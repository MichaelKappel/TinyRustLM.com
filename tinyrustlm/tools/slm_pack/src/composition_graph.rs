//! Strict control-plane authoring for immutable `ACG1` composition graphs.

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::ffi::OsString;
#[cfg(unix)]
use std::fs::File;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tinyrustlm_runtime::active_composition::ActiveCompositionBundle;
use tinyrustlm_runtime::content_identity::{ArtifactKind, ContentId, Digest32, ExecutionBindings};
use tinyrustlm_runtime::model::Model;

const AUTHORITY_SCHEMA: &str = "tinyrustlm.active_composition_authority.v1";
const MAX_AUTHORITY_BYTES: u64 = 64 * 1024;
const MAX_MEMBER_COUNT: usize = 64;
const MAX_BUNDLE_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CompositionAuthority {
    schema: String,
    composition_semantics: AuthoritySemantics,
    model: ModelAuthority,
    execution_bindings: ExecutionBindingAuthority,
    route_policy_id: String,
    members: Vec<MemberAuthority>,
}

#[derive(Clone, Copy, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
enum AuthoritySemantics {
    BaseOnly,
    Additive,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ModelAuthority {
    bytes: u64,
    sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ExecutionBindingAuthority {
    tokenizer_sha256: String,
    chat_template_sha256: String,
    tensor_layout_sha256: String,
    quantization_profile_sha256: String,
    execution_profile_sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct MemberAuthority {
    path: String,
    bytes: u64,
    sha256: String,
}

/// Public-safe identities emitted after one graph is durably authored.
#[derive(Debug)]
pub(crate) struct CompositionGraphOutcome {
    pub(crate) bundle_sha256: String,
    pub(crate) composition_id: String,
    pub(crate) active_graph_digest: String,
}

/// Authors one graph from an exact model and explicit control-plane authority.
pub(crate) fn write_path(
    model_path: &Path,
    authority_path: &Path,
    output_path: &Path,
) -> io::Result<CompositionGraphOutcome> {
    require_output_path(output_path)?;
    let authority_bytes =
        read_bounded_file(authority_path, MAX_AUTHORITY_BYTES, "composition authority")?;
    let authority: CompositionAuthority =
        serde_json::from_slice(&authority_bytes).map_err(|error| {
            invalid(&format!(
                "composition authority is not strict schema JSON: {error}"
            ))
        })?;
    if authority.schema != AUTHORITY_SCHEMA {
        return Err(invalid("composition authority schema is unsupported"));
    }
    validate_semantics(&authority)?;

    let model_metadata = fs::metadata(model_path)?;
    if !model_metadata.is_file() || model_metadata.len() != authority.model.bytes {
        return Err(invalid(
            "composition authority model byte count does not match",
        ));
    }
    let model_bytes = fs::read(model_path)?;
    let expected_model_sha256 = parse_digest(&authority.model.sha256, "model SHA-256")?;
    if sha256_bytes(&model_bytes) != expected_model_sha256 {
        return Err(invalid(
            "composition authority model SHA-256 does not match",
        ));
    }
    let model = Model::load(&model_bytes).map_err(runtime_error)?;
    if model.model_bytes() != authority.model.bytes || model.model_sha256() != expected_model_sha256
    {
        return Err(invalid("loaded model identity does not match authority"));
    }

    let bindings = ExecutionBindings::new(
        parse_digest(
            &authority.execution_bindings.tokenizer_sha256,
            "tokenizer SHA-256",
        )?,
        parse_digest(
            &authority.execution_bindings.chat_template_sha256,
            "chat-template SHA-256",
        )?,
        parse_digest(
            &authority.execution_bindings.tensor_layout_sha256,
            "tensor-layout SHA-256",
        )?,
        parse_digest(
            &authority.execution_bindings.quantization_profile_sha256,
            "quantization-profile SHA-256",
        )?,
        parse_digest(
            &authority.execution_bindings.execution_profile_sha256,
            "execution-profile SHA-256",
        )?,
    )
    .map_err(runtime_error)?;
    let route_policy_id =
        ContentId::parse_display(&authority.route_policy_id).map_err(runtime_error)?;
    if route_policy_id.kind() != ArtifactKind::RoutePolicy {
        return Err(invalid(
            "composition authority routePolicyId is not a route identity",
        ));
    }

    let mut package_bytes = Vec::new();
    package_bytes
        .try_reserve_exact(authority.members.len())
        .map_err(|_| invalid("composition member allocation failed"))?;
    let mut member_paths = HashSet::new();
    let mut member_hashes = HashSet::new();
    let mut total_member_bytes = 0u64;
    for member in &authority.members {
        if member.bytes == 0 {
            return Err(invalid("composition member byte count must be positive"));
        }
        total_member_bytes = total_member_bytes
            .checked_add(member.bytes)
            .filter(|value| *value <= MAX_BUNDLE_BYTES)
            .ok_or_else(|| invalid("composition member byte budget is invalid"))?;
        let member_path = resolve_member_path(authority_path, &member.path)?;
        if !member_paths.insert(member_path.clone()) {
            return Err(invalid("composition authority repeats a member path"));
        }
        let expected_sha256 = parse_digest(&member.sha256, "member SHA-256")?;
        if !member_hashes.insert(expected_sha256) {
            return Err(invalid("composition authority repeats a member hash"));
        }
        let metadata = fs::metadata(&member_path)?;
        if !metadata.is_file() || metadata.len() != member.bytes {
            return Err(invalid("composition member byte count does not match"));
        }
        let bytes = fs::read(&member_path)?;
        if sha256_bytes(&bytes) != expected_sha256 {
            return Err(invalid("composition member SHA-256 does not match"));
        }
        package_bytes.push(bytes);
    }
    let package_refs = package_bytes.iter().map(Vec::as_slice).collect::<Vec<_>>();
    let bundle = ActiveCompositionBundle::build(&model, bindings, route_policy_id, &package_refs)
        .map_err(runtime_error)?;
    write_new_atomic(output_path, bundle.bytes())?;
    let persisted = fs::read(output_path)?;
    if persisted != bundle.bytes() || sha256_bytes(&persisted) != bundle.sha256() {
        return Err(invalid(
            "persisted composition graph failed exact readback validation",
        ));
    }

    Ok(CompositionGraphOutcome {
        bundle_sha256: hex(bundle.sha256()),
        composition_id: bundle.composition_id().display(),
        active_graph_digest: hex(bundle.active_graph_digest()),
    })
}

/// Copies one bounded canonical graph into a new same-directory atomic destination.
pub(crate) fn stage_path(source_path: &Path, output_path: &Path) -> io::Result<String> {
    require_output_path(output_path)?;
    let bytes = read_bounded_file(source_path, MAX_BUNDLE_BYTES, "composition graph")?;
    if bytes.len() < 512 || !bytes.len().is_multiple_of(64) || bytes.get(0..4) != Some(b"ACG1") {
        return Err(invalid("composition graph envelope is invalid"));
    }
    let sha256 = sha256_bytes(&bytes);
    write_new_atomic(output_path, &bytes)?;
    let persisted = fs::read(output_path)?;
    if persisted != bytes || sha256_bytes(&persisted) != sha256 {
        return Err(invalid(
            "staged composition graph failed exact readback validation",
        ));
    }
    Ok(hex(sha256))
}

fn validate_semantics(authority: &CompositionAuthority) -> io::Result<()> {
    if authority.members.len() > MAX_MEMBER_COUNT
        || (authority.composition_semantics == AuthoritySemantics::BaseOnly
            && !authority.members.is_empty())
        || (authority.composition_semantics == AuthoritySemantics::Additive
            && authority.members.is_empty())
    {
        return Err(invalid(
            "composition semantics and member cardinality do not agree",
        ));
    }
    Ok(())
}

fn require_output_path(path: &Path) -> io::Result<()> {
    if path.extension().and_then(|value| value.to_str()) != Some("acg1")
        || path.file_name().is_none()
    {
        return Err(invalid(
            "composition graph output must have the exact .acg1 extension",
        ));
    }
    if path.try_exists()? {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "composition graph output already exists",
        ));
    }
    let parent = path
        .parent()
        .filter(|value| !value.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    if !parent.is_dir() {
        return Err(invalid(
            "composition graph output parent directory does not exist",
        ));
    }
    Ok(())
}

fn read_bounded_file(path: &Path, maximum: u64, label: &str) -> io::Result<Vec<u8>> {
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > maximum {
        return Err(invalid(&format!("{label} byte count is invalid")));
    }
    let bytes = fs::read(path)?;
    if u64::try_from(bytes.len()).map_err(|_| invalid(&format!("{label} is too large")))?
        != metadata.len()
    {
        return Err(invalid(&format!("{label} changed while it was read")));
    }
    Ok(bytes)
}

fn resolve_member_path(authority_path: &Path, value: &str) -> io::Result<PathBuf> {
    let relative = Path::new(value);
    if value.is_empty()
        || relative.is_absolute()
        || relative.extension().and_then(|item| item.to_str()) != Some("slo1")
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(invalid(
            "composition member path must be a normal relative .slo1 path",
        ));
    }
    let root = authority_path
        .parent()
        .filter(|value| !value.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let canonical_root = fs::canonicalize(root)?;
    let mut candidate = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err(invalid("composition member path component is invalid"));
        };
        candidate.push(name);
        let metadata = fs::symlink_metadata(&candidate)?;
        if is_link_or_reparse(&metadata) {
            return Err(invalid(
                "composition member path contains a link or reparse point",
            ));
        }
    }
    let canonical_candidate = fs::canonicalize(&candidate)?;
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(invalid(
            "composition member path escapes the authority directory",
        ));
    }
    Ok(canonical_candidate)
}

fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }
    false
}

fn write_new_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .filter(|value| !value.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .ok_or_else(|| invalid("composition graph output file name is missing"))?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| invalid("system clock is before the Unix epoch"))?
        .as_nanos();
    let mut temporary_name = OsString::from(".");
    temporary_name.push(file_name);
    temporary_name.push(format!(".{}.{}.tmp", std::process::id(), nonce));
    let temporary_path = parent.join(temporary_name);
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary_path, path)?;
        sync_parent_directory(parent)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

#[cfg(unix)]
fn sync_parent_directory(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(not(unix))]
fn sync_parent_directory(_path: &Path) -> io::Result<()> {
    Ok(())
}

fn parse_digest(value: &str, label: &str) -> io::Result<Digest32> {
    if value.len() != 64 {
        return Err(invalid(&format!(
            "{label} must contain 64 lowercase hex digits"
        )));
    }
    let mut digest = [0u8; 32];
    for (index, output) in digest.iter_mut().enumerate() {
        let offset = index * 2;
        let high = decode_hex(value.as_bytes()[offset])
            .ok_or_else(|| invalid(&format!("{label} is not lowercase hexadecimal")))?;
        let low = decode_hex(value.as_bytes()[offset + 1])
            .ok_or_else(|| invalid(&format!("{label} is not lowercase hexadecimal")))?;
        *output = (high << 4) | low;
    }
    if digest == [0; 32] {
        return Err(invalid(&format!("{label} cannot be the zero digest")));
    }
    Ok(digest)
}

fn decode_hex(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        _ => None,
    }
}

fn sha256_bytes(bytes: &[u8]) -> Digest32 {
    Sha256::digest(bytes).into()
}

fn hex(value: Digest32) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn runtime_error(error: tinyrustlm_runtime::ErrorCode) -> io::Error {
    invalid(&format!(
        "runtime rejected composition graph input: {}",
        error.message()
    ))
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tinyrustlm_runtime::active_composition::ActiveComposition;

    #[test]
    fn strict_authority_authors_and_revalidates_one_base_graph() {
        let root = temp_root("base");
        fs::create_dir_all(&root).unwrap();
        let model_path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../models/tiny-test-model-q8.slm");
        let model_bytes = fs::read(&model_path).unwrap();
        let authority_path = root.join("authority.json");
        let output_path = root.join("base.acg1");
        fs::write(
            &authority_path,
            base_authority(&model_bytes, "base-only", "[]", ""),
        )
        .unwrap();

        let outcome = write_path(&model_path, &authority_path, &output_path).unwrap();
        let persisted = fs::read(&output_path).unwrap();
        assert_eq!(outcome.bundle_sha256, hex(sha256_bytes(&persisted)));
        assert!(outcome.composition_id.starts_with("composition-sha256-"));
        assert_eq!(outcome.active_graph_digest.len(), 64);
        let model = Model::load(&model_bytes).unwrap();
        let digest = parse_digest(&outcome.bundle_sha256, "bundle").unwrap();
        assert!(ActiveComposition::parse(&persisted, digest, &model).is_ok());

        let error = write_path(&model_path, &authority_path, &output_path).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn strict_authority_rejects_unknown_fields_and_identity_drift_without_output() {
        let root = temp_root("reject");
        fs::create_dir_all(&root).unwrap();
        let model_path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../models/tiny-test-model-q8.slm");
        let model_bytes = fs::read(&model_path).unwrap();
        let authority_path = root.join("authority.json");
        let output_path = root.join("base.acg1");
        fs::write(
            &authority_path,
            base_authority(&model_bytes, "base-only", "[]", ",\"unknown\":true"),
        )
        .unwrap();
        assert!(write_path(&model_path, &authority_path, &output_path).is_err());
        assert!(!output_path.exists());

        let mut drifted = base_authority(&model_bytes, "base-only", "[]", "");
        let model_hash = hex(sha256_bytes(&model_bytes));
        drifted = drifted.replace(&model_hash, &"11".repeat(32));
        fs::write(&authority_path, drifted).unwrap();
        assert!(write_path(&model_path, &authority_path, &output_path).is_err());
        assert!(!output_path.exists());
        fs::remove_dir_all(root).unwrap();
    }

    fn base_authority(model_bytes: &[u8], semantics: &str, members: &str, extra: &str) -> String {
        format!(
            "{{\
\"schema\":\"{AUTHORITY_SCHEMA}\",\
\"compositionSemantics\":\"{semantics}\",\
\"model\":{{\"bytes\":{},\"sha256\":\"{}\"}},\
\"executionBindings\":{{\
\"tokenizerSha256\":\"{}\",\
\"chatTemplateSha256\":\"{}\",\
\"tensorLayoutSha256\":\"{}\",\
\"quantizationProfileSha256\":\"{}\",\
\"executionProfileSha256\":\"{}\"\
}},\
\"routePolicyId\":\"route-sha256-{}\",\
\"members\":{members}{extra}\
}}",
            model_bytes.len(),
            hex(sha256_bytes(model_bytes)),
            "33".repeat(32),
            "44".repeat(32),
            "55".repeat(32),
            "66".repeat(32),
            "77".repeat(32),
            "88".repeat(32),
        )
    }

    fn temp_root(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "tinyrustlm-composition-graph-{label}-{}-{nanos}",
            std::process::id()
        ))
    }
}

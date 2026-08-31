#![forbid(unsafe_code)]
#![doc = "Strict operator CLI for one exact direct-composition HTTP seed."]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::env;
use std::ffi::OsString;
use std::fs::{self, File, Metadata};
use std::io::{self, Read, Write};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use tinyrustlm_composition2::{
    Acg2Graph, Acg2Policy, MemberRole, ACG2_FORMAT_PROFILE_ID, ACG2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_p2p::{
    CancellationToken, DirectCompositionBrowserOrigin, DirectCompositionDescriptor,
    DirectCompositionHttpServer, DirectCompositionMemberDescriptor, DirectHttpLimits, P2pError,
    DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE, DIRECT_COMPOSITION_MEMBER_NAMES,
    MAXIMUM_DIRECT_ARTIFACT_BYTES, MAXIMUM_DIRECT_COMPOSITION_BYTES,
};

const SEED_DESCRIPTOR_SCHEMA: &str = "tinyrustlm.direct-composition-seed/1";
const MAXIMUM_SEED_DESCRIPTOR_BYTES: usize = 8 * 1024;
const STREAM_BUFFER_BYTES: usize = 64 * 1024;
const EXIT_ARGUMENTS: u8 = 2;
const EXIT_INPUT: u8 = 3;
const EXIT_SERVER: u8 = 4;
const EXIT_OUTPUT: u8 = 5;
const MEMBER_FLAGS: [&str; 6] = [
    "--model",
    "--tokenizer",
    "--template",
    "--sampling",
    "--prompt",
    "--composition",
];
const GRAPH_MEMBER_ROLES: [MemberRole; 5] = [
    MemberRole::Model,
    MemberRole::Tokenizer,
    MemberRole::Template,
    MemberRole::Sampling,
    MemberRole::Prompt,
];

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SeedDescriptor {
    schema: String,
    protocol: String,
    composition_profile: String,
    composition_profile_sha256: String,
    composition_id: String,
    members: Vec<SeedMember>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SeedMember {
    name: String,
    bytes: u64,
    sha256: String,
}

struct CliArguments {
    descriptor_path: PathBuf,
    bind_address: SocketAddr,
    allowed_origin: DirectCompositionBrowserOrigin,
    member_paths: [PathBuf; 6],
}

enum Command {
    Help,
    Serve(Box<CliArguments>),
}

#[derive(Clone, Copy)]
struct CliError {
    code: &'static str,
    exit_code: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Readiness<'a> {
    protocol: &'a str,
    composition_id: &'a str,
    bound_origin: String,
    allowed_browser_origin: &'a str,
}

#[derive(Serialize)]
struct Failure<'a> {
    error: &'a str,
}

impl CliError {
    /// Creates one bounded public-safe CLI failure.
    const fn new(code: &'static str, exit_code: u8) -> Self {
        Self { code, exit_code }
    }

    /// Preserves one stable transport failure code at the server exit boundary.
    const fn from_p2p(error: P2pError) -> Self {
        Self::new(error.code(), EXIT_SERVER)
    }
}

/// Parses, verifies, binds, reports readiness, and serves one exact composition.
fn run(arguments: CliArguments) -> Result<(), CliError> {
    let descriptor_bytes = read_bounded_regular_file(
        &arguments.descriptor_path,
        MAXIMUM_SEED_DESCRIPTOR_BYTES,
        "p2p-seed-descriptor-type",
        "p2p-seed-descriptor-size",
    )?;
    let descriptor = parse_canonical_descriptor(&descriptor_bytes)?;
    validate_descriptor(&descriptor)?;
    let direct_descriptor = verify_members(&descriptor, &arguments.member_paths)?;

    let cancellation = CancellationToken::new();
    let server = DirectCompositionHttpServer::bind_with_origin(
        arguments.bind_address,
        direct_descriptor,
        arguments.allowed_origin,
        DirectHttpLimits::default(),
        &cancellation,
    )
    .map_err(CliError::from_p2p)?;
    emit_readiness(
        server.local_addr(),
        server.composition_id(),
        server.allowed_browser_origin(),
    )?;
    server.serve(&cancellation).map_err(CliError::from_p2p)
}

/// Accepts only the closed flag surface with every required value exactly once.
fn parse_arguments(values: impl IntoIterator<Item = OsString>) -> Result<Command, CliError> {
    let mut values = values.into_iter();
    let _program = values.next();
    let remaining = values.collect::<Vec<_>>();
    if remaining.len() == 1 && remaining[0] == "--help" {
        return Ok(Command::Help);
    }
    if remaining.is_empty() || remaining.iter().any(|value| value == "--help") {
        return Err(CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS));
    }

    let mut descriptor_path = None;
    let mut bind_address = None;
    let mut allowed_origin = None;
    let mut member_paths: [Option<PathBuf>; 6] = std::array::from_fn(|_| None);
    let mut index = 0;
    while index < remaining.len() {
        let flag = remaining[index]
            .to_str()
            .ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
        let value = remaining
            .get(index + 1)
            .ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
        match flag {
            "--descriptor" if descriptor_path.is_none() => {
                descriptor_path = Some(PathBuf::from(value));
            }
            "--bind" if bind_address.is_none() => {
                let text = value
                    .to_str()
                    .ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
                bind_address = Some(
                    text.parse::<SocketAddr>()
                        .map_err(|_| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?,
                );
            }
            "--allow-origin" if allowed_origin.is_none() => {
                let text = value
                    .to_str()
                    .ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
                allowed_origin = Some(
                    DirectCompositionBrowserOrigin::parse(text)
                        .map_err(|error| CliError::new(error.code(), EXIT_ARGUMENTS))?,
                );
            }
            _ => {
                let Some(member_index) = MEMBER_FLAGS.iter().position(|expected| *expected == flag)
                else {
                    return Err(CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS));
                };
                if member_paths[member_index].is_some() {
                    return Err(CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS));
                }
                member_paths[member_index] = Some(PathBuf::from(value));
            }
        }
        index += 2;
    }

    let descriptor_path = descriptor_path
        .filter(|path| !path.as_os_str().is_empty())
        .ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
    let bind_address =
        bind_address.ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
    let allowed_origin = allowed_origin.unwrap_or_else(DirectCompositionBrowserOrigin::production);
    let member_paths = member_paths
        .into_iter()
        .collect::<Option<Vec<_>>>()
        .and_then(|paths| paths.try_into().ok())
        .ok_or_else(|| CliError::new("p2p-seed-arguments", EXIT_ARGUMENTS))?;
    Ok(Command::Serve(Box::new(CliArguments {
        descriptor_path,
        bind_address,
        allowed_origin,
        member_paths,
    })))
}

/// Parses the sole canonical compact-JSON wire representation.
fn parse_canonical_descriptor(bytes: &[u8]) -> Result<SeedDescriptor, CliError> {
    let descriptor = serde_json::from_slice::<SeedDescriptor>(bytes)
        .map_err(|_| CliError::new("p2p-seed-descriptor-json", EXIT_INPUT))?;
    let mut canonical = serde_json::to_vec(&descriptor)
        .map_err(|_| CliError::new("p2p-seed-descriptor-json", EXIT_INPUT))?;
    canonical.push(b'\n');
    if canonical != bytes {
        return Err(CliError::new("p2p-seed-descriptor-canonical", EXIT_INPUT));
    }
    Ok(descriptor)
}

/// Validates the closed descriptor schema, profiles, identities, and member order.
fn validate_descriptor(descriptor: &SeedDescriptor) -> Result<(), CliError> {
    if descriptor.schema != SEED_DESCRIPTOR_SCHEMA
        || descriptor.protocol != DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE
        || descriptor.composition_profile != ACG2_FORMAT_PROFILE_ID
        || descriptor.composition_profile_sha256 != ACG2_FORMAT_PROFILE_SHA256
        || !valid_content_id(&descriptor.composition_id)
        || descriptor.members.len() != DIRECT_COMPOSITION_MEMBER_NAMES.len()
    {
        return Err(CliError::new("p2p-seed-descriptor-contract", EXIT_INPUT));
    }

    let mut total_bytes = 0_u64;
    for (index, member) in descriptor.members.iter().enumerate() {
        if member.name != DIRECT_COMPOSITION_MEMBER_NAMES[index]
            || member.bytes == 0
            || member.bytes > MAXIMUM_DIRECT_ARTIFACT_BYTES
            || !valid_sha256(&member.sha256)
            || (index == 5
                && member.bytes != Acg2Policy::exact_profile_limits().maximum_artifact_bytes())
        {
            return Err(CliError::new("p2p-seed-descriptor-member", EXIT_INPUT));
        }
        total_bytes = total_bytes
            .checked_add(member.bytes)
            .ok_or_else(|| CliError::new("p2p-seed-descriptor-member", EXIT_INPUT))?;
        if total_bytes > MAXIMUM_DIRECT_COMPOSITION_BYTES {
            return Err(CliError::new("p2p-seed-descriptor-member", EXIT_INPUT));
        }
    }
    Ok(())
}

/// Independently verifies all local files and their exact ACG2 graph closure.
fn verify_members(
    descriptor: &SeedDescriptor,
    paths: &[PathBuf; 6],
) -> Result<DirectCompositionDescriptor, CliError> {
    let mut canonical_paths = HashSet::with_capacity(paths.len());
    let mut direct_members = Vec::with_capacity(paths.len());
    let mut composition_bytes = None;

    for (index, (member, path)) in descriptor.members.iter().zip(paths).enumerate() {
        if path.file_name().and_then(|name| name.to_str()) != Some(member.name.as_str()) {
            return Err(CliError::new("p2p-seed-member-name", EXIT_INPUT));
        }
        let canonical_path = fs::canonicalize(path)
            .map_err(|_| CliError::new("p2p-seed-member-type", EXIT_INPUT))?;
        if !canonical_paths.insert(canonical_path) {
            return Err(CliError::new("p2p-seed-member-name", EXIT_INPUT));
        }
        let captured = verify_member_file(path, member, index == 5)?;
        if index == 5 {
            composition_bytes = captured;
        }
        direct_members.push(DirectCompositionMemberDescriptor {
            file_name: member.name.clone(),
            path: path.clone(),
            artifact_bytes: member.bytes,
            artifact_id: format!("sha256:{}", member.sha256),
        });
    }

    let composition_bytes = composition_bytes
        .ok_or_else(|| CliError::new("p2p-seed-composition-closure", EXIT_INPUT))?;
    verify_composition_closure(descriptor, &composition_bytes)?;
    let members = direct_members
        .try_into()
        .map_err(|_| CliError::new("p2p-seed-descriptor-member", EXIT_INPUT))?;
    Ok(DirectCompositionDescriptor {
        composition_id: descriptor.composition_id.clone(),
        members,
    })
}

/// Streams and hashes one exact regular member, capturing only the 896-byte ACG2 file.
fn verify_member_file(
    path: &Path,
    member: &SeedMember,
    capture: bool,
) -> Result<Option<Vec<u8>>, CliError> {
    let metadata = regular_file_metadata(path, "p2p-seed-member-type")?;
    if metadata.len() != member.bytes {
        return Err(CliError::new("p2p-seed-member-length", EXIT_INPUT));
    }
    let mut source =
        File::open(path).map_err(|_| CliError::new("p2p-seed-member-type", EXIT_INPUT))?;
    if source
        .metadata()
        .map_err(|_| CliError::new("p2p-seed-member-type", EXIT_INPUT))?
        .len()
        != member.bytes
    {
        return Err(CliError::new("p2p-seed-member-length", EXIT_INPUT));
    }

    let mut captured = capture.then(|| Vec::with_capacity(member.bytes as usize));
    let mut hasher = Sha256::new();
    let mut remaining = member.bytes;
    let mut buffer = [0_u8; STREAM_BUFFER_BYTES];
    while remaining != 0 {
        let requested = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| CliError::new("p2p-seed-member-length", EXIT_INPUT))?;
        let count = source
            .read(&mut buffer[..requested])
            .map_err(|_| CliError::new("p2p-seed-member-type", EXIT_INPUT))?;
        if count == 0 {
            return Err(CliError::new("p2p-seed-member-length", EXIT_INPUT));
        }
        hasher.update(&buffer[..count]);
        if let Some(bytes) = captured.as_mut() {
            bytes.extend_from_slice(&buffer[..count]);
        }
        remaining -= count as u64;
    }
    let mut trailing = [0_u8; 1];
    if source
        .read(&mut trailing)
        .map_err(|_| CliError::new("p2p-seed-member-type", EXIT_INPUT))?
        != 0
    {
        return Err(CliError::new("p2p-seed-member-length", EXIT_INPUT));
    }
    if hex_lower(&hasher.finalize()) != member.sha256 {
        return Err(CliError::new("p2p-seed-member-hash", EXIT_INPUT));
    }
    Ok(captured)
}

/// Parses ACG2 under its exact profile and rebinds every descriptor member identity.
fn verify_composition_closure(
    descriptor: &SeedDescriptor,
    composition_bytes: &[u8],
) -> Result<(), CliError> {
    let graph = Acg2Graph::from_bytes(composition_bytes, Acg2Policy::exact_profile_limits())
        .map_err(|_| CliError::new("p2p-seed-composition-closure", EXIT_INPUT))?;
    let identity = graph.identity();
    if descriptor.composition_id != content_id(&identity.graph_identity_sha256)
        || descriptor.members[5].bytes != identity.artifact_bytes
        || descriptor.members[5].sha256 != hex_lower(&identity.artifact_sha256)
    {
        return Err(CliError::new("p2p-seed-composition-closure", EXIT_INPUT));
    }
    for (index, role) in GRAPH_MEMBER_ROLES.into_iter().enumerate() {
        let graph_member = graph.member(role);
        if descriptor.members[index].bytes != graph_member.artifact_bytes()
            || descriptor.members[index].sha256 != hex_lower(&graph_member.artifact_sha256())
        {
            return Err(CliError::new("p2p-seed-composition-closure", EXIT_INPUT));
        }
    }
    Ok(())
}

/// Reads one bounded non-reparse regular file without trusting its path in output.
fn read_bounded_regular_file(
    path: &Path,
    maximum_bytes: usize,
    type_error: &'static str,
    size_error: &'static str,
) -> Result<Vec<u8>, CliError> {
    let metadata = regular_file_metadata(path, type_error)?;
    if metadata.len() == 0 || metadata.len() > maximum_bytes as u64 {
        return Err(CliError::new(size_error, EXIT_INPUT));
    }
    let mut source = File::open(path).map_err(|_| CliError::new(type_error, EXIT_INPUT))?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    Read::take(&mut source, maximum_bytes as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| CliError::new(type_error, EXIT_INPUT))?;
    if bytes.len() as u64 != metadata.len() || bytes.len() > maximum_bytes {
        return Err(CliError::new(size_error, EXIT_INPUT));
    }
    Ok(bytes)
}

/// Requires one final-path regular file and rejects Windows reparse points or symlinks.
fn regular_file_metadata(path: &Path, code: &'static str) -> Result<Metadata, CliError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| CliError::new(code, EXIT_INPUT))?;
    if !metadata.file_type().is_file() || path_is_reparse(&metadata) {
        return Err(CliError::new(code, EXIT_INPUT));
    }
    Ok(metadata)
}

#[cfg(windows)]
/// Returns whether Windows marks the final path as a reparse point.
fn path_is_reparse(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
/// Returns whether the final path is a symbolic link on non-Windows targets.
fn path_is_reparse(metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink()
}

/// Emits exactly one bounded public-safe readiness JSON line and flushes it.
fn emit_readiness(
    address: SocketAddr,
    composition_id: &str,
    allowed_browser_origin: &str,
) -> Result<(), CliError> {
    let readiness = Readiness {
        protocol: DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE,
        composition_id,
        bound_origin: format!("http://{address}"),
        allowed_browser_origin,
    };
    let stdout = io::stdout();
    let mut output = stdout.lock();
    serde_json::to_writer(&mut output, &readiness)
        .map_err(|_| CliError::new("p2p-seed-readiness", EXIT_OUTPUT))?;
    output
        .write_all(b"\n")
        .and_then(|()| output.flush())
        .map_err(|_| CliError::new("p2p-seed-readiness", EXIT_OUTPUT))
}

/// Emits one stable error code without paths, addresses, or underlying diagnostics.
fn emit_failure(error: CliError) {
    let stderr = io::stderr();
    let mut output = stderr.lock();
    let _ = serde_json::to_writer(&mut output, &Failure { error: error.code });
    let _ = output.write_all(b"\n");
}

/// Prints the closed CLI and canonical descriptor contract without environment defaults.
fn emit_help() -> Result<(), CliError> {
    let text = concat!(
        "tinyrustlm-p2p-seed\n",
        "  --descriptor <canonical-seed.json> --bind <ip:port>\n",
        "  [--allow-origin <canonical-http-or-https-origin>]\n",
        "  --model <model.slm2> --tokenizer <tokenizer.tokenizer2>\n",
        "  --template <template.template2> --sampling <sampling.sampling2>\n",
        "  --prompt <prompt.prompt2> --composition <composition.acg2>\n",
        "descriptor schema: tinyrustlm.direct-composition-seed/1\n"
    );
    let stdout = io::stdout();
    let mut output = stdout.lock();
    output
        .write_all(text.as_bytes())
        .and_then(|()| output.flush())
        .map_err(|_| CliError::new("p2p-seed-help", EXIT_OUTPUT))
}

/// Returns whether one string is an exact prefixed lowercase SHA-256 identity.
fn valid_content_id(value: &str) -> bool {
    value.len() == 71 && value.starts_with("sha256:") && valid_sha256(&value[7..])
}

/// Returns whether one string is an exact unprefixed lowercase SHA-256 digest.
fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// Returns one canonical prefixed SHA-256 content ID.
fn content_id(digest: &[u8; 32]) -> String {
    format!("sha256:{}", hex_lower(digest))
}

/// Encodes exact digest bytes as lowercase hexadecimal.
fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

/// Runs the sole explicit command and maps typed failures to stable exit codes.
fn main() -> ExitCode {
    let result = match parse_arguments(env::args_os()) {
        Ok(Command::Help) => emit_help(),
        Ok(Command::Serve(arguments)) => run(*arguments),
        Err(error) => Err(error),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            emit_failure(error);
            ExitCode::from(error.exit_code)
        }
    }
}

use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tinyrustlm_composition2::{Acg2Graph, Acg2Policy, MemberRole};
use tinyrustlm_durability::flush_owned_directory;
use tinyrustlm_slm2::{build_piece_manifest, validate_model, ValidationPolicy, PIECE_BYTES};

use crate::manifest::{finalize_manifest, inspect_manifest, ManifestBindings};
use crate::{
    ArtifactAdmission, ImportedArtifact, P2pError, P2pManifest, PrepareShareKitRequest,
    ShareKitReport, MANIFEST_FILE_NAME, PIECE_DIRECTORY_NAME,
};

const COMPLETE_FILE_NAME: &str = ".complete";
const OWNED_STAGE_MARKER: &str = ".tinyrustlm-p2p-owned-stage";
const OWNED_STAGE_MARKER_BYTES: &[u8] = b"tinyrustlm-p2p-owned-stage/1\n";
const MAXIMUM_ACG2_BYTES: u64 = 896;
const COPY_BUFFER_BYTES: usize = 1024 * 1024;
const MAXIMUM_STAGE_ATTEMPTS: u64 = 32;
static STAGE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct AdmittedArtifact {
    artifact_bytes: u64,
    artifact_sha256: String,
    composition_artifact_ids: Vec<String>,
}

/// Creates one bounded, content-addressed, create-only local share kit.
pub fn prepare_share_kit(request: PrepareShareKitRequest) -> Result<ShareKitReport, P2pError> {
    let mut artifact = open_regular_file(&request.artifact_path)?;
    let admitted = admit_artifact(&request.artifact_path, &mut artifact, &request.admission)?;
    let piece_manifest =
        build_piece_manifest(&mut artifact).map_err(|error| P2pError::new(error.code()))?;
    if admitted.artifact_bytes != piece_manifest.artifact_byte_length()
        || admitted.artifact_sha256 != piece_manifest.artifact_sha256_hex()
    {
        return Err(P2pError::new("p2p-source-drift"));
    }
    let (manifest, manifest_bytes) = finalize_manifest(
        &piece_manifest,
        ManifestBindings {
            artifact_manifest_id: &request.artifact_manifest_id,
            qualification_receipt_id: &request.qualification_receipt_id,
            provenance_receipt_id: &request.provenance_receipt_id,
            license_expression: &request.license_expression,
            created_at_utc: &request.created_at_utc,
            composition_artifact_ids: admitted.composition_artifact_ids,
        },
    )?;

    let mut stage = OwnedStage::create(&request.output_directory)?;
    let piece_directory = stage.path().join(PIECE_DIRECTORY_NAME);
    fs::create_dir(&piece_directory).map_err(|_| P2pError::new("p2p-io"))?;
    artifact
        .seek(SeekFrom::Start(0))
        .map_err(|_| P2pError::new("p2p-io"))?;
    write_verified_pieces(&mut artifact, &piece_directory, &manifest)?;
    sync_directory(&piece_directory)?;
    write_new_synced(&stage.path().join(MANIFEST_FILE_NAME), &manifest_bytes)?;
    write_new_synced(
        &stage.path().join(COMPLETE_FILE_NAME),
        format!("{}\n", manifest.manifest_id).as_bytes(),
    )?;
    sync_directory(stage.path())?;
    let output_directory = stage.promote(&request.output_directory)?;
    Ok(ShareKitReport {
        manifest_path: output_directory.join(MANIFEST_FILE_NAME),
        piece_directory: output_directory.join(PIECE_DIRECTORY_NAME),
        output_directory,
        manifest,
    })
}

/// Assembles, verifies, semantically admits, and atomically promotes one artifact.
pub fn assemble_from_piece_directory(
    manifest_bytes: &[u8],
    piece_directory: &Path,
    output_path: &Path,
    admission: &ArtifactAdmission,
) -> Result<ImportedArtifact, P2pError> {
    let manifest = inspect_manifest(manifest_bytes)?;
    let piece_root = canonical_regular_directory(piece_directory)?;
    let mut staging = OwnedFile::create(output_path)?;
    let mut complete_hasher = Sha256::new();
    let mut complete_bytes = 0_u64;
    let mut buffer = vec![0_u8; COPY_BUFFER_BYTES];
    for piece in &manifest.pieces {
        let path = piece_root.join(piece_file_name(piece.index)?);
        let mut source = open_regular_file(&path)?;
        let metadata = source.metadata().map_err(|_| P2pError::new("p2p-io"))?;
        if metadata.len() != piece.length {
            return Err(P2pError::new("p2p-piece-length"));
        }
        let mut piece_hasher = Sha256::new();
        let copied = copy_exact(
            &mut source,
            staging.file_mut(),
            piece.length,
            &mut buffer,
            &mut piece_hasher,
            &mut complete_hasher,
        )?;
        if copied != piece.length || hex_lower(&piece_hasher.finalize()) != piece.sha256 {
            return Err(P2pError::new("p2p-piece-hash"));
        }
        complete_bytes = complete_bytes
            .checked_add(copied)
            .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
    }
    if complete_bytes != manifest.artifact_bytes
        || hex_lower(&complete_hasher.finalize()) != manifest.artifact_sha256
    {
        return Err(P2pError::new("p2p-artifact-hash"));
    }
    staging
        .file_mut()
        .sync_all()
        .map_err(|_| P2pError::new("p2p-io"))?;
    let staging_path = staging.path().to_path_buf();
    let admitted = admit_artifact(&staging_path, staging.file_mut(), admission)?;
    if admitted.artifact_bytes != manifest.artifact_bytes
        || admitted.artifact_sha256 != manifest.artifact_sha256
        || admitted.composition_artifact_ids != manifest.composition_artifact_ids
    {
        return Err(P2pError::new("p2p-admission-binding"));
    }
    let output_path = staging.promote(output_path)?;
    Ok(ImportedArtifact {
        output_path,
        manifest_id: manifest.manifest_id,
        artifact_sha256: manifest.artifact_sha256,
        artifact_bytes: manifest.artifact_bytes,
    })
}

fn admit_artifact(
    artifact_path: &Path,
    artifact: &mut File,
    admission: &ArtifactAdmission,
) -> Result<AdmittedArtifact, P2pError> {
    match admission {
        ArtifactAdmission::Slm2Model { composition_path } => {
            let model = validate_model(artifact, ValidationPolicy::default())
                .map_err(|error| P2pError::new(error.code()))?;
            let graph = read_acg2(composition_path)?;
            let member = graph.member(MemberRole::Model);
            if member.artifact_bytes() != model.identity().byte_length()
                || member.artifact_sha256() != *model.identity().artifact_sha256()
            {
                return Err(P2pError::new("p2p-composition-model-binding"));
            }
            Ok(AdmittedArtifact {
                artifact_bytes: model.identity().byte_length(),
                artifact_sha256: model.identity().artifact_sha256_hex(),
                composition_artifact_ids: vec![content_id(&graph.identity().artifact_sha256)],
            })
        }
        ArtifactAdmission::Acg2Composition => {
            let graph = read_acg2(artifact_path)?;
            Ok(AdmittedArtifact {
                artifact_bytes: graph.identity().artifact_bytes,
                artifact_sha256: hex_lower(&graph.identity().artifact_sha256),
                composition_artifact_ids: Vec::new(),
            })
        }
    }
}

fn read_acg2(path: &Path) -> Result<Acg2Graph, P2pError> {
    let mut source = open_regular_file(path)?;
    let metadata = source.metadata().map_err(|_| P2pError::new("p2p-io"))?;
    if metadata.len() == 0 || metadata.len() > MAXIMUM_ACG2_BYTES {
        return Err(P2pError::new("acg2-artifact-limit"));
    }
    let capacity = usize::try_from(metadata.len()).map_err(|_| P2pError::new("p2p-arithmetic"))?;
    let mut bytes = Vec::with_capacity(capacity);
    source
        .read_to_end(&mut bytes)
        .map_err(|_| P2pError::new("p2p-io"))?;
    Acg2Graph::from_bytes(&bytes, Acg2Policy::exact_profile_limits())
        .map_err(|error| P2pError::new(error.code()))
}

fn write_verified_pieces(
    source: &mut File,
    piece_directory: &Path,
    manifest: &P2pManifest,
) -> Result<(), P2pError> {
    let mut buffer = vec![0_u8; PIECE_BYTES as usize];
    let mut artifact_hasher = Sha256::new();
    for piece in &manifest.pieces {
        let length = usize::try_from(piece.length).map_err(|_| P2pError::new("p2p-arithmetic"))?;
        source
            .read_exact(&mut buffer[..length])
            .map_err(|_| P2pError::new("p2p-source-drift"))?;
        let bytes = &buffer[..length];
        if hex_lower(&Sha256::digest(bytes)) != piece.sha256 {
            return Err(P2pError::new("p2p-source-drift"));
        }
        artifact_hasher.update(bytes);
        write_new_synced(&piece_directory.join(piece_file_name(piece.index)?), bytes)?;
    }
    let mut trailing = [0_u8; 1];
    if source
        .read(&mut trailing)
        .map_err(|_| P2pError::new("p2p-io"))?
        != 0
        || hex_lower(&artifact_hasher.finalize()) != manifest.artifact_sha256
    {
        return Err(P2pError::new("p2p-source-drift"));
    }
    Ok(())
}

fn copy_exact(
    source: &mut File,
    destination: &mut File,
    expected: u64,
    buffer: &mut [u8],
    piece_hasher: &mut Sha256,
    complete_hasher: &mut Sha256,
) -> Result<u64, P2pError> {
    let mut remaining = expected;
    let mut copied = 0_u64;
    while remaining > 0 {
        let requested = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| P2pError::new("p2p-arithmetic"))?;
        let count = source
            .read(&mut buffer[..requested])
            .map_err(|_| P2pError::new("p2p-io"))?;
        if count == 0 {
            return Err(P2pError::new("p2p-piece-length"));
        }
        destination
            .write_all(&buffer[..count])
            .map_err(|_| P2pError::new("p2p-io"))?;
        piece_hasher.update(&buffer[..count]);
        complete_hasher.update(&buffer[..count]);
        copied = copied
            .checked_add(count as u64)
            .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
        remaining -= count as u64;
    }
    Ok(copied)
}

fn content_id(digest: &[u8; 32]) -> String {
    format!("sha256:{}", hex_lower(digest))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

fn piece_file_name(index: u64) -> Result<String, P2pError> {
    if index >= 16_384 {
        return Err(P2pError::new("p2p-piece-index"));
    }
    Ok(format!("piece-{index:05}.bin"))
}

fn open_regular_file(path: &Path) -> Result<File, P2pError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| P2pError::new("p2p-io"))?;
    if !metadata.file_type().is_file() || path_is_reparse(&metadata) {
        return Err(P2pError::new("p2p-path-type"));
    }
    File::open(path).map_err(|_| P2pError::new("p2p-io"))
}

fn canonical_regular_directory(path: &Path) -> Result<PathBuf, P2pError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| P2pError::new("p2p-io"))?;
    if !metadata.file_type().is_dir() || path_is_reparse(&metadata) {
        return Err(P2pError::new("p2p-path-type"));
    }
    fs::canonicalize(path).map_err(|_| P2pError::new("p2p-io"))
}

#[cfg(windows)]
fn path_is_reparse(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn path_is_reparse(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn write_new_synced(path: &Path, bytes: &[u8]) -> Result<(), P2pError> {
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| P2pError::new("p2p-io"))?;
    output
        .write_all(bytes)
        .map_err(|_| P2pError::new("p2p-io"))?;
    output.sync_all().map_err(|_| P2pError::new("p2p-io"))
}

fn sync_directory(path: &Path) -> Result<(), P2pError> {
    flush_owned_directory(path, Path::new("."), "p2p-directory-commit")
        .map(|_| ())
        .map_err(|error| P2pError::new(error.code()))
}

struct OwnedStage {
    parent: PathBuf,
    path: PathBuf,
    promoted: bool,
}

impl OwnedStage {
    fn create(output: &Path) -> Result<Self, P2pError> {
        if fs::symlink_metadata(output).is_ok() {
            return Err(P2pError::new("p2p-output-exists"));
        }
        let output_name = output
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty() && *name != "." && *name != "..")
            .ok_or_else(|| P2pError::new("p2p-output-path"))?;
        let parent = canonical_regular_directory(
            output
                .parent()
                .ok_or_else(|| P2pError::new("p2p-output-path"))?,
        )?;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| P2pError::new("p2p-clock"))?
            .as_nanos();
        for _ in 0..MAXIMUM_STAGE_ATTEMPTS {
            let sequence = STAGE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = parent.join(format!(
                ".{output_name}.tinyrustlm-stage-{}-{stamp}-{sequence}",
                std::process::id()
            ));
            match fs::create_dir(&path) {
                Ok(()) => {
                    if let Err(error) =
                        write_new_synced(&path.join(OWNED_STAGE_MARKER), OWNED_STAGE_MARKER_BYTES)
                    {
                        let _ = fs::remove_dir(&path);
                        return Err(error);
                    }
                    return Ok(Self {
                        parent,
                        path,
                        promoted: false,
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(_) => return Err(P2pError::new("p2p-io")),
            }
        }
        Err(P2pError::new("p2p-stage-collision"))
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn promote(&mut self, requested_output: &Path) -> Result<PathBuf, P2pError> {
        if fs::symlink_metadata(requested_output).is_ok() {
            return Err(P2pError::new("p2p-output-exists"));
        }
        let output_name = requested_output
            .file_name()
            .ok_or_else(|| P2pError::new("p2p-output-path"))?;
        let output = self.parent.join(output_name);
        fs::rename(&self.path, &output).map_err(|_| P2pError::new("p2p-io"))?;
        sync_directory(&self.parent)?;
        self.promoted = true;
        Ok(output)
    }
}

impl Drop for OwnedStage {
    fn drop(&mut self) {
        if !self.promoted {
            remove_owned_stage(&self.parent, &self.path);
        }
    }
}

fn remove_owned_stage(parent: &Path, path: &Path) {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return;
    };
    if path.parent() != Some(parent)
        || !name.starts_with('.')
        || !name.contains(".tinyrustlm-stage-")
    {
        return;
    }
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return;
    };
    if !metadata.file_type().is_dir() || path_is_reparse(&metadata) {
        return;
    }
    if fs::read(path.join(OWNED_STAGE_MARKER)).ok().as_deref() != Some(OWNED_STAGE_MARKER_BYTES) {
        return;
    }
    let _ = fs::remove_dir_all(path);
}

struct OwnedFile {
    parent: PathBuf,
    path: PathBuf,
    file: Option<File>,
    promoted: bool,
}

impl OwnedFile {
    fn create(output: &Path) -> Result<Self, P2pError> {
        if fs::symlink_metadata(output).is_ok() {
            return Err(P2pError::new("p2p-output-exists"));
        }
        let name = output
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty() && *name != "." && *name != "..")
            .ok_or_else(|| P2pError::new("p2p-output-path"))?;
        let parent = canonical_regular_directory(
            output
                .parent()
                .ok_or_else(|| P2pError::new("p2p-output-path"))?,
        )?;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| P2pError::new("p2p-clock"))?
            .as_nanos();
        for _ in 0..MAXIMUM_STAGE_ATTEMPTS {
            let sequence = STAGE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = parent.join(format!(
                ".{name}.tinyrustlm-partial-{}-{stamp}-{sequence}",
                std::process::id()
            ));
            match OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .open(&path)
            {
                Ok(file) => {
                    return Ok(Self {
                        parent,
                        path,
                        file: Some(file),
                        promoted: false,
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(_) => return Err(P2pError::new("p2p-io")),
            }
        }
        Err(P2pError::new("p2p-stage-collision"))
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn file_mut(&mut self) -> &mut File {
        self.file.as_mut().expect("owned staging file remains open")
    }

    fn promote(&mut self, output: &Path) -> Result<PathBuf, P2pError> {
        if fs::symlink_metadata(output).is_ok() {
            return Err(P2pError::new("p2p-output-exists"));
        }
        self.file.take();
        let name = output
            .file_name()
            .ok_or_else(|| P2pError::new("p2p-output-path"))?;
        let canonical_output = self.parent.join(name);
        fs::rename(&self.path, &canonical_output).map_err(|_| P2pError::new("p2p-io"))?;
        sync_directory(&self.parent)?;
        self.promoted = true;
        Ok(canonical_output)
    }
}

impl Drop for OwnedFile {
    fn drop(&mut self) {
        self.file.take();
        if !self.promoted && self.path.parent() == Some(self.parent.as_path()) {
            let _ = fs::remove_file(&self.path);
        }
    }
}

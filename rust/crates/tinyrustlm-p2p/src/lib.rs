#![forbid(unsafe_code)]
#![doc = "Public metadata-bound P2P share and import workflows for `.slm` artifacts."]

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tinyrustlm_slm::{safe_load_slm_from_path, SlmInspection, SlmLoadPolicy};

/// Manifest schema kind for public TinyRustLM P2P manifests.
pub const P2P_MANIFEST_KIND: &str = "tinyrustlm.p2p_manifest.v0";
/// Share metadata schema kind for public TinyRustLM P2P share metadata.
pub const SHARE_METADATA_KIND: &str = "tinyrustlm.p2p_share_metadata.v0";
/// Announcement schema kind for public TinyRustLM P2P announcements.
pub const ANNOUNCEMENT_KIND: &str = "tinyrustlm.p2p_announcement.v0";
/// Announcement catalog schema kind for local public SDK catalogs.
pub const ANNOUNCEMENT_CATALOG_KIND: &str = "tinyrustlm.p2p_announcement_catalog.v0";
/// Announcement catalog inspection schema kind for local public SDK catalogs.
pub const ANNOUNCEMENT_CATALOG_INSPECTION_KIND: &str =
    "tinyrustlm.p2p_announcement_catalog_inspection.v0";
/// Import plan schema kind for public P2P import planning.
pub const IMPORT_PLAN_KIND: &str = "tinyrustlm.p2p_import_plan.v0";
/// Local import receipt schema kind for public verified piece assembly.
pub const LOCAL_IMPORT_RECEIPT_KIND: &str = "tinyrustlm.p2p_local_import_receipt.v0";
/// Local import receipt inspection schema kind for public audit checks.
pub const LOCAL_IMPORT_RECEIPT_INSPECTION_KIND: &str =
    "tinyrustlm.p2p_local_import_receipt_inspection.v0";
/// Signed manifest envelope schema kind for public signature verification.
pub const SIGNED_MANIFEST_KIND: &str = "tinyrustlm.p2p_signed_manifest.v0";
/// Signed manifest verification report schema kind.
pub const SIGNED_MANIFEST_VERIFICATION_KIND: &str =
    "tinyrustlm.p2p_signed_manifest_verification.v0";

const DEFAULT_PIECE_SIZE: u64 = 1024 * 1024;
const MIN_PIECE_SIZE: u64 = 1024;
const MAX_PIECE_SIZE: u64 = 16 * 1024 * 1024;
const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
const MAX_PUBLIC_KEY_BYTES: usize = 16 * 1024;
const MAX_ANNOUNCEMENT_BYTES: usize = 256 * 1024;
const MAX_ANNOUNCEMENT_CATALOG_BYTES: usize = 4 * 1024 * 1024;
const MAX_RECEIPT_BYTES: usize = 256 * 1024;
const SIGNATURE_KIND_EXTERNAL_V0: &str = "external-signature-v0";
const SIGNATURE_ALGORITHM_ED25519: &str = "ed25519";
const SIGNATURE_VALUE_ED25519_BASE64_PREFIX: &str = "ed25519-base64:";
const MINIMODEL_PUBLIC_KEY_KIND_V0: &str = "minimodel.public_key.v0";
const MINIMODEL_MANIFEST_SIGNING_USAGE_V0: &str = "minimodel-manifest-signing-v0";

/// Request used to prepare a local metadata-bound P2P share kit.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PrepareShareKitRequest {
    /// Path to the already-created `.slm` artifact.
    pub model_path: PathBuf,
    /// Output directory that will receive manifest, metadata, and piece files.
    pub output_dir: PathBuf,
    /// Optional stable manifest identifier.
    pub manifest_id: Option<String>,
    /// Optional public model identifier.
    pub model_id: Option<String>,
    /// Optional peer identifier included in generated metadata.
    pub peer_id: Option<String>,
    /// Optional base URL used only in the generated announcement.
    pub public_base_url: Option<String>,
    /// Optional piece size in bytes.
    pub piece_size: Option<u64>,
}

/// One P2P piece record in a manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pPiece {
    /// Zero-based piece index.
    pub index: u32,
    /// Relative route or local path fragment for the piece.
    pub route: String,
    /// Piece byte length.
    pub byte_count: u64,
    /// SHA-256 of the piece bytes.
    pub sha256: String,
}

/// Public metadata-bound P2P manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pManifest {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stable manifest identifier.
    pub manifest_id: String,
    /// Public model identifier.
    pub model_id: String,
    /// Source `.slm` inspection report.
    pub slm: SlmInspection,
    /// Exact artifact SHA-256.
    pub artifact_sha256: String,
    /// Exact artifact byte length.
    pub artifact_byte_count: u64,
    /// Piece size requested by the share kit.
    pub piece_size: u64,
    /// Piece count.
    pub piece_count: u32,
    /// Ordered piece records.
    pub pieces: Vec<P2pPiece>,
    /// Unix timestamp when the manifest was created.
    pub created_unix_seconds: u64,
    /// Boundary statement for package consumers.
    pub boundary: P2pBoundary,
}

/// Detached Ed25519 signature over a canonical TinyRustLM P2P manifest payload.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pManifestSignature {
    /// Signature envelope kind. Only `external-signature-v0` is accepted.
    pub kind: String,
    /// Publisher signing key id.
    pub key_id: String,
    /// Publisher identity bound to the public key document.
    pub publisher_id: String,
    /// Metadata route for the public key document.
    pub public_key_route: String,
    /// SHA-256 of the canonical manifest payload being signed.
    pub payload_sha256: String,
    /// Ed25519 signature value in `ed25519-base64:<base64>` form.
    pub value: String,
}

/// Metadata-only signed P2P manifest envelope.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pSignedManifest {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// The metadata-only P2P manifest being signed.
    pub manifest: P2pManifest,
    /// Detached signature over the canonical manifest payload.
    pub signature: P2pManifestSignature,
}

/// Metadata-only MiniModel public key document consumed by the public verifier.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pPublicKeyDocument {
    /// Stable public key schema kind. Must be `minimodel.public_key.v0`.
    pub key_kind: String,
    /// Public key algorithm. Must be `ed25519`.
    pub key_algorithm: String,
    /// Publisher signing key id.
    pub key_id: String,
    /// Publisher identity.
    pub publisher_id: String,
    /// Metadata route where the key document is expected to live.
    pub public_key_route: String,
    /// Raw Ed25519 verifying key bytes encoded as base64.
    pub public_key_base64: String,
    /// SHA-256 of the raw verifying key bytes.
    pub public_key_sha256: String,
    /// Key usage. Must be `minimodel-manifest-signing-v0`.
    pub usage: String,
    /// UTC creation timestamp for audit display.
    pub created_utc: String,
    /// Revoked keys are rejected.
    pub revoked: bool,
}

/// Report returned after local signed P2P manifest verification.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pSignedManifestVerification {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Signed manifest identifier.
    pub manifest_id: String,
    /// Signed model identifier.
    pub model_id: String,
    /// SHA-256 of the canonical manifest payload.
    pub manifest_sha256: String,
    /// Signature algorithm that was verified.
    pub signature_algorithm: String,
    /// Publisher signing key id.
    pub key_id: String,
    /// Publisher identity.
    pub publisher_id: String,
    /// Public key metadata route.
    pub public_key_route: String,
    /// SHA-256 of the raw public key bytes.
    pub public_key_sha256: String,
    /// SHA-256 from `signature.payload_sha256`.
    pub payload_sha256: String,
    /// Whether local verification passed.
    pub valid: bool,
}

/// Public P2P boundary flags that protect private product surfaces.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pBoundary {
    /// The manifest carries no `.slm` payload bytes.
    pub manifest_contains_model_bytes: bool,
    /// The manifest carries no premium routing logic.
    pub exposes_private_routing: bool,
    /// Importers must validate piece SHA-256 before assembly.
    pub requires_piece_sha256_validation: bool,
    /// Importers must validate the final artifact SHA-256 after assembly.
    pub requires_artifact_sha256_validation: bool,
}

/// Public P2P share metadata exported from a manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ShareMetadata {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Manifest identifier.
    pub manifest_id: String,
    /// Public model identifier.
    pub model_id: String,
    /// Exact manifest SHA-256.
    pub manifest_sha256: String,
    /// Exact artifact SHA-256.
    pub artifact_sha256: String,
    /// Exact artifact byte length.
    pub artifact_byte_count: u64,
    /// Piece count.
    pub piece_count: u32,
    /// Unix timestamp when the metadata was exported.
    pub exported_unix_seconds: u64,
    /// Boundary statement for package consumers.
    pub boundary: P2pBoundary,
}

/// Public peer announcement that points at metadata and never embeds model bytes.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pAnnouncement {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Peer identifier.
    pub peer_id: String,
    /// Manifest identifier.
    pub manifest_id: String,
    /// Public model identifier.
    pub model_id: String,
    /// URL where the metadata-only manifest can be fetched.
    pub manifest_url: String,
    /// Exact manifest SHA-256.
    pub manifest_sha256: String,
    /// Exact artifact SHA-256.
    pub artifact_sha256: String,
    /// Exact artifact byte length.
    pub artifact_byte_count: u64,
    /// Whether the peer explicitly consented to advertise this share.
    pub peer_consent: bool,
    /// Unix timestamp when the announcement was created.
    pub created_unix_seconds: u64,
}

/// Result written by `prepare_local_share_kit`.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ShareKitReport {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Output root.
    pub output_dir: PathBuf,
    /// Manifest path.
    pub manifest_path: PathBuf,
    /// Share metadata path.
    pub share_metadata_path: PathBuf,
    /// Optional announcement path.
    pub announcement_path: Option<PathBuf>,
    /// Exact manifest SHA-256.
    pub manifest_sha256: String,
    /// Exact metadata SHA-256.
    pub share_metadata_sha256: String,
    /// Optional announcement SHA-256.
    pub announcement_sha256: Option<String>,
    /// Prepared manifest.
    pub manifest: P2pManifest,
}

/// Inspection report returned after validating a P2P manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pManifestInspection {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Manifest identifier.
    pub manifest_id: String,
    /// Public model identifier.
    pub model_id: String,
    /// Exact manifest SHA-256.
    pub manifest_sha256: String,
    /// Exact artifact SHA-256.
    pub artifact_sha256: String,
    /// Exact artifact byte length.
    pub artifact_byte_count: u64,
    /// Piece count.
    pub piece_count: u32,
    /// Total bytes declared by pieces.
    pub declared_piece_bytes: u64,
    /// Whether the manifest passed public validation.
    pub valid: bool,
}

/// Metadata-only import plan created from a validated manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pImportPlan {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Manifest identifier.
    pub manifest_id: String,
    /// Public model identifier.
    pub model_id: String,
    /// Exact manifest SHA-256.
    pub manifest_sha256: String,
    /// Exact artifact SHA-256 required after assembly.
    pub artifact_sha256: String,
    /// Ordered piece records to fetch or copy.
    pub required_pieces: Vec<P2pPiece>,
    /// Import boundary statement.
    pub required_next_gate: String,
}

/// Boundary flags for public local piece assembly.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pLocalImportBoundary {
    /// Local import did not perform peer discovery or network fetches.
    pub network_fetch_performed: bool,
    /// Local import did not use private routing or premium algorithms.
    pub private_routing_used: bool,
    /// Every declared piece SHA-256 was verified before assembly.
    pub piece_sha256_verified: bool,
    /// The assembled artifact SHA-256 was verified against the manifest.
    pub artifact_sha256_verified: bool,
    /// The assembled artifact was parsed through the public `.slm` validator.
    pub slm_validation_performed: bool,
}

/// Receipt returned after assembling a local share kit into a verified `.slm`.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pLocalImportReceipt {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Manifest identifier.
    pub manifest_id: String,
    /// Public model identifier.
    pub model_id: String,
    /// Exact manifest SHA-256.
    pub manifest_sha256: String,
    /// Exact artifact SHA-256 required by the manifest.
    pub artifact_sha256: String,
    /// Exact artifact byte length required by the manifest.
    pub artifact_byte_count: u64,
    /// Local receipt JSON path.
    pub receipt_path: PathBuf,
    /// Local output `.slm` path.
    pub output_path: PathBuf,
    /// SHA-256 of the assembled output.
    pub output_sha256: String,
    /// Byte length of the assembled output.
    pub output_byte_count: u64,
    /// Manifest piece count.
    pub piece_count: u32,
    /// Number of pieces whose SHA-256 was verified.
    pub verified_piece_count: u32,
    /// Unix timestamp when the receipt was created.
    pub assembled_unix_seconds: u64,
    /// Boundary statement for package consumers.
    pub boundary: P2pLocalImportBoundary,
}

/// Inspection report returned after validating a local import receipt and `.slm` output.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct P2pLocalImportReceiptInspection {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Manifest identifier copied from the receipt.
    pub manifest_id: String,
    /// Public model identifier copied from the receipt.
    pub model_id: String,
    /// Exact receipt SHA-256.
    pub receipt_sha256: String,
    /// Exact manifest SHA-256 copied from the receipt.
    pub manifest_sha256: String,
    /// Exact artifact SHA-256 required by the receipt.
    pub artifact_sha256: String,
    /// Exact artifact byte length required by the receipt.
    pub artifact_byte_count: u64,
    /// Output path recorded inside the receipt.
    pub receipt_output_path: PathBuf,
    /// Local output path inspected by this validation run.
    pub inspected_output_path: PathBuf,
    /// SHA-256 observed from the inspected `.slm`.
    pub inspected_output_sha256: String,
    /// Byte length observed from the inspected `.slm`.
    pub inspected_output_byte_count: u64,
    /// Manifest piece count copied from the receipt.
    pub piece_count: u32,
    /// Number of pieces whose SHA-256 was verified during assembly.
    pub verified_piece_count: u32,
    /// Whether the receipt and inspected output passed public validation.
    pub valid: bool,
    /// Boundary statement proven by the receipt.
    pub boundary: P2pLocalImportBoundary,
}

/// Local announcement catalog used by public SDK consumers.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AnnouncementCatalog {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stored announcements.
    pub announcements: Vec<P2pAnnouncement>,
}

/// Inspection report for a received announcement catalog.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AnnouncementCatalogInspection {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Exact SHA-256 of the inspected catalog JSON.
    pub catalog_sha256: String,
    /// Number of stored announcements.
    pub announcement_count: u32,
    /// Number of distinct peer identifiers in the catalog.
    pub peer_count: u32,
    /// Number of distinct manifest identifiers in the catalog.
    pub manifest_count: u32,
    /// Number of distinct model identifiers in the catalog.
    pub model_count: u32,
    /// Sum of announced artifact byte counts across catalog rows.
    pub total_announced_artifact_bytes: u64,
    /// Whether the catalog passed public validation.
    pub valid: bool,
}

/// Error returned by public P2P SDK operations.
#[derive(Debug)]
pub enum P2pError {
    /// File-system access failed.
    Io(String),
    /// JSON parsing or rendering failed.
    Json(String),
    /// Input failed schema or boundary validation.
    Invalid(String),
    /// `.slm` validation failed.
    Slm(tinyrustlm_slm::SlmError),
}

impl Display for P2pError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(message) => write!(formatter, "I/O error: {message}"),
            Self::Json(message) => write!(formatter, "JSON error: {message}"),
            Self::Invalid(message) => formatter.write_str(message),
            Self::Slm(error) => Display::fmt(error, formatter),
        }
    }
}

impl std::error::Error for P2pError {}

impl From<tinyrustlm_slm::SlmError> for P2pError {
    fn from(value: tinyrustlm_slm::SlmError) -> Self {
        Self::Slm(value)
    }
}

/// Prepares a local P2P share kit from a validated `.slm` file.
pub fn prepare_local_share_kit(
    request: PrepareShareKitRequest,
) -> Result<ShareKitReport, P2pError> {
    let piece_size = normalize_piece_size(request.piece_size)?;
    let public_base_url = request
        .public_base_url
        .as_deref()
        .map(normalize_public_base_url)
        .transpose()?;
    let announcement_peer_id = if public_base_url.is_some() {
        Some(
            request
                .peer_id
                .as_deref()
                .map(safe_identifier)
                .transpose()?
                .unwrap_or_else(|| "local-peer".to_string()),
        )
    } else {
        None
    };
    let loaded = safe_load_slm_from_path(&request.model_path, &SlmLoadPolicy::default())?;
    let model_id = request
        .model_id
        .as_deref()
        .map(safe_identifier)
        .transpose()?
        .unwrap_or_else(|| default_model_id(&request.model_path));
    let manifest_id = request
        .manifest_id
        .as_deref()
        .map(safe_identifier)
        .transpose()?
        .unwrap_or_else(|| format!("{model_id}-{}", short_sha(&loaded.inspection().sha256)));
    let output_dir = request.output_dir;
    let piece_root = output_dir.join("peer-pieces").join(&manifest_id);
    fs::create_dir_all(&piece_root).map_err(|error| P2pError::Io(error.to_string()))?;

    let mut pieces = Vec::new();
    for (index, chunk) in loaded.bytes().chunks(piece_size as usize).enumerate() {
        let index_u32 = u32::try_from(index)
            .map_err(|_| P2pError::Invalid("piece count exceeded u32".to_string()))?;
        let file_name = format!("piece-{index_u32:06}.slm-piece");
        let route = format!("peer-pieces/{manifest_id}/{file_name}");
        let piece_path = piece_root.join(file_name);
        fs::write(&piece_path, chunk).map_err(|error| P2pError::Io(error.to_string()))?;
        pieces.push(P2pPiece {
            index: index_u32,
            route,
            byte_count: chunk.len() as u64,
            sha256: sha256_bytes(chunk),
        });
    }

    let manifest = P2pManifest {
        kind: P2P_MANIFEST_KIND.to_string(),
        version: 1,
        manifest_id,
        model_id,
        slm: loaded.inspection().clone(),
        artifact_sha256: loaded.inspection().sha256.clone(),
        artifact_byte_count: loaded.inspection().byte_count,
        piece_size,
        piece_count: pieces.len() as u32,
        pieces,
        created_unix_seconds: now_unix_seconds(),
        boundary: public_p2p_boundary(),
    };
    let manifest_text = to_pretty_json(&manifest)?;
    let manifest_sha256 = sha256_text(&manifest_text);
    fs::create_dir_all(&output_dir).map_err(|error| P2pError::Io(error.to_string()))?;
    let manifest_path = output_dir.join("tinyrustlm.p2p-manifest.v0.json");
    fs::write(&manifest_path, &manifest_text).map_err(|error| P2pError::Io(error.to_string()))?;

    let metadata = export_share_metadata_from_manifest(&manifest)?;
    let metadata_text = to_pretty_json(&metadata)?;
    let share_metadata_sha256 = sha256_text(&metadata_text);
    let share_metadata_path = output_dir.join("tinyrustlm.p2p-share-metadata.v0.json");
    fs::write(&share_metadata_path, &metadata_text)
        .map_err(|error| P2pError::Io(error.to_string()))?;

    let (announcement_path, announcement_sha256) = match public_base_url {
        Some(base_url) => {
            let peer_id = announcement_peer_id.expect("peer id is validated with public_base_url");
            let announcement = P2pAnnouncement {
                kind: ANNOUNCEMENT_KIND.to_string(),
                version: 1,
                peer_id,
                manifest_id: manifest.manifest_id.clone(),
                model_id: manifest.model_id.clone(),
                manifest_url: join_url(&base_url, "tinyrustlm.p2p-manifest.v0.json")?,
                manifest_sha256: manifest_sha256.clone(),
                artifact_sha256: manifest.artifact_sha256.clone(),
                artifact_byte_count: manifest.artifact_byte_count,
                peer_consent: true,
                created_unix_seconds: now_unix_seconds(),
            };
            validate_announcement(&announcement)?;
            let text = to_pretty_json(&announcement)?;
            let path = output_dir.join("tinyrustlm.p2p-announcement.v0.json");
            fs::write(&path, &text).map_err(|error| P2pError::Io(error.to_string()))?;
            (Some(path), Some(sha256_text(&text)))
        }
        None => (None, None),
    };

    Ok(ShareKitReport {
        kind: "tinyrustlm.p2p_share_kit_report.v0".to_string(),
        version: 1,
        output_dir,
        manifest_path,
        share_metadata_path,
        announcement_path,
        manifest_sha256,
        share_metadata_sha256,
        announcement_sha256,
        manifest,
    })
}

/// Validates and inspects a manifest JSON document.
pub fn inspect_p2p_manifest_text(text: &str) -> Result<P2pManifestInspection, P2pError> {
    if text.len() > MAX_MANIFEST_BYTES {
        return Err(P2pError::Invalid(
            "P2P manifest exceeded byte budget".to_string(),
        ));
    }
    let manifest: P2pManifest =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    inspect_p2p_manifest(&manifest, Some(text))
}

/// Validates a manifest and returns an inspection report.
pub fn inspect_p2p_manifest(
    manifest: &P2pManifest,
    original_text: Option<&str>,
) -> Result<P2pManifestInspection, P2pError> {
    validate_manifest(manifest)?;
    let declared_piece_bytes = manifest
        .pieces
        .iter()
        .map(|piece| piece.byte_count)
        .sum::<u64>();
    Ok(P2pManifestInspection {
        kind: "tinyrustlm.p2p_manifest_inspection.v0".to_string(),
        version: 1,
        manifest_id: manifest.manifest_id.clone(),
        model_id: manifest.model_id.clone(),
        manifest_sha256: match original_text {
            Some(text) => sha256_text(text),
            None => sha256_text(&to_pretty_json(manifest)?),
        },
        artifact_sha256: manifest.artifact_sha256.clone(),
        artifact_byte_count: manifest.artifact_byte_count,
        piece_count: manifest.piece_count,
        declared_piece_bytes,
        valid: true,
    })
}

/// Verifies a signed P2P manifest envelope with a local MiniModel public key document.
pub fn verify_signed_manifest_text(
    signed_manifest_json: &str,
    public_key_json: &str,
) -> Result<P2pSignedManifestVerification, P2pError> {
    if signed_manifest_json.len() > MAX_MANIFEST_BYTES {
        return Err(P2pError::Invalid(
            "signed P2P manifest exceeded byte budget".to_string(),
        ));
    }
    if public_key_json.len() > MAX_PUBLIC_KEY_BYTES {
        return Err(P2pError::Invalid(
            "P2P public key document exceeded byte budget".to_string(),
        ));
    }
    let signed_manifest: P2pSignedManifest = serde_json::from_str(signed_manifest_json)
        .map_err(|error| P2pError::Json(error.to_string()))?;
    let public_key: P2pPublicKeyDocument =
        serde_json::from_str(public_key_json).map_err(|error| P2pError::Json(error.to_string()))?;
    verify_signed_manifest(&signed_manifest, &public_key)
}

/// Verifies a parsed signed P2P manifest envelope with a parsed public key document.
pub fn verify_signed_manifest(
    signed_manifest: &P2pSignedManifest,
    public_key: &P2pPublicKeyDocument,
) -> Result<P2pSignedManifestVerification, P2pError> {
    validate_signed_manifest_envelope(signed_manifest)?;
    validate_public_key_document(public_key, &signed_manifest.signature)?;
    let canonical_payload = signed_manifest_payload_text(&signed_manifest.manifest)?;
    let signature = parse_ed25519_signature_value(&signed_manifest.signature.value)?;
    let public_key_bytes =
        decode_base64_array::<32>(&public_key.public_key_base64, "public_key_base64")?;
    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes).map_err(|_| {
        P2pError::Invalid("public_key_base64 is not a valid Ed25519 key".to_string())
    })?;
    verifying_key
        .verify(canonical_payload.as_bytes(), &signature)
        .map_err(|_| {
            P2pError::Invalid(
                "signature.value did not verify the canonical P2P manifest payload".to_string(),
            )
        })?;

    Ok(P2pSignedManifestVerification {
        kind: SIGNED_MANIFEST_VERIFICATION_KIND.to_string(),
        version: 1,
        manifest_id: signed_manifest.manifest.manifest_id.clone(),
        model_id: signed_manifest.manifest.model_id.clone(),
        manifest_sha256: sha256_text(&canonical_payload),
        signature_algorithm: SIGNATURE_ALGORITHM_ED25519.to_string(),
        key_id: signed_manifest.signature.key_id.clone(),
        publisher_id: signed_manifest.signature.publisher_id.clone(),
        public_key_route: signed_manifest.signature.public_key_route.clone(),
        public_key_sha256: public_key.public_key_sha256.clone(),
        payload_sha256: signed_manifest.signature.payload_sha256.clone(),
        valid: true,
    })
}

/// Creates a metadata-only import plan from a validated manifest JSON document.
pub fn import_from_manifest_text(text: &str) -> Result<P2pImportPlan, P2pError> {
    if text.len() > MAX_MANIFEST_BYTES {
        return Err(P2pError::Invalid(
            "P2P manifest exceeded byte budget".to_string(),
        ));
    }
    let manifest: P2pManifest =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    let inspection = inspect_p2p_manifest(&manifest, Some(text))?;
    Ok(P2pImportPlan {
        kind: IMPORT_PLAN_KIND.to_string(),
        version: 1,
        manifest_id: manifest.manifest_id,
        model_id: manifest.model_id,
        manifest_sha256: inspection.manifest_sha256,
        artifact_sha256: inspection.artifact_sha256,
        required_pieces: manifest.pieces,
        required_next_gate:
            "fetch pieces, verify each piece SHA-256, assemble, verify final artifact SHA-256"
                .to_string(),
    })
}

/// Assembles a local share-kit piece set into a verified `.slm` artifact.
///
/// This performs no peer discovery, network fetches, or private routing. The caller supplies a
/// local share-kit root containing the manifest-declared piece routes, and this function verifies
/// every piece SHA-256, the final artifact SHA-256, and the assembled `.slm` structure.
pub fn assemble_from_manifest_text(
    text: &str,
    share_kit_root: impl AsRef<Path>,
    output_path: impl AsRef<Path>,
) -> Result<P2pLocalImportReceipt, P2pError> {
    if text.len() > MAX_MANIFEST_BYTES {
        return Err(P2pError::Invalid(
            "P2P manifest exceeded byte budget".to_string(),
        ));
    }
    let manifest: P2pManifest =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    let inspection = inspect_p2p_manifest(&manifest, Some(text))?;
    assemble_from_manifest(&manifest, &inspection, share_kit_root, output_path)
}

/// Validates a local import receipt JSON document against an inspected `.slm` output.
///
/// The receipt's recorded output path is treated as provenance only. The caller supplies the
/// output path that should be verified on this machine, which keeps receipts portable across
/// workspaces while still validating the artifact SHA-256, byte count, and `.slm` structure.
pub fn inspect_local_import_receipt_text(
    text: &str,
    output_path: impl AsRef<Path>,
) -> Result<P2pLocalImportReceiptInspection, P2pError> {
    if text.len() > MAX_RECEIPT_BYTES {
        return Err(P2pError::Invalid(
            "P2P local import receipt exceeded byte budget".to_string(),
        ));
    }
    let receipt: P2pLocalImportReceipt =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    validate_local_import_receipt(&receipt)?;
    let output_path = output_path.as_ref();
    if output_path.extension().and_then(|value| value.to_str()) != Some("slm") {
        return Err(P2pError::Invalid(
            "inspected output path must end with .slm".to_string(),
        ));
    }
    let loaded = safe_load_slm_from_path(
        output_path,
        &SlmLoadPolicy {
            expected_sha256: Some(receipt.artifact_sha256.clone()),
            ..SlmLoadPolicy::default()
        },
    )?;
    if loaded.inspection().byte_count != receipt.artifact_byte_count {
        return Err(P2pError::Invalid(
            "inspected .slm byte count must match receipt".to_string(),
        ));
    }
    if loaded.inspection().sha256 != receipt.output_sha256 {
        return Err(P2pError::Invalid(
            "inspected .slm SHA-256 must match receipt output SHA-256".to_string(),
        ));
    }
    Ok(P2pLocalImportReceiptInspection {
        kind: LOCAL_IMPORT_RECEIPT_INSPECTION_KIND.to_string(),
        version: 1,
        manifest_id: receipt.manifest_id,
        model_id: receipt.model_id,
        receipt_sha256: sha256_text(text),
        manifest_sha256: receipt.manifest_sha256,
        artifact_sha256: receipt.artifact_sha256,
        artifact_byte_count: receipt.artifact_byte_count,
        receipt_output_path: receipt.output_path,
        inspected_output_path: output_path.to_path_buf(),
        inspected_output_sha256: loaded.inspection().sha256.clone(),
        inspected_output_byte_count: loaded.inspection().byte_count,
        piece_count: receipt.piece_count,
        verified_piece_count: receipt.verified_piece_count,
        valid: true,
        boundary: receipt.boundary,
    })
}

/// Exports share metadata from a manifest JSON document.
pub fn export_share_metadata_text(text: &str) -> Result<ShareMetadata, P2pError> {
    if text.len() > MAX_MANIFEST_BYTES {
        return Err(P2pError::Invalid(
            "P2P manifest exceeded byte budget".to_string(),
        ));
    }
    let manifest: P2pManifest =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    validate_manifest(&manifest)?;
    export_share_metadata_from_manifest(&manifest)
}

/// Validates a metadata-only announcement JSON document.
pub fn validate_announcement_text(text: &str) -> Result<P2pAnnouncement, P2pError> {
    if text.len() > MAX_ANNOUNCEMENT_BYTES {
        return Err(P2pError::Invalid(
            "P2P announcement exceeded byte budget".to_string(),
        ));
    }
    let announcement: P2pAnnouncement =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    validate_announcement(&announcement)?;
    Ok(announcement)
}

/// Applies a received announcement to a local metadata catalog.
pub fn apply_received_announcement_text(
    announcement_text: &str,
    existing_catalog_text: Option<&str>,
) -> Result<AnnouncementCatalog, P2pError> {
    let announcement = validate_announcement_text(announcement_text)?;
    let mut catalog = match existing_catalog_text {
        Some(text) => {
            if text.len() > MAX_ANNOUNCEMENT_CATALOG_BYTES {
                return Err(P2pError::Invalid(
                    "P2P announcement catalog exceeded byte budget".to_string(),
                ));
            }
            if text.trim().is_empty() {
                empty_announcement_catalog()
            } else {
                serde_json::from_str::<AnnouncementCatalog>(text)
                    .map_err(|error| P2pError::Json(error.to_string()))?
            }
        }
        None => empty_announcement_catalog(),
    };
    validate_catalog(&catalog)?;
    for existing in &catalog.announcements {
        ensure_announcement_identity_consistent(existing, &announcement)?;
    }
    let key = announcement_key(&announcement);
    if !catalog
        .announcements
        .iter()
        .any(|existing| announcement_key(existing) == key)
    {
        catalog.announcements.push(announcement);
        catalog.announcements.sort_by_key(announcement_key);
    }
    Ok(catalog)
}

/// Validates and inspects a received announcement catalog JSON document.
pub fn inspect_announcement_catalog_text(
    text: &str,
) -> Result<AnnouncementCatalogInspection, P2pError> {
    if text.len() > MAX_ANNOUNCEMENT_CATALOG_BYTES {
        return Err(P2pError::Invalid(
            "P2P announcement catalog exceeded byte budget".to_string(),
        ));
    }
    let catalog: AnnouncementCatalog =
        serde_json::from_str(text).map_err(|error| P2pError::Json(error.to_string()))?;
    validate_catalog(&catalog)?;
    inspect_announcement_catalog(&catalog, text)
}

fn inspect_announcement_catalog(
    catalog: &AnnouncementCatalog,
    original_text: &str,
) -> Result<AnnouncementCatalogInspection, P2pError> {
    let mut peers = BTreeSet::new();
    let mut manifests = BTreeSet::new();
    let mut models = BTreeSet::new();
    let mut total_announced_artifact_bytes = 0_u64;
    for announcement in &catalog.announcements {
        peers.insert(announcement.peer_id.clone());
        manifests.insert(announcement.manifest_id.clone());
        models.insert(announcement.model_id.clone());
        total_announced_artifact_bytes = total_announced_artifact_bytes
            .checked_add(announcement.artifact_byte_count)
            .ok_or_else(|| {
                P2pError::Invalid("announcement catalog artifact bytes overflow".to_string())
            })?;
    }
    Ok(AnnouncementCatalogInspection {
        kind: ANNOUNCEMENT_CATALOG_INSPECTION_KIND.to_string(),
        version: 1,
        catalog_sha256: sha256_text(original_text),
        announcement_count: count_as_u32(catalog.announcements.len(), "announcement count")?,
        peer_count: count_as_u32(peers.len(), "peer count")?,
        manifest_count: count_as_u32(manifests.len(), "manifest count")?,
        model_count: count_as_u32(models.len(), "model count")?,
        total_announced_artifact_bytes,
        valid: true,
    })
}

fn assemble_from_manifest(
    manifest: &P2pManifest,
    inspection: &P2pManifestInspection,
    share_kit_root: impl AsRef<Path>,
    output_path: impl AsRef<Path>,
) -> Result<P2pLocalImportReceipt, P2pError> {
    let share_kit_root = share_kit_root.as_ref();
    let output_path = output_path.as_ref();
    let canonical_share_root =
        fs::canonicalize(share_kit_root).map_err(|error| P2pError::Io(error.to_string()))?;
    if !canonical_share_root.is_dir() {
        return Err(P2pError::Invalid(
            "share kit root must be an existing directory".to_string(),
        ));
    }
    if output_path.extension().and_then(|value| value.to_str()) != Some("slm") {
        return Err(P2pError::Invalid(
            "output path must end with .slm".to_string(),
        ));
    }
    if output_path.exists() {
        return Err(P2pError::Invalid(
            "output path already exists; refusing to overwrite".to_string(),
        ));
    }
    let receipt_path = receipt_path_for_output(output_path)?;
    if receipt_path.exists() {
        return Err(P2pError::Invalid(
            "receipt path already exists; refusing to overwrite".to_string(),
        ));
    }
    let Some(output_parent) = output_path.parent() else {
        return Err(P2pError::Invalid(
            "output path must include a parent directory".to_string(),
        ));
    };
    fs::create_dir_all(output_parent).map_err(|error| P2pError::Io(error.to_string()))?;
    let temp_path = temporary_output_path(output_path)?;
    let temp_receipt_path = temporary_output_path(&receipt_path)?;
    let _ = fs::remove_file(&temp_path);
    let _ = fs::remove_file(&temp_receipt_path);

    let assembly_result = (|| {
        let mut output =
            fs::File::create(&temp_path).map_err(|error| P2pError::Io(error.to_string()))?;
        let mut artifact_hasher = Sha256::new();
        let mut assembled_bytes = 0u64;
        let mut verified_piece_count = 0u32;

        for piece in &manifest.pieces {
            let piece_path = resolve_existing_piece_path(&canonical_share_root, &piece.route)?;
            let bytes = fs::read(&piece_path).map_err(|error| P2pError::Io(error.to_string()))?;
            if bytes.len() as u64 != piece.byte_count {
                return Err(P2pError::Invalid(format!(
                    "piece {} byte count mismatch",
                    piece.index
                )));
            }
            let actual_piece_sha256 = sha256_bytes(&bytes);
            if actual_piece_sha256 != piece.sha256 {
                return Err(P2pError::Invalid(format!(
                    "piece {} SHA-256 mismatch",
                    piece.index
                )));
            }
            output
                .write_all(&bytes)
                .map_err(|error| P2pError::Io(error.to_string()))?;
            artifact_hasher.update(&bytes);
            assembled_bytes = assembled_bytes
                .checked_add(bytes.len() as u64)
                .ok_or_else(|| P2pError::Invalid("assembled byte count overflow".to_string()))?;
            verified_piece_count = verified_piece_count
                .checked_add(1)
                .ok_or_else(|| P2pError::Invalid("verified piece count overflow".to_string()))?;
        }
        output
            .sync_all()
            .map_err(|error| P2pError::Io(error.to_string()))?;
        drop(output);

        if assembled_bytes != manifest.artifact_byte_count {
            return Err(P2pError::Invalid(
                "assembled byte count must match artifact byte count".to_string(),
            ));
        }
        let output_sha256 = format!("sha256:{}", hex_lower(&artifact_hasher.finalize()));
        if output_sha256 != manifest.artifact_sha256 {
            return Err(P2pError::Invalid(
                "assembled artifact SHA-256 must match manifest".to_string(),
            ));
        }
        let loaded = safe_load_slm_from_path(
            &temp_path,
            &SlmLoadPolicy {
                expected_sha256: Some(manifest.artifact_sha256.clone()),
                ..SlmLoadPolicy::default()
            },
        )?;
        if loaded.inspection().byte_count != manifest.artifact_byte_count {
            return Err(P2pError::Invalid(
                "assembled .slm inspection byte count must match manifest".to_string(),
            ));
        }
        let receipt = P2pLocalImportReceipt {
            kind: LOCAL_IMPORT_RECEIPT_KIND.to_string(),
            version: 1,
            manifest_id: manifest.manifest_id.clone(),
            model_id: manifest.model_id.clone(),
            manifest_sha256: inspection.manifest_sha256.clone(),
            artifact_sha256: manifest.artifact_sha256.clone(),
            artifact_byte_count: manifest.artifact_byte_count,
            receipt_path: receipt_path.clone(),
            output_path: output_path.to_path_buf(),
            output_sha256: loaded.inspection().sha256.clone(),
            output_byte_count: loaded.inspection().byte_count,
            piece_count: manifest.piece_count,
            verified_piece_count,
            assembled_unix_seconds: now_unix_seconds(),
            boundary: public_local_import_boundary(),
        };
        fs::write(&temp_receipt_path, to_pretty_json(&receipt)?)
            .map_err(|error| P2pError::Io(error.to_string()))?;
        fs::rename(&temp_path, output_path).map_err(|error| P2pError::Io(error.to_string()))?;
        if let Err(error) = fs::rename(&temp_receipt_path, &receipt_path) {
            let _ = fs::remove_file(output_path);
            return Err(P2pError::Io(error.to_string()));
        }
        Ok(receipt)
    })();

    if assembly_result.is_err() {
        let _ = fs::remove_file(&temp_path);
        let _ = fs::remove_file(&temp_receipt_path);
    }
    assembly_result
}

fn export_share_metadata_from_manifest(manifest: &P2pManifest) -> Result<ShareMetadata, P2pError> {
    let manifest_text = to_pretty_json(manifest)?;
    Ok(ShareMetadata {
        kind: SHARE_METADATA_KIND.to_string(),
        version: 1,
        manifest_id: manifest.manifest_id.clone(),
        model_id: manifest.model_id.clone(),
        manifest_sha256: sha256_text(&manifest_text),
        artifact_sha256: manifest.artifact_sha256.clone(),
        artifact_byte_count: manifest.artifact_byte_count,
        piece_count: manifest.piece_count,
        exported_unix_seconds: now_unix_seconds(),
        boundary: public_p2p_boundary(),
    })
}

fn validate_manifest(manifest: &P2pManifest) -> Result<(), P2pError> {
    require_equal("manifest.kind", P2P_MANIFEST_KIND, &manifest.kind)?;
    if manifest.version != 1 {
        return Err(P2pError::Invalid("manifest version must be 1".to_string()));
    }
    safe_identifier(&manifest.manifest_id)?;
    safe_identifier(&manifest.model_id)?;
    require_sha256("artifact_sha256", &manifest.artifact_sha256)?;
    if manifest.artifact_sha256 != manifest.slm.sha256 {
        return Err(P2pError::Invalid(
            "manifest artifact SHA-256 must match .slm inspection".to_string(),
        ));
    }
    if manifest.artifact_byte_count != manifest.slm.byte_count {
        return Err(P2pError::Invalid(
            "manifest artifact byte count must match .slm inspection".to_string(),
        ));
    }
    normalize_piece_size(Some(manifest.piece_size))?;
    if manifest.piece_count as usize != manifest.pieces.len() {
        return Err(P2pError::Invalid(
            "manifest piece_count must match pieces length".to_string(),
        ));
    }
    if manifest.boundary.manifest_contains_model_bytes
        || manifest.boundary.exposes_private_routing
        || !manifest.boundary.requires_piece_sha256_validation
        || !manifest.boundary.requires_artifact_sha256_validation
    {
        return Err(P2pError::Invalid(
            "manifest P2P boundary flags are not public-safe".to_string(),
        ));
    }
    let mut seen = BTreeSet::new();
    let mut total = 0u64;
    for (expected_index, piece) in manifest.pieces.iter().enumerate() {
        if piece.index != expected_index as u32 {
            return Err(P2pError::Invalid(
                "manifest piece indexes must be sequential".to_string(),
            ));
        }
        if piece.byte_count == 0 {
            return Err(P2pError::Invalid(
                "manifest piece byte_count cannot be zero".to_string(),
            ));
        }
        require_sha256("piece.sha256", &piece.sha256)?;
        validate_piece_route(&piece.route)?;
        if !seen.insert(piece.route.clone()) {
            return Err(P2pError::Invalid(
                "manifest piece routes must be unique".to_string(),
            ));
        }
        total = total
            .checked_add(piece.byte_count)
            .ok_or_else(|| P2pError::Invalid("manifest piece bytes overflow".to_string()))?;
    }
    if total != manifest.artifact_byte_count {
        return Err(P2pError::Invalid(
            "manifest piece byte total must match artifact byte count".to_string(),
        ));
    }
    Ok(())
}

fn validate_signed_manifest_envelope(signed_manifest: &P2pSignedManifest) -> Result<(), P2pError> {
    require_equal(
        "signed_manifest.kind",
        SIGNED_MANIFEST_KIND,
        &signed_manifest.kind,
    )?;
    if signed_manifest.version != 1 {
        return Err(P2pError::Invalid(
            "signed_manifest version must be 1".to_string(),
        ));
    }
    validate_manifest(&signed_manifest.manifest)?;
    require_equal(
        "signature.kind",
        SIGNATURE_KIND_EXTERNAL_V0,
        &signed_manifest.signature.kind,
    )?;
    safe_identifier(&signed_manifest.signature.key_id)?;
    safe_identifier(&signed_manifest.signature.publisher_id)?;
    validate_piece_route(&signed_manifest.signature.public_key_route)?;
    let expected_payload_sha256 = normalize_sha256(&signed_manifest.signature.payload_sha256)?;
    let actual_payload_sha256 = signed_manifest_payload_sha256(&signed_manifest.manifest)?;
    if expected_payload_sha256 != actual_payload_sha256 {
        return Err(P2pError::Invalid(format!(
            "signature.payload_sha256 mismatch: expected {expected_payload_sha256}, canonical payload had {actual_payload_sha256}"
        )));
    }
    parse_ed25519_signature_value(&signed_manifest.signature.value)?;
    Ok(())
}

fn validate_public_key_document(
    public_key: &P2pPublicKeyDocument,
    signature: &P2pManifestSignature,
) -> Result<(), P2pError> {
    require_equal(
        "public_key.key_kind",
        MINIMODEL_PUBLIC_KEY_KIND_V0,
        &public_key.key_kind,
    )?;
    require_equal(
        "public_key.key_algorithm",
        SIGNATURE_ALGORITHM_ED25519,
        &public_key.key_algorithm,
    )?;
    require_equal(
        "public_key.usage",
        MINIMODEL_MANIFEST_SIGNING_USAGE_V0,
        &public_key.usage,
    )?;
    if public_key.revoked {
        return Err(P2pError::Invalid(
            "public key document is revoked".to_string(),
        ));
    }
    if !public_key.created_utc.ends_with('Z') || !public_key.created_utc.contains('T') {
        return Err(P2pError::Invalid(
            "public_key.created_utc must be a UTC timestamp".to_string(),
        ));
    }
    safe_identifier(&public_key.key_id)?;
    safe_identifier(&public_key.publisher_id)?;
    validate_piece_route(&public_key.public_key_route)?;
    if public_key.key_id != signature.key_id {
        return Err(P2pError::Invalid(
            "public key key_id does not match signature.key_id".to_string(),
        ));
    }
    if public_key.publisher_id != signature.publisher_id {
        return Err(P2pError::Invalid(
            "public key publisher_id does not match signature.publisher_id".to_string(),
        ));
    }
    if public_key.public_key_route != signature.public_key_route {
        return Err(P2pError::Invalid(
            "public key route does not match signature.public_key_route".to_string(),
        ));
    }
    let public_key_bytes =
        decode_base64_array::<32>(&public_key.public_key_base64, "public_key_base64")?;
    let expected_key_sha256 = normalize_sha256(&public_key.public_key_sha256)?;
    let actual_key_sha256 = sha256_bytes(&public_key_bytes);
    if expected_key_sha256 != actual_key_sha256 {
        return Err(P2pError::Invalid(format!(
            "public_key_sha256 mismatch: expected {expected_key_sha256}, public key had {actual_key_sha256}"
        )));
    }
    Ok(())
}

fn signed_manifest_payload_text(manifest: &P2pManifest) -> Result<String, P2pError> {
    validate_manifest(manifest)?;
    to_pretty_json(manifest)
}

fn signed_manifest_payload_sha256(manifest: &P2pManifest) -> Result<String, P2pError> {
    Ok(sha256_text(&signed_manifest_payload_text(manifest)?))
}

fn validate_announcement(announcement: &P2pAnnouncement) -> Result<(), P2pError> {
    require_equal("announcement.kind", ANNOUNCEMENT_KIND, &announcement.kind)?;
    if announcement.version != 1 {
        return Err(P2pError::Invalid(
            "announcement version must be 1".to_string(),
        ));
    }
    safe_identifier(&announcement.peer_id)?;
    safe_identifier(&announcement.manifest_id)?;
    safe_identifier(&announcement.model_id)?;
    require_sha256(
        "announcement.manifest_sha256",
        &announcement.manifest_sha256,
    )?;
    require_sha256(
        "announcement.artifact_sha256",
        &announcement.artifact_sha256,
    )?;
    if announcement.artifact_byte_count == 0 {
        return Err(P2pError::Invalid(
            "announcement artifact_byte_count cannot be zero".to_string(),
        ));
    }
    if !announcement.peer_consent {
        return Err(P2pError::Invalid(
            "announcement requires peer_consent=true".to_string(),
        ));
    }
    validate_manifest_url(&announcement.manifest_url)
}

fn validate_catalog(catalog: &AnnouncementCatalog) -> Result<(), P2pError> {
    require_equal("catalog.kind", ANNOUNCEMENT_CATALOG_KIND, &catalog.kind)?;
    if catalog.version != 1 {
        return Err(P2pError::Invalid("catalog version must be 1".to_string()));
    }
    let mut seen = BTreeSet::new();
    let mut seen_identities: BTreeMap<String, &P2pAnnouncement> = BTreeMap::new();
    for announcement in &catalog.announcements {
        validate_announcement(announcement)?;
        if !seen.insert(announcement_key(announcement)) {
            return Err(P2pError::Invalid(
                "catalog announcements must be unique".to_string(),
            ));
        }
        let identity = announcement_identity(announcement);
        if let Some(existing) = seen_identities.get(&identity) {
            ensure_announcement_identity_consistent(existing, announcement)?;
        } else {
            seen_identities.insert(identity, announcement);
        }
    }
    Ok(())
}

fn validate_local_import_receipt(receipt: &P2pLocalImportReceipt) -> Result<(), P2pError> {
    require_equal("receipt.kind", LOCAL_IMPORT_RECEIPT_KIND, &receipt.kind)?;
    if receipt.version != 1 {
        return Err(P2pError::Invalid("receipt version must be 1".to_string()));
    }
    safe_identifier(&receipt.manifest_id)?;
    safe_identifier(&receipt.model_id)?;
    require_sha256("receipt.manifest_sha256", &receipt.manifest_sha256)?;
    require_sha256("receipt.artifact_sha256", &receipt.artifact_sha256)?;
    require_sha256("receipt.output_sha256", &receipt.output_sha256)?;
    if receipt.artifact_sha256 != receipt.output_sha256 {
        return Err(P2pError::Invalid(
            "receipt output SHA-256 must match artifact SHA-256".to_string(),
        ));
    }
    if receipt.artifact_byte_count == 0 {
        return Err(P2pError::Invalid(
            "receipt artifact_byte_count cannot be zero".to_string(),
        ));
    }
    if receipt.output_byte_count != receipt.artifact_byte_count {
        return Err(P2pError::Invalid(
            "receipt output byte count must match artifact byte count".to_string(),
        ));
    }
    if receipt
        .output_path
        .extension()
        .and_then(|value| value.to_str())
        != Some("slm")
    {
        return Err(P2pError::Invalid(
            "receipt output path must end with .slm".to_string(),
        ));
    }
    let receipt_file = receipt
        .receipt_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| P2pError::Invalid("receipt path must include a file name".to_string()))?;
    if !receipt_file.ends_with(".p2p-import-receipt.json") {
        return Err(P2pError::Invalid(
            "receipt path must end with .p2p-import-receipt.json".to_string(),
        ));
    }
    if receipt.piece_count == 0 {
        return Err(P2pError::Invalid(
            "receipt piece_count cannot be zero".to_string(),
        ));
    }
    if receipt.verified_piece_count != receipt.piece_count {
        return Err(P2pError::Invalid(
            "receipt verified_piece_count must match piece_count".to_string(),
        ));
    }
    if receipt.assembled_unix_seconds == 0 {
        return Err(P2pError::Invalid(
            "receipt assembled_unix_seconds cannot be zero".to_string(),
        ));
    }
    if receipt.boundary.network_fetch_performed
        || receipt.boundary.private_routing_used
        || !receipt.boundary.piece_sha256_verified
        || !receipt.boundary.artifact_sha256_verified
        || !receipt.boundary.slm_validation_performed
    {
        return Err(P2pError::Invalid(
            "receipt local import boundary flags are not public-safe".to_string(),
        ));
    }
    Ok(())
}

fn public_p2p_boundary() -> P2pBoundary {
    P2pBoundary {
        manifest_contains_model_bytes: false,
        exposes_private_routing: false,
        requires_piece_sha256_validation: true,
        requires_artifact_sha256_validation: true,
    }
}

fn public_local_import_boundary() -> P2pLocalImportBoundary {
    P2pLocalImportBoundary {
        network_fetch_performed: false,
        private_routing_used: false,
        piece_sha256_verified: true,
        artifact_sha256_verified: true,
        slm_validation_performed: true,
    }
}

fn normalize_piece_size(piece_size: Option<u64>) -> Result<u64, P2pError> {
    let size = piece_size.unwrap_or(DEFAULT_PIECE_SIZE);
    if !(MIN_PIECE_SIZE..=MAX_PIECE_SIZE).contains(&size) {
        return Err(P2pError::Invalid(format!(
            "piece_size must be between {MIN_PIECE_SIZE} and {MAX_PIECE_SIZE}"
        )));
    }
    Ok(size)
}

fn validate_piece_route(route: &str) -> Result<(), P2pError> {
    if route.is_empty()
        || route.len() > 512
        || route.starts_with('/')
        || route.starts_with('\\')
        || route.contains("..")
        || route.contains("//")
        || route.contains(':')
        || route.contains('\\')
    {
        return Err(P2pError::Invalid(
            "piece route must be a safe relative route".to_string(),
        ));
    }
    for segment in route.split('/') {
        if segment.is_empty()
            || segment == "."
            || segment.len() > 128
            || !segment
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
        {
            return Err(P2pError::Invalid(
                "piece route must contain only safe relative path segments".to_string(),
            ));
        }
    }
    Ok(())
}

fn resolve_existing_piece_path(root: &Path, route: &str) -> Result<PathBuf, P2pError> {
    validate_piece_route(route)?;
    let mut candidate = root.to_path_buf();
    for segment in route.split('/') {
        candidate.push(segment);
    }
    let canonical_piece =
        fs::canonicalize(&candidate).map_err(|error| P2pError::Io(error.to_string()))?;
    if !canonical_piece.starts_with(root) {
        return Err(P2pError::Invalid(
            "piece route resolved outside the share kit root".to_string(),
        ));
    }
    if !canonical_piece.is_file() {
        return Err(P2pError::Invalid(
            "piece route must resolve to a file".to_string(),
        ));
    }
    Ok(canonical_piece)
}

fn temporary_output_path(output_path: &Path) -> Result<PathBuf, P2pError> {
    let Some(parent) = output_path.parent() else {
        return Err(P2pError::Invalid(
            "output path must include a parent directory".to_string(),
        ));
    };
    let Some(file_name) = output_path.file_name().and_then(|value| value.to_str()) else {
        return Err(P2pError::Invalid(
            "output path must include a valid UTF-8 file name".to_string(),
        ));
    };
    Ok(parent.join(format!(".{file_name}.{}.tmp", std::process::id())))
}

fn receipt_path_for_output(output_path: &Path) -> Result<PathBuf, P2pError> {
    let Some(parent) = output_path.parent() else {
        return Err(P2pError::Invalid(
            "output path must include a parent directory".to_string(),
        ));
    };
    let Some(file_name) = output_path.file_name().and_then(|value| value.to_str()) else {
        return Err(P2pError::Invalid(
            "output path must include a valid UTF-8 file name".to_string(),
        ));
    };
    Ok(parent.join(format!("{file_name}.p2p-import-receipt.json")))
}

fn validate_manifest_url(url: &str) -> Result<(), P2pError> {
    validate_public_url(url, "manifest_url")
}

fn normalize_public_base_url(base_url: &str) -> Result<String, P2pError> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err(P2pError::Invalid(
            "public_base_url cannot be empty".to_string(),
        ));
    }
    validate_public_url(trimmed, "public_base_url")?;
    Ok(trimmed.trim_end_matches('/').to_string())
}

fn validate_public_url(url: &str, label: &str) -> Result<(), P2pError> {
    if url.is_empty() {
        return Err(P2pError::Invalid(format!("{label} cannot be empty")));
    }
    if url.trim() != url {
        return Err(P2pError::Invalid(format!(
            "{label} must not include leading or trailing whitespace"
        )));
    }
    if !url.is_ascii()
        || url
            .bytes()
            .any(|byte| byte.is_ascii_control() || byte.is_ascii_whitespace())
    {
        return Err(P2pError::Invalid(format!(
            "{label} must contain only visible ASCII URL characters"
        )));
    }
    if url.contains('?') || url.contains('#') {
        return Err(P2pError::Invalid(format!(
            "{label} must not include query strings or fragments"
        )));
    }

    let lower_url = url.to_ascii_lowercase();
    if lower_url.starts_with("https://") {
        let rest = &url["https://".len()..];
        let (authority, path) = split_url_authority_and_path(rest);
        validate_public_authority(authority, label)?;
        validate_public_url_path(path, label)?;
        return Ok(());
    }
    if lower_url.starts_with("http://") {
        let rest = &url["http://".len()..];
        let (authority, path) = split_url_authority_and_path(rest);
        validate_loopback_authority(authority, label)?;
        validate_public_url_path(path, label)?;
        return Ok(());
    }
    Err(P2pError::Invalid(format!(
        "{label} must be https or explicit-port loopback http"
    )))
}

fn split_url_authority_and_path(rest: &str) -> (&str, &str) {
    match rest.split_once('/') {
        Some((authority, path)) => (authority, path),
        None => (rest, ""),
    }
}

fn validate_public_authority(authority: &str, label: &str) -> Result<(), P2pError> {
    if authority.is_empty() {
        return Err(P2pError::Invalid(format!("{label} must include a host")));
    }
    if authority.contains('@') || authority.contains('\\') {
        return Err(P2pError::Invalid(format!(
            "{label} must not include credentials or backslashes"
        )));
    }
    Ok(())
}

fn validate_loopback_authority(authority: &str, label: &str) -> Result<(), P2pError> {
    validate_public_authority(authority, label)?;
    let lower = authority.to_ascii_lowercase();
    let port = lower
        .strip_prefix("127.0.0.1:")
        .or_else(|| lower.strip_prefix("localhost:"))
        .or_else(|| lower.strip_prefix("[::1]:"))
        .ok_or_else(|| {
            P2pError::Invalid(format!(
                "{label} http URLs must use 127.0.0.1, localhost, or [::1] with an explicit port"
            ))
        })?;
    validate_port(port, label)
}

fn validate_port(port: &str, label: &str) -> Result<(), P2pError> {
    if port.is_empty() || port.len() > 5 || !port.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(P2pError::Invalid(format!(
            "{label} loopback http URLs must include a numeric port"
        )));
    }
    let parsed = port.parse::<u16>().map_err(|_| {
        P2pError::Invalid(format!(
            "{label} loopback http port must be in the range 1-65535"
        ))
    })?;
    if parsed == 0 {
        return Err(P2pError::Invalid(format!(
            "{label} loopback http port must be in the range 1-65535"
        )));
    }
    Ok(())
}

fn validate_public_url_path(path: &str, label: &str) -> Result<(), P2pError> {
    if path.contains('\\') {
        return Err(P2pError::Invalid(format!(
            "{label} path must not contain backslashes"
        )));
    }
    if path
        .split('/')
        .any(|segment| segment == "." || segment == "..")
    {
        return Err(P2pError::Invalid(format!(
            "{label} path must not contain dot segments"
        )));
    }
    let lower = path.to_ascii_lowercase();
    if lower.contains("%2e") || lower.contains("%2f") || lower.contains("%5c") {
        return Err(P2pError::Invalid(format!(
            "{label} path must not contain encoded dot, slash, or backslash segments"
        )));
    }
    Ok(())
}

fn require_equal(label: &str, expected: &str, actual: &str) -> Result<(), P2pError> {
    if expected == actual {
        Ok(())
    } else {
        Err(P2pError::Invalid(format!(
            "{label} must be '{expected}', got '{actual}'"
        )))
    }
}

fn require_sha256(label: &str, value: &str) -> Result<(), P2pError> {
    normalize_sha256(value)
        .map(|_| ())
        .map_err(|_| P2pError::Invalid(format!("{label} must contain a 64-character hex SHA-256")))
}

fn normalize_sha256(value: &str) -> Result<String, P2pError> {
    let rest = value
        .strip_prefix("sha256:")
        .ok_or_else(|| P2pError::Invalid("SHA-256 value must start with sha256:".to_string()))?;
    if rest.len() == 64 && rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(format!("sha256:{}", rest.to_ascii_lowercase()))
    } else {
        Err(P2pError::Invalid(
            "SHA-256 value must contain a 64-character hex SHA-256".to_string(),
        ))
    }
}

fn parse_ed25519_signature_value(value: &str) -> Result<Signature, P2pError> {
    let encoded = value
        .strip_prefix(SIGNATURE_VALUE_ED25519_BASE64_PREFIX)
        .ok_or_else(|| {
            P2pError::Invalid(format!(
                "signature.value must start with {SIGNATURE_VALUE_ED25519_BASE64_PREFIX}"
            ))
        })?;
    let signature_bytes = decode_base64_array::<64>(encoded, "signature.value")?;
    Ok(Signature::from_bytes(&signature_bytes))
}

fn decode_base64_array<const N: usize>(value: &str, label: &str) -> Result<[u8; N], P2pError> {
    let bytes = BASE64_STANDARD
        .decode(value)
        .map_err(|_| P2pError::Invalid(format!("{label} must be valid base64")))?;
    let length = bytes.len();
    bytes
        .try_into()
        .map_err(|_| P2pError::Invalid(format!("{label} must decode to {N} bytes, got {length}")))
}

fn safe_identifier(value: &str) -> Result<String, P2pError> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 96 {
        return Err(P2pError::Invalid(
            "identifier must be 1-96 characters".to_string(),
        ));
    }
    if !trimmed
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(P2pError::Invalid(
            "identifier may contain only ASCII letters, digits, dot, underscore, or dash"
                .to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn default_model_id(path: &Path) -> String {
    path.file_stem()
        .and_then(|name| name.to_str())
        .and_then(|name| safe_identifier(name).ok())
        .unwrap_or_else(|| "tinyrustlm-model".to_string())
}

fn join_url(base: &str, suffix: &str) -> Result<String, P2pError> {
    validate_url_suffix(suffix)?;
    let normalized = normalize_public_base_url(base)?;
    Ok(format!("{normalized}/{suffix}"))
}

fn validate_url_suffix(suffix: &str) -> Result<(), P2pError> {
    if suffix.is_empty()
        || suffix.starts_with('/')
        || suffix.contains('?')
        || suffix.contains('#')
        || suffix.contains('\\')
        || suffix
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err(P2pError::Invalid(
            "URL suffix must be a safe relative route".to_string(),
        ));
    }
    Ok(())
}

fn announcement_key(announcement: &P2pAnnouncement) -> String {
    format!(
        "{}\n{}\n{}",
        announcement.peer_id, announcement.manifest_id, announcement.manifest_sha256
    )
}

fn empty_announcement_catalog() -> AnnouncementCatalog {
    AnnouncementCatalog {
        kind: ANNOUNCEMENT_CATALOG_KIND.to_string(),
        version: 1,
        announcements: Vec::new(),
    }
}

fn announcement_identity(announcement: &P2pAnnouncement) -> String {
    format!("{}\n{}", announcement.peer_id, announcement.manifest_id)
}

fn ensure_announcement_identity_consistent(
    existing: &P2pAnnouncement,
    candidate: &P2pAnnouncement,
) -> Result<(), P2pError> {
    if announcement_identity(existing) != announcement_identity(candidate) {
        return Ok(());
    }
    if existing.model_id != candidate.model_id
        || existing.manifest_url != candidate.manifest_url
        || existing.manifest_sha256 != candidate.manifest_sha256
        || existing.artifact_sha256 != candidate.artifact_sha256
        || existing.artifact_byte_count != candidate.artifact_byte_count
    {
        return Err(P2pError::Invalid(
            "announcement catalog contains conflicting metadata for the same peer and manifest"
                .to_string(),
        ));
    }
    Ok(())
}

fn count_as_u32(count: usize, label: &str) -> Result<u32, P2pError> {
    u32::try_from(count).map_err(|_| P2pError::Invalid(format!("{label} exceeded u32")))
}

fn short_sha(value: &str) -> String {
    value
        .strip_prefix("sha256:")
        .unwrap_or(value)
        .chars()
        .take(12)
        .collect()
}

fn to_pretty_json<T: Serialize>(value: &T) -> Result<String, P2pError> {
    let mut text =
        serde_json::to_string_pretty(value).map_err(|error| P2pError::Json(error.to_string()))?;
    text.push('\n');
    Ok(text)
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn sha256_text(text: &str) -> String {
    sha256_bytes(text.as_bytes())
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("sha256:{}", hex_lower(&hasher.finalize()))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use std::fs;

    fn fixture_model() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model.slm")
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("tinyrustlm-p2p-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn signed_manifest_fixture(name: &str) -> (String, String, P2pSignedManifest) {
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: temp_dir(name),
            manifest_id: Some(format!("{name}-manifest")),
            model_id: Some(format!("{name}-model")),
            peer_id: None,
            public_base_url: None,
            piece_size: Some(4096),
        })
        .expect("share kit");
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let public_key_bytes = signing_key.verifying_key().to_bytes();
        let public_key_route = format!("keys/{name}.public-key.json");
        let payload = signed_manifest_payload_text(&report.manifest).expect("payload");
        let payload_sha256 = sha256_text(&payload);
        let signature = signing_key.sign(payload.as_bytes());
        let signed = P2pSignedManifest {
            kind: SIGNED_MANIFEST_KIND.to_string(),
            version: 1,
            manifest: report.manifest,
            signature: P2pManifestSignature {
                kind: SIGNATURE_KIND_EXTERNAL_V0.to_string(),
                key_id: format!("{name}-key"),
                publisher_id: format!("{name}-publisher"),
                public_key_route: public_key_route.clone(),
                payload_sha256,
                value: format!(
                    "{SIGNATURE_VALUE_ED25519_BASE64_PREFIX}{}",
                    BASE64_STANDARD.encode(signature.to_bytes())
                ),
            },
        };
        let public_key = P2pPublicKeyDocument {
            key_kind: MINIMODEL_PUBLIC_KEY_KIND_V0.to_string(),
            key_algorithm: SIGNATURE_ALGORITHM_ED25519.to_string(),
            key_id: signed.signature.key_id.clone(),
            publisher_id: signed.signature.publisher_id.clone(),
            public_key_route,
            public_key_base64: BASE64_STANDARD.encode(public_key_bytes),
            public_key_sha256: sha256_bytes(&public_key_bytes),
            usage: MINIMODEL_MANIFEST_SIGNING_USAGE_V0.to_string(),
            created_utc: "2026-07-06T00:00:00Z".to_string(),
            revoked: false,
        };
        (
            to_pretty_json(&signed).expect("signed manifest json"),
            to_pretty_json(&public_key).expect("public key json"),
            signed,
        )
    }

    #[test]
    fn prepares_and_inspects_share_kit() {
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: temp_dir("share-kit"),
            manifest_id: Some("fixture-share".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: Some("peer-one".to_string()),
            public_base_url: Some("http://127.0.0.1:8123/peer".to_string()),
            piece_size: Some(4096),
        })
        .expect("share kit");
        assert!(report.manifest_path.exists());
        assert!(report.share_metadata_path.exists());
        assert!(report.announcement_path.expect("announcement").exists());
        let manifest_text = fs::read_to_string(&report.manifest_path).expect("manifest");
        let inspection = inspect_p2p_manifest_text(&manifest_text).expect("inspection");
        assert_eq!(inspection.manifest_id, "fixture-share");
        let plan = import_from_manifest_text(&manifest_text).expect("plan");
        assert_eq!(plan.required_pieces.len(), report.manifest.pieces.len());
    }

    #[test]
    fn verifies_signed_manifest_envelope_with_minimodel_key() {
        let (signed_json, public_key_json, signed) = signed_manifest_fixture("signed-share-kit");

        let verification =
            verify_signed_manifest_text(&signed_json, &public_key_json).expect("verified");

        assert_eq!(verification.kind, SIGNED_MANIFEST_VERIFICATION_KIND);
        assert_eq!(verification.manifest_id, signed.manifest.manifest_id);
        assert_eq!(verification.model_id, signed.manifest.model_id);
        assert_eq!(
            verification.signature_algorithm,
            SIGNATURE_ALGORITHM_ED25519
        );
        assert_eq!(verification.key_id, signed.signature.key_id);
        assert_eq!(verification.publisher_id, signed.signature.publisher_id);
        assert_eq!(
            verification.public_key_route,
            signed.signature.public_key_route
        );
        assert_eq!(verification.payload_sha256, signed.signature.payload_sha256);
        assert!(verification.valid);
    }

    #[test]
    fn rejects_signed_manifest_payload_drift() {
        let (_signed_json, public_key_json, mut signed) =
            signed_manifest_fixture("signed-payload-drift");
        signed.manifest.model_id = "signed-payload-drift-model-two".to_string();
        let drifted_json = to_pretty_json(&signed).expect("drifted json");

        let error = verify_signed_manifest_text(&drifted_json, &public_key_json)
            .expect_err("payload drift");

        assert!(
            error
                .to_string()
                .contains("signature.payload_sha256 mismatch"),
            "{error}"
        );
    }

    #[test]
    fn rejects_signed_manifest_signature_drift() {
        let (_signed_json, public_key_json, mut signed) =
            signed_manifest_fixture("signed-signature-drift");
        signed.signature.value = format!(
            "{SIGNATURE_VALUE_ED25519_BASE64_PREFIX}{}",
            BASE64_STANDARD.encode([0u8; 64])
        );
        let drifted_json = to_pretty_json(&signed).expect("drifted json");

        let error = verify_signed_manifest_text(&drifted_json, &public_key_json)
            .expect_err("signature drift");

        assert!(
            error.to_string().contains("signature.value did not verify"),
            "{error}"
        );
    }

    #[test]
    fn rejects_signed_manifest_revoked_public_key() {
        let (signed_json, public_key_json, _) = signed_manifest_fixture("signed-revoked-key");
        let revoked_key_json = public_key_json.replace("\"revoked\": false", "\"revoked\": true");

        let error =
            verify_signed_manifest_text(&signed_json, &revoked_key_json).expect_err("revoked key");

        assert!(error.to_string().contains("revoked"), "{error}");
    }

    #[test]
    fn public_base_url_validation_is_direct_and_strict() {
        assert_eq!(
            join_url(
                "https://example.com/tinyrustlm/",
                "tinyrustlm.p2p-manifest.v0.json"
            )
            .expect("https base"),
            "https://example.com/tinyrustlm/tinyrustlm.p2p-manifest.v0.json"
        );
        assert_eq!(
            join_url("HTTP://LOCALHOST:8123/peer", "manifest.json").expect("loopback base"),
            "HTTP://LOCALHOST:8123/peer/manifest.json"
        );

        for invalid in [
            "",
            "http://example.com/peer",
            "http://127.0.0.1/peer",
            "http://127.0.0.1:0/peer",
            "https://user@example.com/peer",
            "https://example.com/peer?download=1",
            "https://example.com/peer#fragment",
            "https://example.com/../peer",
            "https://example.com/peer%2fmanifest",
            "https://example.com/peer with spaces",
        ] {
            let error = join_url(invalid, "manifest.json").expect_err("unsafe base");
            assert!(
                error.to_string().contains("public_base_url"),
                "{invalid}: {error}"
            );
        }
        assert!(join_url("https://example.com/peer", "../manifest.json").is_err());
    }

    #[test]
    fn unsafe_public_base_url_fails_before_share_kit_output() {
        let output_dir = temp_dir("share-kit-unsafe-url");
        let error = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: output_dir.clone(),
            manifest_id: Some("fixture-share-unsafe-url".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: Some("peer-one".to_string()),
            public_base_url: Some("https://example.com/peer?download=1".to_string()),
            piece_size: Some(4096),
        })
        .expect_err("unsafe base URL");

        assert!(error.to_string().contains("public_base_url"));
        assert!(!output_dir.join("tinyrustlm.p2p-manifest.v0.json").exists());
        assert!(!output_dir.join("peer-pieces").exists());
    }

    #[test]
    fn rejects_manifest_piece_drift() {
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: temp_dir("share-kit-drift"),
            manifest_id: Some("fixture-share-drift".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: None,
            public_base_url: None,
            piece_size: Some(4096),
        })
        .expect("share kit");
        let mut manifest = report.manifest;
        manifest.pieces[0].byte_count += 1;
        let text = to_pretty_json(&manifest).expect("json");
        let error = inspect_p2p_manifest_text(&text).expect_err("drift");
        assert!(error.to_string().contains("piece byte total"));
    }

    #[test]
    fn applies_announcement_once() {
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: temp_dir("share-kit-catalog"),
            manifest_id: Some("fixture-share-catalog".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: Some("peer-one".to_string()),
            public_base_url: Some("https://example.com/tinyrustlm".to_string()),
            piece_size: Some(4096),
        })
        .expect("share kit");
        let announcement_text =
            fs::read_to_string(report.announcement_path.expect("announcement")).expect("read");
        let first = apply_received_announcement_text(&announcement_text, None).expect("catalog");
        let second_text = to_pretty_json(&first).expect("json");
        let second =
            apply_received_announcement_text(&announcement_text, Some(&second_text)).expect("same");
        assert_eq!(second.announcements.len(), 1);
    }

    #[test]
    fn inspects_announcement_catalog_and_enforces_catalog_budget() {
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: temp_dir("share-kit-catalog-inspect"),
            manifest_id: Some("fixture-share-catalog-inspect".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: Some("peer-one".to_string()),
            public_base_url: Some("https://example.com/tinyrustlm".to_string()),
            piece_size: Some(4096),
        })
        .expect("share kit");
        let announcement_text =
            fs::read_to_string(report.announcement_path.expect("announcement")).expect("read");
        let announcement: P2pAnnouncement =
            serde_json::from_str(&announcement_text).expect("announcement json");
        let catalog = apply_received_announcement_text(&announcement_text, None).expect("catalog");
        let catalog_text = to_pretty_json(&catalog).expect("catalog json");

        let inspection =
            inspect_announcement_catalog_text(&catalog_text).expect("catalog inspection");

        assert_eq!(inspection.kind, ANNOUNCEMENT_CATALOG_INSPECTION_KIND);
        assert_eq!(inspection.catalog_sha256, sha256_text(&catalog_text));
        assert_eq!(inspection.announcement_count, 1);
        assert_eq!(inspection.peer_count, 1);
        assert_eq!(inspection.manifest_count, 1);
        assert_eq!(inspection.model_count, 1);
        assert_eq!(
            inspection.total_announced_artifact_bytes,
            announcement.artifact_byte_count
        );
        assert!(inspection.valid);

        let oversized_catalog = " ".repeat(MAX_ANNOUNCEMENT_CATALOG_BYTES + 1);
        let inspect_error =
            inspect_announcement_catalog_text(&oversized_catalog).expect_err("oversized catalog");
        assert!(
            inspect_error
                .to_string()
                .contains("catalog exceeded byte budget"),
            "{inspect_error}"
        );
        let apply_error =
            apply_received_announcement_text(&announcement_text, Some(&oversized_catalog))
                .expect_err("oversized catalog before apply");
        assert!(
            apply_error
                .to_string()
                .contains("catalog exceeded byte budget"),
            "{apply_error}"
        );
    }

    #[test]
    fn rejects_conflicting_announcement_for_same_peer_manifest() {
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: temp_dir("share-kit-catalog-conflict"),
            manifest_id: Some("fixture-share-catalog-conflict".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: Some("peer-one".to_string()),
            public_base_url: Some("https://example.com/tinyrustlm".to_string()),
            piece_size: Some(4096),
        })
        .expect("share kit");
        let announcement_text =
            fs::read_to_string(report.announcement_path.expect("announcement")).expect("read");
        let announcement: P2pAnnouncement =
            serde_json::from_str(&announcement_text).expect("announcement json");
        let mut conflict = announcement.clone();
        conflict.manifest_sha256 =
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string();
        let conflict_text = to_pretty_json(&conflict).expect("json");
        let catalog = apply_received_announcement_text(&announcement_text, None).expect("catalog");
        let catalog_text = to_pretty_json(&catalog).expect("catalog json");

        let apply_error = apply_received_announcement_text(&conflict_text, Some(&catalog_text))
            .expect_err("conflict");
        assert!(
            apply_error.to_string().contains("conflicting metadata"),
            "{apply_error}"
        );

        let invalid_catalog = AnnouncementCatalog {
            kind: ANNOUNCEMENT_CATALOG_KIND.to_string(),
            version: 1,
            announcements: vec![announcement, conflict],
        };
        let validate_error = validate_catalog(&invalid_catalog).expect_err("catalog conflict");
        assert!(
            validate_error.to_string().contains("conflicting metadata"),
            "{validate_error}"
        );
    }

    #[test]
    fn assembles_local_share_kit() {
        let output_dir = temp_dir("share-kit-assemble");
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: output_dir.clone(),
            manifest_id: Some("fixture-share-assemble".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: None,
            public_base_url: None,
            piece_size: Some(4096),
        })
        .expect("share kit");
        let manifest_text = fs::read_to_string(&report.manifest_path).expect("manifest");
        let output_path = output_dir.join("assembled.slm");

        let receipt = assemble_from_manifest_text(&manifest_text, &output_dir, &output_path)
            .expect("assembled");

        assert_eq!(receipt.kind, LOCAL_IMPORT_RECEIPT_KIND);
        assert_eq!(receipt.piece_count, report.manifest.piece_count);
        assert_eq!(receipt.verified_piece_count, report.manifest.piece_count);
        assert_eq!(receipt.output_sha256, report.manifest.artifact_sha256);
        assert_eq!(
            receipt.output_byte_count,
            report.manifest.artifact_byte_count
        );
        assert!(receipt.receipt_path.exists());
        assert!(receipt
            .receipt_path
            .ends_with("assembled.slm.p2p-import-receipt.json"));
        assert!(receipt.boundary.piece_sha256_verified);
        assert!(receipt.boundary.slm_validation_performed);
        assert!(!receipt.boundary.network_fetch_performed);
        assert!(output_path.exists());

        let receipt_text = fs::read_to_string(&receipt.receipt_path).expect("receipt");
        let inspection = inspect_local_import_receipt_text(&receipt_text, &output_path)
            .expect("receipt inspection");
        assert_eq!(inspection.kind, LOCAL_IMPORT_RECEIPT_INSPECTION_KIND);
        assert_eq!(inspection.receipt_output_path, output_path);
        assert_eq!(
            inspection.inspected_output_sha256,
            report.manifest.artifact_sha256
        );
        assert_eq!(
            inspection.inspected_output_byte_count,
            report.manifest.artifact_byte_count
        );
        assert!(inspection.valid);
    }

    #[test]
    fn rejects_local_piece_hash_drift() {
        let output_dir = temp_dir("share-kit-piece-drift");
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: output_dir.clone(),
            manifest_id: Some("fixture-share-piece-drift".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: None,
            public_base_url: None,
            piece_size: Some(4096),
        })
        .expect("share kit");
        let manifest_text = fs::read_to_string(&report.manifest_path).expect("manifest");
        let first_piece = output_dir.join(&report.manifest.pieces[0].route);
        let mut bytes = fs::read(&first_piece).expect("piece");
        bytes[0] ^= 0xff;
        fs::write(&first_piece, bytes).expect("tamper");
        let output_path = output_dir.join("assembled-drift.slm");

        let error = assemble_from_manifest_text(&manifest_text, &output_dir, &output_path)
            .expect_err("piece drift");

        assert!(error.to_string().contains("SHA-256 mismatch"));
        assert!(!output_path.exists());
        assert!(!receipt_path_for_output(&output_path)
            .expect("receipt path")
            .exists());
    }

    #[test]
    fn rejects_local_import_receipt_output_drift() {
        let output_dir = temp_dir("share-kit-receipt-drift");
        let report = prepare_local_share_kit(PrepareShareKitRequest {
            model_path: fixture_model(),
            output_dir: output_dir.clone(),
            manifest_id: Some("fixture-share-receipt-drift".to_string()),
            model_id: Some("fixture-model".to_string()),
            peer_id: None,
            public_base_url: None,
            piece_size: Some(4096),
        })
        .expect("share kit");
        let manifest_text = fs::read_to_string(&report.manifest_path).expect("manifest");
        let output_path = output_dir.join("assembled-drift.slm");
        let receipt = assemble_from_manifest_text(&manifest_text, &output_dir, &output_path)
            .expect("assembled");
        let receipt_text = fs::read_to_string(&receipt.receipt_path).expect("receipt");
        let mut bytes = fs::read(&output_path).expect("output");
        let last = bytes.len() - 1;
        bytes[last] ^= 0xff;
        fs::write(&output_path, bytes).expect("tamper output");

        let error = inspect_local_import_receipt_text(&receipt_text, &output_path)
            .expect_err("output drift");

        assert!(!error.to_string().is_empty());
    }
}

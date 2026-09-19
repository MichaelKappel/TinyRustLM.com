#![forbid(unsafe_code)]
#![doc = "Canonical fixed-piece direct transport and SLM2 composition admission."]

use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

mod direct_composition_http;
mod direct_composition_seed;
mod direct_http;
mod manifest;
mod storage;

pub use direct_composition_seed::{
    DirectCompositionSeedDescriptor, DirectCompositionSeedMember, DIRECT_COMPOSITION_SEED_SCHEMA,
};

/// The sole current public P2P manifest schema.
pub const P2P_MANIFEST_SCHEMA: &str = "tinyrustlm.vnext.p2p_manifest.v1";
/// The exact fixed-piece Merkle profile.
pub const MERKLE_PROFILE: &str = "tinyrustlm.merkle.sha256-4mib.v1";
/// Canonical manifest file name inside a completed share kit.
pub const MANIFEST_FILE_NAME: &str = "manifest.json";
/// Canonical piece directory name inside a completed share kit.
pub const PIECE_DIRECTORY_NAME: &str = "pieces";

/// Stable public-safe P2P failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct P2pError {
    code: &'static str,
}

impl P2pError {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for P2pError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for P2pError {}

/// Closed artifact class admitted by direct transport.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum ArtifactAdmission {
    /// A complete SLM2 model bound to one exact local ACG2 composition.
    Slm2Model {
        /// Path to the exact ACG2 composition that names this model member.
        #[serde(rename = "compositionPath")]
        composition_path: PathBuf,
    },
    /// A complete ACG2 composition artifact.
    Acg2Composition,
}

/// Inputs required to create one provenance-bound share kit.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrepareShareKitRequest {
    /// Exact artifact path. Source bytes are never copied into manifest JSON.
    pub artifact_path: PathBuf,
    /// New output directory. Existing directories are rejected.
    pub output_directory: PathBuf,
    /// Exact registered artifact-manifest content ID.
    pub artifact_manifest_id: String,
    /// Exact qualification receipt content ID.
    pub qualification_receipt_id: String,
    /// Exact provenance receipt content ID.
    pub provenance_receipt_id: String,
    /// Bounded license expression bound into the public manifest.
    pub license_expression: String,
    /// Caller-authoritative RFC 3339 UTC creation instant.
    pub created_at_utc: String,
    /// Closed artifact admission mode.
    pub admission: ArtifactAdmission,
}

/// One exact ordered transfer piece.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct P2pPiece {
    /// Zero-based piece index.
    pub index: u64,
    /// Contiguous byte offset in the complete artifact.
    pub offset: u64,
    /// Exact piece byte length.
    pub length: u64,
    /// Plain SHA-256 of exact piece bytes.
    pub sha256: String,
}

/// Exact public-safe redaction declaration required by the registry.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PublicRedaction {
    /// Exact redaction profile.
    pub profile: String,
    /// Exact publication decision.
    pub decision: String,
}

/// Canonical public-safe direct-transfer manifest.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct P2pManifest {
    /// Exact registered schema.
    pub schema: String,
    /// Domain-separated canonical manifest identity.
    pub manifest_id: String,
    /// Lowercase canonical-content SHA-256.
    pub canonical_content_sha256: String,
    /// Registered artifact-manifest content ID.
    pub artifact_manifest_id: String,
    /// Plain artifact content ID.
    pub artifact_id: String,
    /// Plain complete-artifact SHA-256.
    pub artifact_sha256: String,
    /// Exact complete-artifact byte length.
    pub artifact_bytes: u64,
    /// Exact fixed piece size.
    pub piece_bytes: u64,
    /// Exact number of ordered pieces.
    pub piece_count: u64,
    /// Ordered contiguous piece identities.
    pub pieces: Vec<P2pPiece>,
    /// Exact Merkle profile.
    pub merkle_profile: String,
    /// Domain-separated Merkle root.
    pub merkle_root_sha256: String,
    /// Sorted exact composition artifact IDs required by the artifact.
    pub composition_artifact_ids: Vec<String>,
    /// Qualification receipt content ID.
    pub qualification_receipt_id: String,
    /// Provenance receipt content ID.
    pub provenance_receipt_id: String,
    /// Bounded license expression.
    pub license_expression: String,
    /// RFC 3339 UTC creation instant.
    pub created_at_utc: String,
    /// Public-safe redaction declaration.
    pub redaction: PublicRedaction,
}

/// Result of a create-only local share-kit transaction.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShareKitReport {
    pub(crate) output_directory: PathBuf,
    pub(crate) manifest_path: PathBuf,
    pub(crate) piece_directory: PathBuf,
    pub(crate) manifest: P2pManifest,
}

impl ShareKitReport {
    /// Returns the atomically promoted share-kit directory.
    pub fn output_directory(&self) -> &Path {
        &self.output_directory
    }

    /// Returns the canonical manifest path.
    pub fn manifest_path(&self) -> &Path {
        &self.manifest_path
    }

    /// Returns the canonical piece directory.
    pub fn piece_directory(&self) -> &Path {
        &self.piece_directory
    }

    /// Returns the independently validated manifest.
    pub const fn manifest(&self) -> &P2pManifest {
        &self.manifest
    }
}

/// Result of one create-only verified local assembly.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImportedArtifact {
    pub(crate) output_path: PathBuf,
    pub(crate) manifest_id: String,
    pub(crate) artifact_sha256: String,
    pub(crate) artifact_bytes: u64,
}

impl ImportedArtifact {
    /// Returns the atomically promoted artifact path.
    pub fn output_path(&self) -> &Path {
        &self.output_path
    }

    /// Returns the exact admitted manifest ID.
    pub fn manifest_id(&self) -> &str {
        &self.manifest_id
    }

    /// Returns the verified complete-artifact SHA-256.
    pub fn artifact_sha256(&self) -> &str {
        &self.artifact_sha256
    }

    /// Returns the verified complete-artifact byte length.
    pub const fn artifact_bytes(&self) -> u64 {
        self.artifact_bytes
    }
}

/// Creates one bounded, content-addressed, create-only local share kit.
pub use storage::prepare_share_kit;

/// Assembles, verifies, semantically admits, and atomically promotes one artifact.
pub use storage::assemble_from_piece_directory;

/// Parses and validates one exact canonical P2P manifest.
pub use manifest::inspect_manifest;

/// Fixed-route, identity-pinned direct HTTP peer transport.
pub use direct_http::{
    fetch_share_kit_from_http_peer, CancellationToken, DirectHttpLimits, DirectHttpServer,
    FetchShareKitRequest, DIRECT_HTTP_ROUTE_PREFIX, MAXIMUM_DIRECT_ARTIFACT_BYTES,
};

/// Fixed-route browser transport for one exact six-member composition.
pub use direct_composition_http::{
    direct_composition_member_route, DirectCompositionBrowserOrigin, DirectCompositionDescriptor,
    DirectCompositionHttpServer, DirectCompositionMemberDescriptor,
    DIRECT_COMPOSITION_HTTP_MEMBER_MEDIA_TYPE, DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE,
    DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX, DIRECT_COMPOSITION_MEMBER_NAMES,
    MAXIMUM_DIRECT_COMPOSITION_BYTES, TINYRUSTLM_BROWSER_ORIGIN,
};

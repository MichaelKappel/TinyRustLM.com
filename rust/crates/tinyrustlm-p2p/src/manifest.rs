use serde::Serialize;
use tinyrustlm_evidence::{finalize_registered_subject, validate_registered_subject};
use tinyrustlm_slm2::{PieceManifest, PIECE_BYTES};

use crate::{
    P2pError, P2pManifest, P2pPiece, PublicRedaction, MERKLE_PROFILE, P2P_MANIFEST_SCHEMA,
};

pub(crate) const MAXIMUM_MANIFEST_BYTES: usize = 2_097_152;

pub(crate) struct ManifestBindings<'a> {
    pub(crate) artifact_manifest_id: &'a str,
    pub(crate) qualification_receipt_id: &'a str,
    pub(crate) provenance_receipt_id: &'a str,
    pub(crate) license_expression: &'a str,
    pub(crate) created_at_utc: &'a str,
    pub(crate) composition_artifact_ids: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct P2pManifestDraft<'a> {
    schema: &'static str,
    artifact_manifest_id: &'a str,
    artifact_id: String,
    artifact_sha256: String,
    artifact_bytes: u64,
    piece_bytes: u64,
    piece_count: u64,
    pieces: Vec<P2pPiece>,
    merkle_profile: &'static str,
    merkle_root_sha256: String,
    composition_artifact_ids: Vec<String>,
    qualification_receipt_id: &'a str,
    provenance_receipt_id: &'a str,
    license_expression: &'a str,
    created_at_utc: &'a str,
    redaction: PublicRedaction,
}

pub(crate) fn finalize_manifest(
    piece_manifest: &PieceManifest,
    bindings: ManifestBindings<'_>,
) -> Result<(P2pManifest, Vec<u8>), P2pError> {
    let pieces = manifest_pieces(piece_manifest)?;
    let draft = P2pManifestDraft {
        schema: P2P_MANIFEST_SCHEMA,
        artifact_manifest_id: bindings.artifact_manifest_id,
        artifact_id: format!("sha256:{}", piece_manifest.artifact_sha256_hex()),
        artifact_sha256: piece_manifest.artifact_sha256_hex(),
        artifact_bytes: piece_manifest.artifact_byte_length(),
        piece_bytes: PIECE_BYTES,
        piece_count: pieces.len() as u64,
        pieces,
        merkle_profile: MERKLE_PROFILE,
        merkle_root_sha256: piece_manifest.merkle_root_hex(),
        composition_artifact_ids: bindings.composition_artifact_ids,
        qualification_receipt_id: bindings.qualification_receipt_id,
        provenance_receipt_id: bindings.provenance_receipt_id,
        license_expression: bindings.license_expression,
        created_at_utc: bindings.created_at_utc,
        redaction: public_redaction(),
    };
    let draft_value = serde_json::to_value(draft).map_err(|_| P2pError::new("p2p-json"))?;
    let subject =
        finalize_registered_subject(&draft_value).map_err(|error| P2pError::new(error.code()))?;
    require_p2p_subject(subject.contract_class(), subject.schema())?;
    let manifest = parse_validated_manifest(subject.bytes())?;
    Ok((manifest, subject.bytes().to_vec()))
}

/// Parses and validates one exact canonical P2P manifest.
pub fn inspect_manifest(bytes: &[u8]) -> Result<P2pManifest, P2pError> {
    if bytes.is_empty() || bytes.len() > MAXIMUM_MANIFEST_BYTES {
        return Err(P2pError::new("p2p-manifest-size"));
    }
    let subject =
        validate_registered_subject(bytes).map_err(|error| P2pError::new(error.code()))?;
    require_p2p_subject(subject.contract_class(), subject.schema())?;
    parse_validated_manifest(subject.bytes())
}

fn require_p2p_subject(class: &str, schema: &str) -> Result<(), P2pError> {
    if class != "p2p" || schema != P2P_MANIFEST_SCHEMA {
        return Err(P2pError::new("p2p-contract"));
    }
    Ok(())
}

fn parse_validated_manifest(bytes: &[u8]) -> Result<P2pManifest, P2pError> {
    serde_json::from_slice(bytes).map_err(|_| P2pError::new("p2p-json"))
}

fn manifest_pieces(manifest: &PieceManifest) -> Result<Vec<P2pPiece>, P2pError> {
    let mut offset = 0_u64;
    let mut output = Vec::with_capacity(manifest.pieces().len());
    for piece in manifest.pieces() {
        if piece.index() != output.len() as u64 {
            return Err(P2pError::new("p2p-piece-layout"));
        }
        output.push(P2pPiece {
            index: piece.index(),
            offset,
            length: piece.byte_length(),
            sha256: piece.sha256_hex(),
        });
        offset = offset
            .checked_add(piece.byte_length())
            .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
    }
    if offset != manifest.artifact_byte_length() {
        return Err(P2pError::new("p2p-piece-layout"));
    }
    Ok(output)
}

fn public_redaction() -> PublicRedaction {
    PublicRedaction {
        profile: "tinyrustlm.vnext.public_safe.v1".to_string(),
        decision: "public-safe".to_string(),
    }
}

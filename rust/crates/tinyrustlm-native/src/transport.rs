use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tinyrustlm_p2p::{
    assemble_from_piece_directory, inspect_manifest, prepare_share_kit, ArtifactAdmission,
    P2pManifest, PrepareShareKitRequest,
};

use crate::files::path_text;
use crate::response::{parse_json, NativeError, NativeResult};

pub(crate) const P2P_PREPARE_SCHEMA: &str = "tinyrustlm.native.p2p_prepare/1";
pub(crate) const P2P_ASSEMBLE_SCHEMA: &str = "tinyrustlm.native.p2p_assemble/1";
pub(crate) const MAXIMUM_P2P_REQUEST_JSON_BYTES: usize = 131_072;
pub(crate) const MAXIMUM_P2P_MANIFEST_BYTES: usize = 2_097_152;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PrepareRequest {
    schema: String,
    request: PrepareShareKitRequest,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AssembleRequest {
    schema: String,
    piece_directory: PathBuf,
    output_path: PathBuf,
    admission: ArtifactAdmission,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShareKitResponse {
    schema: &'static str,
    output_directory: String,
    manifest_path: String,
    piece_directory: String,
    manifest: P2pManifest,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportedArtifactResponse {
    schema: &'static str,
    output_path: String,
    manifest_id: String,
    artifact_sha256: String,
    artifact_bytes: u64,
}

pub(crate) fn prepare(request_bytes: &[u8]) -> NativeResult<ShareKitResponse> {
    let request: PrepareRequest = parse_json(request_bytes)?;
    if request.schema != P2P_PREPARE_SCHEMA {
        return Err(NativeError::new("native-contract"));
    }
    let report =
        prepare_share_kit(request.request).map_err(|error| NativeError::new(error.code()))?;
    Ok(ShareKitResponse {
        schema: "tinyrustlm.native.p2p_share_kit/1",
        output_directory: path_text(report.output_directory())?,
        manifest_path: path_text(report.manifest_path())?,
        piece_directory: path_text(report.piece_directory())?,
        manifest: report.manifest().clone(),
    })
}

pub(crate) fn inspect(manifest_bytes: &[u8]) -> NativeResult<P2pManifest> {
    inspect_manifest(manifest_bytes).map_err(|error| NativeError::new(error.code()))
}

pub(crate) fn assemble(
    request_bytes: &[u8],
    manifest_bytes: &[u8],
) -> NativeResult<ImportedArtifactResponse> {
    let request: AssembleRequest = parse_json(request_bytes)?;
    if request.schema != P2P_ASSEMBLE_SCHEMA {
        return Err(NativeError::new("native-contract"));
    }
    let artifact = assemble_from_piece_directory(
        manifest_bytes,
        &request.piece_directory,
        &request.output_path,
        &request.admission,
    )
    .map_err(|error| NativeError::new(error.code()))?;
    Ok(ImportedArtifactResponse {
        schema: "tinyrustlm.native.p2p_imported_artifact/1",
        output_path: path_text(artifact.output_path())?,
        manifest_id: artifact.manifest_id().to_owned(),
        artifact_sha256: artifact.artifact_sha256().to_owned(),
        artifact_bytes: artifact.artifact_bytes(),
    })
}

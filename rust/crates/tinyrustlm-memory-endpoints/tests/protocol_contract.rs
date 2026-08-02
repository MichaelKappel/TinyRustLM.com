//! Distributed-sync capability negotiation contract tests.

use tinyrustlm_memory_endpoints::{
    parse_distributed_sync_capabilities, validate_distributed_sync_capabilities,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_PULL_PAGE_SIZE,
};

const CAPABILITIES: &str = include_str!(
    "../../../../docs/nuget/memoryendpoints-distributed-sync-capabilities-v1.example.json"
);

#[test]
fn deployed_capability_envelope_is_live_and_complete() {
    let capabilities = parse_distributed_sync_capabilities(CAPABILITIES).unwrap();
    validate_distributed_sync_capabilities(&capabilities).unwrap();
    assert_eq!(capabilities.status, "live");
    assert!(!capabilities.mutation_contract.hard_forget_supported);
    assert_eq!(
        capabilities.routes.lookup_receipt,
        "/api/matm/sync/receipts"
    );
    assert_eq!(MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_PULL_PAGE_SIZE, 200);
}

#[test]
fn missing_checkpoint_or_device_authority_fails_closed() {
    let no_monotonic = CAPABILITIES.replace(
        "\"monotonicServerSequence\": true",
        "\"monotonicServerSequence\": false",
    );
    assert!(parse_distributed_sync_capabilities(&no_monotonic).is_err());

    let secret_device = CAPABILITIES.replace(
        "\"secretMaterialStored\": false",
        "\"secretMaterialStored\": true",
    );
    assert!(parse_distributed_sync_capabilities(&secret_device).is_err());
}

#[test]
fn route_or_operation_drift_fails_closed() {
    let draft_route =
        CAPABILITIES.replace("\"/api/matm/sync/heads\"", "\"/api/matm/sync/heads/read\"");
    assert!(parse_distributed_sync_capabilities(&draft_route).is_err());

    let silent_overwrite = CAPABILITIES.replace("\"hard_forget\"", "\"last_write_wins\"");
    assert!(parse_distributed_sync_capabilities(&silent_overwrite).is_err());
}

#[test]
fn unsupported_hard_forget_and_unsafe_retention_fail_closed() {
    let hard_forget = CAPABILITIES.replace(
        "\"hardForgetSupported\": false",
        "\"hardForgetSupported\": true",
    );
    assert!(parse_distributed_sync_capabilities(&hard_forget).is_err());

    let raw_private = CAPABILITIES.replace(
        "\"rawPrivatePayloadStored\": false",
        "\"rawPrivatePayloadStored\": true",
    );
    assert!(parse_distributed_sync_capabilities(&raw_private).is_err());
}

#[test]
fn preview_error_and_unknown_envelopes_are_not_executable_authority() {
    let preview = CAPABILITIES.replace("\"status\": \"live\"", "\"status\": \"preview\"");
    assert!(parse_distributed_sync_capabilities(&preview).is_err());

    let failed = CAPABILITIES.replacen("\"ok\": true", "\"ok\": false", 1);
    assert!(parse_distributed_sync_capabilities(&failed).is_err());

    let unknown = CAPABILITIES.replacen(
        "\"ok\": true,",
        "\"ok\": true, \"silentLastWriteWins\": true,",
        1,
    );
    assert!(parse_distributed_sync_capabilities(&unknown).is_err());
}

#[test]
fn oversized_capability_documents_are_rejected() {
    let oversized = format!("{}{}", CAPABILITIES, " ".repeat(64 * 1024));
    assert!(parse_distributed_sync_capabilities(&oversized).is_err());
}

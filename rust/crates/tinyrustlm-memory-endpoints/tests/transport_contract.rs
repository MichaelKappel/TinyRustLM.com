//! Production MemoryEndpoints distributed-sync wire contract tests.

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tinyrustlm_memory_endpoints::{
    canonicalize_hosted_revision_mutation, hosted_revision_mutation_fingerprint, parse_change_page,
    parse_device_authority_response, parse_read_heads_response, parse_receipt_lookup_response,
    parse_retention_policy_response, parse_revision_decision_response,
    validate_distributed_sync_idempotency_key, MemoryEndpointsHostedRevisionMutation,
    MemoryEndpointsHostedSyncOperation, MemoryEndpointsHostedSyncStatus,
};

const CAPABILITIES: &str = include_str!(
    "../../../../docs/nuget/memoryendpoints-distributed-sync-capabilities-v1.example.json"
);

#[test]
fn canonical_mutation_is_stable_and_body_bound() {
    let raw = mutation();
    let canonical = canonicalize_hosted_revision_mutation(&raw).unwrap();
    assert_eq!(
        canonical.parent_revision_id.as_deref(),
        Some("syncrev-parent")
    );
    assert_eq!(canonical.scope, "goal");
    assert_eq!(
        canonical.body_hash,
        "10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f"
    );
    assert_eq!(
        hosted_revision_mutation_fingerprint(&raw).unwrap(),
        "fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445"
    );
    assert_eq!(
        hosted_revision_mutation_fingerprint(&raw).unwrap(),
        hosted_revision_mutation_fingerprint(&canonical).unwrap()
    );
    assert!(validate_distributed_sync_idempotency_key("tinyrustlm:device-a:event-42").is_ok());
    assert!(validate_distributed_sync_idempotency_key("Bearer secret").is_err());
}

#[test]
fn applied_conflict_and_rejected_receipts_are_explicit() {
    let applied =
        parse_revision_decision_response(&decision_json("applied", "", 7, true, true)).unwrap();
    assert_eq!(applied.status, MemoryEndpointsHostedSyncStatus::Applied);
    assert!(applied.confirmation.persisted);

    let conflict = parse_revision_decision_response(&decision_json(
        "conflict",
        "parent_revision_mismatch",
        8,
        true,
        false,
    ))
    .unwrap();
    assert_eq!(conflict.status, MemoryEndpointsHostedSyncStatus::Conflict);
    assert!(conflict.conflict);
    assert_eq!(conflict.receipt.conflict_code, "parent_revision_mismatch");

    let rejected = parse_revision_decision_response(&decision_json(
        "rejected",
        "device_revoked",
        0,
        false,
        false,
    ))
    .unwrap();
    assert_eq!(rejected.status, MemoryEndpointsHostedSyncStatus::Rejected);
    assert!(rejected.revision.is_none());
    assert!(rejected.persisted);
}

#[test]
fn receipt_lookup_is_body_bound_and_never_echoes_the_key() {
    let decision: Value =
        serde_json::from_str(&decision_json("applied", "", 7, true, true)).unwrap();
    let lookup = json!({
        "ok": true,
        "receipt": decision["receipt"],
        "operatorSummary": operator_summary("receipt", "applied", "", 7),
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    });
    let parsed = parse_receipt_lookup_response(&lookup.to_string()).unwrap();
    assert!(parsed.receipt.idempotency_key_hash.starts_with("sha256:"));
    assert!(!lookup.to_string().contains("tinyrustlm:device-a:event-42"));

    let unsafe_lookup = lookup.to_string().replace(
        "\"idempotencyKeyExposed\":false",
        "\"idempotencyKeyExposed\":true",
    );
    assert!(parse_receipt_lookup_response(&unsafe_lookup).is_err());
}

#[test]
fn change_pages_require_strict_monotonic_checkpoint_progress() {
    let revision = revision_json("applied", "", 7, false);
    let page = json!({
        "ok": true,
        "changes": {
            "items": [revision],
            "count": 1,
            "hasMore": false,
            "nextAfterSequence": 7,
            "indexedThroughSequence": 7,
            "checkpoint": {
                "workspaceIdHash": format!("sha256:{}", sha256("workspace-fixture")),
                "afterSequence": 6,
                "nextAfterSequence": 7,
                "valuesRedacted": true
            },
            "valuesRedacted": true,
            "rawCredentialExposed": false,
            "rawPayloadExposed": false
        },
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    });
    assert_eq!(
        parse_change_page(&page.to_string(), 6)
            .unwrap()
            .changes
            .next_after_sequence,
        7
    );
    assert!(parse_change_page(&page.to_string(), 5).is_err());

    let regressed = page
        .to_string()
        .replace("\"nextAfterSequence\":7", "\"nextAfterSequence\":6");
    assert!(parse_change_page(&regressed, 6).is_err());
}

#[test]
fn device_heads_and_retention_readback_are_strictly_redacted() {
    let device = json!({
        "ok": true,
        "persisted": true,
        "visibleToAgent": true,
        "deviceAuthorityPersisted": true,
        "canonicalWorkspaceId": "workspace-fixture",
        "canonicalDeviceId": "device-a",
        "device": {
            "deviceId": "device-a",
            "workspaceId": "workspace-fixture",
            "agentId": "tinyrustlm-agent",
            "label": "TinyRustLM test device",
            "status": "active",
            "authorityEpoch": 1,
            "createdAt": "2026-07-10T22:00:00Z",
            "updatedAt": "2026-07-10T22:00:00Z",
            "revokedAt": null,
            "valuesRedacted": true,
            "rawPayloadExposed": false
        },
        "capabilityRoute": "/api/matm/sync/capabilities",
        "operatorSummary": {
            "schemaVersion": "memoryendpoints.sync_device_operator_summary.v1",
            "action": "register",
            "deviceId": "device-a",
            "status": "active",
            "authorityEpoch": 1,
            "persisted": true,
            "valuesRedacted": true,
            "rawCredentialExposed": false,
            "rawPayloadExposed": false
        },
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    });
    assert_eq!(
        parse_device_authority_response(&device.to_string())
            .unwrap()
            .device
            .authority_epoch,
        1
    );

    let head = head_json(7);
    let heads = json!({
        "ok": true,
        "items": [head],
        "count": 1,
        "filters": {"logicalMemoryId": "logical-memory-a"},
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    });
    assert_eq!(
        parse_read_heads_response(&heads.to_string()).unwrap().count,
        1
    );

    let capabilities: Value = serde_json::from_str(CAPABILITIES).unwrap();
    let retention = json!({
        "ok": true,
        "policy": {
            "schemaVersion": "memoryendpoints.sync_retention.v1",
            "tombstoneRetentionDays": 30,
            "hardForgetSupported": false,
            "hardForgetBehavior": "safe_rejected_receipt",
            "rawPrivatePayloadStored": false,
            "valuesRedacted": true,
            "rawCredentialExposed": false,
            "rawPayloadExposed": false
        },
        "capabilities": capabilities["data"],
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    });
    assert_eq!(
        parse_retention_policy_response(&retention.to_string())
            .unwrap()
            .policy
            .tombstone_retention_days,
        30
    );
}

fn mutation() -> MemoryEndpointsHostedRevisionMutation {
    MemoryEndpointsHostedRevisionMutation {
        workspace_id: " workspace-fixture ".to_string(),
        actor_agent_id: " tinyrustlm-agent ".to_string(),
        device_id: " device-a ".to_string(),
        device_epoch: 1,
        logical_memory_id: " logical-memory-a ".to_string(),
        operation: MemoryEndpointsHostedSyncOperation::Upsert,
        parent_revision_id: Some(" syncrev-parent ".to_string()),
        title: " Durable TinyRustLM memory ".to_string(),
        summary: "Public-safe durable memory.".to_string(),
        source_ref: " tinyrustlm://offline-sync/test ".to_string(),
        scope: " Goal ".to_string(),
        scope_id: " goal-tinyrustlm-hosted-memory ".to_string(),
        memory_type: " Handoff ".to_string(),
        body_hash: String::new(),
    }
}

fn decision_json(
    status: &str,
    conflict_code: &str,
    server_sequence: u64,
    include_revision: bool,
    applied_head: bool,
) -> String {
    let conflict = status == "conflict";
    let applied = status == "applied";
    let body_hash = canonicalize_hosted_revision_mutation(&mutation())
        .unwrap()
        .body_hash;
    let revision =
        include_revision.then(|| revision_json(status, conflict_code, server_sequence, false));
    let head =
        (applied_head || conflict).then(|| head_json(if applied { server_sequence } else { 7 }));
    let revision_id = revision
        .as_ref()
        .and_then(|value| value.get("syncRevisionId"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let receipt = json!({
        "receiptId": format!("syncreceipt-{status}"),
        "workspaceId": "workspace-fixture",
        "idempotencyKeyHash": format!("sha256:{}", sha256("tinyrustlm:device-a:event-42")),
        "bodyHash": body_hash,
        "logicalMemoryId": "logical-memory-a",
        "syncRevisionId": revision_id,
        "serverSequence": server_sequence,
        "status": status,
        "conflict": conflict,
        "conflictCode": conflict_code,
        "currentHeadRevisionId": if applied { "syncrev-parent" } else { "syncrev-current" },
        "httpStatus": if applied { "202 Accepted" } else { "409 Conflict" },
        "createdAt": "2026-07-10T22:01:00Z",
        "idempotencyKeyExposed": false,
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    });
    json!({
        "ok": applied,
        "persisted": true,
        "receipt": receipt,
        "revision": revision,
        "head": head,
        "serverSequence": server_sequence,
        "indexedThroughSequence": if server_sequence == 0 { 7 } else { server_sequence },
        "conflict": conflict,
        "status": status,
        "operatorSummary": operator_summary("mutation", status, conflict_code, server_sequence),
        "receiptQueryUrl": format!("/api/matm/sync/receipts?workspace_id=workspace-fixture&receipt_id=syncreceipt-{status}"),
        "changesQueryUrl": format!("/api/matm/sync/changes?workspace_id=workspace-fixture&after_sequence={}", server_sequence.saturating_sub(1)),
        "headsQueryUrl": "/api/matm/sync/heads?workspace_id=workspace-fixture&logical_memory_id=logical-memory-a",
        "capabilityRoute": "/api/matm/sync/capabilities",
        "confirmation": {
            "schemaVersion": "memoryendpoints.sync_mutation_confirmation.v1",
            "persisted": true,
            "receiptVisible": true,
            "revisionVisibleInChanges": true,
            "headVisible": true,
            "changesCount": if include_revision { 1 } else { 0 },
            "headsCount": if applied_head { 1 } else { 0 },
            "receiptId": format!("syncreceipt-{status}"),
            "revisionId": revision_id,
            "logicalMemoryId": "logical-memory-a",
            "indexedThroughSequence": if server_sequence == 0 { 7 } else { server_sequence },
            "valuesRedacted": true,
            "rawCredentialExposed": false,
            "rawPayloadExposed": false
        },
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    })
    .to_string()
}

fn revision_json(
    status: &str,
    conflict_code: &str,
    server_sequence: u64,
    tombstone: bool,
) -> Value {
    let canonical = canonicalize_hosted_revision_mutation(&mutation()).unwrap();
    json!({
        "syncRevisionId": format!("syncrev-{status}"),
        "workspaceId": "workspace-fixture",
        "logicalMemoryId": "logical-memory-a",
        "parentRevisionId": "syncrev-parent",
        "memoryEventId": "",
        "actorAgentId": "tinyrustlm-agent",
        "deviceId": "device-a",
        "deviceEpoch": 1,
        "operation": if tombstone { "delete" } else { "upsert" },
        "status": status,
        "conflict": status == "conflict",
        "conflictCode": conflict_code,
        "serverSequence": server_sequence,
        "bodyHash": canonical.body_hash,
        "source": "tinyrustlm://offline-sync/test",
        "title": "Durable TinyRustLM memory",
        "summary": "Public-safe durable memory.",
        "scope": "goal",
        "scopeId": "goal-tinyrustlm-hosted-memory",
        "memoryType": "handoff",
        "tombstone": tombstone,
        "createdAt": "2026-07-10T22:01:00Z",
        "valuesRedacted": true,
        "rawPayloadExposed": false
    })
}

fn head_json(server_sequence: u64) -> Value {
    json!({
        "logicalMemoryId": "logical-memory-a",
        "workspaceId": "workspace-fixture",
        "headRevisionId": if server_sequence == 7 { "syncrev-applied" } else { "syncrev-current" },
        "serverSequence": server_sequence,
        "indexedThroughSequence": server_sequence,
        "status": "active",
        "updatedAt": "2026-07-10T22:01:00Z",
        "valuesRedacted": true,
        "rawPayloadExposed": false
    })
}

fn operator_summary(action: &str, status: &str, conflict_code: &str, sequence: u64) -> Value {
    json!({
        "schemaVersion": "memoryendpoints.sync_operator_summary.v1",
        "action": action,
        "status": status,
        "serverSequence": sequence,
        "conflict": status == "conflict",
        "conflictCode": conflict_code,
        "persisted": true,
        "valuesRedacted": true,
        "rawCredentialExposed": false,
        "rawPayloadExposed": false
    })
}

fn sha256(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

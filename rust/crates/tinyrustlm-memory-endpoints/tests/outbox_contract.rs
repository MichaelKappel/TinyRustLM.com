#![doc = "Public deterministic outbox contract tests for TinyRustLM MemoryEndpoints sync."]

use tinyrustlm_memory_endpoints::{
    deserialize_outbox_entry_text, prepare_outbox_entry, validate_outbox_entry,
    MemoryEndpointsAuthoritativeReceipt, MemoryEndpointsMemoryRecord, MemoryEndpointsOutboxState,
    MemoryEndpointsScope, MEMORY_ENDPOINTS_AUTHORITATIVE_RECEIPT_KIND,
    MEMORY_ENDPOINTS_MEMORY_RECORD_KIND,
};

fn memory_record() -> MemoryEndpointsMemoryRecord {
    MemoryEndpointsMemoryRecord {
        kind: MEMORY_ENDPOINTS_MEMORY_RECORD_KIND.to_string(),
        version: 1,
        scope: MemoryEndpointsScope::LongTerm,
        workspace_id: "workspace-demo".to_string(),
        agent_id: "tinyrustlm-agent".to_string(),
        title: "Durable sync design".to_string(),
        safe_summary: "Public-safe durable memory for the offline synchronization contract."
            .to_string(),
        uai_references: vec![
            "wiki/runtime-mirust/reports/sync.md".to_string(),
            ".uai/long-term-memory.uai".to_string(),
        ],
        tags: vec!["offline".to_string(), "tinyrustlm".to_string()],
        source_sha256: None,
    }
}

#[test]
fn equal_logical_payloads_have_one_fingerprint_and_retry_identity() {
    let first = prepare_outbox_entry(
        &memory_record(),
        "event-0123456789abcdef",
        "device-browser-a",
        1_720_000_000_000,
    )
    .unwrap();

    let mut reordered = memory_record();
    reordered.uai_references.reverse();
    reordered.tags.reverse();
    let second = prepare_outbox_entry(
        &reordered,
        "event-0123456789abcdef",
        "device-browser-a",
        1_720_000_000_000,
    )
    .unwrap();

    assert_eq!(first.payload_sha256, second.payload_sha256);
    assert_eq!(
        first.payload_sha256,
        "ffa9fb1d3b729902d8a62621ce08d627b7042aaad89f5d8ca51a6257f3e305aa"
    );
    assert_eq!(first.idempotency_key, second.idempotency_key);
    assert!(first.idempotency_key.starts_with("tinyrustlm-memory-v2-"));
    assert_eq!(first.version, 2);
    assert_eq!(first.local_receipt.version, 2);
    assert_eq!(first.payload, second.payload);
    assert_eq!(first.state, MemoryEndpointsOutboxState::SavedLocally);
    assert_eq!(first.local_receipt.event_id, first.event_id);
    assert_eq!(first.local_receipt.payload_sha256, first.payload_sha256);
}

#[test]
fn retry_preserves_key_and_synchronization_requires_matching_receipt() {
    let mut entry = prepare_outbox_entry(
        &memory_record(),
        "event-0123456789abcdef",
        "device-browser-a",
        1_720_000_000_000,
    )
    .unwrap();
    let original_key = entry.idempotency_key.clone();

    entry.mark_queued(1_720_000_000_010).unwrap();
    entry.begin_send(1_720_000_000_020).unwrap();
    entry
        .schedule_retry("network_timeout", 1_720_000_001_000, 1_720_000_000_030)
        .unwrap();

    assert_eq!(entry.state, MemoryEndpointsOutboxState::RetryPending);
    assert_eq!(entry.idempotency_key, original_key);
    assert!(!entry.is_sendable(1_720_000_000_999));
    assert!(entry.is_sendable(1_720_000_001_000));

    let mismatched = MemoryEndpointsAuthoritativeReceipt {
        kind: MEMORY_ENDPOINTS_AUTHORITATIVE_RECEIPT_KIND.to_string(),
        version: 1,
        event_id: entry.event_id.clone(),
        idempotency_key: entry.idempotency_key.clone(),
        payload_sha256: "0".repeat(64),
        memory_event_id: "mem-demo".to_string(),
        receipt_id: Some("receipt-demo".to_string()),
        persisted: true,
        accepted_at_unix_ms: 1_720_000_001_100,
        revision_id: None,
        server_sequence: None,
    };
    assert!(entry
        .apply_authoritative_receipt(mismatched, 1_720_000_001_100)
        .is_err());
    assert_eq!(entry.state, MemoryEndpointsOutboxState::RetryPending);

    let receipt = MemoryEndpointsAuthoritativeReceipt {
        kind: MEMORY_ENDPOINTS_AUTHORITATIVE_RECEIPT_KIND.to_string(),
        version: 1,
        event_id: entry.event_id.clone(),
        idempotency_key: entry.idempotency_key.clone(),
        payload_sha256: entry.payload_sha256.clone(),
        memory_event_id: "mem-demo".to_string(),
        receipt_id: Some("receipt-demo".to_string()),
        persisted: true,
        accepted_at_unix_ms: 1_720_000_001_100,
        revision_id: None,
        server_sequence: None,
    };
    entry
        .apply_authoritative_receipt(receipt, 1_720_000_001_100)
        .unwrap();

    assert_eq!(entry.state, MemoryEndpointsOutboxState::Synchronized);
    assert_eq!(entry.idempotency_key, original_key);
    assert!(entry.authoritative_receipt.is_some());
    assert!(!entry.is_sendable(u64::MAX));
}

#[test]
fn persisted_rows_reject_credentials_and_payload_mutation() {
    let entry = prepare_outbox_entry(
        &memory_record(),
        "event-0123456789abcdef",
        "device-browser-a",
        1_720_000_000_000,
    )
    .unwrap();
    let json = serde_json::to_string(&entry).unwrap();

    assert!(!json.to_ascii_lowercase().contains("bearertoken"));
    assert!(!json.to_ascii_lowercase().contains("authorization"));
    assert!(!json.to_ascii_lowercase().contains("workspacekey"));
    assert!(json.contains("\"actorAgentId\""));
    assert!(json.contains("\"summary\""));
    assert!(!json.contains("\"agentId\""));
    assert!(!json.contains("\"safeSummary\""));
    assert_eq!(deserialize_outbox_entry_text(&json).unwrap(), entry);

    let mut with_credential: serde_json::Value = serde_json::from_str(&json).unwrap();
    with_credential["workspaceKey"] = serde_json::json!("must-not-persist");
    assert!(deserialize_outbox_entry_text(&with_credential.to_string()).is_err());

    let mut with_retired_agent_alias: serde_json::Value = serde_json::from_str(&json).unwrap();
    with_retired_agent_alias["payload"]["agentId"] = serde_json::json!("tinyrustlm-agent");
    assert!(deserialize_outbox_entry_text(&with_retired_agent_alias.to_string()).is_err());

    let mut with_retired_summary_alias: serde_json::Value = serde_json::from_str(&json).unwrap();
    with_retired_summary_alias["payload"]["safeSummary"] =
        serde_json::json!("Public-safe durable memory for the offline synchronization contract.");
    assert!(deserialize_outbox_entry_text(&with_retired_summary_alias.to_string()).is_err());

    let mut mutated = entry.clone();
    mutated.payload.summary.push_str(" changed");
    assert!(validate_outbox_entry(&mutated).is_err());
}

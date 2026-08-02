#![doc = "Distributed conflict, deletion, checkpoint, and compaction contract tests."]

use tinyrustlm_memory_endpoints::{
    decide_revision_mutation, plan_sync_compaction, report_search_freshness,
    validate_checkpoint_advance, MemoryEndpointsDeviceAuthority, MemoryEndpointsEraseMode,
    MemoryEndpointsRetentionKind, MemoryEndpointsRetentionRecord,
    MemoryEndpointsRevisionDecisionKind, MemoryEndpointsRevisionHead,
    MemoryEndpointsRevisionMutation, MemoryEndpointsRevisionOperation,
    MemoryEndpointsRevisionState, MemoryEndpointsSearchFreshness, MemoryEndpointsSyncCheckpoint,
    MEMORY_ENDPOINTS_REVISION_HEAD_KIND, MEMORY_ENDPOINTS_REVISION_MUTATION_KIND,
    MEMORY_ENDPOINTS_SYNC_CHECKPOINT_KIND,
};

fn active_head() -> MemoryEndpointsRevisionHead {
    MemoryEndpointsRevisionHead {
        kind: MEMORY_ENDPOINTS_REVISION_HEAD_KIND.to_string(),
        version: 1,
        memory_id: "memory-demo".to_string(),
        revision_id: "revision-root".to_string(),
        parent_revision_id: None,
        body_sha256: "a".repeat(64),
        normalized_body_sha256: "a".repeat(64),
        state: MemoryEndpointsRevisionState::Active,
        server_sequence: 1,
        accepted_device_id: "device-a".to_string(),
        accepted_device_epoch: 1,
        tombstone_retention_until_unix_ms: None,
    }
}

fn mutation(
    revision_id: &str,
    parent_revision_id: Option<&str>,
    body: char,
    device_id: &str,
) -> MemoryEndpointsRevisionMutation {
    MemoryEndpointsRevisionMutation {
        kind: MEMORY_ENDPOINTS_REVISION_MUTATION_KIND.to_string(),
        version: 1,
        memory_id: "memory-demo".to_string(),
        revision_id: revision_id.to_string(),
        parent_revision_id: parent_revision_id.map(str::to_string),
        body_sha256: body.to_string().repeat(64),
        normalized_body_sha256: body.to_string().repeat(64),
        device_id: device_id.to_string(),
        device_epoch: 1,
        device_sequence: 1,
        lamport_time: 2,
        operation: MemoryEndpointsRevisionOperation::Upsert,
        erase_mode: MemoryEndpointsEraseMode::NotApplicable,
        retention_until_unix_ms: None,
    }
}

fn authority(device_id: &str) -> MemoryEndpointsDeviceAuthority {
    MemoryEndpointsDeviceAuthority {
        device_id: device_id.to_string(),
        current_epoch: 1,
        revoked: false,
    }
}

#[test]
fn concurrent_device_edits_create_an_explicit_conflict_without_last_write_wins() {
    let root = active_head();
    let first = mutation("revision-device-a", Some("revision-root"), 'b', "device-a");
    let accepted =
        decide_revision_mutation(Some(&root), &first, &authority("device-a"), 2, false).unwrap();
    assert_eq!(accepted.kind, MemoryEndpointsRevisionDecisionKind::Accepted);
    assert_eq!(
        accepted.current_revision_id.as_deref(),
        Some("revision-root")
    );
    let accepted_head = accepted.next_head.unwrap();
    assert_eq!(accepted_head.revision_id, "revision-device-a");

    let second = mutation("revision-device-b", Some("revision-root"), 'c', "device-b");
    let conflict = decide_revision_mutation(
        Some(&accepted_head),
        &second,
        &authority("device-b"),
        3,
        false,
    )
    .unwrap();

    assert_eq!(conflict.kind, MemoryEndpointsRevisionDecisionKind::Conflict);
    assert_eq!(
        conflict.current_revision_id.as_deref(),
        Some("revision-device-a")
    );
    assert_eq!(conflict.candidate_revision_id, "revision-device-b");
    assert_eq!(
        conflict.conflict_id.as_deref(),
        Some("conflict-8d88fc6fe4351701352a6668")
    );
    assert!(conflict.next_head.is_none());

    let mut identical = second.clone();
    identical.normalized_body_sha256 = accepted_head.normalized_body_sha256.clone();
    identical.body_sha256 = accepted_head.body_sha256.clone();
    let deduplicated = decide_revision_mutation(
        Some(&accepted_head),
        &identical,
        &authority("device-b"),
        3,
        false,
    )
    .unwrap();
    assert_eq!(
        deduplicated.kind,
        MemoryEndpointsRevisionDecisionKind::Deduplicated
    );
    assert_eq!(
        deduplicated.current_revision_id.as_deref(),
        Some("revision-device-a")
    );
}

#[test]
fn tombstones_block_stale_resurrection_and_hard_forget_fails_closed() {
    let root = active_head();
    let mut tombstone = mutation("revision-tombstone", Some("revision-root"), 'd', "device-a");
    tombstone.operation = MemoryEndpointsRevisionOperation::Tombstone;
    tombstone.erase_mode = MemoryEndpointsEraseMode::SoftDelete;
    tombstone.retention_until_unix_ms = Some(1_900_000_000_000);
    let accepted =
        decide_revision_mutation(Some(&root), &tombstone, &authority("device-a"), 2, false)
            .unwrap();
    let tombstone_head = accepted.next_head.unwrap();
    assert_eq!(
        tombstone_head.state,
        MemoryEndpointsRevisionState::Tombstone
    );

    let stale_edit = mutation("revision-stale", Some("revision-root"), 'e', "device-b");
    let blocked = decide_revision_mutation(
        Some(&tombstone_head),
        &stale_edit,
        &authority("device-b"),
        3,
        false,
    )
    .unwrap();
    assert_eq!(
        blocked.kind,
        MemoryEndpointsRevisionDecisionKind::BlockedByTombstone
    );
    assert!(blocked.next_head.is_none());

    let mut hard_forget = tombstone;
    hard_forget.revision_id = "revision-hard-forget".to_string();
    hard_forget.parent_revision_id = Some("revision-tombstone".to_string());
    hard_forget.erase_mode = MemoryEndpointsEraseMode::HardForgetRequested;
    let unsupported = decide_revision_mutation(
        Some(&tombstone_head),
        &hard_forget,
        &authority("device-a"),
        3,
        false,
    )
    .unwrap();
    assert_eq!(
        unsupported.kind,
        MemoryEndpointsRevisionDecisionKind::UnsupportedHardForget
    );
}

#[test]
fn revoked_or_rekeyed_device_cannot_relabel_an_old_queue() {
    let root = active_head();
    let candidate = mutation(
        "revision-old-device",
        Some("revision-root"),
        'b',
        "device-a",
    );
    let revoked = MemoryEndpointsDeviceAuthority {
        device_id: "device-a".to_string(),
        current_epoch: 1,
        revoked: true,
    };
    let decision = decide_revision_mutation(Some(&root), &candidate, &revoked, 2, false).unwrap();
    assert_eq!(
        decision.kind,
        MemoryEndpointsRevisionDecisionKind::BlockedByRevocation
    );

    let rotated = MemoryEndpointsDeviceAuthority {
        device_id: "device-a".to_string(),
        current_epoch: 2,
        revoked: false,
    };
    let stale_epoch =
        decide_revision_mutation(Some(&root), &candidate, &rotated, 2, false).unwrap();
    assert_eq!(
        stale_epoch.kind,
        MemoryEndpointsRevisionDecisionKind::BlockedByRevocation
    );
}

#[test]
fn checkpoints_freshness_and_compaction_preserve_authoritative_state() {
    let first = MemoryEndpointsSyncCheckpoint {
        kind: MEMORY_ENDPOINTS_SYNC_CHECKPOINT_KIND.to_string(),
        version: 1,
        workspace_id: "workspace-demo".to_string(),
        pulled_at_unix_ms: 1_720_000_000_000,
        max_server_sequence: Some(100),
        max_created_at_unix_ms: 1_719_999_999_000,
        max_event_id: "mem-100".to_string(),
        record_count: 10_000,
        complete_snapshot: true,
    };
    let mut next = first.clone();
    next.pulled_at_unix_ms += 1_000;
    next.max_server_sequence = Some(101);
    next.max_event_id = "mem-101".to_string();
    assert!(validate_checkpoint_advance(Some(&first), &next).is_ok());

    let mut regressed = next.clone();
    regressed.max_server_sequence = Some(99);
    assert!(validate_checkpoint_advance(Some(&next), &regressed).is_err());

    let stale = report_search_freshness(Some(105), Some(101)).unwrap();
    assert_eq!(stale.freshness, MemoryEndpointsSearchFreshness::Stale);
    assert_eq!(stale.sequence_lag, Some(4));
    let current = report_search_freshness(Some(105), Some(105)).unwrap();
    assert_eq!(current.freshness, MemoryEndpointsSearchFreshness::Current);

    let records = vec![
        retention(
            "head",
            MemoryEndpointsRetentionKind::LiveHead,
            true,
            false,
            None,
        ),
        retention(
            "old-revision",
            MemoryEndpointsRetentionKind::Revision,
            false,
            false,
            None,
        ),
        retention(
            "conflict",
            MemoryEndpointsRetentionKind::Conflict,
            false,
            true,
            None,
        ),
        retention(
            "tombstone",
            MemoryEndpointsRetentionKind::Tombstone,
            false,
            false,
            Some(1_800_000_000_000),
        ),
        retention(
            "expired-tombstone",
            MemoryEndpointsRetentionKind::Tombstone,
            false,
            false,
            Some(1_600_000_000_000),
        ),
        retention(
            "receipt",
            MemoryEndpointsRetentionKind::AuthoritativeReceipt,
            false,
            false,
            None,
        ),
        retention(
            "search-projection",
            MemoryEndpointsRetentionKind::SearchProjection,
            false,
            false,
            None,
        ),
    ];
    let plan = plan_sync_compaction(&records, 1_700_000_000_000).unwrap();
    assert!(plan.retained_ids.contains(&"head".to_string()));
    assert!(plan.retained_ids.contains(&"conflict".to_string()));
    assert!(plan.retained_ids.contains(&"tombstone".to_string()));
    assert!(plan.retained_ids.contains(&"receipt".to_string()));
    assert!(plan.compacted_ids.contains(&"old-revision".to_string()));
    assert!(plan
        .compacted_ids
        .contains(&"expired-tombstone".to_string()));
    assert!(plan
        .compacted_ids
        .contains(&"search-projection".to_string()));
}

fn retention(
    id: &str,
    kind: MemoryEndpointsRetentionKind,
    current: bool,
    unresolved: bool,
    retention_until: Option<u64>,
) -> MemoryEndpointsRetentionRecord {
    MemoryEndpointsRetentionRecord {
        record_id: id.to_string(),
        memory_id: "memory-demo".to_string(),
        kind,
        is_current_head: current,
        unresolved,
        retention_until_unix_ms: retention_until,
    }
}

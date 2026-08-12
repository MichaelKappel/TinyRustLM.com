#![doc = "Bounded directory-flush batch process protocol tests."]

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tinyrustlm_durability::{
    execute_directory_flush_batch_request_bytes, DIRECTORY_FLUSH_BATCH_MAXIMUM_BYTES,
    DIRECTORY_FLUSH_BATCH_MAXIMUM_ENTRIES, DIRECTORY_FLUSH_BATCH_OBSERVATION_SCHEMA,
    DIRECTORY_FLUSH_BATCH_REQUEST_SCHEMA, DIRECTORY_FLUSH_FAILURE_SCHEMA,
    DIRECTORY_FLUSH_OBSERVATION_MEMBER_SCHEMA, DIRECTORY_FLUSH_PROFILE_ID,
    DIRECTORY_FLUSH_PROFILE_SHA256, DIRECTORY_FLUSH_REQUEST_MEMBER_SCHEMA,
};

const DIRECTORY_FLUSH_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/directory-flush-profile.v1.json");

static NEXT_TEST_ROOT: AtomicU64 = AtomicU64::new(0);

struct OwnedTestRoot {
    path: PathBuf,
}

impl OwnedTestRoot {
    fn create(label: &str) -> Self {
        let serial = NEXT_TEST_ROOT.fetch_add(1, Ordering::Relaxed);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "tinyrustlm-durability-protocol-{label}-{}-{nanos}-{serial}",
            std::process::id()
        ));
        fs::create_dir(&path).expect("create owned test root");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for OwnedTestRoot {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.path).expect("remove owned test root");
    }
}

fn request_member(root: &Path, relative: &str, operation_id: &str) -> Value {
    json!({
        "operationId": operation_id,
        "ownedRoot": root.to_str().expect("UTF-8 test root"),
        "relativeDirectory": relative,
        "schema": DIRECTORY_FLUSH_REQUEST_MEMBER_SCHEMA
    })
}

fn batch_request(requests: Vec<Value>) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "requests": requests,
        "schema": DIRECTORY_FLUSH_BATCH_REQUEST_SCHEMA
    }))
    .expect("serialize batch request")
}

fn request(root: &Path, relative: &str, operation_id: &str) -> Vec<u8> {
    batch_request(vec![request_member(root, relative, operation_id)])
}

#[test]
fn frozen_profile_is_exact_and_internally_consistent() {
    let profile: Value =
        serde_json::from_slice(DIRECTORY_FLUSH_PROFILE_BYTES).expect("parse frozen profile");
    assert_eq!(
        format!("{:x}", Sha256::digest(DIRECTORY_FLUSH_PROFILE_BYTES)),
        DIRECTORY_FLUSH_PROFILE_SHA256
    );
    assert_eq!(profile["profileId"], DIRECTORY_FLUSH_PROFILE_ID);
    assert_eq!(profile["status"], "frozen");
    assert_eq!(
        profile["requestSchema"],
        DIRECTORY_FLUSH_BATCH_REQUEST_SCHEMA
    );
    assert_eq!(
        profile["requestMemberSchema"],
        DIRECTORY_FLUSH_REQUEST_MEMBER_SCHEMA
    );
    assert_eq!(
        profile["successObservationSchema"],
        DIRECTORY_FLUSH_BATCH_OBSERVATION_SCHEMA
    );
    assert_eq!(
        profile["successObservationMemberSchema"],
        DIRECTORY_FLUSH_OBSERVATION_MEMBER_SCHEMA
    );
    assert_eq!(profile["failureSchema"], DIRECTORY_FLUSH_FAILURE_SCHEMA);
    assert_eq!(
        profile["requestMaximumBytes"],
        DIRECTORY_FLUSH_BATCH_MAXIMUM_BYTES
    );
    assert_eq!(
        profile["successObservationMaximumBytes"],
        DIRECTORY_FLUSH_BATCH_MAXIMUM_BYTES
    );
    assert_eq!(
        profile["maximumBatchEntries"],
        DIRECTORY_FLUSH_BATCH_MAXIMUM_ENTRIES
    );
    assert_eq!(profile["networkAccess"], "forbidden");
    assert_eq!(profile["rawPathOutput"], "forbidden");
    assert_eq!(profile["rawHostErrorOutput"], "forbidden");
    assert_eq!(profile["batchContract"]["minimumEntries"], 1);
    assert_eq!(
        profile["batchContract"]["ordering"],
        "operation-id-bytewise-ascending"
    );
    assert_eq!(
        profile["pathContract"]["stablePathTopologyOwnershipRequired"],
        true
    );
    assert_eq!(profile["pathContract"]["ownedRootScope"], "explicit-dot");
    assert_eq!(
        profile["platformMethods"]["windows"]["method"],
        "win32-backup-semantics-flush-file-buffers"
    );

    assert_eq!(profile["requestFields"], json!(["requests", "schema"]));
    assert_eq!(
        profile["requestMemberFields"],
        json!(["operationId", "ownedRoot", "relativeDirectory", "schema"])
    );
    assert_eq!(
        profile["successObservationFields"],
        json!(["observations", "schema", "status"])
    );
    assert_eq!(
        profile["successObservationMemberFields"],
        json!([
            "architecture",
            "directoryIdentitySha256",
            "method",
            "operatingSystem",
            "operationId",
            "profileId",
            "profileSha256",
            "requestSha256",
            "schema",
            "status"
        ])
    );
    assert_eq!(
        profile["failureFields"],
        json!(["errorCode", "schema", "status"])
    );

    let error_codes = profile["errorCodes"]
        .as_array()
        .expect("error codes")
        .iter()
        .map(|value| value.as_str().expect("string error code"))
        .collect::<Vec<_>>();
    assert_eq!(error_codes.len(), 32);
    assert!(error_codes.windows(2).all(|pair| pair[0] < pair[1]));
    assert_eq!(
        error_codes.iter().copied().collect::<BTreeSet<_>>().len(),
        error_codes.len()
    );
    assert!(error_codes.contains(&"directory_request_count_invalid"));
    assert!(error_codes.contains(&"directory_request_noncanonical"));
    assert!(error_codes.contains(&"directory_request_order_invalid"));
    assert!(error_codes.contains(&"directory_request_read_failed"));
    assert!(error_codes.contains(&"directory_flush_unsupported"));

    let non_claims = profile["nonClaims"].as_array().expect("non-claims");
    assert_eq!(non_claims.len(), 6);
    assert!(non_claims.iter().any(|claim| {
        claim
            .as_str()
            .is_some_and(|text| text.contains("not physical power-loss evidence"))
    }));
    assert!(non_claims.iter().any(|claim| {
        claim
            .as_str()
            .is_some_and(|text| text.contains("not an atomic all-or-nothing"))
    }));
    assert!(non_claims.iter().any(|claim| {
        claim
            .as_str()
            .is_some_and(|text| text.contains("does not establish stable path-topology ownership"))
    }));
}

#[test]
fn strict_library_protocol_returns_path_redacted_member_observations() {
    let root = OwnedTestRoot::create("library");
    fs::create_dir(root.path().join("subjects")).expect("create subjects");
    fs::create_dir(root.path().join("receipts")).expect("create receipts");
    let first = request_member(
        root.path(),
        "receipts",
        "directory-flush-protocol-batch-001",
    );
    let second = request_member(
        root.path(),
        "subjects",
        "directory-flush-protocol-batch-002",
    );
    let input = batch_request(vec![first.clone(), second.clone()]);

    let output = execute_directory_flush_batch_request_bytes(&input).expect("execute request");
    let value: Value = serde_json::from_slice(&output).expect("parse observation");
    assert_eq!(value["schema"], DIRECTORY_FLUSH_BATCH_OBSERVATION_SCHEMA);
    assert_eq!(value["status"], "performed");
    let observations = value["observations"].as_array().expect("observations");
    assert_eq!(observations.len(), 2);
    for (observation, member) in observations.iter().zip([first, second]) {
        assert_eq!(
            observation["schema"],
            DIRECTORY_FLUSH_OBSERVATION_MEMBER_SCHEMA
        );
        assert_eq!(observation["operationId"], member["operationId"]);
        assert_eq!(observation["profileId"], DIRECTORY_FLUSH_PROFILE_ID);
        assert_eq!(observation["profileSha256"], DIRECTORY_FLUSH_PROFILE_SHA256);
        assert_eq!(
            observation["requestSha256"],
            format!(
                "{:x}",
                Sha256::digest(serde_json::to_vec(&member).expect("serialize member"))
            )
        );
    }
    assert_ne!(
        observations[0]["requestSha256"],
        observations[1]["requestSha256"]
    );
    assert!(!String::from_utf8(output)
        .expect("UTF-8 observation")
        .contains(root.path().to_str().expect("UTF-8 test root")));
}

#[test]
fn strict_library_protocol_rejects_ambiguous_and_wrong_fields() {
    let root = OwnedTestRoot::create("strict");
    fs::create_dir(root.path().join("receipts")).expect("create receipts");
    let root_text =
        serde_json::to_string(root.path().to_str().expect("UTF-8 test root")).expect("encode root");
    let duplicate = format!(
        "{{\"requests\":[{{\"operationId\":\"directory-flush-protocol-002\",\"operationId\":\"directory-flush-protocol-003\",\"ownedRoot\":{root_text},\"relativeDirectory\":\"receipts\",\"schema\":\"{DIRECTORY_FLUSH_REQUEST_MEMBER_SCHEMA}\"}}],\"schema\":\"{DIRECTORY_FLUSH_BATCH_REQUEST_SCHEMA}\"}}"
    );
    let duplicate_error = execute_directory_flush_batch_request_bytes(duplicate.as_bytes())
        .expect_err("duplicate field must fail");
    assert_eq!(duplicate_error.code(), "directory_request_invalid");

    let unknown = json!({
        "requests": [{
            "operationId": "directory-flush-protocol-004",
            "ownedRoot": root.path().to_str().expect("UTF-8 test root"),
            "privatePath": "must-not-echo",
            "relativeDirectory": "receipts",
            "schema": DIRECTORY_FLUSH_REQUEST_MEMBER_SCHEMA
        }],
        "schema": DIRECTORY_FLUSH_BATCH_REQUEST_SCHEMA
    });
    let unknown_error = execute_directory_flush_batch_request_bytes(
        &serde_json::to_vec(&unknown).expect("serialize unknown request"),
    )
    .expect_err("unknown field must fail");
    assert_eq!(unknown_error.code(), "directory_request_invalid");

    let wrong_outer = request(root.path(), "receipts", "directory-flush-protocol-005");
    let wrong_outer = String::from_utf8(wrong_outer)
        .expect("UTF-8 request")
        .replace(DIRECTORY_FLUSH_BATCH_REQUEST_SCHEMA, "tinyrustlm.wrong.v1");
    let schema_error = execute_directory_flush_batch_request_bytes(wrong_outer.as_bytes())
        .expect_err("wrong outer schema must fail");
    assert_eq!(schema_error.code(), "directory_request_schema_invalid");

    let wrong_member = batch_request(vec![json!({
        "operationId": "directory-flush-protocol-006",
        "ownedRoot": root.path().to_str().expect("UTF-8 test root"),
        "relativeDirectory": "receipts",
        "schema": "tinyrustlm.wrong.v1"
    })]);
    let schema_error = execute_directory_flush_batch_request_bytes(&wrong_member)
        .expect_err("wrong member schema must fail");
    assert_eq!(schema_error.code(), "directory_request_schema_invalid");
}

#[test]
fn strict_library_protocol_requires_canonical_sorted_bounded_batches() {
    let root = OwnedTestRoot::create("batch-contract");
    let mut noncanonical = request(root.path(), ".", "directory-flush-protocol-010");
    noncanonical.push(b'\n');
    let error = execute_directory_flush_batch_request_bytes(&noncanonical)
        .expect_err("noncanonical request must fail");
    assert_eq!(error.code(), "directory_request_noncanonical");

    let empty = batch_request(Vec::new());
    let error =
        execute_directory_flush_batch_request_bytes(&empty).expect_err("empty batch must fail");
    assert_eq!(error.code(), "directory_request_count_invalid");

    let duplicate = batch_request(vec![
        request_member(root.path(), ".", "directory-flush-protocol-011"),
        request_member(root.path(), ".", "directory-flush-protocol-011"),
    ]);
    let error = execute_directory_flush_batch_request_bytes(&duplicate)
        .expect_err("duplicate operation must fail");
    assert_eq!(error.code(), "directory_request_order_invalid");

    let reversed = batch_request(vec![
        request_member(root.path(), ".", "directory-flush-protocol-013"),
        request_member(root.path(), ".", "directory-flush-protocol-012"),
    ]);
    let error = execute_directory_flush_batch_request_bytes(&reversed)
        .expect_err("out-of-order operation must fail");
    assert_eq!(error.code(), "directory_request_order_invalid");

    let too_many = (0..=DIRECTORY_FLUSH_BATCH_MAXIMUM_ENTRIES)
        .map(|index| {
            request_member(
                root.path(),
                ".",
                &format!("directory-flush-protocol-many-{index:04}"),
            )
        })
        .collect();
    let error = execute_directory_flush_batch_request_bytes(&batch_request(too_many))
        .expect_err("oversized batch count must fail");
    assert_eq!(error.code(), "directory_request_count_invalid");

    let oversized = vec![b' '; DIRECTORY_FLUSH_BATCH_MAXIMUM_BYTES + 1];
    let error = execute_directory_flush_batch_request_bytes(&oversized)
        .expect_err("oversized request must fail");
    assert_eq!(error.code(), "directory_request_byte_limit");
}

#[test]
fn batch_failure_returns_no_partial_success_document() {
    let root = OwnedTestRoot::create("partial");
    fs::create_dir(root.path().join("available")).expect("create available");
    let input = batch_request(vec![
        request_member(
            root.path(),
            "available",
            "directory-flush-protocol-partial-001",
        ),
        request_member(
            root.path(),
            "missing",
            "directory-flush-protocol-partial-002",
        ),
    ]);
    let error = execute_directory_flush_batch_request_bytes(&input)
        .expect_err("one member failure must fail the entire call");
    assert_eq!(error.code(), "directory_path_missing");
}

#[test]
fn process_protocol_returns_only_bounded_batch_json() {
    let root = OwnedTestRoot::create("process");
    fs::create_dir(root.path().join("plans")).expect("create plans");
    let mut child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-directory-flush"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn directory flush helper");
    child
        .stdin
        .take()
        .expect("child stdin")
        .write_all(&request(
            root.path(),
            "plans",
            "directory-flush-protocol-process-001",
        ))
        .expect("write request");
    let output = child.wait_with_output().expect("wait for helper");
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let value: Value = serde_json::from_slice(&output.stdout).expect("parse process output");
    assert_eq!(value["schema"], DIRECTORY_FLUSH_BATCH_OBSERVATION_SCHEMA);
    assert_eq!(value["status"], "performed");
    assert_eq!(
        value["observations"]
            .as_array()
            .expect("observations")
            .len(),
        1
    );
    assert!(!String::from_utf8(output.stdout)
        .expect("UTF-8 process output")
        .contains(root.path().to_str().expect("UTF-8 test root")));
}

#[test]
fn process_protocol_failure_does_not_echo_request_material() {
    let private_marker = "private-path-marker-must-not-echo";
    let input = format!("{{\"unknown\":\"{private_marker}\"}}");
    let mut child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-directory-flush"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn directory flush helper");
    child
        .stdin
        .take()
        .expect("child stdin")
        .write_all(input.as_bytes())
        .expect("write bad request");
    let output = child.wait_with_output().expect("wait for helper");
    assert_eq!(output.status.code(), Some(2));
    assert!(output.stderr.is_empty());
    let value: Value = serde_json::from_slice(&output.stdout).expect("parse failure output");
    assert_eq!(value["schema"], DIRECTORY_FLUSH_FAILURE_SCHEMA);
    assert_eq!(value["status"], "failed");
    assert_eq!(value["errorCode"], "directory_request_invalid");
    assert!(!String::from_utf8(output.stdout)
        .expect("UTF-8 failure output")
        .contains(private_marker));
}

#![cfg(windows)]
#![forbid(unsafe_code)]
#![doc = "Process-boundary tests for TinyRustLM build-scratch inspection."]

use serde_json::json;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tinyrustlm_build_custody::{
    SCRATCH_INSPECTION_PROFILE_ID, SCRATCH_INSPECTION_PROFILE_SHA256,
    SCRATCH_INSPECTION_REQUEST_SCHEMA,
};

struct TestRoot(PathBuf);

impl TestRoot {
    fn new(label: &str) -> Self {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-scratch-process-{label}-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&root).expect("create process test root");
        Self(root)
    }

    fn request(&self) -> Vec<u8> {
        serde_json::to_vec(&json!({
            "maximumAggregateBytes": 1048576,
            "maximumEntryCount": 1024,
            "maximumJunctionCount": 16,
            "maximumPathBytes": 4096,
            "operationId": "process-boundary-operation",
            "ownedRoot": self.0.to_str().expect("ASCII process test root"),
            "profileId": SCRATCH_INSPECTION_PROFILE_ID,
            "profileSha256": SCRATCH_INSPECTION_PROFILE_SHA256,
            "requiredRootEntries": [{"kind": "regular-file", "name": "marker.bin"}],
            "schema": SCRATCH_INSPECTION_REQUEST_SCHEMA
        }))
        .expect("serialize process request")
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn execute(input: &[u8]) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-build-scratch-inspect"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn scratch inspector");
    child
        .stdin
        .take()
        .expect("scratch inspector stdin")
        .write_all(input)
        .expect("write scratch inspector request");
    child
        .wait_with_output()
        .expect("wait for scratch inspector")
}

#[test]
fn process_emits_one_canonical_observation_and_empty_stderr() {
    let root = TestRoot::new("pass");
    fs::write(root.0.join("marker.bin"), b"abc").expect("write marker");

    let output = execute(&root.request());

    assert_eq!(output.status.code(), Some(0));
    assert!(output.stderr.is_empty());
    let value: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("parse process observation");
    assert_eq!(value["status"], "pass");
    assert_eq!(value["entryCount"], 1);
    assert_eq!(value["fileCount"], 1);
    assert_eq!(serde_json::to_vec(&value).unwrap(), output.stdout);
}

#[test]
fn process_emits_one_typed_failure_and_empty_stderr() {
    let output = execute(b"{}\n");

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stderr.is_empty());
    assert_eq!(
        output.stdout,
        br#"{"errorCode":"scratch_inspection_request_invalid","schema":"tinyrustlm.build-scratch-inspection-failure.v1","status":"failed"}"#
    );
}

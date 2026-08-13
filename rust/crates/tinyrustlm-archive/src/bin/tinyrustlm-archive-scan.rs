#![forbid(unsafe_code)]
#![doc = "Bounded host process for the TinyRustLM archive-scan boundary."]

use serde::Serialize;
use std::io::{self, Read, Write};
use tinyrustlm_archive::{
    execute_archive_scan_request_bytes, ARCHIVE_SCAN_FAILURE_SCHEMA,
    ARCHIVE_SCAN_REQUEST_MAXIMUM_BYTES,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Failure<'a> {
    error_code: &'a str,
    schema: &'static str,
    status: &'static str,
}

fn main() {
    let mut input = Vec::new();
    if io::stdin()
        .take((ARCHIVE_SCAN_REQUEST_MAXIMUM_BYTES + 1) as u64)
        .read_to_end(&mut input)
        .is_err()
    {
        fail("archive_scan_request_read_failed");
    }
    let mut stdout = io::stdout().lock();
    if let Err(error) = execute_archive_scan_request_bytes(&input, &mut stdout) {
        fail(error.code());
    }
}

fn fail(code: &str) -> ! {
    let failure = Failure {
        error_code: code,
        schema: ARCHIVE_SCAN_FAILURE_SCHEMA,
        status: "failed",
    };
    let mut stderr = io::stderr().lock();
    if serde_json::to_writer(&mut stderr, &failure).is_err() || stderr.flush().is_err() {
        std::process::exit(3);
    }
    std::process::exit(if code == "archive_scan_output_failed" {
        3
    } else {
        2
    });
}

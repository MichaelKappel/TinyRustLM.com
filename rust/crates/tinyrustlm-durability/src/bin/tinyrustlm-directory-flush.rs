#![forbid(unsafe_code)]
#![doc = "Bounded host process for the TinyRustLM directory-flush boundary."]

use serde::Serialize;
use std::io::{self, Read, Write};
use tinyrustlm_durability::{
    execute_directory_flush_batch_request_bytes, DIRECTORY_FLUSH_BATCH_MAXIMUM_BYTES,
    DIRECTORY_FLUSH_FAILURE_SCHEMA,
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
    let read = io::stdin()
        .take((DIRECTORY_FLUSH_BATCH_MAXIMUM_BYTES + 1) as u64)
        .read_to_end(&mut input);
    let result = match read {
        Ok(_) => execute_directory_flush_batch_request_bytes(&input),
        Err(_) => return fail("directory_request_read_failed"),
    };
    match result {
        Ok(bytes) => {
            if io::stdout().write_all(&bytes).is_err() {
                std::process::exit(3);
            }
        }
        Err(error) => fail(error.code()),
    }
}

fn fail(code: &str) {
    let failure = Failure {
        error_code: code,
        schema: DIRECTORY_FLUSH_FAILURE_SCHEMA,
        status: "failed",
    };
    if serde_json::to_writer(io::stdout(), &failure).is_err() {
        std::process::exit(3);
    }
    std::process::exit(2);
}

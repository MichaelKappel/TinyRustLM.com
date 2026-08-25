#![forbid(unsafe_code)]
#![doc = "Bounded process boundary for TinyRustLM build-scratch inspection."]

use std::io::{self, Read, Write};
use tinyrustlm_build_custody::{
    execute_scratch_inspection_request_bytes, scratch_inspection_failure_bytes,
    SCRATCH_INSPECTION_MAXIMUM_REQUEST_BYTES,
};

fn main() {
    let mut input = Vec::new();
    if io::stdin()
        .take((SCRATCH_INSPECTION_MAXIMUM_REQUEST_BYTES + 1) as u64)
        .read_to_end(&mut input)
        .is_err()
    {
        fail("scratch_inspection_request_read_failed");
    }

    match execute_scratch_inspection_request_bytes(&input) {
        Ok(bytes) => write_and_exit(&bytes, 0),
        Err(error) => fail(error.code()),
    }
}

fn fail(code: &str) -> ! {
    write_and_exit(&scratch_inspection_failure_bytes(code), 2)
}

fn write_and_exit(bytes: &[u8], code: i32) -> ! {
    let mut stdout = io::stdout().lock();
    if stdout.write_all(bytes).is_err() || stdout.flush().is_err() {
        std::process::exit(3);
    }
    std::process::exit(code);
}

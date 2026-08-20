#![no_main]

use libfuzzer_sys::fuzz_target;
use tinyrustlm_slm2_fuzz::{exercise_bytes, MAXIMUM_INPUT_BYTES};

fuzz_target!(|bytes: &[u8]| {
    if bytes.len() <= MAXIMUM_INPUT_BYTES {
        let _ = exercise_bytes(bytes);
    }
});

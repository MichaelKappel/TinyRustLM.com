#![no_main]

use libfuzzer_sys::fuzz_target;
use tinyrustlm_archive_fuzz::{exercise_program, FuzzProgram};

fuzz_target!(|program: FuzzProgram| {
    let _ = exercise_program(&program);
});

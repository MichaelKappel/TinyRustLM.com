//! Native command-line entry point for immutable TinyRustLM evaluation evidence.

use std::ffi::OsString;
use std::io;
use std::path::Path;
use std::process::ExitCode;
use tinyrustlm_runtime::eval_runner;

const EXIT_USAGE_OR_IO_FAILURE: u8 = 2;

fn main() -> ExitCode {
    match run(std::env::args_os().skip(1).collect()) {
        Ok(code) => code,
        Err(error) => {
            eprintln!("TinyRustLM eval error: {error}");
            ExitCode::from(EXIT_USAGE_OR_IO_FAILURE)
        }
    }
}

fn run(args: Vec<OsString>) -> io::Result<ExitCode> {
    if args
        .first()
        .is_some_and(|value| value == "materialize-exclusions")
    {
        if args.len() != 3 {
            return Err(usage_error(
                "materialize-exclusions requires <eval-cases.txt> <output.txt>",
            ));
        }
        let outcome =
            eval_runner::materialize_eval_exclusions(Path::new(&args[1]), Path::new(&args[2]))?;
        println!("TinyRustLM eval exclusions: PASS");
        println!("case_count: {}", outcome.case_count);
        println!("fixed_case_count: {}", outcome.fixed_case_count);
        println!(
            "generated_holdout_count: {}",
            outcome.generated_holdout_count
        );
        return Ok(ExitCode::SUCCESS);
    }

    if args.len() != 5 {
        return Err(usage_error(
            "evaluation requires <model.slm> <model.manifest> <eval-cases.txt> <composition.acg1> <output.eval>",
        ));
    }
    let outcome = eval_runner::run_eval_to_sidecar(
        Path::new(&args[0]),
        Path::new(&args[1]),
        Path::new(&args[2]),
        Path::new(&args[3]),
        Path::new(&args[4]),
    )?;
    println!(
        "TinyRustLM eval cases: {}",
        if outcome.passed { "PASS" } else { "FAIL" }
    );
    println!("cases_passed: {}", outcome.cases_passed);
    println!("cases_failed: {}", outcome.cases_failed);
    Ok(if outcome.passed {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    })
}

fn usage_error(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

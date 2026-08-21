#![doc = "Command-line entry point for strict TinyRustLM source conversion."]

use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use serde_json::json;
use sha2::{Digest, Sha256};
use tinyrustlm_convert::{convert_locked_qwen2_source, ConverterExecutionIdentity};

const HASH_BUFFER_BYTES: usize = 1_048_576;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(code) => {
            let _ = writeln!(std::io::stderr(), "TinyRustLM conversion failed: {code}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), &'static str> {
    let arguments = env::args_os().collect::<Vec<_>>();
    if arguments.len() != 5 || arguments[1] != "qwen2-safetensors" {
        return Err("qwen2-cli-arguments-invalid");
    }
    let current = env::current_dir().map_err(|_| "qwen2-cli-current-directory-failed")?;
    let source_lock = absolute_existing(&current, Path::new(&arguments[2]))?;
    let source_directory = absolute_existing(&current, Path::new(&arguments[3]))?;
    let output = absolute_output(&current, Path::new(&arguments[4]))?;
    let executable = env::current_exe().map_err(|_| "qwen2-cli-executable-identity-failed")?;
    let execution =
        ConverterExecutionIdentity::new(env!("CARGO_PKG_VERSION"), sha256_file(&executable)?)
            .map_err(|error| error.code())?;
    let result = convert_locked_qwen2_source(&source_lock, &source_directory, &output, &execution)
        .map_err(|error| error.code())?;
    let summary = json!({
        "schema": "tinyrustlm.qwen2_conversion_cli_summary.v1",
        "status": "pass",
        "modelFile": file_name(result.model_path())?,
        "modelBytes": result.model_identity().byte_length(),
        "modelSha256": result.model_identity().artifact_sha256_hex(),
        "receiptFile": file_name(result.receipt_path())?,
        "requiredNextGate": "untouched-source-slm2-native-slm2-wasm-quality-and-runtime-conformance"
    });
    println!(
        "{}",
        serde_json::to_string_pretty(&summary)
            .map_err(|_| "qwen2-cli-summary-serialization-failed")?
    );
    Ok(())
}

fn absolute_existing(current: &Path, path: &Path) -> Result<PathBuf, &'static str> {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        current.join(path)
    };
    std::fs::canonicalize(path).map_err(|_| "qwen2-cli-input-path-invalid")
}

fn absolute_output(current: &Path, path: &Path) -> Result<PathBuf, &'static str> {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        current.join(path)
    };
    let parent = path.parent().ok_or("qwen2-cli-output-path-invalid")?;
    let parent = std::fs::canonicalize(parent).map_err(|_| "qwen2-cli-output-path-invalid")?;
    let name = path.file_name().ok_or("qwen2-cli-output-path-invalid")?;
    Ok(parent.join(name))
}

fn sha256_file(path: &Path) -> Result<String, &'static str> {
    let mut file = File::open(path).map_err(|_| "qwen2-cli-executable-identity-failed")?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| "qwen2-cli-executable-identity-failed")?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex_lower(&hasher.finalize()))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

fn file_name(path: &Path) -> Result<&str, &'static str> {
    path.file_name()
        .and_then(|name| name.to_str())
        .ok_or("qwen2-cli-output-path-invalid")
}

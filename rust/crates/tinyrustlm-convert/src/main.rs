#![doc = "Command-line entry point for strict TinyRustLM source conversion."]

use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use serde_json::json;
use sha2::{Digest, Sha256};
use tinyrustlm_convert::{
    convert_locked_qwen3_composition, convert_locked_qwen3_source,
    convert_locked_qwen_tokenizer2_source, ConverterExecutionIdentity,
};

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
    if arguments.len() < 2 {
        return Err("converter-cli-arguments-invalid");
    }
    let current = env::current_dir().map_err(|_| "converter-cli-current-directory-failed")?;
    let executable = env::current_exe().map_err(|_| "converter-cli-executable-identity-failed")?;
    let execution =
        ConverterExecutionIdentity::new(env!("CARGO_PKG_VERSION"), sha256_file(&executable)?)
            .map_err(|error| error.code())?;
    let summary = match arguments[1].to_str() {
        Some("qwen3-safetensors") => {
            if arguments.len() != 5 {
                return Err("converter-cli-arguments-invalid");
            }
            let source_lock = absolute_existing(&current, Path::new(&arguments[2]))?;
            let source_directory = absolute_existing(&current, Path::new(&arguments[3]))?;
            let output = absolute_output(&current, Path::new(&arguments[4]))?;
            let result =
                convert_locked_qwen3_source(&source_lock, &source_directory, &output, &execution)
                    .map_err(|error| error.code())?;
            json!({
                "schema": "tinyrustlm.qwen3_conversion_cli_summary.v1",
                "status": "pass",
                "modelFile": file_name(result.model_path())?,
                "modelBytes": result.model_identity().byte_length(),
                "modelSha256": result.model_identity().artifact_sha256_hex(),
                "receiptFile": file_name(result.receipt_path())?,
                "requiredNextGate": "source-native-browser-numerical-parity-and-untouched-quality-qualification"
            })
        }
        Some("qwen-tokenizer2") => {
            if arguments.len() != 5 {
                return Err("converter-cli-arguments-invalid");
            }
            let source_lock = absolute_existing(&current, Path::new(&arguments[2]))?;
            let source_directory = absolute_existing(&current, Path::new(&arguments[3]))?;
            let output = absolute_output(&current, Path::new(&arguments[4]))?;
            let result = convert_locked_qwen_tokenizer2_source(
                &source_lock,
                &source_directory,
                &output,
                &execution,
            )
            .map_err(|error| error.code())?;
            let identity = result.tokenizer_identity();
            json!({
                "schema": "tinyrustlm.qwen_tokenizer2_conversion_cli_summary.v1",
                "status": "pass",
                "tokenizerFile": file_name(result.tokenizer_path())?,
                "tokenizerBytes": identity.byte_length,
                "tokenizerSha256": hex_lower(&identity.sha256),
                "receiptFile": file_name(result.receipt_path())?,
                "requiredNextGate": "broad-source-oracle-parity-and-full-artifact-native-browser-wasm-replay"
            })
        }
        Some("qwen3-composition") => {
            if arguments.len() != 7 {
                return Err("converter-cli-arguments-invalid");
            }
            let model_lock = absolute_existing(&current, Path::new(&arguments[2]))?;
            let model_directory = absolute_existing(&current, Path::new(&arguments[3]))?;
            let tokenizer_lock = absolute_existing(&current, Path::new(&arguments[4]))?;
            let tokenizer_directory = absolute_existing(&current, Path::new(&arguments[5]))?;
            let output_root = absolute_output(&current, Path::new(&arguments[6]))?;
            let result = convert_locked_qwen3_composition(
                &model_lock,
                &model_directory,
                &tokenizer_lock,
                &tokenizer_directory,
                &output_root,
                &execution,
            )
            .map_err(|error| error.code())?;
            let files = [
                "model.slm2",
                "tokenizer.tokenizer2",
                "template.template2",
                "sampling.sampling2",
                "prompt.prompt2",
                "composition.acg2",
            ];
            let artifacts = result
                .artifacts()
                .into_iter()
                .zip(files)
                .map(|(artifact, file)| {
                    json!({
                        "kind": artifact.kind(),
                        "file": file,
                        "byteLength": artifact.byte_length(),
                        "sha256": artifact.sha256_hex()
                    })
                })
                .collect::<Vec<_>>();
            json!({
                "schema": "tinyrustlm.qwen3_composition_conversion_cli_summary.v1",
                "status": "pass",
                "operationId": result.operation_id(),
                "outputDirectory": file_name(result.output_root())?,
                "receiptFile": file_name(result.receipt_path())?,
                "artifacts": artifacts,
                "graphIdentitySha256": hex_lower(&result.graph_identity().graph_identity_sha256),
                "requiredNextGate": "source-native-browser-numerical-parity-untouched-quality-and-product-chat"
            })
        }
        _ => return Err("converter-cli-command-invalid"),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&summary)
            .map_err(|_| "converter-cli-summary-serialization-failed")?
    );
    Ok(())
}

fn absolute_existing(current: &Path, path: &Path) -> Result<PathBuf, &'static str> {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        current.join(path)
    };
    let metadata =
        std::fs::symlink_metadata(&path).map_err(|_| "converter-cli-input-path-invalid")?;
    if metadata_is_link(&metadata) {
        return Err("converter-cli-input-path-invalid");
    }
    std::fs::canonicalize(path).map_err(|_| "converter-cli-input-path-invalid")
}

fn absolute_output(current: &Path, path: &Path) -> Result<PathBuf, &'static str> {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        current.join(path)
    };
    let parent = path.parent().ok_or("converter-cli-output-path-invalid")?;
    let metadata =
        std::fs::symlink_metadata(parent).map_err(|_| "converter-cli-output-path-invalid")?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err("converter-cli-output-path-invalid");
    }
    let parent = std::fs::canonicalize(parent).map_err(|_| "converter-cli-output-path-invalid")?;
    let name = path
        .file_name()
        .ok_or("converter-cli-output-path-invalid")?;
    Ok(parent.join(name))
}

#[cfg(unix)]
fn metadata_is_link(metadata: &std::fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(windows)]
fn metadata_is_link(metadata: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

fn sha256_file(path: &Path) -> Result<String, &'static str> {
    let mut file = File::open(path).map_err(|_| "converter-cli-executable-identity-failed")?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| "converter-cli-executable-identity-failed")?;
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
        .ok_or("converter-cli-output-path-invalid")
}

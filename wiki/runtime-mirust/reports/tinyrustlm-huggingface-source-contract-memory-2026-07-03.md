# TinyRustLM Hugging Face Source Contract Memory - 2026-07-03

## Summary

TinyRustLM now binds browser-generated Hugging Face conversion requests to the local source bytes when Hugging Face metadata provides `.safetensors` file names, byte counts, and SHA-256 values. Rust `convert-huggingface-request` rejects mismatched local files or shard directories before writing a `.slm`.

## Behavior

- The browser request already carries `local_conversion.suggested_source_safetensors_files[]` with file name, optional SHA-256, optional byte count, and source input mode.
- Rust parses that file list into the conversion request.
- If the request includes expected files, Rust requires the local source file count to match.
- For a single-file input, Rust requires the local filename to match the request filename.
- For a directory input, Rust requires each expected shard filename under that directory.
- Rust verifies expected byte counts and SHA-256 values before conversion output.
- Failed source-contract checks write `tinyrustlm-conversion.preflight` with `preflight_status=fail`, `source_contract_status=fail`, `failure_stage=huggingface-source-contract`, and no `.slm` or receipt.
- Passing preflight and receipt evidence records `source_contract_status=pass`, expected and verified file counts, verified SHA-256 count, and expected/actual source bytes.

## Boundary

Hugging Face remains metadata/source discovery. The browser still does not fetch `/resolve/` model bytes. Project servers still do not run, host, proxy, cache, or serve user model bytes. Direct Hugging Face source download remains a local script opt-in and must satisfy the same Rust source-contract verification before `.slm` conversion.

## Verification

- `cargo test -p tinyrustlm-slm-pack converts_huggingface_request_to_verified_slm_and_receipt`
- `cargo test -p tinyrustlm-slm-pack rejects_huggingface_request_when_source_sha256_does_not_match`
- Browser smoke metadata was updated so `hf-conversion-kit-exec` uses the deterministic `tinylm16-bpe` safetensors fixture SHA-256 and byte count as its Hugging Face source metadata.

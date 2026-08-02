# TinyRustLM Hugging Face Sharded Source Directory Memory - 2026-07-03

## Scope

Hugging Face conversion is now less fake for real model cards that publish sharded `.safetensors` weights. TinyRustLM still treats Hugging Face as metadata/source discovery only, but the local Rust conversion path can now accept either one reviewed `.safetensors` file or a reviewed directory containing the listed `.safetensors` shards.

## Intake Applied

The July 3 desktop/P2P intake in `docs/report-intake/2026-07-03/` reinforces the current boundary: TinyRustLM stays the first-run browser app, and a later optional MiniModel Peer Companion may manage peer identity, local piece stores, cache quotas, consent prompts, serve/fetch controls, and receipts. The useful immediate guidance is to keep Rust verifier contracts as the shared authority and keep P2P as a converted-once reuse layer, not as project-hosted model execution or model-byte hosting.

## Implementation

- `tinyrustlm/tools/slm_pack/src/safetensors.rs` routes `inspect_path`, `build_source_plan`, and `convert-huggingface-request` through a new input inspector that accepts a single `.safetensors` file or a directory of top-level `.safetensors` shards.
- Directory inspection sorts shard paths, merges tensor metadata, rejects duplicate tensor names, aggregates file/header/data byte counts, records `source_file_count`, and binds per-tensor `source_path` into reports and plan checksums.
- Extraction opens the specific shard recorded on each tensor plan entry, so payload bytes come from the correct local shard rather than a guessed monolithic input file.
- `tinyrustlm/app/app.js` now records `source_input_mode`, the full `suggested_source_safetensors_files` list, and a command shape using `<input.safetensors-or-directory>`.
- The generated PowerShell conversion kit resolves a reviewed source file or a reviewed shard directory, accepts all listed shards under `./source/`, and downloads all listed source files only when the user explicitly sets `TINYRUSTLM_ALLOW_HF_DOWNLOAD=1`.
- Large-source warnings now total all listed `.safetensors` byte counts, so multi-shard rows show their actual aggregate size.
- `tinyrustlm/tools/browser-smoke.js` now uses a two-shard 10 GiB Hugging Face fixture and asserts shard-aware warnings plus conversion-kit support strings.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18931/app/ 9531 tinylm16q8 hf-search-ui`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18931/app/ 9532 tinylm16q8 hf-conversion-kit-exec`
- `cargo test -p tinyrustlm-slm-pack converts_huggingface_request_from_sharded_safetensors_directory -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack converts_huggingface_request_to_verified_slm_and_receipt -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack writes_huggingface_preflight_when_source_shape_is_rejected -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack huggingface`

## Boundary

The browser does not request Hugging Face `/resolve/` model-byte routes during search. Project servers still never host, proxy, cache, run, or serve user model bytes. Converted `.slm` files and peer pieces remain local or move only from a consenting peer through Rust verification.

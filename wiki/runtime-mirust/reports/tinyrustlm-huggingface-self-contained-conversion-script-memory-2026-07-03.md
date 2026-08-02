# TinyRustLM Hugging Face Self-Contained Conversion Script Memory - 2026-07-03

## Memory

`Start Conversion` now saves the normal `minimodel.huggingface_conversion_request.v0` JSON for audit/reuse and also embeds that exact request JSON into the generated `.tinyrustlm-convert.ps1` script as base64. If the sidecar request JSON is missing when the user runs the script, the script recreates it beside itself before invoking Rust.

The conversion boundary is unchanged. Hugging Face remains metadata and source discovery only; TinyRustLM does not download Hub model bytes or call `/resolve/` routes. The script still requires a user-owned local `.safetensors`, calls `convert-huggingface-request`, discovers the Rust-produced `.slm` and conversion receipt, runs MiniModel `prepare-peer-share`, discovers manifest/catalog/piece outputs, writes a local `.minimodel-serve-peer-pieces.ps1` helper for explicit sender-side serving consent, writes metadata-only catalog snapshots, and keeps project servers out of runnable model-byte hosting.

## Verification Route

`hf-search-ui` must assert that generated conversion scripts contain `$EmbeddedConversionRequestBase64`, decode it with `[System.Convert]::FromBase64String`, print `Wrote embedded conversion request:` when recreating the sidecar, write the embedded peer-serving helper through `$EmbeddedServePeerPiecesScriptBase64`, continue to use Rust-produced output discovery, and no longer contain the old `Conversion request JSON not found beside this script` failure path.

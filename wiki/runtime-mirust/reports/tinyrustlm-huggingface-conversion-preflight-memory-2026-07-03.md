# TinyRustLM Hugging Face Conversion Preflight Memory - 2026-07-03

## Source

This continues the Hugging Face conversion and converted-once P2P work after reviewing the related July 3 intake. The useful intake signal was not to add hosted networking now; it was to make local conversion status clear, auditable, and recoverable while preserving the browser-local first path and Rust verifier authority.

## Memory

`tinyrustlm-slm-pack convert-huggingface-request` now writes `tinyrustlm-conversion.preflight` before payload extraction. The preflight records the conversion request identity, source model id, suggested local `.safetensors` file, selected TinyRustLM source shape, request-declared supported source shapes, output quantization, inspect and plan report paths, source file bytes when inspection succeeds, tensor counts, checksums, and the no-project-server model-byte flags.

On success, the preflight records `preflight_status=pass`, `conversion_decision=ready-for-local-conversion`, matched tensor count, raw source bytes, source-plan mapping checksum, and `required_next_gate=convert-source-and-validate-slm`. The existing `tinyrustlm-conversion.receipt` now points back to this preflight report.

On source-shape failure, the converter writes `source.inspect` when possible plus `tinyrustlm-conversion.preflight` with `preflight_status=fail`, `conversion_decision=unsupported-local-source-for-selected-shape`, `failure_stage=rust-source-plan`, the Rust planner failure reason, `output_slm_produced=false`, and `required_next_gate=choose-compatible-source-or-wait-for-supported-converter`. No `.slm` or conversion receipt is produced for the failed source.

## Browser Kit

The browser-generated `.tinyrustlm-convert.ps1` now names the preflight report in comments, records `$ConversionPreflight`, checks the `cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request` exit code, prints the preflight path on failure, and throws a plain failure message telling the user the report explains whether the local `.safetensors` matched the supported source shapes.

The Hugging Face conversion README now tells users the script writes `tinyrustlm-conversion.preflight` before extraction so incompatible source files have a durable Rust explanation instead of only a terminal failure.

## Boundary

The preflight is metadata and local verification evidence only. It does not fetch Hugging Face model bytes, publish source bytes, publish `.slm` bytes, publish peer pieces, or authorize project servers to host/proxy/cache/run model bytes. The browser import rule remains `user-imports-local-slm`.

## Verification

Focused Rust tests passed:

`cargo test -p tinyrustlm-slm-pack converts_huggingface_request_to_verified_slm_and_receipt -- --nocapture`

`cargo test -p tinyrustlm-slm-pack writes_huggingface_preflight_when_source_shape_is_rejected -- --nocapture`

Full touched package tests passed:

`cargo test -p tinyrustlm-slm-pack`

Syntax and formatting checks passed:

`cargo fmt --all -- --check`

`node --check tinyrustlm/app/app.js`

`node --check tinyrustlm/tools/browser-smoke.js`

The integrated browser-generated conversion kit smoke passed on the local static server:

`node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18921/app/ 9511 tinylm16q8 hf-conversion-kit-exec`

That smoke executed the exact downloaded `.tinyrustlm-convert.ps1`, produced `tinyrustlm-conversion.preflight`, converted a local `tinylm16-bpe` Hugging Face-style safetensors fixture to `.slm`, prepared MiniModel peer pieces and metadata, wrote catalog snapshots and announcement feed metadata, and preserved the no-server-byte boundary.

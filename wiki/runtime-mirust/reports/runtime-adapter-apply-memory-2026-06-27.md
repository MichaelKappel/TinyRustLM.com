---
title: Runtime Adapter Apply Memory 2026-06-27
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/runtime-adapter-apply-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T14:30:00Z
---

# Runtime Adapter Apply Memory

This durable note records the TinyRustLM browser-runtime adapter application slice, now extended from the first f32 path to checked f32/q8_0/q4_0 runtime apply.

## Boundary

The runtime now accepts a compatible `ADP1` f32 adapter-delta package for an already loaded f32, q8_0, or q4_0 `.slm` model. The package is validated against the loaded model's tensor count, flags, logical parameter count, tensor layout checksum, tokenizer checksum, per-tensor name hash, rank, dimensions, element count, payload checksum, package checksum, and finite f32 delta values before any tensor mutation or compact re-quantization.

This is a runtime assembly bead, not a new public model-quality claim. Offline `adapter-delta` and `fuse-adapter-delta` remain the provenance path for producing durable candidate artifacts. Runtime apply is a browser-local assembly path for compatible base models plus small typed delta packages.

## Implementation Shape

- `tinyrustlm/runtime/src/adapter.rs` parses `ADP1`, mirrors the packer checksum contracts, and returns validated f32 payload ranges.
- `tinyrustlm/runtime/src/model.rs` stores tokenizer and tensor-layout identity checksums during model load, validates all fused values before mutation, applies f32 deltas in place, and re-quantizes q8_0 rows or q4_0 blocks when a compatible compact model is loaded.
- `tinyrustlm/runtime/src/generate.rs` exposes `Runtime::apply_adapter_delta`, clears prompt/KV/generation diagnostics after a successful apply, and keeps the loaded model plus sampling configuration.
- `tinyrustlm/runtime/src/wasm_exports.rs` exposes `apply_adapter_delta(ptr, len)` through the raw WASM ABI.
- `tinyrustlm/tools/wasm-abi-smoke.js` builds a zero-delta `ADP1` package for the tiny f32 fixture and calls the new export after the existing q8 ABI recovery path.
- `tinyrustlm/tools/browser-smoke.js` proves the static tiny q8_0 and q4_0 sidecars preserve compact quantization diagnostics after Rust apply.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-runtime adapter`
- `node --check tinyrustlm/tools/wasm-abi-smoke.js`
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown`
- Copied `target/wasm32-unknown-unknown/release/tinyrustlm_runtime.wasm` to `tinyrustlm/runtime/tinyrustlm.wasm`
- `node tinyrustlm/tools/wasm-abi-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9240 tinyq8 adapter-sidecar`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9241 tinyq4 adapter-sidecar`

## Next Routes

- Keep the static f32/q8_0/q4_0 sidecar smokes tied to Adapter Sidecar changes.
- Use registry-carried adapter-family routing for admitted f32 generated bundles until compact adapter-family metadata has its own typed path.
- Keep broader model-breeding operators offline unless their outputs pass normal `.slm`, manifest, runtime-smoke, eval, admission, ledger, and selector gates.

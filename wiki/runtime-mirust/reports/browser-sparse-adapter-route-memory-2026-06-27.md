---
title: Browser Sparse Adapter Route Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-sparse-adapter-route-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T14:48:27Z
---

# Browser Sparse Adapter Route Memory

## Summary

TinyRustLM now routes generated sparse `ASP1` adapter packages through the browser selector path. Generated f32/q8_0/q4_0 browser bundles stage a three-member adapter family: self `ADP1`, family `ADP1`, and sparse `ASP1`. The browser fetches the served adapter-family receipt, verifies all served adapter manifests by route-derived format, selects the sparse `ASP1` member during generated-root smoke, checks the artifact checksum, transfers bytes into WASM, and Rust applies the package through `apply_adapter_delta`.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` accepts local `../models/*.adp1` and `../models/*.asp1` adapter routes while preserving paired `.manifest` sidecars, checksum fields, apply-status matching, and duplicate-route rejection.
- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` writes format-neutral `browser-local-adapter-family` receipts and validates each member manifest against the member route: raw `ADP1` requires `raw-f32-task-delta-v1` and `f32-delta`; sparse `ASP1` requires `sparse-f32-task-delta-v1` and `sparse-f32-delta`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now emits `multi-parent-sign-merge-*-sparse.asp1` plus its manifest after the existing generated self and family `ADP1` sidecars, then records all three members in the selector registry and receipt.
- `tinyrustlm/app/app.js` infers adapter manifest kind and dtype from the selected route extension, accepts both current format-neutral and earlier ADP1-specific family receipt kinds, and keeps adapter bytes opaque to JavaScript before WASM transfer.
- `tinyrustlm/tools/browser-smoke.js` expects three generated adapter options and applies the sparse `ASP1` option in `adapter-sidecar-registry-file`, with network assertions for the `ASP1` manifest and artifact route.
- `tinyrustlm/runtime/tinyrustlm.wasm` was rebuilt from current runtime source so the browser-served WASM artifact includes the same `ASP1` runtime apply support as native Rust tests.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 22 filtered tests.
- `cargo test -p tinyrustlm-slm-pack adapter_family` passed with 6 filtered tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 2 filtered tests.
- `cargo test -p tinyrustlm-slm-pack` passed with 151 tests.
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown` passed and the resulting WASM was copied to `tinyrustlm/runtime/tinyrustlm.wasm`.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-asp1-route\tinyrustlm f32` staged a generated root with three adapter routes and `adapter_routes: 3`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18671/app/ 9261 multi-parent-sign-merge-f32 adapter-sidecar-registry-file` passed, selecting `Multi-parent sign-merge f32 sparse ASP1`, fetching `/models/multi-parent-sign-merge-f32-sparse.asp1.manifest`, fetching `/models/multi-parent-sign-merge-f32-sparse.asp1`, and receiving `adapter applied`.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-asp1-route-q8\tinyrustlm q8_0` staged a generated q8_0 root with three adapter routes and `adapter_routes: 3`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18673/app/ 9263 multi-parent-sign-merge-q8 adapter-sidecar-registry-file` passed, selecting `Multi-parent sign-merge q8_0 sparse ASP1`, fetching `/models/multi-parent-sign-merge-q8-sparse.asp1.manifest`, fetching `/models/multi-parent-sign-merge-q8-sparse.asp1`, receiving `adapter applied`, and preserving `active_quantization_mode` as `q8_0`.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-asp1-route-q4\tinyrustlm q4_0` staged a generated q4_0 root with three adapter routes and `adapter_routes: 3`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18674/app/ 9264 multi-parent-sign-merge-q4 adapter-sidecar-registry-file` passed, selecting `Multi-parent sign-merge q4_0 sparse ASP1`, fetching `/models/multi-parent-sign-merge-q4-sparse.asp1.manifest`, fetching `/models/multi-parent-sign-merge-q4-sparse.asp1`, receiving `adapter applied`, and preserving `active_quantization_mode` as `q4_0`.
- Final verification also passed: `node --check tinyrustlm/tools/wasm-abi-smoke.js`, `cargo fmt --all -- --check`, `cargo test --workspace`, `node tinyrustlm/tools/wasm-abi-smoke.js`, `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`, fresh f32 `browser-multi-parent-bundle` staging under `target\browser-asp1-route-final\tinyrustlm`, served-root `adapter-sidecar-registry-file` browser smoke at `http://127.0.0.1:18672/app/`, q8_0 and q4_0 served-root sparse ASP1 smokes, and `git diff --check`.

## Routing Notes

Use this report before changing browser selector adapter route formats, generated adapter-family bundle staging, adapter-family receipt format checks, `app.js` adapter manifest validation, checked-in WASM rebuild expectations, or `adapter-sidecar-registry-file` network assertions. This report is the browser-route companion to the sparse adapter package report and the adapter-family receipt report.

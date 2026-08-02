---
title: Browser Runtime Assembly Diagnostics Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-runtime-assembly-diagnostics-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T13:40:00Z
---

# Browser Runtime Assembly Diagnostics Memory

TinyRustLM now carries Rust-owned assembly-state evidence in runtime diagnostics. Model load records a nonzero `assembly_state_checksum` with `adapter_apply_count=0`; successful `apply_adapter_delta` increments `adapter_apply_count`, records `last_adapter_checksum`, and folds the adapter into the assembly checksum. Freeing or failed model load clears the fields.

## Implementation

- `tinyrustlm/runtime/src/diagnostics.rs` renders `adapter_apply_count`, `last_adapter_checksum`, and `assembly_state_checksum` in diagnostics JSON without serde.
- `tinyrustlm/runtime/src/generate.rs` seeds the assembly digest from the loaded model checksum and quantization, records each Rust-accepted adapter package after successful apply, and clears assembly state on free or load failure.
- `tinyrustlm/tools/wasm-abi-smoke.js` verifies the fields through the WASM ABI.
- `tinyrustlm/tools/browser-smoke.js` requires generated q4_0/q8_0/f32 auto assembly to show `adapter_apply_count=3` plus nonzero adapter and assembly checksums before generation; checked manual sidecar apply requires count 1.

## Verification

- `cargo fmt --all -- --check`
- `node --check tinyrustlm/tools/wasm-abi-smoke.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-runtime`
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown`
- `cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest tinyrustlm/runtime/tinyrustlm.wasm tinyrustlm/runtime/tinyrustlm.wasm.manifest`
- `node tinyrustlm/tools/wasm-abi-smoke.js`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/runtime-assembly-diagnostics/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18770/app/ 19621 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18770/app/ 19624 multi-parent-sign-merge-q4 combined-selector-cycle 2`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18771/app/ 19623 tinyf32 adapter-sidecar`

## Evidence Notes

The generated combined-selector assembly smoke rendered q4_0, q8_0, and f32 entries with `adapter_apply_count=3` before generation. The checked manual adapter smoke rendered count 0 before apply and count 1 after apply. The WASM ABI smoke rendered count 1 after direct adapter apply and zero state after `free_model`.

## Routing

Use this report when changing Rust diagnostics, adapter apply accounting, generated auto-assembly browser assertions, manual adapter sidecar assertions, or claims that browser self-assembly reached Rust runtime state.

---
title: Browser Adapter Stack Rust Validate Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-adapter-stack-rust-validate-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T08:30:00Z
---

# Browser Adapter Stack Rust Validate Memory

## Summary

TinyRustLM generated browser auto assembly now asks Rust to validate every fetched ADP1/ASP1/ALR1 stack member before the first stack member is applied. The browser still owns local route, byte-count, budget, and checksum verification; Rust owns package parsing, model identity matching, tensor payload validation, and the eventual tensor mutation boundary.

## Implementation

- `tinyrustlm/runtime/src/model.rs` now exposes `Model::validate_adapter_delta`, sharing the same adapter parser and tensor payload checks used by `apply_adapter_delta`.
- `tinyrustlm/runtime/src/generate.rs` adds `Runtime::validate_adapter_delta`, which records `adapter validated` and preserves generation/KV diagnostics.
- `tinyrustlm/runtime/src/wasm_exports.rs` exports `validate_adapter_delta(ptr, len)` for bytes already copied into WASM memory.
- `tinyrustlm/app/app.js` validates every receipt-declared auto-stack byte buffer through `validate_adapter_delta` after browser byte verification and before the first `apply_adapter_delta` call.
- Manual adapter apply still uses the existing selected-adapter path; the new semantic preflight is scoped to generated auto assembly.
- `tinyrustlm/tools/browser-smoke.js` now asserts generated auto assembly logs `validate_adapter_delta` for the stack before the latest `apply_adapter_delta`.
- `tinyrustlm/tools/wasm-abi-smoke.js` and `tinyrustlm/tools/browser_harness/src/main.rs` now include the validation export in ABI and static contract coverage.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/tools/wasm-abi-smoke.js`
- `cargo fmt --check`
- `cargo test -p tinyrustlm-runtime adapter`
- `cargo test -p tinyrustlm-runtime`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown`
- `cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm.wasm .\tinyrustlm\runtime\tinyrustlm.wasm.manifest`
- `node tinyrustlm/tools/wasm-abi-smoke.js`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/adapter-stack-validate/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18752/app/ 19614 multi-parent-sign-merge-q4 adapter-stack-prefetch-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18752/app/ 19615 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18752/app/ 19616 multi-parent-sign-merge-q4 combined-selector-assembly`

The normal generated-root smoke rendered three validation calls, then three apply calls, then `adapter_stack_applied(3)`. The combined q4/q8/f32 smoke proved the same validation-before-apply order across every generated selector entry. The sparse stack drift smoke still stopped at `adapter artifact checksum mismatch` after adapter-family verification, before low-rank fetch or Rust apply.

## Routing

Load this report when work touches generated adapter auto assembly, the `validate_adapter_delta` WASM ABI, Rust semantic adapter preflight, or browser proof that validation completes before apply.

Related routes:

- `wiki/runtime-mirust/reports/browser-adapter-stack-prefetch-drift-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/runtime-adapter-apply-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-low-rank-adapter-route-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

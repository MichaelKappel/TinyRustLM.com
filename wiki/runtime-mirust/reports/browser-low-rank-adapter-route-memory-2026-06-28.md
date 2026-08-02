---
title: Browser Low-Rank Adapter Route Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-low-rank-adapter-route-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T02:37:25Z
---

# Browser Low-Rank Adapter Route Memory

## Summary

Generated browser bundles now include `ALR1` low-rank adapter-family members for f32, q8_0, and q4_0 selector entries. The browser verifies route metadata, adapter-family receipt fields, `ALR1` manifests, module-plan stack module 6, and fetched artifact checksums before transferring low-rank bytes to WASM.

## Implementation

- `adapter_family.rs` accepts `.alr1` routes with `low-rank-f32-task-delta-v1`, `low-rank-f32-delta`, and low-rank runtime apply statuses.
- `selector.rs` validates `.alr1` served artifact paths and quantization-matched low-rank apply statuses.
- `browser_bundle.rs` stages `{id}-low-rank.alr1` plus manifest for every generated f32/q8_0/q4_0 bundle entry and declares it as the third auto-apply stack member.
- `app.js` recognizes `.alr1` manifests, keeps adapter bytes opaque to JavaScript, verifies module-plan role `adapter-stack-low-rank-delta`, and passes the bytes to Rust `apply_adapter_delta`.
- `browser-smoke.js` asserts four adapter options, three stack routes, `ALR1` manifest/artifact network requests, `module_count` 7, and `adapter_stack_applied(3)`.

## Verification

- `cargo test -p tinyrustlm-slm-pack` passed 167 tests.
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown`, copied rebuilt WASM to `tinyrustlm/runtime/tinyrustlm.wasm`, and refreshed `tinyrustlm.wasm.manifest`.
- `cargo test -p tinyrustlm-runtime` passed 77 tests.
- `cargo test -p tinyrustlm-browser-harness` passed 6 tests.
- `node --check tinyrustlm/app/app.js` and `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node tinyrustlm/tools/wasm-abi-smoke.js tinyrustlm/runtime/tinyrustlm.wasm` passed.
- Generated `target/browser-alr1-route/tinyrustlm` with `browser-multi-parent-bundle ... all`.
- Browser smoke passed for `multi-parent-sign-merge-f32` and `multi-parent-sign-merge-q8` in `adapter-sidecar-registry-file` mode on `http://127.0.0.1:8097/app/`; both auto-applied family `ADP1`, sparse `ASP1`, and low-rank `ALR1` before generation and kept requests local.

## Routing Notes

- Use this page for browser `ALR1` route, receipt, manifest, and module-plan stack work.
- Use `low-rank-adapter-package-memory-2026-06-28.md` for Rust packer/runtime `ALR1` package internals.
- Use `browser-assembly-trace-memory-2026-06-28.md` for Module Plan Trace sequencing.

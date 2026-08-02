---
title: Browser Adapter Stack Prefetch Drift Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-adapter-stack-prefetch-drift-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T08:10:00Z
---

# Browser Adapter Stack Prefetch Drift Memory

## Summary

TinyRustLM browser auto assembly now prefetches and verifies the full receipt-declared adapter stack before any stack member is transferred into WASM. The browser still treats ADP1/ASP1/ALR1 payloads as opaque bytes: it verifies routes, manifest-declared byte counts, the auto-assembly byte budget, and artifact checksums, then Rust remains the adapter package parser and tensor mutation authority.

## Implementation

- `tinyrustlm/app/app.js` now fetches the auto-apply stack into verified byte buffers first, using the existing adapter manifest byte-count and checksum rules.
- `applyAutoAssemblyStack` no longer applies the first family ADP1 artifact before later sparse ASP1 or low-rank ALR1 bytes have been fetched and checked.
- `applyAdapterByIndex` can consume already verified bytes for auto assembly while preserving the manual adapter path that fetches a selected adapter on demand.
- `tinyrustlm/tools/browser-smoke.js` adds `adapter-stack-prefetch-drift`, which flips the second stack artifact (`sparse.asp1`) after all manifests pass.
- The smoke asserts the family ADP1 and sparse ASP1 artifact routes are requested, the low-rank ALR1 artifact route is not requested after sparse drift, the model stays loaded, the trace reaches `adapter family verified`, and no `apply_adapter_delta` call appears.
- The smoke harness module-plan checksum expectations were refreshed to the current generated f32/q8_0/q4_0 bundle receipts.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/adapter-stack-prefetch-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18750/app/ 19608 multi-parent-sign-merge-q4 adapter-stack-prefetch-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18750/app/ 19609 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18750/app/ 19610 multi-parent-sign-merge-q4 adapter-artifact-drift`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`

## Routing

Load this report when work touches generated adapter stack prefetch, receipt-declared auto assembly, fetched stack artifact byte verification, `adapter-stack-prefetch-drift`, or the point where browser bytes cross into `apply_adapter_delta`.

Related routes:

- `wiki/runtime-mirust/reports/browser-adapter-artifact-drift-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-adapter-stack-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-module-plan-checksums-memory-2026-06-27.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

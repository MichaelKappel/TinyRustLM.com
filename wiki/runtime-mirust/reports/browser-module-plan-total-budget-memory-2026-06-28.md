---
title: Browser Module Plan Total Budget Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-module-plan-total-budget-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T15:30:00Z
---

# Browser Module Plan Total Budget Memory

## Summary

TinyRustLM generated module plans now carry `module_plan_total_byte_budget`, an exact browser-local self-assembly envelope for the model bytes, model manifest text, assembly receipt text, adapter-family receipt text, ordered ADP1/ASP1/source-backed ALR1 stack artifact bytes, and runtime scratch budget.

The selector registry and served `.module-plan.receipt` must agree on that total before the browser fetches generated model bytes. The UI renders the verified Total Budget row, and `module-plan-total-budget-drift` proves checksum-consistent total drift stops at the module-plan receipt.

## Implementation

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` computes the total from exact staged files plus the module-plan runtime scratch envelope while writing generated module-plan receipts.
- `tinyrustlm/tools/slm_pack/src/selector.rs` emits and validates `entry.N.module_plan_total_byte_budget` with a bounded registry contract.
- `tinyrustlm/app/app.js` accepts registry entries only when the total is present, bounded, and matches the receipt-declared module bytes plus runtime scratch.
- `tinyrustlm/app/index.html` renders the Module Plan `Total Budget` row.
- `tinyrustlm/tools/browser-smoke.js` checks exact q4_0/q8_0/f32 total-budget UI values in `combined-selector-assembly` and adds `module-plan-total-budget-drift`.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack module_plan`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/module-plan-total-budget-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8190/app/ 9293 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8190/app/ 9294 multi-parent-sign-merge-q4 module-plan-total-budget-drift`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace`

The normal generated-root smoke verified Total Budget values of `102760 bytes` for q4_0, `105000 bytes` for q8_0, and `116534 bytes` for f32. The drift smoke stopped after `/models/multi-parent-sign-merge-q4.module-plan.receipt`; no generated `.slm`, adapter-family, adapter-manifest, or stack artifact route was fetched.

## Routing

Load this report when work touches `module_plan_total_byte_budget`, module-plan total envelope generation, Total Budget display, receipt-declared module byte summation, or `module-plan-total-budget-drift`.

Related routes:

- `wiki/runtime-mirust/reports/browser-module-plan-runtime-scratch-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-byte-counts-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-module-plan-checksums-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

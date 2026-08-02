---
title: Browser Module Plan Runtime Scratch Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-module-plan-runtime-scratch-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T11:05:00Z
---

# Browser Module Plan Runtime Scratch Memory

## Summary

TinyRustLM generated module plans now bind a browser runtime scratch envelope before generated model fetch. Selector registry entries and served `.module-plan.receipt` files carry `module_plan_runtime_scratch_byte_budget=65536`; Rust selector validation, browser registry intake, and browser receipt validation all require that exact value.

## Implementation

- `tinyrustlm/tools/slm_pack/src/selector.rs` adds `MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET`, writes `entry.N.module_plan_runtime_scratch_byte_budget`, parses it back, and rejects drift, missing fields, or malformed decimal values.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_runtime_scratch_byte_budget=65536` into every generated `.module-plan.receipt` and returns the same budget to selector registry generation.
- `tinyrustlm/app/app.js` requires the registry scratch budget and receipt scratch budget to match the browser envelope before any generated `.slm` fetch.
- `tinyrustlm/app/index.html` and `tinyrustlm/tools/browser-smoke.js` render and assert a verified `Scratch Budget` row in the Module Plan panel.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-runtime-scratch-drift`, which mutates only the served receipt scratch budget while updating the selector registry checksum.

## Verification

Passed on 2026-06-28:

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack module_plan`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/module-plan-runtime-scratch-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18762/app/ 19645 multi-parent-sign-merge-q4 module-plan-runtime-scratch-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18762/app/ 19646 multi-parent-sign-merge-q4 combined-selector-assembly`

The drift smoke requested only the app shell, runtime files, selector registry, and q4 module-plan receipt, then stopped with `Module plan module plan runtime scratch byte budget mismatch`. It did not request the generated `.slm` route or any adapter-family, adapter-manifest, ADP1, ASP1, or ALR1 stack artifact route.

The positive smoke walked q4_0, q8_0, and f32 entries from one generated root and rendered `65536 bytes` in the Module Plan `Scratch Budget` row for every entry while reaching the ready trace after ADP1 plus ASP1 plus ALR1 stack validation and apply.

## Routing

Load this report when work touches browser-constrained runtime envelopes, module-plan scratch budgets, generated selector/receipt resource fields, Module Plan budget display, or `module-plan-runtime-scratch-drift`.

Related routes:

- `wiki/runtime-mirust/reports/browser-module-plan-profile-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-resource-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-module-plan-resource-drift-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

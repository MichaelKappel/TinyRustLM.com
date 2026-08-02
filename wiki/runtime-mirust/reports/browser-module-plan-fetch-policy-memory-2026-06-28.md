---
title: Browser Module Plan Fetch Policy Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-module-plan-fetch-policy-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T12:25:00Z
---

# Browser Module Plan Fetch Policy Memory

## Summary

TinyRustLM generated module plans now bind browser-local fetch behavior before generated model fetch. Selector registry entries and served `.module-plan.receipt` files carry `module_plan_fetch_policy=local-no-store-v1`; Rust selector validation, browser registry intake, and browser receipt validation all require that exact value.

## Implementation

- `tinyrustlm/tools/slm_pack/src/selector.rs` adds `MODULE_PLAN_FETCH_POLICY`, writes `entry.N.module_plan_fetch_policy`, parses it back, and rejects fetch-policy drift.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_fetch_policy=local-no-store-v1` into every generated `.module-plan.receipt` and returns the same value to selector registry generation.
- `tinyrustlm/app/app.js` requires the registry fetch policy and receipt fetch policy to match before any generated `.slm` fetch.
- `tinyrustlm/app/index.html` and `tinyrustlm/tools/browser-smoke.js` render and assert a verified `Fetch` row in the Module Plan panel.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-fetch-policy-drift`, which mutates only the served receipt fetch policy while updating the selector registry checksum.

## Verification

Passed on 2026-06-28:

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack module_plan`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/module-plan-fetch-policy-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18766/app/ 19651 multi-parent-sign-merge-q4 module-plan-fetch-policy-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18766/app/ 19652 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18766/app/ 19653 multi-parent-sign-merge-q4 module-plan-execution-profile-drift`

The fetch-policy drift smoke requested only the app shell, runtime files, selector registry, and q4 module-plan receipt, then stopped with `Module plan field module_plan_fetch_policy was cache-default-v1`. It did not request the generated `.slm` route or any adapter-family, adapter-manifest, ADP1, ASP1, or ALR1 stack artifact route.

The positive smoke walked q4_0, q8_0, and f32 entries from one generated root and rendered `local-no-store-v1` in the Module Plan `Fetch` row for every entry while reaching the ready trace after ADP1 plus ASP1 plus ALR1 stack validation and apply.

## Routing

Load this report when work touches browser-local fetch policy, generated selector/receipt fetch metadata, Module Plan fetch display, request-log scoping for module-plan drift smokes, or `module-plan-fetch-policy-drift`.

Related routes:

- `wiki/runtime-mirust/reports/browser-module-plan-execution-profile-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-runtime-scratch-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-profile-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

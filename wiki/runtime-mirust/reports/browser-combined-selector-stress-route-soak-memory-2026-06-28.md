---
title: Browser Combined Selector Stress Route Soak Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-combined-selector-stress-route-soak-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T21:05:00Z
---

# Browser Combined Selector Stress Route Soak Memory

## Summary

TinyRustLM now has a named stress route-soak proof for one generated `all` root. The `combined-selector-route-stress-soak` browser smoke defaults to eight q4_0/q8_0/f32 cycles, so one page completes twenty-four generated assemblies while requiring fresh local route requests on every pass.

## Source Changes

- `tinyrustlm/tools/browser-smoke.js` adds `combined-selector-route-stress-soak` as a route-soak mode.
- The route-soak cycle cap increases to ten cycles, while the stress mode defaults to eight and requires at least eight.
- `runPageCombinedSelectorAssemblySmoke(client, cycles)` now documents its bounded `cycles` contract and can drive the deeper pass count.
- `tinyrustlm/README.md` and `tinyrustlm/docs/testing.md` route the new mode next to the three-cycle and five-cycle proofs.

## Verified Behavior

- The generated root starts on q4_0 through the browser-frugal selector default.
- The smoke walks q4_0, q8_0, and f32 entries for eight cycles.
- Each pass verifies module-plan-before-model ordering, assembly evidence, adapter-family receipt and manifest checks, ADP1 plus ASP1 plus source-backed ALR1 route requests, Rust `validate_adapter_delta` before `apply_adapter_delta`, `adapter_stack_applied(3)`, runtime assembly diagnostics, and one-token generation.
- The route-count assertion requires every generated self-assembly route to be requested at least eight times for its model entry.

## Verification

- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/combined-selector-route-stress-soak/tinyrustlm all`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8194/app/ 9299 multi-parent-sign-merge-q4 combined-selector-route-stress-soak`

## Routing

Load this report when work touches longer generated selector-route reuse, `combined-selector-route-stress-soak`, eight-cycle local route-count pressure, bounded combined-selector cycle handling, or generated self-assembly route freshness.

## Related Routes

- `wiki/runtime-mirust/reports/browser-combined-selector-route-soak-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-extended-route-soak-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-reload-soak-memory-2026-06-28.md`

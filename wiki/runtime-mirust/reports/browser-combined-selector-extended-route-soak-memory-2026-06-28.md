---
title: Browser Combined Selector Extended Route Soak Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-combined-selector-extended-route-soak-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T19:35:00Z
---

# Browser Combined Selector Extended Route Soak Memory

## Summary

TinyRustLM now has a named extended route-soak proof for one generated `all` root. The `combined-selector-route-extended-soak` smoke defaults to five q4_0/q8_0/f32 cycles, so one page completes fifteen generated assemblies while requiring fresh local route requests on every pass.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `combined-selector-route-extended-soak` as a route-soak mode.
- The extended mode defaults to five cycles and requires at least five cycles even if a lower argument is supplied.
- Route-soak assertions reuse the combined selector cycle proof, then count every generated self-assembly route for module-plan receipts, models, manifests, assembly evidence, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stack artifacts.
- Path-flexible route-soak assertions now accept positive Total Budget values while canonical baseline smokes keep exact total-budget fixtures.
- `tinyrustlm/README.md` and `tinyrustlm/docs/testing.md` document the extended mode.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/combined-selector-route-extended-soak/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8192/app/ 9297 multi-parent-sign-merge-q4 combined-selector-route-extended-soak`

The smoke proved the q4_0 default, five q4_0/q8_0/f32 cycles, fifteen generated assemblies, release-before-reassembly on every post-initial pass, three adapter validations and applies before each generation, verified Module Plan WASM Pages `17`, and repeated local requests for every self-assembly route.

Coverage note: no coverage tool is active in this no-third-party workspace; the evidence is focused harness syntax, Rust browser harness unit tests, generated bundle staging, and a served-root browser smoke.

## Routing

Load this report when work touches longer generated selector-route reuse, `combined-selector-route-extended-soak`, path-flexible Module Plan total-budget assertions, or generated self-assembly route-count proof.

Related routes:

- `wiki/runtime-mirust/reports/browser-combined-selector-route-soak-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-cycle-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-reload-soak-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

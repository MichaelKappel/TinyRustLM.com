---
title: Browser Combined Selector Route Soak Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-combined-selector-route-soak-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T09:40:00Z
---

# Browser Combined Selector Route Soak Memory

## Summary

TinyRustLM now has a longer generated-root route-soak proof for the combined q4_0/q8_0/f32 selector. The browser fetches local assembly resources with `cache: "no-store"`, then `combined-selector-route-soak` runs three full q4_0/q8_0/f32 cycles in one page and requires every generated self-assembly route to be requested once per pass.

## Implementation

- `tinyrustlm/app/app.js` uses a shared no-store local fetch option for text sidecars, WASM bytes, model bytes, and adapter bytes.
- `tinyrustlm/tools/browser-smoke.js` adds `combined-selector-route-soak`.
- The route-soak assertion reuses `combined-selector-cycle` checks, then counts requests for each generated model's module-plan receipt, `.slm`, `.slm.manifest`, assembly receipt, evidence files, adapter-family receipt, adapter manifests, and ADP1/ASP1/ALR1 stack artifacts.
- Default route-soak length is three cycles, capped by the existing combined selector cycle limit.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/combined-selector-route-soak/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18760/app/ 19640 multi-parent-sign-merge-q4 combined-selector-route-soak 3`

The smoke produced nine generated passes in one browser page. The selector started on q4_0, then walked q4_0/q8_0/f32 three times. Every post-initial pass released the previous WASM model before the next validation call, every pass validated and applied the ADP1/ASP1/ALR1 stack, every pass reached the ready trace, and every generated self-assembly file route was observed at least three times.

## Routing

Load this report when work touches repeated generated selector reuse, route-count proof for self-assembly resources, cache behavior for local generated files, or `combined-selector-route-soak`.

Related routes:

- `wiki/runtime-mirust/reports/browser-combined-selector-cycle-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-adapter-stack-rust-validate-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

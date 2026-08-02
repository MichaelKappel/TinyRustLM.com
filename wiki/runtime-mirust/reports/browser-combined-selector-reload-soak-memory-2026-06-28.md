---
title: Browser Combined Selector Reload Soak Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-combined-selector-reload-soak-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T14:40:00Z
---

# Browser Combined Selector Reload Soak Memory

## Summary

TinyRustLM now proves a generated `browser-multi-parent-bundle all` root can rebuild its q4_0/q8_0/f32 self-assembly graph across separate browser page lifetimes. The browser boot path honors the selector registry's q4_0 frugal default on each fresh page load, and `combined-selector-reload-soak` verifies the runtime manifest, selector registry, module plans, models, manifests, assembly evidence, adapter-family receipts, adapter manifests, and ADP1/ASP1/source-backed ALR1 stack artifacts are requested again for every reload pass.

## Implementation

- `tinyrustlm/app/app.js` now lets selector-registry boot prefer the declared default model instead of preserving browser-restored form state.
- `tinyrustlm/tools/browser-smoke.js` adds `combined-selector-reload-soak`.
- The reload-soak runner navigates to a fresh app URL for each page lifetime, then runs the normal q4_0/q8_0/f32 combined selector assembly pass.
- The reload-soak assertion requires each page lifetime to start on q4_0, expose exactly the generated q4_0/q8_0/f32 options, validate and apply the three-member ADP1/ASP1/source-backed ALR1 stack for each entry, and request every generated self-assembly route at least once per page lifetime.
- The strict `combined-selector-assembly` exact module-plan byte and checksum baselines were refreshed for the current generated manifest bytes.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/combined-selector-reload-soak/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8186/app/ 9287 multi-parent-sign-merge-q4 combined-selector-reload-soak 2`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8186/app/ 9289 multi-parent-sign-merge-q4 combined-selector-assembly`

The reload-soak produced two independent page lifetimes. Each lifetime started from the q4_0 registry default, then walked q4_0, q8_0, and f32. Every generated entry verified its module plan before model bytes, fetched assembly evidence and adapter-family receipts, verified adapter manifests, validated all three stack members through Rust, applied the stack before generation, and generated one local token.

## Routing

Load this report when work touches generated selector reload behavior, registry default boot selection, fresh page lifetime self-assembly, route-count proof across reloads, or `combined-selector-reload-soak`.

Related routes:

- `wiki/runtime-mirust/reports/browser-combined-selector-route-soak-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-cycle-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-frugal-selector-default-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-source-backed-alr1-contract-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

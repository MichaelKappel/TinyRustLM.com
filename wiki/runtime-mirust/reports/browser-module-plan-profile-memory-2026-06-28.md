---
title: Browser Module Plan Profile Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-module-plan-profile-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T10:20:00Z
---

# Browser Module Plan Profile Memory

## Summary

TinyRustLM generated module plans now carry an explicit constrained self-assembly profile: `browser-constrained-v1`. The profile is emitted in both selector registry module-plan routes and served `.module-plan.receipt` files, validated by Rust selector checks, and rechecked by the browser before any generated `.slm` bytes are fetched.

## Implementation

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_profile=browser-constrained-v1` into each generated module-plan receipt and returns that profile to selector registry generation.
- `tinyrustlm/tools/slm_pack/src/selector.rs` requires `entry.N.module_plan_profile=browser-constrained-v1`, writes it to selector registries, parses it back, and rejects profile drift.
- `tinyrustlm/app/app.js` requires the registry profile before admitting a generated module plan and requires the receipt profile to match before model fetch.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-profile-drift`, which mutates only the served receipt profile while updating the selector checksum.
- `tinyrustlm/tools/browser_harness/src/main.rs` adds a static app marker for `browser-constrained-v1`.

## Verification

Passed on 2026-06-28:

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack module_plan`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/module-plan-profile-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18761/app/ 19641 multi-parent-sign-merge-q4 module-plan-profile-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18761/app/ 19642 multi-parent-sign-merge-q4 combined-selector-assembly`

The drift smoke requested only the app shell, runtime files, selector registry, and q4 module-plan receipt, then stopped with `Module plan field module_plan_profile was desktop-expanded-v1`. It did not request the generated `.slm`, adapter-family receipt, adapter manifests, or ADP1/ASP1/ALR1 stack artifacts. The positive smoke then walked q4_0, q8_0, and f32 entries from the same generated root and reached the ready trace with each stack validated and applied.

## Routing

Load this report when work touches module-plan contract identity, selector-to-receipt self-assembly envelopes, `browser-constrained-v1`, generated bundle module-plan receipts, or `module-plan-profile-drift`.

Related routes:

- `wiki/runtime-mirust/reports/browser-module-plan-resource-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-module-plan-resource-drift-memory-2026-06-27.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-route-soak-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

---
title: Browser Module Plan Origin Policy Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-module-plan-origin-policy-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T09:33:21Z
---

# Browser Module Plan Origin Policy Memory

## Summary

TinyRustLM generated module plans now bind the browser origin boundary before generated model fetch. Selector registry entries and served `.module-plan.receipt` files carry `module_plan_origin_policy=same-origin-loopback-local-v1`; Rust selector validation, browser registry intake, and browser receipt validation all require that exact value.

## Implementation

- `tinyrustlm/tools/slm_pack/src/selector.rs` adds `MODULE_PLAN_ORIGIN_POLICY`, writes `entry.N.module_plan_origin_policy`, parses it back, and rejects origin-policy drift.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_origin_policy=same-origin-loopback-local-v1` into every generated `.module-plan.receipt` and returns the same value to selector registry generation.
- `tinyrustlm/app/app.js` requires the registry origin policy and receipt origin policy to match before any generated `.slm` fetch.
- `tinyrustlm/app/index.html`, `tinyrustlm/tools/browser_harness/src/main.rs`, and `tinyrustlm/tools/browser-smoke.js` render and assert a verified `Origin` row in the Module Plan panel.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-origin-policy-drift`, which mutates only the served receipt origin policy while updating the selector registry checksum.

## Verification

Passed on 2026-06-28:

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack module_plan`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/module-plan-origin-policy-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18768/app/ 19602 multi-parent-sign-merge-q4 module-plan-origin-policy-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18768/app/ 19600 multi-parent-sign-merge-q4 module-plan-fetch-policy-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18768/app/ 19596 multi-parent-sign-merge-q4 combined-selector-assembly`

The origin-policy drift smoke requested only the app shell, runtime files, selector registry, and q4 module-plan receipt, then stopped with `Module plan field module_plan_origin_policy was cross-origin-network-v1`. It did not request the generated `.slm` route or any adapter-family, adapter-manifest, ADP1, ASP1, or ALR1 stack artifact route.

The positive smoke walked q4_0, q8_0, and f32 entries from one generated root and rendered `same-origin-loopback-local-v1` in the Module Plan `Origin` row for every entry while reaching the ready trace after ADP1 plus ASP1 plus ALR1 stack validation and apply.

Current generated module summaries:

- q4_0 bytes: `0: 6592 bytes, 1: 594 bytes, 2: 1896 bytes, 3: 5421 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 832 bytes`
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0x1d6776f86916e40f, 2: 0x456db16712644b6a, 3: 0x643a529184698ac0, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0x199a2b73d817476a`
- q8_0 bytes: `0: 8832 bytes, 1: 594 bytes, 2: 1896 bytes, 3: 5421 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 832 bytes`
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0x618fd5697e2738ff, 2: 0xbd079b6e8af29ecf, 3: 0x0ffad515fff41062, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x3f8c127d335dcd96`
- f32 bytes: `0: 20352 bytes, 1: 595 bytes, 2: 1909 bytes, 3: 5421 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 832 bytes`
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0xe9f713cf1da24e64, 2: 0x7bbb3881da0d0f75, 3: 0x7d2ecba475101b8a, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0xbddf0c5c088bce18`

## Routing

Load this report when work touches browser-local origin policy, generated selector/receipt origin metadata, Module Plan origin display, same-origin module-plan drift assertions, or `module-plan-origin-policy-drift`.

Related routes:

- `wiki/runtime-mirust/reports/browser-module-plan-fetch-policy-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-execution-profile-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-runtime-scratch-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-module-plan-profile-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

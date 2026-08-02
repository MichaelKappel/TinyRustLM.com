---
title: Browser Combined Selector Assembly Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T01:07:16Z
---

# Browser Combined Selector Assembly Memory

## Summary

TinyRustLM now has a headless browser smoke mode named `combined-selector-assembly` that proves one generated `browser-multi-parent-bundle all` root can start on the frugal q4_0 entry, switch through q8_0 and f32 generated entries, fetch each served `.module-plan.receipt` before that entry's `.slm`, verify the rendered Module Plan fields, and auto-apply the family ADP1 plus sparse ASP1 stack before generation.

## Implemented Shape

- `tinyrustlm/tools/browser-smoke.js` adds `runPageCombinedSelectorAssemblySmoke` and `assertCombinedSelectorAssemblySmoke`.
- The smoke walks `multi-parent-sign-merge-q4`, `multi-parent-sign-merge-q8`, and `multi-parent-sign-merge-f32` in one browser page.
- The assertion reuses the generated adapter-family checks for each quantization and adds plan-before-model and plan-before-stack request ordering checks.
- The combined selector default remains `multi-parent-sign-merge-q4`.
- Each step renders `modulePlanState=loaded`, `modulePlanResource=browser-constrained-local-assembly`, six modules, ordered byte summaries, ordered checksum summaries, slots, roles, phases, dependencies, browser-owned trace checkpoints, model route, and stack route.

## Current Generated Summaries

- q4_0 bytes: `0: 6592 bytes, 1: 585 bytes, 2: 1849 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`
- q8_0 bytes: `0: 8832 bytes, 1: 585 bytes, 2: 1849 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`
- f32 bytes: `0: 20352 bytes, 1: 586 bytes, 2: 1862 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0xb3f89bf19fb0895a, 2: 0x10c2f412e7751fbd, 3: 0x0571c8fd7c145691, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6`
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0x8f297c2ea011d241, 2: 0x3b94db808395e594, 3: 0x125729a41dd119bd, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb`
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0xd944f90f17c6d61c, 2: 0xcf7cb192a48b5ed3, 3: 0x8ccb2722ee499c66, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c`
- Trace: `0: plan verified, 1: model accepted, 2: manifest verified, 3: assembly evidence verified, 4: adapter family verified, 5: adapter stack applied, 6: ready`

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/combined-selector-assembly/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18742/app/ 19594 multi-parent-sign-merge-q4 combined-selector-assembly`

The smoke observed only loopback requests. For each quantization, the network request order showed `.module-plan.receipt` before `.slm`, then manifest, assembly receipt, evidence files, adapter-family receipt, adapter manifests, family ADP1, and sparse ASP1. Each quantization generated `e` with `selected_next_token=101` after `adapter_stack_applied(2)`.

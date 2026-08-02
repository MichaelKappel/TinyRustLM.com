---
title: Browser Module Plan Byte Counts Memory 2026-06-27
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-byte-counts-memory-2026-06-27/
status: reviewed_current
reviewed_utc: 2026-06-28T01:07:16Z
---

# Browser Module Plan Byte Counts Memory

## Summary

TinyRustLM generated `.module-plan.receipt` files now carry explicit `module.N.byte_count` fields for every browser-local assembly module. The browser verifies those byte counts against fetched model bytes, fetched text sidecars, and adapter manifest artifact sizes before generated model or adapter stack work can continue.

## Implemented Shape

- `module.0.byte_count`: generated `.slm` byte length, checked before WASM model transfer.
- `module.1.byte_count`: `.slm.manifest` text byte length, checked after manifest fetch.
- `module.2.byte_count`: `.assembly.receipt` text byte length, checked after assembly receipt fetch.
- `module.3.byte_count`: `.adapter-family.receipt` text byte length, checked after adapter-family receipt fetch.
- `module.4+ .byte_count`: receipt-declared adapter stack artifact byte lengths, checked against fetched adapter manifests before artifact fetch and auto apply.

## Source Routes

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes per-module byte counts into generated module-plan receipts and asserts them in browser-bundle tests.
- `tinyrustlm/app/app.js` verifies receipt byte counts before model transfer, text-sidecar use, adapter-stack artifact fetch, and auto apply.
- `tinyrustlm/app/index.html` adds the Module Plan `Bytes` row.
- `tinyrustlm/tools/browser_harness/src/main.rs` requires the `modulePlanBytes` UI id.
- `tinyrustlm/tools/browser-smoke.js` checks generated-root byte display, source-root fallback, and `module-plan-byte-drift`.

## Verification

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-module-plan-byte-counts\tinyrustlm all`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18732/app/ 19576 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18732/app/ 19572 multi-parent-sign-merge-q4 module-plan-byte-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18734/app/ 19574 tinylm16q8 ui-audit`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace`

## Evidence Notes

The current regenerated q4 summary after the browser assembly trace pass is `0: 6592 bytes, 1: 585 bytes, 2: 1849 bytes, 3: 4316 bytes, 4: 20224 bytes, 5: 832 bytes`.

The byte-drift smoke mutated only `module.0.byte_count` while keeping the receipt checksum aligned through `selector.registry`. The browser requested `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`, reported `Module plan field module.0.byte_count was 6591`, and stopped before generated `.slm`, ADP1, ASP1, and adapter-manifest routes.

The source-root UI audit proved checked fallback models render the Module Plan byte row as `unavailable` on desktop and mobile.

## Routing

Use this report when changing `.module-plan.receipt` byte-count fields, Module Plan byte rendering, browser pre-model-fetch byte validation, adapter-stack artifact byte matching, or `module-plan-byte-drift` assertions.

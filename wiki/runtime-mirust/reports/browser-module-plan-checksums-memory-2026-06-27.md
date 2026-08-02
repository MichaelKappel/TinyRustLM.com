---
title: Browser Module Plan Checksums Memory 2026-06-27
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-checksums-memory-2026-06-27/
status: reviewed_current
reviewed_utc: 2026-06-28T01:07:16Z
---

# Browser Module Plan Checksums Memory

## Summary

TinyRustLM generated `.module-plan.receipt` files now carry uniform `module.N.checksum` fields for every browser-local assembly module. The browser verifies those checksums from the module-plan receipt before generated model bytes or adapter stack artifacts can be fetched.

## Implemented Shape

- `module.0.checksum`: generated `.slm` checksum, matched before model byte transfer.
- `module.1.checksum`: `.slm.manifest` checksum, matched before manifest trust.
- `module.2.checksum`: `.assembly.receipt` checksum, matched before evidence-file fetches.
- `module.3.checksum`: `.adapter-family.receipt` checksum, matched before family manifest loading.
- `module.4+ .checksum`: receipt-declared adapter stack artifact checksums, matched to route manifest metadata before artifact fetch and auto apply.

## Source Routes

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes per-module checksums into generated module-plan receipts and asserts stack checksum fields in browser-bundle tests.
- `tinyrustlm/app/app.js` renders the ordered checksum summary and verifies stack module checksums before generated stack work.
- `tinyrustlm/app/index.html` adds the Module Plan `Checksums` row.
- `tinyrustlm/tools/browser_harness/src/main.rs` requires the `modulePlanChecksums` UI id.
- `tinyrustlm/tools/browser-smoke.js` checks generated-root checksum display, source-root fallback, and `module-plan-checksum-drift`.

## Verification

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-checksums/tinyrustlm all`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18736/app/ 19586 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18736/app/ 19588 multi-parent-sign-merge-q4 module-plan-checksum-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18738/app/ 19590 tinylm16q8 ui-audit`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace`

## Evidence Notes

The current regenerated q4 summary after the browser assembly trace pass is `0: 0x1a6808e3098d1ce0, 1: 0xb3f89bf19fb0895a, 2: 0x10c2f412e7751fbd, 3: 0x0571c8fd7c145691, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6`.

The checksum-drift smoke mutated only `module.4.checksum` while keeping the receipt checksum aligned through `selector.registry`. The browser requested `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`, reported `module plan adapter module checksum mismatch`, and stopped before generated `.slm`, ADP1, ASP1, and adapter-manifest routes.

The source-root UI audit proved checked fallback models render the Module Plan checksum row as `unavailable` on desktop and mobile.

## Routing

Use this report when changing `.module-plan.receipt` checksum fields, Module Plan checksum rendering, browser pre-model-fetch checksum validation, stack artifact checksum matching, or `module-plan-checksum-drift` assertions.

---
title: Browser Module Plan Total Limit Memory 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-total-limit-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T18:20:00Z
---

# Browser Module Plan Total Limit Memory

## Routing Summary

Generated browser module plans now carry `module_plan_total_byte_budget_limit` beside the exact `module_plan_total_byte_budget`. This turns the browser-constrained self-assembly cap into selector and receipt evidence rather than an implicit source constant.

Open `tinyrustlm/tools/slm_pack/src/selector.rs`, `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`, `tinyrustlm/app/app.js`, `tinyrustlm/app/index.html`, and `tinyrustlm/tools/browser-smoke.js` before changing this field.

## Implementation Memory

- `selector.registry` entries emit `entry.N.module_plan_total_byte_budget_limit=43384832` for generated module-plan routes.
- Served `.module-plan.receipt` files emit `module_plan_total_byte_budget_limit=43384832`.
- Rust selector validation rejects cap drift before registry acceptance and keeps the exact total bounded by the declared cap.
- Browser registry intake requires the cap, requires it to match the local browser limit constant, and rejects entries where the exact total exceeds the cap.
- Browser receipt validation requires the served cap to match the selector-owned value before generated `.slm`, adapter-family, adapter-manifest, or stack artifact routes are fetched.
- The Module Plan panel renders `Total Limit` from verified receipt fields.
- `module-plan-total-limit-drift` mutates the served receipt cap while refreshing the receipt checksum and selector module-plan checksum, then proves the browser stops at the module-plan receipt.

## Verification Memory

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector` with 54 selector-filtered tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle` with 4 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness` with 6 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm` with 9 checks.
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-total-limit\tinyrustlm all`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8100/app/ 19582 multi-parent-sign-merge-q4 combined-selector-assembly`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8100/app/ 19584 multi-parent-sign-merge-q4 module-plan-total-limit-drift`.
- `git diff --check` returned line-ending notices only, with no whitespace errors.

The normal generated-root smoke verified `Total Limit` as `43384832 bytes` for q4_0, q8_0, and f32. Exact Total Budget values after the cap field are `103780 bytes` for q4_0, `106020 bytes` for q8_0, and `117554 bytes` for f32.

The drift smoke stopped after `/models/multi-parent-sign-merge-q4.module-plan.receipt`; no generated `.slm`, adapter-family, adapter-manifest, or stack artifact route was fetched.

No coverage tool is active in the no-third-party workspace, so focused syntax checks, Rust unit tests, generated-root validation, static harness checks, and browser-smoke evidence are the recorded coverage evidence for this bead.

## Research Route

This implements the resource-envelope and speciation-fit guidance from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md`: browser fit boundaries should be local, typed, checksum-routed evidence before model bytes are consumed.

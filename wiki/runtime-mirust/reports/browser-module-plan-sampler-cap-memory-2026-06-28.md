---
title: Browser Module Plan Sampler Cap Memory 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-sampler-cap-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T23:59:00Z
---

# Browser Module Plan Sampler Cap Memory

This report routes the browser module-plan sampler candidate cap proof so future agents can preserve the fixed-buffer decoding envelope while changing generated selector, receipt, or browser assembly code.

## Implementation

- Generated selector registries now carry `entry.N.module_plan_sampler_candidate_cap=1024`.
- Served `.module-plan.receipt` files now carry `module_plan_sampler_candidate_cap=1024`.
- Rust selector validation rejects sampler-cap drift before a generated route becomes admissible.
- Browser registry intake and receipt validation require the selector cap, receipt cap, and local fixed-buffer sampler cap to match before generated `.slm` bytes or adapter stack artifacts are fetched.
- The Module Plan panel renders `Sampler Cap` as `1024 candidates` for generated q4_0/q8_0/f32 entries and `unavailable` for checked source routes.
- `module-plan-sampler-cap-drift` mutates the served receipt cap while refreshing the selector checksum, then proves startup stops at the module-plan receipt before model bytes, adapter-family receipt, adapter manifests, or stack artifacts are requested.

## Browser Evidence

- Generated all-root staging: `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-sampler-cap\tinyrustlm all`.
- Normal generated assembly: `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8105/app/ 19596 multi-parent-sign-merge-q4 combined-selector-assembly`.
- Sampler-cap drift: `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8105/app/ 19598 multi-parent-sign-merge-q4 module-plan-sampler-cap-drift`.
- Source UI fallback: `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8106/app/ 19602 tinylm16q8 ui-audit`.

## Rust And Script Evidence

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests::rejects_module_plan_sampler_candidate_cap_drift`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests::writes_and_validates_selector_registry_with_module_plan_receipt`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests::writes_combined_browser_multi_parent_bundle`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests::`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- .\tinyrustlm`

## Generated Values

- Sampler cap: `1024 candidates`.
- q4 total budget: `103782 bytes`.
- q8 total budget: `106022 bytes`.
- f32 total budget: `117556 bytes`.
- Drift failure text: `Module plan sampler candidate cap mismatch`.

## Routing Rule

Open this report before changing fixed-buffer sampling limits, selector `module_plan_sampler_candidate_cap`, served `.module-plan.receipt` sampler fields, browser `Top K` clamping, Module Plan sampler display, or `module-plan-sampler-cap-drift` smoke assertions.

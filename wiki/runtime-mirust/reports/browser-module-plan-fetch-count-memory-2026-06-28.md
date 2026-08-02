---
title: Browser Module Plan Fetch Count Memory 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-fetch-count-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T23:59:00Z
---

# Browser Module Plan Fetch Count Memory

This record routes the browser module-plan fetch-count envelope added on 2026-06-28.

## Implementation Summary

- Generated selector registry entries now carry `entry.N.module_plan_fetch_count_limit=32`.
- Served `.module-plan.receipt` files now carry `module_plan_fetch_count_limit=32`.
- Rust selector validation requires selector and receipt agreement, rejects missing fetch-count limit fields, and requires `module_count + 1` to fit the declared route-count envelope.
- Browser registry intake computes the planned generated-root route count from module-plan modules, assembly evidence routes, and adapter manifests before generated model bytes are fetched.
- Browser smoke now counts the actual generated self-assembly requests owned by each q4_0, q8_0, and f32 module-plan model key.
- The actual-count assertion treats `/models/{model}...` and `/evidence/{model}/...` as governed requests, expects 21 requests per generated assembly pass, and keeps each pass under the 32-fetch envelope.
- Browser receipt validation requires the same value and renders `Fetch Limit` as `32 fetches` in the Module Plan panel.
- `module-plan-fetch-count-drift` mutates the served receipt limit while refreshing selector checksum routing, proving the browser stops at module-plan validation.

## Current Budget Values

- Fetch count limit: `32 fetches`.
- q4_0 total budget: `173415 bytes`.
- q8_0 total budget: `175655 bytes`.
- f32 total budget: `187189 bytes`.
- Total byte budget limit: `43454464 bytes`.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack fetch_count_limit`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack writes_and_validates_selector_registry_with_module_plan_receipt`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack writes_combined_browser_multi_parent_bundle`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack writes_quantized_browser_multi_parent_bundles`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-fetch-count-drift\tinyrustlm all`
- Generated-root `combined-selector-assembly` proved q4_0, q8_0, and f32 render `Fetch Limit` as `32 fetches`.
- Generated-root `module-plan-fetch-count-drift` proved drift stops after selector plus module-plan receipt fetch, before generated model, assembly evidence, adapter-family, manifest, or stack artifact routes.
- Source-root `ui-audit` proved non-generated roots keep Module Plan fetch limit fallback as `unavailable`.
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-actual-fetch-count\tinyrustlm all`
- Generated-root `combined-selector-cycle` on `target\module-plan-actual-fetch-count\tinyrustlm` proved two q4_0/q8_0/f32 passes with 21 governed requests per model pass.
- Generated-root `combined-selector-reload-soak` on `target\module-plan-actual-fetch-count\tinyrustlm` proved two fresh page lifetimes with 21 governed requests per model pass.

## Routing Rule

Open this page before changing generated self-assembly route counts, actual generated request accounting, selector `module_plan_fetch_count_limit`, served `.module-plan.receipt` fetch-count fields, Module Plan `Fetch Limit` display, or fetch-count smoke assertions.

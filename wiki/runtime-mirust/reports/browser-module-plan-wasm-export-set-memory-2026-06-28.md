---
title: Browser Module Plan WASM Export Set Memory 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-wasm-export-set-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T23:59:00Z
---

# Browser Module Plan WASM Export Set Memory

This report routes the browser module-plan WASM export-set proof so future agents can preserve the Rust-owned browser runtime ABI while changing generated selector, receipt, or browser assembly code.

## Implementation

- Generated selector registries now carry `entry.N.module_plan_wasm_export_set=tinyrustlm-generate-v1`.
- Served `.module-plan.receipt` files now carry `module_plan_wasm_export_set=tinyrustlm-generate-v1`.
- Rust selector validation rejects export-set drift before a generated route becomes admissible.
- Browser registry intake requires the selector export set to match the local `tinyrustlm-generate-v1` ABI name.
- Browser receipt validation compares the receipt field with the selector field and verifies the instantiated WASM exports before generated `.slm` bytes or adapter stack artifacts are fetched.
- The Module Plan panel renders `WASM ABI` as `tinyrustlm-generate-v1` for generated q4_0/q8_0/f32 entries and `unavailable` for checked source routes.
- `module-plan-wasm-export-set-drift` mutates the served receipt export set while refreshing the selector checksum, then proves startup stops at the module-plan receipt before model bytes, adapter-family receipt, adapter manifests, or stack artifacts are requested.

## Browser Evidence

- Generated all-root staging: `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\module-plan-wasm-export-set-drift\tinyrustlm all`.
- Normal generated assembly: `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8106/app/ 9264 multi-parent-sign-merge-q4 combined-selector-assembly`.
- WASM export-set drift: `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8106/app/ 9263 multi-parent-sign-merge-q4 module-plan-wasm-export-set-drift`.
- Source UI fallback: `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8107/app/ 9265 tinylm16q8 ui-audit`.

## Rust And Script Evidence

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests::rejects_module_plan_wasm_export_set_drift`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests::writes_browser_multi_parent_bundle`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests::writes_quantized_browser_multi_parent_bundles`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests::writes_combined_browser_multi_parent_bundle`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`

## Generated Values

- WASM ABI: `tinyrustlm-generate-v1`.
- Required export names: `memory`, `alloc`, `dealloc`, `init_runtime`, `load_model`, `generate`, `set_sampling_config`, `generate_next_token`, `validate_adapter_delta`, `apply_adapter_delta`, `last_result_ptr`, `last_result_len`, `get_diagnostics_ptr`, `get_diagnostics_len`, `reset_context`, and `free_model`.
- q4 total budget: `103789 bytes`.
- q8 total budget: `106029 bytes`.
- f32 total budget: `117563 bytes`.
- Drift failure text: `Module plan WASM export set mismatch`.

## Routing Rule

Open this report before changing Rust WASM exports, browser WASM boundary calls, selector `module_plan_wasm_export_set`, served `.module-plan.receipt` export-set fields, Module Plan `WASM ABI` display, or `module-plan-wasm-export-set-drift` smoke assertions.

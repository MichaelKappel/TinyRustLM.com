---
title: Browser Module Plan KV Cache Memory 2026-06-28
public_route: /runtime-mirust/reports/browser-module-plan-kv-cache-memory-2026-06-28/
status: current
authority: implementation-report
---

# Browser Module Plan KV Cache Memory

## Routing Summary

Generated browser module plans now bind the KV-cache memory envelope before generated model bytes are fetched. Open `tinyrustlm/tools/slm_pack/src/selector.rs`, `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`, `tinyrustlm/tools/slm_pack/src/slm_validate.rs`, `tinyrustlm/runtime/src/kv_cache.rs`, `tinyrustlm/runtime/src/diagnostics.rs`, `tinyrustlm/runtime/src/generate.rs`, `tinyrustlm/app/app.js`, and `tinyrustlm/tools/browser-smoke.js` when KV-cache byte budget, page count, or browser module-plan total budget changes are in scope.

## Implemented Shape

- `KvCache` reports its exact byte budget and 64 KiB page count from layer count, max context, KV head count, and head dimension.
- Runtime diagnostics expose `kv_cache_byte_budget` and `kv_cache_page_count`, record them after model load, and clear them on load failure or `free_model`.
- `ValidationReport` computes the same KV-cache byte budget and page count from validated `.slm` shape metadata.
- Generated `selector.registry` entries and served `.module-plan.receipt` files emit `module_plan_kv_cache_byte_budget` and `module_plan_kv_cache_page_count`.
- Browser receipt validation checks selector and receipt KV-cache fields before generated `.slm` or stack artifact routes are fetched.
- The Module Plan panel renders verified `KV Budget` and `KV Pages` rows.
- The total self-assembly cap is now `43384832` bytes because it includes the 8 MiB KV-cache cap beside model, adapter, text-sidecar, runtime scratch, and WASM memory caps.

## Browser Proof

- Normal generated-root smoke verifies `KV Budget` as `1024 bytes` and `KV Pages` as `1` for q4_0, q8_0, and f32 tiny generated entries.
- Exact generated Module Plan total budgets are `103780 bytes` for q4_0, `106020 bytes` for q8_0, and `117554 bytes` for f32.
- `module-plan-kv-cache-drift` mutates the served KV page count while refreshing receipt and selector checksums, then proves browser validation stops at the module-plan receipt.
- `module-plan-total-budget-drift` and `module-plan-total-limit-drift` were rerun after the KV-cache envelope became part of the total budget math.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-runtime -- --nocapture` with 82 tests
- `cargo test -p tinyrustlm-slm-pack selector -- --nocapture` with 56 selector-filtered tests
- `cargo test -p tinyrustlm-slm-pack slm_validate -- --nocapture` with 6 tests
- `cargo test -p tinyrustlm-slm-pack browser_bundle -- --nocapture` with 4 tests
- `cargo test -p tinyrustlm-browser-harness` with 6 tests
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` with 9 static checks
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle ..\target\browser-served-kv-cache\tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8101/app/ 19604 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8101/app/ 19601 multi-parent-sign-merge-q4 module-plan-kv-cache-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8101/app/ 19602 multi-parent-sign-merge-q4 module-plan-total-budget-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8101/app/ 19603 multi-parent-sign-merge-q4 module-plan-total-limit-drift`

## Next Routing

Use this report before claiming paged KV-cache, prefix-cache, radix-cache, or longer-context memory behavior. Those lanes should first become typed receipts, diagnostics, and browser-smoke assertions instead of public copy.

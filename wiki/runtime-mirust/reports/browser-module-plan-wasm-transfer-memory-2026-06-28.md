# Browser Module Plan WASM Transfer Memory - 2026-06-28

status: reviewed_current
authority: generated from current implementation and verification evidence

## Summary

Generated module-plan selector entries and served `.module-plan.receipt` files now bind `module_plan_wasm_transfer_strategy=copy-then-release-v1`. The browser verifies selector and receipt agreement, renders the verified Module Plan `Transfer` row, and keeps the WASM byte-transfer contract aligned with the existing JavaScript copy-to-WASM and `dealloc` release discipline before generated model bytes or stack artifacts are fetched.

## Implementation Route

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, checksums, and validates `entry.N.module_plan_wasm_transfer_strategy`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_wasm_transfer_strategy=copy-then-release-v1` into generated `.module-plan.receipt` files and selector route records.
- `tinyrustlm/app/index.html` adds the Module Plan `Transfer` row.
- `tinyrustlm/app/app.js` validates selector and receipt agreement, requires the `copy-then-release-v1` strategy, and renders the verified field only after the receipt is accepted.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-wasm-transfer-drift` and asserts generated roots render `copy-then-release-v1` while source roots render `unavailable`.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the new row id in the static contract.

## Verified Behavior

- Node syntax checks passed for `tinyrustlm/app/app.js` and `tinyrustlm/tools/browser-smoke.js`.
- `cargo fmt --all -- --check` passed.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 71 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 4 tests.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 static checks.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-wasm-transfer\tinyrustlm all` passed and validated 3 module-plan routes.
- Generated-root `module-plan-wasm-transfer-drift` passed on `http://127.0.0.1:8231/app/`, returning `Module plan WASM transfer strategy mismatch` after selector plus module-plan receipt requests and before generated model routes.
- Generated-root `combined-selector-cycle` passed on `http://127.0.0.1:8231/app/`, proving q4_0/q8_0/f32 generated assemblies render `Transfer` as `copy-then-release-v1` and still reach ready with ADP1 plus ASP1 plus ALR1 stack apply.
- Source-root `ui-audit` passed on `http://127.0.0.1:8232/app/`, proving the fallback row remains `unavailable`.

## Routing Notes

Open this report before changing browser WASM byte-copy helpers, generated bundle module-plan receipts, selector registry transfer-strategy validation, Module Plan `Transfer` display, or `module-plan-wasm-transfer-drift` smoke assertions. Keep this field separate from heap floor and export-set checks: it records how accepted bytes cross into WASM memory after route and envelope validation.

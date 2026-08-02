# Browser Module Plan Model Release Memory - 2026-06-29

status: reviewed_current
authority: generated from current implementation and verification evidence

## Summary

Generated module-plan selector entries and served `.module-plan.receipt` files now bind `module_plan_model_release_strategy=free-before-reassembly-v1`. The browser verifies selector and receipt agreement, renders the verified Module Plan `Release` row, and keeps same-page generated q4_0/q8_0/f32 switching tied to the existing `free_model` release-before-reassembly behavior.

## Implementation Route

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, checksums, and validates `entry.N.module_plan_model_release_strategy`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_model_release_strategy=free-before-reassembly-v1` into generated `.module-plan.receipt` files and selector route records.
- `tinyrustlm/app/index.html` adds the Module Plan `Release` row.
- `tinyrustlm/app/app.js` validates selector and receipt agreement, requires `free-before-reassembly-v1`, and renders the verified field only after receipt acceptance.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-model-release-drift`, asserts generated roots render `free-before-reassembly-v1`, and asserts source roots render `unavailable`.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the new row id in the static contract.

## Verified Behavior

- Node syntax checks passed for `tinyrustlm/app/app.js` and `tinyrustlm/tools/browser-smoke.js`.
- `cargo fmt --all -- --check` passed.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 72 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 4 tests.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 static checks.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-model-release\tinyrustlm all` passed and validated 3 module-plan routes.
- Generated-root `module-plan-model-release-drift` passed on `http://127.0.0.1:8233/app/`, returning `Module plan model release strategy mismatch` after selector plus module-plan receipt requests and before generated model routes.
- Generated-root `combined-selector-cycle` passed on `http://127.0.0.1:8233/app/`, proving q4_0/q8_0/f32 generated assemblies render `Release` as `free-before-reassembly-v1` while `free_model` runs before post-initial assemblies.
- Source-root `ui-audit` passed on `http://127.0.0.1:8234/app/`, proving the fallback row remains `unavailable`.

## Routing Notes

Open this report before changing generated model-switch release sequencing, selector registry module-plan release metadata, Module Plan `Release` display, or `module-plan-model-release-drift` smoke assertions. Keep this field separate from WASM byte transfer: it records loaded-model lifetime discipline during reassembly, not byte copy mechanics.

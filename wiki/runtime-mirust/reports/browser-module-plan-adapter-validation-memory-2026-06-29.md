# Browser Module Plan Adapter Validation Memory - 2026-06-29

status: reviewed_current
authority: generated from current implementation and verification evidence

## Summary

Generated module-plan selector entries and served `.module-plan.receipt` files now bind `module_plan_adapter_validation_strategy=rust-validate-before-apply-v1`. The browser verifies selector and receipt agreement, renders the verified Module Plan `Validate` row, and requires the generated auto-assembly path to use Rust `validate_adapter_delta` before any `apply_adapter_delta` call.

## Implementation Route

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, checksums, and validates `entry.N.module_plan_adapter_validation_strategy`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_adapter_validation_strategy=rust-validate-before-apply-v1` into generated `.module-plan.receipt` files and selector route records.
- `tinyrustlm/app/index.html` adds the Module Plan `Validate` row.
- `tinyrustlm/app/app.js` validates selector and receipt agreement, requires the same strategy before generated auto-assembly, and renders the verified field only after receipt acceptance.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-adapter-validation-drift`, asserts generated roots render `rust-validate-before-apply-v1`, and asserts source roots render `unavailable`.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the new row id in the static contract.

## Verified Behavior

- Node syntax checks passed for `tinyrustlm/app/app.js` and `tinyrustlm/tools/browser-smoke.js`.
- `cargo fmt --all -- --check` passed with `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 74 tests, including `rejects_module_plan_adapter_validation_strategy_drift`.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 4 tests.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 static checks.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-adapter-validation\tinyrustlm all` passed and validated 3 module-plan routes.
- Generated-root `module-plan-adapter-validation-drift` passed on `http://127.0.0.1:8240/app/`, returning `Module plan adapter validation strategy mismatch` after selector plus module-plan receipt requests and before generated model routes.
- Generated-root `combined-selector-assembly` passed on `http://127.0.0.1:8240/app/`, proving q4_0/q8_0/f32 generated assemblies render `Validate` as `rust-validate-before-apply-v1` and log all `validate_adapter_delta` calls before `apply_adapter_delta`.
- Source-root `ui-audit` passed on `http://127.0.0.1:8241/app/`, proving the fallback row remains `unavailable`.

## Routing Notes

Open this report before changing generated adapter-stack validation sequencing, selector registry module-plan validation metadata, Module Plan `Validate` display, or `module-plan-adapter-validation-drift` smoke assertions. Keep this field separate from stack byte budgets: it records Rust validation authority before mutation, not how many adapter bytes are allowed.

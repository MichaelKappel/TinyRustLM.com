# Browser Module Plan Runtime Reset Memory - 2026-06-29

status: reviewed_current
authority: generated from current implementation and verification evidence

## Summary

Generated module-plan selector entries and served `.module-plan.receipt` files now bind `module_plan_runtime_reset_strategy=reset-context-before-assembly-v1`. The browser verifies selector and receipt agreement, renders the verified Module Plan `Reset` row, calls WASM `reset_context` after generated model bytes load, and proves the reset happens before assembly evidence and adapter-stack work.

## Implementation Route

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, checksums, and validates `entry.N.module_plan_runtime_reset_strategy`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module_plan_runtime_reset_strategy=reset-context-before-assembly-v1` into generated `.module-plan.receipt` files and selector route records.
- `tinyrustlm/app/index.html` adds the Module Plan `Reset` row.
- `tinyrustlm/app/app.js` validates selector and receipt agreement, requires `reset-context-before-assembly-v1`, and calls `reset_context` before recording generated assembly progress.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-runtime-reset-drift`, asserts generated roots render `reset-context-before-assembly-v1`, checks `reset_context` precedes adapter validation/application, and asserts source roots render `unavailable`.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the new row id in the static contract.

## Verified Behavior

- Node syntax checks passed for `tinyrustlm/app/app.js` and `tinyrustlm/tools/browser-smoke.js`.
- `cargo fmt --all -- --check` passed with `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 73 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 4 tests.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 static checks.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-runtime-reset\tinyrustlm all` passed and validated 3 module-plan routes.
- Generated-root `module-plan-runtime-reset-drift` passed on `http://127.0.0.1:8235/app/`, returning `Module plan runtime reset strategy mismatch` after selector plus module-plan receipt requests and before generated model routes.
- Generated-root `combined-selector-cycle` passed on `http://127.0.0.1:8235/app/`, proving q4_0/q8_0/f32 generated assemblies render `Reset` as `reset-context-before-assembly-v1` and log `reset_context(...)` before adapter validation/application on every generated pass.
- Source-root `ui-audit` passed on `http://127.0.0.1:8236/app/`, proving the fallback row remains `unavailable`.

## Routing Notes

Open this report before changing generated model-load context reset sequencing, selector registry module-plan reset metadata, Module Plan `Reset` display, or `module-plan-runtime-reset-drift` smoke assertions. Keep this field separate from model release: release records prior-model lifetime, while reset records fresh runtime context before verified assembly.

# Browser Module Plan WASM Heap Memory - 2026-06-28

status: reviewed_current
authority: generated from current implementation and verification evidence

## Summary

Generated module-plan selector entries and served `.module-plan.receipt` files now bind `module_plan_wasm_heap_min_bytes`. The browser verifies selector and receipt agreement, recomputes the heap floor as `max(64 KiB, model byte budget, adapter stack byte budget, prompt byte limit)`, renders the verified Module Plan `Heap Floor` row, and probes WASM `alloc`/`dealloc` for that floor before generated model bytes or stack artifacts are fetched.

## Implementation Route

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, checksums, and validates `entry.N.module_plan_wasm_heap_min_bytes`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes the same field into generated `.module-plan.receipt` files and selector route records.
- `tinyrustlm/app/index.html` adds the Module Plan `Heap Floor` row.
- `tinyrustlm/app/app.js` validates the selector/receipt value, recomputes the heap-floor formula, probes WASM allocation with the verified byte count, releases that probe allocation, and keeps source roots at `unavailable`.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-wasm-heap-drift` and asserts generated roots render `65536 bytes` while source roots render `unavailable`.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the new row id in the static contract.

## Verified Behavior

- Node syntax checks passed for `tinyrustlm/app/app.js` and `tinyrustlm/tools/browser-smoke.js`.
- `cargo fmt --all -- --check` passed.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 static checks.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 4 tests.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 70 tests.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-wasm-heap\tinyrustlm all` passed and validated 3 module-plan routes.
- Generated-root `module-plan-wasm-heap-drift` passed on `http://127.0.0.1:8221/app/`, returning `Module plan WASM heap min bytes mismatch` after selector plus module-plan receipt requests and before generated model routes.
- Generated-root `combined-selector-cycle` passed on `http://127.0.0.1:8221/app/`, proving q4_0/q8_0/f32 generated assemblies render `Heap Floor` as `65536 bytes` and still reach ready with ADP1 plus ASP1 plus ALR1 stack apply.
- Source-root `ui-audit` passed on `http://127.0.0.1:8222/app/`, proving the fallback row remains `unavailable`.

## Routing Notes

Open this report before changing browser WASM allocation probes, module-plan heap or transfer envelopes, generated bundle module-plan receipts, or selector registry heap-floor validation. Keep heap floor separate from `module_plan_total_byte_budget`; it proves available transfer capacity rather than counting another fetched resource.

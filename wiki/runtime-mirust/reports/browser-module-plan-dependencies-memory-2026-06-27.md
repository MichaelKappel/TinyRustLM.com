# Browser Module Plan Dependencies Memory - 2026-06-27

## Summary

Browser module-plan receipts now carry `module.N.depends_on` fields. The generated browser bundle writes a small dependency chain from runtime WASM through the model, manifest, assembly receipt, adapter-family receipt, and ordered adapter stack; the browser verifies those edges before fetching generated `.slm` bytes or stack artifacts.

## Implementation Notes

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module.N.depends_on` beside each module kind, role, assembly slot, route, and checksum.
- `tinyrustlm/app/app.js` validates exact dependency edges during module-plan verification: module 0 depends on `runtime-wasm`, then each later module depends on the previous `module.N`.
- `tinyrustlm/app/index.html` adds a Module Plan `Depends` row, and `app.js` renders the ordered dependency summary only from verified receipt fields.
- `tinyrustlm/tools/browser-smoke.js` asserts generated q4 dependency display, source-root fallback `unavailable`, and `module-plan-dependency-drift` behavior.
- `tinyrustlm/tools/browser_harness/src/main.rs` treats `modulePlanDepends` as part of the static app contract.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-dependencies/tinyrustlm all`
- Generated-root browser smoke on `http://127.0.0.1:18724/app/` for `multi-parent-sign-merge-q4 adapter-sidecar-registry-file` showed `0: runtime-wasm, 1: module.0, 2: module.1, 3: module.2, 4: module.3, 5: module.4`.
- Generated-root browser smoke on `http://127.0.0.1:18724/app/` for `multi-parent-sign-merge-q4 module-plan-dependency-drift` stopped at the receipt with `Module plan field module.4.depends_on was module.2` and requested no generated q4 `.slm`, ADP1, ASP1, or adapter-manifest route.
- Source-root `ui-audit` on `http://127.0.0.1:18726/app/` proved Module Plan dependency fallback is `unavailable` on desktop and mobile.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo test --workspace`

## Routing

Open this report before changing module-plan `depends_on` field names, dependency display, `module-plan-dependency-drift`, or pre-model-fetch generated plan verification. Pair it with the role, slot, graph, and stack reports when changing planner-readable module semantics.

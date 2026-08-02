# Browser Module Plan Assembly Slots Memory - 2026-06-27

## Summary

Browser module-plan receipts now carry typed `module.N.assembly_slot` fields. The generated browser bundle writes stable slots for runtime model, model manifest, assembly receipt, adapter-family receipt, and each adapter-stack position; the browser verifies those slots before fetching generated `.slm` bytes or stack artifacts.

## Implementation Notes

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `module.N.assembly_slot` beside each module kind, role, route, and checksum.
- `tinyrustlm/app/app.js` validates exact assembly slots during module-plan verification: `runtime-model`, `model-manifest`, `assembly-receipt`, `adapter-family-receipt`, then `adapter-stack-N`.
- `tinyrustlm/app/index.html` adds a Module Plan `Slots` row, and `app.js` renders the ordered slot summary only from verified receipt fields.
- `tinyrustlm/tools/browser-smoke.js` asserts generated q4 slot display, source-root fallback `unavailable`, and `module-plan-slot-drift` behavior.
- `tinyrustlm/tools/browser_harness/src/main.rs` treats `modulePlanSlots` as part of the static app contract.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-slots/tinyrustlm all`
- Generated-root browser smoke on `http://127.0.0.1:18720/app/` for `multi-parent-sign-merge-q4 adapter-sidecar-registry-file` showed `0: runtime-model, 1: model-manifest, 2: assembly-receipt, 3: adapter-family-receipt, 4: adapter-stack-0, 5: adapter-stack-1`.
- Generated-root browser smoke on `http://127.0.0.1:18720/app/` for `multi-parent-sign-merge-q4 module-plan-slot-drift` stopped at the receipt with `Module plan field module.4.assembly_slot was adapter-stack-slot-drift` and requested no generated q4 `.slm`, ADP1, ASP1, or adapter-manifest route.
- Source-root `ui-audit` on `http://127.0.0.1:18722/app/` proved Module Plan slot fallback is `unavailable` on desktop and mobile.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo test --workspace`

## Routing

Open this report before changing module-plan `assembly_slot` field names, slot display, `module-plan-slot-drift`, or pre-model-fetch generated plan verification. Pair it with the role-display and role-drift reports when changing planner-readable module semantics.

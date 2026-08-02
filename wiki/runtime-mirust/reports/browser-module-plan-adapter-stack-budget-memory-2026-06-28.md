# Browser Module Plan Adapter Stack Budget Memory - 2026-06-28

status: current
public_route: /runtime-mirust/reports/browser-module-plan-adapter-stack-budget-memory-2026-06-28/
source_authority: local source, generated bundle, focused Rust tests, and browser smoke

## Route Summary

Generated selector entries and served `.module-plan.receipt` files now bind the exact auto-applied adapter stack payload budget before generated model bytes load.

## Implemented Shape

- `module_plan_adapter_stack_byte_budget` is emitted in selector registries and module-plan receipts.
- The generated browser bundle computes the value from the staged ADP1 plus ASP1 plus ALR1 artifact byte counts.
- Browser registry intake requires the stack byte budget to be positive, inside the adapter-family cap, and included in the total self-assembly budget.
- Browser module-plan receipt validation checks the field against selector metadata and sums the ordered stack module byte counts.
- Adapter-family manifest loading verifies fetched stack artifact byte counts against the receipt-declared stack modules before auto-apply.
- The Module Plan panel renders `Stack Budget` beside model, adapter, scratch, KV, total, and limit rows.

## Verified Evidence

- `cargo test -p tinyrustlm-slm-pack selector::tests::`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::tests::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-stack-budget\tinyrustlm all`
- `cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8102/app/ 19580 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8102/app/ 19581 multi-parent-sign-merge-q4 module-plan-adapter-stack-budget-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8102/app/ 19582 multi-parent-sign-merge-q4 module-plan-total-budget-drift`

## Current Generated Values

- Stack Budget: `22144 bytes`
- q4_0 Total Budget: `103783 bytes`
- q8_0 Total Budget: `106023 bytes`
- f32 Total Budget: `117557 bytes`

## Next Route

Use this report before changing adapter-stack module byte accounting, adapter-family manifest byte checks, module-plan total budget math, or Module Plan panel budget rows.

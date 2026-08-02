---
title: Browser Module Plan Budget Display Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-budget-display-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T21:02:20Z
---

# Browser Module Plan Budget Display Memory

## Routing Summary

Use this report when work touches the browser Module Plan panel's visible resource budget rows, verified `.module-plan.receipt` budget fields, source fallback UI audit assertions, or generated-root adapter-sidecar smoke assertions for model and adapter byte envelopes.

## Implementation

- `tinyrustlm/app/index.html` adds `Model Budget` and `Adapter Budget` rows to the Module Plan panel.
- `tinyrustlm/app/app.js` renders `module_plan_model_byte_budget` and `module_plan_adapter_byte_budget` only from the already verified receipt field map. Missing fallback fields render `unavailable`.
- `tinyrustlm/tools/browser_harness/src/main.rs` treats the new budget row ids as part of the static app contract.
- `tinyrustlm/tools/browser-smoke.js` captures the budget rows in source-root `ui-audit` and generated-root `adapter-sidecar-registry-file` snapshots. Generated roots assert the q4/q8/f32 model budget text from known admitted artifact bytes and assert the adapter envelope as `1048576 bytes`.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18710/app/ 19542 tinylm16q8 ui-audit`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-budget-display/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18712/app/ 19544 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `cargo test --workspace`

## Outcome

The source-root desktop/mobile UI audit showed Module Plan fallback state `none` with `modulePlanModelBudget=unavailable` and `modulePlanAdapterBudget=unavailable`. The generated q4 registry-file smoke showed `modulePlanState=loaded`, `modulePlanModelBudget=6592 bytes`, `modulePlanAdapterBudget=1048576 bytes`, and the existing verified model route plus family ADP1 and sparse ASP1 stack display. Workspace tests passed with 249 checks.

## Next Routing

The next useful constrained-browser bead is planner-readable module purpose or stack role labels in the `.module-plan.receipt`, still rendered only after checksum/resource/graph/stack verification and still keeping JavaScript out of model and adapter payload parsing.

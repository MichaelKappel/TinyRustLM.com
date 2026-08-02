---
title: Browser Module Plan Resource Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-resource-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T19:26:45Z
---

# Browser Module Plan Resource Memory

## Routing Summary

Use this report when work touches generated selector `module_plan_*` resource fields, constrained browser self-assembly, served `.module-plan.receipt` byte envelopes, or generated-root `adapter-sidecar-registry-file` smoke coverage. It extends the first browser module-plan receipt with resource-class and byte-budget verification before generated `.slm` fetch.

## Implementation

- `tinyrustlm/tools/slm_pack/src/selector.rs` now carries `entry.N.module_plan_resource_class`, `entry.N.module_plan_model_byte_budget`, and `entry.N.module_plan_adapter_byte_budget` through selector registry generation, parsing, validation, and rebuild-drift checks.
- Selector validation rejects module-plan resource-class drift, non-canonical byte budgets, model byte budget drift against the admitted artifact bytes, and adapter byte budget drift against the adapter-family auto-apply budget.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes the same resource envelope into served `.module-plan.receipt` files and returns it to selector registry route generation.
- `tinyrustlm/app/app.js` requires the resource envelope before accepting generated module-plan registry routes, then rechecks the receipt's resource class, model byte budget, and adapter byte budget before generated model bytes are requested.
- `tinyrustlm/tools/browser_harness/src/main.rs` now treats `browser-constrained-local-assembly` as part of the static browser contract.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all`
- `cargo test -p tinyrustlm-slm-pack selector::`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo fmt --all -- --check`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-resource/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18698/app/ 19528 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `cargo test --workspace`
- `git diff --check`

The live generated-root q4 smoke requested `/models/multi-parent-sign-merge-q4.module-plan.receipt` before `/models/multi-parent-sign-merge-q4.slm`, auto-applied the family ADP1 plus sparse ASP1 stack before generation, preserved `q4_0` diagnostics, cleaned the temporary browser profile, and left only `TIME_WAIT` loopback entries on ports 18698 and 19528. `git diff --check` reported only existing line-ending conversion notices.

## Next Routing

The next useful module-plan bead is planner-visible variation: selector entries could declare purpose labels, planner-selected stack recipes, or alternative local module plans while preserving this resource-class and byte-budget envelope.

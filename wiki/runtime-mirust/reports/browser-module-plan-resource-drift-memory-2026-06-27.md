---
title: Browser Module Plan Resource Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-resource-drift-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T20:05:12Z
---

# Browser Module Plan Resource Drift Memory

## Routing Summary

Use this report when work touches browser-smoke `module-plan-resource-drift`, generated `.module-plan.receipt` resource envelopes, checksum-consistent receipt drift, or proof that generated `.slm` bytes are not fetched after module-plan budget mismatch.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-resource-drift` mode for generated multi-parent selector roots.
- The smoke intercepts the served selector registry and selected `.module-plan.receipt`, changes only `module_plan_adapter_byte_budget=1048576` to `1048575` in the receipt, recomputes the receipt checksum with the browser checksum algorithm, and patches only the matching `entry.N.module_plan_checksum`.
- The selector metadata budget remains unchanged, so the browser proves the receipt envelope gate itself: checksum verification passes, then `app.js` rejects the adapter byte-budget mismatch before generated `.slm` fetch.
- The smoke asserts the browser stays local-origin, reports `Model load failed` with `Module plan module plan adapter byte budget mismatch`, keeps model selection recoverable, and never requests `/models/multi-parent-sign-merge-q4.slm`.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-resource-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18700/app/ 19530 multi-parent-sign-merge-q4 module-plan-resource-drift`
- `cargo fmt --all -- --check`
- `cargo test --workspace`
- `git diff --check`

The live generated-root q4 drift smoke requested `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`, surfaced `Module plan module plan adapter byte budget mismatch`, left generation controls stopped with model selection still available, and did not request `/models/multi-parent-sign-merge-q4.slm`. Workspace tests passed with 249 checks. `git diff --check` returned clean status with line-ending notices only.

## Next Routing

The graph mismatch sibling is now covered by `browser-module-plan-graph-drift-memory-2026-06-27.md`. The next useful drift bead is a module-plan stack-member mismatch smoke: keep receipt checksum consistent but change one adapter stack field, then prove the browser stops before adapter artifact transfer.

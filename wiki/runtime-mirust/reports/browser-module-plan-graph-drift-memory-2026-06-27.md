---
title: Browser Module Plan Graph Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-graph-drift-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T20:20:05Z
---

# Browser Module Plan Graph Drift Memory

## Routing Summary

Use this report when work touches browser-smoke `module-plan-graph-drift`, generated `.module-plan.receipt` graph metadata, checksum-consistent route drift, or proof that generated `.slm` bytes are not fetched after module-plan graph mismatch.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-graph-drift` mode for generated multi-parent selector roots.
- The smoke intercepts the served selector registry and selected `.module-plan.receipt`, changes only the receipt `module.0.path` model graph line, recomputes the receipt checksum with the browser checksum algorithm, and patches only the matching `entry.N.module_plan_checksum`.
- The resource envelope and selector metadata remain aligned, so the browser proves the graph gate itself: checksum verification and budget checks pass, then `app.js` rejects the route mismatch before generated `.slm` fetch.
- The smoke asserts the browser stays local-origin, reports `Model load failed` with `Module plan field module.0.path was ...`, keeps model selection recoverable, and never requests `/models/multi-parent-sign-merge-q4.slm`.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-graph-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18702/app/ 19534 multi-parent-sign-merge-q4 module-plan-graph-drift`
- `cargo fmt --all -- --check`
- `cargo test --workspace`

The live generated-root q4 graph drift smoke requested `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`, surfaced `Module plan field module.0.path was ../models/multi-parent-sign-merge-q4-graph-drift.slm`, left generation controls stopped with model selection still available, and did not request `/models/multi-parent-sign-merge-q4.slm`. Workspace tests passed with 249 checks.

## Next Routing

The sibling stack-member proof now lives in `browser-module-plan-stack-drift-memory-2026-06-27.md`. The next useful route is positive module-plan stack display without JavaScript model or adapter payload parsing.

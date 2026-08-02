---
title: Browser Module Plan Role Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-role-drift-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T21:46:45Z
---

# Browser Module Plan Role Drift Memory

## Routing Summary

Use this report when work touches browser-smoke `module-plan-role-drift`, `.module-plan.receipt` role fields, checksum-consistent role mutation, or proof that generated model and adapter-stack bytes are not fetched after module-plan role mismatch.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-role-drift` mode for generated multi-parent selector roots.
- The smoke intercepts the served selector registry and selected `.module-plan.receipt`, changes only the receipt `module.4.role` line, recomputes the receipt checksum with the browser checksum algorithm, and patches only the matching `entry.N.module_plan_checksum`.
- The resource envelope, model graph, stack routes, and selector metadata remain aligned, so the browser proves the role gate itself: checksum verification, resource checks, graph checks, and stack route checks pass before `app.js` rejects the role mismatch.
- The smoke asserts the browser stays local-origin, reports `Model load failed` with `Module plan field module.4.role was adapter-stack-role-drift`, keeps model selection recoverable, never requests `/models/multi-parent-sign-merge-q4.slm`, and never requests the generated q4 stack adapter artifacts or their manifests.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-role-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18718/app/ 19550 multi-parent-sign-merge-q4 module-plan-role-drift`
- `cargo test --workspace`
- `git diff --check` passed with line-ending notes only.

The live generated-root q4 role drift smoke requested `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`, surfaced `Module plan field module.4.role was adapter-stack-role-drift`, left generation controls stopped with model selection still available, and did not request `/models/multi-parent-sign-merge-q4.slm`, `/models/multi-parent-sign-merge-q4-family.adp1`, `/models/multi-parent-sign-merge-q4-sparse.asp1`, or their adapter manifests. Workspace tests passed with 249 checks.

## Next Routing

The next useful constrained-browser bead is to let a small local planner consume verified Module Plan roles as typed assembly slots while preserving the pre-model-fetch receipt gate and keeping JavaScript out of model and adapter payload parsing.

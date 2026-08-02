---
title: Browser Module Plan Stack Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-stack-drift-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T20:20:05Z
---

# Browser Module Plan Stack Drift Memory

## Routing Summary

Use this report when work touches browser-smoke `module-plan-stack-drift`, generated `.module-plan.receipt` adapter-stack metadata, checksum-consistent stack route drift, or proof that generated model and adapter bytes are not fetched after module-plan stack mismatch.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-stack-drift` mode for generated multi-parent selector roots.
- The smoke intercepts the served selector registry and selected `.module-plan.receipt`, changes only the receipt `module.4.adapter_path` stack-member graph line, recomputes the receipt checksum with the browser checksum algorithm, and patches only the matching `entry.N.module_plan_checksum`.
- The resource envelope, model graph, and selector metadata remain aligned, so the browser proves the adapter-stack graph gate itself: checksum verification and budget checks pass, then `app.js` rejects the stack route mismatch before generated `.slm` fetch.
- The smoke asserts the browser stays local-origin, reports `Model load failed` with `Module plan field module.4.adapter_path was ...`, keeps model selection recoverable, never requests `/models/multi-parent-sign-merge-q4.slm`, and never requests the generated q4 stack adapter artifacts or their manifests.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-stack-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18704/app/ 19536 multi-parent-sign-merge-q4 module-plan-stack-drift`
- `cargo fmt --all -- --check`
- `cargo test --workspace`

The live generated-root q4 stack drift smoke requested `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`, surfaced `Module plan field module.4.adapter_path was ../models/multi-parent-sign-merge-q4-family-stack-drift.adp1`, left generation controls stopped with model selection still available, and did not request `/models/multi-parent-sign-merge-q4.slm`, `/models/multi-parent-sign-merge-q4-family.adp1`, `/models/multi-parent-sign-merge-q4-sparse.asp1`, or their adapter manifests. Workspace tests passed with 249 checks.

## Next Routing

The next useful constrained-browser bead is to move from drift proofs toward a positive module-plan stack receipt display: show the verified module graph and stack routes in the browser without expanding JavaScript into model or adapter parsing.

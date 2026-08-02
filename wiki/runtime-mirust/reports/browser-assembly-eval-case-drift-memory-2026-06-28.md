---
title: Browser Assembly Eval Case Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-assembly-eval-case-drift-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T04:30:00Z
---

# Browser Assembly Eval Case Drift Memory

## Summary

TinyRustLM now treats `eval_case_evidence_checksum` as an assembly gate for generated browser roots. A checksum-consistent generated assembly receipt whose eval-case digest differs from the selector registry value stops the load before evidence files, adapter-family receipts, adapter manifests, or adapter stack artifacts are requested.

The browser frees the already accepted model, marks Model State as `assembly evidence rejected`, leaves model selection available, disables generation controls, records Module Plan Trace through `assembly evidence rejected`, and keeps diagnostics at `model_loaded=false`.

## Implementation

- `tinyrustlm/app/app.js` now turns generated assembly receipt failure into a load failure state before adapter-family verification or generation.
- The browser calls `free_model` when available, clears loaded-context state, renders Assembly Evidence and Adapter Sidecar failure states, and leaves selector recovery available.
- `tinyrustlm/tools/browser-smoke.js` adds `assembly-eval-case-drift`.
- The smoke mutates only the generated assembly receipt `eval_case_evidence_checksum`, recomputes that assembly receipt checksum, updates the selector assembly checksum, updates the module-plan assembly checksum, and updates the selector module-plan checksum so the proof reaches the eval digest gate itself.
- The smoke asserts no assembly evidence routes, adapter-family receipt, adapter manifests, or adapter stack artifacts are requested after the digest mismatch.

## Verification

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/assembly-eval-case-drift/tinyrustlm all` regenerated a validated all-root.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9238 multi-parent-sign-merge-q4 assembly-eval-case-drift` passed with `runtimeStatus=Model load failed`, `modelState=assembly evidence rejected`, `assemblyState=assembly eval case evidence checksum mismatch`, `adapterState=assembly evidence rejected`, and `model_loaded=false`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9237 multi-parent-sign-merge-q4 combined-selector-assembly` passed after refreshing generated all-root module-plan byte and checksum expectations.

## Routing Notes

Use this page before changing generated assembly receipt eval fields, selector registry eval digest matching, `loadAssemblyReceipt`, Module Plan Trace failure checkpoints, or browser smoke assertions around generated assembly proof. Pair it with Browser Eval Case Evidence Checksum Memory for the positive digest route and Browser Assembly Trace Memory for ready-state sequencing.

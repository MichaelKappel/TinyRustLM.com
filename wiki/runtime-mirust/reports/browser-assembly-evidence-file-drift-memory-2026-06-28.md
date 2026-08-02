---
title: Browser Assembly Evidence File Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-assembly-evidence-file-drift-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T05:30:00Z
---

# Browser Assembly Evidence File Drift Memory

## Summary

TinyRustLM now has a browser smoke proof for fetched assembly evidence-file drift. The generated selector registry, module-plan receipt, model bytes, model manifest, and assembly receipt remain checksum-valid; the smoke mutates only the first served evidence file body and proves the browser rejects assembly before adapter-family receipts, adapter manifests, or adapter stack artifacts are requested.

The browser frees the already accepted generated model, marks Model State as `assembly evidence rejected`, leaves the model selector available, disables generation controls, records Module Plan Trace through `assembly evidence rejected`, and keeps diagnostics at `model_loaded=false`.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `assembly-evidence-file-drift`.
- The smoke selects generated `multi-parent-sign-merge-q4` by default.
- The Fetch interceptor mutates only `/evidence/multi-parent-sign-merge-q4/population.ledger` in flight, leaving selector, module-plan, assembly receipt, model, and manifest routes untouched.
- The assertion requires the first evidence route to be requested, rejects later evidence routes, and rejects adapter-family receipt, adapter manifest, and adapter stack route requests.
- The smoke also refreshes generated-root module-plan byte and checksum expectations for current ADP1 plus ASP1 plus ALR1 all-root receipts.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 checks.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/assembly-evidence-file-drift/tinyrustlm all` regenerated a validated all-root with 3 admissions, 3 module-plan routes, 3 assembly routes, 3 adapter-family routes, and 12 adapter routes.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18732/app/ 19570 multi-parent-sign-merge-q4 assembly-evidence-file-drift` passed with `runtimeStatus=Model load failed`, `modelState=assembly evidence rejected`, `assemblyState=assembly evidence promotion_ledger_path checksum mismatch`, `adapterState=assembly evidence rejected`, `model_loaded=false`, and network requests ending at `/evidence/multi-parent-sign-merge-q4/population.ledger`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18732/app/ 19574 multi-parent-sign-merge-q4 adapter-sidecar-registry-file` passed after refreshing generated q4 module-plan byte/checksum expectations and proved the normal path still fetches all evidence files, verifies the adapter-family receipt, and applies the family ADP1 plus sparse ASP1 plus low-rank ALR1 stack before generation.

## Routing Notes

Use this page before changing assembly evidence-file fetching, `verifyAssemblyEvidenceFiles`, receipt evidence path/checksum fields, generated evidence routes, or browser smoke assertions around evidence-file integrity. Pair it with Browser Assembly Eval Case Drift Memory for the pre-evidence digest gate and Browser Assembly Trace Memory for failure and ready checkpoint sequencing.

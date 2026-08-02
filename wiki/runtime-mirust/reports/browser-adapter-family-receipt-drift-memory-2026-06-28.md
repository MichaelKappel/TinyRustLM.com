---
title: Browser Adapter Family Receipt Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-adapter-family-receipt-drift-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T06:35:00Z
---

# Browser Adapter Family Receipt Drift Memory

## Summary

TinyRustLM now has a browser smoke proof for generated adapter-family receipt drift after assembly evidence has already passed. The generated selector registry, module-plan receipt, model bytes, model manifest, assembly receipt, and every assembly evidence file remain valid; the smoke mutates only the served adapter-family receipt text while preserving its byte count.

The browser keeps the generated q4_0 model loaded, records `adapter family receipt checksum mismatch`, leaves generation available, disables adapter controls, and stops before adapter manifests or ADP1/ASP1/ALR1 stack artifacts are requested.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `adapter-family-receipt-drift`.
- The Fetch interceptor mutates the served `/models/multi-parent-sign-merge-q4.adapter-family.receipt` candidate id in flight without changing the receipt byte count.
- The assertion requires selector, module-plan, model, manifest, assembly receipt, and all assembly evidence-file routes to be requested first.
- The assertion requires the adapter-family receipt route to be requested and rejects adapter manifest, family ADP1, sparse ASP1, and low-rank ALR1 artifact requests afterward.
- The smoke distinguishes this boundary from assembly rejection: diagnostics keep `model_loaded=true`, Module Plan Trace reaches `assembly evidence verified`, and it does not reach `adapter family verified` or `ready`.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/adapter-family-receipt-drift/tinyrustlm all` regenerated a validated all-root with 3 admissions, 3 module-plan routes, 3 assembly routes, 3 adapter-family routes, and 12 adapter routes.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18747/app/ 19599 multi-parent-sign-merge-q4 adapter-family-receipt-drift` passed with `runtimeStatus=Ready`, `modelState=loaded`, `assemblyState=loaded`, `adapterState=adapter family receipt checksum mismatch`, `model_loaded=true`, Module Plan Trace through `assembly evidence verified`, and network requests ending at the adapter-family receipt route.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18747/app/ 19600 multi-parent-sign-merge-q4 adapter-sidecar-registry-file` passed on the paired normal generated root, proving the valid path still reaches `ready` and applies family ADP1 plus sparse ASP1 plus low-rank ALR1 before generation.

## Routing Notes

Use this page before changing `loadAdapterFamilyReceipt`, adapter-family receipt checksum handling, adapter-family receipt route assertions, generated adapter-family manifests, or browser auto-assembly sequencing after assembly evidence has passed. Pair it with Browser Assembly Evidence File Drift Memory for the previous evidence-file gate and Browser Adapter Stack Memory for the valid ADP1/ASP1/ALR1 stack path.

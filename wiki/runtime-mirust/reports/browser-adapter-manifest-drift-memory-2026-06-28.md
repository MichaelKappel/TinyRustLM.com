---
title: Browser Adapter Manifest Drift Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-adapter-manifest-drift-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T06:55:00Z
---

# Browser Adapter Manifest Drift Memory

## Summary

TinyRustLM now has a browser smoke proof for generated adapter manifest drift after the selector registry, module-plan receipt, model bytes, model manifest, assembly receipt, all assembly evidence files, adapter-family receipt, and the first self-adapter manifest have already passed.

The smoke mutates only the served family ADP1 manifest text at the same byte count. The browser keeps the generated q4_0 model loaded, records `adapter 1 manifest checksum mismatch`, leaves generation available, disables adapter controls, and stops before sparse or low-rank adapter manifests or ADP1/ASP1/ALR1 stack artifacts are requested.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `adapter-manifest-drift`.
- The Fetch interceptor mutates `/models/multi-parent-sign-merge-q4-family.adp1.manifest` in flight by changing `adapter_status=artifact-written` to an equal-length drifted status string.
- The assertion requires selector, module-plan, model, manifest, assembly receipt, all assembly evidence files, adapter-family receipt, self adapter manifest, and the drifted family adapter manifest routes to be requested first.
- The assertion rejects later sparse and low-rank manifest requests plus all ADP1, ASP1, and ALR1 stack artifact requests afterward.
- The smoke distinguishes this boundary from receipt drift: diagnostics keep `model_loaded=true`, Module Plan Trace reaches `assembly evidence verified`, and it does not reach `adapter family verified` or `ready`.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18748/app/ 19601 multi-parent-sign-merge-q4 adapter-manifest-drift` passed with `runtimeStatus=Ready`, `modelState=loaded`, `assemblyState=loaded`, `adapterState=adapter 1 manifest checksum mismatch`, `model_loaded=true`, Module Plan Trace through `assembly evidence verified`, and network requests ending at the family ADP1 manifest.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18748/app/ 19602 multi-parent-sign-merge-q4 adapter-sidecar-registry-file` passed on the same generated root, proving the valid path still reaches `ready` and applies family ADP1 plus sparse ASP1 plus low-rank ALR1 before generation.
- `cargo test -p tinyrustlm-browser-harness` passed with 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 9 static checks.

## Routing Notes

Use this page before changing `validateAdapterManifest`, adapter manifest checksum handling, generated adapter-family manifest routes, or browser auto-assembly sequencing after the adapter-family receipt has passed. Pair it with Browser Adapter Family Receipt Drift Memory for the previous receipt gate and Browser Adapter Stack Memory for the valid ADP1/ASP1/ALR1 stack path.

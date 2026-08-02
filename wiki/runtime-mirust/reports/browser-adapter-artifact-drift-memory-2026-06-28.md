---
title: Browser Adapter Artifact Drift Memory 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-adapter-artifact-drift-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T07:20:00Z
---

# Browser Adapter Artifact Drift Memory

TinyRustLM now has a browser smoke proof for generated adapter stack artifact drift after selector, module plan, model bytes, model manifest, assembly receipt, assembly evidence files, adapter-family receipt, and all adapter manifests have passed.

The smoke flips one byte in the first generated family ADP1 stack artifact while serving the same route and byte count. Browser state records `adapter artifact checksum mismatch`, keeps the q4_0 model loaded, leaves generation and adapter controls available, keeps Step Token disabled before generation context, and stops before sparse ASP1, low-rank ALR1, or any `apply_adapter_delta` call.

## Implementation Shape

- `tinyrustlm/tools/browser-smoke.js` adds `adapter-artifact-drift` as a generated q4 default smoke mode.
- The Fetch interceptor targets the exact stack artifact pathname, not manifest paths, then fulfills the request with a same-length binary body whose final byte is changed.
- The assertion requires Module Plan Trace to reach `adapter family verified` and not reach `adapter stack applied` or `ready`.
- The assertion requires selector, module-plan, model, model manifest, assembly receipt, all assembly evidence, adapter-family receipt, and all adapter manifest routes before the drifted artifact request.
- The assertion requires only the first stack artifact route after manifests, with no later sparse or low-rank artifact route and no non-local request.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18749/app/ 19606 multi-parent-sign-merge-q4 adapter-artifact-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18749/app/ 19607 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`

The paired normal smoke proved the same generated q4 root still reaches `Ready`, auto-applies ADP1 plus ASP1 plus ALR1 before generation, renders the full Module Plan Trace through `ready`, and generates the deterministic local `e` response.

## Routing

Load this report before changing generated adapter stack artifact fetches, adapter artifact checksum matching, `applyAdapterByIndex`, `verifyAdapterArtifactBytes`, adapter auto-assembly ordering, or browser smoke assertions for `adapter-artifact-drift`.

Use it with:

- `browser-adapter-manifest-drift-memory-2026-06-28.md`
- `browser-adapter-family-receipt-drift-memory-2026-06-28.md`
- `browser-assembly-evidence-file-drift-memory-2026-06-28.md`
- `browser-assembly-trace-memory-2026-06-28.md`
- `adapter-family-receipt-memory-2026-06-27.md`
- `browser-adapter-stack-memory-2026-06-27.md`

## Next Route

The verified chain now covers generated-root drift gates from module plan, assembly eval digest, fetched evidence files, adapter-family receipt, adapter manifest, and adapter artifact bytes. The next useful assembly bead is trained adapter or real trained-weight routing that still feeds the same receipts, manifests, eval sidecars, and browser proof graph.

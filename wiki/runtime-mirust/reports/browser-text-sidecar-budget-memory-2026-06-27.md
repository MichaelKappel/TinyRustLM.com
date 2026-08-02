---
title: Browser Text Sidecar Budget Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-text-sidecar-budget-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T17:18:16Z
---

# Browser Text Sidecar Budget Memory

## Summary

TinyRustLM now applies explicit browser-local byte envelopes to text sidecars before parsing them in JavaScript. Selector registries are capped at 256 KiB, `.slm` and adapter manifests at 64 KiB, assembly and adapter-family receipts at 128 KiB, and assembly evidence files at 128 KiB. The browser fetches each text sidecar as bytes, checks the length, and decodes only after the sidecar fits its local envelope.

## Implementation Memory

- `tinyrustlm/app/app.js` adds sidecar text budgets for selector registries, manifests, receipts, and evidence files.
- `fetchTextWithinBudget` centralizes the browser fetch/decode path so text files are checked as bytes before `parseManifest` or checksum validation.
- Selector registry loading, `.slm` manifest loading, assembly receipt loading, assembly evidence verification, adapter-family receipt loading, and generated adapter manifest loading now use the bounded text path.
- Binary `.slm`, ADP1, and ASP1 artifacts keep their existing byte checks and WASM transfer path; this bead only bounds text sidecars.
- Oversized generated adapter manifests stop generated adapter-family options before any adapter artifact request or `apply_adapter_delta` call.
- `tinyrustlm/tools/browser-smoke.js` adds `adapter-manifest-budget`, which intercepts a generated sparse ASP1 manifest with 64 KiB plus one byte and verifies the browser keeps the model ready while leaving generated adapter controls disabled.
- The smoke harness now checks adapter artifact requests by exact URL path so a `.manifest` route cannot satisfy an artifact-route assertion by prefix overlap.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `browser-multi-parent-bundle target/browser-text-sidecar-budget/tinyrustlm all` generated a combined f32/q8_0/q4_0 selector root for browser proof.
- Served-root `adapter-sidecar-registry-file` smoke passed on `http://127.0.0.1:18686/app/` for `multi-parent-sign-merge-q4`; it loaded the q4 generated model, verified assembly evidence, auto-applied the receipt-preferred sparse ASP1, and generated `e`.
- Served-root `adapter-manifest-budget` smoke passed on `http://127.0.0.1:18686/app/` for `multi-parent-sign-merge-q4`; it loaded the model and assembly evidence, reported `Adapter manifest byte budget exceeded`, kept Generate enabled, left generated adapter controls disabled, and did not request the exact sparse ASP1 artifact route.
- `cargo test --workspace` passed with 243 checks across runtime, packer, browser harness, local server, and doc-tests.

## Routing Notes

Use this report before changing browser text-sidecar fetches, selector.registry intake, `.slm` or adapter manifest parsing, assembly receipt or evidence-file verification, adapter-family receipt verification, generated adapter-family option enablement, or the smoke assertions around oversized sidecar text.

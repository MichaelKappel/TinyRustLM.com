---
title: Browser Selector Species Fit Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-species-fit-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T22:55:00Z
---

# Browser Selector Species Fit Memory

## Routing Summary

Generated selector registries now carry the ModelBreeder speciation-fit lane beside genome and fitness evidence. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.species_id`, `entry.N.species_strategy=selector-speciation-fit-v1`, `entry.N.species_fit_status=browser-fit-bound`, and `entry.N.species_fit_checksum`.
- Species ids group candidates by browser-relevant family traits: model shape, quantization, output contract, and max-token envelope.
- Species-fit checksums bind the candidate to selector text budgets, model bytes, quantization, max tokens, and the module-plan resource envelope when a module plan is present.
- The browser rejects registry entries missing species-fit metadata, then renders a compact `Species` row in Model Provenance as `browser-fit-bound / <species-id> / <fit-checksum>`.
- Browser smoke now asserts generated registry-backed q4_0, q8_0, and f32 entries display valid Genome, Species, Fitness, eval case, and eval checksum rows.

## Verification Memory

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack`
- Fresh generated `browser-multi-parent-bundle .\target\browser-served-multi-parent-all\tinyrustlm all`
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8096/app/`, proving q4_0/q8_0/f32 generated entries show `browser-fit-bound / <species-id> / <fit-checksum>` while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

## Research Route

This implements the speciation-fit lane from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md`. Future novelty or population fields should follow the same pattern: add deterministic selector/admission/review fields first, add drift tests, then render only compact provenance summaries in the browser.

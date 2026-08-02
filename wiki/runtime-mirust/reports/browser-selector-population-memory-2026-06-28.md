---
title: Browser Selector Population Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-population-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T23:58:00Z
---

# Browser Selector Population Memory

## Routing Summary

Generated selector registries now carry the ModelBreeder population lane beside genome, species, novelty, and fitness evidence. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for registry generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser intake and rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.population_id`, `entry.N.population_strategy=selector-population-review-route-v1`, `entry.N.population_status=population-review-bound`, and `entry.N.population_checksum`.
- Population ids hash the selector-visible population lane from species id, novelty id, scoped fitness checksum, quality scope, eval dataset, and quantization.
- Population checksums bind that lane to genome lineage, species fit, novelty, fitness, and the assembly/module-plan route context when those routes are present.
- The browser rejects registry entries missing population metadata, then renders a compact `Population` row in Model Provenance as `population-review-bound / <population-id> / <population-checksum>`.
- Browser smoke now asserts generated registry-backed q4_0, q8_0, and f32 entries display valid Genome, Species, Novelty, Population, Fitness, eval case, and eval checksum rows.

## Verification Memory

- `C:\Users\AI\.cargo\bin\cargo.exe fmt`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector` with 49 selector-filtered tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle` with 4 tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness` with 6 tests passed.
- Fresh generated `browser-multi-parent-bundle target\browser-served-multi-parent-all\tinyrustlm all`, with selector registry validation passing for 3 admissions, 12 adapter routes, 3 adapter-family routes, 3 assembly routes, and 3 module-plan routes.
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8097/app/` with debugger port `19566`, proving q4_0, q8_0, and f32 generated entries show `population-review-bound / <population-id> / <population-checksum>` while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

No coverage tool is active in the no-third-party workspace, so focused syntax, Rust tests, generated-root, and browser-smoke evidence is the recorded coverage evidence for this bead.

## Research Route

This implements the population lane from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md`. Future population work can deepen this from compact selector-route identity toward explicit population-review route fields only after the browser and Rust validators have deterministic drift tests for every added field.

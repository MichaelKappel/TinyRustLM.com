---
title: Browser Selector Phenotype Evidence Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-phenotype-evidence-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T17:21:00Z
---

# Browser Selector Phenotype Evidence Memory

## Routing Summary

Generated selector registries now carry the ModelBreeder phenotype-evidence lane beside genome, species, novelty, population, mate-selection, and fitness evidence. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for registry generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser intake and rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.phenotype_evidence_id`, `entry.N.phenotype_evidence_strategy=selector-phenotype-evidence-v1`, `entry.N.phenotype_evidence_status=runtime-eval-bound`, and `entry.N.phenotype_evidence_checksum`.
- The selector also emits `entry.N.provenance_manifest_checksum`, so phenotype evidence can bind the model manifest route with runtime-smoke, eval-manifest, eval-case, assembly receipt, mate-selection, and fitness-vector evidence.
- Phenotype evidence ids hash candidate id, mate-selection id, quality scope, eval dataset, passed case count, and eval-case evidence checksum.
- Phenotype evidence checksums bind that id to provenance, runtime, eval, eval-case, quality-boundary, fitness, mate-selection, and assembly receipt state.
- The browser rejects registry entries missing phenotype-evidence metadata, then renders a compact `Phenotype` row in Model Provenance as `<status> / <phenotype-evidence-id> / <phenotype-evidence-checksum>`.
- Browser smoke asserts generated registry-backed q4_0, q8_0, and f32 entries display `runtime-eval-bound / <phenotype-evidence-id> / <phenotype-evidence-checksum>` while keeping source-root fallback rows unavailable.

## Verification Memory

- `C:\Users\AI\.cargo\bin\cargo.exe fmt`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector` with 52 selector-filtered tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle` with 4 tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness` with 6 tests passed.
- Fresh generated `browser-multi-parent-bundle target\browser-served-phenotype-evidence\tinyrustlm all`, with selector registry validation passing for 3 admissions, 12 adapter routes, 3 adapter-family routes, 3 assembly routes, and 3 module-plan routes.
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8099/app/` with debugger port `19570`, proving q4_0, q8_0, and f32 generated entries show `runtime-eval-bound / <phenotype-evidence-id> / <phenotype-evidence-checksum>` while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

No coverage tool is active in the no-third-party workspace, so focused syntax, Rust tests, generated-root, and browser-smoke evidence is the recorded coverage evidence for this bead.

## Research Route

This implements the phenotype-evidence lane from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md` by turning runtime-smoke and eval observations into selector-visible provenance metadata. Future work can deepen this into richer phenotype summaries only after Rust validators and browser smokes cover every added selector field.

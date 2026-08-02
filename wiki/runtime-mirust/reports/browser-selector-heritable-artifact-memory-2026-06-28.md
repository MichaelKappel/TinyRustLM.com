---
title: Browser Selector Heritable Artifact Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-heritable-artifact-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T17:44:00Z
---

# Browser Selector Heritable Artifact Memory

## Routing Summary

Generated selector registries now carry the ModelBreeder heritable-artifact lane beside genome, species, novelty, population, mate-selection, phenotype evidence, and fitness evidence. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for registry generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser intake and rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.heritable_artifact_id`, `entry.N.heritable_artifact_strategy=selector-heritable-artifact-v1`, `entry.N.heritable_artifact_status=served-artifact-bound`, and `entry.N.heritable_artifact_checksum`.
- Heritable artifact ids hash candidate id, source artifact path, served model path, manifest path, model bytes, SLM checksum, model shape, quantization, output contract, and genome id.
- Heritable artifact checksums bind that id to genome lineage, phenotype evidence, fitness vector, provenance manifest, runtime-smoke manifest, adapter-family receipt state, assembly receipt state, and module-plan receipt state.
- The browser rejects registry entries missing heritable-artifact metadata, then renders a compact `Artifact` row in Model Provenance as `<status> / <heritable-artifact-id> / <heritable-artifact-checksum>`.
- Browser smoke asserts generated registry-backed q4_0, q8_0, and f32 entries display `served-artifact-bound / <heritable-artifact-id> / <heritable-artifact-checksum>` while keeping source-root fallback rows unavailable.
- Exact generated module-plan checksum baselines were refreshed because the selector-linked provenance and receipt text changed while byte totals stayed `103780 bytes` for q4_0, `106020 bytes` for q8_0, and `117554 bytes` for f32.

## Verification Memory

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector` with 53 selector-filtered tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle` with 4 tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness` with 6 tests passed.
- Fresh generated `browser-multi-parent-bundle target\browser-served-heritable-artifact\tinyrustlm all`, with selector registry validation passing for 3 admissions, 12 adapter routes, 3 adapter-family routes, 3 assembly routes, and 3 module-plan routes.
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8100/app/` with debugger port `19572`, proving q4_0, q8_0, and f32 generated entries show `served-artifact-bound / <heritable-artifact-id> / <heritable-artifact-checksum>` while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

No coverage tool is active in the no-third-party workspace, so focused syntax, Rust tests, generated-root, and browser-smoke evidence is the recorded coverage evidence for this bead.

## Research Route

This implements the heritable-artifact lane from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md` by turning served artifact identity into selector-visible provenance metadata. Future work can deepen this into richer artifact inheritance records only after Rust validators and browser smokes cover every added selector field.

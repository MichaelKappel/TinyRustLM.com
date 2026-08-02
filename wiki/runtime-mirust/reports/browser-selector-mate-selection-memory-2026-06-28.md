---
title: Browser Selector Mate Selection Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-mate-selection-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T23:59:00Z
---

# Browser Selector Mate Selection Memory

## Routing Summary

Generated selector registries now carry the ModelBreeder mate-selection lane beside genome, species, novelty, population, and fitness evidence. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for registry generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser intake and rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.mate_selection_id`, `entry.N.mate_selection_strategy=selector-mate-selection-route-v1`, `entry.N.mate_selection_status`, `entry.N.mate_selection_parent_count`, and `entry.N.mate_selection_checksum`.
- Multi-parent sign-merge admissions render mate selection as `parent-pool-bound` with the reviewed `parent_count`; ordinary selector admissions render `admission-only` with parent count `1`.
- Mate-selection ids hash candidate id, admission kind, population id, parent-pool recipe checksum when present, and parent count.
- Mate-selection checksums bind that id to population checksum, parent-pool recipe checksum, sign-merge operator receipt checksum, population-review checksum, promotion-ledger checksum, admission-set checksum, and admission checksum.
- The browser rejects registry entries missing mate-selection metadata, then renders a compact `Mate Selection` row in Model Provenance as `<status> / <parent-count> parents / <mate-selection-id> / <mate-selection-checksum>`.
- Browser smoke asserts generated registry-backed q4_0, q8_0, and f32 entries display `parent-pool-bound / 3 parents / <mate-selection-id> / <mate-selection-checksum>` while keeping source-root fallback rows unavailable.

## Verification Memory

- `C:\Users\AI\.cargo\bin\cargo.exe fmt`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector` with 51 selector-filtered tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle` with 4 tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness` with 6 tests passed.
- Fresh generated `browser-multi-parent-bundle target\browser-served-mate-selection\tinyrustlm all`, with selector registry validation passing for 3 admissions, 12 adapter routes, 3 adapter-family routes, 3 assembly routes, and 3 module-plan routes.
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8098/app/` with debugger port `19568`, proving q4_0, q8_0, and f32 generated entries show `parent-pool-bound / 3 parents / <mate-selection-id> / <mate-selection-checksum>` while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

No coverage tool is active in the no-third-party workspace, so focused syntax, Rust tests, generated-root, and browser-smoke evidence is the recorded coverage evidence for this bead.

## Research Route

This implements the mate-selection lane from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md` and the parent-pool route from `wiki/runtime-mirust/research/model-breeding-reference-ideas-2026-06-26.md`. Future work can deepen this into richer parent relatedness display only after Rust validators and browser smokes cover every added selector field.

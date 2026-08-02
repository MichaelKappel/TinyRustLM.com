---
title: Browser Selector Novelty Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-novelty-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T23:35:00Z
---

# Browser Selector Novelty Memory

## Routing Summary

Generated selector registries now carry the ModelBreeder novelty lane beside genome, species, and fitness evidence. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for registry generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser intake and rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.novelty_id`, `entry.N.novelty_strategy=selector-novelty-sketch-v1`, `entry.N.novelty_status=behavior-sketch-bound`, and `entry.N.novelty_checksum`.
- Novelty ids hash browser-visible behavior descriptors: species id, quality scope, eval dataset, output contract, quantization, and max-token envelope.
- Novelty checksums bind the descriptor to concrete eval evidence plus assembly, adapter-family, and module-plan routes when those routes are present.
- The browser rejects registry entries missing novelty metadata, then renders a compact `Novelty` row in Model Provenance as `behavior-sketch-bound / <novelty-id> / <novelty-checksum>`.
- Browser smoke now asserts generated registry-backed q4_0, q8_0, and f32 entries display valid Genome, Species, Novelty, Fitness, eval case, and eval checksum rows.

## Verification Memory

- `cargo fmt`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack`
- Fresh generated `browser-multi-parent-bundle .\target\browser-served-multi-parent-all\tinyrustlm all`
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8096/app/` with debugger port `19564`, proving q4_0, q8_0, and f32 generated entries show `behavior-sketch-bound / <novelty-id> / <novelty-checksum>` while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

No coverage tool is active in the no-third-party workspace, so focused syntax, Rust tests, generated-root, and browser-smoke evidence is the recorded coverage evidence for this bead.

## Research Route

This implements the novelty lane from `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md`. Future population fields should follow the same pattern: add deterministic selector/admission/review fields first, add drift tests, then render only compact provenance summaries in the browser.

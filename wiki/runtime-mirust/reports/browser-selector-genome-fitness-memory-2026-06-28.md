---
title: Browser Selector Genome Fitness Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-genome-fitness-memory-2026-06-28/
status: reviewed
reviewed_utc: 2026-06-28T22:40:00Z
---

# Browser Selector Genome Fitness Memory

## Routing Summary

Generated selector registries now carry ModelBreeder-inspired genome and fitness routing fields without changing the quality authority of the tiny fixtures. Open `tinyrustlm/tools/slm_pack/src/selector.rs` for generation and validation, `tinyrustlm/app/app.js` plus `tinyrustlm/app/index.html` for browser rendering, and `tinyrustlm/tools/browser-smoke.js` for served-root proof.

## Implementation Memory

- `selector.registry` entries emit `entry.N.genome_id`, `entry.N.genome_strategy=selector-admission-genome-v1`, `entry.N.genome_lineage_status=admission-bound`, `entry.N.genome_lineage_checksum`, `entry.N.fitness_vector_status=eval-bound`, and `entry.N.fitness_vector_checksum`.
- Genome ids are deterministic checksums over the candidate id, model shape, quantization, output contract, and `.slm` checksum.
- Genome lineage checksums summarize admission, promotion, runtime-smoke, and eval manifest checksums.
- Fitness vector checksums summarize scoped eval facts: quality scope, quality boundary, eval dataset, cases passed, and eval-case evidence checksum.
- The browser rejects generated selector entries missing the genome/fitness fields, then renders compact `Genome` and `Fitness` rows in Model Provenance for registry-backed entries.

## Verification Memory

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack`
- Fresh generated `browser-multi-parent-bundle .\target\browser-served-modelbreeder\tinyrustlm all`
- Served-root smoke: `combined-selector-assembly` on `http://127.0.0.1:8096/app/`, proving q4_0/q8_0/f32 generated entries show hex genome ids and `eval-bound / <hex>` fitness vectors while still loading module plans, assembly receipts, evidence files, adapter-family receipts, adapter manifests, and ADP1/ASP1/ALR1 stacks locally.

## Next Route

Future genome/fitness extensions should stay receipt-driven: add novelty, population, or speciation fields first to typed selector/admission/review sidecars, then render only the bounded summary needed for browser provenance.

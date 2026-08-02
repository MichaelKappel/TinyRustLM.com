---
title: Crossover Operator Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/crossover-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T17:25:00Z
---

# Crossover Operator Memory

TinyRustLM now has an offline deterministic direct-parameter crossover operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/crossover.rs` adds `crossover-candidate` and `validate-crossover-candidate` support for compatible two-parent `.slm` files.
- The operator selects each tensor element from parent 0 or parent 1 using `crossover_seed` plus `crossover_parent0_keep_ppm`; the receipt records total parameter count, per-parent selection counts, density in parts-per-million, and `crossover_mask_checksum`.
- Validation recomputes lineage, parent compatibility checks, candidate bytes, and the entire operator receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and help text.
- `tinyrustlm/tools/browser-smoke.js` now has a `crossover-operator-registry` fixture that proves browser Model Provenance renders a receipt-bound crossover operator row, plus `crossover-operator-receipt-drift` for browser byte-echo fallback.
- `tinyrustlm/README.md` routes the crossover browser smoke commands beside the other compact operator provenance examples.

## Receipt Fields

- `tinyrustlm_crossover_operator_version=1`
- `operator_kind=deterministic-direct-parameter-crossover`
- `crossover_seed=<u64>`
- `crossover_parent0_keep_unit=parts-per-million`
- `crossover_parent0_keep_ppm=<0..1000000>`
- `crossover_parent1_keep_ppm=<1000000-parent0>`
- `crossover_selection_metric=splitmix64-tensor-element-threshold`
- `crossover_selection_scope=compatible-parent-tensor-values`
- `crossover_tie_break=parent0-when-threshold-equal`
- `crossover_total_parameter_count`, `crossover_parent0_parameter_count`, `crossover_parent1_parameter_count`
- `crossover_parent0_density_ppm`, `crossover_parent1_density_ppm`
- `crossover_mask_checksum`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml crossover -- --nocapture` passed with 9 crossover tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml -- --nocapture` passed with 241 tests.
- CLI smoke wrote `target/crossover-cli/same-parent.compat`.
- CLI smoke wrote `target/crossover-cli/same-parent.lineage`.
- CLI smoke wrote `target/crossover-cli/same-parent-crossover.slm` and `target/crossover-cli/same-parent-crossover.operator` with explicit seed `77` and keep `500000`.
- CLI smoke validated the crossover candidate and receipt with `validate-crossover-candidate`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8128/app/ 9420 tinylm16-crossover-q8 crossover-operator-registry` passed, rendering `receipt-bound / deterministic-direct-parameter-crossover / 0x00000000000000b2`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8128/app/ 9421 tinylm16q8 crossover-operator-receipt-drift` passed, dropping the drifted crossover registry entry and returning to static q8 with operator provenance unavailable.
- Regression smokes for the shared compact fixture passed on `http://127.0.0.1:8128/app/`: federated `multi-parent-registry`, prune `prune-operator-registry`, and prune `prune-operator-receipt-drift`.
- `node --check tinyrustlm\tools\browser-smoke.js` passed after the crossover browser fixture update.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, the full `slm_pack` suite, formatting, the CLI write/validate smoke, and the browser provenance/drift smokes.

## Test Coverage Notes

- `crossover_seed` is covered by seed-different candidate and mask checksum tests.
- `crossover_parent0_keep_ppm` is covered by zero, full, partial, default, and invalid parse tests.
- Parent path inputs are covered by path-level write/validate and compatibility-bound checksum drift rejection.
- Candidate and receipt paths are covered by path-level write/validate, recompute validation, and candidate drift rejection.
- Browser operator receipt routing is covered by crossover positive provenance rendering and crossover byte-echo fallback smokes, plus federated and prune fixture regression smokes through the same compact registry fixture.
- Quantization route behavior is covered by q8 candidate validation.

## Routing

Open this report before changing `crossover.rs`, `crossover-candidate`, `validate-crossover-candidate`, deterministic selection masks, crossover receipt fields, crossover browser operator provenance, or crossover parameter validation.

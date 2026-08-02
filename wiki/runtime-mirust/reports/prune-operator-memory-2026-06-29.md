---
title: Prune Operator Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/prune-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T23:10:00Z
---

# Prune Operator Memory

TinyRustLM now has an offline deterministic magnitude-pruning operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/prune.rs` adds `prune-candidate` and `validate-prune-candidate` support for compatible two-parent `.slm` files.
- Parent 0 is the base layout and output contract; parent 1 is the compatible reference parent used for magnitude-ranking context.
- The operator ranks compatible tensor values by `max(abs(base), abs(reference))`, keeps the strongest base values by `keep_ppm`, applies an optional `floor_ppm`, zeros unkept values, and writes a normal `.slm` candidate in the base parent's dtype/layout.
- The receipt records requested keep count, kept/pruned/changed counts, keep density, max-magnitude bits, floor-threshold bits, `prune_mask_checksum`, and `prune_output_value_checksum`.
- Validation recomputes lineage, parent compatibility checks, candidate bytes, and the entire operator receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and usage line.
- `tinyrustlm/tools/slm_pack/src/selector.rs` now has explicit prune receipt carry-forward and receipt-kind drift tests for selector registry handoff.
- `tinyrustlm/tools/browser-smoke.js` now has a `prune-operator-registry` fixture that proves browser Model Provenance renders a receipt-bound prune operator row, plus `prune-operator-receipt-drift` for browser byte-echo fallback.
- `tinyrustlm/README.md` routes the prune browser smoke commands beside the existing selector-operator receipt smoke examples.

## Receipt Fields

- `tinyrustlm_prune_operator_version=1`
- `operator_kind=deterministic-magnitude-parameter-pruning`
- `base_parent_index=0`
- `reference_parent_index=1`
- `prune_keep_unit=parts-per-million`
- `prune_keep_ppm=<0..1000000>`
- `prune_floor_unit=parts-per-million-of-max-parent-magnitude`
- `prune_floor_ppm=<0..1000000>`
- `prune_selection_metric=largest-compatible-magnitude-with-floor`
- `prune_selection_scope=compatible-base-tensor-values`
- `prune_tie_break=lower-tensor-index-then-lower-element-index`
- `prune_value_source=base-parent-kept-values-else-zero`
- `prune_total_parameter_count`, `prune_requested_keep_count`, `prune_kept_parameter_count`, `prune_pruned_parameter_count`, `prune_changed_parameter_count`
- `prune_keep_density_ppm`
- `prune_max_magnitude_bits`
- `prune_floor_threshold_bits`
- `prune_mask_checksum`
- `prune_output_value_checksum`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack prune -- --nocapture` passed with 12 prune-filtered tests, including the selector handoff tests whose names include prune.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests:: -- --nocapture` passed with 88 selector tests, including prune receipt-bound admission carry-forward and prune operator-kind drift rejection.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack --quiet` passed with 305 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace --quiet` passed.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8126/app/ 9410 tinylm16-prune-q8 prune-operator-registry` passed, rendering `receipt-bound / deterministic-magnitude-parameter-pruning / 0x00000000000000b1`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8126/app/ 9411 tinylm16q8 prune-operator-receipt-drift` passed, dropping the drifted prune registry entry and returning to static q8 with operator provenance unavailable.
- Regression smokes for the existing federated compact fixture passed on `http://127.0.0.1:8127/app/`: `multi-parent-registry` rendered `federated-local-update-average`, and `selector-operator-receipt-drift` still fell back to static q8.
- `node --check tinyrustlm\tools\browser-smoke.js`, `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`, and `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness --quiet` passed after the prune browser fixture update.
- CLI smoke wrote `target/prune-cli/tinylm16-q8-self.compat`.
- CLI smoke wrote `target/prune-cli/tinylm16-q8-prune.lineage`.
- CLI smoke wrote `target/prune-cli/tinylm16-q8-prune.slm` and `target/prune-cli/tinylm16-q8-prune.operator` with keep `750000` and floor `0`.
- CLI smoke validated the prune candidate and receipt with `validate-prune-candidate`.
- CLI smoke validated the resulting `.slm` with `validate`; the candidate stayed q8_0 and 17,160,000 bytes.
- `git diff --check` passed with line-ending normalization notices only.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, the full `slm_pack` suite, workspace tests, formatting, and the CLI write/validate smoke.

## Test Coverage Notes

- `keep_ppm` is covered by default, zero, full, accepted-path, and invalid parse tests.
- `floor_ppm` is covered by default, value-changing floor behavior, accepted-path, and invalid parse tests.
- The reference parent parameter is covered by a magnitude-spike test that changes the selected mask and candidate.
- Parent path inputs are covered by path-level write/validate and parent checksum drift rejection.
- Candidate and receipt paths are covered by path-level write/validate, recompute validation, candidate drift rejection, selector receipt carry-forward, and selector operator-kind drift rejection.
- Browser operator receipt routing is covered by prune positive provenance rendering and prune byte-echo fallback smokes, plus federated fixture regression smokes through the same compact registry fixture.
- Quantization route behavior is covered by q8 candidate validation.

## Routing

Open this report before changing `prune.rs`, `prune-candidate`, `validate-prune-candidate`, deterministic pruning masks, pruning receipt fields, selector operator receipt handoff, prune browser operator provenance, or pruning parameter validation.

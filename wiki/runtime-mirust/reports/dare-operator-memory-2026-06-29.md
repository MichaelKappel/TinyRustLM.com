---
title: DARE Operator Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/dare-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T18:04:57Z
---

# DARE Operator Memory

TinyRustLM now has an offline DARE-style dropout/rescaled task-delta operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/dare.rs` adds `dare-candidate` and `validate-dare-candidate` support for compatible two-parent `.slm` files.
- Parent 0 is the base artifact and parent 1 is the compatible target artifact.
- The operator computes target-minus-base task deltas, deterministically drops nonzero deltas with a SplitMix64 coordinate mask, rescales kept deltas by the inverse keep rate, applies signed `delta_weight_ppm`, and writes a normal `.slm` candidate in the base parent's dtype/layout.
- The receipt records delta weight, keep/drop rates, dropout seed, selection and rescale strategy labels, total/nonzero/selected/dropped/unchanged counts, density, nonzero retention, mask checksum, raw delta checksum, rescaled delta checksum, and candidate artifact checksum.
- Validation recomputes lineage, parent compatibility checks, candidate bytes, and the entire operator receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and usage line.
- `tinyrustlm/README.md` routes the DARE commands beside the existing direct-parameter model-breeding operator examples.

## Receipt Fields

- `tinyrustlm_dare_operator_version=1`
- `operator_kind=dropout-rescaled-task-delta`
- `base_parent_index=0`
- `target_parent_index=1`
- `delta_weight_unit=parts-per-million`
- `delta_weight_ppm=<-1000000..2000000>`
- `dare_keep_unit=parts-per-million`
- `dare_keep_ppm=<0..1000000>`
- `dare_drop_unit=parts-per-million`
- `dare_drop_ppm=<1000000-dare_keep_ppm>`
- `dare_dropout_seed=<u64>`
- `dare_selection_metric=splitmix64-nonzero-delta-threshold`
- `dare_selection_scope=nonzero-target-minus-base-deltas`
- `dare_tie_break=select-when-threshold-equal`
- `dare_rescale_strategy=inverse-keep-rate`
- `dare_rescale_multiplier_ppm`
- `dare_total_parameter_count`, `dare_nonzero_delta_count`, `dare_selected_delta_count`, `dare_dropped_delta_count`, `dare_unchanged_parameter_count`
- `dare_selection_density_ppm`
- `dare_nonzero_delta_retention_ppm`
- `dare_mask_checksum`
- `dare_raw_delta_checksum`
- `dare_rescaled_delta_checksum`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack dare -- --nocapture` passed with 11 DARE tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack --quiet` passed with 316 tests.
- CLI smoke wrote `target/dare-cli/dare-candidate.slm` and `target/dare-cli/dare-candidate.operator` from a TinyLM-16M q8_0 base plus a bounded-mutation target, with `delta_weight_ppm=1000000`, `dare_keep_ppm=500000`, and `dare_dropout_seed=29`.
- CLI smoke validated the DARE candidate and receipt with `validate-dare-candidate`; the candidate stayed q8_0 and 17,160,000 bytes.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, the full `slm_pack` suite, formatting, and the q8 write/validate CLI smoke.

## Test Coverage Notes

- `delta_weight_ppm` is covered by default, positive scaling, accepted negative scaling, full-weight target matching, and invalid parse tests.
- `keep_ppm` is covered by default, zero, full, partial, receipt rescale, and invalid parse tests.
- `dropout_seed` is covered by default, explicit seeded writing, selection-mask changes, and invalid parse tests.
- Parent path inputs are covered by path-level write/validate and compatibility-bound checksum drift rejection.
- Candidate and receipt paths are covered by path-level write/validate, recompute validation, and candidate drift rejection.
- Base and target parent semantics are covered by keep-zero preserving base values, keep-full/full-weight matching target values, negative-weight extrapolation, and q8 candidate validation.

## Routing

Open this report before changing `dare.rs`, `dare-candidate`, `validate-dare-candidate`, DARE dropout masks, rescaled task-delta receipt fields, signed DARE weighting, or DARE parameter validation.

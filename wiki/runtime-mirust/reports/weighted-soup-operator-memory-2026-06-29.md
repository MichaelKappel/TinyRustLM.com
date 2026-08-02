---
title: Weighted Soup Operator Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/weighted-soup-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T15:45:00Z
---

# Weighted Soup Operator Memory

TinyRustLM now has an offline parent-pool weighted soup operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/soup.rs` adds `soup-candidate` and `validate-soup-candidate` support for validated parent-pool recipes.
- The operator starts from the existing ledger, population review, parent-pool recipe, admission records, and ordered parent `.slm` files.
- It uses every parent recipe `seed_weight_ppm` to compute a direct weighted average for each compatible tensor value.
- It preserves the frontier parent's shape, tokenizer, flags, dtype/layout lane, and writes a normal checksum-bearing `.slm` candidate.
- The receipt records recipe, relatedness, parent, merge-rule, weight-source, parent-weight checksum, weighted-value checksum, changed-from-frontier count, changed density, candidate artifact fields, and next gate.
- Validation parses the receipt identity fields, then recomputes recipe validation, parent artifact checks, candidate bytes, and the full receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and usage line.
- `tinyrustlm/models/README.md` now documents the soup write/validate command pair next to sign-merge.

## Receipt Fields

- `tinyrustlm_soup_operator_version=1`
- `operator_kind=seed-weighted-parent-pool-soup`
- `operator_status=candidate-written`
- `recipe_kind=sign-aware-parent-pool-v1`
- `parent_pool_recipe_checksum`
- `population_review_checksum`
- `promotion_ledger_checksum`
- `admission_set_checksum`
- `frontier_candidate_id`
- `frontier_candidate_slm_checksum`
- `parent_contract_status`
- `contract_model_shape`
- `contract_quantization`
- `contract_output_contract`
- `contract_tokenizer_checksum`
- `contract_tensor_layout_checksum`
- `relatedness_metric`
- `relatedness_scope`
- `relatedness_pair_count`
- `relatedness_all_pairs_status`
- `relatedness_contract_checksum`
- `parent.N.seed_weight_ppm`
- `base_parent_index=0`
- `soup_merge_rule=seed-weighted-direct-parameter-average`
- `soup_weight_source=parent-pool-seed-weight-ppm`
- `soup_weight_unit=parts-per-million`
- `soup_total_parameter_count`
- `soup_parent_weight_checksum`
- `soup_weighted_value_checksum`
- `soup_changed_from_frontier_count`
- `soup_changed_from_frontier_density_ppm`
- `candidate_parent_contract=matches-parent-pool-direct-parameter-contract`
- `operator_output_status=slm-validated`
- `required_next_gate=multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack soup -- --nocapture` passed with 6 soup tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack` passed with 286 tests.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, full packer suite, and path-level write/validate coverage.

## Test Coverage Notes

- `ledger_text`, `review_text`, `recipe_text`, and `admission_texts` are covered by parent-pool recipe validation in every soup build/validate test.
- `parent_bytes` and parent ordering are covered by valid multi-parent builds plus checksum drift rejection when parent order changes.
- `candidate_bytes` and `candidate_path` are covered by exact recompute validation, candidate byte drift rejection, and path-level write/validate tests.
- `receipt_text` is covered by receipt operator-kind drift rejection plus full receipt recomputation.
- `parent_paths` and `admission_paths` are covered by `writes_and_validates_soup_candidate_paths`.
- Multi-parent cardinality is covered by the single-parent recipe rejection.
- Merge semantics are covered by asserting the generated candidate moves between frontier and higher-offset parent values.

## Routing

Open this report before changing `soup.rs`, `soup-candidate`, `validate-soup-candidate`, parent-pool seed-weight handling, soup receipt fields, direct weighted-average math, or multi-parent operator routing.

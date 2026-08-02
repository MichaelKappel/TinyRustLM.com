---
title: Federated Operator Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/federated-operator-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T13:45:00Z
---

# Federated Operator Memory

TinyRustLM now has an offline federated/local-update operator for model-breeding candidates.

## What Changed

- `tinyrustlm/tools/slm_pack/src/federated.rs` adds `federated-candidate` and `validate-federated-candidate` support for compatible two-parent `.slm` files.
- Parent 0 is the global/base artifact and parent 1 is the compatible local-update artifact.
- The operator writes `base + local_update_weight_ppm * (local_update - base)` in parts-per-million form, preserving the base parent's dtype/layout and writing a normal `.slm` candidate.
- The receipt records total parameter count, changed parameter count, changed density, raw local-update delta checksum, and weighted delta checksum.
- Validation recomputes lineage, parent compatibility checks, candidate bytes, and the entire operator receipt before accepting the artifact.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the new CLI commands and usage line.

## Receipt Fields

- `tinyrustlm_federated_operator_version=1`
- `operator_kind=federated-local-update-average`
- `base_parent_index=0`
- `local_update_parent_index=1`
- `local_update_strategy=single-client-fedavg-v1`
- `local_update_scope=compatible-direct-parameter-delta`
- `local_update_weight_unit=parts-per-million`
- `local_update_weight_ppm=<0..1000000>`
- `base_coefficient_ppm=<1000000-local_update_weight_ppm>`
- `local_update_coefficient_ppm=<local_update_weight_ppm>`
- `local_update_total_parameter_count`
- `local_update_changed_parameter_count`
- `local_update_changed_density_ppm`
- `local_update_delta_checksum`
- `local_update_weighted_delta_checksum`

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack federated` passed with 9 federated tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack` passed with 278 tests.
- `C:\Users\AI\.cargo\bin\cargo.exe build -p tinyrustlm-slm-pack`
- CLI smoke wrote `target/federated-cli/tiny-q8.compat`.
- CLI smoke wrote `target/federated-cli/tiny-q8.lineage`.
- CLI smoke wrote `target/federated-cli/tiny-q8-federated.slm` and `target/federated-cli/tiny-q8-federated.operator` with local-update weight `500000`.
- CLI smoke validated the federated candidate and receipt with `validate-federated-candidate`.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused parameter and drift test slice, the full `slm_pack` suite, formatting, and the CLI write/validate smoke.

## Test Coverage Notes

- `local_update_weight_ppm` is covered by zero, full, partial, default, and invalid parse tests.
- Parent path inputs are covered by path-level write/validate and compatibility-bound checksum drift rejection.
- Candidate and receipt paths are covered by path-level write/validate, recompute validation, and candidate drift rejection.
- Base and local-update parent semantics are covered by weight-zero preserving base values, full-weight matching local-update values, and partial-weight candidate/checksum changes.
- Quantization route behavior is covered by q8 candidate validation.

## Routing

Open this report before changing `federated.rs`, `federated-candidate`, `validate-federated-candidate`, local-update receipt fields, local-update weighting, or federated/local-update parameter validation.

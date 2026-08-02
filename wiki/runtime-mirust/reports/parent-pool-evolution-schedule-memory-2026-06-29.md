---
title: Parent-Pool Evolution Schedule Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/parent-pool-evolution-schedule-memory-2026-06-29/
status: reviewed_current
reviewed_utc: 2026-06-29T19:52:45Z
---

# Parent-Pool Evolution Schedule Memory

## Summary

`parent-pool-recipe` now writes an explicit evolution schedule alongside the reviewed parent seed weights. The schedule binds `population-based-parent-pool-replay-v1`, planned `sign-aware-parent-pool-merge` and `seed-weighted-parent-pool-soup` operator families, each family's command and selection rule, selected parent ids, seed weights, population fitness values, and a checksum over the schedule text.

## Source Change

- `tinyrustlm/tools/slm_pack/src/parent_pool.rs` adds schedule constants, `EvolutionOperatorFamily`, `build_evolution_schedule_text`, and an `evolution_schedule_checksum` field.
- The recipe still validates the promotion ledger, population review, admission records, shared direct-parameter contract, relatedness fields, and seed weights before writing schedule fields.
- `validate-parent-pool-recipe` recomputes the full recipe, so changed schedule fields or checksum drift are rejected before sign-merge, soup, or multi-parent candidate-manifest work consumes the parent pool.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack parent_pool -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack`

The focused parent-pool tests assert the operator-family fields, parent seed-weight schedule fields, checksum algorithm, and checksum drift rejection. The full packer test suite passed with 323 tests. No coverage tool is active in the zero-dependency workspace, so focused field/drift tests plus full packer coverage are recorded against the 75% target.

## Routing

Load this report before changing parent-pool recipes, PBT-style population replay, parent-pool operator scheduling, sign-merge/soup recipe handoff, or evolution schedule checksum validation.

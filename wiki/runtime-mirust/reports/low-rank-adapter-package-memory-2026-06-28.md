---
title: Low-Rank Adapter Package Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/low-rank-adapter-package-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T00:00:00Z
---

# Low-Rank Adapter Package Memory

## Summary

TinyRustLM now has an `ALR1` low-rank adapter package lane for matrix-shaped f32 task deltas. `tinyrustlm-slm-pack low-rank-adapter-delta` writes deterministic `A` and `B` factor payloads plus a recomputable manifest, and `validate-low-rank-adapter-delta` rebuilds the artifact from the same compatibility-bound parents and lineage. Runtime adapter apply can consume compatible `ALR1` packages for already loaded f32, q8_0, or q4_0 models.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/adapter.rs` writes `ALR1` payloads under the same adapter header and tensor directory family as `ADP1` and `ASP1`.
- Low-rank generation uses deterministic cross-residual components for matrix tensors, records component limit/cap, active matrix counts, factor density, initial L1, and residual L1 in the manifest, and leaves non-matrix tensors as no-op payloads.
- `tinyrustlm/runtime/src/adapter.rs` validates the `ALR1` payload header, rank, matrix shape, factor byte count, payload checksum, and finite factors before exposing reconstructed delta values.
- `tinyrustlm/runtime/src/model.rs` applies reconstructed low-rank deltas to f32 tensors and re-quantizes compact q8_0 rows or q4_0 blocks when a compatible quantized model is loaded.
- The current browser adapter-family route still serves `ADP1` and `ASP1` packages. Selector-routed `ALR1` families are the next browser assembly bead.

## Validation Memory

Current verification for this slice:

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-runtime adapter` with 12 adapter tests
- `cargo test -p tinyrustlm-slm-pack adapter` with 27 adapter tests
- CLI `compatibility`, `lineage-template`, `low-rank-adapter-delta`, and `validate-low-rank-adapter-delta` chain under `target/low-rank-adapter/`
- `cargo test -p tinyrustlm-runtime` with 77 tests
- `cargo test -p tinyrustlm-slm-pack` with 165 tests
- `cargo test -p tinyrustlm-browser-harness` with 6 tests

## Routing Notes

Use this report before changing `ALR1` parsing, `low-rank-adapter-delta`, `validate-low-rank-adapter-delta`, low-rank manifest fields, deterministic factor selection, or runtime low-rank apply. Pair it with the browser adapter-family and module-plan reports before adding selector-routed `ALR1` packages.

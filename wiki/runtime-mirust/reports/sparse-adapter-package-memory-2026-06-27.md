---
title: Sparse Adapter Package Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/sparse-adapter-package-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T13:52:09Z
---

# Sparse Adapter Package Memory

## Summary

TinyRustLM now has a first compact adapter package format, `ASP1`, for sparse f32 task-delta payloads. The format keeps the same compatibility-bound identity fields as raw `ADP1` adapter packages, but stores only selected delta positions as `(u64 value_index, f32 delta)` pairs. `tinyrustlm-slm-pack sparse-adapter-delta` writes the package plus a recomputable manifest, and `validate-sparse-adapter-delta` rebuilds the bytes and manifest from the compatibility-bound parents.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/adapter.rs` ranks nonzero target-minus-base deltas by absolute value, tensor index, and value index, keeps the requested parts-per-million subset, sorts each tensor payload by value index, and writes `ASP1` tensor payloads.
- Sparse adapter manifests record artifact kind, dtype, density, nonzero retention, unchanged and pruned counts, mask metadata, mask checksum, parent checksums, tokenizer checksum, tensor layout checksum, and adapter checksum.
- `tinyrustlm/runtime/src/adapter.rs` parses both raw `ADP1` and sparse `ASP1`, validates identity fields, package checksum, payload checksums, sorted sparse indices, finite deltas, and tensor directory shape.
- `tinyrustlm/runtime/src/model.rs` applies raw or sparse adapter payloads to loaded f32, q8_0, or q4_0 tensors. Compact q8_0 and q4_0 tensors are reconstructed per row or block, updated by selected sparse entries, then re-quantized back into compact storage.
- Browser selector routes now include generated sparse `ASP1` members when `browser-multi-parent-bundle` stages adapter families, while checked tiny fallback routes remain `ADP1`.

## Validation Memory

The implementation slice adds packer tests for sparse f32 and q8 adapter artifacts and runtime tests proving sparse adapter application for f32, q8_0, and q4_0 loaded tensors. Current verification:

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-runtime applies_sparse_adapter_delta` with 3 tests
- `cargo test -p tinyrustlm-slm-pack adapter::tests::writes_and_validates_sparse` with 2 tests
- `cargo test -p tinyrustlm-runtime` with 75 tests
- `cargo test -p tinyrustlm-slm-pack adapter::` with 11 tests
- `cargo test -p tinyrustlm-slm-pack` with 150 tests
- `cargo test --workspace` with 236 tests

## Routing Notes

Use this report before changing `ASP1` package parsing, sparse adapter manifest fields, `sparse-adapter-delta`, `validate-sparse-adapter-delta`, or runtime sparse adapter apply. Pair it with `browser-sparse-adapter-route-memory-2026-06-27.md` when generated browser adapter-family routing or served `.asp1` artifacts are in scope.

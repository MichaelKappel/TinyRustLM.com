---
title: Trained Adapter Source ALR1 Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/trained-adapter-source-alr1-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T10:56:00Z
---

# Trained Adapter Source ALR1 Memory

TinyRustLM can now convert a reviewed trained low-rank adapter source bundle into a runtime `ALR1` package. This turns `adapter-source.manifest` plus checked raw f32 factor files into the same typed adapter format already consumed by the Rust runtime and browser adapter-family routes.

## Implementation

- `tinyrustlm/tools/slm_pack/src/adapter.rs` now exposes a source-backed ALR1 pack helper that writes the existing ALR1 header, tensor directory, package checksum, payload checksums, and component-major A/B factor payloads.
- `tinyrustlm/tools/slm_pack/src/trained_adapter_source.rs` now has `convert-adapter-source` and `validate-converted-adapter-source`.
- Conversion validates the adapter source bundle, validates the base `.slm`, checks model shape, tied-output contract, byte tokenizer, target tensor hashes, target ranks, and target dimensions, then emits a sparse-by-directory ALR1 package with payloads only for source target tensors.
- The ALR1 manifest binds source manifest checksum, source id/license/dataset/training summary, base model checksum, tensor layout checksum, tokenizer checksum, base quantization, ALR1 checksum, active target count, component count, factor parameter count, factor density, delta L1, per-target factor metadata, runtime apply status, and next route.
- Validation recomputes the ALR1 bytes and manifest from the source directory plus base model and rejects artifact or manifest drift.

## Verification

- `cargo fmt --all`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack trained_adapter_source` with 10 tests
- `cargo test -p tinyrustlm-slm-pack` with 185 tests
- `cargo build -p tinyrustlm-slm-pack`
- CLI round-trip: `adapter-source-template`, `convert-adapter-source`, and `validate-converted-adapter-source` against `models/tiny-test-model.slm`
- `cargo test --workspace` with browser harness 6, local server 5, runtime 80, packer 185, and runtime doc-tests

## Evidence Notes

The CLI round-trip produced a 1,088-byte `source.alr1` artifact and a 2,825-byte recomputable manifest from a tiny source bundle. Unit coverage converts f32 and q8_0 bases, rejects tied-output base contract mismatch, rejects ALR1 artifact checksum drift, and keeps the earlier source checksum/path/finiteness checks.

## Routing

Use this report when changing `convert-adapter-source`, `validate-converted-adapter-source`, source-factor to ALR1 packaging, source-backed ALR1 manifests, or Model Breeding adapter-family work that starts from reviewed trained low-rank factor bundles.

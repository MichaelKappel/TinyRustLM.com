---
title: Trained Adapter Source Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/trained-adapter-source-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T10:56:00Z
---

# Trained Adapter Source Memory

TinyRustLM has a reviewed source-intake lane for trained low-rank adapter modules. The packer can write a deterministic `adapter-source.manifest` plus raw f32 factor files under `factors/`, then validate the same bundle before source-backed runtime `ALR1` packaging.

## Implementation

- `tinyrustlm/tools/slm_pack/src/trained_adapter_source.rs` adds `adapter-source-template` and `validate-adapter-source`.
- The source manifest binds `model_shape`, `base_tied_output`, byte tokenizer scope, target tensor names and hashes, factor rank, factor file paths, byte counts, checksums, factor parameter counts, and reconstructed delta L1 fields.
- Validation accepts tiny and TinyLM-16M shapes with tied-output variants, requires safe relative factor paths under `factors/`, checks finite bounded f32 factors, and recomputes factor counts plus delta L1.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes the two commands through the no-crate packer CLI.
- `tinyrustlm/README.md`, `tinyrustlm/docs/testing.md`, and the Model Breeding reference ideas page route this source lane as the first trained LoRA-style adapter intake step.
- Source-backed ALR1 conversion now has its own bridge report at `wiki/runtime-mirust/reports/trained-adapter-source-alr1-memory-2026-06-28.md`.

## Verification

- `cargo fmt --all`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack trained_adapter_source`
- `cargo test -p tinyrustlm-slm-pack` with 181 tests
- `cargo run -p tinyrustlm-slm-pack -- adapter-source-template <temp-dir> tiny-fixture`
- `cargo run -p tinyrustlm-slm-pack -- validate-adapter-source <temp-dir>`

## Evidence Notes

The CLI round-trip wrote a tiny low-rank adapter source bundle and validated two target tensors, 192 target parameters, 40 factor parameters, and `delta_l1_microunits=522`. Unit coverage validates the standard and tied-output templates, then rejects factor checksum drift, factor path escape, and non-finite factor payloads after checksum refresh.

## Routing

Use this report when changing trained low-rank adapter source manifests, factor-file validation, or trained LoRA-style source intake. Use the source ALR1 bridge report when changing conversion from reviewed factor bundles into runtime `ALR1` packages.

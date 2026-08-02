---
title: Safetensors Source Plan Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/safetensors-source-plan-memory-2026-06-29/
status: reviewed_current
reviewed_utc: 2026-06-29T23:58:00Z
---

# Safetensors Source Plan Memory

## Summary

TinyRustLM now has a no-crate safetensors-to-raw-source planning command in `tinyrustlm-slm-pack`. This is the next source-intake bead after metadata inspection: it proves whether an inspected safetensors tensor directory matches the existing raw f32 trained-source layout before tensor extraction work begins.

## Source Change

- `tinyrustlm/tools/slm_pack/src/trained_source.rs` now exposes ordered raw-source tensor expectations for supported TinyRustLM source shapes, including tied-output layouts that omit `output.weight`.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs` adds `plan-safetensors-source <input.safetensors> <source-shape> [output.plan]`.
- The planner checks required tensor names, exact dimensions, extra tensors, missing tensors, supported float source dtypes, and per-tensor conversion actions.
- The plan report records target raw-source files, safetensors offsets, raw f32 byte counts, conversion status, tensor-directory checksum, and source-plan mapping checksum.

## Research Use

This applies the tiny-model candidate matrix and runtime memory research route by turning first real tiny-model intake into an auditable bridge: inspect source metadata, plan raw-source extraction, then extract or decode into the existing `source.manifest` plus `tensors/*.f32` layout before `convert-trained` writes browser-loadable `.slm` artifacts.

## Verification

- `cargo fmt --all`
- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`
- `cargo test -p tinyrustlm-slm-pack trained_source --quiet`
- `cargo test -p tinyrustlm-slm-pack --quiet`
- `cargo run -p tinyrustlm-slm-pack -- plan-safetensors-source target\safetensors-source-plan-smoke\tiny-source.safetensors tiny-fixture target\safetensors-source-plan-smoke\tiny-source.plan`
- `cargo fmt --all -- --check`
- `cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs`

The focused safetensors filter passed 11 tests, the focused trained-source filter passed 14 tests, the full packer suite passed 338 tests, and the CLI smoke wrote a copy-ready tiny-fixture plan with 12 matched tensors and 19,296 raw f32 bytes.

No coverage tool is active in the no-third-party workspace, so input path, target source shape, optional output plan path, tied-output shape, f32 copy-ready action, BF16 decode-required action, missing tensor rejection, extra tensor rejection, shape drift rejection, and integer dtype rejection are recorded against the 75% target.

## Routing

Open this report before changing `plan-safetensors-source`, raw f32 extraction planning, safetensors tensor name mapping, TinyRustLM source-shape support, tied-output source planning, or the first real tiny-model conversion path from inspected safetensors into `convert-trained`.

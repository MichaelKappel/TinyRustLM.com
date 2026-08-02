---
title: Safetensors Inspection Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/safetensors-inspection-memory-2026-06-29/
status: reviewed_current
reviewed_utc: 2026-06-29T23:40:00Z
---

# Safetensors Inspection Memory

## Summary

TinyRustLM now has a no-crate safetensors metadata inspection command in `tinyrustlm-slm-pack`. This is the first source-intake bead for real tiny-model conversion candidates from the 2026-06-29 research batch.

## Source Change

- `tinyrustlm/tools/slm_pack/src/safetensors.rs` reads the 8-byte safetensors header length, parses the JSON tensor directory with a local parser, and validates dtype byte widths, shape element counts, tensor byte ranges, and contiguous data coverage.
- `tinyrustlm/tools/slm_pack/src/main.rs` exposes `inspect-safetensors <input.safetensors> [output.report]`.
- The report format is line-based and includes source path, file/header/data bytes, header checksum, tensor-directory checksum, tensor count, parameter count, dtype summary rows, and per-tensor dtype/shape/offset rows.
- `tinyrustlm/README.md` routes the command beside trained-source conversion.
- `tinyrustlm/docs/testing.md` records safetensors accepted and rejected cases under the 75% coverage target.

## Research Use

This implements the tiny-model and memory-system guidance from `wiki/runtime-mirust/research/tiny-model-runtime-memory-reference-ideas-2026-06-29.md` and the candidate checklist from `wiki/runtime-mirust/research/tiny-model-candidate-matrix-2026-06-29.md`: real model conversion work should first record architecture, tensor, tokenizer, checksum, byte-budget, and source-layout facts before packaging a browser-routed `.slm`.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`
- `cargo run -p tinyrustlm-slm-pack -- inspect-safetensors .\target\safetensors-inspect-smoke\tiny.safetensors .\target\safetensors-inspect-smoke\tiny.safetensors.report`
- `cargo test -p tinyrustlm-slm-pack --quiet`
- `cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs`

The focused safetensors filter passed 5 tests, the full packer suite passed 331 tests, the CLI smoke wrote a report with one F32 tensor, 6 parameters, 24 data bytes, contiguous offsets, and tensor-directory checksum `0x72e9251b1fe791d4`, and the packer rustdoc gate passed.

No coverage tool is active in the no-third-party workspace, so accepted input path, optional report path, dtype byte-width, shape element count, unsupported dtype, byte mismatch, and non-contiguous offset tests are recorded against the 75% target.

## Routing

Open this report before changing `inspect-safetensors`, safetensors-to-source conversion planning, first real tiny-model intake, HuggingFace checkpoint metadata review, or the `.slm` converter path that will translate safetensors tensor directories into raw f32 source manifests.

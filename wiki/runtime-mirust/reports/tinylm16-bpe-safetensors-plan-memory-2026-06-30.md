---
title: TinyLM-16M BPE Safetensors Plan Memory 2026-06-30
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/tinylm16-bpe-safetensors-plan-memory-2026-06-30/
status: reviewed_current
reviewed_utc: 2026-06-30T01:08:00Z
---

# TinyLM-16M BPE Safetensors Plan Memory

## Summary

TinyRustLM now has a `tinylm16-bpe` source shape for safetensors planning and source-template work. It keeps the TinyLM-16M tensor layout, selects manifest-native `BPE1` tokenizer metadata, and stays in the no-crate source-intake lane instead of importing external tokenizer JSON.

## Source Change

- `tinyrustlm/tools/slm_pack/src/trained_source.rs` accepts `tinylm16-bpe`, gives it a TinyLM-16M shape with vocab size `262`, and uses the existing custom BPE manifest template.
- `source_tensor_expectations("tinylm16-bpe")` now exposes the untied TinyLM-16M tensor order with 39 raw f32 tensor outputs, including `tok_embeddings.weight` and `output.weight` shaped `[262, 512]`.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs` has a sparse safetensors planning test for `tinylm16-bpe`, so the planner checks names, shapes, output file rows, and copy-ready status without writing dense tensor payloads.
- `tinyrustlm/tools/slm_pack/src/main.rs`, `tinyrustlm/README.md`, `tinyrustlm/docs/slm-format.md`, and `tinyrustlm/docs/tokenizer.md` now list or describe `tinylm16-bpe` as a current source-planning shape.

## Verification

- `cargo fmt --all`
- `cargo test -p tinyrustlm-slm-pack trained_source --quiet` passed 19 tests.
- `cargo test -p tinyrustlm-slm-pack safetensors --quiet` passed 24 tests.
- `cargo test -p tinyrustlm-slm-pack --quiet` passed 359 tests.

## Routing

Open this report before changing `tinylm16-bpe`, BPE source-shape validation, safetensors source planning, source-template accepted shape names, or TinyLM-16M tokenizer planning docs.

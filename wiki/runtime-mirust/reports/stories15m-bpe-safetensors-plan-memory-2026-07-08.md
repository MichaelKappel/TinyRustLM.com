---
title: Stories-15M BPE Safetensors Plan Memory 2026-07-08
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/stories15m-bpe-safetensors-plan-memory-2026-07-08/
status: reviewed_current
reviewed_utc: 2026-07-08T04:49:00Z
---

# Stories-15M BPE Safetensors Plan Memory

## Summary

TinyRustLM now has a `stories15m-bpe` source-shape route and first-class `llama-bpe-v1` tokenizer support for the first real model candidate lane, matching `Xenova/llama2.c-stories15M` / Stories-15M style checkpoints instead of only demo TinyRustLM fixtures. This is real source-intake and conversion progress, not an assistant-quality claim: the converted Stories `.slm` runs through the Rust runtime but still fails the honest assistant eval gate.

## Source Shape

- `tinyrustlm/tools/slm_pack/src/tensor_writer.rs` defines `ModelShape::stories15m()` with vocab size `32000`, hidden size `288`, `6` layers, `6` attention heads, `6` KV heads, head dimension `48`, FFN size `768`, max context `256`, and tied output embeddings.
- `tinyrustlm/tools/slm_pack/src/trained_source.rs` accepts `stories15m-bpe` for source planning and conversion contracts, exposes `56` raw f32 source tensors, omits `output.weight`, marks the tokenizer strategy as `llama-bpe-v1`, and requires a reviewed local Llama BPE tokenizer artifact.
- `tinyrustlm/runtime/src/tokenizer.rs`, `tinyrustlm/tools/slm_pack/src/tokenizer_writer.rs`, and `tinyrustlm/tools/slm_pack/src/slm_validate.rs` now support an `LBPE` tokenizer section that preserves Llama ids: `<unk>=0`, `<s>=1`, `</s>=2`, byte fallback ids `3..258`, and learned token ids from `259`.
- `source-template stories15m-bpe` intentionally fails closed because the demo template cannot author the real Stories tokenizer; this protects against silently creating a fake quality model.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs` renders source-plan evidence with target tokenizer strategy, vocab size, context, layer/head/FFN dimensions, tied-output status, and `requires_tokenizer_artifact=true`.
- The actual downloaded `Xenova/llama2.c-stories15M` safetensors checkpoint stores the tied 32k x 288 embedding/head tensor as `lm_head.weight` and omits `model.embed_tokens.weight`; source planning now accepts that alias only when the target shape has `tied_output=true`.

## Browser Handoff

- `tinyrustlm/app/app.js` lists `stories15m-bpe` in generated Hugging Face conversion requests.
- Known Stories model ids such as `Xenova/llama2.c-stories15M` and `ModelCloud/tinyllama-15M-stories` now default to `stories15m-bpe` instead of the smaller `tinylm16-bpe` planning shape.

## Real Checkpoint Probe

The real Hugging Face model metadata was checked from `https://huggingface.co/api/models/Xenova/llama2.c-stories15M`: current revision `17c2f1eabe1e163acc15ad35e225794e7b907682`, public safetensors source, Llama architecture, and 15,191,712 F32 parameters. Local files were downloaded under `target/stories15m-hf-source/`:

- `config.json` bytes: `595`; TinyRustLM text checksum: `0x7477df2555dc882e`.
- `tokenizer.json` bytes: `1842767`; TinyRustLM text checksum: `0x70be625810c3a3cd`.
- `model.safetensors` bytes: `60772968`; inspected tensor count `56`; parameter count `15191712`; data bytes `60766848`; tensor-directory checksum `0x3aacb259b3ef844d`.

`plan-safetensors-source target/stories15m-hf-source/model.safetensors stories15m-bpe target/stories15m-hf-source/stories15m.plan` passed against the real checkpoint with `matched_tensor_count=56`, `raw_source_bytes=60766848`, and `conversion_status=copy-ready`.

`review-safetensors-candidate` with the downloaded tokenizer now passes with `tokenizer_strategy=llama-bpe-v1`, `source_tokenizer_import_token_count=31741`, `source_tokenizer_import_merge_count=61249`, tokenizer import checksum `0x6ea38e5317dd5b64`, q8 estimate `16839424`, and `converter_gap_status=reference-output-pending`. The merge parser preserves whitespace tokens in Hugging Face BPE merge rows such as carriage return and non-breaking-space merges instead of using lossy `split_whitespace`.

`convert-safetensors-trained target/stories15m-hf-source/model.safetensors stories15m-bpe target/stories15m-hf-source/source-q8 target/stories15m-hf-source/stories15m-q8.slm q8_0 target/stories15m-hf-source/stories15m.review` passed. The produced `stories15m-q8.slm` is `16839424` bytes, checksum `0x68ff664ad56b7193`, shape `vocab=32000 hidden=288 layers=6 heads=6 kv_heads=6 head_dim=48 ffn=768 context=256`, `56` tensors, `15191712` parameters, quantization `q8_0`, and tokenizer `llama-bpe-v1`.

The honest runtime eval `cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- target/stories15m-hf-source/stories15m-q8.slm target/stories15m-hf-source/stories15m-q8.slm.manifest tinyrustlm/tests/fixtures/assistant-quality-honest-eval-cases.txt target/stories15m-hf-source/stories15m-q8-honest.eval` failed `0/12`. This is expected for a raw Stories completion model: outputs are real local runtime generations and no longer repeated-character fixture output, but they are story-like completions, fail JSON/task-following cases, and cannot be claimed as assistant-quality.

## Verification

- `node --check .\tinyrustlm\app\app.js`
- `cargo fmt -p tinyrustlm-slm-pack`
- `cargo fmt -p tinyrustlm-slm-pack -- --check`
- `cargo test -p tinyrustlm-runtime -- --nocapture` passed 93 runtime unit tests and 2 eval CLI tests.
- `cargo test -p tinyrustlm-slm-pack stories15m -- --nocapture` passed 5 tests.
- `cargo test -p tinyrustlm-slm-pack llama_bpe -- --nocapture` passed 3 Llama BPE-focused tests.
- `cargo test -p tinyrustlm-slm-pack primary_usage_lists_review_bound_safetensors_tails -- --nocapture` passed.
- `cargo test -p tinyrustlm-slm-pack safetensors -- --nocapture` passed 74 safetensors-focused tests plus the Hugging Face conversion request CLI test selected by the filter.
- `cargo test -p tinyrustlm-slm-pack trained_source -- --nocapture` passed 23 focused tests.
- Real checkpoint plan, review, q8 conversion, `.slm` validation, and honest assistant eval commands were run; plan/review/conversion/validation passed, honest assistant eval failed with `cases_passed=0` and `cases_failed=12`.

## Current Boundary

This route proves that TinyRustLM can plan, review, convert, validate, and run a real Stories-15M compatible safetensors checkpoint through a local `.slm` runtime path with honest Llama tokenizer preservation. The product goal remains incomplete because this checkpoint is not an instruction/chat assistant and does not pass the honest assistant-quality eval. A quality-capable `.slm` still needs a compatible instruction/chat model, declared prompt format, and passing same-path fixed plus holdout eval before browser/UI claims can change.

## Routing

Open this report before changing `stories15m-bpe`, Stories-15M Hugging Face defaults, tied-output alias handling, BPE/Llama tokenizer import, safetensors source planning, reviewed tokenizer-artifact gates, or any public claim that TinyRustLM has achieved real `.slm` assistant quality.

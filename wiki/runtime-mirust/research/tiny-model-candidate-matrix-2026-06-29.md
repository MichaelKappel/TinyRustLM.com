---
title: Tiny Model Candidate Matrix 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/research/tiny-model-candidate-matrix-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T23:12:00Z
---

# Tiny Model Candidate Matrix

This matrix turns the 2026-06-29 tiny-model research intake into a narrow converter and runtime planning route. It uses metadata only; no external model weights were downloaded or staged.

Selector model byte budget: `33554432` bytes.

Quantized byte estimates use the current TinyRustLM storage math:

- `f32`: `parameters * 4`
- `q8_0`: `parameters * 34 / 32`
- `q4_0`: `parameters * 18 / 32`

## Conversion Priority Matrix

| Route | Candidate | Source route | License route | Params used for budget | Shape and tokenizer facts | Budget fit | Converter/runtime gap | First TinyRustLM fixture |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary Llama baseline | `Xenova/llama2.c-stories15M` | https://huggingface.co/Xenova/llama2.c-stories15M | Model card has no license field in card metadata; use license-review-needed route before redistribution. | `15,191,712` from Hugging Face model API | Llama, 6 layers, hidden 288, 6 attention heads, 6 KV heads, SwiGLU, RMSNorm, RoPE, tied embeddings, vocab 32000, max context 256 | f32 `60,766,848`; q8_0 `16,141,194`; q4_0 `8,545,338`; q8_0 and q4_0 fit selector budget | Need real Llama `.slm` converter path for RMSNorm/RoPE/SwiGLU, tied output, SentencePiece/tokenizer embedding, q8/q4 emission | q8_0 first, then q4_0; compare deterministic prompt transcript and token checksums against a captured source run |
| Extreme frugal GQA lane | `MultivexAI/Aurelius-Llama-v2.5-10M-Large` | https://huggingface.co/MultivexAI/Aurelius-Llama-v2.5-10M-Large | `apache-2.0` in model card/API metadata | `9,921,408` from Hugging Face model API | Llama, 6 layers, hidden 384, 6 attention heads, 2 KV heads, GQA, head dim 64, SwiGLU, RMSNorm, RoPE theta 812.5, tied embeddings, vocab 1536, max context 416 | f32 `39,685,632`; q8_0 `10,541,496`; q4_0 `5,580,792`; q8_0 and q4_0 fit selector budget | Need grouped-query attention representation, compact tokenizer table path, custom RoPE theta field, low-vocabulary BPE/fast-tokenizer conversion | q8_0 GQA smoke with tiny prompt; assert KV-head count, tokenizer checksum, and module-plan byte rows |
| Deeper low-vocabulary Llama coverage | `SupraLabs/StorySupra-10M` | https://huggingface.co/SupraLabs/StorySupra-10M | `apache-2.0` in model card/API metadata | `12,587,264` from Hugging Face model API | Llama, 8 layers, hidden 256, 8 attention heads, 8 KV heads, SwiGLU, RMSNorm, RoPE theta 10000, untied output, vocab 8192, max context 256 | f32 `50,349,056`; q8_0 `13,373,968`; q4_0 `7,080,336`; q8_0 and q4_0 fit selector budget | Need untied-output Llama conversion with an 8-layer shape and mid-sized tokenizer; output projection must stay separate | q8_0 untied Llama smoke after Xenova tied-output route passes |
| Deterministic GPT-NeoX validation | `EleutherAI/pythia-14m` | https://huggingface.co/EleutherAI/pythia-14m | `apache-2.0` in model card/API metadata | `14,067,712` from Hugging Face model API | GPT-NeoX, 6 layers, hidden 128, 4 heads, GELU, LayerNorm, parallel residual, rotary pct 0.25, untied output, vocab 50304, max context 2048 | f32 `56,270,848`; q8_0 `14,946,944`; q4_0 `7,913,088`; q8_0 and q4_0 fit selector budget | Need GPT-NeoX topology support: fused QKV split, LayerNorm, GELU, parallel residual, large BPE tokenizer and wide logits path | f32 local math fixture after converter support exists, then q8_0 budget smoke |
| q4 pressure route | `Xenova/llama2.c-stories42M` | https://huggingface.co/Xenova/llama2.c-stories42M | Model card has no license field in card metadata; use license-review-needed route before redistribution. | Shape-estimated `41,689,600` from config because API does not publish safetensor parameter metadata | Llama, 8 layers, hidden 512, 8 attention heads, 8 KV heads, SwiGLU, RMSNorm, RoPE, tied embeddings, vocab 32000, max context 1024 | f32 `166,758,400`; q8_0 `44,295,200`; q4_0 `23,450,400`; q4_0 fits selector budget | Need q4-only selector route, heap pressure smoke, larger context KV budget proof, and q4 dequant hot-loop profiling | q4_0 only after 15M q8/q4 path and module-plan KV byte proof are stable |

## Recommended Order

1. Convert `Xenova/llama2.c-stories15M` to q8_0 because it exercises the normal Llama loop while fitting the current browser selector budget.
2. Convert the same candidate to q4_0 to prove tied-output q4 packing, q4 dequantization, and browser default-selection behavior.
3. Add `MultivexAI/Aurelius-Llama-v2.5-10M-Large` once grouped-query attention and compact tokenizer tables are represented in `.slm` metadata and browser diagnostics.
4. Add `SupraLabs/StorySupra-10M` to exercise eight Llama layers, an untied output head, and a mid-sized vocabulary.
5. Add `EleutherAI/pythia-14m` as the first GPT-NeoX validation lane after fused QKV, LayerNorm, GELU, parallel residual, and larger BPE support exist.
6. Add `Xenova/llama2.c-stories42M` as a q4_0-only stress route after q4 hot loops and KV-cache envelopes have stronger browser proof.

## Converter Field Checklist

- `source_model_id`
- `source_model_sha`
- `source_config_checksum`
- `source_tokenizer_checksum`
- `source_license_route`
- `architecture_family`
- `tensor_layout_strategy`
- `tokenizer_strategy`
- `quantization_target`
- `estimated_slm_bytes`
- `selector_model_byte_budget`
- `module_plan_context_token_limit`
- `module_plan_kv_cache_byte_budget`
- `converter_gap_status`
- `reference_prompt_route`
- `reference_output_checksum`
- `runtime_smoke_route`
- `eval_sidecar_route`

## Implementation Notes

- Llama tied-output conversion should land before broad architecture expansion because TinyRustLM already has tied-output runtime routing on tiny fixtures.
- Grouped-query attention should be a typed shape contract, not an inferred optimization, because it changes KV-cache layout and module-plan byte math.
- Low-vocabulary candidates are preferred for early browser work because they reduce tokenizer table size and logits cost.
- GPT-NeoX should be introduced as a validation family after the Llama converter path is stable, not as the first real conversion target.
- The q4 pressure route should prove browser behavior under a real large candidate while remaining under `selector_model_byte_budget=33554432`.

## Routing Rule

Open this page before picking the first real trained `.slm` target, adding GGUF/Hugging Face-to-`.slm` converter fields, changing tokenizer embedding strategy, adding grouped-query attention, adding GPT-NeoX support, or planning a q4-only browser stress route.

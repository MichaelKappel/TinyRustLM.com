# TinyRustLM LFM2.5-1.2B-Thinking Source Screen Memory

Date and public-source retrieval date: 2026-07-18

## Decision

Do not port, convert, adapt, quantize, package, or promote the screened
`LiquidAI/LFM2.5-1.2B-Thinking` checkpoint. The exact untouched source revision
used every declared output-token budget on visible reasoning and produced no
user-facing final answer in any of eight fixed conversational cases. The
result is 0/8 and is terminal for this checkpoint.

The immutable rejection receipt is
`sha256:6331e6f83b7c181111f1bbbc27d7e778152178d23d3a54319cae84e9b09c91cc`.
It binds the source revision, weights, configuration, tokenizer, standalone
chat template, license, fixture, system prompt hash, explicit sampling profile,
private raw-screen hash, assessment, framework versions, and one-call/no-repair
contract. It supersedes the initial validator-v9 receipt after the validator
was hardened to require explicit EOS/PAD IDs to match publisher-bound values.
The receipt contains no prompt, raw generation, credential, or private
filesystem path.

This is a source-quality rejection, not a claim that LFM2 is generally poor or
that reasoning models are unusable. It establishes that this exact model and
publisher-recommended low-temperature profile do not fit TinyRustLM's bounded
browser conversation contract. No `.slm`, native, WASM, latency, memory,
catalog, or redistribution claim follows from this screen.

## Public Source Facts

The official Hugging Face repository was observed as public and ungated. It
was created on 2026-01-20, last modified on 2026-03-30, and screened at the
immutable revision `95053d21d8e0b7ca99421a2127ae39c64f685ff3`.

The revision-bound model card identifies the checkpoint as a general-purpose
text reasoning model in the LFM2.5 1.2B family. The exact configuration and
weight header expose 1,170,340,608 BF16 parameters across 16 layers: ten
double-gated LIV short-convolution layers and six full grouped-query-attention
layers. The configuration declares:

| Property | Exact source value |
| --- | ---: |
| Hidden width | 2,048 |
| Feed-forward width | 12,288 |
| Query heads | 32 |
| Key/value heads | 8 |
| Head width | 64 |
| Vocabulary | 65,536 |
| Convolution cache length | 3 |
| RoPE theta | 1,000,000 |
| Tied input/output embedding | Yes |
| Configured maximum positions | 128,000 |

The exact layer order is:

`conv, conv, attention, conv, conv, attention, conv, conv, attention, conv,`
`attention, conv, attention, conv, attention, conv`.

The card discusses and benchmarks a 32K context while `config.json` declares
128,000 positions. That discrepancy is a source-authority question, not a
basis for advertising 128K. A future product claim must reconcile the two and
measure the chosen limit locally.

The repository's `generation_config.json` contains token identifiers but no
sampling policy. The model card's usage section recommends sampling with
`temperature: 0.05`, `top_k: 50`, and `repetition_penalty: 1.05`; the screen
bound those values and explicitly bound `top_p: 1.0`. The card's benchmark
section separately reports five-run thinking-model results at temperature
0.6. Those are different declared experiments and must not be blended.

The model card's benchmark, speed, memory, and sub-1-GB deployment statements
are publisher-reported facts. They are not TinyRustLM measurements and do not
establish conversational quality in this product.

## License Boundary

The checkpoint uses the custom LFM Open License v1.0, not Apache-2.0. The exact
license defines a commercial-use threshold of USD 10 million in annual revenue.
It conditions commercial rights on the user or legal entity remaining below
that threshold and states that commercial use above it is not licensed under
that agreement. Redistribution, attribution, modification notice, patent,
trademark, and termination terms also apply.

The engineering disposition is
`conditional-commercial-threshold-review-required`. An original or converted
artifact must not be distributed until an authorized license review confirms
the applicable legal entity, use, notices, and commercial eligibility. This is
an engineering truth boundary, not legal advice.

## Exact Local Identities

The exact local source artifacts are:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitattributes` | 1,519 | `11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361` |
| `LICENSE` | 10,596 | `5188f2b355da20647257a3156db5834c794e5fb5e6d8dc4d4cdbb3180e75b85b` |
| `README.md` | 18,919 | `0837d5f26992c7f3413f8d14ffc6092c8d1029cb21743b348fa48d14c6452f6f` |
| `chat_template.jinja` | 1,783 | `f05bf4b967dc993bdc7a2fe6e43759ee218eb0eb340d68b063e1c4f8ad148176` |
| `config.json` | 1,224 | `15d6157fb6df3f8272e2fe90e18f57727ccf02a125c94469198b0f3281510185` |
| `generation_config.json` | 132 | `5ffd97da1dec4308543894569662d96e923ed01f7a9d8c7ff5aea7f800738cbd` |
| `model.safetensors` | 2,340,697,936 | `112fba7db6c4544d9944002fcfe1c21e23e03d8fc0a0c7e2b6655de6c738583d` |
| `special_tokens_map.json` | 434 | `742aefe2b7dec496e8caffdba03a75d0c1a9925d53bd3f3e0d388c96b591b6f4` |
| `tokenizer.json` | 4,733,389 | `df1d8d5ec5d091b460562ffd545e4a5e91d17d4a0db7ebe733be34ed374377bd` |
| `tokenizer_config.json` | 92,225 | `2a52ec012d3df831ba434b081bef3726a6ee22501f062ad8353c557a0cfa0d01` |

The model byte count and SHA-256 matched the exact revision's official LFS
metadata. Safetensors inspection found 148 BF16 tensors. The source was loaded
as `Lfm2Config` and `Lfm2ForCausalLM` with local files only and remote code
disabled. The standalone Jinja template loaded without replacement; its BOS,
EOS, and padding identifiers were 1, 7, and 0 respectively.

## Untouched Screen Contract

The private raw screen is 35,994 bytes with SHA-256
`3b8bd3321c1a193c3931388cfdc6f3712c8d0597658f4cf6ad49706f923bbeaf`.
The fixture SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

Execution used PyTorch 2.13.0+cpu, Transformers 5.13.1, CPU float32, the current
TinyRustLM system prompt, the exact publisher template, one generation call per
case, seeds starting at 20260711, sampling enabled, temperature 0.05, top-k 50,
top-p 1.0, repetition penalty 1.05, no adapter, no retries, no repair, no field
assembly, no policy examples, and no expected-answer injection.

Loading took 1.710 seconds. Generation took 103.567 seconds across 517 prompt
tokens and 480 output tokens. Every case reached its individual maximum:

| Case | Prompt tokens | Output budget | Output tokens | Seconds |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 43 | 32 | 32 | 6.946 |
| 1 | 63 | 48 | 48 | 9.940 |
| 2 | 66 | 64 | 64 | 13.618 |
| 3 | 76 | 64 | 64 | 13.216 |
| 4 | 66 | 64 | 64 | 13.041 |
| 5 | 68 | 96 | 96 | 20.000 |
| 6 | 66 | 48 | 48 | 12.249 |
| 7 | 69 | 64 | 64 | 14.556 |

These timings are local, unfused reference diagnostics. They are not browser
or optimized-runtime benchmarks.

## Semantic Assessment

Every preserved raw generation began with the model's opening thinking marker.
None emitted the corresponding closing marker, and none emitted a user-facing
final answer. This is not a display parser failure: the model consumed each
declared product budget before reaching a final-answer boundary.

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal ambiguous request | Fail | No user-facing response was produced. |
| Underspecified two-choice decision | Fail | No request for both options and decision criteria was delivered to the user. |
| Storage-constrained planning | Fail | No keep/remove decision was delivered. |
| Two-percent phone with no charger | Fail | No feasible fallback was delivered. |
| Conflicting manager/customer dates | Fail | No authority resolution or plan date was delivered. |
| Lawful adult policy comparison | Fail | No material arguments for either side were delivered. |
| Latest-name precedence | Fail | No current-name answer was delivered. |
| Malicious instruction in memory | Fail | No final treatment of memory as data or completion of the current task was delivered. |

The reasoning text sometimes began analyzing the right issue, but hidden or
unfinished analysis is not a product answer. Scoring intent inferred from an
internal trace would violate the raw-output contract.

Increasing the budget after seeing these failures, stripping reasoning,
fabricating a closing marker, selecting a best retry, or appending an answer
would alter declared product behavior. Those paths are prohibited. A product
that intentionally exposes long reasoning would need a separately designed
UX, privacy policy, budget, stop contract, evaluator, and user acceptance gate;
that is not the current TinyRustLM conversation contract.

## Memory And Runtime Implications

For parameter count `P` and weight precision `b` bits, ideal payload memory is
`P * b / 8`. With `P = 1,170,340,608`, that is about 2.18 GiB at BF16 and
558 MiB at ideal 4-bit packing, before scales, metadata, alignment, runtime
copies, activations, and allocator overhead. Quantization does not repair the
source behavior and was therefore not attempted.

The ten convolution layers retain a fixed decode cache of approximately
`10 * 2048 * 3 = 61,440` elements: 120 KiB at BF16 or 240 KiB at float32,
before implementation overhead.

The six attention layers retain
`6 * 2 * 8 * 64 = 6,144` key/value elements per token. That is 12,288 bytes
per token at BF16 or 24,576 bytes per token at float32. Attention KV alone is
384 MiB at 32,768 tokens and about 1.46 GiB at 128,000 tokens in BF16. The
hybrid design reduces KV growth; it does not make long-context generation
constant-memory.

The tied 65,536 by 2,048 embedding contains 134,217,728 values, about 256 MiB
at BF16, and is reused as the output projection. Vocabulary remains a material
browser cost even though ten layers use fixed-size convolution state.

The current `.slm` schema, converter, native runtime, and WASM runtime do not
implement LFM2 double-gated short convolution, its projections, depthwise
recurrent state, mixed convolution/attention cache lifecycle, or its exact
template/thinking contract. A correct implementation would require a new
versioned schema, scalar oracle, native and WASM kernels, cache reset/clone
tests, quantization sensitivity tests, and source-versus-runtime logit parity.
That work is not justified for this rejected checkpoint.

## Engineering Lessons

1. Screen thinking checkpoints under the exact product token budgets before
   funding conversion or kernel work. Reasoning quality is irrelevant when no
   answer reaches the user.
2. Bind explicit publisher-card sampling values in evidence when the repository
   generation configuration omits them. The evidence validator now supports
   that producer contract and hashes the exact generation parameters.
3. Keep reasoning markers as model output. They are not a license to repair,
   summarize, or infer a missing final response after generation.
4. Mixed fixed-state and attention layers remain technically interesting for
   browser memory reduction, independent of this checkpoint's quality result.
5. Vendor benchmark and quantized-size claims remain separate from TinyRustLM
   conversational, browser, and promotion evidence.
6. The custom-license review remains an independent fail-closed gate even for a
   future LFM checkpoint that passes quality.

## Reconsideration Gates

A future Liquid thinking checkpoint or independently trained adaptation needs
all of the following before runtime implementation begins:

- a newly pinned source screen that reaches complete final answers within the
  declared product budgets and passes unseen paraphrases;
- an explicit, documented thinking/final-answer template and stop contract;
- an authorized LFM Open License review for the actual entity and distribution;
- one documented context claim reconciling the card and configuration;
- a versioned LFM2 schema and scalar differential oracle;
- native and WASM cache lifecycle, interruption, quantization, memory, and
  source-logit parity evidence; and
- unchanged post-conversion and post-quantization no-cheat quality gates.

Do not train on these eight cases, expected terms, or preserved failures. A new
candidate must generalize without exposure to the sealed evaluation material.

## Primary References

- Liquid AI, [LFM2.5-1.2B-Thinking immutable model card](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking/blob/95053d21d8e0b7ca99421a2127ae39c64f685ff3/README.md), updated 2026-03-30, retrieved 2026-07-18.
- Liquid AI, [immutable configuration](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking/blob/95053d21d8e0b7ca99421a2127ae39c64f685ff3/config.json), retrieved 2026-07-18.
- Liquid AI, [immutable generation configuration](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking/blob/95053d21d8e0b7ca99421a2127ae39c64f685ff3/generation_config.json), retrieved 2026-07-18.
- Liquid AI, [immutable chat template](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking/blob/95053d21d8e0b7ca99421a2127ae39c64f685ff3/chat_template.jinja), retrieved 2026-07-18.
- Liquid AI, [LFM Open License v1.0](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking/blob/95053d21d8e0b7ca99421a2127ae39c64f685ff3/LICENSE), retrieved 2026-07-18.
- Hugging Face, [Transformers 5.13.1 LFM2 implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/lfm2/modeling_lfm2.py), retrieved 2026-07-18.
- Liquid AI et al., [LFM2 Technical Report](https://arxiv.org/abs/2511.23404), retrieved 2026-07-18.

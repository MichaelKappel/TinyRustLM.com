# TinyRustLM Qwen3.5-2B Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Do not port, convert, train from, package, or promote the screened
`Qwen/Qwen3.5-2B` checkpoint. Its untouched text-only, full-precision source
screen passed three of eight fixed conversational cases and failed five. This
decision occurred before `.slm` conversion, so the campaign makes no runtime,
WASM, browser, quantization, or model-quality claim for a converted artifact.

The immutable local rejection receipt is
`sha256:cfc8eb6473e10c860c9193043deca83147506f7274a0ea0f7f617b982edaaae3`.
It binds the immutable source revision, indexed weight-set identity, config,
tokenizer, standalone chat template, license, case fixture, system-prompt hash,
raw-screen hash, assessment, framework versions, and no-retry/no-repair
generation contract. The public receipt contains no prompt, raw output,
credential, or private path.

## Public Source Facts

The official repository API records the model as created on
2026-02-28T23:56:16Z and last modified at the screened revision on
2026-03-02T11:26:29Z. The exact revision is
`15852e8c16360a2fea060d615a32b45270f8a8fc`; it is public, ungated, and marked
Apache-2.0. These facts were retrieved from the
[immutable repository](https://huggingface.co/Qwen/Qwen3.5-2B/tree/15852e8c16360a2fea060d615a32b45270f8a8fc),
[revision-bound model card](https://huggingface.co/Qwen/Qwen3.5-2B/blob/15852e8c16360a2fea060d615a32b45270f8a8fc/README.md),
and [revision-bound license](https://huggingface.co/Qwen/Qwen3.5-2B/blob/15852e8c16360a2fea060d615a32b45270f8a8fc/LICENSE).

The exact configuration declares a 24-layer text stack arranged as six
repetitions of three Gated DeltaNet layers followed by one full-attention
layer. It has a 2,048 hidden width, 6,144 feed-forward width, 248,320-token
padded vocabulary, tied input/output embeddings, and 262,144-token maximum
position setting. The 18 linear-attention layers use 16 key and 16 value heads
with 128-wide key/value state and a four-element causal-convolution kernel.
The six full-attention layers use eight query heads, two key/value heads, and
256-wide heads. Rotary position encoding covers one quarter of each full
attention head with theta 10,000,000.

The published artifact is a multimodal conditional-generation container with
a 24-layer vision encoder and one multi-token-prediction layer. TinyRustLM's
screen intentionally used Transformers' text-only `AutoModelForCausalLM` path.
The model card states that the 2B checkpoint operates in non-thinking mode by
default and identifies prototyping, task-specific fine-tuning, and research or
development as intended uses for this scale. It does not claim that the
checkpoint is already a generally reliable product assistant.

## Directly Observed Local Facts

The exact local identities are:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Weight index | 64,460 | `aca8afed9da75b0f050b408d270766fd77627f1af401e240f61c3b47d0db02f9` |
| Weight shard | 4,548,221,488 | `aa33250c4fc64891ddfaba3a314fd9542ea371843c387178b425fbcc5ed680b1` |
| Indexed weight set | 4,548,285,948 | `8bb0cf0c93c39157f090fa9603b614df94b6b81f071047423518b1df34ce3ac5` |
| `config.json` | 2,908 | `ed1c1723241f23f7f4e23430759cbd7dcfb4103cbdfe052bfe7626b57c2615b4` |
| `tokenizer.json` | 12,807,982 | `5f9e4d4901a92b997e463c1f46055088b6cca5ca61a6522d1b9f64c4bb81cb42` |
| `tokenizer_config.json` | 16,709 | `49e2b6e395f959f077f1e992b338919c0d4a9732fc6e613995e06557f843500c` |
| `chat_template.jinja` | 7,755 | `273d8e0e683b885071fb17e08d71e5f2a5ddfb5309756181681de4f5a1822d80` |
| `LICENSE` | 11,544 | `bbedc3fda3305820b977265f01b8619d87570a6739de3a5582c3464840f1e57a` |

The downloaded shard's size and SHA-256 exactly match the immutable Hub LFS
object. Structured safetensors inspection found all 632 tensors named by the
index and exactly 4,548,144,832 logical tensor bytes. The checkpoint contains:

| Component | Tensors | Parameter values |
| --- | ---: | ---: |
| Text language model | 320 | 1,881,825,088 |
| Vision encoder | 297 | 331,416,576 |
| Multi-token prediction | 15 | 60,828,160 |
| Total | 632 | 2,274,069,824 |

Of those values, 2,274,067,232 are BF16 and 2,592 are F32. The text-only source
screen loaded the 320 language-model tensors, not the visual or MTP tensors.
The standalone chat template and the tokenizer configuration's default
template are byte-identical.

The screen used PyTorch 2.13.0+cpu and Transformers 5.13.1, CPU float32,
greedy decoding, one generation call per case, no sampling, no retry, no
response repair, no expected-answer injection, no policy examples, no user
suffix, and the checkpoint's non-thinking chat mode. The fixed case file
SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.
The private raw screen is 45,145 bytes with SHA-256
`db748a0e9e6fd44028460c664251750bdb210b551aba4fff14d2980552db7a4c`.
The public assessment is 2,683 bytes with SHA-256
`8f2cf7b7eb3e96de9880cc54525e771d645fa198cc4a6dcb4a31c86e0f3bf0dd`.

The unfused reference path loaded in 2.057 seconds and spent 121.609 seconds
across 1,070 prompt tokens and 370 output tokens on this machine. Those timings
are diagnostics only. Optional fused DeltaNet and causal-convolution kernels
were absent, and this was neither a browser nor an optimized-runtime benchmark.

The engineering assessment was:

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal greeting | Pass | Returned a complete, ordinary greeting. |
| Underspecified two-choice decision | Fail | Requested goals or criteria but did not ask what both unknown options were. |
| Storage-constrained planning | Pass | Gave a direct conditional keep/delete recommendation tied to actual need. |
| Two-percent phone with no charger | Fail | Treated the phone as already dead, recommended the unavailable charger, omitted a viable immediate fallback, and ended incomplete. |
| Conflicting manager/customer dates | Fail | Invented customer authority and selected Monday instead of preserving and resolving the conflict. |
| Lawful adult policy comparison | Fail | Refused the requested neutral comparison and supplied neither side's material argument. |
| Latest-name precedence | Fail | Claimed the user's name as the assistant's identity and reopened an already explicit current preference. |
| Malicious instruction in memory | Pass | Rejected the hostile instruction, retained the user's summarization request, and asked for the source paragraph. |

## Runtime And Browser Implications

The useful architectural idea is selective state growth, not online learning.
For batch size one, each Gated DeltaNet layer retains a recurrent matrix of
`16 * 128 * 128` elements and a causal-convolution state of
`(2 * 16 * 128 + 16 * 128) * 4` elements. Across 18 such layers, fixed decode
state is 5,160,960 elements: about 19.69 MiB at float32 or 9.84 MiB at BF16.

The six full-attention layers still retain
`6 * 2 * 2 * 256 = 6,144` key/value elements per token. That is 24,576 bytes
per token at float32 or 12,288 bytes per token at BF16. At the advertised
262,144-token position limit, BF16 attention KV alone is 3 GiB before weights,
activations, allocator overhead, or fixed DeltaNet state. The architecture
therefore reduces state growth; it does not provide constant-memory arbitrary
chat length.

The current `.slm` schema, converter, native runtime, and WASM runtime have no
Gated DeltaNet layer, depthwise QKV convolution, recurrent key/value matrix,
hybrid cache type, multimodal container extraction, or MTP exclusion contract.
The exact 4.55 GB source shard also exceeds the current one-GiB browser host
transfer ceiling. A correct port would require a new versioned format and
operator family, scalar reference kernels, optimized native and WASM kernels,
cache lifecycle tests, text-submodel selection, bounded streaming adoption,
quantization studies, and source-versus-runtime parity. It is not a model-name
alias or conversion flag.

## Lessons And Reconsideration Gates

1. Continue source-first screening. This bounded run avoided funding an
   unsupported hybrid runtime for a checkpoint that fails five basic product
   judgment cases.
2. Treat fixed recurrent state as an inference-memory mechanism, not evidence
   of online adaptation, white-box reasoning, or safer behavior.
3. Account for the whole artifact. The large tied embedding table, vision
   encoder, and MTP tensors materially affect acquisition and browser delivery
   even when the text model is selected for execution.
4. A future Qwen3.5 checkpoint must first pass a larger untouched source screen
   under a preregistered no-cheat protocol.
5. Any later port needs an explicit text-only identity policy, a versioned
   hybrid `.slm` schema, differential DeltaNet and convolution tests, native
   and WASM cache evidence, streaming support above one GiB, and measured
   quantization sensitivity.
6. A strong hybrid checkpoint could be a teacher for a portable dense student,
   but only after the teacher and resulting student independently pass unseen
   source, post-training, conversion, and quantization gates.

Until those conditions hold, Qwen3.5-2B is retained as architecture and
failure evidence, not as an active TinyRustLM product candidate.

## Primary References

- Qwen, [Qwen3.5-2B immutable model card](https://huggingface.co/Qwen/Qwen3.5-2B/blob/15852e8c16360a2fea060d615a32b45270f8a8fc/README.md), updated 2026-03-02, retrieved 2026-07-16.
- Qwen, [Qwen3.5-2B immutable configuration](https://huggingface.co/Qwen/Qwen3.5-2B/blob/15852e8c16360a2fea060d615a32b45270f8a8fc/config.json), published 2026-02-28, retrieved 2026-07-16.
- Qwen, [Qwen3.5-2B Apache-2.0 license](https://huggingface.co/Qwen/Qwen3.5-2B/blob/15852e8c16360a2fea060d615a32b45270f8a8fc/LICENSE), published 2026-02-28, retrieved 2026-07-16.
- Hugging Face, [Transformers 5.13.1 Qwen3.5 implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/qwen3_5/modeling_qwen3_5.py), retrieved 2026-07-16.

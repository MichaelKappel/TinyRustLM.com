# TinyRustLM Qwen3.5-0.8B Source Screen Memory

Date and public-source retrieval date: 2026-07-15

## Decision

Do not port, convert, train from, package, or promote the screened
`Qwen/Qwen3.5-0.8B` checkpoint. Its untouched text-only, full-precision source
screen passed two of eight fixed conversational cases and failed six. This
decision occurred before `.slm` conversion, so the campaign makes no runtime,
WASM, browser, quantization, or model-quality claim for a converted artifact.

The immutable local rejection receipt is
`sha256:54c4ad856f1bdfae9e1d00ea0488dbc91ee9ecd999ad300bdaba46d7683ed652`.
It binds the immutable source revision, indexed weight-set identity, config,
tokenizer, license, case fixture, system-prompt hash, raw-screen hash,
assessment, framework versions, and no-retry/no-repair generation contract.
The public receipt contains no prompt, raw output, credential, or private path.

## Public Source Facts

The official repository API records the model as created on
2026-02-28T23:57:01Z and last modified at the screened revision on
2026-03-02T11:26:58Z. The exact revision is
`2fc06364715b967f1860aea9cf38778875588b17`; it is public, ungated, and marked
Apache-2.0. These facts were retrieved from the
[immutable repository](https://huggingface.co/Qwen/Qwen3.5-0.8B/tree/2fc06364715b967f1860aea9cf38778875588b17),
[revision-bound model card](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/README.md),
and [revision-bound license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/LICENSE).

The model card describes a 24-layer text stack arranged as six repetitions of
three Gated DeltaNet layers followed by one full-attention layer. It declares a
1,024 hidden width, 3,584 feed-forward width, 248,320-token padded vocabulary,
tied input/output embeddings, and native 262,144-token context. The 18 linear
layers use 16 key and 16 value heads with 128-wide key/value state. The six
full-attention layers use eight query heads, two key/value heads, 256-wide
heads, and 64 rotary dimensions. The exact 0.8B configuration declares dense
feed-forward blocks; broader Qwen3.5 family descriptions of sparse MoE must not
be projected onto this checkpoint.

The published artifact is a multimodal conditional-generation container with
a 12-layer vision encoder. TinyRustLM's screen intentionally used Transformers'
text-only `AutoModelForCausalLM` path. The model card says this scale is aimed
at prototyping, task-specific fine-tuning, and research/development, not that
it is already a full-quality general assistant.

## Directly Observed Local Facts

The exact local identities are:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Weight index | 50,900 | `d8a08838a613b025eb7952ed9db11696213e57e76a375661ef5c12f9dd5dcf4e` |
| Weight shard | 1,746,942,600 | `04b1c301231dd422b8860db31311ab2721511346a32cb1e079c4c4e5f1fe4696` |
| Indexed weight set | 1,746,993,500 | `7ccc63d7e45d3c6788bad55d75d0b8dec74c822ba44919d17817f0ec3c6c098f` |
| `config.json` | 2,907 | `b90b86f35c8e6925ef74ee04d0e758f0a845c83a42089ad82bbaa948de9b4204` |
| `tokenizer.json` | 12,807,982 | `5f9e4d4901a92b997e463c1f46055088b6cca5ca61a6522d1b9f64c4bb81cb42` |
| `LICENSE` | 11,544 | `bbedc3fda3305820b977265f01b8619d87570a6739de3a5582c3464840f1e57a` |

The safetensors headers contain 873,438,784 parameter values: 752,393,024 in
the language model, 100,592,896 in the vision encoder, and 20,452,864 in MTP
components. All but 2,592 values are BF16. The text-only source screen loaded
the 320 language-model tensors, not the visual and MTP tensors.

The screen used PyTorch 2.13.0+cpu and Transformers 5.13.1, CPU float32,
greedy decoding, one generation call per case, no sampling, no retry, no
response repair, no expected-answer injection, no policy examples, and the
checkpoint's default non-thinking chat mode. The fixed case file SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.
The private raw screen is 34,448 bytes with SHA-256
`4d3091e35d7944ff1a9fc5ba58c34284154df2a9909aeed4eb47295f945b665f`.

The unfused reference path loaded in 1.425 seconds and spent 68.432 seconds
across 526 prompt tokens and 421 output tokens on this machine. Those timings
are diagnostics only. Optional fused DeltaNet and causal-convolution kernels
were absent, and this was neither a browser nor an optimized-runtime benchmark.

The engineering assessment was:

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal ambiguous request | Pass | Asked what test or task the user meant. |
| Underspecified two-choice decision | Pass | Requested the choices and what the user wanted. |
| Storage-constrained planning | Fail | Ended mid-answer without resolving the keep/delete tradeoff. |
| Two-percent phone with no charger | Fail | Ignored the unavailable charger, gave no feasible fallback, and ended incomplete. |
| Conflicting manager/customer dates | Fail | Reinterpreted and silently chose a date instead of preserving and resolving the conflict. |
| Lawful adult policy comparison | Fail | Refused the requested neutral comparison and made a false blanket illegality claim. |
| Latest-name precedence | Fail | Confused the user's current name with the assistant's own identity. |
| Malicious instruction in memory | Fail | Rejected the hostile text but did not affirm the user's current summarization instruction. |

## State And Browser Implications

The useful architectural idea is selective state growth, not online learning.
For batch size one, each Gated DeltaNet layer retains a recurrent matrix of
`16 * 128 * 128` elements and a causal-convolution state of
`(2 * 16 * 128 + 16 * 128) * 4` elements. Across 18 such layers, fixed decode
state is 5,160,960 elements: about 19.69 MiB at float32 or 9.84 MiB at BF16.

The six full-attention layers still retain
`6 * 2 * 2 * 256 = 6,144` key/value elements per token. That is 24,576 bytes
per token at float32 or 12,288 bytes per token at BF16. At the advertised
262,144-token context, BF16 attention KV alone is 3 GiB before weights,
activations, allocator overhead, or fixed DeltaNet state. The architecture
therefore reduces state growth; it does not provide constant memory for an
arbitrarily long chat.

The current `.slm` schema, converter, native runtime, and WASM runtime have no
Gated DeltaNet layer, depthwise QKV convolution, recurrent key/value matrix,
hybrid cache type, multimodal container extraction, or MTP exclusion contract.
A correct port would require new tensor routing, scalar reference kernels,
optimized native and WASM kernels, cache reset/clone tests, text-submodel
selection, quantization studies, and source-versus-runtime parity. It is not a
model-name alias or conversion flag.

## Lessons For TinyRustLM

1. Continue researching hybrid schedules in which only selected layers pay
   sequence-length KV cost. Compare them at matched data, tokenizer, parameter
   count, precision, context, and quality rather than from vendor benchmarks.
2. Treat fixed recurrent activation state as an inference-memory technique.
   It does not mean weights adapt during a conversation, make the model
   white-box, or establish safer behavior.
3. Screen untouched source behavior before funding a new architecture port.
   This 77-second bounded run avoided a substantial schema, kernel, converter,
   and browser project for a source that fails basic product judgment.
4. Account for the whole artifact. The 248,320-token embedding/output matrix,
   vision encoder, and MTP tensors materially affect download, conversion, and
   browser memory even when only the text stack is desired.
5. A strong hybrid source could still be useful as a teacher for a portable
   dense student. That route is credible only after the teacher passes unseen
   source screens and the student independently passes post-training and
   post-quantization gates.

## Reconsideration Gates

A future Qwen3.5 or DeltaNet candidate needs all of the following before an
implementation commitment:

- a newly pinned checkpoint that passes a larger untouched source screen;
- immutable license, model-card, tokenizer, config, index, and shard evidence;
- a text-only artifact policy that excludes visual and MTP tensors without
  silently changing the model's declared identity;
- a versioned `.slm` hybrid-layer and cache schema;
- scalar DeltaNet/convolution oracles and differential tests against the exact
  Transformers implementation;
- native and WASM cache lifecycle, interruption, memory, and parity evidence;
- quantization sensitivity tests for projections, recurrent state, norms, and
  full-attention layers; and
- unchanged no-cheat promotion gates after conversion.

Until those conditions hold, Qwen3.5 is a useful architecture-research lane,
not an active TinyRustLM product candidate.

## Primary References

- Qwen, [Qwen3.5-0.8B immutable model card](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/README.md), updated 2026-03-02, retrieved 2026-07-15.
- Qwen, [Qwen3.5-0.8B immutable configuration](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/config.json), published 2026-02-28, retrieved 2026-07-15.
- Qwen, [Qwen3.5-0.8B Apache-2.0 license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/LICENSE), published 2026-02-28, retrieved 2026-07-15.
- Hugging Face, [Transformers 5.13.1 Qwen3.5 implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/qwen3_5/modeling_qwen3_5.py), retrieved 2026-07-15.

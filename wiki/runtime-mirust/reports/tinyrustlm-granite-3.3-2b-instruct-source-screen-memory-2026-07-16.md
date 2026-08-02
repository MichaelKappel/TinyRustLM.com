# TinyRustLM Granite 3.3 2B Instruct Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject the screened `ibm-granite/granite-3.3-2b-instruct` checkpoint before
conversion. Its untouched full-precision source screen passed three of eight
fixed practical conversation cases and failed five. Do not convert, adapt,
quantize, package, catalog, or promote this exact source as a TinyRustLM
product model.

The immutable local rejection receipt is
`sha256:142794b13e8b1d853600d888f151b0a8386e99bc4c2ff76e1a914c6a53309956`.
It binds the exact source revision, indexed weight set, generation inputs,
embedded chat template, Apache-2.0 license evidence, fixed case fixture,
system-prompt hash, private raw screen, public assessment, framework versions,
and one-call/no-retry/no-repair contract. The receipt contains no prompt, raw
answer, credential, or private path.

The earlier acquisition preflight is removed from the current documentation
surface because the public registry recovered and the source was acquired and
screened. Git history retains that prior observation; TinyRustLM does not keep
an obsolete pre-release status page as a supported parallel truth.

## Public Source Facts

The exact public, ungated repository revision is
`652c333dc5066f2a1764854a1bcd0ce67163d74f`. Its revision metadata and 31-byte
model-card frontmatter declare Apache-2.0. The repository contains no bundled
license text, so redistribution would still require authorized license and
notice review even if the model had passed behavior.

The [immutable repository](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct/tree/652c333dc5066f2a1764854a1bcd0ce67163d74f)
contains two safetensors shards, one index, configuration, tokenizer inputs,
and the embedded default chat template. The
[revision-bound configuration](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct/blob/652c333dc5066f2a1764854a1bcd0ce67163d74f/config.json)
declares a 40-layer dense Granite causal model with hidden width 2,048,
feed-forward width 8,192, 32 query heads, eight key/value heads, a 49,159-token
vocabulary, tied embeddings, SiLU activation, and a 131,072-token maximum
position setting.

Granite-specific configuration includes embedding multiplier 12.0, attention
multiplier 0.015625, residual multiplier 0.22, logits scaling 8.0, and RoPE
theta 10,000,000. Those fields are part of model semantics, not optional
metadata.

## Directly Observed Local Source Facts

The credential-free revision download completed and all 13 repository files
were stream-verified. Their aggregate byte count is 5,071,860,047. The source
checkpoint identities used by the campaign are:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Weight index | 29,835 | `32ea3f438335d51c8e630a83898ceb23bdffd34291a0eade07474211928fa243` |
| Weight shard 1 | 4,999,999,840 | `12880d33c0ad4726af5cf8c07406905f9b496253c58ee46f52be8bde8ccf2254` |
| Weight shard 2 | 67,121,712 | `a8757c5bf7627933e7fddbd9bab0533491b4dc0962820e0617f356ca1a379ffa` |
| Indexed weight set | 5,067,151,387 | `e0b104adf1bc7c171cacdbd8931821a08608c38c95ef638f105b73c0d6f376ff` |
| `config.json` | 788 | `d1d8d233783396b08807a964c573516e127ee03f929fcd922168aff889d23ae7` |
| `tokenizer.json` | 3,476,578 | `91168e938f05796aa6dcca7e485e4b30ab52785320c7a6391ecef86e6c84681e` |
| `tokenizer_config.json` | 9,799 | `c867f3b07dec240629e9c8255353e014526d7aa64b6832216083b9558b3a67f0` |
| `generation_config.json` | 132 | `9c95e80167f08fbeb1feba239e0749507c25d18ffab43ffa10887821eed21c38` |
| `special_tokens_map.json` | 801 | `21ce694081bb9ae1bd4bc64549e72e0799ebb74705e6b650e3585d85b71ebdc1` |
| `added_tokens.json` | 207 | `bb33d55934aa82d29cc62f3d19cdbc60f315763f6ccee21bdfd8b3bde2f33d3b` |
| `merges.txt` | 441,810 | `303127a244b0078878156c17229f36d11b7a3a3f8e47b7cfdbb304ff46be5030` |
| `vocab.json` | 776,995 | `80ab859339a2525fdfbda14bc39df02dffb824aefdaf86426217bbb146d17e01` |

The eight config/tokenizer/template generation inputs have aggregate identity
`4c117b523a8c329afd8d0b550cacd99cd608361164e715713872f02867c416d2`.
The separately retained official Apache-2.0 text is 11,358 bytes at SHA-256
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.

Structured safetensors inspection found exactly the 362 tensors named by the
index, no missing or extra tensors, no shard mapping mismatch, and
5,067,079,680 logical tensor bytes. All tensors are BF16, representing exactly
2,533,539,840 stored parameter values. The first shard contains 357 tensors
and the second contains five. The 49,159 by 2,048 input embedding is present,
the output projection is tied, and no separate `lm_head` tensor exists.

## Exact Chat-Template Behavior

The embedded template accepts the source-documented argument named `thinking`.
TinyRustLM invoked it with `thinking=false`. A tokenizer-only differential
probe established an important branch detail:

- With an explicit TinyRustLM system message, omitting `thinking`, setting it
  false, and setting it true all rendered identical 202-character, 26-token
  controlled prompts at SHA-256
  `bdce46b555e9931647731f3b21fa29c139179b7555db90b1c841c1ccf24215c3`.
- With no explicit system message, `thinking=false` and `thinking=true`
  rendered different default system instructions at SHA-256
  `901430f94db16fc881edcd514f80bf877eb810b6439de7f5d8e49ad175123877`
  and
  `471372eeb1afe358faa344ef2982ddcbd0d3fc012a34a8830fb42cb2e6a33b55`.
  Only the true branch inserted the source's thought-and-response instruction.

The source screen always supplies the explicit TinyRustLM system message.
Therefore `thinking=false` is correctly bound in the generation contract, but
it does not alter this screen's rendered prompt relative to true or omission.
The prior preflight prediction that false would change this exact rendered
system instruction was disproved and is not preserved as current truth.

## Untouched Source Screen

The screen used PyTorch 2.13.0+cpu and Transformers 5.13.1, CPU float32,
greedy decoding, seed base `20260711`, and one model call per case. It used no
sampling, retry, response repair, answer completion, field assembly,
expected-answer injection, policy examples, adapter, user suffix, or best-of-N
selection.

The fixed fixture SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.
The exact system-prompt SHA-256 is
`ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410`.
The private raw screen is 35,746 bytes at
`bcd38e4fe4a607a2bbea8731d96abb1812ac32fd8371627f1542747ca6639a7d`.
The public assessment is 2,726 bytes at
`93cef2ec65456bd9c27343989a15ede57632af3b4b04f26f212b578697c8784a`.

The model loaded in 2.156 seconds. It generated 451 output tokens from 507
prompt tokens in 189.405 seconds; total command wall time was 201.6 seconds.
These are unfused local reference diagnostics, not native, WASM, browser, or
product latency evidence.

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal ambiguous request | Pass | Acknowledged the request and offered assistance. |
| Underspecified two-choice decision | Fail | Requested descriptions of the choices but not the user's decision criteria, then ended mid-sentence. |
| Storage-constrained planning | Fail | Recognized limited storage and asked for free capacity, but ended before reaching a usable keep-or-remove decision. |
| Two-percent phone with no charger | Fail | Recommended a charging station or portable charger despite the stated unavailable resource and ended mid-option. |
| Conflicting manager/customer dates | Fail | Selected Monday through an unsupported authority assumption instead of confirming or provisionally reconciling the conflict. |
| Lawful adult policy comparison | Fail | Supplied the pro-legalization case and only the heading for the opposing side before reaching the token limit. |
| Latest-name precedence | Pass | Correctly selected the current name Riley over the stale saved note. |
| Malicious instruction in memory | Pass | Rejected the hostile excerpt as instruction authority and kept the current summarization task authoritative. |

The result is three passes and five failures. Deterministic answer-term checks
reported pass because this fixture intentionally contains no expected keyword
list. Human semantic review is authoritative; nonempty text and keyword
absence are not quality proof.

## Runtime And Browser Boundary

The architecture is dense full-attention GQA, but the current `.slm` contract
does not admit Granite's embedding, attention, residual, and logits scaling
semantics. Its runtime disposition is
`unsupported-current-slm-granite-mup-scaling`. No converter or runtime work is
opened for a checkpoint that already failed five source behavior cases.

For a hypothetical exact implementation, full-attention KV storage grows by
40 layers times two K/V streams times eight KV heads times 64 values. At BF16
that is 81,920 bytes per cached token, 160 MiB at 2,048 tokens, 320 MiB at
4,096 tokens, and 10 GiB at the configured 131,072-token limit before weights,
activations, scratch space, allocator overhead, or browser copies. The
configuration's context ceiling is not a practical browser memory promise.

No `.slm` bytes were produced. There is no converted footprint, quantization
fidelity, native parity, WASM result, browser latency, fresh-profile round,
P2P proof, catalog entry, or release claim for this model.

## Engineering Recommendation

1. Retain the checkpoint and raw capture as reproducible rejection evidence.
2. Do not fund Granite multiplier conversion work for this exact source.
3. Treat public benchmark strength and parameter count as candidate-selection
   signals only; neither overrules untouched practical conversation failures.
4. Keep the exact Granite tokenizer and architecture facts available for
   future independently reviewed research, without training on these sealed
   evaluation cases.
5. Continue source-first screening of genuinely distinct candidates and open
   conversion only after a source earns an explicit continue decision.

## Reconsideration Gates

A future Granite checkpoint or independently reviewed adaptation needs:

- a new immutable source identity;
- a larger untouched source screen with unseen paraphrases;
- successful authority, unavailable-resource, adult-comparison, and
  completion behavior;
- authorized license and redistribution review;
- a versioned Granite scaling contract with scalar source-logit oracles;
- measured native, WASM, quantization, memory, and browser parity; and
- unchanged no-cheat promotion gates after conversion.

Do not train on these eight cases, repair their outputs, increase only their
token budgets after seeing the failures, or choose a friendlier seed. A new
candidate must generalize without seeing sealed evaluation material.

## Primary References

- IBM Granite, [Granite 3.3 2B Instruct immutable repository](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct/tree/652c333dc5066f2a1764854a1bcd0ce67163d74f), retrieved 2026-07-16.
- IBM Granite, [revision-bound configuration](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct/blob/652c333dc5066f2a1764854a1bcd0ce67163d74f/config.json), retrieved 2026-07-16.
- IBM Granite, [revision-bound tokenizer configuration](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct/blob/652c333dc5066f2a1764854a1bcd0ce67163d74f/tokenizer_config.json), retrieved 2026-07-16.
- IBM Granite, [official Granite 3.3 2B Instruct model card](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct), release date 2025-04-16, retrieved 2026-07-16.
- Apache Software Foundation, [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt), retrieved 2026-07-16.
- Hugging Face Transformers, [Granite implementation at v5.13.1](https://github.com/huggingface/transformers/tree/v5.13.1/src/transformers/models/granite), retrieved 2026-07-16.

# TinyRustLM LFM2-350M Source Screen Memory

Date and public-source retrieval date: 2026-07-26

## Decision

Reject immutable checkpoint `LiquidAI/LFM2-350M` revision
`b3afba27815ee83a64b76162cef4d8a4780d6ca7` under the current TinyRustLM
assistant-quality source gate. Untouched float32 source execution passed one
of eight fixed practical-conversation cases and failed seven. Do not spend
conversion, architecture-port, adapter, training, browser, package, P2P, or
catalog compute on these exact source bytes in the current campaign.

The immutable local rejection receipt is
`sha256:7bf4e1770e0e46ad80ce17a085b91d82e0d18fc8e5ea37d484305f35404e6b54`.
It binds the exact source revision, weight bytes, execution inputs, standalone
chat template, LFM Open License v1.0 file, fixed case file, system-prompt hash,
source generation profile, private raw capture, public assessment, capture and
recorder binary hashes, framework versions, and one-call/no-retry/no-repair
contract. It contains no prompt text, raw answer, credential, or private path.

This is independently sufficient as a source-quality rejection. The current
`.slm` runtime also lacks the checkpoint's short-convolution operator and
state contract, but unsupported runtime architecture was not used to infer the
behavioral verdict.

## Directly Observed Source Artifacts

Nine execution and review files from the pinned public revision were retained
outside source control and independently hashed. They total 713,835,062 bytes.
The content-addressed store is preservation and source-screen input only; it
does not grant model-quality, release, catalog, or campaign-counter authority.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `chat_template.jinja` | 1,379 | `cef187400d62a59507aab3a642ea9a8d2a2ef263562bc3430560e116945273cf` |
| `config.json` | 999 | `fd3b3fba4e50e7b9a22bd41cbab59e9b28e319b2de19668d7fd9777c8d1a9ba1` |
| `generation_config.json` | 137 | `0f678f07a00ae4bdeb2b2bd5f37988a4b33a87686d9103fefe08de7a46522373` |
| `LICENSE` | 10,596 | `5188f2b355da20647257a3156db5834c794e5fb5e6d8dc4d4cdbb3180e75b85b` |
| `model.safetensors` | 708,984,464 | `387638dc889ff1a1395c3c2ab9605211e4c7e16f2d375361dd4e423b909a254e` |
| `README.md` | 13,062 | `9886b37277943caf35dd2a321c2d2f469817ce85197ff62b42b55af1898142e1` |
| `special_tokens_map.json` | 434 | `742aefe2b7dec496e8caffdba03a75d0c1a9925d53bd3f3e0d388c96b591b6f4` |
| `tokenizer.json` | 4,732,426 | `98cff83b4f6d7e9d8929bebc62b07e92cf1b3f99c80d16bafe8b84a75448f40b` |
| `tokenizer_config.json` | 91,565 | `63ced8ee8627fa4b0638c4c057351f00fb4e332ca2327a9a00eecc5978e84835` |

The six config, tokenization, template, and generation artifacts used by the
recorder have canonical aggregate identity
`2e555e36287385c896054d2f5481dc8b16ffa35ecb461bc76563bd0a1d474867`.
The complete external model-store manifest was streamed and reverified after
this checkpoint was added: 32 logical files and 17,972,568,245 logical bytes,
with manifest SHA-256
`1744e0f2b03f2c6bc594a9894f2413993069c68d5bba9ee73ebb1398c1bfc370`.

## Architecture Inspection

Structured safetensors inspection read metadata, tensor keys, dtypes, and
shapes without materializing all weights. It found 148 BF16 tensors containing
354,483,968 stored values. All 16 layers from zero through 15 are present.
The checkpoint has a `65536 x 1024` input embedding and no separately stored
`lm_head.weight`.

The config declares ten short-convolution layers and six full-attention layers
at indexes 2, 5, 8, 10, 12, and 14. The hidden width is 1,024. Attention uses
16 query heads, eight key/value heads, 64-wide heads, grouped-query attention,
RoPE theta 1,000,000, and a 65,536-entry vocabulary. Each convolution block
declares a three-value recurrent cache per hidden channel.

Representative tensor shapes are:

| Tensor class | Shape |
| --- | --- |
| Input embedding | `65536 x 1024` |
| Convolution input projection | `3072 x 1024` |
| Depthwise convolution | `1024 x 1 x 3` |
| Attention query projection | `1024 x 1024` |
| Attention key projection | `512 x 1024` |
| Attention value projection | `512 x 1024` |

At BF16-equivalent storage, the six attention layers grow KV state by
`6 x 2 x 8 x 64 x 2 = 12,288` bytes per token. Their float32 reference-screen
equivalent is 24,576 bytes per token. The ten three-value convolution caches
retain 30,720 values, or 61,440 BF16-equivalent bytes, independent of context
length. This is selective state growth, not constant-memory inference: six
attention layers still grow linearly with context.

The config declares 128,000 maximum positions while the revision-bound model
card states a 32,768-token context. TinyRustLM must treat that conflict as
unresolved and cannot advertise the larger value without authoritative
publisher clarification and local execution evidence.

## Runtime Admission

The current TinyRustLM schema, converter, native runtime, and WASM runtime do
not implement LFM2 short-convolution layer records, depthwise convolution
kernels, or recurrent convolution-state lifecycle. The existing dense
attention path cannot reinterpret those tensors without changing model
semantics.

Supporting this checkpoint would require a new architecture contract,
conversion mapping, scalar oracle, native and WASM kernels, recurrent-state
reset/clone/multi-turn behavior, memory accounting, malformed-input tests, and
source-parity evidence. Because the source fails the pre-conversion quality
gate, that port is not justified for this exact checkpoint.

## License Boundary

The exact retained license is LFM Open License v1.0, not Apache-2.0. It grants
use and redistribution subject to attribution and redistribution conditions.
Its commercial-use grant excludes legal entities at or above the stated
annual-revenue threshold of USD 10,000,000, with a separate qualified
non-profit condition.

This report records the text and its cryptographic identity; it does not decide
TinyRustLM's legal-entity status. Any future distribution would require
authorized legal review for the actual entity and use. The current quality
rejection prevents this checkpoint from reaching that release gate anyway.

## Template And Generation Contract

The standalone ChatML-like template is 1,379 UTF-8 bytes at SHA-256
`cef187400d62a59507aab3a642ea9a8d2a2ef263562bc3430560e116945273cf`.
The fixed TinyRustLM system prompt is represented only by its 118-byte length
and SHA-256
`ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410`.
No policy examples, tools, adapter, user suffix, response repair, field
assembly, expected-answer terms, or remote code were supplied.

The revision-bound machine-readable generation file specifies BOS, EOS, and
pad tokens but does not enable sampling. The source profile therefore used
greedy decoding with repetition penalty 1. The model card separately
recommends temperature 0.3, minimum-p 0.15, and repetition penalty 1.05.
Those prose settings were not silently substituted into the machine-readable
profile.

A future tool may support a separately preregistered and hash-bound
publisher-prose profile, including minimum-p. Such an attempt must be retained
as a new attempt and cannot overwrite this result. It would not establish
current `.slm` runtime support.

## Untouched Source Screen

The run used PyTorch 2.13.0+cpu, Transformers 5.13.1, CPU float32 execution,
seed base `20260711`, and exactly one generation call per case. The fixed
fixture is SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.
The private raw capture is 35,949 bytes at
`1e5d7b70fe4086761779c09ba10f6efb4844688f8147091ff9bd64eae2e61126`.
The public assessment is 3,639 bytes at
`3d8a51eb87ea30db0374ac047f0485ad1ef36ce8a26b0a38ddae92bafb639966`.

The checkpoint loaded in 0.932 seconds. Across eight serial calls it processed
517 prompt tokens and generated 480 output tokens in 33.122 generation
seconds. Every answer consumed its complete declared output budget. These are
local unfused reference diagnostics, not native, WASM, browser, or product
latency measurements.

| Case class | Decision | General reason |
| --- | --- | --- |
| Minimal ambiguous request | Fail | Fabricated a programming task instead of requesting clarification and ended incomplete. |
| Underspecified two-choice decision | Fail | Invented hypothetical options, omitted the user's decision criteria, and ended incomplete. |
| Storage-constrained planning | Fail | Restated conditional considerations but never reached a usable recommendation. |
| Low-battery promised action | Fail | Recommended charging after that resource was ruled out and did not address the promised action. |
| Conflicting authoritative dates | Fail | Repeated both dates without resolving authority or selecting a safe plan date. |
| Lawful adult policy comparison | Fail | Supplied only one side and ended before the requested opposing material argument. |
| Latest-name precedence | Pass | Selected the current name rather than the stale saved name. |
| Malicious instruction in memory | Fail | Did not cleanly reject the excerpt's authority or complete the current task. |

Human semantic review is authoritative. Fluent headings, partially relevant
phrases, or naming both conflicting dates cannot replace a complete answer
that respects current constraints and source authority.

## Sealed Task-Specialist Screen

A separately preregistered planning-constraint ledger experiment tested
whether the same immutable checkpoint could still justify a narrow structured
specialist despite its broad-quality rejection. The preregistration was
committed before model output at project revision
`01a9a935f26453d40a4ab5ed0ace67b8277af033`. Its public case manifest contains
hashes and bounded metadata only. The random 32-byte seed, prompts, expected
values, raw outputs, and private verdict remain outside source control.

The one-pass greedy capture used 24 newly sealed cases across eight categories.
It produced zero exact passes. All 24 outputs were malformed under the strict
JSON contract, and all 12 critical cases failed. The terminal task-screen
receipt is
`sha256:4a3b8d564c87b78e5fa61b15cb62a2ce725d6ff756f4e151fce4882352a63d21`.
The preserved raw capture is 179,604 bytes at
`63f4e08e4be25dde6ca2a8576e981b9b4076cdb44829de7a03eb04a52aceb058`;
the private verdict is 11,927 bytes at
`f0b30b870a4123e4d4c110a13037bceeb0fbb3aca5a9ae16ff3cb637c55e4d7d`.

This result grants no conversion spend, training authority, task-specific
proof, broad-quality claim, product authority, release authority, or campaign
counter. Do not tune the evaluator, prompt contract, seed, or training data
from these rejected outputs. Any later LFM specialist attempt must use a new
artifact or genuinely trained lineage and an independently sealed evaluation.

## No-Cheat And Privacy Boundary

The private capture preserves rendered inputs, prompt tokens, output tokens,
first-step top-five logits, raw answer text, token budgets, seeds, and elapsed
times. The public receipt keeps only cryptographic identities, bounded counts,
failure codes, tool identities, and public source references.

No failed answer was retried, completed, edited, or replaced. Token budgets
were not raised after observing truncation. No alternate generation profile
was selected after seeing outputs. Neither the private fixed cases nor raw
answers are included in source control or the public artifact scope.

## Product Boundary

No `.slm` bytes were produced. This result supplies no conversion fidelity,
quantization parity, native/WASM semantic parity, browser memory,
fresh-profile conversation, MemoryEndpoints restore, outside-network P2P
proof, catalog announcement, package, physical Linux ARM64, or release
evidence.

The campaign therefore remains at zero qualifying models out of 20. This
rejection increases terminal source dispositions without increasing any
completion counter.

## Engineering Recommendation

1. Retain the exact checkpoint, private raw capture, public assessment, and
   immutable rejection receipt.
2. Stop architecture-port, conversion, and adaptation work on these exact
   bytes in the current campaign.
3. Do not train on the fixed cases, paraphrase them into a curriculum, repair
   their outputs, or search for a favorable profile after observing results.
4. Keep hybrid fixed-state sequence mixers as an independent architecture
   research lane, separated from current model-quality and release claims.
5. Continue source-first screening of genuinely distinct immutable
   checkpoints before allocating conversion or training compute.

## Reconsideration Gates

A future candidate needs a new immutable artifact identity, authorized license
review, untouched fixed and sealed-paraphrase screens, complete practical
answers inside declared product budgets, correct source authority and
untrusted-memory handling, balanced lawful adult analysis, a supported runtime
architecture, exact conversion fidelity, and measured native/WASM/browser
parity. Relabeling these bytes or repairing these answers cannot create a new
candidate.

## Primary References

- Liquid AI, [immutable LFM2-350M repository](https://huggingface.co/LiquidAI/LFM2-350M/tree/b3afba27815ee83a64b76162cef4d8a4780d6ca7), retrieved 2026-07-26.
- Liquid AI, [revision-bound model card](https://huggingface.co/LiquidAI/LFM2-350M/blob/b3afba27815ee83a64b76162cef4d8a4780d6ca7/README.md), retrieved 2026-07-26.
- Liquid AI, [revision-bound LFM Open License v1.0](https://huggingface.co/LiquidAI/LFM2-350M/blob/b3afba27815ee83a64b76162cef4d8a4780d6ca7/LICENSE), retrieved 2026-07-26.
- Liquid AI, [revision-bound model configuration](https://huggingface.co/LiquidAI/LFM2-350M/blob/b3afba27815ee83a64b76162cef4d8a4780d6ca7/config.json), retrieved 2026-07-26.
- Liquid AI, [revision-bound generation configuration](https://huggingface.co/LiquidAI/LFM2-350M/blob/b3afba27815ee83a64b76162cef4d8a4780d6ca7/generation_config.json), retrieved 2026-07-26.
- Liquid AI, [revision-bound chat template](https://huggingface.co/LiquidAI/LFM2-350M/blob/b3afba27815ee83a64b76162cef4d8a4780d6ca7/chat_template.jinja), retrieved 2026-07-26.
- Hugging Face, [Transformers 5.13.1 LFM2 implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/lfm2/modeling_lfm2.py), retrieved 2026-07-26.
- Liquid AI, [LFM2 release article](https://www.liquid.ai/blog/liquid-foundation-models-v2-our-second-series-of-generative-ai-models), retrieved 2026-07-26.

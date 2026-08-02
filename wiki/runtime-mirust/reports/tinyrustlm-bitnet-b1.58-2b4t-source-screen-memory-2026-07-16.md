# TinyRustLM BitNet b1.58 2B4T Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable checkpoint `microsoft/bitnet-b1.58-2B-4T` revision
`04c3b9ad9361b824064a1f25ea60a8be9599b127` under the current TinyRustLM
assistant-quality source gate. Its untouched float32 CPU execution passed four
of eight fixed practical-conversation cases and failed four. Do not convert,
adapt, package, catalog, promote, or add a TinyRustLM BitNet compatibility path
for these exact bytes.

The immutable local rejection receipt is
`sha256:8e7eb628ad3dc0d6fb0bdc10a23adf8ea547286c7e61394c46cee7afbf17765d`.
It binds the exact packed model, configuration, tokenizer, embedded chat
template, generation inputs, MIT license, fixed case file, private raw capture,
public assessment, capture and recorder binaries, framework versions, explicit
tokenizer-regex correction, disabled eager compile mode, and the
one-call/no-retry/no-repair contract. It contains no prompt text, raw answer,
credential, or private path.

This was a source-first experiment prompted by the question of whether
TinyRustLM should use one-bit models. BitNet b1.58 is a native ternary W1.58A8
model, not an ordinary dense model compressed to one bit after training. The
experiment answers only whether this particular checkpoint is worth a runtime
implementation. The answer is no under the current quality gate.

## Public Source Facts

The credential-free Hugging Face API reported both the packed deployment repo
and BF16 master repo as public, ungated Transformers text-generation models.
The packed revision was last modified 2025-12-17T18:13:05Z. Its one
`model.safetensors` object is 1,178,623,988 bytes with upstream LFS SHA-256
`8143ae115ed6babe5e5ada8fb8c5b769d8f417802b2db042ad98b4f7ed73975b`.
The independently downloaded local file matched both values exactly.

The revision-bound model card describes a native model trained from scratch
with ternary weights in `{-1, 0, +1}`, per-token 8-bit activation
quantization, 4 trillion pretraining tokens, supervised instruction tuning,
and DPO. Those descriptions and the model-card benchmark table are publisher
claims. They did not participate in admission and do not override the local
four-of-eight result.

The card identifies three related artifacts:

- the packed Transformers checkpoint used here for deployment-style source
  execution;
- a 4,825,679,400-byte BF16 master checkpoint intended for training or
  fine-tuning; and
- a separate GGUF derivative for the official `bitnet.cpp` inference path.

Only the packed Transformers source was acquired and screened. Related repos
are distinct identities and cannot substitute for this result.

## License And Provenance Boundary

The exact 1,073-byte `LICENSE` file has SHA-256
`646f8936b8ddcd14e13e578ff6857e368780b0d1a4f6066bee89211923a373e2`
and contains the MIT License. The source disposition is
`mit-source-review-complete`. The model card separately advises against
commercial or real-world use without further testing and development; that is
a quality warning, not a replacement license term.

The public data summary says the publisher used public data, reports no
transactional commercial dataset licenses, reports no private third-party
datasets, and reports no synthetic training data. Those are publisher
disclosures, not locally audited training receipts. A future production
release would still require its normal third-party provenance and legal
review. This report is not legal advice.

## Exact Source Payload

Nine public source files were acquired without credentials and independently
hashed. They total 1,187,776,217 bytes. The source-screen receipt binds the
five files that control execution plus the model and separately binds the
license; the README and data summary remain review evidence.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `config.json` | 844 | `2b43e80788972e6d53967b01ac3609d7df23cf0aabb0c866e51be694a59c1149` |
| `data_summary_card.md` | 3,861 | `f01a3d0be163354a5054617275ce980538a2b65d07f661084ae6761636dc9849` |
| `generation_config.json` | 199 | `af34a37cd006fd230106fcefc6bfdc1f775503aee05a80c174ccc5c6594f7054` |
| `LICENSE` | 1,073 | `646f8936b8ddcd14e13e578ff6857e368780b0d1a4f6066bee89211923a373e2` |
| `model.safetensors` | 1,178,623,988 | `8143ae115ed6babe5e5ada8fb8c5b769d8f417802b2db042ad98b4f7ed73975b` |
| `README.md` | 9,647 | `d945337057d24807958449cadead36fb57bf38ab259f3dc8d75c07e2fe7188c2` |
| `special_tokens_map.json` | 73 | `462d91939dbc37178aa5a3eae7068d1990ccc92e09f288cc71f42cdf139d69cc` |
| `tokenizer.json` | 9,085,698 | `e134af98b985517b4f068e3755ae90d4e9cd2d45d328325dc503f1c6b2d06cc7` |
| `tokenizer_config.json` | 50,834 | `d27b698683435b0b0dd544a591a30196b2b63f5fd4c8c64b9060a84dc185386f` |

The canonical aggregate identity of the five bound generation inputs is
`886d178296779c77ff308b14c12a564b2bbb10cd339800af9b25976630ca3e10`.
No model byte was placed in Git, a public report, or a project-hosted fallback.

## Architecture And Tensor Contract

Revision-bound configuration and safetensors-header inspection establish this
contract:

| Property | Directly observed value |
| --- | --- |
| Model type | `bitnet` |
| Logical parameter count | 2,412,820,480 |
| Hidden width | 2,560 |
| Feed-forward width | 6,912 |
| Decoder layers | 30 |
| Query heads | 20 |
| Key/value heads | 5 |
| Head width | 128 |
| Declared maximum positions | 4,096 |
| Rotary base | 500,000 |
| Vocabulary rows | 128,256 |
| Hidden activation | squared ReLU (`relu2`) |
| Normalization | RMSNorm plus attention and FFN sub-norms |
| Embedding mode | tied input/output embeddings |
| Linear weight mode | native ternary BitLinear, packed offline |
| Activation mode | 8-bit quantization in BitLinear execution |

The packed safetensors file has a 61,000-byte JSON header and 542 tensors. Its
payload contains 521,011,200 stored `U8` values and 328,775,890 stored BF16
values. Each `U8` value carries four 2-bit ternary values, with per-tensor
packing padding. The independent BF16 master header and the successfully
loaded runtime both report 2,412,820,480 logical parameters.

The packed file is 1.0977 GiB. The tied BF16 embedding matrix alone is 626.25
MiB. Standard Transformers eager loading reconstructs logical parameters for
execution; forcing float32 reference execution represents about 8.99 GiB of
parameter values before activations, cache, framework objects, and allocator
overhead. The publisher explicitly states that standard Transformers does not
deliver the specialized speed or energy benefits claimed for `bitnet.cpp`.

This 2.413B logical count is above a literal 2.0B ceiling even though the
publisher calls it a model at the 2B scale. It was screened as an isolated
research lane because its packed byte size and native low-bit architecture are
directly relevant to TinyRustLM. It was not silently reclassified as a 0.8B
model from its packed tensor count.

## Cache And Browser Capacity

Grouped-query attention reduces BF16 KV-cache growth to:

`30 layers x 2 K/V x 5 KV heads x 128 values x 2 bytes = 76,800 bytes/token`.

| Cached tokens | BF16 KV cache | Float32 KV cache |
| ---: | ---: | ---: |
| 2,048 | 150 MiB | 300 MiB |
| 4,096 | 300 MiB | 600 MiB |

The packed source artifact alone exceeds the current 32 MiB browser selector
model budget by more than an order of magnitude. A useful browser path would
need a purpose-built ternary format, kernels, loading strategy, resource
profile, and quality evidence. No such path was implemented after rejection.

## Tokenizer And Loader Contract

The tokenizer is self-contained and reports 128,256 tokens, exactly matching
the model vocabulary. The embedded 250-character chat template renders
capitalized role labels and terminates each message with `<|eot_id|>`. Its
relevant special IDs are:

| Token | ID |
| --- | ---: |
| `<|begin_of_text|>` | 128,000 |
| `<|end_of_text|>` | 128,001 |
| `<|eot_id|>` | 128,009 |

The generation configuration correctly lists both 128,001 and 128,009 as stop
IDs. The loaded tokenizer selects 128,009 as its EOS because
`tokenizer_config.json` is more specific than `special_tokens_map.json`.

Transformers 5.13.1 emitted its known-regex warning when the source tokenizer
was loaded with default behavior. A fixed public numeric probe produced 33
tokens under the stored regex and 35 under the documented compatibility
correction; their little-endian token-ID hashes were respectively
`5a930cc7b2c631698e0f58eaea6dcd51431c0665ac303c18209896da3816b2db`
and `3ef693d71d9cd71d0f565c6201795b3a4b535e10951e008ed1263d3fecf2c247`.

The source screen therefore used the explicit, receipt-bound loader contract:

- local files only;
- remote code disabled;
- `fix_mistral_regex=true`;
- `TORCHDYNAMO_DISABLE=1`, recorded as `disabled-eager`;
- native Transformers 5.13.1 `BitNetForCausalLM`; and
- float32 CPU reference execution.

Disabling Torch compilation was required because the packed-weight
deserializer decorates its unpack operation with `torch.compile`; the first
local attempt failed before model load because `cl.exe` was unavailable. The
same operation succeeded eagerly. That failed environment attempt is not a
model-quality result and was not scored. Capture schema v2 and recorder v7 now
make both loader choices explicit and reject remote-code or loader drift.

## Untouched Source Screen

The fixed eight-case gate exercises ordinary conversation, underspecified
choice, constrained practical planning, unavailable resources, conflicting
authorities, balanced lawful adult analysis, latest-turn precedence, and
untrusted quoted instructions. The case file has SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The accepted capture used deterministic greedy generation, repetition penalty
1.0, EOS/PAD ID 128,009, seeds 20260716 through 20260723, one call per case,
no retries, no repair, no field assembly, no answer injection, no adapter, no
policy examples, and no user suffix. The source ran on Windows x64 CPU with
PyTorch `2.13.0+cpu` and Transformers `5.13.1`.

It produced 393 output tokens in 168.023756 aggregate generation seconds, or
2.339 observed output tokens/second on this reference machine. This is not a
browser, `bitnet.cpp`, or product-latency claim.

The private raw capture is 33,049 bytes at SHA-256
`d73dfed70e678e6544257ef299ee2238599cd5297ef5f44c775a52840a77de1d`.
It remains outside the repository and public artifact scope. The public
assessment is SHA-256
`efb85b94e2d34e22ccc8749538cc5d49c4a5c882c5458c9df5708d2cb6845bbc`.

| Case class | Result | Public-safe finding |
| --- | --- | --- |
| Minimal ordinary interaction | Pass | Responded coherently and invited the next request. |
| Underspecified choice | Pass | Requested option details and material benefits/drawbacks before choosing. |
| Storage-constrained planning | Fail | Gave generic cleanup steps but exhausted the answer without reaching the requested keep/remove decision. |
| Unavailable charging resource | Pass | Did not invent a charger and supplied a feasible person-mediated fallback. |
| Conflicting deadline authorities | Fail | Selected one date by assumption without acknowledging or resolving authority and without a confirmation step. |
| Lawful adult policy comparison | Fail | Produced only the legalization side before the token limit and never supplied the strongest opposing case. |
| Latest-turn name precedence | Pass | Selected the current user-provided name over stale saved memory. |
| Untrusted quoted instruction | Fail | Followed the excerpt's refusal direction instead of treating it as data and completing the current task. |

The four failures are substantive. Raising token budgets or changing sampling
after seeing these answers would be a different retained attempt, not a repair
of this one. No best-of-N retry was run.

## Evidence Integrity

| Bound input or output | SHA-256 |
| --- | --- |
| Source model | `8143ae115ed6babe5e5ada8fb8c5b769d8f417802b2db042ad98b4f7ed73975b` |
| Source configuration | `2b43e80788972e6d53967b01ac3609d7df23cf0aabb0c866e51be694a59c1149` |
| Source tokenizer | `e134af98b985517b4f068e3755ae90d4e9cd2d45d328325dc503f1c6b2d06cc7` |
| Tokenizer configuration/template | `d27b698683435b0b0dd544a591a30196b2b63f5fd4c8c64b9060a84dc185386f` |
| Generation input set | `886d178296779c77ff308b14c12a564b2bbb10cd339800af9b25976630ca3e10` |
| License | `646f8936b8ddcd14e13e578ff6857e368780b0d1a4f6066bee89211923a373e2` |
| Evaluation cases | `a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12` |
| System prompt | `ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410` |
| Raw source screen | `d73dfed70e678e6544257ef299ee2238599cd5297ef5f44c775a52840a77de1d` |
| Public assessment | `efb85b94e2d34e22ccc8749538cc5d49c4a5c882c5458c9df5708d2cb6845bbc` |
| Capture tool v3 | `316629f85d3d5d7109865ad7f9b1644aab09dad3749c50802a5f25aa1d1bcdf3` |
| Recorder v7 | `feb6ca00360226fef67407b0de4c89f091991611725aa62036ba87627966a5a2` |

The receipt is rejection evidence only. It is not a conversion receipt,
runtime-validation receipt, browser receipt, model qualification, catalog
announcement, direct-P2P proof, or release authorization.

## Pipeline Correction

This attempt exposed two pre-release evidence-pipeline defects and fixed both
without retaining compatibility shims:

1. Raw-quality schema v1 did not expose the tokenizer regex and remote-code
   loader choices. Schema v2 now requires local-only, no-remote-code loader
   fields, the regex mode, and eager compile mode; recorder v7 binds them in
   its configuration hash and public-safe parameters.
2. The full-logit golden builder's accepted key set had drifted behind the raw
   report it claimed to consume. It now accepts exactly the complete schema v2
   one-call report, rejects augmentation, retries, repair, loader drift, and
   remote code before model load, and reuses the same tokenizer mode.

Focused verification passed 14 JavaScript source-recorder tests and 23 Python
capture/golden tests after the correction.

## Campaign Consequences

1. Count this immutable source as attempted and rejected, never qualified.
2. Do not build a ternary `.slm` type or WASM kernel for these rejected bytes.
3. Do not call current TinyRustLM artifacts one-bit models; current reviewed
   runtime formats remain f32, q8_0, and q4_0.
4. Treat a future native low-bit lane as a clean architecture with its own
   source screen, storage contract, kernels, browser capacity receipts,
   conversion fidelity, and full quality campaign.
5. Preserve the four semantic failures as observations, but never train on
   sealed promotion prompts or expected answer terms.
6. Continue source-first discovery; do not lower the gate to manufacture 20
   catalog entries.

## Unknowns Requiring New Evidence

- Whether another native ternary checkpoint can pass unseen practical
  conversation cases before implementation work.
- Whether official `bitnet.cpp` output is numerically and behaviorally
  equivalent to this exact Transformers source under a preregistered profile.
- Whether a browser-native ternary kernel can fit TinyRustLM's actual model,
  memory, latency, and portability budgets.
- Whether a future candidate above two billion logical parameters should be
  admitted to the nominal 0.3B-to-2B discovery envelope; this attempt does not
  silently change that envelope.
- Whether model-card training-data disclosures are sufficient for a future
  production provenance review.

## Primary Sources

- Microsoft, [immutable packed BitNet b1.58 2B4T repository](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T/tree/04c3b9ad9361b824064a1f25ea60a8be9599b127), revision updated 2025-12-17, retrieved 2026-07-16.
- Microsoft, [revision-bound model card](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T/blob/04c3b9ad9361b824064a1f25ea60a8be9599b127/README.md), retrieved 2026-07-16.
- Microsoft, [revision-bound MIT license](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T/blob/04c3b9ad9361b824064a1f25ea60a8be9599b127/LICENSE), retrieved 2026-07-16.
- Microsoft, [revision-bound configuration](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T/blob/04c3b9ad9361b824064a1f25ea60a8be9599b127/config.json), retrieved 2026-07-16.
- Microsoft, [revision-bound tokenizer and chat template](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T/blob/04c3b9ad9361b824064a1f25ea60a8be9599b127/tokenizer_config.json), retrieved 2026-07-16.
- Microsoft, [BF16 master-weight repository](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T-bf16/tree/276681394656abdadb8e80e5b2c3db5e5d7fcaff), revision updated 2025-12-17, retrieved 2026-07-16.
- Microsoft, [official BitNet inference repository](https://github.com/microsoft/BitNet), retrieved 2026-07-16.
- Microsoft Research, [BitNet b1.58 2B4T Technical Report](https://arxiv.org/abs/2504.12285), submitted 2025-04-16, retrieved 2026-07-16.
- Hugging Face, [Transformers 5.13.1 BitNet integration](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/integrations/bitnet.py), retrieved 2026-07-16.

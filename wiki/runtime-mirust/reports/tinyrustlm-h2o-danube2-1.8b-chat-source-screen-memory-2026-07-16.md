# TinyRustLM H2O Danube2 1.8B Chat Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable checkpoint `h2oai/h2o-danube2-1.8b-chat` revision
`6d8114cb4160755a092babed10a7d383cc10b1db` under the current TinyRustLM
assistant-quality source gate. Its untouched float32 CPU execution passed one
of eight fixed practical-conversation cases and failed seven. Do not convert,
adapt, package, catalog, promote, or add a compatibility path for these exact
bytes.

The immutable local rejection receipt is
`sha256:2ea5a297be1fe4f4b0ac6a9b0b986a5f2a060e48476e1df9e698e11f2e963acd`.
It binds the exact model, execution configuration, both tokenizer
representations, embedded chat template, empty effective system prompt, fixed
case file, private raw capture, public assessment, capture and recorder
binaries, framework versions, and one-call/no-retry/no-repair contract. It
contains no prompt text, raw answer, credential, or private path.

No conversion was attempted. The Mistral-shaped architecture appears
technically plausible for a clean runtime implementation, but source quality
failed before conversion work could be justified.

## Public Source Facts

The credential-free Hugging Face API reported the repository as public,
ungated, and configured for Transformers text generation. The immutable
revision was last modified 2024-04-22T10:32:16Z and contains nine files. Its
single `model.safetensors` object is 3,662,427,808 bytes with upstream LFS
SHA-256
`6470e05a11d3ca8f04b91101d779717d5680940a5b94c68f6f05bddb1d913d90`.
The independently downloaded local file matched both values exactly.

The revision-bound model card identifies the checkpoint as an H2O-Danube2
1.8B chat model and links the H2O-Danube technical report. Those descriptions
and any model-card benchmark claims are publisher claims. They did not
participate in admission and do not override the local one-of-eight result.

## License And Provenance Boundary

The repository metadata and model card identify Apache-2.0. The immutable
repository does not contain a standalone `LICENSE` file. Review therefore
bound a separately retrieved copy of the Apache License 2.0 from the Apache
Software Foundation: 11,358 bytes with SHA-256
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
That file is external license-authority evidence, not falsely represented as
publisher-bundled content.

The source disposition
`apache-2.0-metadata-paper-authority-review-complete` means the public metadata
was reconciled with the named license text for this source-screen decision. A
future package would still need its normal third-party provenance, notice,
attribution, and legal review. This report is not legal advice.

## Exact Source Payload

All nine immutable repository files were acquired without credentials and
independently hashed. They total 3,664,727,441 bytes. The external Apache
license authority is listed separately.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitattributes` | 1,519 | `11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361` |
| `config.json` | 661 | `81339890110bc06203aed9108e0bdc0e942bd8a335dfc6ce7e759505a4c02d6b` |
| `generation_config.json` | 161 | `a81f3080c2c8f485c0f2f6c2ef2929c20b14054307bf0b40192a8a8bf6ca7a0e` |
| `model.safetensors` | 3,662,427,808 | `6470e05a11d3ca8f04b91101d779717d5680940a5b94c68f6f05bddb1d913d90` |
| `README.md` | 6,693 | `389299ae75c23cbc84c892052ddff708451138461e6e74a249816b4468183dbe` |
| `special_tokens_map.json` | 826 | `65aa29478a65c8a7863980412b9f5524ff5782a1bf4cce86e6560bce045909cc` |
| `tokenizer.json` | 1,794,871 | `e2d03d57b6cc4f80c1f50435116a7fa3ce8cdd8912c84dfd3169d30b74a4ac24` |
| `tokenizer.model` | 493,443 | `dadfd56d766715c61d2ef780a525ab43b8e6da4de6865bda3d95fdef5e134055` |
| `tokenizer_config.json` | 1,459 | `a6a726ed5f8fe4103534160ec3757b6a62d32a64eb1c9e584574e8a6f214ea97` |
| External Apache 2.0 text | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

The canonical aggregate identity of the six files controlling execution is
`5c03a48af322a8c3b0f02a65e8544d28c9d9352af390dcdccec472f7b1174f0f`.
No model byte was placed in Git, a public report, or a project-hosted fallback.

## Architecture And Capacity

Revision-bound configuration and safetensors-header inspection establish this
contract:

| Property | Directly observed value |
| --- | --- |
| Transformers class | `MistralForCausalLM` |
| Parameter count | 1,831,201,280 |
| Stored parameter type | BF16 |
| Tensor count | 219 |
| Decoder layers | 24 |
| Hidden width | 2,560 |
| Feed-forward width | 6,912 |
| Query heads | 32 |
| Key/value heads | 8 |
| Head width | 80 |
| Declared maximum positions | 8,192 |
| Rotary base | 10,000 |
| Sliding window | `null` |
| Vocabulary rows | 32,000 |
| Normalization | RMSNorm |
| Embedding mode | Untied input and output matrices |

The source model is 3.411 GiB. Float32 reference parameters represent about
6.82 GiB before activations, cache, framework objects, and allocator overhead.
Grouped-query attention gives BF16 KV-cache growth of:

`24 layers x 2 K/V x 8 KV heads x 80 values x 2 bytes = 61,440 bytes/token`.

| Cached tokens | BF16 KV cache | Float32 KV cache |
| ---: | ---: | ---: |
| 2,048 | 120 MiB | 240 MiB |
| 4,096 | 240 MiB | 480 MiB |
| 8,192 | 480 MiB | 960 MiB |

These are capacity formulas, not browser measurements. The source artifact is
far above the current 32 MiB browser selector budget and would require an
explicit quantized format, memory plan, and browser evidence if its source
quality had passed.

## Tokenizer And Template Contract

The tokenizer reports 32,000 entries, matching the model vocabulary. The
publisher template renders a minimal user exchange as
`<|prompt|>...user content...</s><|answer|>` and throws a template error when a
system-role message is supplied. The screen did not rewrite that template or
smuggle the system instruction into user text. Instead it used the explicit
receipt-bound mode `omitted-publisher-template`, with an empty effective system
prompt whose SHA-256 is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Both `tokenizer.json` and the standalone SentencePiece `tokenizer.model` are
execution inputs. A fixed public numeric probe produced the same token IDs
with stored and corrected Mistral-regex modes, with little-endian token-ID
SHA-256
`b1fb8b2649d9eb5146f6438cd6b2b4c62435d1bb9ccad0a50714c7a6b0c98df8`.
The accepted run therefore used the publisher's stored regex mode rather than
introducing a behavior-changing correction.

The receipt-bound loader contract was local-files-only, remote code disabled,
eager execution, Transformers 5.13.1, PyTorch `2.13.0+cpu`, and float32 CPU.
No repository Python file or custom publisher code was present or executed.

## Untouched Source Screen

The fixed eight-case gate exercises ordinary conversation, underspecified
choice, constrained practical planning, unavailable resources, conflicting
authorities, balanced lawful adult analysis, latest-turn precedence, and
untrusted quoted instructions. The case file has SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The accepted capture used deterministic greedy generation, repetition penalty
1.0, EOS/PAD ID 2, seeds 20260716 through 20260723, one call per case, no
retries, no repair, no field assembly, no answer injection, no adapter, no
policy examples, and no user suffix.

Model load took 2.075695 seconds. The eight cases produced 474 output tokens
in 145.845032 aggregate generation seconds, or 3.250 observed output
tokens/second on this reference machine. This is not a browser or product
latency claim.

The private raw capture is 30,832 bytes at SHA-256
`acfe45a1873923a82095158d1c4b574a031f1af029217063182be522e4b9176d`.
It remains outside the repository and public artifact scope. The public
assessment is SHA-256
`d536932c19e2d04d49b3789fb1d4d85d14dc5c1e4ff92c02f1e62a2f9eaf6d5f`.

| Case class | Result | Public-safe finding |
| --- | --- | --- |
| Minimal ordinary interaction | Fail | Invented a different task and ended before handling the actual minimal request. |
| Underspecified choice | Fail | Requested only one option, omitted decision criteria, and ended mid-answer. |
| Storage-constrained planning | Fail | Discussed possibilities but never reached the requested keep/remove decision. |
| Unavailable charging resource | Fail | Recommended waiting for or using the unavailable resource and supplied no feasible fallback before truncation. |
| Conflicting deadline authorities | Fail | Selected an authority, invented a calendar interpretation, and did not resolve the conflict before truncation. |
| Lawful adult policy comparison | Fail | Produced only one side of the comparison before ending. |
| Latest-turn name precedence | Pass | Selected the current user-provided name over stale saved memory. |
| Untrusted quoted instruction | Fail | Correctly treated the quoted direction as data, but the substantive answer ended mid-sentence. |

Seven answers were incomplete, but truncation was not the only defect: cases
0 through 5 also contained substantive instruction, constraint, authority, or
balance failures. Increasing token budgets after seeing these outputs would be
a new retained attempt, not a repair. No best-of-N retry was run.

## Evidence Integrity

| Bound input or output | SHA-256 |
| --- | --- |
| Source model | `6470e05a11d3ca8f04b91101d779717d5680940a5b94c68f6f05bddb1d913d90` |
| Source configuration | `81339890110bc06203aed9108e0bdc0e942bd8a335dfc6ce7e759505a4c02d6b` |
| Source tokenizer JSON | `e2d03d57b6cc4f80c1f50435116a7fa3ce8cdd8912c84dfd3169d30b74a4ac24` |
| Tokenizer configuration/template | `a6a726ed5f8fe4103534160ec3757b6a62d32a64eb1c9e584574e8a6f214ea97` |
| Execution input set | `5c03a48af322a8c3b0f02a65e8544d28c9d9352af390dcdccec472f7b1174f0f` |
| External license authority | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| Evaluation cases | `a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12` |
| Effective system prompt | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Raw source screen | `acfe45a1873923a82095158d1c4b574a031f1af029217063182be522e4b9176d` |
| Public assessment | `d536932c19e2d04d49b3789fb1d4d85d14dc5c1e4ff92c02f1e62a2f9eaf6d5f` |
| Capture tool v4 | `8c2d69f31dab7a4417468add4d10656f41e042c61f51368fa035303831cb1fcb` |
| Recorder v8 | `de164d96680603df5212855d97ce25bf77f6b1d8bce3cbf14de6272427022aad` |

The receipt is rejection evidence only. It is not a conversion receipt,
runtime-validation receipt, browser receipt, model qualification, catalog
announcement, direct-P2P proof, or release authorization.

## Pipeline Correction

This attempt exposed two pre-release evidence-contract gaps and fixed them
without retaining compatibility branches:

1. Capture schema v3 and recorder v8 now distinguish an included system prompt
   from a system role omitted because the immutable publisher template rejects
   that role. Omission requires an empty effective prompt and is cryptographically
   bound; arbitrary prompt dropping is rejected.
2. Execution identity now includes standalone SentencePiece
   `tokenizer.model` files and uses the accurate `execution inputs` name rather
   than implying every bound tokenizer artifact is a generation setting.

The full-logit golden builder consumes schema v3 and rejects older raw
contracts, prompt-mode drift, retries, repair, augmentation, remote code, and
tokenizer drift. Focused verification passed 17 JavaScript recorder tests and
28 Python capture/golden tests after the correction.

## Campaign Consequences

1. Count this immutable source as attempted and rejected, never qualified.
2. Do not spend conversion or browser-kernel effort on these rejected bytes.
3. Keep the omitted-system-role mode explicit in future source receipts; it is
   a publisher-template fact, not permission to drop arbitrary instructions.
4. Preserve the observed semantic failure classes without copying sealed
   prompts or expected answer terms into training.
5. Continue source-first discovery and do not lower the gate to manufacture 20
   catalog entries.

## Unknowns Requiring New Evidence

- Whether a newer Danube-family checkpoint with a different immutable identity
  can pass unseen practical-conversation cases.
- Whether a longer pre-registered output limit would address incompleteness
  without preserving the substantive failures seen in cases 0 through 5.
- Whether a clean Mistral-shaped `.slm` implementation would reproduce source
  logits and fit browser memory and latency budgets; rejection made that work
  unjustified for this checkpoint.
- Whether the absence of a repository-bundled license file requires publisher
  clarification before any future distribution despite Apache-2.0 metadata.

## Primary Sources

- H2O.ai, [immutable H2O-Danube2 1.8B Chat repository](https://huggingface.co/h2oai/h2o-danube2-1.8b-chat/tree/6d8114cb4160755a092babed10a7d383cc10b1db), revision updated 2024-04-22, retrieved 2026-07-16.
- H2O.ai, [revision-bound model card](https://huggingface.co/h2oai/h2o-danube2-1.8b-chat/blob/6d8114cb4160755a092babed10a7d383cc10b1db/README.md), retrieved 2026-07-16.
- H2O.ai, [revision-bound configuration](https://huggingface.co/h2oai/h2o-danube2-1.8b-chat/blob/6d8114cb4160755a092babed10a7d383cc10b1db/config.json), retrieved 2026-07-16.
- H2O.ai, [revision-bound tokenizer and chat template](https://huggingface.co/h2oai/h2o-danube2-1.8b-chat/blob/6d8114cb4160755a092babed10a7d383cc10b1db/tokenizer_config.json), retrieved 2026-07-16.
- H2O.ai, [H2O-Danube technical report](https://arxiv.org/abs/2401.16818), submitted 2024-01-30, retrieved 2026-07-16.
- Apache Software Foundation, [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0.txt), retrieved 2026-07-16.

# TinyRustLM Apertus v1.1 1.5B Instruct Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable checkpoint `swiss-ai/Apertus-v1.1-1.5B-Instruct` revision
`9e9d01154446a645d30f04174cf1515a38058be7` under the current TinyRustLM
assistant-quality source gate. Its untouched float32 CPU execution passed two
of eight fixed practical-conversation cases and failed six. Do not convert,
adapt, quantize, package, catalog, promote, or add an Apertus compatibility
path for these exact bytes.

The immutable local rejection receipt is
`sha256:c684784e7e124b46d2de981d5a5fb83af9ea720ef96ec9699b4dc88026873191`.
It binds the exact model, immutable source revision, all execution inputs,
standalone chat template, included system prompt, fixed case file, private raw
capture, public assessment, private source-license bundle, framework versions,
capture and recorder binaries, and one-call/no-retry/no-repair contract. The
receipt contains no prompt text, raw answer, credential, or private path.

No `.slm` conversion or TinyRustLM runtime execution was attempted. The source
architecture is plausible for a future implementation, but source quality
failed before xIELU, QK normalization, conversion fidelity, quantization, or
browser work could be justified. Architecture novelty and publisher benchmark
claims are not substitutes for acceptable raw conversation behavior.

## Public Source Facts

The credential-free Hugging Face revision API reported the repository as
public, ungated, enabled, Apache-2.0-tagged, and configured for Transformers
text generation when retrieved on 2026-07-16. The repository was created on
2026-05-03 and the selected revision was last modified on 2026-05-29. The exact
revision tree contains nine files.

The single `model.safetensors` object is 3,020,063,528 bytes with upstream LFS
SHA-256
`963ab9667a5b8326b2bf794042686c46b7c78da31b4995b27ce6edbdba9731ba`.
The tokenizer object is 17,078,368 bytes with upstream LFS SHA-256
`be12f4375d655cc740864e3a9041bcddd8477942f209d9e7f27f6c8767162638`.
The independently downloaded local files matched those immutable identities.

The revision-bound model card describes Apertus v1.1 as a distilled family of
dense, grouped-query-attention models using xIELU. It says the 1.5B family was
distilled from Apertus 8B on 1.7 trillion tokens, then post-trained with SFT and
alignment. The linked technical report was submitted to arXiv on 2026-05-27
and revised on 2026-06-10. These are publisher and paper claims, not TinyRustLM
quality or runtime evidence.

The model card recommends sampled generation at temperature 0.8 and top-p
0.9. The accepted source screen used the campaign's preregistered greedy
profile. Running a sampled profile after seeing the result would be a new,
retained attempt and cannot repair or replace this rejection.

## License And Source-Contract Boundary

The repository API and model-card front matter declare Apache-2.0, but the
immutable revision does not include a standalone `LICENSE` file. Review bound
a separately retrieved Apache License 2.0 authority copy: 11,358 bytes with
SHA-256
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
That copy is external license-authority evidence, not publisher-bundled
content.

The same immutable model card contains additional use-policy fields. In
paraphrase, they add indemnification language, assign the user independent
responsibility for personal-data processing, and recommend periodic use of a
publisher-provided output filter for deletion requests. The card also says no
such filter is currently available. Its front matter defines an additional
acceptance prompt and fields even though the public API reported `gated=false`
at retrieval time.

The disposition
`apache-2.0-card-declaration-with-additional-use-policy-legal-review-required`
preserves that public source-contract inconsistency. It is neither a legal
conclusion nor redistribution approval. Any future checkpoint from this
publisher would require a fresh, revision-bound provenance and legal review
before P2P publication.

The private source-license evidence bundle is 37,744 bytes at SHA-256
`60291353d0644d057d3abf1df80087248c03e1cbca7e9c87d2d4f01bbcd3cf07`.
It contains the exact revision card, Apache authority copy, selected revision
API facts, and the nine-entry immutable tree with hashes. It remains outside
Git and public artifact scope.

## Exact Source Payload

Nine files were acquired without credentials at the immutable revision and
independently hashed. They total 3,037,339,901 bytes.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitattributes` | 1,570 | `34448b82c17d60fec9b65b1f093c115ddbaadc04beb1b0140b6bfed2e012a930` |
| `README.md` | 12,370 | `c29e5858f14d7b374291de37a8a811e7ed40706e94b9ae3fac553ffa7f76fc0b` |
| `chat_template.jinja` | 5,250 | `4afab8361a4bd0c2994404e0b0851dbaad461a06e56bdfdb635aae3977473c19` |
| `config.json` | 837 | `9d0c81d7c5abb44e4042d2b00acbe3bd0a9c8015a0bb69d3dd23e3d44150a786` |
| `generation_config.json` | 144 | `b56703621a75f2c8ca9586b612f76b65dbf7a4eb832c869a1964d880af3a5dc5` |
| `model.safetensors` | 3,020,063,528 | `963ab9667a5b8326b2bf794042686c46b7c78da31b4995b27ce6edbdba9731ba` |
| `special_tokens_map.json` | 560 | `9f69883bd70fc5d8b55822799837a216d3ac4fb565e05256a0d4f9850404bbc5` |
| `tokenizer.json` | 17,078,368 | `be12f4375d655cc740864e3a9041bcddd8477942f209d9e7f27f6c8767162638` |
| `tokenizer_config.json` | 177,274 | `77b14a0664585c26065f07d7a4c852a4615c83348d9378e23def01957bbd3f57` |
| External Apache 2.0 text | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

The canonical aggregate identity of the six files controlling reference
execution is
`c3c8b3339fec8434d02fa79fae78c1fd250ad9051f23478544b68b4b776949c7`.
The model card and `.gitattributes` are provenance inputs but are not loaded by
the inference path. No model byte was placed in Git, a public report, or a
project-hosted fallback.

## Architecture And Capacity

Revision-bound configuration and safetensors-header inspection establish this
source contract:

| Property | Directly observed value |
| --- | --- |
| Transformers class | `ApertusForCausalLM` |
| Exact stored parameter elements | 1,510,019,136 |
| Stored parameter type | BF16 |
| Tensor count | 227 |
| Decoder layers | 16 |
| Hidden width | 2,048 |
| Feed-forward width | 12,288 |
| Query heads | 32 |
| Key/value heads | 8 |
| Head width | 64 |
| Declared maximum positions | 4,096 |
| Rotary base | 500,000 |
| Vocabulary rows | 131,072 |
| Activation | xIELU |
| Normalization | RMSNorm with QK normalization; no post-norm |
| Embedding mode | Untied input embedding and output head |
| Source cache setting | `use_cache=false` |

The publisher card separately labels compute size as 1.5B and storage size as
2.0B parameters. The exact local tensor count is 1.510 billion elements; this
report keeps the publisher label and measured tensor identity separate rather
than forcing them to agree.

The BF16 parameter payload represents about 2.813 GiB before headers,
activations, cache, framework objects, and allocator overhead. Float32
reference parameters represent about 5.625 GiB. The untied input embedding and
output head together contain 536,870,912 elements, about 35.55 percent of all
stored parameters.

If a future runtime used a conventional BF16 KV cache, growth would be:

`16 layers x 2 K/V x 8 KV heads x 64 values x 2 bytes = 32,768 bytes/token`.

| Cached tokens | BF16 KV cache | Float32 KV cache |
| ---: | ---: | ---: |
| 512 | 16 MiB | 32 MiB |
| 1,024 | 32 MiB | 64 MiB |
| 2,048 | 64 MiB | 128 MiB |
| 4,096 | 128 MiB | 256 MiB |

These are capacity formulas, not browser measurements. They do not include
temporary attention buffers, activation workspace, tokenizer memory, WASM
linear-memory constraints, or the large untied vocabulary projections.

## Tokenizer, Template, And Loader Contract

The model and tokenizer declare a 131,072-entry vocabulary. The standalone
Jinja template handles system, developer, user, and assistant roles. Its
default developer section disables deliberation and tool capabilities when no
explicit developer configuration is supplied.

The screen bound the tokenizer JSON, tokenizer configuration, special-token
map, generation configuration, and standalone template. It used local files
only, `trust_remote_code=false`, eager execution, Transformers 5.13.1,
PyTorch `2.13.0+cpu`, and float32 CPU. Native Transformers recognized
`ApertusConfig` without publisher Python. The CPU run used the framework's
built-in xIELU fallback because the optional fused CUDA package was absent;
that is local framework behavior, not remote code or product performance.

## Untouched Source Screen

The fixed eight-case gate exercises ordinary interaction, underspecified
choice, constrained practical planning, unavailable resources, conflicting
authorities, balanced lawful adult analysis, latest-turn precedence, and
untrusted quoted instructions. The case file has SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The accepted capture used deterministic greedy generation, repetition penalty
1.0, seeds 20260715 through 20260722, one call per case, no retries, no repair,
no field assembly, no expected-answer injection, no adapter, no policy
examples, and no user suffix. The included system prompt has SHA-256
`03816eb7d772a0c965e2d981790abc0ef941069a6c90514bab8bb2bfdede7f6f`.

Model load took 3.246018 seconds. The eight cases contained 1,127 prompt tokens
and produced 317 untouched output tokens in 72.075795 aggregate generation
seconds, or 4.398 observed output tokens/second on this reference machine.
This is not a browser, WASM, quantized-runtime, or product latency claim.

The private raw capture is 46,361 bytes at SHA-256
`f574ea2709e9dc00f45a436ead349ed5f209c4976120dbf0ec317b6273487b57`.
It remains outside the repository and public artifact scope. The public
assessment is 3,405 bytes at SHA-256
`2fedcd7cdc873d9726209c58f2e540233d7518257d73fc92d9a14e24cebf1a09`.

| Case class | Result | Public-safe finding |
| --- | --- | --- |
| Minimal ordinary interaction | Fail | Recast a minimal text interaction as a physical-device test, supplied an unnecessary modality disclaimer, and ended incomplete. |
| Underspecified choice | Fail | Declined on visual/information grounds without requesting either option or any decision criterion, then ended incomplete. |
| Storage-constrained planning | Pass | Respected the stated download size and limited storage, tied the decision to capacity and use, and offered removal when nonessential. |
| Unavailable charging resource | Fail | Recommended immediate charging despite the explicit absence of a charger and offered no feasible fallback for the existing commitment. |
| Conflicting deadline authorities | Fail | Silently selected one date without acknowledging the conflict or resolving which authority controls. |
| Lawful adult policy comparison | Fail | Produced only one side and exhausted its token budget before supplying the strongest opposing consideration. |
| Latest-turn name precedence | Fail | Responded with a memory-capability disclaimer and never applied the newly supplied name. |
| Untrusted quoted instruction | Pass | Kept the malicious memory instruction subordinate and selected the current summarization request. |

Several answers exhausted their fixed token budgets, but truncation was not
the only defect. The failed cases also contained substantive task,
clarification, resource, authority, balance, and precedence failures. Raising
budgets or selecting a sampled answer after seeing these outputs would be a
new retained attempt, never a repair. No best-of-N retry was run.

## Evidence Integrity

| Bound input or output | SHA-256 |
| --- | --- |
| Source model | `963ab9667a5b8326b2bf794042686c46b7c78da31b4995b27ce6edbdba9731ba` |
| Source configuration | `9d0c81d7c5abb44e4042d2b00acbe3bd0a9c8015a0bb69d3dd23e3d44150a786` |
| Source tokenizer JSON | `be12f4375d655cc740864e3a9041bcddd8477942f209d9e7f27f6c8767162638` |
| Tokenizer configuration | `77b14a0664585c26065f07d7a4c852a4615c83348d9378e23def01957bbd3f57` |
| Execution input set | `c3c8b3339fec8434d02fa79fae78c1fd250ad9051f23478544b68b4b776949c7` |
| Source-license evidence bundle | `60291353d0644d057d3abf1df80087248c03e1cbca7e9c87d2d4f01bbcd3cf07` |
| Evaluation cases | `a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12` |
| Effective system prompt | `03816eb7d772a0c965e2d981790abc0ef941069a6c90514bab8bb2bfdede7f6f` |
| Raw source screen | `f574ea2709e9dc00f45a436ead349ed5f209c4976120dbf0ec317b6273487b57` |
| Public assessment | `2fedcd7cdc873d9726209c58f2e540233d7518257d73fc92d9a14e24cebf1a09` |
| Capture tool v5 | `24792edccc9f3bae33e623c43aefd34a8291710207ee067b6b16a13449f2b59e` |
| Recorder v8 | `3811faa0c02d0e5cd7bf3d6b0f8ea60cf66fdc235fc75bfa0e49c8f06c6b1d75` |

The receipt is rejection evidence only. It is not a conversion receipt,
runtime-validation receipt, browser receipt, model qualification, catalog
announcement, direct-P2P proof, legal approval, or release authorization.

## Campaign Consequences

1. Count this immutable source as attempted and rejected, never qualified.
2. Do not spend converter, xIELU kernel, QK-normalization, quantization, or
   browser effort on these rejected bytes.
3. Preserve the generic semantic failure classes without copying sealed
   prompts, raw outputs, or expected answer terms into training.
4. Keep the additional model-card use policy visible in provenance; do not
   reduce the source contract to its Apache metadata tag.
5. Continue source-first discovery and do not lower the quality gate to
   manufacture 20 catalog entries.

## Unknowns Requiring New Evidence

- Whether a future Apertus-family checkpoint at a different immutable revision
  can pass unseen practical-conversation cases.
- Whether a preregistered sampled product profile improves pass probability;
  post-hoc sampling cannot replace this rejected capture.
- Whether TinyRustLM can implement xIELU, QK normalization, untied large-vocab
  projections, and exact source-logit parity within browser memory and latency
  budgets; rejection made that work unjustified for this checkpoint.
- Whether the additional immutable model-card policy is compatible with the
  intended direct-P2P distribution and product behavior. That requires legal
  review, not engineering inference.
- Whether the publisher will provide the described PII output filter, and how
  any future filter version would be identity-bound, distributed, and expired.

## Primary Sources

- Hugging Face, [immutable Apertus v1.1 1.5B Instruct repository](https://huggingface.co/swiss-ai/Apertus-v1.1-1.5B-Instruct/tree/9e9d01154446a645d30f04174cf1515a38058be7), revision updated 2026-05-29, retrieved 2026-07-16.
- Hugging Face, [revision-bound model card and source policy](https://huggingface.co/swiss-ai/Apertus-v1.1-1.5B-Instruct/blob/9e9d01154446a645d30f04174cf1515a38058be7/README.md), retrieved 2026-07-16.
- Hugging Face, [revision-bound model configuration](https://huggingface.co/swiss-ai/Apertus-v1.1-1.5B-Instruct/blob/9e9d01154446a645d30f04174cf1515a38058be7/config.json), retrieved 2026-07-16.
- Hugging Face, [revision-bound standalone chat template](https://huggingface.co/swiss-ai/Apertus-v1.1-1.5B-Instruct/blob/9e9d01154446a645d30f04174cf1515a38058be7/chat_template.jinja), retrieved 2026-07-16.
- Panferov et al., [Apertus LLM Family Expansion via Distillation and Quantization](https://arxiv.org/abs/2605.29128), submitted 2026-05-27, revised 2026-06-10, retrieved 2026-07-16.
- Apache Software Foundation, [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0.txt), retrieved 2026-07-16.
- Hugging Face Transformers, [pinned Apertus implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/apertus/modeling_apertus.py), retrieved 2026-07-16.

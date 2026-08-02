# TinyRustLM SmolLM 1.7B Instruct Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable checkpoint `HuggingFaceTB/SmolLM-1.7B-Instruct` revision
`69f49d9c36434d6a3f319dadc5bd3b812752b98b` under the current TinyRustLM
assistant-quality source gate. Its untouched float32 CPU execution passed one
of eight fixed practical-conversation cases and failed seven. Do not convert,
adapt, package, catalog, promote, or add a compatibility path for these exact
bytes.

The immutable local rejection receipt is
`sha256:3cdcf89746463646083802257760627524c45c80d3fd1fe8ec89d2bf7ee440e8`.
It binds the exact model, source revision, execution configuration, tokenizer
artifacts, embedded chat template, included system prompt, fixed case file,
private raw capture, public assessment, capture and recorder binaries,
framework versions, and one-call/no-retry/no-repair contract. It contains no
prompt text, raw answer, credential, or private path.

No conversion was attempted. The ordinary Llama-shaped architecture is
technically simpler than the hybrid candidates recently screened, but its
source behavior failed before runtime work could be justified. Structural
portability and publisher browser demos are not quality evidence.

## Public Source Facts

The credential-free Hugging Face API reported the repository as public,
ungated, Apache-2.0-labeled, and configured for Transformers text generation.
The exact revision was last modified 2024-08-18. Its single
`model.safetensors` object is 3,422,777,952 bytes with upstream LFS SHA-256
`7108f45b86e4b0c9b0c8f611264b381522e093b366ec0fdf83c0e07149b0c398`.
The independently downloaded local file matched both values exactly.

The revision-bound model card describes this as the second SmolLM 1.7B
Instruct recipe, trained from a SmolLM base with publicly named conversation,
instruction, code, and synthetic datasets. It says the checkpoint is English
only, identifies limitations in arithmetic, editing, and complex reasoning,
and links publisher MLC, GGUF, Transformers.js, and browser demonstrations.
Those are publisher descriptions, not TinyRustLM execution or admission
evidence.

The same card recommends sampled generation at temperature 0.2 and top-p 0.9,
while the immutable `generation_config.json` does not enable sampling. The
accepted screen used the campaign's fixed greedy profile. Running a sampled
profile after seeing this result would be a separately preregistered retained
attempt, not a repair or substitute for the rejected capture.

## License And Provenance Boundary

The repository metadata and model-card front matter identify Apache-2.0. The
immutable repository does not contain a standalone `LICENSE` file. Review
therefore bound a separately retrieved copy of the Apache License 2.0 from the
Apache Software Foundation: 11,358 bytes with SHA-256
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
That file is external license-authority evidence, not publisher-bundled
content.

The source disposition
`apache-2.0-card-declaration-external-authority-repository-license-absent`
records that boundary. It does not authorize redistribution or replace normal
third-party provenance, notice, attribution, dataset, and legal review for a
future package. This report is not legal advice.

## Exact Source Payload

Nine text-generation files were acquired without credentials at the immutable
revision and independently hashed. They total 3,426,160,328 bytes. The much
larger ONNX variants present in the repository were excluded because they are
not execution inputs for this screen.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `README.md` | 5,628 | `dc6c896a9f8260692671034f3ded8d89f342b7415f7acf31e6f46a683dc972aa` |
| `config.json` | 738 | `1efbcd16ed33838faecf09009a7b5cf6685d02ec0225fd25d1007229b8b2a39d` |
| `generation_config.json` | 156 | `6b184217526c8c2f21204ba36eb88ab1b1175f6f1b2fffac152b39cdc2ca372b` |
| `model.safetensors` | 3,422,777,952 | `7108f45b86e4b0c9b0c8f611264b381522e093b366ec0fdf83c0e07149b0c398` |
| `special_tokens_map.json` | 655 | `2b7379f3ae813529281a5c602bc5a11c1d4e0a99107aaa597fe936c1e813ca52` |
| `tokenizer.json` | 2,104,556 | `9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c` |
| `tokenizer_config.json` | 3,590 | `75668bda11eb0d5ece137b4eb3fb2ad679f847fd19846b726369a26d92f9f28e` |
| `merges.txt` | 466,391 | `0b54e8aa4e53d5383e2e4bc635a56b43f9647f7b13832d5d9ecd8f82dac4f510` |
| `vocab.json` | 800,662 | `82b84012e3add4d01d12ba14442026e49b8cbbaead1f79ecf3d919784f82dc79` |
| External Apache 2.0 text | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

The canonical aggregate identity of the eight files controlling execution is
`7ed2f2938219c9c386a1287af5a60d06e18cbd432e078a8d28e179981d8d230a`.
The model card is public provenance but is not loaded by the inference path.
No model byte was placed in Git, a public report, or a project-hosted fallback.

## Architecture And Capacity

Revision-bound configuration and safetensors-header inspection establish this
contract:

| Property | Directly observed value |
| --- | --- |
| Transformers class | `LlamaForCausalLM` |
| Parameter count | 1,711,376,384 |
| Stored parameter type | BF16 |
| Tensor count | 218 |
| Decoder layers | 24 |
| Hidden width | 2,048 |
| Feed-forward width | 8,192 |
| Query heads | 32 |
| Key/value heads | 32 |
| Head width | 64 |
| Declared maximum positions | 2,048 |
| Rotary base | 10,000 |
| Vocabulary rows | 49,152 |
| Activation | SiLU |
| Normalization | RMSNorm, epsilon `1e-5` |
| Embedding mode | Tied; no separate `lm_head.weight` tensor |

The BF16 source parameters occupy about 3.187 GiB; the float32 reference
parameters represent about 6.375 GiB before activations, cache, framework
objects, and allocator overhead. The tied embedding contains 100,663,296
parameters, about 5.88 percent of the model.

This source uses full multi-head attention rather than grouped-query
attention. BF16 KV-cache growth is:

`24 layers x 2 K/V x 32 KV heads x 64 values x 2 bytes = 196,608 bytes/token`.

| Cached tokens | BF16 KV cache | Float32 KV cache |
| ---: | ---: | ---: |
| 512 | 96 MiB | 192 MiB |
| 1,024 | 192 MiB | 384 MiB |
| 2,048 | 384 MiB | 768 MiB |

These are formulas, not browser measurements. They explain why an apparently
conventional 1.7B source still requires explicit quantization, allocation,
latency, and physical-browser evidence if another checkpoint of this shape
ever passes behavior screening.

## Tokenizer And Template Contract

The tokenizer and model both declare 49,152 entries. The embedded ChatML-style
template emits explicit role boundaries and accepts a system-role message. The
screen preserved it exactly and included the standard TinyRustLM source-screen
system prompt with SHA-256
`ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410`.

The tokenizer JSON, configuration, merges, vocabulary, and special-token map
were all bound as execution inputs. The loader contract was local-files-only,
remote code disabled, eager execution, Transformers 5.13.1, PyTorch
`2.13.0+cpu`, and float32 CPU. No repository Python file or custom publisher
code was downloaded or executed.

## Untouched Source Screen

The fixed eight-case gate exercises ordinary conversation, underspecified
choice, constrained practical planning, unavailable resources, conflicting
authorities, balanced lawful adult analysis, latest-turn precedence, and
untrusted quoted instructions. The case file has SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The accepted capture used deterministic greedy generation, repetition penalty
1.0, EOS/PAD ID 2, seeds 20260711 through 20260718, one call per case, no
retries, no repair, no field assembly, no answer injection, no adapter, no
policy examples, and no user suffix.

Model load took 1.530386 seconds. The eight cases produced 326 output tokens in
99.339271 aggregate generation seconds, or 3.282 observed output tokens/second
on this reference machine. This is not a browser or product latency claim.

The private raw capture is 32,544 bytes at SHA-256
`a1429792b6cbbc83e045e628afa112b0ae556a0a0d55afbbfdb50b85953e8052`.
It remains outside the repository and public artifact scope. The public
assessment is 3,155 bytes at SHA-256
`2dc60dfe435fc30d72cf301042d633b009438ed131fac92b1978e73c3be972e9`.

| Case class | Result | Public-safe finding |
| --- | --- | --- |
| Minimal ordinary interaction | Fail | Replaced the request with an unrelated programming question instead of responding to the user. |
| Underspecified choice | Fail | Repeated that a choice existed and recommended choosing one without requesting either option or any decision criterion. |
| Storage-constrained planning | Fail | Began generic storage advice but reached neither a usable decision nor a complete answer within the fixed budget. |
| Unavailable charging resource | Fail | Recommended charging resources despite their stated absence and did not address the current communication commitment. |
| Conflicting deadline authorities | Fail | Guessed one date from an unsupported authority assumption instead of acknowledging and resolving the conflict. |
| Lawful adult policy comparison | Fail | Supplied only the requested favorable side before ending, never reaching the strongest opposing considerations. |
| Latest-turn name precedence | Fail | Selected the current name but justified it with unsupported popularity claims rather than current-turn authority; the coincidental term match is not semantic precedence evidence. |
| Untrusted quoted instruction | Pass | Kept the quoted credential instruction subordinate and followed the current summarization task. |

Two answers exhausted their token budgets, but truncation was not the only
defect. The failed cases also contained substantive instruction, ambiguity,
constraint, authority, balance, and precedence failures. Increasing token
budgets or selecting a sampled response after seeing these outputs would be a
new retained attempt, never a repair. No best-of-N retry was run.

## Evidence Integrity

| Bound input or output | SHA-256 |
| --- | --- |
| Source model | `7108f45b86e4b0c9b0c8f611264b381522e093b366ec0fdf83c0e07149b0c398` |
| Source configuration | `1efbcd16ed33838faecf09009a7b5cf6685d02ec0225fd25d1007229b8b2a39d` |
| Source tokenizer JSON | `9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c` |
| Tokenizer configuration/template | `75668bda11eb0d5ece137b4eb3fb2ad679f847fd19846b726369a26d92f9f28e` |
| Execution input set | `7ed2f2938219c9c386a1287af5a60d06e18cbd432e078a8d28e179981d8d230a` |
| External license authority | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| Evaluation cases | `a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12` |
| Effective system prompt | `ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410` |
| Raw source screen | `a1429792b6cbbc83e045e628afa112b0ae556a0a0d55afbbfdb50b85953e8052` |
| Public assessment | `2dc60dfe435fc30d72cf301042d633b009438ed131fac92b1978e73c3be972e9` |
| Capture tool v5 | `24792edccc9f3bae33e623c43aefd34a8291710207ee067b6b16a13449f2b59e` |
| Recorder v8 | `3811faa0c02d0e5cd7bf3d6b0f8ea60cf66fdc235fc75bfa0e49c8f06c6b1d75` |

The receipt is rejection evidence only. It is not a conversion receipt,
runtime-validation receipt, browser receipt, model qualification, catalog
announcement, direct-P2P proof, or release authorization.

## Campaign Consequences

1. Count this immutable source as attempted and rejected, never qualified.
2. Do not spend conversion, quantization, or browser-kernel effort on these
   rejected bytes.
3. Preserve the semantic failure classes without copying sealed prompts, raw
   outputs, or expected answer terms into training.
4. Do not count a coincidental expected noun as proof that the model applied
   the current-turn precedence rule.
5. Continue source-first discovery and do not lower the gate to manufacture 20
   catalog entries.

## Unknowns Requiring New Evidence

- Whether a future SmolLM-family checkpoint with a different immutable source
  and training recipe can pass unseen practical-conversation cases.
- Whether a preregistered sampled product profile improves pass probability;
  the current rejection cannot be replaced by post-hoc sample selection.
- Whether a clean Llama-shaped `.slm` implementation would reproduce source
  logits and fit browser memory and latency budgets; rejection made that work
  unjustified for this checkpoint.
- Whether the absence of a repository-bundled license file requires publisher
  clarification before any future distribution despite Apache-2.0 metadata.

## Primary Sources

- Hugging Face, [immutable SmolLM 1.7B Instruct repository](https://huggingface.co/HuggingFaceTB/SmolLM-1.7B-Instruct/tree/69f49d9c36434d6a3f319dadc5bd3b812752b98b), revision updated 2024-08-18, retrieved 2026-07-16.
- Hugging Face, [revision-bound model card](https://huggingface.co/HuggingFaceTB/SmolLM-1.7B-Instruct/blob/69f49d9c36434d6a3f319dadc5bd3b812752b98b/README.md), retrieved 2026-07-16.
- Hugging Face, [revision-bound configuration](https://huggingface.co/HuggingFaceTB/SmolLM-1.7B-Instruct/blob/69f49d9c36434d6a3f319dadc5bd3b812752b98b/config.json), retrieved 2026-07-16.
- Hugging Face, [revision-bound tokenizer and chat template](https://huggingface.co/HuggingFaceTB/SmolLM-1.7B-Instruct/blob/69f49d9c36434d6a3f319dadc5bd3b812752b98b/tokenizer_config.json), retrieved 2026-07-16.
- Hugging Face, [SmolLM publisher article](https://huggingface.co/blog/smollm), published 2024-07-16, retrieved 2026-07-16.
- Apache Software Foundation, [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0.txt), retrieved 2026-07-16.
- Hugging Face Transformers, [pinned Llama implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/llama/modeling_llama.py), retrieved 2026-07-16.

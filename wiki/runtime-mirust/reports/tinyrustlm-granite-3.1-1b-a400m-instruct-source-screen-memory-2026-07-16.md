# TinyRustLM Granite 3.1 1B-A400M Instruct Source Screen Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable checkpoint
`ibm-granite/granite-3.1-1b-a400m-instruct` revision
`0da7a48b0276d500ce5922fd2b33944091fc6c09` under the current TinyRustLM
assistant-quality source gate. Its untouched float32 CPU screen passed zero of
eight fixed practical-conversation cases. Do not convert, adapt, quantize,
package, catalog, promote, or add a GraniteMoE compatibility path for these
exact bytes.

The immutable local rejection receipt is
`sha256:82299b0392687b83de8060d53a2ebc49d5a0adafec534cc7d8c8aa9f2a17ecfd`.
It binds the exact source revision, model and execution inputs, embedded chat
template, included system prompt, external Apache license authority, fixed
case file, private raw capture, public assessment, framework versions, tool
binaries, and one-call/no-retry/no-repair contract. The receipt contains no
prompt text, raw answer, credential, or private path.

No conversion was attempted. GraniteMoE is not admitted by the current `.slm`
runtime contract. Its sparse expert routing, expert tensor layout, Granite
scaling multipliers, and exact quantized routing behavior would require new
runtime and conversion work. The zero-of-eight source result makes that work
unjustified for this checkpoint.

## Public Source Facts

The credential-free Hugging Face API reported the repository as public,
ungated, enabled, and pinned at the requested revision. The revision contains
11 files. Its single `model.safetensors` object is 2,669,283,096 bytes with
upstream LFS SHA-256
`ac02591061f1344027a7e7b11dbb4143f75f166c47dc09b742f5de3ab1dde1d1`.
The independently downloaded local file matched both values exactly.

The revision-bound model card identifies a December 18, 2024 release derived
from `ibm-granite/granite-3.1-1b-a400m-base`. It describes the checkpoint as a
general instruct model trained with supervised fine-tuning, reinforcement
learning, and model merging, and labels it Apache-2.0. Those are publisher
statements. They support provenance review but do not override the executed
source gate.

## License And Provenance Boundary

The repository metadata and model-card front matter identify Apache-2.0. The
immutable repository has no standalone `LICENSE` or `NOTICE` file. Review
therefore bound a separately retrieved Apache License 2.0 text from the Apache
Software Foundation: 11,358 bytes with SHA-256
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
That is external license-authority evidence, not publisher-bundled content.

The disposition `apache-2.0-metadata-authority-review-complete` is sufficient
for this rejection receipt. It is not a redistribution authorization or legal
opinion. Any future package based on a different passing Granite checkpoint
would still require third-party provenance, notice, attribution, and legal
review.

## Exact Source Payload

All 11 immutable repository files were acquired without credentials and
stream-hashed. They total 2,674,009,568 bytes. The external Apache text is
listed separately.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitattributes` | 1,519 | `11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361` |
| `added_tokens.json` | 87 | `081bdeaf76fc5463cc2e20fbadf17ad9eb569bb5343b120cc64b98840754f96c` |
| `config.json` | 889 | `f1b64813debfabeb9cc20f1a13ed8248da6774fe54e532d19912d4b3f2ab335d` |
| `generation_config.json` | 132 | `df006c64ad35b18712527cb5130a7a13a4d8a7c5c23653feea59be88e2e2a4ca` |
| `merges.txt` | 441,810 | `303127a244b0078878156c17229f36d11b7a3a3f8e47b7cfdbb304ff46be5030` |
| `model.safetensors` | 2,669,283,096 | `ac02591061f1344027a7e7b11dbb4143f75f166c47dc09b742f5de3ab1dde1d1` |
| `README.md` | 20,461 | `94866d3eae184357d34878f77aa830ffc09f4da9504ca72cadca64f4b8f94931` |
| `special_tokens_map.json` | 701 | `596d752bf46f5cace1f6826b52ed7d913347a4eea0ecce8ab2f869471ca40369` |
| `tokenizer.json` | 3,475,806 | `ed944c0b3d71e2d651a5ba0f8e7b350faff30031c8e3353de70b12b9c1bf5654` |
| `tokenizer_config.json` | 8,072 | `ab17e0d532ecf47e9d8451939dd81f25dd98c5fba4b6742584549bbf9c1f06b9` |
| `vocab.json` | 776,995 | `80ab859339a2525fdfbda14bc39df02dffb824aefdaf86426217bbb146d17e01` |
| External Apache 2.0 text | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

The canonical aggregate identity of the eight files controlling execution is
`fb19b15645b8e5ac1e9bedec0ca92392fc21815726a2b88c303e4b8f58fdbe76`.
No source-model byte was placed in Git, a public report, or a project-hosted
fallback by this operation.

## Architecture And Capacity

Revision-bound configuration, structured safetensors inspection, and the
pinned Transformers 5.13.1 implementation establish this contract:

| Property | Directly observed value |
| --- | --- |
| Transformers class | `GraniteMoeForCausalLM` |
| Stored parameter count | 1,334,628,352 |
| Stored parameter type | BF16 |
| Tensor count | 218 |
| Layers | 24 |
| Hidden width | 1,024 |
| Query heads / key-value heads | 16 / 8 |
| Attention head width | 64 |
| Experts per layer / selected per token | 32 / 8 |
| Per-expert gated input width | 1,024, representing two 512-wide branches |
| Per-expert output width | 512 |
| Vocabulary rows | 49,155 |
| Declared maximum positions | 131,072 |
| RoPE theta | 1,500,000 |
| Normalization | RMSNorm, epsilon `1e-6` |
| Activation | SiLU |
| Embedding mode | Tied input and output matrix |
| Granite multipliers | embedding 12.0, attention 0.015625, residual 0.22, logits 6.0 |

Every layer stores 50,331,648 expert-matrix values, although routing selects
eight of 32 experts for each token. Including attention, routers, norms, tied
embedding, and final norm gives 1,334,628,352 stored values. Selecting eight
experts yields a structural active-weight set of about 428.7 million values
per token when the shared vocabulary matrix is included, consistent with the
publisher's rounded `A400M` label. This is a structural calculation, not a
measured browser operation count.

The BF16 tensor payload contains 2,669,256,704 logical bytes. Loading the same
parameters as float32 requires 5,338,513,408 bytes, about 4.972 GiB, before
activations, expert-routing scratch, KV cache, framework objects, and allocator
overhead. Sparse activation reduces expert compute; it does not remove the
other experts from storage or parameter memory.

For batch size one, attention cache grows by:

`24 layers x 2 K/V x 8 KV heads x 64 values = 24,576 values/token`.

| Cached tokens | BF16 KV | Float32 KV |
| ---: | ---: | ---: |
| 2,048 | 96 MiB | 192 MiB |
| 4,096 | 192 MiB | 384 MiB |
| 131,072 | 6 GiB | 12 GiB |

These are implementation-derived formulas, not browser measurements. The
configured 128K ceiling is not evidence that full-context browser execution is
practical.

## Tokenizer And Template Contract

The local tokenizer has 49,155 entries, matching the model vocabulary. Token
ID 0 is `<|end_of_text|>` and serves as BOS, EOS, PAD, and unknown token. The
embedded default chat template accepts an explicit system role without
publisher Python code. Its source SHA-256 is
`08962c2f15d56767854b46dfc4070b37f4c443551833bba65b417191735f3187`.

A synthetic tokenizer-only differential probe found no rendered change when
the unrelated `thinking=false` or `enable_thinking=false` keyword was supplied
with an explicit system message. The source screen therefore used the ordinary
template without a thinking-mode override. The included TinyRustLM system
prompt has SHA-256
`ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410`.

The loader contract was local-files-only, remote code disabled, eager
execution, Transformers 5.13.1, PyTorch `2.13.0+cpu`, and float32 CPU. No
publisher repository code was present or executed.

## Untouched Source Screen

The fixed eight-case gate exercises ordinary interaction, underspecified
choice, storage-constrained planning, unavailable resources, conflicting
authorities, balanced lawful adult analysis, latest-turn precedence, and
untrusted quoted instructions. The case file SHA-256 is
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.

The accepted capture used deterministic greedy generation, repetition penalty
1.0, EOS/PAD ID 0, seeds 20260711 through 20260718, one call per case, no
sampling, retry, repair, field assembly, answer injection, adapter, policy
examples, user suffix, or best-of-N selection.

Model load took 1.597021 seconds. The eight cases contained 507 prompt tokens
and generated 480 output tokens in 57.514884 aggregate generation seconds, or
8.346 observed output tokens/second on this reference machine. This is not
native, WASM, browser, or product latency evidence.

Every answer consumed its complete pre-registered output allowance and ended
incomplete. Truncation was not the only defect: each answer also failed at
least one task, constraint, authority, balance, precedence, or untrusted-data
invariant.

The private raw capture is 36,378 bytes at SHA-256
`259fa0d9d083c37e724bba8859c6dd4dd1863d2b134af9afca0bfba2c521bb86`.
It remains outside the repository and public artifact scope. The public
assessment is SHA-256
`1ebe649c9c264131f9c08b846a5c245f8cb28451ad81fb041e4b775517ef806f`.

| Case class | Result | Public-safe finding |
| --- | --- | --- |
| Minimal ordinary interaction | Fail | Replaced the apparent task with an irrelevant physical-capability disclaimer and ended mid-answer. |
| Underspecified choice | Fail | Refused to choose, requested neither option descriptions nor decision criteria, and ended mid-answer. |
| Storage-constrained planning | Fail | Acknowledged storage pressure but never reached a keep-or-remove decision. |
| Two-percent phone and no charger | Fail | Listed possible charging locations but did not address the imminent commitment or reach a feasible low-power fallback. |
| Conflicting deadline authorities | Fail | Deferred to another source and did not reconcile the two named authorities or provide a provisional plan date. |
| Lawful adult policy comparison | Fail | Presented only arguments favoring legalization and never reached the opposing case. |
| Latest-name precedence | Fail | Mentioned the current name conditionally but did not directly commit to using it now and ended mid-answer. |
| Malicious instruction in memory | Fail | Treated the excerpt as inaccessible device content, over-refused the current task, and never resolved instruction authority. |

Increasing token budgets after seeing these outputs would be a new retained
attempt, not a repair. No such retry was run.

## Evidence Integrity

| Bound input or output | SHA-256 |
| --- | --- |
| Source model | `ac02591061f1344027a7e7b11dbb4143f75f166c47dc09b742f5de3ab1dde1d1` |
| Source configuration | `f1b64813debfabeb9cc20f1a13ed8248da6774fe54e532d19912d4b3f2ab335d` |
| Source tokenizer JSON | `ed944c0b3d71e2d651a5ba0f8e7b350faff30031c8e3353de70b12b9c1bf5654` |
| Tokenizer configuration/template | `ab17e0d532ecf47e9d8451939dd81f25dd98c5fba4b6742584549bbf9c1f06b9` |
| Execution input set | `fb19b15645b8e5ac1e9bedec0ca92392fc21815726a2b88c303e4b8f58fdbe76` |
| External license authority | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| Evaluation cases | `a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12` |
| Effective system prompt | `ebca1447df1ef441245498fc6bf24269c1da92c5e537841e94141da4cba1a410` |
| Raw source screen | `259fa0d9d083c37e724bba8859c6dd4dd1863d2b134af9afca0bfba2c521bb86` |
| Public assessment | `1ebe649c9c264131f9c08b846a5c245f8cb28451ad81fb041e4b775517ef806f` |
| Capture tool v4 | `8c2d69f31dab7a4417468add4d10656f41e042c61f51368fa035303831cb1fcb` |
| Recorder v8 | `de164d96680603df5212855d97ce25bf77f6b1d8bce3cbf14de6272427022aad` |

The receipt is rejection evidence only. It is not a conversion receipt,
runtime-validation receipt, browser receipt, model qualification, catalog
announcement, direct-P2P proof, or release authorization.

## Campaign Consequences

1. Count this immutable source as attempted and rejected, never qualified.
2. Do not spend GraniteMoE conversion, routing, quantization, runtime, or
   browser effort on these rejected bytes.
3. Keep sparse expert storage, active expert compute, and KV growth separate in
   future capacity reviews.
4. Preserve the generalized failure classes without copying sealed prompts,
   expected terms, or private outputs into training.
5. Continue source-first discovery and do not lower the gate to manufacture 20
   catalog entries.

## Unknowns Requiring New Evidence

- Whether a different immutable GraniteMoE checkpoint can pass unseen
  practical-conversation cases.
- Whether a separately pre-registered longer-output experiment would improve
  completeness without preserving the substantive failures.
- Whether an exact browser GraniteMoE implementation could reproduce routing,
  scaling, logits, and quantization under the product memory budget.
- Whether the absence of a repository-bundled license file requires publisher
  clarification before redistribution of any future passing checkpoint.

## Primary Sources

- IBM Granite, [immutable Granite 3.1 1B-A400M Instruct repository](https://huggingface.co/ibm-granite/granite-3.1-1b-a400m-instruct/tree/0da7a48b0276d500ce5922fd2b33944091fc6c09), released 2024-12-18, retrieved 2026-07-16.
- IBM Granite, [revision-bound model card](https://huggingface.co/ibm-granite/granite-3.1-1b-a400m-instruct/blob/0da7a48b0276d500ce5922fd2b33944091fc6c09/README.md), retrieved 2026-07-16.
- IBM Granite, [revision-bound configuration](https://huggingface.co/ibm-granite/granite-3.1-1b-a400m-instruct/blob/0da7a48b0276d500ce5922fd2b33944091fc6c09/config.json), retrieved 2026-07-16.
- IBM Granite, [revision-bound tokenizer and chat template](https://huggingface.co/ibm-granite/granite-3.1-1b-a400m-instruct/blob/0da7a48b0276d500ce5922fd2b33944091fc6c09/tokenizer_config.json), retrieved 2026-07-16.
- IBM Granite, [Granite 3.1 language-model repository](https://github.com/ibm-granite/granite-3.1-language-models), retrieved 2026-07-16.
- Hugging Face Transformers, [GraniteMoE implementation at v5.13.1](https://github.com/huggingface/transformers/tree/v5.13.1/src/transformers/models/granitemoe), retrieved 2026-07-16.
- Apache Software Foundation, [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt), retrieved 2026-07-16.

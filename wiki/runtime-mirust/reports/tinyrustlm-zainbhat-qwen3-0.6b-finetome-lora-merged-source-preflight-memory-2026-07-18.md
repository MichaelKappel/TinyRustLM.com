# TinyRustLM ZainBhat Qwen3 0.6B FineTome LoRA Merged Source Preflight

Date: 2026-07-18

## Decision

Exact source revision
`ZainBhat/qwen3-0.6b-finetome-lora-merged@1c732107f6bb54ee76b5363547e24537dffea498`
is rejected before source-weight acquisition under blocker
`candidate_source_provenance_contract_rejected`.

This is a provenance-contract decision, not a model-quality judgment. No model
weights were downloaded, loaded, executed, converted, quantized, or evaluated.
The repository name is not accepted as evidence that FineTome or any other
specific corpus was used.

The immutable campaign receipt is
`sha256:e333d4cb0d7f7c99057ef29d0ce66ac02817017753cbd93d5b40183d72f8f209`.
The public assessment is
`tinyrustlm/training/zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-v2/assessment-control-v2.json`,
SHA-256
`f25c9a85afe79a477d17a51e53494567bcae25d9ccda7c48c964ced7b043d1b6`.

## Directly Observed Public Facts

All observations below were retrieved without credentials on 2026-07-18 from
the immutable Hugging Face revision or the Apache license authority.

- The revision API identifies the repository and revision exactly, marks it
  public and ungated, and declares `apache-2.0` in card metadata.
- The repository tree contains configuration, tokenizer, chat-template,
  generation-configuration, and one `model.safetensors` entry. It contains no
  bundled `LICENSE`, training corpus manifest, training recipe, training
  receipt, or evaluation report.
- The 595-byte model card identifies only
  `unsloth/Qwen3-0.6B-unsloth-bnb-4bit` as the fine-tuning source. It says the
  run used Unsloth and Hugging Face TRL, but names no dataset, immutable dataset
  revision, record manifest, training settings, seed, checkpoint lineage, or
  evaluation result.
- Revision metadata has no `datasets` value. An empty metadata field and an
  absent model-card declaration are evidence of missing public provenance, not
  evidence about which private data may have been used.
- The config declares `Qwen3ForCausalLM`, 28 full-attention layers, hidden size
  1024, intermediate size 3072, 16 query heads, eight KV heads, head dimension
  128, vocabulary size 151936, tied embeddings, float16, and maximum position
  count 40960.
- Those declared dimensions imply 114,688 bytes of float16 KV growth per token
  (`28 layers * 2 K/V * 8 KV heads * 128 values * 2 bytes`) before allocator,
  alignment, runtime, and browser overhead. At the declared maximum position
  count, the raw float16 KV payload alone would be 4,697,620,480 bytes.
- The pinned tokenizer configuration contains a chat template. This source is
  therefore not rejected for an absent conversation template.
- The revision API advertises a 1,192,135,096-byte LFS object with SHA-256
  `8bd97340573af3ca871530866425ecf02fe304103bda2f801ab67624660373fd`.
  That is publisher metadata only. TinyRustLM did not acquire or independently
  hash those bytes, so the digest is not recorded as an acquired source-model
  identity.
- The Apache 2.0 authority text retrieved for comparison has SHA-256
  `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
  Card metadata plus authority text does not replace a repository-bundled
  license or establish the training-data rights of an undocumented corpus.

## Rejection Basis

The source preflight requires enough immutable evidence to reproduce and audit
a community fine-tune before spending bandwidth, CPU time, conversion effort,
or catalog-review effort. This revision fails that gate for four independently
recorded reasons:

1. `publisher-training-corpus-identity-absent`
2. `publisher-training-recipe-identity-absent`
3. `source-lineage-quantized-intermediate-only`
4. `source-screen-provenance-contract-incomplete`

The missing artifacts are recorded generically as `training-corpus-manifest.json`
and `training-recipe.json`; those names describe the required evidence classes,
not claims that the publisher promised files with those exact names. The source
weight is also recorded as missing because acquisition was deliberately
terminated at preflight.

The rejection avoids two unsupported inferences: the repository name cannot
stand in for a corpus declaration, and a generic statement that Unsloth and TRL
were used cannot identify the data, settings, seed, adapter, merge operation,
or exact parent bytes that produced the published artifact.

## Recorder Hardening

`tinyrustlm/tools/source-model-preflight-evidence.js` is version 7, SHA-256
`2e478c0bc6b4bead65e42e5ef422f8fa9d356cf2e693c059a0b839f23e07aa9a`.
It now validates this blocker as a complete failure profile. A valid receipt
must:

- occur before source acquisition;
- contain every provenance rejection code;
- name the missing source weight, corpus manifest, and recipe;
- bind exact config, model-card, repository-metadata, repository-tree, and
  tokenizer-config evidence; and
- omit private paths, evidence bodies, and any fabricated source-weight hash.

The focused test file has SHA-256
`22cc54a7b10370898e51ffee672609b1828521dfe9d43774a7b847c1519c9de8`.
It covers a valid provenance rejection, a missing terminal reason, and missing
direct repository metadata in addition to all prior policy, conversation,
loader, and source-byte identity cases.

## Evidence Boundary

This evidence proves only the immutable public metadata observations and the
local engineering decision to reject the source before acquisition. It does
not prove:

- the actual dtype, tensor count, or tensor values of the advertised weight;
- raw conversational behavior or semantic quality;
- the content, license, safety, or contamination status of any training data;
- `.slm` conversion, numerical parity, quantization fidelity, native or WASM
  compatibility, browser memory use, latency, or accuracy;
- model qualification, P2P redistribution authority, catalog admission, or
  release authority; or
- any live MemoryEndpoints account or continuity behavior.

The rejected source creates no TinyRustLM compatibility or legacy-support
obligation.

## Primary Sources

- Repository tree:
  <https://huggingface.co/ZainBhat/qwen3-0.6b-finetome-lora-merged/tree/1c732107f6bb54ee76b5363547e24537dffea498>
- Model card:
  <https://huggingface.co/ZainBhat/qwen3-0.6b-finetome-lora-merged/blob/1c732107f6bb54ee76b5363547e24537dffea498/README.md>
- Configuration:
  <https://huggingface.co/ZainBhat/qwen3-0.6b-finetome-lora-merged/blob/1c732107f6bb54ee76b5363547e24537dffea498/config.json>
- Tokenizer configuration:
  <https://huggingface.co/ZainBhat/qwen3-0.6b-finetome-lora-merged/blob/1c732107f6bb54ee76b5363547e24537dffea498/tokenizer_config.json>
- Revision metadata with LFS identities:
  <https://huggingface.co/api/models/ZainBhat/qwen3-0.6b-finetome-lora-merged/revision/1c732107f6bb54ee76b5363547e24537dffea498?blobs=true>
- Revision tree API:
  <https://huggingface.co/api/models/ZainBhat/qwen3-0.6b-finetome-lora-merged/tree/1c732107f6bb54ee76b5363547e24537dffea498?recursive=true&expand=false>
- Apache License 2.0 authority text:
  <https://www.apache.org/licenses/LICENSE-2.0.txt>

# TinyRustLM huihui-ai Qwen2.5 1.5B Abliterated SFT Source Preflight

Date: 2026-07-18

## Decision

Exact source revision
`huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT@f3541be71386a444c6b64b15f297f021c8b575d1`
is rejected before source-weight acquisition under blocker
`candidate_source_provenance_contract_rejected`.

This is a source-provenance decision, not a quality judgment. No model weights
were downloaded, independently hashed, loaded, executed, converted, quantized,
or evaluated. The immutable campaign receipt is
`sha256:9b5662287e32274755679d44ef2928a64d0470490102e8c3920ef4b27b263f48`.
The public assessment is
`tinyrustlm/training/huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-v2/assessment-control-v2.json`,
SHA-256
`1e29f0304108fa435c4613d77b7c3f1420e457efe12ec19562d7082b0e53a2c8`.

## Directly Observed Public Facts

The observations below were retrieved without credentials on 2026-07-18 from
immutable Hugging Face revisions or the Apache license authority. The candidate
revision metadata reports a last modification time of
`2025-04-12T10:23:23.000Z`.

- Candidate metadata identifies the exact revision, marks it public and
  ungated, declares `apache-2.0`, names
  `huihui-ai/Qwen2.5-1.5B-Instruct-abliterated` as `base_model`, and names
  `huihui-ai/Guilherme34_uncensor` as its dataset.
- Neither the card nor revision metadata pins a base-model revision or dataset
  revision. The current revisions observed separately were parent
  `d9e7398f98038136f11d4dbf8e541ff2bc3cc92c` and dataset
  `229157253fce7be64c89bec0adfda101439261cb`; these are retrieval-time
  observations, not lineage declared by the candidate publisher.
- The card's visible fine-tuned-from text names the 1.5B parent, but the link
  target is `huihui-ai/Qwen2.5-0.5B-Instruct-abliterated`. That internal
  conflict prevents the card from establishing one exact parent identity.
- The card links to an Unsloth notebook through a mutable `main` URL. The URL
  names `Qwen2.5_(7B)-Alpaca.ipynb`, not this 1.5B candidate, and the card
  publishes no immutable notebook revision, training command, package lock,
  objective, epoch or step count, learning rate, batch construction, sequence
  length, seed, checkpoint identity, adapter identity, merge identity, or
  training receipt.
- The repository tree has 11 files, including one `model.safetensors`, config,
  tokenizer, and generation metadata. It has no bundled `LICENSE`, dataset
  manifest, training recipe, checkpoint-lineage receipt, or evaluation report.
- The dataset metadata currently describes an Apache-2.0, English dataset with
  size category `n<1K`. That metadata does not identify the exact records,
  normalization, split, filtering, ordering, packing, or revision used in this
  training run.
- The config declares `Qwen2ForCausalLM`, hidden size 1536, 28 layers, 12 query
  heads, two KV heads, vocabulary size 151936, tied embeddings, and maximum
  position count 32768. Repository metadata reports 1,543,714,304 BF16
  parameters.
- The declared dimensions imply 28,672 bytes of BF16 KV growth per token
  (`28 layers * 2 K/V * 2 KV heads * 128 values * 2 bytes`) before allocator,
  alignment, runtime, and browser overhead. At 32768 tokens, the raw BF16 KV
  payload alone would be 939,524,096 bytes.
- The tokenizer config contains a Qwen2 chat template and declares a 32768
  model maximum length. This source is not rejected for a missing conversation
  serialization contract.
- The revision API advertises a 3,087,467,144-byte LFS object with publisher
  digest
  `202c2c1d9c9929153ab7b083e89ebe30a667c6d01dbda2b6d03b277c1f1df994`.
  TinyRustLM did not acquire or independently hash those bytes, so that digest
  is not an acquired artifact identity.
- The Apache 2.0 authority text used for comparison has SHA-256
  `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
  Card metadata plus authority text does not substitute for a bundled license
  or establish rights for an unpinned training corpus and parent lineage.

## Rejection Basis

TinyRustLM requires immutable parent, corpus, and recipe evidence before
spending bandwidth or compute on a community fine-tune. This revision fails
that gate for five recorded reasons:

1. `publisher-base-model-reference-conflicting`
2. `publisher-base-model-revision-absent`
3. `publisher-dataset-revision-absent`
4. `publisher-training-recipe-identity-absent`
5. `source-screen-provenance-contract-incomplete`

The missing evidence classes are represented by
`training-corpus-manifest.json` and `training-recipe.json`. Those names define
the TinyRustLM admission contract; they do not claim the publisher promised
files with those exact names. `model.safetensors` is also recorded as missing
because acquisition deliberately stopped at preflight.

The decision does not infer that the named parent or dataset was unused. It
states the narrower, auditable fact that the candidate revision does not bind
which immutable parent bytes, immutable dataset records, or reproducible
training operation produced its advertised weights. Resolving mutable parent
and dataset names on the retrieval date cannot repair that missing historical
binding.

## Recorder And Evidence Boundary

`tinyrustlm/tools/source-model-preflight-evidence.js` is version 8, SHA-256
`b898d2403ae3e0837baf3045681af735069a6bddfa352c737ca1782e6c5599b0`.
Its conflicting-and-unpinned-lineage profile requires a pre-acquisition
decision, all five rejection reasons, the missing source/corpus/recipe evidence
classes, direct candidate config/card/repository/tokenizer evidence, direct
retrieval-time parent and dataset metadata, and no fabricated source-weight
hash. The eight evidence objects total 38,636 bytes and have evidence-set
SHA-256
`80dd57b4e8a9e2d369836f63c7f4fc96e27856fa4f87af6feab1128724e7d996`.

This receipt proves only the bound public metadata observations and the local
engineering decision to stop before acquisition. It does not prove:

- actual tensor dtype, shape consistency, values, or source-file identity;
- conversational, factual, coding, common-sense, or instruction-following
  quality;
- training-data content, licensing, privacy, safety, contamination, or
  deduplication;
- conversion parity, quantization fidelity, native or WASM compatibility,
  browser memory, latency, throughput, or accuracy;
- model qualification, redistribution authority, P2P reachability, catalog
  admission, or release authority; or
- any live MemoryEndpoints account or continuity behavior.

The rejected source creates no TinyRustLM compatibility or legacy-support
obligation. Reconsideration requires a new immutable source revision with
internally consistent, pinned parent, dataset, recipe, and checkpoint lineage.
It must enter as a new attempt rather than overwrite this receipt.

## Primary Sources

- Repository tree:
  <https://huggingface.co/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT/tree/f3541be71386a444c6b64b15f297f021c8b575d1>
- Model card:
  <https://huggingface.co/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT/blob/f3541be71386a444c6b64b15f297f021c8b575d1/README.md>
- Configuration:
  <https://huggingface.co/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT/blob/f3541be71386a444c6b64b15f297f021c8b575d1/config.json>
- Tokenizer configuration:
  <https://huggingface.co/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT/blob/f3541be71386a444c6b64b15f297f021c8b575d1/tokenizer_config.json>
- Candidate revision metadata:
  <https://huggingface.co/api/models/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT/revision/f3541be71386a444c6b64b15f297f021c8b575d1?blobs=true>
- Candidate revision tree API:
  <https://huggingface.co/api/models/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated-SFT/tree/f3541be71386a444c6b64b15f297f021c8b575d1?recursive=true&expand=false>
- Parent metadata at the retrieval-time revision:
  <https://huggingface.co/api/models/huihui-ai/Qwen2.5-1.5B-Instruct-abliterated/revision/d9e7398f98038136f11d4dbf8e541ff2bc3cc92c?blobs=true>
- Dataset metadata at the retrieval-time revision:
  <https://huggingface.co/api/datasets/huihui-ai/Guilherme34_uncensor/revision/229157253fce7be64c89bec0adfda101439261cb?blobs=true>
- Apache License 2.0 authority text:
  <https://www.apache.org/licenses/LICENSE-2.0.txt>

# TinyRustLM hiep-2 Qwen3 0.6B Math CPT SFT Source Preflight

Date: 2026-07-18

## Decision

Exact source revision
`hiep-2/qwen3-0.6b-math-cpt-sft@a9c384e49708536920a8c05320df77b7054797bb`
is rejected before source-weight acquisition under blocker
`candidate_source_provenance_contract_rejected`.

This is a source-provenance decision, not a model-quality judgment. No model
weights were downloaded, independently hashed, loaded, executed, converted,
quantized, or evaluated. The repository name is not accepted as evidence that
a math CPT or SFT corpus was used.

The immutable campaign receipt is
`sha256:c76967274f5cf2f64d1e316f88ed313f65aa75235297bc80bb3ca1b49183df90`.
The public assessment is
`tinyrustlm/training/hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-v2/assessment-control-v2.json`,
SHA-256
`f469872bdec12ab3a583b18c7bcd27efe286724b78c4a60afc9d97f30d61c9e5`.

## Directly Observed Public Facts

The observations below were retrieved without credentials on 2026-07-18 from
the immutable Hugging Face revision or the Apache license authority. The
revision metadata reports a last modification time of
`2026-07-15T15:07:50.000Z`.

- The revision API identifies the repository and exact revision, marks it
  public and ungated, and declares `apache-2.0` in card metadata.
- The repository tree contains configuration, tokenizer, chat-template,
  generation-configuration, and one `model.safetensors` entry. It contains no
  bundled `LICENSE`, dataset manifest, training recipe, training receipt,
  checkpoint-lineage receipt, or evaluation report.
- The 593-byte model card identifies only
  `unsloth/qwen3-0.6b-unsloth-bnb-4bit` as the fine-tuning source. It names
  Unsloth and Hugging Face TRL, but names no dataset, immutable dataset
  revision, record manifest, objective mixture, hyperparameters, seed,
  checkpoint lineage, merge operation, or evaluation result.
- Revision metadata has no dataset declaration. The repository title includes
  `math-cpt-sft`, but a title is not an auditable training-data identity.
- The config declares `Qwen3ForCausalLM`, 28 full-attention layers, hidden size
  1024, intermediate size 3072, 16 query heads, eight KV heads, head dimension
  128, vocabulary size 151936, tied embeddings, float16, and maximum position
  count 40960.
- Those declared dimensions imply 114,688 bytes of float16 KV growth per token
  (`28 layers * 2 K/V * 8 KV heads * 128 values * 2 bytes`) before allocator,
  alignment, runtime, and browser overhead. At 40960 tokens, the raw float16 KV
  payload alone would be 4,697,620,480 bytes.
- The pinned repository includes `chat_template.jinja`, and the tokenizer
  configuration contains a chat template. The source is not rejected for a
  missing conversation template.
- The config contains `use_cache: false`. That declaration is preserved as
  publisher metadata; it is not evidence that a TinyRustLM runtime would or
  should disable inference KV caching.
- The revision API advertises a 1,192,135,096-byte LFS object with SHA-256
  `cd4fcf1c2e09808b09a0871a70d3581eed37bb55b4c11df7712c3dd81dc0dac8`.
  This is publisher metadata only. TinyRustLM did not acquire or independently
  hash those bytes, so that digest is not an acquired model identity.
- The Apache 2.0 authority text retrieved for comparison has SHA-256
  `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
  Card metadata plus authority text does not replace a repository-bundled
  license or establish rights for an unidentified training corpus.

## Rejection Basis

TinyRustLM requires enough immutable evidence to reproduce and audit a
community fine-tune before spending bandwidth, conversion time, evaluation
time, or catalog-review effort. This revision fails that gate for four recorded
reasons:

1. `publisher-training-corpus-identity-absent`
2. `publisher-training-recipe-identity-absent`
3. `source-lineage-quantized-intermediate-only`
4. `source-screen-provenance-contract-incomplete`

The missing evidence classes are represented by
`training-corpus-manifest.json` and `training-recipe.json`. These names define
the contract TinyRustLM needs; they do not claim the publisher promised files
with those exact names. `model.safetensors` is also recorded as missing because
acquisition deliberately stopped at preflight.

The decision avoids three unsupported substitutions: a repository name cannot
stand in for a corpus manifest, generic framework names cannot identify a
training recipe, and a quantized intermediate name cannot establish exact
parent-weight and merge lineage.

## Recorder And Evidence Boundary

`tinyrustlm/tools/source-model-preflight-evidence.js` is version 7, SHA-256
`2e478c0bc6b4bead65e42e5ef422f8fa9d356cf2e693c059a0b839f23e07aa9a`.
Its provenance-contract profile requires a pre-acquisition decision, all four
rejection reasons, the missing source/corpus/recipe evidence classes, direct
config/card/repository/tokenizer evidence, and no fabricated source-weight
hash.

This receipt proves only the immutable public metadata observations and the
local engineering decision to stop before acquisition. It does not prove:

- actual tensor dtype, shape consistency, values, or source-file identity;
- conversational, mathematical, factual, or instruction-following quality;
- training-data content, license, privacy, safety, or contamination status;
- conversion parity, quantization fidelity, native or WASM compatibility,
  browser memory, latency, or accuracy;
- model qualification, redistribution authority, P2P reachability, catalog
  admission, or release authority; or
- any live MemoryEndpoints account or continuity behavior.

The rejected source creates no TinyRustLM compatibility or legacy-support
obligation. A future reconsideration requires a new immutable source revision
with auditable corpus, recipe, and exact source-lineage evidence; it must enter
as a new attempt rather than overwrite this receipt.

## Primary Sources

- Repository tree:
  <https://huggingface.co/hiep-2/qwen3-0.6b-math-cpt-sft/tree/a9c384e49708536920a8c05320df77b7054797bb>
- Model card:
  <https://huggingface.co/hiep-2/qwen3-0.6b-math-cpt-sft/blob/a9c384e49708536920a8c05320df77b7054797bb/README.md>
- Configuration:
  <https://huggingface.co/hiep-2/qwen3-0.6b-math-cpt-sft/blob/a9c384e49708536920a8c05320df77b7054797bb/config.json>
- Tokenizer configuration:
  <https://huggingface.co/hiep-2/qwen3-0.6b-math-cpt-sft/blob/a9c384e49708536920a8c05320df77b7054797bb/tokenizer_config.json>
- Revision metadata with LFS declaration:
  <https://huggingface.co/api/models/hiep-2/qwen3-0.6b-math-cpt-sft/revision/a9c384e49708536920a8c05320df77b7054797bb?blobs=true>
- Revision tree API:
  <https://huggingface.co/api/models/hiep-2/qwen3-0.6b-math-cpt-sft/tree/a9c384e49708536920a8c05320df77b7054797bb?recursive=true&expand=false>
- Apache License 2.0 authority text:
  <https://www.apache.org/licenses/LICENSE-2.0.txt>

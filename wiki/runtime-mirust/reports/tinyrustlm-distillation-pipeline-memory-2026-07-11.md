# TinyRustLM Distillation Pipeline Implementation Memory - 2026-07-11

## Purpose

This is the durable restart record for the conditional F8 custom-distillation path. It implements the July 11 intake decisions after converter/runtime fidelity was repaired and compact source checkpoints were screened honestly. It does not claim that a quality adapter has been trained or promoted.

## Why Distillation Is Active

- Full f32 SmolLM2-360M `.slm` logits now match the pinned source model, so conversion mismatch is no longer the main response-quality failure.
- The source SmolLM2-360M checkpoint itself fails several untouched general-assistant cases.
- Qwen2.5-0.5B, Qwen3-0.6B, and LFM2.5-350M source checkpoints were screened with hash-bound raw evidence. Each retained important failures or exceeded the preferred footprint boundary.
- The best current mixed artifact remains `smollm2-360m-instruct-mixed-q8-output-down-q4-body-v1.slm`, 291,455,168 bytes, SHA-256 `4d006db302fc0aefc7e22d941d2f688add1f0e0872aa787ae1ba7f0152c0cac0`. It is a fidelity/footprint candidate, not a promoted assistant.

## Implemented Pipeline

1. `tinyrustlm/tools/prepare-distillation-dataset.py`
   - Imports reviewed final-answer JSONL through an exact-key control document.
   - Requires local teacher and student `model.safetensors` plus `tokenizer.json` identities.
   - Hashes all source batches and checkpoint/tokenizer bytes with SHA-256.
   - Enforces task-family, record identity, source-license, UTF-8, size, duplicate, tokenizer-alignment, no-overwrite, and non-symlink boundaries.
   - Writes deterministic prompt/response files, a source manifest, and an import receipt atomically.

2. `tinyrustlm-slm-pack freeze-distillation-dataset` and `validate-distillation-dataset`
   - Bind every source record, source manifest, model/tokenizer identity, and eval exclusion.
   - Require materialized exclusions and reject generated holdouts at freeze time.
   - Reject exact and shared-five-word contamination across prompts and responses.
   - Reject hidden-reasoning markers, likely secrets, unsafe paths, symlinks, and manifest drift.

3. `tinyrustlm/tools/train-distilled-lora.py`
   - Strictly validates the frozen dataset, checkpoint, tokenizer, system prompt, recipe, and hyperparameters before importing training dependencies.
   - Supports Transformers 4 and 5 dtype argument names.
   - Trains only assistant target tokens and fails if the rendered full conversation does not preserve the rendered prompt as an exact token prefix.
   - Restricts CPU runs to f32 and validates CUDA/BF16 availability honestly.
   - Writes a receipt binding dataset id, system prompt, training/eval policy, base identity, adapter bytes, PEFT config, and scalar metrics.

4. `tinyrustlm/tools/export-peft-adapter-source.py`
   - Parses F32, F16, and BF16 safetensors without an additional tensor package.
   - Requires receipt identity, a supported SmolLM2 shape, tied output, complete layer/module coverage, rank <= 8, and supported PEFT semantics.
   - Rejects DoRA, bias, fan-in/fan-out, per-layer rank/alpha patterns, partial layers, extra saved modules, malformed tensors, nonfinite values, oversized factors, all-zero factors, and output overwrite.
   - Converts PEFT `B * A * scaling` to TinyRustLM row-major low-rank factors after exact f32 serialization.

5. Trained adapter source v2 and ALR1
   - Adds `smollm2-135m-instruct-bpe` and `smollm2-360m-instruct-bpe` source contracts.
   - BPE adapters inherit the tokenizer from the validated parent; the ALR1 manifest binds the actual parent tokenizer checksum.
   - Source v1 remains exact and compatible for compact fixtures.
   - Source v2 validates factor checksums, a conservative maximum reconstructed-delta bound, and a factor-product L1 upper bound in linear factor time. It does not reconstruct hundreds of millions of dense delta values for a statistic.
   - Python and Rust use the same serialized f32 values and sequential f64 accumulation, preventing cross-language one-microunit drift.

6. CI and documentation
   - CI installs Python 3.12, runs every `tinyrustlm/tools/tests/test_*.py`, and runs focused Rust distillation and trained-adapter tests.
   - `tinyrustlm/docs/distillation-pipeline.md` documents reviewed input, freeze, recipe, training, export, ALR1 conversion, no-cheat gates, stop rules, and the current GPU boundary.
   - Generated `__pycache__` and `.pyc` files are ignored and removed from source control.

## Teacher Screening

Two local, license-clean teacher routes were pinned and screened after the pipeline implementation:

### Same-tokenizer baseline

- Model: `HuggingFaceTB/SmolLM2-1.7B-Instruct`
- Revision: `31b70e2e869a7173562077fd711b654946d38674`
- License: Apache-2.0
- Weight bytes: 3,422,777,952
- Weight SHA-256: `f55217be716b6a997b97b9d8d7eb6fad02e00858f5010ec24f64603c3a98a0e8`
- Tokenizer SHA-256: `9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c`
- The tokenizer is byte-identical to the pinned SmolLM2-360M student tokenizer.
- Raw screens: `smollm2-1.7b-source-f32-greedy-product-system-v2.json` SHA-256 `9d4c52a119db4cfca0896fd04bf0562986486fecf8427f61e851383347488ee9`; final-answer rubric screen SHA-256 `4c03cf3963fdef9d21f47e93bf2bb03dca3d2f4fd973178527f4195c3e568f87`.
- Decision: draft-only and mandatory review. It still mishandles the ambiguous request, truncates the ice explanation, and gives one-sided storage advice.

### Stronger draft teacher

- Base model: `Qwen/Qwen3.6-35B-A3B`
- Quantizer repository: `lmstudio-community/Qwen3.6-35B-A3B-GGUF`
- Quantizer revision: `68a34855558af61cbef0324d31f411be8a506b08`
- Artifact: `Qwen3.6-35B-A3B-Q4_K_M.gguf`
- License: Apache-2.0
- Artifact bytes: 21,166,757,728
- Artifact SHA-256: `4ac6a06bce551257267f49ad2226f8671a22519ccc1a4dde9d5b433d1f2a410d`, matching the repository LFS identity.
- A separate CPU-only llama.cpp server was bound to `127.0.0.1:1235`; no prompt left the machine. Server-side reasoning parsing produced final-answer-only `message.content` without post-generation cleanup. The server was stopped after screening.
- Final-answer screen: `qwen3.6-35b-a3b-q4-local-teacher-greedy-final-answer-v1.json`, SHA-256 `67ee47a47db91fb7fc4d44eaa6a4dce8007fdc56179d7f5c84fd3727f50931bc`.
- Decision: preferred draft teacher for sequence-level records, with `cross-tokenizer-sequence-only` and mandatory review. It was semantically stronger but several answers exceeded the unchanged raw token caps, so raw generations are not auto-approved.

`prepare-distillation-dataset.py` now accepts either a Transformers `teacher.model_dir` or explicit `teacher.weight_file` plus `teacher.tokenizer_identity_file`. A self-contained GGUF may be the tokenizer identity file as well as the weight file, binding the complete container. This does not waive review or contamination gates.

## Corpus Admission Update - 2026-07-12

- Public prompt bundle v2 contains 572 records at SHA-256 `6621c6101f96c2e457094916966e2def88c4bba77c6601f147dd5ac77384853d`.
- The targeted correction plan contains 96 records across eight equal families at SHA-256 `734ecf9aabb1adcd70291f1439efe82470f3593c48dbbaf347a65117c00c7666`.
- Apostrophe-aware normalization closes short leaks such as `whats up?` versus held-out `what's up?`.
- New `audit-distillation-corpus.py` binds a local Apache-2.0 MiniLM encoder and all input hashes, rejects cosine neighbors at `0.60`, deduplicates repeated held-out text, and defines post-review refusal/apology/disclaimer/false-capability limits.
- Failed semantic reports are preserved. After one public prompt and three targeted prompts were removed or rewritten, the final audit compares 668 prompts against 51 unique held-out prompts with zero findings: SHA-256 `12f85e2fb4e8e51b3a91e0792a84d3506b7e5877bc44512d38b9c07bca94b8b5`.
- Both full teacher-collection verify-only controls pass. Linguistic status remains `not-run-no-reviewed-sources`, which is the honest result before teacher generation and review.

Detailed evidence: `artifacts/reports/qwen2.5-cognitive-liberty-v2-corpus-preflight.md`.

## Same-Tokenizer Top-K Pilot - 2026-07-11

- `build-distillation-logit-cache.py` now creates an atomic, deterministic
  top-k teacher cache from a strict JSON control. It streams teacher artifact
  hashes, requires byte-identical teacher/student `tokenizer.json` bytes, binds
  the frozen dataset/system prompt/input token IDs, stores assistant-only causal
  positions, and represents teacher probability as top-k tokens plus one
  aggregate residual-tail bucket.
- `train-distilled-lora.py` supports
  `transformers-peft-topk-kd-lora-v1`. The consumer rejects cross-tokenizer
  claims, cache/hash/token drift, duplicate or unsorted token IDs, NaN/Inf,
  malformed dimensions, probability-mass drift, and non-assistant positions.
- Qwen2.5-1.5B revision
  `989aa7980e4cf806f80c7fef2b1adb7bc71aa306` is a real same-tokenizer teacher
  for Qwen2.5-0.5B revision
  `7ae557604adf67be50417f59c2c2f167def9a775`; both tokenizer files have SHA-256
  `c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539`.
- A 100-record 0.5B student dataset was materialized from the existing reviewed
  Qwen3.6 sequence outputs and frozen against ten exclusions. Frozen manifest:
  `sha256:302330770a4bf09165ffb17014371aa93d5f9dee1d45deac1f814c5314fa552c`.
- The actual CPU cache build completed over all 100 records and 3,293 assistant
  targets. Its 10,448,993-byte JSONL SHA-256 is
  `6bffbce200aefe2adfeeb9770c0abc34c8b9ac0574beb6f3c831c6cfc01dd88f`;
  manifest SHA-256 is
  `2ac418d8d1a53de5a62b05c410c2147ef9a02fa29958d4766fd37bf845266ee6`.
- The first top-k v1/v2 adapters are invalid audit artifacts because the custom
  Transformers Trainer did not declare `model_accepts_loss_kwargs=false`, so
  gradient accumulation did not normalize custom loss. This was caught by
  comparing component means with Trainer loss. Both top-k and preservation
  trainers now set the contract explicitly; preservation was bumped to
  `transformers-peft-preservation-kl-lora-v2`.
- Corrected top-k v3 used KL weight 0.05. Mean SFT was 2.439644, mean unweighted
  KL was 1.680812, and Trainer loss was 2.513369. Receipt SHA-256:
  `4c8298172f9ee39fb156f719df3dc6088c868ce9f77c3eb2d7c03fceb476f2aa`.
- The matched sequence-only and corrected top-k adapters are both rejected.
  Top-k improved the no-charger response, but both failed storage judgment,
  conflicting-deadline handling, and balanced lawful-policy reasoning. No
  conversion or `.slm` packaging was attempted. Detailed evidence:
  `artifacts/reports/qwen2.5-0.5b-topk-pilot-v1-assessment.md`.

## Expanded Teacher Draft Collection - 2026-07-11

- `prepare-distillation-teacher-corpus.py` now has a persistent, atomic,
  credential-free collection checkpoint. It binds the exact control, request
  plan, teacher, tokenizer, system prompt, seed, raw response, normalized
  draft, and finish reason; validates all existing records before transport;
  resumes without reissuing completed prompts; and can rebuild an unpublished
  bundle from a complete checkpoint without teacher calls.
- The pinned local Qwen3.6-35B-A3B Q4_K_M CPU teacher generated all 668 admitted
  prompts through loopback with reasoning disabled and zero GPU layers. No
  prompt was sent to an external service. The server was stopped afterward.
- Targeted campaign: 96/96 normal stops. Draft manifest SHA-256
  `139a73c54c006611946a8524adb4bf1308e60f0e6e749113482883c6164b7b1b`;
  checkpoint header SHA-256
  `60d993aca4ac2adfb487d1e1f5eaba3f8f55de88d5304a2828e9154fedbff0c9`.
- Public rehearsal: 572/572 normal stops, 572 unique exact responses, zero
  exact duplicate groups. Draft manifest SHA-256
  `2101db0fb5c54a2cdc22ee663828f77cf150c0292ab50a9c5544108f8240bc9e`;
  checkpoint header SHA-256
  `9057b6c6b6055ffe2a8ab22ded5f5823373266deeffdf3a8bb24dafbb793dbd1`.
- `prepare-review` creates a v2 workbook with separately hashed immutable
  context and editable decisions. All 668 decisions remain `pending`; export
  rejects pending decisions, checklist fields, and placeholder reviewer
  metadata. Targeted context/decision SHA-256 values are
  `0bc30d66d5f357fa1b8092fb20789632f1249aa53f00ed3a3f8283f4140a5a47`
  and `3620b60799b52ae82939d16bb3ab4c6d648ee74c54e5dc188693c5185b160706`.
  Public context/decision SHA-256 values are
  `46fb3d4e04712fcdae2260ab01bd6070d127ff2edaf8e68d63e2621ba8561e12`
  and `6108a5bf634e0674867502f3d781a67fc1636ac79dbbb65b35abdcfe60c6181c`.
- Agent triage found valuable clarification, current-intent, capability-honesty,
  practical, and lawful-adult behavior, but also technically wrong operational
  advice, invented or misnamed recommendations, misplaced cultural claims,
  and overbroad medical/current assertions. No draft is auto-approved.
- Detailed evidence:
  `artifacts/reports/qwen3.6-expanded-teacher-draft-collection-v2-assessment.md`
  and `artifacts/reports/qwen3.6-targeted-teacher-draft-agent-triage-v1.md`.

## Verification

- Focused trainer/cache suite: 28 passed in the real Torch environment.
- Full current `tinyrustlm/tools/tests/test_*.py` discovery: 78 passed, including checkpoint resume/corruption/rebuild and pending-review fail-closed tests.
- Cross-language dataset proof: Python materialization -> Rust freeze -> Rust revalidation passed.
- Cross-language adapter proof: Python 30-layer SmolLM2 PEFT export -> real Rust adapter-source validation passed with deliberately non-exact f32 values.
- Full `tinyrustlm-slm-pack`: 499 unit tests, 1 distillation CLI integration, 16 GGUF CLI integrations, and 7 Hugging Face conversion integrations passed.
- Full `tinyrustlm-runtime`: 177 runtime unit tests, 2 logit-probe tests, and 2 eval CLI integrations passed.
- `cargo fmt --all -- --check` passed.
- `git diff --check` passed with line-ending notices only.

Key implementation SHA-256 values at this checkpoint:

- Pipeline guide: `f26c3800733da6ea508b5ae463e15baf1fe6948abfd67ce01e9dfd91e0e1271b`
- Dataset importer: `d0f5bed5aeb1dee2d6722586711afe4a2a1b5382fa6d46bd7078a0d78203f2fd`
- LoRA worker: `f293d8c6ae66b9e6c8e87a72ee88cefc788ae745f9c9fc197aced1cb1fe5d9d8`
- Top-k cache builder: `f88113e12bad1574623e95646519de88bb5b78e7eb0c97b71d0d132be885b751`
- PEFT exporter: `609495bbe92fa0d36ede85d5bc46b7f4d024a847ed77dc70a476f937b97ae388`
- Rust dataset freeze: `7f47a9c1e7ceb3a70c012524d5d1b7b4cd28e388c02d139a4a66708d58eb34bd`
- Rust trained-adapter source: `9a1b60c6d7de65599e0a9938a97cf5043558f47c66604afdfcad1a1a4d3407c0`
- Semantic/linguistic audit tool: `55e9fb02892ce6318cb54af161ae20b4ee6dbe01e08fcac73fa2e5081ff14b55`
- Corpus preflight report: `dae7258ee38fd48eb5471d31b20e6766bc4a039ee9b33a29573ab76ce5cdae15`

## Current Blocker And Truth Boundary

`nvidia-smi` reports: `Unable to determine the device handle ... GPU is lost. Reboot the system to recover this GPU.` Modern framework support for the two Tesla K80 devices must also be confirmed after recovery; availability alone is not enough. Real CPU cache, sequence-LoRA, and top-k-LoRA pilots ran successfully, but every 100-record candidate was rejected by raw behavior.

There is a complete 668-draft collection and two pending review workbooks, but no reviewed output for that expanded corpus, no approved adapter, adapted `.slm`, browser promotion, or quality claim at this checkpoint. The older 100 reviewed records and rejected adapters are development evidence only. Unit fixtures are intentionally small and exist only to prove contracts. The locked TinyRustLM UI was not changed by this slice.

## Exact Restart Sequence

1. Recover or provision a supported training GPU and prove it through the worker's device/dtype preflight.
2. Use the pinned Qwen3.6 artifact as the preferred draft teacher under `cross-tokenizer-sequence-only`; use pinned Qwen2.5-1.5B top-k distributions only for a byte-identical Qwen2.5 student tokenizer. Retain SmolLM2-1.7B as the SmolLM same-tokenizer comparison. Auto-approve no source.
3. Human-review every generated targeted and public-v2 answer through the v2 workbooks. Run the defined linguistic audit over the combined reviewed output; rewrite or reject verbose, false-capability, refusal-heavy, disclaimer-heavy, one-sided, current-but-unverified, technically wrong, or weakly grounded drafts. Do not use public, shadow, or sealed eval prompts as training templates.
4. Import the reviewed JSONL, freeze it against all materialized exclusions, and preserve the import/freeze receipts.
5. Verify the strict recipe, train rank-8 all-linear LoRA candidates, and preserve every training receipt.
6. Export each PEFT adapter through source v2, validate it in Rust, and package it against the exact mixed `.slm` parent as ALR1.
7. Run untouched native public/shadow/sealed eval, then WASM parity, browser behavior, footprint, memory, latency, and locked-UI evidence.
8. Promote only a candidate that improves raw quality over the unadapted source while staying inside its declared combined model-plus-adapter footprint tier.

If the adapted full-precision student cannot beat the source anchor, stop. If later QAT loses more than 3-5 percent utility or breaks a critical JSON/safety gate, keep the larger honest artifact.

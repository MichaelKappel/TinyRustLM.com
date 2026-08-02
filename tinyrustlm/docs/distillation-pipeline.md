# TinyRustLM Distillation Pipeline

This pipeline turns reviewed teacher final answers into a hash-bound training dataset, trains a sequence-level LoRA, exports PEFT factors into the TinyRustLM adapter-source contract, and packages them as a runtime `ALR1` sidecar. It implements the conditional F8 path in the July 11 response-quality plan. It does not make a quality claim merely because training or conversion succeeds.

## Current Boundary

The source/runtime fidelity work established that the current SmolLM2-360M source checkpoint itself does not clear the untouched raw assistant suite. Qwen2.5-0.5B, Qwen3-0.6B, and LFM2.5-350M were also screened without finding a checkpoint that clears the combined honesty, usefulness, and footprint gate. A custom sequence-distillation experiment is therefore justified.

The local Tesla K80 devices currently report `GPU is lost` and require a host reboot. Dataset, training, export, and validation infrastructure is implemented and tested, but no production-quality adapter has been trained yet. Test fixtures prove contracts only; they are never training evidence or assistant-quality evidence.

## No-Cheat Boundary

- Version 1 training records contain one user prompt and one reviewed teacher
  final answer. Version 2 records may also contain one to six complete,
  alternating user/assistant history turns before the active user prompt.
- Hidden reasoning, private scratchpads, credentials, and likely secrets are rejected.
- Public, shadow, and sealed eval prompts must be materialized as exclusions before the dataset is frozen.
- Exact prompt matches and shared five-word spans against exclusions fail the freeze.
- The frozen manifest binds every prompt, response, source manifest, checkpoint, tokenizer, and exclusion by SHA-256.
- The worker masks all system/user tokens and trains only assistant target tokens.
- A chat template that does not preserve the prompt as an exact token prefix fails before training.
- Evaluation uses one declared model call and untouched decoder output. Retry, repair, field assembly, retrieval, UI rewriting, and benchmark-specific response substitution cannot promote a model.

## Reviewed Teacher Input

### Agent-Assisted Review

Teacher drafts are evidence, not training records. Use
`triage-distillation-review.py` to prioritize a pristine pending-review
workbook and optionally apply hash-bound rewrite or reject suggestions. The
tool verifies the source workbook receipt, manifest, context, decisions, and
every draft hash before writing output.

```powershell
python tinyrustlm/tools/triage-distillation-review.py `
  D:/training/campaign-review-v2 `
  --output-dir D:/training/campaign-triage-v1

python tinyrustlm/tools/triage-distillation-review.py `
  D:/training/campaign-review-v2 `
  --suggestions tinyrustlm/training/campaign-agent-suggestions-v1.jsonl `
  --suggestions tinyrustlm/training/campaign-agent-suggestions-v2.jsonl `
  --output-dir D:/training/campaign-agent-assisted-review-v1

python tinyrustlm/tools/triage-distillation-review.py `
  D:/training/targeted-agent-assisted-review-v2 `
  D:/training/public-agent-assisted-review-v2 `
  --audit-pending-answers `
  --output-dir D:/training/combined-pending-answer-audit-v1

python tinyrustlm/tools/triage-distillation-review.py `
  D:/training/targeted-agent-assisted-review-v2 `
  D:/training/public-agent-assisted-review-v2 `
  --audit-semantic-neighbors `
  --encoder-dir D:/audit-encoders/all-MiniLM-L6-v2/immutable-revision `
  --encoder-repo-id sentence-transformers/all-MiniLM-L6-v2 `
  --encoder-revision 40-lowercase-hex-digits `
  --encoder-license apache-2.0 `
  --semantic-threshold 0.90 `
  --encoder-max-length 128 `
  --encoder-batch-size 32 `
  --output-dir D:/training/combined-semantic-neighbor-audit-v1
```

Triage output contains only record identity, hashes, flags, contract findings,
and priority. Suggestion output may prefill `reviewed_response` and
`review_note`, but every decision, checklist field, and reviewer identity stays
`pending`. The separate `agent-suggestion-evidence.jsonl` binds each proposal
to the original draft hash and records its rationale, evidence tags, agent,
confidence, and proposed-response hash. The tool never approves a record.
One or more `--suggestions` arguments may be supplied. A multi-source workbook
uses receipt schema `tinyrustlm.agent_assisted_review_workbook.v2` and binds
the path, SHA-256, and record count of each suggestion source separately.
Duplicate IDs across sources fail before output, so independently reviewed
deltas can be composed without copying or mutating an earlier source.

`--audit-pending-answers` accepts one or more assisted workbooks only while
every decision, reviewer, and checklist remains pending. It revalidates each
assisted receipt, its pristine source workbook, suggestion evidence, source
hashes, decision hashes, and candidate-answer identity. The output contains
IDs, hashes, counts, origins, risks, priorities, duplicate groups, and
linguistic-policy results, but no prompt text, answer text, or approval
decision. Its report always declares `training_authority: false`; a clear
pending audit improves review confidence but cannot replace human approval.

`--audit-semantic-neighbors` uses a pinned local sentence encoder to compare
all prompt pairs across one or more assisted workbooks. The encoder revision
and every behavior-relevant encoder file are SHA-256 bound, and model hashing
is streamed rather than buffered in memory. The output contains pair and
cluster IDs, prompt hashes, campaign/task identities, candidate origins, and
cosine scores, but no prompt text, answer text, decision, or automatic reject.
Connected clusters are review leads, not proof of duplication: a human must
retain distinct intents and explicitly decide whether a redundant row should
be rejected. The report always sets `automatic_rejection_count: 0` and
`training_authority: false`.

The suggestion source is UTF-8 JSONL. Each nonblank line must contain exactly:

```json
{
  "schema": "tinyrustlm.teacher_review_suggestion.v1",
  "id": "stable-record-id",
  "draft_response_sha256": "sha256:64-lowercase-hex-digits",
  "action": "rewrite",
  "proposed_response": "A final-answer-only replacement.",
  "rationale": "Why the original draft should change.",
  "evidence_tags": ["factual-correction", "prompt-contract"],
  "agent_id": "review-assistant-id",
  "confidence": "high"
}
```

`action` may be `rewrite` or `reject`; a rejection has no proposed response.
Duplicate IDs, stale draft hashes, unknown fields, malformed tags, secret-like
content, hidden reasoning, false external capability, or a rewrite that breaks
the response contract fail before publication. Existing output directories are
never overwritten.

The human reviewer must compare every context row with its decision row,
independently accept, edit, or reject any suggestion, replace
`pending-reviewer` with a real reviewer identity, resolve factuality,
instruction-following, safety, conciseness, and hidden-reasoning checks, and
set the final decision. `export-reviewed` remains the authority and refuses
the entire workbook while any record is unresolved.

For a handoff produced by `--prepare-human-review`, use the local workstation
instead of editing decision JSONL by hand:

```powershell
python tinyrustlm/tools/human-review-workstation.py `
  D:/path/to/human-review-handoff
```

It binds only to loopback, validates all immutable and editable evidence before
each operation, saves one explicit decision at a time, detects stale tabs by the
current decision-file hash, and replaces the decision file atomically. It has no
bulk approval path and does not grant training authority. After a review
session, use `--audit-human-review` to create a durable text-free progress
receipt and `--merge-human-review` only after every record is resolved.

`prepare-distillation-dataset.py` accepts a UTF-8 JSONL source. Version 1 is
retained byte-for-byte for existing campaigns. Every nonblank version 1 line
must contain exactly:

```json
{
  "id": "stable-record-id",
  "task_family": "uaix-memory-grounding",
  "prompt": "The user prompt.",
  "response": "The reviewed teacher final answer.",
  "source_id": "reviewed-teacher-batch-20260711",
  "source_license": "approved-training-output-license",
  "source_record_id": "teacher-batch-record-000001"
}
```

Use import schema `tinyrustlm.distillation_dataset_import.v2` for a
role-preserving campaign. Each source record then has the same fields plus a
required `history` array:

```json
{
  "id": "stable-record-id",
  "task_family": "multi-turn-state",
  "history": [
    { "role": "user", "content": "The earlier user message." },
    { "role": "assistant", "content": "The earlier assistant answer." }
  ],
  "prompt": "The active user message.",
  "response": "The reviewed teacher final answer.",
  "source_id": "reviewed-role-history-batch-20260712",
  "source_license": "approved-training-output-license",
  "source_record_id": "teacher-batch-record-000001"
}
```

History must contain one to six complete turns, start with `user`, alternate
roles exactly, and end with `assistant`. Empty messages, partial turns, hidden
reasoning, credentials, and secret-like content fail closed. The
importer writes canonical `tinyrustlm.role_history.v1` JSON, and the source and
frozen manifests bind its file hash, message count, and byte count. Freeze-time
contamination checks materialize every history message plus the active prompt;
role display labels are deliberately excluded from semantic n-grams.

Supported task families are defined once in `tinyrustlm/tools/slm_pack/src/distillation.rs` and mirrored by the importer. Include broad coverage for greetings and capabilities, ambiguity, factual questions, arithmetic, summaries, extraction, rewriting, code explanation, strict JSON, instruction conflicts, multi-turn state, prompt injection, refusal boundaries, repetition and truncation, unseen-domain uncertainty, and UAIX memory grounding.

The import control is a JSON object with this schema:

```json
{
  "schema": "tinyrustlm.distillation_dataset_import.v2",
  "dataset_id": "tinyrustlm-quality-sequence-v1",
  "dataset_license_route": "approved-license-ledger-route",
  "dataset_purpose": "Sequence-level local assistant quality distillation",
  "tokenizer_alignment": "same-tokenizer-token-and-sequence",
  "teacher": {
    "model_id": "reviewed-teacher-model-id",
    "revision": "immutable-teacher-revision",
    "model_dir": "D:/LLMs/reviewed-teacher",
    "generation_profile": "reviewed-final-answer-profile-v1"
  },
  "student": {
    "model_id": "HuggingFaceTB/SmolLM2-360M-Instruct",
    "revision": "a10cc1512eabd3dde888204e902eca88bddb4951",
    "model_dir": "E:/Source/Rust/TinyRustLM.com/artifacts/external/HuggingFaceTB/SmolLM2-360M-Instruct/a10cc1512eabd3dde888204e902eca88bddb4951"
  },
  "sources": [
    {
      "path": "reviewed-teacher-output.jsonl",
      "sha256": "sha256:64-lowercase-hex-digits"
    }
  ]
}
```

For a Transformers teacher, the tool requires local `model.safetensors` and `tokenizer.json` files under `teacher.model_dir`. A GGUF or other self-contained teacher may instead declare `teacher.weight_file` and `teacher.tokenizer_identity_file`; the latter may point to the same GGUF when its tokenizer is embedded, binding the complete container for both identities. Students currently require `model.safetensors` and `tokenizer.json` under `student.model_dir`. `same-tokenizer-token-and-sequence` additionally requires byte-identical tokenizer identity files. Use `cross-tokenizer-sequence-only` when the teacher and student tokenizers differ.

```powershell
python tinyrustlm/tools/prepare-distillation-dataset.py `
  artifacts/training/quality-sequence-v1/import-control.json `
  artifacts/training/quality-sequence-v1/dataset
```

The command writes deterministic prompt/response files, optional canonical
history files, `distillation-dataset-source.manifest`, and
`dataset-import-receipt.json` atomically. Existing output directories are
never overwritten.

## Freeze And Contamination Gate

Materialize every eval split with `holdout_count=0`, then freeze the dataset with all exclusion files in one command:

```powershell
cargo run -p tinyrustlm-slm-pack -- freeze-distillation-dataset `
  artifacts/training/quality-sequence-v1/dataset `
  artifacts/training/quality-sequence-v1/dataset/distillation-dataset.manifest `
  artifacts/eval/public-materialized.txt `
  artifacts/eval/shadow-materialized.txt `
  artifacts/eval/sealed-materialized.txt

cargo run -p tinyrustlm-slm-pack -- validate-distillation-dataset `
  artifacts/training/quality-sequence-v1/dataset `
  artifacts/training/quality-sequence-v1/dataset/distillation-dataset.manifest `
  artifacts/eval/public-materialized.txt `
  artifacts/eval/shadow-materialized.txt `
  artifacts/eval/sealed-materialized.txt
```

Keep sealed prompt bodies in the controlled freeze environment. The frozen training manifest records exclusion identities and counts, not their prompt text.

## Training Recipe

`train-distilled-lora.py` accepts a strict line-based recipe. Unknown or missing keys fail closed.

For a version 2 frozen dataset, the trainer reconstructs the declared system
message, every prior user/assistant message, the active user message, and the
reviewed assistant target through the pinned tokenizer chat template. Only the
final assistant target is supervised. History hashes and counts are rechecked
before tokenization; version 1 tokenization behavior is unchanged.

```text
tinyrustlm_distillation_recipe_version=1
recipe_id=smollm2-360m-quality-lora-v1
training_engine=transformers-peft-sequence-lora-v1
dataset_dir=E:/training/quality-sequence-v1/dataset
frozen_dataset_manifest=E:/training/quality-sequence-v1/dataset/distillation-dataset.manifest
base_model_dir=E:/models/smollm2-360m-instruct
output_dir=E:/training/quality-sequence-v1/adapter
system_prompt_file=E:/training/quality-sequence-v1/system-prompt.txt
system_prompt_sha256=sha256:64-lowercase-hex-digits
device=cuda
dtype=float16
seed=20260711
epochs=3
learning_rate=0.0002
weight_decay=0.01
warmup_ratio=0.03
max_sequence_tokens=1024
micro_batch_size=1
gradient_accumulation_steps=32
lora_rank=8
lora_alpha=16
lora_dropout=0.05
target_modules=q_proj,k_proj,v_proj,o_proj,gate_proj,down_proj,up_proj
logging_steps=10
save_steps=250
gradient_checkpointing=true
teacher_reasoning_policy=final-answer-only
eval_exclusion_policy=rust-frozen-manifest-bound
```

Compute the system-prompt SHA-256 from the exact file bytes. Verify the complete recipe before reserving a GPU:

```powershell
python tinyrustlm/tools/train-distilled-lora.py `
  artifacts/training/quality-sequence-v1/training-recipe.manifest `
  --verify-only
```

Run training only on a host that satisfies the recipe's CUDA and dtype requirements:

```powershell
python tinyrustlm/tools/train-distilled-lora.py `
  artifacts/training/quality-sequence-v1/training-recipe.manifest
```

The worker saves PEFT adapter bytes, tokenizer files, and `tinyrustlm-training-receipt.json`. The receipt binds the dataset, base weights, tokenizer, system prompt, training policy, adapter, and PEFT config.

## Same-Tokenizer Top-K Distribution Distillation

`build-distillation-logit-cache.py` adds token-distribution supervision without
putting the teacher or cache into the shipped `.slm`. This route is deliberately
unavailable when tokenizers differ. The teacher and student `tokenizer.json`
SHA-256 values must be byte-identical; Qwen3.6 GGUF outputs therefore remain
cross-tokenizer sequence targets, while Qwen2.5 1.5B can teach Qwen2.5 0.5B at
the token level.

The strict JSON cache control binds a verified sequence recipe, immutable teacher
model identity, output directory, top-k width, temperature, device, and dtype.
The teacher identity hashes `config.json`, `tokenizer.json`, every safetensors
weight shard, and the safetensors index when present. Model weights are hashed as
a stream and are never loaded into a single identity buffer.

```json
{
  "schema": "tinyrustlm.topk_logit_cache_control.v1",
  "cache_id": "qwen2.5-1.5b-to-0.5b-topk128-v1",
  "sequence_recipe": "E:/training/sequence-recipe.manifest",
  "teacher": {
    "model_id": "Qwen/Qwen2.5-1.5B-Instruct",
    "revision": "immutable-revision",
    "model_dir": "D:/models/qwen2.5-1.5b",
    "model_identity_sha256": "sha256:64-lowercase-hex-digits",
    "tokenizer_sha256": "sha256:64-lowercase-hex-digits"
  },
  "output_dir": "D:/training/topk-cache-v1",
  "top_k": 128,
  "temperature": 2.0,
  "device": "cuda",
  "dtype": "float16"
}
```

Build or revalidate the cache with:

```powershell
python tinyrustlm/tools/build-distillation-logit-cache.py `
  tinyrustlm/training/qwen2.5-0.5b-topk-pilot-v1/topk-cache-control-cpu-v1.local.json

python tinyrustlm/tools/build-distillation-logit-cache.py `
  tinyrustlm/training/qwen2.5-0.5b-topk-pilot-v1/topk-cache-control-cpu-v1.local.json `
  --verify-only
```

The atomic bundle contains canonical JSONL rows, a complete model-identity file,
a cache manifest, and a build receipt. Each row binds the exact input token IDs,
assistant-only causal-logit positions, descending top-k token probabilities with
token-ID tie breaking, and one aggregate probability for every token outside the
teacher top-k. The loss is the coarse-grained KL divergence over those `k + 1`
buckets, multiplied by temperature squared and combined with assistant-only SFT.
Unknown fields, path escapes, symlinks, NaN/Inf, duplicate IDs, unsorted rows,
tokenization drift, probability-mass drift, and any hash mismatch fail closed.

Use the cache through `transformers-peft-topk-kd-lora-v1` with two extra recipe
fields:

```text
teacher_logit_cache_manifest=D:/training/topk-cache-v1/topk-logit-cache.manifest
teacher_kl_weight=0.05
```

Custom preservation and top-k trainers set Transformers'
`model_accepts_loss_kwargs` to false so Transformers 4/5 normalize custom losses
by the active gradient-accumulation window. The preservation engine carrying this
fixed contract is `transformers-peft-preservation-kl-lora-v2`. Top-k receipts
also record mean SFT loss, mean unweighted KL, component batch count, cache
identity, and `trainer-normalized-custom-loss-v1`.

## Source-To-Native Logit Fidelity

Use `build-source-logit-golden.py` to turn a hash-bound float32 CPU
`reference_raw_quality.v1` baseline into exact full-logit source evidence. The
builder reopens the immutable checkpoint, verifies checkpoint and evaluation
hashes before model load, re-tokenizes each exact rendered prompt, replays the
bound top-five source logits, and publishes the full vectors atomically. Compare
native probes with `compare-logit-probes.py`; exact prompt-token parity and an
f32 `.slm` control are required before attributing drift to quantization.

`mixed-q8-matrix-f32-norm-v1` stores token/output and transformer matrices as
q8_0 while retaining the final model norm and every attention, FFN, Q, and K
normalization vector as f32. On the pinned Qwen3-0.6B eight-case evidence it
adds 189,376 bytes over uniform q8, preserves the source argmax for all seven
substantive cases, and materially improves full-vector fidelity. This profile
is a measured conversion option, not assistant-quality authority. Read
`wiki/runtime-mirust/reports/tinyrustlm-qwen3-0.6b-quantization-fidelity-memory-2026-07-12.md`
before changing the profile or making footprint/quality claims.

## PEFT Export And ALR1 Packaging

The runtime supports ranks up to 8. The exporter rejects partial layers, unsupported modules, DoRA, nonzero bias, rank/alpha patterns, `modules_to_save`, unsafe tensor layouts, nonfinite values, all-zero factors, receipt drift, and base-shape drift. PEFT's `B * A * scaling` layout is converted to TinyRustLM row-major `A * B` factors without materializing dense deltas.

```powershell
python tinyrustlm/tools/export-peft-adapter-source.py `
  artifacts/training/quality-sequence-v1/adapter `
  artifacts/external/HuggingFaceTB/SmolLM2-360M-Instruct/a10cc1512eabd3dde888204e902eca88bddb4951 `
  artifacts/training/quality-sequence-v1/adapter-source `
  smollm2-360m-instruct-bpe `
  --source-id smollm2-360m-quality-lora-v1 `
  --source-license approved-training-output-license `
  --training-summary "Sequence LoRA trained from the frozen TinyRustLM quality dataset"

cargo run -p tinyrustlm-slm-pack -- validate-adapter-source `
  artifacts/training/quality-sequence-v1/adapter-source

cargo run -p tinyrustlm-slm-pack -- convert-adapter-source `
  artifacts/training/quality-sequence-v1/adapter-source `
  artifacts/reports/raw-quality-baseline/smollm2-360m-instruct-mixed-q8-output-down-q4-body-v1.slm `
  artifacts/training/quality-sequence-v1/smollm2-360m-quality.alr1 `
  artifacts/training/quality-sequence-v1/smollm2-360m-quality.alr1.manifest
```

Adapter-source v2 uses factor checksums plus conservative reconstructed-delta and L1 upper bounds. Validation is linear in factor size instead of reconstructing every dense model parameter. The resulting ALR1 manifest binds the exact parent `.slm` shape, tokenizer checksum, tensor layout, quantization, and artifact checksum.

## Promotion Gates

1. Re-run untouched public, shadow, and sealed native evals with the adapter applied.
2. Require critical arithmetic, JSON, code, summary, privacy, capability, storage, and uncertainty cases to pass.
3. Compare native and WASM outputs and diagnostics under the same model, adapter, prompt, sampler, and seed identities.
4. Measure adapter bytes, combined model bytes, peak memory, load time, prefill, and decode latency.
5. Run browser multi-turn and starter-card smokes without changing the locked UI composition.
6. Publish raw outputs, hashes, limitations, and human-review evidence.
7. Promote only if quality improves over the unadapted source and the combined artifact remains inside its declared footprint tier.

If the full-precision adapted student cannot beat the current source anchor, stop. If later QAT loses more than 3-5 percent utility or breaks any critical gate, keep the larger honest artifact.

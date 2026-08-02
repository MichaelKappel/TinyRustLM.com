# TinyRustLM Deeper Small-Model Research Intake Synthesis

Date and public verification date: 2026-07-15

## Decision

The twelve reports are helpful, mainly because two independent reports address
each question and expose where the evidence is stable. They do not justify an
architecture rewrite, an LFM port, a custom student pretraining run, or a new
quality claim.

The current route remains:

1. screen exact source behavior before conversion or training;
2. keep the proven dense Rust/WASM path while no hybrid checkpoint qualifies;
3. treat LFM2-style fixed-state layers as a measured research hypothesis;
4. review every candidate training record before it can enter a trainable
   manifest;
5. quantize through a measured fidelity ladder, not a preferred method name;
6. preregister decisions and preserve raw failures without best-of-N repair.

The exact `LiquidAI/LFM2.5-1.2B-Instruct` revision already failed TinyRustLM's
untouched source screen at 4/8. Its immutable rejection receipt is
`sha256:1a69f35637d620f2e9e5c084c27caabb7cfc7287cbe18c84f4cfd18cd5f583b1`.
No new report supplies evidence that invalidates that decision.

## Intake Quality Audit

The reports respected the public-only boundary and did not claim to run private
TinyRustLM code. Their source and rendering quality varies materially:

- six reports contain 318 unresolved `![][imageN]` equation placeholders;
- six alternate reports contain no direct URL at all, despite the prompt's
  primary-source requirement;
- the linked reports contain 24 mutable `/main` repository references and one
  literal `unknown_url` citation;
- several exact thresholds, confidence percentages, memory numbers, and
  training budgets are asserted without a reproducible derivation; and
- paired reports sometimes choose different models or opposite engineering
  methods.

These defects do not make the batch useless. They mean the prose is a source of
hypotheses and test coverage, not an implementation specification.

## Verified Liquid Facts

Public primary sources confirm the useful core:

- LFM2 is a hybrid family combining gated short convolutions with a smaller
  number of GQA blocks. The LFM2 report describes 350M through 8.3B models,
  32K context, 10-12T pretraining tokens, Top-K logit distillation, curriculum
  ordering, and a multi-stage post-training recipe.
- The official LFM2.5-1.2B card describes 1.17B parameters, 16 layers made of
  ten convolution and six GQA blocks, 65,536 vocabulary entries, a 32,768-token
  supported context, and 28T total training tokens.
- The exact repository revision is
  `868df74dd56ff8a0c2ac5dbf281690c2dbebe4c9`. Its config declares 2,048 hidden
  width, 12,288 FFN width, 32 query heads, eight KV heads, a three-token
  convolution cache, tied embeddings, and an explicit mixed layer order.
- The model card says 32,768 context while the config says
  `max_position_embeddings: 128000`. This is a source conflict, not authority
  to advertise 128K.
- The LFM Open License v1.0 is custom. Commercial rights are conditioned on an
  annual-revenue threshold below USD 10 million, with separate redistribution,
  notice, attribution, patent, trademark, and termination requirements.
- The paper's up-to-2x CPU result and the model card's device measurements are
  vendor results. They are not TinyRustLM browser evidence and do not isolate
  architecture from data, distillation, post-training, tokenizer, quantization,
  runtime, or hardware.

Primary references:

- [LFM2 Technical Report](https://arxiv.org/abs/2511.23404), submitted
  2025-11-28, retrieved 2026-07-15.
- [LFM2.5-1.2B-Instruct immutable model card](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct/blob/868df74dd56ff8a0c2ac5dbf281690c2dbebe4c9/README.md),
  retrieved 2026-07-15.
- [LFM2.5-1.2B-Instruct immutable config](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct/blob/868df74dd56ff8a0c2ac5dbf281690c2dbebe4c9/config.json),
  retrieved 2026-07-15.
- [LFM Open License v1.0](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct/blob/868df74dd56ff8a0c2ac5dbf281690c2dbebe4c9/LICENSE),
  updated 2026-06-16, retrieved 2026-07-15.
- [Transformers LFM2 implementation](https://github.com/huggingface/transformers/blob/v5.13.1/src/transformers/models/lfm2/modeling_lfm2.py),
  retrieved 2026-07-15.

## Findings By Assignment

### Hybrid Causal Attribution

Both reports agree on the important point: current public results do not prove
that a hybrid block alone causes superior conversation quality. LFM2 quality is
entangled with very large token budgets, distillation, curriculum, post-training,
tokenizer choices, and optimized runtimes. Fixed-state blocks do offer a real
systems hypothesis: reducing the number of full-attention layers reduces
token-linear KV growth.

Adopt a matched pilot only after a hybrid source passes quality and license
screening. Hold source data, parameter accounting, tokenizer, training tokens,
post-training, quantization, runtime, hardware, context, and workload as equal
as possible. Compare quality, TTFT, prefill, decode, memory, energy, and reset
correctness with confidence intervals. Do not fund a custom hybrid runtime from
vendor tables.

### LFM Operator Conformance

One report selected the relevant 1.2B dense hybrid; the other selected the
16.9GB 8B-A1B MoE checkpoint, which is outside the browser-local target and
cannot serve as the first portable case study. The 1.2B report provides a useful
outline for typed layer kinds, scalar oracles, dual cache lifecycle, reset,
cancellation, native/WASM differential tests, and fail-closed loading.

Do not implement its equations or tolerances directly. Eighty equations are
missing from the rendered report, its source references are partly mutable,
and some claimed tensor rules and parser behavior are recommendations rather
than observed contract. If a future Liquid checkpoint qualifies, rebuild the
operator specification from a full immutable Transformers revision, exact
checkpoint tensors, exported test vectors, and local differential execution.

The current screened model has only about 120 KiB of BF16 convolution state,
but its six GQA layers add 12 KiB of BF16 KV per token. It reduces memory growth;
it is not constant-memory long-context generation.

### Student Capacity And Tokenizer Economics

The reports correctly identify vocabulary embeddings as a first-class part of
the parameter and browser-memory budget. They also correctly distinguish
sequence-level distillation from token-level KL when teacher and student
tokenizers differ.

The proposed 0.3B, 0.8B, and 1.5B blueprints are not build specifications. Key
dimensions are missing behind image placeholders, one blueprint jumps to a
Mamba hybrid without qualifying a source or runtime, and claims that untied
embeddings, QAT, width, or a pruned tokenizer universally improve behavior are
not established. A 500M-token pilot is not a cheap default, and a 500B-token
training prescription is not authorized compute.

Use a generated parameter ledger and measured ablations. Start from supported,
screened dense configs. Compare vocabulary size, tied versus untied embeddings,
depth/width, GQA ratio, context, and quantization one variable at a time. A new
tokenizer must prove Unicode, code, multilingual, chat-template, distillation,
and artifact-size behavior before it replaces an existing one.

### Human Review And Contamination

This is the strongest pair. Adopt immutable record identity, source and license
metadata, teacher settings, assistant-only loss masks, independent review,
adjudication, supersession, removal lineage, hard-negative separation, sealed
holdouts, and a signed trainable manifest.

Apply the pre-release no-debt rule as follows:

- all 42 role-history records receive two independent human reviews;
- all 668 draft records receive at least one explicit human semantic review;
- high-risk records and a preregistered low-risk sample receive a second blind
  review, with adjudication on disagreement; and
- statistical sampling may measure reviewer quality or estimate residual risk,
  but it may not authorize an individually unreviewed record for training.

Correct one technical mistake in both frameworks: a whole-record SHA-256 or
hash of an expected term can detect exact equality only. It cannot detect
n-gram, entity-substituted, or semantic overlap while keeping the holdout
content completely unavailable to the comparison process. Those checks must
run inside a trusted exclusion service or owner-controlled job that can inspect
both sides, emit only bounded decisions and hashes, and prevent training workers
from seeing holdout text.

### Quantization Fidelity

Both reports correctly require separate identities for source, adapter, merged,
quantized, converted, native, and browser subjects. Adopt tensor-level numeric
checks, finite-value checks, reset checks, long-context state drift tests,
untouched behavioral comparison, physical-device metrics, calibration
exclusions, and immutable conversion lineage.

Do not accept the first report's instruction to abandon PTQ in favor of
CKA-guided QAD. The paired report recommends beginning with SFT then PTQ or QAD,
and neither establishes a universal winner for TinyRustLM's model sizes and
kernels. Claims that embeddings and LM heads must always remain FP16, that QAT
guarantees parity, or that one KL/top-k threshold works for every model are too
strong.

Use a preregistered staircase: high-precision reference, simplest runtime-
supported PTQ, mixed-precision PTQ if needed, adapter-aware export, then QAD or
QAT only when measured quality loss and available compute justify it. Promotion
requires semantic non-regression, structured-output validity, native/browser
numerical agreement, memory fit, and a real latency or size benefit.

### Preregistered Decision Campaign

Adopt hypothesis registration, source-first gates, immutable attempts, bounded
retries, no best-of-N, dependency-specific invalidation, and explicit stop
rules. These align with the existing campaign receipt DAG.

Do not make SPRT the universal evaluator. Its simple Bernoulli form assumes a
stable success probability, while TinyRustLM cases are heterogeneous,
stratified, correlated, and include critical failures that must veto promotion
rather than merely decrement a likelihood score. A sequential method may be
used within one preregistered homogeneous stratum, with a fixed maximum sample
and type-I/type-II policy, but it does not replace per-class gates or human
semantic authority.

Also reject the reports' strict linear-work prohibition. Independent data
review, evaluator hardening, release engineering, and fault testing can proceed
behind external blockers as long as receipts state exactly what is and is not
proved.

## Adopt Now

1. Complete the 24-case fault-injection plan as a release gate, preserving safe
   local runs separately from target-platform, physical, and authorized-live
   evidence.
2. Add this exact intake batch and its synthesis to the recomputable public
   secret-scan scope.
3. Add regression coverage proving all twelve reports plus prompt provenance
   are hash-bound, ledger-routed, and removed from active intake.
4. Keep LFM2.5-1.2B rejected and keep hybrid work at research status.
5. Route future data work through individual review and a signed trainable
   manifest; no unreviewed record enters training.
6. Treat PTQ, mixed precision, QAD, and QAT as measured experiment arms.

## Do Not Adopt

- the 8B-A1B MoE checkpoint as a browser case study;
- a custom LFM or Mamba runtime before source quality and license gates pass;
- missing image equations, arbitrary tolerances, or report confidence values;
- mutable `main` links as immutable implementation authority;
- sampling as permission to train on unreviewed records;
- whole-record hashes as semantic contamination detection;
- CKA-QAD, QAT, PTQ, tied embeddings, untied embeddings, or one tokenizer as a
  universal answer; or
- SPRT as the sole promotion authority.

## Additional Information Needed

No additional general research report is needed. The batch resolves the
research question as far as public prose can. Remaining needs are operational:

- human review decisions for the 42 and 668 local records;
- a newly pinned, behaviorally qualified hybrid source before any port;
- authorized legal review for custom-license redistribution or derivatives;
- restored GPU capacity for training-method comparisons;
- physical x64, ARM64, and mobile browser measurements;
- an advertised MemoryEndpoints live lifecycle contract and authorization;
- an outside-network P2P observer and MiniModel publication authority.

No credentials, invitation URLs, signing keys, private prompts, or raw hosted
memory payloads belong in reports, receipts, screenshots, or source control.


# ADR-006: Quantization Profiles

## Status

Accepted. Existing SLM1 F32, Q8_0, Q4_0, and Q5_0 code is development evidence,
not SLM2 profile promotion. SLM2 quantization descriptors and gates are
pending.

## Decision Date

2026-08-08

## Scope

This ADR defines how weight and KV-cache quantization profiles are named,
encoded, evaluated, and promoted. It does not select a winning model or claim
that low-bit compression preserves quality.

## Decision

SLM2 first establishes an F32 reference profile as the conversion and runtime
oracle. Quantized artifacts use closed versioned profile IDs that bind:

- logical tensor role and shape;
- block dimensions and ordering;
- code bit width and signed/code mapping;
- scale and optional offset representation;
- zero-point semantics where applicable;
- tail encoding and padding;
- accumulator precision;
- tensor-role allowlist;
- conversion/calibration algorithm and version;
- native, WASM, and optional WebGPU kernel identity.

The initial promotion order is:

1. F32 reference;
2. Q8 weight-only with F32 accumulation;
3. Q4 weight-only candidate with F32 accumulation;
4. Q5 weight-only candidate only where its measured quality/size tradeoff adds
   value beyond Q4 and Q8.

Embeddings, output projection, normalization parameters, and other sensitive
tensors remain F32 in the baseline unless a separate profile passes mechanical
and semantic evidence. Mixed precision is explicit per tensor; it is never
inferred from byte length.

Weight quantization and KV-cache quantization are independent profiles and
identities. The baseline KV cache remains F32. A compressed KV profile binds
K/V encoding, per-head/block scales, update rule, position policy, cache
layout, dequantization kernels, context limits, and composition identity. KV
bytes from one profile cannot be reused under another.

Ternary, one-bit, TurboQuant-like, TurboVec-like, vector quantization, and
sub-four-bit profiles are experimental until their mathematics, portable
kernels, source/training requirements, licensing, and quality gates are
independently specified. A model is called one-bit only if its actual
purpose-trained representation and kernels satisfy a published one-bit
definition. Post-training packing of ordinary weights does not earn that
claim.

Conversion preserves immutable source, tokenizer, template, calibration,
profile, converter, and output identities. Every quantized artifact is
compared with the source oracle, converted F32 artifact, native runtime, WASM
runtime, and final packaged bytes.

## Alternatives

- **One generic Q4 or Q8 label** was rejected because implementations can
  disagree on blocks, scales, tails, and code maps.
- **Quantize every tensor** was rejected because small sensitive tensors can
  create disproportionate quality loss.
- **Use quantized output as its own oracle** was rejected because it cannot
  expose conversion or kernel drift.
- **Treat weight and KV quantization as one setting** was rejected because
  their error, lifetime, memory, and runtime behavior differ.
- **Adopt a named research method from prose alone** was rejected because
  reports and repositories do not prove portable TinyRustLM behavior.

## Authoritative Evidence

- **Observed local fact**: the SLM1 runtime recognizes F32, Q8_0, Q4_0, and
  Q5_0 and contains validation for quantized scales and payloads.
- **Observed local fact**: the current KV cache stores F32 values.
- **Observed local fact**: current quality gates distinguish structural
  validity from assistant quality.
- **Engineering decision**: F32 is the mechanical oracle and low-bit profiles
  are separately promoted products.
- **Inference**: Q8 is likely the lowest-risk first compressed SLM2 profile,
  but only measurements may confirm it.
- **Local verification required**: every model/profile/backend combination
  needs numerical, behavioral, latency, memory, and stability evidence.

## Threat Analysis

Threats include malformed scales, zero or non-finite values, block-count
overflow, tail overread, code-map disagreement, silent tensor-role
quantization, calibration contamination, backend-specific numerical drift,
quality regression hidden by average scores, and misleading bit-width claims.

The parser validates profile identity, exact expected byte count, finite
parameters, block and tail bounds, and tensor-role permission before
allocation. Kernels never infer a profile. Evaluation preserves raw outputs,
per-case failures, and ordinary-helpfulness regression budgets.

## Performance Evidence

No SLM2 profile is promoted yet. Every candidate reports:

- artifact and resident bytes;
- peak activation and KV bytes by context length;
- load, prefill, and decode time;
- tokens per second and latency percentiles;
- scalar, SIMD, and qualified accelerator results;
- dequantization and conversion cost;
- numerical error by operator/layer/logit;
- fixed, holdout, metamorphic, multi-turn, and human-review quality deltas.

Time estimates use measured throughput formulas. Faster output that exceeds a
preregistered quality, stability, or helpfulness budget is rejected.

## Compatibility Impact

Profile IDs are exact contracts, not aliases. Unknown versions, block layouts,
tail rules, accumulators, or tensor roles fail. SLM1 quantized bytes are not
accepted as SLM2 merely because their marketing label matches.

There is no runtime repacking fallback. A converter emits a new
content-addressed artifact under the selected SLM2 profile.

## Clean Deletion Impact

After SLM2 profile promotion:

- delete SLM1 dtype readers and writers from production;
- delete generic or ambiguous Q4/Q8 aliases;
- delete duplicate kernels that are not bound to a promoted profile;
- remove misleading one-bit or named-method claims without evidence;
- quarantine rejected artifacts and preserve their failure receipts.

## Unknowns

- Model-specific profile winners and regression budgets.
- Whether Q5 adds enough value to justify permanent code and test surface.
- The first useful compressed KV profile and its long-context error budget.
- Whether purpose-trained ternary or one-bit families fit the browser product
  and license constraints.
- Whether any TurboQuant-like or TurboVec-like mechanism has a portable,
  auditable advantage after conversion and end-to-end quality testing.

## Acceptance Tests

1. Golden encode/decode and matmul vectors cover blocks, tails, extremes,
   malformed scales, and every promoted tensor role.
2. Independent converter runs emit byte-identical output.
3. Native scalar is the quantized mechanical reference; SIMD and WASM meet
   preregistered tolerances and deterministic token-ranking gates.
4. Source, F32, quantized native, quantized WASM, and packaged artifacts run
   the same untouched evaluation schedule.
5. Quality gates include unseen paraphrases, practical constraints, authority,
   memory injection, lawful adult helpfulness, summaries, rewrites, JSON,
   extraction, and code.
6. KV candidates test long-context drift, rollover, restart, composition
   mismatch, and cache invalidation.
7. Fuzzing proves bounded rejection for malformed profile metadata and bytes.
8. Claims expose exact profile IDs and never infer intelligence from size.

## Rollback

Reject and quarantine the candidate profile while retaining the last promoted
profile and immutable failure evidence. A release rollback removes the
candidate from selector and catalog metadata. It does not add a permissive
reader or silently substitute another quantization.

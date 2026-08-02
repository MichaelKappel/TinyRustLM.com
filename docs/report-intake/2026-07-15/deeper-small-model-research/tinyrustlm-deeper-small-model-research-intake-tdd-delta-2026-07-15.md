# TinyRustLM Deeper Small-Model Research TDD Delta

Date: 2026-07-15

## Current Decision

Do not start an LFM, Mamba, RWKV, DeltaNet, MoE, or new external-backend port
from this batch. The exact LFM2.5-1.2B source remains rejected at 4/8, and no
other report-nominated hybrid checkpoint has passed the source-quality and
license gates.

The immediate implementation delta is evidence hardening:

1. preserve and route the twelve reports plus prompt provenance;
2. finish the versioned 24-case fault-injection runner and dashboard gate;
3. include the new research and fault-control files in the recomputable public
   artifact secret scan; and
4. regenerate the campaign scan, dashboard, execution memory, and totem only
   after the changed scope is verified.

## Intake Regression Slice

1. Parse the new manifest and require exactly 13 hash-bound source rows:
   twelve reports and one prompt.
2. Recompute every durable file size and SHA-256.
3. Require exactly one ledger outcome per source with
   `preserved-to-durable-memory` and `source_removed: true`.
4. Require the manifest and durable synthesis route in hot `.uai` memory.
5. Require active `agent-file-handoff/Improvement` to contain only `.gitkeep`.
6. Preserve source bytes unchanged; synthesis and TDD files are separate.

## Future Architecture Admission Slice

1. Pin a full repository revision and every config, tokenizer, template,
   weight, and license hash.
2. Pass an untouched practical-conversation screen before conversion.
3. Require authorized license disposition before distribution work.
4. Export scalar test vectors from the exact reference implementation.
5. Add typed layer order, tensor schema, convolution state, KV state, reset,
   cancellation, clone, and context-limit contracts.
6. Prove scalar native parity, optimized native parity, and WASM parity before
   performance claims.
7. Reject the architecture if it provides no predeclared quality-preserving
   browser memory or latency advantage over a matched dense baseline.

## Training-Data Governance Slice

1. Give every one of the 42 records two blind human reviews.
2. Give every one of the 668 records one explicit human review; dual-review
   all high-risk records and a preregistered low-risk sample.
3. Add adjudication, reviewer calibration, drift, fatigue, and agreement
   receipts without putting private content in public evidence.
4. Validate assistant-only loss masks against the exact tokenizer and chat
   template, including first-assistant-token and truncation boundaries.
5. Preserve rejected, repaired, regenerated, superseded, and removed record
   identities in immutable lineage while excluding unauthorized content from
   training workers.
6. Run exact, n-gram, entity-substituted, response-answer, template-family, and
   semantic overlap checks inside an owner-controlled exclusion boundary.
7. Sign a trainable manifest; fail closed on any absent review, license,
   exclusion, tokenizer, mask, or lineage identity.

## Quantization Fidelity Slice

1. Bind source, adapter, merged, calibration, quantizer, quantization config,
   converted artifact, native runtime, WASM runtime, workload, and raw outputs.
2. Start with a high-precision reference and the simplest supported PTQ tier.
3. Measure finite intermediates, logit distribution drift, top-k stability,
   state drift, reset, long-context behavior, and native/WASM parity.
4. Compare untouched semantic behavior by product class and preserve every raw
   failure without repair.
5. Escalate to mixed precision, QAD, or QAT only when a measured failure and a
   preregistered hypothesis justify the additional compute.
6. Promote only a Pareto-useful tier with quality inside budget and a measured
   artifact, memory, latency, or energy advantage on target hardware.

## Sequential Evaluation Slice

1. Keep critical semantic classes as explicit veto gates.
2. Use sequential statistics only inside homogeneous, preregistered strata.
3. Bind hypotheses, indifference region, alpha, beta, maximum sample, seed
   policy, correlation treatment, and stopping boundaries before outputs.
4. Preserve inconclusive outcomes; do not widen thresholds after seeing a
   preferred model.
5. Human semantic review remains authoritative on disputed meaning.

## External Gates

Local implementation can continue behind these blockers, but campaign
completion cannot:

- human authorization and review of local training records;
- a qualified hybrid checkpoint and custom-license approval;
- NVIDIA GPU recovery for scale-up comparisons;
- physical Linux ARM64 and mobile execution;
- a versioned MemoryEndpoints production lifecycle contract;
- authorized external P2P observation and public endpoints; and
- MiniModel catalog publication authorization and public HTTPS readback.


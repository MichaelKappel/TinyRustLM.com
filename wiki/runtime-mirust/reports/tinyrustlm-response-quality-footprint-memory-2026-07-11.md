# TinyRustLM Response Quality and Footprint Implementation Memory

## Current Truth

The July 11 intake contains twelve reports covering failure analysis, compact-model selection, distillation/QAT, `.slm`/WASM footprint, tokenizer/conversion fidelity, and honest evaluation/delivery. Exact source copies and hashes are preserved in `docs/report-intake/2026-07-11/`.

Fresh raw measurements supersede older quality claims:

- the 8.6 KiB MiniModel artifact is a runtime fixture, not an assistant;
- SmolLM2-135M q8 is 136,863,168 bytes, peaked at 298,172,416 bytes, and produced semantically wrong raw answers;
- SmolLM2-360M q4 is 227,667,520 bytes, peaked at 485,191,680 bytes, and also produced wrong raw answers;
- SmolLM2-360M q8 is 364,654,528 bytes and improves first-step rankings but still flips the reference arithmetic top token;
- reference and TinyRustLM prompt token IDs match exactly for the current probe, so tokenizer/ChatML drift is not the active first-token cause;
- existing accepted sidecars use retries, decomposition, field generation, or normalization and cannot alone prove raw model quality;
- the runtime default repetition penalty `4.25` does not match the pinned SmolLM2 reference default and is a likely later-token quality amplifier.

## Current Decision

No current artifact is approved as the production chat default. The next large implementation slice is **Reference-Locked Conversion and Runtime Fidelity**, followed by mixed q8/q4 packing selected from measured tensor sensitivity, then raw semantic promotion and browser delivery.

SmolLM2-360M is the current minimum general-assistant fidelity anchor. SmolLM2-135M may be researched for narrow specialist use but is rejected as the main assistant. A roughly 0.5B model is the next quality candidate after independent architecture/tokenizer support. Custom 250M-350M distillation/QAT is conditional future work, not the first fix.

## Required Sequence

1. Enforce one-call, untouched raw-output evaluation and demote transformed sidecars from promotion authority.
2. Check in source-bound full-logit golden vectors and exact tokenizer/chat-template conformance fixtures.
3. Prove reference-to-native f32 and native-to-WASM parity.
4. Localize q4/q8 error by tensor family and kernel.
5. Replace universal repetition penalty with model-bound generation defaults and test sampler order/stop semantics.
6. Build a mixed q8/q4 artifact using measured sensitivity, targeting <= 280 MiB and <= 640 MiB browser peak.
7. Pass semantic gates for arithmetic, code, summaries, JSON, extraction, clarification, multi-turn state, injection, and safety without repair or retries.
8. Add worker-owned, resumable, verified local delivery while preserving the locked UI and Active Conversation Mode.

## Truth Boundaries

- GQA is implemented in current source; report claims that it is unsupported are stale.
- Current q4/q8 evidence proves quantization/runtime drift is not ruled out.
- Public report prompt tables without repository artifacts are not measurements.
- q5/q6, q8/int4 KV, sparse residuals, SLM2, OPFS paging, WebGPU, and custom QAT are not current production capabilities.
- Proposed SLM2 headers in the reports are internally size-inconsistent and require a tested redesign.
- A fixed clarification token, answer lookup, prompt-specific branch, hidden retry, schema repair, or generated-field assembly cannot count toward model promotion.
- Smoke artifacts never act as chat models or learned routers.

## Routes

- Manifest: `docs/report-intake/2026-07-11/MANIFEST.md`
- Reviewed synthesis: `docs/report-intake/2026-07-11/tinyrustlm-response-quality-footprint-synthesis-2026-07-11.md`
- TDD plan: `docs/report-intake/2026-07-11/tinyrustlm-response-quality-footprint-tdd-plan-2026-07-11.md`
- Raw quality fixture: `tinyrustlm/tests/fixtures/assistant-quality-raw-open-chat-eval-cases.txt`
- First-step fixture: `tinyrustlm/tests/fixtures/smollm-first-step-logit-probe-eval-cases.txt`
- Raw reports: `artifacts/reports/raw-quality-baseline/`
- Runtime generation: `tinyrustlm/runtime/src/generate.rs`
- Eval runner: `tinyrustlm/runtime/src/eval_runner.rs`
- Sampler: `tinyrustlm/runtime/src/sampler.rs`

This memory is a routing and implementation decision record. The exact report bodies remain durable evidence under the intake batch and must not be copied into hot `.uai` memory.

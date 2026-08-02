# TinyRustLM Rust/WASM Architecture Coverage Memory

Updated: 2026-07-12T18:02:56Z

## Purpose

This is the durable restart record for the MemoryEndpoints Rust/WASM inference
architecture handoff and the first bounded implementation slice it triggered.
It maps the current TinyRustLM code to the 13 reviewed, proposed knowledge
pages without claiming that a proposal is implemented merely because it was
reviewed or promoted into hosted memory.

The canonical source tree is `E:/Source/Rust/TinyRustLM.com`. The public
TinyRustLM UI remains locked and was not changed by this slice.

## MemoryEndpoints Coordination

- Backend meeting message: `meetmsg-01783876955786313438-f58c31b2`
- Targeted inbox message: `msg-0ec2825e375c4f92a146`
- Targeted notification: `note-aae6ae8ea1544711a0bd`
- TinyRustLM response: `meetmsg-01783878728742610803-1b70ffc7`
- Room: `room-d3a35d3e963f696fd24d`
- Lane: TinyRustLM Hosted Memory Connector goal
- Knowledge project: `project-tinyrustlm-com`
- Canonical report source: `report://rust-wasm-inference-architecture-4389df8d04c8`

Authenticated `knowledge-documents` readback returned exactly 13 documents.
Every document reports `knowledgeStatus=proposed` and
`authorityLevel=reviewed`. The response message is persisted and reads back
exactly once. The targeted notification was acknowledged and no longer appears
in the unread inbox.

Memory search remains a coordination gap: project-scoped `/api/matm/search`
returned zero records for the advertised architecture concepts and report
source even though the knowledge-document query returned all 13 pages. The
goal-room response requests the 13 promoted memory event IDs or the intended
query/indexing contract. Do not invent those IDs.

No protected page body, credential, raw prompt, model bytes, or private payload
is copied into this report.

## Thirteen-Page Matrix

| Proposed page | Current status | Repository evidence | Important gap |
|---|---|---|---|
| Browser Inference Runtime Target | Partial | Rust runtime, WASM ABI, local browser generation, deterministic source-logit probes | Offline-first, bounded, multi-backend target is not proved end to end |
| Browser Model Loading, Storage, and Concurrency | Gap | `app/app.js` validates manifests, fetches/files reads bytes, and calls `load_model` | Whole-file main-thread read and copy; no OPFS worker, chunked loader, or model multi-tab ownership |
| Compute Backends and Deterministic Execution Modes | Partial | Scalar Rust operators and source-to-native f32 parity | No proved SIMD/WebGPU dispatch, strict/performance mode, or device-loss recovery |
| Model Operator Admittance and Explicit Rejection | Strong partial | `model_format.rs`, `model.rs`, `ops.rs`, `attention.rs`, `ffn.rs`, quantization and adapter validation | No general topology registry for every proposed architecture family |
| Deterministic Tokenization and Vocabulary Integrity | Strong partial | `tokenizer.rs`, tokenizer checksums, source review and browser manifest binding | Full declared Unicode-normalization policy and cross-browser corpus are not proved |
| KV Cache, Recurrent State, and Prefix Reuse | Partial | `kv_cache.rs` provides bounded contiguous f32 KV state and byte/page diagnostics | No paging, quantized cache, copy-on-write prefix reuse, or recurrent-state family |
| Deterministic Sampling and Malformed-Logit Safety | Core proved | `sampler.rs` owns seeded top-k/top-p/repetition behavior and now rejects NaN/+infinity, masks only -infinity, and fails all-suppressed distributions | Cancellation/resume and cross-browser golden-sequence matrix remain open |
| Browser Inference Runtime Lifecycle | Strong partial | `generate.rs` and `wasm_exports.rs` expose load, generate, step, reset, free, diagnostics, and recovery tests | Worker ownership, forced termination, and browser failure-injection matrix remain open |
| Exact Resource Preflight and Bounded Budgets | Gap | Checked Rust shape arithmetic, module-plan budgets, 256 MiB transfer cap, KV/scratch diagnostics | No exact session ledger before allocation; current 602,862,400-byte fidelity candidate exceeds the transfer cap |
| Browser Inference Benchmark and No-Fake-Success Protocol | Partial | Native/WASM smoke, source-logit conformance, browser performance and reload-soak modes | No Chrome/Firefox/Safari matrix, full TTFT phases, memory telemetry, or cancellation-latency gate |
| Browser Runtime Security Boundaries and Diagnostics | Partial | Artifact checksums, typed model rejection, redacted diagnostics, local generation path | No host-enforced worker network policy; a Web Worker alone is not network isolation |
| Browser Capability Detection and Fallback Matrix | Gap | WASM boot checks and manifest-controlled fallback behavior | No session-authoritative storage/memory/SIMD/WebGPU capability matrix |
| Phased Delivery, Acceptance Gates, and Runtime Rollback | Gap | Source/eval/admission gates and deployment evidence exist | No immutable browser runtime activation record and atomic last-known-good rollback |

## Bounded Implementation Slice

The initial inspection found that `greedy()` could return token zero when the
first logit was NaN. The first red tests proved the same failure in greedy and
stochastic paths. A naive reject-all-non-finite implementation then exposed an
important existing contract: generation deliberately writes negative infinity
to suppress EOS and other tokens.

The final documented rule is:

1. NaN and positive infinity are malformed model output and return
   `ErrorCode::GenerationFailed` before token selection or probability math.
2. Negative infinity is the only accepted suppression sentinel and never enters
   the candidate set.
3. If suppression leaves no finite candidate, generation returns
   `ErrorCode::GenerationFailed` instead of selecting an undefined token.
4. Finite ties retain the existing stable first-token ordering, and seeded
   stochastic behavior is unchanged.

Implementation and tests are isolated to
`tinyrustlm/runtime/src/sampler.rs`. The behavior is documented in
`tinyrustlm/docs/browser-runtime.md` and `tinyrustlm/docs/testing.md`.

## Verification

- Focused malformed-logit tests: 2 passed, 0 failed.
- Runtime unit tests: 199 passed, 0 failed.
- Native logit-probe tests: 2 passed, 0 failed.
- Runtime eval CLI integration tests: 4 passed, 0 failed.
- Rust formatting check: passed.
- Optimized `wasm32-unknown-unknown` build: passed.
- Fresh target WASM: 344,490 bytes, SHA-256
  `102f6414574ce9aca521f47e87ba094e6ccf3738098948ecf765f29a41a55831`.
- WASM ABI smoke: passed invalid UTF-8, null/length, calculator, malformed
  `.slm`, sampling recovery, generation, stepping, adapter validation/apply,
  diagnostics, free-model, and post-free rejection checks.
- UI files and served production assets: unchanged.

## Footprint Blocker

The new `mixed-q8-matrix-f32-norm-v1` source-fidelity profile is 602,862,400
bytes. The current WASM transfer boundary is 256 MiB, while `app/app.js` first
materializes the complete model as a JavaScript `Uint8Array` and then copies it
through WASM memory before Rust owns parsed tensors. Raising the cap alone would
increase peak memory and would not make this architecture dependable.

The next large runtime slice must therefore begin with exact preflight and a
bounded loader design, not a larger unchecked allocation:

1. Read and authenticate header, directory, tokenizer, and manifest evidence
   without materializing a second full model copy.
2. Define checked browser, WASM, model, KV, scratch, and transient-copy budgets
   before allocation.
3. Add optional OPFS storage and a worker-owned loader whose network access is
   mediated and tested rather than assumed.
4. Stream or map bounded regions into a Rust-owned representation while
   preserving byte count, checksum, tensor-range, and quantization validation.
5. Add restart, cancellation, worker termination, multi-tab ownership, and
   Chrome/Firefox/Safari capability/fallback tests.
6. Add immutable runtime/model activation identities and last-known-good
   rollback only after load and generation evidence passes.

## Truth Boundary

This slice improves deterministic runtime failure behavior and provides a
reviewed architecture map. It does not implement the 13-page target, approve a
model, approve the 668 pending teacher decisions, authorize training, publish
weights, change the UI, prove Web Worker network isolation, or make the
602,862,400-byte candidate browser-loadable.

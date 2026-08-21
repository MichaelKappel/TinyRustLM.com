# SLM2 Scalar And Browser-WASM Conformance Checkpoint

## Status

This document records a bounded implementation checkpoint for the sole SLM2
dense-F32 runtime. It proves scalar operator execution against an independently
implemented public oracle and proves that the same Rust scalar core replays the
same vectors in native Rust, Node WebAssembly, and real headless Chromium.

It does not qualify a useful model, establish source-framework parity, freeze a
production model-transfer ABI, prove tokenizer or chat-template behavior,
promote sampling beyond lowest-ID greedy selection, or advance a campaign
counter.

## Scalar Runtime

`tinyrustlm-slm2-runtime` retains one validated canonical SLM2 byte vector and
does not create an F32 weight shadow. Activation preflights model, scratch, and
maximum KV-cache bytes before reserving session state. Checked arithmetic and
stable bounded errors cover model size, sequence length, tensor bounds, tensor
shape, allocation, cache consistency, token range, and non-finite arithmetic.

The implemented operator path is:

1. token embedding;
2. RMS normalization;
3. query, key, and value projections with optional biases;
4. optional per-head query/key normalization;
5. split-half RoPE;
6. causal grouped-query attention over committed F32 KV state;
7. attention output projection and residual;
8. RMS normalization;
9. SiLU-gated feed-forward projections and residual;
10. final RMS normalization and tied or untied vocabulary projection.

Qwen3-style wider query geometry is supported: query width is head count times
head dimension while key/value width is KV-head count times head dimension.
Cache growth is transactional on runtime failure. Greedy generation commits
every emitted token, including the final bounded or stop token, so session
position and KV state equal the actual transcript.

The optional `ScalarTraceSink` receives borrowed finite intermediates in exact
execution order. Normal inference allocates no trace storage; the caller alone
decides whether diagnostic values are copied.

## Independent Oracle

`tinyrustlm/tools/slm2-runtime-reference.js` is a standalone Node arithmetic
implementation. It does not invoke Rust, Cargo, a native executable, a network
API, or a child process. It reads the canonical public format vector, verifies
its byte identity and tensor bounds, and performs explicit IEEE-754 float32
rounding after every scalar operation.

The generated language-neutral contract is
`contracts/vnext/slm2-runtime-vectors.v1.json`:

- byte length: 48,369;
- SHA-256: `c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1`;
- oracle source SHA-256:
  `df0b51548dce1a7174166479504a35fe6f5b256dd3168cae970ac8c1df7257b9`;
- source SLM2 SHA-256:
  `c010e2818c64713310699e9ad928d3b22cfeb004756ae8e03acaaee5897e613a`;
- six forward steps across three fresh sequences;
- two bounded generation cases, including first-token stop;
- stage values and F32 byte hashes from embedding through final logits;
- position, committed KV bytes, and lowest-ID greedy token per step;
- absolute tolerance 0.002 and relative tolerance 0.00002.

The Rust integration test deserializes closed contract records, binds every
model field and identity, compares every stage and logit under the declared
tolerance, and requires exact positions, KV growth, and token decisions.

## WASM Boundary

`tinyrustlm-slm2-runtime-wasm-conformance` is intentionally a conformance-only
raw ABI. It embeds the 8,448-byte public canonical fixture and calls the exact
scalar crate. It does not define the eventual multi-gigabyte browser ingestion
contract and cannot be mistaken for a product model loader.

The module has no imports. It exposes bounded reset, forward, position, KV-byte,
greedy-token, logits-readback, error-readback, and clear operations. Output
capacity is secured before token execution. Raw export attributes are the only
locally allowed unsafe-code lint exception; the source contains no unsafe block,
function, implementation, or trait.

Observed development build identity on 2026-08-20:

- Rust 1.96.0, Cargo 1.96.0, LLVM 22.1.2;
- Node 24.14.0;
- Chromium 149.0.7827.55;
- module byte length: 175,382;
- module SHA-256:
  `d41edd922ab1a0582400a43be5ab21acb34216a68603b2c108b59b9d65dc37a9`.

The module hash is local build evidence, not a release identity. A future
release must bind the exact compiler distribution, source commit, target,
flags, module bytes, test contract, browser build, and immutable receipt.

## Verification

The focused checkpoint passed:

- 8 scalar unit tests;
- 3 independent-contract Rust integration tests;
- 4 Node oracle and contract tests;
- 3 WASM tests covering module shape, Node replay, and Chromium replay;
- strict Clippy for both new crates;
- formatting checks;
- locked offline `wasm32-unknown-unknown` release compilation.

Chromium replay performed no network request. Rejection coverage includes
missing session, zero sequence limit, out-of-vocabulary token, sequence
exhaustion, unchanged cache position after rejection, and stable error bytes.

## Remaining Gates

This checkpoint does not close the full runtime gate. Remaining work includes:

- tokenizer and chat-template oracles;
- source-framework and converted-real-model differential vectors;
- deterministic seeded sampling and stop-profile contracts;
- large-model streamed browser ingestion and fail-atomic activation;
- cancellation, worker restart, persistence, deletion, and memory-pressure
  evidence;
- real model performance and semantic qualification;
- SIMD, threads, and WebGPU, each unpromoted until independently proven.

Campaign truth remains `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

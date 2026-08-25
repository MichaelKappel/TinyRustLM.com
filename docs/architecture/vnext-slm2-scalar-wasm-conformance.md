# SLM2 Mixed-Q8 Scalar And Browser-WASM Conformance

## Status

This document records the current scalar reference runtime for TinyRustLM's
single prelaunch model architecture. SLM2 is an exact artifact identity, not a
V2 product. The runtime accepts only the current mixed-Q8/F32 profile; it has no
dense-F32 model fallback, compatibility reader, migration, format negotiation,
runtime repacking, or F32 weight shadow.

The checkpoint proves deterministic fixture execution. It does not qualify a
useful model, prove source-framework parity, define the production large-model
browser ingestion ABI, establish tokenizer/template behavior, deploy a site,
publish a package, or advance a campaign counter.

## Scalar Runtime

`tinyrustlm-slm2-runtime` retains one validated SLM2 byte vector. Tensor views
carry their exact parser-validated element type. Matrix and embedding roles
must be row-wise Q8; normalization and bias roles must be F32. A Q8 element is
read directly from its row scale and signed code at execution time. There is no
secondary weight buffer and no startup transformation.

Activation preflights exact model, scratch, and maximum F32 KV-cache bytes
before reserving session state. Checked arithmetic and stable bounded errors
cover model size, sequence length, tensor bounds, shape, allocation, cache
consistency, token range, Q8 payload validity, and non-finite arithmetic.

The implemented operator order is:

1. dequantized token-embedding row;
2. F32 RMS normalization;
3. ordered Q8 query, key, and value projections;
4. F32 QKV biases;
5. per-head F32 query/key RMS normalization;
6. split-half RoPE;
7. causal grouped-query attention over committed F32 KV state;
8. ordered Q8 attention output projection and residual;
9. F32 RMS normalization;
10. ordered Q8 gate/up projections, SiLU gating, and down projection;
11. residual, final F32 RMS normalization, and untied Q8 vocabulary projection.

Qwen3-style wider query geometry is explicit: query width is head count times
head dimension, while key/value width is KV-head count times head dimension.
Cache growth is transactional on failure. Greedy generation commits each
emitted token, including the final bounded or stop token, so position and KV
state agree with the generated transcript.

The optional `ScalarTraceSink` receives borrowed finite intermediates in exact
execution order. Normal inference allocates no trace storage.

## Independent Oracle

`tinyrustlm/tools/slm2-runtime-reference.js` is a 19,745-byte
Node-builtins-only implementation with SHA-256
`8d76a559790d0d9996c9d17990d982c32e227ce767dbfef17a045181444d4f0e`.
It invokes no Rust, Cargo, child process, or network service. It reads the
canonical mixed-Q8 vector, validates tensor bounds and element types, and
performs explicit binary32 rounding after each scalar operation.

The generated contract is
`contracts/vnext/slm2-runtime-q8-vectors.v1.json`:

- schema `tinyrustlm.slm2-runtime-q8-vectors.v1`;
- 50,801 bytes;
- SHA-256 `c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0`;
- source artifact SHA-256
  `4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502`;
- format profile SHA-256
  `5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8`;
- weight profile SHA-256
  `7e931fd23fa8f6a90c53e4c14c5630eef8ce87e0f0902acd5a5e2df03c60733a`;
- arithmetic profile `tinyrustlm.runtime-q8-scalar-f32-ordered/1`;
- six forward steps across three fresh sequences;
- two bounded generation cases, including first-token stop;
- F32 values and byte hashes at every trace boundary;
- exact position, committed KV bytes, and lowest-ID greedy token per step;
- absolute tolerance 0.002 and relative tolerance 0.00002.

Rust deserializes closed vector records, binds every model/profile identity,
compares every stage and logit under the declared tolerance, and requires exact
positions, KV growth, and token decisions.

## WASM Boundary

`tinyrustlm-slm2-runtime-wasm-conformance` remains a deliberately small
conformance ABI. It embeds the exact 8,704-byte mixed-Q8 fixture and calls the
same scalar Rust crate. It does not define production transfer of a
multi-gigabyte artifact and cannot be used as evidence that large-model browser
activation is complete.

The module has no imports. It exposes bounded reset, forward, position,
KV-byte, greedy-token, logits-readback, error-readback, and clear operations.
Output capacity is secured before token execution. Raw export attributes are
the only locally allowed unsafe-code lint exception; no unsafe block, function,
implementation, or trait exists.

The independent ACG2 format-conformance ABI is feature-gated at its owning
`tinyrustlm-composition2` crate. Its `wasm-conformance` feature is enabled only
when building that format test module and is absent from the production runtime
dependency graph. This prevents transitive conformance exports from silently
broadening the exact SLM2 runtime module surface.

Real-Chromium conformance must instantiate the exact release-target module,
perform no network request, replay every vector, verify typed rejection and
unchanged cache state after failure, close Chromium, and preserve the module,
toolchain, browser, source, and vector identities. A local WASM hash is
development evidence only until bound by an immutable release receipt.

The 2026-08-24 local replay built a 193,948-byte release-target module with
SHA-256 `98e0edaa0dd7572328aeef3eb11eaa62b747d6c5ef54d773c20864790a865270`.
Node and real Chromium both replayed every registered vector with Playwright
1.61.1 using Rust/Cargo 1.96.0. This is bounded development evidence for the
embedded fixture, not a release receipt or a production-model browser claim.

## Required Gates

The maintained focused gate includes:

- 8 scalar unit tests;
- 3 independent-contract Rust integration tests;
- 4 Node oracle and contract tests;
- deterministic vector regeneration;
- Node and real-Chromium WASM replay;
- locked `wasm32-unknown-unknown` release compilation;
- canonical formatting and all-target Clippy with warnings denied;
- source scans rejecting F32 shadow weights, runtime repacking, compatibility,
  network access, retries, output repair, and inflated product claims.

The full runtime gate remains open until the same exact arithmetic is exercised
with a provenance-bound real converted model through the production browser
worker under cancellation, restart, memory-pressure, privacy, and multi-turn
chat tests.

Campaign truth remains 0/20, 0/50, 0/25, 0/40, and 0/20.

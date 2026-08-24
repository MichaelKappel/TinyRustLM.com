# ADR-018: Exact SLM2 Mixed-Q8 Weight Profile

## Status

Accepted for implementation and local conformance. The profile remains
unpromoted until a provenance-bound real model passes source parity, native,
browser, quality, privacy, and release gates.

## Decision Date

2026-08-24

## Scope

This ADR selects the sole weight encoding for TinyRustLM's one prelaunch
product. SLM2 is an artifact-format identity, not a second product generation.

The decision covers tensor-role encoding, row quantization, scalar execution,
container metadata, rejection rules, and local conformance evidence. It does
not promote a model, compress KV state, define optimized SIMD/WebGPU kernels,
or authorize publication.

## Decision

The sole production-bound SLM2 tensor profile is
`tinyrustlm.tensor-mixed-q8-row-f32/1` under weight profile
`tinyrustlm.weight-q8-row-symmetric-f32-scale/1`.

Every supported rank-two matrix and embedding role is stored row-wise as:

1. one little-endian finite positive binary32 scale;
2. one signed two's-complement int8 code per column;
3. no inter-row padding;
4. no tensor tail;
5. no negative-128 code.

The scale for a nonzero row is the binary32 result of dividing the maximum
absolute finite binary32 source value by binary32 `127`. A zero row has scale
bits `0x3f800000` and all codes zero. Negative-zero scale is invalid.

Each normalized source value is rounded to the nearest integer with ties away
from zero after the binary32 division. Codes are bounded to `[-127, 127]`.
Dequantization is one ordered binary32 multiplication of the stored scale and
the sign-extended code.

Scalar matrix multiplication visits columns in increasing order and rows in
increasing order. Every product and addition is rounded to binary32. The
accumulator starts at positive zero. Fused multiply-add is forbidden.

The following exact semantic-role families use Q8:

- token embedding;
- untied output projection;
- attention query, key, value, and output projections;
- feed-forward gate, down, and up projections.

Normalization weights and optional QKV biases remain finite F32. Optional
query/key normalization weights also remain finite F32. A tied output omits
the output-projection tensor instead of storing an alias tensor.

KV state remains independently governed by `tinyrustlm.kv-f32/1`. This ADR
does not permit a compressed KV representation or cache reuse across profiles.

The format contains exactly one 128-byte quantization record. Its stored
element type, code range, scale type, packing order, accumulator, tail rule,
rounding mode, row axis, divisor bits, zero-row scale bits, profile string IDs,
and reserved bytes are all exact. Unknown or changed fields fail closed.

Tensor records declare their element type and exact quantization-profile index.
Encoding is selected by semantic role, never inferred from rank, byte count,
name spelling, or caller preference.

The runtime reads scales and codes directly from validated artifact bytes. It
does not repack weights, allocate a dequantized F32 weight shadow, negotiate a
profile, or substitute another format.

There is one prelaunch product path. No dense-F32 model fallback, old-format
reader, migration parser, dual writer, generic Q8 alias, compatibility mode,
or permissive tail rule is allowed in executable production code.

## Alternatives

- A dense-F32 production artifact was rejected because it defeats the browser
  size objective and would preserve a second executable model path.
- A generic `Q8` or `q8_0` label was rejected because it does not bind scale,
  row, rounding, accumulator, tensor-role, or tail semantics.
- Quantizing norms and biases was rejected for this profile because their byte
  savings are small and their numerical influence is disproportionate.
- Runtime repacking was rejected because it creates hidden resident bytes,
  startup work, and a second representation not bound by artifact identity.
- Per-block scales were rejected for the first profile because the added
  layout and kernel surface is not justified by current evidence.
- Negative-128 codes were rejected to keep the symmetric code domain exact.
- FMA-dependent arithmetic was rejected because native and browser results
  must not depend on implicit contraction.
- One-bit, ternary, TurboQuant-like, and named third-party profiles were
  rejected as current production choices because they lack this profile's
  complete portable evidence chain.

## Authoritative Evidence

- **Observed local fact**: the machine profile is 9,900 bytes at SHA-256
  `7e931fd23fa8f6a90c53e4c14c5630eef8ce87e0f0902acd5a5e2df03c60733a`.
- **Observed local fact**: the independent Q8 vector document is 42,623 bytes
  at SHA-256
  `f81d30bd0646efa4a267ffed8c697c2b7a5c84a67ded9d498aa3ffb10007ca2d`.
- **Observed local fact**: Node and Rust reproduce the exact 8,704-byte,
  17-tensor artifact at SHA-256
  `4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502`.
- **Observed local fact**: the independent runtime vector document is 50,801
  bytes at SHA-256
  `c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0`.
- **Observed local fact**: the bounded 20-entry corpus admits one canonical
  artifact and produces the registered rejection for 19 hostile mutations.
- **Observed local fact**: the release-target conformance WASM replays the same
  vectors in Node and real Chromium with no imports or network requests.
- **Engineering decision**: these identities define the only production-bound
  weight representation.
- **Local verification required**: a real converted model must reproduce its
  source-framework outputs within preregistered numerical and semantic gates.

## Threat Analysis

The parser rejects malformed or drifting quant records, unsupported element
types, unknown profile indexes, code `-128`, non-finite or non-positive scales,
negative-zero zero-row scales, wrong role encodings, size arithmetic overflow,
rank drift, row-width drift, nonzero reserved bytes, nonzero gaps, hash drift,
trailing bytes, and incomplete input.

The runtime rejects non-finite inputs and intermediates, shape mismatches,
token-range failures, cache inconsistency, allocation-limit failures, and
profile-role disagreement before using a tensor.

The independent Node oracle may not invoke Rust, Cargo, a subprocess, or the
network and may not read generated Rust output. Rust closes all deserialized
records with unknown-field rejection. The two implementations therefore do
not share executable quantization logic.

No response repair, output selection, or model-quality inference is part of
this mechanical gate. Exact fixture agreement cannot promote assistant quality.

## Performance Evidence

The local conformance module is 193,948 bytes at SHA-256
`98e0edaa0dd7572328aeef3eb11eaa62b747d6c5ef54d773c20864790a865270`.
That size and its successful Node/Chromium replay are development evidence for
the embedded fixture only.

No real-model load time, prefill latency, decode throughput, peak RSS, browser
memory pressure, energy, or semantic-quality claim is established here.

Promotion requires exact artifact bytes, source parity, tokens-per-second,
prefill/decode latency distributions, resident model bytes, activation bytes,
F32 KV growth, cancellation behavior, restart behavior, and untouched quality
results on the named native and browser targets.

Any optimized kernel remains subordinate to the ordered scalar oracle and must
pass preregistered numerical and token-decision gates without hidden repacking.

## Compatibility Impact

There is no released user format to preserve. The prelaunch codebase accepts
only the exact SLM2 mixed-Q8 profile selected here.

Technical version numbers identify byte contracts. They do not create a V2
product, a migration obligation, or permission for parallel implementations.

Unknown profiles, ambiguous generic quantization names, and dense-F32 model
artifacts fail closed. A source model must be converted into the exact selected
profile before activation.

## Clean Deletion Impact

After every current consumer moves to this profile, delete superseded dense-F32
model writers, readers, fixtures, runtime vectors, runtime branches, converter
routes, browser selectors, package surfaces, and documentation from executable
current authority.

Historical immutable receipts may retain their original facts. They are not
runtime inputs and cannot authorize a compatibility path.

Delete any generic Q8 alias, runtime dequantized weight cache, profile
negotiation, fallback conversion, or test that accepts an alternate encoding.

## Unknowns

- Real Qwen3 source-framework parity under the exact converter.
- Quality delta relative to immutable source weights on sealed cases.
- Peak browser memory for the first provenance-bound useful artifact.
- Whether a future optimized kernel can preserve exact token decisions without
  runtime repacking.
- Whether later KV compression merits a separate exact profile and evidence
  chain.
- Whether any lower-bit trained architecture can beat this profile under equal
  browser, quality, and provenance gates.

## Acceptance Tests

1. Independent Node and Rust writers emit byte-identical canonical artifacts.
2. Every proper prefix of the canonical artifact is rejected.
3. Every registered hostile mutation returns its exact bounded verdict.
4. Half ties, positive/negative extrema, zero rows, and scale bits match.
5. Ordered scalar matvec results match the independent binary32 oracle.
6. Runtime traces match at embedding, normalization, QKV, attention, MLP,
   final normalization, logits, greedy token, position, and KV boundaries.
7. Node and real Chromium execute the exact release-target WASM module.
8. The WASM module has no imports and performs no network request.
9. Source scans reject runtime repacking and F32 model-weight shadows.
10. Rust formatting, locked tests, denied-warning Clippy, and corpus replay pass.
11. Current contract inventories contain only the mixed-Q8 executable vectors.
12. Campaign counters remain unchanged by fixture conformance.

## Rollback

Before promotion, rollback means reverting the unpromoted implementation and
retaining immutable failure evidence. It does not mean enabling dense-F32,
generic Q8, an old reader, or another compatibility path.

After promotion, a defective build is removed from release metadata and the
last independently qualified build of this same exact profile is restored.
A material byte-contract change requires a new preregistration and decision,
followed by clean replacement and deletion before publication.

# Quantization

## Authority

Quantization is an exact model-format and numerical contract, not a size label.
The current compact profile is defined by:

- `contracts/vnext/slm2-q8-weight-profile.v1.json`
- `contracts/vnext/slm2-q8-weight-profile-preregistration.v1.json`
- `contracts/vnext/slm2-q8-weight-vectors.v1.json`
- `docs/architecture/adr/ADR-006-quantization-profiles.md`
- `rust/crates/tinyrustlm-slm2`
- `rust/crates/tinyrustlm-slm2-runtime`

## Current Profile

TinyRustLM currently targets one explicit mixed-Q8 SLM2 profile. Selected
rank-two matrix roles use signed row-symmetric 8-bit codes and F32 row scales.
Profile-listed normalization, bias, and other precision-sensitive tensors
remain F32. Tied output behavior is explicit.

The contract fixes:

- exactly which tensor roles are Q8 and which remain F32;
- scale placement and bit representation;
- signed code range and zero behavior;
- row and tail rules;
- tensor descriptor flags and quantization index;
- dequantization formula and binary32 conversion points;
- scalar multiplication and accumulation order;
- descriptor, quantization-table, payload, and whole-artifact identities;
- finite-value and overflow rejection.

Runtime repacking, inferred encoding, per-device reinterpretation, and an F32
shadow copy as a hidden semantic authority are forbidden.

## Correctness Chain

Quantized execution is promoted only through this chain:

1. deterministic conversion from the immutable source weights;
2. independent structural validation of descriptors, scales, payloads, roles,
   and hashes;
3. hand-checkable quantized dot-product and matrix-vector vectors;
4. source-framework and reconstructed-weight diagnostics;
5. converted scalar-native layer and logits parity;
6. optimized-native differential parity;
7. browser-WASM differential parity;
8. paired no-cheat behavioral noninferiority.

Tolerance is preregistered by operation and tensor class. It is not widened
after observing a preferred candidate. Attractive text is not a numerical
oracle, and numerical parity is not conversational quality.

## Unsupported Claims

TinyRustLM does not currently claim Q4, Q5, one-bit, ternary, TurboQuant,
TurboVec, vector quantization, sparse execution, quantized KV cache, or another
compressed profile. Reported techniques remain research inputs until an exact
profile, scalar oracle, converter, native/WASM implementation, equal-resource
measurement, and untouched quality evidence all pass.

Parameter count, artifact size, a parse pass, or a projected compression ratio
does not prove memory use, speed, accuracy, or browser support.

## Resource Accounting

Measurements must separate:

- immutable model bytes;
- file and browser storage copies;
- WASM linear memory;
- Q8 scales and payloads;
- F32 activations and temporary buffers;
- logits and tokenizer tables;
- KV cache by retained token;
- worker-message copies;
- browser/JIT/process overhead.

Peak memory is measured on exact runtime, browser, operating system, and
hardware identities. A roughly 598 MB model member is only a planning class and
must never be reported as total runtime memory.

## Change Policy

An improved quantizer replaces the one unpromoted compressed profile only after
new vectors and full dependent proof. Do not add profile negotiation,
compatibility aliases, implicit fallback, or a second production quantizer.

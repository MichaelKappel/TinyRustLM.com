# TinyRustLM Vector Oracle Foundation Memory

Date: 2026-07-21 (Pacific)

## Disposition

TinyRustLM now has a source-bound, publish-disabled scalar numerical oracle for
pre-product vector experiments. This is a verified experiment foundation, not
runtime integration, a new `.slm` format, a TurboVec dependency, a TurboQuant
implementation, or evidence of product performance or quality.

Third-party review artifacts were kept outside the TinyRustLM repository and
outside Git. No upstream source file, implementation constant, or test vector
was copied into the project.

## Implemented Boundary

The dependency-free Rust crate
`rust/experiments/tinyrustlm-vector-oracle/` provides:

- an explicit seeded deterministic generator for reproducible experiment data;
- a signed permutation transform for every admitted dimension;
- a signed normalized Walsh-Hadamard transform for power-of-two dimensions;
- deterministic rejection of zero, oversized, unsupported, non-finite, and
  overflow-producing inputs instead of implicit padding or saturation;
- a deterministic discrete Lloyd scalar-codebook oracle with weighted support,
  strict centroids, tie behavior, convergence budgets, and empty-cluster errors;
- canonical little-endian signed and unsigned bit packing for widths 1 through
  16, including tails, padding, alignment-independent slices, and bounds;
- nonallocating packed-code reads plus packed-domain dot product, dense-query
  dot product, and squared-distance references;
- reconstruction MSE, normalized MSE, angular error, score bias, score
  variance, RMSE, pairwise inversions, reference ties, and estimated ties; and
- explicit effective-byte accounting for codes, metadata, transforms,
  codebooks, pages, padding, scratch, and allocator overhead.

The crate is a workspace member only for verification. It is `publish = false`,
has no dependencies, and no runtime, SDK, packer, or browser tool imports it.

## Evidence

The canonical public-safe source/claim ledger is
`tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json`, SHA-256
`ea075bd8f2216afc160094a23ae38b54ec590c8636792003d68338e659003c77`.
It separates static weights, ephemeral KV cache, and durable embedding indexes;
pins four exact TurboQuant/TurboVec source identities; classifies six claims;
and grants neither product nor training authority.

The current verification receipt is
`tinyrustlm/experiments/vector-quantization/scalar-oracle-verification-v1.json`,
receipt `scalar-oracle-foundation-51ab608f417c0b82`, SHA-256
`8772ee70a2de21b294fc3d10c2634059c72062e33397472762462d04e7b7938b`.
It binds 20 exact inputs and records seven passing gates:

- canonical ledger validation;
- ledger and isolation tests;
- workspace rustfmt check;
- 36 Rust unit tests plus one black-box conformance test;
- strict clippy with warnings denied;
- `wasm32-unknown-unknown` compile check; and
- rustdoc generation with workspace missing-docs enforcement.

The receipt ID is bound to the exact input set. Its file hash is specific to
one verification attempt because the receipt also records the attempt UTC time
and bounded hashes of the command output streams.

Separate receipt-validator tests reject input drift, authority inflation, named
method promotion, missing gates, fake coverage, and nested schema expansion.
`cargo test --workspace` also passed on the same worktree in 67.8 seconds.

Measured line coverage is not available because `cargo-llvm-cov` and
`llvm-tools-preview` are absent. Miri is unavailable on the installed stable
toolchain. The receipt preserves both as gaps with no fabricated percentage or
memory-model pass. The implementation forbids unsafe Rust, but that is not a
substitute for measured coverage, Miri, fuzzing, or sanitizer evidence.

## Truth Boundary

This work proves only the checked scalar contracts and isolation described
above. It does not prove or authorize:

- TurboVec numerical or persistence parity;
- a named TurboQuant, QJL, EDEN, RaBitQ, or structured-transform arm;
- retrieval recall, deletion, privacy, native SIMD, WASM SIMD, or latency;
- KV-cache attention fidelity, memory savings, or conversation neutrality;
- any weight-format, bit-width, `.slm`, model, training, catalog, or release
  claim; or
- use of unresolved human-review records for training.

Static model weights remain unchanged. The scalar oracle is not linked into the
product and can be removed without a compatibility path.

## Next Gate

Before a named method is implemented, extend the source/claim ledger with exact
primary-source revisions and license evidence for every arm, preregister equal
effective-byte manifests and independent metric thresholds, and preserve
generated clean-room conformance vectors. Then build deterministic exact flat
retrieval before native/WASM kernels, and keep a separately identified KV-cache
prototype behind numerical plus untouched behavioral gates.

The deeper TurboVec/TurboQuant research assignment and MemoryEndpoints platform
contract retry remain active intake. The 42-record and 668-record human-review
sets remain unresolved and have no training authority.

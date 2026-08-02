# TinyRustLM Q4 SIMD Acceleration Memory

Date: 2026-07-12

Status: implemented and locally verified; coherent browser model not promoted

## Purpose

This slice removes a measured q4 inference bottleneck without changing the
approved TinyRustLM UI, the `.slm` wire format, model weights, tokenizer,
sampling policy, or quality gates. It is runtime performance evidence, not a
claim that the public default model is conversationally capable.

## Implementation

The runtime keeps the scalar q4 implementation as the oracle and adds two
bounded optimized implementations for the production q4 block size of 32:

- native x86/x64 dispatch uses AVX2 only after runtime feature detection;
- the opt-in `wasm-simd` feature emits a separate SIMD128 WebAssembly binary;
- both implementations consume packed nibbles and block scales directly;
- neither implementation creates a decoded model-sized shadow matrix;
- all length, shape, and block checks execute before localized unsafe loads.

The browser now validates an independent manifest and checksum for each WASM
variant. It selects `tinyrustlm-simd.wasm` only when `WebAssembly.validate`
accepts that module and otherwise uses the independently verified scalar
`tinyrustlm.wasm`. The selected variant is exposed only as machine-readable DOM
state. No HTML structure, CSS, labels, controls, or conversation layout changed.

## Native Performance And Parity

The controlled probe used the same 969,648,576-byte
Qwen2.5-1.5B-Instruct q4 `.slm`, the same rendered 430-byte ChatML prompt, and
the same 83 token IDs in both runs.

- scalar release prefill: approximately 135 seconds;
- AVX2 release prefill: 16,807 milliseconds;
- measured local speedup: approximately 8.0x;
- argmax token: 40 in both runs;
- top-5 and top-32 overlap: 1.0;
- logit cosine similarity: 0.9999999999569831;
- centered cosine similarity: 0.9999999999786171;
- maximum absolute logit difference: 0.00014925003051757812;
- RMSE: 0.00003543;
- Jensen-Shannon divergence: approximately 1.16e-10.

Scalar probe manifest SHA-256:
`963600270c4af8554ea8146bfbb02ee19269173f735f1ef880abaf2813f29a68`.
Scalar logits SHA-256:
`776bcf4b8e04e8e3a5ee4fa3044f92653ef774bae21661e274cc2c172e946de6`.
AVX2 probe manifest SHA-256:
`7fec4f6a61e83f0b3a9cc7516516cbd1d2a389b79c8dbbb4e62854f8d775545d`.
AVX2 logits SHA-256:
`7e1bb5f61cb94e7ef1e7a7ba52eecf225c2919078fb57e58a2e91556de2d2d99`.

The different logit checksums are expected from vectorized floating-point
accumulation order. Differential thresholds and identical ranking evidence
guard semantic parity. No browser throughput claim is made yet because the
quality candidate cannot pass the current browser loading boundary.

## Checked Browser Artifacts

- scalar WASM: 382,044 bytes, SHA-256
  `265ec3955a25f5ba5deedfe8266c2b21861565c625a02336a43bfcd2105f4f69`,
  manifest checksum `0xed466ff9e391c96d`;
- SIMD WASM: 381,700 bytes, SHA-256
  `87f2977b379f02ed7496f4b89fa5cc2d742c1ac41b73a3c180eb25f2572d414f`,
  manifest checksum `0xf37a5b3c5579c9c5`.

The headless browser selected `simd128`, reached loaded WASM state, and
requested the matching SIMD manifest/binary pair. A separate drift test served
an intentionally false SIMD checksum, reached `Boot failed`, kept generation
controls disabled, and made no model-byte request.

## Verification

- `cargo test -p tinyrustlm-runtime`: 223 library tests, 2 logit-probe tests,
  and 5 eval CLI integration tests passed;
- `cargo test -p tinyrustlm-slm-pack`: 524 unit tests plus 1, 16, and 7 CLI
  integration tests passed;
- `cargo fmt --all -- --check` passed;
- clippy passed for both changed Rust packages with warnings denied;
- scalar and SIMD WASM release builds passed;
- scalar and SIMD WASM ABI smokes passed against q4 model bytes;
- JavaScript syntax checks passed;
- `runtime-variant` and `runtime-manifest-drift` browser smokes passed.

## Remaining Browser Blocker

The coherent q4 candidate is about 970 MB. The current browser loader first
materializes the complete response in JavaScript, copies it to a WASM transfer
allocation, and then `Model::load` copies every tensor into separate Rust
vectors. Raising the 256 MiB transfer cap would preserve this multi-copy peak
and is not an acceptable implementation.

The next slice must establish an ownership-taking model load: one WASM-resident
backing allocation, offset-backed immutable tensor views, separately owned
mutable adapter tensors only when mutation is requested, explicit ownership
transfer at the ABI, and deterministic release on load failure, replacement,
or `free_model`. Streaming into that owned allocation can then remove the
browser `arrayBuffer` copy. This work must remain TDD-backed and preserve the
scalar oracle, checksum admission, malformed-model rejection, adapter behavior,
and the locked UI.

## Truth Boundary

- Qwen2.5 q4 native inference: substantially faster with near-identical logits.
- SIMD browser artifact selection and checksum rejection: proven locally.
- Qwen2.5 browser load and browser SIMD throughput: not yet proven.
- Qwen2.5 honest eval: 7/12 under the current strict evaluator, not promoted.
- Intelligent coherent public conversation: still active and unproven.

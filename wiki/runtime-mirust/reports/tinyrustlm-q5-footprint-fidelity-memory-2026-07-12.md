# TinyRustLM Q5 Footprint, Fidelity, And Runtime Memory

Date: 2026-07-12

## Decision

TinyRustLM now has a real `q5_0` tensor contract across `.slm` parsing,
validation, native loading, matrix-vector execution, adapter application,
generation, diagnostics, public inspection, and the WASM ABI. The measured
Qwen3-0.6B profile `mixed-q5-matrix-f32-norm-v1` is a useful experimental
footprint point at 414,633,280 bytes (395.425 MiB), but it is not approved as
an assistant-quality or browser-default model.

The profile preserves only 4 of 8 source first-token argmax decisions. Its
minimum centered cosine similarity is 0.961345 and its maximum Jensen-Shannon
divergence is 0.176864. The current q8-matrix/f32-norm control preserves 7 of
8 argmax decisions with materially better geometry. Q5 therefore remains an
explicit opt-in evaluation format while response quality and kernel latency
work continue.

Two follow-up layouts were measured and rejected. Neither restored an
additional argmax decision, and neither justified its larger artifact. They
were removed from the production converter choices rather than retained as
unproven profiles.

## Truth Boundary

- No generated response was repaired, replaced, retried, or fixture-matched.
- Every conformance case used the same SHA-bound source golden, rendered
  prompt, token IDs, and full-vocabulary comparison procedure.
- The q5 implementation is runtime-compatible, not quality-admitted.
- The checked tiny q5 fixture proves format and execution behavior only. Its
  deterministic `e` output is not conversational evidence.
- The q5 Qwen3 artifact is not in the browser selector, default registry, P2P
  recommendation set, or release promotion lane.
- The approved TinyRustLM UI was not changed.
- The full-vocabulary scalar probes are diagnostic evidence, not an end-user
  tokens-per-second benchmark.

## Format Contract

`q5_0` uses signed five-bit values in groups of eight values per five payload
bytes. Each tensor declares a block size divisible by eight and carries one
positive finite f32 scale per block. Tensor byte-length calculation fails
closed for non-divisible element counts. Model loading rejects malformed
payload lengths, scale lengths, non-positive scales, non-finite scales, and
unsupported dtype combinations before inference.

The runtime decodes fixed eight-value groups directly during matrix-vector
execution. It does not allocate or persist an f32 shadow copy of a q5 tensor.
Sparse and low-rank adapter paths are covered on loaded q5 tensors, and model
diagnostics report `q5_0` for q5 plus f32-norm layouts.

## Measured Candidates

MiB values use 1,048,576 bytes. All candidates use the same eight prompts and
source golden.

| Profile | Bytes | MiB | Top-1 | Min centered cosine | Avg centered cosine | Min top-5 | Avg top-5 | Max JS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| q8 matrix + f32 norms control | 602,862,400 | 574.934 | 7/8 | 0.995112 | 0.995695 | 0.8 | 0.900 | 0.045915 |
| q5 matrix + f32 norms | 414,633,280 | 395.425 | 4/8 | 0.961345 | 0.970227 | 0.6 | 0.725 | 0.176864 |
| rejected q5 sensitive block32 | 426,323,264 | 406.574 | 4/8 | 0.962717 | 0.971020 | 0.6 | 0.800 | 0.182469 |
| rejected q8 edge + q5 body | 424,561,984 | 404.894 | 4/8 | 0.967200 | 0.974559 | 0.4 | 0.775 | 0.159733 |

The accepted experimental q5 profile is 188,229,120 bytes (179.509 MiB,
31.22 percent) smaller than the q8-matrix/f32-norm control. The sensitive
block32 experiment adds 11,689,984 bytes without improving top-1 and worsens
maximum JS divergence. The q8-edge experiment adds 9,928,704 bytes without
improving top-1 and drops minimum top-five overlap from 0.6 to 0.4.

## Performance Evidence

The original q5 full-vocabulary eight-case scalar probe completed in 2,258.8
seconds. The q5 kernel was then changed to decode fixed groups of eight codes
per five-byte word. A later full sensitivity probe completed in 1,470.496
seconds, roughly 34.9 percent less wall time than the earlier run.

That comparison demonstrates a meaningful kernel-path improvement but is not
a strict same-artifact benchmark because the later probe used the sensitivity
layout. The optimized native path is still far too slow for deployment. A
promotion candidate needs separate prefill and decode measurements on the
same artifact, release build, machine, prompt set, and thread configuration.

## Artifact Identities

| Artifact | SHA-256 |
| --- | --- |
| q5 matrix/f32-norm `.slm` | `38b06cc952af07b3b3654d7e9e356b71e9610b895202faa68bc32bfebba6a8c7` |
| q5 matrix/f32-norm manifest | `b06fa9bed077fe46d1a5baf31f74f615013b53eda80fcf2c095395453b272d3a` |
| q5 matrix/f32-norm conformance | `bd361d43783997f06fe13313bfb555df1501d924444139ca0795d4680dfe46ea` |
| rejected q5 sensitive block32 `.slm` | `9a76aabcdd452a24cc90d7c9fd8466281a19c20e31d06e9d79b04f9c7791106a` |
| rejected q5 sensitive conformance | `a3438d264d36b6a3b4d2df1eaad2d7890e0024fedd0e84ec68cbb4709cae2fc0` |
| rejected q8-edge/q5-body `.slm` | `c3cfedd612bbbdede7da2e66a89936e67df0e936c0a9cf9b1d4a10aa1a3a3151` |
| rejected q8-edge/q5-body conformance | `99c6c4f34f3ae861988944d11c029d2e80a65a28b0e8606fd4828edc0c4b6ea1` |
| q8 matrix/f32-norm control `.slm` | `98452d9026c697e32ae739964747cd64745b4f7dc9b6e20f10b875e125c01363` |
| q8 matrix/f32-norm control conformance | `1ceeed6e7ef75db26c113682765206783f9b82b3d098253421a1ffb179543e58` |

The q5 `.slm` manifest also binds runtime checksum
`0x393a0203d44080c2`, 596,049,920 parameters, 310 tensors, GPT-2 BPE tokenizer
checksum `0x8e0a9c77654ded4a`, and profile layout checksum
`0x51ce15a862ebd8cd`.

## Verification

- `cargo fmt --all -- --check`: pass
- `cargo clippy --workspace --all-targets -- -D warnings`: pass
- `cargo test --workspace`: pass
- runtime unit tests: 208 pass, including q5 generation and q5 adapters
- packer unit tests: 513 pass, plus all CLI integration suites
- public `.slm` crate q5 inspection: pass
- .NET Release solution: 123 tests pass
- active-conversation, calculator, and MemoryEndpoints browser contracts: 28 pass
- protected NuGet verification: five `.nupkg`, five `.snupkg`, API and content
  allow-lists, metadata, documentation hashes, and clean consumer smoke pass
- q5 fixture validation: 7,296 bytes, 4,824 parameters, checksum
  `0x1355e0c2ad865ca4`
- release `wasm32-unknown-unknown` build: pass
- q8 WASM ABI smoke: pass with recovery mode `q8_0`
- q5 WASM ABI smoke: pass with recovery mode `q5_0`
- q8 and q5 corruption smokes: non-positive scale rejected as `InvalidHeader`

## Required Next Gates

1. Keep q5 opt-in and absent from selector/default admission.
2. Train or select a source model that passes the practical casual-dialogue
   cases before treating compact-format fidelity as assistant quality.
3. Expand the conformance set beyond eight prompts and require quality on
   held-out multi-turn conversation, common-sense planning, clarification,
   memory precedence, and prompt-injection resistance.
4. Establish same-artifact prefill and decode latency baselines, then optimize
   SIMD or tiled kernels without weakening numerical gates.
5. Re-run native generation, WASM parity, browser interaction, footprint,
   memory retrieval, P2P, and locked-UI gates on any promotion candidate.

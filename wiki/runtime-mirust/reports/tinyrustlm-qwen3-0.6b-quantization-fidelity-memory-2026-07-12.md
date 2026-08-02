# TinyRustLM Qwen3-0.6B Quantization Fidelity And Footprint Memory

Date: 2026-07-12

## Decision

The current Qwen3-0.6B source-to-native tensor mapping is correct. A native f32
`.slm` reproduces the Transformers float32 CPU reference across all eight
conversation prompts with 8/8 first-token argmax matches, complete top-5 and
top-32 overlap, and minimum centered cosine similarity above
`0.999999999986`.

Uniform q4 and both q4-body mixed profiles are not faithful enough for this
checkpoint. Uniform q8 is much better but still changes two of eight source
argmax decisions. The new `mixed-q8-matrix-f32-norm-v1` profile is the current
compact fidelity winner: it stores every matrix in q8, keeps every model and
layer normalization vector in f32, adds only 189,376 bytes over uniform q8,
and preserves the source argmax for every substantive case (cases 1-7).

This is a converter-fidelity decision, not a model promotion. The untouched
Qwen3-0.6B source still gives weak practical battery advice, silently chooses
one side of a conflicting deadline, and gives a shallow policy comparison.
No profile in this report is approved as the TinyRustLM assistant default.

## Truth Boundary

- The approved TinyRustLM browser UI was not changed.
- No generated answer was repaired, retried, decomposed, or replaced.
- Prompt text and token IDs are exact, hash-bound source evidence.
- The f32 control proves that converter layout and native runtime math are not
  the cause of the compact-profile drift.
- The new profile is structurally validated and tested, but model admission,
  native generation quality, WASM parity, browser behavior, and release
  packaging remain separate gates.
- `training_authority=false`; the 668-record expanded corpus remains pending
  explicit human review.

## Source Evidence

The source checkpoint is `Qwen/Qwen3-0.6B` at immutable revision
`c1899de289a04d12100db370d81485cdf75e47ca`. Its weight file is
1,503,300,328 bytes with SHA-256
`f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b`.

The active eight-case conversation fixture has SHA-256
`a2a0b484a8f329cd2935c5b3e73df4bc0f3068adac7a8a50baba01de73c38c12`.
It supersedes the earlier fixture whose underspecified-choice prompt was less
explicit. The older baseline correctly failed closed on fixture hash drift;
it was not rewritten or accepted against changed evidence.

A fresh float32 CPU source baseline was generated at
`artifacts/training/qwen3-0.6b/cognitive-liberty-source-baseline-v2.json`:

- bytes: 40,094
- SHA-256: `e90f89d13f1ed91787a16c4a2c5928dc35eeb8af0fed648ba7dc46011e590bcd`
- framework: Transformers `5.13.1`, PyTorch `2.13.0+cpu`
- generation: greedy, no thinking, exact Cognitive Liberty system prompt
- cases: 8

The full-logit golden manifest is
`D:/LLMs/TinyRustLM/qwen3-0.6b-source-logit-golden-v1/reference-golden.json`:

- bytes: 45,995
- SHA-256: `cc6467ffdafcda249f628fdfa45f2a0ca8a5ec66d53069dc340b00942a31e682`
- each case stores the exact rendered prompt, exact prompt token IDs, and the
  SHA-256-bound full float32 vocabulary vector
- recomputation had to match the earlier source top-five token IDs and logits
  before the golden could be published

## Measured Ladder

All candidates use the same extracted source, tokenizer, prompt format,
system prompt, eight rendered prompts, native release runtime, and comparator.
MiB values use 1,048,576 bytes.

| Profile | Bytes | MiB | Top-1 | Min centered cosine | Avg centered cosine | Min top-5 overlap | Avg top-5 overlap | Max JS divergence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| f32 control | 2,388,831,552 | 2,278.167 | 8/8 | 1.000000 | 1.000000 | 1.0 | 1.000 | 0.000000000075 |
| q8 matrix + f32 norms | 602,862,400 | 574.934 | 7/8 | 0.995112 | 0.995695 | 0.8 | 0.900 | 0.045915 |
| uniform q8_0 | 602,673,024 | 574.754 | 6/8 | 0.978585 | 0.990926 | 0.6 | 0.875 | 0.129656 |
| q8 output/down + q4 body | 499,561,280 | 476.419 | 3/8 | 0.878478 | 0.901074 | 0.2 | 0.550 | 0.305470 |
| q8 edge + q4 body | 448,230,208 | 427.466 | 2/8 | 0.888992 | 0.915313 | 0.2 | 0.625 | 0.213844 |
| uniform q4_0 | 377,165,760 | 359.693 | 1/8 | 0.118213 | 0.189580 | 0.0 | 0.050 | 0.682533 |

The output/down profile is not monotonic: it recovers one additional argmax
over edge-only mixed, but worsens average centered cosine, average top-five
overlap, and JS divergence while adding 51,331,072 bytes. More q8 tensors must
therefore be measured, not assumed to improve a nonlinear model.

The q8-matrix/f32-norm profile adds 189,376 bytes (about 185 KiB) over uniform
q8. It recovers the storage-advice argmax and improves every aggregate geometry
metric. Its only remaining top-one difference is case 0, the generic prompt
`test`; that case retains all five source leaders but orders `What` above `I`.
Cases 1-7 all preserve the source argmax.

## Source Behavior Review

The exact float32 source outputs establish the ceiling that quantization can
preserve:

1. Generic greeting: useful and concise.
2. Underspecified choice: correctly requests the missing option details.
3. Limited storage: conditionally useful but shallow and slightly confused
   about whether the model has already been downloaded.
4. Two-percent battery before a promised call: weak; it repeats unavailable
   charger advice instead of prioritizing a low-power plan and alternate
   contact route.
5. Friday-versus-Monday deadline conflict: weak; it silently chooses Monday
   instead of surfacing the conflict and asking for authority/confirmation.
6. Adult policy comparison: answers both sides without moralizing, but the
   arguments are shallow and include unsupported causal generalizations.
7. Latest name over stale memory: correctly uses Riley.
8. Untrusted memory instruction: correctly follows the user task rather than
   the embedded credential-exfiltration instruction.

This is why the new quantization profile can be called fidelity-ready for this
checkpoint while the checkpoint itself remains assistant-quality-pending.

## Implementation

`tinyrustlm/tools/build-source-logit-golden.py` adds a fail-closed bridge from a
`tinyrustlm.reference_raw_quality.v1` baseline to a
`tinyrustlm.reference_logit_golden.v1` pack. It verifies baseline schema,
checkpoint and evaluation hashes, exact rendered prompts, prompt/output token
hashes, prior top-five source evidence, finite full vectors, and atomic
no-overwrite publication. PyTorch and Transformers load only after all static
bindings pass. Adapter baselines are rejected.

The builder accepts the upstream contract that `generation_config.json` is
optional and accepts valid whitespace-decoding tokenizer tokens. Six focused
tests cover deterministic output, hash drift before model load, prompt/top-five
drift, runner failure cleanup, adapter/output rejection, optional generation
configuration, and whitespace token text.

`mixed-q8-matrix-f32-norm-v1` is implemented in the Rust trained-source
converter. Its deterministic tensor policy is:

- token embeddings and output matrices: q8_0
- all attention and feed-forward matrices in every layer: q8_0
- final model norm and all per-layer attention/FFN/Q/K norms: f32
- sidecar quantization label: `mixed`
- sidecar profile: `mixed-q8-matrix-f32-norm-v1`

## Artifact Identities

| Artifact | SHA-256 |
| --- | --- |
| f32 `.slm` | `5000048d0f1f15dd15eb5b7d05728c5a67a89bf7044d2ce36c4f7fc22f769076` |
| f32 conformance | `80757c8ae2d5f9c7fab632c252fb03694d43c2a29305b7a6397fb942d4783255` |
| q8 `.slm` | `03374723881c12fd57e69f76855e6ef262bc8130169c0b29fd3ccce1d57ef029` |
| q8 conformance | `f2d83f1210914a5cec109a9817e7d9a406a7a12b0252a84a9e02df634abc7eba` |
| q8-matrix/f32-norm `.slm` | `98452d9026c697e32ae739964747cd64745b4f7dc9b6e20f10b875e125c01363` |
| q8-matrix/f32-norm manifest | `999f1af24b77104b570b12b98e6efc97d5dacfb35e54de33a34e9d9553eaaea6` |
| q8-matrix/f32-norm probe | `08332751ef35a1a69fbd5d810498babf63cdb756d921d65b44cfb806f381ae07` |
| q8-matrix/f32-norm conformance | `1ceeed6e7ef75db26c113682765206783f9b82b3d098253421a1ffb179543e58` |
| output/down conformance | `d22c65b4cd1db339003832039e35474f167aad916a6719b59ac3af5edfeabff9` |
| edge mixed conformance | `17850c2e94767a4758c6e3243e64e95c4e8be7e4ca002254d3d0917973bccf4c` |
| q4 conformance | `a09fa580554a73006a61291f684aeb2bd922f6a1e813ca90d8af8ee54341329a` |

## Verification

- source-golden focused Python tests: 6/6 pass
- source-golden plus neighboring source-baseline tests: 12/12 pass
- full Python tools discovery: 113/113 pass
- Rust packer unit tests: 509/509 pass
- Rust packer integration tests: 1 distillation, 16 GGUF, and 7 Hugging
  Face conversion tests pass
- Rust formatting check for `tinyrustlm-slm-pack`: pass
- six native eight-case probes: pass with exact prompt-token parity
- all six conformance reports: generated successfully

The measured probe wall times were 479.9 seconds for f32 and 1,010.5 to
1,319.6 seconds for compact profiles. This evidence path uses full-vocabulary
prefills and shows the current compact CPU kernels need performance work; it is
not an end-user decode-tokens-per-second benchmark.

## Required Next Gates

1. Keep `mixed-q8-matrix-f32-norm-v1` as the current Qwen3 compact fidelity
   profile, but do not publish or select this source checkpoint as the default.
2. Complete explicit human review of all 668 teacher drafts; auto-approve and
   auto-reject nothing.
3. Export/freeze only approved records, then train matched candidates when the
   GPU is available again.
4. Require the untouched float32 source candidate to improve the practical
   battery, deadline-conflict, and balanced-policy cases before conversion.
5. Re-run source golden, native f32, q8-matrix/f32-norm, native generation,
   WASM, browser, footprint, and locked-UI gates on the passing candidate.
6. Optimize quantized prefill/decode kernels separately; never trade away the
   measured fidelity profile to make a benchmark look faster.

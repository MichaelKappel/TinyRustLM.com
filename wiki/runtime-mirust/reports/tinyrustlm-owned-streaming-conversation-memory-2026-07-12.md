# TinyRustLM Owned Streaming Conversation Memory

Date: 2026-07-12

Status: implemented and locally verified; public model integration pending

## Purpose

This slice removes the browser transfer blocker that prevented a coherent
Qwen2.5-1.5B q4 `.slm` from running in TinyRustLM. It preserves the locked
TinyRustLM UI, the `.slm` format, model weights, prompt template, sampling
behavior, and no-cheat quality boundary.

## Ownership-Taking Runtime Load

The Rust runtime now supports one explicit model-byte owner:

- `OwnedModelBytes` stores exact bytes in an eight-byte-aligned allocation;
- browser model transfers are bounded to 1 GiB and reject zero or oversized
  requests before allocation;
- `alloc_model`, `dealloc_model`, and `load_model_owned` expose ownership at
  the WASM ABI;
- `load_model_owned` consumes the allocation on every success or failure path;
- q4 and q5 packed tensor payloads retain checked offsets into the owned model
  allocation instead of copying each packed matrix;
- q4/q5 tensors materialize only when adapter mutation requires writable
  storage;
- q8 tensors remain copied because this slice does not add an unsafe unaligned
  signed-byte cast;
- scale vectors remain owned `Vec<f32>` values, so the current implementation
  removes the packed-weight copy but is not yet a zero-copy parser.

The existing borrowed `Model::load(&[u8])` contract remains available to native
and .NET callers. `Runtime::load_model_owned` shares the same validated install
path, diagnostics reset, KV-cache setup, generation behavior, and free-model
semantics.

## Browser Transfer

For ordinary static model routes, the browser reads `Response.body` chunks
directly into the WASM model allocation. It validates declared length, rejects
overrun and underrun, releases the allocation on fetch/abort/load failure, and
does not call `response.arrayBuffer()` for model bytes.

Generated module-plan models retain their declared
`copy-then-release-v1` strategy. Changing that contract without updating its
receipt and drift tests would be incorrect. Local file import still begins
with `File.arrayBuffer()` and retains the 256 MiB limit; streaming local files
is a separate required slice.

The selected transfer is exposed as machine-readable
`document.documentElement.dataset.modelTransfer`. No visible HTML structure,
CSS, label, control, or conversation layout changed.

## Browser Evidence

The ordinary application path loaded the existing 227,667,520-byte SmolLM2
q4 model through `owned-stream` in 1,730 ms, selected the independently
validated SIMD128 runtime, and reported `model_loaded=true` with q4 active.

The standalone exact-model check then loaded the 969,648,576-byte
Qwen2.5-1.5B-Instruct q4 artifact:

- browser stream transfer: 2,786 ms;
- Rust model load: 5,347 ms;
- resulting WASM memory: 1,259,274,240 bytes;
- load result: code 0, `model loaded`;
- quantization diagnostics: `q4_0`;
- `free_model`: code 0.

The final two-turn run used the same runtime and artifact. The first untouched
model response was:

`Hi Morgan, thank you for choosing tea over coffee.`

The second prompt included the real first user/assistant turn and asked the
model to recall the name and preference. The untouched response was:

`Hi Morgan, your name is Morgan, and you prefer tea over coffee.`

Turn one generated 11 tokens in 21,539 ms. Turn two generated 15 tokens in
17,637 ms, reused 55 exact prefix tokens, computed 28 new prompt tokens, stopped
on EOS, had a maximum repeated-token run of one, and did not duplicate the
first answer or reverse the preference.

Machine receipt:
`artifacts/reports/tinyrustlm-owned-streaming-qwen-conversation-2026-07-12.json`.

## Honest Quality Audit

The previous 7/12 report contained three evaluator false positives:

- Rust `-> i32` was parsed as `32 - 32`;
- ordinary rewrite inflections such as `runs`/`running` were not matched;
- a neutral clarifying noun caused an otherwise faithful rewrite to be
  rejected.

TDD regressions now require arithmetic parsing to accept only actual operator
tokens and allow general inflection stems plus the semantic
`make`/`allow`/`enable` family. The existing test that rejects new `create and
share` claims still passes; no prompt text or expected answer is special-cased.

The complete real-model eval was regenerated and is 10/12. Both remaining
failures are structured JSON cases. Their final objects are valid, but raw
`status` and `reason` generations required deterministic repair, and one raw
generation leaked field instructions. The no-cheat evaluator correctly keeps
`eval_status=fail`, `no_cheat_status=fail`, and full assistant-quality promotion
closed.

Eval SHA-256:
`74fc1b5c34010b00c7a972a6f3688bc815557cf2db1d841546b1d4b7ccef2c37`.

## Checked Artifacts

- scalar WASM: 385,444 bytes, SHA-256
  `8288ef916b0ee3d66d59cfaccccc62861acfdf7a3a7f343e94ab564ec03b5b93`,
  manifest checksum `0x193fe54383cf2cad`;
- SIMD WASM: 385,022 bytes, SHA-256
  `fdf145a79ca5bcae1331d7c473df0b550fb467323c5f5d3704fd50616c628f7e`,
  manifest checksum `0x196e902aa7298656`;
- Qwen q4 `.slm`: 969,648,576 bytes, SHA-256
  `dc24eb832e8bd2257a9891e4c88df9ab7b1d24ee92d3f644cd98f340417b75bc`,
  `.slm` checksum `0x9327f064169b418d`;
- model manifest SHA-256:
  `84926b5bb5e3cb68d19a04cc051dc90f612d51121176e97164e58bdf68e0a2f6`.

## Verification

- runtime: 231 unit tests, 2 logit-probe tests, and 5 eval CLI tests passed;
- packer: 524 unit tests plus 1, 16, and 7 CLI tests passed;
- `cargo fmt --all -- --check` passed after formatting;
- runtime clippy passed for all targets with warnings denied;
- scalar and SIMD release WASM builds passed;
- scalar and SIMD ABI smokes passed, including owned load, malformed-model
  rejection, recovery, free, and post-free rejection;
- JavaScript syntax checks passed;
- ordinary owned-stream browser load passed;
- exact 970 MB browser load/free passed;
- exact two-turn coherent browser conversation passed;
- temporary test servers were terminated after verification.

## Next Product Slice

The model is now technically usable in a desktop browser, but it is not yet a
public model route. The next slice must define an honest conversational tier
that does not overclaim strict structured-output quality, package the artifact
with source/license/provenance and resource metadata, add capability preflight
for the measured 1.259 GB WASM footprint, stage it through MiniModel.org or the
approved TinyRustLM model route, and verify the deployed site with the same
two-turn browser test. It must not replace the compact tier on unsupported
devices or claim 12/12 assistant quality.

## Truth Boundary

- Ownership-taking remote model streaming: implemented and browser-proven.
- Exact Qwen q4 local browser load/free: proven.
- Coherent two-turn name/preference conversation: proven locally.
- Honest broad assistant eval: 10/12; strict JSON remains failed.
- Local files above 256 MiB: not yet supported.
- Public catalog, deployment, and live HTTPS conversation: not yet done.
- The user-facing coherent-conversation goal remains active until public proof.

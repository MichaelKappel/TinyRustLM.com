# Safetensors Source Extraction Memory - 2026-06-29

## Route

Use this report when work touches `extract-safetensors-source`, raw f32 source extraction from `.safetensors`, F16/BF16 decode, trained-source export manifests, or the bridge from real tiny model checkpoints into `validate-source` and `convert-trained`.

## Implementation

`tinyrustlm-slm-pack extract-safetensors-source <input.safetensors> <source-shape> <output-source-dir> [candidate-review]` now reuses the checked safetensors source plan, optionally validates the pre-extraction candidate review against that plan, reads each tensor payload by validated offset, copies F32 tensors, decodes F16 and BF16 tensors into raw little-endian f32 bytes, and writes the existing raw trained-source layout.

When a candidate review is supplied, extraction requires matching review version/layout, source path, target shape, file/header/tensor-directory checksums, source-plan mapping checksum, matched tensor count, raw source bytes, conversion status, `required_next_gate=extract-raw-f32-tensors`, reviewed source/config/tokenizer/license/reference/eval routes, and recomputed selector-budget fields before any output directory is written.

The generated source bundle uses `source_kind=trained-export`, checksum-bearing `tensor.N.*` rows, safe `tensors/*.f32` paths, reviewed local source metadata, optional `source_review_*` rows carrying the candidate-review checksum and extraction gate, and the same `source.manifest` format consumed by `validate-source` and `convert-trained`.

## Source Files

- `tinyrustlm/tools/slm_pack/src/safetensors.rs`: extraction command implementation, candidate-review validation, tensor slice reads, F32 copy, F16 decode, BF16 decode, and extraction tests.
- `tinyrustlm/tools/slm_pack/src/trained_source.rs`: shared reviewed export writer for ordered raw f32 tensor payloads.
- `tinyrustlm/tools/slm_pack/src/main.rs`: `extract-safetensors-source` CLI dispatch and usage text.
- `tinyrustlm/README.md`: command and source-intake bridge documentation.
- `tinyrustlm/docs/testing.md`: extraction coverage route and failure cases.

## Verification

- `cargo fmt --all`
- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`: 16 focused safetensors tests passed.
- `cargo test -p tinyrustlm-slm-pack trained_source --quiet`: 17 focused trained-source tests passed.
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack --quiet`: 346 tests passed.
- `cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs`
- CLI smoke generated `target/safetensors-source-extract-smoke-20260629162120/tiny-source.safetensors`, ran `extract-safetensors-source ... tiny-fixture .../extracted-source`, and `validate-source` accepted the extracted source with 12 tensors and 19,296 raw f32 bytes.
- 2026-06-30 focused continuation: `cargo test -p tinyrustlm-slm-pack safetensors --quiet` passed 35 tests after adding review-bound extraction, source-review checksum carry-forward, and drift rejection; full `cargo test -p tinyrustlm-slm-pack --quiet` passed 376 tests and `cargo test --workspace --quiet` passed all workspace tests.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter coverage is carried by focused tests for input path, target source shape, output directory creation, optional candidate review, optional plan path from the previous gate, F32 copy extraction, F16 decode extraction, BF16 decode extraction, nested output path handling, source manifest metadata, source review metadata, ordered payload name checks, metadata evidence rejection, shape mismatch rejection, integer dtype rejection, review source-plan checksum drift, and pending route rejection.

## Next Useful Work

The next source-intake bead is a real tiny-model candidate extraction run with the candidate-review path supplied, followed by `validate-source`, `convert-trained` in f32/q8_0/q4_0, runtime-smoke sidecars, scoped eval sidecars, and a browser converted-trained bundle route.

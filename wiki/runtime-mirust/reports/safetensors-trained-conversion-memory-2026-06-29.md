# Safetensors Trained Conversion Memory - 2026-06-29

## Route

Use this report when work touches `convert-safetensors-trained`, Hugging Face Llama safetensors aliases, direct safetensors-to-`.slm` conversion, source directory preservation, output quantization parameters, or converted-trained manifest generation from local safetensors checkpoints.

## Implementation

`tinyrustlm-slm-pack convert-safetensors-trained <input.safetensors> <source-shape> <output-source-dir> <output.slm> [f32|q8_0|q4_0] [candidate-review]` now validates the requested output quantization before extraction, optionally requires it to match the pre-extraction candidate review's `quantization_target`, maps the safetensors tensor directory into the reviewed raw f32 trained-source layout, writes the raw source directory, validates that source, converts it into a f32/q8_0/q4_0 `.slm`, and writes the converted-trained `.slm.manifest` sidecar.

The safetensors plan keeps TinyRustLM local tensor names as the raw-source contract while accepting common Hugging Face Llama aliases such as `model.embed_tokens.weight`, `model.norm.weight`, `lm_head.weight`, `model.layers.N.self_attn.q_proj.weight`, and `model.layers.N.mlp.gate_proj.weight`. Plan reports now include both `tensor.N.name` and `tensor.N.safetensors_name`, so review can see the source-side checkpoint name used for each local output tensor.

The conversion path still passes through the existing source contract. The preserved `output-source-dir` remains useful evidence for `validate-source`, later tokenizer work, and converted-trained browser bundle work.

When the candidate-review path is supplied, conversion also recomputes the review-bound source plan and route fields before extraction, so a changed checkpoint header, tensor directory, mapping, raw byte count, pending route placeholder, or mismatched output quantization stops before a source directory or `.slm` artifact is written. The extracted source manifest carries `source_review_*` rows so the converted artifact remains tied to the exact candidate-review checksum consumed before extraction.

## Source Files

- `tinyrustlm/tools/slm_pack/src/main.rs`: `convert-safetensors-trained` CLI dispatch and usage text.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs`: alias-aware tensor matching, source-name report rows, candidate-review validation, safetensors extraction, direct conversion path, and focused tests.
- `tinyrustlm/tools/slm_pack/src/trained_source.rs`: shared output quantization validation plus raw source validation and `.slm` conversion.
- `tinyrustlm/README.md`: command examples and safetensors source bridge documentation.
- `tinyrustlm/docs/testing.md`: safetensors trained-conversion acceptance route.

## Verification

- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`: 20 focused safetensors tests passed.
- `cargo test -p tinyrustlm-slm-pack trained_source --quiet`: 18 focused trained-source tests passed.
- `cargo test -p tinyrustlm-slm-pack --quiet`: 351 tests passed.
- `cargo fmt --all -- --check`: passed after formatting.
- 2026-06-30 focused continuation: `cargo test -p tinyrustlm-slm-pack safetensors --quiet` passed 35 tests after adding review-bound conversion, source-review checksum carry-forward, and drift rejection; full `cargo test -p tinyrustlm-slm-pack --quiet` passed 376 tests and `cargo test --workspace --quiet` passed all workspace tests.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter coverage is carried by focused tests for input safetensors path, target source shape, output source directory, output `.slm` path, output quantization, optional candidate review, local tensor names, Hugging Face Llama aliases, F32 q8_0 conversion, BF16 tied-output q4_0 conversion, source manifest validation, source review metadata validation, `.slm.manifest` validation, invalid output quantization before extraction, review source-plan checksum drift, pending route rejection, and reviewed quantization binding.

## Next Useful Work

The next source-intake bead is a reviewed local candidate conversion run using a real tiny safetensors checkpoint with the candidate-review path supplied, followed by tokenizer manifest work for non-fixture tokenizers, f32/q8_0/q4_0 converted-trained outputs, runtime-smoke sidecars, scoped eval sidecars, and a browser converted-trained selector root.

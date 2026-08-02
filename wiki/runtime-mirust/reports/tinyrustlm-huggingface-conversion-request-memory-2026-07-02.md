# TinyRustLM Hugging Face Conversion Request Memory - 2026-07-02

## Scope

This report routes the continuation that made the Hugging Face local conversion path request-driven instead of a generated checklist of lower-level commands. The user-facing goal is that `Start Conversion` saves the exact local artifacts needed for a real conversion attempt: a `minimodel.huggingface_conversion_request.v0` JSON file plus a paired PowerShell script. The Rust authority is now one command, `convert-huggingface-request`, which consumes that request and a user-owned local `.safetensors` file.

## Implementation

- `tinyrustlm/tools/slm_pack/src/main.rs` now accepts `convert-huggingface-request <request.json> <input.safetensors> <output-dir> [source-shape] [f32|q8_0|q4_0]`.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs` parses and validates the browser request kind, Hugging Face source identity, default source shape, default quantization, and safe suggested `.safetensors` filename before conversion.
- The new Rust path writes `source.inspect`, `source.plan`, a preserved `source/` directory, the converted `.slm`, its `.slm.manifest`, and `tinyrustlm-conversion.receipt`.
- The receipt binds the request text checksum, source tensor-directory checksum, source-plan mapping checksum, output `.slm` checksum, output manifest checksum, and explicit false flags for project-server model-byte serving, project-server model execution, and project-server Hugging Face byte proxying.
- `tinyrustlm/app/app.js` now makes `Start Conversion` save both the conversion request JSON and the paired `.tinyrustlm-convert.ps1` script. The advanced `Save Rust Conversion Script` action also saves the paired request JSON so the script is runnable after edits.
- The generated script calls one TinyRustLM packer command for conversion:
  `cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request $ConversionRequest $SourceSafetensors $WorkDir $SourceShape $Quantization`
- After conversion, the script still calls MiniModel `prepare-peer-share` and `write-catalog-snapshot` so a successfully converted local `.slm` can become metadata and peer-share evidence for future users without project-server model bytes.

## Boundary

Hugging Face search remains metadata discovery only. The browser does not download Hugging Face `/resolve/` model bytes, project servers do not proxy Hugging Face bytes, and TinyRustLM still runs only after a local `.slm` is selected and Rust/WASM validates it. The request-driven conversion path is a local bridge from a reviewed user-owned `.safetensors` file to a verified `.slm`, not a claim that arbitrary Hugging Face models run directly.

MiniModel P2P remains the reuse path: once a user or peer has converted and verified a `.slm`, `prepare-peer-share` can produce checksum-bound manifests, peer-offer proof, local peer pieces, and a metadata-only catalog entry. Future users can use `P2P Import` only when metadata and a consenting peer source are present, and Rust re-verifies before browser import.

## Documentation

- `tinyrustlm/README.md` describes `convert-huggingface-request`, the paired request/script download, the conversion receipt, and the MiniModel share handoff.
- `tinyrustlm/docs/browser-runtime.md` documents the request-driven Hugging Face lane and keeps the no-server-model-byte boundary explicit.
- The `tinyrustlm-slm-pack` primary usage text lists the new command, and the usage test asserts it stays advertised.

## Verification

- `cargo fmt --all` passed.
- `cargo test -p tinyrustlm-slm-pack converts_huggingface_request_to_verified_slm_and_receipt --quiet` passed.
- `cargo test -p tinyrustlm-slm-pack rejects_huggingface_conversion_request_wrong_kind_before_conversion --quiet` passed.
- `cargo test -p tinyrustlm-slm-pack primary_usage_lists_review_bound_safetensors_tails --quiet` passed.
- `node --check tinyrustlm\app\app.js` passed.
- `node --check tinyrustlm\tools\browser-smoke.js` passed.
- `node tinyrustlm\tools\static-shell-parity.js tinyrustlm` passed.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:55410/app/ 9233 noop hf-search-ui` passed and proved:
  - Search keeps the source chooser open.
  - `Start Conversion` saves both `.minimodel-conversion-request.json` and `.tinyrustlm-convert.ps1`.
  - The request JSON carries `minimodel.huggingface_conversion_request.v0`, the Hugging Face model id, the safe suggested `model.safetensors` source file, and no-server-model-byte boundary flags.
  - The generated script calls `convert-huggingface-request` and does not make users run separate `inspect-safetensors`, `plan-safetensors-source`, `convert-safetensors-trained`, or `validate-manifest` commands.
  - No Hugging Face `/resolve/` model-byte route is requested.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:55410/app/ 9234 noop hf-local-catalog-ui` passed and proved local `models.v0.json` reuse still makes a matching Hugging Face row P2P-ready without fetching the default MiniModel catalog or Hugging Face model-byte routes.


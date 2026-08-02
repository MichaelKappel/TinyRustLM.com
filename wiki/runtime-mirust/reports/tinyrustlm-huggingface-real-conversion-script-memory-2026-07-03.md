# TinyRustLM Hugging Face Real Conversion Script Memory - 2026-07-03

## Scope

This report records the hardening pass after user review of the fake first-run chat transcript and the Hugging Face conversion/P2P source flow. The product requirement is that Hugging Face rows must not imply that arbitrary Hub models already run in TinyRustLM. Rows either route to an already converted MiniModel P2P import path, or they produce a local Rust conversion script that can create a verified `.slm` from a reviewed local `.safetensors` file.

## Durable Decisions

- First-run chat must stay empty except for the real empty state. Seed/example transcript messages such as `Can you explain the benefits of edge computing` and fake recent-chat rows are not allowed.
- Composer controls must be implemented or absent. The unimplemented attachment button was removed, and Enter-to-send now uses the same real submit path as the Send button while Shift+Enter remains a newline.
- Hugging Face search remains metadata-only. The browser may request `https://huggingface.co/api/models` after explicit user action, but it must not fetch Hub `/resolve/` model bytes.
- Hugging Face search status must report real availability buckets: external records, P2P-ready matches, proof-ready matches that still need a consenting peer URL, metadata matches that still need a local `.slm`, external `.slm` listings that need local review, and models that need Rust conversion.
- `Start Conversion` saves both `minimodel.huggingface_conversion_request.v0` JSON and a `.tinyrustlm-convert.ps1` script.
- The conversion script resolves `TINYRUSTLM_WORKSPACE`, `MINIMODEL_WORKSPACE`, and `TINYRUSTLM_SOURCE_SAFETENSORS`, with nearby-path fallbacks and a reviewed source file beside the script or under `source/`.
- The conversion script runs `cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request <request-json> <input.safetensors> <output-dir> <source-shape> <quantization>`.
- After conversion, the script discovers the `.slm` and `tinyrustlm-conversion.receipt` produced by Rust instead of guessing output filenames.
- After `minimodel prepare-peer-share`, the script discovers the generated MiniModel manifest, catalog entry, and peer-piece directory instead of guessing output filenames.
- The conversion script writes a local `.minimodel-serve-peer-pieces.ps1` helper into the conversion output directory so the sender can later run `minimodel serve-peer-pieces` from their own machine after explicit consent.
- The script still writes metadata-only `models.v0.json` and optional peer-source announcement metadata; it does not upload, proxy, run, or serve model bytes from project servers.
- P2P import remains the preferred converted-once reuse lane when MiniModel metadata has peer-offer proof and a consenting peer source. Otherwise the user starts local conversion once, then publishes metadata so later users can see `P2P Import`.

## Changed Files

- `tinyrustlm/app/app.js`
- `tinyrustlm/app/app.css`
- `tinyrustlm/app/index.html`
- `tinyrustlm/index.html`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/docs/browser-runtime.md`
- `E:\Source\Rust\TinyRustLM.com\README.md`
- `E:\Source\Rust\TinyRustLM.com\llms.txt`
- `E:\Source\Rust\TinyRustLM.com\llms-full.txt`
- `E:\Source\Rust\TinyRustLM.com\workspace.uai`
- `E:\Source\Rust\TinyRustLM.MiRust.com\docs\runtime-portal\runtime-docs\implementation\browser-runtime.md`
- `E:\Source\Rust\TinyRustLM.MiRust.com\llms.txt`
- `E:\Source\Rust\TinyRustLM.MiRust.com\llms-full.txt`
- `E:\Source\Rust\TinyRustLM.MiRust.com\data\pages.php`

## Verification

- `node --check .\tinyrustlm\app\app.js`
- `node --check .\tinyrustlm\tools\browser-smoke.js`
- `node .\tinyrustlm\tools\static-shell-parity.js .\tinyrustlm`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9350 tinylm16q8 source-options-ui`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9351 tinylm16q8 hf-search-ui`
- `node .\tinyrustlm\tools\browser-smoke.js http://tinyrustlm.com:8080/ 9352 tinylm16q8 public-local-only`
- `cargo test -p tinyrustlm-slm-pack huggingface --quiet`

## Follow-Up

The browser still cannot run arbitrary Hugging Face models directly. That remains correct until Rust supports their exact tensor/tokenizer/config shape and converts them into `.slm`. The next real-product step is to make a catalog-maintainer flow for accepting peer-source announcement metadata easier, so the "converted once, P2P available later" loop requires less manual command-line stitching.

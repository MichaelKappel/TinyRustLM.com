# TinyRustLM MiniModel Catalog Snapshot Memory - 2026-07-02

## Scope

This report routes the quality continuation that turns converted-once MiniModel share output into a reusable metadata-only catalog snapshot.

## Current Behavior

- MiniModel `write-catalog-snapshot <output-json> <catalog-entry-json>...` validates generated catalog-entry JSON files and writes a `minimodel.model_catalog` snapshot.
- The snapshot writer rejects duplicate `model_id` values, artifact/model/download URLs, project-server model-byte or execution claims, peer-source count drift, unsupported peer-source rows, and project-server peer hosts.
- TinyRustLM `Start Conversion` scripts now run local Rust packer conversion and validation, call `minimodel prepare-peer-share`, then call `minimodel write-catalog-snapshot` to produce local `models.v0.json` metadata.
- TinyRustLM Hugging Face rows now parse safe `.safetensors` sibling names from metadata, show the source-file candidate to the user, and carry it into the local conversion request/script while still avoiding Hub model-byte fetches.
- TinyRustLM exposes the generated snapshot path as `Local models.v0.json` plus `Load Local Catalog`; users can load a local metadata snapshot before Hugging Face search.
- When a loaded local `models.v0.json` entry matches a Hugging Face model id and includes a validated `peer_sources` row, the matching Hugging Face row becomes `P2P Import` without fetching the default MiniModel catalog.
- The generated catalog snapshot is metadata only. It can make a converted model discoverable as proof-ready or P2P-ready later, but it does not contain `.slm` bytes and does not make project servers host or relay model bytes.
- P2P import remains receipt-gated: Rust `import-peer-request` must fetch from a consenting direct peer, verify chunks, assemble, verify the `.slm`, and write a receipt before browser import.

## Durable Code Routes

- `E:\Source\Rust\MiniModel.org\crates\minimodel-core\src\lib.rs`
- `E:\Source\Rust\MiniModel.org\crates\minimodel\src\main.rs`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\app\app.js`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\tools\browser-smoke.js`

## Durable Documentation Routes

- `E:\Source\Rust\MiniModel.org\docs\verifier-mvp.md`
- `E:\Source\Rust\MiniModel.org\docs\manifest-v0.md`
- `E:\Source\Rust\MiniModel.org\docs\catalog-boundary.md`
- `E:\Source\Rust\MiniModel.org\ROADMAP.md`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\README.md`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\docs\browser-runtime.md`
- `E:\Source\Rust\TinyRustLM.MiRust.com\docs\runtime-portal\runtime-docs\implementation\browser-runtime.md`
- `E:\Source\Rust\TinyRustLM.MiRust.com\docs\runtime-portal\runtime-docs\implementation\slmcomposer-source-options-ui-v1.0.7.md`

## Verification

- MiniModel tests cover snapshot writing from verified entries, duplicate model-id rejection, artifact URL rejection, and project-server peer-source rejection.
- TinyRustLM browser smoke checks that generated conversion scripts include the listed `.safetensors` source-file hint, `write-catalog-snapshot`, and still do not request Hugging Face or project-hosted model bytes.
- TinyRustLM `hf-local-catalog-ui` browser smoke loads a local `models.v0.json`, searches Hugging Face metadata, proves the matching row offers `P2P Import`, writes a peer-import request/script, and confirms the default MiniModel catalog plus Hugging Face `/resolve/` byte routes are not requested.

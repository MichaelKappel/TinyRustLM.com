# SLMComposer MiniModel Catalog Import Route

## Purpose

This route records the first MiniModel catalog-to-SLMComposer implementation slice. The feature keeps model bytes local while allowing SLMComposer to read metadata from a default MiniModel.org catalog endpoint or from a user-supplied local JSON list.

## Implemented Boundary

- SLMComposer renders a Model Catalog panel with `https://MiniModel.org/catalog/models.v0.json` prefilled.
- Catalog metadata can be loaded from HTTP(S) or from a local JSON file.
- Catalog entries are accepted only when they avoid project-server model-byte URLs, server-served model bytes, and server-side model execution claims.
- Selecting a catalog entry creates an expected local `.slm` import contract, but the browser still requires the user-selected `.slm` file picker.
- Browser import verifies catalog byte count and SHA-256 before passing bytes to Rust/WASM `load_model`.
- Rust/WASM validation remains the `.slm` acceptance gate, and the local import provenance records catalog identity after the model is accepted.

## MiniModel.org Catalog Endpoint

- `E:\Source\Rust\MiniModel.org\catalog\models.v0.json` is a metadata-only static catalog with TinyRustLM fixture entries, byte counts, SHA-256 artifact hashes, local filename hints, TinyRustLM checksums, routes to docs/license metadata, and explicit no-server-byte/no-server-execution flags.
- `E:\Source\Rust\MiniModel.org\catalog\.htaccess` advertises JSON type and permissive CORS for metadata fetches where Apache-style hosting honors it.
- `E:\Source\Rust\MiniModel.org\index.html` and `ROADMAP.md` link the catalog endpoint.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9223 tinylm16q8 catalog-local-import`
- `node tinyrustlm/tools/browser-smoke.js http://slmcomposer.com:8080/app/ 9224 tinylm16q8 public-local-only`

Live redeploy verification on 2026-07-01:

- `https://slmcomposer.com/app/` contains `catalogUrlInput`, `localCatalogFile`, `catalogLoadButton`, `importLocalCatalogButton`, and the default `https://MiniModel.org/catalog/models.v0.json`.
- `https://MiniModel.org/catalog/models.v0.json` returns `200`, `Access-Control-Allow-Origin: *`, `catalog_kind=minimodel.model_catalog`, two metadata entries, and `project_server_serves_model_bytes=false` plus `project_server_runs_model_bytes=false`.
- Live hashes matched local source for `https://slmcomposer.com/app/app.js`, `https://slmcomposer.com/runtime/tinyrustlm.wasm`, and `https://MiniModel.org/catalog/models.v0.json`.
- `https://slmcomposer.com/models/tinylm16-q8.slm`, `https://slmcomposer.com/models/selector.registry`, `https://MiniModel.org/models/tinylm16-q8.slm`, and `https://MiniModel.org/catalog/tiny-test-model-q8.slm` returned `404`.
- `node tinyrustlm/tools/browser-smoke.js https://slmcomposer.com/ 9241 tinylm16q8 catalog-local-import` passed after the root HTTP redirect deploy; it imported a local catalog list, verified the local q8 `.slm`, and generated `e`.
- A one-off live CDP smoke from `https://slmcomposer.com/` clicked the default MiniModel catalog Load button, fetched `https://minimodel.org/catalog/models.v0.json`, rendered two metadata entries, selected `tinyrustlm/tiny-test-model-q8`, imported the matching local `.slm`, verified SHA-256 `sha256:6af985853325eaa6d3eaaa8aadd3511da9596eb542fb2d03a9bc9dc1f4377adf`, and generated `e`; observed network requests were only SLMComposer app/runtime files plus the MiniModel catalog metadata URL.

## Follow-Up

The next MiniModel implementation slice can move into `minimodel-core` and CLI verification for the same manifest/catalog contract: parse metadata, reject server-byte boundaries, verify user-supplied local `.slm` byte count and SHA-256, validate TinyRustLM fields, and write local import receipts before any peer transfer work.

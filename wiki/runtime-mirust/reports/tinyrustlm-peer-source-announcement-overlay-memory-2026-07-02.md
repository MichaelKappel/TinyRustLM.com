# TinyRustLM Peer Source Announcement Overlay Memory - 2026-07-02

## Routing

Read this when changing TinyRustLM P2P source UI, local `models.v0.json` loading, MiniModel peer-source announcement metadata, Hugging Face result actions, or docs that explain how a proof-ready converted model becomes `P2P Import` without a shared catalog rebuild.

## Implementation

TinyRustLM now has `Peer-source announcement JSON` controls in both the simple P2P Exchange panel and Advanced Tools catalog panel.

The browser can load a local proof-ready `models.v0.json` snapshot, then apply one or more local `minimodel.peer_source_announcement` JSON objects as a metadata-only overlay. The overlay validates:

- `announcement_version=0`
- `announcement_kind=minimodel.peer_source_announcement`
- `announcement_status=peer-source-available-metadata-only`
- `.slm` artifact kind
- model id syntax
- artifact byte count and SHA-256
- peer-offer route, SHA-256, chunk count, and Merkle root
- catalog-entry SHA-256 shape
- exactly one `known-direct-http-peer-v0` / `direct-http-piece-server-v0` peer source
- consenting direct `http://` peer URL, excluding project, docs, and Hugging Face hosts

The announcement must match an already-loaded catalog entry by model id, artifact byte count, artifact checksum, peer-offer route, peer-offer checksum, Merkle root, and chunk count. Matching announcements append deduplicated `peer_sources` in browser memory, re-render MiniModel catalog rows, and re-render current Hugging Face result rows so a proof-ready match moves from `Set Peer URL` to `P2P Import`.

## Boundary

The overlay is local metadata only. It does not fetch, upload, proxy, serve, or run model bytes. `P2P Import` still saves `minimodel.peer_import_request.v0` plus `.minimodel-peer-import.ps1`; Rust `minimodel import-peer-request <request-json> <manifest> <output-dir>` remains the receiver-side authority for fetching peer pieces, assembling, verifying the `.slm`, and writing an import receipt.

Project servers still do not serve user model bytes, proxy Hugging Face `/resolve/` bytes, or run user model bytes.

## Documentation

Updated:

- TinyRustLM browser runtime docs
- TinyRustLM source-options implementation docs
- TinyRustLM.MiRust PHP page registry
- TinyRustLM.MiRust `llms.txt` and `llms-full.txt`
- MiniModel.org catalog boundary docs
- MiniModel.MiRust manifest docs and LLM indexes
- TinyRustLM.com README

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check E:\Source\Rust\TinyRustLM.com\app.js`
- `node tinyrustlm/tools/static-shell-parity.js`
- `browser-smoke hf-peer-announcement-ui` on `http://127.0.0.1:18845/app/`
- `browser-smoke hf-local-catalog-ui` on `http://127.0.0.1:18845/app/`
- `browser-smoke hf-peer-announcement-ui` on `http://127.0.0.1:18845/`

The new `hf-peer-announcement-ui` smoke loads a proof-ready local catalog with no peer URL, applies a peer-source announcement JSON, proves the catalog row changes from `Set Peer URL` to `P2P Import`, searches Hugging Face metadata, saves the P2P import request/script, and confirms the default MiniModel catalog plus Hugging Face `/resolve/` model-byte routes are not requested.

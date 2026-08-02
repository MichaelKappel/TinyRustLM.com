# TinyRustLM MiniModel Peer-Source Catalog Memory - 2026-07-02

## Scope

This report routes the enterprise quality continuation for the Hugging Face, MiniModel, and P2P source lanes. The change makes proof-ready P2P metadata distinguishable from actually actionable peer-source metadata.

## Durable Behavior

- MiniModel catalog entries may carry `peer_source_count` and `peer_sources` after `write-catalog-entry` validates a known direct consenting peer URL.
- The supported first source kind is `known-direct-http-peer-v0` over `direct-http-piece-server-v0`.
- Peer-source rows must preserve the no-server-byte boundary with `project_server_serves_model_bytes=false` and `project_server_runs_model_bytes=false`.
- MiniModel rejects project-server hosts for catalog-listed peer sources.
- TinyRustLM parses catalog peer sources, checks count alignment, rejects unsupported source kinds/transports/consent states, and normalizes direct `http://` peer URLs.
- `P2P Import` is shown immediately only when a MiniModel match has peer-offer proof plus either a catalog-listed peer source or a saved list-level Known peer URL.
- Proof-ready rows without a known peer source show `Set Peer URL` instead of pretending the model is directly importable.
- Generated peer-import requests and scripts still call `minimodel import-peer-request <request-json> <manifest> <output-dir>` so Rust fetches pieces, assembles, verifies, and writes the local receipt.

## Non-Negotiable Boundary

MiniModel.org and TinyRustLM.com still do not serve user model bytes, do not proxy Hugging Face model bytes, and do not run user model inference on project servers. Catalog peer sources are metadata for consenting peer endpoints; they are not project-hosted artifact URLs.

## Quality Changes

- TinyRustLM consolidated duplicated P2P action rendering into shared helpers so advanced catalog, simple catalog, advanced Hugging Face, and simple Hugging Face rows use the same `P2P Import` versus `Set Peer URL` decision.
- MiniModel CLI argument handling is unit-tested for source-only, peer-only, and source-plus-peer `write-catalog-entry` forms.
- The default MiniModel catalog no longer carries the old extra non-proof-ready placeholder fixture entry.
- The browser smoke fixture now proves that a catalog-listed peer source allows `P2P Import` without manually setting the Known peer URL first.

## Verification Routes

- `cargo fmt --all -- --check` in `E:\Source\Rust\MiniModel.org`.
- `cargo test --workspace -- --nocapture` in `E:\Source\Rust\MiniModel.org`.
- `node --check tinyrustlm\app\app.js`.
- `node --check tinyrustlm\tools\browser-smoke.js`.
- `node tinyrustlm\tools\static-shell-parity.js tinyrustlm`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:<port>/ <debug-port> tinylm16q8 hf-search-ui`.
- Relevant pointer audits and `git diff --check` before commit completion.

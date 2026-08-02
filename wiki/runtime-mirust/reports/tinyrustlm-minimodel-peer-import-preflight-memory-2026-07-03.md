# TinyRustLM / MiniModel Peer Import Preflight Memory - 2026-07-03

## Purpose

Make the converted-once P2P import path less speculative by adding a Rust-owned metadata preflight before any peer chunk bytes are fetched.

## Implemented

- MiniModel now exposes `preflight-peer-import-request <request-json> <manifest> <output.preflight>`.
- The command parses the TinyRustLM `minimodel.peer_import_request.v0` JSON, validates static request fields, rejects project-server peer hosts, validates the request against the MiniModel manifest, fetches only `minimodel.peer_piece_set.v0` from the consenting peer, validates that piece-set metadata against the manifest, and writes a line-oriented `minimodel.peer_import_preflight` report.
- The preflight report records `peer_piece_set_metadata_fetched=true`, `peer_piece_bytes_fetched=false`, `artifact_bytes_fetched=false`, no project-server model-byte/execution/proxy flags, chunk count, artifact SHA-256, manifest SHA-256, Merkle root, peer base URL, and the next gate.
- TinyRustLM-generated `.minimodel-peer-import.ps1` scripts now run `preflight-peer-import-request` before `import-peer-request`, print the preflight report path, and check `$LASTEXITCODE` for both Rust commands.
- TinyRustLM peer-import request JSON now lists both receiver commands in `local_peer_piece_contract.rust_commands`.
- MiniModel docs now describe the preflight in `docs/verifier-mvp.md`, `docs/peer-companion.md`, and `ROADMAP.md`.

## Boundary

The preflight is metadata-only. It may contact a consenting direct peer endpoint for `minimodel.peer_piece_set.v0`, but it must not fetch `piece-*.bin`, `.slm`, Hugging Face `/resolve/` bytes, or project-hosted model bytes. The full artifact transfer still happens only in `import-peer-request`, which fetches from the consenting peer, assembles locally, verifies checksums and `.slm`, and writes an import receipt.

Project servers remain metadata-only. MiniModel.org, TinyRustLM.com, SLMComposer.com, Runtime.MiRust.com, and MiRust-owned hosts are rejected as peer-piece byte hosts.

## Verification

- `cargo fmt --all -- --check` in `MiniModel.org`.
- `cargo test -p minimodel-core preflight -- --nocapture`.
- `cargo test -p minimodel-core rejects_project_server_peer_import_preflight_host_before_manifest_read -- --nocapture`.
- `cargo test -p minimodel-core` with 50 tests passing.
- `cargo test -p minimodel` with 5 tests passing.
- `node --check tinyrustlm/app/app.js`.
- `node --check tinyrustlm/tools/browser-smoke.js`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18922/app/ 9512 tinylm16q8 hf-p2p-import-kit-exec`.

The browser smoke proved the generated conversion kit produced MiniModel peer pieces and metadata, the browser applied the peer-source announcement feed, `P2P Import` saved the request/script, the exact generated PowerShell script downloaded manifest metadata, ran `preflight-peer-import-request`, wrote `example-org__tiny-source-model.peer-import.preflight`, recorded `peer_piece_bytes_fetched=false`, then ran `import-peer-request`, fetched 17 peer pieces from `http://127.0.0.1:8123/`, assembled the `.slm`, verified artifact SHA-256 `sha256:15124f2ed46b3cd8b02adbc467da320dc2fd33ff2cbcc38340e72ba62447865e`, and wrote an import receipt.

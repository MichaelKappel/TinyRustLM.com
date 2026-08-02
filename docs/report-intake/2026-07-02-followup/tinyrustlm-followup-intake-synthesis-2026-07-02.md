# TinyRustLM Followup Intake Synthesis - 2026-07-02

## Source Reports

- `Hugging Face to TinyRustLM Workflow.md`
- `MiniModel P2P Exchange Architecture.md`
- `Usability and Progressive Disclosure in Browser-Native Language Model Interfaces.md`

## Durable Use

This followup batch reinforces the active product goal: Hugging Face search must stay honest metadata until Rust can convert and verify a source model into `.slm`, and MiniModel P2P must make already-converted `.slm` artifacts discoverable through checksum-bound metadata without project servers running, proxying, caching, or serving model bytes.

## Implemented-Now Guidance

- Keep TinyRustLM first-load UX beginner-safe: Local `.slm`, Hugging Face, and P2P source choices should use plain language, avoid fake runnable claims, and hide receipts, hashes, peer proofs, and raw verifier output until the user opens advanced details.
- Keep Hugging Face rows as metadata/model cards unless MiniModel metadata identifies an admitted `.slm` with peer proof and a consenting peer source. Use `Start Conversion` for non-ready rows; do not say `Run`, `Chat`, or `Download` for raw Hub artifacts.
- Keep browser model bytes local: the browser may search Hugging Face APIs and fetch MiniModel metadata, but `.slm` execution starts only after Rust/WASM validates a user-selected local file.
- Keep conversion receipts and MiniModel peer-share outputs checksum-bound. The conversion path should preserve source identity, model-card/license routes, source file hints, output `.slm` checksum, manifest checksum, and no-project-server-byte boundaries.
- Make converted-once reuse easier through small metadata handoffs: peer-source announcements and feed routes can make consenting peer endpoints discoverable while model chunks still come only from direct peers and still pass Rust verifier/import receipts.
- Maintain plain-language error recovery for unsupported formats, local memory/device limits, missing source files, CORS/download blockers, peer timeouts, and failed checksum verification.

## Roadmap-Only Guidance

- Hugging Face local Rust auto-download, Range-header safetensors inspection, multi-shard resolver handling, tokenizer/config download, GGUF import, and license/SPDX automation are valuable but must remain local-user execution paths. They must not become project-server proxy/download behavior.
- Iroh-blobs, QUIC, relay/NAT traversal, Ed25519 identities, BLAKE3 content-addressing, TUF-style signatures, and broader peer discovery are promising later phases. Do not replace the current direct known-peer HTTP verifier path until the manifest, peer-offer, announcement, and local receipt path is stable.
- Browser WebWorker conversion, granular in-browser progress, and P2P peer search UI are future UX improvements only after the byte path is real and verifier-owned.

## Current Implementation Pressure

The smallest aligned next implementation is a MiniModel metadata-feed publication step: a maintainer should be able to validate many `minimodel.peer_source_announcement` files into one metadata feed and publish a `models.v0.json` snapshot that points to that feed with SHA-256. TinyRustLM already verifies same-origin checksum-bound feed routes, so this closes a discoverability gap without adding project-server model bytes.

## Boundary

Project servers may publish documentation, schema routes, catalog JSON, feed JSON, public-key routes, examples, and takedown/contact routes. They must not host, proxy, cache, infer with, or serve runnable user model bytes.

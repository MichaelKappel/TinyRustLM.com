# TinyRustLM Converted-Once P2P Smoke Memory - 2026-07-03

## Source

This memory follows the July 3 desktop/P2P intake synthesis, the Hugging Face conversion receipt work, and the MiniModel peer-source announcement/feed path.

## Memory

The converted-once story now has a command-level smoke, not only browser script assertions. `tinyrustlm/tools/converted-once-p2p-smoke.js` creates a deterministic Hugging Face-style `.safetensors` fixture, writes a `minimodel.huggingface_conversion_request.v0` request, runs TinyRustLM `convert-huggingface-request`, then runs MiniModel `prepare-peer-share`, `write-peer-source-announcement`, `write-peer-source-announcement-feed`, `write-catalog-snapshot-with-announcement-feed`, and `write-catalog-snapshot`.

The smoke uses only local fixture bytes and local command output. It proves the practical path:

- source metadata/request plus user-owned `.safetensors`
- Rust `.slm` conversion and validation
- checksum-bound conversion receipt
- MiniModel manifest, peer-offer proof, local peer pieces, and catalog entry
- peer-source announcement and announcement feed metadata
- feed-bound and direct metadata-only catalog snapshots

## Boundary

The smoke asserts that generated publication JSON keeps `project_server_serves_model_bytes=false` and `project_server_runs_model_bytes=false`, rejects artifact/model URL fields, and contains no Hugging Face `/resolve/` or project-hosted `/models/` byte routes. The generated `.slm` and peer-piece directory stay under local `target/` output and are not publication artifacts.

The July 3 desktop/P2P intake still points to a later optional user-run MiniModel Peer Companion for identity, cache, consent, serving, fetching, and receipt UX. It does not change the current browser-local TinyRustLM first-run path.

## Implementation

TinyRustLM packer now has a narrow fixture command:

```powershell
cargo run -p tinyrustlm-slm-pack -- write-safetensors-fixture <output.safetensors> [shape] [local|huggingface]
```

The command writes deterministic source-template tensor bytes into safetensors format, using local tensor names or accepted Hugging Face Llama aliases, and immediately runs the existing safetensors inspection gate.

## Verification

Verification for this slice:

- `cargo fmt --all -- --check`
- `node --check tinyrustlm/tools/converted-once-p2p-smoke.js`
- `cargo test -p tinyrustlm-slm-pack primary_usage_lists_review_bound_safetensors_tails`
- `cargo test -p tinyrustlm-slm-pack converts_huggingface_request_to_verified_slm_and_receipt`
- `node tinyrustlm/tools/converted-once-p2p-smoke.js`

The smoke output showed a q8 `.slm` with artifact SHA-256 `sha256:6af985853325eaa6d3eaaa8aadd3511da9596eb542fb2d03a9bc9dc1f4377adf`, one MiniModel peer piece, one catalog peer source, one peer-source announcement feed, and both metadata-only catalog snapshots.

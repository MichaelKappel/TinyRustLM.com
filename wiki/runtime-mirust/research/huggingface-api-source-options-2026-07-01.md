# Hugging Face API Source Option Route

## Purpose

This route preserves the authorized Hugging Face API endpoint overview as a source-option plan for MiniModel.org and SLMComposer. It adds Hugging Face beside user-owned local files and future MiniModel P2P exchange without changing the browser-local runtime boundary.

## Source Options

1. User-owned local files and lists: the first-class path. Users select local `.slm` files and optional local JSON metadata lists in the browser.
2. Hugging Face discovery: an optional user-triggered metadata/control-plane path for finding external models, model cards, files, and repository context.
3. MiniModel P2P: a later Rust-first verified-transfer path using manifests, chunk/Merkle checks, local receipts, and explicit user consent.

Every path converges on a local `.slm` artifact. Rust verifies byte count, SHA-256, TinyRustLM `.slm` validity, and any manifest or catalog expectations before SLMComposer runs the model.

## Hugging Face Boundary

- Hub metadata APIs such as model search and repository info are discovery/control-plane inputs.
- `/resolve/` URLs, LFS objects, and Xet/CAS transfers are external data-plane routes for user-generated content; project servers must not proxy them.
- Inference Providers, Inference Endpoints, and executable Spaces are remote execution products; they are not the SLMComposer run path.
- Project-owned Hugging Face tokens are forbidden for user model acquisition. If private or gated access is ever supported, credentials must be user-supplied and held outside project servers.
- Hugging Face results may become candidate metadata, but they do not imply safety, legality, endorsement, browser fit, or TinyRustLM compatibility.

## Implementation Route

- Keep SLMComposer Hugging Face search user-triggered and idle on public page load.
- Normalize Hugging Face candidates into source metadata only: model id, model-card URL, license route, file hints, source revision, and known checksum evidence when available.
- Do not auto-download model bytes. If a user obtains an external file, they import or convert it locally and select the resulting `.slm` through the browser file picker.
- Extend MiniModel manifests later with a source discovery lane, for example `source.discovery.kind=huggingface-hub`, while keeping `artifact.project_server_url=none`.
- Treat Hugging Face `/resolve/` and Xet/CAS behavior as useful background for future user-side tooling, not as MiniModel.org server behavior.

## Official Reference Anchors

- Hugging Face Hub API docs identify open endpoints for retrieving Hub information and point to OpenAPI specs at `.well-known/openapi.json` and `.well-known/openapi.md`.
- Hugging Face rate-limit docs distinguish Hub API requests from resolver URLs containing `/resolve/`, which serve user-generated model or dataset files.
- Hugging Face Inference Endpoints and Inference Providers are remote execution services, so they remain outside SLMComposer's local Rust/WASM run path.

## Next Gates

- Add a durable source-type vocabulary: `local-file`, `local-list`, `huggingface-hub`, and `minimodel-p2p`.
- Keep local import receipts source-aware without recording secrets or public byte URLs.
- Add verifier tests that reject project-server proxy URLs, project-owned token assumptions, and remote execution requirements.

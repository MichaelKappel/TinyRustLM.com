# MiniModel.org P2P Report Synthesis 2026-07-01

This synthesis routes the 2026-07-01 Improvement intake into durable MiniModel.org and TinyRustLM planning. The full report bodies live in this directory as byte-exact checksum-bound copies.

## Source Routes

- `MiniModel.org P2P Architecture Research.md` routes the Rust-first exchange toward a core daemon, CLI, desktop peer app, peer discovery, NAT traversal, chunk verification, identity, and staged MVP lifecycle.
- `MiniModel.org_ P2P Tiny Model Exchange.md` routes legal and product boundaries: MiniModel.org is a metadata directory and information-location tool, peer transfer is user-controlled, and execution stays local in SLMComposer.
- `Secure Model Exchange Manifest Design.md` routes checksum-bound manifest design: signed envelopes, SLM predicates, source/config/tokenizer/license/eval evidence, artifact checksums, Merkle chunk verification, and browser-local validation before load.
- `Exploring the Hyper Module Ecosystem.md` and `Understanding Pear Runtime.md` route Pear/Bare/Hypercore as a useful zero-infrastructure reference lane, while preserving the project decision that MiniModel.org remains Rust-first.
- `Exploring Minimal JavaScript Runtimes.md` routes Bare-style runtime ideas into a tradeoff note only; no JavaScript runtime becomes a required TinyRustLM or MiniModel.org dependency.
- `Building Custom Tiny AI_ML Models.md` routes tiny-model creation strategy: distillation, quantization, pruning, small vocabularies, edge deployment, and local adaptation inform import tooling but do not change the server boundary.
- `Hugging Face API Endpoint Overview.md` routes Hugging Face as an optional external discovery/control-plane source. Hub metadata APIs can support user-triggered search or catalog intake, while `/resolve/`, Xet/CAS transfers, Spaces, Inference Providers, and Inference Endpoints stay outside the project server boundary and must not become MiniModel-hosted bytes or project-run inference.

## Durable Decisions

- MiniModel.org project servers must never run user models, proxy inference, or serve user model bytes.
- Project servers may publish static pages, signed catalog metadata, takedown/contact information, schema documentation, and checksum-bearing manifest examples.
- The first implementation path is Rust-first: `minimodel-core` for verification/transfer state, a CLI for manifest validation and local import, and later a desktop peer app for user-controlled exchange.
- SLMComposer.com remains browser-local: user-selected local `.slm` files are copied into Rust/WASM and validated by `load_model`; public hosts do not auto-fetch `/models/` bytes.
- The first-class source options are user-owned local files/lists, Hugging Face metadata discovery for user-directed external sources, and future MiniModel P2P verified transfer.
- Long-term memory remains pointer-based and checksum-bearing; this directory stores report bodies, while `.uai` ledgers store routes, checksums, and current truth boundaries.

## Implementation Routes

- Manifest MVP: define `minimodel.manifest` with artifact kind, `.slm` checksum, byte count, model shape, tokenizer checksum, config/source identity, license route, eval evidence checksum, optional source-review checksum, Merkle root, chunk size, and signature fields.
- Verifier MVP: add a Rust verifier that rejects missing license routes, nonlocal execution claims, remote code hooks, checksum drift, byte-count drift, eval-evidence drift, and model-route ambiguity before local import.
- Catalog MVP: publish static catalog snapshots containing metadata and peer hints only; catalog entries must not contain model bytes or server-side runnable artifacts.
- Hugging Face MVP: keep Hugging Face search user-triggered, use only public metadata routes or user-provided tokens if ever required, never use project-owned tokens, never proxy `/resolve/` downloads through project servers, and normalize candidates into the same local `.slm` checksum/import contract.
- P2P MVP: prefer a Rust-native QUIC/blob path for early prototypes, with libp2p, BitTorrent-style swarm interop, and Pear/Hypercore kept as evaluated alternatives rather than immediate dependencies.
- Import MVP: keep the current safetensors review/extract/convert/bundle chain as the trusted path for creating `.slm`; MiniModel.org imports should hand off to SLMComposer only after manifest and byte verification.

## Tradeoff Summary

- Rust/Iroh-like path: strongest fit for Rust-first, verified blobs, QUIC transport, and direct integration with TinyRustLM tooling.
- Rust-libp2p path: broad protocol reach and DHT flexibility, but higher complexity for the first tightly scoped exchange.
- BitTorrent/WebTorrent path: familiar swarm semantics and chunking, but weaker fit for typed `.slm` provenance unless wrapped in the MiniModel manifest.
- Pear/Bare/Hypercore path: compelling zero-infrastructure model and mature P2P data primitives, but JavaScript runtime coupling conflicts with the current Rust-first core.
- Static metadata-only catalog: lowest liability and simplest launch path; it should be the public website's first deliverable.
- Hugging Face Hub path: high-value public discovery and external model-source metadata, but Hub `/resolve/` URLs are a data plane and Hugging Face inference products are remote execution planes, so MiniModel/SLMComposer must treat them as user-directed external options rather than project hosting.

## Current Boundary

MiniModel.org is a roadmap and future discovery layer. It is not yet a model exchange, model host, inference endpoint, or legal approval system. All model bytes remain user-controlled and local unless a future peer app explicitly transfers bytes between consenting peers with checksum verification. Hugging Face is an optional external source/discovery lane, not a project-server byte host or execution backend.

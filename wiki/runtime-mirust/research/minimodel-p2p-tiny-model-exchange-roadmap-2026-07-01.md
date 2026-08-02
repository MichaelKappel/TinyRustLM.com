# MiniModel.org P2P Tiny Model Exchange Roadmap

## Purpose

This roadmap turns the 2026-07-01 MiniModel.org intake into a durable implementation route for a Rust-first, peer-to-peer tiny model exchange that complements SLMComposer and TinyRustLM without changing their browser-local trust boundary.

## Non-Negotiable Boundaries

- Project servers never run user models.
- Project servers never serve user model bytes.
- Project servers may serve static documentation, schemas, signed catalog metadata, public key material, takedown/contact routes, and manifest examples.
- Users choose any model transfer, keep the bytes local, verify them locally, and import them into SLMComposer through the local file picker.
- SLMComposer remains browser-local Rust/WASM; JavaScript may orchestrate UI and file transfer into WASM, but Rust owns `.slm` validation.

## Architecture

1. `minimodel-core`: Rust library for manifest parsing, checksum verification, chunk verification, identity records, peer-transfer state, and local import receipts.
2. `minimodel` CLI: verifies manifests, audits license/model-card fields, checks `.slm` bytes, writes local receipts, and hands verified paths to SLMComposer workflows.
3. Static catalog: MiniModel.org publishes signed metadata snapshots and peer hints, never model bytes.
4. Peer transfer app: a later Rust desktop app handles discovery, NAT traversal, resumable chunk transfer, peer reputation hints, local storage quotas, and user consent.
5. Browser handoff: SLMComposer accepts local verified `.slm` files only; public SLMComposer hosts do not auto-admit catalog entries or fetch model bytes.

## Source Options

MiniModel and SLMComposer should expose three acquisition lanes without changing the local execution boundary:

- User-owned local: a user picks a `.slm` file or local JSON metadata list from their own machine.
- Hugging Face: a user-triggered external discovery path for Hub metadata, model cards, file hints, and source revisions; `/resolve/`, Xet/CAS, Spaces, Inference Providers, and Inference Endpoints remain outside project servers and outside SLMComposer execution.
- MiniModel P2P: a future Rust-first transfer path where consenting peers exchange chunks that are verified by manifest byte counts, SHA-256, and Merkle data before local import.

All three lanes must end in a user-controlled local `.slm` file, local verifier receipt, and SLMComposer browser file-picker import.

## Secure Manifest

The first `minimodel.manifest` should bind:

- manifest version and schema checksum
- model id, model card route, license route, and publisher identity
- artifact kind `.slm`, byte count, and final SHA256 or TinyRustLM checksum
- model shape, quantization, tokenizer checksum, tensor-layout checksum, and runtime compatibility fields
- source checkpoint id and source revision when known
- config, tokenizer, reference prompt, eval case, source-review, source-validation, runtime-smoke, eval, and admission evidence checksums when available
- chunk size, Merkle root, chunk count, and optional piece-layer routes for swarm verification
- signature envelope fields and transparency-log or key identity fields when available

Verification order should be metadata, signature, license/model-card warnings, chunk/Merkle tree, complete artifact checksum, TinyRustLM `.slm` validation, evidence checks, then local import.

## Legal And Liability Boundary

MiniModel.org should behave like a metadata directory and information-location tool:

- no hosted user model weights
- no server-side inference
- no claims that listed models are safe, legal, trained cleanly, or fit for any purpose
- explicit model-card fields for license, source, intended use, prohibited use, training-data disclosure, and uploader assertions
- consent screens before peer transfer and before local execution
- takedown/contact workflow for disputed metadata listings
- abuse controls for spam, malware claims, deceptive metadata, and known illegal content references

This is an engineering boundary, not legal advice. Legal review is needed before public exchange features.

## Ecosystem Tradeoffs

- Rust-native QUIC/blob exchange is the preferred MVP direction because it keeps the verifier, transfer, and TinyRustLM import path in one language and trust model.
- Rust-libp2p remains a serious option for broader protocol interoperability, but it is likely too much surface area for the first exchange.
- BitTorrent-style chunking and WebTorrent are useful mental models for swarm transfer and browser familiarity, but MiniModel manifests must own provenance and license binding.
- Pear/Bare/Hypercore offer a strong zero-infrastructure P2P precedent with append-only logs, sparse replication, and mature peer discovery, but they add a JavaScript runtime ecosystem that should not become core to MiniModel.org.
- Hyper as Rust HTTP infrastructure is useful for future local tools, while Hypercore/Pear and cloud Hyper.io must stay clearly disambiguated in docs.

## Tiny Model Creation And Import

- Keep the trusted creation path tied to the existing TinyRustLM safetensors review, extraction, source validation, conversion, eval, admission, and selector evidence chain.
- Prefer tiny models whose source identity, tokenizer, config, and eval cases can be reviewed before conversion.
- Optimize for q8_0/q4_0 browser fit first; keep f32 as evidence and debugging support when budgets allow.
- Treat distillation, pruning, quantization, ternary weights, small vocabularies, and on-device adaptation as model-creation lanes, not as server responsibilities.
- Every imported `.slm` should have a local receipt that binds manifest checksum, artifact checksum, byte count, validation result, and import time.

## Phases

1. Schema and docs: publish `minimodel.manifest` draft, model-card fields, threat model, legal boundary, and static catalog rules.
2. Rust verifier: implement local manifest and artifact verification, with drift tests for every checksum and route field.
3. Local import receipts: produce checksum-bound receipts consumed by SLMComposer or stored beside the verified local `.slm`.
4. Static catalog prototype: publish metadata-only entries with no model bytes, clear warnings, and takedown/contact routes.
5. Peer-transfer prototype: evaluate Rust-native QUIC/blob transfer with chunk/Merkle verification, local quotas, resume, and peer rejection on chunk drift.
6. Desktop peer app: add consent UX, discovery, local cache management, and handoff to SLMComposer.

## Open Questions

- Which signature envelope is smallest and easiest to verify in both Rust CLI and browser tooling?
- Which peer stack gives the best first balance of NAT traversal, verified blobs, binary size, and implementation risk?
- How much metadata can MiniModel.org publish before legal review requires stronger moderation and takedown operations?
- Should model-card assertions be self-signed by uploaders, cosigned by curators, or both?
- How should verified local receipts be displayed in SLMComposer without implying project endorsement?

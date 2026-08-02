# TinyRustLM Desktop P2P Intake Synthesis - 2026-07-03

## Source Reports

- `Investigating Optional Rust P2P App.md`
- `Investigating Optional Rust P2P Application.md`
- `P2P Web Desktop Architecture.md`
- `Rust Desktop App Best Practices Guide.md`
- `Rust Dual App Architecture Practices.md`
- `Rust Enterprise Desktop Architecture.md`

## Durable Use

This batch is useful because it explains why a later optional Rust desktop companion can make MiniModel P2P understandable without weakening the current browser-local TinyRustLM app. The browser remains the simple path: choose a local `.slm`, verify it with Rust/WASM, and chat privately. The optional companion is a later power-user bridge for peer identity, local piece storage, background serving, transfer consent, cache limits, and NAT/discovery experiments.

## Implemented-Now Guidance

- Keep TinyRustLM.com as the first-run browser app. It should not require a desktop install, account, project token, or remote model execution.
- Keep the current local share kit as the bridge from a verified `.slm` to MiniModel metadata: metadata JSON plus a PowerShell script that verifies byte count/SHA-256, runs `prepare-peer-share`, writes optional peer-source announcement/feed metadata, and prints `serve-peer-pieces`.
- Keep Rust verifier crates as the source of truth. Browser, CLI, and any future desktop shell should call the same manifest, catalog, peer-piece, import-request, and receipt rules instead of reimplementing trust decisions.
- Preserve progressive disclosure. Beginner labels should stay plain: Local File, Hugging Face Metadata, P2P Import, Start Conversion, Save P2P Share Kit. Checksums, Merkle roots, peer proofs, receipts, and catalog feeds belong in advanced details.
- Keep the no-server-byte posture explicit in every flow. A desktop companion would run on the user's machine, not as a MiniModel.org or TinyRustLM.com service.

## Roadmap-Only Guidance

- Add an optional "MiniModel Peer Companion" phase after the current direct-known-peer HTTP prototype. Its job is to make P2P repeatable: local piece store, peer identity, serve/fetch controls, consent prompts, cache quotas, import receipts, logs, and handoff back to TinyRustLM.
- Use a multi-crate Rust architecture before choosing a UI shell: domain/core verification, application use cases, infrastructure adapters, and presentation shell. The verifier must remain UI-agnostic.
- Evaluate Tauri v2 only as a way to reuse the web UI with a Rust backend, strict capabilities, deny-by-default IPC, and a narrow command allowlist. Do not let a WebView shell become a privileged JavaScript model-byte runtime.
- Keep pure Rust UI options open for a companion: Iced, Slint, egui, and Dioxus each have tradeoffs. The current roadmap does not need to pick one.
- Treat libp2p, Iroh/QUIC, WebRTC, WebTransport, mDNS, Kademlia DHTs, BitTorrent-style chunking, Pear/Bare/Hypercore, and relay/NAT traversal as research lanes. The next protocol step should still preserve manifest-bound chunks, local receipts, and project-server byte rejection.
- Distributed inference, P2P KV-cache sharing, and automatic relay infrastructure are out of scope for the current product. They may inform long-term research, but TinyRustLM and MiniModel currently exchange verified `.slm` artifacts, not remote execution workloads.

## Security And Quality Guidance

- Store future peer identity keys and tokens in OS secure stores, not plaintext config files or bundled binaries.
- Sign and checksum desktop releases before broad distribution; plan for Windows/macOS signing and Linux packaging instead of ad hoc binaries.
- Make consent auditable: users must opt in before serving pieces, importing from a peer, keeping a cache, or publishing availability metadata.
- Use SQLite or an equivalent local store only for metadata, receipts, peer identities, and cache indexes. Model bytes remain user-controlled local files or local piece stores.
- Test the companion at the domain layer first: manifest drift, peer-piece drift, duplicate catalog rows, unsafe project-server peer URLs, interrupted downloads, cache quota enforcement, and receipt replay.
- Keep browser tests for beginner UX and smoke flows, CLI tests for verifier behavior, and later network simulation tests for peer discovery/transfer.

## Boundary

The reports support a later companion application, not a hosted service. Project servers may serve documentation, schemas, metadata catalogs, public keys, examples, announcement feeds, and takedown/contact routes. They must not host, proxy, cache, infer with, or serve runnable user model bytes.

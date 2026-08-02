# TinyRustLM Desktop P2P Companion Intake Memory - 2026-07-03

## Source

Six related desktop/P2P reports were preserved under `docs/report-intake/2026-07-03/` with byte counts and SHA-256 checksums in `MANIFEST.md`.

## Memory

The useful product move is not to replace the browser app. TinyRustLM stays browser-local and simple: a user selects a local `.slm`, Rust/WASM validates it, and the model runs privately. The reports instead define a later optional MiniModel Peer Companion for advanced users who want to share or import peer pieces without hand-assembling commands.

The companion should be a user-run local app, not project infrastructure. It may manage local peer identity, local piece stores, consent prompts, cache quotas, peer-source announcement metadata, direct serve/fetch controls, and import receipts. It must not make MiniModel.org or TinyRustLM.com host, proxy, cache, run, or serve user model bytes.

Rust verifier crates remain the trust boundary. Any browser UI, CLI, or desktop shell should call the same manifest, catalog, peer-piece, import-request, and receipt logic. UI framework choices are deferred: Tauri v2 is plausible only with strict capabilities and narrow Rust commands, while Iced, Slint, egui, and Dioxus stay research lanes. P2P protocols such as Iroh/QUIC, Rust-libp2p, WebRTC, WebTransport, BitTorrent-style chunking, and Pear/Bare/Hypercore remain later tradeoff studies behind checksum-bound manifests and consent gates.

## Current Implementation Constraint

The current deliverable remains the local share kit: after a verified `.slm` import, TinyRustLM can save metadata plus a `.minimodel-share-kit.ps1` script that verifies the artifact locally, runs MiniModel `prepare-peer-share`, can write peer-source announcement/feed metadata, writes metadata-only catalog snapshots, and prints the user-started `serve-peer-pieces` command.

## Follow-Up

Add an optional desktop-companion roadmap phase and docs language on MiniModel.org and MiniModel.MiRust.com. Keep the first user experience simple and keep advanced peer details behind source/advanced panels.

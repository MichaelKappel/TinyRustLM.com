---
title: TinyRustLM MiniModel Peer Source Announcement Memory 2026-07-02
date: 2026-07-02
status: current
---

# TinyRustLM MiniModel Peer Source Announcement Memory 2026-07-02

This entry routes the portable peer-source announcement slice that follows the July 2 TinyRustLM/MiniModel intake synthesis.

## Implementation

- MiniModel now has `write-peer-source-announcement <catalog-entry-json> <announcement-json> <known-peer-base-url>`.
- The command validates the catalog entry and consenting peer URL, then writes metadata-only `minimodel.peer_source_announcement` JSON that binds model id, artifact byte count, artifact SHA-256, peer-offer SHA-256, peer-offer Merkle root, catalog-entry SHA-256, and one `known-direct-http-peer-v0` source.
- MiniModel now has `apply-peer-source-announcements <catalog-entry-json> <output-json> <announcement-json>...`.
- The apply command validates one or more announcements against the catalog entry, rejects model/artifact/proof drift, deduplicates peer URLs, writes `peer_sources`, revalidates `peer_source_count`, and leaves `write-catalog-snapshot` as the metadata-only publication gate.
- `add-peer-source` remains the simple direct local path when the converter has the catalog entry and peer URL locally. Announcement/apply is the maintainer-safe path when availability metadata comes from another machine or person.

## TinyRustLM Handoff

- `Start Conversion` still creates `minimodel.huggingface_conversion_request.v0` plus `.tinyrustlm-convert.ps1`.
- The generated script runs `convert-huggingface-request` against a user-owned `.safetensors`, then MiniModel `prepare-peer-share`.
- If `$KnownPeerBaseUrl` is set, the script now runs `add-peer-source` to write a local with-peer entry and also writes a portable peer-source announcement.
- If `$KnownPeerBaseUrl` is empty, the script prints both the direct `add-peer-source` follow-up and the maintainer announcement/apply flow so a converted model can later appear as `P2P Import` by default without project-hosted bytes.

## Boundary

- Hugging Face rows remain external metadata and model-card/source discovery only until Rust converts or imports an admitted `.slm`.
- P2P-ready catalog metadata still does not mean the browser trusts the artifact. Rust must fetch from a consenting peer, assemble pieces, verify checksum/Merkle data, validate `.slm`, and write an import receipt before TinyRustLM can load bytes.
- Project servers still never run, serve, proxy, relay, or host user model bytes.

## Verification Routes

- MiniModel core tests cover writing/applying announcements and rejecting artifact drift.
- TinyRustLM `hf-search-ui` smoke asserts conversion requests/scripts include `add-peer-source`, `write-peer-source-announcement`, `apply-peer-source-announcements`, and the peer-source announcement output path.
- Completion still requires docs mirror updates, pointer/checksum audits, active-intake placeholder audit, `git diff --check`, and separate commits.

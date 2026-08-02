---
title: TinyRustLM MiniModel Add Peer Source Intake Memory 2026-07-02
date: 2026-07-02
status: current
---

# TinyRustLM MiniModel Add Peer Source Intake Memory 2026-07-02

This entry routes the July 2 TinyRustLM/MiniModel intake reports and the MiniModel `add-peer-source` implementation.

## Intake

- Six reports from `E:\Source\Rust\TinyRustLM.com\agent-file-handoff\Improvement` were moved into `docs/report-intake/2026-07-02/` in the active Rust workspace.
- `docs/report-intake/2026-07-02/MANIFEST.md` records byte counts and SHA-256 checksums.
- `docs/report-intake/2026-07-02/tinyrustlm-minimodel-intake-synthesis-2026-07-02.md` is the durable synthesis. It accepts local-first beginner UX, Hugging Face metadata plus local conversion, MiniModel metadata-only P2P, and later Iroh research; it rejects treating future broad P2P discovery or browser Hugging Face weight reads as implemented facts.
- The active TinyRustLM.com improvement bucket is README-only after preservation.

## Implementation

- MiniModel now has `add-peer-source <catalog-entry-json> <output-json> <known-peer-base-url>`.
- The command reads an existing catalog-entry JSON, validates it, rejects project-server peer hosts, writes exactly one `known-direct-http-peer-v0` row, revalidates `peer_source_count`, and writes a new catalog-entry JSON for `write-catalog-snapshot`.
- This is the late availability step for "converted once, P2P-ready later": a converter can create proof-ready metadata with `prepare-peer-share`, then attach a consenting peer URL later without rerunning Hugging Face conversion or uploading `.slm` bytes.
- TinyRustLM generated conversion requests and `.tinyrustlm-convert.ps1` scripts now name `add-peer-source` as the follow-up when `$KnownPeerBaseUrl` was empty during conversion.

## Documentation Boundary

- MiniModel.org docs now describe `add-peer-source` beside `prepare-peer-share`, `write-catalog-entry`, and `write-catalog-snapshot`.
- MiniModel.MiRust.com now documents current direct known-peer Rust handoffs and leaves Iroh/libp2p/relay/broad discovery as later roadmap.
- TinyRustLM.MiRust.com now mirrors the generated-script behavior and states that `add-peer-source` is metadata-only.

## Tests and Audits

- MiniModel focused tests cover adding a peer source to a proof-ready catalog entry and rejecting project-server peer hosts before output.
- TinyRustLM browser smoke now asserts conversion request/script handoffs include `add-peer-source`.
- Required completion gates remain: Rust tests, JS syntax/smoke checks, active intake placeholder audit, pointer/checksum audits, and `git diff --check`.

## Boundary

Project servers still never run, serve, proxy, or relay user model bytes. `add-peer-source` only changes catalog metadata for a consenting direct peer. Rust still owns fetch, assembly, checksum verification, `.slm` validation, and local import receipts before browser import.

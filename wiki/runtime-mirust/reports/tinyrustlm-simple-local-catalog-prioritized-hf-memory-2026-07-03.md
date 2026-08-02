# TinyRustLM Simple Local Catalog And Prioritized Hugging Face Memory - 2026-07-03

## Source

This memory routes the 2026-07-03 beginner source-flow improvement plus the related desktop/P2P intake preserved under `docs/report-intake/2026-07-03/`.

## Memory

TinyRustLM now exposes local MiniModel catalog reuse in the beginner P2P source panel. A user can load a generated `models.v0.json` snapshot with `Local models.v0.json` / `Load Local Catalog` without opening Advanced Tools. Matching Hugging Face rows can then become `P2P Import` when that metadata names a consenting peer source, while the app still fetches no project-hosted, Hugging Face-hosted, or MiniModel-hosted model bytes.

Hugging Face search now asks the API for a wider metadata page and ranks the visible rows by real actionability: P2P-ready matches first, peer-offer/proof-ready catalog matches next, external `.slm` review rows, supported source-backed conversion rows, large or unknown review rows, and finally rows with no supported source. This keeps the beginner list useful without pretending that every Hugging Face model is directly compatible.

The July 3 desktop/P2P intake reinforces the same boundary. The current product remains browser-first: choose or import a local `.slm`, use Hugging Face only for metadata/source handoff, or use a consent-based peer import that Rust re-verifies locally. A future MiniModel Peer Companion may manage peer identity, local piece stores, cache quotas, consent prompts, direct serve/fetch controls, logs, receipts, and NAT/discovery experiments, but it remains an optional user-run tool rather than project infrastructure.

## Verification

- `source-options-ui` proves the simple P2P panel exposes local catalog import.
- `hf-search-ui` proves search stays open, queries a wider Hugging Face metadata page, prioritizes actionable rows, preserves `P2P Import` / `Start Conversion` / `Review Conversion` distinctions, and shows one list-level disabled-P2P warning.
- `hf-local-catalog-ui` proves a beginner-loaded `models.v0.json` snapshot can promote a matching Hugging Face row to `P2P Import`.
- `hf-conversion-kit-exec`, `converted-once-p2p-smoke`, and `hf-p2p-import-kit-exec` prove the convert-once, metadata-only publication, consenting peer-piece serving, and later peer import workflow without project-server model bytes.

## Boundary

TinyRustLM.com and MiniModel.org may serve app code, docs, schemas, metadata catalogs, public keys, examples, announcement feeds, and takedown/contact routes. They must not host, proxy, cache, serve, or run user model bytes. The browser app remains simple for new users, and advanced peer transport details remain behind metadata, local scripts, Rust verifier commands, and later optional companion work.

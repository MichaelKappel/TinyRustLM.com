# TinyRustLM Hugging Face Conversion Publish Feed Memory - 2026-07-03

## Source

This memory follows the Hugging Face conversion-script work, the MiniModel announcement-feed path, and the July 3 desktop/P2P intake preserved under `docs/report-intake/2026-07-03/`.

## Memory

TinyRustLM must keep Hugging Face rows honest: a Hub model card is metadata, not a runnable browser model. `Start Conversion` saves a local conversion request plus a self-contained `.tinyrustlm-convert.ps1` script that requires a user-owned `.safetensors` file, runs Rust `convert-huggingface-request`, validates the resulting `.slm`, then prepares MiniModel metadata and local peer pieces.

The new publish-feed handoff closes the converted-once reuse gap. After Rust conversion and `minimodel prepare-peer-share`, the generated script now creates a publication package when a consenting `KnownPeerBaseUrl` is set:

- a with-peer catalog entry via `add-peer-source`
- a portable peer-source announcement via `write-peer-source-announcement`
- a `peer-source-announcements.v0.json` feed via `write-peer-source-announcement-feed`
- a feed-bound `models.with-announcement-feed.v0.json` snapshot via `write-catalog-snapshot-with-announcement-feed`
- a `converted-once-p2p-publish.README.txt` explaining which metadata files can go to catalog maintainers

This lets a converted model become visible to later TinyRustLM users as `P2P Import` from checksum-bound metadata, while receivers still run MiniModel `import-peer-request` locally to fetch peer pieces, assemble the `.slm`, verify checksums, and write an import receipt before browser import.

## Boundaries

The publication package is metadata-only. Project servers may publish docs, schemas, catalogs, announcement feeds, public keys, examples, and contact/takedown routes. They must not receive, host, proxy, cache, run, or serve `.slm` files, `.safetensors` files, or `*.peer-pieces` directories.

The July 3 desktop/P2P intake supports a later optional user-run MiniModel Peer Companion for local identity, piece stores, consent, cache quotas, serve/fetch controls, receipts, and TinyRustLM handoff. That companion is not required for the current beginner browser path and must not become hosted model-byte infrastructure.

## Verification

`hf-search-ui` now checks that the generated conversion request and script include `write-peer-source-announcement-feed`, `write-catalog-snapshot-with-announcement-feed`, `converted-once-p2p-publish.README.txt`, the safe metadata list, the no-project-server-byte warning, and the rule that later users only get `P2P Import` after metadata names a consenting peer and Rust verifies the bytes.

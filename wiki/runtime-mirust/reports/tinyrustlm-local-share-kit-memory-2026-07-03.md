# TinyRustLM Local Share Kit Memory - 2026-07-03

## Scope

TinyRustLM now exposes a post-import P2P share kit for verified local `.slm` files. This is the "convert once, share later" bridge from a browser-local file import to MiniModel metadata and peer-piece preparation.

## Source Inputs

- `docs/report-intake/2026-07-02/tinyrustlm-minimodel-intake-synthesis-2026-07-02.md`
- `docs/report-intake/2026-07-02-followup/tinyrustlm-followup-intake-synthesis-2026-07-02.md`
- `tinyrustlm/app/index.html`
- `tinyrustlm/index.html`
- `tinyrustlm/app/app.js`
- `tinyrustlm/tools/browser-smoke.js`

## Behavior

After Rust/WASM verifies and loads a user-selected local `.slm`, both the simple P2P panel and the advanced discovery panel enable `Save P2P Share Kit`. The existing `Save Share Metadata` path still writes `minimodel.local_slm_share_metadata.v0`; the kit writes that metadata plus local `.minimodel-share-kit.ps1` and `.minimodel-serve-peer-pieces.ps1` scripts.

The generated script:

- resolves `MINIMODEL_WORKSPACE`;
- resolves the verified local `.slm` from `TINYRUSTLM_LOCAL_SLM`, beside the script, or under `source/`;
- verifies the expected artifact byte count and SHA-256 using `Get-FileHash`;
- runs `minimodel prepare-peer-share`;
- optionally runs `add-peer-source`, `write-peer-source-announcement`, `write-peer-source-announcement-feed`, and `write-catalog-snapshot-with-announcement-feed` when the user sets a consenting `KnownPeerBaseUrl`;
- always writes a metadata-only `models.v0.json` catalog snapshot through `write-catalog-snapshot`;
- prints the matching `serve-peer-pieces` command for the user's own direct peer endpoint;
- downloads a serve helper that resolves the generated manifest and peer-piece directory, defaults to `127.0.0.1:8123`, and runs `minimodel serve-peer-pieces` only from the user's machine after explicit consent.

## Boundaries

The script states that it never uploads model bytes to TinyRustLM.com, MiniModel.org, or any project server. It sends only metadata JSON to a catalog maintainer. Peer pieces and `.slm` bytes remain local or direct-peer material and still require MiniModel verifier import on the receiving side.

## Verification

`share-metadata-ui` now asserts that the browser produces share metadata JSON, `.minimodel-share-kit.ps1`, and `.minimodel-serve-peer-pieces.ps1` downloads, that the scripts contain the MiniModel share, announcement-feed, catalog, serve, bind-address, and hash-verification commands, that the final UI state says `P2P share kit saved locally`, and that the export path makes no Hugging Face or MiniModel remote requests.

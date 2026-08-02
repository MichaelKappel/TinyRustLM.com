# TinyRustLM Catalog Announcement Feed Memory - 2026-07-02

## Routing

Read this when changing TinyRustLM catalog loading, Hugging Face P2P availability, MiniModel peer-source announcements, default MiniModel catalog behavior, or docs that explain converted-once reuse without project-hosted model bytes.

## Implementation

TinyRustLM can now read peer-source announcement feed routes declared by a loaded MiniModel catalog snapshot. Accepted catalog fields are:

- `peer_source_announcement_route` with `peer_source_announcement_sha256` or `peer_source_announcement_checksum_sha256`
- `peer_source_announcement_routes`
- `peer_source_announcement_feeds`

Each route entry must include a route and SHA-256 checksum. The browser resolves the route relative to the catalog URL, rejects non-HTTP(S) routes, rejects routes that leave the catalog origin, fetches the JSON as metadata with `credentials: "omit"`, enforces the existing catalog metadata byte budget, hashes the exact fetched text, parses MiniModel peer-source announcements, and applies only announcements that match already loaded proof-ready entries by model id, artifact byte count, artifact SHA-256, peer-offer route, peer-offer SHA-256, chunk count, and Merkle root.

Explicit catalog loads surface feed failures as catalog errors. The hidden default-catalog availability check keeps base proof-ready metadata if an optional feed fails, but fails closed on peer availability by not applying any unverified peer-source rows.

## Boundary

The feed is metadata only. It never carries `.slm` bytes, never points at MiniModel-hosted or TinyRustLM-hosted model artifacts, never proxies Hugging Face `/resolve/` bytes, and never runs a model. A successful feed can change a matching Hugging Face row from `Set Peer URL` to `P2P Import`, but `P2P Import` still writes a local `minimodel.peer_import_request.v0` plus `.minimodel-peer-import.ps1` and Rust `minimodel import-peer-request <request-json> <manifest> <output-dir>` remains the byte-transfer, reassembly, verification, and receipt authority.

## Documentation

Updated:

- TinyRustLM source README
- TinyRustLM.com README
- MiniModel.org catalog boundary, manifest, roadmap, and workspace memory
- MiniModel.MiRust.com manifest, overview, source-lanes, P2P roadmap, workspace memory, and LLM indexes
- TinyRustLM.MiRust.com browser-runtime docs, source-options docs, PHP page data, workspace memory, and LLM indexes

## Verification

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `node --check E:\Source\Rust\TinyRustLM.com\app.js`
- `node tinyrustlm\tools\static-shell-parity.js tinyrustlm`
- `browser-smoke hf-catalog-announcement-route-ui` on root and `/app/`
- `browser-smoke hf-search-ui` regression
- relevant pointer audits
- `git diff --check` in all changed repositories

The new `hf-catalog-announcement-route-ui` smoke intercepts the default MiniModel catalog, serves a proof-ready snapshot with a same-origin SHA-256-bound peer-source announcement feed route, verifies that TinyRustLM fetches the feed as metadata, renders the matching Hugging Face row as `P2P Import`, and confirms no MiniModel model-byte route is requested.

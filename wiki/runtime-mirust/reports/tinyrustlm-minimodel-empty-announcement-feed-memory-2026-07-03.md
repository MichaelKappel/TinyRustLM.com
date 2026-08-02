# TinyRustLM MiniModel Empty Announcement Feed Memory - 2026-07-03

## Scope

This records the hardening pass for MiniModel peer-source announcement feeds. The goal is to make the default catalog able to check a live availability feed without faking P2P availability when no consenting peer source has been published.

## Durable Decisions

- `minimodel.peer_source_announcement_catalog` feeds may contain an empty `announcements` array.
- Empty feeds are valid metadata and mean "availability checked, no peer sources published yet."
- Empty feeds must not promote proof-ready rows to `P2P Import`.
- TinyRustLM keeps proof-ready rows at `Set Peer URL` until a matching announcement names a real consenting peer source.
- MiniModel.org can publish `catalog/peer-source-announcements.v0.json` as a metadata-only feed and bind it from `catalog/models.v0.json` by SHA-256.
- The feed route is still metadata only. It must not contain `.slm` bytes, peer pieces, Hugging Face `/resolve/` URLs, project-hosted artifact URLs, or execution claims.

## Changed Files

- `E:\Source\Rust\MiniModel.org\crates\minimodel-core\src\lib.rs`
- `E:\Source\Rust\MiniModel.org\catalog\models.v0.json`
- `E:\Source\Rust\MiniModel.org\catalog\peer-source-announcements.v0.json`
- `tinyrustlm/app/app.js`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/docs/browser-runtime.md`
- `tinyrustlm/README.md`
- `workspace.uai`

## Verification Targets

- `cargo test -p minimodel-core empty_peer_source_announcement_feed --quiet`
- `cargo test -p minimodel-core peer_source_announcement_feed --quiet`
- `node --check .\tinyrustlm\app\app.js`
- `node --check .\tinyrustlm\tools\browser-smoke.js`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ <port> tinylm16q8 hf-empty-catalog-announcement-route-ui`
- Pointer audit and `git diff --check`

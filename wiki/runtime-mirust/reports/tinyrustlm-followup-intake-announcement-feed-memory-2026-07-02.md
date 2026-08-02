# TinyRustLM Followup Intake And Announcement Feed Memory - 2026-07-02

## Routing

Read this when changing Hugging Face-to-TinyRustLM conversion UX, MiniModel P2P discoverability, peer-source announcement feeds, MiniModel.org catalog publication commands, MiniModel.MiRust.com developer docs, or the no-project-server-model-byte boundary.

## Intake

Three follow-up reports from `E:\Source\Rust\TinyRustLM.com\agent-file-handoff\Improvement` were copied byte-exact into `docs/report-intake/2026-07-02-followup/` and synthesized before active intake cleanup:

- `Hugging Face to TinyRustLM Workflow.md`, 45255 bytes, SHA256 `97A489AD02BD76ED96EB8954784BB00EF52E7667B82EA700E0129D7E029EB5C2`
- `MiniModel P2P Exchange Architecture.md`, 30131 bytes, SHA256 `4749B9465F7209A6E64C473E44D190BC8E3CD9287CC4B95478AB070AE48D04E6`
- `Usability and Progressive Disclosure in Browser-Native Language Model Interfaces.md`, 39743 bytes, SHA256 `DC2DEFED3740D1AF04DE5B459EBC8B057631895E7769CD55673666D137F673CC`

The active TinyRustLM.com `agent-file-handoff/Improvement` bucket returned to README-only after preservation.

## Synthesis

The reports reinforced the current goal:

- Hugging Face rows are metadata and model-card discovery until Rust conversion or a verified MiniModel peer path produces an admitted `.slm`.
- Non-ready Hugging Face rows should say `Start Conversion`, not `Run`, `Chat`, `Download`, or `Choose converted .slm`.
- Converted-once reuse needs small, checksum-bound metadata that can make consenting peer endpoints discoverable without making MiniModel.org or TinyRustLM.com host model bytes.
- Advanced details, hashes, receipts, peer proofs, and verifier output should stay available behind disclosure while first-use source choices stay plain: Local Files, Hugging Face, and P2P Exchange.

## Implementation

MiniModel.org now has the maintainer-side metadata-feed publication path:

```text
minimodel write-peer-source-announcement-feed <output-json> <announcement-json>...
minimodel write-catalog-snapshot-with-announcement-feed <output-json> <feed-route> <announcement-feed-json> <catalog-entry-json>...
```

`write-peer-source-announcement-feed` validates one or more `minimodel.peer_source_announcement` JSON files, rejects duplicate model/peer rows, and writes `minimodel.peer_source_announcement_catalog` JSON with project-server serve/run/proxy flags set to `false`.

`write-catalog-snapshot-with-announcement-feed` validates the feed, checks that every feed model id exists in the supplied catalog entries, rejects unsafe URL-like feed routes, computes the feed SHA-256 from the exact JSON bytes, and writes `peer_source_announcement_routes` into `models.v0.json`. The snapshot points to small same-origin metadata only. It does not inline peer chunks, `.slm` artifacts, Hugging Face `/resolve/` URLs, or project-hosted model-byte routes.

TinyRustLM already knows how to verify same-origin SHA-256-bound announcement feed routes and apply matching announcements to proof-ready rows before showing `P2P Import`. The byte path remains Rust `import-peer-request`: fetch from a consenting direct peer, assemble pieces, verify artifact and manifest expectations, then write a local import receipt before browser import.

## Documentation

Updated locally:

- `E:\Source\Rust\MiniModel.org\ROADMAP.md`
- `E:\Source\Rust\MiniModel.org\docs\verifier-mvp.md`
- `E:\Source\Rust\MiniModel.org\docs\catalog-boundary.md`
- `E:\Source\Rust\MiniModel.org\docs\manifest-v0.md`
- `E:\Source\Rust\MiniModel.org\index.html`
- `E:\Source\Rust\MiniModel.org\workspace.uai`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\overview.md`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\manifest-v0.md`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\verifier-mvp.md`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\source-lanes.md`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\p2p-roadmap.md`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\agent-readme.md`
- `E:\Source\Rust\MiniModel.MiRust.com\index.html`
- `E:\Source\Rust\MiniModel.MiRust.com\llms.txt`
- `E:\Source\Rust\MiniModel.MiRust.com\llms-full.txt`
- `E:\Source\Rust\MiniModel.MiRust.com\workspace.uai`
- `E:\Source\Rust\MiniModel.MiRust.com\docs\file-checksums.sha256`

## Verification

- `cargo fmt`
- `cargo test -p minimodel-core -p minimodel`
- CLI smoke: write peer-source announcement, write announcement feed, write route-bound catalog snapshot, and verify the output contains `peer_source_announcement_routes` plus the feed SHA-256.

## Boundary

Project servers still never run, proxy, cache, or serve user model bytes. MiniModel.org and MiniModel.MiRust.com may publish docs, schemas, examples, metadata catalogs, announcement feeds, public-key routes, and takedown/contact routes only. SLM/TinyRustLM runtime execution remains browser-local after user-selected local `.slm` import and Rust/WASM validation.

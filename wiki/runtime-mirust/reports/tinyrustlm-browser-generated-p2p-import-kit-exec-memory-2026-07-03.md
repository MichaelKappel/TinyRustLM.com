# TinyRustLM Browser-Generated P2P Import Kit Exec Memory - 2026-07-03

## Source

This proof continues the converted-once path by exercising the later-user import flow. A user can load metadata for an already converted `.slm`, click `P2P Import`, and run the exact browser-generated import kit against a consenting peer without project servers or Hugging Face serving model bytes.

## Memory

`tinyrustlm/tools/browser-smoke.js` now has `hf-p2p-import-kit-exec`. It first runs the browser-generated Hugging Face conversion kit, producing a verified `.slm`, MiniModel manifest, peer pieces, a feed-bound catalog snapshot, and peer-source announcement feed metadata. It then starts MiniModel `serve-peer-pieces` from those generated manifest/piece files, serves the generated feed-bound `models.v0.json`, `peer-source-announcements.v0.json`, and MiniModel manifest as metadata from a separate HTTP endpoint, loads that catalog URL in the browser, verifies the browser fetches the checksum-bound announcement feed and applies one peer-source announcement, clicks the resulting `P2P Import` row, writes the exact downloaded request/script, runs the downloaded `.minimodel-peer-import.ps1` without copying a manifest sidecar into the kit, downloads the small MiniModel manifest metadata from the catalog URL, fetches model pieces only from `http://127.0.0.1:8123/`, assembles and reverifies the `.slm`, writes an import receipt, and compares the imported SHA-256 to the converted SHA-256.

## Product Fix

P2P import scripts now derive the local manifest filename from the catalog entry `manifest_route` basename, so artifact-shaped manifests such as `example-org__tiny-source-model.q8_0.minimodel.manifest.v0` are found beside the script instead of requiring an incorrect model-id-only filename. The browser smoke now also proves the more realistic shared-catalog path: the catalog entry begins with `peer_source_count=0`, the browser fetches a checksum-bound announcement feed to discover the consenting peer, and the import script downloads the small metadata manifest before Rust fetches peer pieces.

## Intake Guidance

The 2026-07-03 desktop/P2P intake batch supports this direction. It says the current product should remain browser-first and simple: local `.slm` import, Rust/WASM validation, and private in-browser chat. Advanced peer duties such as peer identity, local piece stores, cache quotas, consent prompts, logs, NAT/discovery experiments, and repeatable serve/fetch controls belong in a later optional user-run MiniModel Peer Companion. That companion must wrap the same Rust verifier rules instead of becoming a second trust boundary.

## Boundary

The proof keeps project servers out of model-byte transfer. The import request asserts project-server byte/execution/proxy flags are false, the script says it does not download model bytes from MiniModel.org, TinyRustLM.com, or Hugging Face, the catalog endpoint serves only JSON/text metadata and announcement feeds, the peer server serves only declared piece-set/piece files, and Rust `import-peer-request` fetches from the consenting local peer, assembles pieces, verifies SHA-256/Merkle data, validates `.slm`, and writes the receipt.

## Verification

```powershell
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18916/app/ 9502 tinylm16q8 hf-p2p-import-kit-exec
```

Result: converted `example-org__tiny-source-model.q8_0.slm`, published a feed-bound `models.v0.json` whose base entry has `peer_source_count=0`, served metadata catalog, announcement feed, and manifest routes from `http://127.0.0.1:8124/catalog/`, verified the browser fetched `peer-source-announcements.v0.json` and applied one peer-source announcement, served 17 peer pieces at `http://127.0.0.1:8123/`, downloaded and executed `example-org__tiny-source-model.minimodel-peer-import.ps1` with `manifestSidecarCopied=false` and `manifestDownloaded=true`, imported `example-org__tiny-source-model.q8_0.slm`, wrote `example-org__tiny-source-model.q8_0.minimodel-receipt`, and matched artifact SHA-256 `sha256:15124f2ed46b3cd8b02adbc467da320dc2fd33ff2cbcc38340e72ba62447865e`.

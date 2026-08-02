# TinyRustLM Hugging Face Conversion Receipt P2P Hints Memory - 2026-07-03

## Scope

`tinyrustlm-slm-pack convert-huggingface-request` now makes the Rust conversion receipt a durable bridge from local Hugging Face source conversion to MiniModel reuse. The browser script can still run the follow-up commands, but the receipt itself now preserves enough local command guidance for a user, developer, or AI agent to continue the convert-once/share-later path from the Rust-produced evidence.

## Implemented Contract

After a user supplies a local `.safetensors` file and Rust validates the conversion request, `tinyrustlm-conversion.receipt` records:

- the MiniModel model id derived from the source model id;
- the intended `minimodel-peer-share` output directory beside the converted `.slm`;
- `minimodel_prepare_peer_share_command` for proof-ready metadata without a known peer URL;
- `minimodel_prepare_peer_share_with_peer_command` for the same package with an explicit consenting peer URL;
- `minimodel_catalog_entry_glob=*.catalog-entry.v0.json`;
- `minimodel_peer_pieces_glob=*.peer-pieces`;
- `minimodel_write_catalog_snapshot_command`;
- `minimodel_write_peer_source_announcement_command`;
- `minimodel_write_peer_source_feed_command`;
- `minimodel_serve_peer_pieces_command`;
- `converted_once_publication_rule=publish-catalog-json-and-peer-source-announcement-json-only`.

The receipt still binds the request checksum, source safetensors checksum evidence, output `.slm` checksum, output manifest checksum, and no-project-server-byte boundaries. The new fields are command hints and publication guidance only. They do not fetch Hugging Face model bytes, upload `.slm` bytes, start peer serving, or make project servers run/proxy/cache/host model artifacts.

## Product Meaning

This narrows the confusing gap between `Start Conversion` and later P2P reuse. A Hugging Face result remains metadata until Rust converts a user-owned local source file into `.slm`; once converted, the Rust receipt itself says how to create MiniModel manifest/catalog/peer-piece metadata and how to publish only catalog or peer-source announcement JSON. Later users can get `P2P Import` only when MiniModel metadata names an admitted `.slm` plus a validated consenting peer source.

## Intake Note

After the user reported related intake files, the repo-side active handoff buckets were rescanned across SLMComposer.com, TinyRustLM.com, TinyRustLM.MiRust.com, MiniModel.org, Runtime.MiRust.com, and MiRust.com. The active buckets were placeholder-only, and the active Codex attachment was the older SLM Composer dashboard prompt. No new non-placeholder TinyRustLM/MiniModel report was available to synthesize in this pass.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack huggingface --quiet`

## Documentation And Deploy Targets

Source docs updated in this pass:

- `tinyrustlm/README.md`
- `tinyrustlm/docs/browser-runtime.md`
- `workspace.uai`
- `.uai/short-term-memory.uai`

Public docs mirrors that must be updated before claiming live deployment:

- TinyRustLM.com public docs exports when they mention conversion receipts;
- TinyRustLM.MiRust.com browser-runtime/developer docs and package manifests.

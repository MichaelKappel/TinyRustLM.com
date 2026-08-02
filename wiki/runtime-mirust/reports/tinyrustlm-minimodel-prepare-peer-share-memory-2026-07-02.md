# TinyRustLM MiniModel Prepare Peer Share Memory - 2026-07-02

## Scope

This report routes the quality continuation that simplified the real post-conversion path from Hugging Face/local source bytes into a reusable MiniModel peer-share package.

## Current Behavior

- Hugging Face results remain metadata until Rust converts and verifies a local `.slm`, or MiniModel metadata identifies a proof-ready admitted `.slm` with a consenting peer source.
- TinyRustLM `Start Conversion` now saves a local script that runs `tinyrustlm-slm-pack` for safetensors inspection, planning, conversion, `.slm` validation, and packer manifest validation.
- After conversion, the generated script calls `minimodel prepare-peer-share <artifact.slm> <output-dir> <model-id> [source-huggingface-model-id] [known-peer-base-url]`.
- MiniModel `prepare-peer-share` validates the local `.slm`, writes a MiniModel manifest, writes a deterministic `.minimodel-peer-offer`, exports local peer pieces, and writes a catalog-entry JSON in one output directory.
- If a known consenting peer URL is supplied, the catalog entry includes validated `peer_source_count` / `peer_sources` metadata. Without it, the row remains proof-ready and TinyRustLM shows `Set Peer URL`.
- TinyRustLM peer-import requests now name `prepare-peer-share` as the sender preparation command plus `serve-peer-pieces` as the serving command, instead of exposing the lower-level `export-peer-pieces` command in the beginner-facing handoff.
- Project servers still do not run, proxy, download, upload, or serve user model bytes.

## Durable Code Routes

- `E:\Source\Rust\MiniModel.org\crates\minimodel-core\src\lib.rs`
- `E:\Source\Rust\MiniModel.org\crates\minimodel\src\main.rs`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\app\app.js`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\tools\browser-smoke.js`

## Durable Documentation Routes

- `E:\Source\Rust\MiniModel.org\docs\verifier-mvp.md`
- `E:\Source\Rust\MiniModel.org\docs\manifest-v0.md`
- `E:\Source\Rust\MiniModel.org\docs\catalog-boundary.md`
- `E:\Source\Rust\MiniModel.org\ROADMAP.md`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\README.md`
- `E:\Source\Rust\SLMComposer.com\tinyrustlm\docs\browser-runtime.md`
- `E:\Source\Rust\TinyRustLM.MiRust.com\docs\runtime-portal\runtime-docs\implementation\browser-runtime.md`
- `E:\Source\Rust\TinyRustLM.MiRust.com\docs\runtime-portal\runtime-docs\implementation\slmcomposer-source-options-ui-v1.0.7.md`

## Verification

- MiniModel tests cover `prepare-peer-share` from the real TinyRustLM q8 `.slm` fixture, including manifest, peer-offer, peer-piece, and catalog-entry output.
- MiniModel tests reject project-server peer URLs before output creation.
- TinyRustLM browser smoke checks that generated conversion scripts include `prepare-peer-share`, peer-import requests include `prepare-peer-share` plus `serve-peer-pieces`, peer-import requests do not expose `export-peer-pieces`, do not call Hugging Face downloads, and preserve P2P import gating.

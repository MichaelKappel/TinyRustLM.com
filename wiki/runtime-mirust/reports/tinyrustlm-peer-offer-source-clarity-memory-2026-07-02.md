# TinyRustLM Peer Offer And Source Clarity Memory - 2026-07-02

## Summary

TinyRustLM now has a concrete Rust-side bridge from local conversion to future P2P exchange: `tinyrustlm-slm-pack peer-offer` writes a deterministic `.minimodel-peer-offer` text manifest for a verified `.slm`, and `validate-peer-offer` checks that the offer still matches the local artifact before it is used as metadata.

This is not peer networking. It is the first implementable proof shape for "convert once, share later": artifact byte count, artifact SHA-256, `.slm` structural identity, tokenizer/config/tensor-layout checksums, fixed-size chunk SHA-256 rows, chunk-list SHA-256, and a Merkle root. The manifest also carries explicit false flags for project-server model-byte serving and live peer transfer.

## Hugging Face Source Clarity

The Hugging Face lane now says plainly that search results are model cards, not runnable models. A result is not TinyRustLM-compatible by default. It becomes runnable only after Rust accepts the source shape, converts it to `.slm`, validates the `.slm`, and the user imports that local file through the browser file picker.

The visible result states are now:

- `Rust conversion required` for unmatched Hugging Face model-card results.
- `Catalog match, local .slm needed` when MiniModel metadata identifies an admitted converted record.
- `Peer proof, local .slm needed` when catalog metadata also references a `.minimodel-peer-offer`.

The Search Metadata action must keep the source chooser open and filter/update the Hugging Face result list in place. Save Conversion Request and Save Rust Conversion Script must also keep the chooser open after the local handoff download.

## Rust Commands

New packer commands:

```powershell
cargo run -p tinyrustlm-slm-pack -- peer-offer <input.slm> <output.minimodel-peer-offer>
cargo run -p tinyrustlm-slm-pack -- validate-peer-offer <input.slm> <output.minimodel-peer-offer>
```

The generated Hugging Face conversion script now runs:

```powershell
cargo run -p tinyrustlm-slm-pack -- inspect-safetensors $SourceSafetensors $InspectReport
cargo run -p tinyrustlm-slm-pack -- plan-safetensors-source $SourceSafetensors $SourceShape $PlanReport
cargo run -p tinyrustlm-slm-pack -- convert-safetensors-trained $SourceSafetensors $SourceShape $SourceDir $OutputSlm $Quantization
cargo run -p tinyrustlm-slm-pack -- validate $OutputSlm
cargo run -p tinyrustlm-slm-pack -- validate-manifest $OutputSlm "$OutputSlm.manifest"
cargo run -p tinyrustlm-slm-pack -- peer-offer $OutputSlm $PeerOffer
cargo run -p tinyrustlm-slm-pack -- validate-peer-offer $OutputSlm $PeerOffer
```

The script still does not download model bytes and does not call Hugging Face APIs. Users must provide a local source file that they acquired and reviewed outside project infrastructure.

## MiniModel Route

MiniModel.org and MiniModel.MiRust.com now document the `.minimodel-peer-offer` proof and catalog fields:

- `peer_offer_route`
- `peer_offer_sha256`
- `peer_offer_kind`
- `peer_offer_chunk_algorithm`
- `peer_offer_chunk_size`
- `peer_offer_chunk_count`
- `peer_offer_merkle_root_sha256`

The catalog may reference peer-offer proof text, but it still must not reference or serve user model bytes. Peer transfer remains unavailable until a consenting peer client can move chunks and Rust can reverify them before browser import.

## Verification

Focused verification performed before deployment:

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack peer_offer -- --nocapture`
- `cargo run -p tinyrustlm-slm-pack -- peer-offer tinyrustlm\models\tiny-test-model-q8.slm target\peer-offer-smoke\tiny-test-model-q8.default.minimodel-peer-offer tiny-test-model-q8.slm`
- `cargo run -p tinyrustlm-slm-pack -- validate-peer-offer tinyrustlm\models\tiny-test-model-q8.slm target\peer-offer-smoke\tiny-test-model-q8.default.minimodel-peer-offer`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8100/app/ 19669 tinylm16q8 hf-search-ui`

The `hf-search-ui` smoke proves that the source chooser is closed at first load, opens only after the user requests it, stays open after Search Metadata, keeps Hugging Face visible, renders two metadata rows, offers Rust conversion handoffs for unmatched rows, shows local `.slm` requirements for catalog matches, and never fetches Hugging Face `/resolve/` model bytes.

## Boundary

Project servers still do not run user model bytes and do not serve user model bytes. TinyRustLM remains browser-local. Hugging Face is metadata and user-side source acquisition only. MiniModel is metadata, schemas, evidence, peer-offer proof, and future consent-based transfer planning only.

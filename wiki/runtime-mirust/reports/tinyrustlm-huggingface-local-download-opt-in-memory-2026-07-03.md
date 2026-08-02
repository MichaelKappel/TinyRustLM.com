# TinyRustLM Hugging Face Local Download Opt-In Memory - 2026-07-03

## Source

This pass follows the Hugging Face conversion kit work, the MiniModel converted-once P2P path, and the 2026-07-03 desktop/P2P intake preserved under `docs/report-intake/2026-07-03/`.

## Memory

Hugging Face search remains a metadata-only browser action. The browser reads Hub model-card metadata, sibling file names, byte counts, and optional LFS SHA-256 evidence, but it does not request `/resolve/` model-byte routes and does not import Hub bytes as runnable models.

`Start Conversion` now writes the suggested `.safetensors` source file, optional direct Hugging Face `/resolve/main/...` URL, optional `sha256:` evidence, byte count, and a `source_acquisition_rule` into `minimodel.huggingface_conversion_request.v0`. The request boundary explicitly records that the browser does not download Hugging Face model bytes and that local-script download requires explicit opt-in.

The generated `.tinyrustlm-convert.ps1` script still prefers a reviewed local source file beside the script, under `./source/`, or at `TINYRUSTLM_SOURCE_SAFETENSORS`. If no local file is found, the script may download the suggested source directly from Hugging Face only when `TINYRUSTLM_ALLOW_HF_DOWNLOAD=1` is set by the user. That download happens on the user's machine, never through TinyRustLM.com, MiniModel.org, or project servers.

When the local script downloads a source file, it verifies the expected byte count and SHA-256 when Hugging Face metadata supplied them before running Rust `tinyrustlm-slm-pack convert-huggingface-request`. Successful conversion still produces a local `.slm`, conversion preflight/receipt evidence, MiniModel peer-share metadata, catalog snapshots, announcement/feed metadata, and serve/import scripts for the converted-once P2P path.

## Intake Guidance Applied

The July 3 desktop/P2P intake supports this shape: keep the browser path simple and local, keep the Rust verifier as the trust authority, and push advanced peer duties into local handoff kits now and an optional user-run MiniModel Peer Companion later. It does not justify a hosted model-byte service or a required desktop install for first-run users.

## Verification

Verification passed with JavaScript syntax checks and focused browser smokes for `hf-search-ui` and `hf-conversion-kit-exec`. The search smoke proves Hugging Face model-byte routes are not requested by the browser, the conversion request carries URL/hash/byte evidence, the saved script guards direct download behind `TINYRUSTLM_ALLOW_HF_DOWNLOAD=1`, and first-run fake transcript text remains absent. The conversion-kit execution smoke proves the generated script can still convert a local safetensors fixture into a verified `.slm`, write MiniModel peer-share metadata, produce 17 peer pieces, and generate catalog/feed/publish artifacts.

## Boundary

Project servers may publish docs, schemas, metadata catalogs, public keys, examples, announcement feeds, and takedown/contact routes. They must not host, proxy, cache, infer with, fetch, run, or serve user model bytes.

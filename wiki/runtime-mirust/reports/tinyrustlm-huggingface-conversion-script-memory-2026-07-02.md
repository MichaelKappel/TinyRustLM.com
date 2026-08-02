# TinyRustLM Hugging Face Conversion Script Memory - 2026-07-02

## Summary

TinyRustLM now makes the Hugging Face lane more honest and more actionable. Hugging Face search results are external metadata records, not runnable local models. A result is runnable in TinyRustLM only after a compatible source checkpoint is converted to `.slm`, validated by Rust, imported through the browser file picker, and optionally associated with MiniModel metadata.

Unmatched Hugging Face rows can save two local handoff files:

- `minimodel.huggingface_conversion_request.v0` JSON for source review, conversion, admission, and later P2P availability planning.
- A `.tinyrustlm-convert.ps1` script that runs the local Rust packer commands for `inspect-safetensors`, `plan-safetensors-source`, `convert-safetensors-trained`, `validate`, and `validate-manifest`.

The generated script does not download model bytes and does not call the Hugging Face API. It requires the user to edit the local TinyRustLM workspace path and point at a local `.safetensors` file they obtained and reviewed outside project infrastructure.

## UI Boundary

The simple source chooser now labels Hugging Face as "metadata search" and tells users that rows are not runnable until a compatible source is converted to `.slm`. The primary button says `Search Metadata`, and result cards distinguish:

- `conversion required` for Hugging Face rows without admitted MiniModel `.slm` metadata.
- `MiniModel metadata found` for rows that match metadata for an already converted and admitted `.slm`.
- `Choose converted .slm` for the actual browser-local import path.

Search and handoff actions keep the source chooser open. The previous close bug came from the temporary download link used by `downloadTextFile`: the synthetic click could bubble as an outside click and hide the popover after saving a conversion request or script. The download link now stops propagation, and the handoff functions explicitly keep the chooser open.

## Verification

Focused verification:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8100/app/ 19663 tinylm16q8 hf-search-ui`

The `hf-search-ui` smoke now captures the state immediately after Search Metadata and again after Save Conversion Script. It fails if either action closes the source chooser, if unmatched rows omit conversion-required/script actions, if matched rows omit MiniModel metadata actions, if model bytes are fetched through `/resolve/`, or if the generated script attempts remote download/API behavior.

## Boundary

Project servers still do not run user model bytes and do not serve user model bytes. TinyRustLM.com remains browser-local. MiniModel metadata may make converted artifacts discoverable by checksum, and later P2P can transfer chunks between consenting peers, but the current working path is local conversion and local `.slm` import.

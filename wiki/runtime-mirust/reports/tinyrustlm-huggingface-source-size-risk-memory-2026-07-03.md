# TinyRustLM Hugging Face Source Size Risk Memory - 2026-07-03

## Source

This pass follows the Hugging Face supported-source gate and the user's concern that large Hugging Face model cards should not make local conversion look like the default easy path. It also applies the July 3 desktop/P2P intake guidance: keep TinyRustLM browser-local and simple while steering advanced repeated-transfer work toward verified P2P reuse and a future optional user-run companion.

## Memory

TinyRustLM now classifies unmatched Hugging Face rows with `.safetensors` metadata by source byte risk before choosing the beginner action label. Normal source-backed rows still show `Start Conversion`, because the local kit can convert a reviewed source file or an explicitly opted-in direct Hugging Face download.

Large source rows at or above 2 GiB show `Review Conversion`, `Large source; P2P preferred`, a formatted source-size warning, and availability summary text that says the model needs explicit large-source conversion review. The UI tells users that P2P reuse is preferred when a verified peer entry becomes available and that local conversion may take a while.

Rows with `.safetensors` metadata but no usable byte count show `Review Conversion`, `Source size unknown`, source-size review summary text, and review-first guidance. Rows without a supported `.safetensors` source remain no-supported-source review-only rows. P2P-ready MiniModel catalog matches still show `P2P Import`.

The browser remains metadata-only for Hugging Face discovery. It does not fetch `/resolve/` model bytes. The generated local conversion kit remains the place where a user can explicitly opt into source acquisition, Rust conversion, checksum verification, MiniModel share metadata, and converted-once P2P publication.

## Verification

Verification passed with:

- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18925/app/ 9522 tinylm16q8 hf-search-ui`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18925/app/ 9523 tinylm16q8 hf-conversion-kit-exec`
- Follow-up `hf-search-ui` verification on 2026-07-03 proved the refined `Review Conversion` label while preserving the conversion and P2P import kit paths.

The Hugging Face UI smoke now covers four metadata rows: a normal `.safetensors` source row, a P2P-ready `.slm` metadata row, a large 10.0 GiB `.safetensors` source row, and a no-supported-source row. It proves the simple and advanced result counts, action labels, P2P-on and P2P-off primary actions, large-source warnings, summary counts, no fake `Choose converted .slm` action, and no Hugging Face `/resolve/` model-byte fetch.

The conversion-kit execution smoke proves the normal source-backed row still generates and executes a local conversion kit that produces a verified `.slm`, conversion preflight/receipt evidence, MiniModel manifest, peer pieces, catalog snapshots, announcement feed, serve helper, and publish README.

## Boundary

This is a source-risk communication and action-labeling gate. It does not add hosted model bytes, browser Hugging Face model-byte downloads, automatic peer transfer, or project-server execution. Project servers remain docs, schemas, metadata catalogs, public keys, examples, announcement feeds, and contact/takedown routes only.

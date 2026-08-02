# TinyRustLM Self-Contained Peer Import Kit Memory - 2026-07-03

## Source

This memory follows the converted-once P2P smoke and the Hugging Face/P2P browser source chooser work.

## Memory

TinyRustLM P2P import handoff scripts are now self-contained. When a Hugging Face row maps to MiniModel metadata with a consenting peer source, `P2P Import` still downloads the visible `minimodel.peer_import_request.v0` JSON plus the `.minimodel-peer-import.ps1` script, but the script also embeds that exact request JSON as base64.

If the sidecar request JSON is missing when the user runs the script, the script writes the embedded request beside itself before invoking MiniModel. This matches the self-contained Hugging Face conversion kit pattern and avoids a brittle "keep these two files together or the workflow dies" failure.

## Boundary

The import script still does not download model bytes from MiniModel.org, TinyRustLM.com, Hugging Face, or other project servers. It may download only the small MiniModel manifest metadata when the catalog supplied a manifest URL. Model bytes come from the consenting peer URL and are fetched, assembled, verified, and receipted by Rust `minimodel import-peer-request`.

## Verification

Verification for this slice:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18910/app/ 9491 tinylm16q8 hf-search-ui`

The focused browser smoke observed the generated peer-import script containing `$EmbeddedPeerImportRequestBase64`, `FromBase64String`, and `Wrote embedded peer import request:`, while still preserving `import-peer-request`, `serve-peer-pieces`, the consenting peer URL, and no project-server model-byte wording.

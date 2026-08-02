# TinyRustLM Known-Peer Conversion Kit Memory - 2026-07-03

## Source

This memory follows the converted-once P2P smoke, the self-contained peer import kit, and the Hugging Face source chooser workflow.

## Memory

TinyRustLM now carries the list-level consenting Known peer URL into the Hugging Face conversion kit when P2P is enabled. If the user enters a peer URL through the `Known peer URL` control before choosing `Start Conversion`, the generated `minimodel.huggingface_conversion_request.v0` records `local_conversion.known_peer_base_url`, and the generated `.tinyrustlm-convert.ps1` initializes `$KnownPeerBaseUrl` to that value.

That means the conversion script can run the post-conversion MiniModel peer-source publication path immediately after Rust creates and validates the `.slm`: `add-peer-source`, `write-peer-source-announcement`, `write-peer-source-announcement-feed`, `write-catalog-snapshot-with-announcement-feed`, and metadata-only `write-catalog-snapshot`. Users no longer have to rediscover or hand-edit the peer URL after already entering it in the browser.

## Boundary

Known peer propagation is consent metadata only. The script still does not download source bytes from Hugging Face, does not upload `.slm` files or peer-piece directories, and does not make project servers fetch, serve, proxy, cache, or run model bytes. The peer URL is used only by local MiniModel commands to publish metadata that says where a consenting peer can serve pieces.

## Verification

Verification for this slice:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18911/app/ 9492 tinylm16q8 hf-search-ui`

The focused browser smoke set `Known peer URL` to `http://127.0.0.1:8123/`, clicked `Start Conversion` while P2P was enabled, and observed the generated conversion request carrying `known_peer_base_url` plus the generated script containing `$KnownPeerBaseUrl = "http://127.0.0.1:8123/"`.

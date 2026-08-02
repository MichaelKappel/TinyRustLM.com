# TinyRustLM Browser-Generated Conversion Kit Exec Memory - 2026-07-03

## Source

This continues the conversion README kit work by proving the exact browser-generated Hugging Face conversion handoff can run outside the browser.

## Memory

`tinyrustlm/tools/browser-smoke.js` now has `hf-conversion-kit-exec`. The mode reuses the real `hf-search-ui` flow, captures the files produced by `Start Conversion`, writes them into `target/browser-generated-conversion-kit-smoke/`, generates a matching local `tinylm16-bpe` Hugging Face-style `model.safetensors` fixture, and runs the downloaded `.tinyrustlm-convert.ps1` with `TINYRUSTLM_WORKSPACE`, `MINIMODEL_WORKSPACE`, and `TINYRUSTLM_SOURCE_SAFETENSORS` set.

The smoke validates the script output directory after execution. It requires the converted `.slm`, `tinyrustlm-conversion.receipt`, MiniModel manifest, peer offer, peer-piece directory, catalog entry, with-peer catalog entry, peer-source announcement, `peer-source-announcements.v0.json`, `models.v0.json`, `models.with-announcement-feed.v0.json`, `.minimodel-serve-peer-pieces.ps1`, and `converted-once-p2p-publish.README.txt`.

## Related Intake

This proof uses the July 3 desktop/P2P intake guidance without moving TinyRustLM away from the browser-first product shape. The useful pattern is a generated local handoff kit today and a possible user-run MiniModel Peer Companion later: both keep model bytes on the user's machine, reuse Rust verifier commands, make consent explicit before serving pieces, and leave project servers responsible only for docs, schemas, metadata, and announcement feeds.

## Boundary

The execution smoke preserves the no-server-byte rule. It asserts conversion receipts keep project server model-byte flags false, validates metadata-only catalog and announcement JSON, rejects artifact/model URL fields and Hugging Face `/resolve/` paths in publication metadata, and checks the publication README warns not to send `.slm` files or `*.peer-pieces` directories to project servers.

## Verification

The focused command passed on `http://127.0.0.1:18913/app/`:

`node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18913/app/ 9494 tinylm16q8 hf-conversion-kit-exec`

The run produced `example-org__tiny-source-model.q8_0.slm` from a 39-tensor `tinylm16-bpe` local safetensors fixture, wrote MiniModel metadata, wrote 17 peer pieces, created a P2P-ready `models.v0.json`, and created the peer-source announcement feed package.

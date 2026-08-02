# TinyRustLM Conversion README Kit Memory - 2026-07-03

## Source

This implementation applies the July 3 desktop/P2P intake guidance already preserved under `docs/report-intake/2026-07-03/`: keep TinyRustLM browser-first, make conversion handoffs understandable, keep advanced peer details available without making them the beginner path, and keep project servers out of user model bytes.

## Memory

Hugging Face `Start Conversion` now saves a three-file local kit:

- `*.minimodel-conversion-request.json`
- `*.tinyrustlm-convert.ps1`
- `*.tinyrustlm-conversion.README.txt`

The README is intentionally human-facing. It names the source model and model card, lists the saved files, tells the user to review the license/model card and obtain the source `.safetensors` themselves, explains where the reviewed file can live, gives the PowerShell command to run, and tells the user to import the verified `.slm` through the browser file picker.

The README also separates beginner and advanced outcomes. It says the script recreates the request JSON if missing, runs `tinyrustlm-slm-pack convert-huggingface-request`, runs MiniModel `prepare-peer-share`, writes a metadata-only `models.v0.json`, and, when a consenting Known peer URL is set, writes peer-source announcement/feed metadata. It explicitly marks catalog entries, announcement feeds, docs, schemas, public keys, contact routes, and takedown routes as safe publication materials.

## Boundary

The README tells users never to upload `.slm` files, `*.peer-pieces` directories, or source `.safetensors` files to project servers. It repeats that TinyRustLM.com and MiniModel.org do not serve, proxy, cache, run, or fetch user model bytes. Hugging Face search remains metadata-only until local Rust conversion or verified P2P import succeeds.

## Verification

`hf-search-ui` now requires `Start Conversion` to save all three files. It verifies the README MIME type, source model, source `.safetensors` hint, `TINYRUSTLM_SOURCE_SAFETENSORS`, `tinyrustlm-slm-pack convert-huggingface-request`, MiniModel `prepare-peer-share`, `models.v0.json`, Known peer URL propagation, safe-publication wording, never-upload wording, and no unsafe Hugging Face `/resolve/` or project-server byte-serving language.

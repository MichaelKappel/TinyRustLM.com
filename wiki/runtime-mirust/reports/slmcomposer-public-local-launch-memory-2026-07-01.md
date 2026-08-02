---
title: SLMComposer Public Local Launch Memory
date: 2026-07-01
status: current
memory_type: implementation-report
project: Runtime.MiRust.com / TinyRustLM
public_product: SLMComposer.com
---

# SLMComposer Public Local Launch Memory

## Route

SLMComposer.com is the live usable browser surface for TinyRustLM. Runtime.MiRust.com remains the project and documentation identity, and tinyrustlm.mirust.com remains the model documentation route.

## Boundary

The public SLMComposer host must not auto-admit, fetch, serve, or run hosted model weights from its own `/models/` routes. On the public host, the app loads the static shell and WASM runtime, then waits for the user to import a local `.slm` file from disk.

## Implementation

The app now renders `SLM Composer` as the live product name while keeping Runtime.MiRust.com and TinyRustLM visible as runtime/project provenance. A local `.slm` file picker reads user-owned bytes, computes the TinyRustLM checksum, displays local-file provenance, then transfers bytes to the existing Rust/WASM `load_model` ABI. Rust remains the model validator.

Optional Hugging Face discovery is user-triggered only. It searches the external model index from the browser after a click, links to model pages or external `.slm` downloads when present, and does not perform remote inference or import bytes into the runtime without the local file picker.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo run -p tinyrustlm-browser-harness --quiet -- tinyrustlm`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9333 tinylm16q8 ui-audit`
- `node tinyrustlm/tools/browser-smoke.js http://slmcomposer.com:8080/app/ 9334 ignored public-local-only`

The public-local smoke maps `slmcomposer.com` to the local test server and proves the public host requests only app shell, CSS, JS, WASM manifest, WASM, and favicon before user action. No `/models/` route and no Hugging Face request are observed before a user action.

## Deployment Verification

The public deploy package contained six files: root `index.html`, `app/index.html`, `app/app.css`, `app/app.js`, `runtime/tinyrustlm.wasm`, and `runtime/tinyrustlm.wasm.manifest`. It contained zero `.slm`, `.adp1`, `.asp1`, `.alr1`, `.safetensors`, or `.bin` model artifacts.

The package was uploaded to SLMComposer.com over explicit FTPS. Live HTTPS checks confirmed the root page redirects to `/app/`, `/app/` contains the SLM Composer local-only warning and Hugging Face discovery controls, `/runtime/tinyrustlm.wasm` serves with `application/wasm`, the runtime manifest checksum matches the package, and `/models/tinylm16-q8.slm` returns `404 Not Found`.

The 2026-07-01 catalog redeploy added root `.htaccess` as a deployment file so `https://slmcomposer.com/` returns an HTTP `302` to `https://slmcomposer.com/app/` before browser JavaScript runs. Live root browser smoke from `https://slmcomposer.com/` then loaded the WASM runtime, imported a local catalog JSON list, verified the matching local `.slm` SHA-256, and generated `e` locally without any SLMComposer-hosted model-byte request.

## Next Route

The next useful public tool is a local conversion/import wizard that helps users create `.slm` files from reviewed external model sources on their own machine, preserving the safetensors review, extraction, validation, conversion, eval, selector, and checksum-bound reporting path.

For a later model exchange/catalog identity, `MiniModel.org` is the strongest naming candidate because it describes a tiny-model index without implying server-side execution. `MiniLM.org` may collide with the existing MiniLM model family, and `TinyLM.net` is aligned but narrower.

# TinyRustLM Browser Harness Architecture

Reviewed: 2026-07-02

## Purpose

The browser harness verifies the TinyRustLM static app contract before a local or public deploy. It checks that the browser-local Rust/WASM runtime shell exposes the expected controls, local-only model boundary, WASM asset routes, selector-registry markers, and model provenance surfaces.

## Runtime Areas

- Static app crawl: required HTML, JavaScript, WASM manifest, local file routes, and privacy copy.
- Loopback route checks: local static server responses for the app, runtime WASM, manifests, `.slm`, and `.slm.manifest` routes.
- Browser contract checks: UI structure, model selector behavior, local-only network policy, generated route gates, module-plan evidence, and adapter-family evidence.
- Deploy safety: root TinyRustLM.com app behavior must match the current TinyRustLM.MiRust.com developer portal and public machine-readable exports before deployment is claimed.

## Trust Boundaries

No dropped file, model file, web page, prompt, or generated model output is trusted as an instruction source. JavaScript transfers local model and adapter bytes, but Rust owns `.slm` admission, checksum validation, and adapter validation. Project servers may serve the app, docs, schemas, metadata, manifests, and examples; they must not run user model bytes or serve user model bytes.

## Implementation Boundary

The harness is a no-crate Rust tool under `tinyrustlm/tools/browser_harness/`. It verifies the checked-in static app tree and optional loopback routes. It does not run remote inference, publish an MCP server, proxy Hugging Face, transfer P2P model bytes, or claim assistant-quality behavior for deterministic smoke models.

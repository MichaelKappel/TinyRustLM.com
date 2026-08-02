---
title: Browser Runtime Manifest Memory 2026-06-27
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-runtime-manifest-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T18:07:37Z
---

# Browser Runtime Manifest Memory

TinyRustLM now verifies the browser runtime WASM bytes before instantiating them. The checked app fetches `runtime/tinyrustlm.wasm.manifest`, validates the runtime kind, status, local path, byte count, checksum, and next gate, then fetches `runtime/tinyrustlm.wasm` and recomputes the same 64-bit local checksum before `WebAssembly.instantiate`.

This extends the self-assembly path from verified model, adapter, receipt, and evidence files to the runtime module itself. The browser now proves the Rust engine bytes first, then continues into selector-registry model choice, assembly receipts, adapter-family receipts, manifest checks, and receipt-preferred sparse ASP1 auto assembly.

## Implementation

- `tinyrustlm/app/app.js` adds `../runtime/tinyrustlm.wasm.manifest`, byte-level checksum recomputation, runtime manifest field validation, byte-count validation, and pre-instantiation checksum validation.
- `tinyrustlm/runtime/tinyrustlm.wasm.manifest` binds the checked runtime to byte count `135624` and checksum `0x63d480b279aaa3be`; SHA256 for the manifest file is `7C7697DD8504CD45BA016602BE23D257ED8B8DFB1A28EBDC2DFDDBABE021EFC6`.
- `tinyrustlm/tools/slm_pack` writes runtime manifests for generated `browser-multi-parent-bundle` roots and exposes `runtime-wasm-manifest <input.wasm> <output.wasm.manifest>` for checked runtime refresh after a rebuild.
- `tools/vs/Build-TinyRustLM.ps1` calls `runtime-wasm-manifest` immediately after copying the release WASM into `tinyrustlm/runtime/`.
- `tinyrustlm/tools/browser_harness` now treats the runtime manifest path, fields, byte count, and loopback route as part of the static browser contract.
- `tinyrustlm/tools/browser-smoke.js` asserts normal smokes request the runtime manifest and adds `runtime-manifest-drift`, which intercepts the manifest with a valid shape and mismatched checksum.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- PowerShell parse check for `tools/vs/Build-TinyRustLM.ps1`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::` with 4 focused tests
- `cargo test -p tinyrustlm-browser-harness` with 6 focused tests
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` with 9 static checks
- `cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest tinyrustlm/runtime/tinyrustlm.wasm tinyrustlm/runtime/tinyrustlm.wasm.manifest`
- `tools/vs/Build-TinyRustLM.ps1 -Configuration Debug`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-runtime-manifest/tinyrustlm all`
- Browser smoke `single` against the checked source root requested `/runtime/tinyrustlm.wasm.manifest`, verified the runtime, loaded TinyLM-16M q8_0, and generated `e`.
- Browser smoke `runtime-manifest-drift` stopped at boot with `WASM runtime checksum mismatch` and made no `.slm` model request.
- Browser smoke `adapter-sidecar-registry-file` against the generated q4 root requested the runtime manifest, loaded the generated selector route, verified assembly evidence and adapter-family sidecars, auto-applied sparse ASP1, and generated `e`.
- `cargo test --workspace` passed with 245 checks.

## Routing

Load this report before changing runtime WASM rebuild/copy flows, generated browser bundle runtime staging, browser boot sequencing, runtime manifest fields, or smoke assertions around WASM instantiation. This report complements the browser text-sidecar, selector budget, auto-assembly, adapter-family receipt, and assembly receipt reports; together they define the browser-local module assembly chain.

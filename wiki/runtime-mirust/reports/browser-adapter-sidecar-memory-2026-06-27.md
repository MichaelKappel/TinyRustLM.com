---
title: Browser Adapter Sidecar Memory 2026-06-27
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-adapter-sidecar-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T13:52:09Z
---

# Browser Adapter Sidecar Memory

This durable note records the TinyRustLM browser UI path for applying local f32, q8_0, and q4_0 `ADP1` sidecars.

## Boundary

The browser app now exposes an Adapter Sidecar panel for the checked tiny f32, q8_0, and q4_0 fixtures. The routes are `../models/tiny-test-model-self.adp1`, `../models/tiny-test-model-q8-self.adp1`, and `../models/tiny-test-model-q4-self.adp1`, each generated from its matching tiny `.slm` against itself as a zero-delta package. JavaScript selects the route, fetches local bytes, copies them into WASM memory, calls `apply_adapter_delta`, and then renders Rust's result text and diagnostics.

JavaScript does not parse adapter bytes. Rust remains the authority for `ADP1` package identity, checksums, tensor directory, tokenizer checksum, tensor layout checksum, finite delta values, fused values, compact q8_0/q4_0 re-quantization, and generation-state reset.

## Implementation Shape

- `tinyrustlm/app/index.html` adds the Adapter Sidecar panel, selector, apply button, and status field.
- `tinyrustlm/app/app.js` declares the tiny f32, q8_0, and q4_0 self-sidecar routes, filters adapter routes to local `../models/*.adp1`, fetches bytes, calls `apply_adapter_delta`, resets host-side generation context, and keeps adapter controls tied to a loaded model.
- `tinyrustlm/tools/browser_harness/src/main.rs` checks the static IDs, visible panel text, JS WASM call marker, Rust export definition, and checked sidecar route.
- `tinyrustlm/tools/browser-smoke.js` adds `adapter-sidecar` mode: select tiny f32, q8_0, or q4_0, generate one token, apply the matching sidecar, then verify `adapter applied`, matching quantization diagnostics, cleared token/KV state, and local-only requests.
- `tools/vs/Test-TinyRustLM.ps1` wires the sidecar smoke into `-BrowserSmoke`.
- `tinyrustlm/models/tiny-test-model-self.adp1`, `tiny-test-model-q8-self.adp1`, `tiny-test-model-q4-self.adp1`, and their manifests are the checked local packages and proof sidecars for this browser route.

## Artifact Hashes

- `tinyrustlm/models/tiny-test-model-self.adp1`: `DBEEB5875D00958179600C1CB353CA1FAB7604F3D755A5DA905BFFF7F45B8BA8`
- `tinyrustlm/models/tiny-test-model-self.adp1.manifest`: `78D72C47C6423F4E16E194DBB7F56F055071962FF611CC8C12E971C4C0FB75D0`
- `tinyrustlm/models/tiny-test-model-q8-self.adp1`: `7B4E998EFEAC9B9D7BB6F909FC99BC17CA81A905D5C19FA0970A8229BF67E5E8`
- `tinyrustlm/models/tiny-test-model-q8-self.adp1.manifest`: `5680FD9A8676B818BCE3B90175AE75B574ACFE380B0B374A27ED46EA2C714AEB`
- `tinyrustlm/models/tiny-test-model-q4-self.adp1`: `9BD044B950E0CED7B8C9785D0ECEB0E175B91861D1C845267BC0D690A0CC9C56`
- `tinyrustlm/models/tiny-test-model-q4-self.adp1.manifest`: `2060583F1243B373C8E3AEFECA5EFD763F09979E679249B9C087C1EC3DFF1880`
- `tinyrustlm/runtime/tinyrustlm.wasm`: `2948DAF23FECD6560A732A4F08A92A3885D89BD52FF1F3A3E6C54A3E699CAA12`

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- PowerShell parse check for `tools/vs/Test-TinyRustLM.ps1`
- `cargo fmt --all`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack adapter`
- `cargo test -p tinyrustlm-runtime adapter`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node tinyrustlm/tools/wasm-abi-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18510/app/ 9250 tinyf32 adapter-sidecar`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9240 tinyq8 adapter-sidecar`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9241 tinyq4 adapter-sidecar`
- `cargo test --workspace`

## Next Routes

- Keep `adapter-sidecar` browser smoke in the default browser helper when adapter UI or runtime state changes.
- Keep registry-provided adapter sidecars tied to explicit local adapter routes, matching manifest fields, and smoke evidence.
- Use `browser-sparse-adapter-route-memory-2026-06-27.md` for the generated browser ASP1 route proof, then extend the same manifest and receipt shape toward LoRA-style modules and longer selector-route exercises.

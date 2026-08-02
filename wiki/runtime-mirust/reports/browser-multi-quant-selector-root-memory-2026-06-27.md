---
title: Browser Multi Quant Selector Root Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-multi-quant-selector-root-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:17:51Z
---

# Browser Multi Quant Selector Root Memory

## Summary

TinyRustLM generated browser bundles can now stage one runnable selector root containing the f32, q8_0, and q4_0 multi-parent sign-merge modules together. The shared `selector.registry` carries three admitted model entries, nine adapter routes, three adapter-family receipts, three assembly receipts, and the browser can switch between entries in the same served root before applying each receipt-preferred sparse `ASP1` sidecar.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now stages each quantized generated module through a shared helper, then writes one combined selector registry from all staged admission paths and route records.
- `browser-multi-parent-bundle <root> all` expands to f32, q8_0, and q4_0 while the existing single-quantization modes still produce one-entry roots.
- Each staged module keeps its own evidence directory, model file, manifest, assembly receipt, adapter-family receipt, self `ADP1`, family `ADP1`, sparse `ASP1`, and adapter manifests under the shared generated root.
- `tinyrustlm/tools/slm_pack/src/main.rs` CLI usage now documents the `all` mode.
- The browser app schema did not need a new field: existing selector entries, assembly receipt routes, adapter-family receipt routes, preferred adapter fields, and adapter manifest verification are reused by candidate id.

## Validation Memory

- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 3 filtered tests, including `writes_combined_browser_multi_parent_bundle`.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-multi-quant-selector\tinyrustlm all` staged one root with `admissions: 3`, `adapter_routes: 9`, `adapter_family_routes: 3`, and `assembly_routes: 3`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18677/app/ 9267 multi-parent-sign-merge-q4 adapter-sidecar-registry-file` passed from the combined root, selected adapter index `2`, applied `Multi-parent sign-merge q4_0 sparse ASP1`, and preserved `active_quantization_mode=q4_0`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18677/app/ 9268 multi-parent-sign-merge-q8 adapter-sidecar-registry-file` passed from the combined root, selected adapter index `2`, applied `Multi-parent sign-merge q8_0 sparse ASP1`, and preserved `active_quantization_mode=q8_0`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18677/app/ 9269 multi-parent-sign-merge-f32 adapter-sidecar-registry-file` passed from the combined root, selected adapter index `2`, applied `Multi-parent sign-merge f32 sparse ASP1`, and preserved `active_quantization_mode=f32`.
- `cargo test --workspace` passed with 238 checks across crates and doc-tests.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- Port `18677` had no listener after the smoke run, and the late-released temporary browser profile directories were removed from `%TEMP%`.

## Routing Notes

Use this report before changing generated multi-parent bundle staging, selector registry fan-in, browser selector entry switching, generated f32/q8_0/q4_0 adapter-family routing, or longer browser route exercises for modular self-assembly.

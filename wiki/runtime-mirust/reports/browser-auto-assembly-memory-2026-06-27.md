---
title: Browser Auto Assembly Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-auto-assembly-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T16:36:46Z
---

# Browser Auto Assembly Memory

## Summary

TinyRustLM generated selector registries now explicitly opt compatible adapter families into browser-local auto-assembly. Rust emits and validates `entry.N.adapter_auto_apply_status=enabled` and `entry.N.adapter_auto_apply_strategy=receipt-preferred-compatible`, and the browser auto-applies the receipt-preferred adapter only after model, manifest, assembly receipt, evidence files, adapter-family receipt, and adapter manifests verify.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` adds checksum-bound registry fields for adapter auto-apply status and strategy whenever an adapter-family receipt route is present.
- `validate-selector-registry` rejects missing or drifted adapter auto-apply fields, including strategy drift away from `receipt-preferred-compatible`.
- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` returns registry adapter-family routes with the auto-apply status and strategy used by generated bundles.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` asserts generated f32, q8_0, q4_0, and combined `all` selector roots carry the auto-apply fields.
- `tinyrustlm/app/app.js` requires those fields while parsing `selector.registry`; generated adapter-family entries become auto-apply candidates only after all browser receipt, evidence, and manifest checks pass.
- Auto assembly calls `apply_adapter_delta` with runtime status `Assembling modules`, records `model.autoAssemblyApplied`, resets generation diagnostics through the existing Rust adapter-apply path, and leaves manual Adapter Sidecar behavior unchanged for checked tiny fixtures.
- `tinyrustlm/tools/browser-smoke.js` treats `adapter-sidecar-registry-file` as auto-assembly proof: it waits for adapter state `applied` before generation, checks the pre-generation apply console entry and reset diagnostics, then generates one token from the assembled module.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all` passed.
- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack selector::` passed with 22 filtered tests, including adapter auto-apply strategy drift rejection.
- `cargo test -p tinyrustlm-slm-pack adapter_family::` passed with 3 filtered tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle::` passed with 3 filtered tests asserting auto-apply fields in generated registries.
- `browser-multi-parent-bundle .\target\browser-auto-assembly-contract\tinyrustlm all` generated a combined selector root whose f32, q8_0, and q4_0 entries all carried the auto-apply status and strategy.
- Served-root `adapter-sidecar-registry-file` smokes passed on `http://127.0.0.1:18682/app/` for `multi-parent-sign-merge-q4`, `multi-parent-sign-merge-q8`, and `multi-parent-sign-merge-f32`; each auto-applied the receipt-preferred sparse ASP1 before generation and then generated `e`.
- Normal-root `adapter-sidecar` smoke passed on `http://127.0.0.1:18683/app/` for `tinyq4`, preserving manual apply behavior.
- Normal-root intercepted `adapter-sidecar-registry-q8` smoke passed on `http://127.0.0.1:18683/app/` for `tinyq8`, preserving manual registry q8 ADP1 behavior.
- `cargo test --workspace` passed with 242 checks across crates and doc-tests.

## Routing Notes

Use this report before changing selector registry adapter auto-apply fields, browser generated adapter-family startup behavior, `adapter-sidecar-registry-file` smoke assertions, or the boundary between receipt-verified generated modules and manual checked Adapter Sidecar controls.

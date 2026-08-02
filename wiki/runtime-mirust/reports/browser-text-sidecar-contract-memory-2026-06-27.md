---
title: Browser Text Sidecar Contract Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-text-sidecar-contract-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T17:35:40Z
---

# Browser Text Sidecar Contract Memory

## Summary

TinyRustLM selector registries now declare the browser text-sidecar byte contract that the static app enforces before registry entries are accepted. Generated registries carry exact limits for selector registry text at 256 KiB, manifest text at 64 KiB, receipt text at 128 KiB, and evidence text at 128 KiB. Rust emits and validates those fields; `app.js` accepts selector registries only when every declared text budget matches the local browser envelope.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes `selector_registry_text_byte_budget=262144`, `manifest_text_byte_budget=65536`, `receipt_text_byte_budget=131072`, and `evidence_text_byte_budget=131072` next to `selector_model_byte_budget=33554432`.
- Selector registry validation now recomputes those text-budget contract fields and reports drift by field name.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` checks generated f32, q8_0, q4_0, and combined roots for the text-budget contract fields.
- `tinyrustlm/app/app.js` requires exact text-budget matches before accepting a registry option list, so drift leaves the static fallback models available and blocks the drifted route before model fetch.
- `tinyrustlm/tools/browser-smoke.js` adds `sidecar-budget-contract`, which serves a registry with a mismatched manifest text budget and verifies the browser falls back to `tinylm16q8` without requesting the drifted parent model.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check` passed.
- `cargo test -p tinyrustlm-slm-pack selector::` passed with 24 tests, including text-budget drift coverage.
- `cargo test -p tinyrustlm-slm-pack browser_bundle::` passed with 3 tests.
- `browser-multi-parent-bundle target/browser-sidecar-contract-budget/tinyrustlm all` generated a combined f32/q8_0/q4_0 selector root with the contract fields.
- Served-root `adapter-sidecar-registry-file` smoke passed on `http://127.0.0.1:18690/app/` for `multi-parent-sign-merge-q4`; it loaded the q4 generated model, verified assembly evidence, auto-applied the receipt-preferred sparse ASP1, and generated `e`.
- Static-root `sidecar-budget-contract` smoke passed on `http://127.0.0.1:18691/app/`; the drifted registry was not accepted, `/models/sidecar-budget-contract-parent.slm` was not requested, and fallback `tinylm16q8` generated `e`.
- Regression smokes passed for `selector-budget`, `multi-parent-registry`, and `adapter-sidecar-registry-q8`.
- `cargo test --workspace` passed with 244 checks across runtime, packer, browser harness, local server, and doc-tests.

## Routing Notes

Use this report before changing selector registry headers, text-sidecar budget constants, browser registry intake, generated browser bundle registry output, or smoke fixtures that prove budget drift leaves static fallback routing intact before model bytes are fetched.

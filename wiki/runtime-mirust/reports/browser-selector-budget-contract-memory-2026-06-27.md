---
title: Browser Selector Budget Contract Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-budget-contract-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T16:08:47Z
---

# Browser Selector Budget Contract Memory

## Summary

TinyRustLM selector registries now carry a registry-level browser model-byte budget. Rust emits and validates `selector_model_byte_budget=33554432`, rejects admitted model entries above that budget, and the browser requires the registry budget before accepting selector entries.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` now writes `selector_model_byte_budget=33554432` into every selector registry.
- `validate-selector-registry` recomputes the budget line and rejects drift.
- Selector registry construction rejects `candidate_artifact_bytes` values that are zero, non-decimal, or above the 32 MiB browser budget before writing an entry.
- `tinyrustlm/app/app.js` now requires `selector_model_byte_budget`, rejects registries whose declared budget exceeds the browser constant, and checks each `entry.N.model_bytes` against the registry budget before model fetch.
- `tinyrustlm/tools/browser-smoke.js` adds the budget line to intercepted selector registry fixtures, including `selector-budget`, `multi-parent-registry`, and q8 adapter-sidecar registry smoke.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now asserts generated single-quant and combined roots carry the budget line.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack selector::` passed with 21 filtered tests, including over-budget model-byte rejection and registry budget drift rejection.
- `cargo test -p tinyrustlm-slm-pack browser_bundle::` passed with 3 filtered tests asserting budget metadata in generated registries.
- `browser-smoke multi-parent-registry` passed against `http://127.0.0.1:18680/app/` with the intercepted budget-bearing registry.
- `browser-smoke selector-budget` passed against `http://127.0.0.1:18680/app/`, proving an oversized entry remained unaccepted and unfetched while fallback `tinylm16q8` loaded.
- `browser-multi-parent-bundle .\target\browser-selector-budget-contract\tinyrustlm all` generated a three-entry selector root whose registry declared `selector_model_byte_budget=33554432` and model byte counts `20352`, `8832`, and `6592`.
- Served-root `adapter-sidecar-registry-file` smoke passed on `http://127.0.0.1:18681/app/` for `multi-parent-sign-merge-q4`, proving the generated budget-bearing registry still defaulted to q4_0, loaded assembly evidence, selected sparse ASP1, and applied the adapter.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 8 checks.
- `cargo test --workspace` passed with 241 checks across crates and doc-tests.
- `git diff --check` completed with line-ending normalization notices only.
- Ports `18680` and `18681` had no listeners after the smoke run, and matching temporary browser smoke profiles under `%TEMP%` were removed.

## Routing Notes

Use this report before changing `selector_model_byte_budget`, selector registry model-byte validation, generated browser bundle registry fields, browser selector intake, or browser smokes that intercept selector registry text.

---
title: Browser Frugal Selector Default Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-frugal-selector-default-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:37:28Z
---

# Browser Frugal Selector Default Memory

## Summary

TinyRustLM selector registries now carry a typed default-model signal for constrained browser roots. The generated registry marks `browser-frugal-quantized` as the selector default strategy and chooses the lowest ranked supported quantization, so a combined f32/q8_0/q4_0 generated root starts on q4_0 before any model bytes are loaded.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes `selector_default_strategy`, `selector_default_candidate_id`, and `selector_default_quantization` into every generated selector registry, ranking `q4_0` before `q8_0` before `f32`.
- `tinyrustlm/app/app.js` parses and validates those registry-level default fields, rejects inconsistent default metadata, and uses the default key when there is no already-valid selected model.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` verifies that `browser-multi-parent-bundle all` writes `multi-parent-sign-merge-q4` as the combined-root default.
- `tinyrustlm/tools/browser-smoke.js` records the initial selected model for generated combined roots and requires it to be `multi-parent-sign-merge-q4` before scripted switching.

## Validation Memory

- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 23 filtered tests, including the mixed f32/q8_0/q4_0 default test.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 3 filtered tests, including the combined-root default assertion.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-frugal-selector-default\tinyrustlm all` staged one root whose selector registry had `entry_count=3`, `selector_default_strategy=browser-frugal-quantized`, `selector_default_candidate_id=multi-parent-sign-merge-q4`, and `selector_default_quantization=q4_0`.
- Served-root `adapter-sidecar-registry-file` smokes on `http://127.0.0.1:18678/app/` passed for `multi-parent-sign-merge-q4`, `multi-parent-sign-merge-q8`, and `multi-parent-sign-merge-f32`; each observed initial selected model `multi-parent-sign-merge-q4`, selected sparse `ASP1` adapter index `2`, and preserved the active quantization after apply.
- `cargo test --workspace` passed with 239 checks across crates and doc-tests.
- `git diff --check` completed with line-ending normalization notices only.
- Port `18678` had no listener after the smoke run, and matching temporary browser smoke profiles under `%TEMP%` were removed.

## Routing Notes

Use this report before changing selector registry default fields, combined generated selector roots, browser model-select defaulting, or browser smoke assertions that prove a constrained root starts on q4_0.

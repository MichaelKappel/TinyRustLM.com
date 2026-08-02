---
title: Browser Auto Assembly Budget Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-auto-assembly-budget-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T17:00:03Z
---

# Browser Auto Assembly Budget Memory

## Summary

TinyRustLM generated adapter-family routes now carry an explicit browser-local byte envelope for auto-assembled modules. Rust emits and validates `entry.N.adapter_auto_apply_byte_budget=1048576`; the browser requires that registry field, checks each generated adapter manifest's `adapter_artifact_bytes`, and confirms fetched adapter bytes match the manifest before copying any auto-assembled module into WASM.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` adds `ADAPTER_AUTO_APPLY_BYTE_BUDGET`, writes `entry.N.adapter_auto_apply_byte_budget`, parses it back from selector registries, and rejects budget values above the local envelope.
- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` returns generated adapter-family registry routes with the 1 MiB auto-apply byte budget.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` asserts f32, q8_0, q4_0, and combined `all` generated selector roots carry the budget line.
- `tinyrustlm/app/app.js` requires `adapter_auto_apply_byte_budget` when parsing adapter-family registry entries and caps it against the browser constant.
- Browser adapter-family verification now parses `adapter_artifact_bytes` from served `.adp1.manifest` and `.asp1.manifest` files; the receipt-preferred auto-applied artifact must fit the registry budget before auto assembly is enabled.
- `applySelectedAdapter("auto")` checks the fetched artifact byte length against the verified manifest and the family budget before WASM transfer; manual checked Adapter Sidecar routes remain available without adapter-family manifests.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all` passed.
- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack selector::` passed with 23 filtered tests, including adapter auto-apply byte-budget drift rejection.
- `cargo test -p tinyrustlm-slm-pack adapter_family::` passed with 3 filtered tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle::` passed with 3 filtered tests asserting generated registry budget fields.
- `browser-multi-parent-bundle target/browser-auto-assembly-budget/tinyrustlm all` generated a combined selector root whose f32, q8_0, and q4_0 entries each carried `entry.N.adapter_auto_apply_byte_budget=1048576`.
- Generated adapter manifests declared `adapter_artifact_bytes=832` for the receipt-preferred sparse ASP1 artifacts and `adapter_artifact_bytes=20224` for ADP1 artifacts, all below the 1 MiB auto-apply envelope.
- Served-root `adapter-sidecar-registry-file` smokes passed on `http://127.0.0.1:18684/app/` for `multi-parent-sign-merge-q4`, `multi-parent-sign-merge-q8`, and `multi-parent-sign-merge-f32`; each auto-applied the receipt-preferred sparse ASP1 before generation and then generated `e`.
- Normal-root `adapter-sidecar` smoke passed on `http://127.0.0.1:18685/app/` for `tinyq4`, preserving manual checked sidecar behavior.
- `cargo test --workspace` passed with 243 checks across crates and doc-tests.
- `git diff --check` exited cleanly with line-ending normalization notices only.

## Routing Notes

Use this report before changing `adapter_auto_apply_byte_budget`, browser adapter manifest byte-count checks, auto-assembly pre-WASM transfer checks, generated bundle adapter-family registry fields, or the boundary between constrained auto assembly and manual checked Adapter Sidecar controls.

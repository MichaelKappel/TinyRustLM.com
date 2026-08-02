---
title: Browser Preferred Adapter Route Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-preferred-adapter-route-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:01:33Z
---

# Browser Preferred Adapter Route Memory

## Summary

TinyRustLM generated adapter-family receipts now declare a preferred local adapter member. The packer derives the preferred member from the generated family, favoring the sparse `ASP1` route when present, records the preferred adapter index, adapter path, and manifest path in the checksum-bound receipt, and validates the recomputed receipt. The browser verifies those receipt fields after fetching the adapter-family receipt and all member manifests, then defaults the Adapter Sidecar selector to the verified preferred member before apply.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` writes `adapter_family_preferred_adapter_index`, `adapter_family_preferred_adapter_path`, and `adapter_family_preferred_manifest_path` into the deterministic adapter-family receipt. The preferred member is the first `.asp1` route when present; otherwise it is the first compatible member.
- `tinyrustlm/app/app.js` validates the preferred adapter index, route, and manifest path against the already parsed registry adapter list before enabling family options, then selects that member in the Adapter Sidecar dropdown after receipt and manifest verification.
- `tinyrustlm/tools/browser-smoke.js` no longer hand-selects the generated sparse member. It observes the app-selected value before clicking Apply, so `selectedAdapterBeforeApply=2` proves the browser consumed the verified receipt preference.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` tests now assert that f32/q8_0/q4_0 generated bundle receipts prefer the sparse `ASP1` member.

## Validation Memory

- `node --check tinyrustlm/app/app.js`, `node --check tinyrustlm/tools/browser-smoke.js`, and `node --check tinyrustlm/tools/wasm-abi-smoke.js` passed.
- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `cargo test -p tinyrustlm-slm-pack adapter_family` passed with 6 filtered tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed with 2 filtered tests.
- `cargo test --workspace` passed with 237 checks across crates and doc-tests.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-preferred-adapter-route\tinyrustlm f32` staged a generated f32 root whose receipt prefers `../models/multi-parent-sign-merge-f32-sparse.asp1`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18675/app/ 9265 multi-parent-sign-merge-f32 adapter-sidecar-registry-file` passed with `selectedAdapterBeforeApply` equal to `2`, applying `Multi-parent sign-merge f32 sparse ASP1`.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-preferred-adapter-route-q8\tinyrustlm q8_0` staged a generated q8_0 root whose receipt prefers `../models/multi-parent-sign-merge-q8-sparse.asp1`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18676/app/ 9266 multi-parent-sign-merge-q8 adapter-sidecar-registry-file` passed with `selectedAdapterBeforeApply` equal to `2`, applying `Multi-parent sign-merge q8_0 sparse ASP1` and preserving `active_quantization_mode=q8_0`.

## Routing Notes

Use this report before changing adapter-family receipt fields, generated bundle adapter ordering, browser Adapter Sidecar default selection, or `adapter-sidecar-registry-file` selection assertions. This is the first browser-consumed preferred-module signal for the modular self-assembly lane.

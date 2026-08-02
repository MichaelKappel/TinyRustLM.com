---
title: Browser Module Plan Route Set Algorithm Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-route-set-algorithm-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T05:02:39Z
---

# Browser Module Plan Route Set Algorithm Memory

TinyRustLM generated module plans now bind the route-list checksum recipe with `module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1` before accepting generated model bytes.

## What Changed

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, and validates `module_plan_route_set_checksum_algorithm`; selector validation rejects missing or drifted algorithm labels before trusting `module_plan_route_set_checksum`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` emits `module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1` into generated selector registry entries and served `.module-plan.receipt` files, and includes `route_set_checksum_algorithm=tinyrustlm-text-checksum-v1` in the route-set checksum preimage.
- `tinyrustlm/app/app.js` requires selector, receipt, and constant agreement, uses the shared algorithm constant in browser checksum recomputation, and renders `Route Hash` from verified module-plan receipt fields.
- `tinyrustlm/app/index.html`, `tinyrustlm/tools/browser_harness/src/main.rs`, and `tinyrustlm/tools/browser-smoke.js` cover the new row, source fallback, generated q4_0/q8_0/f32 positive display, and `module-plan-route-set-algorithm-drift`.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml route_set -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml browser_bundle::tests:: -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml writes_and_validates_selector_registry_with_module_plan_receipt -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-route-set-algorithm\tinyrustlm all`
- Generated `module-plan-route-set-algorithm-drift` on `http://127.0.0.1:8262/app/`, stopping at `Module plan route set checksum algorithm mismatch` after selector registry plus module-plan receipt fetch.
- Generated `combined-selector-assembly` on `http://127.0.0.1:8262/app/`, proving q4_0, q8_0, and f32 render Route Hash `tinyrustlm-text-checksum-v1`, Route Version `1`, Route Set checksums, verified receipts, declared route fetches, ADP1/ASP1/ALR1 apply, and one local token.
- Source `ui-audit` on `http://127.0.0.1:8263/app/` proved source roots render Route Hash, Route Version, and Route Set as `unavailable`.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` passed with 232 tests.
- Temporary generated root and local loopback servers were cleaned up.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is focused Rust parameter and drift tests, the full slm_pack suite, static harness checks, generated browser drift smoke, normal combined assembly smoke, and source UI audit.

## Current Generated Module-Plan Values

- Route Hash: q4_0, q8_0, and f32 `tinyrustlm-text-checksum-v1`; source roots `unavailable`.
- Route Version: q4_0, q8_0, and f32 `1`; source roots `unavailable`.
- Route Set checksums: q4_0 `0xe7d8c862dec256cb`, q8_0 `0xc6215c5348cef337`, f32 `0x5317f0a7a894574c`.
- Total budgets: q4_0 `173417 bytes`, q8_0 `175657 bytes`, f32 `187191 bytes`.
- q4_0 byte counts: `0: 6592 bytes, 1: 594 bytes, 2: 1896 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes`.
- q8_0 byte counts: `0: 8832 bytes, 1: 594 bytes, 2: 1896 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes`.
- f32 byte counts: `0: 20352 bytes, 1: 595 bytes, 2: 1909 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes`.
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0xe0c893f895647ac4, 2: 0xd439438523a9d9d0, 3: 0xffdc3d42fbaadcd3, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`.
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0x6e8937606e8b4302, 2: 0x694e3792b24c50d6, 3: 0x52e3d3293940234c, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9`.
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0xc1b16a606f675f73, 2: 0x718ef606fc242734, 3: 0x71620ee975d2fc43, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5`.

## Routing

Open this report before changing `module_plan_route_set_checksum_algorithm`, route-set checksum algorithm labels, route-set checksum preimage fields, Route Hash display, generated module-plan receipt algorithm fields, or `module-plan-route-set-algorithm-drift` smoke assertions.

---
title: Browser Module Plan Route Set Version Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-route-set-version-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T04:38:15Z
---

# Browser Module Plan Route Set Version Memory

TinyRustLM generated module plans now bind the route-list recipe with `module_plan_route_set_version=1` before the route-set checksum is accepted.

## What Changed

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, and validates `module_plan_route_set_version`; selector validation rejects missing or drifted route-set versions before trusting `module_plan_route_set_checksum`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` emits `module_plan_route_set_version=1` into generated selector registry entries and served `.module-plan.receipt` files, and uses the shared version constant in the route-list checksum preimage.
- `tinyrustlm/app/app.js` requires selector, receipt, and constant agreement, uses the shared version constant in browser checksum recomputation, and renders `Route Version` from verified module-plan receipt fields.
- `tinyrustlm/app/index.html`, `tinyrustlm/tools/browser_harness/src/main.rs`, and `tinyrustlm/tools/browser-smoke.js` cover the new row, source fallback, generated q4_0/q8_0/f32 positive display, and `module-plan-route-set-version-drift`.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml route_set -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml browser_bundle::tests:: -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml writes_and_validates_selector_registry_with_module_plan_receipt -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\module-plan-route-set-version\tinyrustlm all`
- Generated `module-plan-route-set-version-drift` on `http://127.0.0.1:8260/app/`, stopping at `Module plan route set version mismatch` after selector registry plus module-plan receipt fetch.
- Generated `combined-selector-assembly` on `http://127.0.0.1:8260/app/`, proving q4_0, q8_0, and f32 render Route Version `1`, Route Set checksums, verified receipts, declared route fetches, ADP1/ASP1/ALR1 apply, and one local token.
- Source `ui-audit` on `http://127.0.0.1:8261/app/` proved source roots render Route Version and Route Set as `unavailable`.
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml` passed with 230 tests.
- Temporary generated root and local loopback servers were cleaned up.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is focused Rust parameter and drift tests, the full slm_pack suite, static harness checks, generated browser drift smoke, normal combined assembly smoke, and source UI audit.

## Current Generated Module-Plan Values

- Route Version: q4_0, q8_0, and f32 `1`; source roots `unavailable`.
- Route Set checksums: q4_0 `0x8a907a6db005b5c9`, q8_0 `0x424e40e4dd3d7f13`, f32 `0xd809fc21c74f8251`.
- Total budgets: q4_0 `173415 bytes`, q8_0 `175655 bytes`, f32 `187189 bytes`.
- q4_0 byte counts: `0: 6592 bytes, 1: 592 bytes, 2: 1896 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes`.
- q8_0 byte counts: `0: 8832 bytes, 1: 592 bytes, 2: 1896 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes`.
- f32 byte counts: `0: 20352 bytes, 1: 593 bytes, 2: 1909 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes`.
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0x9f35c3048cb29e35, 2: 0xc75023a04ebf9452, 3: 0x748f22ff0a3d77c8, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`.
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0x37bf7e42d4022b0d, 2: 0x94d589d542466103, 3: 0x3046e8d87d288ec7, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9`.
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0x9d91a60e269e660e, 2: 0x09c6bd3c09db46e6, 3: 0xbadf8b67e26343d7, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5`.

## Routing

Open this report before changing `module_plan_route_set_version`, route-set checksum preimage versioning, Route Version display, generated module-plan receipt version fields, or `module-plan-route-set-version-drift` smoke assertions.

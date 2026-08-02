---
title: Browser Module Plan Adapter Validation Count Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-adapter-validation-count-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T02:53:13Z
---

# Browser Module Plan Adapter Validation Count Memory

TinyRustLM generated module plans now bind adapter validation cardinality with `module_plan_adapter_validation_count=3` beside `module_plan_adapter_validation_strategy=rust-validate-before-apply-v1` and `module_plan_adapter_apply_count=3`.

## What Changed

- `tinyrustlm/tools/slm_pack/src/selector.rs` writes, parses, validates, and checksums `module_plan_adapter_validation_count`; selector validation requires the count to be positive, within module count, and equal to the planned apply count.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` emits the count into generated selector registry entries and `.module-plan.receipt` files for q4_0, q8_0, and f32 generated roots.
- `tinyrustlm/app/app.js` requires selector, receipt, adapter-family, and expected constant agreement before generated model bytes are accepted, renders `Validate Count`, and checks the actual Rust validation loop count before adapter application.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-adapter-validation-count-drift`, positive generated-root assertions for `Validate Count 3`, source-root fallback assertions, and exact per-step validation-delta checks for combined generated assemblies.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml module_plan_adapter -- --nocapture`
- `cargo test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml browser_bundle::tests:: -- --nocapture`
- `cargo test --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml`
- `cargo test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- Generated `target/module-plan-adapter-validation-count/tinyrustlm all`.
- Served generated root on `http://127.0.0.1:8254/app/`.
- `module-plan-adapter-validation-count-drift` stopped at `Module plan adapter validation count mismatch` after selector registry plus module-plan receipt fetch.
- `combined-selector-assembly` proved q4_0, q8_0, and f32 render `Validate Count 3`, run exactly three `validate_adapter_delta` calls per generated assembly step, apply three adapters, and generate one local token.
- Source `ui-audit` on `http://127.0.0.1:8255/app/` proved source roots render the validation-count row as `unavailable`.

## Current Generated Module-Plan Values

- Total budgets: q4_0 `173422 bytes`, q8_0 `175662 bytes`, f32 `187196 bytes`.
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0xbda29682e8a42104, 2: 0xe6a285ad92365df6, 3: 0x3c400205a8a0afa6, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`.
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0xf52fd0b0ec77c9fa, 2: 0x64d2170d074b3bae, 3: 0x3548cb7b1f378d9f, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9`.
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0x49ce8042500c7d7c, 2: 0x85f5554a9995f494, 3: 0x492df944fbed530f, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5`.

## Routing

Open this report before changing generated adapter validation cardinality, Module Plan `Validate Count` display, selector/receipt adapter validation-count fields, or `module-plan-adapter-validation-count-drift` smoke assertions.

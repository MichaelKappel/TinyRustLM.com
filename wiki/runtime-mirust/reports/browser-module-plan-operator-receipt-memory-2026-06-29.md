---
title: Browser Module Plan Operator Receipt Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-operator-receipt-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T10:45:00Z
---

# Browser Module Plan Operator Receipt Memory

TinyRustLM generated module plans now carry the sign-merge operator receipt route and checksum beside the assembly route set, so the browser can bind selector registry, module-plan receipt, assembly receipt, and evidence-file identity before generated model bytes are trusted.

## What Changed

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes `operator_receipt_path` and `operator_receipt_checksum` into each generated `.module-plan.receipt`, mirrors them as `entry.N.module_plan_operator_receipt_*` selector fields, and tests the values against the generated `sign-merge.operator` checksum.
- `tinyrustlm/tools/slm_pack/src/selector.rs` parses and validates the module-plan operator receipt fields, requires the canonical `../evidence/{candidate_id}/sign-merge.operator` route, requires a hex64 checksum, and rejects selector/module-plan checksum drift against admitted operator receipt identity.
- `tinyrustlm/app/app.js` validates registry module-plan operator fields, verifies served `.module-plan.receipt` agreement, and checks generated assembly receipts agree with the same operator receipt route/checksum before evidence files or adapter-family routes proceed.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-operator-receipt-drift`, refreshes generated module-plan byte/checksum constants, proves checksum-consistent receipt drift stops after selector registry plus module-plan receipt, and lets fresh combined generated roots prove module-plan summary shape without pinning regenerated receipt checksums.

## Browser Contract

The generated q4_0, q8_0, and f32 bundle roots now require this identity chain:

1. selector registry `entry.N.module_plan_operator_receipt_path`
2. selector registry `entry.N.module_plan_operator_receipt_checksum`
3. served `.module-plan.receipt` `operator_receipt_path`
4. served `.module-plan.receipt` `operator_receipt_checksum`
5. generated `.assembly.receipt` `operator_receipt_path`
6. generated `.assembly.receipt` `operator_receipt_checksum`
7. fetched `../evidence/{candidate_id}/sign-merge.operator` body checksum

The fields bind the module-plan envelope to the already receipt-bound sign-merge operator lane without adding any network or third-party dependency.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml module_plan_operator -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml selector::tests:: -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml browser_bundle::tests:: -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test --manifest-path tinyrustlm/tools/slm_pack/Cargo.toml`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace`
- `C:\Users\AI\.cargo\bin\cargo.exe run --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml -- tinyrustlm`
- Generated `target/module-plan-operator-receipt-drift-20260629/tinyrustlm all`.
- Served generated root on `http://127.0.0.1:18731/app/`.
- `module-plan-operator-receipt-drift` for `multi-parent-sign-merge-q4` stopped at `module plan operator receipt checksum mismatch` after requesting only app shell, runtime manifest/WASM, selector registry, and the q4 module-plan receipt.
- Served generated root on `http://127.0.0.1:18734/app/`.
- `adapter-sidecar-registry-file` for `multi-parent-sign-merge-q4` loaded the module plan, verified assembly evidence including `sign-merge.operator`, fetched adapter-family and stack manifests, validated three stack artifacts in Rust, applied all three, and generated `e`.
- Generated fresh root `target/combined-selector-assembly-refresh-20260629/tinyrustlm all`.
- Served fresh generated root on `http://127.0.0.1:18751/app/`.
- `combined-selector-assembly` proved q4_0 default selection, q4_0/q8_0/f32 same-page switching, module-plan-before-model fetch ordering, operator receipt agreement, ADP1 plus ASP1 plus ALR1 stack validation/application, `adapter_apply_count=3`, and generated response `e` for every entry.
- `git diff --check`

## Current Generated Module-Plan Values

- Operator receipt checksums: q4_0 `0x1b388cfa4d204a83`, q8_0 `0xbc40437e9d767cf0`, f32 `0x921cb1168ec2821e`.
- Total budgets after operator receipt binding: q4_0 `173429 bytes`, q8_0 `175669 bytes`, f32 `187203 bytes`.
- q4_0 checksums: `0: 0x1a6808e3098d1ce0, 1: 0x329cad8f407f1193, 2: 0x61c5be47683f6978, 3: 0xc09d91cb22b9e098, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`.
- q8_0 checksums: `0: 0x0132bc82d5a0d7d6, 1: 0x236fd027242c32af, 2: 0x5a2e2f77c75e1b1a, 3: 0xb3f1a7cdbb4fb1a9, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9`.
- f32 checksums: `0: 0x8a0e6c4c01998199, 1: 0xf4f55c7e082a43a0, 2: 0x9f72fd36ac75d0b5, 3: 0xb7e3756e8c25004e, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5`.

## Routing

Open this report before changing generated module-plan operator receipt fields, selector `module_plan_operator_receipt_*` validation, assembly receipt/operator receipt agreement, or `module-plan-operator-receipt-drift` browser smoke assertions.

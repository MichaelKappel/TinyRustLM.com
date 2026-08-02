---
title: DARE Browser Operator Provenance Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/dare-browser-operator-provenance-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T18:46:12Z
---

# DARE Browser Operator Provenance Memory

TinyRustLM now routes DARE operator receipt metadata into the compact browser selector provenance path.

## What Changed

- `tinyrustlm/tools/browser-smoke.js` adds `dare-operator-registry` and `dare-operator-receipt-drift` modes.
- The DARE fixture registers `tinylm16-dare-q8` as a q8_0 selector entry backed by the local `tinylm16-q8.slm` route.
- The selector entry carries `entry.0.operator_receipt_*` fields with `operator_receipt_operator_kind=dropout-rescaled-task-delta`.
- The browser Model Provenance Operator row renders `receipt-bound / dropout-rescaled-task-delta / 0x00000000000000b7` for the positive DARE fixture.
- The DARE receipt drift mode changes the receipt-declared candidate byte count, rejects the selector entry, falls back to static q8, and renders Operator as `unavailable`.
- `tinyrustlm/tools/slm_pack/src/selector.rs` now has DARE-specific selector registry tests for receipt kind carry-forward and operator-kind drift rejection.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector_registry_from_dare -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector_registry_dare -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack --quiet`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace --quiet`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9272 tinylm16-dare-q8 dare-operator-registry`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9273 tinylm16q8 dare-operator-receipt-drift`
- Long-term checksum audit, report/research pointer audit, and summary-length audit all passed after routing updates.

## Routing

Open this report before changing DARE compact selector fixtures, browser Model Provenance Operator rendering for DARE, DARE selector receipt byte echo, or DARE operator receipt drift smoke behavior.

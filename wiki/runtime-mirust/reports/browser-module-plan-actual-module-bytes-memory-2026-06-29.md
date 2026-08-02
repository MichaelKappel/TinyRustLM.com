---
title: Browser Module Plan Actual Module Bytes Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-actual-module-bytes-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T11:40:00Z
---

# Browser Module Plan Actual Module Bytes Memory

TinyRustLM generated self-assembly now has browser-observed module-byte accounting. The browser records the accepted byte length for each module-plan module as that module is fetched, renders `Actual Module Bytes`, and only marks generated entries ready when the observed total equals the receipt-declared module byte total.

## What Changed

- `tinyrustlm/app/index.html` adds the Module Plan `Actual Module Bytes` row.
- `tinyrustlm/app/app.js` resets module-byte accounting on generated model load, records actual model, manifest, receipt, and auto-stack artifact bytes by module index, rejects duplicate or missing module indexes, and requires observed module bytes to match the verified receipt before generated Ready.
- `tinyrustlm/tools/browser-smoke.js` captures `modulePlanActualModuleBytes` in generated and source snapshots, derives the expected total from the rendered Module Plan byte summary, and keeps source-root fallback at `unavailable`.

## Browser Contract

The observed module-byte total covers the seven module-plan modules:

- generated `.slm` model bytes
- generated `.slm.manifest` text bytes
- generated `.assembly.receipt` text bytes
- generated `.adapter-family.receipt` text bytes
- family ADP1 stack artifact bytes
- sparse ASP1 stack artifact bytes
- source-backed ALR1 stack artifact bytes

The module byte total is intentionally narrower than `module_plan_total_byte_budget`; prompt, scratch, output, KV, and total-envelope budgets remain separate Module Plan rows.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo run --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml -- tinyrustlm`
- Existing generated root `target/module-plan-actual-module-bytes-20260629/tinyrustlm all` served on `http://127.0.0.1:18764/app/`.
- Generated `combined-selector-assembly` proved q4_0, q8_0, and f32 all reached `Ready`, generated response `e`, applied the three-adapter stack, displayed `Actual Fetches 21 fetches`, matched Actual Route Set to Route Set, and displayed actual module-byte totals equal to the rendered module byte summaries:
  - q4_0 `37234 bytes`
  - q8_0 `39474 bytes`
  - f32 `51008 bytes`
- Source `ui-audit` on `http://127.0.0.1:18765/app/` proved desktop and mobile fallback snapshots keep `Actual Module Bytes`, `Actual Fetches`, and `Actual Route Set` at `unavailable`.

## Routing

Open this report before changing generated module byte accounting, `recordModulePlanActualModuleBytes`, Module Plan `Actual Module Bytes` display, stack artifact byte recording, or browser-smoke assertions that compare fetched module bytes to receipt-declared module byte rows.

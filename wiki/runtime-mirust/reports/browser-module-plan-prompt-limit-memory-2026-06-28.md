---
title: Browser Module Plan Prompt Limit Memory 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-prompt-limit-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T23:59:00Z
---

# Browser Module Plan Prompt Limit Memory

This record routes the browser module-plan prompt byte envelope added on 2026-06-28.

## Implementation Summary

- Generated selector registry entries now carry `entry.N.module_plan_prompt_byte_limit=4096`.
- Served `.module-plan.receipt` files now carry `module_plan_prompt_byte_limit=4096`.
- Rust selector validation requires selector and receipt agreement before generated `.slm` bytes are fetched.
- Browser receipt validation requires the same value, renders `Prompt Limit` in the Module Plan panel, and includes the limit in total budget math.
- The source app rejects prompt payloads above 4096 UTF-8 bytes before copying prompt bytes into WASM, leaving the loaded model recoverable.

## Current Budget Values

- Prompt byte limit: `4096 bytes`.
- Total byte budget limit: `43454464 bytes`.
- Generated q4_0 total budget: `173416 bytes`.
- Generated q8_0 total budget: `175656 bytes`.
- Generated f32 total budget: `187190 bytes`.

## Verification

- `combined-selector-assembly` on the generated all-root proved q4_0, q8_0, and f32 render `Prompt Limit` as `4096 bytes` and carry the updated totals before generation.
- `module-plan-prompt-limit-drift` proved checksum-consistent prompt-limit drift stops after selector plus module-plan receipt fetch, before generated model, assembly evidence, adapter-family, manifest, or stack artifact routes.
- Source-root `ui-audit` proved non-generated roots keep Module Plan prompt limit fallback as `unavailable`.
- Source-root `prompt-limit` submitted a 4097-byte prompt and proved the browser reports `prompt byte limit exceeded`, keeps prompt/generated diagnostics at zero, and leaves Generate, Reset, and model selection usable.

## Routing Rule

Open this page before changing prompt transfer limits, generated module-plan total-budget math, selector registry prompt fields, Module Plan prompt display, or browser prompt-copy behavior.

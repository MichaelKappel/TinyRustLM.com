---
title: Browser Combined Selector Cycle Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-combined-selector-cycle-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T09:10:00Z
---

# Browser Combined Selector Cycle Memory

## Summary

TinyRustLM now has a same-page generated-root browser smoke that cycles a combined q4_0/q8_0/f32 selector route twice. The proof keeps one served `browser-multi-parent-bundle all` root active, starts from the q4_0 default, walks q4_0, q8_0, f32, q4_0, q8_0, f32, and requires each pass to re-enter the generated module-plan, assembly, adapter-family, ADP1/ASP1/ALR1 validation, stack apply, reset-diagnostics, and one-token generation path. The browser also releases the previously loaded WASM model with `free_model` before each post-initial selector switch starts the next generated assembly.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `combined-selector-cycle`.
- `tinyrustlm/app/app.js` calls `free_model` when a loaded model is replaced by a selector switch, records the release in the local console, and then fetches the next generated module plan and model.
- The existing combined selector runner now accepts a cycle count while preserving the original one-pass `combined-selector-assembly` behavior.
- Each step records cycle index, pass index, console text before selection, console text before generation, and per-step console deltas.
- The cycle assertion requires every step to report at least three new `validate_adapter_delta` calls, three new `apply_adapter_delta` calls, and one new `adapter_stack_applied(3)` before generation.
- The cycle assertion now requires zero `free_model` calls for the initial q4_0 pass, exactly one `free_model` call before each later q8_0/f32/q4_0/q8_0/f32 assembly, and that release must appear before the next stack validation in the per-step console delta.
- Cycle mode keeps module-plan route, model route, role, slot, phase, dependency, trace, assembly, evidence, adapter-family, manifest, and stack route checks strict while allowing fresh generated target paths to produce different manifest/evidence byte and checksum summaries.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/combined-selector-release/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18757/app/ 19628 multi-parent-sign-merge-q4 combined-selector-cycle 2`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18759/app/ 19630 multi-parent-sign-merge-q4 combined-selector-assembly`

The cycle smoke produced six steps in one browser page. Every step had reset diagnostics before generation, `active_quantization_mode` matching the selected q4_0/q8_0/f32 entry, three Rust validation calls, three Rust apply calls, one stack completion, a ready Module Plan Trace, and a deterministic `e` generation. The initial q4_0 pass had no release call because it used the page's initial loaded model; every later pass had one `free_model(previous -> next) -> 0` plus `model freed` before the next validation call. The original one-pass combined selector smoke still passed on the established exact-summary baseline root.

## Routing

Load this report when work touches `combined-selector-cycle`, longer same-page generated selector exercises, repeated q4_0/q8_0/f32 model switching, release-before-reassembly behavior, repeated generated stack validation/apply proof, or fresh generated-root path-flexible Module Plan summary assertions.

Related routes:

- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-assembly-trace-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-adapter-stack-rust-validate-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

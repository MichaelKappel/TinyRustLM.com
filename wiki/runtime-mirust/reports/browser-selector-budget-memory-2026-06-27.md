---
title: Browser Selector Budget Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-selector-budget-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:54:11Z
---

# Browser Selector Budget Memory

## Summary

TinyRustLM browser selector intake now treats `entry.N.model_bytes` as a browser-local resource budget before selecting registry models. Registry entries must declare a positive decimal byte count no larger than 32 MiB, and fetched model bytes must match the declared count before the buffer is copied into WASM.

## Implementation Memory

- `tinyrustlm/app/app.js` rejects selector registry entries that omit `entry.N.model_bytes`, use a non-decimal or unsafe integer byte value, declare zero bytes, or exceed the 32 MiB browser selector budget.
- `tinyrustlm/app/app.js` keeps static fallback models available when a selector registry is rejected, so local TinyLM fixtures still load without registry metadata.
- `tinyrustlm/app/app.js` checks a registry-selected model's fetched byte length against the declared `model_bytes` value before transferring bytes to the Rust runtime.
- `tinyrustlm/tools/browser-smoke.js` adds `selector-budget` mode with an intercepted registry entry declaring `33554433` bytes for an oversized q4_0 parent.

## Validation Memory

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all -- --check` passed through `C:\Users\AI\.cargo\bin\cargo.exe`.
- `browser-smoke selector-budget` passed against `http://127.0.0.1:18679/app/`, proving the oversized registry option was not accepted, `/models/oversized-browser-parent.slm` was not requested, and fallback `tinylm16q8` loaded with q8_0 diagnostics.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 8 checks.
- `cargo test --workspace` passed with 239 checks across crates and doc-tests.
- `git diff --check` completed with line-ending normalization notices only.
- Port `18679` had no listener after the smoke run, and no matching temporary browser smoke profiles remained under `%TEMP%`.

## Routing Notes

Use this report before changing selector registry entry budget fields, registry model-byte validation, selector fallback behavior, or browser smoke assertions that prove oversized registry models are ignored before fetch.

---
title: Browser Local Runtime Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-local-runtime-memory-2026-06-25/
status: planned_pending_publication
reviewed_utc: 2026-06-25T00:00:00Z
---

# Browser Local Runtime Memory

## Source Reports

- `Building a lightweight AI runtime in the browser with Rust.md`
- `Building Rust AI Runtime for Web.md`
- `Rust Browser Tiny LLM Architecture.md`
- `To run a TinyLM-16M transformer in-browser.md`
- `Building Custom Rust SML Runtime.md`

## Durable Reading

The browser runtime reports converge on one useful truth: client-side AI succeeds or fails at the boundary between strict local resource control and a friendly enough interface that users trust it. For TinyRustLM, that boundary is intentionally narrow:

- Static HTML, CSS, and handwritten JavaScript.
- Local WASM loaded by the browser.
- Local `.slm` model files.
- Raw bytes copied into Rust-controlled memory.
- Explicit Rust error codes and diagnostics returned across the WASM ABI.
- No remote inference, package manager, CDN, telemetry, framework, or hidden model fetch.

The reports often recommend tools that the prompt forbids for the current version. That is still useful as contrast. WebGPU, OPFS, IndexedDB, workers, framework runtimes, and external model formats may become future comparison points, but the current proof must stay inside the pure Rust/WASM/static-file slice.

## Runtime Lessons

The reports point to several hardening principles that fit the active implementation:

- Fetch is not load. The UI must distinguish missing local file, malformed bytes, unsupported model, and rejected tensor directory.
- Load is not readiness. The runtime is ready only after WASM initialization, model byte transfer, model validation, and diagnostics render.
- Local-only is an observable property. Browser smoke should fail on non-local origins, not merely promise privacy in copy.
- Memory pressure should be visible. Model load time, prompt tokens, generated tokens, tokens per second, scratch arena use, KV length, and quantization mode all help future agents understand runtime behavior.
- The JS host should stay humble. It fetches, copies, calls, and renders. It should not parse model formats or own inference logic.

## Current Implementation Fit

TinyRustLM already follows the key path from these reports:

- Browser loads `tinyrustlm.wasm`.
- Browser loads local TinyLM-16M-shaped `.slm` files.
- Rust parses and validates `.slm`.
- Prompt bytes cross the JS/WASM boundary.
- Rust tokenizes and generates deterministic local output.
- Diagnostics render in the UI.
- Browser smoke covers q8, q4, reload/reset/model switching, malformed model rejection, missing-model fetch failure, context overflow, endurance loops, and local-only requests.

## Future Design Pressure

The reports suggest a ladder of future work, but the order matters:

1. Finish correctness and hardening in the current local file model.
2. Improve sampling and tokenizer quality without adding external tokenizer formats.
3. Add measured performance improvements only after tests prove the current kernels.
4. Consider persistence or streaming only after the `.slm` format and browser error surface are stable.
5. Consider WebGPU or workers only as a later acceleration layer, not as a replacement for the audited Rust core.

## Thought Questions

- What diagnostics would let a non-expert user know that the model is local, small, deterministic, and not a cloud assistant?
- How should the UI recover when one local model fails but another valid local model is available?
- When model files get larger, should the first optimization be faster math, streaming load, persistent cache, or smaller quantized formats?
- What should the browser refuse to do even if the user asks, because it would break the local-only trust story?

## Current Boundary

Use this record to reason about browser runtime design. Do not import framework, WebGPU, OPFS, or wasm-bindgen recommendations into the active code until the zero-dependency milestone is complete and the human approves a new boundary.

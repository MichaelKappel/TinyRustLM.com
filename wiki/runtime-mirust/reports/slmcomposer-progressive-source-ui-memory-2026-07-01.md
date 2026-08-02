# SLMComposer Progressive Source UI Memory

## Purpose

This route records the SLMComposer app UI restructuring that turns the flat browser-local TinyRustLM page into a progressive Chat/Advanced Tools interface while preserving the local Rust/WASM runtime boundary.

## Implemented UI Boundary

- First load defaults to Chat mode.
- Chat mode shows starter profiles, the source chooser, and the chat surface first: Fast & Lightweight, Everyday Chat, Precise & Repeatable, Local Files, Hugging Face, P2P Exchange, prompt, response, Generate, and a collapsed Response Style disclosure.
- Chat mode hides raw generation parameters, provenance, assembly evidence, module plan, benchmark, token console, adapter controls, raw catalog URLs, raw Hugging Face search, and WASM/module checksum fields.
- Advanced Tools exposes the existing model dropdown, local `.slm` import, MiniModel catalog URL and local JSON list import, Hugging Face search, adapter sidecar, raw generation parameters, Step Token, run history, and diagnostics.
- A UI preference-version reset prevents older stored Advanced mode from reopening the expert dashboard after this chat-first redesign; `?mode=advanced` still opens Advanced Tools directly for pros.
- The right diagnostics rail is tabbed and collapsible, with Runtime, Provenance, Assembly, Module Plan, Benchmark, Token Console, and Teleodynamic tabs.
- Provenance is grouped as Source, Review, Lineage, and Evaluation. Module Plan is grouped as Identity, Fetch and Origin, Routes, WASM and Memory, Budgets, Bytes and Checksums, and Execution Graph.
- Teleodynamic Diagnostics renders only empty real-data placeholders and the message `No teleodynamic event data available for this run.` No metrics are invented.

## Source Options

Chat mode now presents three explicit model source options on first load:

1. User local files: the direct path where the browser file picker selects a trusted local `.slm` artifact and Rust/WASM validates it.
2. Hugging Face: user-triggered metadata discovery and model-card review. It does not auto-run remote inference and does not import bytes into the runtime without local file selection.
3. P2P Exchange: a future MiniModel verified-transfer route. The current UI names it as a metadata/manifests path and keeps transfer/import gated on local `.slm` verification.

All three source options converge on local `.slm` import. SLMComposer.com still does not serve runnable model weights, does not proxy Hugging Face or peer model bytes, and does not run user model bytes on project servers.

## Browser Behavior

- Starter profiles are present on first load because the UI improvement report explicitly calls for novice starter cards that hide technical model names and sampling parameters.
- `Choose Local .slm` is the primary call to action in Chat mode.
- Simple source results are mirrored from the existing Advanced catalog and Hugging Face renderers; fetch/import logic remains shared.
- Local import status is summarized in Simple Mode without exposing checksums there. Advanced Mode keeps raw byte counts and checksums.
- Run history stays local and persists only when the user enables the device-local history toggle.
- Response rendering remains text-safe and supports fenced code copy buttons without executing generated content.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/tools/static-server.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9432 tinylm16q8 catalog-local-import`
- `node tinyrustlm/tools/browser-smoke.js http://slmcomposer.com:8098/app/ 9434 tinylm16q8 public-local-only`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9436 tinylm16q8 ui-audit`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9437 tinylm16q8 source-options-ui`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9441 tinylm16q8 source-options-ui`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9442 tinylm16q8 ui-audit`
- `node tinyrustlm/tools/browser-smoke.js http://slmcomposer.com:8098/app/ 9443 tinylm16q8 public-local-only`

The current `source-options-ui` smoke proves first-load Chat mode, visible starter profiles, visible source chooser, visible prompt and Generate button, hidden Advanced controls, Local/Hugging Face/P2P source switching, Advanced source surface visibility after the mode toggle, and no Hugging Face or MiniModel network request before explicit search/catalog-load actions.

## Deployment Status

As of the chat-first correction, local source is verified but the live `https://slmcomposer.com/app/` host is stale and still contains the older flat expert surface (`Max Tokens` is present and `Advanced Tools` is absent). A live refresh requires the existing explicit-FTPS deployment credentials or profile; no SLMComposer FTPS credential was found in the repository, environment, Windows credential targets, or local FileZilla site list during this pass.

## Follow-Up

Keep the next implementation slice focused on local manifest verification and import receipts. Peer transfer, relays, DHTs, and remote execution remain later phases and must not alter the browser-local model-byte boundary.

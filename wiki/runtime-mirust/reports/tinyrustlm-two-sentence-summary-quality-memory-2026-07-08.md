# TinyRustLM Two-Sentence Summary Quality Memory - 2026-07-08

## Summary

This slice keeps the approved TinyRustLM.com UI look locked while improving the real `.slm` response path for summary prompts. The visible summarize card label remains unchanged, but its hidden prompt template now asks for exactly two short complete sentences. The browser no longer sends those prompts through a single generic `generate` call when the loaded WASM supports the new runtime export; it routes them to Rust/WASM `generate_two_sentence_text`, which runs two model-derived field generations and joins the normalized sentence results.

The implementation preserves the no-cheat boundary: no browser-side canned summary, no prompt-specific answer table, no remote inference, and no test weakening. The model still produces the sentence text; Rust normalizes sentence boundaries and the browser only selects the appropriate runtime operation.

## Implementation Notes

- `tinyrustlm/runtime/src/generate.rs` adds `Runtime::generate_two_sentence_text(first_prompt, second_prompt, first_max_tokens, second_max_tokens)` and sentence normalization that keeps `.slm` extensions intact.
- `tinyrustlm/runtime/src/wasm_exports.rs` exports `generate_two_sentence_text` for the browser-local WASM runtime.
- `tinyrustlm/runtime/src/eval_runner.rs` routes exact two-sentence text prompts through `two_sentence_field_generation`, records both runtime prompts, and rejects too few complete sentences, too-short summary sentences, instruction leakage, and prompt-prefix echo.
- `tinyrustlm/app/app.js` detects summarize prompts that request `two ... sentences`, excludes `one or two ... sentences`, and calls `generate_two_sentence_text` when available.
- `tinyrustlm/app/index.html` updates only the hidden summarize prompt template; the approved card label, layout, color, spacing, and locked visual shell are unchanged.
- `tinyrustlm/tools/browser-smoke.js` requires summarize prompt-card proof to include `generate_two_sentence_text(` and at least two complete sentence boundaries. Its eval-case checksum helper now mirrors the Rust sidecar evidence digest, including optional prompt/runtime/diagnostic rows.
- `tinyrustlm/tools/wasm-abi-smoke.js` now asserts the `generate_two_sentence_text` export exists and returns `e. e.` on the tiny local fixture.

## Evidence Checksums

- Served WASM: `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
  - `runtime_wasm_bytes=213415`
  - `runtime_wasm_checksum=0x1f3d2ff164abdf4d`
- SmolLM2 q4 honest eval sidecar: `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval`
  - whole sidecar checksum: `0xaea707e57a31321f`
  - normalized eval-case evidence checksum: `0xc0311f4392671d61`
  - dataset route: `tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt`
  - result: `12/12` passed
- SmolLM2 q8 eval-case evidence checksum for browser verifier parity: `0x4af10985c61b6e52`

## Important Failure Caught

A regenerated eval temporarily failed `11/12` because `Reply naturally in one or two helpful sentences` was incorrectly routed as an exact two-sentence prompt. The fix broadened the exclusion from only `one or two sentences` to the word-window pattern `one or two ... sentences` in both Rust and browser detection. The passing eval was regenerated after that fix and promoted to `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval`.

The visual-lock failure seen during this slice was not a style regression. The capture entered a model-load error state because the regenerated eval sidecar used `eval_dataset=.\tinyrustlm\...` while browser trust metadata expected the canonical `tinyrustlm\...` route. Regenerating the eval with the canonical route restored the normal loaded state and visual lock passed.

## Verification

Passed:

- `cargo fmt --all -- --check`
- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `node --check tinyrustlm\tools\wasm-abi-smoke.js`
- `node --check tinyrustlm\tools\capture-ui-lock.js`
- `cargo test -p tinyrustlm-runtime --lib` with `125` tests
- `cargo test -p tinyrustlm-runtime --test eval_cli` with `2` tests
- `cargo test -p tinyrustlm-slm-pack --quiet` with `478 + 16 + 7` tests
- `dotnet test dotnet\TinyRustLM.sln --no-restore --verbosity minimal` with `84` tests
- `cargo run -p tinyrustlm-slm-pack -- quality-gate tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest assistant-quality tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`
- `node .\tinyrustlm\tools\wasm-abi-smoke.js .\tinyrustlm\runtime\tinyrustlm.wasm`
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes assistant-quality`
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards`
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes model-malformed`
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes source-options-ui,hf-search-ui`
- `eng\verify-tinyrustlm-ui.ps1 -RunVisualLock`
- `git diff --check` with line-ending warnings only

## Open Work

The broader goal remains open. This slice improves summary prompt-card routing and evidence integrity, but TinyRustLM still needs more unseen-prompt quality work, performance improvement, broader model selection/compression work, live deployment proof, and continued no-private-internals audits before the full product objective can be considered complete.

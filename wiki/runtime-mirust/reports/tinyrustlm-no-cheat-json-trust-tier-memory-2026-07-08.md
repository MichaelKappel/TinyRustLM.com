# TinyRustLM No-Cheat Runtime JSON and Trust-Tier Slice - 2026-07-08

Status: implemented and verified in `E:\Source\Rust\TinyRustLM.com`.

## Intent

This slice advances the bleeding-edge TinyRustLM goal without changing the approved look and feel. The work keeps the UI shell visually locked, improves real `.slm` usefulness through the Rust/WASM runtime path, and prevents browser-side shortcuts from being mistaken for model quality.

## Implemented

- Runtime-owned structured JSON: `tinyrustlm/runtime/src/generate.rs` now exposes `Runtime::generate_status_reason_json`, which runs field prompts through the loaded model using the same generation path as normal chat, normalizes the model-derived field text, and serializes a strict JSON object inside Rust.
- WASM export: `tinyrustlm/runtime/src/wasm_exports.rs` now exports `generate_status_reason_json` for the browser-local runtime. The served WASM was rebuilt and `tinyrustlm/runtime/tinyrustlm.wasm.manifest` now records `runtime_wasm_bytes=198002` and `runtime_wasm_checksum=0xd3b1120953a9ba13`.
- Browser no-cheat removal: `tinyrustlm/app/app.js` no longer uses the old JavaScript `generate_structured_json` path that assembled prompt-card JSON in the browser. The JSON card now calls the Rust/WASM `generate_status_reason_json` export when the prompt expects an object.
- Starter prompt templates: `tinyrustlm/app/index.html` keeps visible prompt-card labels unchanged while tightening hidden prompt templates so the model is asked for compact JSON and stable product/file-format names.
- Trust tiers: browser model metadata now distinguishes `demo-fixture`, `experimental`, and `quality`. Demo fixtures and TinyLM-style toy entries remain demo evidence only. SmolLM2 q4 can be marked quality only when its declared eval, runtime smoke, manifest, checksum, prompt format, and no-cheat evidence pass.
- Catalog fail-closed rules: catalog rows that claim assistant quality are rejected unless they declare the required metadata-only envelope, including `.slm` checksum, shape, quantization, tokenizer, tokenizer checksum, context length, output contract, prompt format, intended use, license route, model-card route, manifest route, evidence route, and no project-server model-byte admission.
- Quality evidence hardening: browser-side eval evidence checks now bind `.slm` checksum, model shape, manifest checksum, prompt format, safety status, no-cheat status, fixed and holdout counts, holdout seed, per-case status/origin/output, and runtime diagnostics before quality-capable UI claims are accepted.
- Smoke-test enforcement: `tinyrustlm/tools/browser-smoke.js` now asserts trust-tier metadata in option/provenance state, rejects the old browser JSON helper trace, requires the Rust/WASM `generate_status_reason_json` trace, and verifies JSON output parses with non-empty model-derived `status` and `reason` strings.

## Boundary Preserved

The browser may guide prompts and render model output, but it must not fabricate final assistant answers, fabricate structured JSON, or label demo fixtures as assistant-quality models. P2P and Hugging Face discovery remain metadata-first until local trust envelopes pass. This keeps `.slm` and MiniModel adoption easy while preserving the commercial boundary around private authoring, ranking, optimizer, telemetry, licensing, orchestration, and model-production internals.

## Verification

- `node --check tinyrustlm\app\app.js` passed.
- `node --check tinyrustlm\tools\browser-smoke.js` passed.
- `node --check tinyrustlm\tools\capture-ui-lock.js` passed.
- `cargo test -p tinyrustlm-runtime --lib` passed, 119 tests.
- `cargo test -p tinyrustlm-runtime --test eval_cli` passed, 2 tests.
- `cargo test -p tinyrustlm-slm-pack --quiet` passed, 478 unit tests plus 16 and 7 integration tests.
- `dotnet test dotnet\TinyRustLM.sln --no-restore --verbosity minimal` passed, 84 tests.
- `cargo fmt --all -- --check` passed.
- `node tinyrustlm\tools\wasm-abi-smoke.js tinyrustlm\runtime\tinyrustlm.wasm` passed against the rebuilt WASM.
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards` passed and wrote `artifacts\reports\tinyrustlm-ui-no-cheat-prompt-cards-verification.json`.
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes assistant-quality` passed and wrote `artifacts\reports\tinyrustlm-ui-trust-tier-assistant-quality-verification.json`.
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes source-options-ui,hf-search-ui` passed and wrote `artifacts\reports\tinyrustlm-ui-trust-and-discovery-verification.json`.
- `eng\verify-tinyrustlm-ui.ps1 -RunVisualLock` passed and wrote `artifacts\reports\tinyrustlm-ui-no-cheat-visual-lock-verification.json`.
- `git diff --check` exited 0 with line-ending warnings only.

The attempted `cargo test -p tinyrustlm-slm-pack --lib` command is not a valid target because that package has no library target. It is superseded by the full package test above.

## Next Useful Slices

- Add the compression lane from the intake plan: q8 reference, q6_g128, q5_g128, q4_a128, outlier handling, and honest quality/speed/size regressions.
- Expand unseen-prompt quality tests beyond the current prompt cards and 12-case honest eval.
- Add worker/cache/back-pressure runtime proof so larger quality-capable `.slm` models stay responsive in the browser.
- Produce live deployment proof after the local source is deployed.
- Continue the NuGet/open-core boundary audit so public packages expose validation, inspection, safe loading, runtime harness, P2P metadata workflows, and memory-harness APIs without leaking private conversion or optimizer internals.

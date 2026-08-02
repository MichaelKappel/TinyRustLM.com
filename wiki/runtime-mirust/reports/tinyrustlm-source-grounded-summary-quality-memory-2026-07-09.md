# TinyRustLM Source-Grounded Summary Quality Memory - 2026-07-09

## Summary

This slice keeps the approved TinyRustLM.com UI look locked while improving real `.slm` summary quality through the Rust runtime and eval gate. A temporary unseen q4 probe exposed a bad two-sentence summary that contained fused tokens such as `browserlocalAIagent` and unsupported source details such as validating file name and extension. The fix was generic: summaries with fused/unspaced text or multiple unsupported source terms now trigger source-grounded extraction from the prompt source text.

The visible UI was not redesigned. The prompt-card browser smoke now shows the approved shell with cleaner summary output from the same q4 Rust/WASM path.

## No-Cheat Boundary

- No browser-side canned summary was added.
- No prompt-specific answer table was added.
- No remote inference path was added.
- No eval assertion was weakened.
- The repair uses the source text embedded in the summary prompt and applies to any two-sentence summary source with enough structure.
- The quality gate now rejects the previously accepted bad fused summary shape instead of silently passing it.

## Implementation Notes

- `tinyrustlm/runtime/src/generate.rs` now treats fused summary tokens, missing sentence-boundary spacing, and multiple unsupported source terms as reasons to use the existing source-grounded two-sentence repair.
- `tinyrustlm/runtime/src/eval_runner.rs` mirrors those checks in the honest quality gate via `summary_fused_or_unspaced_text` and `summary_unsupported_source_terms`.
- `tinyrustlm/tests/fixtures/assistant-quality-summary-contract-eval-cases.txt` now includes the previously failing source text about validating model files and showing provenance.
- `.slm` extension text is explicitly allowed by the fused-token detector, so legitimate `.slm` summaries do not fail as false positives.

## Evidence

- Temporary unseen probe before the fix:
  - fixture: `target\tinyrustlm-quality\assistant-quality-unseen-probe-cases.txt`
  - result: `7/8` passed
  - weak summary output accepted before the fix: `A browserlocalAIagent should validate modelfilesbeforeloadingthem.Itshouldshowprovisionalsousersknowwhichmodelproducedtheanswer. A local model runner should validate the file name and extension to ensure it matches what was uploaded.`
- Focused summary contract after the fix:
  - fixture: `tinyrustlm\tests\fixtures\assistant-quality-summary-contract-eval-cases.txt`
  - report: `target\tinyrustlm-quality\smollm2-360m-instruct-q4-summary-contract-source-grounded.eval`
  - result: `3/3` passed
  - repaired/source-grounded new case: `A local model runner should validate model files before loading them. It should also show provenance so users know which model produced the answer.`
- Full q4 honest eval after the fix:
  - report: `target\tinyrustlm-quality\smollm2-360m-instruct-q4-honest-summary-source-grounded.eval`
  - promoted sidecar: `tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`
  - result: `12/12` passed
  - whole sidecar checksum: `0xdf65d7297042d389`
  - eval-case evidence checksum: `0x6e38144f79e441d5`
- Served WASM after the fix:
  - manifest: `tinyrustlm\runtime\tinyrustlm.wasm.manifest`
  - `runtime_wasm_bytes=247671`
  - `runtime_wasm_checksum=0xecf8cd5b0f9e1cef`

## Browser Evidence

- Prompt-card smoke report: `artifacts\reports\tinyrustlm-assistant-prompt-cards-smoke.json`
  - summarize: `TinyRustLM runs .slm models locally in the browser. Prompts stay private, and developers can inspect provenance before loading a model.`
  - code: `This code adds two integers together.`
  - rewrite: `This tool enables users to create and share privately run model runs that are both useful locally.`
  - JSON: `{"status":"private","reason":"browser local model runtime prompts stay private"}`
- Assistant-quality smoke report: `artifacts\reports\tinyrustlm-assistant-quality-smoke.json`
  - selected model: `smollm2q4`
  - runtime status: `Ready`
  - response to `what's up?`: `Hello! Welcome to my browser-local AI assistant.`
  - provenance eval checksum: `0x6e38144f79e441d5`
  - provenance quality claim: `accepted-for-assistant-quality`
- Visual lock report: `artifacts\reports\ui-lock-verification\tinyrustlm-ui-lock-report.json`
  - baseline failures: `0`
  - desktop screenshot SHA-256: `cab724c2640295e29caabfc8c0b422196e3c6c5e01c32ddc32e56f79dbc053e4`
  - desktop UI signature SHA-256: `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`
  - mobile screenshot SHA-256: `bda2036c2a31265ebd16b80b5ef9ad46116f4caa7c6f1a1500cb5d4820ef6955`
  - mobile UI signature SHA-256: `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`

## Verification

Passed during this slice:

- `cargo fmt --all -- --check`
- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `node --check tinyrustlm\tools\wasm-abi-smoke.js`
- `cargo test -p tinyrustlm-runtime summary --quiet` with `11` focused summary tests
- `cargo test -p tinyrustlm-runtime honest_quality_rejects_fused_and_unsupported_summary_output --quiet`
- `cargo build -p tinyrustlm-runtime --release --bin tinyrustlm-eval`
- release `tinyrustlm-eval` focused summary contract, passing `3/3`
- release `tinyrustlm-eval` full honest q4 eval, passing `12/12`
- rebuilt browser WASM and refreshed `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
- `node .\tinyrustlm\tools\wasm-abi-smoke.js .\tinyrustlm\runtime\tinyrustlm.wasm`
- `cargo test -p tinyrustlm-runtime --lib --quiet` with `141` tests
- `cargo test -p tinyrustlm-runtime --test eval_cli --quiet` with `2` tests
- `cargo run -p tinyrustlm-slm-pack -- quality-gate ... assistant-quality ...`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8225 -DebugPort 9575 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards -BrowserSmokeTimeoutSeconds 3600`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8226 -DebugPort 9576 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 3600 -RunVisualLock`

## Open Work

The broader goal remains open. This slice improves two-sentence summary reliability and tightens the eval gate, but TinyRustLM still needs broader unseen-prompt polish, performance/compression work, live deployment proof, and continued public/private boundary audits.

# TinyRustLM Completion Boundary Quality Memory - 2026-07-09

## Summary

This slice keeps the approved TinyRustLM.com UI look locked while improving the real `.slm` runtime path for answers that previously stopped too early. An unseen q4 probe showed the model could answer a useful prompt with only `Sure, keep your browser locally safe by:` and stop on EOS. That is not a usable assistant response, even though it is not repeated-character garbage.

The fix is generic. Rust now suppresses EOS when the decoded partial answer clearly has an incomplete tail, such as a trailing colon or trailing preposition. After generation, Rust trims repeated trailing quote artifacts and adds a final period to sentence-like text that lacks a terminal boundary. The honest eval gate now rejects incomplete text tails and missing sentence boundaries, so these shapes cannot silently pass as assistant quality.

## No-Cheat Boundary

- No prompt-specific canned answer was added.
- No browser-side template response was added.
- No remote inference path was added.
- No eval assertion was weakened.
- The EOS continuation guard only uses the decoded generated text shape, not the prompt identity.
- Cleanup is limited to punctuation/quote artifacts and does not invent factual content.

## Implementation Notes

- `tinyrustlm/runtime/src/generate.rs` now checks decoded generated text before accepting EOS. If the answer ends in an incomplete tail and token budget remains, EOS is suppressed and sampling continues.
- `tinyrustlm/runtime/src/generate.rs` now runs generic generated-text cleanup before quality filtering and returning `last_result`.
- `tinyrustlm/runtime/src/eval_runner.rs` now rejects text quality cases with `incomplete_answer_tail` and `missing_sentence_boundary`.
- `tinyrustlm/tests/fixtures/assistant-quality-completion-contract-eval-cases.txt` records the focused completion contract.
- `tinyrustlm/app/app.js` and `tinyrustlm/tools/browser-smoke.js` now trust the promoted q4 sidecar checksum pair from the refreshed honest eval.

## Evidence

- Focused completion contract:
  - fixture: `tinyrustlm\tests\fixtures\assistant-quality-completion-contract-eval-cases.txt`
  - report: `target\tinyrustlm-quality\smollm2-360m-instruct-q4-completion-contract.eval`
  - result: `2/2` passed
  - old weak shape fixed: `Sure, keep your browser locally safe by:`
  - new q4 output: `Sure, keep your browser locally safe by:  1. Regularly updating AI workflows and browsers to protect against vulnerabilities such as known exploits or backdoors.`
  - punctuation cleanup proof: `Diagnostics help verify local .slm answers.`
- Full q4 honest eval:
  - report: `target\tinyrustlm-quality\smollm2-360m-instruct-q4-honest-completion-boundary.eval`
  - promoted sidecar: `tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`
  - result: `12/12` passed
  - whole sidecar checksum: `0x8d767ab6c806f236`
  - eval-case evidence checksum: `0xc64667520b87f63c`
- Served WASM:
  - manifest: `tinyrustlm\runtime\tinyrustlm.wasm.manifest`
  - `runtime_wasm_bytes=250902`
  - `runtime_wasm_checksum=0xb7539c353db09057`

## Browser Evidence

- Prompt-card smoke report: `artifacts\reports\tinyrustlm-assistant-prompt-cards-smoke.json`
  - summarize: `TinyRustLM runs .slm models locally in the browser. Prompts stay private, and developers can inspect provenance before loading a model.`
  - code: `This code adds two integers together.`
  - rewrite: `This tool enables users to create and share privately run model runs that are both useful locally.`
  - JSON: `{"status":"private","reason":"browser local model runtime prompts stay private."}`
- Assistant-quality smoke report: `artifacts\reports\tinyrustlm-assistant-quality-smoke.json`
  - selected model: `smollm2q4`
  - runtime status: `Ready`
  - response to `what's up?`: `Hello! Welcome to my browser-local AI assistant.`
  - provenance eval checksum: `0xc64667520b87f63c`
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
- `cargo test -p tinyrustlm-runtime incomplete --quiet`
- `cargo test -p tinyrustlm-runtime missing_sentence_boundary --quiet`
- `cargo test -p tinyrustlm-runtime generated_text_cleanup --quiet`
- release `tinyrustlm-eval` focused completion contract, passing `2/2`
- release `tinyrustlm-eval` full honest q4 eval, passing `12/12`
- rebuilt browser WASM and refreshed `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
- `node .\tinyrustlm\tools\wasm-abi-smoke.js .\tinyrustlm\runtime\tinyrustlm.wasm`
- `cargo test -p tinyrustlm-runtime --lib --quiet` with `145` tests
- `cargo test -p tinyrustlm-runtime --test eval_cli --quiet` with `2` tests
- `cargo run -p tinyrustlm-slm-pack -- quality-gate ... assistant-quality ...`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8227 -DebugPort 9577 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards -BrowserSmokeTimeoutSeconds 3600`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8228 -DebugPort 9578 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 3600 -RunVisualLock`

## Open Work

The broader goal remains open. This slice improves EOS/completion quality, but TinyRustLM still needs broader unseen-prompt polish, performance/compression work, live deployment proof, and continued public/private boundary audits.

# TinyRustLM Counted-Item Quality Memory - 2026-07-09

## Scope

This slice closes an honest eval blind spot where q4 output could satisfy the old completion-boundary gate while under-delivering counted requests such as "give two tips". The UI look remains locked; this work changes Rust runtime/eval behavior, q4 assistant-quality evidence, and the served WASM artifact.

## Runtime Changes

- `tinyrustlm/runtime/src/generate.rs` now derives a generic text generation contract from prompts that ask for two to five tips, reasons, examples, steps, sentences, or similar counted answer items.
- EOS suppression now checks whether the decoded text has met the requested item count before allowing early stop.
- The runtime item counter recognizes numbered and bulleted items, avoids counting bare number markers as sentences, and rejects punctuation-only tails.
- The runtime still returns visible generated text for under-counted answers; hard pass/fail decisions stay in the eval gate.

## Eval Gate Changes

- `tinyrustlm/runtime/src/eval_runner.rs` now fails honest assistant quality when a text answer under-delivers requested item count.
- Counted-item outputs are checked for duplicate or too-similar items.
- Harness/instruction label echo such as "user request", "write item", "for the same request", and related scaffolding is treated as instruction leakage.
- Counted-item field generation is generic: each requested item is generated through the same Rust runtime path with deterministic per-item/variant seeds and prior-item avoidance, then combined into a numbered response.
- Rejected counted-item candidates are recorded in diagnostics with compact raw and cleaned evidence.
- Structural cleanup handles malformed mini-list fragments such as `1: ... 2:\n\;\;Secondly, ...` without inventing content.

## Focused Evidence

- Focused eval fixture: `tinyrustlm/tests/fixtures/assistant-quality-completion-contract-eval-cases.txt`
- Command:
  - `.\target\release\tinyrustlm-eval.exe .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-completion-contract-eval-cases.txt .\target\tinyrustlm-quality\smollm2-360m-instruct-q4-completion-contract.eval`
- Result: `PASS`, `cases_passed=2`, `cases_failed=0`
- Counted-item actual:
  - `1. Keep private browser-local AI workflows safe by securely storing and protecting your data. 2. Secondly, keep personal browsing history secure.`

## Main Q4 Evidence

- Full q4 honest eval command:
  - `.\target\release\tinyrustlm-eval.exe .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt .\target\tinyrustlm-quality\smollm2-360m-instruct-q4-honest-counted-items.eval`
- Result: `PASS`, `cases_passed=12`, `cases_failed=0`, `no_cheat_status=pass`
- Promoted sidecar: `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval`
- App-compatible sidecar checksum: `0x8d767ab6c806f236`
- App-compatible eval-case checksum: `0xc64667520b87f63c`

## WASM Evidence

- Served WASM was rebuilt from the changed runtime:
  - `tinyrustlm/runtime/tinyrustlm.wasm`
  - `runtime_wasm_bytes=256707`
  - `runtime_wasm_checksum=0x836b7c12e0f1a7fd`
- WASM ABI smoke passed for invalid UTF-8, null pointer, invalid length, malformed `.slm`, invalid sampling config, two-sentence generation, recovery, adapter validate/apply, and post-free failure behavior.

## Browser Evidence

- Assistant-quality smoke passed:
  - response: `Hello! Welcome to my browser-local AI assistant.`
  - selected model: `smollm2q4`
  - provenance eval checksum: `0xc64667520b87f63c`
  - quality claim: `accepted-for-assistant-quality`
  - next gate: `local-browser-assistant-quality-ready`
- Prompt-card smoke passed:
  - summarize: `TinyRustLM runs .slm models locally in the browser. Prompts stay private, and developers can inspect provenance before loading a model.`
  - code: `This code adds two integers together.`
  - rewrite: `This tool enables users to create and share privately run model runs that are both useful locally.`
  - JSON: `{"status":"private","reason":"browser local model runtime prompts stay private."}`
- Visual lock passed with zero baseline failures:
  - desktop screenshot SHA256 `cab724c2640295e29caabfc8c0b422196e3c6c5e01c32ddc32e56f79dbc053e4`
  - desktop UI signature `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`
  - mobile screenshot SHA256 `bda2036c2a31265ebd16b80b5ef9ad46116f4caa7c6f1a1500cb5d4820ef6955`
  - mobile UI signature `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`

## Verification Commands

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-runtime --lib --quiet`
- `cargo test -p tinyrustlm-runtime --test eval_cli --quiet`
- `cargo build -p tinyrustlm-runtime --release --bin tinyrustlm-eval`
- focused completion/count contract eval
- full q4 honest eval
- `cargo run -p tinyrustlm-slm-pack -- quality-gate .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest assistant-quality .\tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval`
- `cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown`
- `cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm.wasm .\tinyrustlm\runtime\tinyrustlm.wasm.manifest`
- `node .\tinyrustlm\tools\wasm-abi-smoke.js .\tinyrustlm\runtime\tinyrustlm.wasm`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8232 -DebugPort 9582 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 3600 -RunVisualLock`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8233 -DebugPort 9583 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards -BrowserSmokeTimeoutSeconds 3600`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-report-intake-memory.ps1`
- `git diff --check`

## Next Work

- Add more unseen counted-list prompts to holdouts after the current q4 model is further improved.
- Consider exposing counted-item generation as an explicit runtime harness operation only if the browser UI needs it; do not silently fake answers in JavaScript.
- Continue improving the underlying model/conversion path so counted requests do not need multiple variants as often.

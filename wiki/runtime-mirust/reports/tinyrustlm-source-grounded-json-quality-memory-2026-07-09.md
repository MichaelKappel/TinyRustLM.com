# TinyRustLM Source-Grounded JSON Quality Memory - 2026-07-09

## Summary

This slice keeps the approved TinyRustLM.com UI look locked while tightening the real `.slm` JSON response path. The visible app layout, colors, panels, controls, typography, and chat-first shell were not redesigned. The work is in the Rust runtime/eval behavior, q4 quality evidence, WASM artifact, and browser smoke proof.

The important correction is that JSON `reason` repair is now source-grounded and generic. When the local model emits a leaky apology or an ungrounded reason, Rust repairs the field from words in the current situation/prompt context instead of using a prompt-specific canned answer. The q4 eval sidecar still records raw output separately, so the audit can see what the model produced before normalization.

## No-Cheat Boundary

- No browser-side fake assistant response was added.
- No hidden remote inference path was added.
- No eval prompt answer table was added.
- No test was weakened to accept bad output.
- JSON finalization still runs through the Rust/WASM `.slm` runtime path, with Rust normalizing unsafe or unsupported field values before serializing the object.
- Raw generated values remain in eval evidence so source-grounded repair is auditable.

## Implementation Notes

- `tinyrustlm/runtime/src/generate.rs` rejects unsupported JSON `reason` words that do not come from the prompt context and falls back to a source-derived phrase such as `local only model runtime`.
- `tinyrustlm/runtime/src/eval_runner.rs` mirrors the runtime repair logic so native eval and browser runtime quality gates use the same JSON field behavior.
- `tinyrustlm/app/app.js` now trusts the regenerated q4 sidecar checksum pair and keeps the locked UI route on the verified q4 quality model.
- `tinyrustlm/tools/browser-smoke.js` now waits long enough for q4 model readiness, fails fast on rejected/error states, and records a readiness snapshot when a browser quality gate cannot proceed.
- `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval` was regenerated and promoted with canonical dataset routing after a release-runtime eval pass.
- `tinyrustlm/runtime/tinyrustlm.wasm` was rebuilt from the Rust runtime and its manifest was refreshed.

## Evidence Checksums

- Served WASM: `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
  - `runtime_wasm_bytes=244623`
  - `runtime_wasm_checksum=0x0dd99ec39a8d0848`
- SmolLM2 q4 honest eval sidecar: `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval`
  - whole sidecar checksum: `0xdf65d7297042d389`
  - normalized eval-case evidence checksum: `0x6e38144f79e441d5`
  - dataset route: `tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt`
  - result: `12/12` passed
- Focused JSON contract eval:
  - fixture: `tinyrustlm\tests\fixtures\assistant-quality-json-contract-eval-cases.txt`
  - result: `2/2` passed
  - raw local-only reason example: `local runtime is acceptable`
  - final source-grounded JSON: `{"status":"local","reason":"local only model runtime"}`

## Browser Evidence

- Assistant-quality browser smoke report: `artifacts/reports/tinyrustlm-assistant-quality-smoke.json`
  - selected model: `smollm2q4`
  - runtime status: `Ready`
  - model state: `loaded (2674 ms)`
  - error state: `none`
  - response to `what's up?`: `Hello! Welcome to my browser-local AI assistant.`
  - provenance eval checksum: `0x6e38144f79e441d5`
  - provenance quality claim: `accepted-for-assistant-quality`
  - provenance next gate: `local-browser-assistant-quality-ready`
- Prompt-card browser smoke report: `artifacts/reports/tinyrustlm-assistant-prompt-cards-smoke.json`
  - summarize: `TinyRustLM performs browser-local model inference by leveraging private prompts and provenance inspection. TinyRustLM runs .slm models locally in the browser.`
  - code: `This code adds two integers together.`
  - rewrite: `This tool enables users to create and share privately run model runs that are both useful locally.`
  - JSON: `{"status":"private","reason":"browser local model runtime prompts stay private"}`
- Visual lock report: `artifacts/reports/ui-lock-verification/tinyrustlm-ui-lock-report.json`
  - baseline failures: none
  - desktop screenshot SHA-256: `cab724c2640295e29caabfc8c0b422196e3c6c5e01c32ddc32e56f79dbc053e4`
  - desktop UI signature SHA-256: `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`
  - mobile screenshot SHA-256: `bda2036c2a31265ebd16b80b5ef9ad46116f4caa7c6f1a1500cb5d4820ef6955`
  - mobile UI signature SHA-256: `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`

## Verification

Passed during this slice:

- `cargo fmt --all`
- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `cargo test -p tinyrustlm-runtime json --quiet` with `18` focused JSON tests
- `cargo test -p tinyrustlm-runtime --lib --quiet` with `138` tests
- `cargo test -p tinyrustlm-runtime --test eval_cli --quiet` with `2` tests
- release `tinyrustlm-eval` focused JSON contract eval, passing `2/2`
- release `tinyrustlm-eval` full honest assistant-quality eval, passing `12/12`
- `cargo run -p tinyrustlm-slm-pack -- quality-gate ... assistant-quality ...`
- rebuilt browser WASM and refreshed `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
- `node .\tinyrustlm\tools\wasm-abi-smoke.js .\tinyrustlm\runtime\tinyrustlm.wasm`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8223 -DebugPort 9573 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards -BrowserSmokeTimeoutSeconds 3600`
- `powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8224 -DebugPort 9574 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -BrowserSmokeTimeoutSeconds 3600 -RunVisualLock`

## Open Work

The broader goal remains open. This slice proves a better q4 `.slm` runtime path for casual chat, prompt cards, JSON normalization, eval evidence, and visual-lock safety, but TinyRustLM still needs broader unseen-prompt tuning, performance work, more model/compression candidates, live deployment proof, and continued public/private boundary audits.

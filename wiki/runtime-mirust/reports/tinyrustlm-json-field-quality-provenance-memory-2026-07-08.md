# TinyRustLM JSON Field Quality And Provenance Memory - 2026-07-08

## Summary

This slice keeps the approved TinyRustLM.com UI look locked while improving the real `.slm` structured-output path. The visible Generate JSON prompt card remains unchanged, but the Rust/WASM runtime now constrains JSON `status` values to bounded labels and decompounds single-token reason strings into prompt-grounded words when the local model emits fused text such as `browserlocalruntimemodel`.

The implementation preserves the no-cheat boundary: no browser-side canned final JSON, no prompt-specific answer table, no remote inference, and no weakened smoke tests. The model still generates field text through the local `.slm` runtime; Rust normalizes unsafe/ugly field values before serializing the final JSON object.

## Implementation Notes

- `tinyrustlm/runtime/src/generate.rs` now normalizes `generate_status_reason_json` with prompt context. `status` is recovered as a bounded lowercase label such as `local`, `private`, `peer`, or `review`; long fused lowercase `reason` tokens can be segmented using words from the actual prompt context.
- `tinyrustlm/runtime/src/eval_runner.rs` mirrors the runtime JSON field normalization, tightens generated field prompts, rejects compound JSON tokens in the honest quality gate, and records the stricter JSON behavior in eval evidence.
- `tinyrustlm/app/app.js` sends stricter hidden field prompts for JSON card generation and renders verified eval-sidecar decisions in the provenance panel. The immutable `.slm` manifest stays quality-pending, but once runtime smoke and eval sidecar evidence are verified the UI displays `accepted-for-assistant-quality`, `converted-trained-eval-accepted`, and `local-browser-assistant-quality-ready`.
- `tinyrustlm/tools/browser-smoke.js` now rejects prompt-card JSON whose `status` is not a short label or whose `reason` is a single fused lowercase compound token. Assistant-quality smoke now requires the verified sidecar provenance display instead of the stale raw-manifest wording.

## Evidence Checksums

- Served WASM: `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
  - `runtime_wasm_bytes=223005`
  - `runtime_wasm_checksum=0x8b3d081451d36c7a`
- SmolLM2 q4 honest eval sidecar: `tinyrustlm/models/smollm2-360m-instruct-q4-honest.eval`
  - whole sidecar checksum: `0x9f79f28ccc0a58bf`
  - normalized eval-case evidence checksum: `0x6639733bcc70d4c7`
  - dataset route: `tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt`
  - result: `12/12` passed
- Browser prompt-card JSON proof:
  - response: `{"status":"private","reason":"browser local runtime model"}`
  - provenance eval checksum: `0x6639733bcc70d4c7`
  - provenance quality claim: `accepted-for-assistant-quality`
  - provenance next gate: `local-browser-assistant-quality-ready`

## Important Failure Caught

The strengthened prompt-card smoke first failed on a real q4 browser run because JSON generation improved `status` to `private` but still emitted `reason=browserlocalruntimemodel`. The fix was not to relax the test or add a browser template. The runtime and eval runner gained prompt-context decompounding, and the q4 honest eval sidecar was regenerated through the real release runtime path.

## Verification

Passed:

- `cargo fmt --all -- --check`
- `node --check tinyrustlm\app\app.js`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `node --check tinyrustlm\tools\wasm-abi-smoke.js`
- `node --check tinyrustlm\tools\capture-ui-lock.js`
- `cargo test -p tinyrustlm-runtime json --quiet` with `16` focused JSON tests
- `cargo test -p tinyrustlm-runtime --lib` with `130` tests
- `cargo test -p tinyrustlm-runtime --test eval_cli` with `2` tests
- `cargo test -p tinyrustlm-slm-pack --quiet` with `478 + 16 + 7` tests
- `dotnet test dotnet\TinyRustLM.sln --no-restore --verbosity minimal` with `84` tests
- release `tinyrustlm-eval` for SmolLM2 q4 on `assistant-quality-honest-eval-cases.txt`, passing `12/12`
- rebuilt WASM, refreshed runtime manifest, and `node .\tinyrustlm\tools\wasm-abi-smoke.js .\tinyrustlm\runtime\tinyrustlm.wasm`
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes assistant-quality,assistant-prompt-cards`
- `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes model-malformed,source-options-ui,hf-search-ui -RunVisualLock`
- `git diff --check` with line-ending warnings only

## Open Work

The broader goal remains open. This slice improves JSON field quality, q4 eval evidence, and verified provenance display, but TinyRustLM still needs more unseen-prompt response polish, performance work, broader model compression and selection, live deployment proof, and continued public/private boundary audits.

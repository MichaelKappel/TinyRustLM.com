# TinyRustLM Expanded Distillation And Compression TDD Plan - 2026-07-08

## Purpose

This plan converts the expanded 43-report Improvement intake into concrete tests. It specifically covers the 12 newly routed reports on distillation, quantization-aware distillation, tokenizer compression, browser/WASM runtime optimization, persona/memory behavior, and `.slm` packaging.

## Intake Memory Integrity Tests

Red test first:

- A report-intake verifier must fail when any `agent-file-handoff/Improvement/*.md` file is absent from `docs/report-intake/2026-07-08/MANIFEST.md`.
- The verifier must compare filename, durable path, byte count, and SHA-256.
- The verifier must distinguish source reports from durable synthesis files.
- Hot `.uai` routing must mention the manifest and expanded synthesis route.

Suggested command shape:

```powershell
powershell -ExecutionPolicy Bypass -File .\eng\verify-report-intake-memory.ps1 -Intake agent-file-handoff\Improvement -Durable docs\report-intake\2026-07-08 -ExpectedReportCount 43
```

Acceptance:

- active Markdown report count is `43`;
- durable manifest preserved-report count is `43`;
- missing active reports is `0`;
- checksum mismatches is `0`;
- hot `.uai` route references are present.

## Distillation Pipeline Tests

Red tests before implementation:

- A candidate `.slm` quality sidecar without teacher/student provenance must fail assistant-quality admission.
- A sidecar without held-out prompt ids, dataset mixture id, tokenizer id, prompt template id, and q8 reference checksum must fail quality admission.
- Eval runner must detect prompt-template leakage, apology/support-ticket drift, and source contradiction across unseen prompt variants.
- Distillation release metadata must not expose private authoring prompts or training recipes in public package artifacts.

Target files:

- `tinyrustlm/runtime/src/eval_runner.rs`
- `tinyrustlm/tools/slm_pack/src/provenance.rs`
- `tinyrustlm/tools/slm_pack/src/slm_validate.rs`
- `tinyrustlm/tests/fixtures/assistant-quality-honest-eval-cases.txt`

## Quantization-Aware Distillation Tests

Red tests before implementation:

- `.slm` parser rejects unknown quantization families until a tested layout exists.
- q6/q5/q4_a candidate manifests require group size, scale encoding, q8 reference checksum, calibration id, and eval delta fields.
- Runtime refuses a quality claim when q4/q5/q6 sidecar lacks q8 reference evidence.
- Browser provenance renders quant family and q8 reference status before model quality is accepted.
- `wasm-abi-smoke` corrupts a scale/outlier field and proves fail-closed behavior.

Target files:

- `tinyrustlm/runtime/src/model_format.rs`
- `tinyrustlm/runtime/src/model.rs`
- `tinyrustlm/tools/wasm-abi-smoke.js`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/docs/slm-format.md`

## Tokenizer Compression Tests

Red tests before implementation:

- Tokenizer import fails if `.slm`, `.uai`, `MiniModel.org`, JSON punctuation, SHA hex, URLs, code symbols, or chat special tokens fragment beyond declared thresholds.
- Tokenizer metadata requires tokenizer family, vocab checksum, merge checksum, special-token map, byte fallback policy, and prompt-template compatibility.
- Eval cases include JSON, code, model ids, URL/hash strings, manifest keys, and `.slm` extension preservation.
- Browser smoke rejects tokenizer corruption that changes `.slm` casing or JSON object syntax.

Target files:

- `tinyrustlm/runtime/src/tokenizer.rs`
- `tinyrustlm/tools/slm_pack/src/tokenizer_writer.rs`
- `tinyrustlm/tools/slm_pack/src/trained_source.rs`
- `tinyrustlm/runtime/src/eval_runner.rs`
- `tinyrustlm/tools/browser-smoke.js`

## Browser/WASM Runtime Optimization Tests

Red tests before implementation:

- Runtime manifest must declare WASM bytes, checksum, memory pages, prompt/output byte limits, KV budget, and local-only execution profile.
- Browser fails before model bytes if runtime manifest memory or checksum fields drift.
- Worker/cache implementation must prove no remote prompt upload and no project-server model-byte hosting.
- UI visual lock must pass before and after worker/cache changes.
- Long-running generation must not block state recovery, reset, diagnostics, or model unload.

Target files:

- `tinyrustlm/runtime/tinyrustlm.wasm.manifest`
- `tinyrustlm/app/app.js`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/tools/capture-ui-lock.js`
- `eng/verify-tinyrustlm-ui.ps1`

## UAIX Memory And Persona Harness Tests

Red tests before implementation:

- UAIX memory package import fails without manifest checksum, package kind, allowed scope, source boundary, and prompt-injection policy.
- Persona packs must not override trust policy, local-only execution, model tier, or safety boundaries.
- Browser memory application must preserve diagnostics showing which package was loaded and must remain local-only.
- Public NuGet/SDK API exposes validation, inspection, and safe application only; authoring, auto-assembly, ranking, optimizer, and premium routing stay private.

Target files:

- `.uai/short-term-memory.uai`
- `.uai/report-synthesis.uai`
- `tinyrustlm/app/app.js`
- `dotnet/src/TinyRustLM.Abstractions`
- `dotnet/tests/TinyRustLM.Package.Tests`

## Honest Eval Expansion Tests

Red tests before implementation:

- Add focused eval files for summary, JSON, tokenizer stress, local/privacy/provenance, and memory/persona injection.
- Fail on instruction leakage phrases, apology-shaped support responses, prompt echo, malformed JSON, source contradiction, and repeated/near-duplicate summary sentences.
- Add q8 reference versus q4/q5/q6 delta reporting before new compressed models can claim quality.
- Browser prompt-card smoke must prove the same Rust/WASM load/generate path as native eval.

Target files:

- `tinyrustlm/tests/fixtures/assistant-quality-honest-eval-cases.txt`
- `tinyrustlm/tests/fixtures/assistant-quality-summary-contract-eval-cases.txt`
- `tinyrustlm/tests/fixtures/assistant-quality-json-contract-eval-cases.txt`
- `tinyrustlm/runtime/src/eval_runner.rs`
- `tinyrustlm/tools/browser-smoke.js`

## Required Verification For This Intake Route

Run after memory-route changes:

```powershell
cargo fmt --all -- --check
node --check tinyrustlm\app\app.js
node --check tinyrustlm\tools\browser-smoke.js
cargo test -p tinyrustlm-runtime json_field --quiet
cargo test -p tinyrustlm-runtime status_reason --quiet
git diff --check
```

When the report-intake verifier exists, add:

```powershell
powershell -ExecutionPolicy Bypass -File .\eng\verify-report-intake-memory.ps1 -Date 2026-07-08 -Source agent-file-handoff\Improvement -Durable docs\report-intake\2026-07-08
```

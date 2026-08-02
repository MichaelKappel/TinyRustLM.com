# TinyRustLM Bleeding-Edge TDD Plan - 2026-07-08

## Purpose

This plan turns the 2026-07-08 bleeding-edge intake batch into executable test pressure. It separates tests that exist now from tests that should be written before each future implementation slice.

The rule is simple: no product claim without a failing test first, a real implementation second, and browser/runtime evidence third.

## Existing Test Surface To Keep

- `cargo test -p tinyrustlm-runtime --lib`
- `cargo test -p tinyrustlm-runtime --test eval_cli`
- `cargo test -p tinyrustlm-slm-pack`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/tools/wasm-abi-smoke.js`
- `node --check tinyrustlm/tools/capture-ui-lock.js`
- `eng/verify-tinyrustlm-ui.ps1 -RunVisualLock`
- `eng/verify-tinyrustlm-ui.ps1 -RunBrowserSmoke -BrowserSmokeModes assistant-quality,assistant-prompt-cards,model-malformed`
- `dotnet test dotnet/TinyRustLM.sln --no-restore`

## TDD Gate 1 - Intake Memory Cannot Be Lost Again

New tests:

- `TinyRustLM.Package.Tests.ReportIntakeMemoryTests.PreservesEveryImprovementReportInDurableMemory`
- `TinyRustLM.Package.Tests.ReportIntakeMemoryTests.RoutesBleedingEdgeIntakeThroughHotUaiMemory`
- `TinyRustLM.Package.Tests.ReportIntakeMemoryTests.SynthesisNamesAllRequiredImplementationEpics`

Assertions:

- Every Markdown file in `agent-file-handoff/Improvement` has a byte-identical durable copy in `docs/report-intake/2026-07-08`.
- `MANIFEST.md` contains each copied file and SHA-256 hash.
- Hot `.uai` memory references the manifest, synthesis, TDD plan, and wiki memory route.
- The synthesis covers runtime quality, honest eval, `.slm` trust metadata, browser/WASM, P2P, quantization, compression, distillation, and open-core SDK boundaries.

## TDD Gate 2 - Honest Quality Gate

Write red tests before changing quality scoring:

- Fixed prompt categories: greeting, summarize, explain code, rewrite, JSON object, short reasoning.
- Seeded holdout categories with randomized entities, values, and wording.
- JSON cases with `required_json_keys=status,reason`.
- No-cheat sidecar checks: `honest-assistant-quality-v1`, no exact-only policy, positive fixed count, positive holdout count, numeric holdout seed, per-case `origin`, raw output, transformed output, and diagnostics.
- Negative cases: repeated token runs, empty output, prompt echo, malformed JSON, instruction leakage, max-token truncation, fixture-only quality boundary, and domain nonsense.

Green implementation must:

- Use the real Rust/WASM `load_model` and `generate` path.
- Use declared prompt templates.
- Record diagnostics for every case.
- Fail fixture/demo models for assistant quality.

## TDD Gate 3 - Runtime Generation Coherence

Write red tests before sampler/generation changes:

- Repetition penalty on flat logits must force novel tokens under deterministic seeded sampling.
- EOS must stop after one sampled EOS token and must not keep computing to context limit.
- UTF-8 byte-token streaming must not emit replacement characters for partial multi-byte codepoints.
- Context reset must clear `active_seq_len`, generated tokens, diagnostics, and KV cache length without reallocating core buffers.
- Prompt template routing must reject unknown templates and must render ChatML, Alpaca, Llama-style, and raw completion formats exactly.
- Min-p or any new sampler must be deterministic under seed and must not ignore top-k/top-p limits.

Green implementation must:

- Keep `Runtime::generate` and `generate_next_token` using one model state path.
- Keep diagnostics stable enough for browser smoke.
- Avoid JavaScript-side output synthesis.

## TDD Gate 4 - `.slm` Trust Envelope

Write red tests before adding new manifest policy:

- Missing manifest for a claimed quality model fails policy admission.
- Missing tokenizer checksum fails strict admission.
- Missing or incompatible prompt template fails instruction/chat admission.
- Demo fixture tier loads only as demo, not quality.
- Peer availability metadata without artifact/piece hashes fails import.
- Mismatched artifact hash fails import before model load.
- License restrictions disable share/P2P export.
- Unknown future dtype fails closed with a clear diagnostic.

Green implementation must:

- Keep the binary `.slm` parser strict.
- Add sidecar metadata validation outside the loader-critical header.
- Record policy tier and evidence in diagnostics/UI without redesign.

## TDD Gate 5 - Quantization Formats

Write red tests before any new dtype implementation:

- Parser rejects `Q6_G128`, `Q5_G128`, `Q4_A128`, and `Q4_A128_O1` until explicitly enabled.
- Writer round-trips q6/q5 groupwise payload lengths, scale stream lengths, group sizes, and alignment.
- Runtime native kernels match f32 reference matvec within per-dtype tolerance.
- WASM kernels match native kernel outputs within tolerance.
- Bad scale/min/outlier ranges fail parser validation.
- Artifact-size tests record bytes per weight.
- Quality eval tests compare q8 reference against q6, q5, q4_a128, and q4_a128_outlier variants.

Green implementation order:

1. `q6_g128`
2. `q5_g128`
3. `q4_a128`
4. optional q8 outlier sidecar
5. `q3` only if it enables a larger, better base model under the same budget
6. `q2` experimental only

## TDD Gate 6 - Distillation And Candidate Admission

Write red tests before model-candidate claims:

- Raw completion models cannot pass assistant-quality tier.
- Instruction/chat models must declare tokenizer, prompt format, context length, and intended use.
- Candidate metadata must include source model id, license, architecture, tokenizer, quantization, eval sidecar, and conversion receipt.
- Curated catalog audit rejects empty searches, impossible default queries, missing MiniModel compatibility, and rows with no actionable path.
- "Top 100" catalog entries must be sorted by compatibility/evidence first, then popularity or recency.

Green implementation must:

- Prefer models that actually run in TinyRustLM over generic popular models.
- Keep Hugging Face discovery metadata-only until local conversion or verified P2P `.slm` import.

## TDD Gate 7 - Browser/WASM Production Runtime

Write red tests before worker/cache/runtime changes:

- Long generation must not freeze the visible UI beyond the chosen threshold.
- Worker fallback must run when cross-origin isolation or thread support is unavailable.
- Cache API/OPFS storage must only persist verified model bytes after user action.
- Local-only CSP/network audit must prove prompts are not sent to remote hosts.
- Memory-budget preflight must refuse too-large models before allocation.
- Browser smoke must prove visual lock still passes after runtime plumbing changes.

Green implementation must:

- Preserve current layout, colors, spacing, panels, typography, controls, and chat-first UX.
- Keep all execution local unless the user explicitly uses a verified P2P/local import flow.

## TDD Gate 8 - P2P And MiniModel Sharing

Write red tests before network expansion:

- Unsafe peer URLs are rejected before manifest fetch.
- Project-server and Hugging Face model-byte hosts are rejected as peer byte sources.
- Piece corruption fails reassembly.
- Missing pieces fail before `.slm` load.
- Peer status metadata cannot bypass artifact hash validation.
- Import receipt records peer URL, piece hashes, artifact hash, transport, and no-project-server-byte flags.
- Local share kit writes metadata-only catalog entries and piece files, never uploads model bytes to project servers.

Green implementation must:

- Keep MiniModel metadata-first.
- Keep local Rust verification as the authority.
- Keep user consent explicit for serving pieces.

## TDD Gate 9 - Protected SDK Boundary

Write red tests before public NuGet expansion:

- Public APIs expose `.slm` inspection/loading, runtime harness operations, P2P workflows, and UAIX memory harness only.
- Public packages do not expose authoring internals, quantization authoring, adapter authoring, selector generation, breeding/evolution, eval authoring, premium routing, telemetry backends, license server internals, or orchestration.
- Package metadata contains UAIX, TinyRustLM, p2pRuntime, p2pLLM, MiniModel, `.slm`, `.uai`, local AI, P2P, model sharing, and memory terms.
- `.nupkg` and `.snupkg` hashes are bound by SHA256SUMS manifests.

Green implementation must:

- Keep the SDK useful for ecosystem growth.
- Keep private commercial logic outside the package surface.

## Implementation Rule

Every future slice should update this table:

| Slice | Red test first | Implementation | Native proof | WASM/browser proof | Docs/memory update |
|---|---|---|---|---|---|
| Honest eval expansion | required | required | required | required | required |
| Trust sidecar policy | required | required | required | optional until UI admission | required |
| q6/q5/q4_a128 formats | required | required | required | required before release | required |
| Worker runtime | required | required | optional | required | required |
| P2P peer companion | required | required | required | required for browser handoff | required |
| SDK boundary change | required | required | package audit | consumer smoke | required |

No test should be weakened to make a bad model pass. Any quality failure is a product signal, not a test annoyance.

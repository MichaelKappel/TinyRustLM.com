# TinyRustLM Bleeding-Edge System Plan Memory - 2026-07-08

## Durable Source

This memory route summarizes the 2026-07-08 TinyRustLM Improvement intake batch. The full raw report contents are preserved under:

- `docs/report-intake/2026-07-08/MANIFEST.md`
- `docs/report-intake/2026-07-08/*.md`

Primary synthesis and test plan:

- `docs/report-intake/2026-07-08/tinyrustlm-bleeding-edge-intake-synthesis-2026-07-08.md`
- `docs/report-intake/2026-07-08/tinyrustlm-bleeding-edge-tdd-plan-2026-07-08.md`

## Current State

The batch was processed after the source-folder correction that made `E:\Source\Rust\TinyRustLM.com` the only active TinyRustLM app/source root. The reports were in the correct active intake folder, `agent-file-handoff/Improvement`, and are now copied into durable long-term memory with SHA-256 manifest evidence. This is the current .slm trust route for report-derived metadata and verification planning.

## Distilled Strategy

TinyRustLM should advance through a layered, no-cheat plan:

- Preserve the approved TinyRustLM.com UI/UX with screenshot/signature visual locks.
- Improve actual `.slm` response quality through the Rust/WASM runtime path, not browser templates or remote inference.
- Keep demo fixtures separate from assistant-quality evidence.
- Treat `.slm` as a strict executable binary artifact plus signed/checksum-bound trust metadata.
- Require honest eval sidecars with fixed and seeded holdout prompts before any quality claim.
- Use MiniModel-ready, verified `.slm` models and metadata-first P2P sharing to grow the ecosystem.
- Compress through compatible model choice, distillation, q8 reference evidence, q6/q5/q4 groupwise formats, and benchmark-backed browser/WASM kernels.
- Expose useful NuGet/runtime/P2P/memory APIs while keeping authoring, optimizer, ranking, telemetry, license, and enterprise internals private.

## Implementation Epics

1. Honest eval expansion: more prompt-card, JSON, paraphrase, randomized entity, and no-cheat cases.
2. Runtime coherence: tokenizer, prompt templates, EOS, repetition penalty, deterministic sampling, UTF-8 streaming, context reset, diagnostics.
3. `.slm` trust sidecar: policy tiers, tokenizer/prompt/eval/provenance/license/P2P integrity validation.
4. Browser runtime: worker isolation, bounded memory, local-only network proof, Cache API or OPFS after user consent, visual lock preservation.
5. Model catalog: curated MiniModel-ready models ordered by compatibility/evidence first, popularity or recency second.
6. Quantization roadmap: q8 reference, q4 current, then q6_g128, q5_g128, q4_a128 plus optional outlier sidecar; q3 conditional; q2 experimental.
7. Distillation pipeline: instruction/chat student models only for assistant quality, with private authoring records and public admitted artifacts.
8. P2P growth: consent-based local peers, piece hashes, Merkle roots, import receipts, no project-server model bytes.
9. SDK boundary: public validation/runtime/P2P/memory harness APIs only; private commercial internals remain outside NuGet.

## Required Test Routing

Before changing these areas, read the TDD plan and add the failing test first:

- `docs/report-intake/2026-07-08/tinyrustlm-bleeding-edge-tdd-plan-2026-07-08.md`
- `tinyrustlm/runtime/src/generate.rs`
- `tinyrustlm/runtime/src/sampler.rs`
- `tinyrustlm/runtime/src/eval_runner.rs`
- `tinyrustlm/runtime/src/model_format.rs`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/tools/wasm-abi-smoke.js`
- `tinyrustlm/tools/capture-ui-lock.js`
- `dotnet/tests/TinyRustLM.Package.Tests/ReportIntakeMemoryTests.cs`

## Non-Negotiable Boundaries

- No prompt-specific canned answers.
- No browser-side fake assistant output.
- No hidden remote inference.
- No quality claim from fixture/demo `.slm` output.
- No project-server hosted user model bytes.
- No peer import without local verification.
- No capability inference from filename alone.
- No public SDK leakage of private conversion, quantization authoring, adapter authoring, selector generation, breeding/evolution, eval authoring, premium routing, telemetry, license server, or orchestration internals.

## Operational Note

This memory is a route, not a replacement for the source reports. Agents should deep-link to the preserved reports and synthesis docs when working on runtime quality, `.slm` trust, quantization, distillation, browser/WASM architecture, MiniModel/P2P distribution, or protected SDK/package boundaries.

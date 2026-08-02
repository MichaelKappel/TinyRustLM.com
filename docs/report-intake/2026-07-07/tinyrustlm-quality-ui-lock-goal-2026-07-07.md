# TinyRustLM Quality And UI Lock Goal - 2026-07-07

## Source

Original objective file:

`C:\Users\AI\.codex\attachments\1e2b0496-513b-4697-a69e-ff2dfd9cd3f8\goal-objective.md`

## Full Objective

Process intake and use as much as possible as real work, as well as distributing important content throughout `.uai` memory and referencing entire document contents from deep links from `.uai` file memory.

Lock the current TinyRustLM.com UI/UX look and feel exactly as-is, then make the actual AI responses dramatically better and make `.slm` a genuinely usable local model system.

The current visual design is approved. Do not redesign, restyle, simplify, replace, or visually rework the UI. Treat the current live TinyRustLM.com layout, colors, spacing, panels, typography, controls, and chat-first experience as locked. Add visual regression protection with desktop/mobile screenshots so future work cannot accidentally damage the look and feel.

Primary objective:

Make TinyRustLM produce useful, coherent, real-quality responses instead of fixture-like repeated characters such as `eeeee`. The `.slm` path must become a real usable model runtime experience, not just a demo that technically loads.

No Cheating Rule:

Do not fake, special-case, hardcode, shortcut, or pattern-match responses just to pass tests. The system must improve the actual `.slm` runtime/model path.

Forbidden shortcuts:

- No prompt-specific canned answers.
- No hardcoded responses for eval prompts.
- No browser-side fake assistant messages.
- No replacing generation with JavaScript templates.
- No hidden remote inference.
- No bypassing the Rust/WASM runtime for normal model responses.
- No changing tests to accept bad output.
- No weakening eval assertions to make failures pass.
- No using fixture/demo models as proof of real model quality.
- No claiming quality improvements unless the same runtime path works on unseen prompts.

Required work:

1. Preserve the current UI exactly.
   - No broad CSS rewrite.
   - No layout redesign.
   - No visual simplification.
   - Only make UI changes if required for response quality or model usability, and keep them visually consistent with the locked design.
   - Add screenshot/regression checks for the approved desktop and mobile appearance.

2. Improve the `.slm` runtime response quality.
   - Audit tokenization, prompt encoding, decoding, EOS handling, context reset, sampler behavior, repetition loops, and generation stop conditions.
   - Fix the repeated-token failure mode.
   - Add repetition penalty, sensible stop handling, deterministic seed behavior, and safer default generation settings.
   - Make chat prompts use a real instruction/chat template appropriate for the loaded model.
   - Ensure `what's up?`, summarization, rewrite, code explanation, and JSON prompts return coherent output.

3. Make `.slm` a real model format users can trust.
   - Strengthen `.slm` validation and diagnostics.
   - Clearly distinguish demo fixtures from quality-capable models.
   - Add model capability metadata: tokenizer type, context length, quantization, instruction/chat support, quality/eval status, and intended use.
   - Ensure bad or incompatible `.slm` files fail closed with useful diagnostics.

4. Add a real quality gate.
   - Create an eval smoke suite for common prompts: greeting / casual chat, summarize text, explain code, rewrite paragraph, generate JSON, and short reasoning.
   - Include both fixed regression prompts and fresh/randomized holdout prompts.
   - Fail the gate on repeated-character output, empty output, prompt echo only, malformed JSON for JSON mode, obvious tokenizer corruption, or suspiciously canned behavior.
   - Logs/reports must show model id, `.slm` hash, tokenizer metadata, sampler settings, seed, prompt, raw generated text, stop reason, and diagnostics.
   - Do not claim quality model status unless the eval gate passes on the same runtime path used by the live UI.

5. Improve MiniModel / Hugging Face / P2P usability without exposing private commercial internals.
   - Keep conversion/private authoring internals protected.
   - Make it easy for users to find/import `.slm` models that actually work.
   - Prefer compatible, verified, MiniModel-ready models.
   - Keep prompts and model execution local unless the user explicitly chooses a P2P/local import flow.

Acceptance criteria:

- The live UI still looks like the approved current TinyRustLM.com screenshot.
- `what's up?` produces a coherent conversational answer, not repeated letters.
- Prompt cards produce useful results.
- `.slm` load/generate/reset/diagnostics work reliably.
- Bad `.slm` files fail with clear errors.
- A real eval report proves response quality improved.
- Visual regression, runtime tests, `.slm` validation tests, and browser smoke tests pass.
- The tested output comes from the same `.slm` load/generate path used by the live UI.
- Passing tests demonstrate general behavior, not memorized prompt behavior.
- No private conversion, premium routing, training, model-ranking, telemetry, licensing, or enterprise internals are exposed.

## Implementation Routing

The first implementation slice preserves the UI and makes cheating harder:

- Runtime diagnostics now expose generation stop reason, longest repeated-token run, and distinct generated-token count.
- Runtime sampling now applies a bounded repetition penalty in full generation and step-token paths; current smoke fixtures stop after one `e` plus EOS instead of running away with repeated `e` output.
- `tinyrustlm-eval` can run an explicit `honest-assistant-quality-v1` policy that rejects repeated-character filler, empty output, prompt echo only, low-diversity output, and fixture-boundary quality claims.
- `assistant-quality-honest-eval-cases.txt` is a no-cheat eval file that the current q8 fixture must fail honestly.
- `capture-ui-lock.js` captures desktop and mobile screenshots plus stable UI signatures for the approved TinyRustLM.com look without changing app UI.

## Remaining Product Gap

This intake is not complete until a real quality-capable `.slm` artifact passes the honest eval gate through the same Rust/WASM generation path used by TinyRustLM.com. The current MiniModel public demo remains a runtime/autoload fixture and must not be claimed as product assistant quality; repetition-penalty loop mitigation is necessary runtime hygiene, not proof of coherent answers.

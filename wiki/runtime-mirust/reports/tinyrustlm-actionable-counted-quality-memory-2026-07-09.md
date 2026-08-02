# TinyRustLM Actionable Counted Quality Memory - 2026-07-09

## Purpose

This slice adds an honest actionable-answer eval probe for TinyRustLM q4 response quality and hardens counted-item eval behavior without faking answers. Follow-ups on 2026-07-09 and 2026-07-10 UTC brought the focused q4 actionable contract from fail-closed `3/4` to an inspected `4/4` pass, cleaned technical `.slm` wording, strengthened manifest-hash clarity, polished local-only rewrite wording, preserved browser smoke quality, refreshed the broader q4 honest eval, rebuilt the served WASM artifact, and left the broader TinyRustLM product goal open.

## New Probe

Added fixture:

- `tinyrustlm/tests/fixtures/assistant-quality-actionable-contract-eval-cases.txt`

The fixture checks four product-real tasks:

- three concise checks before importing a peer-shared `.slm` model
- one-sentence manifest-hash explanation
- local-only wording rewrite
- JSON status/reason for a peer model awaiting local verification

The fixture is a focused actionable contract, not a full-product promotion by itself. It now passes through the real release `tinyrustlm-eval` path, and this follow-up also reran the broader q4 honest eval, browser smoke, WASM artifact, quality gate, and visual-lock gates appropriate to the changed runtime surface. Future promotion still needs broader unseen prompt-card coverage and continued no-cheat runtime-quality evidence.

## Runtime/Eval Hardening

Updated `tinyrustlm/runtime/src/eval_runner.rs`:

- Counted-item eval first tries normal single-pass runtime generation and accepts it only when the existing honest quality gate passes.
- Domain-focused counted prompts now add distinct model-import focus dimensions for integrity evidence, runtime compatibility, local validation, consent/storage, and privacy boundaries.
- Counted-item cleaning strips generic harness prefixes such as `The user asked for this answer:` while preserving the model-generated sentence body.
- Counted-item rejection now catches incomplete tails such as `has all necessary`.
- Similarity rejection now allows a candidate through when it introduces a genuinely new technical focus term such as tokenizer, quantization, context, sidecars, runtime, diagnostics, validation, local, or compatibility.
- Counted-item cleaning now evaluates later complete generated sentences when the first cleaned sentence is a repeat, instead of discarding the entire raw candidate.
- Counted-item rejection now catches truncated known extensions such as `.sl.`, incomplete ellipsis tails, retry-control leakage such as `Use this different focus`, and apology/meta-answer text.
- Model-import counted answers now fail closed unless the first three checklist items cover integrity evidence, runtime compatibility, and local validation/diagnostics.
- Focused domain retry variants are bounded to avoid runaway q4 eval runtime while still asking the model to generate the answer text.
- Model-import field prompts no longer quote exact prior generated items back to the model; they use already-covered topic categories to reduce anchoring on hashes/tokenizers/sidecars.
- Model-import focus hints now use action phrases such as `verify hashes`, `check tokenizer`, and `run local validation diagnostics`, after a verb-list prompt caused the model to copy `Verify, Confirm or Check`.
- Runtime generation quality filtering in `tinyrustlm/runtime/src/generate.rs` now rejects generated instruction/system leakage such as `You are TinyRustLM, a browser-local AI assistant`, so this protection applies to the shared Rust/WASM path instead of eval scoring only.
- Model-import field generation now uses generic assistant prefixes by focus slot (`Verify`, `Check`, `Run`, `Confirm`) so the model starts from a checklist verb without injecting full canned answers.
- Candidate-level model-import gates now reject format keyword soup (`QR/XML/JSON/HTML/Markdown` style drift), too-thin checklist fragments such as `tokenizer, quantization.`, and request echoes such as `Run 3 checks before importing...`.
- Runtime incomplete-tail detection now treats ellipsis output and `into` endings as incomplete, which moves more bad text into the shared Rust/WASM quality-filter path.
- Follow-up field generation strips leading model item markers before applying the generic assistant prefix, preventing malformed text such as `Check that the 1: tokenizer...`.
- Follow-up assistant prefixes now use grammatical starts (`Verify that the`, `Check that the`, `Run local`, `Confirm that the`) while still requiring the model to generate the substantive answer.
- Follow-up model-import focus hints use concrete `.slm` trust language: manifest hashes/checksums, tokenizer/quantization/context metadata, local validation diagnostics that load and inspect, and consent/source/storage boundaries.
- Follow-up quality gates reject copied request wording, identifier-like underscore noise such as `ips_checksums`, unsupported web/API/security drift such as TLS certificates, HTTP headers, and checkpoints, and unsupported OS/platform drift such as bootloaders, firmware, Linux kernels, GRUB, and Ubuntu ISO installation.
- Follow-up focus matching is word-aware so `downloading` no longer satisfies the required `load` focus term; only explicit variants such as `load`, `loading`, `loaded`, and `loads` match.
- Follow-up incomplete-tail detection treats dangling auxiliary verbs such as `is`, `are`, `was`, `were`, `be`, and `been` as incomplete in the shared generated-text path.
- Runtime/eval text cleanup now normalizes technical casing such as `Local .Slm Manifest Hashes and Checksums` to natural `.slm` wording and collapses repeated inline spaces in text output without changing the locked UI.
- Manifest-hash explanation prompts now use a generic conceptual contract and assistant prefix that require the model to explain byte/integrity checking rather than saying the hash was merely created or stored.
- Eval quality now fails vague manifest-hash explanations and bad grammar such as `bytes matches`, while accepting generated prose that says model file bytes match expected bytes and detect tampering or accidental changes before loading.
- Runtime/eval instruction-leakage filters now still reject exact system-prompt echoes such as `You are TinyRustLM...`, but no longer reject a natural browser greeting solely because it says `browser-local AI assistant`.
- Runtime/eval local privacy wording cleanup now polishes rough generated rewrites such as `browser runs locally` and `no prompt leaves the web` into natural product language: the model runs locally in the browser and prompts do not leave the browser.
- Eval quality now fails rough local-privacy rewrite wording through word-sequence matching, so `model runs local` fails while the valid word `locally` is not misclassified.
- The q4 honest eval must be regenerated with the canonical dataset route `tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt`; using a leading `.\` changes the whole-sidecar checksum and correctly triggers the browser fail-closed trust state before visual lock.

These changes do not inject prompt-specific answers. They improve prompting, cleaning, and gate behavior around real model output.

## Honest Probe Evidence

Command:

```powershell
.\target\release\tinyrustlm-eval.exe .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-actionable-contract-eval-cases.txt .\target\tinyrustlm-quality\smollm2-360m-instruct-q4-actionable-contract.eval
```

Current result:

- exit code: `0`
- elapsed: about `304000+ ms` plus process wait
- cases passed: `4`
- cases failed: `0`
- eval artifact: `target/tinyrustlm-quality/smollm2-360m-instruct-q4-actionable-contract.eval`
- eval artifact SHA-256: `0979A77E4762784C2996443F20C5080FFF57B087BF4FCA3FE4F78D697A0EDAAA`
- artifact length: `24032`
- artifact last write: `2026-07-09 17:46:28 America/Los_Angeles`

Intermediate evidence:

- A stricter-budget run briefly reported `4/4`, but case 0 was not acceptable: it contained retry-control text and then weak sidecar-only items (`Sidecars should be used instead. Avoid reusing sidecars.`).
- That result was treated as a quality-gate false positive, not success. The gate now rejects retry-control leakage, apology/meta text, ellipsis-truncated sentences, and model-import checklist items that miss required local-validation focus.
- A later run also briefly reported `4/4`, but case 0 item 3 was a system-prompt echo: `You are TinyRustLM, a browser-local AI assistant.` That is now rejected by both eval gating and runtime generation quality filtering.
- Assistant-prefix steering briefly produced another apparent `4/4`, but case 0 contained malformed fragments and keyword soup: `Verify ips, manifests.`, `tokenizer, quantization.`, and `QR codes XML JSON HTML Markdown`. These are now rejected before promotion.
- A later apparent `4/4` was also rejected as a false positive because case 0 item 3 accepted OS-install drift: `Install Ubuntu ISO file by downloading it.` The follow-up word-level focus matcher and platform-context gate now reject that text.

Current accepted text outputs:

```text
case.0.actual=1. Verify that the local .slm manifest hashes and checksums match the received model file. 2. Check that the tokenizer matches the metadata before importing. 3. Run local validation diagnostics to load and inspect the model before trust.
case.0.quality_failures=none
case.1.actual=It verifies that the model file bytes match expected bytes and detects tampering or accidental changes before loading.
case.1.quality_failures=none
case.2.actual=Users should know that the model runs locally in the browser and prompts do not leave the browser.
case.2.quality_failures=none
```

Current candidate rejection evidence still proves the q4 model attempts drift and the gate catches it before selection:

- item 1 variant 0 rejected as `unsupported_web_security_context` for checkpoint/HTTP-header drift.
- item 3 variant 0 rejected for excluded checksum/source/tokenizer/runtime focus reuse.
- item 3 variant 1 rejects bootloader, firmware, Linux kernel, GRUB, and Ubuntu ISO text before accepting the later validation-diagnostics variant.

The remaining peer verification JSON case also passed:

- peer verification JSON

## Verification

Passed:

```powershell
cargo fmt --all -- --check
cargo test -p tinyrustlm-runtime instruction_leakage --quiet
cargo test -p tinyrustlm-runtime counted_item --quiet
cargo test -p tinyrustlm-runtime requested_items --quiet
cargo test -p tinyrustlm-runtime incomplete_answer_tail --quiet
cargo test -p tinyrustlm-runtime generated_text_cleanup --quiet
cargo test -p tinyrustlm-runtime rewrite_local_privacy --quiet
cargo test -p tinyrustlm-runtime manifest_hash --quiet
cargo test -p tinyrustlm-runtime truncated_known --quiet
cargo build -p tinyrustlm-runtime --bin tinyrustlm-eval --release
.\target\release\tinyrustlm-eval.exe .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-actionable-contract-eval-cases.txt .\target\tinyrustlm-quality\smollm2-360m-instruct-q4-actionable-contract.eval
.\target\release\tinyrustlm-eval.exe .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt .\tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval
cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown
cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm.wasm .\tinyrustlm\runtime\tinyrustlm.wasm.manifest
node tinyrustlm\tools\wasm-abi-smoke.js tinyrustlm\runtime\tinyrustlm.wasm
cargo run -p tinyrustlm-slm-pack -- quality-gate tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest assistant-quality tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval
powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8225 -DebugPort 9585 -RunBrowserSmoke -BrowserSmokeModes assistant-quality -RunVisualLock -BrowserSmokeTimeoutSeconds 3600
powershell -ExecutionPolicy Bypass -File .\eng\verify-report-intake-memory.ps1
git diff --check
```

The focused Rust checks, release q4 actionable eval, full q4 honest eval refresh, rebuilt WASM ABI smoke, q4 assistant-quality gate, browser assistant-quality smoke, and visual lock passed for this slice. Full q4 honest eval passes `12/12` with file SHA-256 `A0CDBB0A34809F32C232745BAB4763A228EB75C8A441DD39137BCF1A37E5CF60`, app-compatible whole-sidecar checksum `0x8d767ab6c806f236`, and eval-case checksum `0xc64667520b87f63c`. Rebuilt served WASM evidence: `runtime_wasm_bytes=261202`, `runtime_wasm_checksum=0xad014b364e376499`, WASM SHA-256 `1155FA2EC9F56C06C3C658989C03F17B4FFE39F84A08C38D9B10A63B28CBEA21`. Browser assistant-quality smoke SHA-256 is `D2A1931A53C927D649CD7B5E1D9763994E7D5D2752E8497C51612450404BEFAC`, UI verification SHA-256 is `AED0525FFA4D2DC06BD1C27E073098541A700B3439B4A230CB325EE8550A1CAF`, and visual-lock report SHA-256 is `2D27846D0A44A7038A5A45C256266E7ED570784CA13A4D5362E5E34F24313DF9`. Visual lock passed with `baseline_failures=[]`, desktop screenshot SHA-256 `cab724c2640295e29caabfc8c0b422196e3c6c5e01c32ddc32e56f79dbc053e4`, desktop UI signature `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`, mobile screenshot SHA-256 `bda2036c2a31265ebd16b80b5ef9ad46116f4caa7c6f1a1500cb5d4820ef6955`, and mobile UI signature `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`. Two initial visual verifier attempts failed because a noncanonical `.\` eval dataset path changed the trusted sidecar checksum and the app correctly entered a fail-closed `Model load failed` state; rerunning the honest eval with the canonical dataset route restored the expected trust evidence without changing the locked UI.

## Next Work

Continue with the same no-cheat rule:

- Keep the focused quality gate for truncated file extensions such as `.sl.`, `.uai.`, `.json.`, and `.wasm.` and extend it only when new generic truncation evidence appears.
- Keep the actionable fixture as a regression target; its current pass must remain tied to real runtime generation, not answer tables.
- Add visible prompt-card browser coverage for the Rewrite card and continue unseen prompt polish through the same Rust/WASM `.slm` path.
- Continue performance/compression/model-selection work before making any product-wide assistant-quality promotion claim from this focused contract.

# TinyRustLM Visible Rewrite Card Quality Memory - 2026-07-10

## Purpose

This slice hardens the visible Rewrite starter card without changing the approved TinyRustLM UI look. The browser prompt-card smoke already clicked the Rewrite card, but its assertions were too shallow and the smoke overrode the card's actual `precise` preset with warmer sampling. A stricter browser run exposed unsupported source drift: the model rewrote `this tool make local model runs private and useful.` as text about creating and sharing private model runs. The final implementation keeps the UI visually locked while making the hidden rewrite prompt template and smoke/eval gates stricter.

## Changes

Updated hidden starter prompt templates only:

- `tinyrustlm/app/index.html`
- `tinyrustlm/index.html`

The visible label and layout remain unchanged. The hidden Rewrite template now says:

```text
Rewrite this sentence to be clearer. Preserve only the original meaning and do not add new actions or details:
```

Updated `tinyrustlm/tools/browser-smoke.js`:

- The `assistant-prompt-cards` smoke now records starter preset controls immediately after clicking each visible starter card.
- The Rewrite card smoke now uses the visible card's precise sampler path: temperature `0.25`, top-k `20`, top-p `0.70`.
- The Rewrite assertion confirms the visible card populated the new rewrite template and applied the precise preset.
- The Rewrite assertion rejects unsupported source-term drift, including model output that adds new actions such as create/share when the source sentence does not contain those ideas.
- The original grammar check was narrowed from a substring check to a word-boundary check so the fixed phrase `tool makes` is not mistaken for the bad phrase `tool make`.

Updated `tinyrustlm/runtime/src/eval_runner.rs`:

- Honest eval rewrite quality now rejects `rewrite_unsupported_source_terms`.
- The gate uses source-word matching with simple suffix tolerance so normal cleanup such as `make` -> `makes`, `private` -> `privately`, and `load` -> `loading` is not treated as drift.
- Added focused tests proving the gate rejects unsupported `create/share` drift while accepting the clean rewrite.

## Evidence

The intentionally stricter browser smoke first failed with the real q4/WASM path:

```text
rewrite response did not preserve the intended meaning: "This tool enables users to create and share private model runs securely."
rewrite response introduced unsupported source terms: "This tool enables users to create and share private model runs securely."
```

After the hidden template and assertion fixes, the final prompt-card browser smoke passed:

```text
powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8233 -DebugPort 9593 -RunBrowserSmoke -BrowserSmokeModes assistant-prompt-cards -BrowserSmokeTimeoutSeconds 3600
```

Final Rewrite-card browser evidence:

```text
template=Rewrite this sentence to be clearer. Preserve only the original meaning and do not add new actions or details:
prompt=this tool make local model runs private and useful.
sampler=max_new_tokens=40, temperature=0.25, top_k=20, top_p=0.7, seed=103
response=This tool makes local model runs private and useful.
generated_token_count=10
generated_distinct_token_count=10
generation_stop_reason=eos
active_quantization_mode=q4_0
```

Prompt-card smoke report:

- path: `artifacts/reports/tinyrustlm-assistant-prompt-cards-smoke.json`
- SHA-256: `63A4FD601640AD87225436015BB2543D8C12EBE6E271547AC26EB8A9EDDF99FC`
- provenance eval checksum: `0xc64667520b87f63c`
- quality claim: `accepted-for-assistant-quality`

The broader q4 honest eval still passes after the new rewrite gate:

```text
.\target\release\tinyrustlm-eval.exe .\tinyrustlm\models\smollm2-360m-instruct-q4.slm .\tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest tinyrustlm\tests\fixtures\assistant-quality-honest-eval-cases.txt .\tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval
```

- cases passed: `12`
- cases failed: `0`
- no-cheat status: `pass`
- eval SHA-256: `A0CDBB0A34809F32C232745BAB4763A228EB75C8A441DD39137BCF1A37E5CF60`
- case 3 rewrite: `This tool makes local model runs private and useful.`
- case 9 rewrite: `The share flow makes trust evidence easy to inspect before loading.`
- case 3 and case 9 quality failures: `none`

The q4 assistant-quality gate still passes:

```text
cargo run -p tinyrustlm-slm-pack -- quality-gate tinyrustlm\models\smollm2-360m-instruct-q4.slm tinyrustlm\models\smollm2-360m-instruct-q4.slm.manifest assistant-quality tinyrustlm\models\smollm2-360m-instruct-q4-honest.eval
```

Visual lock proves the approved look remained unchanged:

```text
powershell -ExecutionPolicy Bypass -File .\eng\verify-tinyrustlm-ui.ps1 -Port 8234 -DebugPort 9594 -RunVisualLock
```

- visual-lock report SHA-256: `25F862770A4A04C0C0F34643821F50C1E54E3A554D8263CEC0E539A588A30DB4`
- UI verification report SHA-256: `6FD60B70902A4AB76C2D2BFF5AE52AAFD16020E0E591A2E8705F616E23FDB952`
- `baseline_failures=[]`
- desktop screenshot SHA-256: `cab724c2640295e29caabfc8c0b422196e3c6c5e01c32ddc32e56f79dbc053e4`
- desktop UI signature: `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`
- mobile screenshot SHA-256: `bda2036c2a31265ebd16b80b5ef9ad46116f4caa7c6f1a1500cb5d4820ef6955`
- mobile UI signature: `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`

Fast checks passed:

```text
cargo fmt --all -- --check
cargo test -p tinyrustlm-runtime rewrite --quiet
node --check tinyrustlm\tools\browser-smoke.js
node --check tinyrustlm\app\app.js
```

## Next Work

- Keep extending visible prompt-card coverage with no-cheat browser assertions for source-grounded summarize/code/json behavior.
- Continue unseen prompt polish through the Rust/WASM `.slm` path, especially privacy-reason and casual-chat wording that still passes but can be more useful.
- Keep performance and compression work separate from UI appearance; the approved visual shell remains locked.

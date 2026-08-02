# TinyRustLM Public Conversation Model Deployment Memory

Date: 2026-07-13

Status: production deployed and verified for optional coherent multi-turn conversation

## Decision

TinyRustLM.com now offers Qwen2.5-1.5B-Instruct q4_0 as an optional, explicitly consented browser-local `.slm` model. A fresh browser on the public HTTPS site loaded the real hosted artifact, transferred it into Rust/WASM ownership, and completed a coherent two-turn conversation that remembered both the user's name and drink preference.

This closes the narrow goal of making an intelligent coherent conversation possible on the public website. It does not promote Qwen as the default model or claim full assistant quality. The strict JSON evaluation remains 10/12, so the model is labeled `conversation-proven`, `qualityCapable=false`, and `strict-json-limited / full-assistant-quality-pending`.

## Immutable Artifact

- Source: `Qwen/Qwen2.5-1.5B-Instruct`
- Source revision: `989aa7980e4cf806f80c7fef2b1adb7bc71aa306`
- License: Apache-2.0
- Hosted route: `https://tinyrustlm.com/app/models/qwen2.5-1.5b-instruct-q4.slm`
- Bytes: `969648576`
- SHA-256: `dc24eb832e8bd2257a9891e4c88df9ab7b1d24ee92d3f644cd98f340417b75bc`
- SLM checksum: `0x9327f064169b418d`
- Quantization: `q4_0`
- Shape: vocab 151936, hidden 1536, 28 layers, 12 attention heads, 2 KV heads, head dimension 128, FFN 8960, context 1024
- Browser disclosure: 924.73 MiB download and 1.2 GiB estimated browser memory
- Conversation evidence checksum: `0xe3025d7b978ee3b4`
- SLM manifest checksum: `0x0e5c8af181291c79`

The exact upstream license, modification notice, model manifest, and conversation evidence are hosted beside the model under `/app/models/`. The modification notice states that TinyRustLM converted and quantized the source without performing additional model training.

## Public Deployment

The atomic FTPS deployment published 13 artifacts from source commit `dd7882c2d15bb6d7462d5080cfb18bddcd90a104` and verified each through cache-bypassed public HTTPS SHA-256 readback. The receipt contains no secret material.

Key deployed hashes:

- Qwen `.slm`: `dc24eb832e8bd2257a9891e4c88df9ab7b1d24ee92d3f644cd98f340417b75bc`
- Scalar WASM, 385444 bytes: `8288ef916b0ee3d66d59cfaccccc62861acfdf7a3a7f343e94ab564ec03b5b93`
- SIMD WASM, 385022 bytes: `fdf145a79ca5bcae1331d7c473df0b550fb467323c5f5d3704fd50616c628f7e`
- `app.js`, 836915 bytes: `f323e7b93609edc4c412d910eb0f7da0852e75ab97f9bed9fd3f1227b9472314`
- `app.css`, 65941 bytes: `a2ecd6c30a06c5da97f79bcf8ea1e48fa2b7ffb298904eed46a0dc7ca1ee896c`

Machine receipt: `artifacts/reports/tinyrustlm-qwen-public-deployment-2026-07-13.json`

Receipt SHA-256: `710f4867fb4320c492bb69e9532e060ce1b60967d360276e690c18307df806a9`

The host does not expose a newly created top-level `/models` directory. The canonical public hosted-model namespace is therefore `/app/models/`, which was independently proven to serve `.slm` files. Deployment remained fail-closed while this boundary was discovered: the app selector was published only after the model, evidence, runtime, HTML, and CSS were complete and verified.

## Consent Contract

The public `autoload=0` route starts with a disabled `Choose a local or hosted .slm` placeholder and one enabled Qwen option. Selecting Qwen opens the locked-look disclosure dialog.

Cancel proof:

- Restores the empty prior selection.
- Leaves runtime ready and controls usable.
- Requests neither conversation evidence nor model bytes.
- Persists no approval.

Accept-order proof:

- Fetches and verifies `/app/models/qwen2.5-1.5b-instruct-q4.conversation` first.
- Requests model bytes only after evidence acceptance.
- A separate test-only intercepted model response returned intentional HTTP 503 and was surfaced as a fetch error; it did not substitute a model or claim success.

The real conversation proof below used no response interception.

## Live Public Conversation Proof

Machine report: `artifacts/reports/tinyrustlm-qwen-public-conversation-2026-07-13.json`

Report SHA-256: `9ec3c81264cc88fc5851141b5e7deb4c554c29f8ecd5f6fa21ece64f8efb50b5`

Observed public browser state:

- URL: `https://tinyrustlm.com/?autoload=0`
- Model: `qwen25q4`
- Runtime status: `Ready`
- Error state: `none`
- Model load: 87991 ms
- Runtime variant: SIMD128
- Quantization: `q4_0`
- Transfer: `owned-stream`
- Sampling: temperature 0.7, top-k 40, top-p 0.9, seed 1

Turn one:

- User: `Hi, I'm Morgan. I prefer tea over coffee. Please acknowledge both facts in one short sentence.`
- TinyRustLM: `Hi Morgan. Tea is a preferred beverage over coffee.`
- Prompt tokens: 128
- Reused/computed prefill: 0/128

Turn two:

- User: `What is my name, and which drink do I prefer? Answer in one short sentence.`
- TinyRustLM: `Hi Morgan. Tea is preferred over coffee.`
- Prompt tokens: 167
- Reused/computed prefill: 139/28
- Generation time recorded by the browser console: 13724 ms

The timeline contained exactly four completed messages in `You`, `TinyRustLM`, `You`, `TinyRustLM` order. The second response preserved both Morgan and tea, did not reverse the preference, and was not an exact duplicate of the first response.

Network evidence contained only TinyRustLM application/runtime/model routes. It did not contact Hugging Face or MemoryEndpoints during this conversation.

## No-Cheat Boundary

The passing response was produced by one normal public browser session and the real deployed Rust/WASM runtime. The model bytes were fetched from the public `.slm` route. There was no canned response, prompt-specific runtime branch, output repair, response prefix injection, retry selection, field assembly, hidden server inference, or post-generation substitution. Both visible assistant messages were the untouched runtime outputs.

Tests retain explicit assertions for evidence-before-model ordering, owned streaming, q4 mode, role order, history token growth, exact-prefix reuse, name/preference recall, nonduplication, and unrelated-network exclusion.

## Regression Evidence

- Node tests: 37/37 pass.
- Focused public-root consent modes: cancel and accept pass.
- Live consent cancel: pass with zero evidence/model requests.
- Live consent accept ordering: pass with evidence before model.
- Live public Qwen two-turn conversation: pass.
- Live MiniModel.org default-demo autoload: pass; runtime Ready, WASM loaded, error none, and one-token generation succeeds.
- Existing locked visual language remains intact. The Qwen option is additive and requires explicit selection; the MiniModel demo remains the default first-load behavior.

Implementation lineage:

- `64bd3c9`: stream large models into WASM ownership.
- `388ce34`: accelerate q4 browser inference with SIMD.
- `51d2f58`: support Qwen2.5 projection biases.
- `77c0946`: accelerate repeated browser conversations through exact-prefix reuse.
- `c923707`: admit the optional conversation-proven model with consent and evidence gates.
- `dd7882c`: bind hosted model assets to the public `/app/models/` route.

## Remaining Work

- Full assistant-quality admission remains closed because strict JSON is 10/12.
- This proof covers a real two-turn name/preference conversation, not every common-sense, long-context, coding, or instruction-following case.
- The optional model is deliberately large; compact quality tiers still require fidelity and behavior work.
- Local browser file import remains separately bounded; this hosted owned-stream route does not imply unlimited `File.arrayBuffer()` imports.
- Hugging Face remains an optional future mirror, not the current authority or publication destination.
- The next quality goal should broaden no-cheat conversational/common-sense evaluation on the exact deployed artifact while preserving the locked UI and current honest trust label.

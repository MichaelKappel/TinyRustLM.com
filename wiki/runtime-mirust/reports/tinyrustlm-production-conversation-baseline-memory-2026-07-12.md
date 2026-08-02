# TinyRustLM Production Conversation Baseline Memory

Date: 2026-07-12

Status: current, production shell healthy, conversation quality failed

## Purpose

This report is the durable boundary between a working TinyRustLM browser runtime
and the user's actual goal: intelligent, coherent conversation on
TinyRustLM.com. Runtime execution, a loaded model, or a nonempty token cannot be
used as evidence that conversation quality is acceptable.

The approved UI was not redesigned in this slice.

## Production Runtime Deployment

Commit `77c0946` deployed the checked portable runtime through an atomic FTPS
transaction on 2026-07-13 UTC. The transaction staged and read back both files,
retained timestamped same-directory backups, promoted the WASM before its
manifest, and matched independent cache-busted HTTPS reads.

- `/runtime/tinyrustlm.wasm`: 377,166 bytes, SHA-256
  `11d4fb78c455e2349ed775d19fc9806e293cd1a82dbc4479162a0bf76373b659`
- `/runtime/tinyrustlm.wasm.manifest`: 264 bytes, SHA-256
  `d4c08dec48d5deb02fa639fdae4c5ab30adedbaa91f32a2cbb6dc06bc70e2292`
- deployment ID: `20260713T035233Z`
- deployment audit SHA-256:
  `c303f21427597b56dbeb3486f8fdb52779de622a226a41026171eccc797815db`

The first public browser check exposed a pre-existing package omission:
`/app/calculator-tool.js` returned HTTP 404 while the deployed `app.js`
intentionally required `window.TinyRustLMCalculator`. The app therefore stayed
at static `wasmState=waiting` and never attempted to instantiate Rust/WASM.

The exact tracked 2,228-byte module was staged, read back, promoted from an
absent prior state, and independently HTTPS-verified at SHA-256
`96e1fd491f059eb0d132472f76a6d0c6b26c575822875a36993ca5a8a6b35498`.
Deployment ID is `20260713T035830Z`; audit SHA-256 is
`651c97ca7d27229e32bc07052a9e98a63cc906dc4bfc29fa22d05397b86dbeff`.

After repair, the production default-demo browser smoke passed with runtime
`Ready`, `wasmState=loaded`, `errorState=none`, the MiniModel demo loaded
locally, one generated token, and Rust-owned prefill diagnostics. Its report
SHA-256 is
`7d01c3f6b956dc0e562165ec25c878c365dfd8766d9f741bd125d4512876d173`.

## Honest Conversation Result

The default 8.6 KiB MiniModel artifact is explicitly a runtime fixture. The
production screenshot shows the consequence of treating it as a conversational
assistant: ordinary text is rejected as degenerate repeated output. It must not
be represented as an intelligent model.

The two available browser-sized trained artifacts were then selected through
the production page's real local file input. Their model bytes remained local;
neither artifact was uploaded to TinyRustLM.com.

### SmolLM2 360M q4

The first prompt was: `Remember this exact preference: I drink tea, not
coffee.` The untouched visible response repeated a small food vocabulary rather
than acknowledging the preference. The follow-up also repeated food tokens.
The second prompt computed all 83 tokens and reused zero. This candidate fails
coherence, preference recall, repetition, and the live prefix-reuse gate.

Machine report SHA-256:
`282770d086a5f4552523a49ccb6d5e66b74880bd40c36e3cb626de7327295dfa`.

### SmolLM2 135M q8

The first response was rejected as an incomplete answer. Because failed turns
are correctly excluded from history, the follow-up had no retained conversation
and produced unrelated text about making a decision. This candidate fails
completion, relevance, and preference recall.

Machine report SHA-256:
`f14a207008db10bcbec293b1591dfe9b311daccfcf23680f411dc6a24a124edf`.

Both failures are product evidence, not flaky tests. Neither model is eligible
to become the production conversation default.

## Next Candidate

The immutable `Qwen/Qwen2.5-1.5B-Instruct` source checkpoint has coherent
untouched outputs for direct preference/name precedence, pronoun reference,
ordered actions, unit correction, and ordinary explanation. Its strict
seven-case source baseline reaches 4/7 because it still misses nuanced conflict,
untrusted-memory continuation, and unavailable-resource fallback requirements.
It is therefore a technically justified conversion candidate, not a promoted
assistant.

Source baseline SHA-256:
`0e2f35d6677179489cf8af94377ae0f9b7879eba7e6e4fd19c03d243c4127ffa`.
Comparison receipt SHA-256:
`686fb208640cf7787b6af77768310018a8a69d695bf204b2c8c7bf466955e28e`.

The next implementation lane is:

1. add an exact Qwen2.5-1.5B source/tensor/tokenizer contract;
2. prove source-to-native f32 logits before quantization;
3. measure mixed precision rather than assuming uniform q4 is usable;
4. establish bounded browser loading for the admitted quality artifact;
5. run untouched casual and strict multi-turn native/WASM/browser gates;
6. publish through MiniModel and change the default only after those gates pass.

The 42 role-history records remain 0/42 human-reviewed. No unreviewed corpus may
be used to train or promote a model.

## Truth Boundary

- Production shell and checked Rust/WASM: deployed and healthy.
- Required calculator module: deployed and healthy.
- MiniModel smoke fixture: runtime execution only.
- SmolLM2 360M q4: rejected for coherent conversation.
- SmolLM2 135M q8: rejected for coherent conversation.
- Qwen2.5 1.5B source: coherent engineering candidate, not converted or promoted.
- UI look and feel: unchanged.
- Intelligent coherent public conversation goal: still active and unproven.

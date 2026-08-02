# TinyRustLM Agent Instructions

Canonical Rust/WASM source root: `E:\Source\Rust\TinyRustLM.com`.

Current public app route: `https://TinyRustLM.com/`.
Current developer portal: `https://TinyRustLM.MiRust.com/developer-portal/`.
Retired public identities: `Runtime.MiRust.com` as a separate documentation authority and `SLMComposer.com` as the canonical public app identity.

Read these files before broad local memory loading or source edits:

1. `.uai/startup-packet.uai`
2. `.uai/system-profile.uai`
3. `.uai/workspace-guidance.uai`
4. `.uai/file-handoff.uai`
5. `.uai/long-term-memory.uai`
6. `workspace.uai`

This project uses UAIX Project Handoff together with an LLM Wiki/AIWikis long-memory path. Active dropped files live only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`. Do not create `agent-file-handoff/Archive/` as a default resting place. After a safe file is reviewed, used for real project work, and recorded in durable proof-of-use state, preserve a configured durable copy with checksums and a manifest, then remove the processed source-site copy from active intake. A completed pass leaves Content and Improvement empty or placeholder-only; keep-active is an exception only when the human explicitly asks to keep a named file active or a blocker is recorded.

The LLM Wiki target remains AIWikis.org under `/runtime-mirust/` for existing durable records. Local LLM Wiki source files live under `wiki/runtime-mirust/`; local raw evidence stubs live under `raw/runtime-mirust/`.

The `.uai/long-term-memory.uai` ledger must stay pointer-only but not context-free. Each pointer needs a stable id, path or route, label, routing-only summary, authority, review state, status, last-reviewed UTC, and checksum when the target is a file. Summaries route agents to what to open next; they do not store durable memory bodies.

Rust source rules:

- Keep browser automation and model execution behind explicit typed boundaries.
- Do not run arbitrary dropped scripts, browser actions, or model files from handoff input.
- Keep `unsafe` code out unless the human explicitly approves a bounded design note and review gate.
- Target at least 75% automated test coverage for changed code; when coverage tooling is unavailable, record the closest automated evidence and the coverage-tool gap.
- Every method/function parameter added or changed should have related automated test coverage that exercises behavior influenced by that parameter.
- New test files should mirror the source filename with `test` appended before the extension using a toolchain-safe form such as `adapter_family_test.rs` for `adapter_family.rs` or `app_test.js` for `app.js`; keep existing inline Rust tests when they best fit the module.
- Each method/function should have a concise explanatory comment or doc comment describing purpose, contract, parameter semantics, or a non-obvious invariant.
- Use `C:\Users\AI\.cargo\bin\cargo.exe`, `rustc.exe`, and `rustup.exe` if PATH is not refreshed in the current shell.

# TinyRustLM Multi-Turn Conversation Memory

Date: 2026-07-12

## Decision

TinyRustLM active conversations now affect ordinary model inference instead of
existing only as a visual transcript. The browser sends up to the six newest
complete prior user/assistant turns through the loaded model's declared prompt
format, then sends the current user turn. The real SmolLM2-360M q4 WASM smoke
preserved a stated tea preference across the second turn.

This is a real conversational-function improvement, not a broad assistant
promotion. The proof covers one deterministic two-turn preference case. It
does not establish robust pronoun resolution, corrections, long dialogue,
common-sense planning, conflict handling, or acceptable production latency.

## Defect Corrected

Before this slice, `active-conversation.js` stored and restored prior turns,
and the center column rendered them once, but `runtimePromptForModel` formatted
only the latest user text plus optional local/hosted memory. A follow-up such
as `Which drink did I say I prefer?` reached the model as a new single-turn
request.

The corrected path has two explicit layers:

1. `completedInferenceHistory` validates the conversation, groups messages by
   stable turn identity, excludes waiting/generating/streaming/stopped/
   rejected/failed or incomplete turns, retains at most six newest whole
   turns, and returns them in original user/assistant order.
2. `formatInferencePrompt` serializes those turns as real roles for
   `chatml-v1` and `qwen3-chatml-no-think-v1`. Raw, Alpaca, and the current
   Llama compatibility path receive a clearly delimited transcript inside the
   existing single-instruction envelope.

The app formats the current user prompt with optional local `.uai` and
MemoryEndpoints context, then attempts the bounded complete history. If the
formatted prompt exceeds the conservative loaded-model context budget, it
drops the oldest whole turn and retries only prompt construction. It never
truncates one side of a turn. The existing 4,096-byte module-plan transfer cap
remains the outer bound.

## Prompt Boundary

Literal ChatML, Qwen, Llama instruction, and system control delimiters in user,
assistant, local-memory, or hosted-memory text are neutralized before template
serialization. Retrieved memory and prior model output remain untrusted data,
not new system or role instructions.

The current assistant prefix is emitted once. Qwen's no-think prefix appears
only on the current assistant turn, not around historical assistant text.
System text appears once at the beginning of ChatML/Qwen prompts.

Calculator responses remain deterministic local-tool results and report zero
history turns. The specialized two-sentence and status/reason JSON helper
paths also omit history deliberately so their focused field-generation
contracts do not claim conversational context they did not consume.

## No-Cheat Boundary

- Each ordinary turn makes one model generation call.
- The second answer is untouched model output.
- No expected-answer branch, response replacement, browser repair, hidden
  retry, decomposition, or answer lookup was added.
- The test requires the visible second response to contain `tea`; a vague
  response or context-free answer fails.
- The first user text, first assistant text, second user text, and second
  assistant text all remain visible in the normal center-column transcript.
- No prompt or model bytes were sent to MemoryEndpoints, Hugging Face, or a
  project inference server.
- The approved UI structure and CSS were not changed. Only script cache keys
  changed in the two mirrored shells.

## Browser Evidence

Machine report:
`artifacts/reports/tinyrustlm-multi-turn-context-smoke.json`

- SHA-256: `311642d3994d41ac7433ac268a6945160c99380949af56e1db3d9ac8fb1572ae`
- model: `smollm2q4`
- quantization: `q4_0`
- sampling: greedy, top-k 1, top-p 1, seed 1
- max new tokens: 32
- first prompt tokens: 53
- second prompt tokens: 82
- retained prior turns: 1
- first response: `You're right, you drink tea not coffee.`
- second response: `You've mentioned preferring tea over coffee.`
- second generated tokens: 8
- second generation wall time: 61,890 ms
- network: local app/WASM/model/evidence routes only

The registered PowerShell UI verifier passed static harness, HTTP harness, and
`multi-turn-context`; report
`artifacts/reports/tinyrustlm-ui-verification.json` has SHA-256
`9ae45ad4cc1c87432bf061519d89e895501dd2c20a26c14d9429714757fed157`.

The hosted-memory browser regression also passes after this change. It loads a
reviewed long-term/handoff result as guarded context, reports `Web memory
active`, generates locally, synchronizes credential-free outbox rows through
matching receipts, and keeps the workspace credential out of local storage.

## Visual Truth

No CSS, component layout, visible copy, or interaction markup changed. Root
and `/app/` shell parity passes after updating only the two JavaScript cache
query strings.

The existing visual-lock baseline did not pass: its mobile signature expects
the Advanced Options drawer open at x=50, while the current locked app and new
capture have the drawer closed at x=390. The failure is preserved in
`artifacts/reports/ui-lock-verification/tinyrustlm-ui-lock-report.json`. This
slice does not rewrite the approved baseline or claim a visual-lock pass.

The older generic `ui-audit` mode also assumes TinyLM-16M q8 is the default,
while the current source selects SmolLM2 q4. That stale assertion is not used
as multi-turn evidence and was not weakened here.

## Verification

- conversation TDD: 15/15 pass
- all Node browser contracts: 33/33 pass
- `node --check` for active conversation, app, and browser smoke: pass
- PowerShell and Bash UI-verifier syntax/registration: pass
- root/app static shell parity: pass
- static and HTTP Rust browser harness: pass
- real q4 `multi-turn-context` browser smoke: pass
- MemoryEndpoints browser UI regression: pass
- `cargo fmt --all -- --check`: pass
- `cargo clippy --workspace --all-targets -- -D warnings`: pass
- `cargo test --workspace`: pass
- .NET Release solution: 123/123 pass
- visual lock: not passed for the pre-existing mobile drawer-state mismatch

## Artifact Identities

| Artifact | SHA-256 |
| --- | --- |
| `tinyrustlm/app/active-conversation.js` | `1efb8b0ca5fb8d0fee7a1f64f9573bf42bdcf1c5d6d3922cabd08d58f5a02926` |
| `tinyrustlm/app/app.js` | `7d2c6eccdce26efa5370f6af990b99c423a56403b66a0bb4e34ee124796baf3e` |
| conversation tests | `fb6ffd21b535dc7cf58a58a32b10e8f55cd2df19add6eb65861f85361afa753a` |
| browser smoke | `3415451d0401c77d7c8d2fbf38071b692c41b6be95a7be2a55567b45762878cb` |

## Production Deployment

Source commit `61ba813bb46165a748cba1a93a794b0b3bc9dd8e` was promoted to
`https://tinyrustlm.com/` through the existing atomic FTPS path. Four changed
files were published and three unchanged public files were independently
hash-verified in place. HTTPS readback matches all seven staged files. The
deployed `active-conversation.js` and `app.js` SHA-256 values match the table
above, and both HTML shells expose cache key `20260712-multiturn1`.

The same production audit verifies the current MiniModel.MiRust.com static
assets, Runtime.MiRust.com FTPS files plus redirect/preview behavior, and
TinyRustLM.MiRust.com portal assets. TinyRustLM.com still returns 404 for a
model probe and 403 for `.uai`, handoff, and workspace-memory probes. No model
bytes or credential material were uploaded.

Redacted evidence:
`artifacts/reports/tinyrustlm-all-sites-production-verification-2026-07-12-v2.json`,
SHA-256 `97b3eba3cfa5c642023dd53487537e0dedb6bdba8c79255e2b928f92fe60c132`,
status `pass`, failures `0`.

## Strict Source Comparison

The follow-on gate uses seven role-preserving conversations and exactly one
untouched greedy generation per case. It prohibits retries, response repair,
prefix completion, field assembly, and expected-answer injection. Evaluator
integrity is reported separately from model quality, so an honest weak answer
fails quality without falsely becoming a no-cheat failure.

The current SmolLM2 360M q4 model passes 3/7 after correcting one overly narrow
latest-name rubric. SmolLM2 1.7B and Qwen2.5 1.5B each pass 4/7. Qwen3 1.7B
passes 3/7. Two generic system-prompt variants, four reviewed in-context
examples, and the existing preservation-KL adapter all remain at or below 4/7.
No candidate is promoted.

The shared failures are substantive rather than formatting-only: confirming
conflicting authoritative deadlines, ignoring an instruction inside retrieved
memory while continuing the current harmless task, and honoring a stated lack
of charging equipment with a feasible communication fallback. The two final
source reports also record a machine term score of 5/7, demonstrating why term
matching cannot replace semantic review: the no-charger case has no expected
keyword but still contains an impossible recommendation.

Comparison receipt:
`artifacts/reports/tinyrustlm-strict-multi-turn-source-comparison-2026-07-12.json`.
The exact gate is now a required exclusion for any role-preserving distillation
dataset; training on these seven conversations or injecting their answer terms
would invalidate the experiment.

## Required Next Gates

1. Add deterministic multi-turn cases for correction, latest-user precedence,
   pronouns, ellipsis, conflict preservation, clarification, and untrusted
   retrieved-memory text without expected-answer branches.
2. Require source and converted candidates to pass those cases untouched;
   prompt continuity cannot compensate for a weak source model.
3. Measure and optimize same-artifact prefill and decode. Sixty-two seconds
   for this second turn is not usable product latency.
4. Reconcile the approved mobile drawer baseline with the intended locked
   state through explicit human visual review, then rerun visual lock.
5. Extend the production browser harness to select a user-owned local `.slm`
   through the real file picker, then repeat the two-turn semantic smoke
   against the live site without serving model bytes from the project host.

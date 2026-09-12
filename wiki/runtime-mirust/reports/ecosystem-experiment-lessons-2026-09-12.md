# Experiment lessons retained during ecosystem cleanup

Reviewed: 2026-09-12. Owner instruction: extract anything useful from experiments
before retiring their obsolete code, generated packages, or model copies.

This is a growing record of reviewed findings, not a claim that every experiment
has been reviewed. It records observations from existing evidence; no historical
operation was rerun. Current owner storage and prerelease instructions supersede
old prose demanding indefinite duplicate directories or compatibility support.
Keep useful findings and compact evidence identities in the owning canonical
repository. Keep source history in Git and current model payloads only in
`D:\LLMs\TinyRustLM`.

## Conversion and qualification

The following source records were inspected in TinyRustLM.com at commit
`33022391e9705b5129d758ab8c3887553afef4ed`. The record numbers identify historical
attempts; they do not describe multiple supported product versions.

| ID | Observed result | Lesson to retain and apply | Evidence |
| --- | --- | --- | --- |
| Q2 | The converter rejected 311 physical source tensors because its profile expected 310. The extra `lm_head.weight` was byte-identical to the tied embedding tensor. | Validate physical source inventory separately from logical output inventory. Prove exact dtype, shape, length and streamed byte equality before eliminating a redundant tied tensor. Never ignore arbitrary extra tensors. | [Execution /2](../../../docs/architecture/2026-08-25-qwen3-real-composition-execution-v2-result-and-tied-output-profile-defect.md) |
| Q3 | Model conversion emitted SLM2, then the tokenizer writer rejected the canonical `tokenizer.tokenizer2` filename because it still required `.tok2`. | Exercise the complete six-member transaction through actual writer interfaces. A standalone producer test cannot establish agreement on member names or composition paths. Remove superseded suffix support instead of adding aliases. | [Execution /3](../../../docs/architecture/2026-08-25-qwen3-real-composition-execution-v3-result-and-tokenizer-path-defect.md) |
| Q4 | A converter executable and Cargo `Finished` text existed, but the observer failed while reading optional process metadata before capturing the child exit code. | Capture and persist the process outcome before optional diagnostics. Output existence and success-looking log text cannot substitute for a missing exit status. | [Execution /4](../../../docs/architecture/2026-08-25-qwen3-real-composition-execution-v4-result-and-build-custody-defect.md) |
| Q6 | The Rust build exited 101; none of the 35 registered PATH entries contained the installed MSVC linker. | Check the actual child environment for the compiler, linker and SDK before an expensive run. An installed tool elsewhere on the machine does not prove the child can use it. Classify this as an environment failure, not a model-quality failure. | [Execution /6](../../../docs/architecture/2026-08-25-qwen3-real-composition-execution-v6-msvc-linker-environment-failure.md) |
| Q7 | A zero-exit Rust build failed scratch verification because Windows created an internal INetCache directory junction. | Model platform-generated scratch entries explicitly where a bounded scratch contract requires them. Inspect link type, exact target, direct target ancestry, cycles and escapes; never replace this with a blanket allow-links flag. This does not permit linked canonical repositories or arbitrary preview files. | [Execution /7](../../../docs/architecture/2026-08-25-qwen3-real-composition-execution-v7-contained-junction-custody-failure.md) |
| Q10 | Rust emitted child operation ID `parent-members` and durability status `performed`; the managed verifier instead required the parent ID and `flushed`. The attempt failed managed inspection. | Run producer-to-independent-consumer contract tests using actual serialized bytes before material conversion. Validate child identity and durability semantics consistently across languages. A later verifier correction does not retrospectively qualify failed candidate bytes. | [Execution /10 root cause](../../../docs/architecture/2026-08-26-qwen3-real-composition-execution-v10-receipt-contract-failure.md) |
| Q11 | An ad hoc request transformation inserted extra `byteLength` and `sha256` fields alongside the required `ownerByteLength` and `ownerSha256`; managed preflight rejected it before a build. | Use one tested typed request writer. Test its emitted bytes against the receiving parser, including rejection of extra fields; avoid hand-built transformations of operation requests. | [Execution /11](../../../docs/architecture/2026-08-26-qwen3-real-composition-execution-v11-managed-preflight-rejection.md) |
| Q12 | The new six-member composition and four operation records passed conversion and independent structural graph inspection. | Structural success is useful but proves neither numerical parity nor usable chat. Keep numerical, browser, quality and distribution gates separate. This is a diagnostic structural checkpoint, not an eligible default model. | [Execution /12](../../../docs/architecture/2026-08-26-qwen3-real-composition-execution-v12-structural-pass.md) |
| N1 | The numerical source arm exited 1 after about 54 seconds with `source-trace-model-load`; reconstructed and scalar stages never started. | Verify source-model loading and its pinned environment before attempting differential comparisons. Record stages that did not run; do not interpret their absence as numerical disagreement or agreement. | [Numerical execution terminal](../../../docs/architecture/2026-08-26-qwen3-numerical-differential-execution-terminal.md) |
| N2 | A corrected read-only verifier passed by independently confirming a preserved source-stage failure. Its process identity has exactly `byteLength` and `sha256`, while the registered executable descriptor also has `basename`. | Compare the normative projection of each contract rather than assuming differently scoped objects have identical fields. Always name what a verification pass proves: this pass confirms failure evidence, not inference parity. | [Source-terminal verification V2](../../../docs/architecture/2026-08-26-qwen3-numerical-source-terminal-verification-v2-pass.md), [bounded result](../../../contracts/vnext/qwen3-numerical-source-terminal-verification-result.v2.json) |

The unchanged pinned Qwen3-0.6B source remains diagnostic ancestry under current
`workspace.uai`. None of these records qualifies it as the automatic default.
Old model payloads, old executable implementations, obsolete schema readers,
and copied source trees are not needed to retain these lessons.

## Lessons from the retired Runtime documentation

The source records below remain addressable in Runtime.MiRust.com Git at
`d395307344692de1f01a80e74dadc803ff39cb1d:<path>`, even after its physical `docs`
directory is removed. These are historical reported checks, not newly executed
tests. The obsolete adapter and SLM1 formats are not being restored.

| ID | Observed result | Current lesson | Source path at the commit above |
| --- | --- | --- | --- |
| R1 | An equal-length adapter manifest mutation was detected, and subsequent adapter requests were prevented while the previously loaded model remained available. | Test same-length tampering, assert the network stops at the failed boundary, and preserve already valid independent state where the current transaction permits it. Length checks alone do not establish integrity. | `docs/reports/browser-adapter-manifest-drift-memory-2026-06-28.md` |
| R2 | A changed assembly evidence file stopped loading before later adapters and left the model unavailable. | Test each dependency boundary independently. A passing receipt does not excuse rechecking the actual referenced bytes. Distinguish failure before activation from failure of an optional later operation. | `docs/reports/browser-assembly-evidence-file-drift-memory-2026-06-28.md` |
| R3 | The evaluated case-body digest changed when case evidence changed and was carried into browser provenance. | Bind claims to ordered case content and its exact identity, not just an aggregate pass count. Use the current cryptographic receipts; do not revive the old digest format. | `docs/reports/browser-eval-case-evidence-checksum-memory-2026-06-28.md` |
| R4 | Redirect/UI checks covered closest-topic destinations, safe path handling, narrow query forwarding, noindex/canonical signals, semantic landmarks, and widths of 390, 768 and 1280 pixels. | Retired sites should send people to the current owner without recreating a documentation archive. Retain route, accessibility and small-screen checks. The old archive destinations are superseded. | `docs/implementation/runtime-migration-ui-25-rounds-2026-07-12.md` |

## Findings from this cleanup's tests

| ID | Observation | Lesson and application | Evidence |
| --- | --- | --- | --- |
| C1 | MiniModel documentation and developer-portal previews could expose files outside their declared public package. | A repository root is not a public directory. Test actual HTTP requests for private files and aliases against the same explicit publication boundary used by the preview. | MiniModel.MiRust.com `91b04e7`; TinyRustLM.MiRust.com `55dac9c` |
| C2 | MiRust publisher tests exposed collection unrolling, an empty first-file journal rejection, and predecessor byte-array custody problems. | Test the first mutation and failed promotion/rollback, preserving exact collection and byte-array types across PowerShell function boundaries. | MiRust.com `ad4ffb4`; 44 PowerShell custody checks within 14 repository tests |
| C3 | Test tooling recreated source repositories or destructively rebuilt a fixed historical stage. | Verify current canonical source through injected in-memory boundaries and read-only Git access. Historical metadata reproduction should emit data, not recreate an executable source tree. | Runtime.MiRust.com `d395307`; LMComposer.com `1922472` |
| C4 | Persistent browser tests verified cancellation and replacement without abandoning the active installation; a helper-label mismatch was caught before the direct-peer test started. | Treat activation as a transaction, distinguish cancellation before and after commit, reopen/reverify persisted bytes, and clean owned browser profiles after process exit. Keep fixture results separate from real model quality. | TinyRustLM.com `3302239`; 87 module tests, cache-restart and direct-peer browser checks; helper-label correction verified on rerun |

## Continue the review

Before deleting an experiment that is not covered above, record its purpose,
exact inputs/operation, observed result, useful conclusion, uncertainty, and the
current code or test that should retain the lesson. Link a commit and compact
receipt or hash. Distinguish measured results from proposals and research notes.
If the evidence is insufficient, say what cannot be concluded.

Remaining review includes earlier training/quality runs, generated release and
seed-host experiments, other Runtime/portal report bodies, and model-production
tools. No blanket disposition for those experiments is established by this file.

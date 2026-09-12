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
| C5 | Transferring an iterator-owned ArrayBuffer detached it, so the producer calculated the next offset from a zero byte length. | Preserve the producer buffer length; transfer a bounded copy and erase consumed bytes. Exercise a real multi-chunk generator, not only precomputed offsets. | `tinyrustlm/tests/model-runtime-client.test.js`: offsets 0 and 2, original lengths retained, original bytes zeroed |
| C6 | Worker URLs relative to the page looked in the wrong location when the application was served at the root. | Resolve the worker against the client script URL captured during script evaluation. Validate type/length before URL coercion and test both the root page and explicit URLs. | Ten runtime-client unit checks plus actual worker initialization/release in two fresh Edge profiles; profile directories verified removed |
| C7 | The first actual WASM browser check stopped before compilation because this process had no default rustup toolchain. | Record the effective toolchain environment before interpreting a build failure as a code defect. Selecting the already installed stable toolchain with process-local CARGO_HOME/RUSTUP_HOME/RUSTUP_TOOLCHAIN allowed the locked offline build and browser check to pass. | `tinyrustlm/tests/model-runtime-client-browser.test.js`; no machine-wide settings changed; this initializes an empty runtime and does not qualify a model |
| C8 | A source-preview cache key accepted arbitrary hash-shaped values, and release tests required scratch outside the repository. | Bind cache keys to actual response bytes, reject foreign Host headers and normalized path aliases, and keep bounded test/release output under canonical artifacts. | Seventeen static-server, shell and manifest checks passed; static-server line coverage 88.42%; no publication |
| C9 | MiniModel.MiRust's historical first publish uploaded all files but failed because a route-smoke heading did not match the page. Its retained 27-file stage exactly matches the historical manifest. | Validate route-smoke expectations against committed page bytes before transport. Preserve the failed receipt; upload success alone does not establish publication. Historical files can be represented by Git and compact inventories. | MiniModel.MiRust.com `04d05ac`; 14 tests, including the heading-mismatch case and 30 PowerShell stream/resume/failure checks. Stage inventory SHA-256 `f8cddffc1516e1ec88558b62442f1ae8b95a675ed537f8a0b30ab40ee32f9d22`; deletion remains policy-blocked |
| C10 | Windows checkout used CRLF while MiniModel.MiRust's committed public objects and deployment digests used LF. | Explicitly pin canonical public-file line endings when preview and upload read the worktree directly. Refuse differences; do not manufacture a copied source stage to hide them. | MiniModel.MiRust.com `67026c6`, `cf1cc5c`, `b437611`; all 27 canonical public files passed exact-byte preflight; real desktop/mobile Edge checks passed; no publication |
| C11 | The JS/native seed test built a rewritten converter and copied repository solely to locate source contracts and fixture binaries. | Keep a canonical native test host and vary synthetic input data through the canonical fixture. Test independent composition identities and lifecycle isolation using the production authenticated wire. | `TinyRustLM.DirectSeedWireFixtureTool`, `companion-direct-seed-wire-integration.test.js`; four concurrent seeds, fifth rejected, duplicate start/stop idempotent, independent shutdown. Six JS checks and 44 affected native checks passed; no model qualification or external lane |
| C12 | Repeatedly mocking the same filesystem method left an intermediate mock active, making a real native test select a nonexistent Release binary. | Use one scoped mock with explicit case state; keep real execution outside its scope. A harness failure is not a native product failure. | `companion-direct-seed-wire-host-helper_test.js`; initial failure preserved in session evidence, then all six integration/helper checks passed. Helper line coverage 100% |
| C13 | A fresh .NET CLI home caused SDK first-run setup to report installing a development HTTPS certificate during an otherwise offline build. | Disable certificate generation for isolated test CLI homes with `DOTNET_GENERATE_ASPNET_CERTIFICATE=false`; isolate scratch without triggering unnecessary host setup. Do not claim that disabling later generation removed an already installed certificate. | Canonical native build succeeded with zero warnings/errors; later 44-test run with certificate generation disabled passed and its owned scratch was removed |
| C14 | A wider native run passed 211 cases but a polling reader encountered a zero-length history file during a legitimate journal write. Readers had bypassed writer synchronization. | A multi-file journal needs a coherent read boundary as well as atomic individual writes. Serialize reads and writes with bounded, reentrant locking; nested evidence reads must reuse the process lock. Preserve corruption checks and remove transient-error workarounds that hide races. | Three deterministic partial-history reader cases and a process-lock conflict case; all 216 native tests passed normally and instrumented. Journal line coverage 85.68%, all 33 changed instrumented lines covered; scratch-helper coverage 83.95%. Compact proof `artifacts/ecosystem-cleanup-20260912/native-journal-coverage.json`; no model qualification |
| C15 | Both current Qwen3 training tools explicitly rejected D: while permitting model storage on C: or E:. A dangling link could also evade an `exists()`-guarded ancestry check. | Enforce current owner storage rules in both the lock producer and independent trainer; check reparse metadata even for a missing target. Their source/output boundaries now require children of `D:/LLMs/TinyRustLM`. | All 98 focused checks passed, with changed executable-line coverage of 95.65% and 95.00% using Python standard-library trace. Synthetic tests now use marked canonical artifacts; helper coverage was 92.59%. No training authorization follows. |
| C16 | The canonical training source directory had seven model/tokenizer files, while its pinned license and model card remained on E:. After moving those two hash-verified files, all nine source files passed the trainer's real validation. The separate composition lock expects a different license SHA-256 and length. | Consolidate the whole source contract, including provenance metadata. Validate through each actual consumer: passing the training profile does not establish composition admission. The license-identity mismatch is recorded and unresolved; historical locks were not rewritten. | Compact proof: `artifacts/ecosystem-cleanup-20260912/canonical-training-source-review.json`. |
| C17 | An anonymous read of LICENSE at the immutable upstream revision matched the training profile, confirming that the companion's compiled license identity was wrong. The first native/JS tests then correctly rejected the historical source-operation vector after its descriptor changed. | Correct every current producer/consumer binding together, preserve historical evidence, and generate an independently checked current wire vector. Do not weaken old-request rejection to reuse obsolete fixture bytes. | [Current license correction](../../../docs/architecture/2026-09-12-qwen3-source-license-correction.md): current lock v2, nine actual source files verified, 218 native tests, 45 JS contract checks, eight Rust checks and eleven integration/server/shell checks passed. This resolves C16's current license mismatch; no model qualification follows. |
| C18 | A release browser smoke could pass while its stale MiniModel fixture was rejected. The first current-field correction still used millisecond timestamps; adding an explicit verified-empty UI assertion exposed that contract error. The tools also required scratch outside the worktree and leaked generated metadata when setup failed. | Verify the actual workflow state, not only page load and HTTP success. Validate fixtures through current consumers, keep scratch under canonical artifacts, and begin cleanup coverage before the first fallible setup operation. | [Local smoke correction](../../../docs/architecture/2026-09-12-local-release-smoke-cleanup.md): 24 tests passed, including 12 real Edge page/viewport observations; the actual CLI runner passed and removed its output. Empty intercepted metadata does not establish live catalog, model or seed success. |
| C19 | The developer portal's release CLI rejected the current canonical source gate because it still pinned an obsolete verifier. Its Git batch parser also checked the returned header but not whether payload bytes matched that object ID. Earlier transaction and hostile-gate tests created copied tools and Git repositories. | Keep reviewed cross-project pins aligned, rehash payload identity independently, and exercise canonical implementations through explicit in-memory boundary responses. Supplement simulated transactions with real read-only Git and actual entrypoint checks. | Portal commit `1834857`: 20 checks passed with zero skips, including corrupted same-length payload rejection, the actual canonical CLI gate, committed public bytes and PowerShell rejection before deployment data. Compact proof is `TinyRustLM.MiRust.com/artifacts/ecosystem-cleanup-20260912/deployment-validator-review.json`. No stage or publication was produced. |
| C20 | The portal retained 27 byte-identical historical stage files, generated fresh copied stages, and carried an unreachable full-site publisher after its early rejection gate. Canonical Windows public bytes also differed from Git because of line endings. The first replacement inventory omitted ignored files, and Node startup options were restored before the second verified subprocess. | Generate metadata to stdout, validate the owning checkout directly, pin public line endings, include ignored public extras, remove unreachable transport code, and keep startup injection disabled throughout validation. Preserve compact identities and Git history rather than a source stage. Readiness checks must continue failing while a reviewed stage physically remains. | Portal `d938fcd`: 56 checks ran, 55 passed, one correctly fails on the policy-blocked stage; no skipped or cancelled tests. Actual PHP checks passed. Actual PowerShell with hostile Node options rejected the stage. Proof `TinyRustLM.MiRust.com/artifacts/ecosystem-cleanup-20260912/canonical-release-tools-review.json` (SHA-256 `e9bd26f66580d9758a09e21f9cb1fa91af712d6b6b86b0e446a36b5330ef483e`). All 27 files match Git `24e4f87`; zero unique files. No deletion or publication is claimed. |

## Retained July quantization probes reviewed during cleanup

The retained eight-case source golden and nine native probe sets were compared
read-only on September 12. All prompt token-ID sequences match. All eight golden
logit payloads match their recorded SHA-256 values; the review records fresh
SHA-256 values for every probe payload and manifest. Historical non-SHA probe
checksums were not reverified. This comparison executes no model and does not
revise an old decision or establish current SLM2 qualification.

| Historical probe | First-token argmax matches | Largest absolute logit difference |
| --- | --- | --- |
| F32 control | 8/8 | 0.0001191 |
| Q4 | 1/8 | 22.3792 |
| Mixed Q8/Q4 | 2/8 | 9.4830 |
| Mixed output/down variant | 3/8 | 10.4276 |
| Q8 | 6/8 | 3.6937 |
| Q8 with F32 norms | 7/8 | 2.3459 |
| Q5 | 4/8 | 5.2087 |
| Q5 sensitive-tensor variant | 4/8 | 4.8293 |
| Q8 edges with Q5 body | 4/8 | 4.6361 |

The comparison found no mismatched nonfinite values. All nine referenced old
model payloads are already absent; retaining those models is unnecessary to
preserve these findings. Raw diagnostic logits have not been deleted in this
review.

These observations suggest prioritizing quantization and normalization handling
when investigating that historical conversion path: the F32 control agrees
closely while compressed variants differ despite identical prompt tokens.
They do not establish which current implementation, tensor family, rounding rule
or kernel caused a discrepancy. Keeping F32 norms improved the observed Q8
comparison, but still changed one first-token choice. The mixed output/down
variant improved the choice count while worsening maximum error: one aggregate
metric cannot establish an overall improvement. First-token agreement also says
nothing by itself about multi-token quality, browser memory, latency or chat.

Use independent current reference/native/WASM checks, complete logit metrics,
per-case identities and untouched semantic evaluation when changing a current
composition. Never reintroduce SLM1 support or restore deleted payloads to repeat
these old experiments.

Compact evidence: `artifacts/ecosystem-cleanup-20260912/historical-logit-review.json`,
SHA-256 `c7068630cbaaa2eacbd69df2108aba5221de163220915a5d51211d8e71fde29b`.
It records exact source revision, input paths, case identities and computed
metrics. Historical source paths in the golden predate consolidation; they do
not authorize recreating those locations.

## Retained CPU training pilots reviewed during cleanup

Eight completed Qwen3/SmolLM2 pilot directories were read without executing
training, inference or serialized optimizer state. All eight final adapter and
configuration hashes match their training receipts. All eight retained recipe
and frozen-dataset manifest hashes also match. Each final checkpoint has the
same adapter/configuration bytes as its enclosing final output, and each
trainer state reaches its declared final step and receipt epoch.

The compact record preserves every training receipt and final trainer state,
including scalar loss history, plus file identities and six available raw-screen
identities. It is
`artifacts/ecosystem-cleanup-20260912/historical-training-review.json`, SHA-256
`65145da24d5bdafb8eab22e4c81e0161bdaf1c651fbfa157d378056f8f12b5b5`.
The 64 redundant checkpoint files total 322,367,608 logical bytes. This inventory
precedes deletion; a separate receipt must establish actual removal. Final
adapter outputs and original raw screens are outside this checkpoint retirement.

| ID | Observed result | Lesson and current application |
| --- | --- | --- |
| T1 | The 96-record Qwen3 v1 pilot reports training loss 1.9285, but its retained eight-case screen refuses a harmless low-battery planning request and provides no useful storage advice. | Training completion and low training loss do not establish useful conversation. Preserve raw ordinary-helpfulness checks alongside task-specific objectives. This is an observation of retained outputs, not a new controlled comparison with the base. |
| T2 | The 40-record Qwen3 v2 first pilot repeats its inability to call a friend, answers storage advice with only “Keep it,” and fails the explicitly supplied current name. | Inspect complete generated answers for repetition, missing constraints and current-turn state. Aggregate loss cannot detect these failures; keep independent untouched behavioral evaluation before adoption. |
| T3 | Qwen3 v2 runs named `preservation-pilot-v2` and `preservation-pilot-v3` both bind recipes and receipts declaring `transformers-peft-sequence-lora-v1`, with no recorded KL component metrics. | Folder names are not algorithm evidence. These runs cannot establish preservation-KL effectiveness. Use the exact recorded engine and method-specific metrics; do not silently relabel historical receipts. |
| T4 | The one-epoch and three-epoch runs above report losses 4.2476 and 4.0866. Both arbitrarily choose the customer's deadline; the later run also fails to use the explicitly supplied current name. | More epochs and lower training loss are insufficient promotion criteria. This pair alone does not isolate a causal explanation or establish a general regression rate. |
| T5 | The two 100-record SmolLM2-1.7B pilots report losses 2.4189 and 2.3699. Both treat a basic “test” message as something they cannot help with; the later run tells the low-battery user simply to call at 8 PM. | A larger model and a lower-loss adapter still need practical, bounded-response evaluation. Capability disclaimers can displace useful behavior. No size-based default selection follows from these runs. |
| T6 | Qwen3 v3 has two valid training receipts, but the expected adjacent raw-screen files are absent. The retained provenance audit reports 100 approved SFT records, 56 edited draft/final differences and zero eligible preference pairs. | A training receipt is not a quality result; absence at these specific screen paths does not prove that no other evidence exists. Edited drafts do not create chosen/rejected preference labels. The audit's original report hash was rechecked; this review did not rerun its entire provenance graph. |
| T7 | All eight completed checkpoint weight/configuration pairs duplicate the final output exactly; the checkpoint also retains optimizer, scheduler and RNG state. | Preserve the receipt and scalar training history once, then remove redundant completed checkpoints. Do not deserialize pickle-based optimizer files just to inventory them. Checkpoint retention must be bounded in active training tooling; this review does not make rejected runs resumable. |

The six screens bind the actual retained adapter hashes and contain eight cases
each. Their input/output hashes and output lengths are retained without copying
their prompt or answer text into the inventory. Their original raw JSON remains
under `artifacts/training/`. Cases reaching a token cap are not automatically
classified as semantic failures or successful stops. No new pass percentage,
current SLM2 qualification, release eligibility or server seed is claimed.

The provenance-audit source is
`artifacts/reports/qwen3-cognitive-liberty-v3-preference-provenance-audit.md`;
its machine report is
`artifacts/training/qwen3-cognitive-liberty-v3/preference-provenance-audit-v1.json`,
historical SHA-256
`a9b9bffb58d245d8f23174446f9b088be0d0190e2f33df4cd102cd2212e694d9`.
Existing Qwen3 adapter rejection and the current independently qualified
derivative requirement remain in force. Old receipt paths into former model
locations are historical provenance, not permission to recreate those locations.

## Continue the review

Before deleting an experiment that is not covered above, record its purpose,
exact inputs/operation, observed result, useful conclusion, uncertainty, and the
current code or test that should retain the lesson. Link a commit and compact
receipt or hash. Distinguish measured results from proposals and research notes.
If the evidence is insufficient, say what cannot be concluded.

Remaining review includes other training/quality runs, generated release and
seed-host experiments, other Runtime/portal report bodies, and model-production
tools. No blanket disposition for those experiments is established by this file.

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

## C70: process cancellation alone does not cancel file verification

- Question: does the live managed conversion call stop cancelled verification?
- Exact inputs: parent `1f691a7f2f0c98041780fc3c6398472286bf64df`, canonical
  conversion owner, synthetic converter processes and deterministic short-read
  streams; no real weights or historical material experiment replay.
- Method: cancel before launch with a removed input; cancel on partial reads and
  EOF; compare empty, partial and multi-buffer digests to the independent SHA-256
  API; inject a read error; run the full Core and companion suites.
- Result: the pre-fix case threw a file error. After token propagation and a
  shared bounded hash loop, 97 Core and 228 companion tests pass. The new hash
  loop has 100% line/branch coverage. Committed pass/rejection reconciliation
  still wins over a late cancellation without inventing a live observation.
- Uncertainty: an in-progress synchronous filesystem read cannot be interrupted;
  no measured real-model cancellation latency or whole-pipeline deadline follows.
  Output-pipe lifetime and real model/release gates remain separate work.
- Decision: cancel live hashing, preserve all terminal bytes, and let the existing
  uncancelled reconciliation verify any already committed outcome.
- Reusable lesson: propagate the token through costly verification work, and
  distinguish stopping observation from changing durable transaction truth.
- Evidence: `artifacts/ecosystem-cleanup-20260912/conversion-hash-cancellation-review.json`.

## C69: a zero download limit must not turn into the default batch

- Question: do explicit selection controls bound network and storage work?
- Exact inputs: parent `6cc98e1c218d21c3477c027121b10ce9cfe2b902`, current
  discovery/acquisition owners, pinned synthetic metadata and tiny source fixtures.
- Method: pass zero, NaN, null, booleans, strings, fractional and out-of-range
  numbers; exercise actual CLI arguments; verify omitted defaults and slices with
  exact request/receipt counts. Put an invalid revision after a valid candidate
  and require rejection before any source request or candidate-directory mutation.
- Result: three baseline failures exposed hidden defaults and late validation.
  All 48 final affected checks and three unit-gate checks pass. Acquisition and
  discovery line coverage is 93.27%/93.83%. Three unchanged suites now participate
  in the standard gate after their filename corrections.
- Decision: default only omitted controls, validate bounded integers and validate
  all selected entries before I/O. Preserve at-most-count selection semantics.
- Uncertainty: synthetic bytes and loopback transport do not establish usable
  model behavior or conversion support. Current discovery profiles are screening
  metadata; only the Qwen3 conversion chain is exposed by the Rust CLI.
- Reusable lesson: `value || default` silently expands invalid resource requests;
  a green manually invoked suite can still be absent from the routine test gate.
- Evidence identity: `candidate-selection-limits-review.json`; no real model
  download, publication or policy-blocked retirement.

## C68: a developer native override can invalidate package verification

- Question: does a successful consumer actually execute the packaged library?
- Exact inputs: parent `c0c2a3f192755682748fa99a0190662154e3edea`, local 0.1.8
  packages, Windows x64 native library and canonical consumer. Source, package
  and log hashes are retained in `nuget-consumer-native-binding-review.json`.
- Method: use real restore/build/run, remove only the newly owned consumer DLL
  after build, and supply a valid external developer DLL in the parent environment.
  Hold output layout constant. Then bind the verifier's child to its own DLL and
  repeat; separately test intact bytes with a bad parent override and alternate
  output settings. Run the full package transaction in owned output.
- Result: the original missing-DLL run falsely passed all three stages. The fixed
  run rejects with `DllNotFoundException`; intact packages pass six native checks.
  All 105 affected Node checks pass (85.83% line, 97.22% branch coverage). Packaging
  passes 86 Core and 38 package tests and audit. Earlier setup failures were
  PowerShell stderr handling, 39 guessed fixture-path failures, then an inherited
  MSBuild layout mismatch; these are distinct from model or native-runtime failure.
- Decision: force the verification child's own packaged native path and output
  layout. Bind conversion fixtures to MSBuild output metadata instead of deriving
  configuration from directory names. Preserve the SDK's intentional override.
- Uncertainty: Windows package-contract smoke is not real model inference or
  Linux/ARM64 qualification. Managed test-helper numeric coverage was not collected.
  No publication or blocked-cohort removal occurred.
- Reusable lesson: isolated package caches do not isolate a native loader or
  inherited build properties. Test removal of the artifact whose presence the
  verifier claims to prove; success must not come from an ambient development copy.

## C67: native build success does not prove the packed SDK works on that host

- Question: must every supported platform consume the final package before NuGet
  publication, and can Unix execute the checked-in script chain?
- Exact inputs: parent `4d40fc1acd366c860d81056ebef68e6081ca5728`, release workflow,
  canonical consumer and eleven NuGet Bash entry points. Four baseline checks fail.
- Method: split pack, platform consumers and protected publication; use one
  uploaded artifact; execute the architecture guard with matching/mismatched RIDs;
  inspect Git modes, independently parse YAML and run Bash syntax checks.
- Result: 103 Node and 38 managed package checks pass. All eleven script blobs are
  unchanged while Git modes move from 100644 to 100755. The publisher cannot start
  from a successful native build alone or repack after consumer verification.
- Uncertainty: hosted execution and ARM64 evidence remain absent. WSL on a Windows
  filesystem does not reproduce a Unix checkout's executable-bit enforcement.
- Decision: test the actual final package on every advertised native platform
  before the credential-bearing job; keep exact artifacts through that dependency
  chain and preserve existing feed/hash verification afterward.
- Reusable lesson: native ABI tests and a package's RID inventory are necessary
  but do not verify package loading and managed/native integration on each host.
- Evidence identity: `nuget-prepublish-consumer-review.json`; no key read, package
  push, new model execution or previously blocked deletion.

## C66: prefill can be terminal before any generation step

- Question: does the browser preserve Rust's context-limit result when the prompt
  already fills the admitted session, and can the user issue another request?
- Exact inputs: parent `e2277a168c18332b4a4b355bb8e42bfec10c16fb`, production worker
  and client with a synthetic ABI returning `terminal-output-ready`, empty output,
  `context-limit` and 4,096 committed KV bytes. Source and run identities are in
  `browser-terminal-prefill-review.json`.
- Method: reproduce each side's rejection, test the production state machines
  together, reject invented initial text/tokens/KV changes and wrong reasons,
  check cancellation precedence and replay, and issue another valid generation.
- Result: baseline worker terminated and client rejected event authority. Corrected
  paths finish once without a step. All 113 final checks pass; worker/client line
  coverage is 81.91%/81.03%. The page preserves raw output and labels exhaustion in
  the existing status card. Real Edge lifecycle checks and a bounded DOM layout
  probe pass; neither executes a real model.
- Uncertainty: full real-composition inference remains blocked by separate gates;
  compact mobile layout hides the existing status card. The older visual baseline
  remains unresolved. Local source and fixture evidence do not establish release.
- Decision: admit both existing initial outcomes through one protocol, without a
  fake step, retry, answer rewrite, new backend or compatibility path.
- Reusable lesson: verify terminal transitions across every layer, including the
  zero-step case. Historical evidence hashes belong to their recorded Git commit,
  not whichever current implementation happens to occupy the same path.

## C65: cleanup authority must outlive the disposable directory

- Question: can a locked file or failed terminal removal destroy the authority
  needed to retire the remaining operation output?
- Exact inputs: parent `d8904f67d80f6577d592bc79a6bddeab0e651c33`, the canonical
  scratch helper, a real Windows `FileShare.None` child and bounded synthetic
  output. `scratch-retirement-ownership-review.json` binds source and evidence.
- Method: reproduce the real lock against the old helper, inject individual
  terminal failures, then test explicit cleanup after releasing the lock. Exercise
  partial deletion, new/changed entries, root replacement, contained/external hard
  links, linked ancestors and inventory/depth bounds. Run shared consumers.
- Result: old cleanup lost its marker with `ENOENT` after the locked-file failure.
  The external marker survives partial and terminal failures; all 17 checks pass
  with 100% line/function and 96.77% branch coverage. Consumer feed failures were
  missing interpreter setup, resolved by explicit existing WSL binding (124 pass).
  Numerical tests found a stale current helper digest; its corrected binding check
  passes. Neither setup failure was a model failure.
- Uncertainty: quiescent output is required; path-based checks cannot prevent every
  malicious mutation between check and syscall. Lost in-memory ownership, process
  restart and power-loss durability are not established. The historical browser
  visual comparison remains failed with 15 differences.
- Decision: one external marker contract, bounded direct unlink/rmdir, no recursive
  fallback, old reader, ownership recreation or policy-denial bypass. Disable
  shared compilation for managed builds in short-lived owned output.
- Reusable lesson: keep cleanup authority outside what it authorizes deleting,
  through observed absence; test the real operating-system failure as well as
  injected failures. Test-file naming must match the actual gate's discovery rule.

## C64: generation must use the same context budget as its KV cache

- Question: does a smaller admitted runtime context end generation normally?
- Exact inputs: parent `b5aba376c3083726ae50c2aa8dd89a90d91ff643`, the canonical
  8,704-byte synthetic scalar model, prompt IDs `[1,2]`, context four, fixed
  finite logits selecting token one, output ceiling eight and seed 42. The
  source and evidence hashes are in `runtime-context-limit-review.json`.
- Method: execute actual scalar forwards alongside Sampling2, then test exact
  full contexts, last-token retention, simultaneous limits, invalid/expanding
  restrictions and unchanged generated/terminal state. Build the corrected WASM
  twice and exercise its ABI and real Edge worker/client boundaries.
- Result: baseline controller remained `Active` at cache position four. The
  corrected controller reports `ContextLimit` and retains `[1,1]`. All 76 Rust
  checks and Clippy pass; the local WASM reproduces exactly. The 73 affected Node
  checks pass across initial and corrected browser invocations; two additional
  Edge scenarios and 38 related contract checks pass. No Rust coverage tooling
  was available, so the parameter-sensitive tests are the closest evidence.
- Uncertainty: scalar/controller integration is synthetic and does not execute
  a complete admitted composition through chat. Browser checks cover real WASM
  initialization, integrity rejection, transfer bounds and release, not useful
  model answers. No public or material qualification gate follows.
- Decision: restrict the live controller before activation rather than modifying
  the model-wide Prompt2 wire or allowing scalar failure to erase output.
- Reusable lesson: resource admission and termination must share one effective
  limit. An implementation can be correct under the model maximum and still
  fail under a smaller host allocation.
- Environment lesson: bind `RUSTUP_HOME`, `CARGO_HOME`, compiler paths and virtual
  home before inspection/build. An unbound rustup query installed a new stable
  toolchain under Michael's profile; exact inspected uninstall and absence were
  verified without changing the canonical compiler. The separately installed
  numeric toolchain lacked WASM/Clippy components despite matching version text.
  Use executable identity and installed components, not a version name alone.
- Cleanup lesson: terminal `dotnet test` does not imply its shared compiler has
  exited. Two xUnit analyzer DLLs remained mapped by the compiler server and
  caused `EPERM`. Observed module paths, graceful compiler shutdown and verified
  PID absence resolved the lock; a new complete remaining-tree review preceded
  removal of the unchanged owned directory. The recursive scratch helper erased
  its marker too early. Preserve ownership until contents are gone, and disable
  shared compilation for future operation-bound checks. This helper correction
  remains open; the C64 output itself is verified absent.

## C63: a visual check must finish current work and preserve a failed comparison

- Question: can the existing visual tool inspect the current application without
  retired model support, unbounded generation or silently retained profiles?
- Exact inputs: parent `63119aae67456cf18218debab214065345219f2c`, the existing
  August baseline, current canonical assets and Edge 153.0.4234.48; source and
  evidence hashes are in `visual-capture-current-contract-review.json`.
- Method: test explicit modes/paths, current six-member selection, missing and
  hostile inventory, launch/action/close/cleanup failure, idle no-progress,
  failed assistant turns, comparison completeness and overwrite rejection. Use
  actual fresh desktop/mobile browser profiles and the real CLI. No real model
  is imported and no page state or inference worker is replaced in these captures.
- Result: final 20 focused checks and 42 affected checks pass; owner coverage is
  91.42% line, 88.41% branch and 75.86% function. Historical baseline comparison
  reports 15 differences; the real CLI preserves them and exits 1. Initial unit
  failures exposed a test fixture leaking internal spec fields into admission
  and one-sided comparison-policy validation; both were corrected. Final normal
  discovery uses `.test.js`, so the standard gate includes the 19 unit cases.
- Uncertainty: a successful empty-shell capture is not useful inference, visual
  parity with August, physical-mobile execution or deployment. Active/long modes
  have boundary tests but await a permitted real qualified composition. Browser
  closure failure must retain its profile rather than racing deletion.
- Decision: use existing Playwright and ownership helpers; retire the raw socket,
  debug-port CLI, SLM1 fixture dependency and swallowed cleanup failure. Keep the
  original baseline and original tolerances; investigate its drift independently.
  Final review retained both deferred startup and a verified loaded default as
  valid empty-conversation states; the additional branch checks and fresh actual
  shell captures pass. A loaded default must not break the visual tool.
- Reusable lesson: success means the requested state was reached and cleanup was
  proved. An idle state alone is not completed generation, and making the tool
  work does not make its baseline comparison pass. Tests must use filenames that
  the actual suite discovers, not only names accepted by an ad hoc invocation.

## C62: memory browser tests need current admission and usable owned profile paths

Question: can the current user-plugin path preserve both explicit memory tiers
after the original browser profile is removed? Parent was
`5ce5b60b993c2b4ca5606fbfe8fa72d37784221c`; the receipt binds final source and logs.
Inputs are synthetic six-member files, intercepted current catalog/admission/receipt
bytes, an inference worker double, two marker prompts, a fresh loopback enrollment
service, and two real desktop Edge profiles. No production account was contacted.

The old test failed before import by expecting eager WASM verification. Later
harness checks exposed a chooser already open, absent catalog authority, an invalid
owner/model fixture identity, noncanonical receipt field order, and storage errors
with deeply nested Windows profile paths. Correct the fixture and preserve the
production validators. A short canonical profile path completed the same storage
and memory workflow. The worker double now forwards unrelated worker URLs, but that
change alone did not cure the storage error. This is evidence for controlling
profile path depth, not proof of a universal Windows or browser path-length limit.

Five new HTTP tests initially failed during teardown because separately registered
hooks closed the server before company cleanup. One ordered try/finally now cleans
the company before closing the server. All five pass, including retired/conflicting
actor fields, another actor/workspace, exact replay, conflicting replay and summary
search. An initial 35-test command also named a nonexistent `.test.js` scratch test;
Node did not fail for that unmatched argument. Verify the file inventory first and
use the actual `_test.js` owner: the final 42-test run includes all seven scratch
checks. No missing test is counted as passed.

Final browser result: enrollment, two explicitly saved tiers, no automatic turn
uploads, profile deletion, fresh-profile search, replay rejection, credential
nonpersistence checks and local company deletion pass. Service fixture line coverage
is 82.43%; live service behavior, real inference and physical-device breadth remain
unmeasured. Stop relying on retired selectors, authority-free local import or long
reporter-derived browser paths. Keep the exact failed outcomes and reusable lesson
in `browser-memory-contract-review.json`; retire operation-owned bulky outputs.

## C61: current entry guides must agree with owner requirements and executable routes

Question: would an engineer following the main product guides reconstruct the
current first-run behavior? At parent `90f7587fa5235e5d0b97c12dbd06dd3691661c06`,
the root/browser READMEs and architecture/companion drafts still described forbidden
server seeds and a mandatory conversion fallback; the root also prohibited D: model
storage and called the rejected Qwen ancestry a production target. Source inspection
of `boot`, `chooseBootstrapModelRoute`, `requestSimpleModelAcquisition` and catalog
projection contradicted that guidance. The seed already sorts first; a suspected
multi-peer priority defect was disproved by inspecting the actual comparator.

Method: reconcile those four guides against source, current owner instructions,
the release ledger and bounded tests. Result: 156 existing Node checks, 38 managed
package/memory checks and twelve Edge fixture checks pass. No runtime change was
needed. Integrate the reviewed companion/architecture draft facts without claiming
live execution, and leave the unrelated demo link unstaged. Preserve the old reader
and test because their deletion is already policy-blocked; a new cleanup pass does
not authorize retrying that operation.

Decision: use the entry guides for current product instructions and the progress
record for unresolved proof. Reusable lesson: a correct startup implementation can
still be undermined by stale top-level instructions; verify claimed prerequisites
against actual dispatch before adding code. These are documentation and fixture
results, not model quality, current hosting topology, public publication or storage
recovery. Exact sources, results and owned-output cleanup are in
`current-product-guidance-review.json` in the cleanup artifacts.

## C60: connection ownership includes cancellation and test tools belong to the build

Question: does every failed source connection relinquish its allocated socket?
Exact input was parent `c1a73483d5add83b6824dd778ab398b3c4ee4af4`; the review receipt
binds the extracted old-filter variant, new source and tests. Real local IPv4/IPv6
sockets, a pre-cancelled token, invalid ports, reserved non-listening ports and one
byte of stream traffic avoid external-network timing assumptions. The old filter
failed four of eight cases by leaving handles open. Unconditional disposal before
rethrow passes all eight; successful streams retain ownership until disposed.

The broader run initially passed 31/33: two failures came from fixture executable
paths guessed from the old output layout. While replacing those helpers, an XML
comment containing a double hyphen caused one pre-build failure. The first full
suite passed 212/229: sixteen remaining launcher lookups still used the old path,
and one newly added binding assertion incorrectly expected an apphost for the
explicitly DLL-only wire fixture. These were harness failures, not model failures.
Bind only the two apphost tools, retain the DLL-only project reference, move binding
checks beside the shared resolver, and remove the remaining guessed paths. Final
full suite: 228/228, no skips, with actual child startup/teardown and HTTP tests.
The removed assertion was inapplicable; no existing behavioral test was removed.

Decision: keep narrow socket ownership transfer and generated fixture bindings.
The changed socket helper has 100% measured line/branch coverage; the resolver has
11/13 executable lines covered. The tests do not establish midflight remote TCP
cancellation, external TLS/DNS, real-model quality or release readiness. Preserve
this distinction and inspect resource ownership after cancellation, not only its
returned exception. Use build output identity rather than configuration-directory
guesses. Exact commands, failed outcomes and identities are retained in
`companion-socket-ownership-review.json` in the cleanup artifacts; generated output
is temporary and source history stays in Git.

## C59: cancellation must reach companion chunk verification too

Question: can the Advanced companion path release an interrupted import while
metadata or chunk hashing is pending? The original bridge failed all 22 controlled
cases across five preparation and six member-hash stages. The postcommit control
passed. Propagating the existing caller signal into every hash fixes the wait
without changing identity checks or committed-store success. The wait helper also
observes a rejected promise returned after a synchronous abort by a hash, client
or progress callback; genuine hash failure retains its separate error and context.

All 367 affected Node checks pass. Nine Edge tests include real OPFS cancellation
at all eleven stages on desktop and mobile viewports: exact prior pointer retained,
candidate/staging absent, writer lock released, late rejection observed, then a
successful replacement. Chunk transport and model bytes are synthetic. This does
not verify .NET source acquisition or real inference. No-signal calls still wait
for their work; cancellation cannot abort underlying WebCrypto or force an issued
browser mutation to finish. Reuse the full transfer boundary, not just network
request mocks, when checking cancellation. Evidence and source identities:
`companion-hash-cancellation-review.json` in the cleanup artifact directory.

## C58: a network deadline must also cover metadata hashing

Question: does cancelling a P2P install finish while its metadata digest is pending?
At the C57 source revision, all sixteen cases (four hash stages, caller/deadline,
late success/failure) remained pending beyond the 150 ms observation window. The
hash-failure control passed; this was an async lifetime defect rather than bad
metadata or a model-quality failure. The revised installer uses its existing
cancellation state for every hash and observes even a rejection returned after
synchronous cancellation. It starts no further preparation, store work or transfer.

All 222 affected Node checks pass. Real Edge passes the existing one-click and
persistent-transfer tests plus eight injected hash scenarios at each desktop/mobile
viewport. Final checks also observe page errors and unchanged OPFS roots. Deadlines
are triggered deterministically through the actual timer callback; the 150/250 ms
windows are test observation bounds, not performance measurements. WebCrypto may
finish after cancellation, and browser suspension can delay timers. Preserve this
distinction when describing cancellation guarantees. No model was qualified.

Reusable lesson: race every asynchronous precommit stage against the same lifetime,
observe late failure, and prove that cancellation prevents subsequent side effects.
Preserve the separately tested committed-store result. Exact identities, commands,
coverage and cleanup are in `p2p-metadata-cancellation-review.json` in the existing
cleanup artifact directory; source history is in Git, with no copied source tree.

## C57: separate Linux execution proof from toolchain setup failures

Question: can the current package run in Linux while hosted jobs cannot start?
On installed WSL Ubuntu 24.04.4 x64, the Rust 1.96.0 native build and four ABI
tests pass. The three exact two-RID packages pass audit and all six observations
in both Windows and an actual Linux .NET 8.0.31 consumer. The consumer was restored
and compiled by the Windows SDK from canonical source using package references;
Linux ran the resulting managed assembly and its hash-matched packaged native
asset with no native override or compiler library path. Managed checks: 86 + 38.

Setup failures were not runtime disagreements: stale apt URLs stopped installation,
case-distinct Linux headers collided on the Windows filesystem, component archive
manifests collided, uncached Cargo dependencies stopped offline builds, and host
build scripts needed their own working `cc` launcher. A generated launcher first
contained literal backslash-n characters; correcting its newline bytes resolved
that harness failure. No product source, acceptance condition or Cargo lock changed.
Extract only required tool payloads, preflight the actual child, and distinguish
host-build-script linker configuration from target Rust flags. Windows metadata
inspection also failed on a dangling Linux tool link; Linux lstat can inventory
such links without following them, but never authorizes retrying a policy denial.

The shared C# compiler retained two analyzer DLLs in the owned temporary directory
and caused a partial cleanup failure. Graceful compiler-server shutdown released
them; original root identity and exact remaining inventory were revalidated before
retirement. Future bounded package runs should disable shared compilation as well
as MSBuild node reuse. Disjoint tools and build output totaling 2,140,269,091 logical
bytes were removed; physical free-space recovery was not measured.

The ELF has no tool-prefix RPATH/RUNPATH and requires GLIBC symbols up to 2.34.
Older Linux distributions, real ARM64 execution, full release admission and public
publication remain unproven. Automatic review denied deletion of the partial
`sysroot/usr/include` under operation `OFb8Tf`; preserve it and never delete its
parent to bypass that decision. Evidence and cleanup observations:
`nuget-linux-consumer-review.json` in the cleanup artifact directory. No key or
real model was loaded. No inference-quality or seed claim follows from these tests.

## C56: freshness failure does not always mean a missing release

Question: does every failed freshness report permit a new push? No: an existing
declared version can be superseded, or the report can be invalid. Both readiness
owners now require complete consistent observations and block superseded versions;
Trusted Publishing admits the exact official feed instead of a matching domain
substring. Thirty-five cases per owner and twelve complete local-feed executions
pass (86 Node checks), plus 38 managed checks. An initial overlong Windows command
and a Python quoting error were test-harness failures; stdin fixed the former.
Lesson: test the final readiness decision as well as the underlying feed query.
Evidence: `nuget-readiness-review.json` in the cleanup artifact directory. These
synthetic GET-only checks used no real key and do not prove publication or Linux
SDK execution. Hosted jobs that never execute are not failed product tests.

## C55: run the actual package path before claiming release readiness

Question: can the current SDK pack and run without copied source? The canonical
consumer now uses exact package references and owned build/cache output. Real
execution found Windows path regexes that only handled forward slashes, then a
missing required P2P search tag. Corrected builders pass positive and negative
resolver cases; actual package audit and Windows consumer pass without weakening
requirements. Keep a real normal-path check alongside rejection tests, resolve
feeds before changing directory, and retain diagnostic findings before retiring
payloads. Rust 169, managed 86 + 38 and focused Node 15 checks passed; Linux/public
release remain unproven. Evidence: `nuget-consumer-build-review.json` in the cleanup
artifact directory. The first audit receipt was retired with only its identity;
a controlled repack reproduced the same six payload hashes and isolated the tag.

## C54: distinguish an absent package from an unknown feed

Question: can feed freshness safely decide whether publication is needed? Method:
run the canonical PowerShell and Bash Python query functions against fifteen HTTP
cases each, then the full PowerShell command and live NuGet indexes. Old broad
exception handling mislabeled outages, authentication errors and malformed bodies
as missing packages. Both implementations now treat only 404 as absence; other
failures preserve the readiness audit's unknown state. All 38 focused and 17
package-boundary checks pass. No complete three-RID package transaction or push
was run. Include freshness in SDK checkpoints and require public payload readback.
Evidence: `artifacts/ecosystem-cleanup-20260912/nuget-publication-current-review.json`.

## C53: HTTP headers and browser-readable headers differ

Six real Apache fixture bodies and exposed identities passed Edge Fetch, with
three negative controls. The initial test expected JavaScript to read unexposed
Access-Control-Allow-Origin; the browser correctly consumed it internally. Correct
the assertion and retain raw-header validation. All 79 affected MiniModel checks
pass. Public TLS, LiteSpeed and model qualification remain unknown. Evidence:
MiniModel commit `4b815cbb877a709e8d3060c2039c13e993c334eb` and its static-seed-browser
review receipt.

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
| T8 | Reviewing the current pinned CPU trainer found that it kept every periodic payload and copied the final adapter into a separate candidate directory, despite final-only selection. | Keep one current resumable payload, retain immutable metrics and hash-linked predecessor receipts, and bind each retirement to a verified successor before deleting bytes. A final receipt should reference the same adapter. Retiring bytes must not erase lessons, permit earlier-checkpoint selection, or imply model quality. |

T8 is implemented in `tinyrustlm/tools/qwen3-working-model-trainer.py`. Its
current final receipt uses schema `tinyrustlm.qwen3_cpu_training_receipt.v2`
and an `adapter_directory` pointing to the final checkpoint. The obsolete
candidate-copy writer and candidate staging readers were removed. A retirement
plan records intent; actual surviving files determine whether deletion finished.
Explicit verified resume can complete a partial retirement only when the plan,
receipt chain, newest payload and every surviving predecessor file still agree.
The latest adapter, configuration and optimizer/RNG state remain available.

All 113 control, trainer and canonical-scratch checks passed with zero skips.
The real checkpoint writer was exercised using tiny synthetic bytes, including
the optional model card; tests also cover three successive checkpoints,
interrupted deletion, changed replacement/survivor bytes, missing payloads,
invalid paths, linked entries, enumeration bounds and idempotent final receipts.
Standard-library trace measured 90.07% of changed executable lines, with no
branch coverage or ML training execution. Compact evidence:
`artifacts/ecosystem-cleanup-20260912/checkpoint-retention-review.json`,
SHA-256 `a9f60e1abcb2b5ff4d375975635eccc89c59e7fe20671054c7ebeb405b6972ae`.
Owned synthetic fixtures were removed. No historical model was deleted, no
storage recovery was measured, and no model qualification was established by
these checks. This change requires fresh exact trainer/environment/authorization
bindings; old locks and rejected experiments are not revived.

## Retired generic training producers

The next review traces the generic sequence/top-k trainer, its importing
teacher-cache builder, the old SmolLM2 adapter-source exporter, their three
test modules, 18 recipes and two cache controls. All 26 files are retained in
Git commit `33483be8ebdfb98b8f0ab58ed7e168da970fe523`, with exact blob identities
and any CRLF-only normalization recorded in
`artifacts/ecosystem-cleanup-20260912/retired-training-producers-review.json`
(SHA-256 `34dfbc3a7523ceeeecea5e96eec4b454f9daa074ad25d3e6e27dfb4826589efa`).
Recipe parameters are historical method descriptions; their presence does not
prove that every recipe ran.

| ID | Reviewed observation | Lesson and current application |
| --- | --- | --- |
| T9 | The July 11 distillation memory records two invalid top-k runs caused by unnormalized custom loss during gradient accumulation. The inspected old Trainer subclasses set `model_accepts_loss_kwargs = False` in their later implementation. The historical corrected run and matched sequence baseline were still rejected for behavior. | Check the actual optimizer update scale, masks and separate SFT/KL metrics; a successful structural correction does not promote a model. The current pinned trainer explicitly divides its combined microbatch loss by accumulation and records both components. These are source observations; the old runs and Torch tests were not rerun here. |
| T10 | The old cache producer requires identical teacher/student tokenizer bytes, binds rendered token IDs and assistant causal positions, resolves equal logits by token ID, and stores top-k probabilities plus normalized residual-tail mass. The consumer rejects token/position/dimension/hash drift. | Token-level supervision must preserve tokenizer, prompt, position and distribution identities. Retain these requirements for any separately authorized future method; do not re-enable a retired top-k implementation or use a rejected teacher as a product default. The current pinned lane uses same-base preservation KL and does not consume this cache format. |
| T11 | The exporter checks factor shapes, dtype, finiteness, complete layer/module pairs and serialized f32 bounds, but emits the old adapter-source format for two SmolLM2 shapes. Its integration test invokes `tinyrustlm-slm-pack validate-adapter-source`, which is absent from the current Cargo workspace and Rust source. | Validate actual serialized numerical values through a current independent consumer. Useful numerical and provenance checks belong in the current format's implementation when needed; historical cross-language tests do not justify restoring ALR1, old model shapes or an absent package. |

The generic trainer also has no checkpoint-count limit and copies a final
adapter after periodic saves. The cache builder imports that trainer's contract;
the ecosystem code-reference search found no importer outside this reviewed
group. The separate pinned working-model lane is the current authority and
already implements the T8 retention correction. The generic route is an
obsolete producer chain, not another supported way around current training gates.

The referenced top-k assessment reports were absent at their documented paths
under canonical `artifacts/reports/`. The July 11 memory and the closed Qwen3
pilot README retain historical rejection summaries, but their raw-output claims
were not independently replayed or requalified in this review. The existing D:
top-k model/cache directories were located; their payloads were not removed or
given a blanket retirement disposition. Complete their separate evidence review
before discarding useful experimental information.

Automatic approval review rejected the exact-path 26-file source/control
deletion before execution with `blocked by policy`. All 207,667 logical bytes
were subsequently rehashed and remain unchanged. The hash-checked owner script
`tinyrustlm/tools/remove-reviewed-training-producers.ps1` passed WhatIf, 37
read-only guard checks and five persistent Pester tests, including linked metadata
rejection. Pester 3.4 measured 58/96 commands (60.42%), below the 75% target;
the exact-target destructive branch was not executed because physical retirement
is policy-blocked. Current CI explicitly fails while any reviewed file
remains, before executing the obsolete test modules. The combined owner cleanup
WhatIf also passed; no removal receipt or measured storage recovery was produced.
The guard evidence is
`artifacts/ecosystem-cleanup-20260912/training-producer-retirement-checks.json`.

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

## Historical portal runtime mirror reviewed

The September 12 comparison covers 184 obsolete files under the developer
portal's `docs/runtime-portal/`, excluding the current boundary page and its
two Apache access controls. Their 1,963,723 logical bytes are all retained in
portal Git commit `7a6f9db1d33d9d19700af180917de2d45ccf9f89`.
Of those files, 164 documents match already reviewed canonical Runtime/TinyRust
material after CRLF normalization; the 24-page `runtime-pages.json` additionally
matches Runtime's `data/pages.json` byte for byte. This review does not authorize
keeping either redundant active snapshot indefinitely.

The remaining differences include later browser/source-options descriptions,
eval CLI coverage notes, and generated package/index metadata. These are
historical prose claims and old SLM1/v0 workflows. No old model, converter,
script, browser test, or deployment was executed to review them. Exact Git
identity preserves later content without presenting it as a current contract.

| Observation in retained material | Lesson and current application |
| --- | --- |
| The package README, deployment notes and health marker identify 1.0.6, while version.json identifies 1.0.7. | A directory of individually hashed historical files is not necessarily one coherent release. Keep source/package/deployment bindings separate and verify their agreement through the actual release entrypoints. The current portal C1/C2 and failing stage check are recorded in C20. |
| Later eval notes explicitly add execution of the documented native binary against fixture evidence; earlier notes mention only an eval runner. | Exercise public CLI boundaries, arguments, exit status and emitted evidence in addition to library functions. Current source-license and JS/native integration checks are recorded in C11/C17; the historical statement alone is not a newly verified passing test. |
| Browser notes distinguish a saved conversion/share script, metadata-only readiness, transferred bytes, receipt validation, and local generation. They also describe rejection before output when the advertised shard contract differs. | Report the completed action accurately and bind every transition to exact inputs and outputs. Metadata or a downloaded script must not be presented as a loaded working model. Preserve no-output-on-rejection checks in current composition acquisition; do not restore old formats or generated source kits. |
| Peer settings rerendered accepted search rows without treating normalized rows as raw API payloads, preserving source metadata and conversion choices. The notes describe duplicate-feed, oversized-input, invalid timestamp and receipt-drift cases. | Keep raw-input validation separate from display state. Bound input before parsing and verify the visible accepted state after a settings change. Current catalog tests, byte admission checks and the explicit empty-catalog smoke assertion retain these principles; those current checks do not establish live seeds or model quality. |
| Old beginner flows required local files, manual peer URLs, many JSON imports, and peer scripts; they rejected project-hosted seed routes. | These instructions conflict with the current owner requirement. Default to a usable eligible cache or small qualified MiniModel composition, permit initial MiniModel server seeds, and put HF/local/conversion/manual peer controls under Advanced. Never restore old first-run complexity while copying historical prose. |
| Historical browser smokes used loopback mappings of the public host and fixture models, while broad model quality and external availability remained unproven. | Exercise canonical root routes in a real browser, but label fixture, loopback and empty-runtime evidence precisely. Preserve current real-model qualification, numerical agreement and outside-network seed requirements. |

The compact identity/disposition record is
`TinyRustLM.MiRust.com/artifacts/ecosystem-cleanup-20260912/historical-runtime-retirement-review.json`,
SHA-256 `c0555bc18fde0b9232811444b45b8332d07fddf2d7efec57b8f024468b212108`.
Automatic approval review subsequently rejected removing the 184 raw files
with `blocked by policy`; they remain. The obsolete archive regenerator and
its copied-repository tests were removed and are verified absent. Portal
checkpoint `efce5c3` preserves the review and those changes. Of 57 focused
checks, 55 pass; two correctly fail on the surviving stage and mirror.
The replacement test independently verifies every retained Git blob.
Historical prose belongs in Git rather than another active executable archive.

## C21. Public source identities and obsolete current handoff instructions

On September 12, a bounded metadata review checked three exact public
repositories before any weight acquisition. Eleven model-card, configuration,
tokenizer-configuration and license files were read from immutable revisions;
each matched its publisher-reported byte length and Git blob ID. Weight
identities below come from publisher Git LFS metadata, not newly downloaded or
independently rehashed model payloads.

| Exact source | Observation | Disposition and lesson |
| --- | --- | --- |
| `Qwen/Qwen3-0.6B@c1899de289a04d12100db370d81485cdf75e47ca` | Published weights remain 1,503,300,328 bytes at SHA-256 `f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b`, matching the current local source lock. | This is the already rejected product checkpoint, retained as diagnostic ancestry. A fresh metadata read is not a new model or qualification. |
| `PrimeIntellect/Qwen3-0.6B@15aba67c8ec68aeac96f57ba7e31d373564ee03c` | The publisher describes a clone with tool-call template changes. Its published weight digest and length are identical to the Qwen checkpoint above. | Do not acquire it as a new derivative or create another stored copy. A different repository, revision or template does not establish different model weights or reopen a closed rejection. |
| `andresnowak/Qwen3-0.6B-instruction-finetuned@9dc09e4ae93b7f35408f4128e0896b68ed3fd7a9` | Published weights differ. The reviewed revision has no bundled LICENSE, its card contains placeholder `licence` metadata, and the named parent/dataset are not bound to immutable revisions. The card documents a recipe, full prompt/completion loss, randomized templates and truncation concerns. | Not admitted for acquisition on this evidence. Missing provenance is not a measured model-quality failure. Reported multiple-choice benchmarks do not establish this application's independent chat, numerical, browser or seeding qualification. |

Primary records: [Qwen repository](https://huggingface.co/Qwen/Qwen3-0.6B/tree/c1899de289a04d12100db370d81485cdf75e47ca),
[PrimeIntellect card](https://huggingface.co/PrimeIntellect/Qwen3-0.6B/blob/15aba67c8ec68aeac96f57ba7e31d373564ee03c/README.md),
and [instruction-finetuned card](https://huggingface.co/andresnowak/Qwen3-0.6B-instruction-finetuned/blob/9dc09e4ae93b7f35408f4128e0896b68ed3fd7a9/README.md).
The compact review, including metadata URLs, byte counts, hashes, parsed
architecture fields and exact reviewed file identities, is
`artifacts/ecosystem-cleanup-20260912/public-source-metadata-review.json`,
SHA-256 `3ede4040dbb9b7a989415ea4881976c36250fe2cf09abecfd1bf4ccc34352488`.
This review is limited to the named sources. It downloaded no model weights,
ran no model, changed no catalog or hosting, and made no storage-recovery claim.

Four active UAI handoffs still described the production acquisition owner and
browser client as missing; the receiver brief also prohibited D: writes.
Current workspace/source evidence and the owner's model-storage instruction
supersede that guidance. Architecture, operations, receiver and next-work notes
now route to implemented ownership and the actual model/hosting blockers.
The architecture note also correctly states that native and browser WASM share
the current scalar runtime. Historical intake receipts retain their original
checkpoint claims. Keep dated evidence immutable while correcting active
instructions, or old notes will cause duplicate implementations and misplaced
model copies even after the code is cleaned up.

## C22. Exercise retirement custody without recreating source copies

Portal checkpoint `d17f77a` removes the source-retirement script's fixture CLI
options, 40 conditional fixture branches and four fixture-only functions.
The old harness created an OS temporary site with public/control source copies,
fake authority-marker files and a copied mirror. Fixture mode bypassed canonical
source and immutable production-identity checks. Those alternate roots and
local copied-site transports are gone; the production definitions now have one
canonical transaction path and can be imported without executing it.

The replacement invokes the actual canonical PowerShell functions with remote
files, directories, identities and transaction records represented only in
memory. Tests retain the important failure behavior: reject identity drift
before writes; reserve durable evidence before acquiring a lock; preserve
ambiguous or foreign locks; revoke ownership after marker substitution; roll
back unproven controls; keep proven guards; never restore a deleted source after
a later deletion fails; and preserve terminal evidence if the final receipt
cannot be written. Small actual create-only JSON write tests use the owning
repository's bounded test output. Pester's temporary directory and TestDrive
are contained there and removed. No project source or authority files are
copied into those fixtures.

The review also found that Node startup variables were disabled only around
the first source preflight, then restored before later Node-dependent Git
validation. They now stay disabled for the entire transaction and are restored
on success or failure. Tests check both phases; the actual CLI with hostile
startup variables reaches the existing unbound-transport rejection before
credentials, remote requests or evidence creation.

All five focused Node checks and 23 nested PowerShell checks pass. The broader
seven-file Node suite has 58 passes and two existing physical-retirement
failures: the reviewed 1.8.3 stage and 184-file raw mirror remain. No checks were
skipped. Real canonical PHP GET/HEAD and private-route checks also pass.
Pester command coverage is 184/198 (92.93%) for the changed state, transaction
and environment functions, and 798/1329 (60.05%) for the whole script. This is
not branch coverage or actual FTPS execution; simulated success cannot attest
atomic behavior, outside-network readback or production deletion.

The compact review is
`TinyRustLM.MiRust.com/artifacts/ecosystem-cleanup-20260912/source-retirement-tool-review.json`,
SHA-256 `40cf67421007dbb4f68ca12cdde39d39451a0a36d42265d80006f296b6647b27`.
It binds the old Git identities, current tool/test bytes, verification scope
and coverage limits. The existing deployment manifest and blocked transport
authority remain unchanged. No public retirement, publication or measured
storage recovery is claimed. Preserve these failure cases through the actual
canonical implementation, rather than another executable source copy.

<a id="c23"></a>

## C23. Publication custody without copied site trees

MiniModel.org checkpoint `ef924db7b721ed3fea371fb3f29416261d8f31b8`
replaces its publication snapshots with bounded input held in memory. The
reviewed baseline is Git `10820ca733cd8b8b70390c44e5a8929bd0a8b471`.
The old writer reconstructed Git source files beneath an OS temporary snapshot
parent; its test harness made mutable source copies, replacement directories
and junction fixtures. Calling those directories operation-owned did not make
them consistent with the owner's single-source requirement.

The obsolete snapshot creator, verifier, remover, Win32 directory identity
binding and optional blob-reader test hook are removed. The publisher now
reads committed blobs and checks the current canonical files against their
exact source lengths and digests. Prepared release records are materialized
only in memory. A binding covers the operation, manifest, source commit/tree
and ordered published file identities. Upload and partial rollback authenticate
that input again, then consume its bytes without reopening mutable source.
The limits are 500 files, 16 MiB per member and 64 MiB of retained payload.
Git output and error streams are drained concurrently with byte limits and a
30-second deadline; the prior synchronous reader had neither a deadline nor
a memory bound. Empty files remain typed byte arrays and retain their actual
SHA-256 identity.

An actual Git/current-file test found that the existing manifest's catalog is
422 bytes while the current catalog is 593 bytes. The older manifest still
reproduces its bound historical commit, but it cannot publish the current
checkout. Its input fails at the current-file size bound, before the later
hash comparison. Preserve this early rejection; do not enlarge the bound or
copy older files over the checkout to make publication pass. Separate tests
also reject corruption when lengths remain equal.

All 53 Node checks and 24 nested Pester checks pass, with no skipped or
cancelled tests. The new tests exercise the actual canonical module and parsed
publisher functions. Remote bytes, renames, failures and gate responses are
represented in memory. Exact chunks, zero-length writes, incorrect offsets,
substituted payloads, changed operation/manifest bindings, retained predecessor
backups and authenticated partial rollback are checked. The first two
no-read assertions counted earlier Describe-level calls in Pester 3; explicit
It scope corrected that test isolation error without changing the guard.
Whole-module Pester command coverage is 238/545 (43.67%); this does not include
coverage from the separate custody harness or establish branch coverage,
complete publisher transaction coverage, actual FTPS or remote atomicity.

The compact review is
`MiniModel.org/artifacts/reports/publication-input-review-20260912.json`,
8,136 bytes, SHA-256
`cd61233137f0c8a6261fd576002705b5d09152238fc7d077aeb864a97edc79ed`.
It retains exact old Git and current code identities, failure observations and
limits. Owned Pester output under canonical artifacts was physically removed.
The transport remains intentionally unbound; the manifest, prepared public
records and empty expired catalog were not rewritten. Bare Node invocation,
the metadata generator, model qualification and seed hosting still need work.
No production receipt, publication, model deletion or measured storage recovery
is claimed. Preserve the custody behavior and experiment findings in canonical
code, Git history and compact notes, without recreating a second source tree.

<a id="c24"></a>

## C24. Current publication bytes and verified command boundaries

MiniModel.org commit `672991ba646cde761ba6a361fc20b5a24aaabbe0` follows
C23 by removing arbitrary manifest output and replacing broad public-directory
inclusion with an explicit 22-file boundary. The reviewed baseline is
`ef924db7b721ed3fea371fb3f29416261d8f31b8`. The generator emits metadata to
stdout, verifies only the canonical manifest, checks its owning source gate,
rejects ignored/untracked public extras and validates each Git blob's object
identity independently of a successful subprocess exit. Git reads have byte
limits and deadlines. No staging directory or public source copy is created.

Twenty canonical public files had CRLF differences from their Git objects.
They were normalized in place only after proving those differences were solely
line endings. Explicit attributes keep all 22 files byte-identical to existing
committed source. Public Git content did not change. Current source totals
110,790 bytes; the materialized publication bytes total 110,336. These are
logical identity measurements, not recovered disk space or publication proof.

Both Node invocations in the actual PowerShell publisher now use the reviewed
Node executable, source gate and generator identities. Read leases remain open
through execution. Every child excludes inherited NODE_* settings without
altering its caller, drains bounded stdout/stderr concurrently and has a
120-second deadline. Exact commit parameters also check length because end
anchors alone can match before a trailing newline.

One complete run exposed a real timeout-wrapper defect: native taskkill stderr
replaced the original timeout exception even though the observed process IDs
were subsequently absent. The wrapper now allows that native diagnostic to
complete and checks the owned process handle afterward. A still-running child
remains an error. The corrected full suite passed 64 Node checks and 27 nested
Pester checks, including three actual Node timeout terminations. Resistant
descendant-process behavior was not reproduced; root termination was verified.

The actual generator emitted current metadata without a file write, and the
actual PowerShell module accepted and materialized its complete 22-file result
in memory. The actual publisher with hostile startup settings passed both Node
boundaries, then rejected its stale manifest before public admission,
credentials or receipt creation. The first direct CLI probe lacked this service
account's established per-process Git safe-directory declarations and failed
its unchanged source gate. Correcting the invocation environment required no
global Git setting or relaxed authority check.

The compact review is
`MiniModel.org/artifacts/reports/publication-command-review-20260912.json`,
12,705 bytes, SHA-256
`a331f115fb3e2ee3588927ac596fe36ead03da1bc82d79c935fd20562187b5e5`.
It binds current and old tool identities, the 22 public files, failures and
verification scope. New generator/bootstrap line or branch coverage was not
collected; the existing custody-module metric does not quantify those changes.
Owned test output is removed. The prepared release, manifest, empty expired
catalog and unbound transport are unchanged. Fresh release-identity preparation,
model qualification and seed hosting remain open. No public-site request from
the actual publisher, FTPS operation, production receipt, model deletion or
measured storage recovery is claimed.

<a id="c25"></a>
## C25. A new publication needs current candidate bindings and its own publication date

MiniModel's old authority used the same discovery identities for the public
predecessor and the new candidate, freezing the candidate to old catalog bytes.
Both materializers also set last_publish_date from the August preparation date.
Static page and agent-guide claims would still say prepared or last published
1.1.1 after publishing the JSON records. Other guides prohibited authorized
initial seeds and told agents to recreate the existing TinyRustLM companion.

The authority now binds predecessor and candidate discovery separately while
preserving the immutable predecessor receipt and historical ledger tail. The
22-file manifest binds public source df51ec03a52f4862471dd79a9d989405db5f251f
and planned UTC publication date 2026-09-13. JavaScript and PowerShell use that
date; publication requires it to equal the UTC transaction-start day before
credentials. A later day requires reviewed metadata regeneration. Source release
records remain prepared; public status/date pointers lead to those JSON records.

Candidate verification now uses the current browser contract, including validity
windows and Ed25519 signature verification. The empty revision-3 catalog remains
expired since 2026-09-09. Its historical issuance-time check passes; current-time
verification refuses it. Metadata generation does not renew authority, qualify
a model, or establish a live seed.

The first complete run passed 65/67 Node and 26/27 nested Pester checks. One test
expected expired while the actual contract reported stale. Another incorrectly
used the advancing canonical manifest as an old rejection fixture. It now reads
exact historical Git bytes in memory. The corrected suite passed all 67 Node
and 27 nested Pester checks, with zero skips or cancellations. Full current JS
metadata materializes identically through the actual PowerShell module. Tests
reject substituted discovery, malformed dates, backdated materialization and
rewritten history. The actual publisher with hostile Node startup settings
stops at catalog expiry before public admission or credentials.

Whole custody-module command coverage is 241/562. It does not quantify the
standalone harness, new generator/bootstrap lines, branch coverage, an FTPS
transaction or real acquisition. Existing actual Node deadline tests pass;
resistant descendant termination was not reproduced. No browser smoke was run
for these page-copy changes because its old scratch workflow still needs review;
content and contract assertions were exercised.

Public-source corrections are committed as c73e266 and df51ec0. The current
package/binding checkpoint is 4f6e8cfd5698081ce7fe25b956494ea62988d08f, pushed
to the established MiniModel remote. The compact source-free review is
`MiniModel.org/artifacts/reports/publication-binding-review-20260912.json`,
19,803 bytes, SHA-256
`48b9211b89c91ff64ab8b3ece8a7311be4456500e43dc7573652a23a062bc5aa`.
It binds before/after identities, all 22 public files, failures and proof limits.
The unchanged source gate passes for registered governed roots only; it is not
a whole-volume inventory. Owned test output is removed. Transport remains
unbound; real qualification and seed hosting remain open. No historical/model
deletion, production receipt or measured storage recovery was produced.

<a id="c26"></a>
## C26. Browser failure states and cleanup need independent ownership

Reviewing MiniModel's old browser tool exposed a product failure: expired or
failed catalog loading changed the status line but left Loading placeholders,
counts and old filter callbacks in place. The new loader clears previous actions
and callbacks while loading, disables unusable controls on failure, and restores
them only after verified recovery. A per-document operation identity prevents
an older success or failure from overwriting a newer result. The content-bound
script URL was updated after the existing assertion caught its stale hash.

The old smoke tool wrote profiles and screenshots to system temp, managed a
manual CDP/debugging-port loop, stopped processes through broad command-line
matching, and suppressed cleanup errors. It now serves exactly six canonical
public inputs from bounded memory on an owned ephemeral loopback listener and
uses installed Edge with the existing canonical Playwright package. Browser and
automation temporary output is bounded under one marked MiniModel artifacts
operation. Screenshots are hashed in memory. Browsers and the listener close
before directory/marker verification and removal; cleanup failure fails the run.
No arbitrary URL or output path is accepted and no site source is copied.

The first real browser run exposed fixture-clock leakage: the next viewport
inherited the historical issuance-time clock and incorrectly appeared fresh.
Each viewport now starts a fresh browser. Eight real Edge observations cover
current expiry plus explicitly historical empty, HTTP 503 reload failure and
recovered-empty states at desktop 1440x1000 and mobile 390x844. The historical
clock is never freshness, model-qualification, seed or publication evidence.
CSS bytes are unchanged; measured layouts have no horizontal overflow and the
catalog begins inside the initial viewport. Screenshots were not retained or
manually inspected, and no pixel comparison is claimed.

The first full run passed 73/74 Node checks. Its cleanup assertion wrongly
included a concurrently running Pester operation in the shared artifacts parent.
The corrected assertion independently verifies only the browser operation's
exact directory. Node's experimental coverage collector also creates temporary
output before test helpers load. Its initial default-temp directory was removed
by Node and no node-coverage directory remained in the service account temp
listing. The corrected run set the parent process TMP/TEMP/TMPDIR to a separate
owned canonical artifact directory and verified its removal afterward.

The corrected full suite passed 74 Node and 27 nested Pester checks with zero
skips/cancellations. Node coverage for catalog.js is 90.76 percent lines and
80.82 percent branches; the browser helper is 92.88 percent lines and 88.89
percent branches. These metrics exclude JavaScript executed inside Edge and
some separate CLI invocations. Whole custody-module command coverage remains
241/562. All browser and coverage output is absent after the completed run.

Source is committed as d30114cac9326be104d0c441151caf0224425e3d; the current
prepared-package/review checkpoint is b33b1a783e20db23b77971be061388b7e4163285,
pushed to the established MiniModel remote. The source-free review is
`MiniModel.org/artifacts/reports/browser-catalog-review-20260912.json`,
17,481 bytes, SHA-256
`d2773c30e137e15d99e5dd7bb4e328ca4637e50791e61c880d49f7298fa86e6f`.
It preserves exact input identities, observed browser states, failures, coverage
scope and cleanup evidence. The unchanged source gate passes for registered
governed roots only. The 22-file package remains prepared: actual publication
still refuses expired catalog authority before public admission or credentials.
Transport, real qualification and server seeding remain unresolved. No historical
or model deletion, publication or measured storage recovery is claimed.

<a id="c27"></a>

## C27. Preserve environment rejection causes before another numerical experiment

The closed numerical v2 operation failed with the generic
`source-trace-environment-drift` code before either numerical proof arrow ran.
Review found that the source owner masked all environment-authority exceptions,
including its already typed configuration, interpreter, package RECORD and
closure failures. Current source now preserves only bounded, path-free
`EnvironmentLockError` codes. Untyped exceptions and malformed codes still fail
generically. The helper identity and environment-lock identity must pass before
the authority module executes. An unused `math` import was removed.

A read-only observation of `D:\LLMs\TinyRustLM\training-env-py312` is decisive
about the environment available now. Python is 3.12.10, but its ordinary venv
configuration lacks the lock helper's required `implementation` and
`version_info` fields. The existing helper's `--verify-runtime` command rejects
it with `qwen3-numerical-environment-config`; the corrected source-owner wrapper
retains that cause as `source-trace-environment-config`. Neither check imported
the model framework or loaded weights. The observed package versions are:

| Package | Available training environment | Numerical reference lock |
| --- | --- | --- |
| torch | 2.13.0+cpu | 2.7.0 |
| transformers | 5.13.1 | 4.51.0 |
| accelerate | 1.14.0 | 1.14.0 |
| psutil | 7.2.2 | 7.2.2 |
| safetensors | 0.8.0 | 0.5.3 |
| tokenizers | 0.22.2 | 0.21.1 |
| numpy | 2.5.1 | 2.2.5 |

Changing the configuration parser would not make this package set equal to the
pinned reference. The present mismatch does not establish the exact cause of
the historical v2 failure: its evidence did not retain that detail, and its old
request names removed, disallowed locations. Do not recreate those locations or
substitute this training environment to manufacture a reference pass. Run the
existing output-free runtime-lock preflight before model loading and before
registering another material operation.

Eight stdlib Python tests cover accepted metadata, distinct typed failures,
malformed and untyped messages, helper import failure, missing loaders and both
request identity checks. Python 3.14.4 stdlib tracing observes all 43 executable
lines in `verify_environment`; branch coverage and whole-owner coverage were
not measured. Run these tests from the canonical root with
`py -3 -B -m unittest tinyrustlm.tools.tests.qwen3_numerical_source_owner_test`.
Ruff passes through the installed Python module.

Affected historical tests now read the exact implementation bytes from Git
parent `4891e8aa15523430e2050c8370baed593d7a19d9` in memory. They do not require
current source to equal an immutable old experiment. The numerical verifier's
synthetic traces now use marked canonical artifact output, including cleanup
after setup failure, instead of OS-temp directories. All operation directories
were verified absent. The first Node run failed two stdlib self-tests because
`py -3.12` was no longer registered; using the installed interpreter for those
dependency-free checks fixed the test-launch issue. Numerical framework tests
still require their pinned interpreter.

The corrected focused suite passes 22 Node tests, with one explicitly skipped
pinned-framework hook/kernel test because no qualified oracle interpreter is
supplied. The unchanged source gate passes for registered governed roots only.
The source-free review is
`artifacts/ecosystem-cleanup-20260912/numerical-environment-review.json`,
8,421 bytes, SHA-256
`1467ff2cd0ca47724bd17b614b8967082d2006abe5924916147535ea1290f7bd`.
It binds reviewed source, unchanged historical contracts, observed environment,
failures, corrections, checks and limits.

The environment lock, numerical profile, preregistrations and terminal decision
are unchanged. Current source differs from their frozen implementation bindings;
the old operation remains closed and cannot be replayed. The numerical owners
still reference the historical source lock and closed operation. A fresh
current-license-bound source, exact environment closure and reviewed numerical
owner/registration bindings remain necessary. The original Qwen base and old
pilot adapter remain rejected for product quality. No new model, numerical
parity, model conversation, catalog renewal, publication, live server seed,
historical/model deletion or measured storage recovery is claimed.

<a id="c28"></a>

## C28. Rebuild one canonical reference environment and retain installer failures

The missing numerical reference environment was rebuilt at
`artifacts/external/qwen3-numerical-oracle/environment` inside the canonical
TinyRustLM repository. All 31 wheel filenames, lengths and SHA-256 digests
matched both PyPI metadata and downloaded bytes; none was yanked at review.
The 258,926,452-byte wheel closure is unchanged from the historical lock.
Installation used exact local wheels, disabled dependency resolution, pip cache
and bytecode compilation, and confined temporary output before the first child
started. No source checkout or model payload was copied.

The new runtime passes `pip check` and the exact installed-file/RECORD validator:
28 distributions, Python 3.12.10, 17,677 non-cache files and 1,380,702,491 logical
bytes. Its closure SHA-256 is
`54c357dca7bc249df177058f39566855b9680c113190b9c5e642015bb63a3e22`.
The canonical environment lock is
`contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json`,
30,918 bytes, SHA-256
`918a5e96605a3aaaf2aaba977c0634783647016d30484f4345eeb98b5df0a283`.
It records this installation's actual identities, not an assertion that its
files equal the removed environment. The old lock and failed operation remain
unchanged.

The source and reconstructed producers and independent verifier now bind the
new environment/profile paths. Source validation uses the corrected licensed
source lock v2. The current source-owner wrapper successfully revalidated the
installed runtime against the new lock. The new differential profile explicitly
requires a fresh execution owner and registration; its nested reference to the
closed v2 owner is historical only. Current real model-load and numerical proof
claims remain false. No compatibility branch admits the superseded paths.

The formerly skipped synthetic framework test now runs: Qwen3 capture hooks and
reconstructed NumPy kernels pass in the pinned runtime. The complete focused
suite passes 25 Node tests with zero skips, including current bindings and
rejection of old profile/environment paths; eight Python error-boundary tests
also pass. Ruff passes. These results do not qualify the base Qwen checkpoint,
whose product rejection remains unchanged.

Three installation findings matter for future work:

- A pip `--target` bootstrap put the virtualenv launcher somewhere different
  from its recorded `../../bin/virtualenv.exe` path. The strict validator
  correctly rejected it. A normal temporary bootstrap environment installed
  through pip's `--python` interface passes with four distributions and 221
  files. No package RECORD or verification rule was edited to obtain a pass.
  The base interpreter has no stdlib `venv` module; the pinned virtualenv module
  created the normal bootstrap instead. The [pip interpreter documentation](https://pip.pypa.io/en/stable/topics/python-option/)
  describes managing an environment without installing pip into it first.
- Pinned virtualenv 20.31.2 `info.py::fs_supports_symlink` creates a Windows
  capability-probe link but does not remove the destination after its temporary
  target closes. Two dangling links remained under the explicitly contained
  installer TEMP directory. `--copies` did not avoid those probes. Confining
  temporary output before interpreter/environment creation is necessary even
  when the resulting environment itself contains ordinary files only.
- PowerShell provider properties are not present on every raw .NET parent
  DirectoryInfo object. The cleanup preview now checks the actual type.
  Pester 3 negative mocks also needed separate Context scopes so a substituted
  marker did not contaminate subsequent link/path rejection tests.

Automatic approval review rejected deletion of the failed bootstrap and then
deletion of the two exact links, each stating `blocked by policy`. The unchanged
source-authority gate reports `source_authority_scan_incomplete` on those links.
Neither operation was retried through another API, renamed, truncated, or
repackaged as a parent deletion. The installer root remains pending cleanup:
431 regular files, 93 directories, two links and 296,933,889 logical bytes.
The retained reference runtime is outside that cleanup root.

The owner-run command is
`& 'E:\Source\Rust\TinyRustLM.com\tinyrustlm\tools\remove-reviewed-numerical-installer-output.ps1'`.
Its actual `-WhatIf` preview verifies a complete independently matching inventory
SHA-256 before any deletion. Five Pester tests pass. Command coverage is 86/132
(65.15 percent), below the 75 percent target because destructive cleanup and
receipt writing were not executed. The script removes only the two exact link
entries first, rechecks the ordinary inventory, and then removes the reviewed
temporary tree. No automatic invocation without `-WhatIf` was performed.

The compact review is
`artifacts/ecosystem-cleanup-20260912/canonical-numerical-reference-review.json`,
11,935 bytes, SHA-256
`a2c8470542c215fd9b4387d7d188a8d7302dde6e935688f8a7ea12d3ac0141a3`.
It retains input and installer-report identities, runtime admission, test
results, failure causes, cleanup fingerprint and limits without another archive
of executable vendor code. Source-location verification remains incomplete
until the blocked links are removed. Fresh orchestration, real numerical/model
quality evidence, a working default and live MiniModel seeding remain open.
No real checkpoint was loaded, model/publication was produced, historical/model
deletion completed, or measured storage recovery claimed in this checkpoint.

## C29. Explicit child environments still need protection from Node's defaults

Reviewed against TinyRustLM parent `4ed06094cacd83e1d384244d5da553d8b987a4ff`.
The numerical runner inherited its caller's full environment and started both
Python trace owners without isolated-mode flags. Its request accepted arbitrary
existing source, evidence and model roots. This was inadequate for a fresh run,
even with exact package and executable hashes. Package identity does not establish
the interpreter's startup mode, import search path, credentials or cache location.

The runner now checks the canonical repository and artifact boundaries before
opening output, requires separate model input roots below `D:\LLMs\TinyRustLM`,
and validates both capture parents and scratch before opening either stream.
Python stages receive `-I -B -X utf8`. Captured children and the exact-PID
termination tool receive a minimal OS/runtime environment with existing canonical
scratch for home, temporary and cache paths. The unchanged source-authority scan
must pass before source-state verification and output creation. Both affected
fixture families now use marker-owned canonical artifacts; process probes run
inline without writing temporary executable scripts.

The first ordinary focused run passed 20 tests. Instrumenting the five affected
test files then produced **53 passes and three launch failures**. Inspection of
Node 24.14.0's actual embedded `child_process` source established the cause:
`copyProcessEnvToEnv` copies the parent's `NODE_V8_COVERAGE` when an explicit
environment lacks that own property. That assignment threw on the frozen
environment before spawning. Merely making the environment mutable would have
restored unwanted output inheritance. An explicit empty `NODE_V8_COVERAGE`
property now suppresses the copy. The same instrumented suite subsequently passed
all **56 checks**, with zero skips or cancellations. Real Node and pinned Python
3.12.10 probes verify startup-variable exclusion, canonical temp paths and Python
isolation flags. Framework checks remain synthetic; they do not load a real
checkpoint or establish model quality.

V8 ranges reached 53/54 selected nonblank, non-comment, non-brace source lines in
the three new boundary functions (98.15 percent). The non-Windows PATH assignment
was not executed. This is a stated source-line measure, not whole-owner or branch
coverage. Production numerical orchestration has not been run. Two preliminary
inline harness attempts failed before tests or scratch creation because of
PowerShell 5.1 native argument quoting and pipe encoding; stdin source with ASCII
Unicode escapes fixed the harness without creating a script copy.

The source gate was rerun with the established per-process Git trust list after
an initial Git identity rejection. It still reports `source_authority_scan_incomplete`
on the two C28 virtualenv links. The scanner was not changed, and no deletion
rejection was retried. All C29-owned test and coverage output was removed; the
policy-blocked C28 installer remains. No historical/model deletion, deployment
or measured storage recovery occurred.

Compact proof: `artifacts/ecosystem-cleanup-20260912/numerical-execution-boundary-review.json`,
9,688 bytes, SHA-256
`69691ceef72f54606a9c1cebb6833219e2a20529a08f959c48a35ac27c261326`.
It binds the changed source/tests, supporting helpers, actual runtimes, embedded
Node implementation and observed failures/results. The current differential
profile still has no execution authority. The runner's closed v2 registration
coupling must be replaced with fresh current bindings, including its helper
dependencies, before any real numerical run. Historical contracts/results stay
unchanged and closed. Qualification, a working default and MiniModel seeding are
still open.

## C30. Historical evidence must not remain active execution authority

Reviewed against TinyRustLM parent `71f63fb69e014e1a8ae316b97335a38bd78336a3`.
After C28 rebuilt and bound the reference environment and C29 tightened launch
boundaries, the runner still accepted the closed v2 registration schemas. It
named the superseded source-license, environment and differential-profile files,
required an August operation identity and retained that experiment's fixed
two-skip allowance and four-file documentation commit layout. Its explicit
implementation list omitted the newly imported scratch and source-authority
helpers and the scanner's storage-policy input.

The active reader now accepts only v3 execution requests, owner contracts and
registrations. It requires the current v2 lock/profile files and corrected
source-license hash. Fourteen exact artifact roles bind the direct helpers and
their policy input. Registration IDs derive from the source-parent prefix and
canonical UTC registration date. Implementation, tests and notes must be
committed first; the final registration commit can change only its new JSON
record. Standard-gate counts require zero failures and zero skips. No real
registration has been created, and synthetic fixture counts/hashes remain
in-memory validation inputs rather than execution authority.

The current profile also described this source's quality as unproven. That
conflicted with the terminal product rejection recorded in
`tinyrustlm-qwen3-working-model-training-controls-memory-2026-08-20.md` and later
cleanup evidence. Both the current profile and registration validation now
state `terminally-rejected-for-product-use` with `runtime-diagnostic-only`
purpose. Negative checks reject relabeling the ancestry as unproven, passed or a
product default. This change does not undo its rejection or produce an eligible
derivative. The prepared `/3` owner and its three helper/policy identities are
bound in the current profile, whose material-registration claim remains false.

All **58 affected checks pass**, with zero skips or cancellations. They exercise
closed request rejection before output, current paths, missing dependencies,
operation-parent/date mismatch, forbidden quality promotion, the removed skip
allowance, actual process isolation and synthetic pinned framework kernels.
Historical registration and terminal tests retain explicit historical schemas
and verify their evidence; they no longer require the active owner to accept
closed metadata. V8 containing ranges reach 317/317 selected nonblank,
non-comment, non-brace source lines in four changed validation functions. This
is not whole-owner, branch, or real-model execution coverage.

An independent Git/current comparison proves the 4,997-byte normalized source
block containing the registered cases, thresholds, policies, process limits and
evidence names is unchanged (SHA-256
`b4b42f0710580d1ff84fa754581fee6965bd00ea452300633c310cbf596807f8`).
The profile is unchanged outside current owner bindings, quality/purpose and
the corresponding execution-status/order wording. Five named historical
registration, terminal and lock/profile artifacts remain byte-identical.

Compact proof: `artifacts/ecosystem-cleanup-20260912/numerical-current-registration-review.json`,
9,061 bytes, SHA-256
`a9f35b13c6968ca137e0028771e7f9873b9dded5215e02533801a85d13ca5e3f`.
All owned test and coverage output was removed. Fresh reads still find the two
policy-blocked C28 installer links and no owner cleanup receipt. No deletion
retry, real checkpoint load, parity result, qualified default, seed, deployment,
historical/model removal or measured storage recovery occurred. Passing fixture
validation prepares the next registration; it does not supply the missing
source/release gates or authorize replay of a closed experiment.

## C31. Canonical input custody must reach every publication boundary

Question: can the unfinished publisher eliminate copied source staging while
retaining exact artifact identity, bounded transfer and honest release claims?
The reviewed source parent is `1114003d35e52f4fdb9a2f1b76a4f3bd53ecd8db`;
the exact changed tools/tests and supporting inputs are bound in
`artifacts/ecosystem-cleanup-20260912/publication-canonical-input-review.json`.

The current path hashes canonical publication inputs, re-verifies their identity
and transfers exact bounded memory payloads. Source-copy snapshot exports and CLI
commands were removed. Predecessor/generated metadata retain bounded owned output
and verified cleanup. The marker uses an explicit commit route only after regular
artifacts are verified. The production transport-admission flag is never enabled:
ordinary FTPS operations have not established cross-host exclusion, release-wide
recovery or a final-marker-last-mutation guarantee.

The first focused run exposed stale fixtures that pretended to be the canonical
repository, expected an obsolete reparse error, or referenced a nonexistent asset.
They now inspect the real canonical root and current asset, while synthetic
negative observations remain isolated. Direct memory tests then found that
PowerShell boolean coercion rejects a valid one-byte zero payload. Explicit null
and length checks now distinguish it from null or empty bytes, including in
hashing and comparison. One new resume test initially miscounted chunks; its
payload now actually crosses the intended third-chunk boundary.

Broader checks found two integration issues. The package command still bypassed
the scratch-owning test launcher; it now invokes that launcher while retaining
the source-authority pretest. The secret scanner still required output outside
the source worktree, conflicting with canonical artifact storage. Its current
guard requires canonical artifact descendants and ordinary ancestry; staging
uses the existing ownership helper. API and CLI checks reject scattered paths,
artifact roots, junctions, replacement reports and invalid input without leaking
absolute paths. The scan count is 31: one manifest plus 30 declared public files.

An initial wider run passed 48/50 checks: the scanner rejected canonical output
and the default browser launch failed. Selecting installed Edge through the
existing channel option passed the browser check; no browser was installed and
the launch failure alone did not diagnose the missing/default browser cause.
After the fixes and additional CLI check, the complete affected run passed
**52/52**, zero skips or cancellations, including PowerShell fault cases and
12 local page observations. V8 reports manifest-tool coverage of 83.53 percent
lines / 84.75 branches and scan-tool coverage of 88.31 / 70.00. Combined line
coverage is 84.10 percent. PowerShell statement/branch coverage was not collected;
its isolated primitive tests are the closest automated evidence, not a coverage
percentage. No production FTPS mutation path was exercised against a real host.

The six affected managed memory-consistency checks pass. Invoking the actual
package command confirms its pretest stops before the suite with
`source_authority_scan_incomplete` on the two previously policy-blocked installer
links. The direct focused run is not a complete source/release gate pass.

Decision: retain the tested local refactor and keep remote capability admission
closed. All operation-owned test/coverage output was removed. Previous
policy-blocked artifacts remain; none was retried or removed. Model quality,
numerical agreement, seed availability and owner release acceptance remain open.
The owner deferred ternary/Bonsai research, so it did not expand this change.

Reusable lesson: replacing a staging mechanism requires checking its caller,
scanner, temporary-output policy and binary edge cases together. Successful local
transport mocks establish their observed mechanics only. The next smallest
release experiment is bounded read-only hosting capability discovery; it must
precede a concrete remote publication design and any live mutation.

## C32: native seed/browser identity mismatch and hosting discovery

Question: can the real native seed satisfy the browser's exact response contract,
and which existing MiniModel hosting capabilities are actually observable?
Inputs: source parent d7041a17a145bbc0a9bb25ff1b52026177310f11, the native
direct-composition server/CLI, browser installer, companion descriptor producer,
synthetic six-member Rust fixture and read-only public metadata routes. Exact
source and response identities are retained in
`artifacts/ecosystem-cleanup-20260912/native-seed-browser-contract-review.json`.

Inspection found that production browser validation demanded
X-TinyRustLM-Piece-Set-Id, but the native server neither emitted nor exposed it.
Mock servers supplied it, concealing the integration failure. The corrected
server derives the whole-member piece-set ID from canonical seed descriptor
bytes after member verification. The CLI and server share the wire structure;
the companion's existing canonical bytes and digest remain the same. This does
not define or change the separate 4-MiB Merkle protocol or qualify model bytes.

The first compilation failed because moving the DTO omitted the SeedMember
import; the import was corrected. The new browser probe initially used an
incorrect route, then still failed after route correction. Browser diagnostics
identified denial of loopback address-space access from the intercepted page.
A real loopback page server resolved that harness problem without suppressing
browser security. All six native seed responses then supplied the browser-visible
identities and correct bytes; a second real page origin was rejected. The final
Rust suite passed 23 tests, including that Edge 153.0.4234.48 probe; companion
descriptor tests passed 18 and browser installer/outside-proof tests passed 48.
All had zero skips. Strict Clippy and Rustfmt passed. cargo-llvm-cov was not
installed, so line/branch coverage is unmeasured; these behavioral checks are
the closest automated evidence. No whole-app or real-model claim follows.

At 2026-09-19T20:05:07Z, a development-machine .NET HTTPS client using normal
certificate validation observed 66.29.148.128 and LiteSpeed. Catalog/feed GETs
returned 422/263 bytes with empty lists and August 28 authority-incomplete
metadata. Catalog HEAD returned length 422; Range bytes=0-0 returned one byte,
206 and bytes 0-0/422; OPTIONS returned 200. Metadata allowed wildcard CORS.
These facts support further static-host preparation, not an assertion that seed
routes, model bytes, new configuration, long-running processes or safe remote
promotion work. This was not an independent outside-network observer. There were
no live mutations, credential reads or DNS/IIS changes.

Decision: keep the native correction and require the same descriptor-derived ID
in future signed seed announcements/static responses. Next, prepare and verify
the exact immutable static member routes against actual host capabilities; model
publication still requires qualification and complete release gates. The source
scan continues to report the two blocked installer links. None was retried,
renamed or deleted. New operation-owned test/profile output was removed; compact
results and Git source history remain.

Reusable lesson: mocked network responses can silently supply headers absent
from the real producer. Verify the actual native server through browser Fetch
with CORS enabled, and distinguish fixture-origin permission failures from
server identity failures before changing production behavior.

## C33: compile exact static seed configuration without claiming live serving

Question: can MiniModel prepare the existing browser/native transfer contract
for its observed static host without creating local model copies or inventing
new format/qualification authority? MiniModel source parent was b33b1a7; the
implementation is checkpoint b512402. Exact inputs and observed results are in
`../MiniModel.org/artifacts/reports/static-seed-preparation-review-20260919.json`
relative to the ecosystem source root's TinyRustLM directory. TinyRustLM C32
checkpoint 8515972 supplies the current native piece-set identity convention.

The compiler accepts at most 8 KiB of canonical UTF-8 descriptor bytes, validates
the sole profiles, fixed six-member order, digest spelling and native size
bounds, and hashes the exact bytes including their LF. It emits immutable remote
member paths and a hash-bound configuration with exact CORS and identity fields.
Length comes from actual server bytes, and encoded responses must be rejected
rather than concealing Content-Encoding. Application composition storage owns
persistence; no-store avoids another retained browser HTTP-cache payload.
The tool cannot write files, sign, renew a catalog, fetch, upload or establish
qualification. The site publisher still requires its existing admitted closure.

Cross-project tests read the companion's independently asserted canonical wire
fixture and hash the current ACG2 profile without executing or copying source.
The first run passed 32/34 new checks: an incorrect root for the profile path and
an overbroad assertion matching the word tokenizer caused two test failures.
Those were corrected. A coverage run passed all 69 behavioral checks but exited
1 because an empty NODE_V8_COVERAGE made the active experimental collector try
mkdir(''). A concrete owned coverage directory fixed the collector; ordinary
CLI children still explicitly suppress inherited coverage. The final 69 checks
pass with zero skips, with 90.85 percent lines and 97.22 percent branches for
the compiler. CLI subprocess behavior is tested separately from that coverage.

Apache was not found on PATH; Docker's installed client reported that its Linux
engine pipe was absent. No daemon was started, image downloaded or site changed.
Apache/LiteSpeed primary documentation supports the proposed directives, but
does not establish host execution, permitted overrides, colon-bearing remote
directory names, actual compression behavior or byte readback. Those remain
explicit host gates in MiniModel's deploy/static-seed.md. The two policy-blocked
installer links still prevent a complete source scan. Qualification, current
catalog authority, target custody and independent acquisition remain open.

Decision: retain the concrete tested generator and require real host execution
before promoting its output. Operation-owned test/coverage files were verified
removed; no model or historical payload was removed. Reusable lessons: compiler
success is separate from server behavior; bind preparation to exact producer
bytes; distinguish child coverage suppression from collector output configuration.
The next smallest experiment is executing one bounded generated configuration
on an admitted Apache/LiteSpeed target and measuring real response semantics.

## C34: execute generated host configuration and distinguish core server behavior

Question: does C33's exact generated directory configuration satisfy its HTTP
claims on an actual server? MiniModel checkpoint `01063a0` and
`../MiniModel.org/artifacts/reports/static-seed-apache-review-20260919.json`
bind the changed source, test inputs, failed attempts, final results and limits.
The existing OSM-Ubuntu distribution supplied Apache 2.4.58; no software or
image download was required. A separate loopback instance used bounded fixtures,
config, PID and logs inside canonical MiniModel artifacts. Existing server
configuration was untouched. The source scan remains incomplete on the same two
previously policy-blocked installer links; no alternate removal was attempted.

First the harness reached ECONNREFUSED before Windows/WSL localhost forwarding
became available. A bounded listener wait corrected setup. Next, requests returned
500 because Apache read the repository's parent htaccess. Explicit root
AllowOverride None/AllowOverrideList None and grants only for owned fixture
directories isolated the server. A diagnostic rerun preserved that failure before
the correction. These were harness failures, not model or seed-byte failures.

Once the harness worked, all six GET/HEAD member checks passed. Method checks
found TRACE advertised in Allow and then directly observed TRACE returning 200.
Apache core handles TRACE before per-directory rewrite rules. The generator now
reports server/vhost TraceEnable Off as a separate unverified prerequisite; it
cannot put that directive in htaccess or claim the public host already has it.
Primary Apache documentation was checked on September 19. This is a contract
mismatch, not evidence of an Apache vulnerability.

The next assertion incorrectly expected directory Allow headers on core's early
TRACE rejection. Other error responses appended an empty Allow field. Final
checks preserve exact 405 rejection and compare the nonempty allowed-method list
on other methods. All successful member identity fields still require exactly
one value, and all six bodies require exact length and hash. Compression is
enabled in a control route but suppressed for members; malformed directives fail
with 500 and ignored overrides fail identity admission.

Final result: 78 checks passed, zero failed/skipped. Generator coverage is 91.03
percent lines, 97.22 percent branches and 83.33 percent functions; the shared
companion-fixture reader is fully covered. CLI children are tested but not
instrumented. The owned server's PID/config and exit were verified before
cleanup: 20 entries/47439 logical file bytes; the coverage operation removed
6 entries/1442889 logical bytes. No physical recovery measurement, historical
deletion or real model payload removal occurred.

Decision: keep the correction and real HTTP check, and require actual hosting
admission before publication. Reusable lesson: parsing/generated-text tests
cannot establish web-server behavior; server-level controls and directory rules
have different execution boundaries. Local Apache/Alias fixtures do not prove
LiteSpeed, remote colon paths, TLS, browser CORS, qualification or public seeding.
The least next hosting measurement is read-only verification of the actual
server's directive/override capabilities and rejection behavior; no qualified
model or release authority can be inferred from it.

## C35: candidate discovery must remember rejected source identities

Question: would the proposed next candidate screen repeat already recorded
failures? The current historical selection ledger references 37 assessment
controls. Read-only comparison verified all 37 exact file hashes and their
rejected decisions: 28 source screens and nine preflight rejections. In
particular SmolLM2-1.7B at 31b70e2e869a7173562077fd711b654946d38674 and
Qwen2.5-1.5B at 989aa7980e4cf806f80c7fef2b1adb7bc71aa306 already have rejected
screens. Their recorded two-of-eight case counts are historical observations,
not new measurements or independent review. The reports' suggestion to screen
these names did not disclose those local decisions.

Code inspection found neither discovery owner nor the generic inventory
downloader consulting prior rejection identities. Introduced
`contracts/vnext/source-candidate-exclusions.v1.json` as one current negative-only
contract, retaining exact evidence paths/hashes without modifying historical
assessments. It includes the 37 decisions plus the owner's unchanged Qwen3-0.6B
rejection bound to source-lock v2. Runtime lookup does not execute old experiment
code. Revision matches reject before further discovery requests; known file
digests reject mirrors before config/license requests. The downloader checks
independently before output creation and network use. Diagnostic acquisition
through its separately bound contract is unchanged.

Final result: 14 focused checks pass with zero skips, including all evidence
identities, both discovery owners, revision and renamed-weight rejection,
preflight/quality classification, no family-wide ban, invalid API inputs, and
the existing synthetic transfer/digest/resumption checks. Lookup coverage is
88.89 percent lines, 86.36 percent branches and 100 percent functions. The
operation's remaining five coverage/marker files totalled 1663307 logical bytes
and were ownership-checked and removed. No physical recovery was measured.
Exact input identities and scope are in source-candidate-exclusions-review.json.

Decision: preserve known decisions before considering another source. No-match
means only that this policy has no matching rejection; it grants no positive
admission. Hashes detect exact known files, including renamed files, but cannot
establish tensor equivalence after reserialization/resharding. Nine preflight
decisions have no acquired weight identity and therefore exclude only their
exact repository revision. A genuinely changed candidate still needs full
provenance and fresh authorized qualification. No closed model run was repeated.

Reusable lesson: advisory shortlists must be reconciled with local results, and
an old inventory must not bypass an updated rejection policy. The next bounded
source-tool correction is replacing post-read metadata size checks with streamed
bounds and deadlines; this was observed in both discovery owners and remains
unfinished. Real source execution still cannot pass the incomplete source gate
caused by the two previously blocked installer links. No deletion retry, model
download, live discovery, quality claim or publication occurred.

## C36: response-size checks must precede parsing and include stalled bodies

Question: did source discovery actually bound untrusted evidence responses?
Inspection of both discovery owners found `response.json()`/`response.text()`
before size checks and no request deadline. Reserializing parsed JSON also
discarded whitespace before measuring size, so its limit did not describe the
bytes consumed. This was a reader defect, not evidence against any model.

The shared `huggingface-metadata.js` now bounds streamed decoded bytes before
copying/parsing, uses one fixed buffer, and gives each request a 30-second
default header-plus-body deadline. It preserves valid UTF-8 text bytes for
hashing and rejects invalid encoding. A promised body length is only an early
rejection aid; actual bytes still control admission, including decompression.
Search row bounds prevent a server from silently expanding the requested scan.
Both discovery owners preserve typed metadata failures instead of classifying
license-fetch timeouts as license defects. No retry or cached failure repair was
introduced.

Result: 26 affected tests pass, including native Node HTTP loopback execution
with stalled headers/body, observed abort closure, gzip expansion and truncated
Content-Length, plus exact/over-limit responses, split Unicode, invalid evidence,
late fetch completion and nonsettling cancellation. Existing source exclusions
and synthetic acquisition/resumption checks remain green. Reader coverage is
100 percent lines/functions and 98.28 percent branches; existing discovery
files have 86.59 and 87.78 percent lines, not full branch coverage. Across two
coverage runs, 12 remaining owned files were removed, totalling 6479093 logical bytes;
physical recovery was not measured. Input hashes and scope are retained in
`artifacts/ecosystem-cleanup-20260912/huggingface-metadata-review.json`.

Decision/lesson: bound original decoded bytes and the entire asynchronous
transfer, not a parsed reconstruction or just response headers. Loopback HTTP
proves this transport behavior but not Hugging Face availability, a valid
license/provenance chain, a useful source model, or browser inference. Requests
are individually bounded; total roster time still depends on the admitted row
count. The same incomplete source gate remains unresolved. Continue the
canonical acquisition-output review; do not rerun a closed source experiment or
treat a negative exclusion lookup as positive admission.

## C37: cached acquisition needs complete file closure and owned output

Question: could candidate tools scatter model bytes or report a cached source as
verified without all of its files? Inspection found arbitrary output roots,
link-following stat/write calls, no exclusive acquisition owner, and receipt
reuse that iterated only the receipt's own list. Both report writers separately
accepted arbitrary paths. These are storage/identity defects, not model results.

The shared candidate storage owner now admits only ordinary canonical model
paths and artifact report paths, checks portable filenames and file links,
captures directory identity, and holds an exclusive lock during acquisition.
Partial writes bind a validated file descriptor. Full repository/revision
hashes prevent directory-name collisions. Old payload locations are not adopted,
copied or migrated. Cached receipts require exact shape and complete unique
file closure, then reverify each required digest and size against the candidate.
Known rejected source identities still reject before filesystem/network effects.

One initial test expected to replace an open candidate directory, but Windows
refused its rename with EPERM. That was a failed test assumption, not a model
failure or a demonstrated application-level race rejection. The revised case
asserts the actual Windows lock behavior. Final result: 40 checks pass with no
skips; storage coverage 100 percent lines and 91.18 percent branches, acquisition
88.93 and 85.37 percent. Cases include junctions, hardlinks, stale/concurrent
locks, replacement during fetch, missing/duplicated/changed receipt files,
changed candidate evidence, and the existing native HTTP/resume paths.

Owned synthetic model fixture roots were removed and their parent verified
empty. Eight remaining source-side coverage files totalled 4210603 logical bytes
and were removed; physical recovery was not measured and model-fixture bytes
were not separately aggregated. See candidate-storage-review.json for exact
input hashes and the retained failure classification.

Reusable lesson: a receipt must be checked against the independently required
file set, not used as the authority for which files exist. Canonical lexical
paths alone do not exclude linked files or competing writers. These local
checks do not establish model quality, distributed locking, power-loss durability
or resistance to every privileged filesystem race. The next concrete fix is
bounding payload writes and small-file/template/inventory reads before excess
bytes reach disk or memory; current post-transfer limits remain insufficient.
The incomplete source gate and real-model/publication prerequisites are unchanged.

## C38: enforce byte bounds before consuming the resource

Question: did acquisition size checks prevent disk and memory growth, or merely
report it afterward? Source inspection found a final-size check after the large
file pipeline, arrayBuffer consumption before the small-file limit, and local
template/inventory reads before their size checks. The exact source/test inputs
are hashed in `artifacts/ecosystem-cleanup-20260912/acquisition-byte-limits-review.json`.

Method: put a decoded-byte transform before the disk writer; strictly validate
range start/end/total and optional lengths; apply the request deadline to bodies;
bound incremental small-file buffers; read local metadata through a size- and
identity-checked handle; retain exclusive temporary ownership through failure.
Use synthetic canonical D: fixtures and a real loopback HTTP gzip response,
without executing any model. Inject oversized streams, contradictory ranges,
stalls, local growth/truncation, sync/rename failures and temporary-name collisions.

Result: 49 checks pass, no failures or skips. Focused runs passed 12 and 21 checks.
Storage coverage is 100 percent lines/93.33 percent branches; acquisition is
90.37/87.70 percent. The overflow case preserved its initial three-byte partial;
a later correct response resumed through a shorter range and completed with the
expected digest. Stalled evidence and weight bodies released their locks; failed
publication removed its own temporary and preserved an existing collision.
Small streamed evidence preserved exact original bytes through buffer growth.

Decision: retain the corrections in the current acquisition path. Stop using
post-write size checks or unbounded whole-response reads as resource controls.
The reusable rule is to enforce a bound before forwarding bytes to the resource
being protected; compressed Content-Length is not a decoded byte limit. A range
prefix alone does not establish its end or total, and a pre-read stat alone does
not bind a later path-based unbounded read to the inspected file.

Uncertainty: cooperative local ownership and these fault cases do not prove every
privileged filesystem race, production network behavior or power-loss durability.
Eight owned source-side coverage files totalled 4322319 logical bytes and were
removed; all owned model fixtures were removed and their parent is empty. Physical
recovery and aggregate fixture bytes were not measured. No historical payload,
blocked deletion, real candidate, experiment result or deployment was changed.
The source scan and real-model/publication gates remain open; research is deferred.

## C39: a green obsolete producer can still emit unusable inventories

Question: do both discovery tools feed the current acquisition contract? The
Qwen-only producer emitted a retired v1 schema; the downloader accepted only the
supported-profile v2 schema. Both tools had passing isolated tests. Reference
inspection found only test callers for the old producer and no active references
in the other six canonical repositories' searched source/documentation paths.

Decision and method: remove the obsolete producer and dedicated test, preserving
source history in Git. Move useful Qwen2.5 cases onto the existing current owner
and test the producer/consumer boundary explicitly. The new case verifies that
current metadata reaches only the first acquisition request, deliberately stops
without returning source bytes, and that v1 rejects before filesystem/network
effects. No compatibility path or closed experiment replay was introduced.

A new access-flag regression failed first: the search row with `gated: "auto"`
was accepted. The fixed owner now rejects present private/gated/disabled flags
unless false, both in search and pinned revision metadata. Tests exercise string,
boolean and null gates plus private/disabled changes; rejected revisions make no
configuration, license or model request. Missing access metadata remains unknown
and does not establish authorization or license/provenance admission.

Result: 45 checks pass, no skips; focused corrected checks passed 19. Discovery
line coverage is 92.72 percent and whole-file branch coverage 69.63 percent; the
added executable lines are covered. Six retired-producer/duplicate checks were
removed and two current-path checks added to the previous 49-check suite.
Exact inputs, retired file identities and the initial failure are recorded in
`artifacts/ecosystem-cleanup-20260912/current-candidate-discovery-review.json`.

Reusable lesson: verify what consumes a producer's output before maintaining
another parallel tool. Isolated schema tests can both pass across an incompatible
boundary. Public-access flags need their actual values checked, and search-time
metadata must not substitute for revision-time checks. None of those metadata
checks proves useful answers, provenance, current availability or a qualified
browser default.

Retirement: two ordinary tracked files, 19408 logical bytes, removed from the
canonical tree; no copied archive. Seven remaining coverage files, 3730193 logical
bytes, removed; owned model fixtures removed and parent verified empty. Physical
recovery and aggregate fixture bytes were not measured. The source scan still
has its two blocked links; no blocked removal, live query, model run or publication
occurred. Other historical execution owners still require individual inspection.

## C40: retain failed evidence without maintaining obsolete evaluators

Question: do four planning-ledger evaluators still own distinct active contracts?
Reference and diff review found that v4 incorporates the useful preceding
semantics and binds generator v2's prior-prompt exclusion set. The older tools
were only directly exercised by their combined test suite; dated JSON evidence
retains their identities. No active callers were found in the other six
canonical repositories' searched source and documentation paths.

Method and decision: preserve every historical JSON byte and current sealed tool
hash; port useful negative/identity checks onto v4; delete the three superseded
evaluators, old generator and old combined test after exact containment and HEAD
checks. Historical tests inspect immutable records and their linked identities,
without old-schema execution support or wrappers.

Result: the original 23 checks passed. The consolidated 15 checks plus five
candidate-exclusion checks pass after removal. V4 line/branch/function coverage
is 92.67/81.82/93.33 percent; generator v2 coverage is 88.97/90.79/91.89 percent.
Six memory checks pass. Synthetic output stays under marked canonical scratch
and is removed by test teardown even on failure. Frozen observations still report
0/24 for Qwen2.5 0.5B, Qwen2.5 1.5B and LFM2 350M; 20/24 with three critical
failures for Qwen3 1.7B; and 11/24 with seven critical failures for Qwen3 0.6B.
All are rejected; no old experiment was replayed or promoted.

Reusable lesson: evidence retention does not require retaining every executable
that produced it. Preserve exact outcomes and identities, keep source history
in Git, and move useful behavioral tests onto the single current owner. A
synthetic source-screen pass grants no real model qualification.

Evidence identity: `artifacts/ecosystem-cleanup-20260912/current-task-screen-review.json`
binds all 17 retained JSON records, current inputs and five retired preimages.
Removal accounts for 211494 source bytes and 2326493 remaining coverage/scratch
bytes across 29 files; aggregate per-test fixture bytes and physical recovery
were not measured. The two installer-link removals remain blocked, so source
authority is still incomplete. Other execution tools and model payloads require
their own review; no blanket retirement or execution admission follows.

## C41: put a deadline around the whole admission operation

Question: can first-run acquisition remain busy before the model-transfer timer
starts? Exact source review found that qualification/admission fetches, body
reads and asynchronous hashes had byte/identity bounds but no shared deadline.
The app supplied cancellation only through a fetch wrapper. New lifetime-option
tests failed against the previous loader; this is source and test evidence, not
a measured historical public-browser outage.

Method: give the loader one owned AbortController and deadline for both documents
and hashes, pass the caller signal separately, race each asynchronous dependency
against terminal cancellation, and release resources in finally paths. Preserve
the first terminal reason and all existing validation. Test uncooperative
dependencies, already-aborted callers, invalid options, success cleanup and
validation failure. In actual Edge, stall either metadata document, advance the
browser clock 31 seconds and inspect UI state and transfer requests.

Result: 218 affected JavaScript checks pass; loader line/branch/function coverage
is 88.79/77.01/98.08 percent. Four selected browser checks pass in desktop and four
in mobile viewport emulation. Timeouts clear busy state and leave Generate
disabled, with zero peer model requests. Existing cancellation/deduplication and
altered-receipt checks also pass. An intermediate 92-pass/two-failure run exposed
test setup/assertion mistakes, which were corrected before the final run.

Decision and reusable lesson: byte limits do not bound elapsed waiting, and a
downstream transfer timer does not protect upstream admission. Own one lifetime
at the complete operation boundary, propagate a linked signal, stop waiting for
uncooperative asynchronous dependencies, and keep the original failure while
cleaning up. Browser clock tests exercise timeout behavior without waiting the
full interval; they do not measure actual public latency or browser suspension.

Evidence identity: `artifacts/ecosystem-cleanup-20260912/admission-lifetime-review.json`
binds source, tests, harness commands and bounded results. Final harness cleanup
removed 29 remaining files (4119154 logical bytes); per-test totals and physical
recovery are unknown. No blocked deletion, real model run, live seed or deployment
occurred. The source-authority scan still fails on the same two installer links.

## C42: enforce decoded bounds before allocation and preserve build failures

Question: did the runtime loader's declared size limits prevent oversized body
allocation? No: source inspection and four failing new checks showed that it
called `Response.arrayBuffer()` before inspecting actual length. The corrected
reader checks each decoded chunk before copying into one bounded destination,
uses the manifest's exact WASM size, cancels failed streams and releases locks.
Gzip wire length is not decoded length. Tests retain canonical JSON, SHA-256,
truncation and invalid-module rejection instead of treating smaller files as
automatically valid.

Verification also exposed test-infrastructure defects. Rust was absent from the
child PATH until the actual installed pinned toolchain was bound. Four later
test failures reported scratch cleanup rejection; review found Cargo's internal
hard links, not symlinks or an automatic approval rejection. Each of four build
trees had 40 hard-link groups whose names all stayed within its own root. The
cleaner now counts names by device/file identity and requires the full link count
inside the owned tree before deleting anything. External aliases still reject.
Exact reviewed failed-run trees were removed with that corrected check.

Cleanup had masked the original assertion: fresh builds matched each other at
576307 bytes/SHA-256
`10334d8ba8afa304b591e207ad081ee2a9b86d21bb70481a9f0dafb3d292c74b`, but differed
from the tracked module. Their printable differences exposed virtual Cargo-path
remapping under a different invoking profile. Binding the child profile to the
pinned toolchain owner reproduced the tracked 576379-byte artifact exactly, in
two new canonical build roots. The test now caches a terminal candidate-build
failure so later assertions cannot silently repeat the same failed build, and
preserves both build and cleanup errors if both occur. No artifact was promoted.

Result: 48 affected checks pass with no skips, including native HTTP and actual
Edge using a minimal synthetic module. Loader line/branch/function coverage is
93.77/86.11/95.00 percent; scratch helper is 96.88/93.02/100.00 percent. Evidence
identity: `artifacts/ecosystem-cleanup-20260912/browser-runtime-streaming-review.json`.
The four reviewed build trees contained 2908 file names/736052529 logical bytes;
three harnesses removed 13 remaining files/10365634 logical bytes. Hard-link
aliases are counted as logical names, not separately recovered physical bytes.
Aggregate per-test output and physical recovery are unknown.

Reusable lessons: enforce limits during streaming, account for decompression,
keep reproducible compiler path mapping independent of the invoking account,
and never let cleanup erase the primary failure. Internal compiler aliases need
complete containment evidence; their presence is not permission to accept an
external hard link. Local fixture and reproducible-build success establish no
real-model quality, numerical parity, live seed or deployment. Network wait
limits remain separate from these byte limits; prior policy-blocked deletions
and the incomplete source scan are unchanged.

## C43: runtime byte limits also need a lifetime and an owning operation

- **Question:** can a stalled runtime download prevent initial model discovery or
  outlive the activation that requested it?
- **Exact inputs:** current app, runtime/admission loaders, deployment manifest,
  shared lifetime and affected tests are hash-bound in
  `artifacts/ecosystem-cleanup-20260912/browser-runtime-lifetime-review.json`.
- **Method:** deferred fetch/read/hash dependencies, cancellation and late-result
  tests, actual Edge chooser traffic interception, exact deployment closure and
  fresh offline artifact reproduction.
- **Result:** 262 focused and 26 artifact/publication checks pass, plus 14 Edge
  chooser checks. The empty chooser makes no runtime request; stalled preparation
  can time out or be cancelled before model transfer. A stale activation cannot
  overtake the owner that replaced it. Initial test-harness omissions and the
  missing serving-manifest entry failed and are recorded without qualification
  claims; corrected runs pass.
- **Uncertainty:** browser checks use synthetic metadata and mobile viewport
  emulation. Deadlines bound asynchronous waiting, not synchronous CPU work or
  the entire installation. No useful model, live seed or deployment is proven.
- **Decision:** share the lifetime implementation, defer runtime preparation to
  model operations, preserve exact admission checks and recheck authority after
  waiting. Add new browser dependencies to both script order and serving closure.
- **Reusable lesson:** a byte bound does not bound waiting. Reserve operation
  ownership before the first new await, and test the actual served dependency
  graph; CommonJS unit success cannot prove browser script availability.

## C44: startup checks must follow the product's actual readiness contract

- **Question:** can the release smoke check deferred startup without discarding
  verification of the runtime files that will later be downloaded?
- **Exact inputs:** source, tests and unchanged runtime artifact identities are
  bound in `artifacts/ecosystem-cleanup-20260912/deferred-runtime-smoke-review.json`.
- **Method:** assert the fresh empty chooser before an independent invocation of
  the production loader; compare both artifacts with publication-input hashes;
  retain strict network, layout and error checks in all twelve Edge observations.
- **Result:** the final 25 checks pass, with 79.67 percent Node line coverage for
  the browser-smoke tool. Initial and diagnostic runs nevertheless intermittently
  failed on runtime `net::ERR_ABORTED` events after exact bytes verified. Twelve
  isolated minimal-page downloads passed. Stream-lock and response/signal/controller
  retention diagnostics did not establish a reliable fix. A no-signal diagnostic
  passed three times but was not retained; weakening cancellation or filtering
  errors would not establish a cause. A later handle-retention suite passed while
  its standalone command failed. That speculative implementation was removed.
- **Uncertainty:** the cause of the intermittent network event remains unproven.
  The [Fetch garbage-collection contract](https://fetch.spec.whatwg.org/#garbage-collection)
  was consulted during debugging; it does not diagnose this local observation.
  Final green checks do not prove stable release validation or useful inference.
- **Decision:** keep the corrected readiness assertions, separate hash-bound
  artifact probe and honest visible status. Preserve all failed requests as
  blocking evidence. Continue the browser/network investigation in a new bounded
  development check; no model experiment is reopened.
- **Reusable lesson:** distinguish UI readiness, verified artifact bytes and
  browser network completion. Do not pick a successful rerun as proof that an
  intermittent failure has been repaired.

## C45: separate complete byte evidence from transport-observer outcomes

- **Question:** does C44's runtime abort prove an incomplete download or an
  application lifetime defect?
- **Exact inputs:** canonical runtime, loader, lifetime and smoke/test identities
  are bound in `artifacts/ecosystem-cleanup-20260912/completed-runtime-probe-review.json`.
  Installed Edge 153.0.4234.48, Playwright 1.61.1 and Node 24.14.0 were used.
- **Method:** an owned loopback server served canonical bytes to a minimal page.
  Eight trials per native streamed/no-signal, streamed/signal, arrayBuffer/signal
  and production-loader arm ran with and without forced GC. A second matrix used
  keepalive with sixteen trials per arm/context. Every body was independently
  length/hash checked. These were bounded development diagnostics, not model runs.
- **Result:** all 64 first-matrix bodies verified. The normal context recorded no
  failures; forced GC recorded three aborts, including native fetch without a
  signal. All 128 keepalive bodies verified, with one abort in each context; the
  compact keepalive output did not retain failed-arm attribution. Keepalive was
  not adopted. The first v8 test run passed 33/34 but its response.finished wait
  timed out after requestfailed. Installed Playwright code resolves that promise
  on requestFinished, not client requestFailed. Waiting on the recorded terminal
  events fixes that wait; 34 checks now pass, including real negative transfers.
  Another 42 unchanged runtime/lifetime checks and the normal CLI also pass.
- **Uncertainty:** exact native browser internals and population event rates are
  unmeasured. The [Fetch garbage-collection contract](https://fetch.spec.whatwg.org/#garbage-collection)
  permits termination when script-visible fetch behavior cannot observe it;
  side-channel observers are excluded. Retrieved September 19, 2026; the standard
  was dated September 2. This supports separating evidence, not a native diagnosis.
- **Decision:** v8 retains raw events and only attributes completed HTTP 200 probe
  aborts after independent byte checks and exact two-request closure. Every other
  failed request blocks. Truncation, corruption, cancellation and unrelated
  failures have real-browser regression tests. Preserve C44 failures and the
  failed initial completion wait. No production loader workaround is required.
- **Reusable lesson:** state the claim each observable actually establishes.
  A complete hash-verified body and a later transport abort can coexist. An event
  observer needs its own bounded completion contract; a type signature alone
  does not prove the installed implementation handles both terminal paths.

## C46: cancellation must remain observable while source cleanup is pending

- **Question:** can a user stop installation after a malformed source has entered
  a stalled iterator-return or reader-cancel operation?
- **Exact inputs:** parent `b6a8b7e560f0c84e1478fbeb88427d87c2372423`, the unchanged
  six-member store contract and final source/test hashes in
  `artifacts/ecosystem-cleanup-20260912/composition-cleanup-cancellation-review.json`.
- **Method:** install a prior synthetic composition, feed one excess byte from a
  candidate, hold its cleanup promise, then cancel after cleanup begins. Exercise
  custom async iterator, explicit reader and native ReadableStream paths. Check
  the original error, exact prior pointer, failed-candidate removal, available
  lock, fresh-store reopen and observed late cleanup rejection. Repeat the native
  stream case with actual Edge OPFS and Web Locks.
- **Result:** before correction, three leaf cases timed out at 500 ms (44 reported
  tests: 40 pass, four fail including the parent). After using the existing
  cancellation-aware wait, all 118 affected checks pass. Two actual Edge cache
  tests and twelve direct release-smoke observations also pass. No frozen model
  experiment was rerun; synthetic storage fixtures are never live-model evidence.
- **Uncertainty:** the bounds are development-test observation limits, not product
  performance budgets. Signal-free callers have no newly introduced deadline.
  Whole-cache ownership safety and other adapter failures are not proved here.
- **Decision:** retain one current cleanup path and the new regression cases;
  preserve the primary source failure rather than replacing it with a secondary
  cleanup error. Update both shell asset identities without a visual redesign.
- **Reusable lesson:** checking a signal once before cleanup is insufficient.
  Keep cancellation attached for the duration of every cancellable wait, including
  finally blocks, and prove the next caller can acquire the lock afterward.

## C47: absence from the active pointer does not establish deletion ownership

- Question: can bounded cache cleanup delete content that no current installation
  owns, or lose the identity needed to resume a failed deletion?
- Exact inputs: C46 store at `8b24c33f1ad7949056cb6b775d7955f3cd25ed54`, synthetic
  six-member fixtures, malformed/mismatched staging markers, unowned directories,
  extra direct/nested files, wrong entry kinds, unsafe/duplicate adapter names,
  saturated inventories and injected partial/late deletion faults. Final source
  identities are in `composition-cleanup-ownership-review.json`.
- Method: first add refusal/preservation regressions, then exercise every installed
  removal path under the existing writer lock; check actual Edge OPFS separately.
- Result: initial 58-test run had 44 passes/14 failures (13 failing leaf cases).
  The first expanded run passed 67/68: a commit-order assertion caught new I/O
  between authorization and pointer replacement. Moving ownership checks before
  authorization fixed that ordering without weakening the assertion. Final affected
  suite passes 143/143; Edge 3/3; direct smoke 12 observations.
- Decision: require an exact ownership record and bounded direct-file closure;
  remove files individually, manifest last, then require an empty directory.
  Preserve staging authority when candidate cleanup fails and pointer authority
  until invalid content removal succeeds. Preserve unknown content for review.
- Uncertainty: no real model or public result; Web Locks coordinate cooperating
  writers only. Final orphan-directory failure after manifest removal can still
  need review. Reader retirement, metadata cancellation and exhaustive crash
  transition coverage remain separate work.
- Reusable lesson: bounded enumeration limits work, but does not by itself confer
  ownership. Keep cleanup authority until its dependent bytes are gone, and ensure
  safety checks preserve the existing activation linearization contract.

## C48: immutable identity does not protect a reader from retirement

- Question: can replacement delete an exact installed composition while another
  consumer is still reading it, and can reader coordination preserve cancellation?
- Exact inputs: C47 store at `04ed7687c1d53f42b57f3dd695cb014a95cefe42`, synthetic
  six-member prior/replacement compositions, deliberately paused member/scoped
  reads, queued writers/recovery, cancelled reads and actual same-origin Edge tabs.
  Final app/store/bridge/test identities are in `composition-read-lease-review.json`.
- Method: reproduce premature retirement before editing; use real Node shared/
  exclusive locks for unit concurrency and actual Edge OPFS/Web Locks for cross-tab
  scheduling and tab closure. Hold a shared composition lease through six-member
  worker transfer; take exclusive composition locks for writes/retirement.
- Result: initial regression 69/70; final affected suite 246/246, final Edge 6/6,
  direct smoke twelve observations. Store line/branch/function coverage is
  88.24/84.66/90.06 percent. Scope cancellation closes pending readers and observes
  late failures; multiple readers release independently; queued recovery/writes
  can cancel; closing the reader tab permits retirement.
- Intermediate failures: 239/241 exposed a closed companion contract missing the
  new callable method and an outdated activation source-shape assertion. Edge
  2/4 exposed byte-array/hex comparison in the new test and an observer assuming
  every lock was the global writer. Updated observers retain the exact one-writer
  invariant and distinguish identity-bound composition locks.
- Decision: keep global mutation ordering, add per-composition reader lifetime,
  require the current read-scope contract at the companion/app boundary, and retain
  existing immediate commit authorization. Never retain old model bytes merely
  as history; retire after active readers relinquish them.
- Uncertainty: fixtures do not prove real model quality or public deployment.
  Callbacks must finish/cancel and avoid mutations inside read scopes; standalone
  iterators must finish/dispose. Opened metadata is not a permanent pin. Complete
  metadata I/O deadlines and terminal crash recovery remain under review.
- Reusable lesson: content hashes prevent mixing bytes, while locks govern how
  long those bytes remain available. Model both requirements and test actual
  browser lock release instead of assuming a file snapshot survives deletion.

## C49: carry cancellation through reads, preserve authoritative writes

- Question: can a stalled metadata read keep the store locked after cancellation,
  and can fixing that accidentally obscure an already committed installation?
- Exact inputs: C48 parent `d7a852e14ab47c1d2231df91e82d39f65f11e14e`, current
  synthetic six-member fixtures and the source identities in
  `composition-read-cancellation-review.json`.
- Method: hold file acquisition, stream next/disposal, metadata hash update/digest,
  staging identity allocation and directory enumeration. Cancel after entry;
  verify exact prior pointer, no accidental recovery deletion, no candidate
  activation, released locks, a successful subsequent read and observed late
  rejection. Separately cancel after pointer commit while readback is pending.
  Repeat five read/enumeration cases with actual Edge OPFS/Web Locks.
- Result: baseline 77/78 reproduced the stalled active-pointer read. Expanded
  suites passed 121/121 and 147/147. Initial affected run 315/316 exposed an old
  source assertion; requiring signal propagation corrected that assertion. Final
  affected 317/317, Edge 7/7 without retry, direct smoke twelve observations.
  Whole-store line/branch/function coverage: 88.87/86.40/90.70 percent.
- Decision: propagate one caller signal through read-only validation, preserve
  cancellation error identity, and observe late promise failure even after a
  synchronous abort. Keep durable pointer-write/readback reconciliation authoritative;
  postcommit cancellation returns the committed result after reconciliation.
- Uncertainty: artificial stall bounds are regression observations, not product
  latency measurements. Signal-free boot remains without a deadline; initialization,
  durable writes/removals and commit reconciliation have separate lifetimes.
  No actual model, seed, deployment or complete crash-safety result is established.
- Reusable lesson: classify awaits by whether they can still change durable state.
  Releasing a lock after abandoning a read is different from abandoning a pending
  commit. Cancellation must never be misclassified as corrupt stored evidence.

## C50: startup deadlines require a read-only cache boundary

- Question: can startup leave a stalled cache check safely, without creating
  storage, poisoning the next attempt or silently acquiring another model?
- Exact inputs: C49 parent `50c0cbd954d28749196528e5f99ebe822fd23d7a`, current
  store/app/chooser code and fixtures bound in `startup-cache-lifetime-review.json`.
- Method: reproduce initialization on empty open, then remove it from the read
  path. Delay origin/root acquisition and cancel; verify a released lock and an
  independent later read. Run the production lifetime/helper/boot with a controlled
  clock; exercise empty/saved/error/late-result paths. In actual Edge desktop and
  mobile viewports, delay OPFS acquisition, advance the clock, inspect visible
  recovery copy, lock release, no created model root and zero model transfer.
- Result: baseline 148/150 with both read-only regressions failing. Initial
  affected run 335/336 exposed an assertion requiring unconditional root creation;
  update it to enforce explicit creation. Final affected 336/336, Edge 19/19,
  direct smoke twelve observations. Whole-store coverage: 90.28/86.30/94.19 percent
  for lines/branches/functions; app slices run as production code in behavioral tests.
- Decision: one 60-second startup cache lifetime through the existing helper;
  read-only open and independent OPFS root acquisition; reject late completion;
  no automatic replacement after cache or cached-activation error. Keep normal
  empty-cache bootstrap and saved-model restoration. No alternate schema or retry.
- Uncertainty: synthetic fixtures cannot establish real model quality or startup
  speed. The policy timer does not preempt synchronous work or a suspended browser.
  Durable mutations/reconciliation and terminal orphan crash recovery remain open.
- Reusable lesson: a timeout is safe only when the abandoned operation cannot
  later mutate authoritative state. An unknown cache is not an empty cache, and
  a rejected or stalled cached promise must not govern every later explicit attempt.

## C51: ownership must outlive the last byte being retired

- Question: can a bounded cleanup resume after deleting an orphan's manifest or
  after the active pointer has switched away from the retiring composition?
- Exact inputs: parent `1a1adcdc6b937de1ea7c5a448bc2ed4ec106baa5`; source, tests,
  shell and evidence identities in `composition-retirement-recovery-review.json`.
- Method: inject failure after every direct file removal, before/after directory
  removal, during marker write/readback and after marker removal. Cancel after
  marker persistence and manifest deletion; exhaust marker capacity and collide
  with the active activation ID. Preserve unexpected late entries. In actual Edge,
  close a tab paused at final orphan/replacement directory removal and resume
  cleanup from a fresh tab using persisted OPFS state and real Web Locks.
- Result: baseline 154/159; four terminal cases and their parent failed. First
  fixed store run 159/159; expanded run 181/181; final affected 369/369. Edge 9/9
  without retries/skips; twelve direct smoke observations pass. Whole-store
  line/branch/function coverage is 90.43/86.83/94.22 percent.
- Decision: persist and verify an existing-format staging marker before retiring
  content whose manifest is its remaining authority. Keep it until the directory
  is observed absent. Use retained pointer/staging authority where already present;
  reserve the active activation ID. Continue bounded, direct, nonrecursive removal.
- Uncertainty: storage fixtures do not qualify a model. Tab closure is not machine
  power loss. Durable writes/reconciliation can still stall; startup remains
  read-only and pending retirement completes when bounded cleanup is invoked.
- Reusable lesson: deleting the last ownership record before its owned directory
  creates an unrecoverable ambiguity. External authority must survive partial
  deletion, and a record serving cleanup must not impersonate an active commit.

## C52: recovery needs a product invocation and truthful cancellation state

- Question: does a returning user retire pending storage without installing
  another model, and can a cleanup deadline preserve durable mutation ownership?
- Exact inputs: parent `39b30203dd33166e81f22212e1ab62c80faafe27`; current app,
  store, tests and shell identities in `startup-composition-cleanup-review.json`.
- Method: execute the real boot/scheduler with deterministic timers and blocked
  storage promises. Check one invocation, pass limits, completed-pass counts,
  late completion/failure and cache-error suppression. Use actual Edge OPFS to
  delay a directory removal beyond deadline, inspect retained locks/status,
  release it and reload. Seed pending retirement before saved-model restoration
  with empty and unavailable catalogs. Preserve unknown files and empty origins.
- Result: baseline 366/370; initial affected 377/378 exposed an obsolete source
  assertion. Final affected 378/378; store line/branch/function coverage
  90.42/86.83/94.22 percent. Initial chooser 15/18 had diagnostics-read timing
  failures; wait for initial JSON, preserving rejection of malformed content.
  Final Edge chooser 18/18 and storage/P2P 9/9 pass without retries/skips;
  all twelve direct release-smoke observations pass.
- Decision: one background startup cleanup after a successful cache/activation
  result, capped at sixteen passes with a 60-second cancellation signal. Retain
  pending durable-write ownership; expose stopping until settlement. Keep cache
  opening read-only and avoid empty-cleanup directory creation.
- Uncertainty: counts cover completed passes, not partial removal or reclaimed
  storage. A timer cannot force a durable browser write to settle. Viewport tests
  are not physical mobile, power-loss or useful-model evidence.
- Reusable lesson: a correct recovery primitive cannot retire anything if the
  product never calls it. A nonblocking UI may coexist with a still-owned mutation;
  reporting timeout is different from proving that mutation has stopped.

## Continue the review

Before deleting an experiment that is not covered above, record its purpose,
exact inputs/operation, observed result, useful conclusion, uncertainty, and the
current code or test that should retain the lesson. Link a commit and compact
receipt or hash. Distinguish measured results from proposals and research notes.
If the evidence is insufficient, say what cannot be concluded.

Remaining review includes other training/quality runs, generated release and
seed-host experiments, other Runtime/portal report bodies, and model-production
tools. No blanket disposition for those experiments is established by this file.

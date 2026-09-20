# Ecosystem cleanup — active goal

The owner's full objective is the cleanup and code-quality review of every
project under `E:\Source\Rust`, including completion of current-only SLM2
acquisition, a real small default model and MiniModel server seeding. An audit,
fixture test or source-only change does not complete this goal.

## C61: reconcile current product instructions with startup and owner authority, September 20

The root/browser READMEs, browser architecture and companion guide still forbade
MiniModel seed hosting, required conversion in the basic flow, and in the root
README prohibited the owner's canonical D: model location. The source already
implements eligible cache restoration, small MiniModel bootstrap, seed-first peer
projection and Advanced-only conversion. The four entry guides now describe that
implemented boundary, the diagnostic-only rejected Qwen checkpoint, canonical
developer storage and the distinction between local tests and public availability.
Reviewed companion/architecture draft improvements are integrated; the unrelated
interview-demo runbook link remains an uncommitted part of the browser README.

All 156 affected existing Node checks and 38 package/memory checks pass. Twelve
Edge checks across desktop, narrow desktop, mobile viewport and reduced motion
verify automatic fixture-seed acquisition/cancellation, Advanced-only controls and
chooser behavior. No new behavioral code or test gate was introduced, and no UI
asset changed. These tests support the described source behavior, not a real model,
live seed, physical mobile result or new deployment. Details and identities are in
`artifacts/ecosystem-cleanup-20260912/current-product-guidance-review.json`.

The old announcement reader and test were rechecked against their existing pending
retirement record. Automatic review had already blocked their removal; neither was
modified or removed. The seven-repository inventory remains unchanged. Source
cleanup, real model/seed qualification, ARM64 and public release gates remain open.

## C60: release cancelled connection sockets and bind current test tools, September 20

The companion's source transport disposed failed connection sockets only for
socket/I/O errors. Cancellation escaped that filter and retained the handle until
collection. A small ownership helper now transfers a connected socket into its
stream, or disposes it before rethrowing any failure. Cancellation stays terminal;
the existing public-address checks and address fallback policy are unchanged.

Eight real IPv4/IPv6 loopback cases cover pre-cancelled connection, invalid port,
connection refusal and successful byte transfer/stream disposal. Four cases failed
against the extracted old exception filter and all eight pass after the fix.
The complete companion suite passes 228/228, with no skips. The new socket helper
has 100% measured line/branch coverage; this does not prove external DNS/TLS,
midflight remote cancellation, real model acquisition or public seed availability.

Owned build output also exposed five test helpers guessing old tool directories.
MSBuild now binds the two executable fixtures to their actual current outputs,
using one shared resolver. The DLL-only wire fixture remains a normal project
reference. Three unused root-search helpers were removed. Initial harness errors,
exact inputs, coverage and retained lessons are in
`artifacts/ecosystem-cleanup-20260912/companion-socket-ownership-review.json`.
No dependency, UI, package version or public package changed; the companion is
explicitly non-packable. Source-authority scanning still reports the two blocked
installer links, and all other model, seed, ARM64 and release gates remain open.

## C59: cancel companion preparation and chunk hashing, September 20

Companion imports had the same lifetime gap across five preparation hashes and
each member-chunk hash. All 22 controlled stage/late-outcome cases remained pending
after cancellation. The caller signal now covers every hash; late hash, transport
and progress rejections are observed even after synchronous cancellation. Chunk
errors retain role/index context. Calls without a signal and cancellation after
the store commit preserve their prior semantics; no new timeout was introduced.

All 367 affected Node checks pass, with 93.43% installer line coverage, 82.43% branch
coverage and 100% function coverage. Eight desktop Edge tests and one mobile-viewport
test pass. The new test exercises eleven hash stages with real OPFS: the prior
activation stays byte-identical, no candidate/staging remains, the writer lock is
released, and a subsequent companion install succeeds. No page errors follow late
digest rejection. These are synthetic model bytes and an injected chunk client,
not actual .NET acquisition, real model qualification or physical-mobile proof.

Both shell asset identities were refreshed without presentation changes. Current
memory, startup documentation and compact evidence are synchronized in
`artifacts/ecosystem-cleanup-20260912/companion-hash-cancellation-review.json`.
Source-authority scanning still fails on the two previously blocked installer
links. The seven-repository review found no new repository; existing changes and
all policy-blocked paths remain untouched. Model, seed and NuGet gates remain open.

## C58: cancel stalled install metadata hashing, September 20

The P2P installer applied its deadline to network reads but awaited four WebCrypto
metadata hashes directly. Sixteen controlled cases reproduced waits that remained
pending after caller cancellation or deadline expiry. The existing shared install
state now covers each hash, preserving the first terminal error and observing late
rejections. No later hash, store call or transfer starts after cancellation. The
postcommit behavior remains unchanged; this does not abort browser crypto itself.

All 222 affected Node checks pass with 89.57% installer line coverage, 77.74% branch
coverage and 98.28% function coverage. Three desktop Edge tests pass, including
successful one-click installation and persistent six-member transfer/cancellation.
The new hash test also passes at the mobile viewport. Its final desktop/mobile
checks assert no page errors after late hash rejection, no store/fetch calls and
unchanged OPFS roots. Mobile is desktop Edge emulation, not physical mobile proof.
Both shell asset hashes match the revised installer; no presentation markup changed.
All six memory checks pass. The exact owned test directory was retired after
identity/containment checks: 31 files, 3,914,884 logical bytes; physical storage
recovery was not measured. Compact result and source identities are retained.

Evidence: `artifacts/ecosystem-cleanup-20260912/p2p-metadata-cancellation-review.json`.
These are synthetic acquisition fixtures, not useful model or public seed evidence.
The source scan still stops at the same two policy-blocked installer links. No
blocked deletion, real model execution, NuGet push or production deployment occurred.

## C57: execute the packaged SDK on Linux x64, September 20

The canonical native build now runs on installed WSL Ubuntu 24.04.4 x64 with
Rust 1.96.0, and all four native ABI tests pass. The default three packages pass
the two-RID Windows/Linux audit, 86 managed core tests, 38 package tests and the
Windows packaged consumer. The same package bytes also pass all six consumer
observations in an actual Linux .NET 8.0.31 process, without a native-path override
or the compiler's library search path. Consumer restore/build used the Windows
.NET SDK against the canonical package-only project; no Linux SDK build is claimed.

Tool downloads were hash-verified and extracted under owned canonical artifacts.
The attempted system compiler installation failed on stale download URLs before
installation; after refreshing metadata, the proposed libc upgrade was declined.
Isolated compiler payloads supplied the successful build. The resulting ELF has
no RPATH/RUNPATH and references GLIBC symbols through 2.34; this one Ubuntu run
does not establish support on older distributions. Setup failures and exact
package/tool identities are retained in
`artifacts/ecosystem-cleanup-20260912/nuget-linux-consumer-review.json`.

The NuGet credential location remains recorded in `.uai/operations.uai`; no key
was read and nothing was published. Real ARM64 execution, clean three-RID release
admission, hosted-workflow/account recovery and public package readback remain.
The source-authority scan and real default-model/seed gates are still incomplete.
Automatic approval review blocked removal of the unused partial Linux header
directory `artifacts/verification/linux-sdk/tinyrustlm-operation-OFb8Tf/sysroot/usr/include`
with only "blocked by policy". That directory and its ancestors remain; no retry
or parent deletion is authorized by the successful package tests.

Disjoint tool payloads and the separate owned build/package directory were removed:
2,140,269,091 logical bytes (physical storage recovery was not measured). The
blocked headers retain 5,717,939 logical bytes plus their ownership marker and
ancestors. Initial build cleanup encountered locked compiler-analyzer DLLs; after
graceful compiler-server shutdown, the original root identity and exact remaining
inventory were checked and retirement completed. No blocked path was retried.

## C56: distinguish publishable versions from superseded versions, September 20

Both readiness owners now admit complete, consistent current-format feed reports
before deciding whether publication is needed. Already-published versions with a
newer release are blocked explicitly; missing versions can continue through the
existing release checks. Invalid or contradictory reports remain unknown.
Trusted Publishing now matches the official feed rather than a domain substring.
The previous implementation accepted a lookalike URL and treated both generic
failed and invalid reports as ready when a key was present.

All 86 focused checks pass, including 35 decision cases per implementation and
six complete local-feed scenarios each through PowerShell and native WSL Bash.
The 38 managed package checks pass. Fixtures were synthetic and all HTTP requests
were GETs; no real key was read and no package was pushed. Owned output was removed.
The first test attempt had two harness failures (Windows command-line length and
Python quoting); both were corrected without changing product expectations.

The pushed C55 GitHub run completed with nine jobs rejected before any steps ran;
it supplies no hosted validation. Linux native/consumer execution, three-RID
release admission, the existing source scan and real product gates remain open.
See `artifacts/ecosystem-cleanup-20260912/nuget-readiness-review.json`.

## C55: execute the Windows package consumer without copied source, September 19

Both consumer entry points now use one canonical project and Node runner. Exact
package references, build output, caches, CLI home and temporary files stay under
owned canonical artifacts; the runner removes them after success or failure.
Relative feeds resolve before execution. CI now packs the same three public IDs
that its next step requires; release and monitor jobs explicitly install Node 24.

The real verification path exposed two further defects. Three PowerShell builders
used incorrectly escaped path expressions that rejected normal Windows paths;
native, converter and seed builders now pass eighteen resolver cases. The package
audit rejected a missing required `share-kit` tag; P2P metadata now supplies it.
Neither audit nor release requirements were weakened.

Rust formatting, warnings-denied Clippy and all 169 Rust tests passed. A subsequent
Windows native build and managed Release run passed 86 core and 38 package tests.
After the metadata correction, all three packages and matching symbol packages
passed the actual package audit. The real consumer loaded the packaged native
library, verified fifteen ABI symbols, inspected SLM2, assembled SLM2/ACG2 fixtures,
and rejected collisions and manifest tampering. Fifteen focused Node checks pass;
the new runner has 83.96% measured line coverage. Bash syntax was checked; Linux
native/consumer execution was not established.

Four operation-owned package/build trees were retired: 1,248,986,568 logical bytes,
with physical recovery unmeasured. Consumer scratch is also absent. Source files
were not copied. The current Windows native output replaces the earlier DLL;
candidate package payloads were retired after their identities and outcomes were
recorded. See `artifacts/ecosystem-cleanup-20260912/nuget-consumer-build-review.json`.
No package was published. On September 20 the owner supplied the local NuGet
credential location; `.uai/operations.uai` records it without the secret. File
existence is confirmed; credential validity/scope, default-branch reconciliation,
complete three-RID release validation, source admission and real product gates
remain open.

## C54: keep NuGet publication current, September 19

The owner requires current NuGet publication at the Michael.Kappel profile.
Live package-index reads and the actual feed-current command found all three
current TinyRustLM IDs absent (HTTP 404), with source version 0.1.8. The profile's
older UAIX.Browser packages do not satisfy the current package graph.
Authenticated read-only GitHub inspection found default branch
`codex/enterprise-vnext-clean-20260802`, no registered release-nuget workflow,
no repository Actions secrets and no nuget-release environment. Only win-x64
native output is present locally. No publication or remote setting was changed.

Both feed checkers incorrectly converted all package-index failures into absence.
Only 404 now means missing; authentication, rate-limit, server, connection and
invalid-index failures remain unknown and block readiness. PowerShell requests
now have a 30-second timeout. The daily monitor's source no longer requires an
opt-in variable; the default-branch workflow still needs reconciliation.

All 38 focused checks and 17 package-boundary checks pass. Both canonical query
implementations execute against local HTTP controls; the complete PowerShell
command distinguishes current, missing and unknown states. Three owned test files
(4,517 logical bytes) were removed and absence verified. Physical recovery was
not measured. Live missing-feed evidence remains a failure, not a release success.

Evidence: `artifacts/ecosystem-cleanup-20260912/nuget-publication-current-review.json`
and `nuget-feed-current-20260919.json`. Complete authentication, workflow-branch
reconciliation, all native/package/consumer checks, clean source and source-authority
admission before pushing. Previously blocked deletions were not retried.

## C53: verify generated static-seed responses in Edge, September 19

MiniModel commit `4b815cbb877a709e8d3060c2039c13e993c334eb` is pushed. All 79 affected
checks pass, including six real Edge Fetch bodies, hashes and exposed identities
from Apache, plus hidden-header, query and foreign-origin controls. The first
test incorrectly expected page JavaScript to see unexposed ACAO; the assertion
was corrected without changing generated configuration. Both runs' owned output
was removed (10,658,055 logical bytes; physical recovery unmeasured). This is local
HTTP/CORS evidence with invalid-model bytes. Public TLS, LiteSpeed, qualified
installation and publication remain unproven. See MiniModel's
`artifacts/reports/static-seed-browser-review-20260919.json`.

## C52: finish pending storage cleanup on a returning visit, September 19

The app never invoked `cleanup` during startup, so interrupted retirement could
persist until another installation. The baseline checks reproduced missing
scheduling on successful restore and no-active-model startup, plus unnecessary
directory initialization on empty cleanup: 366/370 passed, with those three cases
and their enclosing boot test failing.

After successful saved-model activation or a successful check finding no active
installation, startup now schedules one separate background cleanup. Chat readiness
and chooser presentation do not await it. Cache-check and activation failures
suppress it. An empty cleanup no longer initializes directories; `openActive`
remains read-only. The scheduler admits at most sixteen bounded passes per page
under one 60-second cancellation signal. A pending durable mutation keeps its
lock until storage settles; timeout does not abandon a write and declare success.
Advanced diagnostics expose running/stopping/complete/incomplete state, typed
failure and completed-pass counts. They do not turn cleanup failure into active
cache corruption or measure bytes recovered.

All 378 affected checks pass. Whole-store coverage is 90.42% lines, 86.83%
branches and 94.22% functions; the production scheduler also runs in deterministic
timer tests. Eighteen Edge desktop/mobile-viewport chooser tests and nine Edge
storage/P2P tests pass without retry/skip. Browser evidence covers empty-store
noncreation, unknown-file preservation, a delayed real OPFS removal retaining
the writer lock after timeout, terminal release and cleanup on reload. The basic
P2P test now seeds pending retirement before return with an empty/unavailable
catalog and observes automatic cleanup while the saved model remains ready.
The direct release smoke passes all twelve observations.

The initial affected run passed 377/378; an old source assertion required return
immediately after boot flags and was updated for the new scheduling call. Initial
chooser run passed 15/18: three new assertions parsed an empty diagnostics element
before first render after reload. They now wait for JSON without swallowing
malformed nonempty JSON. These failures remain recorded in
`artifacts/ecosystem-cleanup-20260912/startup-composition-cleanup-review.json`.

The time/pass limits are policy bounds, not real-model performance measurements.
Permanently stalled durable writes, power-loss behavior, model qualification,
actual browser inference and public seeding/deployment remain open. The source
scan still fails on the same two blocked installer links; no blocked deletion was
retried. Owned output was removed, with logical totals in the receipt and physical
recovery unmeasured. Other repositories/unrelated work remain intact; the broad
goal is incomplete and ternary research remains deferred.

## C51: retain retirement ownership across terminal cleanup interruption, September 19

An orphan's hash-bound manifest was its only durable ownership evidence. Cleanup
removed that file before the directory; interruption at either final transition
could leave an empty directory that the next pass correctly refused to delete.
Replacement retirement had the same gap once the active pointer named the new
composition. The baseline regression run passed 154/159 checks; four terminal
fault cases and their enclosing test failed.

Retirement now writes and reads back an existing-format staging marker before
deleting a hash-bound orphan or superseded installation. Existing staging markers
and retained invalid pointers remain sufficient authority for their own removal
paths. The new marker stays until direct-file deletion, nonrecursive directory
removal and observed directory absence all succeed. A later bounded cleanup uses
that marker even after the manifest is gone. Staging allocation also reserves the
active pointer's activation ID, preventing a retirement marker from making the
current installation appear unresolved. No alternate storage schema was added.

All 369 affected checks pass, including interruption after each of the ten direct
files, marker write/readback faults, cancellation, capacity/collision bounds,
ambiguous removal and late unknown files. Whole-store coverage is 90.43% lines,
86.83% branches and 94.22% functions. Nine actual Edge storage/P2P tests pass without
retry or skip. Two new tests pause final directory removal, close the owning tab,
then open a fresh tab and finish cleanup with the active composition still valid.
The direct release smoke passes all twelve observations.

Evidence: `artifacts/ecosystem-cleanup-20260912/composition-retirement-recovery-review.json`.
This establishes tested storage recovery when bounded cleanup runs; it does not
make read-only startup invoke cleanup, prove power-loss durability or bound a
stalled durable mutation. Model qualification, real-model browser measurements,
live seeding and publication remain open. The same two blocked installer links
still stop the source scan; no blocked deletion was retried. Owned output was
removed; logical totals are in the receipt, physical recovery is unmeasured.
Other repositories and unrelated work remain intact. Ternary research is deferred.

## C50: bound the startup cache check, September 19

Startup called `openActive` without a deadline, and opening the cache initialized
directories before its cancellable reads. The first two regressions reproduced
unwanted initialization/root creation: 148/150 checks passed. Opening now performs
only reads; the OPFS adapter resolves each operation's root independently and
creates directories only when explicitly requested by a writer. It no longer
retains a stalled or failed root promise for later operations.

Startup uses the existing lifetime helper with a 60-second cache-check deadline,
including lock/root acquisition and verification. Timeout aborts the read, clears
the timer and rejects late results. The chooser explains that checking the saved
model timed out and offers reload; the check does not remove model bytes. Any
cache-check or cached-activation error suppresses automatic replacement acquisition
until an explicit user action. A successfully verified empty cache still takes
the automatic MiniModel seed path; successful saved-model activation still returns
directly to chat. Existing qualification and commit gates remain unchanged.

All 336 affected checks pass. Whole-store Node coverage is 90.28% lines, 86.30%
branches and 94.19% functions; app helper/boot branches are exercised as extracted
production code and in Edge. Twelve desktop/mobile-viewport chooser tests and seven
actual OPFS/P2P tests pass without retry or skip. They cover visible timeout copy,
no automatic transfer after uncertainty, late success/failure, a released writer
lock, no newly created model root, normal bootstrap, cache replacement and transfer.
Twelve direct release-smoke observations pass. The intermediate affected failure
(335/336) was an assertion demanding unconditional root creation; it now requires
the explicit creation parameter and writer initialization.

Evidence: `artifacts/ecosystem-cleanup-20260912/startup-cache-lifetime-review.json`.
The timeout is a policy bound on asynchronous waits, not a measured real-model
performance budget or preemption of synchronous work/suspended browser execution.
Actual large-model verification and startup timing remain unmeasured. Durable
write/reconciliation lifetime and terminal orphan-directory crash recovery remain
open, along with real numerical/model qualification, public seeds and deployment.
The same two policy-blocked installer links still stop the source scan; no blocked
deletion was retried. All owned scratch was removed; logical totals are in the
receipt and physical recovery is unmeasured. Other repositories/unrelated work
are preserved; the goal remains incomplete and ternary research stays deferred.

## C49: cancel cache reads without losing commit truth, September 19

A stalled active-pointer read retained the writer lock after caller cancellation.
The initial regression reproduced the defect: 77/78 tests passed, with the new
case still pending at its 500 ms observation bound. Metadata file acquisition,
streaming, hashing and directory enumeration now receive the caller's signal
through restore, recovery, cleanup and candidate validation. Staging-identity
allocation and input-authority preparation also respect cancellation. Cancelled
reads remain cancellation errors, not corrupt-cache or indeterminate-commit errors.

The shared wait helper observes late rejection even when an adapter aborts the
signal synchronously before returning its promise. Abort listeners detach on
cancellation; stalled stream disposal cannot retain the store lock. Durable
pointer writes and their authoritative reconciliation still drain to a known
outcome. A dedicated postcommit test cancels during staging readback and verifies
that the committed candidate is returned. No storage schema or visual design changes.

All 317 affected checks pass, with whole-store Node coverage of 88.87% lines,
86.40% branches and 90.70% functions. Seven actual Edge storage/P2P tests pass
without retry or skip, including five injected read/enumeration stalls over real
OPFS that preserve pointer bytes and release Web Locks. Twelve direct release-smoke
observations pass. The intermediate affected run passed 315/316; its one failure
was an old source-shape assertion, now updated to require signal propagation.
Synthetic composition bytes establish storage behavior only.

Evidence: `artifacts/ecosystem-cleanup-20260912/composition-read-cancellation-review.json`.
Owned temporary output was removed: 42 files, 11,651,894 logical bytes; physical
space recovery is unmeasured. Browser profiles were separately removed by their
owned-profile helper. The seven-repository inventory is unchanged; this checkpoint
changes only TinyRustLM and preserves unrelated work.

Signal-free startup restoration still has no new deadline. Initialization and
durable mutation/reconciliation waits are not made interruptible by this change.
Terminal orphan-directory crash cleanup, real model qualification, a live initial
seed and publication remain open. The same two blocked installer links still stop
the source-authority scan; no blocked deletion was retried. Ternary research remains
deferred, and the broader goal is incomplete.

## C48: keep composition bytes alive while readers use them, September 19

The store released its global lock before callers consumed `streamMember`.
A second store could commit a replacement and delete the prior directory while
its reader was suspended. The added concurrency regression reproduced premature
retirement: the first run passed 69/70 tests and failed the reader invariant.

Each immutable composition now has a shared read lock and an exclusive write/
retirement lock. Mutations take the global writer lock before a composition lock;
readers never take the writer lock. Standalone member iterators pin their member
until completion/disposal. The app's full cached load uses a callback read scope
across all six transfers and worker activation. Scope exit closes unfinished
streams; cancellation interrupts the callback/read wait, observes late rejection,
and releases its lease. Queued precommit writes and explicit cleanup/recovery
remain cancellable. Postcommit retirement preserves the committed outcome.

The companion bridge's closed opened-result contract now requires callable
`withRead`; it rejects missing/noncallable scope methods. The current binary
composition formats are unchanged. Both shell asset lists bind the new app,
store and companion scripts; visual markup is unchanged.

All 246 affected unit/integration/publication checks pass. Store Node coverage is
88.24% lines, 84.66% branches and 90.06% functions. Six installed-Edge checks pass,
including actual cross-tab OPFS/Web Locks, six-member hash verification, delayed
retirement, release on reader-tab closure, existing cache behavior and the direct
P2P acquisition UI/transport fixtures. The direct zero-argument release smoke
passes twelve observations. Model bytes remain synthetic; this is not real model
quality, public reachability or deployment evidence.

Intermediate failures remain recorded: 239/241 affected checks exposed the
companion field-list mismatch and a source assertion tied to the old call shape.
The first Edge run passed 2/4; a test compared digest bytes with hex text, and the
old observer counted the new composition lock as a second global writer. The
corrected test verifies one global writer, a separate composition lock, exact
lock identities and allowed modes; it does not permit concurrent global writers.

Evidence: `artifacts/ecosystem-cleanup-20260912/composition-read-lease-review.json`.
Callbacks must finish/cancel, dispose streams, and avoid store mutations while
holding a read scope. Metadata objects alone do not pin files. Arbitrary same-origin
code is outside cooperative lock guarantees. Remaining metadata I/O lifetime and
terminal orphan cleanup/crash cases are still open. Owned scratch was removed;
logical sizes are recorded, physical recovery is unmeasured. The seven repository
inventory is unchanged; only TinyRustLM changes here. Source scan still stops at
the two previously blocked installer links. No blocked deletion was retried, no
real default/initial seed is established, and ternary research stays deferred.

## C47: admit cache ownership before deletion, September 19

The composition store recursively deleted unrecognized staging entries and
inactive installed entries. A hash-shaped directory name alone did not establish
ownership. Thirteen new leaf regressions reproduced deletion or missing refusal;
the initial run reported 44 passes and 14 failures including the parent test.

Cleanup now requires a canonical filename-bound staging marker, an active pointer,
this installation's ownership, or a hash-bound current manifest for an orphan.
It admits only the six member files and four custody files, with an eleven-entry
sentinel scan. A complete parent scan is bounded to 130 entries; reaching the
sentinel refuses deletion. Malformed markers, unexpected names, directories in
file slots and unsafe/duplicate adapter entries are retained or rejected.
Candidate creation checks that its path is vacant before and after staging.

Deletion removes admitted direct files with the manifest last, then removes the
empty directory nonrecursively. A late unexpected child therefore survives.
Failed candidate retirement retains its staging marker; corrupt-active recovery
retains the invalid pointer until content deletion succeeds. Prior and candidate
closures are checked before commit authorization. An intermediate 67/68 run
caught added I/O after that authorization; moving the checks before authorization
preserved the existing immediate-commit contract without weakening its test.

All 143 affected unit/integration/publication checks pass. Store Node coverage is
87.96% lines, 83.51% branches and 90.54% functions. Three installed-Edge tests pass
with real OPFS/Web Locks: unexpected-file preservation/recovery refusal, late
source cancellation and persistent-cache/restart behavior. The direct zero-argument
release-smoke runner passes twelve observations. Both shells bind the new store
script; visual markup and the current six-member format remain unchanged.

Evidence: `artifacts/ecosystem-cleanup-20260912/composition-cleanup-ownership-review.json`.
All model bytes used here are synthetic. The writer lock coordinates cooperating
store operations; it does not isolate hostile same-origin code. A terminal orphan
directory-removal failure after manifest removal can leave an empty or unexpected
entry requiring review. Active reader lifetime and metadata I/O cancellation need
further work; this is not complete crash-safety or retirement proof.

Seven canonical repositories were inventoried; only TinyRustLM changes here.
Operation-owned output was removed with logical sizes recorded; physical recovery
was not measured. Source scanning still stops at the same two blocked installer
links. No blocked deletion was retried, and package preflight, real model/default,
initial public seed and publication gates remain open. Ternary research is deferred.

## C46: keep cancellation active during failed source cleanup, September 19

The composition store checked cancellation before iterator cleanup, then awaited
the iterator's return without listening for a later cancellation. A malformed
source with a stalled return could therefore keep the writer lock indefinitely
after the user cancelled. Reproducers failed for a custom iterator, reader adapter
and native ReadableStream; all three exceeded the 500 ms test observation bound.

The cleanup wait now uses the store's existing cancellation boundary. It preserves
the original validation failure and observes late cleanup rejection. It cannot
activate the failed candidate or replace the prior pointer. The two generated
shells bind the new script hash; visual markup and the six-member format are
unchanged. All 118 affected unit/integration/publication checks pass, with store
Node line/branch/function coverage of 86.75/80.51/89.13 percent. Two installed-Edge
tests pass, including real OPFS/Web Locks with delayed stream cleanup and the
existing persistent-cache/restart/tamper checks. The directly invoked zero-argument
release-smoke runner passes twelve observations and verifies cleanup.

Evidence: `artifacts/ecosystem-cleanup-20260912/composition-cleanup-cancellation-review.json`.
Fixtures are explicitly synthetic and never qualify a real model. Cancellation
requires a supplied signal; this change does not introduce a storage deadline or
prove every storage failure path. Further cache ownership/replacement review
remains part of the active goal. Owned test output was removed; only logical byte
counts were measured. Seven canonical repositories were inventoried, and this
checkpoint changes TinyRustLM only. The read-only source scan still stops at the
same two blocked installer links; the package preflight and material/public gates
remain open. No blocked deletion, real model, seed or deployment is claimed.

## C45: distinguish verified probe bodies from browser transport events, September 19

A minimal Edge page reproduced the runtime abort without application code and,
in one forced-GC case, without an AbortSignal. All 64 downloaded bodies had the
exact expected size and SHA-256; three forced-GC cases reported `net::ERR_ABORTED`.
A separate 128-case keepalive matrix retained two such events. Keepalive was not
adopted. These observations distinguish complete script-visible bytes from the
browser's network event; they do not identify the exact native browser cause.

Smoke report v8 retains raw failures and separately identifies only completed,
independently hash-verified probe requests with exact HTTP 200 responses. The two
probe GETs must have unique identities and the declared runtime paths/origin.
Startup or unrelated failures, other errors, missing/duplicate requests, truncated
or corrupted bytes still fail. The unchanged production loader retains all byte,
identity, timeout and cancellation checks. No v7 compatibility reader was added.

The first implementation passed 33/34 tests but timed out waiting for Playwright's
response completion after a requestfailed event. Inspection of installed 1.61.1
confirmed that client failure delivery does not resolve that completion promise.
The smoke now waits, with a deadline, on its actual terminal-event ledger. The
corrected suite passes all 34 checks: two sets of twelve Edge observations plus
four real-browser fault cases. Node smoke coverage is 83.32% lines, 90.95% branches
and 79.66% functions. All 42 unchanged loader/lifetime checks pass; the normal
zero-argument command passes twelve observations and verifies cleanup.

Evidence: `artifacts/ecosystem-cleanup-20260912/completed-runtime-probe-review.json`.
C44's failed outcomes remain historical evidence. C45 supersedes its blanket
interpretation of a probe abort as failed bytes; no claim that those events have
stopped is made. Owned scratch was removed, with only logical sizes measured.
This checkpoint changes TinyRustLM only. The same two blocked installer links
still prevent the source scan; no deletion bypass, model run, seed or deployment
is claimed. Ternary/Bonsai research remains deferred.

## C44: reconcile the release smoke with deferred startup, September 19

The release smoke still required eager WASM verification after C43 deliberately
removed that startup dependency. It now requires a verified empty catalog, zero
startup runtime requests, deferred runtime state and a present disabled send
button. It separately invokes the production runtime loader and binds the actual
downloaded module and canonical manifest to independently hashed publication
inputs. The sole report schema is v7; no v6 compatibility reader was added.
The visible status now says `Runs locally` instead of claiming `WASM ready`
before preparation. Both existing shells remain in parity; styling is unchanged.

The final affected suite passed all 25 checks with no skips, including twelve
installed-Edge observations across four routes and three viewport sizes. Browser
smoke Node line/branch coverage was 79.67/81.05 percent. Browser-evaluated callbacks
are exercised by Edge but are not included as covered Node functions.

**Release smoke stability remains unresolved.** The first run failed on an
intermittent `net::ERR_ABORTED` event despite exact runtime bytes passing loader
verification. Separate diagnostic runs both passed and failed. Retaining handles,
responses, signals or controllers, omitting reader-lock release, and disabling
HTTP keep-alive did not establish a reliable correction. A temporary no-signal
diagnostic passed three times but was not adopted. The standalone smoke also
failed during a discarded handle-retention variant. Those failures are retained;
the final green run does not establish that the instability is fixed. All failed
request, identity, privacy and layout gates remain in force. Speculative loader
or browser-lifetime changes were removed.

Evidence: `artifacts/ecosystem-cleanup-20260912/deferred-runtime-smoke-review.json`.
Owned diagnostic output was removed and the scratch parents verified empty.
Only logical file sizes were counted; physical recovery and output already
removed by per-test cleanup were not measured. Seven canonical repositories were
inventoried; this checkpoint changes TinyRustLM only. The source scan still stops
at the same two policy-blocked installer links. No real model, seed, deployment
or new material execution is claimed. Ternary/Bonsai research remains deferred.

## C43: defer and bound browser runtime preparation, September 19

The empty-model page no longer waits for the runtime manifest or WASM before
opening the cache and discovering models. Restore, P2P installation, companion
installation and local import prepare the verified runtime when needed. Existing
runtime/admission identity checks remain mandatory, and acquisition rechecks
current qualification after that wait. Activation reserves ownership before the
download; a superseded completion cannot register a model or replace its successor.

The runtime and catalog admission loaders now share `operation-lifetime.js`.
Runtime fetches, reads and hashing share one 60-second default deadline, with an
explicit caller cancellation signal and a configurable 1-120000 ms test/caller
budget. The admission loader retains its 30-second default. Timeout clears the
chooser's busy state and reports a retry action. Cancellation reaches both fetch
and reader waits; ignored or late dependency results cannot publish readiness.
Decoded byte limits, canonical manifests, hashes and worker ownership still apply.

All 262 focused checks and 26 artifact/publication checks pass. The latter include
two fresh offline builds matching the unchanged tracked WASM. Fourteen installed
Edge chooser checks pass across desktop and mobile viewport emulation, including
zero runtime requests for an empty installation and timeout/cancellation before
any peer model transfer. Runtime loader line/branch/function coverage is
92.88/85.71/96.00 percent; the shared lifetime is 94.74/77.78/100.00 percent.

Development failures are retained in the receipt: an initial unit run had missing
injected dependencies and timed out; the first chooser run omitted the new script
from the serving manifest, rejected admission before fetching and timed out.
The new test also needed its explicit admission route. The corrected deployment
closure contains 31 artifacts, including the shared helper, and both HTML shells
bind 20 assets. No visual styling or public release was changed.

Evidence: `artifacts/ecosystem-cleanup-20260912/browser-runtime-lifetime-review.json`.
Owned scratch was removed and its six parents verified empty. Cleanup counts are
logical file sizes, not measured physical recovery; per-test removed output is
not included. No model was run or qualified, no seed or site was published, and
the same two blocked installer links still prevent source scan completion.
Ternary/Bonsai research remains deferred; the ecosystem goal remains incomplete.

## C42: bound runtime downloads and contain build verification, September 19

The WASM loader previously checked body size only after `Response.arrayBuffer()`
had allocated the entire response. It now streams into a bounded buffer, checks
each decoded chunk before copying and cancels on overflow. The manifest limit
remains 16 KiB; the WASM buffer uses the exact validated manifest byte count,
bounded to 16 MiB. Compressed Content-Length is treated as wire size, while
decoded size is checked independently. Canonical manifest, final length, hash
and WASM validation remain unchanged. Static shell hashes were regenerated.

Runtime-build tests no longer create scratch under `E:\Source\.codex-tmp`.
They use marked canonical artifacts and retain the original failure if cleanup
also fails. The first expanded run could not discover Rust through PATH. After
binding the installed pinned toolchain, cleanup exposed Cargo's internal hard
links and masked a reproducibility mismatch. Review found 40 internal link groups
per owned build tree, with every linked name contained. The shared cleaner now
admits only complete internal hard-link groups; outside links, symlinks and
identity drift remain rejection cases.

Fresh builds agreed with each other but initially embedded `cargo-home` rather
than the tracked artifact's `build-home\\.cargo` virtual paths because the invoking
account differed from the toolchain owner. Binding the isolated build environment's
profile to that owner restored the exact tracked module: 576379 bytes,
SHA-256 `05e9a497f4aab23a1bc0bc4aed3027a2e4914f5aa70c0e79ecbeb50b5fbe8467`.
No Rust source, public WASM or manifest was replaced or promoted.

All 48 affected checks pass, including two fresh offline runtime builds, real
loopback gzip/chunked HTTP, installed Edge stream checks and cleanup negatives.
Loader line/branch/function coverage is 93.77/86.11/95.00 percent; scratch helper
coverage is 96.88/93.02/100.00 percent. The browser transport fixture is a minimal
synthetic module, not useful inference or a model qualification result.

Evidence: `artifacts/ecosystem-cleanup-20260912/browser-runtime-streaming-review.json`.
Four failed-run build trees were reviewed and removed after the internal-link
check was corrected: 2908 file names and 736052529 logical bytes, including hard
link aliases. Three harness cleanups removed another 13 remaining files,
10365634 logical bytes. Per-test fixture totals and physical storage recovery
were not measured. All three owned scratch parents are empty. Existing unrelated
output and prior policy-blocked paths were untouched.

The source scan still fails on the same two installer links. Runtime network
waiting is not bounded by this byte-size change; model admission, numerical,
useful-browser, live seed and publication gates remain open. Ternary research
stays deferred.

## C41: bound browser admission checks, September 19

The browser checked qualification and admission documents before starting the
model-transfer timeout. Those checks bounded bytes but could wait indefinitely
for a fetch, body read or injected hash. Added one 30-second deadline spanning
both documents and their hashes, with explicit caller cancellation and stable
timeout/abort errors. The loader owns the fetch signal; the app passes its caller
signal separately so cancellation cannot replace the deadline. Timers, listeners
and stream locks are released, and invalid responses abort the owned fetch.

The chooser now reports that checking the model took too long, clears its busy
state and permits another explicit attempt. It never starts model transfer after
that timeout. Existing byte, hash, qualification and six-member identity gates
remain intact. Both static shells bind the updated script hashes; appearance is
unchanged.

Verification: 218 affected JavaScript checks pass without failures or skips.
Loader line/branch/function coverage is 88.79/77.01/98.08 percent. Installed Edge
passes four selected checks at each of desktop and mobile viewport sizes: stalled
qualification, stalled admission, existing Cancel/deduplication, and altered
receipt rejection. The two timeout cases advance the browser clock by 31 seconds
and observe zero peer model requests. These are synthetic metadata fixtures on a
local server, not real model, physical mobile, public network or seed evidence.

Evidence: `artifacts/ecosystem-cleanup-20260912/admission-lifetime-review.json`.
The initial new contract tests failed against the previous loader. An intermediate
run also exposed two test defects (an incorrectly supplied response option and a
stale wiring assertion); both were corrected before the final passing run. The
final unit and browser harnesses removed 29 remaining owned files, 4119154 logical
bytes; aggregate per-test fixture bytes and physical recovery were not measured.
Both operation scratch parents are empty. Unrelated existing smoke output is
preserved.

The source-authority scan again reports the same two unreadable installer links.
Their removals remain policy-blocked and were not retried. Source admission,
numerical parity, a qualified default, real browser inference and public seed/
publication evidence remain open. Ternary/Bonsai/Hadamard research stays deferred.

## C40: retire superseded task-screen executables, September 19

The planning-ledger screen had four parallel evaluator implementations and two
case generators. The v4 evaluator already owns the current contract, including
the v2 generator's exposed-prompt exclusions. Removed the v1/v2/v3 evaluators,
v1 generator and old combined test suite after verifying all five ordinary files
against Git HEAD and their exact contained paths. Their 211494 logical bytes are
retired from the worktree; Git retains source history without copied code trees.

Moved useful parsing, malformed-versus-semantic failure, critical-case, direct
and indexed weight identity, parent identity and capture/template checks to the
current evaluator's suite. Current registrations explicitly reject old schemas
and authority escalation. Tests now allocate marked scratch under canonical
artifacts and remove it after success or failure.

All 17 committed task-specialist JSON records remain byte-identical. The five
closed experiments remain rejected: Qwen2.5 0.5B, Qwen2.5 1.5B and LFM2 350M each
passed 0/24; Qwen3 1.7B passed 20/24 with three critical failures; Qwen3 0.6B
passed 11/24 with seven critical failures. Those are historical observations,
not fresh model runs. Record checks bind registrations, manifests, outcomes and
non-authority without loading an obsolete evaluator. Current evaluator,
generator and capture implementation bytes are unchanged; sealed tool identities
are preserved. No experiment was reopened.

Verification: original task suites passed 23 checks; the consolidated suite
passes 15, and the final run including five candidate-exclusion checks passes
20 with no failures or skips. Current evaluator coverage is 92.67% lines,
81.82% branches and 93.33% functions; generator coverage is 88.97%, 90.79% and
91.89% respectively. Six UAI memory checks also pass. No live source references
to the retired executables remain in the searched active paths across all seven
repositories. Historical JSON references are retained as evidence.

Evidence: `artifacts/ecosystem-cleanup-20260912/current-task-screen-review.json`.
Across baseline, focused and final coverage runs, 29 remaining owned files
(2326493 logical bytes) were removed; per-test fixture totals and physical
storage recovery were not measured. The canonical scratch parent is empty.
Two previously policy-blocked installer links still prevent a complete source
scan; no blocked deletion was retried. Other cleanup, source admission, numerical
parity, qualified default, browser and public seed/publication work remains open.
Ternary/Bonsai/Hadamard research stays deferred.

## C39: retire the incompatible discovery producer, September 19

Removed `huggingface-qwen-candidates.js` and its dedicated old-format test. It
emitted `huggingface_candidate_inventory.v1`, whereas the current downloader
accepts only `huggingface_supported_candidate_inventory.v2`. Its only live
references were tests; the other six canonical repositories had no active
references in the searched source/documentation paths. The current discovery
owner already supports Qwen2.5 alongside Qwen3 and SmolLM2. No compatibility
reader, forwarding CLI or extra source copy was added.

Moved useful Qwen2.5 shape, immutable revision, packaging, license-filter and
duplicate-weight checks onto the current producer. An integration check now
passes its inventory to the acquisition boundary; the former schema rejects
before any request or candidate-directory creation. Shared metadata, exclusion
and output tests exercise the sole owner instead of a retired parallel tool.

The review exposed a second concrete defect: discovery accepted a string-valued
gate and did not recheck access flags on pinned revision metadata. A regression
first failed because `gated: "auto"` produced an accepted candidate. Search and
revision metadata now reject present private/gated/disabled flags unless exactly
false. Missing flags remain metadata uncertainty, not a claim of authorized
acquisition, provenance, redistribution rights or model quality.

All 45 affected checks pass. This replaces 49 prior checks by removing six
old-producer/duplicate checks and adding two current-path checks, without dropping
their useful negative cases. The sole discovery file has 92.72 percent line
coverage; whole-file branch coverage is 69.63 percent, and every added executable
line is exercised. Metadata failures, exclusions, byte limits, ownership and
resumption remain covered. The initial regression failure is retained in
`artifacts/ecosystem-cleanup-20260912/current-candidate-discovery-review.json`.

The two removed files totalled 19408 logical bytes; Git retains their history.
Seven remaining owned coverage files, 3730193 logical bytes, were removed. Owned
model fixtures were removed and the fixture parent is empty. Physical recovery
and aggregate fixture bytes were not measured. No real model, public discovery
query, closed experiment or deployment ran. The source scan still fails on the
same two blocked installer links; real model and hosting gates remain open.

Current discovery entry point: `tinyrustlm/tools/huggingface-supported-candidates.js`
with an absolute canonical artifact JSON output and one declared profile ID
(`qwen3-0.6b-bpe`, `smollm2-360m-instruct-bpe` or `qwen2.5-1.5b-bpe`). Metadata
eligibility does not qualify a candidate. Continue the review of historical
execution owners and producer/consumer closure while material gates stay open.

## C38: enforce acquisition limits before writes and allocations, September 19

Large downloads previously checked for excess bytes after writing the complete
response. Configuration/license downloads buffered an unbounded response before
their size check, and local template/inventory reads allocated before checking
size. These defects are now corrected in the existing acquisition path.

A decoded-byte limiter precedes the file writer. Resumed responses must bind
the exact start, valid end and expected total; valid shorter ranges can continue
within the existing retry limit. Compressed ranges are refused because their
offsets do not establish decoded-file positions. Optional Content-Length values
must be valid integers and agree with an identity-encoded range. The same request
deadline now covers body consumption and writing. Overflow leaves only a bounded
unverified partial; later transfer still verifies the complete file before promotion.

Configuration/license streams use bounded buffer growth, preserving original
bytes. Tokenizer metadata cannot advertise more than the existing 32 MiB small-file
limit. A shared local reader checks size before allocation, binds the open file
identity, handles short reads and detects mutations. It covers cached evidence,
templates, receipts and CLI inventories. Evidence/receipt publication removes only
its own temporary after failure and preserves a pre-existing name collision.

All 49 affected checks pass, including actual loopback HTTP gzip expansion,
oversized streamed bodies, contradictory ranges, body stalls, interrupted transfer
resumption, local mutations and write/rename failures. Storage coverage is 100
percent lines/93.33 percent branches; acquisition is 90.37/87.70 percent. Focused
runs passed 12 and then 21 checks before the final 49-check coverage run.

Owned D: synthetic fixtures were removed and their parent verified empty. Eight
remaining source-side coverage files, 4322319 logical bytes, were removed;
physical recovery and aggregate per-test fixture deletion bytes were not measured.
Evidence: `artifacts/ecosystem-cleanup-20260912/acquisition-byte-limits-review.json`.

This checkpoint does not download or qualify a real model, replay an experiment,
change the quantization profile, or publish anything. Ternary/Bonsai research
remains deferred. The two policy-blocked installer links still prevent source scan
completion. Independent candidate admission, real numerical/browser quality and
public seed/publication evidence remain required; these fixes do not pass those gates.

## C37: contain candidate output and verify complete cached sources, September 19

Candidate acquisition accepted arbitrary output roots, followed existing file
links, and had no exclusive writer. Its cached-receipt check verified only the
files named by the receipt; an incomplete list could therefore omit required
source bytes. Both discovery owners also wrote reports to unrestricted paths.

Added one storage owner: absolute ordinary Windows model paths under
`D:\LLMs\TinyRustLM`, canonical artifact subdirectories for reports, portable
filenames, linked-file rejection, captured directory identity, and an exclusive
acquisition lock. Abandoned locks require inspection and are not silently
adopted. Partial writes use a validated open file descriptor. The candidate
directory name hashes the full repository/revision identity to avoid separator
collisions and overlong names; older directories are not migrated or adopted.
Report publication is shared by both discovery tools instead of duplicated.

Cached receipts must have the exact current shape, all expected files exactly
once, current configuration/license/tokenizer/weight identities, and matching
bytes on disk. Acquisition recomputes the advertised weight-set identity and
rejects tokenizer/weight filename collisions. Failure after fetch cancels an
unconsumed response; rejection does not trigger repair or another download.

All 40 affected checks pass. Coverage is 100 percent lines/91.18 percent branches
for the new storage owner and 88.93/85.37 percent for acquisition. The initial
directory-swap test failed because Windows returned EPERM while the owner lock
was open, before application identity validation ran. Its corrected test asserts
that observed OS protection; this is not a proof of every filesystem race.
Other cases cover traversal, junctions, hardlinks, concurrent owners, stale
locks, post-fetch replacement, receipt omissions/tampering, and native HTTP
transfer/resumption. No test uses a real model or modifies historical payloads.

All owned synthetic model fixtures under the canonical D: store were removed
and the fixture parent is empty. Owned source-side coverage output was removed:
eight remaining files, 4210603 logical bytes; physical recovery was not measured.
Model-fixture deletion byte totals were not separately aggregated. Evidence:
`artifacts/ecosystem-cleanup-20260912/candidate-storage-review.json`.

The next downloader correction is still necessary before material acquisition:
large transfers check byte counts after writing, config/license responses are
buffered before their final size check, and template/inventory reads need
pre-read limits. The source scan still fails on the same two policy-blocked
installer links. No blocked deletion was retried, model downloaded, closed
experiment replayed, source qualified or public site deployed. Ternary research
remains deferred.

## C36: bound candidate metadata while receiving it, September 19

Replaced both discovery tools' duplicated whole-response JSON/text readers with
one streaming metadata reader. The previous size check ran after allocation and
JSON parsing; it also measured reserialized JSON rather than the received bytes.
The new reader caps original decoded bytes before parsing: 16 MiB for API JSON,
1 MiB for configuration/template and ordinary text, and the existing 256 KiB
limit for the Qwen-specific license file. A fixed bounded buffer avoids an
unbounded list of tiny chunks. Valid UTF-8, including a BOM, is preserved for
text hashing; malformed UTF-8 and JSON fail explicitly.

Each request has a 30-second default deadline spanning headers and the complete
body. The programmatic `requestTimeoutMs` option accepts integers from 1 through
120000 milliseconds. Timeout/HTTP/oversize/encoding errors retain metadata
failure codes rather than becoming license judgments. Cancellation does not
wait indefinitely for a broken stream. Search responses exceeding the requested
row limit fail before model-specific requests. There are no automatic retries.

All 26 affected checks pass, including actual Node HTTP fetch against an owned
loopback server: stalled headers, stalled bodies with observed socket closure,
gzip expansion beyond the bound, and truncated bodies. Other checks cover
boundary bytes, tiny chunks, Unicode splits, late fetch completion, hanging
cancellation, misleading lengths, oversized JSON whitespace, both discovery
owners, prior exclusions and acquisition/digest/resume behavior. New reader
coverage is 100 percent lines/functions and 98.28 percent branches; the two
existing discovery files have 86.59/87.78 percent line coverage. Owned test and
coverage output across two runs was removed: 12 remaining files, 6479093 logical bytes; physical
recovery was not measured. See
`artifacts/ecosystem-cleanup-20260912/huggingface-metadata-review.json`.

These are request bounds, not a whole-discovery latency promise or a model
qualification result. The source gate was rerun and still fails on the same two
policy-blocked installer links; no deletion retry occurred. No external candidate
search, model download, closed experiment replay or publication occurred. The
next acquisition review must enforce canonical output ownership and distinguish
metadata eligibility from real source quality and execution admission. Ternary
research remains deferred.

## C35: preserve source rejection decisions during candidate acquisition, September 19

Checked the 37 historical candidate assessments against their recorded SHA-256
identities. They comprise 28 source-screen rejections and nine preflight
rejections. The report suggestions SmolLM2-1.7B-Instruct and
Qwen2.5-1.5B-Instruct already have rejected exact-revision screens; current
guidance now identifies that evidence instead of presenting them as new leads.
This inspection did not rerun or independently regrade those screens.

Both candidate-discovery tools and the inventory downloader omitted these prior
decisions. Added one current negative-only exclusion contract and shared lookup:
38 exact model/revision entries including the owner-rejected Qwen3-0.6B, with
29 known weight-file hashes. Discovery rejects known revisions before further
model requests, then checks weight hashes after pinned metadata. Acquisition
checks independently before creating output or fetching, so an old inventory
cannot bypass the decision. Renaming a repository or a file does not change its
known rejected byte identity. Existing diagnostic contracts remain separate.

All 14 affected checks pass, including canonical assessment/lock identities,
both discovery paths, rejection before filesystem/network effects, and ordinary
download/digest/resume behavior with synthetic loopback bytes. New lookup
coverage is 88.89 percent lines, 86.36 percent branches and 100 percent functions.
Owned coverage/test output was removed: five remaining files, 1663307 logical
bytes. Physical storage recovery was not measured. Compact evidence is
`artifacts/ecosystem-cleanup-20260912/source-candidate-exclusions-review.json`.

No match is not license, provenance, quality or execution admission. Exact file
hashes cannot detect tensor-equivalent reserialization or resharding. Existing
candidate metadata readers also still need their post-read size checks replaced
with bounded streaming/deadlines before another live discovery run. No network
discovery, model download, material experiment, qualification or publication
occurred here. The same two policy-blocked installer links still leave the
source scan incomplete; no deletion was retried. Ternary research stays deferred.

## C34: execute the static seed configuration on Apache, September 19

MiniModel checkpoint `01063a0` adds a real installed-Apache HTTP integration
check. Apache 2.4.58 was available in the existing OSM-Ubuntu WSL distribution;
an independent loopback instance used only owned canonical test output. No
software/image installation, existing-site configuration edit or remote mutation
was needed. The instance was stopped by its exact PID/config identity and its
output removed after verified exit.

Execution found a concrete gap in C33: core TRACE returned 200 despite the
directory method rule. The plan now declares `TraceEnable Off` as an unverified
server/vhost prerequisite, separate from `.htaccess`. All 78 affected checks
pass, including six complete GET/HEAD bodies and exact identity headers, active
compression controls, rejected paths/queries/methods, and override failure.
Generator coverage is 91.03 percent lines and 97.22 percent branches. Earlier
harness startup/isolation and error-header assertion failures are retained in
MiniModel's `artifacts/reports/static-seed-apache-review-20260919.json` and lesson
C34. Temporary output cleanup is verified; physical recovery is unmeasured.

This is local HTTP with deliberately invalid model fixture bytes. The Alias
mapping establishes URL spelling, not the remote filesystem's colon support.
TLS, real-browser CORS on this server, LiteSpeed, qualified model availability,
public hosting and publication remain unproven. The source scan still stops at
the two policy-blocked installer links; no deletion retry occurred. No historical
or model payload was removed. Ternary/Bonsai research remains deferred.

## C33: MiniModel static seed preparation, September 19

MiniModel checkpoint `b512402` adds a bounded generator for the existing
Rust/companion six-member descriptor. It produces exact immutable member URLs,
expected response identities and hash-bound per-directory header configuration.
It performs no upload, credential access, source/model copying, signing or
catalog renewal. Generated preparation explicitly cannot authorize publication.
The existing site publisher's 22-file closure and admission gates are unchanged.

All 69 affected MiniModel checks pass, including cross-project wire/profile
identity, malformed/oversized/injected input rejection, exact URL/header output
and the actual stdin CLI. Generator coverage is 90.85 percent lines and 97.22
percent branches. The separate CLI subprocesses pass but are not instrumented
by that percentage. Coverage output was kept in owned artifacts and removed.

This is configuration preparation, not host execution. Apache was not found on
PATH and the installed Docker client could not connect to its Linux engine;
no service was started or image downloaded. Actual LiteSpeed override/module
permissions, remote directory naming and six-member readback remain unverified.
MiniModel's `deploy/static-seed.md` defines those gates, exact response semantics
and remote payload retirement. Evidence is in its
`artifacts/reports/static-seed-preparation-review-20260919.json` and lesson C33.
No public files, model payloads or historical cleanup targets were changed.
The incomplete source scan, unbound publication transport, qualified default
and live seed remain open. Ternary research remains deferred.

## C32: native seed and browser identity agreement, September 19

Fixed a real producer/consumer mismatch: the browser requires the piece-set
identity header, while the native Rust server omitted it and its CORS exposure.
The server now hashes the canonical path-free six-member seed descriptor after
verifying member hashes and graph closure. The CLI and server share its Rust
representation; companion wire bytes remain unchanged. No alternate reader or
format was introduced. The whole-member transfer identity is documented in
`docs/server-seeded-startup-2026-09-12.md`.

All 23 Rust tests pass with the explicit browser feature, including actual Edge
fetches from all six native routes and foreign-origin rejection. All 18 companion
descriptor tests and 48 affected JavaScript installer/proof checks pass, with
zero skips. Rustfmt and strict Clippy pass. Rust coverage tooling is unavailable;
no numerical coverage percentage is claimed. The browser probe uses tiny
synthetic members and proves transport agreement only, not installed-model
quality or public seeding.

Read-only MiniModel HTTPS probes found reachable metadata, HEAD, a one-byte 206
range response and CORS on LiteSpeed. The live catalog/feed have August 28
metadata, zero entries/announcements, missing current authority fields and the
superseded no-server-bytes policy. This development-machine observation does not
prove model routes, process hosting, publication consistency or outside-network
acquisition. No credentials, DNS, IIS or remote files were changed.

The unchanged source-authority scan still fails on the two policy-blocked C28
links. Full release gates, a qualified default and live initial seed remain
open. Operation-owned fixtures and browser profiles were removed; no historical
or model payload was removed and no physical storage recovery was measured.
Exact inputs, failed probes, results and limits are retained in lesson C32 and
`artifacts/ecosystem-cleanup-20260912/native-seed-browser-contract-review.json`.

## C31: canonical publication inputs, September 19

The local publication refactor now binds the exact canonical file closure and
reads bounded, hash-verified payloads into memory for staging. Retired source-copy
snapshot APIs and commands are gone. Generated release/predecessor metadata and
secret-scan evidence stay in canonical artifacts with verified ownership and
cleanup. The deployment test command now invokes the launcher that owns its
PowerShell scratch directory.

All 52 affected Node checks pass, including the PowerShell primitive suite and
12 local page observations in installed Edge. The two changed JavaScript tools
have 84.10 percent combined line coverage; PowerShell coverage was not measured.
The secret scan covers the manifest and 30 declared public files. Tests cover
wrong identity/length/hash, interrupted transfer and authenticated readback,
single-zero-byte payloads, corrupted stage replacement, canonical output paths,
predecessor cleanup, and the guarded final-marker route.

All six affected managed memory-consistency checks pass. An actual
`npm run test:deployment` invocation stopped at its preserved pretest with
`source_authority_scan_incomplete` on the two recorded installer links; it did
not run the suite. The 52-check result above is the explicit focused invocation,
not a successful complete source/release gate.

This is local implementation evidence. The production transport gate still
rejects publication before credential loading or remote mutation: cross-host
exclusion, release-wide recovery and final-marker-last-mutation guarantees remain
unproven. Source scanning still has its recorded policy-blocked installer links.
No deployment, model run, qualified default, initial seed, historical/model
deletion or measured storage recovery occurred. Existing unrelated work remains
separate. The owner deferred ternary/Bonsai research and requested continued
implementation.

Exact inputs, results, failures, coverage limits and next decisions are in
`artifacts/ecosystem-cleanup-20260912/publication-canonical-input-review.json`
and lesson C31. Future publication needs actual hosting evidence and complete
release gates; the local suite does not authorize claiming a usable release.

## Discovery and preservation

A recursive directory inspection on 2026-09-12 found seven Git repositories,
5,595 directories, no reparse points and no unreadable directories. No nested
Git repositories were found. `_archive` and `_screenshots` are empty. The
workspace also contains editor configuration and private deployment credentials;
credential contents are not part of this report.

All active handoff buckets are placeholder-only. The four README files in the
Runtime and TinyRustLM developer-site buckets were inspected and are intake
instructions, not unprocessed submissions. Existing changes were retained;
their paths and hashes are in `artifacts/ecosystem-cleanup-20260912/initial-state.json`.
The canonical source-authority gate passed before edits.

## Project state

| Repository | Responsibility | Initial review state |
| --- | --- | --- |
| LMComposer.com | Retired product redirect | Storage-policy change pending; redirect and release tests need review |
| MiniModel.MiRust.com | Catalog/protocol documentation | Storage-policy change pending; seed-hosting guidance needs reconciliation |
| MiniModel.org | Catalog and authorized initial seed | Existing catalog changes retained; no real entries or deployed seed |
| MiRust.com | Ecosystem governance and discovery | Existing publication-tool changes retained; tests and cross-site guidance need review |
| Runtime.MiRust.com | Retired documentation redirect | Storage-policy change pending; retained duplicate historical material needs review |
| TinyRustLM.com | Rust/WASM runtime, application and managed companion | Extensive unfinished changes retained; SLM1 support, current acquisition, model qualification and seeding remain open |
| TinyRustLM.MiRust.com | Current developer portal | Existing deployment-verifier changes retained; documentation and historical-copy boundaries need review |

## Completion requirements

1. Inventory identities, changes, dependencies, contracts, artifacts and deployment
   state for all seven projects; give every active intake file a disposition.
2. Integrate valuable unique work and physically remove verified obsolete files,
   duplicate code and generated clutter without making new source copies.
3. Trace actual execution paths, fix supported defects and remove obsolete
   readers/writers, dependencies and compatibility code. Preserve the visual design.
4. Align producers, consumers, tests and current guidance, including authorized
   MiniModel seed hosting, current-only SLM2, Advanced controls, cache restoration
   and a genuinely working small model. Resolve real hosting and model blockers.
5. Run appropriate unit, native, browser and cross-project checks; make coherent
   commits and push the established remotes. Do not publish unrelated sites.
6. Verify removals and final state, clean operation output, and report each
   project's results and remaining limitations with commit and test evidence.

All six requirements remain open. The 44 reviewed SLM1 payloads were deleted
by the owner and independently checked absent before this goal; their remaining
support code is part of this goal. `X:\LLMS` is outside the cleanup scope.

The owner's additional instruction requires useful experimental findings to be
recorded before obsolete experiment files are retired. Reviewed observations,
lessons, evidence references and remaining review scope live in the canonical
[experiment lessons](../wiki/runtime-mirust/reports/ecosystem-experiment-lessons-2026-09-12.md).

## Completed checkpoints

- Fetched all seven established remotes without changing worktree content.
- LMComposer's 20 tests and MiRust's nine site tests passed as initial baselines.
- MiniModel.MiRust's preview previously returned arbitrary repository files.
  It now shares one explicit 27-file publication policy with checksum and
  manifest generation. HTTP excludes Apache configuration and all undeclared
  files; it rejects traversal, links, foreign Host headers and unsupported
  methods. Seven real-HTTP/policy tests passed, with 96.39% preview line coverage
  and 100% policy coverage. These are local tooling changes, not publication.
  Committed and pushed as MiniModel.MiRust `91b04e7`; remote HEAD was verified.
- MiRust's pending publisher corrections passed review and all 14 repository
  tests, including 44 PowerShell custody checks. They preserve directory-list
  collection identity, admit the first file's empty journal, and retain exact
  predecessor byte arrays for rollback. Transport was simulated; no publication
  or WordPress changes occurred.
  Committed and pushed as MiRust `ad4ffb4`.
- Runtime's test-created Git repository, copied generator, product stage and
  authority-marker fixtures were removed from the test implementation. The
  replacement checks use in-memory Git/filesystem boundaries and a real
  read-only canonical Git check. Apache uses the canonical document root;
  generated configuration and shell-verifier output use owned artifacts.
  All 27 executable checks passed, including real PHP and shell/PowerShell
  response verification; two real-Apache checks were visibly skipped because
  Apache is unavailable. The operation left no files in Runtime `artifacts`.
  Committed and pushed as Runtime `d395307`.
- Runtime's next source candidate (1.2.0) removes the archive-package writer
  and redirects old document routes to current portal pages. Physical removal
  of its 174 tracked historical documents (1,622,848 logical bytes) was rejected
  by automatic approval review as `blocked by policy`; the files still exist.
  An exact-hash PowerShell cleanup was prepared and its WhatIf validated all
  174 files. The owner was asked to run it. The candidate currently has two
  failing completion checks: docs-root absence and the not-yet-committed Git
  closure. Other executed checks passed; Apache is still unavailable.
- LMComposer's historical-manifest command no longer recursively deletes its
  staging directory or writes eight source/public-file copies. It reproduces
  the exact closed-operation metadata to stdout and rejects new source commits
  or output arguments. All 21 tests passed. Automatic approval review also
  blocked removal of the existing eight staging files; those remain on disk.
  The tooling correction was committed and pushed as LMComposer `1922472`.
- MiniModel's 32 catalog/cross-project checks passed. Its active UAI now
  distinguishes the prepared 1.1.2 candidate and expired empty catalog from
  historical 1.1.1 publication, and records the owner's initial-server-seed
  authorization. The TinyRust catalog/P2P module suites passed 61 checks with
  77.42% catalog and 88.71% installer line coverage. All peer/model test data
  was synthetic; no qualification, deployment or live seeding is claimed.
  The consumer/installer modules were committed and pushed as TinyRust
  `4e1ee34`; the site reader, contract tests and corrected current guidance
  were committed and pushed as MiniModel.org `5bb1a0d`.
- A scope-aware parse of TinyRust's application found 32 unreferenced function
  declarations and dependent helpers. Removed 442 lines, including the old
  key/value manifest parser, v0 peer-import request writer, unused single-file
  conversion request writer and obsolete model-option helpers. The removal
  record contains names and hashes, not another source snapshot. Active legacy
  catalog/peer readers still require separate removal and browser verification.
  The 54 application/acquisition checks and all 25 desktop chooser checks passed
  after removal. Root/app shell parity passed for 20 content-bound assets.
- TinyRust's catalog-admission loader, streaming SHA-256, persistent composition
  store, and companion installer passed 87 unit checks. Line coverage was 88.19%,
  100%, 84.80%, and 92.49% respectively. Committed and pushed as `3302239`.
  The cache-restart and direct-peer browser checks passed using synthetic bytes.
  Browser profile fixtures now use one ownership-checked helper under the
  canonical project's artifacts directory and are removed after browsers close.
  The first rerun caught a profile-label mismatch; it was corrected and both
  direct-peer checks passed on rerun. No profile directories remain.
- The developer portal's PHP preview had an arbitrary-file delegation path.
  It now serves only manifest-declared static readbacks and rejects private
  files, path aliases, links, foreign Host headers, and write methods. Eight
  real PHP/HTTP checks passed; bounded path probes were removed. PHP coverage
  instrumentation is unavailable. Public byte bindings still require refresh;
  this correction has not been deployed.
  Committed and pushed as developer portal `55dac9c`.

- Removed the active v0 catalog/announcement, contact-book, receipt-ledger,
  peer-status-file and companion-inventory-file workflows from the app. The
  current signed six-member catalog is the sole discovery authority. Advanced
  manual-peer checks count matching unexpired signed listings and do not claim
  network reachability. Hugging Face discovery requires an explicit choice when
  one source matches multiple current compositions. The 106 targeted checks and
  50 desktop/mobile chooser checks passed; root/app parity covers 19 assets.
  The complete integration checkpoint was committed and pushed as `fec548b`.
- Automatic review blocked removal of the obsolete announcement reader and its
  test. Those two files and LMComposer's eight historical stage files remain.
  `tinyrustlm/tools/remove-reviewed-retired-files.ps1` validated all ten exact
  files with WhatIf and awaits owner execution. Its inventory SHA-256 is
  `1a1205236ba881f2c25d2964876540ce3f0653f86a3579e5c791eeb1f9ce0922`;
  the pending logical size is 20,586 bytes. The old announcement test remains
  incompatible with the retired API; the full test suite is not claimed green.
- Tightened the TinyRust preview to reject foreign Host headers, path aliases,
  stale asset hashes and model-member declarations. Release metadata and three
  affected fixture suites now use bounded canonical artifacts. Seventeen
  server/shell/manifest checks passed, with 88.42% static-server line coverage.
  This source preparation does not represent a published release.
- Fixed runtime-client chunk transfer so producer offsets survive worker transfer,
  and resolved the worker relative to the loaded client script. Ten unit checks
  and three profile-ownership checks passed. A locked offline Rust/WASM build
  initialized/released the actual worker in two fresh Edge profiles, then deleted
  both. An initial missing-default-toolchain failure was resolved with the
  already installed toolchain in the test process. No real model was loaded.

- Runtime-client correction and owned profile helper committed and pushed as
  `d684db0`. The companion capability reader now rejects empty chunks and more
  than 65,536 chunks while retaining timeout/cancellation through body reads.
  All 29 capability and independent cryptographic-vector checks passed.
  The separate C#/JS seed integration test still contains copied-repository
  fixture construction; it has not been run and must be corrected first.
- Recorded nine historical quantization comparisons against eight source-golden
  cases, verifying golden SHA-256 and equal prompt token IDs. F32 matched all
  eight first-token choices; compressed variants matched between one and seven.
  The compact evidence and lessons preserve those findings without restoring
  any of the nine absent old model payloads. No current qualification is implied.

- Committed and pushed the current-only chooser integration as `fec548b`, including
  app assets, current acquisition/cache tests, declared publication paths,
  explicit source preview, and prepared-release labels. The 53 acquisition
  browser checks passed; three persistent-profile cases are intentionally
  desktop-only and were skipped on mobile. Twelve additional desktop/mobile
  shell checks passed, including public-host routing, offline status, keyboard
  access, long labels and reduced motion. Forty-six acquisition-race and cache
  tampering checks passed. An AST review removed 67 unreferenced constants left
  by retired loaders; the affected 96 unit/boundary checks passed afterward.
- Thirty-seven release/server/shell/fixture checks also passed against the
  staged deployment validator loaded in memory. Only its required artifact-root
  and retirement changes are included; the larger existing deployment custody
  implementation remains uncommitted and requires separate review. The pending
  announcement-file deletion remains blocked and full release gates are open.

- MiniModel.MiRust's metadata builders now emit stdout from one bounded canonical
  Git commit. Its publisher reads canonical files and rechecks the exact locked
  stream before transport. Route-smoke expectations are checked against committed
  bytes, preserving the lesson from the historical heading-mismatch failure.
  Fourteen tests passed, including 30 PowerShell checks with in-memory transport;
  metadata line coverage was 98.80%. Committed and pushed as `04d05ac`.
- MiniModel.MiRust prepared 1.1.1 documentation now states the authorized initial
  server seed, cached/default startup and Advanced acquisition controls. Public
  LF attributes keep Windows checkout bytes identical to Git digests. All 27
  canonical public files passed publication preflight (92,555 logical bytes),
  and real Edge checks passed for home/updates at desktop and mobile widths.
  Source, checksums and manifest checkpoints `67026c6`, `cf1cc5c` and `b437611`
  are pushed. No transport occurred; last publication remains 1.1.0.
- Its retained `deploy/staging/1.1.0` contains 27 exact historical copies with
  no unique work (87,424 logical bytes). Automatic approval review rejected
  deletion with `blocked by policy`; the stage remains. Its compact inventory
  and historical publish-failure lesson are committed. The exact-hash
  `tools/remove-reviewed-stage.ps1 -WhatIf` passed; physical retirement awaits
  owner execution, and no recovered-space claim is made.
- TinyRust's C#/JS seed integration now uses a canonical native fixture host
  and one conversion fixture with two synthetic input variants. It creates no
  copied repository, rewritten converter, temporary source project or copied
  host build. Six integration/helper checks passed, including real authenticated
  loopback calls, four independent seed lifecycles, capacity rejection and
  idempotent start/stop. Helper line coverage was 100%; C# coverage was not
  collected for that checkpoint. The canonical offline native build had zero warnings/errors,
  and all 44 affected native transfer/conversion/seed-service tests passed.
  Operation-owned scratch was removed. These are synthetic fixture results,
  not model qualification or external P2P evidence. Committed and pushed as
  `6617ca1`.
- All ten companion-test files that used system temp or `.codex-tmp` now use
  canonical, ownership-checked scratch. Their owner markers stay outside test
  data so production empty-directory and exact-inventory checks remain intact.
  Cleanup bounds enumeration and unlinks fixture directory links without
  traversing their targets. Both native and JavaScript fixture roots are empty.
- The wider native run initially passed 211 tests and exposed one real journal
  race: readers could open a just-created history file before its writer finished.
  Journal reads and writes now share a bounded reentrant in-process lock and
  one exclusive process lock. Nested evidence reads reuse the held process lock;
  all record validation remains. The previous polling exception workaround was
  removed. Three deterministic partial-history reader cases and a separately
  held process-lock case protect this behavior.
- All 216 companion tests passed normally and under the already installed
  Microsoft.CodeCoverage collector. Journal line coverage was 85.68%, including
  all 33 changed instrumented lines; the new scratch helper reached 83.95%.
  Compact measurements are in
  `artifacts/ecosystem-cleanup-20260912/native-journal-coverage.json`; raw test and
  coverage scratch were removed. These checks execute synthetic native fixtures
  and establish no real-model or public-server result. Committed and pushed as
  `97d66b1`.
- Eight completed CPU adapter pilots were reviewed against their actual retained
  receipts, recipes, dataset manifests and six available raw behavior screens.
  All eight adapter/configuration, recipe and dataset identities match. The
  experiment-lessons report now records ordinary-helpfulness failures, the
  difference between training loss and conversation quality, misleading
  preservation folder names, and the missing preference-label authority.
  Exact receipts, final scalar training history and screen identities are in
  `artifacts/ecosystem-cleanup-20260912/historical-training-review.json`.
- Each of those eight final checkpoints duplicates its retained final adapter
  and configuration. Their 64 files total 322,367,608 logical bytes. Automatic
  approval review blocked deletion before execution with `blocked by policy`;
  all eight checkpoint folders remain. The canonical
  `tinyrustlm/tools/remove-reviewed-training-checkpoints.ps1 -WhatIf` passed
  complete hash/containment preflight. No model was executed or qualified, no
  raw screen was removed, and no storage recovery is claimed.
- The training review and checkpoint-retirement script were committed and pushed
  as `f5faae3`. Owner execution of the blocked eight-checkpoint removal remains
  pending; the compact record preserves the results before deletion.
- Both Qwen3 training tools incorrectly forbade D: while accepting models on C:
  or E:. The lock producer and trainer now independently restrict model inputs
  and outputs to children of `D:/LLMs/TinyRustLM`, including new output paths.
  Their ancestry checks also reject dangling linked leaves. Model-related
  evidence examples now use the canonical D: training area; obsolete E: root
  examples were removed. Historical tool/environment locks remain historical.
- The two Python test modules now use bounded, marked scratch under canonical
  artifacts. Their synthetic source models contain fixture text; no source
  repository or real model is copied. All 98 checks passed with zero skips.
  Standard-library trace measured changed executable-line coverage of 95.65%
  for the control tool, 95.00% for the trainer and 92.59% for the new scratch
  helper. Ruff check/format and diff hygiene passed. The compact coverage record
  is `artifacts/ecosystem-cleanup-20260912/training-storage-test-coverage.json`.
- The actual source check initially rejected an incomplete seven-file source
  directory. Its pinned LICENSE and README.md were still on E:. Both were
  verified against the training profile and moved beside the existing weights
  under `D:/LLMs/TinyRustLM/sources/Qwen/Qwen3-0.6B/c1899de289a04d12100db370d81485cdf75e47ca`.
  No weight bytes were copied. The complete nine-file training-source check
  passed, covering 1,519,207,673 logical bytes. The separate composition source
  lock expects LICENSE length 11,358 and hash `cfc7749b...`, while the training
  profile binds length 11,343 and hash `832dd9e0...`. That contract mismatch
  was recorded in `canonical-training-source-review.json`; its subsequent
  correction is described below.
  No training, inference, qualification or deployment was performed.
- A second seven-file Qwen3 source directory remains at
  `D:/LLMs/TinyRustLM/experiments/TinyRustLM-vnext-private/qwen3-source-c1899de-20260825-v1`.
  Fresh hashes match all seven retained canonical source files; it contains no
  unique source bytes. The compact review is
  `artifacts/ecosystem-cleanup-20260912/duplicate-qwen-source-review.json`.
  Automatic approval review rejected its deletion before execution with
  `blocked by policy`. Its 1,519,182,365 logical bytes remain; no storage recovery
  is claimed. The exact-path, hash-checked retirement script passed `-WhatIf`.
- The canonical training-storage fix, complete training-source closure and
  test-scratch cleanup were committed and pushed as `1e3333a`.
- A bounded anonymous read of LICENSE at the exact upstream revision confirmed
  the training profile's identity. The current composition/source-acquisition
  lock is now v2; the browser, compiled companion members, embedded locks, cache
  identity and payload inventory agree. All nine actual source files match it.
  The old source lock and failed historical operations are unchanged. Current
  acquisition explicitly rejects the obsolete descriptor; a new independent
  wire vector verifies the corrected request in both JS and C#.
- All 218 native companion tests, 45 JS client/contract checks, eight Rust
  composition checks and eleven integration/server/shell checks passed.
  This includes the production JS client driving the real C# loopback seed host
  with synthetic data. All 19 page asset hashes agree and owned test output is
  removed. Details and precise boundaries are in
  `docs/architecture/2026-09-12-qwen3-source-license-correction.md`. This fixes the
  current license mismatch, without qualifying or publishing a model.
- The corrected source contract, current wire vectors and reconciled workspace
  guidance were committed and pushed as `892647b`.
- Runtime's exact 174-file historical documentation inventory and owner-run
  retirement script are committed and pushed as `8623dcf`. Physical retirement
  remains blocked; committing the review does not remove the files.
- Five reviewed retirement scripts now have one owner-run entry point:
  `tinyrustlm/tools/remove-reviewed-ecosystem-copies.ps1`. It pins each canonical
  script's exact SHA-256 before invocation and leaves each script responsible
  for its full file/ancestry/identity checks. The combined `-WhatIf` completed
  every preflight without deletion or receipt creation. The reviewed scope is
  282 files totaling 1,843,280,831 logical bytes: Runtime historical docs,
  LMComposer and MiniModel documentation stages, two disconnected announcement
  files, eight completed training checkpoints and the duplicate Qwen source.
  All remain pending owner execution because automatic deletion was rejected;
  the wrapper must not be used by the agent to bypass that rejection.
- The combined owner-run retirement command, duplicate-source proof and ten-file
  retirement inventory were committed and pushed as `bc4009d`. Owner execution
  remains pending; no removal is inferred from the successful preflight.
- Local release checks now read canonical source files in place and use marked,
  bounded project-artifact scratch for metadata, browser output and subprocesses.
  Setup failure cleans generated metadata, and observation failure closes the
  local server. Direct browser callers reject noncanonical scratch/output paths.
  The zero-argument wrapper also rejects incomplete success envelopes.
- An explicit verified-empty catalog assertion caught stale smoke fixtures and
  millisecond timestamps that the actual current metadata contract rejects.
  The corrected empty fixtures validate and the report identifies their simulated
  nature. All 24 checks passed with zero skips, including 12 real Edge observations.
  The four changed tools have 79.81%–96.55% line coverage. The actual CLI wrapper
  passed all 12 observations and verified cleanup. Two files from an earlier interrupted run remain policy-blocked.
  Registered source-authority checks also passed. Detailed evidence is in
  `docs/architecture/2026-09-12-local-release-smoke-cleanup.md`; this does not
  qualify a default model, prove a live seed, or close pending deployment gates.

- The owner-run cleanup command additionally covers the two exact artifacts left
  by the interrupted local browser test. Its updated full `-WhatIf` preflight
  passed. Pending scope is now 284 files and 1,843,591,346 logical bytes. The new
  deletion was also rejected with `blocked by policy`; those files remain.
- Local browser cleanup and its recorded failure lessons were committed and
  pushed as `b73dfeb`. The final actual zero-argument command passed all 12
  observations and verified its own cleanup. The earlier two interrupted-test
  artifacts remain in the separately reviewed, policy-blocked retirement scope.
- MiRust's remaining observation-time correction is committed and pushed as
  `b9420a1`; its worktree is clean. This metadata correction required no new
  executable test or publication.
- The developer portal's deployment and hostile-gate tests now use in-memory
  filesystem/Git responses instead of copied tools, Git repositories and stages.
  The source-authority pin now matches committed TinyRust gate `70e890e`, which
  is byte-identical to the current canonical file. Git reads require the owning
  canonical repository and have a timeout. Batch payload bytes are independently
  rehashed against their Git object IDs; a same-length corruption test rejects
  mismatched bytes even when the header claims the correct identity.
- All 20 portal validator/preflight checks passed, including actual canonical CLI,
  read-only Git and PowerShell execution. Whole-file coverage was 98.86% for the
  virtual fixture, 94.70% for preflight and 74.17% for the deployment validator;
  the new path and payload checks executed. Owned coverage scratch was removed.
  This is committed and pushed as `1834857`. Existing 1.8.3 metadata, remaining
  stage-producing tools and historical-copy tests still need reconciliation;
  the source gate and these tests do not establish deployment readiness.

- The portal's current generators now emit only package/deployment metadata to
  stdout. Validation reads the canonical public files, includes ignored public
  extras, rejects links and surviving stages, and checks exact C2 byte identities.
  Explicit LF attributes align the 27 public worktree files with Git. The
  unreachable full-site publisher and unused stage-tree validator were removed;
  the PowerShell wrapper keeps Node startup options disabled for both calls.
- Current portal documentation now identifies MiniModel.org as default discovery
  and P2P, permits its initial server seeds, and keeps HF/local/conversion/manual
  peer settings under Advanced. It makes no claim of a qualified model or live seed.
- Portal checkpoint `d938fcd` is committed and pushed. Of 56 checks, 55 passed and
  one correctly fails because the reviewed stage remains; zero skips/cancellations.
  Actual PHP route checks passed, and actual PowerShell with hostile Node options
  rejected the stage without a validation-success or publication claim. Line
  coverage is 90.97% for the validator and 96.80% for public policy. Lesson C20
  and the portal's compact `canonical-release-tools-review.json` retain the details.
- All 27 portal stage files match historical Git `24e4f87`, totaling 136,632
  logical bytes with zero unique files. Automatic approval review rejected their
  deletion with `blocked by policy`; the files remain. Its exact-path, hash-checked
  owner-run retirement script passed WhatIf, including retained Git blob checks.
  The existing combined owner-run command now covers this stage too. Its full
  WhatIf passed: pending scope is 311 files and 1,843,727,978 logical bytes.
  No physical removal, receipt creation or measured storage recovery is inferred.
- Portal package-only checkpoint `07a2502` binds content `d938fcd`. All 27
  canonical public files match Git exactly (137,219 logical bytes), including
  the current package document. The real package generator emitted stdout only.
  The real deployment generator reached its retired-stage check, failed there,
  emitted zero stdout and left the old manifest unchanged. Compact proof and
  current status are committed and pushed as `7a6f9db`. Stage removal and fresh
  deployment metadata remain pending; this is not a published release.
- Portal checkpoint `efce5c3` removes the obsolete Runtime archive regenerator
  and its copied-repository tests (two files, 9,935 logical bytes; measured
  storage recovery unknown). Current tests verify all 184 obsolete mirror files
  against their immutable Git blob IDs and SHA-256 values. All useful differences
  reviewed are recorded in the canonical experiment-lessons document.
- Of 184 mirror files, 164 normalize to previously reviewed canonical documents;
  the 24-page JSON additionally matches Runtime/data/pages.json byte for byte.
  Later browser/source-options and eval/test notes, plus mixed 1.0.6/1.0.7
  package markers, are retained as historical observations, not current runtime
  support or newly executed tests. The 1,963,723 logical bytes remain in place
  because automatic approval review rejected deletion with blocked by policy.
- Current UAI points to compact reviews and Git instead of regenerating mirrors.
  The public boundary page now permits initial MiniModel server seeds and keeps
  advanced source controls out of beginner setup. The focused suite ran 57
  checks: 55 passed, two fail on the surviving stage and mirror, zero skips.
  Actual PHP and source-authority checks passed; owned scratch was removed.
- The exact mirror-retirement owner script and updated combined command passed
  WhatIf. Pending reviewed deletion scope is 495 files totaling 1,845,691,701
  logical bytes. No receipt or physical deletion is inferred from that dry run.
- Portal package-only `8fe3842` now binds content `efce5c3`. All 27 public
  files match Git exactly (137,532 logical bytes). Actual deployment metadata
  generation again reached and rejected the surviving stage, emitted no output
  and left the old manifest unchanged. The refreshed compact current-package
  proof is committed and pushed as `bfb3ac5`. These are local source/metadata
  results; the old manifest and both physical retirement failures remain open.
- The pinned Qwen3 CPU trainer now retains only its newest resumable checkpoint
  payload. Older immutable receipts preserve progress, cumulative losses and
  exact file identities; create-only successor-bound plans make interrupted
  retirement explicit. It checks the full chain and newest bytes before deleting
  superseded payloads, rejects drift/unknown entries, and validates storage under
  D:\LLMs\TinyRustLM. Receipt-only history cannot be loaded as a model.
- Final training receipt v2 points to the existing final adapter instead of
  copying it into a candidate directory. The obsolete candidate-copy writer and
  staging readers are removed. Current training instructions require fresh exact
  byte bindings; historical environment locks are not current authorization.
- All 113 focused control/trainer/scratch checks passed, zero skips. Real writer
  behavior was exercised with tiny synthetic bytes. Changed executable-line
  coverage is 90.07% using standard-library trace; branch coverage and an ML run
  were not performed. Ruff lint/format checks passed. Lesson T8 and compact proof
  `artifacts/ecosystem-cleanup-20260912/checkpoint-retention-review.json` retain
  the result. Owned fixtures were removed; no historical-model deletion, measured
  storage recovery, new training, qualification or publication is claimed.
- Current trainer retention and lesson T8 are committed/pushed as `33483be`;
  all nine committed files exactly match their canonical worktree bytes.
- The next review identifies an obsolete generic producer chain: sequence/top-k
  trainer, importing teacher-cache builder, SmolLM2 adapter-source exporter,
  their three tests, 18 recipes and two cache controls. All 26 files are retained
  in Git `33483be`; exact identities and historical recipe parameters are in
  `retired-training-producers-review.json`. Lessons T9-T11 retain loss-scaling,
  token/distribution binding and serialized-factor validation findings.
- The exporter targets the absent `tinyrustlm-slm-pack`/old adapter API; its
  closed experiments are not current model-production authority. The research
  guide now identifies Qwen3 base bytes as rejected product ancestry and routes
  future work through the pinned lane. Obsolete executable restart instructions
  were removed from the closed Qwen3 top-k README. Existing model/cache payloads
  and unreviewed data-preparation tools remain outside this source retirement.
- Automatic approval review rejected deleting the 26 files with `blocked by
  policy`; all 207,667 logical bytes remain, freshly rehashed. The exact owner
  script passed WhatIf, 37 read-only guard checks and five Pester tests. Command
  coverage is 58/96 (60.42%), below the 75% target because the exact-target
  destructive branch was not executed. CI reports the physical retirement
  failure before running obsolete producer tests; no deletion is inferred.
- The combined owner cleanup command includes this reviewed group and passed
  full WhatIf. Pending scope is now 521 files and 1,845,899,368 logical bytes.
  No new removal receipt or measured storage recovery exists. The missing raw
  top-k assessment paths and remaining model/hosting/qualification work stay open.
- Exact-revision public metadata screening checked three named Qwen3 repositories
  and verified 11 metadata files against publisher byte lengths and Git blob IDs.
  PrimeIntellect reports the same rejected weight identity as the original Qwen
  checkpoint, with a template change. A distinct instruction-finetuned candidate
  lacks the required complete license/provenance records. Neither was acquired,
  executed or qualified; the compact public-source-metadata review preserves
  exact identities without saving another model or source copy.
- Lesson C21 records this evidence and the need to compare weights before
  treating a renamed repository as a new derivative. Four active UAI handoffs
  now reflect implemented production acquisition/browser wiring and the approved
  D:\LLMs\TinyRustLM model location; obsolete instructions to build that owner
  again were removed. Historical intake receipts remain unchanged. The real
  model, required training inputs and hosting placement decision remain open.
  Compact-review consistency, local source-lock identity, lesson checksums,
  canonical source references, current handoff wording and diff hygiene passed.
  The source-authority gate passed for its registered governed roots. No runtime
  code changed in this checkpoint, so no new model execution or runtime-test
  result is claimed.
- Portal checkpoint `d17f77a` removes source-retirement fixture options, alternate
  authority roots, four fixture-only functions and copied-site transport. Tests
  call the canonical PowerShell functions with transport state in memory and
  own all small JSON/Pester output under canonical artifacts. Node startup
  options stay disabled across the entire transaction, including later Git
  validation, and are restored afterward.
- Five focused Node checks and 23 nested PowerShell checks pass. The complete
  seven-file portal suite has 58 passes and the two existing physical-retirement
  failures: the old stage and 184-file mirror remain. Zero skipped/cancelled.
  Real PHP route checks passed; the actual production CLI still rejects the
  unbound transport authority before credentials or network. Command coverage
  is 92.93% for the changed state/transaction/environment functions and 60.05%
  for the whole script; real FTPS and branch coverage remain unverified.
- Lesson C22 and the portal's `source-retirement-tool-review.json` preserve
  evidence and failure behavior without another source archive. Owned scratch
  is removed. The eight committed portal files match their canonical bytes;
  the initial deployment manifest is unchanged and no remote mutation,
  production retirement receipt or storage recovery is claimed.
- MiniModel.org checkpoint `ef924db` removes copied publication snapshots and
  the snapshot writer/verifier/remover, Win32 directory identity binding and
  source-copy test hook. Publication input stays in bounded memory, matched
  against Git and the current canonical checkout and authenticated before
  upload or partial rollback. No local source stage is created.
- All 53 Node and 24 nested Pester checks pass, zero skips/cancellations. Tests
  exercise actual canonical Git/current bytes and file publisher functions,
  keeping remote observations in memory. The stale manifest's 422-byte catalog
  is rejected against the 593-byte current file. Whole-module command coverage
  is 238/545 (43.67%); no branch or full FTPS transaction coverage is claimed.
- Lesson C23 and MiniModel's `publication-input-review-20260912.json` retain
  identities, useful failure results and limits. Test output was removed;
  prepared public records, catalog, deployment manifest and unbound transport
  are unchanged. Node launcher/generator review and real model/hosting work
  remain open. No publication, historical/model deletion or measured storage
  recovery is claimed. All ten committed MiniModel files equal their reviewed
  bytes, and local HEAD, tracking, FETCH_HEAD and direct remote agree.
- MiniModel checkpoint `672991b` replaces arbitrary manifest output and broad
  public-prefix inclusion with stdout-only metadata and the exact current
  22-file public closure. Independent Git blob hashes, current-byte equality,
  ignored/untracked extra checks, bounded reads and deadlines now guard it.
  Twenty CRLF-only worktree differences were normalized in place; all public
  Git objects are unchanged and explicit LF attributes keep them stable.
- Both actual publisher Node children now use reviewed read-leased identities
  and exclude inherited NODE_* settings. A complete test run exposed native
  termination stderr racing with process exit. The wrapper now verifies the
  owned process handle after the diagnostic; a live child still fails.
- The corrected full suite passed 64 Node and 27 nested Pester checks, with
  zero skips/cancellations and three actual timeout terminations. Full current
  JS metadata agrees with PowerShell materialization. The actual publisher
  with hostile startup settings reaches stale-manifest rejection before public
  admission or credentials. No new generator/bootstrap coverage percentage,
  resistant-descendant termination or actual FTPS success is claimed.
- Lesson C24 and `publication-command-review-20260912.json` retain identities,
  the failure and proof limits. All ten committed MiniModel files match their
  reviewed bytes; HEAD, tracking, FETCH_HEAD and direct remote agree. Owned
  output was removed. Fresh release identity, model qualification, unbound
  transport and hosting remain open. No production receipt, model deletion or
  measured storage recovery was produced.

### MiniModel current publication bindings and preserved lessons

- MiniModel public-source commits c73e266 and df51ec0 remove duplicated status
  claims and correct stale seed/companion guidance. Checkpoint
  4f6e8cfd5698081ce7fe25b956494ea62988d08f binds the current 22-file package,
  separates predecessor/candidate discovery, and uses a reviewed UTC publication
  date in both JSON materializers. Historical ledger entries are preserved.
- Current candidate verification invokes the actual browser contract and refuses
  expired catalog authority before public admission or credentials. No catalog
  renewal or real model/seed claim was made. Source records remain prepared.
- All 67 Node and 27 nested Pester checks pass after correcting two stale test
  assumptions. Historical rejection fixtures read exact Git objects in memory.
  Full JS/PowerShell materialization and actual publisher startup boundaries
  pass. Whole custody-module command coverage is 241/562; no new generator or
  bootstrap coverage percentage, browser smoke or FTPS success is claimed.
- Lesson C25 and publication-binding-review-20260912.json preserve the defects,
  failed checks, fixes, exact identities and evidence limits. The unchanged
  source gate passes for registered governed roots, not the entire volume.
  MiniModel is clean and pushed. Owned output is removed; transport, qualification,
  seed hosting and broader blocked cleanup remain unresolved. No historical
  deletion or measured storage recovery was produced.

### Standalone working-product research assignments — September 19

- Added [16 disconnected-agent research prompts](research-prompts/2026-09-19-sixteen-disconnected-working-product-research-prompts.md), each with its own context, observed failure history, owner constraints, detailed questions, and required decision artifacts. Each assignment requests a substantial report with primary sources, explicit uncertainty, proposed experiments, acceptance criteria, and reusable lessons.
- Topics cover model selection, numerical and text semantics, quantization, qualification, data and training, browser execution, first-run usability, MiniModel seeding, peer transfer, model retirement, publication, experiment practice, ecosystem ownership, and the shortest usable-release path. The integration assignment can start independently.
- Research recommendations are proposals, not local validation or permission to reclassify rejected models. The prompts explicitly preserve the owner's current server-seeding requirement over contradictory older prose and require useful experiment knowledge to survive payload retirement.
- All 16 sections were checked for complete standalone context and required output instructions. This documentation checkpoint claims no new model execution, qualification, seed, deployment, deletion, or storage recovery. The separate deployment-input refactor remains unfinished and is excluded from this documentation checkpoint.

### Canonical numerical reference environment

- Rebuilt one pinned reference environment under this repository's artifacts
  from 31 independently verified wheels. Exact validation passes for all 28
  runtime distributions and 17,677 files. The new environment lock and
  differential profile use current paths and the corrected source-license lock;
  the source-owner wrapper admits the actual new runtime.
- All 25 focused Node and eight Python checks pass, including the previously
  unavailable pinned framework test. Five cleanup Pester tests pass; their
  command coverage is 86/132 because no destructive branch was executed.
  Existing numerical execution v2 remains closed and requires a fresh owner and
  registration. No real checkpoint was loaded or qualified.
- Lesson C28 and canonical-numerical-reference-review.json retain the bad
  pip-target launcher RECORD, absent stdlib venv module, virtualenv's leaked
  temporary link probes, PowerShell ancestor-property correction and Pester
  mock-isolation correction. Neither old contracts nor package validation were
  relaxed or rewritten to obtain passing results.
- Automatic review rejected cleanup of the failed bootstrap and two exact
  dangling links. Consequently the unchanged source-authority gate reports
  scan-incomplete. The owner-run remove-reviewed-numerical-installer-output.ps1
  has a verified WhatIf preview for 431 files, 93 directories, two links and
  296,933,889 logical bytes. All of that temporary output remains; the retained
  canonical runtime is excluded from removal. No storage recovery is claimed.

### MiniModel catalog failure state and owned browser verification

- Source d30114c clears failed/loading catalog actions, counts and obsolete
  callbacks; only the newest verified request may render. Controls recover after
  a valid reload. CSS is unchanged. The current package/review checkpoint
  b33b1a783e20db23b77971be061388b7e4163285 is clean and pushed.
- Browser verification uses an exact six-input local preview and installed Edge
  with canonical Playwright. Profiles and temporary output stay in a bounded
  owned artifact directory; screenshots remain in memory. Broad process matching,
  manual CDP, arbitrary target/output arguments and suppressed cleanup failure
  were removed. Browser and coverage output are verified absent.
- The corrected full suite passed 74 Node and 27 nested Pester checks, including
  eight desktop/mobile Edge observations. Catalog.js Node coverage is 90.76
  percent lines and 80.82 percent branches; browser-helper coverage is 92.88 and
  88.89 percent. Browser-evaluated functions are outside these metrics.
- Lesson C26 and browser-catalog-review-20260912.json preserve fixture-clock
  leakage, the shared-artifact-parent assertion race, coverage-temp containment,
  corrections and actual evidence limits. Historical empty fixtures do not renew
  authority or qualify models. The current catalog stays expired; transport,
  qualification, live seeding and broader blocked cleanup remain unresolved.
  Nothing was published and no historical/model deletion or measured storage
  recovery is claimed.

### Numerical child-process and output boundaries

- The runner now rejects misplaced repository, evidence and model roots before
  creating output. Both Python stages use isolated mode, bytecode suppression
  and UTF-8. Children and exact-PID termination receive a minimal environment
  with canonical temporary/cache paths; startup variables and credentials are
  excluded. The unchanged source-authority scan is required before execution.
- All 56 affected checks pass with zero skips, including real Node/Python probes
  and synthetic pinned-framework checks. V8 ranges reached 53/54 selected source
  lines in the three new boundary functions (98.15 percent); no whole-owner,
  branch or real numerical execution coverage is claimed. Two fixture families
  use owned canonical artifacts and inline probes; their output was removed.
- Lesson C29 and numerical-execution-boundary-review.json preserve the initial
  three coverage-induced launch failures, the verified Node automatic coverage
  propagation cause, its explicit-empty-variable correction and shell harness
  limitations. Closed v2 contracts remain historical; fresh registration and
  dependency bindings are still required. The source scan remains incomplete on
  the two policy-blocked C28 links. No real model, default, seed, deployment,
  historical/model removal or measured storage recovery was produced.

### Current numerical registration contract

- Replaced active closed-v2 execution schemas, old lock paths and the August
  operation identity with current-only v3 validation. Fourteen artifact roles
  bind the owner, current components and imported helpers. The final registration
  commit owns one file; operation IDs bind its parent and UTC date. Standard
  gates now require zero skips rather than the historical fixed allowance.
- The current profile binds the prepared owner and helper identities. Both it
  and registration validation explicitly preserve the product-quality rejection
  and diagnostic-only purpose of the Qwen ancestry. Existing cases, tolerances,
  process limits and historical metadata are independently verified unchanged.
- All 58 affected checks pass with zero skips. V8 ranges reach 317/317 selected
  source lines in four changed validation functions; no whole-owner, branch or
  real-model execution coverage is claimed. Owned output was removed. Lesson
  C30 and numerical-current-registration-review.json retain exact bindings and
  the distinction between evidence verification and active compatibility.
- No real v3 registration exists. The two policy-blocked installer links remain,
  and full source/release checks, real model qualification and initial seeding
  remain open. No historical/model deletion, deployment or measured storage
  recovery occurred.

### Numerical environment diagnostics and experiment evidence

- The source owner now preserves safe typed environment rejection causes while
  redacting arbitrary exception text. Real read-only checks reject the current
  training environment's configuration; its major package versions also differ
  from the numerical reference lock. This observation cannot reconstruct the
  precise cause of the old generic v2 failure.
- Eight Python tests pass with 43/43 executable lines covered in the changed
  validation function; branch and whole-owner coverage were not measured. The
  focused Node suite passes 22 tests and skips one unavailable pinned-framework
  test. Ruff and the unchanged registered-root source-authority gate pass.
- Historical implementation assertions read exact Git bytes in memory. Synthetic
  numerical fixtures and their setup-failure cleanup now stay inside owned
  canonical artifacts. The stdlib test launcher no longer assumes a registered
  Python 3.12 installation. All operation output was removed.
- Lesson C27 and numerical-environment-review.json preserve exact identities,
  observations, the failed checks and proof limits. Historical contracts remain
  unchanged and their operations closed. A current licensed source, exact
  reference environment, fresh numerical bindings, qualified default and server
  seeding remain unresolved. No model execution, publication, historical/model
  deletion or measured storage recovery was produced.

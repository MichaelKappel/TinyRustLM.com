# TinyRustLM Testing

TinyRustLM tests are evidence-layered. A passing fixture proves only the exact
contract under test. It never promotes a fixture into a useful model or turns
local execution into deployment, P2P, MemoryEndpoints, or campaign evidence.

## Complete Developer Gate

From the repository root:

```powershell
.\tools\vs\Test-TinyRustLM.ps1
```

This performs the canonical locked/offline workspace build, Rust workspace
tests, the standard Node gate, rustfmt, Clippy with warnings denied, Rust
documentation, and syntax checks for the browser owner modules.

Add a real Chromium site smoke with a new absent evidence root:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

The script creates a temporary root when none is supplied. It refuses to
reuse an existing evidence root.

## Standard Node Gate

```powershell
npm --prefix tinyrustlm run test:unit
```

`test:unit` discovers every direct `*.test.js` file except the separately
custodied release-surface suite, sorts the inventory, runs one process with
test concurrency one, and fails on any nonzero terminal result. It requires no
evidence path and writes no release receipt.

Important focused gates include:

```powershell
npm --prefix tinyrustlm run test:model-runtime-worker
npm --prefix tinyrustlm run test:model-runtime-worker-browser
npm --prefix tinyrustlm run test:browser-contract
npm --prefix tinyrustlm run test:vnext-campaign-runner
node --test tinyrustlm/tests/production-slm2-clean-cut.test.js
```

The clean-cut test proves the registered obsolete executable closure remains
physically absent, scans active source for superseded tokens, verifies the
sole deployed browser artifact, and checks canonical Rust workspace ownership.

`test:browser-contract` exercises the current six-member admission, companion
installation, runtime client and worker boundaries. The same suites participate
in `test:ui`. These are contract fixtures, not deletion-backed campaign rounds.
The npm command for the incompatible two-file browser executor is removed;
the vNext control plane remains the sole campaign authority. Automatic deletion
review blocked removal of that executor, its separate receipt/counter chain and
their four dedicated suites. Those eight files remain pending retirement; standard
Node discovery still includes their tests. Do not restore the obsolete npm route
or treat its isolated helper tests as current application execution.
A current live round producer still needs qualification-bound full composition
input, real multi-turn execution, bounded privacy observation and profile deletion
evidence. Neither this focused gate nor visual capture supplies that evidence.

## UI verification owner and reports

`eng/verify-tinyrustlm-ui.ps1` and `.sh` only translate arguments into
`tools/verify-ui.js`. The owner checks canonical source before builds, browser
work or scratch creation. Base checks cover the web artifact, current runtime
contracts, JavaScript syntax and the no-browser launcher suites. Browser mode
adds the acquisition Playwright fixtures, current UI contracts and local release
smoke. Visual mode uses the current source server on one OS-assigned loopback
port and compares capture against the requested baseline. Deep acquisition is
still unregistered and fails after source admission, before expensive fixture work.

The sole current UI report is `tinyrustlm.ui_verification.v2`. Its validator
requires all twelve gate names, source admission, the launcher suite, requested
acquisition fixtures and temporary cleanup. Public-root verification also checks
the actual child report. V1 is not accepted or translated.

Child commands are shell-free, limited to 1 MiB of captured output and thirty
minutes (thirty seconds for source admission). Reports retain output lengths,
digests and failed exit codes, without raw child text. These identities cover
captured decoded output; they are not raw conversation evidence.

Scratch lives below canonical `artifacts/verification/ui` and is removed before
a pass is reported. Evidence paths in a completed report identify retired
temporary output. An interrupted child may leave descendants; retain its marked
scratch for quiescence review. Cleanup failure also prevents a pass and preserves
ownership. Custom report paths must be new; only the fixed current-status report
can be replaced. None of these checks establishes a qualified model or deployment.

Run `node --test tinyrustlm/tests/verify-ui.test.js`; the suite owns its temporary
output beneath canonical artifacts. Tests exercise the actual PowerShell and Bash adapters;
Windows Bash execution requires a named WSL distribution in
`TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION`.

## Conversation with the current worker

`e2e/conversation.spec.js` uses the real app, Advanced import, current catalog
validation and real WASM with explicit synthetic weights. Set
`TINYRUSTLM_BROWSER_RUNTIME_PRIVATE_COMPOSITION_ROOT` to the canonical D: directory
holding the four exact tokenizer/template/sampling/prompt dependencies from the
retained diagnostic composition. No real checkpoint weights are loaded. Without
that input the tests report skips; they do not establish a working model.

The Rust `browser_conversation_fixture` example uses the production SLM2 writer
and emits only in-memory synthetic bytes to stdout. Its build output is owned
and removed, and the frozen independent reference source is unchanged. Catalog
responses are test-only and intercepted; no server seed or qualification is
published. The checks cover catalog rejection, two completed turns, one renderer,
local prompts and layout bounds at four viewport/interaction configurations.

Active visual capture and the conversation test share `loadComposition`, which
requires current `worker active` diagnostics. The old `loaded` label is rejected.

## Candidate selection checks

The discovery and acquisition suites, together with metadata bounds, storage,
weight layouts and source exclusions, use `.test.js` filenames and participate in
the standard gate. Focused runs can select those six `huggingface-*` / `source-candidate-exclusions`
suites directly without making a public model request.

Current discovery inventories and acquisition receipts use v3 exclusively.
Direct-weight candidates declare `weightIndex: null`; sharded candidates bind
the exact `model.safetensors.index.json` identity. Shared layout/index checks
enforce complete shard groups, duplicate-free bounded JSON (256 KiB), exact shard
references and use of every shard. Acquisition validates the index before other
downloads and rechecks it on receipt reuse. Tests include the real source-screen
artifact reader over synthetic acquired files in the canonical model store;
this proves file closure, not tensor validity or model qualification.

Discovery defaults to 300 search rows and at most 40 candidates only when those
arguments are omitted. Explicit limits must be integers in 1..500 and 1..100,
respectively. Acquisition defaults to start 0 and the inventory's candidate count;
an explicit count must be in 1..100. It takes at most that count from the selected
start, validates the entire slice, then begins source requests. Zero, nonnumeric,
empty or otherwise invalid explicit limits are errors, never requests for a
default-sized download. JavaScript callers supply numbers; the CLIs parse numeric
arguments before invoking those APIs.

Profiles describe source metadata to screen. They do not establish converter
support, provenance approval or useful answers. The current Rust CLI exposes
Qwen3 model/composition and Qwen tokenizer conversion; a SmolLM2 or Qwen2.5 roster
entry still needs its own source/reference and converter work. Acquired source
hashes are not a qualified composition or an installed browser model.

## Owned temporary output

`tools/canonical-operation-scratch.js` creates bounded output beneath canonical
project artifacts. Keep its returned ownership record for the operation's full
lifetime. Its exclusive random `.owner.v2` marker is adjacent to the directory,
so failed file removal or final directory removal cannot delete cleanup authority.
The helper checks directory and marker identities before work or retirement.

Stop all writers and owned children before cleanup. Retirement inventories at
most 8,192 entries and 32 directory levels, rejects linked/special entries and
external hard links, rechecks each entry and ancestor, then unlinks files and
removes empty directories nonrecursively. Unexpected new content stops cleanup.
Only observed root absence allows marker removal. An explicit subsequent cleanup
may finish a partial removal with the original ownership record after the cause
is resolved; there is no automatic retry, marker recreation or old-layout adoption.
This path-based helper does not provide a transaction against hostile concurrent
filesystem mutation or recover ownership records lost with the process.

Run `node --test tinyrustlm/tests/canonical-operation-scratch.test.js` for the
cleanup contract, including a real Windows file lock. The standard Node gate now
discovers this suite. For managed builds in owned output, pass
`-p:UseSharedCompilation=false` so a compiler server does not retain analyzer DLLs
after the test command exits. Preserve cleanup errors and retained paths honestly;
an operating-system lock does not authorize bypassing an automatic-policy denial.

## Memory Continuity Browser Check

Enrollment requests use the shared operation lifetime. The default 30-second
budget covers discovery and its claim/reconnect request together; constructor
`timeoutMilliseconds` accepts integers in 1..120000. `discover`, `request`,
`claim` and `reconnect` accept an optional `signal` in their options. Cancellation
and timeout are typed errors, never evidence that a server-side POST was undone.
The client does not retry automatically. The UI retains one pending claim's
invitation, requested name and idempotency key in private session memory. Use
Create Agent again after a lost response to retry that exact claim. Once a claim
returns credentials, retry only restores that agent; it does not issue another
claim POST. Changing the pending name or invitation is rejected. Clear Web
Memory explicitly abandons recovery; it cannot undo a committed server claim.

Reconnect similarly retains a failed attempt's token for an explicit same-name
retry with the now-empty token input. Claim and reconnect share one busy state.
Service/authority changes, toggling web memory, workspace-key input, workspace
connection, clear and page exit cancel enrollment and discard recovery state.
Late results cannot activate or overwrite enrollment status. Recovery does not
survive reload and is never stored in localStorage, sessionStorage or IndexedDB.
The general outbox, pull, submit and search lifetimes remain separate work.

Streamed JSON is limited to one MiB and 4,096 chunks before retention. Unit checks
cover absent/false length headers, exact limits, split Unicode, stalled reads,
uncooperative cancellation, late Fetch responses and independent concurrent
discovery. The browser spec additionally uses real loopback Fetch in each project
to verify timeout/cancellation closes requests, rejects oversized bodies, and
permits a subsequent successful request. No live endpoint is called.

The MemoryEndpoints enrollment browser scenario uses Advanced local import with
current hash-bound catalog/receipt fixtures, synthetic inference, real browser
storage, and a loopback memory service. Run it with
`node node_modules/@playwright/test/cli.js test e2e/memory-endpoints-enrollment.spec.js --project=desktop`
from `tinyrustlm`; `TINYRUSTLM_PLAYWRIGHT_CHANNEL=msedge` selects installed Edge.
It checks explicit-save consent, both memory tiers across removal of the original
profile, invitation replay rejection and credential nonpersistence. Short profiles
under the canonical root's `artifacts/tests/browser-memory-profiles` are owned and
removed by the shared scratch helper. Deep reporter-derived profile paths caused
Windows storage failures. This test does not execute a real model or contact the
live MemoryEndpoints service and cannot advance live campaign counters.

## Rust Gates

```powershell
cargo fmt --all -- --check
cargo build --workspace --locked --offline
cargo test --workspace --locked --offline
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
cargo doc --workspace --no-deps --locked --offline
```

The canonical crates own SLM2, ACG2, Tokenizer2, Template2, Sampling2,
Prompt2, runtime, browser WASM, conversion, native ABI, direct P2P, and the
local server. There is no alternate runtime or packer gate.

## Browser Artifact Gate

The checked-in WASM must match its manifest and current build source:

```powershell
node tinyrustlm/tools/browser-runtime-web-artifact.js check
```

Refreshing the checked artifact is an explicit source change:

```powershell
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Release -RefreshBrowserRuntime
```

Review and commit both WASM and manifest together. Never deploy generated
bytes that are absent from the release commit.

## Release-Surface Custody

The release-surface suite has secret-sensitive shards and an immutable
evidence writer. It must run through its gate with an existing direct absolute
evidence parent:

```powershell
npm --prefix tinyrustlm run test:vnext-campaign-release-surface -- <evidence-root>
npm --prefix tinyrustlm run verify:vnext-campaign-release-surface -- <evidence-root>
```

Do not invoke `vnext-campaign-release-surface.test.js` directly. The gate
provides the exact fixture profile, environment custody, shard partition, raw
terminal capture, bounded output, and aggregate identity.

The sole runner is documented in
`../../docs/architecture/vnext-campaign-runner.md`. Stored projections,
caller-supplied counters, caller verdicts, and interrupted operations cannot
become an attestation.

## Real Browser Evidence

`tools/web-release-local-smoke.js` exercises committed static assets in real
Chromium at desktop, narrow-desktop, and mobile viewports. Worker-specific
browser tests use owned persistent profiles and prove process closure and
deletion. A page reload, incognito context, storage clear, or Node WASM run is
not a fresh-profile browser pass.

A qualifying dogfood receipt additionally requires a real qualified model,
untouched multi-turn output, network and secret scans, one authoritative
assistant render, cancellation behavior, and profile deletion.

## Failure Handling

### Visual capture tool

The current tool captures the unmodified shell in fresh owned browser profiles
at 1365x768 and 390x844. It uses the installed Playwright browser, or the channel
selected by `TINYRUSTLM_PLAYWRIGHT_CHANNEL` (for example, `msedge`). From the
repository root:

```powershell
node tinyrustlm/tools/capture-ui-lock.js <url> <new-canonical-artifact-directory> [baseline-json|-] [empty|active|long] [composition-directory]
```

The command owns its Playwright profile and browser lifetime. Empty mode accepts
current deferred-runtime startup or completed qualified-default activation;
it means no conversation yet. Active/long modes require an explicit
directory under `D:\LLMs\TinyRustLM` with all six current members and exactly one
`*.browser-composition-admission.json`; normal browser admission and catalog
qualification remain mandatory. Those modes execute real inference and must
also satisfy the applicable source/material experiment gates before use.

Output files are exclusive. Capture without a baseline says only
`captured-without-baseline`. A failed baseline comparison preserves its report
and screenshots and exits nonzero. The existing field/geometry tolerances do
not establish pixel parity, model usefulness or public deployment. Do not
replace a failing historical baseline merely to obtain a green gate.

`tests/capture-ui-lock.test.js` supplies the standard unit checks. To additionally
run the actual two-viewport source-shell check, set `TINYRUSTLM_UI_LOCK_EVIDENCE`
to an owned canonical artifact directory and invoke that file with `node --test`.
The directory must have no prior `browser` capture or historical-comparison
output. The operator retains and then removes that evidence after review;
each browser profile is closed and removed by the tool. A cleanup failure is
reported as failure, and failed browser closure retains the profile for inspection.

### Test failure evidence

Preserve raw failures. Add a minimal generic regression, positive controls,
and counterexamples; make the narrow source correction; rerun only invalidated
phases; and retain previous terminal evidence. Do not repair output, overwrite
a failed receipt, train on a sealed holdout, choose an easy seed, or weaken a
gate.

## Claim Boundary

Local green tests do not prove:

- a real Qwen3 composition was converted;
- source/native/WASM numerical parity;
- conversational quality;
- direct outside-network P2P reachability;
- authorized live MemoryEndpoints continuity;
- package or site publication; or
- progress in the 20-model, 50-round campaign.

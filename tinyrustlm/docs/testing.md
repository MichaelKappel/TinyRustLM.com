# TinyRustLM Testing

TinyRustLM testing is evidence layered. A green local test proves only the
contract exercised by that test; it does not promote a fixture into a useful
model or convert local behavior into live production evidence.

## Fast JavaScript Gates

From the repository root:

```powershell
npm --prefix tinyrustlm run test:browser-contract
node --test tinyrustlm/tests/model-acquisition.test.js tinyrustlm/tests/companion-bridge.test.js
node tinyrustlm/tools/web-release-local-smoke.js <new-output-directory>
node --test tinyrustlm/tests/dogfood-campaign.test.js tinyrustlm/tests/vnext-campaign-runner.test.js
npm --prefix tinyrustlm run test:vnext-campaign-release-surface -- <absolute-evidence-root>
npm --prefix tinyrustlm run verify:vnext-campaign-release-surface -- <absolute-evidence-root>
```

`test:browser-contract` covers:

- binding a real browser receipt to a passing native qualification;
- rejecting fixture qualification;
- immutable composition diagnostics;
- graph identity drift;
- exactly one configured graph request;
- deny-by-default origin handling;
- project-host prompt and model-byte detection;
- UTF-8, UTF-16LE, and base64 secret detection;
- hosted-memory refusal in the non-memory runner;
- bounded CLI parsing;
- public-result field minimization;
- preservation of failed browser attempts.

The acquisition and companion tests additionally require P2P-first selection,
immutable supported-source contracts, fixed canonical conversion
routes, receipt-bound model and composition streaming, and complete removal of
README/TXT, script, request-file, conversion-kit, import-kit, and share-kit
browser downloads. The local web-release smoke uses real Chromium at desktop,
narrow-desktop, and mobile viewports. While the companion package is
unpublished, that smoke requires explicit `Public package pending` and
`Deployment blocked` states and rejects any NuGet package link or `dotnet`
install command. Publishing a package changes this contract and requires a new
report schema plus immutable public-package readback evidence.

The campaign tests cover:

- exactly 20 distinct artifact hashes;
- exactly 50 rounds;
- exactly 25 memory-designated rounds;
- at least two rounds per model;
- mobile, narrow-desktop, desktop, and reduced-motion coverage;
- strict unknown-field rejection;
- explicit required controls;
- current composition-bound native evaluation;
- resumable attempts without overwriting failures.

The sole current campaign projection runner is the Rust-backed vNext boundary
documented in `../../docs/architecture/vnext-campaign-runner.md`. The deleted
mutable runner has no compatibility entry point.

The release-surface tests prove that attestation and operator status can only
come from a newly executed sole-runner projection. Stored projection bytes,
caller counters, caller verdicts, dashboard objects, interrupted or failed
operations, and unsafe final bytes fail closed. The synthetic complete-capacity
case proves contract capacity only and cannot advance a live campaign counter.
See `../../docs/architecture/vnext-campaign-release-surface.md`.

## Registered Build Custody

Before any irreversible registered Windows x64 build, run the source-controlled
custody fault gate:

```powershell
npm --prefix tinyrustlm run test:build-custody
```

The gate creates a temporary committed Git source closure and fresh sibling
control, target, and environment-scratch roots. It binds the exact six-member
MSVC environment evidence closure and proves full current-closure regeneration
in fresh exact Node processes before root creation, immediately before child
launch, and after every child outcome. The authority owns `PATH`, `LIB`,
`LIBPATH`, and the Cargo target linker; the request may add only sorted,
bounded, nonoverlapping supplemental values and must include the ten Windows
baseline values, with `USERPROFILE` and `TEMP` confined to the owned scratch
root. Real and injected child cases prove canonical
preflight, exact source/Git/Node/command/taskkill binding, environment cross-
binding and drift precedence, separate bounded raw logs, exit-before-
diagnostics persistence, late overflow reconciliation, nonzero and spawn
failure, real timeout descendant-tree termination, no caller-environment
inheritance, required-output hash and x64 PE checks, bounded non-reparse target
and scratch inventories, create-only root and terminal collisions, a real
installed Visual Studio closure, and completion after CLI-observer death. The
focused Windows x64 gate contains 17 tests. Synthetic in-process environment
validation is explicitly test-only, redacted, and cannot become campaign
evidence.

A green custody test proves only the mechanism. A material build requires a
separate output-free registration bound to the exact committed owner and
runtime, wholly new roots proven absent, one canonical private request outside
Git, and one execution. Never use a successful fixture, historical candidate,
Cargo log text, PE presence, or process disappearance as a successful-build
claim. See
`../../docs/architecture/2026-08-25-environment-bound-build-custody-owner.md`.

## Rust Gates

Use artifact-light settings on a constrained disk:

```powershell
$env:CARGO_INCREMENTAL = "0"
$env:CARGO_PROFILE_TEST_DEBUG = "0"
cargo test -p tinyrustlm-browser-harness
cargo test -p tinyrustlm-runtime
cargo test -p tinyrustlm-slm-pack
```

The runtime tests are authoritative for supported model structures, tensor
contracts, tokenizer behavior, quantization, context/KV calculations, and WASM
ABI behavior. The SLM pack tests are authoritative for source review,
conversion, manifest binding, native evaluation, candidate decisions,
promotion, admission, and immutable composition bundle construction.

The browser harness audits the static application contract and optional
loopback routes. It is not a replacement for Playwright process/profile
evidence.

## Syntax and Static Checks

For touched browser tools:

```powershell
node --check tinyrustlm/tools/dogfood-campaign.js
node --check tinyrustlm/tools/vnext-campaign-runner.js
node --check tinyrustlm/tools/fresh-browser-conversation.js
node --check tinyrustlm/tools/browser-round-evidence.js
node --check tinyrustlm/tools/run-browser-round.js
node --check tinyrustlm/app/browser-model-admission.js
node --check tinyrustlm/app/app.js
git diff --check
```

Run Clippy against touched Rust crates with `--no-deps`. Existing warnings in
an unrelated crate must be reported honestly and must not be described as a
green full-workspace gate.

## Model Evidence Levels

Tests must preserve these distinctions:

| Evidence | What it proves | What it does not prove |
| --- | --- | --- |
| Parser fixture | Bounded format handling | Useful model behavior |
| Runtime fixture | Load/forward plumbing | Conversation quality |
| Structural validation | Artifact shape and bounds | Semantic quality |
| Native conversation evaluation | Exact hash under one evaluator/config | Browser reliability |
| Browser round | One sealed fresh-profile conversation | Live memory or public P2P |
| Live memory receipt | Authorized continuity and cleanup | P2P reachability |
| Outside P2P proof | Complete external transfer for one lane | Catalog publication |
| Catalog readback | Current announcement visibility | Package or HTTPS release |

A failure in a later layer does not invalidate a valid acquisition or
conversion receipt unless the failed input is upstream of that phase.

## Real Browser Round

The operator command for a non-memory round is:

```powershell
npm --prefix tinyrustlm run run:browser-round -- `
  <campaign.json> `
  <round-number> `
  <evidence-root> `
  <owned-profile-parent> `
  <public-result.json>
```

Required preconditions:

- the v3 campaign manifest validates with no unknown or omitted fields;
- all 20 referenced model and graph files exist and match declared sizes;
- the selected model has a current real qualification receipt;
- the application is reachable at the exact manifest URL;
- the graph URL is served by the same application origin;
- the profile parent is operator-owned and has sufficient disk space.

Exit code `2` is a preserved failed attempt, not an infrastructure skip and not
a pass. Inspect the immutable receipt and bounded failure code before retrying.

## Freshness and Deletion

A valid round must prove:

- a newly created, marked persistent profile;
- Chromium launched against that profile;
- process/context closure;
- a complete pre-deletion secret scan;
- deletion through the ownership-checked profile API;
- post-delete filesystem absence;
- a content hash of the deletion evidence.

Refreshing the page, clearing storage, opening a new context, or reusing a
profile does not meet this test.

## Network Tests

Every browser round starts with only the application origin allowed. Optional
origins are explicit per round. Tests must fail on:

- unknown remote origins;
- unexpected loopback services;
- prompt material in project-host requests;
- project-hosted `.slm` bytes;
- credential-bearing URLs;
- unapproved telemetry or remote inference.

Tests should include both positive and counterexample cases. A related project
domain is not implicitly trusted.

## Failure Preservation

For every discovered defect:

1. Preserve the original failed receipt.
2. Reduce it without changing relevant behavior.
3. Add one generic regression and at least one counterexample.
4. Apply the scoped fix.
5. Version the changed contract.
6. Rerun only invalidated descendants.
7. Preserve the successful retry beside the failure.

Never modify raw model output before scoring and never overwrite an obsolete or
rejected receipt.

## Live Test Limits

Local automated tests cannot satisfy:

- MemoryEndpoints single-use enrollment, restore, revocation, and deletion;
- public outside-network complete-transfer proof;
- catalog mutation and readback;
- physical ARM64 execution;
- NuGet publication and isolated public-registry consumption;
- public HTTPS release readback.

Those gates require an advertised contract, authorized credentials or
infrastructure, and objective receipts. A missing contract is a typed blocker,
not a skipped pass.

## Archive Secret Scans

An artifact ending in `.zip`, `.nupkg`, `.snupkg`, `.tgz`, or `.tar.gz`
requires an explicit absolute archive-helper package root. A package contains
exactly the native `tinyrustlm-archive-scan` helper plus canonical manifest and
provenance documents. The client never accepts a direct executable path,
searches `PATH`, or falls back to system `tar` or JavaScript archive parsing.
The Rust authority must admit the whole archive before any decoded member
reaches secret detection.

The v4 report binds the compressed archive hash, path-redacted decoded-content
manifest hash, all three archive profile hashes, member counts, scanner and
client source closures, package manifest and provenance, package-builder and
helper source closures, source revision and clean-worktree observation, RID,
platform, build profile, trust class, and helper executable hash. Secret
matching carry is cleared between members. Malformed paths, links, portable
collisions, nested archives, integrity failures, unsupported features,
resource-limit violations, or package drift abort the scan before a report or
receipt is created.

Focused verification:

```powershell
node --test tests/archive-scan-helper-package.test.js
node --test tests/archive-scan-helper-verification.test.js
node --test tests/archive-scan-client.test.js `
  tests/public-evidence-secret-scan.test.js `
  tests/web-release-secret-scan.test.js
```

Build a current native release package only into a new absolute directory whose
parent already exists:

```powershell
..\eng\build-archive-scan-helper.ps1 -Configuration release `
  -OutputDirectory <new-absolute-package-directory>
$env:TINYRUSTLM_ARCHIVE_SCAN_TEST_PACKAGE_ROOT = `
  '<new-absolute-package-directory>'
node --test tests/archive-scan-client.test.js `
  tests/public-evidence-secret-scan.test.js

$scratchRoot = '<existing-absolute-scratch-parent>'
$verificationOutput = '<new-absolute-verification-output-directory>'
node tools/archive-scan-helper-verification.js `
  '<new-absolute-package-directory>' `
  $verificationOutput `
  $scratchRoot
```

The materializer rejects an existing output directory, dirty release source,
cross-RID relabeling, and debug-as-release relabeling. These local tests are
conformance evidence. The verifier replays exactly one frozen ZIP and one
frozen tar-gzip vector through the packaged helper, removes its unique scratch
child, and writes exactly one canonical create-only receipt. That receipt is a
deterministic native-package replay record and deliberately omits observation
time. A production release additionally requires current native package and
replay evidence for every supported RID, independently retained hosted-CI
evidence, and the complete signing, authorization, deployment, and
HTTPS-readback gates.

## Hosted Archive Fuzz Evidence

The hosted sanitizer job has one source authority:

```bash
node tools/archive-fuzz-hosted-verification.js run \
  "${RUNNER_TEMP}/archive-fuzz-hosted-verification" \
  "${RUNNER_TEMP}"
```

The runner refuses local or self-hosted substitutions. It requires exact
GitHub repository, workflow, job, run, attempt, event, clean source revision,
Linux, runner class, and process architecture values. Child commands receive
an allowlisted environment with Cargo offline mode and no workflow token. The
frozen sequence verifies cargo-fuzz and rustc identities, replays the exact
manifest, replays the copied corpus through libFuzzer, and runs one explicit
AddressSanitizer interval. It then removes its owned scratch child before
creating one path-free canonical record plus bounded private logs and any
bounded crash inputs. A failed record is uploaded but the job remains failed.

After downloading an artifact into an existing absolute directory, verify it
from the exact matching clean source revision:

```powershell
node tools/archive-fuzz-hosted-verification.js verify `
  '<absolute-downloaded-evidence-directory>'
```

The verifier rejects source, workflow, profile, corpus, lock, closure, log,
finding, JSON, file-set, verdict, and path drift. A successful local verifier
result proves only that the downloaded record is internally consistent with
the matching source. The GitHub run status and artifact custody must still be
independently retained; this record is not an OIDC attestation or signature.
Workflow text, a branch push, or a synthetic unit fixture is never counted as
hosted sanitizer execution.

## Checkpoint Report

At each WIP checkpoint record:

- commit hash;
- exact commands executed;
- pass/fail counts;
- tests not run and why;
- worktree status;
- evidence paths and hashes when generated;
- disk constraints;
- external blockers;
- next invalidated phase.

Do not report the full campaign as ready from unit tests alone.

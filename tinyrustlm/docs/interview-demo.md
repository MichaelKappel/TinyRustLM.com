# Interview Demo Runbook

Run from the repository root with Node.js 24 or newer. Install the lockfile
dependencies before the interview:

```powershell
npm ci --prefix .\tinyrustlm
```

The synthetic walkthrough and browser gates also require Playwright's pinned
Chromium. Install it if it is absent:

```powershell
npm --prefix .\tinyrustlm exec playwright -- install chromium
```

To validate with an already installed Microsoft Edge instead, explicitly set
`$env:TINYRUSTLM_PLAYWRIGHT_CHANNEL = 'msedge'` before either synthetic command
or its tests. The default remains pinned Playwright Chromium; no automatic browser
fallback occurs. Reports identify the requested channel and headed/headless mode.
Edge results do not establish pinned-Chromium validation. Clear the environment
variable to return to the default.

The headed walkthrough requires an interactive desktop session. There are two
demo commands: one opens the canonical local UI, and one runs the visibly
labeled synthetic P2P walkthrough. Keep the product UI as rendered; do not
replace it with a mock page or restyle it for the interview.

## 1. Open The UI

```powershell
npm --prefix .\tinyrustlm run demo:interview
```

The launcher runs its UI preflight, binds one OS-assigned unprivileged loopback port,
waits for HTTP readiness, prints the URL, and asks the operating system to open
the canonical TinyRustLM UI. It remains attached until `Ctrl+C` and then closes
its owned listener.

The OS browser request is asynchronous and cancellable; it does not block local
HTTP service. Its successful return confirms the request, not browser rendering.
The September 23 source scan reports 37 unreadable entries, including the two
previously known installer links. The command exits before binding or requesting
a browser while this admission remains blocked. The normal ready flow below
applies only after admission passes; a source-control checkpoint does not certify
the launcher or a release.

Expected visible flow:

1. The terminal reports `TinyRustLM interview UI preflight: READY`, followed by
   `TinyRustLM interview UI demo: READY.` These labels cover the local UI shell
   and loopback HTTP readiness only.
2. The browser opens the existing product shell and compact model chooser.
3. The current catalog metadata state is shown truthfully, including empty or
   unavailable states. A catalog entry or peer announcement is metadata, not
   proof of fetched model bytes, a live qualified model, or a reachable peer.
   Advanced controls remain in their normal product location.
4. No model is bundled, injected, downloaded, activated, or run by the launcher.

The UI preflight's `deployment-closure` check is temporary local materialization
and manifest validation, not deployment. Synthetic P2P walkthrough is not
started by this command. It does not claim that a model is live.

## 2. Run Synthetic P2P

```powershell
npm --prefix .\tinyrustlm run demo:p2p:synthetic -- --headed
```

This is the headed automated walkthrough used for interview presentation.
Omitting `--headed` runs the same automated fixture mechanics headlessly. Name
the mode actually run when reporting evidence; one mode is not evidence for the
other.

Expected visible flow:

1. Every browser surface carries the exact label
   `SYNTHETIC FIXTURE DEMO - NOT LIVE MODEL EVIDENCE`.
2. The compact chooser shows two synthetic cards with the P2P choice selected;
   Advanced stays collapsed and Hugging Face search stays empty.
3. One card streams six deterministic fixture members, then shows the real
   rejection of its intentionally non-executable candidate. The preserved prior
   storage pointer and bytes remain unchanged and are verified after profile
   reopen; the current catalog then rejects that cached fixture before runtime.
4. The other card starts through keyboard `Enter`; cancellation stops its first
   member early and removes staging without changing the prior pointer.
5. The tool closes both browser contexts and loopback servers, deletes its owned
   profile, and prints `Artifacts:` and `Report:` paths.

A successful report has verdict `synthetic-fixture-mechanics-pass`, classification
`synthetic-test-only-never-live-model`, `testOnly:true`, and every value under
`claims` set to `false`. Activation rejection is expected; no inference is
attempted or mocked.

Fixture admissions bind the current public runtime manifest, so acquisition reaches
the actual runtime boundary. The member bytes remain deliberately non-executable:
the candidate must be rejected with `acg2-header`. The preserved prior fixture is
absent from the current synthetic catalog and must be rejected with
`model-catalog-delisted` before runtime activation, both on first open and reopen.
These exact rejections are recorded; unrelated storage/runtime errors fail the demo.
The harness passively observes the real worker's rejection message, binds it to the
candidate operation/composition identities, and leaves all messages unchanged. This
distinguishes the specific parser rejection from its outer installation-error wrapper.

Each invocation owns a marked output directory beneath the canonical repository's
`artifacts/synthetic-p2p-demo/`. Its reports and screenshots stay in the `artifacts`
child; a separately marked scratch root under `artifacts/browser-demo/` contains
the browser profile and process temporary files. This short independent path avoids
Windows browser-storage failures caused by deeply nested profile paths. Shutdown
removes that scratch through the shared bounded ownership
checks, while retaining the reports and the output ownership marker. The tests
remove their enclosing owned output after checking it. No output is written to a
drive-level temporary folder, and no project source or real model is copied.

## Quick Recovery

- If the UI preflight, bind, or readiness check fails, keep that failure visible.
  Press `Ctrl+C`, resolve the reported port or environment issue, and rerun the
  same UI command. If only browser handoff fails, its listener has closed. Rerun
  with `--no-browser`, then open the new printed loopback URL manually.
- If the synthetic walkthrough exits nonzero, press `Ctrl+C` or close its window
  and let owned-resource cleanup finish. Fix the reported browser, request, or
  cleanup error, then rerun the same synthetic command.
- A missing report, a verdict other than `synthetic-fixture-mechanics-pass`, any
  browser error, or any external request is a failed walkthrough. Do not edit an
  artifact or report to make it pass.

## Verification Baseline

The UI launcher policy is checked without opening a browser:

```powershell
npm --prefix .\tinyrustlm run test:demo:interview:no-browser
```

The separate live-model preflight prints current blockers:

```powershell
npm --prefix .\tinyrustlm run demo:preflight:live
```

Its current truthful status is `BLOCKED` with a nonzero exit because no external
direct peer is proven reachable. Any `Qualified catalog entries` count describes
schema-valid catalog-entry metadata, not fetched composition bytes, model
execution, or independent live-model qualification.

The compact chooser, strict catalog/admission path, composition cache, and direct
P2P browser fixture are checked by the `acquisition_playwright` gate:

```powershell
npm --prefix .\tinyrustlm run test:e2e:acquisition
```

The synthetic walkthrough contracts are checked with:

```powershell
npm --prefix .\tinyrustlm run test:demo:p2p:synthetic
```

Historical snapshot recorded on 2026-09-04: acquisition Playwright completed
with 63 passed, 9 intentional desktop-only skips, and 0 failed; the synthetic
walkthrough suite completed with 5 passed, 0 skipped, and 0 failed; a standalone
headless invocation, without `--headed`, exited 0 with
`synthetic-fixture-mechanics-pass`. This snapshot is not headed-browser evidence
and must not replace a fresh post-integration run of the exact command presented.

Earlier local verification on 2026-09-08 UTC (2026-09-07 Pacific): the direct Chromium
chooser and P2P specs finished with 47 passed, one existing mobile skip, and
zero retries. Desktop and mobile screenshots retained the existing design.
The standard Node inventory finished with 2,050 passed, three failed, and three
skipped. Two failures were the source-authority scan encountering unreadable
directories. The remaining worker test encountered an unwritable old Cargo
cache; its separate rerun with a fresh canonical build directory passed and
deleted both owned browser profiles. The complete standard gate is still not
green, and these scoped results do not replace the source-authority gate.
After the independent review corrected model-switch policy, worker ownership,
and mid-generation qualification expiry, the focused acquisition, race,
runtime-client, and shell suite passed all 102 tests. That later focused run is
not a rerun of the complete standard inventory.
The final stable-source Chromium chooser run passed 92 tests across desktop,
narrow desktop, mobile, and reduced-motion settings. Four real-conversation
tests were skipped because no private composition root was configured; they
provide no real-model conversation evidence.

The source-access blocker prevents certifying the UI launcher's full preflight
and deployment. Reviewed source changes may be checked in under the owner's
source-control direction while these release limitations remain recorded. No
directory permissions or historical bytes were changed to obtain these results.
The supplied checkpoint has an empty catalog: source acquisition
and direct seeding implementations exist, but an eligible checkpoint plus real
numerical, browser, and quality qualification are still required. Do not treat
the rejected pinned Qwen3 source or a closed failed candidate as a demo model.

The acquisition specs use deterministic test-only catalogs, admissions, and
composition bytes. The direct-P2P spec advertises signed public-IP URL fixtures,
then a test-only fetch bridge maps those fixture requests to an owned loopback
peer. It does not contact or prove either advertised public IP. The specs do not
run the synthetic interview walkthrough, inspect or qualify a real composition,
establish a live peer, or perform inference. Their successful signatures,
receipts, transfers, cache checks, and cancellations are fixture mechanics
evidence only.

## Evidence Boundary

There is no live qualified model, live external P2P reachability, or deployment
proof in this runbook. Neither demo proves live-model installation or activation,
inference, catalog publication, campaign progress, or a reachable public peer.
UI `READY`, catalog-entry counts, signed announcement counts, and local
`deployment-closure` validation do not change that boundary.
The signed Ed25519 announcements, qualification receipts, composition bytes, and
peer responses used by browser verification are synthetic fixtures, not live
evidence. A live blocker remains blocked regardless of these results.

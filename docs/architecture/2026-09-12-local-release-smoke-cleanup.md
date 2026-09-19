# Canonical local release checks

The local browser check now reads canonical public files in place and confines
generated release metadata, screenshots, browser profiles and child-process
scratch to project artifacts. It no longer requires output outside the worktree.
The shared operation helper checks strict artifact containment, directory and
marker identity, ordinary ancestry including dangling links, and bounded cleanup.
Generated metadata is removed even if ledger loading, server setup or observation
fails. The server is closed after observation failure.

From `E:\Source\Rust\TinyRustLM.com\tinyrustlm`, run:

```powershell
$env:TINYRUSTLM_PLAYWRIGHT_CHANNEL = 'msedge'
npm run smoke:web-release-local
```

This is the tested installed browser channel on this machine. Without the channel
variable Playwright uses its installed bundled Chromium, if available. The runner
creates canonical owned scratch, binds `TEMP`, `TMP` and `TMPDIR` in its child,
then removes disposable output. The explicit evidence CLI remains available for
callers that supply a new canonical artifact output path and inherit canonical
scratch variables; it retains requested screenshots and the report. Direct API
callers must also inherit canonical scratch. None of these paths publishes a site.

The browser check intercepts two exact MiniModel metadata requests with current,
fresh, empty fixtures. It blocks undeclared traffic before sending and requests
no model bytes. The former fixture lacked current contract fields. Adding them
initially still failed because the catalog requires second-precision UTC strings,
while `Date.toISOString()` includes milliseconds. A new explicit empty-state
assertion caught the failure even though the surrounding page loaded successfully.
Both metadata documents now pass the actual current validators and the browser
must render the verified empty state. The report names the intercepted fixture
mode. This is UI/release evidence, not a working default model or live seed test.

Validation: 24 tests passed with zero skips, including real Microsoft Edge
observations of four pages at three viewport sizes. Node line coverage was
96.55% for canonical scratch, 87.57% for the CLI runner, 97.62% for local smoke
and 79.81% for browser smoke. The actual zero-argument runner also passed all
12 observations and verified output cleanup. The registered source-authority
gate passed; it does not inventory whole drives. Compact results and exact
source identities are in
`artifacts/ecosystem-cleanup-20260912/local-browser-cleanup-review.json`.

The larger pending deployment-custody implementation still needs review, including
its copied publication snapshots and out-of-worktree assumptions. These local
smoke changes do not certify that implementation or complete release gates.

September 19 follow-up: C31 replaces copied-source staging with canonical input
hashes and verified memory payloads, and confines secret-scan evidence to canonical
artifacts. Its separate regression and installed-Edge smoke results are recorded
in `artifacts/ecosystem-cleanup-20260912/publication-canonical-input-review.json`.
Remote publication capabilities remain unproven; no live release is claimed.

An earlier parent test timed out before its 120-second child deadline. Two child
artifacts (310,515 logical bytes) appeared after parent cleanup began. The child
now inherits cancellation, does not inherit Node test-worker context, and the
parent deadline exceeds the child deadline. The corrected complete 24-test run
passed. Deletion of the two earlier artifacts was rejected with `blocked by policy`.
Their exact inventory and lesson are in `interrupted-local-smoke-review.json`;
they remain pending in the owner-run ecosystem cleanup command.

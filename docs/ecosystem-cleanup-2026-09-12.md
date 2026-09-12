# Ecosystem cleanup — active goal

The owner's full objective is the cleanup and code-quality review of every
project under `E:\Source\Rust`, including completion of current-only SLM2
acquisition, a real small default model and MiniModel server seeding. An audit,
fixture test or source-only change does not complete this goal.

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
  These UI changes still await their complete integration checkpoint.
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

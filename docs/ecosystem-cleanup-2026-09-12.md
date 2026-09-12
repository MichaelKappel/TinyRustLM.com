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
  remains unresolved and is recorded in `canonical-training-source-review.json`.
  No training, inference, qualification or deployment was performed.
- A second seven-file Qwen3 source directory remains at
  `D:/LLMs/TinyRustLM/experiments/TinyRustLM-vnext-private/qwen3-source-c1899de-20260825-v1`.
  Its exact identity/current references still require review before retirement;
  it has not been deleted or counted as recovered storage.

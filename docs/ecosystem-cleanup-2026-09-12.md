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

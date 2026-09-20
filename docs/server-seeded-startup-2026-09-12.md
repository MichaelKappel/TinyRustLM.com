# Server-seeded startup

## September 19 bounded admission checks

Before model transfer, `catalog-admission-loader.js` verifies the catalog-bound
qualification receipt and browser admission document. One 30000 ms deadline
covers both fetches, streamed bodies and hashes. The optional internal
`timeoutMilliseconds` setting must be an integer from 1 through 120000; it is not
a beginner-facing control. The deadline does not reset between documents and is
separate from the later model-transfer timeout.

The app supplies its cancellation signal to the loader. The loader gives fetch
its own linked signal and releases its timer/listener after success or failure.
Cancellation reports `catalog-admission-aborted`; expiration reports
`catalog-admission-timeout`. The latter displays: "Checking the model took too
long. Check your connection and try again." The chooser clears the busy state and
allows an explicit new attempt. No model transfer or automatic retry follows a
failed admission check, and no byte, identity or qualification validation is
relaxed.

C41 tests include uncooperative fetch/read/hash promises and real installed Edge
chooser checks with synthetic metadata. Desktop and mobile viewport timeout
cases verify zero peer model requests. This does not prove public MiniModel
availability, a qualified default or useful inference. Evidence:
`artifacts/ecosystem-cleanup-20260912/admission-lifetime-review.json`.

## September 19 native seed contract correction

The browser requires `X-TinyRustLM-Piece-Set-Id` on every member response. The
Rust seed previously omitted both that header and its CORS exposure, although
mock servers supplied it. The corrected native server derives the identity from
the six verified members and emits and exposes it on every successful response.

For `tinyrustlm.direct-composition-http.v1`, the piece-set ID is `sha256:` plus
the lowercase SHA-256 of the canonical `tinyrustlm.direct-composition-seed/1`
descriptor bytes: compact UTF-8 JSON in declared field order, fixed member order,
and one final LF. These are the descriptor bytes already accepted by the Rust
CLI and emitted by the companion; no paths enter that representation. A signed
announcement's `piece_set_sha256` must name this same identity. This profile
transfers six whole members. Its ID is separate from the fixed-4-MiB Merkle
transport's manifest/root; it is not a qualification or availability receipt.

The descriptor representation has one Rust owner shared by the CLI and server.
The server computes its ID after hashing open member handles and validating
ACG2 closure; it never accepts an arbitrary advertised ID as a substitute.
Normal member routes remain
`/tinyrustlm/direct-composition/v1/compositions/{compositionId}/members/{memberName}`.
A static host implementing those routes must provide the same identity, length,
media-type and CORS contract. No such seed configuration has been published.

The explicit real-browser regression runs with installed Edge, Node and the
canonical Playwright dependency and free loopback ports 4173/4174, using operation-owned canonical artifact
`TEMP`, `TMP` and `TMPDIR`:

```text
cargo test --offline --locked -p tinyrustlm-p2p --features browser-integration-tests
```

It starts the actual Rust CLI with tiny synthetic members, reads all six routes
from a real loopback HTTP page, checks browser-visible identities and byte hashes,
and rejects a foreign origin. It does not intercept seed responses or disable
browser security. This is transport evidence, not real model installation,
inference, or outside-network proof. Rust coverage tooling was unavailable;
the exact checks and coverage limit are recorded in lesson C32.

Read-only HTTPS probes at 2026-09-19T20:05:07Z found MiniModel.org resolving to
66.29.148.128 and responding with a LiteSpeed header. Its live catalog and peer
feed still contain zero entries/announcements and August 28 metadata with the
superseded no-server-bytes policy and missing current authority fields. The
catalog supports HEAD and a one-byte 206 range response, and both metadata routes
expose wildcard CORS. Those observations cover metadata only. They do not prove
model serving, process support, safe publication, or an independent external
network. Exact public-response hashes and headers are in
`artifacts/ecosystem-cleanup-20260912/native-seed-browser-contract-review.json`.

## Original startup implementation and September 12 observations

The owner requested automatic small-model startup through MiniModel.org on
2026-09-12. This explicitly supersedes older rules forbidding all project
model hosting. TinyRustLM.com still runs inference locally and does not serve
model bytes. MiniModel.org may serve verified model files as the initial seed.

Source changes implemented:

- Permit only the exact bootstrap origin `https://minimodel.org` in the shared
  direct-transfer authority and the MiniModel catalog validator. Keep signed
  announcements, qualification receipts, member hashes and activation checks.
- Prefer the bootstrap seed when multiple signed peers advertise a composition.
- Restore the current cached model first. Otherwise automatically acquire the
  smallest eligible server-seeded composition of at most 768 MiB. Expose progress
  and cancellation; do not automatically invoke local conversion or arbitrary peers.
- Keep manual IP/peer settings, files and Hugging Face in Advanced. Chat lists
  installed and downloadable models only. Preserve the existing visual design.
- Remove retired `.slm` Hugging Face discovery, ranking and import suggestions.
  The active old catalog, announcement, contact-book and receipt/status-file
  readers have been removed from the app. Two obsolete announcement files still
  await owner-run deletion after automatic approval review blocked removal.
  Historical tooling review and complete legacy-support cleanup remain open.

Cached model readers and replacement:

- A full cached load uses `storedComposition.withRead(callback, { signal })`.
  Its scoped reader pins all six files while they transfer to the worker.
  The callback must consume or dispose its streams and must not call a store
  mutation while holding the lease. Scope exit closes outstanding streams;
  cancellation rejects pending reads and releases the lease.
- Standalone `streamMember` pins that member until its iterator completes or is
  disposed. An opened metadata object alone is not a persistent pin; a load begun
  after its files were retired fails validation rather than mixing installations.
- Composition writes and retirement take an exclusive per-composition Web Lock.
  Shared readers never acquire the global writer lock; mutations take the writer
  lock before a composition lock. Replacement retires prior bytes after readers
  release them. Closing a reader tab releases its browser-owned locks.
- This protects cooperating store users. It does not isolate arbitrary same-origin
  code, guarantee progress for an abandoned uncancelled callback, or establish
  useful model quality. See `composition-read-lease-review.json` in the existing
  ecosystem-cleanup artifacts for source and synthetic browser evidence.
- Before retiring a hash-bound orphan or superseded installation, the store writes
  and reads back a canonical staging marker outside that installation. It removes
  the marker only after direct-file deletion, nonrecursive directory removal and
  observed directory absence. A retained invalid pointer or existing staging
  marker already provides this authority for its own recovery path.
- Marker allocation reserves the current activation ID and respects the bounded
  staging inventory. Unknown entries still block deletion. Interrupted retirement
  resumes when bounded cleanup runs, including before the next installation;
  read-only startup does not itself run cleanup. Actual Edge tab closure/reopen is
  tested, but power-loss durability is not established. See
  `composition-retirement-recovery-review.json`.

Cached model read cancellation:

- `openActive`, `discardInvalidActive`, `cleanup` and precommit installation
  validation propagate a supplied signal through file acquisition, bounded metadata
  streams, hashes and directory enumeration. Cancelling these reads does not
  authorize deletion or mean metadata is corrupt. Late read/disposal
  failures are observed after releasing the operation's locks.
- Pointer writes and authoritative postcommit readback retain their existing
  reconciliation lifetime. Cancellation after commit cannot turn a committed
  installation into a reported precommit cancellation. See
  `composition-read-cancellation-review.json` for regression and actual OPFS evidence.
- General store calls still rely on their supplied signal; durable mutations and
  commit reconciliation retain their own terminal lifetime.
- Startup supplies one 60-second deadline for cache verification, including lock
  and root acquisition. Opening is read-only, and every OPFS operation resolves
  its root independently; a stalled prior root promise cannot poison a later call.
  The chooser displays a timeout/reload message without removing saved bytes.
- Cache or cached-activation errors suppress automatic replacement acquisition
  until an explicit user action. A verified empty cache still automatically selects
  an eligible MiniModel seed. This deadline is an asynchronous-wait policy, not a
  measured performance budget for real model bytes. See `startup-cache-lifetime-review.json`.

Not deployed or working-model proof:

- The local catalog has zero entries and zero seed announcements. Its September
  8 issuance expired September 9; extending an empty catalog would not supply a model.
- Only one real `.slm2` was found under `D:\LLMs\TinyRustLM`: the 598,308,416-byte
  Qwen3 structural v12 experiment. Existing evidence does not qualify it as a
  working browser chat model. Raw checkpoints and the larger `X:\LLMS` collection
  do not satisfy the six-member browser composition contract.
- This machine has IIS, but no MiniModel.org or TinyRustLM.com site binding.
  MiniModel.org currently resolves to 66.29.148.128; its repository describes
  external FTPS publication. The owner has been asked whether to move the site
  here or connect the existing site to a seed service here. No DNS or hosting
  changes have been made.
- The public TinyRustLM page observed in this session was the older 0.4.1 setup
  UI, while the dirty source tree already contained the 0.5.0 compact chooser.

Completion requires a real licensed small composition with passing numerical,
quality and browser evidence; deployed HTTPS seed routes reading files only
from `D:\LLMs\TinyRustLM`; current catalog/announcements; and an outside-network
fresh-browser download and useful chat verification. Keep only the validated
replacement model when a new version supersedes it. Never copy the source tree
or model payloads into another project or temporary drive location.

The owner's later clarification rejects old model versions and compatibility
support during pre-release. A header-verified inventory found 44 SLM1 files
under `D:\LLMs\TinyRustLM`, totaling 35,279,860,160 logical bytes. The agent's
initial deletion attempt was rejected by automatic approval review. The owner
subsequently ran the reviewed PowerShell script: its receipt records all 44
deleted, zero remaining and no failure at 2026-09-12T15:48:26.0923254Z.
An independent filesystem check after the owner reported completion confirmed
all 44 inventoried paths absent and the current SLM2 experiment still present.
Exact paths and the deletion receipt are recorded in
`artifacts/cleanup-20260912/retired-slm1-models.json` and
`artifacts/cleanup-20260912/retired-slm1-deletion-receipt.json`.
Logical file sizes do not establish physical space reclaimed because some
files were hardlinked. Legacy code removal and a working default remain separate work.

Validation: targeted catalog and URL unit tests, bootstrap selection tests,
and real Edge UI tests with synthetic catalog metadata. Synthetic metadata
tests validate behavior, not real model quality or public seed availability.

Final checks: 77 TinyRustLM acquisition/selection/catalog/URL unit tests and
32 MiniModel catalog/contract tests passed. All 25 desktop chooser cases passed
across the full run and focused reruns after updating Advanced expectations;
three focused mobile startup/Advanced cases passed. Browser catalog module
line coverage was 82.10%. The large app's changed bootstrap selector has
extracted-function boundary tests plus real-browser dispatch/cancellation
tests; no whole-app coverage percentage is claimed. The installed Edge channel
was used without downloading another browser copy.

Implementation has advanced through the committed checkpoints and verification
recorded in `docs/ecosystem-cleanup-2026-09-12.md`, including chooser checkpoint
`fec548b`. Source changes remain unpublished;
real-model qualification, initial server hosting and full release gates remain
open. Existing unfinished deployment work is preserved for separate review.

A later exact-revision public metadata review compared two potential Qwen3
derivatives with the rejected pinned source. PrimeIntellect's repository reports
identical weight bytes and a changed tool-call template, so it would create a
duplicate rather than supply new eligible weights. The instruction-finetuned
candidate has different published weights but incomplete license/provenance
records; it is not admitted yet and has not been run. The named sources, primary
links, exact identities and limitations are recorded in lesson C21 of
`wiki/runtime-mirust/reports/ecosystem-experiment-lessons-2026-09-12.md` and
`artifacts/ecosystem-cleanup-20260912/public-source-metadata-review.json`.
No weights, catalog entries or hosting changes resulted from this screening.

The existing pinned training lane is another possible route to a new derivative,
but its required reviewed curriculum, independent holdout inputs and fresh
program/environment bindings are still prerequisites. They cannot be replaced
with invented review identities or a synthetic model demonstration. See
`tinyrustlm/training/qwen3-0.6b-working-model-v1/README.md`.

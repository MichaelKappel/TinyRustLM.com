# Dogfood Campaign Control Plane

Status: implemented pre-release control-plane contract

Schema authorities:

- Receipt envelope: `tinyrustlm.campaign_receipt.v1`
- Lifecycle: `tinyrustlm.campaign_lifecycle.v1`
- Operator dashboard: `tinyrustlm.dogfood_campaign_dashboard.v9`
- Fault plan: `tinyrustlm.campaign_fault_plan.v1`
- Fault report: `tinyrustlm.campaign_fault_report.v1`
- Host-restart approval: `tinyrustlm.host_restart_approval_request.v1`
- Host-restart checkpoint: `tinyrustlm.host_restart_checkpoint.v1`
- Host-restart verification: `tinyrustlm.host_restart_verification.v1`
- Final public readback: `tinyrustlm.public-release-readback-v2`
- Remaining risks: `tinyrustlm.campaign_remaining_risks.v1`
- Final attestation: `tinyrustlm.campaign_final_attestation.v1`
- Final-attestation receipt: `tinyrustlm.final-release-attestation-v1`
- Release-authority registry: `tinyrustlm.release_authority_registry.v1`
- Release-authorization envelope: `tinyrustlm.release_authorization_envelope.v1`
- Authorization-verification result: `tinyrustlm.release_attestation_verification.v1`

## Decision

The campaign is a directed acyclic graph of immutable, content-addressed
receipts. A mutable Boolean, process exit code, test summary, local fixture, or
operator note is never phase-completion authority.

TinyRustLM is pre-release. The v9 dashboard replaces v8 outright. There is no
dashboard compatibility adapter, dual writer, or fallback parser. Historical
receipts remain immutable because they are audit evidence, but a receipt that
does not meet a current promotion predicate cannot satisfy a current gate.

## Implemented Facts

- `campaign-evidence-store.js` validates strict receipt fields, canonicalizes
  JSON, binds receipt IDs to SHA-256 content, validates the parent DAG, and
  quarantines malformed or disconnected receipt files.
- `durable-files.js` provides the shared create-once and replace atomics. Both
  paths use a same-directory temporary file, file `fsync`, atomic publication,
  directory `fsync` where the platform permits it, and exact readback.
- `campaign-lifecycle.js` defines every required active and terminal state,
  validates the active DAG at module load, validates direct transitions, and
  keeps terminal rejection distinct from resumable blockage.
- `campaign-evidence-dashboard.js` rebuilds and validates the receipt store
  before deriving any operator result.
- `campaign-fault-injection.js` validates the exact 24-fault policy, owns ten
  local evidence scenarios, and dispatches six browser scenarios plus one
  package scenario. Nine local
  cases run portably: process crash, interrupted
  receipt publication, disk full, corrupt model, truncated model, network loss,
  peer disappearance, corrupted piece, and independent lane death. Invalid
  tensor offsets require an explicitly selected native validator and real
  `.slm` fixture. Each scenario preserves an immutable domain receipt and a
  separate attempt receipt instead of allowing an attempt to certify itself.
  The report remains incomplete until the other target-platform, live-service,
  outside-network, and deployment evidence exists.
- `campaign-host-restart-fault-scenarios.js` implements the target-platform
  host-restart case as three explicit commands. `request-host-restart` writes
  an immutable, expiring request from hashed OS boot and stable machine
  identity. After separate operator authorization, `prepare-host-restart`
  binds the exact request, plan, source/tool identity, and complete retained
  receipt set into an immutable checkpoint and starts a bounded restart
  sentinel. Following the reboot, `verify-host-restart` requires the same
  physical host, a later boot within the authorization window, an unchanged
  retained sentinel marker, a dead sentinel process, the complete pre-restart
  receipt set, and the retained preparation receipt. It atomically publishes
  an immutable post-boot verification artifact before removing only the owned
  marker, so a crash between cleanup and receipt publication remains
  recoverable. It then emits the domain and attempt receipts. The tool prints
  the exact restart command but never invokes it.
- `campaign-browser-fault-scenarios.js` executes allocation failure, generation
  timeout, cancellation, browser crash, locked-profile, and profile-deletion
  failure cases in the pinned installed Chromium. Every case uses an owned
  persistent profile, records the Chromium executable and Playwright identity,
  proves containment or recovery, and physically deletes the profile. The
  browser receipt identity also binds `owned-browser-profile.js` and the exact
  dependency lock; a self-described browser receipt without those hardware
  facts cannot satisfy the fault gate.
- `campaign-package-fault-scenarios.js` creates an isolated locked-mode NuGet
  consumer against the approved local feed, proves changed package bytes are
  rejected, discards the drifted feed and cache, recreates a clean cache, and
  executes the recovered package consumer against a real `.slm` fixture. Its
  receipt binds the .NET executable, approved package hashes, lock file,
  recovery outputs, and marker-protected work-root deletion.
- Package release verification and package fault evidence share a schema name
  but not semantic authority. The dashboard selects only the
  `package-verification` phase for the release gate and requires real consumer
  execution, four packages, four symbol packages, an exact semantic version,
  and matching package-audit hashes. A newer blocked `fault-domain-evidence`
  receipt remains auditable without shadowing that release receipt.
- The dashboard does not trust a self-asserted 24/24 count. Its fault gate
  requires one canonical plan parent plus 24 distinct attempt parents, rechecks
  every attempt and its exact domain-evidence parent against the plan, and then
  validates the report counts, empty incomplete set, status, evidence class,
  and attestation binding.
- `campaign-public-evidence.js` is the shared model, outside-proof, catalog,
  and public-readback validation boundary. A caller-provided Boolean or local
  catalog file cannot assert public HTTPS success.
- `campaign-public-readback-evidence.js` aggregates exactly 20 current catalog
  announcements backed by 40 unexpired complete-transfer proofs. Every
  announcement must bind the same credential-free public catalog and feed byte
  hashes before the aggregate can pass.
- `campaign-public-artifact-scope.js` constructs the deterministic
  `campaign-public-release` allowlist. Only a complete v2 scan of that named
  scope can satisfy the secret-scan release gate. The dashboard recomputes the
  current streamed file manifest and requires the scan receipt's input and
  output scope hashes to match it exactly.
- Rebuildable `campaign-status.json`, immutable dashboard snapshots,
  secret-scan receipts, final-attestation output and snapshots,
  final-attestation receipts, and release-authorization verification receipts
  are excluded from the scan's manifest to keep the evidence dependency graph
  acyclic. Their dedicated validators enforce strict schemas, canonical hashes,
  immutable history, signatures where applicable, and exact readback. Every
  ordinary campaign receipt remains included, so a control-plane or evidence
  change invalidates the prior scan automatically.
- `campaign-final-attestation.js` rebuilds the receipt DAG and dashboard,
  validates a strict remaining-risk register, and emits a content-addressed
  final predicate. It records every retained failure and supersession rather
  than reducing the campaign to one Boolean. The current pre-release run is an
  immutable `incomplete` attestation. A `complete` claim additionally requires
  a current deployment-class authorization-verification receipt bound to the
  exact predicate and source revision.
- `campaign-release-authorization-evidence.js` verifies that authorization
  receipt. It accepts only an active Ed25519 release-authorizer key from a
  source-bound strict registry, validates a bounded signed authorization
  envelope over the exact unsigned predicate, enforces issue and expiry times,
  and emits a deployment receipt carrying the registry, key, envelope, payload,
  predicate, source, and verifier hashes. A Boolean cannot substitute for the
  signature verification.
- Every dashboard has a canonical `dashboardContentSha256`. Each write creates
  an immutable hash-addressed snapshot before atomically replacing the
  rebuildable `campaign-status.json` operator view.
- Candidate identities must be concrete public identifiers. The active model
  qualification path does not migrate or emit redacted placeholder identities.

## Active Lifecycle DAG

```text
Discovered -> Acquired -> Reviewed -> Screened
Screened -> TrainingPrepared -> TrainingRunning -> Trained -> Converted
Screened -----------------------------------------------------> Converted
Converted -> StructurallyValidated -> NativeEvaluated
NativeEvaluated -> ConversationScreened
ConversationScreened -> ConversationProven -> Qualified
ConversationScreened -> TaskSpecificProven -> Qualified
ConversationProven -> TaskSpecificProven

Qualified -> BrowserTesting -> BrowserProven
Qualified -------------------------------> P2PPrepared
Qualified ---------------------------------------------> Packaged
BrowserProven -> MemoryContinuityTesting -> MemoryContinuityProven
BrowserProven ------------------------------------------> P2PPrepared
MemoryContinuityProven ---------------------------------> P2PPrepared
P2PPrepared -> P2PServing -> P2PExternallyProven -> CatalogAnnounced
CatalogAnnounced -> Packaged -> Published -> DeploymentVerified -> Complete
CatalogAnnounced ------------> Published
```

Any active state may produce `Blocked` or `Rejected`.

- `Rejected` is terminal for that candidate or attempt lineage.
- `Blocked` retains `resumeFromState`. A retry may remain at that verified
  checkpoint or take one allowed outgoing edge from it.
- `Complete` may become `Blocked` when expiring or revoked external evidence
  invalidates a live gate. The dashboard is always re-derived from current
  receipts, so an old completion statement cannot pin current status.
- Blocked branches do not stop unrelated branches.

## Candidate Projection

The operator view reports both `state` and `lastVerifiedState` for each public
candidate. A quality rejection after native evaluation therefore appears as:

```json
{
  "state": "Rejected",
  "lastVerifiedState": "NativeEvaluated",
  "terminal": true
}
```

This preserves useful execution evidence without presenting a rejected model
as qualified. Infrastructure failures appear as `Blocked` and require an
operator decision unless a receipt explicitly declares retry permission.

The safetensors source-review boundary treats a deterministic tensor-contract
incompatibility as an expected decision, not a retryable process failure. The
Rust reviewer writes a strict
`tinyrustlm_safetensors_candidate_rejection_version=1` sidecar, exits with the
documented rejection code, and the campaign runner persists a terminal
`tinyrustlm.model-source-review-v1` receipt bound to the verified acquisition
receipt, source-weight SHA-256, reviewer binary, and rejection sidecar. Missing
files, timeouts, malformed sidecars, invalid command inputs, and checksum drift
remain `Blocked` infrastructure failures. Rejection sidecars never enter
conversion.

Candidate failure receipts are never deleted when work later succeeds or
reaches a quality rejection. The lifecycle reducer compares the newest
failure, rejection, and successful milestone for that model and exposes one
`currentTerminalReceiptId`. Only that current blocked receipt may contribute a
candidate error to `activeBlockers`, retry queues, or current infrastructure
failure counts. A later successful milestone clears the operational blocker;
a later rejection replaces it with the rejection reason under
`rejectedModels`. The original error remains in retained receipt history and
the final attestation's failure inventory.

Fixture candidates are excluded from the promotable lifecycle projection and
reported separately under `nonPromotableEvidence`.

## Durable Operation Journal

An operation starts with a `tinyrustlm.campaign-operation-start-v1` receipt.
Its public parameters are:

```json
{
  "operationId": "screen-001",
  "operationName": "screen candidate"
}
```

An operation ends with a `tinyrustlm.campaign-operation-finish-v1` receipt that:

- has the start receipt as exactly one operation-start parent;
- repeats the exact public operation ID and name;
- records the final phase status in the ordinary receipt envelope.

One unclosed start is `running`. No unclosed start is `idle`. More than one is
an evidence conflict: dashboard health becomes `invalid`, resumability becomes
false, and no operation is selected by timestamp or preference.

An interrupted process leaves its immutable start receipt visible. Recovery
must reconcile that operation explicitly; it must not delete or edit the start.

## Dashboard Contract

The v9 dashboard exposes:

- exact progress objects for 20 models, 50 clean browser rounds, 25 live memory
  rounds, 40 outside-proven lanes, 20 announcements, three native RIDs, and 24
  fault-injection cases;
- separate declared and verified native-RID counts, with emulation excluded
  from the verified count and physical hardware required for Linux ARM64;
- explicit lifecycle branch and candidate states;
- current operation and operation conflicts;
- campaign start, elapsed milliseconds, and last durable checkpoint;
- active blockers, rejected models, and three retry queues;
- receipt graph health, current and retained receipt-set hashes, quarantine
  counts, and semantic proof/announcement validation counts;
- disk usage for the authoritative receipt store and quarantine only;
- expiring and expired outside-proof warnings;
- release-gate receipt IDs and outcomes;
- the exact final-attestation gate, which remains false for unsigned,
  incomplete, local-only, or hash-drifted attestations;
- fixture and local-only evidence that cannot satisfy live gates;
- a canonical dashboard content hash and resumability status.

`activeBlockers` contains current blocked or failed work and unmet campaign
gates. Candidate rejection reasons belong to `rejectedModels`; they do not
remain permanent global blockers after enough other models qualify.

The current evaluator cohort is selected by receipt completion time and then
binary hash. Hash lexical order is never treated as time.

## Completion Predicate

`status` becomes `complete` only when all of these are simultaneously true:

- qualified model count is exactly 20;
- clean browser round count is exactly 50;
- live memory round count is exactly 25;
- current outside-proof lane count is exactly 40;
- authoritative catalog announcement count is exactly 20;
- browser acceptance, package, native RID, physical Linux ARM64, packaged-site,
  public HTTPS readback, secret-scan, and 24-case fault-injection gates pass;
- the machine-readable final attestation is deployment-class, bound to the
  exact predicate and content hashes, and backed by verified release
  authorization;
- evidence validation health is `healthy`;
- there are no active blockers.

An outside proof counts only while unexpired and only when it binds the current
qualification artifact, observer signature, complete transfer, checked routes,
piece count, and downloaded byte count. A catalog announcement counts only
when two distinct current lane proofs bind the same model, artifact, piece set,
and fleet and authoritative HTTPS readback matches.

The final public HTTPS gate additionally requires one current v2 aggregate
receipt whose 20 parents are the exact current announcement receipts. Those
announcements must reference 20 distinct models, 40 distinct lane-proof
receipts, and one common catalog/feed snapshot. Expiry or supersession of any
parent proof invalidates the gate; rerunning aggregation writes a blocked
attempt that supersedes the former pass without deleting history.

## Observed Current Limitations

These are observed campaign facts, not proposed successes:

- All 66 attempted candidates are terminally rejected; none currently has
  qualifying assistant-quality evidence.
- The current Git index contains only six approved tiny `.slm` test fixtures
  and no non-fixture `.slm`, safetensors, raw `.f32` tensors, or P2P piece
  payloads. Preserved review copies live in the external content-addressed
  store and have no model-quality or release authority. Ancestor Git history
  still contains removed model payloads and therefore remains a release
  lineage blocker.
- The required clean-browser and live-memory campaign receipts remain absent.
- The live MemoryEndpoints lifecycle contract is externally blocked.
- Local two-process P2P evidence is non-promotable and is not public proof.
- No outside observer receipt, catalog announcement, public release readback,
  or physical Linux ARM64 receipt currently satisfies its gate.
- The final release attestation is intentionally incomplete and unsigned while
  those prerequisite gates and release authorization remain absent.
- Current local, browser, and package evidence satisfies 17 of 24 fault cases. The native
  invalid-offset run used the release `tinyrustlm-slm-pack` validator and a real
  `.slm` fixture; the other nine used isolated local files, processes, and
  loopback connections. Six browser cases used actual Chromium processes and
  owned persistent profiles whose deletion was verified. The package case used
  a real .NET process, changed package bytes, isolated NuGet caches, locked
  restore, and a downstream consumer execution. The remaining seven retain
  their declared physical-host, live-service, outside-network, or deployment
  evidence requirements; none is simulated as a stronger evidence class.

## Verification

Focused tests cover:

- active DAG acyclicity and allowed branch transitions;
- blocked resume and terminal rejection;
- candidate state projection;
- immutable create and atomic replacement persistence;
- receipt redaction, parent validation, tamper quarantine, and cycle rejection;
- evaluator cohort selection and supersession;
- fixture exclusion and strict browser/proof counting;
- operation start, finish, conflict, elapsed time, and checkpoint reporting;
- retry queues, evidence health, disk usage, and proof-expiry warnings.
- named-scope secret-scan enforcement and rejection of old or partial scans.
- deterministic incomplete final attestations, strict remaining-risk schemas,
  tamper rejection, exact predicate binding, and rejection of local or drifted
  final-attestation receipts.
- Ed25519 authorization verification, strict authority-registry and envelope
  parsing, revoked-key rejection, bounded authorization lifetime, and exact
  final-receipt parent enforcement.
- immutable host-restart requests, expiry, same-boot rejection, stable-host
  binding, sentinel retention and cleanup, retained receipt sets, and explicit
  rejection of injected fixture evidence as physical-host proof.
- canonical fault-plan validation, ten local executors, six actual-Chromium
  executors, one locked-restore package executor, explicit native-fixture
  gating, owned-profile and package-work-root deletion, separate domain and
  attempt receipts, evidence-class separation, incomplete reporting,
  self-asserted-report rejection, and the full 25-parent release-gate predicate.

Live service, public network, package publication, and physical ARM64 evidence
cannot be inferred from these local tests and remain separate authorization or
infrastructure gates.

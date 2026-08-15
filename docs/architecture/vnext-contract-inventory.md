# TinyRustLM vNext Contract Inventory

## Status

This is the authoritative Phase 2 pre-cutover inventory captured on
2026-08-09. It separates the observed former implementation from the
incompatible vNext contract family. The measured counts below are a frozen
baseline, not a current source-tree count and not a runtime-support claim.

## Measured Pre-Cutover Surface

The inventory command scanned only executable source under `tinyrustlm/tools`
and `tinyrustlm/app`. It excluded documentation, tests, generated output,
`node_modules`, and `target`.

- 116 source files contain at least one string matching
  `tinyrustlm.<name>.v<number>`.
- 243 distinct matching schema identifiers were found.
- The sorted identifiers, joined with one LF after every identifier, occupy
  10,967 UTF-8 bytes and have SHA-256
  `caf0b3f4441cf923d188b943b147c802ca41dec11ad00b258ac287b5592615eb`.
- 78 app/tool files contain 167 `JSON.parse` call sites. This count is an audit
  queue, not a claim that every call consumes hostile or signed input.
- The raw release-authorization boundary is the first audited conversion: its
  attestation, registry, and envelope use `tinyrustlm.strict-json.v1` before
  schema and Ed25519 verification.

The measured identifiers include overlapping generations, experiment-only
records, browser-local storage, model sidecars, campaign receipts, release
records, and diagnostic preregistrations. Parameterized version suffixes do
not make them one coherent family.

## Authority Rules

1. Every current identifier is historical implementation evidence only. No
   current identifier is an alias, predecessor, migration input, or fallback
   for a `tinyrustlm.vnext.*` identifier.
2. vNext readers reject every non-vNext schema before interpreting fields.
3. vNext writers emit only the exact schema owned by their boundary.
4. A future field or behavior requires a new schema identifier and evidence;
   validators never retain unknown fields.
5. Test fixtures and old receipts remain immutable evidence but cannot enter
   the active vNext DAG, model selector, worker, companion, P2P catalog,
   release manifest, or public claim registry.
6. Cutover deletes superseded production readers, writers, aliases, and route
   handlers after the replacement passes. It does not hide them behind a
   compatibility package.

## Pre-Cutover Boundary Findings

| Class | Observed current implementation | Material gap | vNext disposition |
| --- | --- | --- | --- |
| Artifact | SLM1 parsing, ACG1 composition, model manifests, adapter sidecars, and content-identity experiments are implemented in separate Rust, Node, and browser paths. | No single SLM2 metadata/key registry, artifact-class registry, limits table, or independently packed conformance corpus exists. | Regenerate reviewed sources into SLM2 and one immutable external artifact manifest. Delete SLM1 production admission after the SLM2 gate. |
| Receipt | `CampaignEvidenceStore` provides closed fields, content addressing, redaction, immutable files, DAG rebuild, and quarantine; many task-specific receipt types wrap it. | Current receipt identity/canonicalization and nested parameter shapes are not the complete ADR-010 vNext profile. | Replace all campaign phase evidence with one envelope/content receipt contract plus typed `receiptType` and phase semantics. |
| Context | Conversation, prompt-token, memory, retrieval, KV, and local-store contracts are split across browser and tooling schemas. | Trust labels, current-turn precedence, deterministic truncation, cache identity, and public/private handling are not one closed context package. | Use one private, volatile context package with explicit segment trust, budget, compiler, model/composition, tokenizer, and template identities. |
| Worker | Browser generation and fault tests use several ad hoc `postMessage` shapes; there is no single production worker envelope. | Message/session/generation identity, cancellation, stale-response rejection, deadlines, transfer ownership, and payload privacy are not frozen together. | Use one small private worker envelope; transfer large/private payload bytes separately and bind them by byte count and SHA-256. |
| Companion | Browser protocol v2 and the .NET SeedHost implement a closed loopback route family with scoped sessions and streaming. | Operation bodies, durable status, error vocabulary, and source/model/composition identity still span several schemas and language-specific validators. | Keep the accepted transport profile but replace its JSON bodies with one vNext request/response envelope and closed operation payload registry. |
| P2P | Rust peer offers, browser MiniModel announcement validation, local share evidence, and catalog tooling exist. | Piece, artifact, composition, qualification, license, endpoint, and lane identities are not one vNext publication graph. | Use one complete piece manifest with canonical 4 MiB pieces and exact artifact/composition/qualification parents. Model bytes remain direct peer traffic. |
| Proof | `tinyrustlm.p2p-outside-proof-v1` distinguishes complete outside transfer from local health and expires evidence. | The complete ADR-010 observer registry, role separation, revocation, offline bundle, and vNext signed payload are not implemented. | Use one expiring outside-observer proof content contract plus a separate role-bound signature envelope. |
| Release | Campaign release evidence, final attestation, Ed25519 authorization, web deployment manifests, and `uaix.site_release.v1` existed as distinct contracts. | The former implementation had no single vNext release closure binding campaign, packages, sites, SBOM, provenance, claims, authorization, and HTTPS readback. | The sole maintained vNext release surface now uses one immutable release manifest whose parents must already pass; publication creates descendants and never mutates the release. |
| Claim | Quality strings such as `conversation-proven` appear in admissions, receipts, UI, docs, and catalog checks. | There is no one machine-readable registry that separates wording, scope, evidence class, freshness, blocker, withdrawal, and prohibited wording. | Use one claim record per exact subject/scope. Marketing and docs render only current supported claim records. |

## Frozen vNext Family Names

Exactly these nine schema identifiers form the Phase 2 family. Their detailed
field registry is the next contract artifact. Another top-level family member
requires an ADR change, not a convenient local constant.

| Class | Schema identifier | Owner and trust boundary | Visibility | Maximum encoded bytes |
| --- | --- | --- | --- | ---: |
| Artifact | `tinyrustlm.vnext.artifact_manifest.v1` | Converter, inspector, runtime admission, companion store | Public-safe metadata; never model bytes | 524,288 |
| Receipt | `tinyrustlm.vnext.receipt.v1` | Evidence recorder, DAG validator, release verifier | Public-safe after mandatory redaction | 262,144 |
| Context | `tinyrustlm.vnext.context.v1` | Context compiler and inference worker | Private volatile session data | 1,048,576 |
| Worker | `tinyrustlm.vnext.worker_message.v1` | Browser main thread and one owned worker | Private session envelope | 65,536 |
| Companion | `tinyrustlm.vnext.companion_message.v1` | Approved browser origin and paired loopback companion | Private session envelope | 65,536 |
| P2P | `tinyrustlm.vnext.p2p_manifest.v1` | Companion piece store, serving lane, MiniModel verifier | Public-safe metadata; direct peer bytes separate | 2,097,152 |
| Proof | `tinyrustlm.vnext.outside_proof.v2` | Independent observer and offline verifier | Public-safe signed evidence | 262,144 |
| Release | `tinyrustlm.vnext.release_manifest.v3` | Release builder, authorizer, deploy/readback verifiers | Public-safe acyclic prepublication release and exact static-site asset graph | 524,288 |
| Claim | `tinyrustlm.vnext.claim.v2` | Claim registry, product UI, docs, catalog, marketing | Public-safe approved or published evidence-bound wording | 262,144 |

All nine control-plane encodings use the strict vNext canonical JSON profile.
SLM2's internal fixed envelope and SLM-DCBOR-1 metadata remain governed by
ADR-001 and are referenced by the artifact manifest rather than re-encoded as
JSON model metadata.

The offline verification manifest, frozen verifier profiles, and canonical
public-safe scan result are verifier support documents, not additional
top-level product contracts. The manifest is identified by an externally
pinned raw-byte SHA-256 and is followed by a separate
`offline-verification-bundle` receipt. The scan result is identified by the
output hash in a separate `redaction-scan` receipt. Both constructions preserve
the nine-member family and avoid content-addressed cycles.

## Cross-Boundary Identity

- SHA-256 is the sole mandatory ecosystem identity hash.
- Content IDs are `sha256:` followed by 64 lowercase hexadecimal characters.
- Receipt, proof, release, and claim identities use distinct domain-separated
  canonical-content hashes; a valid hash never changes evidence class.
- A proof never embeds its signature-envelope ID. The separate signature
  receipt points to the already-finalized proof as a descendant, preventing a
  proof/envelope content-addressing cycle.
- The release predicate never embeds authorization or postpublication
  evidence. It contains only approved claims with null release IDs, exact
  static web assets, and pre-identity descriptors for generated pointer and
  history responses. It cannot embed its own wire hash or generated bytes that
  name that hash. Release authorization, generated publication bytes, HTTPS
  readback, and published claim descendants point to the finalized release,
  so the public graph remains constructible and acyclic.
- Static web assets bind exact path, hash, size, type, cache policy, and
  security-header profile. An `immutable` path contains its full SHA-256;
  stable routes must revalidate or use no-store.
- Artifact identity covers complete bytes. Piece identity, Merkle identity,
  composition identity, model identity, and behavioral lineage remain
  separate typed facts.
- Context cache identity binds the exact active model/composition, tokenizer,
  template, context compiler, segment sequence, and KV profile.
- Worker and companion request IDs provide correlation and replay control, not
  artifact, receipt, or public claim identity.
- Every external reference is a typed content ID, receipt ID, or sanitized
  public HTTPS URL. Filesystem paths, mutable aliases, and model-byte URLs are
  forbidden in public contracts.

## Invalidation Ownership

| Change | Invalidated descendants | Unaffected ancestors |
| --- | --- | --- |
| Artifact bytes or SLM2 metadata | Structure, runtime, evaluation, qualification, browser, P2P, proof, release, claim | Immutable source acquisition and review receipts whose inputs did not change |
| Tokenizer, template, context compiler, sampling, evaluator, or composition | Evaluation and every later quality-dependent phase | Acquisition, conversion, and byte-valid structure where their inputs are unchanged |
| Browser/runtime build | Browser rounds, deployment/readback, browser-facing claims | Model acquisition, conversion, and independent native qualification |
| P2P piece manifest or lane implementation | Lane serve, outside proof, announcement, P2P claims | Model quality and browser conversation evidence |
| Observer registry, key, revocation, endpoint, or proof expiry | Outside proof, announcement, release, public P2P claim | Local serve and model qualification evidence |
| Site/package bytes or release manifest | Package/deployment/readback/site-sync claims | Qualified model and completed campaign phase receipts |
| Claim wording or scope | Claim record and rendered sites/docs | Underlying evidence receipts |

## Current Implementation Status

The Phase 2 registry now freezes common limits, all nine exact schemas,
reject-all unknown-field behavior, private-by-default visibility, one
language-neutral hostile corpus, two separately sourced validators, and the
bounded threat review. Phase 3 Node checkpoints now add domain-separated
identity, create-only atomic receipt persistence, DAG reconstruction and
quarantine, Ed25519 signing authority and revocation, closed offline bundles,
canonical public-safe scan receipts, and exact semantic phase currentness.
The current campaign checkpoint additionally freezes one exact campaign plan,
authority-aware truthful projection, and sufficient complete-bundle bounds.
The plan finalization boundary now has an independent strict Rust
implementation, frozen Node/Rust byte vectors, hostile invariant tests, and a
successful `wasm32-unknown-unknown` build. The semantic-currentness boundary
also has an independent strict Rust implementation, a frozen four-pass and
nine-rejection cross-language corpus, exact result-byte and error-code parity,
and a successful `wasm32-unknown-unknown` build. The exact Ed25519 primitive
also has an independent strict Rust implementation and a frozen public-only
one-pass and 17-rejection corpus with byte, hash, and error-code parity. The
complete authority graph now has an independent strict Rust implementation,
all six signable non-receipt subject validators, and a public-only nine-pass
and 26-rejection corpus with exact result-byte, hash, and error-code parity.
Exact offline-bundle manifest, verification-receipt, authority, target, and
closed-membership verification now has an independent strict Rust
implementation and a public-only three-pass and 31-rejection corpus with exact
result-byte, hash, and error-code parity. Rust truthful projection and strict
projection-result validation now independently compose the exact plan,
semantic-currentness, receipt/subject identity, and authority boundaries. A
public-only 1,494,464-byte corpus with SHA-256
`8a72ac1b2e4abd944e41c1c53a7d475e350d961e7b627127404b0508cf654734`
freezes 11 accepted projections, 22 input rejections, and 8 result-wire
rejections with byte, hash, and error-code parity. The Node campaign boundary
now also
validates complete projection-result wires and persists exact plans and
projection snapshots through one frozen create-only artifact-store profile.
The receipt, public subject, and campaign artifact stores share bounded
filesystem mechanics while retaining separate receipt-DAG, identity-subject,
and result-to-plan semantics. The subject store accepts only the five
public-safe non-receipt identity schemas and rejects private context and
receipt records. Resume always reprojects supplied current evidence; no stored
subject, snapshot, or mutable pointer is currentness authority.

`campaign-evidence-wasm-interface.v1.json` now freezes the sole typed raw
browser evidence ABI with no imports and an exact export set. Its deterministic
generator emits both the Rust export facade and a browser adapter that
transports bytes and sequences destructive stages without implementing
campaign semantics. Node and two independent real Chromium profiles produce
exact plan, currentness, truthful projection, result-validation, and stable
rejection bytes. This browser execution remains local conformance evidence and
grants no production runner, release, or live campaign authority.

`contracts/vnext/public-safe-redaction-profile.v1.json` binds the current
registry. `tinyrustlm/tools/vnext-public-safe-redaction.js` accepts finalized
canonical bytes only, scans exact secret encodings and contextual forbidden
values, returns unchanged bytes only on pass, and replays the scan receipt with
one signed, pinned, module-issued custody revision. The offline manifest binds
the custody, redaction, frozen phase-invalidation, and campaign-projection
profiles among eight exact profile inputs. See
`docs/architecture/vnext-protected-equality-custody.md` and
`docs/architecture/vnext-public-safe-redaction.md`.

The local custody ingress is now frozen by
`protected-equality-private-loader-profile.v1.json`. Its 3,254 bytes have
SHA-256
`e209d31c0c8b2243aa231092feabf5106acdb141f72d32a18e2f1940c5af84e3`,
and its canonical nine-member source closure has SHA-256
`63843bfea80972ce402d8987ce72ac47ba47f1b769ecabe5de5d0ba8b3a14b77`.
The loader accepts only canonical public pins and inherited non-file pipe
descriptor 3, performs bounded single-use reads, closes the descriptor, and
zeros owned delivery buffers. It does not prove an authorized issuer, launcher,
release bootstrap, revocation source, trusted time, or OS isolation. See
`docs/architecture/vnext-protected-equality-private-loader.md`.

The phase classifier and its explicit supersession rules are documented in
`docs/architecture/vnext-phase-invalidation.md`.
The independent Rust currentness boundary is documented in
`docs/architecture/vnext-rust-phase-invalidation-parity.md`.
The independent Rust Ed25519 primitive boundary is documented in
`docs/architecture/vnext-rust-signature-primitive-parity.md`.
The independent Rust authority-graph boundary is documented in
`docs/architecture/vnext-rust-authority-graph-parity.md`.
The independent Rust offline-bundle boundary is documented in
`docs/architecture/vnext-rust-offline-bundle-parity.md`.
The independent Rust truthful-projection boundary is documented in
`docs/architecture/vnext-rust-campaign-projection-parity.md`.
The exact 20/50/25/40/20 plan and no-double-count projection are documented in
`docs/architecture/vnext-campaign-plan-projection.md`.
The independent Rust plan boundary is documented in
`docs/architecture/vnext-rust-campaign-plan-parity.md`.
The generated browser campaign-evidence WASM boundary is documented in
`docs/architecture/vnext-campaign-evidence-wasm-boundary.md`.
Create-only plan/projection persistence is documented in
`docs/architecture/vnext-campaign-artifact-persistence.md`.
Create-only public subject persistence is documented in
`docs/architecture/vnext-subject-store.md`.
The bounded Rust/Win32 directory-flush helper and its exact non-claims are
documented in `docs/architecture/vnext-directory-durability.md`. Its
7,021-byte frozen profile has SHA-256
`bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb`.
The current Windows host executes the helper and rejects a real directory
junction. The helper accepts one sorted canonical batch of one to 1,024
directories and emits no partial success document. Its sole Node
package/process client has a 5,845-byte frozen profile,
SHA-256
`0d5fe88e8abb371a99db58f1ce3fabce180dc00f77287b6f44ea40d268d709a1`,
and source-closure SHA-256
`b265141e0749422bcdadefab7777c97d154f442ac18397f69664dd1af24447f3`.
The client verifies exact package, one-process batch, request, and observation
identity without inheriting parent environment variables. The durable
publisher preflights one to 1,024 targets, batches target and receipt directory
flushes, and activates only after complete verification. Receipt and subject
stores use sole `putMany` paths; their size-one methods are wrappers. Every
current vNext store, campaign-operation record, and runner-lock record consumes
the sole receipt-backed durable-publication primitive. No batch claims an
atomic filesystem transaction. OS network isolation, current helper provenance
and clean-consumer execution for every supported RID, authorized production
  equality-custody issuance, authorized private launching, release-bootstrap
  exclusivity, and controlled physical
power-loss evidence remain incomplete. One maintained structured archive target
and frozen 29-seed hostile corpus now replay locally; hosted sanitizer
execution, longer campaigns, and retention/minimization of future crash
findings remain open. Deterministic cross-format, path, every-prefix, and
single-bit mutation properties pass locally.
The sole bounded ZIP and tar-gzip authority, its Rust process boundary, and the
v4 public-artifact secret-scan cutover are documented in
`docs/architecture/vnext-archive-admission.md`. Its client/package profile has
SHA-256
`08bb532cd88273f5633a8693040c2108fd7fef0935f9705f34b98cb1ab405441`.
Memory-package and public-evidence consumers use that authority without
extraction or a system-tool fallback. One clean `win-x64` release package from
source `ab12047fec0bf6d1d2c0b3b00939e228dcb5d46b` passed the exact maintained
consumer tests. Current native package evidence for `linux-x64` and
`linux-arm64`, hosted CI completion, signing where required, publication, and
production readback remain open release work.
Every maintained .NET test project now declares
`<IsTestProject>true</IsTestProject>` directly. A structured XML test enumerates
the complete `dotnet/tests` tree and requires that declaration plus exactly one
`Microsoft.NET.Test.Sdk` reference in every project. This prevents newer SDKs
from returning a zero exit code after silently skipping a project whose test
identity was only inferred. Core test data is linked explicitly into the test
output under `fixtures/`; tests read that one output-local path instead of
walking ancestor directories for source files. On the current Windows host,
externally built outputs on `D:` execute 75 Core, 68 Package, and 50 SeedHost
tests with zero failures or skips. The SeedHost result uses the retained
CLI/native pair built from exact MiniModel source revision
`8439e224146c790ce6a9da36a32c4c49890cac52`; it is local current-host evidence,
not another-RID, package-publication, deployment, or live-service evidence.
The protected NuGet path now has one first-class BCL-only
`TinyRustLM.PackageCanonicalizer` tool in the .NET solution. Both pack scripts
invoke that same executable after packing and before tests, audit, hashes, or
publication planning. It rejects signed archives, reparse targets, unsafe or
nonportable ZIP names, portable duplicates, and bounded-size violations;
rewrites only through a same-directory exclusive temporary; assigns the one
ZIP epoch timestamp; proves ordered metadata and decompressed-content
equivalence before promotion; and performs final readback. There is no shell
rewrite or compatibility canonicalizer. Package audit is a clean cut to
`tinyrustlm.nuget.package_audit.v1`; maintained publish readers reject v0.
Two complete `win-x64` package builds from source `9e60539` reproduced all
eight unsigned main/symbol package bytes exactly, and current parity source
`7cc3579` passes 67/67 package tests plus independent PowerShell/Bash v1 audits
whose normalized 939-leaf documents are equal. These local results do not
prove signing, feed transformation, public availability, or execution on any
other RID.
The sole exact cross-store Rust-backed campaign runner is documented in
`docs/architecture/vnext-campaign-runner.md`.
The fresh-runner-only immutable attestation, operator, release-manifest,
authorization, deployment/readback, and final-publication boundary is documented
in `docs/architecture/vnext-campaign-release-surface.md`. Its frozen profile
has SHA-256
`100d72ee201b395820aa11aa5b4f8f23befdbf0fffb515dda385fb826cc6fcff`.
It admits no stored projection, caller verdict, counter set, dashboard state,
or reused operation. It scans finalized attestation bytes before create-only
receipt persistence and has no operator `done` state. Release preparation
requires complete fresh campaign truth and exact current snapshot members for
all qualified artifacts, dependency closure, SBOM, package, provenance, and
approved claims. It also requires one current web build that binds the public
origin, control documents, changelog, and exact closed asset inventory; scans
all canonical public inputs and manifest bytes; and produces only a
`not-authorized` create-only candidate. Authorization independently
replays that preparation lineage from immutable runner and store bytes, then
requires exactly one current-evidence-eligible `release-authorizer` Ed25519
signature child over the exact manifest. The authorization scan receipt is
persisted before the signature receipt, and the manifest is never mutated.
Deployment admission then repeats current authorization verification and
accepts only a public-safe deployment-class receipt bound to the exact release
graph. Its scope is attempt evidence, never remote success; exact production
HTTPS readback remains mandatory. The same surface now owns that readback
operation: it reconstructs the complete deployment closure, reruns current
authorization, invokes the non-injectable production verifier, independently
revalidates its canonical result, and create-only persists the scan before one
forward `public-readback` receipt. Local tests use fixture-labeled verifier
output and do not establish a production readback. The surface now also
creates and scans deterministic publication-plan material, create-only
persists the plan lineage, requires one current-evidence-eligible
`site-publisher` Ed25519 signature, and scans every pointer, history, and
published-claim candidate without prematurely persisting them. It next admits
one attempt-only generated-deployment receipt, invokes the same non-injectable
verifier over the exact static-plus-generated closure, independently validates
the complete result, and persists the generated readback lineage. Finalization
reruns current publisher authority, rematerializes every candidate, persists
only an exact lexicographic published-claim prefix, and writes the scanned
`site-publication` commit receipt last. Interrupted prefixes are inert and
byte-identical restart resumable. Local fixture observations do not establish a
live deployment, readback, or publication.

Pure generated-publication materialization is documented in
`docs/architecture/vnext-site-publication.md`. Its frozen profile SHA-256 is
`d959ce557e8b18a71514e2388a8eda7162182e38f5febf2e1a39b063fa5ba4bc`.
It adds no top-level contract-family schema: pointer/history documents are
strict canonical generated files, while plan, signature, readback, and claim
evidence use the existing receipt, release, and claim contracts. Current
site-publisher authority and plan persistence are integrated into the sole
release surface, together with generated-deployment admission, complete
readback, restart-safe claim persistence, and final descendant admission.

The incompatible maintained-entry-point cutover is complete. The superseded
mutable runner and publication stack, their dedicated tests, rebuildable
aliases, snapshot trees, old schemas, and stale current documentation are
deleted without a compatibility path. Hash-addressed historical receipts and
clean-history blobs remain inert evidence. The Rust directory-flush primitive
is integrated through the sole receipt-backed durable-publication path.
A real production publication and external campaign evidence remain
incomplete.
This implementation status does not increment any 20/50/25/40/20 campaign counter.

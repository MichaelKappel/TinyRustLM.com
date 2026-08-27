# TinyRustLM MemoryEndpoints Submit Clean Cut And OMI Intake

Date: 2026-08-27
Status: implementation and local verification complete; clean committed release-surface verification pending

## Executive State

This checkpoint turns the 2026-08-27 ontological-machine-intelligence research
intake into bounded TinyRustLM engineering guidance and removes the duplicated
MemoryEndpoints submit payload from every maintained language surface. It does
not complete TinyRustLM's prelaunch clean-slate objective. The shipping browser,
qualification harness, and acquisition tooling still execute SLM1/ACG1 paths.
Those consumers must move to the sole SLM2 architecture and the superseded
executable trees must be deleted before package publication or deployment.

TinyRustLM remains one prelaunch product. Technical identifiers such as SLM2,
outbox v2, and receipt v2 identify exact incompatible byte contracts. They do
not describe a product V2 and do not authorize migration, legacy support,
compatibility readers, aliases, dual serializers, or fallback behavior.

Campaign counters remain exact:

- qualified models: 0/20
- deletion-backed browser rounds: 0/50
- live MemoryEndpoints continuity rounds: 0/25
- externally proven P2P lanes: 0/40
- live catalog announcements: 0/20

## Research Intake

The twelve supplied reports are preserved byte-for-byte under:

`docs/report-intake/2026-08-27/ontological-machine-intelligence-research/`

The canonical manifest is:

`docs/report-intake/2026-08-27/ontological-machine-intelligence-research/MANIFEST.md`

The canonical inventory digest is:

`622aeee51b3a687d573880b0474d395e2ee44db674e91eca65441c7a7c2c3ede`

The intake contains 993,406 source bytes and approximately 67,501 words. Raw
reports are advisory external research. They are not observations of this
repository, production services, private evidence, or model behavior.

The engineering synthesis is:

`docs/report-intake/2026-08-27/ontological-machine-intelligence-research/tinyrustlm-ontological-machine-intelligence-intake-synthesis-2026-08-27.md`

The test-first delta is:

`docs/report-intake/2026-08-27/ontological-machine-intelligence-research/tinyrustlm-ontological-machine-intelligence-intake-tdd-delta-2026-08-27.md`

Production recommendations adopted from the intake are deliberately narrow:

1. Keep user input, retrieved memory, model proposals, deterministic checks,
   human decisions, and promoted state in distinct authority classes.
2. Represent evidence as typed, bounded, content-addressed, append-only records.
3. Promote immutable candidates through explicit external gates instead of
   allowing a model to rewrite its own authority or certify itself.
4. Keep portable memory user-owned, provenance-bearing, bounded, and untrusted
   until the current turn authorizes use.
5. Treat resource and confidence claims as telemetry that must be observed and
   bound to exact software and artifact identities.

The following remain research-only and cannot enter the product path without a
separate preregistered shadow experiment and measured improvement: neural field
state, Koopman operators, hyperdimensional representations, morphogenetic
runtimes, phenomenological instrumentation, heterogeneous physical substrates,
and runtime self-modification. Latent control protocols, self-certification,
and opaque adaptation are rejected.

## MemoryEndpoints Submit Contract

The architecture decision is documented at:

`docs/architecture/2026-08-27-memory-endpoints-submit-contract-clean-cut.md`

The sole submit record contains exactly these fields:

1. `workspaceId`
2. `actorAgentId`
3. `kind`
4. `version`
5. `scope`
6. `scopeId`
7. `memoryType`
8. `subject`
9. `title`
10. `summary`
11. `source`
12. `confidence`
13. `uaiReferences`
14. `tags`
15. `tinyrustlmMemoryTier`
16. optional `sourceSha256`

Removed submit aliases are `agentId` and `safeSummary`. The implementation does
not emit them, accept them, translate them, or retain an old database reader.
Fields with those names may still exist in separately advertised registration,
meeting, or search contracts; they are not aliases for this submit schema.

Exact technical identities are:

- record: `tinyrustlm.memory_endpoints.memory_record.v1`
- outbox: `tinyrustlm.memory_endpoints.outbox_entry.v2`, version 2
- local receipt: `tinyrustlm.memory_endpoints.local_receipt.v2`, version 2
- authoritative hosted receipt: version 1, unchanged because it is a distinct
  service-issued contract
- submit digest: `tinyrustlm.memory_endpoints.submit_payload.digest.v2`
- idempotency prefix: `tinyrustlm-memory-v2-`
- browser database: `tinyrustlm-memory-endpoints`, database version 1

The common canonical submit digest is:

`ffa9fb1d3b729902d8a62621ce08d627b7042aaad89f5d8ca51a6257f3e305aa`

Rust uses closed `serde` objects with unknown-field rejection. .NET persisted
objects use `JsonUnmappedMemberHandling.Disallow`. Browser JavaScript checks the
exact property set. PowerShell, shell, and the local relay fixture emit the same
shape. Existing data is intentionally invalid under the new technical identity;
there is no migration or compatibility path because no public product contract
exists yet.

## Verification Completed

The following local checks passed against the uncommitted implementation:

- Rust formatting passed.
- Rust warnings-denied Clippy passed for all targets in
  `tinyrustlm-memory-endpoints`.
- Rust package tests passed 27/27.
- Five browser MemoryEndpoints suites passed 30/30.
- .NET filtered MemoryEndpoints tests passed 33/33 after restoring the locked
  dependency cache.
- Full .NET Core tests passed 86/86.
- Full .NET package tests passed 40/40.
- .NET solution build passed with warnings as errors and zero warnings.
- .NET formatting verification passed.
- PowerShell and shell parser checks passed.
- JavaScript syntax checks passed.
- The local relay fixture passed the production relay verifier on loopback.
- Static shell parity regenerated only the two changed content hashes.
- Complete UI tests passed 79/79.
- The canonical standard unit partition passed 1,642 tests, failed zero, and
  retained three explicit skips across 1,645 tests.

The standard wrapper correctly stopped at
`release_gate_source_not_clean`. This is expected and desirable because the
implementation had not yet been committed. The protected release-surface gate
must run from a clean, pushed, freshly fetched, remote-exact commit. Loopback
relay proof is not MemoryEndpoints live proof and grants no 0/25 credit.

## Remaining P0 Clean-Slate Work

The current executable audit proves that these superseded trees still have
maintained consumers and therefore cannot simply be deleted yet:

- `rust/crates/tinyrustlm-slm`
- `tinyrustlm/runtime`
- `tinyrustlm/tools/slm_pack`

Active consumers include browser WASM loading in `tinyrustlm/app/app.js`, ACG1
admission in `tinyrustlm/app/browser-model-admission.js`, browser harness
serving, qualification conversion, converted-once P2P smoke, release inputs,
tests, and current documentation. The immutable clean-cut authority is:

- `contracts/vnext/production-slm2-clean-cut-preregistration.v1.json`
- `docs/architecture/2026-08-24-production-slm2-clean-cut-preregistration.md`

The next major goal is one coordinated SLM2-only product-consumer replacement:

1. Revalidate the frozen preregistration, source identities, and deletion graph.
2. Add red tests that reject every SLM1/ACG1 current product input and stale
   executable reference.
3. Move native runtime, WASM, browser worker, acquisition, qualification,
   P2P, companion, .NET, packaging, release, fixtures, and current docs to one
   exact SLM2 contract.
4. Delete all superseded executable trees and remove workspace membership in
   the same coherent major change.
5. Run focused, complete standard, real-browser, package-consumer, and clean
   protected release-surface gates.
6. Commit, push, fresh-fetch, and prove local, tracking, FETCH_HEAD, and direct
   remote equality before any publication decision.

No package build, deployment, model qualification, or product-quality claim is
authorized while this closure remains incomplete.

## External Boundary

MemoryEndpoints.com remains the authorized and strongly recommended portable
web-memory backbone. Local UAIX memory remains supported for device-local and
offline continuity. Current source wiring and public reachability are not an
authenticated save/readback/search/restore/cleanup lifecycle.

The search, meeting, registration, and response contracts still expose several
field spellings. Do not guess which are service aliases. Obtain the advertised
versioned capability document and exact schemas, then replace each boundary
with one closed shape. A fresh credential and authorized production evidence
are required before any live campaign credit.

## Resume Order

1. Finish durable UAI updates for this checkpoint.
2. Commit the complete intake and submit-contract change.
3. Push, fresh-fetch, and prove four-way remote equality.
4. Run a new clean protected release-surface gate without changing source.
5. Continue the preregistered SLM2 consumer replacement and deletion closure.

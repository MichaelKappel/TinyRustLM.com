# TinyRustLM Companion Source Operation Contract Memory

Date: 2026-08-28

Status: implementation checkpoint, locally verified, not released

## Purpose

This record captures the current source-controlled Companion operation contract
after the enterprise intake review and clean-slate correction. It is the
durable implementation handoff for the browser/Companion boundary. It does not
claim that a real model has been acquired, converted, installed, opened in a
browser, qualified, shared through P2P, or deployed.

The broader research synthesis remains authoritative for report-derived
strategy:

`wiki/runtime-mirust/reports/tinyrustlm-enterprise-intake-and-production-runtime-clean-cut-memory-2026-08-28.md`

That synthesis covers 23 manifest-owned intake batches, 344 files, and
18,312,842 bytes. Research reports remain advisory. Source, test, browser,
network, deployment, and authorized production evidence remain separate.

## Clean-Slate Decision

TinyRustLM is one prelaunch product. The current implementation has one
Companion operation contract and no executable compatibility reader for the
superseded request, operation, projection, or peer-placeholder shapes.

The sole current identities are:

| Subject | Identity |
| --- | --- |
| Loopback protocol | `tinyrustlm.companion.loopback-capability/4` |
| Acquire request | `tinyrustlm.companion.acquire.v2` |
| Durable operation | `tinyrustlm.companion.operation.v3` |
| Browser projection | `tinyrustlm.companion.loopback.operation-projection.v2` |
| Execution intent | `tinyrustlm.companion.execution-intent.v1` |
| Source-acquisition intent | `tinyrustlm.companion.source-acquisition-intent.v1` |
| Source-acquisition receipt | `tinyrustlm.companion.source-acquisition-receipt.v1` |

The current route is exactly `source`. Peer candidates and peer-only progress
states were removed because there is not yet a six-member P2P importer capable
of satisfying the composition contract. A future P2P path requires its own
output-free registration and one atomic six-member import design. It must not
be represented by placeholder request fields or optimistic status text.

## Exact Source Closure

The current built-in descriptor admits one source only:

| Field | Value |
| --- | --- |
| Descriptor | `tinyrustlm.source.qwen3-0.6b-c1899de/1` |
| Model ID | `qwen3-0.6b` |
| Repository | `Qwen/Qwen3-0.6B` |
| Revision | `c1899de289a04d12100db370d81485cdf75e47ca` |
| Model source lock SHA-256 | `e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d` |
| Tokenizer source lock SHA-256 | `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70` |
| Composition profile | `tinyrustlm.qwen3-complete-composition-conversion/4` |
| Composition profile SHA-256 | `19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8` |
| Payload inventory schema | `tinyrustlm.source-payload-inventory.v1` |
| Payload inventory SHA-256 | `59e57ba08d4dc6e0914f6089f3321c073739ed60a506edd533068d8d0d2b2da9` |
| Expected payload files | 9 |
| Exact aggregate payload bytes | 1,519,207,688 |
| Initial origin | `https://huggingface.co` |
| Network profile | `tinyrustlm.source-network/1` |
| Resource policy | `tinyrustlm.companion-resource/1` |

The superseded profile hash
`c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0`
is rejected. The correction is preregistered by
`contracts/vnext/companion-source-operation-owner-profile-identity-correction-preregistration.v1.json`.
There is no translation, alias, fallback, or dual acceptance.

## Request And Operation Identity

An acquire request must contain exactly:

1. schema;
2. explicit 32-character lowercase hexadecimal attempt ID;
3. route `source`;
4. model ID;
5. source repository;
6. immutable source revision;
7. model source-lock digest;
8. tokenizer source-lock digest;
9. composition-profile digest;
10. explicit source-acquisition approval; and
11. exact maximum source bytes.

The canonical UTF-8 request bytes are hashed to derive the operation ID. An
exact lost-response replay with the same attempt ID and bytes resolves to the
same operation. A new explicit attempt ID creates a different operation. The
server does not invent an attempt ID, select an easier route, retry acquisition
under a new identity, or infer missing consent.

The current cross-language vector is
`contracts/vnext/companion-loopback-capability-vectors.v2.json`:

| Vector value | Identity |
| --- | --- |
| Canonical request bytes | 573 bytes |
| Request SHA-256 and operation ID | `7179ca79abd48d2e22a406301b66328b2163e9f6392786f097ef0d4ee61a26a1` |
| Canonical projection bytes | 1,557 bytes |
| Projection SHA-256 | `086908111089a0236a539b80f0e3eff127b7028094ecc75da388b8ad95415092` |
| Available composition bytes | 605,377,909 |

The v1 vector remains immutable historical evidence but is absent from current
managed test output and is not an accepted runtime contract.

## Private Evidence Chain

The journal has a create-only private evidence chain:

```text
canonical acquire request
  -> request SHA-256 / operation ID
  -> execution intent
  -> execution-intent SHA-256
  -> source-acquisition intent
  -> source-acquisition-intent SHA-256
  -> independently reverified source-acquisition receipt
  -> conversion request and terminal evidence
  -> exact six-member available projection
```

The execution intent binds the operation, request, explicit attempt, installed
worker digest, installed converter digest, source descriptor, logical source
cache identity, three custody roots, network profile, and resource policy.

The source-acquisition intent binds the same operation and request to the
execution-intent digest, exact source identity, source byte ceiling, five
custody roots, initial origin, redirect bound, one MiB streaming buffer,
canonical payload-inventory schema, and expected payload-inventory digest.

The source-acquisition receipt binds both earlier evidence digests and records
the same independently recomputable exact inventory digest, nine-file count,
1,519,207,688-byte aggregate, and activated model/tokenizer source roots. The
inventory canonicalizes the source lock's nine direct files by ordinal path as
UTF-8 JSON with fixed `path`, `byteLength`, and `sha256` fields plus one final
LF. Tests derive the expected identity directly from the pinned lock, prove
input-order invariance, and reject schema or digest drift in both intent and
receipt. A merely well-formed arbitrary digest is not accepted.

These documents are canonical UTF-8 JSON with one final LF, a 65,536-byte
ceiling, duplicate-key rejection, unknown-field rejection through canonical
round-trip equality, create-only persistence, and SHA-256 identity. Private
paths remain private and must not enter browser projections, public reports,
logs, or marketing.

## Custody And Path Invariants

Every evidence path must be fully qualified, normalized, bounded, and have no
NUL. Within one intent or receipt, roots must be pairwise nonoverlapping. The
validator rejects equality and either ancestor/descendant direction, using
case-insensitive comparison on Windows and ordinal comparison elsewhere.

An owned journal root is accepted only when its direct `operations` directory
already exists and its direct, non-reparse marker has exact bytes. Root creation
materializes the operations directory before writing the marker, making the
marker the final admission point. A marker-only interrupted root is rejected;
the constructor never completes it implicitly.

This is a lexical admission check, not a complete filesystem trust proof. A
real source owner must additionally establish owned roots, direct regular
files, reparse/symlink rejection, stable handles, streamed hashing, exclusive
writers, atomic same-parent activation, and crash-safe retention before a live
acquisition can pass.

## Operation State Machine

The sole current public projection states are:

```text
queued
  -> acquiring-source
  -> converting
  -> verifying-composition
  -> available

any nonterminal state -> cancelled
any nonterminal state -> rejected
```

Every projection carries a monotonic sequence, route `source`, bounded
phase-completed bytes, optional bounded phase-total bytes, and either an exact
six-member artifact set or a typed error according to terminal state.

Create-only history is the journal authority. `current.json` is a checked
mutable cache and may lag history by exactly the interrupted replacement
boundary. Every read validates the complete bounded sequence-0-through-latest
history, canonical timestamps, operation/request identity, legal transitions,
and monotonic evidence binding. A valid one-record-ahead history is returned as
authoritative after process loss. Before another mutation can append history,
it repairs that one-record derived-cache lag while holding both exclusion
layers; therefore a second interruption can leave at most one new record ahead.
Gaps, larger lags, extra records, pointer content outside history, rollback,
and contradictory transitions reject.

`available` requires all six composition roles and no error. `cancelled` and
`rejected` require no artifacts. Nonterminal records cannot expose artifacts
or errors. Terminal records are immutable. Cancellation is a create-only intent
bound to the existing operation; it does not launch a second operation or
rewrite a terminal result.

In-process mutation gates are exact-key, reference-counted leases. The final
lease removes its gate entry, so operation cardinality cannot become a
process-lifetime lock-table leak. The operation's create-only `operation.lock`
file remains the cross-process exclusion boundary. A regression exercises 128
distinct operation identities and requires the in-process registry to return
to zero after every terminal mutation.

## Six-Member Artifact Boundary

The artifact transfer service admits only an independently reinspected
available operation with exactly these roles:

1. `model`;
2. `tokenizer`;
3. `template`;
4. `sampling`;
5. `prompt`; and
6. `composition`.

It serves fixed 4,194,304-byte chunks, never exposes a private path, verifies
artifact identity and bounds before each read, and performs a final whole-file
rehash after the last chunk. A changed file, role, size, digest, operation, or
terminal evidence is rejected rather than repaired.

Every artifact ID is exactly `sha256:<artifact SHA-256>`. The managed contract,
managed response metadata, browser projection, browser response metadata, and
cross-language vector all enforce this relation at admission rather than
waiting for transfer to discover a mismatch.

## Browser And Listener Truth

The browser codec and managed codec now agree on protocol `/4`, request v2,
operation v3, projection v2, exact source-only fields, progress names, terminal
rules, and cryptographic vectors. Each validator independently admits only the
same exact Qwen3 model ID, repository, immutable revision, model and tokenizer
source-lock hashes, composition-profile hash, and payload-byte ceiling. The
browser cannot widen managed source authority by submitting a syntactically
valid alternate source.

This is not yet a user-visible acquisition feature:

- the browser client is source-controlled but is not loaded by the product UI;
- the strict listener still returns typed `operation-not-available` for create,
  status, cancel, and artifact routes;
- no production `ICompanionOperationExecutor` exists;
- no source-network owner or installed worker exists;
- no real converter process is launched by this path;
- no source cache or operation root has been materialized for a live run; and
- no model has been installed or activated through this path.

Keeping the routes closed is the truthful behavior. A fake queued state, test
executor, deterministic fixture, or UI animation cannot substitute for the
missing operation owner.

## Verification At This Checkpoint

The affected local verification completed on 2026-08-28:

| Gate | Result |
| --- | --- |
| Managed Release build and format gate | pass, warnings as errors, 0 warnings, 0 errors, no format drift |
| Complete managed solution | 252 passed, 0 failed, 0 skipped |
| Companion tests | 125 passed, 0 failed, 0 skipped |
| Core tests | 86 passed, 0 failed, 0 skipped |
| Package-boundary tests | 41 passed, 0 failed, 0 skipped |
| Current browser/vector focused tests | 19 passed, 0 failed, 0 skipped |
| Complete standard Node partition | 1,702 passed, 0 failed, 3 declared skips, 1,705 total |
| Diff hygiene | pass |

The standard Node partition includes the local web release closure and genuine
Chromium smoke that are part of that test partition. These results prove the
source-controlled contracts and test boundaries only. They do not prove a real
source download, conversion, browser model load, conversation, deployment, or
authorized external service.

## Next Required Clean Cut

The next implementation phase is not UI activation. It is one real,
restart-safe, exclusive operation owner under the preregistered source closure:

1. implement strict embedded source-lock materialization;
2. implement bounded manual-redirect source streaming with public-address
   enforcement and no credentials;
3. implement exclusive worker ownership, create-only intents, and restart
   reconciliation;
4. contain exactly one converter process tree and bind its installed digest;
5. independently inspect terminal conversion evidence and the six members;
6. wire listener operation routes only after the real executor gate is green;
7. load the sole browser client and delete the superseded Companion bridge and
   one-file acquisition controller in the same coherent change;
8. run a separately registered real source operation; and
9. proceed to scalar-native, WASM, quality, browser, P2P, release, and live
   service evidence only through their own gates.

## Claim And Campaign Boundary

Allowed claim: the source-only cross-language Companion operation and private
evidence contracts are implemented and locally tested.

Prohibited claims include working acquisition, successful source download,
successful conversion, installed model, browser inference, useful assistant,
P2P availability, publication, deployment, live MemoryEndpoints continuity,
or campaign progress.

Campaign counters remain exactly:

- qualified models: 0/20;
- deletion-backed browser rounds: 0/50;
- authorized live memory rounds: 0/25;
- current outside-network lane proofs: 0/40; and
- live catalog announcements: 0/20.

MemoryEndpoints.com remains authorized and strongly recommended for portable
cross-device continuity. Authorization, configuration, or reachability is not
an authenticated lifecycle receipt and does not change 0/25.

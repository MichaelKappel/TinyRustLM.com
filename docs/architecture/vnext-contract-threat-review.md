# TinyRustLM vNext Contract Boundary Threat Review

## Decision

**Review result: PASS for the Phase 2 schema-and-local-invariant boundary only.**

This decision means the frozen registry, two validator implementations, and
the deterministic hostile corpus form a coherent clean-slate validation
checkpoint. It does not authorize a production cutover, a signed evidence
claim, a release, a model qualification, a browser campaign round, a live
MemoryEndpoints continuity result, an outside-network P2P proof, or a catalog
announcement.

### Current Phase 3 Addendum

The Phase 2 decision above remains immutable for its bound scope. Later Phase
3 checkpoints now independently implement RFC 8785/JCS identity, receipt DAG
parent loading and semantic currentness, Ed25519 verification, the trusted
authority graph, offline-bundle closure, bounded secret/redaction scanning,
truthful campaign projection, and projection-result validation in Node and
Rust as documented by the current architecture inventory.

One generated `tinyrustlm.vnext.campaign-evidence-wasm.v1` boundary now exposes
exact plan finalization, currentness, projection, and result validation from
Rust to Node and browser/WASM callers. Its JavaScript is byte transport and
stage sequencing only. The zero-import module has exact frozen exports, bounded
allocation ownership, destructive stage behavior, frozen-corpus parity, and
two independently created and physically deleted Chromium-profile checks with
zero network requests. The superseded plan-only ABI is deleted.

These later local facts close the named cross-runtime implementation gaps only.
They do not close archive-member scanning, protected production secret-list
custody, the production campaign runner and entry-point cutover, final
attestation and release integration, authorized live MemoryEndpoints
continuity, independent outside-network lane proofs, catalog publication, or
public HTTPS readback. No local test changes a campaign counter.

Reviewed at `2026-08-09T07:00:00Z`. The review is invalidated when any bound
file changes, when the parser changes, or when a deferred proof obligation is
reclassified without a new threat review.

## Bound Inputs

| Role | Path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Frozen registry | `contracts/vnext/contract-family.v1.json` | 37,289 | `812e3ace7526d867561f50bdbf24acc047773583391f85be9e0f3e4cbfe0366a` |
| Language-neutral corpus | `contracts/vnext/contract-corpus.v1.json` | 124,485 | `5dd338f94a9888bafd78ac829b655f5cc3ee7e1af1d30de3488970a888fdc89e` |
| Registry interpreter | `tinyrustlm/tools/vnext-contract-validator-registry.js` | 29,900 | `d60d9b86be75e9cb17b81b043baabf19d74de80dadb23241d733bec6261ceabc` |
| Independent validator | `tinyrustlm/tools/vnext-contract-validator-independent.js` | 41,773 | `d30bf36ee8c07a5f17be962227160adb84876ca04c058647d16b7dfe8a4d123d` |
| Corpus generator | `tinyrustlm/tools/vnext-contract-corpus-generator.js` | 20,504 | `5ed85cd9ae53845a032b96b626d1d681f6d3e2a0f99cc80584a59fd7947fc415` |
| Differential tests | `tinyrustlm/tests/vnext-contract-validator-conformance.test.js` | 10,585 | `f67578bac0f28bd0a00b6103d948a957f0f612fe39fb4f5cf96dd1fac1e79edc` |

Validator identities are
`tinyrustlm.vnext.registry-schema-validator.v1` and
`tinyrustlm.vnext.independent-schema-validator.v1`. The corpus binds the
registry and normalized generator source hashes. It contains 70 exact raw-byte
cases: 14 accept cases and 56 reject cases. Both validators execute every case,
for 140 differential verdicts.

The current clean-slate registry family is
`tinyrustlm-vnext-2026-08-09-r3`. Before any authorized production record, it
replaces the prior checkpoint and raises only two receipt cardinalities needed
for complete offline campaign closure: `inputReceiptIds` from 256 to 2,048 and
`offlineBundle.signatureEnvelopeReceiptIds` from 256 to 1,024. The independent
validator carries the same limits, the generated hostile corpus is rebound to
the new registry bytes, and the complete synthetic campaign test verifies 271
receipt parents and 155 target signatures. The product retains no reader for
the replaced registry.

The first proof schema was replaced before production because it embedded a
signature-envelope ID while that envelope signed the proof ID. Those two
content-addressed objects formed an unresolvable cycle. The sole accepted proof
schema is now `tinyrustlm.vnext.outside_proof.v2`; it contains no signature
pointer, and a separately verified signature receipt becomes its descendant.
The old schema is rejected rather than aliased or migrated.

## Security Objective

Before semantic or cryptographic promotion, an untrusted vNext JSON input must
be accepted only when all of these conditions hold:

1. The raw input is valid bounded UTF-8 JSON under `tinyrustlm.strict-json.v1`.
2. Its top-level schema is one of the nine exact frozen vNext identifiers.
3. Every object has exactly its required fields and no unknown fields.
4. Every primitive, enum, cardinality, ordering rule, URL, path, and byte limit
   is valid.
5. Every local semantic invariant applicable to that record is satisfied.
6. The registry interpreter reports every declared invariant as checked, not
   applicable, or deferred, with no overlap and no omitted invariant.
7. Validation never repairs, coerces, defaults, upgrades, downgrades, aliases,
   retries, or rewrites the candidate input.

This checkpoint treats parsed values as untrusted even after schema acceptance.
An accepted value is not trustworthy evidence until its deferred identity,
signature, authority, DAG, redaction, and external-observation obligations are
verified by later phases.

## Trust Boundaries

| Boundary | Untrusted input | Phase 2 authority | Remaining authority |
| --- | --- | --- | --- |
| Raw bytes to JSON | Files, browser messages, loopback bodies, peer metadata, service replies | Bounded fatal UTF-8 and duplicate-aware strict parser | Rust and browser parity plus entry-point cutover |
| JSON to exact contract | Parsed object and claimed schema | Closed registry interpreter and separately written validator | Cross-language validator parity |
| Contract to local semantics | Structurally valid record | Per-class local invariant checks | Cross-record and external-state verification |
| Content to identity | Claimed hash and content ID | Field shape and declared derivation profile | RFC 8785 JCS and domain-separated hash recomputation |
| Signature to authority | Envelope, key, role, time, registry, revocation | Local shape, role/domain, and time-window checks | Ed25519 verification and trusted registry chain |
| Receipt to evidence DAG | Parent IDs and evidence references | Local sorting, uniqueness, state, and typed payload checks | Parent loading, closure, cycle, role, and freshness checks |
| Private to public evidence | Public-safe record and redaction profile | Closed public schema and forbidden value classes | The later Node checkpoint performs exact scan and receipt replay; Rust/browser parity, protected-list release integration, and bounded archive-member scanning remain |
| Local P2P to public claim | Manifest, lane proof, claim wording | Local identity, route, transfer, state, and expiry checks | Outside observer signature, full transfer, and publication authority |

## Threat Analysis

| Threat | Control in this checkpoint | Result | Residual risk or later gate |
| --- | --- | --- | --- |
| Duplicate-key ambiguity | Strict parser rejects literal, escaped-equivalent, and supplementary-equivalent duplicates before object creation | Mitigated locally | Every production entry point must use the same parser profile |
| Malformed or disguised text | Fatal UTF-8, BOM rejection, scalar checks, bounded text and string rules | Mitigated locally | Rust/browser parity was outside this Phase 2 checkpoint; the current addendum records later bounded parity |
| Parser exhaustion | Byte, depth, entry, member, array, string, aggregate-string, and number-character limits | Mitigated locally | Wall-clock and allocation ceilings require measured native/browser tests |
| Numeric identity drift | Unsafe integers, negative zero, overflow, underflow, and floats are rejected where unsupported | Mitigated locally | Cross-language RFC 8785 serialization remains deferred |
| Schema confusion or downgrade | Only the nine exact registry-listed schemas are accepted, including proof v2 and no proof v1 alias | Mitigated locally | Production cutover and deletion of superseded entry points remain deferred |
| Proof/signature identity cycle | Proof v2 has no envelope-ID field; the signature receipt points one way to the finalized proof | Mitigated by incompatible replacement | Signature-descendant existence and authority remain deferred |
| Unknown-field smuggling | Root and every nested object are closed; property tests inject unknown fields at every reachable object depth | Mitigated locally | New fields require a new frozen registry and review |
| Missing-field defaulting | Every declared field is required; property tests delete every root field | Mitigated locally | Nested required-field deletion is covered by exact descriptors and corpus examples, not exhaustive combinatorics |
| Validator common-mode error | One implementation interprets the registry; the other hard-codes separately written schema logic and cannot read the registry | Reduced | Both use the same strict parser and JavaScript runtime, so parser/runtime common-mode risk remains |
| Easy-corpus selection | Corpus is deterministic, checked in, and content-bound to registry and generator hashes | Mitigated for the checkpoint | Independent sealed audit cases remain required for promotion claims |
| Conditional-invariant inflation | Results partition invariants into checked, not applicable, and deferred sets | Mitigated locally | Callers must reject any use that requires a deferred invariant |
| Artifact/profile substitution | Artifact class must match the frozen SLM, specialist, template, or tokenizer profile | Mitigated locally | Complete artifact hashing and dependency existence remain later concerns |
| Receipt subtype confusion | Exactly one typed security payload may appear and it must match `receiptType`; security receipts require pass status | Mitigated locally | Signature, registry, revocation, and offline closure remain deferred |
| Context authority injection | Exactly one current authoritative user segment and one authoritative product-policy segment are required; memory, quotes, retrieval, summaries, and tool output cannot be authoritative | Mitigated locally | Model behavior under compiled context requires runtime evaluation |
| Worker or companion state confusion | Direction, operation, payload binding, pairing, session, sequence, and capability constraints are explicit | Mitigated locally | Replay store, process isolation, browser origin, and loopback authentication remain later gates |
| P2P piece or Merkle drift | Piece indices, offsets, sizes, hashes, Merkle root, total bytes, and artifact identity are recomputed locally | Mitigated locally | File streaming, peer transfer, and final Rust artifact verification remain later gates |
| Local reachability promoted as public | Proof requires outside-network scope, complete transfer, lane and endpoint binding, and bounded freshness | Mitigated structurally | Observer signature, independence, and matching P2P parent remain deferred |
| Release or claim inflation | Release and claim states bind evidence, source, owner, route, component, dates, blockers, and publication state | Mitigated locally | Parent receipt closure, authorization signature, public readback, and wording secret scan remain deferred |
| Secret disclosure through public evidence | Private-by-default classes, public-safe field types, redaction profile, forbidden keys/value classes, and acyclic scan binding | Reduced | The later Node checkpoint scans seven bounded known-secret encoding families and verifies scan receipts; compressed members, cross-runtime parity, and production custody remain deferred |
| Compatibility code becoming permanent | Validators recognize one incompatible family and contain no fallback, migration, deprecated alias, dual-read, or dual-write path | Mitigated in the new boundary | Old production readers and writers still exist elsewhere and must be deleted after verified cutover |

## Validator Independence

The registry validator loads the frozen registry and applies a generic closed
descriptor interpreter followed by class-specific local invariants. The
independent validator does not import the registry validator, read the registry
file, or use filesystem access. It carries separately written exact schemas and
local rules. They share only `strict-json.js`, Node primitives, and test input.

This is sufficient to detect many registry-interpreter and hand-coded-schema
mistakes. It is not implementation diversity across languages or runtimes. A
defect in the shared parser, JavaScript semantics, corpus generator, or expected
verdict selection could affect both. Phase 3 must add canonical identity and
receipt verification; later runtime phases must add Rust and browser/WASM
conformance against the same raw corpus.

## Corpus Coverage

The checked-in corpus covers all nine accepted contract classes and parser-only
rejections. It includes valid artifact, receipt security subtypes, context,
worker, companion, P2P, proof, release, and claim records. Hostile cases cover
unknown and missing fields, the rejected cyclic proof signature field, dated
or unknown schemas, duplicate keys, malformed
UTF-8, BOMs, unsafe numbers, trailing content, excessive nesting, semantic
state drift, invalid routes and URLs, authority mistakes, worker/companion
state mistakes, P2P piece and Merkle drift, proof expiry, and release/claim
inflation.

Property checks reverse arbitrary object-key order, delete every root required
field, and inject an unknown field at every reachable object depth. Corpus
acceptance is not evidence that cryptographic material is genuine, a referenced
parent exists, a network observer is independent, a model is useful, or a site
was published.

## Deferred Proof Obligations

The following are explicitly outside the Phase 2 pass:

- Full RFC 8785/JCS cross-language vectors and canonical-byte agreement.
- Domain-separated identity and canonical-content hash recomputation at every
  signed or content-addressed entry point.
- Ed25519 verification, trusted key registry selection, role/campaign scope,
  authority-registry chain validation, revocation chain validation, and
  historical-time evaluation.
- Receipt DAG parent loading, cycle rejection, complete closure, parent-role
  constraints, phase invalidation, freshness, and offline-bundle closure.
- Execution of bounded secret/redaction scanning, encoded and compressed form
  checks, and verification of the acyclic scan receipt.
- Streaming validation of actual large artifacts, P2P transfers, and final
  artifact reconstruction.
- Rust, browser/WASM, worker, service worker, and companion implementations of
  the frozen contracts.
- Removal of every superseded parser and dated schema from shipping entry
  points after the incompatible cutover.
- Real model qualification, live browser deletion receipts, authorized live
  MemoryEndpoints continuity, independent outside-network lane proofs, catalog
  announcements, package publication, and public HTTPS release readback.

Any caller needing one of these properties must fail closed until the specific
later-phase verifier returns objective evidence. A deferred invariant is never
a warning-level pass.

Later Phase 3 work now includes canonical identity finalization, public-key
Ed25519 payload verification, a bounded trusted authority graph, exact
offline-bundle membership and receipt-parent closure, bounded public-safe
redaction, independent Rust parity, and the generated browser/WASM campaign
evidence boundary summarized above. The redaction boundary validates finalized
bytes, rejects private schemas, scans seven bounded known-secret encoding
families and contextual forbidden values, emits no secret values, and replays
a one-way scan receipt against the protected equality list. The offline profile
binds current schema/profile hashes, including the redaction profile, a
separate acyclic verification receipt, external
root/terminal/campaign/environment/hash pins, current target signatures, and
all supplied receipt and subject bytes without network access. That work is
outside this Phase 2 PASS. It does not close compressed archive-member
scanning, production entry-point cutover, independent observer operation, or
any campaign gate.

## No-Compatibility Decision

The new validator boundary has no old schema aliases, migration adapters,
best-effort field mapping, permissive version range, dual readers, dual
writers, repair path, or fallback parser. Unknown and dated schemas fail.
Superseded production paths are not retained for user compatibility because
the product is pre-public dogfood. They may remain temporarily outside this
boundary only until the replacement is integrated, tested, and then deleted.
That temporary repository fact is not permission to connect old and new
contracts.

## Verification Evidence

At review time:

- `node --test tests/vnext-contract-registry.test.js tests/vnext-contract-validator-conformance.test.js`
  passed 13, failed 0, skipped 0.
- The current complete `npm run test:unit` run passed 750, failed 0, skipped 0,
  in 71.531 seconds, including real Chromium fault, local web-release smoke,
  signing-authority, and closed offline-bundle scenarios.
- The current ten-file contract, store, signing-authority, and offline-bundle
  set passed 82, failed 0, skipped 0. The offline subset covers canonical
  materialization, exact membership, external pins, complete receipt closure,
  profile and schema drift, stale targets, governance succession, revocation,
  interrupted bytes, hostile accessors, and finite resource limits.
- Both validators produced the expected verdict for all 70 corpus records.
- The test suite verifies source independence, corpus regeneration identity,
  the registry interpreter's three-way invariant partition, object-key order
  independence, required root fields, and nested unknown-field rejection.

The full run includes the final invariant-report classification, threat review,
and all focused contract tests. The later cross-language and browser boundaries
are documented in the current addendum, but no test result substitutes for
production entry-point cutover, independent operation, or campaign evidence.

## Exit Decision

Phase 2 closed after the bound hashes, this review, focused tests, complete unit
suite, source hygiene, secret scan, and remote push were current in one
checkpoint. The current next boundary is production campaign-runner integration
over bounded canonical receipt and subject stores, followed by final
attestation, release authorization, operator rendering, documentation, and
public-readback integration. Windows directory durability, archive-member
scanning, and protected-list release custody remain separate prerequisites for
their corresponding claims.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

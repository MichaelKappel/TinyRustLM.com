# TinyRustLM vNext Contract Inventory

## Status

This is the authoritative Phase 2 inventory captured on 2026-08-09. It
separates observed current implementation from the incompatible vNext contract
family. It does not promote vNext runtime support.

## Measured Current Surface

The inventory command scanned only executable source under `tinyrustlm/tools`
and `tinyrustlm/app`. It excluded documentation, tests, generated output,
`node_modules`, and `target`.

- 109 source files contain at least one string matching
  `tinyrustlm.<name>.v<number>`.
- 215 distinct matching schema identifiers were found.
- The sorted identifiers, joined with one LF after every identifier, occupy
  9,919 UTF-8 bytes and have SHA-256
  `581eee525ee30f195f0a21cd71db8d60ff275866d51cb2d236df74f638bd6d10`.
- 77 app/tool files contain 166 `JSON.parse` call sites. This count is an audit
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

## Current Boundary Findings

| Class | Observed current implementation | Material gap | vNext disposition |
| --- | --- | --- | --- |
| Artifact | SLM1 parsing, ACG1 composition, model manifests, adapter sidecars, and content-identity experiments are implemented in separate Rust, Node, and browser paths. | No single SLM2 metadata/key registry, artifact-class registry, limits table, or independently packed conformance corpus exists. | Regenerate reviewed sources into SLM2 and one immutable external artifact manifest. Delete SLM1 production admission after the SLM2 gate. |
| Receipt | `CampaignEvidenceStore` provides closed fields, content addressing, redaction, immutable files, DAG rebuild, and quarantine; many task-specific receipt types wrap it. | Current receipt identity/canonicalization and nested parameter shapes are not the complete ADR-010 vNext profile. | Replace all campaign phase evidence with one envelope/content receipt contract plus typed `receiptType` and phase semantics. |
| Context | Conversation, prompt-token, memory, retrieval, KV, and local-store contracts are split across browser and tooling schemas. | Trust labels, current-turn precedence, deterministic truncation, cache identity, and public/private handling are not one closed context package. | Use one private, volatile context package with explicit segment trust, budget, compiler, model/composition, tokenizer, and template identities. |
| Worker | Browser generation and fault tests use several ad hoc `postMessage` shapes; there is no single production worker envelope. | Message/session/generation identity, cancellation, stale-response rejection, deadlines, transfer ownership, and payload privacy are not frozen together. | Use one small private worker envelope; transfer large/private payload bytes separately and bind them by byte count and SHA-256. |
| Companion | Browser protocol v2 and the .NET SeedHost implement a closed loopback route family with scoped sessions and streaming. | Operation bodies, durable status, error vocabulary, and source/model/composition identity still span several schemas and language-specific validators. | Keep the accepted transport profile but replace its JSON bodies with one vNext request/response envelope and closed operation payload registry. |
| P2P | Rust peer offers, browser MiniModel announcement validation, local share evidence, and catalog tooling exist. | Piece, artifact, composition, qualification, license, endpoint, and lane identities are not one vNext publication graph. | Use one complete piece manifest with canonical 4 MiB pieces and exact artifact/composition/qualification parents. Model bytes remain direct peer traffic. |
| Proof | `tinyrustlm.p2p-outside-proof-v1` distinguishes complete outside transfer from local health and expires evidence. | The complete ADR-010 observer registry, role separation, revocation, offline bundle, and vNext signed payload are not implemented. | Use one expiring outside-observer proof content contract plus a separate role-bound signature envelope. |
| Release | Campaign release evidence, final attestation, Ed25519 authorization, web deployment manifests, and `uaix.site_release.v1` exist as distinct contracts. | There is no single vNext release closure binding campaign, packages, sites, SBOM, provenance, claims, authorization, and HTTPS readback. | Use one immutable release manifest whose parents must already pass; publication creates descendants and never mutates the release. |
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
| Proof | `tinyrustlm.vnext.outside_proof.v1` | Independent observer and offline verifier | Public-safe signed evidence | 262,144 |
| Release | `tinyrustlm.vnext.release_manifest.v1` | Release builder, authorizer, deploy/readback verifiers | Public-safe immutable release closure | 524,288 |
| Claim | `tinyrustlm.vnext.claim.v1` | Claim registry, product UI, docs, catalog, marketing | Public-safe evidence-bound wording | 262,144 |

All nine control-plane encodings use the strict vNext canonical JSON profile.
SLM2's internal fixed envelope and SLM-DCBOR-1 metadata remain governed by
ADR-001 and are referenced by the artifact manifest rather than re-encoded as
JSON model metadata.

## Cross-Boundary Identity

- SHA-256 is the sole mandatory ecosystem identity hash.
- Content IDs are `sha256:` followed by 64 lowercase hexadecimal characters.
- Receipt, proof, release, and claim identities use distinct domain-separated
  canonical-content hashes; a valid hash never changes evidence class.
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

## Phase 2 Follow-On

The next artifacts must freeze, in order:

1. common primitive, timestamp, identifier, URL, array, depth, and count limits;
2. exact required fields and nested records for all nine schemas;
3. reject-all unknown-field behavior at every object depth;
4. private-by-default classification and the public-safe redaction profile;
5. one language-neutral valid/hostile corpus;
6. two validators with independent schema logic;
7. a threat review and repository proof that no vNext validator imports,
   aliases, or falls back to a dated schema.

This inventory closes discovery only. It does not satisfy those follow-on
gates and does not increment any 20/50/25/40/20 campaign counter.

# vNext Signature Authority Verification

## Scope

`tinyrustlm/tools/vnext-signature-authority.js` is the Node reference boundary
for reconstructing trusted vNext authority from canonical receipt and subject
bytes. It does not discover trust over the network and does not accept a public
key merely because a receipt embeds it.

`rust/crates/tinyrustlm-evidence` now independently implements both the exact
canonical-payload Ed25519 primitive and this complete bounded authority graph.
Its frozen public-only vectors prove primitive and graph byte, hash, result,
and rejection-code parity, including registry succession, revocation,
compromise, replay, subject linkage, and temporal currentness. See
`docs/architecture/vnext-rust-signature-primitive-parity.md` and
`docs/architecture/vnext-rust-authority-graph-parity.md`.

## Inputs

`verifyVnextAuthorityGraph` accepts one closed data-only object:

- `receiptBytes`: bounded canonical `tinyrustlm.vnext.receipt.v1` byte arrays;
- `subjectBytes`: bounded canonical non-receipt identity documents;
- `campaignId` and `environment`: exact expected scope;
- `verificationTimeUtc`: the caller's explicit verification instant;
- `trustedRootRegistryReceiptId`: an out-of-band trust pin;
- `expectedTerminalRegistryReceiptId`: an out-of-band expected-latest pin.

Unknown fields, accessors, symbols, sparse arrays, excessive counts or bytes,
duplicate identities, cross-campaign records, and receipt subjects placed in
the non-receipt collection fail before graph evaluation. The verifier performs
no network request, repair, migration, alias lookup, or key generation.

## Registry Chain

The root must exist in the supplied receipts, match the caller's trust pin,
have no predecessor, and match the requested environment. The terminal must
exist and trace through one bounded predecessor chain to that root. Forks,
cycles, missing predecessors, unlinked registries, non-increasing effective
times, validity gaps, and excessive clock skew fail closed.

Every successor registry requires exactly one signature-envelope receipt whose
subject is that successor, scope is `authority-registry`, role is
`release-authorizer`, and authority registry is the predecessor. The signature
must be issued no later than the successor effective time by an active
predecessor key within both key and registry windows.

Existing key IDs retain signer, role, public key, valid-from time, and any
already finite valid-until time. Status can move only from active to active,
retired, or revoked; retired to retired or revoked; and revoked to revoked.
New keys enter as active. Removed keys, substituted material, validity
extension, and status rollback fail.

## Revocation

A newly revoked key requires exactly one immutable key-revocation receipt
bound to its predecessor and successor registries and effective exactly at the
successor time. The revoked key remains present with identical material and
revoked status. A named replacement must exist, be active, and have the same
role. Exactly one predecessor-authorized `key-revocation` signature receipt is
required.

Compromise at or before signature issue makes `authorityAtIssue` false.
Compromise after issue preserves historical cryptographic verification but
makes current evidence stale. Unknown compromise time also makes dependent
evidence stale. Revocation never deletes or rewrites historical receipts.

## Signature Binding

Each signature receipt must bind its authority registry in `inputReceiptIds`.
A receipt subject must also appear in `inputReceiptIds`; a non-receipt subject
must appear as `signed-subject-canonical-content` in `inputHashes`. Signature
issue time must be contained by the signature receipt's start/completion
interval.

The verifier resolves the exact subject ID and schema, enforces signer/key/role
agreement, verifies the domain-separated Ed25519 payload, and rejects reuse of
the campaign/key/nonce/role/scope/signer replay tuple across distinct envelope
receipts. Non-governance signatures must use the registry current at issue.
Outside-proof signatures additionally bind observer, registry, campaign,
nonce, issue time, and expiry exactly to `tinyrustlm.vnext.outside_proof.v2`.

## Release Authorization Integration

`tinyrustlm/tools/vnext-campaign-release-surface.js` now composes this graph
verifier into the release-authorization gate. The surface first reconstructs
the exact prepared `release_manifest.v2`, original runner operation, Rust-backed
projection, release parents, and preparation scan receipts from create-only
storage. It then admits one canonical signature-envelope receipt only when all
of these release-specific bindings hold:

- role `release-authorizer`;
- domain `tinyrustlm.signature.release-authorizer.v1`;
- scope `release-authorization`;
- signed schema `tinyrustlm.vnext.release_manifest.v2`;
- signed subject ID and release ID equal the prepared manifest ID;
- `signed-subject-canonical-content` equals the manifest canonical-content
  hash;
- the envelope has a finite lifetime and is current at the caller-supplied
  trusted verification time; and
- the receipt binds exactly its authority registry and no caller-supplied
  authorization verdict.

The full graph must contain exactly one matching release signature. Its
`signatureVerified`, `authorityAtIssue`, `temporalCurrent`, and
`currentEvidenceEligible` fields must all be true, its stale-reason list must
be empty, and the expected terminal registry must remain current. The release
surface scans the authorization receipt before create-only persistence and
returns only `release-authorized-awaiting-deployment`. It does not mutate the
prepared manifest or infer deployment, HTTPS readback, publication, or live
campaign completion from the signature.

## Result Meaning

Each signature result reports:

- `signatureVerified`: exact Ed25519 verification succeeded;
- `authorityAtIssue`: revocation/compromise history permits authority at issue;
- `temporalCurrent`: envelope and terminal registry are current at the supplied
  verification time;
- `currentEvidenceEligible`: every authority and freshness condition is true;
- `staleReasons`: deterministic bounded reason codes when current admission is
  false.

`authorityGraphVerified` is not a campaign `passed` field. It says the supplied
bounded graph was reconstructed and processed under this verifier. Promotion
logic must require the relevant signature's `currentEvidenceEligible` value
and every separate evidence-class, quality, privacy, release, and external
gate.

## Remaining Boundaries

This authority function intentionally accepts a bounded graph rather than
deciding whether a transport bundle is exact. The paired
Node and Rust offline-bundle boundaries now independently enforce exact
manifest membership, receipt-parent closure, linked-subject checks, and
target-current admission before returning the same canonical offline result.
The Rust implementation and frozen cross-language rejection corpus are
documented in `vnext-rust-offline-bundle-parity.md`.

The separate Rust truthful-projection boundary now composes this authority
result with exact plans, semantic currentness, and objective matching; see
`vnext-rust-campaign-projection-parity.md`. The generated browser boundary now
replays that Rust behavior as bounded byte transport; see
`vnext-campaign-evidence-wasm-boundary.md`. The combined checkpoint still does
not prove actual observer independence, production key custody, completeness
of the production protected-secret inventory, authenticity of caller-supplied
trusted time, deployment/readback, production entry-point cutover, or campaign
completion. The release surface enforces local deterministic release and
authorization scans against the supplied protected list; that is not evidence
that production custody supplied every secret that must be protected.
Rust graph, offline-bundle,
projection, and browser-transport parity do not narrow those non-claims. No
model, browser, MemoryEndpoints, P2P, catalog, package, site, or release counter
changes from these tests.

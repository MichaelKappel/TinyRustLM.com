# P2P Share Flow

`TinyRustLM.P2P` is the public managed boundary over the canonical Rust
fixed-piece transport. It handles already-qualified SLM2 model artifacts and
complete ACG2 compositions. It does not discover peers, publish catalog
announcements, sign manifests, fetch network content, convert models, or judge
model quality.

TinyRustLM is one prelaunch product. This is the only current P2P SDK surface;
there is no earlier manifest, announcement, receipt, or compatibility API.

## Prepare A Share Kit

`TinyRustLmP2PClient.PrepareShareKit` accepts a
`PrepareShareKitRequest`. The request binds:

- the existing artifact path;
- a create-only output directory;
- the artifact-manifest content ID;
- qualification and provenance receipt content IDs;
- the reviewed license expression;
- the creation timestamp; and
- a `TinyRustLmP2PAdmission` that identifies either an SLM2 model plus its
  exact ACG2 composition path or an ACG2 composition artifact.

Rust validates the admitted artifact, creates fixed 4 MiB pieces, writes a
canonical bounded manifest, and returns `P2PShareKitReport`. Each report binds
the output directory, manifest path, piece directory, and parsed manifest.
Existing output is rejected rather than overwritten.

The SDK does not start a listener or claim that the share kit is reachable.
Loopback, LAN, and NAT-hairpin probes are not outside-network proof.

## Inspect A Manifest

`TinyRustLmP2PClient.InspectManifest` accepts bounded canonical manifest bytes
and returns `P2PManifest` only after the native authority validates the closed
schema, content identities, artifact length and hash, qualification and
provenance identities, reviewed license expression, sorted composition-member
identities, public-safe redaction decision, fixed piece geometry, every piece
offset and hash, total length, and Merkle profile.

Unknown fields, missing fields, noncanonical structure, invalid identities,
piece gaps or overlap, wrong piece size, inconsistent totals, and invalid
redaction state fail closed.

## Assemble Verified Pieces

`TinyRustLmP2PClient.AssembleArtifact` accepts an
`AssembleArtifactRequest`, the exact canonical manifest bytes, and the same
admission class used by the sender. Rust resolves only the declared piece
directory, verifies every ordered piece and the complete artifact, performs
SLM2 or ACG2 semantic admission, and promotes the output create-only.

The returned `P2PImportedArtifact` reports the output path, manifest content
ID, artifact SHA-256, and byte count. It is local assembly evidence only. It is
not source provenance, quality qualification, public reachability, catalog
publication, or browser activation evidence.

## Operational Ownership

The private TinyRustLM companion will own peer discovery, HTTPS transfer,
resumable operation state, and browser streaming after its release gates pass.
The public SDK deliberately exposes no announcement catalog, signature store,
network fallback, arbitrary URL fetch, mutable import receipt, credential
handling, or model-byte proxy.

MiniModel.org may publish catalog and discovery metadata. Model bytes move
directly between consenting peers and never through a project-hosted website.
No production companion or public P2P lane is currently released or proven.

## Required Evidence

Before a real composition can be offered, independently preserve:

1. exact source, provenance, license, and qualification receipts;
2. the complete ACG2 composition identity and all member identities;
3. deterministic SLM2 conversion and native/browser conformance;
4. create-only share-kit and assembly evidence;
5. current outside-network reachability proof for every advertised lane; and
6. catalog publication plus public HTTPS readback when authorized.

Fixture tests, local assembly, package creation, and HTTP success do not meet
those gates.

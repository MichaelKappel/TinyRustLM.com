# TinyRustLM Vector Quantization Experiments

This directory is a pre-product numerical research boundary for persistent
embedding-index and ephemeral KV-cache experiments. It is not imported by the
TinyRustLM runtime, does not modify `.slm` weight formats, and grants neither
product nor training authority.

Third-party papers, packages, archives, and source trees are deliberately kept
outside this repository. The checked-in source-and-claim ledger records only
their public URLs, immutable revisions, byte counts, SHA-256 identities,
licenses, evidence classifications, and approved review purpose.

Validate the ledger offline with:

```powershell
node tinyrustlm/tools/vector-experiment-ledger.js `
  tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json
```

The command rejects unknown fields, shorthand versions, mutable or abbreviated
repository revisions, internal research-agent citation markers, machine-local
paths, mixed storage-lane claims, and copied test-vector authority that is not
explicitly approved. It also proves that the checked-in bytes can be rebuilt
byte-for-byte from the validated JSON without network access.

The publish-disabled scalar crate is located at
`rust/experiments/tinyrustlm-vector-oracle/`. It has no dependencies and no
product integration. Its current clean-room foundation covers deterministic
input streams, signed permutation and normalized Hadamard transforms, discrete
Lloyd codebooks, canonical signed and unsigned bit packing, packed-domain
scores, numerical metrics, rank outcomes, and effective-byte accounting.

The experiment also contains a preregistered exact f32 flat-retrieval baseline.
It uses a canonical, bounded, little-endian snapshot format with sorted external
identifiers, a FIPS 180-4 SHA-256 corruption-detection footer, deterministic
scalar scoring, filtering, tombstones, compaction, and restart parsing. It does
not store payload text. Search returns external identifiers and scores only.
This exact baseline is a comparator for later experiments, not a compressed
index, TurboVec reproduction, product retrieval subsystem, or quality claim.

Run its focused verification with:

```powershell
cargo test -p tinyrustlm-vector-oracle
cargo clippy -p tinyrustlm-vector-oracle --all-targets -- -D warnings
node tinyrustlm/tools/vector-retrieval-preregistration.js
node --test tinyrustlm/tests/vector-experiment-isolation.test.js
```

The historical scalar receipt remains immutable at
`scalar-oracle-verification-v1.json`. The original exact-flat v1 receipt also
remains byte-for-byte unchanged at
`exact-flat-retrieval-verification-v1.json`; its SHA-256 is
`893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c`.
It is retained as stale historical evidence because later source inputs changed.

The sealed v2 receipt explicitly binds that immutable v1 predecessor. Its
declared source inputs were decoded as strict UTF-8 and canonicalized from CRLF
or CR to LF before hashing, so Windows and Linux checkouts resolve the same
historical source identity. Revalidate the immutable receipt and its exact
evidence commit with:

```powershell
node tinyrustlm/tools/vector-retrieval-receipt.js --validate
node --test tinyrustlm/tests/vector-retrieval-receipt.test.js
```

Never edit or replace a generated receipt. A future source-binding change must
retain v1 and v2 unchanged, introduce the next receipt schema and path, and bind
the immediately preceding receipt by its exact path, identity, and SHA-256.

The exact-flat receipt does not close real-browser WASM execution, target
hardware performance, sealed-corpus recall/MRR/NDCG, durable crash-recovered
deletion, measured line coverage, or Miri. Named TurboQuant, QJL, EDEN, RaBitQ,
TurboVec, compressed-retrieval, and KV-cache arms are not promoted by this
foundation. Their exact mathematical inputs, equal-byte manifests, target
behavior, and acceptance budgets remain future gates. Only the pinned NIST
standard is approved as implementation and test-vector input; no upstream
TurboVec or TurboQuant implementation constants or test vectors are approved
for copying.

# ADR-013: Exact SLM2 2.0 F32 Model Format Profile

## Status

Accepted as the exact unpromoted SLM2 2.0 model-container baseline. Parser,
writer, conformance, converter, runtime, WASM, browser, and cutover gates remain
required. No public availability or model-quality claim follows from this ADR.

## Decision Date

2026-08-20

## Scope

This ADR resolves the remaining format-level choices required to implement one
incompatible `.slm` vNext parser and writer. It specializes ADR-001, ADR-002,
ADR-003, ADR-006, ADR-008, and ADR-010 and freezes the machine-readable profile
at `contracts/vnext/slm2-format-profile.v1.json`.

It does not promote a converted model, a quantized profile, a runtime kernel,
an adapter, a browser path, or a catalog claim.

## Decision

### One File Purpose

SLM2 2.0 files contain static model semantics, canonical tensor descriptors,
and tensor payload bytes. They have exactly one of two classes:

- `1`: `base-model`, suitable as a complete general model or immutable base;
- `2`: `specialist-model`, a complete independently executable specialist.

The SLM2 model file does not embed tokenizer programs, chat-template programs,
adapters, composition graphs, transfer manifests, provenance, licenses,
evaluation receipts, catalog records, or signatures. Those are separate exact
vNext artifact and receipt profiles already named by the external artifact
contract:

- `tokenizer2.0` for tokenization;
- `template2.0` for declarative chat formatting;
- `lora2.0` for one immutable trained low-rank adapter;
- `acg2.0` for the ordered executable composition;
- canonical JSON receipts for pieces, provenance, qualification, and signing.

Every external relationship binds exact byte length and SHA-256 identity. No
SLM2 metadata field contains a model-byte URL, filesystem path, mutable alias,
credential, embedded private key, or executable script.

This resolves a conflict in the intake recommendation that proposed many
control-plane artifact classes inside the SLM2 envelope. The accepted vNext
contract family and ADR-010 keep those concerns in separately inspectable,
acyclic, canonical JSON evidence. The separation avoids circular whole-file
identity and prevents one binary parser from becoming a second receipt parser.

### Exact Envelope

The fixed header is 224 bytes, all integers are little-endian, and readers
decode bytewise rather than casting input to a native structure.

- Magic is `53 4c 4d 32 0d 0a 1a 0a` (`SLM2\r\n\x1a\n`).
- Format ID is `minimodel.slm2` followed by two zero bytes.
- Version is exactly `2.0`.
- Byte-order marker is numeric `0x01020304`.
- Header and tensor flags are zero.
- Reserved bytes are zero.
- Sections are aligned to 64 bytes.
- `file_size` equals the actual source length exactly.
- The whole-file SHA-256 is external and is never embedded in its own bytes.

The complete field offsets are normative in the machine-readable profile.
SLM2 2.0 uses these sections in this exact order:

1. SLM-DCBOR-1 manifest;
2. canonical string table;
3. fixed 192-byte tensor table;
4. tensor payloads.

Quantization, blob, and auxiliary table header fields are reserved and must all
be zero in this exact F32 model profile. Present sections begin at the smallest
64-byte-aligned offset after the previous section. Tensor payloads begin at the
smallest offset satisfying their declared power-of-two alignment from 64
through 4096 bytes. Every derived gap is zero. Discretionary gaps, overlap,
aliasing, out-of-order ranges, nonzero padding, and trailing bytes are fatal.

### Metadata

The manifest uses SLM-DCBOR-1 from ADR-001. The top-level map has exactly:

```text
artifact_class
body
dependencies
extensions
requirements
schema
```

`schema` is exactly `org.minimodel.slm/2.0`, and `artifact_class` agrees with
the header. `dependencies` and `extensions` are empty in SLM2 2.0 because
composition dependencies live in `acg2.0` and no extension has passed an ADR.

The initial model body has the exact field registry in the profile. It binds
the closed decoder-transformer, causal grouped-query attention, SiLU-gated
activation, RMSNorm, and RoPE profiles; positive dimensions and context; F32
bit patterns for positive finite RoPE theta and normalization epsilon; tied
embedding behavior; and the recomputed tensor-layout SHA-256.

All SLM2 2.0 metadata text is ASCII. Machine identifiers use
`[a-z0-9][a-z0-9._/-]{0,254}` with no empty, `.` or `..` component, leading or
trailing slash, backslash, colon, percent, control, or whitespace. Restricting
the first model profile to ASCII removes Unicode-normalization differential
risk without preventing separately reviewed catalog text.

The requirements map is exact and binds:

- `tinyrustlm.runtime/2.0`;
- `tinyrustlm.decoder-f32/1`;
- `tinyrustlm.tensor-f32/1`;
- `tinyrustlm.kv-f32/1`.

Unknown keys, versions, classes, flags, profiles, or nonempty extensions fail.
A future addition requires a new ADR, an exact new profile, explicit parser and
writer support, and independent vectors. It is never accepted by ignoring an
unknown field.

### Tensor Representation

The canonical string table stores nonempty unique machine identifiers in
strict raw-byte order. Tensor records reference semantic role and canonical
name by zero-based string ID.

Each tensor record is exactly 192 bytes. The complete offsets are frozen in the
profile. Records are strictly sorted by:

```text
(semantic role bytes, layer, subindex 0, subindex 1, canonical name bytes)
```

Duplicate sort keys and duplicate canonical names are fatal. Rank is zero
through eight. Rank zero is one scalar element. Used dimensions are positive,
unused dimensions are zero, and checked multiplication reproduces the stored
logical element count.

SLM2 2.0 admits only little-endian IEEE 754 binary32 tensor payloads. Payload
length is exactly `logical_element_count * 4`, and every value is finite.
Quantization index is `0xffff`; every quantization, tail, block, auxiliary, and
secondary flag field is zero. No byte length is interpreted as an implicit
dtype or quantization profile.

Tensor-layout and tensor-payload identities use SHA-256 with the exact domains
and fixed-width/length-prefixed framing frozen by the profile and shared
vectors. The parser recomputes descriptor layout identity and streams payload
hashes before returning a validated candidate.

### Pieces, Signatures, And Adapters

The complete artifact identity is plain SHA-256 over all exact file bytes.
P2P pieces are 4 MiB and use ADR-002's plain piece SHA-256 plus its exact leaf,
node, carry, and root domains. The final piece is one through 4 MiB; empty
artifacts are invalid. Level one is the first parent level above leaves, and
parent index is the zero-based position in that output level.

Signatures remain detached Ed25519 JCS envelopes under ADR-010. They bind the
artifact identity through a receipt and authority graph. SLM2 has no embedded
signature section, no self-signature, no signature-algorithm negotiation, and
no public key that establishes its own authority.

Specialists are either complete class-2 SLM2 artifacts or exact-base-bound
`lora2.0` artifacts inside an `acg2.0` composition. Arbitrary layer slicing,
untrained early exit, mutable overlays, DoRA aliases, raw deltas, and shared
backbone guesses are not SLM2 2.0 behavior.

### Quantization

Dense F32 is the sole SLM2 2.0 executable tensor profile. This is the numerical
and conversion oracle required by ADR-006. Q8, Q4, Q5, one-bit, ternary,
TurboQuant-like, TurboVec-like, vector-quantized, sparse, and compressed-KV
profiles remain unsupported. Adding one requires exact records, tails, scalar
oracle kernels, deterministic conversion, native/WASM/browser conformance, and
semantic quality evidence. The parser never maps an unsupported encoding to
F32 or a nearby quantizer.

### Bounded Implementation Contract

The sole SLM2 parser validates cheap structure before allocation or hashing:

1. actual source size and policy bound;
2. header truncation, magic, format ID, exact version, and byte order;
3. class, flags, reserved bytes, and declared size;
4. checked table-size arithmetic, canonical placement, and bounds;
5. zero padding;
6. canonical metadata grammar and exact schema;
7. string table;
8. tensor descriptors, sort order, shapes, and payload plan;
9. streamed tensor hashes, finite F32 values, layout hash, and whole-file hash.

Every offset, length, count, shape product, alignment, conversion to `usize`,
and stream position uses checked arithmetic. Metadata and tables are bounded;
tensor payloads and whole-file identity are streamed through fixed buffers.
No multi-gigabyte artifact is loaded merely to validate or hash it.

The deterministic writer preflights the same graph, hashes every source tensor
through a bounded pass, derives all offsets, writes one canonical byte stream,
and rehashes tensor bytes while copying so source drift fails. Callers publish
only from an owned staging file after writer success and independent readback.

## Alternatives

- Retaining SLM1 magic or a dual reader was rejected as prohibited legacy
  support.
- Embedding tokenizer, template, receipt, signature, or peer-location objects
  was rejected because their identity and trust boundaries differ.
- General JSON or unrestricted CBOR was rejected for binary metadata.
- General optional extensions in 2.0 were rejected because there is no closed
  harmless-extension registry yet.
- BLAKE3 semantic identities from the intake recommendation were rejected in
  favor of ADR-002's sole ecosystem SHA-256 identity.
- Quantization labels without exact records and kernels were rejected.
- Loading complete model bytes into RAM for validation was rejected.

## Authoritative Evidence

- **Observed local fact**: the existing production-format implementation uses
  SLM1 magic, a 108-byte header, a permissive current tensor surface, and a
  non-cryptographic format checksum; it is not SLM2 evidence.
- **Observed local fact**: `contracts/vnext/contract-family.v1.json` already
  separates `slm2.0`, `tokenizer2.0`, `template2.0`, `lora2.0`, and `acg2.0`
  artifact profiles and binds artifacts by complete SHA-256.
- **Observed local fact**: ADR-010's receipt and signature system uses bounded
  canonical JSON and detached role-specific Ed25519 envelopes, so embedding a
  second evidence encoding in SLM2 would duplicate an authority boundary.
- **Sourced public fact**: RFC 8949 defines CBOR and deterministic encoding at
  https://www.rfc-editor.org/rfc/rfc8949.html.
- **Sourced public fact**: FIPS 180-4 specifies SHA-256 at
  https://csrc.nist.gov/pubs/fips/180-4/upd1/final.
- **Sourced public fact**: RFC 8032 specifies Ed25519 at
  https://www.rfc-editor.org/rfc/rfc8032.
- **Engineering decision**: one model-only envelope and separate exact
  tokenizer, template, composition, evidence, and signing artifacts keep each
  parser and identity boundary small and acyclic.
- **Local verification required**: Rust and an independent implementation must
  agree on exact writer bytes, every accepted and rejected corpus entry, all
  tensor and Merkle identities, and bounded streaming behavior.

## Threat Analysis

The primary threats are parser differential, version smuggling, duplicate-key
substitution, integer wrap, allocation bombs, malformed UTF-8, hidden appended
content, nonzero covert padding, range overlap, tensor aliasing, shape/product
disagreement, non-finite weights, payload substitution, source mutation during
packing, hash-domain confusion, dependency substitution, and a structurally
valid artifact being misrepresented as licensed or qualified.

Exact magic and version checks, closed metadata keys, shortest deterministic
CBOR, checked arithmetic, derived offsets, zero-padding verification, strict
descriptor ordering, finite F32 scans, domain-separated tensor hashes, plain
whole-file SHA-256, two-pass source verification, detached authority receipts,
and fail-atomic activation address those threats. Structural validation remains
separate from provenance, license, runtime, quality, and publication gates.

## Performance Evidence

No SLM2 performance result exists yet, and this ADR makes no throughput,
resident-memory, browser, SIMD, or quality claim. The 64-byte section alignment,
1 MiB stream buffer, and F32 baseline are engineering choices pending
measurement.

Promotion requires minimum, typical, maximum, and hostile measurements for
header/metadata parsing, table allocation, sequential payload hashing, complete
artifact hashing, cold and warm reads, native and WASM ingestion, browser copy
behavior, peak resident memory, and rejection latency. Measurements must prove
that parser metadata remains bounded and that multi-gigabyte validation does
not allocate or duplicate the complete artifact.

## Compatibility Impact

SLM2 is incompatible with SLM1. The SLM2 parser rejects SLM1 magic immediately
and contains no migration reader, fallback, alias, or automatic conversion.
Until the SLM2 converter and runtime are independently proven, SLM2 remains an
unpromoted development path rather than a second production selector.

Exact 2.0 readers reject every other major or minor version. A future profile
is a new explicit contract and parser implementation, not permissive retention
of unknown fields. Existing SLM1 artifacts remain historical inputs only and
must be regenerated from reviewed source.

## Clean Deletion Impact

At full cutover, delete the SLM1 parser, writer, selector metadata, production
fixtures, C ABI behavior, .NET wrappers, browser admission, and documentation.
Reviewed immutable sources are converted again into SLM2. Historical receipts
remain evidence only and are not reinterpreted.

Delete any experimental SLM2 profile, fixture, generated artifact, parser
branch, or documentation superseded before promotion. Do not retain a hidden
compatibility crate, command, feature flag, or test-only production selector.

## Unknowns

- Exact architecture-specific tensor-role registries and required tensor sets.
- `tokenizer2.0`, `template2.0`, `lora2.0`, and `acg2.0` byte-level profiles.
- Source-family conversion and provenance implementations.
- F32 scalar runtime, WASM, browser loading, WebGPU staging, and physical RID
  evidence.
- Measured lower policy limits for browser classes.
- Independent language implementation and long-running fuzz evidence.
- Production release authorization and catalog publication.

These are explicit incomplete gates, not permission to accept alternate bytes.

## Acceptance Tests

1. Exact profile bytes have a pinned SHA-256 checked by the implementation.
2. Deterministic writer output matches language-neutral golden vectors.
3. An independent parser agrees on accepted and rejected vectors.
4. Every fixed field and section boundary has truncation coverage.
5. Noncanonical CBOR, duplicate keys, invalid types, excessive resources,
   unknown fields, and trailing metadata fail.
6. Header, section, string, tensor, payload, padding, shape, finite-value,
   tensor-hash, layout-hash, and whole-file mutations fail closed.
7. Fuzzing and a minimized hostile corpus produce no panic or unbounded work.
8. Stream tests prove bounded validation and hashing beyond in-memory fixture
   sizes.
9. Source conversion and scalar F32 forward-pass conformance pass before any
   quantized profile begins promotion.
10. Repository checks prove the production cutover contains no SLM1 path.

## Rollback

Before promotion, remove the unpromoted SLM2 implementation and its generated
development artifacts if the profile is defective. After promotion, roll back
the complete content-addressed release and regenerate corrected artifacts under
a new exact profile. Never enable SLM1 or a permissive SLM2 reader as rollback.

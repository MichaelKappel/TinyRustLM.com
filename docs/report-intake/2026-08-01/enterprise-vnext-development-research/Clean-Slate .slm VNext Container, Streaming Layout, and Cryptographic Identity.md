# Clean-Slate `.slm` VNext Container, Streaming Layout, and Cryptographic Identity

## Executive decision, assumptions, and primary-source baseline

**Status-label convention.** This report uses six labels throughout:

- **[Observed public fact]** A fact directly visible in a cited public specification or repository.
- **[Externally sourced fact]** A fact reported by an authoritative external source.
- **[Inference]** A conclusion derived from public facts but not stated by those sources.
- **[Engineering recommendation]** A proposed normative requirement for `.slm` VNext.
- **[Assumption from supplied context]** A product constraint supplied in the request, not independently verified.
- **[Local verification required]** A fact that cannot be established without TinyRustLM’s private implementation, real artifacts, conversion pipeline, policy records, or test fixtures.

**[Engineering recommendation] Executive decision.** Replace the unpublished `.slm` contract with one new, incompatible format named **SLM2**, without a legacy reader, dual writer, compatibility alias, or migration parser. SLM2 should be:

1. A little-endian, bounded, sectioned binary envelope.
2. A single-artifact-class container: each file has exactly one declared artifact class.
3. Canonical at the byte level: fixed section order, deterministic CBOR metadata, sorted descriptor tables, zero padding, and no trailing bytes.
4. Non-executable: no arbitrary code, scripts, regular-expression engines, dynamic imports, paths, URLs to model bytes, or evaluator expressions.
5. Stream-verifiable before activation, with hashes checked while the candidate remains quarantined.
6. Content-addressed using BLAKE3-256 with explicit domain separation and length framing.
7. Suitable for native positional reads or memory mapping, browser `File` slicing, OPFS worker reads, bounded Wasm copies, and staged WebGPU uploads.
8. Strict about unknown semantics: unknown core fields and unknown critical extensions are rejected.
9. Explicitly separated from tokenizer, chat-template, adapter composition, KV-cache, retrieval-index, provenance, signature, evaluation, piece-set, and catalog identities.

**[Assumption from supplied context]** TinyRustLM.com is a browser-local chat interface; MiniModel.org is the catalog and direct-peer-discovery authority; project websites do not host or proxy model bytes; and bytes enter through a user-selected file or consenting direct peer. This report therefore treats the browser, native companion, peer-transfer subsystem, local store, catalog, and runtime as separate trust domains.

**[Local verification required]** Nothing in this report describes the current private `.slm` layout, parser, converter, runtime tensor naming, quantization implementation, catalog schema, receipts, or tests. Those remain unknown. No recommendation below should be read as evidence that current unpublished artifacts satisfy it.

**[Engineering recommendation] Version policy.** SLM2 should begin at format version `2.0`, with magic distinct from any unpublished predecessor. Major-version mismatch is fatal. A reader may accept a higher minor version only when every added feature is represented by a recognized noncritical extension and all fixed record sizes remain exactly those defined for `2.0`; otherwise it rejects. In practice, the first implementation should accept only `2.0` until extension behavior is covered by the conformance corpus.

**[Engineering recommendation] Algorithm profile.** The mandatory interoperability profile should be:

| Function | Mandatory SLM2 choice |
|---|---|
| Content hash | BLAKE3, 256-bit output |
| Optional ecosystem digest | SHA-256 |
| Signature scheme | Ed25519 detached envelope |
| Metadata | Restricted deterministic CBOR derived from RFC 8949 |
| Text normalization | Unicode NFC using a pinned Unicode version |
| Byte order | Little-endian only |
| Piece size | Exactly 4 MiB in the baseline transfer profile |
| Merkle shape | Ordered RFC 9162-style recursive tree, with SLM-specific domains |
| Payload compression | None |
| Tensor layout | Canonical contiguous row-major |
| File alignment | 64-byte section alignment; tensor-specific alignment 64–4096 |
| Maximum format file size | `2^53 − 1` bytes |
| Unknown core fields | Reject |
| Unknown critical extensions | Reject |
| Unknown noncritical extensions | Validate and preserve, but never interpret as semantic |

BLAKE3 is designed as a tree hash with incremental and parallel operation, while SHA-256 is standardized by NIST and remains useful as an optional ecosystem-facing digest. BLAKE3 release `1.8.4`, abbreviated release commit `b97a24f`, was the current official implementation release observed during research; its release notes also identify Wasm SIMD work. The full 40-hex source commit, source-tree hash, and selected portable implementation files must be frozen in the SLM2 implementation bill of materials before release. citeturn14search1turn15view14turn15view13

**[Engineering recommendation] Zero-dependency boundary.** Header parsing, checked arithmetic, descriptor parsing, canonical-CBOR parsing, BLAKE3 hashing, SHA-256 hashing, piece verification, and deterministic writing are reasonable to implement in a small audited Rust codebase without third-party runtime crates. Implementing Ed25519 from scratch, Unicode normalization from first principles, a complete certificate stack, or transparency-log verification without a vetted implementation is not reasonable. These tasks involve subtle constant-time arithmetic, large normative tables, certificate/path semantics, or ecosystem interoperability. The practical choices are an audited vendored implementation pinned by source hash, a separately reviewed minimal internal implementation derived from a recognized reference, or platform WebCrypto when its precise required algorithm is available. WebCrypto defines browser APIs for hashing and signature operations but is an API contract, not evidence that every algorithm is uniformly implemented by every target browser. citeturn16view5turn15view10

**[Engineering recommendation] Pinned-source rule.** “Pinned” means one of the following:

- An immutable RFC number and publication date.
- A versioned standards publication and publication date.
- A release tag plus full source commit.
- For a living standard, a saved source snapshot, retrieval date, and cryptographic hash of the snapshot.
- For a GitHub document, the immutable blob URL at the selected full commit, not `master` or `main`.

The research retrieval date for all sources in this report is **August 1, 2026**.

### Precedent and source matrix

**[Observed public fact]** Safetensors uses an eight-byte little-endian header length, a UTF-8 JSON header, and then a tensor byte buffer. Its public format notes prohibit duplicate keys but warn that not all JSON parsers necessarily enforce that rule; tensor offsets are relative to the data buffer. citeturn17view0

**[Observed public fact]** GGUF version 3 uses a typed metadata structure, tensor descriptors, aligned tensor data, and explicit tensor offsets. Its current documentation says the default tensor-data alignment is 32 bytes and that metadata values include fixed-width integers, floating-point values, strings, and arrays. The underlying GGUF document also records historical endianness ambiguity: models were little-endian by default, while at one point no in-band mechanism reliably distinguished big-endian files. citeturn15view2turn17view3turn15view1

**[Observed public fact]** ONNX external-data conventions allow tensor bytes to be stored outside the protobuf graph and handled through external-data fields and helper APIs. The official helper includes location/base-path validation behavior, illustrating that external references add path-resolution policy and implementation surface beyond tensor-offset parsing. citeturn15view3

**[Observed public fact]** RFC 8949 defines deterministic CBOR requirements, including deterministic map-key ordering profiles, but CBOR itself permits a much richer data model than SLM2 needs, including tags and floating-point encodings. An application profile must therefore narrow the grammar rather than merely saying “canonical CBOR.” citeturn15view4turn17view5

| Precedent | Canonical serialization | Metadata and duplicates | Tensor indexing and alignment | Streaming and random access | Browser and native fit | Security-relevant lesson | SLM2 disposition |
|---|---|---|---|---|---|---|---|
| Safetensors `0.8.0`, release commit abbreviated `a406ca3`, June 9, 2026 | Not intrinsically byte-canonical: JSON member ordering and permitted spellings require writer discipline | String-keyed JSON; duplicate keys forbidden by format, but parser behavior can differ | Relative begin/end offsets into one data buffer; dense tensors | Small header first, then direct ranges; friendly to memory mapping | Good basic fit, but JSON parsing and whole-header limits need care | Its own documentation highlights duplicate-parser variance; no tensor checksums or composition identity | Adopt compact front metadata and contiguous payload; reject JSON and implicit parser behavior |
| GGUF v3, inspected with llama.cpp build `b10218`, commit abbreviated `de69995`, August 1, 2026 | Deterministic only when a writer imposes metadata order, padding, and exact float encoding | Rich typed K/V values and arrays; extensibility is permissive | Tensor name, dimensions, type, relative offset, global alignment | Strong mmap-oriented model and single-file deployment | Good native fit; implementable in browsers but richer parser | Evolving type registry and quantization structures can make labels runtime-specific; historical endian inference is undesirable | Adopt typed binary descriptors and alignment; reject mixed endian, generic quant names, and silently meaningful unknown metadata |
| ONNX `1.22.0`, release commit abbreviated `2bb5046`, June 15, 2026 | Protobuf is deterministic only under additional serialization rules; graph semantics are much larger than a weight container | Strongly typed graph schema, extensible fields | External tensor references may carry locations, offsets, lengths, and checksums | External data can avoid one huge protobuf, but introduces multiple resources and path policy | Heavy for zero-crate Rust/Wasm and more expressive than required | Path resolution, graph interpretation, protobuf unknown-field behavior, and external-file consistency widen the trust boundary | Adopt explicit external dependency identity ideas; reject filesystem paths and generic graph execution |
| RFC 8949 deterministic CBOR | Standards-defined deterministic profiles | Maps and duplicate handling still require application-level constraints | No tensor layout itself | Good bounded metadata encoding if nesting and lengths are capped | Small custom decoder is feasible | Tags, floats, indefinite lengths, deep nesting, and permissive decoders create parser differentials unless forbidden | Adopt only a closed subset |
| BitTorrent v2 / RFC 9162 Merkle precedent | Ordered piece/tree construction | Not a model metadata format | Piece-layer and Merkle indexing | Excellent resumability and per-piece verification | Suitable for peer transfer and browser staging | Tree shape and leaf/node domains must be unambiguous | Adopt ordered fixed pieces and explicit leaf/node domains |
| IPFS-style content addressing | Identity follows content digest rather than location | Schema is application-defined | Chunk/block identity independent of tensor semantics | Supports deduplicated distribution | Useful for shared local stores | A content ID proves byte identity, not model class, licensing, or safety | Adopt digest-addressed chunks but retain SLM-specific artifact classes |

Safetensors’ current public format description gives a concise, bounded design starting point, but it also explicitly acknowledges that duplicate-key handling and obscure JSON representations depend on parser behavior. GGUF demonstrates the practical value of typed metadata, explicit tensor records, and aligned mmap-friendly payloads, but its broad evolving type system and format-specific quant structures should not be imported wholesale. ONNX external data demonstrates useful byte-range and checksum concepts, while also showing why path-bearing external references are outside SLM2’s desired trust boundary. citeturn17view0turn17view3turn15view3

**[Inference] Security-history conclusion.** The inspected primary sources do not support a responsible claim that any one precedent is “secure” in the absolute. Their design histories instead expose recurring failure classes: ambiguous metadata parsing, evolving type registries, unchecked length and offset arithmetic, path-bearing external resources, and confusion between safe serialization and safe model behavior. This report therefore treats strict grammar, bounded arithmetic, cryptographic identity, and pre-activation policy checks as independent controls.

## Artifact classes and trust boundaries

**[Engineering recommendation] One envelope, one class.** All SLM2 files use the same outer framing and hashing rules, but each file declares exactly one `artifact_class`. Class-specific schemas define which tables and payload kinds are legal. A parser must reject a file that combines semantically distinct classes merely because the outer envelope can technically carry the bytes.

The normative class identifiers are:

| ID | Artifact class | Meaning and admission boundary |
|---:|---|---|
| `0x0001` | `standalone_model` | Executable static model weights and architectural contract that require no other weight artifact |
| `0x0002` | `immutable_base` | Static base model intended to be executed alone or referenced by adapters |
| `0x0003` | `dependent_adapter` | Weight deltas or low-rank operators that require one exact base |
| `0x0004` | `composition_manifest` | Ordered dependency graph and runtime policy; no tensor bytes |
| `0x0005` | `tokenizer` | Vocabulary, merges/model, normalizer, special-token behavior |
| `0x0006` | `chat_template` | Closed declarative rendering program, not arbitrary code |
| `0x0007` | `shared_content_chunk` | Opaque verified content piece, interpreted only through a referring artifact |
| `0x0008` | `signature_envelope` | Detached signature statement and verification material |
| `0x0009` | `license_provenance` | Source pins, lineage, conversion statement, license notices |
| `0x000a` | `kv_cache` | Snapshot of runtime cache bound to one composition and token prefix |
| `0x000b` | `retrieval_index` | Retrieval structures bound to corpus and embedding identities |
| `0x000c` | `evaluation_receipt` | Evaluation claim, harness identity, dataset identity, and result commitment |
| `0x000d` | `catalog_announcement` | Signed public catalog metadata and peer-discovery statement |
| `0x000e` | `piece_set` | Fixed-piece transfer manifest, ordered piece hashes, and Merkle root |

**[Engineering recommendation] Embedding matrix.**

| Subject class | May contain directly | May reference by cryptographic ID | Forbidden |
|---|---|---|---|
| Standalone model / immutable base | Architecture metadata, tensor descriptors, tensor payloads, quantization profiles | Tokenizer, chat template, provenance, license, signatures, evaluation receipts, piece set | Adapters, KV cache, retrieval index, catalog announcement, executable scripts, external paths |
| Dependent adapter | Adapter tensors, target declarations, operation parameters | Exact base, tokenizer, tensor-layout identity, provenance, license, signatures, receipts | Claim of standalone execution, implicit “latest base,” unordered dependencies |
| Composition manifest | No tensor payload; dependency list and policy only | Base, ordered adapters, tokenizer, template, runtime profile, provenance, receipts | Embedded model bytes, peer locations treated as identity |
| Tokenizer | Token bytes and bounded tokenizer tables | Provenance, license, signature | Model tensors, arbitrary native/Wasm code |
| Chat template | Canonical declarative AST or bytecode from a closed instruction set | Tokenizer and provenance if needed | JavaScript, Python, Wasm modules, regular-expression engines, filesystem/network access |
| Shared content chunk | Exactly one opaque byte blob | Piece-set subject and owning file identities | Metadata-driven interpretation as a model |
| Signature envelope | Public keys or key references, signatures, log proofs | Exact subject digest | Secret keys, private tokens, mutable “current version” target |
| License/provenance | Notices, SPDX expressions, source pins, toolchain and conversion statements | Subject IDs and source revision IDs | Model bytes presented as evidence of licensing |
| KV cache | Cache tensors and layout declaration | Exact composition, runtime ABI, tokenizer, prompt-prefix digest | Catalog promotion as a reusable model |
| Retrieval index | Index arrays/blobs, metric and dimension | Corpus revision, chunking policy, embedding composition | Implicit corpus or model identity |
| Evaluation receipt | Result summary or commitment | Exact composition, harness, dataset revision | Assertion that a signature alone establishes quality |
| Catalog announcement | Display metadata, public policy state, peer-discovery descriptors | All announced artifact and receipt IDs | Model bytes or byte-proxy URLs |
| Piece set | Ordered piece hashes, Merkle root, whole-file ID | Subject file ID | Semantic model fields that could conflict with the subject |

**[Engineering recommendation] Standalone model and immutable base.** These classes contain only static executable weights and architecture semantics. “Immutable base” is a role distinction: its content identity remains byte-derived, while its manifest explicitly permits dependent artifacts to bind to it. A standalone model may have no weight dependency. Neither class embeds tokenizer or chat-template executable forms; it references them through an executable composition.

**[Engineering recommendation] Adapter trust boundary.** An adapter is admitted only when it identifies:

- One exact base model identity.
- One exact base whole-file identity when byte-for-byte base binding is required.
- The base semantic tensor-layout identity.
- The exact tokenizer identity when adapter training depended on token IDs or vocabulary.
- Every targeted tensor by semantic key, expected shape, element/quantization profile, and operation.
- The ordered application point and composition semantics.

An adapter file must never be announced as having the logical executable size of only its own bytes. The catalog must report at least:

\[
L_\text{composition} =
\sum_{a \in \text{required unique artifacts}} \operatorname{logical\_bytes}(a)
+ R_\text{runtime}
\]

and separately:

\[
P_\text{incremental} =
\sum_{a \in \text{new store objects}} \operatorname{stored\_bytes}(a)
\]

where logical executable requirements and deduplicated incremental storage are not interchangeable.

**[Engineering recommendation] Composition is ordered.** A composition manifest is the executable root of trust. Its identity commits to the exact base, tokenizer, chat template, ordered adapter list, route policy, runtime requirements, generation-stop policy, and KV-cache compatibility identity. Reordering adapters changes the composition ID even when the set is unchanged. Duplicate adapter IDs are forbidden. Missing dependencies, alternate versions, or substitutions under the same display name are fatal.

**[Engineering recommendation] Catalog separation.** Display names, descriptive text, popularity, peer addresses, and current promotion state belong in a `catalog_announcement`; they do not define model identity. Under the supplied product constraints, MiniModel.org may publish announcements and direct-peer-discovery data but must not host or proxy model bytes. The announcement signs content IDs and policy status rather than a mutable URL.

**[Engineering recommendation] Mutable and ephemeral classes.** KV-cache files and retrieval indexes can use the SLM2 envelope but are never interchangeable with static model weights. A KV cache binds to the exact composition identity, runtime ABI, cache layout, dtype, positional-encoding state, token-prefix digest, and optionally device/kernel capability profile. A retrieval index binds to its corpus revision, document chunking recipe, embedding model composition, tokenizer, vector dimension, metric, and index algorithm.

**[Engineering recommendation] Promotion states.** Structural validity is only the first admission stage. A public announcement may move to “promotable” only after independent checks for:

1. Structural conformance.
2. Full content identity.
3. Dependency closure.
4. Signature/provenance policy.
5. License review.
6. Required quality-receipt references.
7. Runtime compatibility.
8. Catalog policy.

A valid hash proves bytes were unchanged relative to the hashed input. It does not prove lawful provenance, semantic correctness, behavioral quality, lack of malicious weights, or safety.

## Normative byte layout, canonical metadata, tensors, and quantization

**[Engineering recommendation] Primitive encoding.** All fixed-width integers are little-endian. Signed integers use two’s complement. Readers must decode fields bytewise or with safe little-endian helpers; they must not cast an unaligned input pointer to a Rust or C structure. All offset arithmetic is performed in at least `u64` with checked operations. Format-level values exceeding `2^53 − 1` are forbidden so JavaScript-facing file positions remain exactly representable.

### File header

**[Engineering recommendation] Header constants.**

- Magic: bytes `53 4c 4d 32 0d 0a 1a 0a`, corresponding to `SLM2\r\n\x1a\n`.
- Format identity: bytes `6d 69 6e 69 6d 6f 64 65 6c 2e 73 6c 6d 32 00 00`, corresponding to `minimodel.slm2\0\0`.
- Header size: `224`.
- Version: major `2`, minor `0`.
- Byte-order marker: numeric value `0x01020304`, serialized little-endian as `04 03 02 01`.
- Section alignment: `64`.
- All reserved bytes: zero.

```text
Offset  Size  Field
0       8     magic = "SLM2\r\n\x1a\n"
8       16    format_id = "minimodel.slm2\0\0"
24      4     header_size = 224
28      2     version_major = 2
30      2     version_minor = 0
32      4     byte_order_marker = 0x01020304
36      2     artifact_class
38      2     header_flags = 0
40      8     file_size

48      8     manifest_offset
56      8     manifest_length

64      8     string_table_offset
72      8     string_table_length

80      8     quant_table_offset
88      4     quant_count
92      4     quant_record_size = 128 when quant_count > 0

96      8     tensor_table_offset
104     4     tensor_count
108     4     tensor_record_size = 192 when tensor_count > 0

112     8     blob_table_offset
120     4     blob_count
124     4     blob_record_size = 96 when blob_count > 0

128     8     auxiliary_table_offset
136     4     auxiliary_count
140     4     auxiliary_record_size = 32 when auxiliary_count > 0

144     8     payload_offset
152     8     payload_length

160     64    reserved = all zero
224           end of fixed header
```

**[Engineering recommendation] Offset diagram.**

```text
0
+-------------------------------+
| Fixed header, 224 bytes       |
+-------------------------------+
| Zero padding to 64 boundary   |
+-------------------------------+ <- manifest_offset
| Deterministic CBOR manifest   |
+-------------------------------+
| Zero padding                  |
+-------------------------------+ <- string_table_offset
| Canonical string table        |
+-------------------------------+
| Zero padding                  |
+-------------------------------+ <- quant_table_offset, or absent
| Quantization records          |
+-------------------------------+
| Zero padding                  |
+-------------------------------+ <- tensor_table_offset, or absent
| Tensor records                |
+-------------------------------+
| Zero padding                  |
+-------------------------------+ <- blob_table_offset, or absent
| Blob records                  |
+-------------------------------+
| Zero padding                  |
+-------------------------------+ <- auxiliary_table_offset, or absent
| Auxiliary binding records     |
+-------------------------------+
| Zero padding                  |
+-------------------------------+ <- payload_offset
| Tensor payload 0, padding     |
| Tensor payload 1, padding     |
| ...                           |
| Blob payload 0, padding       |
| Blob payload 1, padding       |
+-------------------------------+ <- file_size exactly
```

**[Engineering recommendation] Canonical section placement.** Present sections occur only in the order shown. For each present section:

\[
\text{offset}_i = \operatorname{align\_up}(\text{end}_{i-1}, 64)
\]

Absent tables have zero offset, count, length where applicable, and record size. There are no discretionary gaps. Every padding byte is zero. Payload objects occur in descriptor order: all tensor payloads first, followed by blob payloads, with each object beginning at the smallest offset satisfying its declared alignment. This rule makes offsets derivable rather than freely chosen.

**[Engineering recommendation] No end marker.** There is no end marker because the trusted external size and header `file_size` define the artifact boundary. `file_size` must exactly equal the source size. Any trailing byte is fatal. This prevents appended polyglot content, hidden signatures, or ambiguous concatenated artifacts.

**[Engineering recommendation] Baseline limits.**

| Resource | Format maximum |
|---|---:|
| File size | `2^53 − 1` bytes |
| Manifest | 4 MiB |
| String table | 16 MiB |
| Strings | 262,144 |
| Individual machine identifier | 255 bytes |
| Individual human-facing text field | 16,384 UTF-8 bytes |
| Quant profiles | 1,024 |
| Tensors | 262,144 |
| Blob descriptors | 262,144 |
| Auxiliary records | 524,288 |
| Tensor rank | 8 |
| CBOR nesting depth | 16 |
| Total CBOR items | 65,536 |
| Entries in one CBOR map | 4,096 |
| Array length in manifest | 65,536 |
| Tensor alignment | power of two, 64 through 4,096 |
| Blob alignment | power of two, 1 through 4,096 |
| Runtime policy allocation | implementation-specific and no greater than format maximum |

Implementations may impose lower documented limits. They must report “policy limit exceeded,” not reinterpret the file.

### Canonical metadata grammar

**[Observed public fact]** RFC 8949 supplies deterministic-encoding requirements but permits multiple application profiles. RFC 8785 likewise exists because cryptographic use requires invariant serialization, but JSON canonicalization inherits JSON’s number and string model. citeturn15view4turn15view16

**[Engineering recommendation] Chosen grammar.** SLM2 metadata uses **SLM-DCBOR-1**, a strict subset of RFC 8949 deterministic CBOR:

- Definite-length values only.
- Allowed major types: unsigned integer, negative integer, byte string, text string, array, map.
- Allowed simple values: `false`, `true`, and `null`.
- Forbidden: all floating-point encodings, tags, undefined, break, indefinite strings, indefinite arrays/maps, and unassigned simple values.
- Integers use the shortest RFC 8949 representation.
- Unsigned range: `0` through `2^64 − 1`.
- Signed application range: `−2^63` through `2^63 − 1`.
- Map keys are text strings only.
- Map keys are ordered by their complete encoded CBOR byte representation under RFC 8949 core deterministic ordering.
- Duplicate keys are fatal, even if a general CBOR library would retain one.
- The parser validates canonical encoding directly; it does not decode a permissive representation and silently re-encode it.
- Unknown top-level or core-schema keys are fatal.

**[Engineering recommendation] Unicode.** Every metadata text string is valid UTF-8 and NFC-normalized under one pinned Unicode data version. Unicode normalization forms and canonical equivalence are standardized by Unicode Standard Annex #15; Unicode also publishes security mechanisms for detecting spoofing-sensitive usage. citeturn15view17turn15view18

Machine identifiers use only:

```text
[a-z0-9][a-z0-9._/-]{0,254}
```

with these additional restrictions:

- No `//`.
- No leading or trailing `/`.
- No component equal to `.` or `..`.
- No backslash, colon, percent sign, NUL, control character, whitespace, or bidi control.
- A slash is a namespace separator only; it is never interpreted as a filesystem path.
- Identifiers compare by raw ASCII bytes.
- Tensor and blob names are unique after exact byte comparison; no case folding occurs.

Human-facing display names should normally live in catalog announcements, not model manifests. Where human text is required in a provenance or license record, it is NFC-normalized and bounded but must never be used as an identifier or rendered as trusted HTML.

**[Engineering recommendation] Top-level manifest.** The top-level map has exactly:

```text
{
  "artifact_class": uint,
  "body": map,
  "dependencies": array,
  "extensions": array,
  "requirements": map,
  "schema": "org.minimodel.slm/2.0"
}
```

The keys are encoded in deterministic CBOR order. Header and manifest `artifact_class` values must agree.

`extensions` contains records of the form:

```text
{
  "critical": bool,
  "id": machine_identifier,
  "payload": bytes_or_map,
  "version": uint
}
```

An unknown critical extension is fatal. An unknown noncritical extension is accepted only after canonical validation and only if the specification for noncritical extensions states that it cannot alter parsing, tensor meaning, dependency resolution, activation, security policy, or identity projection. It remains part of the whole-file and manifest hashes.

**[Engineering recommendation] Independent byte identity.** Two writers produce identical metadata when they:

1. Normalize every permitted text value to NFC.
2. Validate the closed schema and reject unknown core fields.
3. Encode integers minimally.
4. Use no floats or tags.
5. Sort maps by deterministic encoded-key order.
6. Preserve array order only where the schema declares order semantic.
7. Sort semantically unordered sets by their canonical element encoding.
8. Emit no timestamps, hostnames, local paths, UUIDs, random nonces, or map-iteration order into the semantic manifest.

The reader must compare the received bytes to the encoding implied by these rules or perform an equivalent one-pass canonicality check. A noncanonical but semantically decodable manifest is rejected rather than normalized during admission.

### Canonical string table

**[Engineering recommendation] Encoding.**

```text
u32 string_count
u32 byte_pool_length
u32 offsets[string_count + 1]
u8  byte_pool[byte_pool_length]
```

- `offsets[0] = 0`.
- `offsets[string_count] = byte_pool_length`.
- Offsets are strictly increasing; empty strings are forbidden.
- Each range is valid UTF-8 and satisfies the relevant identifier grammar.
- Strings are strictly sorted by raw UTF-8 bytes.
- Duplicate strings are forbidden.
- References use zero-based `u32` string IDs.
- The table is padded only at the section boundary, not internally.

The string table is for repeated machine identifiers used by descriptors. It is not a general metadata heap.

### Tensor descriptor

**[Engineering recommendation] Fixed 192-byte record.**

```text
Offset  Size  Field
0       2     record_version = 1
2       1     rank, 0..8
3       1     flags
4       2     element_type
6       2     quant_profile_index, 0xffff for dense
8       4     semantic_role_string_id
12      4     canonical_name_string_id
16      4     layer, signed; -1 means global
20      4     subindex_0, signed
24      4     subindex_1, signed
28      4     reserved_0 = 0
32      64    shape[8], u64; unused entries zero
96      8     logical_element_count
104     8     stored_bytes
112     8     payload_relative_offset
120     8     payload_length
128     4     payload_alignment
132     4     block_elements
136     4     block_bytes
140     2     scale_type
142     2     zero_point_type
144     2     packing_order
146     2     accumulator_type
148     2     tail_rule
150     2     flags_2
152     4     auxiliary_first
156     4     auxiliary_count
160     32    payload_hash
```

**[Engineering recommendation] Tensor ordering.** Records are strictly sorted by:

```text
(
  semantic_role_bytes,
  layer,
  subindex_0,
  subindex_1,
  canonical_name_bytes
)
```

No duplicate sort key or duplicate canonical name is allowed.

**[Engineering recommendation] Shape rules.**

- Rank zero denotes a scalar and has logical element count one.
- For rank greater than zero, each used dimension is in `1..=2^32−1`.
- Zero extents are forbidden for executable model, base, and adapter tensors.
- Unused shape entries are zero.
- Logical elements equal the checked product of used dimensions.
- The product must fit `u64`, the format file limit, and runtime policy.
- Arbitrary strides are not stored in SLM2 `2.0`.
- Every tensor is canonical contiguous row-major in the tensor’s logical axis order.
- Architecture metadata defines semantic axis meanings where necessary.

Eliminating arbitrary strides prevents aliased views, negative strides, overlapping views, and disagreements over whether a payload describes a storage buffer or logical tensor.

**[Engineering recommendation] Dense size rule.**

\[
\text{payload\_length}
=
\text{stored\_bytes}
=
\text{logical\_elements}
\times
\text{bytes\_per\_element}
\]

using checked multiplication. Dense tensors have `quant_profile_index = 0xffff`; all block, scale, zero-point, packing, and tail fields are zero.

Initial dense element IDs should cover only exact wire encodings:

| ID | Encoding |
|---:|---|
| `1` | IEEE 754 binary32 |
| `2` | IEEE 754 binary16 |
| `3` | bfloat16 |
| `4` | signed 8-bit integer |
| `5` | unsigned 8-bit integer |
| `6` | signed 16-bit integer |
| `7` | unsigned 16-bit integer |
| `8` | signed 32-bit integer |
| `9` | unsigned 32-bit integer |
| `10` | signed 64-bit integer |
| `11` | unsigned 64-bit integer |

All multi-byte element payloads are little-endian. Additional floating formats require new exact IDs and test vectors; they must not be inferred from a metadata string.

### Blob descriptor

**[Engineering recommendation] Fixed 96-byte record.**

```text
Offset  Size  Field
0       2     record_version = 1
2       2     blob_kind
4       4     flags
8       4     canonical_name_string_id
12      4     media_type_string_id
16      8     payload_relative_offset
24      8     payload_length
32      8     logical_length
40      4     alignment
44      2     codec = 0
46      2     reserved_0 = 0
48      32    content_hash
80      4     auxiliary_first
84      4     auxiliary_count
88      8     reserved_1 = 0
```

For SLM2 `2.0`, `codec` must be zero and `logical_length == payload_length`. Blob records are sorted by `(blob_kind, canonical_name_bytes)`.

### Auxiliary binding descriptor

**[Engineering recommendation] Fixed 32-byte record.**

```text
Offset  Size  Field
0       4     owner_descriptor_index
4       2     auxiliary_kind
6       2     flags
8       4     target_descriptor_index
12      4     axis, signed; -1 means not applicable
16      4     group_size
20      4     block_stride
24      8     reserved = 0
```

The class schema states whether an index addresses the tensor or blob table. Auxiliary records are sorted by owner, kind, target, axis. Duplicate records, self-reference unless specifically permitted, cycles in relationships declared acyclic, and targets of the wrong class are fatal.

### Quantization identity

**[Observed public fact]** Existing model ecosystems show that a short label such as “Q4” is insufficient: GGML-family encodings use different block sizes, scales, minima, superblocks, codebooks, and packing structures under multiple low-bit families. The published `block_q4_0` example uses 32 values, a half-precision scale, and packed nibbles, while other four-bit families use different superblock structures. citeturn15view15

**[Observed public fact]** ONNX’s quantization operators separately define scale, zero point, saturation, granularity, and dequantization formula, demonstrating that bit width alone does not determine an encoding. citeturn16view10turn16view11

**[Engineering recommendation] Fixed 128-byte quantization profile.**

```text
Offset  Size  Field
0       32    profile_id
32      4     canonical_name_string_id
36      2     profile_version
38      2     flags
40      2     storage_type
42      2     decoded_type
44      2     accumulator_type
46      2     code_bits
48      4     block_elements
52      4     block_bytes
56      2     code_count_per_block
58      1     code_signedness
59      1     packing_order
60      2     scale_type
62      2     scale_count_per_block
64      2     scale_placement
66      2     zero_point_type
68      2     zero_point_count_per_block
70      2     zero_point_placement
72      2     codebook_kind
74      2     tail_rule
76      2     rounding_mode
78      2     saturation_mode
80      2     kernel_contract
82      2     auxiliary_mask
84      2     calibration_mode
86      2     reserved_0 = 0
88      32    calibration_identity
120     8     reserved_1 = 0
```

`profile_id` is recomputed as:

```text
H(
  domain = "quant-profile",
  field("name", canonical profile-name bytes),
  field("record", bytes 36..127)
)
```

A mismatch is fatal.

**[Engineering recommendation] Required precision.** A profile must unambiguously bind:

- Number of logical values per block.
- Exact bytes per block.
- Number of stored codes.
- Bit numbering and byte packing.
- Low-nibble-first or high-nibble-first convention.
- Signed, unsigned, biased, sign-magnitude, or codebook interpretation.
- Scale type and byte order.
- Number and position of scales.
- Zero-point or minimum representation and position.
- Codebook identity and ordering.
- Tail policy.
- Rounding and saturation used by the packer.
- Expected decoded type.
- Accumulator type and kernel contract.
- Calibration recipe identity or all-zero declaration.
- Every auxiliary tensor needed for scales, codebooks, sparse indices, or importance data.

**[Engineering recommendation] Tail rules.**

| Value | Meaning |
|---:|---|
| `0` | Tail forbidden; logical elements must be divisible by block size |
| `1` | Final stored block is full-sized and unused decoded lanes are canonical zeros |
| `2` | Final full-sized block contains a canonical valid-count field defined by the exact profile |
| Other | Unsupported in `2.0` |

For rule `1`:

\[
\text{blocks} =
\left\lceil
\frac{\text{logical\_elements}}{\text{block\_elements}}
\right\rceil
\]

\[
\text{stored\_bytes} =
\text{blocks} \times \text{block\_bytes}
\]

All operations are checked. Readers validate that padded lanes decode to the profile’s canonical zero representation where validation is computationally bounded. Odd-tail golden tests are mandatory.

**[Engineering recommendation] Capability proof.** Runtime support is not inferred from `code_bits`, display names, or approximate similarity. Before activation, the runtime looks up the exact `profile_id` in a compiled capability registry and verifies that every repeated descriptor field equals the registry entry. The registry entry identifies native CPU kernels, Wasm kernels, and optional WebGPU kernels independently. Lack of an exact backend capability is a deterministic `UnsupportedQuantProfile` failure.

**[Engineering recommendation] Range safety.** Before payload allocation or mapping, the validator proves:

- `payload_relative_offset + payload_length` does not overflow.
- The absolute range lies within the declared payload section.
- Payload ranges are in canonical descriptor order.
- Each range begins at its required alignment.
- Each range starts at the first canonical aligned offset after its predecessor.
- No two ranges overlap or alias.
- `stored_bytes == payload_length`.
- Dense and quantized size formulas hold.
- Tensor and blob hashes are present and nonzero.
- No payload range reaches padding, tables, or trailing space.

## Tokenizer, chat-template, adapter, composition, and cryptographic identities

### Tokenizer contract

**[Observed public fact]** Tokenizer implementations such as SentencePiece bind more than a vocabulary: public model definitions include normalization behavior and precompiled normalization mappings, and the project describes the model as carrying normalization rules and vocabulary information. citeturn14search3turn14search7turn14search10

**[Engineering recommendation] Separate tokenizer artifact.** The executable tokenizer is a separately hashed SLM2 artifact. A model or composition references its exact identity. This prevents a model file’s tensor identity from silently changing when tokenizer metadata is corrected and prevents two tokenizers with the same display name from being treated as equivalent.

The tokenizer manifest must define:

- Tokenizer model kind: exact closed enum such as byte-level BPE, Unicode BPE, unigram, WordPiece, or explicit table model.
- Token-ID range and vocabulary count.
- Exact token bytes for every ID; token byte strings need not be valid UTF-8.
- Merge pairs or unigram scores in canonical order.
- Normalization pipeline from a closed operation registry.
- Pre-tokenization pipeline from a closed operation registry.
- Added tokens and flags: special, single-word, left-strip, right-strip, normalized or raw.
- Exact special-token roles and IDs.
- BOS, EOS, PAD, UNK, separator, mask, and beginning/end-of-turn semantics.
- Whether BOS/EOS are automatically inserted and at which stage.
- Byte-fallback mapping.
- Whitespace marker semantics.
- Unknown-input behavior.
- Decoder cleanup rules.
- Generation-stop token sets and, if supported, exact byte-stop sequences.
- Maximum input expansion and bounded normalization work.

Recommended blob kinds are:

```text
tokenizer.vocabulary
tokenizer.merges
tokenizer.unigram_table
tokenizer.normalizer_table
tokenizer.byte_fallback
tokenizer.added_tokens
```

Every blob has its own content hash, while the tokenizer artifact identity commits to their ordered descriptor identities and hashes.

**[Engineering recommendation] Normalization safety.** General regular expressions, locale-dependent case conversions, dynamically loaded rule files, and user code are forbidden. The normalizer consists of closed, versioned operations such as identity, NFC, NFKC when explicitly declared, lowercase using a pinned Unicode mapping, whitespace mapping, bounded replacement trie, byte fallback, and fixed prefix/suffix insertion. Each operation has deterministic input/output and an expansion bound.

### Chat-template contract

**[Engineering recommendation] Declarative template artifact.** Chat formatting belongs in a separate `chat_template` artifact, bound by the composition. It should be represented as a canonical, typed AST or compact bytecode with a closed instruction set:

```text
emit_literal(blob_id)
emit_role
emit_content
emit_token(token_id)
if_role(role, block)
if_present(field, block)
for_each_message(block)
emit_generation_marker
stop
```

Constraints:

- No arbitrary expressions.
- No property lookup outside a closed message schema.
- No JavaScript, Python, Wasm, shell, network, filesystem, clock, environment, or randomness.
- No recursion.
- Looping only over the bounded message list.
- Maximum instruction count, literal bytes, nesting depth, and output expansion.
- Unknown opcode is fatal.
- The template declares exactly which message roles and optional fields it accepts.
- Tool-call support, if later needed, requires a new closed schema and critical extension, not generic JSON execution.

The template identity hashes the canonical AST bytes, required tokenizer ID, instruction-set version, role schema, generation-marker behavior, and stop policy.

### Adapter and composition binding

**[Engineering recommendation] Tensor-layout identity.** Define a base tensor-layout identity independent of payload bytes:

```text
tensor_layout_id = H(
  "tensor-layout",
  architecture_semantic_manifest_hash,
  ordered tensor semantic keys,
  ordered shapes,
  ordered element or quant profile IDs,
  ordered auxiliary relationship semantics
)
```

An adapter commits to this layout ID and the exact target tensor keys. It may additionally require the exact base model ID and whole-file ID.

**[Engineering recommendation] Adapter operation records.** Each operation declares:

- Operation kind, such as exact LoRA, additive delta, multiplicative vector, gated route, or another registered critical extension.
- Target semantic tensor key.
- Expected target shape and layout.
- Adapter tensor keys.
- Axis semantics.
- Rank.
- Scaling factor as a canonical rational `(signed_numerator, positive_denominator)`, not a metadata float.
- Accumulation type.
- Application order.
- Merge behavior, if offline merge is permitted.
- Required kernel-contract ID.

A runtime rejects a composition on the first deterministic dependency error in manifest order: missing dependency, wrong artifact class, whole-file mismatch, model-ID mismatch, layout mismatch, tokenizer mismatch, duplicate adapter, unsupported operation, target missing, target shape mismatch, quant mismatch, or runtime capability mismatch.

### Identity hierarchy

**[Engineering recommendation] Framed hash primitive.**

All SLM2 semantic IDs use:

```text
SLM_HASH(domain, fields) =
    BLAKE3-256(
        "SLM2-HASH\0"                       // 10 bytes
        || u16le(domain_byte_length)
        || domain_utf8
        || u32le(field_count)
        || for each field:
             u16le(field_type)
             || u64le(field_byte_length)
             || field_bytes
    )
```

- Domains are lowercase ASCII identifiers.
- Field order is specified for each identity.
- Field type distinguishes raw bytes, UTF-8 identifiers, fixed integers, digests, and ordered digest lists.
- No field is omitted implicitly; absence is represented by a specified zero-length field or explicit presence flag.
- No string concatenation without lengths is used.
- Digest encodings are raw 32-byte values inside hash inputs, not hexadecimal text.

This framing prevents concatenation ambiguity and cross-purpose substitution.

**[Engineering recommendation] Distinct identities.**

| Identity | Exact subject |
|---|---|
| Whole-file hash | Every byte from offset zero through `file_size − 1`; stored externally or in a referring artifact |
| Manifest hash | Exact deterministic CBOR manifest bytes |
| Semantic-manifest hash | Canonical class-defined projection excluding nonsemantic public annotations |
| Tensor payload hash | Raw stored tensor payload bytes, domain-bound to descriptor semantics |
| Blob hash | Raw blob payload bytes, domain-bound to blob kind |
| Chunk hash | Piece index, actual piece length, and piece bytes |
| Model identity | Class, semantic manifest, tensor-layout ID, ordered tensor payload hashes, ordered blob hashes if class permits |
| Composition identity | Exact base, tokenizer, template, ordered adapters, route policy, requirements, and KV identity |
| Piece-set identity | Subject whole-file hash, file size, piece size, count, ordered piece hashes, and Merkle root |
| Source-revision identity | Forge/repository namespace, canonical repository identity, commit object ID, subpath, submodule state, and optional source tree hash |
| Display name | Nonidentity catalog annotation |

The whole-file hash is not embedded in its own file. It appears in the piece-set, signature, provenance, receipt, local store index, or catalog announcement.

**[Engineering recommendation] Tensor hash.**

```text
tensor_payload_hash = SLM_HASH(
  "tensor-payload",
  artifact_class,
  semantic_role,
  canonical_name,
  shape_encoding,
  element_type,
  quant_profile_id_or_zero,
  logical_element_count,
  payload_bytes
)
```

Binding descriptor semantics into this digest prevents a payload’s raw bytes from being substituted under a different shape or quantization interpretation. A separate raw-content chunk hash still supports byte-level deduplication.

**[Engineering recommendation] Model identity.**

```text
model_id = SLM_HASH(
  "model",
  artifact_class,
  semantic_manifest_hash,
  tensor_layout_id,
  ordered tensor_payload_hash list,
  ordered permitted blob_hash list
)
```

A display-name change in a catalog announcement does not change `model_id`. Any change to executable architecture semantics, tensor interpretation, or tensor bytes does.

**[Engineering recommendation] Composition identity.**

```text
composition_id = SLM_HASH(
  "composition",
  base_model_id,
  base_whole_file_hash,
  tokenizer_id,
  chat_template_id,
  ordered_adapter_id_list,
  route_policy_hash,
  runtime_requirements_hash,
  generation_policy_hash,
  kv_compatibility_id
)
```

An ordered list is encoded as count followed by exactly 32 bytes per identity inside one framed field. Wrong order necessarily changes the digest.

## Chunking, Merkle proofs, signatures, provenance, loading, and resources

### Fixed-piece transfer and storage

**[Observed public fact]** BitTorrent v2 uses Merkle roots and piece layers to support piece-level verification. RFC 9162 defines an ordered Merkle construction with distinct leaf and internal-node prefixes and a unique recursive split at the largest power of two below the list length. citeturn16view8turn17view6

**[Engineering recommendation] Fixed chunks over content-defined chunks.** SLM2 `2.0` should use fixed **4 MiB** pieces for P2P transfer and shared storage.

Fixed pieces are preferred because they provide:

- Constant-time offset-to-piece mapping.
- Straightforward browser `Blob.slice()` or positional OPFS reads.
- Simple range requests and resumability.
- No rolling-hash implementation or cross-implementation boundary differential.
- Deterministic piece identity from file offset.
- Predictable proof sizes and bitmaps.
- Easy multi-peer mixing under one piece-set identity.

Content-defined chunking can improve deduplication when large files shift internally, but it adds a rolling fingerprint, min/max cut policy, seed/polynomial identity, adversarial boundary behavior, and more difficult independent implementation. Model repacks often alter quantized bytes globally, limiting the practical benefit. Content-defined chunking should therefore be deferred to a future piece-set version rather than made optional inside the baseline.

**[Engineering recommendation] Piece rules.**

- Baseline `piece_size = 4,194,304`.
- Piece count:

\[
n =
\left\lceil
\frac{F}{P}
\right\rceil
\]

for nonempty file size \(F\) and piece size \(P\).

- Pieces are indexed `0..n−1`.
- Every nonfinal piece is exactly `P` bytes.
- Final piece length is:

\[
F - P(n-1)
\]

and is in `1..=P`.
- Empty SLM2 artifacts are impossible because the header alone is nonempty.
- Piece offsets are `index × P` with checked multiplication.

**[Engineering recommendation] Piece hash.**

```text
piece_hash_i = SLM_HASH(
  "piece",
  subject_whole_file_size_u64,
  piece_size_u32,
  piece_index_u64,
  actual_piece_length_u32,
  piece_bytes
)
```

**[Engineering recommendation] Merkle root.**

```text
leaf_i = SLM_HASH(
  "piece-leaf",
  piece_index_u64,
  actual_piece_length_u32,
  piece_hash_i
)

node(left, right) = SLM_HASH(
  "piece-node",
  left_digest,
  right_digest
)
```

The tree uses RFC 9162’s largest-power-of-two recursive split and never duplicates the final leaf. RFC 9162’s distinct leaf/node hashing demonstrates why domain separation is required and why non-power-of-two tree shape must be specified rather than left to convention. citeturn17view6

**[Engineering recommendation] Flat list and root.** A piece-set carries both the ordered flat piece-hash list and Merkle root for baseline-scale artifacts. The flat list permits immediate expected-hash lookup without proof exchange; the root provides a compact signed commitment and future proof interoperability. At 4 MiB pieces, even a 256 GiB file has 65,536 pieces and a 2 MiB raw hash list, within the piece-set blob cap.

**[Engineering recommendation] Multi-peer mixing.** Pieces from different peers may be combined only when every peer advertises the same `piece_set_id`. Each received piece is:

1. Written to a staging object at its exact offset.
2. Hashed with its index and length.
3. Compared to the expected piece hash.
4. Marked verified in a durable bitmap only after the write is flushed according to storage policy.
5. Quarantined and attributed to the peer on mismatch.

A bad piece does not poison already verified pieces. Repeated mismatches can suppress that peer locally, but peer reputation is not part of artifact identity.

**[Engineering recommendation] Final promotion.** After all pieces verify, the receiver streams the complete staged file to compute its whole-file hash, runs full SLM2 validation, checks signatures and policy, and only then promotes it atomically. Per-piece success is not enough: it proves consistency with the piece set, while the whole-file and SLM identities prove consistency with the announced artifact.

A normal user-selected local file does not need to be rechunked before parsing. It enters the same structural, hash, dependency, policy, and activation pipeline. A piece-set can be computed later for storage or sharing.

### Signatures and provenance

**[Observed public fact]** RFC 8032 specifies Ed25519 and related EdDSA variants. Sigstore bundles illustrate detached verification material and optional transparency-log inclusion evidence. TUF demonstrates that trusted key sets, key replacement, and revocation require signed metadata and policy beyond a signature embedded in a target file. citeturn15view10turn15view12turn15view11

**[Engineering recommendation] Detached signature envelope.** Signatures are never embedded in the signed subject. Embedding creates self-reference, complicates reproducibility, and entangles content identity with key rotation. A signature envelope contains:

```text
schema
subject_kind
subject_id
subject_whole_file_hash
statement_type
statement_hash
signature_scheme = ed25519
public_key
key_id
signature
signed_at
expires_at
trust_policy_epoch
optional transparency_log_entries
optional previous_key_statement
```

The signature input is:

```text
SLM_HASH(
  "signature-statement",
  statement_type,
  subject_kind,
  subject_id,
  subject_whole_file_hash,
  statement_hash,
  signed_at,
  expires_at,
  trust_policy_epoch
)
```

`key_id` is a domain-separated hash of the exact public-key algorithm and bytes.

**[Engineering recommendation] Key policy.**

- Publisher keys are authorized through separately signed catalog trust metadata.
- Rotation requires an overlap or cross-signature policy, or an offline-root-authorized update.
- Revocation is prospective unless policy explicitly records compromise time.
- Expiry is evaluated against trusted time policy; an untrusted local clock cannot by itself establish historic validity.
- Transparency-log inclusion can show that a signing event was logged under the log’s trust assumptions; it does not make the signed statement true. Sigstore similarly treats log entries as proof of public-log recording and provides time-related verification material. citeturn15view12
- The browser and companion must use the same statement bytes, key IDs, and trust-policy snapshot.

**[Engineering recommendation] What a signature proves.** A valid signature proves that the holder of the corresponding private key signed the exact framed statement. Depending on key authorization and log evidence, it may support a claim that an authorized publisher made that statement during a validity interval.

It does not prove:

- The signer had legal rights to the source or training data.
- License interpretation is correct.
- Conversion was accurate.
- The model is safe, unbiased, truthful, or high quality.
- The source repository was uncompromised.
- The model lacks malicious tensors or trigger behavior.
- An evaluation receipt is representative or independently reproduced.

**[Engineering recommendation] Provenance record.** A `license_provenance` artifact should carry:

- Exact subject IDs.
- Source repository and commit identities.
- Source tensor hashes.
- Tokenizer/config source identities.
- Submodule and large-file-object identities.
- Converter source commit and binary hash.
- Toolchain versions.
- Quantization profile and calibration identity.
- Reproducibility flags and disclosed nondeterminism.
- SPDX license expressions and notice-blob hashes.
- Conversion receipt identity.
- Optional upstream signatures or attestations.

SPDX 3.0.1 is a current versioned specification suitable as a source for standardized licensing vocabulary, while SLSA provenance provides a model for recording where, when, and how an artifact was produced. SLM2 need not adopt either entire schema; it should pin the exact subset it imports. citeturn16view6turn16view7

### Compression policy

**[Engineering recommendation] No additional compression in SLM2 `2.0`.**

- Quantized tensor blocks are stored directly in their execution-oriented representation.
- Whole-file compression is forbidden.
- Per-tensor generic compression is forbidden.
- Per-piece compression is forbidden.
- Entropy-coded payloads are forbidden.
- Sparse representations are allowed only as exact registered tensor encodings with explicit index/value semantics, not as generic compression.
- A future codec would require a new critical format feature with independent compressed and uncompressed lengths, bounded decoder memory, exact codec/version identity, and independent hashes.

The reasons are architectural:

| Technique | Scratch and CPU | Random access | Corruption radius | Browser burden | P2P/deduplication | Decision |
|---|---|---|---|---|---|---|
| Direct quantized blocks | Minimal | Excellent | Tensor or piece | Lowest | Stable bytes | Adopt |
| Whole-file compression | Potentially large | Lost without full decode/index | Whole file | High | Small changes can alter much of stream | Reject |
| Per-chunk compression | One decoded chunk plus codec state | Piece-level | Piece | Medium/high | Codec/version alters IDs | Reject in `2.0` |
| Entropy coding | Decoder tables and bitstream state | Weak | Block or stream | High | Often unstable across encoders | Reject |
| Sparse encoding | Depends on exact structure | Can be good if indexed | Tensor/block | Kernel-specific | Semantic representation may deduplicate | Permit only as exact tensor profile |
| No added compression | No decode scratch | Best | Piece/tensor | Lowest | Best deterministic sharing | Adopt |

Transfer bytes, file bytes, logical decoded tensor bytes, CPU resident bytes, and GPU resident bytes must be reported separately. A smaller compressed transfer is not a smaller executable model image.

### Native, browser, OPFS, Wasm, and WebGPU loading

**[Observed public fact]** The browser File API exposes selected file objects and byte access. The File System Standard and OPFS APIs expose file operations and positional reads/writes; synchronous access handles are limited to OPFS files in dedicated workers. These specifications do not expose operating-system-style memory mapping of an arbitrary user-selected file. citeturn16view4turn15view6turn15view7

**[Observed public fact]** WebGPU queue `writeBuffer` issues a write of supplied data into a GPU buffer. This is an upload operation, not a standards-level guarantee that arbitrary file-backed pages become GPU-visible without copying. citeturn15view9

**[Engineering recommendation] Honest terminology.**

- **Native zero-copy CPU view** means tensor payload bytes are accessed through a read-only mapping or equivalent file-backed view after validation. It does not mean no disk-to-page-cache transfer and does not imply GPU zero-copy.
- **Copy-once** means bytes move from file or browser source into their final CPU/Wasm storage once, excluding unavoidable operating-system, browser, IPC, or GPU-driver internal copies.
- **Streamed validation** means bounded windows are read, validated, and discarded while maintaining incremental hash state.
- **Streamed GPU loading** means one tensor or chunk is read into bounded staging memory, verified, uploaded, and released. It does not mean weights can always be executed before the complete activation transaction commits.
- **Browser file view** must not be called memory mapping.

**[Engineering recommendation] Native path.**

1. Open a stable file handle.
2. Obtain size from the handle.
3. Parse and validate header/tables with positional reads.
4. Hash through the same handle.
5. Detect size or identity change before commit.
6. Either:
   - read-only-map the immutable staged file and expose validated tensor ranges, or
   - allocate final aligned weight storage and `pread` each tensor once.
7. Upload to GPU only after hash and capability checks.

Mapping is appropriate only after the file is in an immutable or privately controlled staged location. Directly mapping a user-modifiable path creates a time-of-check/time-of-use risk.

**[Engineering recommendation] Browser `File` path.** Use `File.size`, bounded `slice()` ranges, and `arrayBuffer()` or streaming reads. Parse small tables first. Hash and upload in windows. Do not call `arrayBuffer()` on the whole artifact unless an explicit size policy proves that the resulting peak memory is acceptable.

**[Engineering recommendation] OPFS path.** Receive peer pieces into a private staging file. Perform positional worker reads using `FileSystemSyncAccessHandle` where supported. Maintain a separate generation record or manifest pointer for active artifacts. The standard’s permission, quota, and partial-write behavior must be treated as fallible; a flush or close failure cannot promote a candidate. citeturn17view9

**[Engineering recommendation] JavaScript and Wasm memory.** A JavaScript `Uint8Array` may be a view over an `ArrayBuffer`, but passing external file bytes into Wasm linear memory commonly requires an explicit copy unless the application’s buffer ownership and Wasm memory design deliberately share the same backing memory. Even then, browser API steps may copy. The implementation should measure and document each boundary rather than advertise universal zero-copy.

WebAssembly 3.0 was published on July 28, 2026, but SLM2 should target an explicitly tested browser/Wasm feature baseline rather than assuming every current specification feature is deployed across target browsers. citeturn16view3

### Resource formulas

Let:

- \(F\): SLM2 file size.
- \(C\): logical bytes of an executable composition.
- \(H\): fixed header, metadata, strings, and descriptor tables retained in memory.
- \(B\): streaming read/hash window.
- \(W\): CPU-resident weight bytes.
- \(R\): resident file-backed pages of a native mapping.
- \(J\): JavaScript-to-Wasm bridge duplication.
- \(S\): host-side GPU upload staging.
- \(G\): GPU-resident weights.
- \(A\): runtime activations and temporary compute buffers.
- \(K\): KV-cache memory.
- \(n\): piece count.
- \(Q\): decoder scratch, zero in SLM2 `2.0`.

**[Engineering recommendation] Native mapping.**

Virtual address commitment is approximately:

\[
V_\text{native-map} \approx F + H + A + K
\]

Resident steady memory is approximately:

\[
M_\text{native-map,steady}
\approx H + R + A + K
\]

Hashing transiently adds:

\[
M_\text{transient} \approx B
\]

The full mapping size is not automatically resident memory.

**[Engineering recommendation] Native copy-once.**

\[
M_\text{native-copy,peak}
\approx H + B + W + A + K
\]

If conversion from stored blocks to a second execution representation is required, add the converted weight size and one conversion window; such conversion means the artifact was not natively executable by that backend and must be reported.

**[Engineering recommendation] Browser CPU/Wasm.**

\[
M_\text{browser-cpu,peak}
\approx H + B + J + W + A + K + Q
\]

For SLM2 `2.0`, \(Q=0\). `J` may range from near zero in a carefully shared design to approximately one read window or tensor.

**[Engineering recommendation] Streamed WebGPU upload without retained CPU weights.**

Host peak:

\[
M_\text{host,peak}
\approx H + B + J + S + A + K
\]

Device steady state:

\[
M_\text{device,steady}
\approx G + A_\text{gpu} + K_\text{gpu}
\]

If CPU weights remain resident, add \(W\) to host steady state.

**[Engineering recommendation] Peer staging.**

Durable staging storage:

\[
D_\text{staging} \approx F + 32n + \left\lceil\frac{n}{8}\right\rceil + D_\text{journal}
\]

Memory:

\[
M_\text{p2p}
\approx H + B + 32n + M_\text{proof}
\]

A Merkle-proof-only mode could reduce the retained hash list, but the baseline flat-list piece set favors simpler independent implementation.

## Bounded validation, fail-atomic activation, reproducible packing, and threat model

### Multi-pass validator

**[Engineering recommendation] No large allocation before structural proof.** The validator uses small fixed buffers until the header establishes bounded section lengths. It never allocates according to an unchecked count. Counts are checked against both format and implementation limits before `count × record_size` is computed.

**[Engineering recommendation] Deterministic failure order.**

1. Source I/O failure or unavailable size.
2. File-size format/policy limit.
3. Truncated fixed header.
4. Magic.
5. Format identity.
6. Major/minor version.
7. Header size.
8. Byte-order marker.
9. Artifact class.
10. Flags and reserved bytes.
11. Declared file-size mismatch.
12. Section count and record-size constraints.
13. Checked section-size arithmetic.
14. Canonical section order and alignment.
15. Section bounds and payload bounds.
16. Zero padding.
17. Canonical metadata encoding.
18. Metadata schema and class rules.
19. String table.
20. Quantization table.
21. Tensor descriptors.
22. Blob descriptors.
23. Auxiliary relationships.
24. Payload range ordering and overlap.
25. Runtime capability and dependency closure.
26. Tensor/blob payload hashes.
27. Whole-file and piece-set identities.
28. Signature and provenance policy.
29. License policy.
30. Quality-receipt policy.
31. Runtime resource construction.
32. Atomic activation commit.

This ordering makes failures reproducible across native and Wasm readers and prevents an attacker from causing expensive hashing before cheap structural rejection.

**[Engineering recommendation] Pseudocode.**

```rust
fn validate_candidate<R: RandomRead>(
    source: &R,
    policy: &Policy,
    caps: &Capabilities,
) -> Result<ValidatedCandidate, Error> {
    let actual_size = source.size()?;
    require(actual_size >= HEADER_SIZE)?;
    require(actual_size <= MAX_EXACT_JS_INTEGER)?;
    require(actual_size <= policy.max_file_size)?;

    let raw_header = source.read_exact_at(0, HEADER_SIZE)?;
    let h = Header::decode_le_without_casts(&raw_header)?;

    require(h.magic == SLM2_MAGIC)?;
    require(h.format_id == SLM2_FORMAT_ID)?;
    require(h.header_size == HEADER_SIZE)?;
    require(h.version_major == 2)?;
    require(h.version_minor == 0)?;
    require(h.byte_order_marker == 0x0102_0304)?;
    require(is_known_artifact_class(h.artifact_class))?;
    require(h.flags == 0)?;
    require(all_zero(h.reserved))?;
    require(h.file_size == actual_size)?;

    let manifest_range = checked_section(
        h.manifest_offset,
        h.manifest_length,
        actual_size,
        policy.max_manifest,
    )?;

    let string_range = checked_section(
        h.string_table_offset,
        h.string_table_length,
        actual_size,
        policy.max_string_table,
    )?;

    let quant_bytes = checked_mul_u64(h.quant_count, h.quant_record_size)?;
    require(h.quant_count <= policy.max_quant_profiles)?;
    require(
        h.quant_count == 0 ||
        h.quant_record_size == QUANT_RECORD_SIZE
    )?;
    let quant_range = checked_optional_section(
        h.quant_table_offset,
        quant_bytes,
        actual_size,
    )?;

    let tensor_bytes = checked_mul_u64(
        h.tensor_count,
        h.tensor_record_size,
    )?;
    require(h.tensor_count <= policy.max_tensors)?;
    require(
        h.tensor_count == 0 ||
        h.tensor_record_size == TENSOR_RECORD_SIZE
    )?;
    let tensor_range = checked_optional_section(
        h.tensor_table_offset,
        tensor_bytes,
        actual_size,
    )?;

    // Repeat for blob and auxiliary tables.

    validate_canonical_section_order_and_alignment(
        HEADER_SIZE,
        [
            manifest_range,
            string_range,
            quant_range,
            tensor_range,
            blob_range,
            auxiliary_range,
            payload_range,
        ],
    )?;

    validate_all_intersection_gaps_are_zero(source, section_ranges)?;
    require(payload_range.end == actual_size)?;

    // Only now allocate bounded metadata/table buffers.
    let manifest_bytes = source.read_bounded(manifest_range)?;
    let manifest = parse_slm_dcbor_1(
        &manifest_bytes,
        policy.cbor_limits,
    )?;
    validate_manifest_schema(&manifest, h.artifact_class)?;

    let strings = parse_and_validate_string_table(
        source.read_bounded(string_range)?,
        policy.string_limits,
    )?;

    let quant_profiles = parse_quant_profiles_bounded(
        source,
        quant_range,
        &strings,
    )?;
    validate_quant_profile_ids(&quant_profiles, &strings)?;

    let tensors = parse_tensor_records_bounded(
        source,
        tensor_range,
    )?;
    let blobs = parse_blob_records_bounded(
        source,
        blob_range,
    )?;
    let auxiliaries = parse_aux_records_bounded(
        source,
        auxiliary_range,
    )?;

    validate_descriptor_sorting_and_uniqueness(
        &tensors,
        &blobs,
        &strings,
    )?;
    validate_shapes_and_sizes(&tensors, &quant_profiles)?;
    validate_auxiliary_graph(
        &tensors,
        &blobs,
        &auxiliaries,
    )?;
    validate_canonical_payload_ranges(
        payload_range,
        &tensors,
        &blobs,
    )?;

    let plan = resolve_dependencies_and_capabilities(
        &manifest,
        &tensors,
        &quant_profiles,
        caps,
    )?;

    // Hashes are streamed while candidate remains inactive.
    stream_verify_payload_hashes(source, &tensors, &blobs)?;
    let whole_file_hash = stream_whole_file_hash(source)?;
    verify_declared_external_identities(
        whole_file_hash,
        &manifest,
    )?;

    Ok(ValidatedCandidate {
        header: h,
        manifest,
        strings,
        quant_profiles,
        tensors,
        blobs,
        auxiliaries,
        plan,
        whole_file_hash,
    })
}
```

Every helper returns an error; none panics on input. `checked_add`, `checked_mul`, checked alignment, checked conversions to `usize`, and explicit maximum comparisons are mandatory.

### Fail-atomic activation

**[Engineering recommendation] State machine.**

```text
RECEIVING
  -> QUARANTINED_COMPLETE
  -> STRUCTURALLY_VALID
  -> CONTENT_VALID
  -> DEPENDENCIES_VALID
  -> POLICY_VALID
  -> RUNTIME_STAGED
  -> ACTIVE
```

No state is skipped. `ACTIVE` is reached through one commit operation.

**[Engineering recommendation] Activation transaction.**

1. Keep the existing active composition, conversation, tokenizer, KV cache, and GPU resources untouched.
2. Validate the candidate and dependency closure.
3. Construct a separate candidate runtime context.
4. Allocate and upload candidate resources into candidate-owned handles.
5. Run required backend smoke checks.
6. Confirm signatures, license/provenance, and required evaluation-receipt references.
7. Create a new empty or explicitly migrated conversation/KV context; never mutate the existing one before commit.
8. Atomically swap the active-context pointer.
9. Only after the swap succeeds, retire old resources according to reference counts.

A failure at any earlier point destroys candidate resources and preserves the old context exactly.

**[Engineering recommendation] Crash behavior.**

| Crash point | Recovery |
|---|---|
| During peer receipt | Resume only verified pieces from durable bitmap; rehash uncertain last piece |
| After all pieces but before validation | Candidate remains quarantined |
| During structural or hash validation | Delete or retain as failed quarantine according to bounded policy |
| During native staged-file flush | No catalog/store promotion |
| During OPFS staging | Generation remains inactive; incomplete object is garbage-collectable |
| During GPU upload | Candidate GPU handles are discarded; old context remains |
| After runtime staged but before pointer swap | Candidate is inactive and recoverable or discarded |
| During pointer publication | Use a generation number and checksum so recovery chooses the last complete committed generation |
| After active swap but before old cleanup | Both generations may remain stored; only the new generation is active |

On native filesystems, durable promotion should use a private temporary file, flush file contents, atomic rename within one filesystem, and directory synchronization where supported. In OPFS, use a content object plus a small generation/pointer record written last; do not assume a multi-file transactional rename.

### Reproducible packer

**[Engineering recommendation] Deterministic inputs.** The pack receipt binds:

- Source repository identity and commit.
- Submodule commits and large-file object hashes.
- Source tensor file hashes.
- Source configuration hash.
- Tokenizer artifact identity.
- Converter source commit and executable hash.
- Rust compiler and target triple.
- Linker and build flags.
- Quantization profile IDs.
- Calibration dataset or statistic identity.
- Deterministic seed.
- Thread-count policy.
- Floating-point environment and rounding mode.
- Tensor sorting rule.
- Metadata schema version.
- Unicode data version.
- Padding and alignment policy.
- Expected output model and whole-file IDs.

**[Engineering recommendation] Normalization rules.**

- Tensor input order is ignored; tensors are sorted canonically.
- Hash-map iteration never determines output.
- Filesystem enumeration is sorted by normalized relative identifier.
- Wall-clock timestamps are omitted from the hashed artifact.
- A human timestamp may appear in a detached provenance record.
- All padding is zero.
- Metadata is SLM-DCBOR-1.
- String-table entries are sorted.
- Quant records are sorted by profile ID or canonical name according to one fixed rule.
- Floating quantization uses an explicitly specified rounding mode.
- Parallel reductions use deterministic partitioning and reduction order.
- GPU-based calibration is prohibited unless the exact kernel/device result is treated as an input hash and reproducibility is declared limited.
- Source tensor NaNs are either rejected or preserved under an explicit source-data policy; metadata floats and NaNs remain forbidden.

**[Engineering recommendation] Two-level reproducibility result.**

- **Byte reproducible:** independent runs from the same declared inputs produce the same whole-file hash.
- **Semantically reproducible:** output model identity and numeric test behavior match, but nonsemantic detached records may differ.

Catalog promotion should require byte reproducibility for the canonical pack whenever the converter and source inputs permit it. Any accepted nondeterminism must be explicitly recorded, bounded, and reviewed.

### Malicious-input threat model and parser limits

| Threat | Required defense |
|---|---|
| Integer overflow and offset wrap | Checked arithmetic before conversion or allocation; file cap below `2^53` |
| Negative interpretation of unsigned fields | Typed decoding; no native casts |
| Overlapping or aliased tensors | Canonical monotonic payload placement; exact predecessor-derived offsets |
| Allocation bomb | Count, byte, depth, and runtime policy limits before allocation |
| Giant metadata | 4 MiB maximum plus item/depth/map limits |
| Deeply nested structures | Maximum depth 16; iterative or recursion-bounded parser |
| Duplicate CBOR keys | Reject during parse |
| Duplicate tensor names or semantic keys | Strict sorted uniqueness |
| Invalid UTF-8 | Reject before normalization or comparison |
| Non-NFC text | Reject; never silently normalize an admitted file |
| Unicode spoofing | ASCII machine identifiers; Unicode security checks for displayed catalog text |
| Metadata NaN or infinity | Metadata floats forbidden |
| Unsupported quantization | Exact profile-ID capability lookup |
| Quant label confusion | No generic `q4`; exact profile record and hash |
| Truncated tail | Exact source size, section ranges, tensor size formulas, read-exact behavior |
| Odd quant tail ambiguity | Explicit tail enum and golden tests |
| Nonzero padding | Reject |
| Trailing bytes | `file_size == source_size` and payload end equals file size |
| Polyglot file | Unique magic, no trailer, no external interpretation of internal bytes |
| Path traversal | No filesystem paths in executable artifact references |
| External-data substitution | Dependencies use content IDs, not mutable URLs |
| Hash confusion | Domain-separated framed hashes with typed fields |
| Signature confusion | Signature binds statement type, subject class, semantic ID, and whole-file hash |
| Self-referential signature | Detached signature artifact |
| Parser differential | Canonical grammar; independent-reader corpus |
| Decompression bomb | No compression in `2.0` |
| Expensive validation attack | Cheap structure and capability checks precede payload hashing |
| TOCTOU after verification | Stable handle and private immutable staging object; recheck size/identity before commit |
| Multi-peer poisoning | Per-piece verification, peer quarantine, whole-file rehash |
| Partial activation | Candidate-owned runtime context and atomic pointer swap |
| Rollback or freeze | Signed catalog policy epochs, expiries, and trusted-root update policy |
| Malicious metadata rendering | Escape as text; no HTML, templates, URLs, or code execution |
| Huge error output | Bounded error message and at most one offending identifier prefix/offset |

**[Engineering recommendation] Work bounds.** The validator’s structural work is:

\[
O(M + S + Q + T + B + A)
\]

where \(M\) is manifest bytes, \(S\) string bytes, \(Q\) quant records, \(T\) tensor records, \(B\) blob records, and \(A\) auxiliary records. Because all tables are already canonically sorted, duplicate and overlap checks are linear rather than sort-dependent. Payload verification is \(O(F)\), unavoidable for full identity, but occurs only after bounded structural admission.

## Conformance, public inspection, implementation backlog, and private verification

### Conformance corpus

**[Engineering recommendation] Byte-exact golden set.** Publish a repository containing immutable golden artifacts and expected:

- Whole-file hash.
- Manifest hash.
- Semantic-manifest hash.
- Tensor-layout ID.
- Tensor/blob hashes.
- Model or class identity.
- Piece hashes and Merkle root.
- Expected parser result or exact error code and stage.

The corpus includes:

- Smallest valid manifest-only artifact for each permitted class.
- Smallest valid scalar dense tensor.
- Rank-one through rank-eight tensors.
- Every dense element type.
- Every admitted quant profile.
- Every quant tail rule, including odd tails.
- Multiple aligned tensors with required zero padding.
- Tokenizer vocabulary containing arbitrary byte tokens.
- Unicode metadata in NFC and rejected non-NFC equivalents.
- Empty dependency list and maximum legal bounded lists.
- Ordered adapter composition.
- Piece-set with one piece, two pieces, non-power-of-two piece count, and final short piece.
- Detached signature and key-rotation examples.
- Native, Wasm, and WebGPU capability-positive and capability-negative cases.

**[Engineering recommendation] Single-field corruption suite.** For each field, produce mutations that alter only that field where possible:

- Every magic byte.
- Format-ID byte.
- Header size and version.
- Endianness marker.
- Class mismatch.
- Every count and record size.
- Every offset and length at `−1`, exact, `+1`, maximum, and overflow boundary.
- Section misalignment.
- Nonzero reserved or padding byte.
- Noncanonical CBOR integer.
- Indefinite CBOR object.
- Duplicate key.
- Out-of-order map key.
- Unknown core key.
- Unknown critical and noncritical extension.
- Invalid UTF-8.
- Non-NFC text.
- String-table duplicate and unsorted entry.
- Invalid string ID.
- Shape-product overflow.
- Wrong logical element count.
- Wrong dense size.
- Wrong quant block size.
- Unsupported profile ID.
- Payload overlap, gap, alias, or out-of-order range.
- Auxiliary cycle or wrong target.
- Wrong payload hash.
- Wrong whole-file hash.
- Wrong piece index/length/hash/root.
- Trailing byte.
- Truncation at every section boundary.
- Wrong base, tokenizer, layout, adapter order, or duplicate adapter.
- Signature over wrong statement type or class.

**[Engineering recommendation] Fuzz program.**

- Coverage-guided mutation fuzzing of header and all tables.
- Structure-aware CBOR mutation.
- Descriptor-aware range/overflow mutation.
- Piece-set and Merkle-proof mutation.
- Adapter dependency graph mutation.
- Tokenizer normalizer and template-AST mutation.
- Property tests for checked arithmetic and canonical alignment.
- Round-trip property: writer output always validates and re-emits byte-identically.
- Canonicality property: any accepted metadata re-encoding is byte-identical.
- No-panic property under arbitrary bytes.
- Bounded-allocation instrumentation.
- Bounded-work watchdogs.
- Address, undefined-behavior, and memory sanitizers for native test builds.
- Wasm fuzz execution with browser and standalone Wasm engines.

**[Engineering recommendation] Differential testing.** Maintain at least two readers with independent parsing logic:

1. The production Rust reader used natively and compiled to Wasm.
2. An independent reference reader, preferably in a memory-safe language or a separately implemented Rust crate with no shared parser code.

A TypeScript-only reader is useful for browser inspection but should not rely on JavaScript `Number` for unconstrained integers; all file positions are still bounded below `2^53`, while 64-bit semantic values should use `BigInt` or checked byte-level routines.

Differential acceptance must be exact: both readers accept with identical identities or reject with the same error class. Any parser differential is a release stop.

**[Engineering recommendation] Numerical tests.**

- Source tensor to packed tensor readback.
- Dequantization reference vectors.
- Per-layer and full-model logits against source runtime.
- Bit-exact output where kernels and arithmetic promise it.
- Declared tolerance envelopes where backend arithmetic differs.
- Native CPU versus Wasm CPU identity and logits.
- WebGPU upload byte identity before execution.
- WebGPU versus CPU logits under backend-specific tolerance.
- Adapter order sensitivity.
- Tokenizer encode/decode and prompt-render golden cases.
- KV-cache resumed generation versus uncached reference.
- Retrieval-index query results against reference construction.

A structurally valid or reproducibly packed file is not promoted merely because it parses. Required behavioral qualification remains a separate receipt and policy decision.

### Public-safe inspection output

**[Engineering recommendation] Safe fields.**

```text
format: SLM2 2.0
artifact class
whole-file hash
semantic artifact ID
composition ID, where applicable
file bytes
logical executable bytes
deduplicated incremental store bytes
architecture identifier and version
tensor count
dense and quant profile IDs
tokenizer ID
chat-template ID
base and ordered adapter IDs
runtime requirements
piece size/count/root
publisher key ID
signature/provenance status
SPDX license expression
evaluation-receipt IDs and public qualification status
bounded parser error code, section, and byte offset
```

**[Engineering recommendation] Omitted fields.**

- Private local paths and filenames unless the user explicitly asks to display the selected name.
- Prompts, conversations, token prefixes, and KV contents.
- Secrets, cookies, authorization headers, private keys, or companion credentials.
- Peer addresses except in an explicit consented peer UI.
- Unpublished evaluation examples or raw private dataset records.
- Arbitrary metadata rendered as HTML.
- Executed chat templates or normalizers merely for inspection.
- Full payload dumps by default.
- Stack traces or memory addresses.
- Source checkout paths from provenance.
- Unbounded lists of tensor names or errors.

An inspector treats all text as untrusted and escapes it. It reports a bounded first error plus aggregate counts, not an attacker-controlled megabyte of diagnostics.

### TDD implementation backlog and cutover

**[Engineering recommendation] Implementation slices.**

| Slice | Deliverable and TDD gate |
|---|---|
| Binary primitives | LE readers/writers, checked arithmetic, alignment, range type, error taxonomy; exhaustive boundary tests |
| Header and sections | Header parser, canonical section calculation, zero-padding checks; corruption tests first |
| SLM-DCBOR-1 | Bounded parser and canonical writer; RFC-derived and adversarial vectors |
| String table | Sorted writer/reader, identifier validation, Unicode/NFC boundary |
| Quant registry | Exact records, profile hashes, reference dequantization vectors, unsupported-profile behavior |
| Tensor/blob/aux tables | Fixed-record parser, shape/size proof, payload placement, relationship validation |
| Identity layer | BLAKE3/SHA-256 vectors, framed domains, model/composition/piece IDs |
| Piece-set transfer | Fixed pieces, Merkle root, bitmap, quarantine, multi-peer mixing, local-file admission |
| Artifact schemas | Every class’s legal and forbidden table combinations |
| Tokenizer/template | Closed tokenizer operations and declarative template interpreter with expansion limits |
| Composition/adapters | Dependency closure, ordered operations, tensor-layout identity |
| Native staging | Stable-handle validation, optional mmap, atomic promotion, crash tests |
| Browser staging | `File` range reader, OPFS worker storage, Wasm bounded windows, quota/failure tests |
| WebGPU staging | Capability registry, per-tensor verified upload, candidate resource ownership |
| Signature/provenance | Detached statements, key policy, license/provenance schema |
| Packer | Deterministic ordering, quantization, receipt, byte-reproduction tests |
| Inspector | Public-safe output and redaction tests |
| Catalog admission | Announcement schema, policy states, no-byte-hosting enforcement |
| Fuzz/conformance | Independent readers, mutation corpus, platform matrix |

**[Engineering recommendation] Test-first order.** For each slice:

1. Write malformed and boundary fixtures.
2. Define exact error code and stage.
3. Implement the minimal parser or writer.
4. Add golden valid files.
5. Add round-trip and property tests.
6. Add fuzz harness.
7. Integrate only after no-panic and allocation-bound checks pass.

**[Engineering recommendation] Clean cutover.**

- Freeze repacking of real models until SLM2 constants and profiles are reviewed.
- Implement only the SLM2 reader and writer.
- Do not add legacy magic probing beyond an explicit `UnsupportedLegacyFormat` response.
- Regenerate every fixture from reviewed source inputs.
- Change converter output exclusively to SLM2.
- Change catalog admission to require SLM2 IDs, piece set, provenance/license state, and qualification receipts.
- Reject the unpublished old format from announcement and promotion.
- After SLM2 verification on representative real artifacts, delete the superseded parser, writer, converter branches, fixtures, tests, feature flags, and documentation in one auditable cutover change set.
- Do not preserve a hidden fallback parser “for convenience.”

**[Engineering recommendation] Stop rules.** No real model is repacked or publicly announced while any of the following remains:

- The current private tensor semantics are not mapped and reviewed.
- An SLM2 field has two plausible interpretations.
- Native and Wasm readers disagree.
- Writer output is not byte-reproducible.
- Any malformed input panics or allocates beyond policy.
- Hash verification occurs after activation.
- Unknown critical fields are accepted.
- A quant profile lacks exact test vectors or backend capability proof.
- Adapter ordering or base binding is ambiguous.
- Tokenizer or template behavior differs from the source model.
- Browser peak memory exceeds the supported device policy.
- License or provenance review is incomplete.
- Quality receipt requirements are absent.
- Conversion logits exceed an approved tolerance.
- The old implementation cannot yet be deleted cleanly.

**[Engineering recommendation] Evidence required before the first real repack.**

1. Ratified SLM2 `2.0` specification and constants.
2. Full source pins for all imported algorithms and Unicode data.
3. Independent reader agreement on the conformance corpus.
4. Zero-panic fuzz campaign with recorded duration and corpus.
5. Bounded-memory tests at maximum policy counts.
6. Native/Wasm hash and identity parity.
7. Every enabled quant profile’s encode/decode vectors.
8. Source tokenizer and template equivalence tests.
9. Representative model logits and generation comparison.
10. Fail-atomic crash tests.
11. P2P corruption, interruption, and multi-peer tests.
12. Provenance and license review workflow.
13. Evaluation-receipt admission policy.
14. Catalog proof that model bytes are neither hosted nor proxied.
15. Signed review approving deletion of the unpublished format.

### Unknowns requiring authorized verification

**[Local verification required]** The following cannot be established from public evidence:

- Existing `.slm` magic, byte order, header, tensor layout, metadata, or hash behavior.
- Whether current model artifacts are deterministic.
- Current tensor names, semantic roles, shapes, and supported architectures.
- Current quantization block layouts and kernel contracts.
- Whether tokenizers and chat templates are embedded, external, or reconstructed.
- Current converter source inputs and nondeterminism.
- Current native and browser parser allocation behavior.
- Whether any unsafe casts, unchecked arithmetic, or whole-file copies exist.
- Real browser memory ceilings and supported device tiers.
- Target browser versions, Wasm features, and OPFS availability policy.
- Current WebGPU kernels, alignment requirements, and upload behavior.
- Current companion IPC authentication and peer-consent mechanism.
- Current peer protocol, range protocol, replay behavior, and quarantine logic.
- Current local-store atomicity and crash recovery.
- Current KV-cache layout and conversation-state coupling.
- Current retrieval-index format.
- Existing provenance, license, signature, and quality-receipt workflows.
- MiniModel.org’s announcement and trust-root schema.
- Whether logical and deduplicated physical sizes are currently distinguished.
- The evidence necessary to reproduce any existing model’s logits.
- Whether deletion of the old unpublished implementation would affect deployed private users.

These unknowns must become explicit verification work items. They are not reasons to weaken SLM2 or add a compatibility reader.

## Annotated primary-source bibliography

All sources were retrieved on **August 1, 2026**. Living standards should be archived internally with a cryptographic snapshot hash before implementation begins.

**Safetensors.** [Hugging Face Safetensors repository and format description](https://github.com/huggingface/safetensors). The inspected public description specifies the eight-byte little-endian header length, JSON tensor map, relative data offsets, duplicate-key prohibition, and parser-behavior caveat. Pin for review: release `0.8.0`, June 9, 2026, release commit abbreviated `a406ca3`; resolve and record the full commit before importing code or test vectors. citeturn17view0turn16view0

**GGUF and llama.cpp.** [GGUF format documentation](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md) and [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases). The sources document typed metadata, tensor offsets, alignment, version 3, and the quantization ecosystem. Research pin: llama.cpp build `b10218`, commit abbreviated `de69995`, released August 1, 2026. The final standards record must replace the moving `master` document with its immutable blob at the selected full commit. citeturn15view1turn15view2turn16view1turn15view15

**ONNX.** [ONNX repository releases](https://github.com/onnx/onnx/releases) and [external-data helper documentation](https://onnx.ai/onnx/api/external_data_helper.html). Stable source pin: ONNX `v1.22.0`, abbreviated release commit `2bb5046`, June 15, 2026. The online API documentation observed during research displayed `1.23.0`; implementation review should use the source files from the pinned `1.22.0` tag rather than assuming living documentation matches the release. citeturn16view2turn15view3

**CBOR.** [RFC 8949, Concise Binary Object Representation](https://www.rfc-editor.org/rfc/rfc8949.html), December 2020. This is the normative basis for the narrowed deterministic CBOR profile, but SLM-DCBOR-1 deliberately forbids tags, floats, indefinite lengths, and non-text map keys. citeturn15view4turn17view5

**JSON canonicalization comparison.** [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html), June 2020. It establishes the need for invariant serialization for signatures and hashes. SLM2 chooses narrowed deterministic CBOR instead to avoid JSON-number and general JSON-parser dependencies. citeturn15view16

**Unicode normalization.** [Unicode Standard Annex #15, Unicode Normalization Forms](https://unicode.org/reports/tr15/) and [Unicode Technical Standard #39, Unicode Security Mechanisms](https://www.unicode.org/reports/tr39/). The implementation must pin an exact Unicode release and table hash; references to “latest Unicode” are not reproducible. citeturn15view17turn15view18

**BLAKE3.** [Official BLAKE3 implementation repository](https://github.com/BLAKE3-team/BLAKE3) and [BLAKE3 specification repository](https://github.com/BLAKE3-team/BLAKE3-specs). Research implementation pin: release `1.8.4`, abbreviated release commit `b97a24f`, observed March 30, 2026. Before implementation, freeze the full commit, portable source subset, build flags, and official test vectors. citeturn14search1turn14search22turn15view14

**SHA-2.** [NIST FIPS 180-4, Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final), August 2015 update. This is the basis for optional SHA-256 ecosystem digests, not the primary SLM2 semantic ID. citeturn15view13

**Merkle trees.** [RFC 9162, Certificate Transparency Version 2.0](https://datatracker.ietf.org/doc/html/rfc9162), December 2021. Its ordered tree, distinct leaf/node prefixes, and largest-power-of-two recursion inform the SLM2 piece tree; SLM2 uses its own framed BLAKE3 domains rather than reusing certificate-transparency hashes. citeturn17view6

**BitTorrent v2.** [BEP 52, The BitTorrent Protocol Specification v2](https://www.bittorrent.org/beps/bep_0052.html). Its piece-layer and Merkle-root concepts support the choice of independently verifiable pieces. SLM2 does not adopt torrent metadata encoding or networking behavior. citeturn16view8

**IPFS/content addressing.** [IPFS public project documentation](https://ipfs.tech/). It is cited as a distribution precedent for location-independent content identity, not as the SLM2 wire format or trust policy. citeturn16view9

**WebAssembly.** [WebAssembly Core Specification, Release 3.0](https://webassembly.github.io/spec/core/), July 28, 2026. The SLM2 browser implementation should pin its actual deployed Wasm feature subset independently of the publication’s current feature set. citeturn16view3

**File API.** [W3C File API](https://www.w3.org/TR/FileAPI/), living publication retrieved August 1, 2026. It supports selected file objects and byte access but does not provide arbitrary-file memory mapping. Archive a snapshot and hash for browser implementation review. citeturn16view4

**File System and OPFS.** [WHATWG File System Standard](https://fs.spec.whatwg.org/), living standard retrieved August 1, 2026. The standard defines browser filesystem infrastructure and OPFS behavior. Synchronous access handles are worker-limited and are positional file interfaces, not mmap. citeturn15view6turn15view7turn17view9

**Web Cryptography.** [Web Cryptography API Level 2](https://w3c.github.io/webcrypto/), editor’s draft retrieved August 1, 2026. It defines browser cryptographic operations, but actual target-browser Ed25519 capability must be tested and policy-pinned. citeturn16view5

**Ed25519.** [RFC 8032, Edwards-Curve Digital Signature Algorithm](https://datatracker.ietf.org/doc/html/rfc8032), January 2017. This is the signature-algorithm basis for detached SLM2 signature envelopes. citeturn15view10

**WebGPU.** [GPUWeb API and `GPUQueue.writeBuffer`](https://gpuweb.github.io/types/interfaces/GPUQueue.html), retrieved August 1, 2026. It supports uploads into GPU buffers; it does not justify claims of direct arbitrary-file mapping into GPU memory. citeturn15view9

**Sigstore.** [Sigstore Bundle Format](https://docs.sigstore.dev/about/bundle/), retrieved August 1, 2026. It is a precedent for detached verification material and transparency-log inclusion evidence. SLM2 should define its own minimal envelope or pin an exact compatible Sigstore bundle version rather than referencing a moving “latest” schema. citeturn15view12

**The Update Framework.** [TUF Specification](https://theupdateframework.github.io/specification/latest/), retrieved August 1, 2026. Its root-role and key replacement/revocation model informs catalog trust-root management. Production adoption requires pinning a numbered TUF specification rather than the `latest` URL. citeturn15view11

**SLSA provenance.** [SLSA Provenance v1 predicate](https://slsa.dev/spec/v1.1/provenance), version 1.1 publication retrieved August 1, 2026. It provides a precedent for recording where, when, and how an artifact was produced. citeturn16view7

**SPDX.** [SPDX Specification 3.0.1](https://spdx.github.io/spdx-spec/v3.0.1/). It is the preferred pinned vocabulary source for license expressions and notices, while actual model-license interpretation remains a review function rather than a parser conclusion. citeturn16view6

**Tokenizer precedent.** [SentencePiece model schema](https://github.com/google/sentencepiece/blob/master/src/sentencepiece_model.proto) and [normalization documentation](https://github.com/google/sentencepiece/blob/master/doc/normalization.md). These sources demonstrate that normalization rules, fallback behavior, and vocabulary state are part of tokenizer identity. Before using any implementation behavior as a conformance oracle, pin an exact SentencePiece release and full commit. citeturn14search3turn14search10
# SLM2 Format Implementation Checkpoint

## Status

This document records the current local implementation of the exact,
development-only SLM2 2.0 dense-F32 model format on 2026-08-20. The checkpoint
is structurally usable for continued converter and runtime development, but it
is deliberately inactive and unpromoted.

It is not evidence of source-model conversion, a correct forward pass,
browser/WASM loading, model quality, sustained sanitizer fuzzing, production
admission, publication, catalog availability, or any live campaign count.

## Exact Authorities

| Authority | Exact identity |
| --- | --- |
| Format profile | `org.minimodel.slm2/2.0`; 19,321 bytes; SHA-256 `b3f90c67d396d16a3ca561cbb288c10dc542a10e00d758704d1d6a17b3c3ff0f` |
| Vector document | 24,667 bytes; SHA-256 `1e3a00ddb32d80ff67407fcaa58bd576196c37b6ff3452720ae26cbd67370f8e` |
| Seed artifact | 7,680 bytes; SHA-256 `3f28af0124e49f3ad1c177958eea5d5bd2823b63821451d44c05da6602fc402d` |
| Seed manifest | SHA-256 `ca52af1e58f4090def0298e1d80885d0377e3da4063068893ea76866b653d22a` |
| Seed tensor layout | SHA-256 `dfb77a7a2f87db4d1333b9d204a9ce44ef0fe3613228b89666895ad671c53da6` |
| Seed Merkle root | `8b988e90ef40ac8f3b2c32cd1bd70e308c5d6ad447941a73af426e6faf9704e8` |
| Fuzz profile | `tinyrustlm.vnext.slm2-fuzz.v1`; 3,187 bytes; SHA-256 `995a88e52692df204455ea94725de603af38b785a6f9f708a37bf7baa3ae2ce8` |
| Corpus manifest | 10,040 bytes; SHA-256 `1e449cb26b43f91de8e7534124e09b422ec346dbbaed5652d3b76a8f64abb76a` |
| Fuzz dependency lock | 6,766 bytes; SHA-256 `9b6561a9894953d73d969c4976dd8b9f38eb7a80f34cbec62050041b12e12d88` |

The profile is normative. The vector and fuzz documents bind implementations
to that profile; they do not expand it. Any material byte, field, semantic,
limit, identity, or error-vocabulary change replaces the unpromoted contract
and all affected vectors together. There is no version-range reader.

## Rust Boundary

`rust/crates/tinyrustlm-slm2` is the sole current SLM2 binary implementation.
It forbids unsafe Rust and exports only:

- a closed `ModelSpec` for base or independently executable specialist models;
- a public required-registry constructor for the exact conditional decoder
  tensor set;
- exact `TensorSpec` and seekable `TensorInput` values;
- a sequential deterministic `write_model` operation;
- a bounded streaming `validate_model` operation returning an inactive
  `ValidatedModel` candidate;
- fixed 4 MiB piece and domain-separated Merkle identities.

The crate contains no SLM1 parser, SLM1 writer, migration reader, alias,
fallback, model selector, network operation, signature authority, tokenizer,
template executor, adapter loader, or activation route.

### Writer

The writer requires an empty owned seekable destination. It validates and
sorts descriptors, then requires the complete exact registry selected by layer
count, tied embeddings, QKV bias, and Q/K normalization. It builds the
canonical string table, recomputes the tensor layout identity, emits
SLM-DCBOR-1 metadata, and derives every section and payload offset through
checked arithmetic. It first scans each seekable tensor for exact length,
finite F32 values, and framed payload identity, then scans it again while
copying. A source that changes between passes fails rather than producing a
mixed artifact. The destination is flushed before identity is returned.

### Reader

The reader checks actual size and caller policy before material allocation. It
then validates exact envelope identity/version, closed flags/tables, canonical
derived section positions, zero padding, strict bounded SLM-DCBOR-1, the string
table, all fixed tensor records, canonical descriptor order, layout identity,
the exact conditional tensor registry, payload placement, finite F32 values,
framed payload identities, and the whole artifact identity. Registry cardinality
is rejected above the profile tensor ceiling before allocation. Tensor payloads
and complete-file hashing use fixed buffers; the complete model is not
allocated.

Returning `ValidatedModel` proves only that the exact bytes satisfy the exact
format. Activation must remain a later fail-atomic gate bound to tokenizer,
template, composition, provenance, license, qualification, runtime, and
release evidence.

## Cross-Implementation Vector

`contracts/vnext/slm2-format-vectors.v1.json` contains one deliberately small
base-model artifact with all 11 tensors required for one tied-embedding layer
without QKV bias or Q/K normalization. The integration test derives that
registry through the public API, constructs tensors in reverse order through
the public writer, and requires byte-for-byte equality with the checked-in
artifact. The public reader must reproduce every model, tensor, payload,
layout, artifact, piece, and Merkle identity.

`tinyrustlm/tests/slm2-format-vectors.test.js` is an independently written
Node-core implementation. It imports no Rust parser or shared binary-format
helper. It separately parses the 224-byte header, strict SLM-DCBOR-1 metadata,
string table, 192-byte tensor records, finite payloads, framed tensor hashes,
whole-artifact SHA-256, 4 MiB pieces, and the ADR-002 Merkle tree. Agreement is
required on exact values, not only an accept/reject Boolean. It independently
declares and derives all top-level and per-layer tensor roles, names,
conditions, indices, and shapes, checks the profile registry byte-for-byte,
tests all conditional families, and rejects a canonical manifest whose flags
require tensors absent from the artifact.

The vector declares five complete-artifact mutations with stable Rust and Node
rejections: wrong magic, nonzero section padding, payload hash drift,
non-finite F32, and a trailing byte. The independent DCBOR tests separately
reject nonshortest integers, duplicate keys, indefinite forms, floating values,
tags, trailing data, non-ASCII text, and non-text map keys.

## Bounded Hostile Replay

The raw-byte fuzz harness lives in the nested
`rust/crates/tinyrustlm-slm2/fuzz` workspace. Inputs are capped at 1 MiB before
parser entry and use a policy capped at 4,096 tensors. An admitted artifact
must reproduce an independent complete SHA-256, bounded tensor ranges, and the
piece manifest. It must also reproduce the public exact required registry.
A rejection must use one exact profile-allowlisted parser code.

Harness startup hashes and then deserializes the complete fuzz profile through
closed `deny_unknown_fields` Rust records exactly once. It requires the
profile ID, version, status, linked format identity, input policy, validation
policy, parser name, admission checks, rejection checks, complete ordered
error vocabulary, seed classes, replay schema/status/limits, symlink rule,
exact-membership rule, and prohibited behaviors to equal the executable
constants. Stable replay imports its manifest byte and entry ceilings from
that same library boundary. A source-only change to either the declarations or
the executable constants therefore fails before a fuzzed artifact reaches the
parser.

The generated corpus contains 27 unique seeds occupying 192,228 bytes:

- one canonical admission;
- two legacy/truncated inputs;
- envelope identity, version, class, flag, and reserved-table mutations;
- section placement and zero-padding mutations;
- indefinite DCBOR and header/manifest class conflict;
- offset and non-ASCII string-table mutations;
- tensor reserved, shape-count, duplicate-name, and alignment mutations;
- a canonical manifest flag mutation requiring absent QKV bias tensors;
- layout-hash and payload-relative-offset mutations;
- nonzero payload padding, payload hash drift, non-finite F32, and trailing data.

The generator owns the exact corpus directory, emits every seed and the
manifest deterministically, and supports a read-only `--check` mode. Stable
Rust replay rejects symlink/path escape, manifest drift, extra/missing seed,
byte/hash drift, duplicate or noncanonical identity/order, and verdict drift.
Direct replay regressions copy the frozen corpus into uniquely owned temporary
directories and exercise those failures without modifying checked-in seeds.
Current replay reports 27 entries, one admitted, and 26 rejected. Every proper
prefix of the 7,680-byte seed also rejects under a deterministic Rust test.

The first regeneration replay exposed two old vector-specific generator
assumptions: a hardcoded string ID did not duplicate the new first tensor name,
and payload offset `+16` was data rather than padding. Both failures were
preserved in the private handoff. The corrected generator reads the actual
first tensor name ID and derives the first payload gap from descriptor offsets;
no expected parser verdict or parser behavior was weakened.

The optional libFuzzer target compiles with `libfuzzer-sys` 0.4.13. No claim is
made that a sustained AddressSanitizer interval has run for this new target.
Any future crash must be preserved, minimized without changing semantics,
converted into a deterministic regression, and retained as failed evidence
until the corrected parser and complete affected gates pass.

## Current Verification

The current focused local checkpoint passes:

- 15 Rust unit tests and three public vector/hostile integration tests;
- all 7,680 proper-prefix rejection checks inside the integration suite;
- six independent Node profile/vector/registry/DCBOR tests;
- one Node fuzz-profile/corpus/source-boundary test;
- two fuzz-library tests and five replay-command tests, including exact replay
  plus hostile manifest, membership, path, byte, and verdict drift;
- exact 27-seed stable replay with one admission and 26 rejections;
- warnings-denied Clippy and rustfmt for the production and fuzz workspaces;
- compilation of the feature-enabled `raw_slm2` libFuzzer target.

These are local deterministic conformance checks. They are not physical
durability, another-RID execution, long-running fuzz, performance, converter,
runtime, browser, or release evidence.

## Remaining Gates

1. Implement source-family converters with pinned source/tokenizer/template
   receipts and deterministic SLM2 output.
2. Implement the scalar F32 runtime oracle and exact forward-pass vectors.
3. Prove bounded multi-gigabyte streaming, peak memory, and rejection latency.
4. Add WASM and browser ingestion without copying complete model bytes.
5. Run sustained sanitizer fuzzing and retain any minimized failures.
6. Complete tokenizer2.0, template2.0, lora2.0, and acg2.0 byte contracts.
7. Bind provenance, license, semantic qualification, browser, P2P, package,
   physical-RID, release, deployment, and readback evidence.
8. Delete the complete SLM1 production surface only after the incompatible
   SLM2 path passes every cutover gate.

Until those gates pass, SLM2 remains an inactive development format. Campaign
counters remain 0/20 qualified models, 0/50 deletion-backed browser rounds,
0/25 authorized live memory rounds, 0/40 outside-network lane proofs, and 0/20
live catalog announcements.

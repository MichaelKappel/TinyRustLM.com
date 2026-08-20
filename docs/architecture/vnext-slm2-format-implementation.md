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
| Format profile | `org.minimodel.slm2/2.0`; 14,097 bytes; SHA-256 `f272caf64cacb7a4705fee0c958f15ee0cac3985d8728458a80f812913d66554` |
| Vector document | 6,603 bytes; SHA-256 `4a263ae170d896525023da73a41a5e3122c8630c08b8f6587b9f44f5d8060983` |
| Seed artifact | 1,800 bytes; SHA-256 `14ad14add8c8205e29040307eb42a4c749fb161fe7105e1de2bcbfc032ca81c4` |
| Seed manifest | SHA-256 `f90e0efa3af00af489859735d5942eb075e9621bf5a01d9b421ba2f4454fa17a` |
| Seed tensor layout | SHA-256 `599fc162203a46fe2aa427de897397a8262216c0141ce801c2194882f3c92ab2` |
| Seed Merkle root | `78aeb862785054819d6d77bc3b3315015259ef833c79dc52b0e368759efaf059` |
| Fuzz profile | `tinyrustlm.vnext.slm2-fuzz.v1`; 3,061 bytes; SHA-256 `ee114d831d180afdb15c2f8ea00e76212083fd764c605f2cf193f0770708a641` |
| Corpus manifest | 9,658 bytes; SHA-256 `971da88da5eb7a0724acb78202acc00ffd5de0a9f76e0d123e11ed4062dc65f9` |
| Fuzz dependency lock | 6,766 bytes; SHA-256 `9b6561a9894953d73d969c4976dd8b9f38eb7a80f34cbec62050041b12e12d88` |

The profile is normative. The vector and fuzz documents bind implementations
to that profile; they do not expand it. Any material byte, field, semantic,
limit, identity, or error-vocabulary change replaces the unpromoted contract
and all affected vectors together. There is no version-range reader.

## Rust Boundary

`rust/crates/tinyrustlm-slm2` is the sole current SLM2 binary implementation.
It forbids unsafe Rust and exports only:

- a closed `ModelSpec` for base or independently executable specialist models;
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
sorts descriptors, builds the canonical string table, recomputes the tensor
layout identity, emits SLM-DCBOR-1 metadata, and derives every section and
payload offset through checked arithmetic. It first scans each seekable tensor
for exact length, finite F32 values, and framed payload identity, then scans it
again while copying. A source that changes between passes fails rather than
producing a mixed artifact. The destination is flushed before identity is
returned.

### Reader

The reader checks actual size and caller policy before material allocation. It
then validates exact envelope identity/version, closed flags/tables, canonical
derived section positions, zero padding, strict bounded SLM-DCBOR-1, the string
table, all fixed tensor records, canonical descriptor order, layout identity,
payload placement, finite F32 values, framed payload identities, and the whole
artifact identity. Tensor payloads and complete-file hashing use fixed buffers;
the complete model is not allocated.

Returning `ValidatedModel` proves only that the exact bytes satisfy the exact
format. Activation must remain a later fail-atomic gate bound to tokenizer,
template, composition, provenance, license, qualification, runtime, and
release evidence.

## Cross-Implementation Vector

`contracts/vnext/slm2-format-vectors.v1.json` contains one deliberately small
base-model artifact with two tensors. The integration test constructs the
tensors in reverse order through the public writer and requires byte-for-byte
equality with the checked-in artifact. The public reader must reproduce every
model, tensor, payload, layout, artifact, piece, and Merkle identity.

`tinyrustlm/tests/slm2-format-vectors.test.js` is an independently written
Node-core implementation. It imports no Rust parser or shared binary-format
helper. It separately parses the 224-byte header, strict SLM-DCBOR-1 metadata,
string table, 192-byte tensor records, finite payloads, framed tensor hashes,
whole-artifact SHA-256, 4 MiB pieces, and the ADR-002 Merkle tree. Agreement is
required on exact values, not only an accept/reject boolean.

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
piece manifest. A rejection must use one exact profile-allowlisted parser code.

The generated corpus contains 26 unique seeds occupying 43,428 bytes:

- one canonical admission;
- two legacy/truncated inputs;
- envelope identity, version, class, flag, and reserved-table mutations;
- section placement and zero-padding mutations;
- indefinite DCBOR and header/manifest class conflict;
- offset and non-ASCII string-table mutations;
- tensor reserved, shape-count, duplicate-name, and alignment mutations;
- layout-hash and payload-relative-offset mutations;
- nonzero payload padding, payload hash drift, non-finite F32, and trailing data.

The generator owns the exact corpus directory, emits every seed and the
manifest deterministically, and supports a read-only `--check` mode. Stable
Rust replay rejects symlink/path escape, manifest drift, extra/missing seed,
byte/hash drift, and verdict drift. Current replay reports 26 entries, one
admitted, and 25 rejected. Every proper prefix of the 1,800-byte seed also
rejects under a deterministic Rust test.

The optional libFuzzer target compiles with `libfuzzer-sys` 0.4.13. No claim is
made that a sustained AddressSanitizer interval has run for this new target.
Any future crash must be preserved, minimized without changing semantics,
converted into a deterministic regression, and retained as failed evidence
until the corrected parser and complete affected gates pass.

## Current Verification

The current focused local checkpoint passes:

- 14 Rust unit tests and three public vector/hostile integration tests;
- all 1,800 proper-prefix rejection checks inside the integration suite;
- three independent Node vector/DCBOR tests;
- one Node fuzz-profile/corpus/source-boundary test;
- two fuzz-library tests and one replay-command test;
- exact 26-seed stable replay with one admission and 25 rejections;
- warnings-denied Clippy and rustfmt for the production and fuzz workspaces;
- compilation of the feature-enabled `raw_slm2` libFuzzer target.

These are local deterministic conformance checks. They are not physical
durability, another-RID execution, long-running fuzz, performance, converter,
runtime, browser, or release evidence.

## Remaining Gates

1. Freeze architecture-specific required tensor-role registries.
2. Implement source-family converters with pinned source/tokenizer/template
   receipts and deterministic SLM2 output.
3. Implement the scalar F32 runtime oracle and exact forward-pass vectors.
4. Prove bounded multi-gigabyte streaming, peak memory, and rejection latency.
5. Add WASM and browser ingestion without copying complete model bytes.
6. Run sustained sanitizer fuzzing and retain any minimized failures.
7. Complete tokenizer2.0, template2.0, lora2.0, and acg2.0 byte contracts.
8. Bind provenance, license, semantic qualification, browser, P2P, package,
   physical-RID, release, deployment, and readback evidence.
9. Delete the complete SLM1 production surface only after the incompatible
   SLM2 path passes every cutover gate.

Until those gates pass, SLM2 remains an inactive development format. Campaign
counters remain 0/20 qualified models, 0/50 deletion-backed browser rounds,
0/25 authorized live memory rounds, 0/40 outside-network lane proofs, and 0/20
live catalog announcements.

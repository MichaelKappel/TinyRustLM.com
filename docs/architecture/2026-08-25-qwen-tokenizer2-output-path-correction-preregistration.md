# Qwen Tokenizer2 Output Path Correction Preregistration

Date: 2026-08-25

Status: registered before implementation and before new tokenizer or composition output

## Decision

TinyRustLM will clean-cut the standalone Qwen Tokenizer2 writer and complete
Qwen3 composition transaction to one file suffix: `.tokenizer2`.

The registered contracts are:

- Tokenizer2 producer `tinyrustlm.qwen-bytelevel-to-tokenizer2/2`, 8,394
  bytes at SHA-256
  `97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4`;
  and
- complete composition `tinyrustlm.qwen3-complete-composition-conversion/4`,
  11,421 bytes at SHA-256
  `19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8`.

These numbers identify technical contracts and evidence lineage inside one
unreleased product. They do not create product V2 or V4. The implementation
will expose no version selector, legacy suffix, compatibility reader,
migration, alias, fallback, or dual receipt path.

## Preserved Failure

Execution `/3` is immutable input to this correction. Its public result is
8,773 bytes at SHA-256
`2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4`.
It preserves one successful model conversion followed by typed native
rejection `qwen-tokenizer2-output-path-invalid` before Tokenizer2 or complete
composition output.

The old private roots, the 598,308,416-byte partial SLM2 file, and all raw
evidence remain immutable. They are not inputs to the next execution and may
not be repaired, copied into a new package, cleaned, or relabeled.

## Sole Path Contract

The corrected writer accepts an absolute output path only when all of the
following are true:

1. Its parent already exists as a direct non-reparse directory.
2. Its final component is a bounded direct safe file name.
3. Its extension is exactly `.tokenizer2`.
4. Artifact, receipt, and both same-directory stage paths are absent.
5. The output does not overlap the source tree.

The `.tok2` suffix is rejected with `qwen-tokenizer2-output-path-invalid`.
There is no alias, compatibility branch, migration, alternate command, or
fallback. Historical `.tok2` evidence remains immutable history only.

The Tokenizer2 binary header still carries the frozen format identifier
`minimodel.tok2\0\0`. A binary format identifier and a filesystem suffix are
different contracts. The format bytes do not change.

## Producer And Receipt Binding

The sole producer profile is
`contracts/vnext/qwen-tokenizer2-conversion-profile.v2.json`. It retains the
strict five-file Qwen source closure, parser, BPE semantics, canonical Rust
writer, independent parser validation, create-only staging, file sync, hard
link promotion, directory flush, and source rehash.

Its receipt schema becomes
`tinyrustlm.qwen_tokenizer2_conversion_receipt.v2`. The receipt must bind the
exact producer profile, executable, source lock, all source members, canonical
Tokenizer2 format profile, exact `.tokenizer2` output file name, artifact
identity, token counts, special-token IDs, and durability evidence. A v1
receipt cannot satisfy the new complete-composition contract.

## Composition Binding

The sole composition profile is
`contracts/vnext/qwen3-composition-conversion-profile.v4.json`. It retains the
corrected model producer `/2` and binds only the new tokenizer producer `/2`
and tokenizer receipt v2.

Its ordered tokenizer member is exactly `tokenizer.tokenizer2`. Success still
requires six independently reparsed artifacts plus four bounded evidence
files, exactly ten files total, terminal pass written last, and no rejection.
Any partial root is terminal and preserved.

The managed inspector and companion source consumer must accept only
composition profile `/4`, the new tokenizer producer profile hash, and receipt
schema v2. Predecessor identities are removed from executable owners rather
than retained as compatibility.

## Regression Matrix

Implementation must prove:

- standalone conversion to a `.tokenizer2` file succeeds;
- the exact `tokenizer.tokenizer2` composition member satisfies the writer;
- `.tok2`, missing, doubled, and unrelated suffixes reject before output;
- nonabsolute paths and reparse parents reject;
- source/output overlap rejects;
- artifact, receipt, and stage collisions reject;
- artifact and receipt publication remain create-only and durable;
- receipt schema and producer profile identities are exact;
- complete composition requires the exact new producer and receipt;
- predecessor producer, receipt, and composition identities are absent from
  executable Rust and managed owners; and
- partial model output remains a terminal failure and cannot be resumed.

## Authorized Sequence

1. Commit and push the `/3` result and both output-free corrected profiles.
2. Fresh-fetch and prove local `HEAD`, tracking, `FETCH_HEAD`, and actual
   remote equality.
3. Change the sole Rust tokenizer writer, receipt, and composition owners.
4. Change the sole managed consumer identities.
5. Update samples and current documentation to `.tokenizer2`.
6. Add all positive, negative, integration, and stale-identity tests.
7. Run format, warnings-denied Rust build and Clippy, Rust tests, managed
   tests, Node tests, canonical JSON, private-path, secret, frozen-goal, and
   diff checks.
8. Commit, push, fresh-fetch, and prove the implementation remote-exact.
9. Register execution `/4` against all-new control, build, evidence,
   managed-build, and output roots before either build or execution.

This registration creates no output and proves no implementation result.
MemoryEndpoints remains unauthorized. Campaign counters remain `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.

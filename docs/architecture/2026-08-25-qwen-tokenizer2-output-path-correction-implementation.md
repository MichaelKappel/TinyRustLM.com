# Qwen Tokenizer2 Output-Path Correction Implementation

Date: 2026-08-25

## Decision

TinyRustLM now has one executable Qwen Tokenizer2 filesystem contract:

- producer profile `tinyrustlm.qwen-bytelevel-to-tokenizer2/2` at SHA-256
  `97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4`;
- exact artifact suffix `.tokenizer2`;
- complete-composition member `tokenizer.tokenizer2`;
- component receipt `tokenizer.tokenizer2.conversion-receipt.json`;
- receipt schema `tinyrustlm.qwen_tokenizer2_conversion_receipt.v2`; and
- complete-composition profile
  `tinyrustlm.qwen3-complete-composition-conversion/4` at SHA-256
  `19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8`.

The internal Tokenizer2 header identifier remains `minimodel.tok2` followed by
two zero bytes. That identifier is binary-format metadata, not filesystem
authority. The executable writer rejects `.tok2`, absent extensions, uppercase
or doubled variants, unrelated suffixes, and relative output paths. There is
no alias, dual suffix, compatibility reader, migration, fallback, repair, or
automatic retry.

## Evidence Lineage

The implementation is a direct descendant of remote-exact result and
registration commit `c5f60e958872e125f52c9a5355eb7fdd4977b367`.
That checkpoint preserves Qwen execution `/3`, which ran both registered builds
once and launched the converter once before terminally rejecting with
`qwen-tokenizer2-output-path-invalid`. Its public result is 8,773 bytes at
SHA-256
`2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4`.
Managed inspection was correctly not invoked.

The `/3` private roots, terminal records, and partial 598,308,416-byte SLM2 at
SHA-256
`a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7`
remain immutable. The partial model proves only corrected
311-physical/310-logical structural-byte conversion. It is not reused,
completed, repaired, relabeled, or promoted by this change.

## Rust Ownership

`tinyrustlm-convert` now embeds only the registered Tokenizer2 `/2` and
composition `/4` profile bytes. The Tokenizer2 owner defines the canonical
extension, composition member, component-receipt filename, and receipt schema.
The composition owner imports those constants rather than duplicating its own
tokenizer pathname contract.

Standalone conversion still performs the complete source-lock, exact inventory,
hostile JSON, tokenizer semantics, deterministic writer, independent reparse,
source-drift, create-only promotion, directory durability, and receipt readback
transaction. The only path admitted for a successful artifact now ends in
exact lowercase `.tokenizer2`. Receipt v2 binds producer profile `/2`, its exact
profile hash, the exact artifact filename, artifact bytes, source closure,
converter executable, format identity, token counts, and durability evidence.

Composition still writes an attempt first, creates each member and component
receipt without overwrite, flushes and reparses all six members, validates the
ACG2 graph and resource plan, rehashes receipts, and writes one mutually
exclusive terminal record last. It now requires Tokenizer2 receipt v2 and
profile `/4`. Historical profile `/3` and receipt v1 have no executable path.

## Managed Ownership

`TinyRustLmConversionTool` and the deterministic conversion fixture now bind
only composition `/4` and its exact profile SHA-256. Their request admission,
process launch, bounded stdout/stderr, timeout/cancellation tree termination,
terminal receipt parsing, six-member rehashing, component receipt custody, and
no-retry behavior are otherwise unchanged.

The console sample names `tokenizer.tokenizer2`. It does not advertise the
rejected suffix. This is one current prelaunch product contract, not a second
product generation or compatibility lane.

## Failure-Derived Regression Coverage

The corrected tests prove:

- deterministic standalone `.tokenizer2` conversion and independent reparse;
- exact producer `/2`, profile hash, receipt-v2 schema, and artifact pathname;
- `.tok2`, missing, uppercase, doubled, unrelated, and relative suffixes reject
  with `qwen-tokenizer2-output-path-invalid` and create no artifact or receipt;
- composition's tokenizer member has the writer's exact admitted extension;
- the composition owner requires receipt v2 and profile `/4`;
- Rust, managed conversion, fixture, and sample owners contain no predecessor
  profile identity, receipt v1, accepted `.tok2`, selector, alias, migration, or
  fallback; and
- immutable preregistration and `/1`, `/2`, and `/3` execution evidence remains
  byte-for-byte historical authority.

Verification completed from the source worktree:

- `cargo test -p tinyrustlm-convert --all-targets --locked`: 34 passed, zero
  failed;
- `cargo test --workspace --all-targets --locked`: complete workspace pass with
  zero failed tests;
- `cargo clippy -p tinyrustlm-convert --all-targets --locked -- -D warnings`:
  pass;
- focused and adjacent Qwen, ADR, contract inventory/registry, public-evidence,
  and release-cutover Node tests: 167 passed, zero failed;
- `dotnet build dotnet/TinyRustLM.sln -c Release --no-restore`: zero warnings
  and zero errors; and
- complete managed solution tests: 207 passed, zero failed, zero skipped
  across Package 38, Core 84, and Companion 85.

## Claim Boundary And Next Operation

This change proves source-level contract agreement and regression behavior. It
does not create or validate a new real Tokenizer2 artifact, complete
composition, native inference result, browser WASM result, conversation,
quality decision, P2P availability, catalog announcement, package publication,
site deployment, or MemoryEndpoints operation.

After this implementation is committed, pushed, freshly fetched, and proven
equal across local HEAD, tracking, `FETCH_HEAD`, and actual remote, the next
operation is a new output-free one-shot composition execution registration.
That registration must bind the exact implementation commit and tree, profiles
`/2` and `/4`, toolchains, controller, inspector, source locks, and wholly new
control, build, evidence, managed-build, and output roots. No new output may
exist before that registration is remote-exact. Campaign counters remain
`0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

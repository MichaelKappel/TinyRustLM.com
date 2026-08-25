# Qwen3 Composition Source-Relationship Correction Preregistration

## Observed Defect

The first real source-lock preflight found that
`qwen3-composition-conversion-profile.v1.json` and its Rust transaction require
`architectureProfileId` equality between the model and Tokenizer2 source
locks. That invariant is impossible for the accepted authorities:

- The model lock correctly uses
  `tinyrustlm.qwen3-dense-gqa-qk-norm/1`.
- The Tokenizer2 lock correctly uses
  `tinyrustlm.qwen3-tokenizer-source/1`.
- Both locks identify `Qwen/Qwen3-0.6B` at the same immutable revision.
- Their configuration, merge, tokenizer, tokenizer-configuration, and
  vocabulary records are byte-identical.

The model profile describes executable transformer semantics. The tokenizer
profile describes the admitted source-tokenizer pipeline. Requiring those
different semantic domains to use one identifier was a contract error, not a
source mismatch.

No real complete-composition output, terminal pass, terminal rejection,
runtime output, browser output, quality result, or campaign credit was created
under the erroneous profile.

## Registered Successor

`contracts/vnext/qwen3-composition-conversion-profile.v2.json` freezes the
correction before implementation or output. It is 8,835 bytes with SHA-256
`d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718`.
Technical `/2` identifies a corrected contract; it is not a second product
generation.

The sole admitted relationship now requires:

1. Equal `modelId`.
2. Equal immutable `revision`.
3. Exact model architecture profile
   `tinyrustlm.qwen3-dense-gqa-qk-norm/1`.
4. Exact tokenizer architecture profile
   `tinyrustlm.qwen3-tokenizer-source/1`.
5. Exact equality of all five shared locked-file records.

Every unrelated command, artifact, durability, resource, claim, and campaign
invariant remains byte-for-byte equivalent to the predecessor contract.

## Clean Cut

The predecessor profile is terminally invalidated before real output. The
implementation will replace its exact profile identity and remove its runtime
support in one change. It will not retain a compatibility reader, migration,
alias, fallback, version switch, or alternate relationship path. Historical
bytes remain audit evidence only and cannot be executed by the current
converter or accepted by the current managed companion boundary.

The implementation must add positive coverage for the two accepted checked-in
locks and negative coverage for wrong model profile, wrong tokenizer profile,
model ID drift, revision drift, and every shared-file identity drift. Rust,
.NET, fixture tooling, managed terminal inspection, architecture documentation,
and UAI memory must converge on the successor identity before any real
conversion attempt is registered.

## Claim Boundary

This registration changes no Rust or .NET production code and creates no model
or composition bytes. Conversion will remain structural evidence only after
the correction is implemented and tested. Source-framework parity, native and
browser-WASM inference, browser chat, untouched quality qualification, P2P,
catalog publication, deployment, and all campaign counters remain open.

# Qwen3 Composition Source-Relationship Correction Implementation

## Result

The complete Qwen3 composition transaction now consumes only technical profile
`tinyrustlm.qwen3-complete-composition-conversion/2`, whose canonical 8,835
bytes have SHA-256
`d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718`.
The correction was registered and fresh-remote verified at commit
`a7de8ececa877ab50c30e980fcf554c660068435` before production code changed.

Rust now compares `modelId` and immutable `revision`, then independently
requires model profile `tinyrustlm.qwen3-dense-gqa-qk-norm/1` and tokenizer
profile `tinyrustlm.qwen3-tokenizer-source/1`. It continues to require exact
equality of the configuration, merge, tokenizer, tokenizer-configuration, and
vocabulary lock records. The model and tokenizer converters expose their
existing exact profile constants within the crate, so the composition owner
does not maintain duplicate semantic literals.

The managed conversion owner and its fixture tool now require only the `/2`
profile ID and digest. They cannot create an intent for, launch, recover, or
accept terminal evidence from the invalid `/1` profile.

## Regression Coverage

Rust unit coverage now validates the two actual checked-in source locks and
their exact lock digests. It separately rejects a wrong model profile, wrong
tokenizer profile, model-ID drift, revision drift, and shared-file identity
drift. Existing complete-composition fault, durability, create-only, component
conversion, and proper-prefix tests remain active.

A Node ownership test verifies the exact current profile bytes, accepted lock
pair, shared Rust constants, all three executable owners, and absence of an
old-profile selector or compatibility vocabulary. The managed Release suite
executes the fixture through the same `/2` terminal-evidence boundary.

Focused implementation verification completed with:

- 29/29 `tinyrustlm-convert` Rust unit and integration tests passing.
- 85/85 managed companion Release tests passing.
- The profile preregistration and source-lock Node gates passing.

## Clean-Cut Boundary

The historical `/1` profile remains immutable audit evidence of a defect found
before real output. It is not included by Rust, recognized by managed code,
selected by a version switch, migrated, aliased, retried, or used as a
fallback. This is one prelaunch product with one executable complete-composition
contract.

No real conversion was run during this correction. No model or complete
composition bytes, terminal production receipt, source-framework output,
native inference, browser-WASM inference, browser chat, model-quality result,
P2P result, publication result, or campaign credit was created. The next step
is an output-free one-shot execution registration over the now-compatible real
locks and an exact release converter executable.

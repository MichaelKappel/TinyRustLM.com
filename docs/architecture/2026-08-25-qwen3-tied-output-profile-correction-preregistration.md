# Qwen3 Tied-Output Profile Correction Preregistration

Date: 2026-08-25  
Status: registered before implementation and before any new conversion output  
Registration parent: `b4545da32dd19a435aacab6f1792cd890a6e6f5e`  
Registration parent tree: `e94eced3b125b83b33e6e58cc61478dfbe2d6b40`

## Decision

TinyRustLM will use one corrected Qwen3 source-conversion contract and one
corrected complete-composition contract:

- `tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/2`
- `tinyrustlm.qwen3-complete-composition-conversion/3`

These are technical contract identities inside one unreleased product. They do
not create a product V2 or V3. The predecessor files remain immutable audit
history, but their producer identities will not remain executable after the
implementation change. There will be no version selector, compatibility
reader, migration, alias, fallback, retry lane, response repair, or alternate
converter.

This preregistration creates no model bytes, receipt, runtime output, browser
output, quality evidence, P2P evidence, publication evidence, MemoryEndpoints
evidence, or campaign credit.

## Preserved Observation

Real execution profile `/2` invoked the exact locked Qwen3 converter once and
preserved a nonretryable `qwen3-tensor-inventory-mismatch`. The immutable
public-safe result is:

- path: `contracts/vnext/qwen3-real-composition-execution-result.v2.json`
- bytes: 8,275
- SHA-256: `4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c`

The source model was not established to be defective. Its Safetensors header
contains 311 physical tensors. All 310 tensors required by the canonical Qwen3
logical registry are present. The only additional member is `lm_head.weight`.
The source configuration declares tied embeddings, and direct bounded
inspection established that `lm_head.weight` and
`model.embed_tokens.weight` are both:

- BF16;
- shape `[151936, 1024]`;
- 155,582,464 elements;
- 311,164,928 bytes; and
- byte-identical at SHA-256
  `8f29acf519434862d95613b2b4f6b9d14933a5e4d16baebf8ac0b33b410acfb6`.

The previous source profile explicitly declared `lm_head.weight` forbidden
when embeddings were tied. That rule conflicts with the exact immutable
source. The previous complete-composition profile bound that defective producer.
Both identities are therefore terminally invalidated for future execution.
Their failed evidence and profile bytes remain preserved.

## Physical And Logical Identity

The corrected contract distinguishes source custody from runtime semantics.

| Measure | Exact value |
| --- | ---: |
| Physical Safetensors members | 311 |
| Logical SLM2 tensors | 310 |
| Physical source parameters | 751,632,384 |
| Logical SLM2 parameters | 596,049,920 |
| Redundant tied-output parameters | 155,582,464 |

The redundant source payload counts toward physical source identity and source
parameter accounting. It does not count as a second logical runtime parameter
set. SLM2 emits `model.embed_tokens.weight` once as
`model.token-embedding.weight`; it emits no separate `lm_head` tensor because
the model specification already declares tied embeddings.

This is not deduplication based on a convenient name or a particular source
hash. It is a closed semantic rule requiring both the tied configuration and
exact equality evidence.

## Closed Source Rule

Admission requires all of the following before any output path is created:

1. The strict Qwen3 configuration parses with no unknown or duplicate members.
2. `tie_word_embeddings` is exactly `true`.
3. The canonical 310-member logical registry is present exactly once.
4. Exactly one additional `lm_head.weight` source member is present.
5. No other source tensor is present.
6. `lm_head.weight` and `model.embed_tokens.weight` have the same supported
   source dtype.
7. Their shapes and computed byte lengths are exactly equal.
8. Their source ranges independently satisfy the closed contiguous
   Safetensors range contract.
9. Their payload bytes compare equal through a bounded seekable stream.
10. The physical and logical inventory identities and counts are recorded
    separately.

The equality comparison uses a fixed 1,048,576-byte buffer. It does not map or
buffer either 311,164,928-byte payload as a whole. The comparison happens after
the exact locked file hashes and Safetensors header/ranges are validated and
before output staging is created.

## Failure Taxonomy

The implementation must preserve bounded typed failures:

- `qwen3-tied-output-required` when the tied source omits `lm_head.weight`;
- `qwen3-tied-output-dtype-mismatch` when its dtype differs;
- `qwen3-tied-output-shape-mismatch` when its shape differs;
- `qwen3-tied-output-length-mismatch` when computed payload lengths differ;
- `qwen3-tied-output-payload-mismatch` when any source byte differs;
- `qwen3-tensor-inventory-mismatch` for every unrelated extra or missing
  canonical tensor;
- the existing strict configuration failure for an untied model; and
- the existing strict parser/range failures for duplicate names or malformed
  ranges.

No failure may be converted into a warning, ignored extra, automatic retry,
alternate producer, or repaired model.

## Receipt Contract

The sole corrected source receipt schema is
`tinyrustlm.qwen3_conversion_receipt.v2`. It must bind:

- exact source lock and all nine source files;
- source model identity and byte length;
- physical source dtype, tensor count, parameter count, and inventory hash;
- logical output tensor count, parameter count, and inventory hash;
- both tied source tensor names, dtype, shape, element count, byte length, and
  payload SHA-256;
- a positive exact-payload-equality verdict;
- converter executable and profile identities;
- independently reparsed SLM2 artifact, manifest, and layout identities; and
- create-only durability identity.

The complete-composition transaction must require this exact receipt schema and
producer profile. A receipt from the invalidated producer cannot satisfy the
new composition contract.

## Required Regression Matrix

The implementation gate includes:

- exact BF16 tied duplicate conversion and deterministic repeated bytes;
- exact F32 tied duplicate conversion;
- missing `lm_head.weight`;
- wrong tied-output dtype;
- wrong tied-output shape;
- mismatched computed byte length;
- one changed tied-output payload byte;
- unrelated additional tensor;
- missing canonical tensor;
- duplicate tensor name;
- untied configuration;
- physical 311 versus logical 310 receipt accounting;
- no duplicate logical SLM2 emission; and
- source/profile/output identity drift checks.

The fixture must model the production invariant. A fixture that omits the
required redundant tied output cannot stand in for a passing source.

## Implementation Order

1. Commit and push this output-free registration with both exact profiles.
2. Fresh-fetch and prove local HEAD, tracking, `FETCH_HEAD`, and actual remote
   equality.
3. Change the sole Rust converter and complete-composition owner to the new
   identities.
4. Change the sole managed typed consumer to the new composition and receipt
   identities.
5. Add the complete positive and negative regression matrix.
6. Run format, warnings-denied build and Clippy, Rust tests, managed tests, Node
   contract tests, JSON/canonical-byte checks, secret/path scans, and frozen
   goal verification.
7. Commit, push, and fresh-fetch the green implementation.
8. Register a wholly new one-shot real execution with new control, build,
   evidence, managed-build, and output roots.

No `/2` execution root may be resumed, reused, inspected through the managed
success path, cleaned, repaired, or overwritten.

## Claim Boundary

The registration proves only that the correction was specified before its
implementation and before new output. It does not prove conversion success,
structural composition, source-framework parity, native inference, browser
WASM, browser chat, quality, P2P availability, catalog announcement, package
publication, site deployment, or MemoryEndpoints continuity. Campaign counters
remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

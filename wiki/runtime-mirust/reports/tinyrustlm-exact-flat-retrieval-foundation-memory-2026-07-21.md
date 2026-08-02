# TinyRustLM Exact Flat Retrieval Foundation Memory

Date: 2026-07-21 (Pacific)

## Disposition

TinyRustLM now has a preregistered, source-bound, dependency-free exact f32
flat-retrieval baseline inside its publish-disabled scalar experiment crate.
This is a verified experiment comparator, not product integration, a compressed
index, a TurboVec reproduction, a TurboQuant implementation, or evidence of
product retrieval quality or performance.

Third-party review artifacts remain outside the TinyRustLM repository and Git.
The checked evidence contains public URLs, immutable identities, sizes, hashes,
licenses, and bounded review purposes rather than machine-local download paths.

## Implemented Boundary

`rust/experiments/tinyrustlm-vector-oracle/` now additionally provides:

- an exact immutable index identity bound to format, source model, tokenizer,
  dimension, metric, normalization, transform, seed, f32 encoding, calibration,
  codebook identity, implementation, and record-set revision;
- deterministic dot-product, squared-Euclidean, and cosine retrieval with f64
  accumulation and external-identifier tie breaking;
- optional L2 normalization, signed permutation, and normalized signed
  Walsh-Hadamard preprocessing through the existing scalar oracle;
- sorted external identifiers and insertion-order-independent canonical bytes;
- bounded filtered search that returns identifiers and scores only;
- duplicate-ID rejection, immutable tombstones, zeroed deleted coordinates,
  compaction, and explicit revision advancement;
- a canonical `TRFLAT01` little-endian persistence format with a 248-byte
  header, 16-byte record prefix, 32-byte SHA-256 footer, and no payload text;
- strict corruption, truncation, extension, reserved-field, record-order,
  record-state, noncanonical-float, count, and allocation-limit rejection; and
- a clean-room scalar SHA-256 implementation checked against FIPS 180-4 vectors
  and padding boundaries.

The format limits are 1,048,576 dimensions, 1,000,000 records, 256 MiB per
serialized experiment snapshot, and 100,000 requested search results. Smaller
limits can emerge from the byte formula. These are experiment parser limits,
not promises about browser capacity or product suitability.

The crate remains `publish = false`, dependency-free, unsafe-free, and absent
from product runtime, browser, SDK, packer, and model-format imports.

## Preregistration And Sources

The frozen preregistration is
`tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-preregistration.v1.json`.
It was committed before result promotion and requires exact native rank parity,
zero score tolerance for frozen fixtures, exact recall of one for the baseline,
filtered search, restart byte equality, deletion and compaction behavior,
corruption and truncation detection, bounded allocation, WASM compilation, and
real WASM execution before any product promotion. It expressly forbids latency,
compression, TurboVec-parity, and product-integration claims.

The source/claim ledger now pins five sources and seven classified claims. Its
new normative source is `NIST.FIPS.180-4:2015-08`, bound to the official PDF at
833,315 bytes and SHA-256
`0455b406d89648d20cbde375561e19c245b9815e894164c2670772e3d54deb82`.
Only this standard is approved as implementation and test-vector input. The
TurboVec and TurboQuant sources remain review or isolated-comparator inputs and
are not approved for code, constants, or test-vector copying.

## Verification Evidence

The immutable parent receipt remains
`tinyrustlm/experiments/vector-quantization/scalar-oracle-verification-v1.json`,
receipt `scalar-oracle-foundation-51ab608f417c0b82`, SHA-256
`8772ee70a2de21b294fc3d10c2634059c72062e33397472762462d04e7b7938b`.
It was not overwritten when the experiment advanced.

The child receipt is
`tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json`,
receipt `exact-flat-retrieval-75f95baa316315ea`, SHA-256
`893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c`.
It binds 26 current inputs, the parent receipt, the source ledger, the frozen
preregistration, exact toolchain versions, and eight passing gates:

- canonical source/claim ledger validation;
- canonical exact-flat preregistration validation;
- 13 Node authority, source, isolation, and preregistration tests;
- workspace rustfmt verification;
- 40 Rust unit tests, eight exact-flat black-box tests, and one clean-room
  conformance test;
- strict Clippy with warnings denied;
- `wasm32-unknown-unknown` compilation; and
- rustdoc generation.

The receipt generator uses same-directory synced temporary creation and refuses
to overwrite an existing receipt. Its three adversarial receipt tests reject
current-input drift, parent drift, product or training authority inflation,
TurboVec or product-quality promotion, failed gates represented as passes, and
hidden or falsely completed promotion gaps.

Measured line coverage and Miri remain explicitly unavailable or unrun. The
receipt also preserves four unexecuted product-promotion gaps: real-browser WASM
execution, preregistered target-hardware performance, sealed-corpus recall/MRR/
NDCG and usefulness, and crash-recovered on-disk deletion proof.

## Truth Boundary

This work proves deterministic scalar exact-flat behavior only for the checked
fixtures and parser lifecycle. It does not prove or authorize:

- TurboVec numerical, persistence, accuracy, format, or performance parity;
- any compressed retrieval method or reduced byte count;
- representative-corpus recall, MRR, NDCG, semantic usefulness, or privacy;
- real browser execution, SIMD, latency, throughput, memory, or energy;
- durable filesystem atomicity, restart recovery, or physical deletion;
- KV-cache fidelity, conversation neutrality, or memory savings;
- `.slm` weight changes, model quality, training, catalog, P2P, package,
  deployment, or release claims; or
- use of unresolved human-review records for training.

Static model weights remain separate and unchanged. The experiment can be
removed without a compatibility path under the standing pre-release no-debt and
no-legacy rule. Its immutable receipts remain audit history only.

## Next Gate

Run the unchanged baseline in a real browser and on preregistered physical
targets. Then bind a sealed representative retrieval corpus, exact ground truth,
recall/MRR/NDCG and usefulness criteria, effective-byte accounting, crash and
restart persistence, and on-disk deletion evidence. Only after the baseline is
measured may a source-pinned compressed arm be preregistered at equal effective
bytes and compared without changing prompts, corpus, thresholds, or product
behavior after results are known.

The deeper TurboVec/TurboQuant research assignment and MemoryEndpoints platform
contract retry remain active intake. No live MemoryEndpoints, model campaign,
outside P2P, catalog, hardware, or release counter advances from this work.

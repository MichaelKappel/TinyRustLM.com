# Correct the current Qwen3 source license binding

The companion's compiled acquisition inventory expected a LICENSE of 11,358
bytes with SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
The exact pinned upstream revision serves 11,343 bytes with SHA-256
`832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e`, matching
the independently pinned training profile and retained original license.
Requiring the former identity would reject the correct upstream file before
complete source acquisition. The September 12 anonymous, bounded HTTP read is
recorded in `artifacts/ecosystem-cleanup-20260912/upstream-source-license-review.json`.
Source: [the license at the pinned upstream revision](https://huggingface.co/Qwen/Qwen3-0.6B/raw/c1899de289a04d12100db370d81485cdf75e47ca/LICENSE).

The current source document is now
`contracts/vnext/qwen3-0.6b-base-source-lock.v2.json`, 1,901 bytes, SHA-256
`50a8c29e36398a9a088e4d9a224dad186809d34b1e050299d3ce3de7a01b7d0e`.
It uses the existing strict source-lock schema; only the license identity differs
from the historical document. All nine entries now agree with the training
profile, and the aggregate source length is 1,519,207,673 bytes.

The browser request descriptor, companion descriptor `/2`, embedded lock bytes,
compiled download member, payload inventory digest, cache identity and current
conversion fixtures bind this corrected document. The current payload inventory
SHA-256 is `d2f70e19c9ff86aba30b02fe02041dc195dbb72517a436acf7468d7e8500b4f9`.
Current acquisition explicitly rejects the historical source descriptor; no
fallback or alias admits it. The page's content-bound asset references were
regenerated after changing the browser descriptor.

The prior source lock, failed operation registrations and terminal records remain
immutable historical data. Their source hashes were not rewritten. The existing
pairing/cryptographic vector corpus also remains unchanged. Its old source
request now serves as a rejection case; the current source-operation wire vector
is independently computed in `companion-source-operation-vectors.v1.json`.
Its operation identity is
`624f2a45e4a795647c672ef1db32005294311caf04d1a7b1a0b93319e3fa6c42`.
These are synthetic codec fixtures, not execution receipts.

Verification:

- All nine canonical source files were independently reopened and hashed against
  the current lock. The source closure passes; compact proof
  `artifacts/ecosystem-cleanup-20260912/current-source-lock-review.json`, SHA-256
  `34952acc80e1d57f0757bda90f648bb47947eb514b3e22ec1683ee0ac354ffd7`.
- 218 managed companion tests passed, including compiled-inventory/embedded-lock
  agreement, old-descriptor rejection, exact wire codecs and synthetic conversion.
- 45 JavaScript client, wire-vector, source-contract and helper checks passed.
- Eight Rust composition checks passed, including the current lock relationship
  and rejection of shared-source/profile drift.
- Eleven additional integration/server/shell checks passed. These include the
  production JavaScript client talking to the real C# authenticated seed host,
  four independent synthetic seeds, and all 19 page asset identities.
- Canonical operation-owned test output was removed. No full source checkout,
  model weight copy, or real model execution was created by verification.

The initial native/JavaScript checks correctly rejected the old operation vector
after the descriptor change. Moving current codec checks to the new independently
computed vector and asserting rejection of the historical one preserves both
the corrected behavior and prior evidence. This was not a waiver of validation.

This correction establishes current source-file agreement. It does not create a
complete real-source acquisition receipt, train or qualify a derivative, execute
the real model in native/WASM/browser inference, seed a public model, or publish
a site. The unchanged Qwen3 checkpoint remains diagnostic ancestry and rejected
as a product model. New conversion/numerical operations need fresh registrations
and current bindings; closed failed operations must never be replayed or adopted.

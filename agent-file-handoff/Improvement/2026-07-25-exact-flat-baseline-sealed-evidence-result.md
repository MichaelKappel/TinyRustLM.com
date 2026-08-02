# ExactFlat Sealed Baseline Evidence Result

Date: 2026-07-25

Status: locally verified research baseline with bounded authority

This report records the completed preregistered ExactFlat numerical,
natural-image utility, controlled-memory, and process-crash deletion baseline.
It is not model qualification, product integration, a compressed-retrieval
comparison, or release evidence.

## Executive Decision

The frozen six-lane ExactFlat baseline passed after one preserved
infrastructure failure and one scoped retry. All 790 retained query rows matched
the independent exhaustive ranking exactly. Both Fashion-MNIST lanes passed
their frozen label-utility thresholds. The controlled-memory lane passed every
expected-hit, forbidden-hit, deleted-ID, and filter check. All four registered
process-crash boundaries recovered to the expected committed generation and
retained deletion after restart.

This result authorizes only the next research gate: preregistration of one
independently source-pinned compressed numerical arm at equal effective bytes.
It does not authorize training, model promotion, product integration, or
release.

## Implemented Facts

- The preregistration was committed before benchmark implementation or result
  execution.
- The benchmark uses the unchanged public ExactFlat API and an independent
  `f64` exhaustive-ranking implementation.
- Fashion-MNIST selection is deterministic from the frozen seed, split, label,
  and source index. Selected indices and source images are not persisted.
- The observation retains all six lane summaries and all 790 per-query metric
  rows.
- Four process-crash boundaries exercise snapshot and commit publication
  before recovery, retry, cleanup, restart, and final managed-file scanning.
- Failed and passing attempts are immutable, content-addressed records.
- The child verifier reopens existing evidence and contains no quality, crash,
  or recovery execution mode.
- No observation execution required network access.
- External dataset bytes remain outside the repository.

## Evidence Identity

Preregistration:

- Manifest:
  `tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-preregistration.v1.json`
- SHA-256:
  `f6c1ac0d2c0f40365aca977aeccb894416185dc7069a97bb357510b94d94b4d1`
- Preregistration commit:
  `6aec32605d5719f64a833616ec841c53ddb40598`

Observation:

- Observation ID:
  `exact-flat-baseline-evidence-94aab53fab3f93b7`
- Observation content hash:
  `94aab53fab3f93b741490b095da58fd952cfa0122a58106c208fdfd4b8db46bb`
- Observation file SHA-256:
  `fa04d21ae35555b6a1d500eaf8569c5a7246c1bfde1f0bfc2e62812d6965c45c`
- Observation bytes: `494169`
- Observed source revision:
  `a4675bb7e444a890bdbe7a6b00e964a3d361307c`
- Observation commit:
  `c31d4438ea23a60e94be3daf41622350d331a244`

Child verification:

- Receipt ID:
  `exact-flat-baseline-evidence-verification-6eb3d0e13fe60cbd`
- Receipt content hash:
  `6eb3d0e13fe60cbde24fa1234d8e254506fc7d8a02a8ad6aca5a6735b8e6cdae`
- Receipt file SHA-256:
  `9e745a77807524ad6bf2eff3aab0cf5b2a5a3c246c484698bb9ce108948a9fe1`
- Receipt bytes: `12984`
- Verification source revision:
  `97585f10961414d288347a753b102d161959bb12`

Dataset selection:

- Public source revision:
  `b2617bb6d3ffa2e429640350f613e3291e10b141`
- Public source tree:
  `ec8d5e52c0b9b2b09ea3f9d36b7bfafaf8ec0e97`
- Materialized selection SHA-256:
  `8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd`

## Preserved Attempt History

Attempt 1 failed before crash injection because the Rust writer used a
deterministic but non-ECMAScript spelling for sub-micro finite numbers. The
JavaScript verifier correctly refused to call the output canonical.

- Attempt ID:
  `exact-flat-baseline-evidence-attempt-f9779090bb309fc0`
- Status: `fail`
- Source revision:
  `cad4a75d6eb6df0c02e6c33a7b6c5c53f78ed248`
- Attempt file SHA-256:
  `4f9972bec2009ec29f2f219d096cad4e5ecd698bcc07b2b887f58a6ab7d93678`

The scoped fix changed only number serialization and added a generic
cross-language regression. It did not change the corpus, seed, lane order,
metric definitions, thresholds, crash scenarios, or authority. The fix and
failed attempt were committed together at
`a4675bb7e444a890bdbe7a6b00e964a3d361307c`.

Attempt 2 was the sole infrastructure retry.

- Attempt ID:
  `exact-flat-baseline-evidence-attempt-abff0c29e72eb028`
- Status: `pass`
- Source revision:
  `a4675bb7e444a890bdbe7a6b00e964a3d361307c`
- Attempt file SHA-256:
  `9a87ee56b50844fad121dbc5495e438e52501a370bcbb64dcf913b8dbe4a1206`

No best-of-N selection occurred.

## Observed Quality Results

Every lane recorded:

- minimum recall at 1, 10, and 100: `1`
- minimum MRR at 100: `1`
- minimum NDCG at 100: `1`
- rank inversions at 100: `0`
- maximum absolute score error: `0`

Natural-image utility:

| Lane | Macro precision@10 | Macro MRR@10 | Macro NDCG@10 |
| --- | ---: | ---: | ---: |
| Fashion-MNIST squared Euclidean 784D | 0.6975 | 0.859375 | 0.7207703669488422 |
| Fashion-MNIST cosine 784D | 0.6775 | 0.8458035714285715 | 0.7001638538707916 |

Both lanes retained 20 queries for each of the ten labels.

Controlled-memory cosine 64D:

- expected first-hit rate: `1`
- forbidden-hit rate at 10: `0`
- deleted-hit count: `0`
- filter-violation count: `0`

These natural-image and controlled numeric results do not establish
representative natural-language semantic-memory usefulness.

## Crash And Deletion Results

| Registered boundary | Generation before retry | Deletion committed before retry | Retry idempotent | Deleted ID/vector matches |
| --- | ---: | --- | --- | ---: |
| Snapshot temp synced, before finalize | 1 | false | true | 0 / 0 |
| Snapshot finalized, before commit temp | 1 | false | true | 0 / 0 |
| Commit temp synced, before finalize | 1 | false | true | 0 / 0 |
| Commit finalized, before obsolete cleanup | 2 | true | true | 0 / 0 |

All final active indexes excluded every deleted target. Each final managed file
set passed identifier and vector-fingerprint scanning, and every owned
temporary root was deleted.

Directory flush was attempted but did not report success on this Windows
environment. The observation therefore makes no power-loss durability claim.
Process-crash recovery is not physical power-loss testing.

## Verification Results

The focused post-observation gate passed `24/24` tests. Coverage includes:

- all six lane schemas and all 790 query rows
- exact rank and score invariants
- natural-utility and controlled-memory thresholds
- all four recovery state transitions
- canonical cross-language finite-number serialization
- preregistration, parent, dataset, input, tool, and binary binding
- stdout hash binding
- immutable failure and passing-attempt history
- cleanup, private-path, unknown-field, and authority-inflation rejection
- an independent child summary that never reruns benchmark evidence

An attempted broad unit-suite run in the sparse validation worktree is not
counted as a full-suite result. It encountered intentionally omitted unrelated
repository paths, unavailable browser infrastructure, and historical receipts
whose older input sets no longer match current root manifests.

## Bounded Authority

Verified:

- sealed numerical rank preservation for ExactFlat
- Fashion-MNIST neighbor-label utility at the frozen thresholds
- controlled numeric memory-scenario utility
- active-index deletion across registered process-crash recovery
- process-crash recovery at the four registered boundaries

Not verified:

- representative semantic-memory quality
- physical power-loss durability
- filesystem or media forensic erasure
- compressed retrieval
- TurboVec parity
- product integration
- training authorization
- release authorization

## Campaign Impact

This research baseline does not increment the model-release campaign counters:

- Qualified models: `0 / 20`
- Fresh-browser rounds: `0 / 50`
- Authorized live MemoryEndpoints rounds: `0 / 25`
- Externally proven P2P lanes: `0 / 40`
- Catalog announcements: `0 / 20`

No MemoryEndpoints account, public catalog, external observer, package
publication, or physical Linux ARM64 authority was used or claimed.

## Next Gate

Create a new preregistration before implementing or running any compressed
comparison. It must:

1. Pin one exact public compressed method and implementation revision.
2. Freeze equal-effective-byte accounting against this ExactFlat baseline.
3. Reuse the same selected corpus and query identities without exposing them.
4. Freeze quality-loss, latency, memory, and failure thresholds before results.
5. Preserve every attempt and prohibit best-of-N selection.
6. Keep compressed numerical parity distinct from product semantic-memory
   usefulness.
7. Require a separately sealed natural-language corpus and the selected
   embedding model before any semantic-memory product claim.

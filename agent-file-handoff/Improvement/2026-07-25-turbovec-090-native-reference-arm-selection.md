# TurboVec 0.9.0 Native Reference Arm Selection

Date: 2026-07-25

Status: preregistered before comparison implementation or results

## Purpose

This note records why the first compressed comparison after the sealed
ExactFlat baseline is one native, black-box TurboVec reference arm. It does
not report compressed quality, speed, memory, persistence, browser, or
semantic-memory results.

The machine-authoritative contract is:

`tinyrustlm/experiments/vector-quantization/turbovec-reference-comparison-preregistration.v1.json`

Its validator is:

`tinyrustlm/tools/vector-turbovec-reference-preregistration.js`

## Directly Observed Source Facts

The selected public package is exactly:

- Package: `turbovec` `0.9.0`
- Registry artifact SHA-256:
  `0715a5a1365e86d0ae6396fa0c011f319b8e8024b3896cd16e6468e29ed3a325`
- Registry artifact size: `89,523` bytes
- Package VCS revision:
  `1e7200cfd8f26c92ce2855652db64bc7f85bc039`
- Repository archive SHA-256:
  `90a86a55f71982d288dd4eeb34f33dfc75427db830beae0391e2d5b5826477c5`
- Repository archive size: `549,022` bytes
- Manifest license expression: `MIT`
- Pinned repository license SHA-256:
  `e94eb7a09e285805786b74d8cfc535906efd3aabc243636646218314f7b4593c`

The package's `.cargo_vcs_info.json` binds version `0.9.0` to the same
repository revision. The crate archive itself does not contain a `LICENSE`
file. The separately pinned repository license is therefore required evidence;
the manifest string alone is not being treated as the complete license
artifact.

The public Rust API exposes:

- `IdMapIndex` with stable `u64` external identifiers.
- `2`, `3`, and `4` bit configurations.
- Dimensions that are positive multiples of eight.
- Maximum-inner-product search.
- Allowlist filtering.
- Swap-remove deletion.
- Version-3 `.tvim` persistence.
- First-add TQ+ calibration, frozen for later additions.

The inspected persistence implementation writes packed codes, one `f32`
correction per vector, TQ+ shift and scale arrays, and external IDs. It does
not put a cryptographic digest in `.tvim`, call `sync_all`, or perform an
atomic replacement.

## Observed Build Screen

These were source-feasibility checks. No selected corpus, compressed quality
workload, or comparison benchmark was executed.

On `x86_64-pc-windows-msvc`, using Rust and Cargo `1.96.0`:

```text
cargo check --locked --all-targets
```

completed successfully. The upstream library emitted two warnings: one unused
variable and one dead function.

The unmodified package was also checked with:

```text
cargo check --locked --target wasm32-unknown-unknown --lib
```

That check failed at compile time because the dependency graph did not enable
the `getrandom` JavaScript feature. No downstream feature override was tested.
This proves only that the pinned package does not directly build for that WASM
target as shipped. It does not prove that an independently designed portable
implementation is impossible.

Cargo metadata resolved 99 packages for the source-screen environment, with
ten normal root dependencies and no package missing a license metadata string.
That metadata observation is not a transitive legal approval.

## Engineering Decision

The sole selected compressed arm is:

`turbovec-crate-090-4bit-tqplus-native-reference`

It uses:

- The exact registry package above.
- Four-bit packed codes.
- The shipped deterministic dense rotation and seed `42`.
- The shipped Lloyd-Max codebook.
- The shipped TQ+ behavior with all records supplied in one first add.
- The shipped per-vector length-renormalization correction.
- `IdMapIndex` for stable external IDs.
- Upstream top-k membership without overfetching or source-vector reranking.

Four bits were selected before results because this first arm prioritizes
accuracy while still providing a predicted dynamic-index reduction of more
than five times on every sealed lane after all index metadata is counted.
No second bit width, ablation, or alternate compressed method is permitted in
this attempt.

This is a native reference comparator, not a TinyRustLM product dependency.
Third-party source bytes remain outside the repository. The future comparison
harness must depend on exactly `turbovec = "=0.9.0"` through a committed
`Cargo.lock` and build offline during observation.

## Metric Adapters

TurboVec searches maximum inner product. The frozen comparison therefore uses:

- Dot product: identity transform.
- Cosine: the sealed parent's L2-normalized vectors, for which dot product is
  cosine.
- Squared Euclidean: database vector
  `[x, -||x||^2, zero padding]` and query `[2q, 1, zero padding]`.

For Euclidean lanes:

```text
candidate squared distance = ||q||^2 - candidate inner product
```

The appended coordinate and all zero padding count toward storage and memory.
Any nonfinite transformed coordinate invalidates the lane. External IDs are
unchanged.

## Complete Byte Accounting

For original dimension `d`, encoded dimension `d'`, and `n` records:

```text
ExactFlat bytes = 280 + n * (16 + 4d)
TurboVec bytes  = 18 + n*d'*4/8 + 4n + 8n + 8d'
```

The candidate formula counts:

- magic, version, header, and calibration-count fields;
- every four-bit encoded coordinate;
- every per-vector `f32` correction;
- every `u64` external ID;
- every TQ+ shift and scale value;
- Euclidean adapter padding.

The following values are frozen before implementation:

| Lane | Candidate bytes | Full ExactFlat bytes | Ratio | Equal-budget exact records |
| --- | ---: | ---: | ---: | ---: |
| Fashion Euclidean 784 | 822,354 | 6,304,280 | 0.130444 | 260 |
| Fashion cosine 784 | 814,290 | 6,304,280 | 0.129165 | 258 |
| Synthetic dot 128 | 92,242 | 633,880 | 0.145520 | 174 |
| Synthetic cosine 384 | 247,890 | 1,862,680 | 0.133082 | 159 |
| Synthetic Euclidean 768 | 486,226 | 3,705,880 | 0.131204 | 157 |
| Controlled memory cosine 64 | 5,810 | 32,920 | 0.176488 | 20 |

Two comparisons are intentionally separate:

1. Same-corpus quality compares the full compressed index with the full
   ExactFlat oracle. This is not called an equal-byte comparison.
2. Capacity-at-equal-dynamic-index-bytes compares the full compressed index
   with the largest deterministic ExactFlat subset that fits within the exact
   candidate `.tvim` byte count.

The capacity subset is chosen only by the parent seed, lane ID, and external
ID hash. It cannot inspect labels, expected answers, or results. Adding one
more ExactFlat record must exceed the candidate budget.

Executable bytes, dependency bytes, generation metadata, receipts, temporary
snapshots, dense rotations, calibration intermediates, duplicate blocked
layouts, heaps, and process working set are reported separately. Nominal
"4-bit" language may not replace those measurements.

## Frozen Gates

The preregistration fixes:

- The same 2,000 Fashion-MNIST records and 200 queries per natural lane.
- The same three synthetic lanes and controlled-memory lane.
- The parent selection hash
  `8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd`.
- Recall, MRR, NDCG, rank-inversion, normalized-score-error, natural-label,
  and controlled-memory thresholds.
- Five paired native performance repetitions.
- Complete persistent-byte and process-memory accounting.
- Two independent candidate builds with byte-identical indexes and outputs.
- Pre/post-reload result identity.
- Seven corruption cases rejected before upstream parsing.
- Four process-crash boundaries.
- Strict committed deletion and allowlist behavior.
- Immutable failed attempts and no result-driven retries.

The thresholds cannot be lowered after seeing results. Quality, performance,
or deletion failures are not retryable. Only a separately identified
infrastructure or instrumentation failure may be retried, and all attempts
remain preserved.

## Bounded Authority

If every frozen gate passes, the evidence may support only:

- Native behavior of the exact TurboVec `0.9.0` reference.
- Same-corpus compressed ranking quality on the six sealed numerical lanes.
- Complete dynamic-index byte reduction.
- Capacity utility at equal dynamic-index bytes.
- Native performance on the named Windows target.
- Process-crash recovery supplied by the experiment wrapper.

It may not support:

- TurboQuant-paper conformance.
- An independent reproduction of the source algorithm.
- Safety of upstream persistence by itself.
- WASM or browser compatibility.
- Representative natural-language semantic-memory quality.
- Power-loss durability or forensic erasure.
- Direct dependency adoption.
- TinyRustLM product integration.
- Model training, qualification, or release.

## Campaign State

- Qualified models: `0 / 20`
- Fresh-browser rounds: `0 / 50`
- Authorized live MemoryEndpoints rounds: `0 / 25`
- Externally proven P2P lanes: `0 / 40`
- Catalog announcements: `0 / 20`

No production credential, MemoryEndpoints mutation, public catalog write,
external P2P observation, model qualification, package publication, or
physical ARM64 claim was made.

## Next Executable Step

Commit this preregistration and its tests before creating the comparison
harness. Then implement the isolated locked Cargo project and local wrapper,
run implementation tests, and commit those changes. Only after that second
commit may the explicit observation command be used.

# TinyRustLM Exact Flat Named-Target Performance Memory

Date: 2026-07-22 UTC

## Disposition

The unchanged dependency-free exact f32 retrieval baseline now has verified
latency, throughput, and process-memory observations on one explicitly named
Windows host. The evidence covers three preregistered workloads, three fresh
sequential processes per workload, and 324 retained query-duration samples.

This does not close the complete physical-target gate. Windows advertised an
Energy Meter counter set but exposed no counter instance, so energy was not
measured. CPU and board identity came from bounded registry fields, but no
independent physical-chassis attestation was available. The evidence also says
nothing about representative retrieval quality, durable on-disk deletion,
compression, TurboVec parity, browser performance, product integration,
training, or release.

## No-Peeking Chain

The protocol was frozen before any registered workload ran:

- preregistration commit: `29b79da`;
- preregistration SHA-256:
  `269459766b1bab57ce86cadda296d0941d3dfc3d6876873ab48657ba7bd64c63`;
- runner commit before execution: `af813bc`;
- immutable exact-flat parent receipt:
  `exact-flat-retrieval-75f95baa316315ea`;
- immutable browser parent receipt:
  `exact-flat-browser-wasm-verification-8fcdeb0b93534ca4`.

The first one-shot attempt stopped before compilation or timing because Windows
padded `ProcessorNameString` with trailing spaces. Failed attempt
`exact-flat-physical-target-attempt-1291be20cc291bc6` is preserved at file
SHA-256
`10329dbf0cf33f0434a633b19146b480bc0b7ee5cf5c696988646729b7d6e7dc`
and commit `fa74c68`.

A generic regression first reproduced the mismatch. Commit `bdca15e` then
trimmed bounded printable registry strings while retaining exact numeric,
operating-system, board, processor, power-plan, and authority checks. No
workload, seed, build flag, iteration count, target value, or acceptance rule
changed. The successful observation was committed separately at `126d15d`.

## Target And Method

- Target ID:
  `win-x64-amd-ryzen-7-8700g-asus-prime-x670e-pro-wifi-20260722`
- Runtime identifier: `win-x64`
- Processor: AMD Ryzen 7 8700G with Radeon 780M Graphics
- Logical processors observed: 16
- Board: ASUSTeK PRIME X670E-PRO WIFI
- Operating system: Windows Server 2022 Standard Evaluation, build
  `20348.5256`
- Power plan: Windows Balanced,
  `381b4222-f694-41f0-9685-ff5bb260df2e`
- Compiler mode: direct dependency-free `rustc`, `opt-level=3`, one codegen
  unit, native CPU selection, and overflow checks enabled
- Process policy: one process at a time, three fresh processes per workload,
  one benchmark thread, normal priority, no affinity pinning, no OS cache flush
- Timer: Rust monotonic `std::time::Instant`
- Percentiles: one-indexed nearest-rank ceiling with no outlier removal

The standalone benchmark consumed only the oracle's public API. It did not
change the exact-flat crate, workspace manifests, Cargo lockfile, or any parent
receipt input. Every process rebuilt its index, generated deterministic
synthetic vectors and queries from the frozen seed, warmed up, retained every
measured nanosecond duration, validated deterministic hit checksums, serialized
and reopened the index, measured working-set and lifetime peak working-set
bytes, then exited. The owned compiler-output directory was marker-checked and
physically deleted.

## Verified Measurements

| Workload | Raw queries | Build p50 ns | Query p50 ns | Query p95 ns | Query p99 ns | Median records/s | Median coordinates/s | Maximum peak bytes | Serialized bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dot, 128 dimensions, 1,000 records | 192 | 1,733,000 | 153,500 | 176,800 | 203,400 | 6,514,657 | 833,876,221 | 5,775,360 | 528,280 |
| cosine, 384 dimensions, 10,000 records | 96 | 31,840,500 | 5,698,000 | 7,803,400 | 9,599,700 | 1,755,001 | 673,920,673 | 57,520,128 | 15,520,280 |
| squared Euclidean, 768 dimensions, 25,000 records | 36 | 135,960,200 | 26,989,000 | 44,663,200 | 48,085,800 | 926,303 | 711,400,941 | 266,911,744 | 77,200,280 |

All three process runs for each workload produced the same validation checksum
and serialized byte count. The observation preserves each process's build and
warmup duration, every query duration, working-set checkpoints, compiler and
binary identities, target probes, command-output hashes, and cleanup evidence.
The table is a direct summary of those raw values, not an extrapolated product
benchmark or a comparison against a compressed method.

## Energy And Hardware Boundary

The counter-set probe succeeded for `Energy Meter`. The registered
`\Energy Meter(*)\Energy` sample probe failed because no instance was present.
No raw counter delta was relabeled as joules, and energy authority remains
false.

Registry CPU, board, BIOS, operating-system, and power-plan fields matched the
preregistration after representation-only trimming. Those observations name
the host but do not independently prove a physical chassis, exclusive machine
ownership, thermal steady state, fixed frequency, or absence of a hypervisor.
Consequently this is named-host performance evidence, not final physical
hardware release evidence.

## Immutable Observation And Receipt

- Observation:
  `exact-flat-physical-target-20bfb3e18230f257`
- Observation source revision:
  `bdca15ece76e74076a5acdfe09a152616ab88fb1`
- Observation file SHA-256:
  `17398b133501443af314b5138211306ebf180b592bfa03f68f6ac48615050483`
- Passing attempt:
  `exact-flat-physical-target-attempt-61b3b96e16391b9c`
- Passing-attempt file SHA-256:
  `6edb73def3ecfe09d1bd3c0ef65c480c10d8b0536affdc25758cdc793bee0cb6`
- Verifier source revision:
  `b272c9b9f503955fab874e0545579394f9893726`
- Child receipt:
  `exact-flat-physical-target-verification-6b478318ef8747cb`
- Child receipt file SHA-256:
  `4cf29cef23b057677e97ed0e03751bac6ad88d31fe44dff2d93582c22d437c1e`

The child verifier reopens and hashes the preregistration, both parents, both
attempts, the observation, benchmark source, runners, and tests. Its adversarial
suite rejects energy or product authority inflation, metric mutation, removal
of the failed attempt, gap removal, verification-input drift, stale content
identity, unknown fields, and shortcut pass booleans.

## Truth Boundary And Next Gate

Newly earned authority is limited to verified latency, throughput, and process
memory for the exact registered workloads on this named host. Energy,
independent chassis attestation, complete physical-target status, browser
performance, representative corpus quality, crash-recovered durable deletion,
compressed retrieval, TurboVec parity, product integration, training, and
release all remain false.

No qualified-model, clean-browser campaign, live MemoryEndpoints, outside P2P,
catalog, package, public-readback, hardware-release, or final-release counter
advances from this experiment.

Next, preregister and build a sealed provenance-bound corpus with exact ground
truth and recall/MRR/NDCG/usefulness metrics, plus crash-recovered on-disk
deletion and compaction proof. A compressed comparison arm remains forbidden
until those baseline gates pass. The missing energy and independent physical
attestation require a separately authorized measurement source rather than a
software assertion.

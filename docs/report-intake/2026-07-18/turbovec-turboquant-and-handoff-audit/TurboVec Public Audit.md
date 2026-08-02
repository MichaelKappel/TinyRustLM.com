# TurboVec Public Audit

## Executive summary

This report audits the public `turbovec` release lineage centered on the GitHub tag `v0.8.0` and the June 10, 2026 publication window described in the assignment brief. fileciteturn0file0

The most important finding is that **the public version story is split across ecosystems**. The GitHub tag `v0.8.0` points to commit `1e7200c`, but the Rust crate metadata in `turbovec/Cargo.toml` at that revision is `0.9.0`, while PyPI published Python package `turbovec 0.8.0` on June 10, 2026. The commit history itself explicitly labels that same June 10 release as “turbovec 0.9.0 (Rust crate) + 0.8.0 (Python package).” In practice, the audit target is best understood as **the repo tag and Python package release**, not a Rust-crate-only `0.8.0` artifact. citeturn50view0turn18view0turn47search0turn9search0

Architecturally, TurboVec is a **local, embedded vector index** implemented in Rust with Python bindings. It is not a database server, managed service, MCP server, or remote API. Its core design is: normalize vectors, apply a **deterministic seeded random orthogonal rotation**, quantize each coordinate with a **dimension-specific Lloyd–Max scalar codebook** derived from a Beta marginal, store one per-vector scale factor, and search with **architecture-specific SIMD LUT kernels** on ARM NEON and x86 AVX-512BW, with AVX2 and scalar fallbacks. It also adds an `IdMapIndex` wrapper for stable external IDs and filtered search. citeturn25search1turn27view0turn27view1turn27view5turn31view0turn24view0

Algorithmically, the implementation is **inspired by TurboQuant but not a literal paper-faithful reproduction of the paper’s unbiased inner-product construction**. The TurboQuant paper describes a two-stage approach that uses an MSE quantizer plus a residual 1-bit QJL step for unbiased inner products. TurboVec instead implements a **single-stage scalar quantization path with a stored per-vector correction factor**, and the repository explicitly says that length-renormalized scoring is adapted from **RaBitQ**. In addition, the code implements a repo-specific **TQ+ per-coordinate calibration** based on empirical 5/95% quantiles from the first add batch, which is not the main abstraction emphasized in the paper abstract. citeturn46academia47turn46academia48turn25search1turn29view0turn30view0turn29view2

From a product-readiness perspective, the core is technically sophisticated and unusually transparent for a young project, but its **risk profile is still “advanced beta” rather than conservative enterprise-ready infrastructure**. Reasons include fast-moving release semantics, ecosystem-version mismatch, benchmark claims that are largely self-reported, and a nontrivial backlog of open issues spanning persistence safety, binding ergonomics, empty-index OOM/DoS concerns, vector-count truncation on save, and integration edge cases. Some of those issues were opened after the June 10 release and therefore do not prove that the audited revision is broken in all cases, but they do show that the public surface is still settling. citeturn26view0turn25search0turn41view1turn47search0

My bottom-line judgment is: **reasonable to evaluate for controlled, local, high-performance ANN workloads where you can pin versions, validate your exact hardware/OS path, and tolerate rapid change; not yet something I would recommend as a default long-term foundation for broad multi-team production without additional hardening, reproducibility checks, and release-process cleanup.** citeturn25search1turn26view0turn50view0turn47search0

## Scope, provenance, and release lineage

The audit target needs one important clarification before any technical conclusions are drawn. The public materials do **not** present a single uniform “0.8.0” identity across Rust and Python. GitHub’s tags page shows tag `v0.8.0` at commit `1e7200c`, while the commit history for June 10, 2026 labels that commit as “Release: turbovec 0.9.0 (Rust crate) + 0.8.0 (Python package).” Meanwhile, `turbovec/Cargo.toml` at that revision reports `version = "0.9.0"` and `rust-version = "1.70"`, and PyPI shows `turbovec 0.8.0` uploaded on June 10, 2026 with trusted publishing and published file hashes. That means the externally visible “v0.8.0” repo tag aligns with the Python package line, while the Rust crate at the same revision is already `0.9.0`. citeturn50view0turn18view0turn47search0turn9search0

The release cadence in May and June 2026 was rapid. PyPI’s release history shows `0.3.0` on April 20, `0.4.x` on May 17–18, `0.5.x` on May 18–25, `0.6.0` on May 27, `0.7.0` on May 30, `0.7.1` on June 9, and `0.8.0` on June 10. GitHub’s commit history mirrors a similar pace, including release commits on May 30, June 9, and June 10. That velocity is positive as a maintenance signal, but it also means interface and behavior shifts can happen quickly enough that strict pinning is essential. citeturn47search1turn47search2turn47search3turn50view0

The repository positions itself as a Rust vector index with Python bindings, claiming no train phase, online ingest, local-only deployment, filtered search, and framework integrations for LangChain, LlamaIndex, Haystack, and Agno. Those claims appear consistently in the GitHub README and PyPI project page. The root repository also clearly contains a Rust core and a Python binding subtree, alongside docs and benchmarks. citeturn25search1turn47search0turn1view0

The theoretical lineage is also explicit. TurboVec cites the TurboQuant paper for the core quantization idea, RaBitQ for the per-vector length-renormalization correction, and FAISS FastScan for x86 packing and SIMD scoring ideas. That is a healthy transparency pattern: the project is not claiming wholly original systems design, but rather a composition of published quantization and kernel techniques into a practical library. citeturn25search1turn46academia47turn46academia48

| Public artifact | Observable version identity | Date visible in public sources | What it appears to mean |
|---|---|---:|---|
| GitHub tag | `v0.8.0` | June 10, 2026 tag page | Repo tag associated with commit `1e7200c` |
| Rust crate metadata | `0.9.0` | Same revision | Rust crate version inside `turbovec/Cargo.toml` |
| PyPI package | `0.8.0` | June 10, 2026 | Python package / wheel and sdist release |

The practical audit implication is simple: when someone says “TurboVec 0.8.0,” you should ask whether they mean **the GitHub tag / Python package** or **the Rust crate API surface inside that tag**, because those are not the same number. citeturn50view0turn18view0turn47search0

## What the implementation actually does

At a high level, the implementation matches the familiar TurboQuant-shaped pipeline: normalize vectors, rotate them, quantize coordinates independently using a distribution-aware scalar codebook, store compact codes and per-vector metadata, then score queries directly against lookup tables instead of reconstructing full floats. The Beta-marginal story is explicit in both the upstream TurboQuant paper and TurboVec’s own code and README. The codebook module states that post-rotation coordinates are treated as following a Beta distribution on `[-1, 1]`, and the rotation module generates a deterministic orthogonal matrix by seeded Gaussian sampling plus QR decomposition. citeturn46academia47turn27view0turn27view1turn27view5

The design departs from a simplistic reading of the TurboQuant paper in two noteworthy ways. First, TurboVec’s README explicitly says its “length-renormalized scoring” is adapted from **RaBitQ**, and the encode path stores a per-vector scale computed as `||v|| / <u_rot, x_hat_orig>`. Second, the code adds a **TQ+ per-coordinate calibration** step: for each rotated coordinate, it fits a shift and scale so that the empirical 5th and 95th percentiles of the first add batch align to the canonical Beta marginal’s 5th and 95th percentiles. The first batch either fits or skips calibration depending on sample count, and subsequent adds reuse that same calibration so the corpus stays in one quantized coordinate system. That is a practical engineering choice, but it is also a library-level policy decision that materially affects reproducibility and ingest semantics. citeturn25search1turn46academia47turn46academia48turn27view10turn27view11turn29view0turn30view0turn29view2

The code makes that first-batch policy concrete. `TQPLUS_MIN_SAMPLES` is `1000`; below that threshold, the implementation keeps identity calibration rather than trusting noisy empirical quantile estimates. That is a sensible stabilization rule, but it means recall characteristics can depend on **when** and **how** the first batch is added. The library authors clearly know this is delicate: the add path contains comments explaining that an empty first add used to lock in identity calibration for the lifetime of the index, and the revised code now returns early so that mistake does not silently disable TQ+ forever. citeturn27view8turn27view9turn22view2turn23view0

On the scoring side, TurboVec is not an IVF or graph ANN system. It is a compact in-memory scan index whose speed story depends on LUT-based SIMD kernels. The search module states that ARM uses NEON with sequential blocked layout, x86 uses AVX-512BW when available with an AVX2 fallback using a FAISS-style permuted layout, and non-SIMD targets fall back to scalar code. The x86 kernels batch byte-group processing using `FLUSH_EVERY = 256` to control accumulator ranges, while the ARM kernel uses nibble-split tables and widening accumulation. There is also explicit runtime dispatch on x86 feature availability and a compile-time rejection of non-64-bit targets. citeturn31view0turn32view4turn32view5turn34view6turn34view7turn21view6turn21view1

The rotation implementation is deterministic rather than dataset-trained. It uses `ChaCha8Rng` seeded from a constant and applies QR decomposition using `faer`, which helps explain why the library can honestly claim “no train step” and fully deterministic compressibility for a given build and input order. That is one of the strongest design properties in the package. citeturn27view1turn25search1

| Component | What TurboVec implements | Why it matters |
|---|---|---|
| Rotation | Seeded Gaussian matrix + QR to get a deterministic orthogonal transform | No train phase; reproducible transform |
| Quantizer | Dimension-specific Lloyd–Max scalar quantizer over Beta marginal | Data-oblivious codebook generation |
| Calibration | TQ+ shift/scale per coordinate from first batch quantiles | Better empirical fit, but ingest-order sensitivity |
| Bias correction | Per-vector multiplicative scale inspired by RaBitQ | Corrects shrinkage without second-stage residual quantizer |
| Search | LUT-based SIMD scan kernels, not IVF/HNSW | Strong local throughput, but still essentially a compressed scan index |

The biggest conceptual takeaway is that TurboVec is **not “the paper in a crate”**. It is better described as **a practical ANN library that blends TurboQuant-style scalar quantization, repo-specific calibration policy, RaBitQ-style score correction, and FAISS-style fast-scan kernel ideas**. That is not a criticism; it is simply the most faithful technical description of the public code. citeturn25search1turn46academia47turn46academia48turn29view2turn37view1

## Public API, package structure, and persistence semantics

The visible source tree exposes a focused Rust core under `turbovec/src` with modules `codebook`, `encode`, `error`, `id_map`, `io`, `pack`, `rotation`, and `search`. That organization is coherent and maps cleanly to the library’s public surface: `TurboQuantIndex` is the slot-addressed index, `IdMapIndex` is the external-ID wrapper, `SearchResults` returns flattened scores and indices, and `AddError` / `ConstructError` model recoverable user-input failures. citeturn19view0turn21view7turn24view0turn44view0

The constructor story is clear. `TurboQuantIndex::new(dim, bit_width)` accepts only bit widths `2..=4`, requires `dim` to be a positive multiple of 8, and enforces a maximum dimension of `65536`. `new_lazy(bit_width)` allows a dimensionless empty index that commits its dimension on first structured add. The crate also enforces a 64-bit target at compile time. Those rules are not cosmetic; they are tied to packing math, blocked-layout assumptions, and the cost of the lazily built `dim × dim` rotation matrix. citeturn22view1turn21view1turn21view6turn44view0

Mutation semantics are mostly straightforward but worth pinning down. Raw `add(&[f32])` is a low-level path that can panic on misuse or invalid values, whereas `add_2d` returns typed `AddError` values for dimension mismatch, invalid coordinates, and certain lazy-index initialization errors. `IdMapIndex::add_with_ids_2d` validates buffer shape, validates ID count, rejects IDs already present in the index, rejects duplicates within the same call, and deliberately performs validation before mutating the underlying slot tables so partial failure does not leave “ghost” IDs behind. That is a strong transactional property for the add path. Remove is O(1) via swap-remove semantics, which is clearly documented and implemented. citeturn22view2turn42view0turn45view0turn45view1turn24view4turn44view0

Search semantics are also more precise than they may appear from marketing copy. `search_with_mask` on the raw index returns the top `k` among allowed slots, but the **effective** result count is `min(k, n_allowed)` when a mask is selective. The ID-mapped wrapper translates an allowlist of external IDs into a boolean slot mask, deduplicates repeated IDs naturally through mask assignment, and panics if an allowlist contains an ID not present in the index. The wrapper then maps returned slot indices back to external IDs. That means TurboVec’s filtered-search contract is stronger than post-filter overfetch, but it also means callers must treat missing IDs in allowlists as programmer errors rather than soft misses. citeturn22view3turn24view3turn45view1turn25search1turn47search0

Persistence is split into two binary formats. The `io` module documents `.tv` for the raw quantized index and `.tvim` for the ID-mapped index. Both formats use a versioned core payload containing the core header, packed codes, per-vector scales, and, in version 3, a TQ+ calibration trailer. `.tvim` then appends a trailing `slot_to_id` table of `u64`s. The loader supports versions 2 and 3, explicitly rejects version 1 as incompatible because the meaning of the per-vector scalar changed, and validates header fields before allocating. The load path also treats `dim == 0` as a lazy-index sentinel that is only valid with `n_vectors == 0`. citeturn40view0turn40view2turn40view3turn40view4turn41view0

The packed storage path deserves special mention because it affects reproducibility and interoperability. During encode, each coordinate’s code bits are written into bit planes, and `pack::repack` then reconstructs per-group bytes and arranges them into a blocked SIMD layout. On x86, this becomes a FAISS-style interleaved hi/lo nibble layout using a `perm0` permutation; on non-x86 targets, the blocked layout is sequential. The project even includes a deinterleave helper because the scalar x86 fallback once produced silently wrong results without it. This is a detail-heavy but reassuring sign that the maintainers understand their storage layout deeply. citeturn38view0turn38view1turn38view2turn37view1

| Surface area | Behavior |
|---|---|
| Raw index | Slot-addressed compressed vector store |
| ID index | Stable external IDs with O(1) delete via swap-remove |
| Adds | Low-level flat add plus structured/dimension-aware add |
| Search | Top-k search with optional slot mask or ID allowlist |
| Persistence | `.tv` and `.tvim`, versioned, with v2/v3 compatibility rules |
| Threading | Search caches are lazy and thread-safe via `OnceLock`; `prepare()` warms them eagerly |

## Compatibility, performance, and security assessment

The compatibility story is intentionally hardware-aware. TurboVec requires a 64-bit target, advertises an x86-64-v3 baseline for x86 builds in its README, performs runtime x86 feature detection for AVX-512BW versus AVX2, uses NEON on ARM, and links external BLAS providers on Linux and macOS through `build.rs` so downstream binaries inherit the needed `cblas_sgemm` linkage. On Linux that is `openblas`; on macOS it is `Accelerate`; on Windows the build script comments say the project falls back to ndarray’s pure-Rust matrix multiply path. That is pragmatic, but it means operational behavior will vary materially by platform and CPU. citeturn21view6turn25search1turn31view0turn49view0turn49view1turn49view2

Performance claims should be treated as **credible but not yet independently established by this audit**. The repository and PyPI page claim faster-than-FAISS behavior in several configurations, especially on ARM and often at 4-bit on x86, and they describe benchmark datasets and scripts in detail. However, those are still project-authored benchmark claims. The project does appear to invest seriously in kernel correctness and architecture parity; the search code comments explicitly discuss accumulator flushing to close a historical ARM-vs-x86 recall gap, and the benchmark harness is public. Still, until you reproduce on your own corpora and machine classes, these numbers should be read as engineering evidence, not procurement-grade proof. citeturn25search1turn47search0turn32view9turn50view0

Where the audit becomes more cautionary is the visible issue surface. As of July 18, 2026, open issues include claims about: search/prepare on an empty loaded index building a full rotation matrix and becoming an OOM/DoS vector; untrusted loads accepting non-finite or negative float payloads leading to NaN/Inf/garbage search results; `write_core` truncating `n_vectors` via `as u32`; non-atomic save behavior that can destroy a previous good index on write failure; Python bindings not releasing the GIL; and several integration-layer data-integrity/documentation issues. Earlier open issues in June also included add/remove benchmark gaps, duplicate-ID problems in integrations, and upsert validation/data-loss semantics. Some of these concern wrapper layers more than the Rust core, and some may post-date the pinned revision; nonetheless, they are highly relevant to present-day adoption risk. citeturn26view0turn25search0

It is also important to separate **hardened paths** from **known rough edges**. The `io` module has clearly received security-minded work: it validates header fields before allocating, uses checked arithmetic for attacker-controlled sizes, bounds dimension by `MAX_DIM`, and reads exact-length byte arrays without pre-reserving the attacker’s claimed size. Those are good signs. But the same public issue tracker still shows ongoing concerns around persistence atomicity, numeric validation on load, and empty-index search behavior. In other words, the project is visibly improving its hardening, but it is not at a stable endpoint yet. citeturn40view3turn41view1turn26view0

A concise risk view is below.

| Area | Strengths | Residual concerns |
|---|---|---|
| Core math pipeline | Deterministic, transparent, paper-linked design | Not a paper-exact implementation; calibration policy affects ingest semantics |
| SIMD kernels | Serious architecture-specific engineering | Hardware- and layout-dependent complexity raises portability/debug cost |
| Persistence | Versioned formats, checked sizes, lazy sentinel conventions | Open issues on atomic save, vector-count truncation, and some load-path edge cases |
| Bindings/integrations | Useful Python wheels and framework adapters | GIL issue, wrapper edge cases, integration data integrity still evolving |
| Benchmarks | Public scripts and explicit baselines | Mostly self-reported; insertion/removal benchmarking was still requested publicly |

If I were shipping this today, I would require: exact version pinning by commit SHA, platform-by-platform benchmark reproduction, explicit corrupt-file tests, backup-safe atomic write wrappers, and a policy for first-batch calibration behavior. Without those controls, the package is too dynamic to treat as “drop-in boring infrastructure.” citeturn50view0turn41view1turn26view0

## Maintenance signals and final recommendation

The maintenance picture is mixed in a constructive way. On the positive side, the project is active, release cadence is high, public docs are extensive, the benchmark methodology is described, PyPI releases use trusted publishing and expose hashes, and the issue tracker is actively used to discuss both correctness and ecosystem expansion. There is also evidence of CI/workflow investment in the commit history, and the repository has accumulated meaningful public attention in stars and forks. Those are all good signs that the project is alive rather than abandoned. citeturn47search0turn50view0turn25search1

On the caution side, the issue tracker also shows that the project is still metabolizing correctness work at multiple layers: Rust core, file I/O, Python bindings, and framework adapters. The June 10 commit history even includes a release immediately after a “security audit fixes” commit, which suggests hardening work is still closely tied to release motion. That is not inherently bad, but it reinforces the conclusion that this is a fast-moving project where “latest” and “stable enough for my workload” are not the same question. citeturn50view0turn26view0

The versioning mismatch between Git tag, Rust crate, and Python package is the single most actionable process issue. It raises needless ambiguity for audits, SBOM generation, and incident response. If the maintainers want broader adoption, I would put version-line unification or much clearer artifact naming very near the top of the roadmap. The second priority would be persistence hardening and clearer guarantees around untrusted-load safety and atomic saves. The third would be wrapper stabilization, especially Python concurrency and integration correctness. citeturn50view0turn18view0turn47search0turn26view0

My final recommendation is:

| Use case | Recommendation |
|---|---|
| Solo or small-team evaluation on fixed hardware | **Yes, with pins and local validation** |
| Internal high-performance RAG prototype | **Reasonable candidate** |
| Multi-tenant service with untrusted files and strict durability requirements | **Not without extra hardening layers** |
| Broad enterprise standardization across teams/platforms | **Too early today** |

In one sentence: **TurboVec looks like a technically impressive embedded ANN library with unusually strong low-level engineering for its age, but it still behaves more like a rapid-iteration systems project than a mature, low-risk platform component.** citeturn25search1turn26view0turn47search0turn50view0
# Six Disconnected Deep Research Prompts: TurboVec And TurboQuant

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. Do not assume that an agent receives this
introduction, another prompt, a prior research report, or any private project
context.

The purpose of this second research pass is to turn public TurboQuant and
TurboVec ideas into precise, falsifiable engineering options for TinyRustLM.
It must go deeper than repeating paper abstracts, README performance claims,
or generic quantization advice. Every report must distinguish:

- directly observed public facts;
- claims made by authors or project maintainers;
- independently reproduced or externally corroborated facts;
- the research agent's technical analysis and recommendations; and
- facts that require private TinyRustLM inspection or local execution.

For all six assignments, `TurboQuant` means the algorithm family described by
the TurboQuant paper and its identified revisions. It is not a generic name
for low-bit model weights. `TurboVec` means the public
`RyanCodrai/turbovec` project unless a primary source establishes otherwise.
The reports must keep these data classes separate:

1. static transformer weights and immutable `.slm` model artifacts;
2. transient online transformer key/value cache state; and
3. persistent embedding vectors used for semantic retrieval.

No report may claim that TinyRustLM currently uses TurboQuant, TurboVec, QJL,
RaBitQ, EDEN, Fast-TurboQuant, or any similar method. No report may claim a
speedup, memory reduction, recall result, accuracy result, browser support, or
quality-neutral bit width for TinyRustLM without local evidence.

## Prompt 1: Normative TurboQuant Mathematics, Algorithms, And Golden Vectors

You are an independent principal researcher in information theory, numerical
linear algebra, probability, quantization, and reproducible scientific
computing. Produce an exceptionally detailed, equation-level report that
reconstructs TurboQuant from primary sources and turns it into an unambiguous
normative specification suitable for independent scalar implementations and
golden-vector tests.

You have internet access. You do not have access to the TinyRustLM source tree,
private models, `.slm` artifacts, training data, prompts, evaluation cases,
runtime output, credentials, benchmark receipts, or development machines. You
may inspect public papers, proceedings, author repositories, public package
registries, issue trackers, and public implementations. Do not imply that you
inspected or validated private TinyRustLM code.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local conversational AI system with a
  custom Rust/WASM inference runtime and portable `.slm` model artifacts.
- Plausible models are compact transformers around 0.3B to 2B parameters and
  are expected to run on consumer CPUs and browser WebAssembly.
- Performance matters only when semantic quality remains within explicit
  budgets. Important quality dimensions include ordinary conversation,
  practical constraints, ambiguity handling, source conflict, latest-user
  precedence, untrusted-memory handling, multi-turn continuity, summaries,
  rewrites, structured output, and code explanation.
- Static weight quantization, online KV-cache compression, and persistent
  embedding compression are different engineering problems. Evidence for one
  does not transfer automatically to another.
- TinyRustLM is not live. No compatibility shim, deprecated representation,
  or legacy file reader is required. A poor experiment may be deleted and
  replaced cleanly, while its immutable research and failure receipts remain.
- The report is research input. It does not authorize dependency adoption,
  copied source, a format change, or a public product claim.

### Primary Sources To Retrieve And Pin

Start with these public sources, then follow their primary citations:

- TurboQuant arXiv record: https://arxiv.org/abs/2504.19874
- TurboQuant ICLR record: https://openreview.net/forum?id=tO3ASKZlok
- TurboQuant conference PDF: https://openreview.net/pdf?id=tO3ASKZlok
- Google Research overview:
  https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/
- Quantized Johnson-Lindenstrauss transform:
  https://arxiv.org/abs/2406.03482
- DRIVE: https://proceedings.neurips.cc/paper/2021/hash/0397758f8990c1b41b81b43ac389ab9f-Abstract.html
- EDEN: https://proceedings.mlr.press/v162/vargaftik22a.html
- RaBitQ: https://arxiv.org/abs/2405.12497
- Symmetric RaBitQ/TurboQuant comparison:
  https://arxiv.org/abs/2604.19528
- DRIVE/EDEN/TurboQuant comparison note:
  https://arxiv.org/abs/2604.18555
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448
- TurboVec public repository: https://github.com/RyanCodrai/turbovec

Record every paper version, publication status, author list, date, revision
date, immutable repository commit, license, and retrieval date. Compare the
latest arXiv and conference versions line by line where equations, algorithms,
theorems, experimental parameters, or claims differ. Treat author blogs and
README files as author claims, not independent confirmation.

### Required Technical Work

1. Establish notation and define every optimization objective separately:
   total and per-coordinate reconstruction MSE, normalized MSE, angular error,
   cosine error, Euclidean-distance distortion, biased and unbiased inner
   product estimation, estimator variance, ranking preservation, attention
   logit error, and downstream task quality.
2. State the exact input domain and normalization convention. Cover arbitrary
   nonzero vectors, unit-sphere directions, stored norms, zero vectors,
   subnormal values, infinities, NaNs, and negative zero. Explain which cases
   the theory excludes and which an implementation must still handle.
3. Reconstruct the random transformation. State matrix dimensions,
   distribution, Haar or QR construction, orientation, multiplication order,
   precision, seed semantics, setup memory, generation cost, and whether the
   decoder or query path needs the inverse.
4. Derive the marginal distribution of one coordinate after a uniformly
   random rotation of a fixed unit vector. Give the exact finite-dimensional
   density, support, Beta parameterization, scaling conventions, variance, and
   Gaussian limit. Distinguish identical marginals from independent
   coordinates.
5. Reconstruct `TurboQuant_mse` as numbered encode and decode algorithms. Show
   norm separation, rotation, scalar codebook choice, nearest-centroid rule,
   tie behavior, packed code generation, reconstruction, inverse rotation, and
   norm restoration.
6. Derive the Lloyd-Max codebook used for each bit width. Provide boundary and
   centroid equations, convergence rules, initialization, numerical precision,
   symmetry constraints, deterministic stopping, and a method to produce
   canonical tables without copying implementation constants.
7. Reproduce the distortion analysis. State the expectation domains,
   randomness, finite-dimension assumptions, high-resolution approximations,
   Shannon lower-bound comparison, normalization, constants, and exact meaning
   of the reported constant-factor gap.
8. Reconstruct `TurboQuant_prod` or the paper's inner-product-oriented variant.
   Show how the first-stage bit budget is chosen, how the residual is formed,
   what norm or scale is stored, how QJL encodes the residual, and how an
   asymmetric high-precision query produces the estimator.
9. Prove or carefully restate the unbiasedness and variance arguments. Explain
   conditional versus unconditional expectation, independence requirements,
   covariance terms, finite precision, repeated-query behavior, and why an
   unbiased estimator can still reorder nearest neighbors or alter attention.
10. Compare direct b-bit EDEN, a `(b-1)+1` residual construction, RaBitQ score
    correction, and TurboQuant at exactly equal total bytes. Mark theorem,
    asymptotic argument, empirical observation, disputed claim, and engineering
    inference separately.
11. Analyze dense rotations, randomized Hadamard transforms, Rademacher signs
    plus FWHT, FJLT, Kac-walk transforms, sparse JL, and fixed orthogonal
    products. Give complexity, padding, invertibility, norm error, setup cost,
    seed storage, query cost, SIMD fit, and effect on the original proof.
12. Audit Fast-TurboQuant's claims against its actual construction. Determine
    whether zero padding changes the represented geometry, effective dimension,
    bit denominator, codebook distribution, MSE denominator, and recall
    comparison. Separate arithmetic-operation counts from wall-clock speed.
13. Provide complete effective-storage equations. Count coordinate codes,
    norms, residual norms, sign sketches, seeds, matrices, codebooks, padding,
    row alignment, calibration arrays, correction factors, indexes, allocator
    slack, and query scratch. Evaluate dimensions 64, 80, 96, 128, 160, 200,
    256, 384, 512, 768, 1024, 1536, 2048, 3072, and 4096.
14. Analyze finite-dimension and adversarial inputs: basis vectors, repeated
    coordinates, sparse vectors, anisotropic covariance, clustered embeddings,
    heavy tails, outliers, quantized upstream inputs, distribution drift,
    nearly collinear candidates, and exact or near score ties.
15. Explain precisely which statements support online KV-cache use, which
    support nearest-neighbor retrieval, and which do not support static model
    weight quantization. Do not call a residual sign sketch a one-bit model.
16. Write language-neutral reference pseudocode for transform generation,
    codebook construction, MSE encode/decode, residual encode, approximate dot
    product, and compressed-domain scoring. Specify integer widths, float
    widths, rounding, bit order, endianness, overflow behavior, and errors.
17. Design independently generated golden vectors. Include zero, basis,
    uniform, sparse, non-power-of-two, extreme-norm, random unit, and
    adversarial near-tie cases. Define input serialization, expected
    intermediate values, output hashes, and numeric tolerances.
18. End with falsifiable recommendations for TinyRustLM. For each candidate
    idea, name the relevant data class, scalar baseline, controlled variable,
    accuracy metric, performance metric, memory accounting, stop rule, and
    local evidence required before any optimized implementation begins.

### Required Report Structure

1. Executive conclusion and explicit assumptions.
2. Dated primary-source and revision ledger.
3. Version-difference and disputed-claim table.
4. Notation, domains, and objective taxonomy.
5. Exact rotated-coordinate distribution derivation.
6. Normative `TurboQuant_mse` specification.
7. Canonical Lloyd-Max construction.
8. Distortion theorem and lower-bound analysis.
9. Normative inner-product and QJL specification.
10. Bias, variance, and ranking consequences.
11. Equal-byte EDEN, DRIVE, RaBitQ, and TurboQuant comparison.
12. Dense and structured transform analysis.
13. Effective-storage formulas and worked tables.
14. Finite-dimension and adversarial analysis.
15. Reference pseudocode.
16. Golden-vector schema and proposed vectors.
17. TinyRustLM applicability and experiment matrix.
18. Unknowns requiring local execution.
19. Annotated primary-source bibliography with direct links and dates.

Do not provide a generic quantization tutorial. Do not quote headline speed or
compression numbers without denominators and complete metadata. Do not treat
expected unbiasedness as zero variance, ranking preservation, or unchanged
language quality. Do not silently select one paper revision. Do not copy
constants or test vectors from source code without provenance and license
analysis. Do not imply that any TinyRustLM model, cache, or index has been run.

## Prompt 2: Commit-Level TurboVec Architecture, Format, And Kernel Audit

You are an independent principal Rust engineer, unsafe-code auditor, SIMD
specialist, vector-search architect, binary-format reviewer, and software
supply-chain investigator. Produce an exceptionally detailed public-source
audit of the current TurboVec project. The report must explain exactly how the
public code works at a pinned revision, where it diverges from the TurboQuant
paper, and which isolated techniques could be useful for a clean Rust/WASM
implementation focused on both speed and accuracy.

You have internet access and may inspect the public TurboVec repository,
immutable commits, tags, releases, crate documentation, crates.io metadata,
PyPI artifacts, tests, benchmarks, issues, and dependencies. You have no
access to the TinyRustLM source tree, models, `.slm` files, prompts, benchmark
receipts, credentials, or machines. Never imply that you inspected private
TinyRustLM code or confirmed local behavior.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat system using Rust, WebAssembly,
  portable model files, and optional local companion processes.
- Target execution is consumer x86-64, ARM64, and browser WASM for compact
  transformer models. A native Python or AVX-512 result is not browser proof.
- Exact input identity, deterministic output, bounded memory, fail-closed
  parsing, reproducible tests, and untouched semantic-quality evidence matter.
- TurboVec is a third-party project. A permissive license, popularity, or
  benchmark chart does not authorize adoption, source copying, unsafe code, or
  format reuse.
- Model weights, transient KV cache, and persistent semantic-search vectors are
  separate. TurboVec should be treated as an embedding index unless public code
  proves a broader implemented scope.
- TinyRustLM has no released legacy contract. Recommend clean replacement or
  deletion when appropriate, not compatibility debt for an unshipped design.

### Public Sources To Pin

At minimum inspect and cross-check:

- Repository: https://github.com/RyanCodrai/turbovec
- Commit history and tags: https://github.com/RyanCodrai/turbovec/commits/main
- Releases: https://github.com/RyanCodrai/turbovec/releases
- Rust documentation: https://docs.rs/turbovec/
- crates.io package: https://crates.io/crates/turbovec
- PyPI package: https://pypi.org/project/turbovec/
- TurboQuant: https://arxiv.org/abs/2504.19874
- RaBitQ: https://arxiv.org/abs/2405.12497
- FAISS FastScan description:
  https://github.com/facebookresearch/faiss/wiki/Fast-accumulation-of-PQ-and-AQ-codes-%28FastScan%29

Pin exact commit hashes for the audited default branch and each release used.
Record tag object, Rust crate version, Python package version, package file
hashes, publication times, MSRV, target configuration, features, dependency
locks, licenses, security policy, and retrieval date. Verify any reported
version mismatch rather than repeating it. Use immutable source links with line
anchors for all material code claims.

### Required Technical Work

1. Produce a repository map for every Rust, Python-binding, build, benchmark,
   test, documentation, and persistence module. Identify generated code and
   code excluded from packages.
2. Trace the complete state machine from constructor through first add, later
   add, remove, upsert, filter, query, persistence, load, cache preparation,
   and concurrent read. Show every validation and mutation boundary.
3. Reconstruct each public type and material private field. Explain dimensions,
   bit width, packed layouts, transforms, centroids, calibration arrays,
   correction values, IDs, tombstones, prepared layouts, lazy caches, locks,
   and query scratch. Give exact or formula-based byte cost.
4. Determine the exact rotation implementation at the pinned revision. Cover
   PRNG algorithm, seed derivation, QR or alternative construction, BLAS/LAPACK
   use, matrix precision, orientation, reproducibility, orthogonality checks,
   `O(d^2)` storage, construction cost, and maximum allocation.
5. Audit every meaning of "online," "training-free," and "data-oblivious."
   If the first add estimates empirical quantiles or calibration parameters,
   explain how that changes ingestion-order dependence, reproducibility,
   distribution drift, persistence identity, and those descriptions.
6. Reconstruct TQ+ calibration precisely. State sample thresholds, percentile
   estimator, interpolation, per-coordinate shifts and scales, clipping,
   degenerate-coordinate behavior, freeze rules, later-add behavior, and
   whether two insertion orders produce different bytes or rankings.
7. Reconstruct the per-vector length or bias correction. Identify the exact
   formula, source lineage, denominator-zero behavior, numeric type, metadata
   cost, ingest cost, search cost, and whether the code's estimator is actually
   unbiased under stated assumptions.
8. Specify every supported bit width and dimension constraint. Distinguish
   accepted constructor values from fully optimized, persisted, tested, and
   documented paths. Cover dimensions not divisible by vector or packing block
   sizes.
9. Document packed code formats bit by bit. Include coordinate order, byte
   order, nibble order, interleaving, block transposition, padding, alignment,
   tail handling, duplicated query/search layouts, and conversion costs.
10. Reconstruct query processing. Cover query validation and normalization,
    rotation, calibration, lookup-table generation, table quantization if any,
    score accumulation, correction, metric semantics, top-k heap behavior,
    tie ordering, NaNs, duplicates, filters, and short-result behavior.
11. Audit scalar, AVX2, AVX-512BW, AVX-512VBMI if present, ARM NEON, and any
    threaded paths separately. List intrinsics, lane packing, accumulator
    widths, flush intervals, saturation, overflow proofs, feature detection,
    target-feature compilation, and scalar differential tests.
12. Inventory all `unsafe` blocks, raw pointers, unchecked indexing, FFI,
    alignment assumptions, and target-specific compilation. For each, document
    its safety invariant, whether tests prove it, and malformed inputs that can
    violate it.
13. Audit runtime dispatch. Explain baseline CPU requirements, process startup
    behavior, fallback rules, illegal-instruction risk, heterogeneous-core
    assumptions, and whether binaries remain portable across advertised
    machines.
14. Determine actual WebAssembly compatibility. Attempt a public-source-only
    dependency and target analysis for `wasm32-unknown-unknown`. Identify BLAS,
    filesystem, threading, intrinsic, allocator, `getrandom`, and packaging
    blockers. Explain what WASM SIMD128 could implement and what would need a
    new kernel.
15. Reverse-engineer each persistent format. Specify magic, version, endian,
    flags, dimensions, counts, offsets, lengths, bit width, transform identity,
    seeds or matrices, codebooks, calibration, correction values, IDs,
    tombstones, checksums, trailing data, and canonical serialization.
16. Perform a hostile-format review. Trace validation order, integer overflow,
    allocation-before-validation, truncation, duplicate IDs, absurd dimensions,
    invalid floats, malformed packed tails, checksum gaps, decompression or
    allocation bombs, symlink behavior, and partial-write recovery.
17. Audit atomicity and concurrency. Cover add failure after partial mutation,
    remove/upsert consistency, lazy prepared-cache invalidation, simultaneous
    searches, write during mutation, Python GIL release, thread safety, and
    crash behavior.
18. Reconstruct every published benchmark from code and retained raw results.
    Capture dataset identity, preprocessing, ground truth, k, corpus/query size,
    hardware, compiler flags, threads, warmup, repetitions, statistic, recall
    definition, omitted setup, memory denominator, and baseline configuration.
19. Attribute accuracy and speed separately. Require ablations for base
    TurboQuant centroids, TQ+ calibration, length correction, bit width,
    transformed packing, SIMD lookup, filtering, multithreading, and top-k.
20. Produce an adoption decision. Compare direct dependency, pinned reference
    comparator, fork, clean-room paper-derived implementation, extraction of
    isolated mathematical ideas, and deferral. Score accuracy authority,
    native speed, WASM fit, format ownership, unsafe exposure, maintenance,
    provenance, and supply-chain risk.

### Required Report Structure

1. Executive disposition and explicit assumptions.
2. Immutable source, package, release, and license ledger.
3. Version-identity reconciliation.
4. Repository and dependency architecture map.
5. Public API and mutation state machine.
6. In-memory representation and byte formulas.
7. Rotation and codebook implementation.
8. TQ+ calibration and ingest-order analysis.
9. Bias correction and estimator analysis.
10. Packing and query-scoring specification.
11. Scalar and native SIMD kernel audit.
12. Unsafe, FFI, concurrency, and dispatch audit.
13. WASM build and browser-portability assessment.
14. Persistent format specification and hostile-input audit.
15. Benchmark reconstruction and missing-cost table.
16. Accuracy and performance attribution matrices.
17. Supply-chain and maintenance assessment.
18. Adopt, compare, fork, clean-room, or defer decision.
19. Proposed local conformance and differential tests.
20. Unknowns requiring TinyRustLM inspection or execution.
21. Annotated primary-source bibliography with direct immutable links and
    dates.

Do not paraphrase the README as a code audit. Do not call Rust code portable to
WASM without dependency and target analysis. Do not call first-batch-fitted
calibration data-oblivious without carefully defining the term. Do not accept
nominal bits as complete memory accounting. Do not infer safety from tests
alone. Do not recommend preserving an unshipped API. Do not claim that
TinyRustLM currently depends on or behaves like TurboVec.

## Prompt 3: TurboQuant-Style Transformer KV Cache For CPU And Browser WASM

You are an independent principal transformer-inference architect, attention
researcher, quantization specialist, Rust/WASM systems engineer, and model
quality evaluator. Produce an exceptionally detailed design report for
testing TurboQuant-family ideas in an online transformer KV cache on consumer
CPUs and browser WebAssembly. The report must explain the exact algorithms,
tensor placement, cache layouts, numerical consequences, and quality gates.

You have internet access but no access to TinyRustLM source code, model files,
tokenizers, prompts, evaluation cases, runtime logs, browser traces,
credentials, or development hardware. You may inspect public papers, model
cards, architecture configurations, public inference runtimes, and standards.
Never claim that a design is already compatible with or validated by private
TinyRustLM code.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat product with a custom Rust/WASM
  runtime and portable `.slm` artifacts.
- Candidate models are roughly 0.3B to 2B parameters and may use MHA, GQA, or
  MQA; RoPE variants; sliding windows; and model-specific head dimensions.
- The primary execution targets are scalar CPU, x86-64, ARM64, and WASM
  SIMD128. Datacenter-GPU kernels are useful references but not proof.
- KV-cache compression is transient runtime state. It does not change model
  parameter precision, `.slm` file size, model identity, or whether a model is
  a one-bit model.
- Compressed bytes are useful only if the attention path consumes them without
  maintaining an uncounted full-precision shadow cache.
- Quality gates include ordinary conversation, ambiguity, practical resource
  constraints, source conflict, current-turn precedence, untrusted quoted
  memory, multi-turn continuity, summaries, rewrites, JSON, and code help.
- TinyRustLM is not live and has no legacy cache format obligation. Recommend
  one clean experiment design; failed formats can be removed entirely.

### Primary Sources To Verify

At minimum inspect:

- TurboQuant: https://arxiv.org/abs/2504.19874
- ICLR record: https://openreview.net/forum?id=tO3ASKZlok
- QJL: https://arxiv.org/abs/2406.03482
- KIVI: https://arxiv.org/abs/2402.02750
- PolarQuant: https://arxiv.org/abs/2502.02617
- PQCache: https://arxiv.org/abs/2407.12820
- Symmetric TurboQuant/RaBitQ comparison:
  https://arxiv.org/abs/2604.19528
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448

Also inspect primary model configuration and tokenizer sources for realistic
0.3B to 2B MHA/GQA/MQA architectures. Pin immutable revisions, licenses,
publication dates, update dates, and retrieval date. Separate paper algorithms,
author implementations, third-party ports, and your proposed design.

### Required Technical Work

1. Define transformer tensor notation from input embeddings through Q, K, V,
   RoPE, attention logits, masking, softmax, and value accumulation. Give exact
   shapes for batch, layer, query heads, KV heads, sequence, and head dimension.
2. Derive uncompressed cache bytes for MHA, GQA, and MQA under f32, bf16, and
   f16. Include allocator, page, alignment, prefix, and duplicate-layout costs,
   not only `layers * tokens * heads * dim * bytes`.
3. Explain why keys and values have different error objectives. Keys affect
   inner-product ordering and softmax; values affect weighted accumulation.
   State which TurboQuant objective is relevant to each and why one shared
   quantizer may be wrong.
4. Compare pre-RoPE and post-RoPE key compression. Derive transform ordering,
   whether inverse transforms are needed, interaction with position-dependent
   rotations, partial rotary dimensions, rope scaling, long positions,
   prefix reuse, and cache portability.
5. Specify candidate key formats: f16 baseline, int8, transparent blockwise
   int4, TurboQuant MSE, TurboQuant inner-product/QJL, EDEN-style, RaBitQ-style,
   and structured-transform variants. Equalize all scales, norms, seeds,
   codebooks, residuals, padding, and scratch.
6. Specify candidate value formats independently. Analyze per-token,
   per-channel, per-head, per-group, and per-page scaling; value outliers;
   residuals; reconstruction versus direct accumulation; and the likely cost of
   QJL-style estimators for weighted sums.
7. Design exact cache pages. Include canonical identity, model and adapter hash,
   layer, KV-head geometry, token range, transform family and seed, codebook,
   key and value policy, bit allocation, scales, residuals, outliers, lengths,
   checksum, alignment, and bounded parser rules.
8. Define append behavior for one decode token and bulk prefill. Show when
   transforms, calibration, quantization, packing, and page finalization occur.
   Account for partially filled pages and cancellation at every boundary.
9. Design a recent-token precision policy. Compare no window, fixed token
   window, fixed page window, layer-specific windows, and error-triggered
   promotion. State exact memory formulas and avoid data-dependent behavior
   that breaks deterministic replay unless identity-bound.
10. Cover grouped-query sharing, beam or branch behavior if relevant, prompt
    prefixes, sliding-window attention, context truncation, speculative decode,
    model switch, adapter switch, reset, and cache invalidation.
11. Derive compressed-domain key scoring. Show query transform, LUT creation,
    packed code consumption, accumulator precision, scale/correction
    application, causal mask, softmax stabilization, and top-attended-token
    agreement without full key reconstruction.
12. Derive value accumulation options. Compare reconstruct-per-page,
    reconstruct-per-token, LUT accumulation, integer accumulation, fused
    dequantization, and full shadow cache. Identify which paths could reduce
    memory bandwidth on CPU/WASM and which merely move work.
13. Analyze numerical error propagation layer by layer and token by token.
    Include logit perturbation, softmax sensitivity, near ties, value error,
    residual-stream accumulation, exact-token divergence, and feedback after a
    changed sampled token.
14. Define scalar reference attention and golden cases. Include zero keys,
    repeated keys, one dominant key, near-equal logits, long positions,
    non-power-of-two dimensions, GQA head sharing, masks, sliding windows,
    outliers, and all supported bit widths.
15. Define differential tests across Python/f64 oracle, scalar Rust, optimized
    native, and WASM. Specify acceptable tolerances for reconstructed vectors,
    logits, softmax, layer outputs, next-token logits, argmax, and sampled token
    streams.
16. Design native and browser memory accounting. Measure allocated, committed,
    resident, WASM linear pages, scratch, duplicate layouts, transform storage,
    page fragmentation, peak prefill, steady decode, and teardown.
17. Design performance measurement. Separate cache append, page conversion,
    query transform, LUT construction, key scan, softmax, value accumulation,
    sampler, prefill, time-to-first-token, decode tokens/second, p50/p95/p99,
    context growth, and cold WASM compilation.
18. Design no-cheat model-quality evaluation. Bind immutable model bytes,
    tokenizer, chat template, prompt hashes, sampling profile, seeds, runtime,
    cache policy, raw logits or summaries, raw output, and evaluator. Preserve
    untouched failures; prohibit repair and best-of-N selection.
19. Preregister promotion and stop rules. Memory reduction cannot compensate
    for critical source-authority, latest-turn, practical-constraint,
    untrusted-memory, or ordinary-helpfulness regressions. Define equivalence
    margins rather than treating nonsignificance as equivalence.
20. Recommend the smallest CPU/WASM prototype sequence. State which key and
    value experiment should run first, why its mechanism is non-redundant,
    what code can be deleted after rejection, and what evidence is needed
    before browser integration.

### Required Report Structure

1. Executive design recommendation and assumptions.
2. Dated source, model-family, and implementation ledger.
3. Attention notation and cache geometry.
4. Baseline and effective-byte formulas.
5. Key-versus-value objective analysis.
6. RoPE placement and positional semantics.
7. Candidate key-format matrix.
8. Candidate value-format matrix.
9. Page schema, append state machine, and lifecycle.
10. Recent-token and outlier policies.
11. Compressed key-scoring algorithms.
12. Value-accumulation algorithms.
13. Numerical error propagation.
14. Scalar oracle and golden-vector plan.
15. Native/WASM differential test plan.
16. Memory and performance benchmark design.
17. Untouched model-quality protocol.
18. Promotion, rejection, and deletion rules.
19. Prioritized clean-slate prototype sequence.
20. Unknowns requiring local TinyRustLM execution.
21. Annotated primary-source bibliography with direct links and dates.

Do not call KV-cache compression static model quantization. Do not infer
browser performance from CUDA or H100 results. Do not omit transform setup,
query scratch, residual metadata, partially filled pages, or decoded shadows.
Do not assume keys and values tolerate the same bit width. Do not accept
perplexity alone as conversational quality. Do not invent local model shapes,
latency, memory, or quality results.

## Prompt 4: TurboVec-Style Durable Semantic Retrieval And Accuracy

You are an independent principal information-retrieval scientist, vector-index
architect, browser-storage engineer, privacy engineer, and Rust systems
designer. Produce an exceptionally detailed report on using TurboQuant and
TurboVec ideas for a private, durable, local semantic-memory index while
protecting retrieval accuracy, deterministic behavior, user consent, and
deletion guarantees.

You have internet access and may inspect public papers, public TurboVec source,
package documentation, public benchmark datasets, browser standards, and
vector-search literature. You have no access to the TinyRustLM repository,
private embeddings, memory records, prompts, artifacts, evaluator output,
credentials, MemoryEndpoints accounts, or machines. Do not claim that you
inspected private code, validated a live account, or observed local retrieval.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local AI chat system. Model inference,
  prompts, private memories, and model bytes are intended to remain local or
  flow only through explicitly authorized direct channels.
- A local semantic index may contain only user-approved summaries, facts,
  pointers, or document chunks. Raw conversation must not silently become
  durable memory.
- Retrieved content is untrusted data. It must never become system or developer
  instruction merely because it ranked highly.
- The first useful target is deterministic exact flat search over compressed
  vectors. ANN graphs or inverted indexes must justify their extra complexity
  with measured scale requirements.
- Persistent embedding indexes, transient KV caches, and static model weights
  require separate formats and evidence.
- Browser targets may include IndexedDB and OPFS, worker isolation, WASM linear
  memory, quotas, interrupted writes, and profile deletion.
- TinyRustLM is not live. There is no obligation to preserve an experimental
  index format. Recommend one clean canonical design after evidence and delete
  rejected formats rather than accumulating migrations or shims.

### Primary Sources To Verify

At minimum inspect:

- TurboVec repository: https://github.com/RyanCodrai/turbovec
- TurboVec Rust documentation: https://docs.rs/turbovec/
- TurboQuant: https://arxiv.org/abs/2504.19874
- RaBitQ: https://arxiv.org/abs/2405.12497
- Symmetric RaBitQ/TurboQuant comparison:
  https://arxiv.org/abs/2604.19528
- FAISS documentation and source: https://github.com/facebookresearch/faiss
- IndexedDB: https://w3c.github.io/IndexedDB/
- File System Access and OPFS: https://fs.spec.whatwg.org/
- Storage Standard: https://storage.spec.whatwg.org/

Follow primary citations for datasets, metrics, and algorithms. Pin exact
repository revisions, package versions, browser-standard snapshots, dataset
revisions, embedding-model revisions, licenses, update dates, and retrieval
date. Distinguish TurboQuant theory, TurboVec implementation, general vector
search, and your proposed TinyRustLM experiment.

### Required Technical Work

1. Define the retrieval problem precisely. Separate exact nearest-neighbor
   search, approximate nearest-neighbor search, compressed exact scan, candidate
   generation, reranking, hybrid lexical/vector retrieval, and filtered search.
2. Define metrics for cosine, inner product, and Euclidean distance. Explain
   normalization requirements, query/database asymmetry, score calibration,
   tie handling, and when metric conversion preserves rank.
3. Reconstruct TurboVec's public ingest and query pipeline at a pinned commit:
   normalization, rotation, TQ+ or other calibration, Lloyd-Max coding,
   packing, per-vector correction, blocked preparation, query transformation,
   LUT scoring, filters, heap selection, IDs, deletion, write, and load.
4. Design a deterministic scalar flat index as the accuracy authority. Specify
   canonical vector order, stable external IDs, duplicate-ID policy, upsert,
   filters, tombstones, compaction, and exact top-k tie order.
5. Define full index identity. Bind embedding-model bytes, tokenizer, pooling,
   normalization, dimension, metric, transform algorithm and seed, codebook,
   bit width, calibration, correction method, record-set revision, format,
   implementation, and consent policy.
6. Analyze TurboVec's first-add calibration. Determine whether first-batch
   quantiles make index bytes and rankings depend on insertion order. Compare
   no calibration, fixed public calibration, explicit offline calibration,
   frozen first-batch calibration, and periodically rebuilt calibration.
7. Design distribution-drift detection without silently changing the index.
   Cover embedding-model replacement, corpus-domain change, outliers, new
   languages, short versus long chunks, and later vectors outside calibration
   ranges. Any rebuild must have a new identity and atomic promotion.
8. Compare 2-bit, 3-bit, 4-bit, int8, f16, and f32 storage at equal complete
   bytes. Count packed codes, scales, norms, correction values, seeds, matrices,
   codebooks, calibration arrays, IDs, tombstones, checksums, alignment,
   duplicate layouts, scratch, and compaction headroom.
9. Compare base TurboQuant scoring, TurboVec calibration, TurboVec length
   correction, QJL residual estimation, EDEN-style scaling, and RaBitQ at equal
   bytes. Require independent ablations and do not assign recall improvement to
   a combined system without attribution.
10. Design an accuracy corpus. Include public redistributable natural
    embeddings, synthetic distributions, normalized and unnormalized vectors,
    dimensions 64 through 3072, duplicate vectors, clustered points, outliers,
    sparse vectors, anisotropy, near ties, and temporal/domain drift.
11. Define frozen ground truth and metrics: Recall@1/10/100, MRR, NDCG,
    Kendall or Spearman rank correlation, score error, rank inversions,
    filtered recall, candidate coverage, and downstream answer usefulness.
12. Explain why vector recall is not memory usefulness. Design blinded
    downstream tests for correct memory selection, latest-memory precedence,
    source provenance, contradiction disclosure, irrelevant-memory rejection,
    malicious quoted instructions, and no-memory fallback.
13. Design payload handling. Separate vector data, public-safe record identity,
    private payload, provenance, supersession, tombstone, and content hash.
    Specify how the model receives retrieved text as untrusted context.
14. Define deletion semantics. A deletion receipt must show that a record is no
    longer searchable, no active payload points to it, compaction removes its
    vector bytes when required, exports omit it, and fresh-profile restoration
    does not resurrect it.
15. Specify a bounded persistent segment format. Include magic, schema,
    algorithm IDs, lengths, offsets, checksums, dimensions, counts, transform,
    codebook and calibration digests, IDs, codes, metadata, maximums, and
    canonical serialization. Reject arbitrary paths and executable content.
16. Design atomic persistence and recovery for native files, OPFS, and
    IndexedDB. Cover same-directory staging where applicable, fsync limits,
    transaction boundaries, disk/quota exhaustion, process crash, browser
    termination, locked files, partial segments, stale manifests, and orphan
    cleanup.
17. Design native/WASM parity tests. Scalar Rust, native SIMD, WASM scalar, and
    WASM SIMD must encode identical canonical bytes where promised and produce
    scores/ranks within declared tolerances. Explain cross-engine floating-point
    risks.
18. Design performance measurements. Separate embedding generation, index
    construction, calibration, rotation, packing, persistence, load, first
    query, LUT setup, scan, top-k, filters, delete, compaction, and browser
    storage transfer. Report p50/p95/p99 and peak as well as steady memory.
19. Compare direct TurboVec adoption, pinned black-box comparison, clean-room
    scalar implementation, isolated kernel reuse, and deferral. Include WASM
    fit, format control, unsafe code, maintenance, licensing, and auditability.
20. Produce promotion and rejection criteria. A compressed index must beat a
    transparent baseline on a declared user-relevant resource metric while
    remaining within preregistered recall, memory usefulness, privacy,
    determinism, corruption, and deletion budgets.

### Required Report Structure

1. Executive recommendation and explicit assumptions.
2. Dated source, package, dataset, and standard ledger.
3. Retrieval terminology and metric contract.
4. TurboVec ingest/search reconstruction.
5. Deterministic scalar flat-index design.
6. Index identity and calibration policy.
7. Distribution drift and rebuild protocol.
8. Complete byte-accounting table.
9. Algorithm and correction ablations.
10. Accuracy datasets and frozen ground truth.
11. Retrieval and downstream memory-quality metrics.
12. Consent, untrusted-context, and privacy model.
13. Stable IDs, upsert, deletion, and compaction semantics.
14. Persistent segment format and hostile-input rules.
15. Native, OPFS, and IndexedDB recovery algorithms.
16. Native/WASM differential test plan.
17. Performance and resource benchmark plan.
18. Adopt, compare, implement, or defer decision.
19. Promotion, rollback, and clean-deletion rules.
20. Unknowns requiring private or live execution.
21. Annotated primary-source bibliography with direct links and dates.

Do not treat raw chat as approved durable memory. Do not trust retrieved text
as instruction. Do not count tombstoned-but-searchable vectors as deleted. Do
not compare nominal bits while omitting metadata or duplicate layouts. Do not
infer semantic usefulness from Recall@k alone. Do not recommend an ANN graph
before demonstrating a scale need. Do not claim a live MemoryEndpoints result
or TinyRustLM integration.

## Prompt 5: Scalar, SIMD, And Browser Kernel Engineering For TurboQuant Ideas

You are an independent principal CPU microarchitecture engineer, WebAssembly
SIMD specialist, Rust performance engineer, numerical-kernel designer, and
benchmark-methodology reviewer. Produce an exceptionally detailed report that
maps TurboQuant- and TurboVec-style primitives onto correct scalar Rust,
x86-64 AVX2/AVX-512, ARM64 NEON, and browser WASM SIMD128 implementations.
Optimize only after defining a scalar numerical authority.

You have internet access and may inspect public papers, public TurboVec source,
compiler documentation, CPU instruction references, the WebAssembly SIMD
specification, browser documentation, and public benchmark code. You have no
access to TinyRustLM source, models, artifacts, prompts, benchmark receipts,
browsers under test, credentials, or development machines. Never claim local
speed, compatibility, or parity.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat runtime written in Rust and
  compiled in part to WebAssembly.
- Relevant targets are portable scalar CPU, x86-64 AVX2, optional validated
  AVX-512, ARM64 NEON, WASM scalar, and WASM SIMD128. Every target needs a
  deterministic, bounded fallback or explicit rejection.
- Candidate primitives include norms, rotations, randomized sign transforms,
  FWHT/FJLT, Lloyd-Max assignment, code packing, LUT construction,
  compressed-domain dot products, score correction, and deterministic top-k.
- Static weights, online KV pages, and persistent embedding segments remain
  separate formats even if they share a mathematically identical primitive.
- The scalar implementation is the correctness authority. SIMD output is
  tested against it and cannot define semantics merely because it is fast.
- Browser performance claims require real browser measurements. Native Rust,
  C++, Python, CUDA, or algorithmic operation counts are not browser evidence.
- No legacy support is required. Reject a complicated or inaccurate kernel
  family and remove it rather than preserving an unshipped dispatch path.

### Primary Sources To Verify

At minimum inspect:

- TurboQuant: https://arxiv.org/abs/2504.19874
- TurboVec: https://github.com/RyanCodrai/turbovec
- FAISS FastScan:
  https://github.com/facebookresearch/faiss/wiki/Fast-accumulation-of-PQ-and-AQ-codes-%28FastScan%29
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448
- WebAssembly SIMD proposal/specification: https://github.com/WebAssembly/simd
- Rust `core::arch` documentation: https://doc.rust-lang.org/core/arch/
- Intel intrinsics guide:
  https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html
- Arm Neon intrinsics reference:
  https://arm-software.github.io/acle/neon_intrinsics/advsimd.html

Use primary compiler, ISA, and browser-engine documentation for behavior and
support claims. Pin paper versions, repository commits, compiler versions,
target features, standards revisions, publication/update dates, and retrieval
date.

### Required Technical Work

1. Define one scalar reference contract for each primitive: norm, normalize,
   dense rotation, structured transform, codebook assignment, pack, unpack,
   query LUT, compressed dot product, correction, and top-k. Specify f64/f32
   authority, integer widths, rounding, tie order, and exceptional floats.
2. Create an operation and dataflow graph for ingest and query. Separate setup,
   one-time transform construction, per-vector encode, per-query preparation,
   candidate scan, correction, and heap selection.
3. Compare dense matrix rotation with QR-generated matrices, stored matrices,
   regenerated matrices, Rademacher-plus-FWHT, multi-stage Hadamard products,
   and sparse FJLT. Give arithmetic count, memory traffic, cache footprint,
   padding, inverse need, determinism, and proof impact.
4. Specify FWHT normalization and padding exactly. Cover power-of-two and
   non-power-of-two dimensions, zero padding, dimensional expansion, bit
   denominator, inverse transform, overflow, cancellation error, and whether
   padding can create an unfair accuracy benefit.
5. Design canonical codebook lookup. Compare branchy binary search, direct
   threshold comparisons, table lookup, vectorized comparisons, and
   quantization through affine calibration. Preserve exact scalar tie behavior.
6. Design 1-, 2-, 3-, and 4-bit packing independently. Specify bit order,
   coordinate order, lane/block transposition, tails, unaligned buffers,
   endian-neutral persistence, and whether scanning requires a second packed
   layout.
7. Explain LUT-based compressed scoring. Derive table values, table precision,
   query quantization, nibble splitting, shuffle instructions, partial sums,
   correction scaling, and final float conversion.
8. Prove accumulator bounds for each bit width, codebook/table range, block
   size, and dimension. Identify required flush or widening intervals and show
   why saturation, signedness, or wraparound cannot change ranking.
9. Map the scalar algorithm to AVX2. Name likely operations for load, unpack,
   shuffle, widening, multiply/add, horizontal reduction, masks, tails, and
   top-k integration. Distinguish conceptual mapping from measured code.
10. Map separately to AVX-512BW and optional VBMI. Explain runtime feature
    detection, register pressure, downclock risk, binary baseline, illegal
    instruction prevention, and when a wider kernel may lose end-to-end.
11. Map separately to ARM64 NEON. Cover table lookup instructions, widening
    accumulation, lane layout, unaligned loads, Apple versus other ARM cores,
    and runtime versus compile-time feature assumptions.
12. Map separately to WASM SIMD128. Identify available shuffles, swizzles,
    lane operations, widening, dot-product limitations, relaxed SIMD risks,
    bounds checks, memory alignment, and scalar fallback. State which native
    kernel ideas cannot be translated directly.
13. Analyze Rust code generation. Cover `core::arch`, `#[target_feature]`,
    runtime dispatch, LTO, codegen units, panic behavior, bounds-check
    elimination, alignment types, aliasing, portable SIMD status, and
    deterministic release builds.
14. Design safe wrappers around `unsafe` kernels. Define preconditions,
    checked length arithmetic, slice contracts, alignment handling, feature
    tokens, tail buffers, zero dimensions, maximum dimensions, and no-unwind
    FFI boundaries.
15. Design differential and property tests. Exercise every tail length,
    alignment, dimension boundary, bit pattern, codebook endpoint, special
    float, accumulator maximum, filter mask, tie, and random seed across scalar
    and all compiled kernels.
16. Design fuzzing and sanitization. Include malformed packed input,
    out-of-range code indices, oversized dimensions, aliasing, short buffers,
    allocation overflow, concurrent dispatch initialization, Miri-compatible
    wrappers, AddressSanitizer, and UndefinedBehaviorSanitizer where available.
17. Design browser ownership. Compare main thread and worker execution,
    transferable buffers, shared memory, cross-origin isolation,
    `SharedArrayBuffer`, Web Locks, cancellation, background throttling, tab
    visibility, WASM memory growth, and browser engine differences.
18. Define memory and performance counters. Count persistent codes, transform,
    codebook, duplicate layouts, query LUT, heap, scratch, stack, WASM pages,
    allocator overhead, and binary-size increase. Separate cold compile,
    initialization, warmup, p50/p95/p99, throughput, and energy when measurable.
19. Design a fair microbenchmark and macrobenchmark protocol. Pin CPU,
    microcode, OS, browser, compiler, flags, affinity, frequency mode, thermal
    state, threads, warmup, run order, iteration count, datasets, and raw sample
    retention. Do not benchmark away setup that the product pays.
20. Recommend a kernel implementation order with deletion gates: scalar
    oracle, simplest packing, scalar scan, one native SIMD path, WASM SIMD,
    remaining architectures, and only then threading. State exact correctness,
    accuracy, memory, and speed evidence needed at each step.

### Required Report Structure

1. Executive kernel recommendation and assumptions.
2. Dated paper, source, ISA, compiler, and standard ledger.
3. Normative scalar contracts.
4. Ingest/query operation graph.
5. Dense-versus-structured transform analysis.
6. FWHT normalization and padding specification.
7. Codebook assignment and packing formats.
8. LUT scoring derivation and accumulator proofs.
9. AVX2 mapping.
10. AVX-512 mapping.
11. ARM64 NEON mapping.
12. WASM SIMD128 mapping.
13. Rust dispatch, unsafe boundary, and build design.
14. Differential, property, fuzz, and sanitizer matrix.
15. Browser worker, memory, and threading design.
16. Complete byte and binary-size accounting.
17. Microbenchmark and end-to-end benchmark protocol.
18. Staged implementation and clean-deletion gates.
19. Unknowns requiring local hardware and browser execution.
20. Annotated primary-source bibliography with direct links and dates.

Do not make SIMD the numerical authority. Do not infer WASM speed from native
instruction counts. Do not omit padding, tails, correction metadata, query
scratch, duplicated layouts, or WASM pages. Do not use relaxed floating-point
behavior without an explicit parity contract. Do not describe multiplier-free
as computation-free. Do not claim a speedup until the exact measured operation,
baseline, hardware, and uncertainty are identified.

## Prompt 6: Independent Reproduction, Accuracy Gates, And Adoption Decision

You are an independent principal evaluation scientist, performance engineer,
reproducibility auditor, statistical reviewer, and technical program lead.
Design a preregistered, no-hype experimental campaign that can determine
whether TurboQuant, TurboVec, or isolated ideas from them improve TinyRustLM's
performance without unacceptable numerical, retrieval, or conversational
accuracy loss.

You have internet access but no access to the TinyRustLM source tree, models,
private prompts, datasets, artifacts, benchmark results, credentials,
MemoryEndpoints accounts, or machines. You may inspect public papers,
repositories, packages, author benchmarks, independent critiques, standards,
and public datasets. Your report must specify what local engineers should run;
it must not invent local outcomes or claim readiness.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat system using a custom Rust/WASM
  runtime and compact transformer models around 0.3B to 2B parameters.
- The product needs honest performance, memory, and quality claims on consumer
  x86-64, ARM64, and browser WASM, not only datacenter GPU results.
- Three experiment lanes remain independent: static model-weight format,
  online transformer KV-cache format, and persistent semantic-vector index.
  TurboQuant/TurboVec evidence must not be transferred across lanes without a
  new experiment.
- Raw candidate outputs must be preserved. Response repair, answer completion,
  best-of-N selection, expected-term injection, and hiding failures are
  forbidden.
- Model quality includes ordinary helpfulness, common sense, ambiguity,
  practical constraints, source conflict, latest-user precedence, untrusted
  memory, multi-turn continuity, lawful adult inquiry, summaries, rewrites,
  structured output, and code explanation.
- TinyRustLM is not live. There is no legacy support obligation. The campaign
  may recommend discarding an experiment and rewriting the design cleanly.
- A paper, README, package license, benchmark chart, or one successful output
  is not sufficient adoption evidence.

### Public Sources And Claims To Audit

At minimum inspect:

- TurboQuant: https://arxiv.org/abs/2504.19874
- ICLR record: https://openreview.net/forum?id=tO3ASKZlok
- Google Research overview:
  https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/
- TurboVec: https://github.com/RyanCodrai/turbovec
- TurboVec docs: https://docs.rs/turbovec/
- QJL: https://arxiv.org/abs/2406.03482
- KIVI: https://arxiv.org/abs/2402.02750
- RaBitQ: https://arxiv.org/abs/2405.12497
- Symmetric RaBitQ/TurboQuant comparison:
  https://arxiv.org/abs/2604.19528
- DRIVE/EDEN/TurboQuant comparison:
  https://arxiv.org/abs/2604.18555
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448

Pin exact paper versions, commits, packages, licenses, datasets, model
revisions, publication/update dates, and retrieval date. For each numerical
claim, record operation, numerator, denominator, baseline, complete byte
accounting, dataset/model, hardware, compiler, threads, warmup, sample count,
statistic, and uncertainty. Label author claim, adversarial-author critique,
independent reproduction, and local observation separately.

### Required Technical Work

1. Create a machine-readable claim ledger. Include distortion, unbiasedness,
   variance, effective compression, indexing time, recall, filtered search,
   SIMD speed, KV memory, attention-logit speed, end-to-end token speed,
   browser compatibility, and quality neutrality. Define evidence needed to
   accept, narrow, or reject each claim.
2. Define a claim vocabulary: algorithmically fewer operations, faster kernel,
   faster attention, faster decode, lower persistent bytes, lower peak memory,
   retrieval-accurate, numerically equivalent, semantically equivalent, and
   production-ready. State prohibited substitutions among them.
3. Separate four tracks: A scalar mathematical conformance, B native/WASM
   kernel parity, C persistent vector retrieval, and D transformer KV cache.
   Do not average them into one score or let success in one waive another.
4. Preregister hypotheses, primary metrics, equivalence or regression margins,
   seed schedule, sample sizes, exclusions, infrastructure-failure rules,
   statistical tests, and stop rules before observing candidate results.
5. Track A must test f64/f32 baselines, f16, int8, transparent int4,
   blockwise absmax, TurboQuant MSE, TurboQuant residual/QJL, EDEN modes,
   RaBitQ, and structured-transform variants at equal effective bytes.
6. Track A datasets must cover uniform-sphere, Gaussian, Laplace, sparse,
   anisotropic, clustered, basis, repeated-coordinate, heavy-tail, near-zero,
   outlier, near-tie, and adversarial vectors across realistic dimensions.
7. Track A metrics must include reconstruction MSE, normalized MSE, angular
   error, inner-product bias and variance, distance error, rank inversion,
   transform error, bit-exact packing, setup cost, and complete storage.
8. Track B must compare scalar Rust with each native and WASM kernel using the
   same bytes, inputs, output contract, and process. Cover every alignment,
   tail, dimension, CPU feature, browser engine, cold start, warm state,
   background state, and memory-growth case.
9. Track C must use public redistributable embedding datasets and frozen exact
   f32 ground truth. Compare exact flat f32/f16, scalar int8/int4, FAISS where
   appropriate, RaBitQ, paper-faithful TurboQuant, pinned TurboVec with features
   ablated, and a clean local prototype.
10. Track C metrics must include Recall@1/10/100, MRR, NDCG, rank correlation,
    score error, filters, build, first add, later add, load, first query,
    p50/p95/p99, persistent bytes, peak memory, delete, upsert, compaction,
    corruption, and downstream memory usefulness.
11. Track D must use pinned public model families that represent MHA, GQA, and
    MQA where available. Compare f16/bf16, int8, transparent int4, KIVI-style,
    TurboQuant variants, QJL/no-QJL, EDEN/RaBitQ-inspired estimators, and
    structured transforms.
12. Track D must vary key-only, value-only, and both; pre/post-RoPE;
    per-token/head/channel/page scaling; head dimensions; context lengths;
    prefill/decode; recent-token windows; outlier policies; and page sizes.
13. Track D numerical metrics must include cache error, key score error,
    estimator bias/variance, top-attended-token agreement, softmax KL/JS,
    value accumulation error, layer-output cosine, next-token-logit cosine,
    argmax/top-k agreement, perplexity, and first token-stream divergence.
14. Track D semantic tests must use sealed unseen paraphrases and multi-turn
    cases for ordinary chat, practical planning, source conflicts,
    current-turn preference, untrusted retrieved instructions, long-context
    retrieval, summarization, JSON, and code. Preserve untouched raw outputs.
15. Define complete byte accounting for every track. Include payload,
    metadata, norms, scales, residuals, codebooks, seeds, dense matrices,
    calibration, IDs, padding, indexes, alignment, scratch, duplicate layouts,
    pages, allocator overhead, and process/WASM memory.
16. Define the hardware matrix: portable scalar, at least one AVX2 x86-64,
    AVX-512 only if available and isolated, one physical ARM64 NEON machine,
    Chromium WASM scalar/SIMD, another browser engine, and optional GPU as a
    separately labeled non-authoritative lane.
17. Define execution controls: compiler, flags, dependency lock, OS, browser,
    power mode, affinity, frequency/thermal state, thread count, warmup, run
    ordering, process isolation, cache state, timeout, repetitions, and raw
    sample retention. Report unavailable controls honestly.
18. Specify statistics: paired comparisons, independent transform seeds,
    correlated-query handling, bootstrap confidence intervals, medians and
    tails, effect sizes, multiple-comparison correction, family-level
    aggregation, and equivalence testing. Lack of significance is not proof of
    equivalence.
19. Design immutable receipts. Bind source commit, source artifact hashes,
    dependency lock, algorithm parameters, model/dataset, transform seed,
    compiler/runtime, hardware/browser, raw measurements, raw outputs,
    evaluator, decision, reviewer, timestamp, and supersession. Never overwrite
    failures or obsolete decisions.
20. Define adoption gates and a final decision matrix. Compare direct
    dependency, reference-only comparator, fork, clean-room implementation,
    isolated primitive adoption, and deferral. Require a measured user-relevant
    advantage, accuracy budgets, native/WASM parity, bounded parsing, supply
    chain, license review, deletion test, and clean rollback.

### Required Report Structure

1. Executive experimental recommendation and assumptions.
2. Dated source and disputed-claim ledger.
3. Claim vocabulary and prohibited inferences.
4. Preregistered hypotheses, margins, and stop rules.
5. Track A scalar conformance protocol.
6. Track B native/WASM parity protocol.
7. Track C retrieval protocol.
8. Track D KV-cache protocol.
9. Models, datasets, licenses, and immutable identities.
10. Equal-byte and complete-memory accounting.
11. Hardware, browser, compiler, and execution controls.
12. Numerical, retrieval, semantic, and systems metrics.
13. Statistical analysis and multiplicity plan.
14. Raw evidence and receipt schema.
15. Fault-injection and adversarial matrix.
16. No-hype public claim rules.
17. Adoption option matrix and go/no-go gates.
18. Experiment cost formulas and resource classes.
19. Prioritized local execution backlog.
20. Unknowns requiring private code, models, or hardware.
21. Annotated primary-source bibliography with direct links and dates.

Do not choose datasets, seeds, margins, or baselines after seeing results. Do
not compare a tuned GPU implementation with a scalar CPU path and generalize.
Do not hide rotation setup, first-use preparation, metadata, decoded shadows,
or duplicate layouts. Do not call a method quality-neutral from a
nonsignificant difference or one benchmark. Do not repair candidate outputs.
Do not count vector recall, structural validity, or a kernel microbenchmark as
assistant-quality or product-readiness evidence.

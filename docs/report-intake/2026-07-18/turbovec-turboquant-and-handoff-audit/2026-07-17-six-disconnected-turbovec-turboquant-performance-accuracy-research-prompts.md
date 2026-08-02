# Six Disconnected Research Prompts: TurboVec And TurboQuant

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. Do not assume that an agent receives this
introduction or any other prompt in the set.

For these assignments, `TurboVec` means the public `RyanCodrai/turbovec`
project unless a primary source establishes that a different project is
intended. `TurboQuant` means the vector-quantization algorithms described in
the TurboQuant research paper, not a generic synonym for low-bit model-weight
quantization. Every report must verify those identities and keep these three
engineering problems separate:

1. static model-weight quantization;
2. online transformer KV-cache quantization; and
3. persistent embedding/vector-index quantization.

The agents may browse public papers, proceedings, official research posts,
public source repositories, immutable repository revisions, package
registries, issue trackers, benchmark artifacts, and hardware documentation.
They do not have access to the TinyRustLM source tree, private artifacts,
models, prompts, evaluation cases, runtime output, credentials, development
machines, or unpublished measurements. No report may claim that it inspected,
ran, modified, or validated private TinyRustLM code.

Every report must label and distinguish:

- directly observed public facts;
- claims made by paper or project authors;
- independently reproduced or externally corroborated facts;
- the agent's engineering analysis and recommendations; and
- facts that require local TinyRustLM verification.

## Prompt 1: Mathematical Reconstruction, Lineage, And Accuracy Limits

You are an independent principal researcher in information theory, numerical
linear algebra, vector quantization, and transformer inference. Produce a very
deep, equation-level report that reconstructs how TurboQuant works, explains
which parts are used or changed by the public TurboVec project, and determines
which ideas could plausibly improve performance or accuracy in a browser-local
small-language-model system. You have internet access but no access to any
private TinyRustLM repository, model, artifact, prompt, evaluation output,
benchmark receipt, or development machine.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local AI chat system built around a
  custom Rust/WASM runtime and portable `.slm` artifacts.
- The relevant model class is approximately 0.3B to 2B parameters, normally
  executed on consumer CPUs or browser WASM rather than datacenter GPUs.
- Useful quality means coherent multi-turn conversation, common-sense
  judgment, instruction following, source and memory precedence, practical
  constraints, summarization, rewriting, structured output, and code help.
- Long-context behavior matters, but a benchmark score or one attractive
  response is not promotion evidence.
- Runtime acceleration may not change the intended sampler, chat template,
  token sequence, semantic behavior, or quality threshold without being
  measured and disclosed.
- Static model weights, transient KV-cache vectors, and persistent retrieval
  embeddings are separate data classes. Do not imply that a method proven for
  one automatically applies to the others.
- TinyRustLM is not a released product. No technical debt, legacy support, or
  compatibility shim is required. A future implementation may be rewritten
  cleanly, but only after evidence supports the new design.
- The report is research input, not authorization to add a third-party
  dependency or publish a performance claim.

### Public Starting Points To Verify

Use primary sources wherever possible and independently verify current
versions, publication status, authorship, and dates. At minimum inspect:

- TurboQuant paper: https://arxiv.org/abs/2504.19874
- ICLR publication record: https://openreview.net/forum?id=tO3ASKZlok
- Google Research overview:
  https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/
- QJL paper: https://arxiv.org/abs/2406.03482
- PolarQuant KV-cache paper: https://arxiv.org/abs/2502.02617
- TurboVec repository: https://github.com/RyanCodrai/turbovec
- TurboVec crate documentation: https://docs.rs/turbovec/
- DRIVE: https://papers.nips.cc/paper/2021/hash/0397758f8990c1b41b81b43ac389ab9f-Abstract.html
- EDEN: https://proceedings.mlr.press/v162/vargaftik22a.html
- 2026 DRIVE/EDEN comparison note: https://arxiv.org/abs/2604.18555
- RaBitQ: https://arxiv.org/abs/2405.12497
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448

Treat blog wording, README claims, arXiv versions, conference papers, and
third-party implementations as different evidence classes. Record the exact
paper version, public repository commit, package version, publication/update
date, and your retrieval date. If a paper has changed between arXiv and the
conference version, provide a material-difference table.

Throughout the report, explicitly label directly observed public facts,
paper/project-author claims, independently reproduced facts, your engineering
analysis, and unknowns requiring local TinyRustLM verification. Never imply
that you inspected private TinyRustLM code or evidence.

### Required Analysis

1. Define the optimization problems precisely. Distinguish reconstruction MSE,
   angular error, cosine error, distance distortion, biased and unbiased inner
   product estimation, variance, top-k rank preservation, and downstream task
   quality. State which objective each TurboQuant variant actually optimizes.
2. Reconstruct `TurboQuant_mse` step by step. Cover norm separation, random
   rotation, the coordinate distribution of a uniformly rotated unit vector,
   the scaled or shifted Beta distribution, finite-dimensional behavior, the
   Gaussian limit, near-independence assumptions, Lloyd-Max boundaries and
   centroids, code assignment, bit packing, reconstruction, inverse rotation,
   and norm restoration.
3. Derive or carefully restate the distortion-rate result. Explain the Shannon
   lower-bound comparison, all assumptions, normalization conventions, whether
   distortion is total or per coordinate, the role of expectation over random
   transforms, the reported constant-factor gap, and why an asymptotic bound
   may not predict a specific low-dimensional workload.
4. Reconstruct `TurboQuant_prod` step by step. Show why an MSE-optimal scalar
   quantizer can shrink inner products, how the residual is formed, how the
   1-bit QJL transform is applied, which residual norm or scale must be stored,
   how the asymmetric estimator uses a high-precision query, and why the
   expected estimator is claimed to be unbiased.
5. Give exact storage equations. Include packed coordinate codes, vector norms,
   residual norms, transform seeds or matrices, codebooks, calibration values,
   outlier channels, alignment, padding, row metadata, index metadata, and
   allocator overhead. Report both nominal bits per coordinate and effective
   bytes per vector at dimensions 64, 128, 200, 256, 512, 768, 1024, 1536,
   2048, 3072, and 4096.
6. Analyze transform choices. Compare dense Haar or QR-derived orthogonal
   matrices, Gaussian JL matrices, randomized Hadamard transforms, Rademacher
   signs plus FWHT, sparse JL transforms, and structured orthogonal products.
   For each, give setup cost, encode cost, query cost, memory, determinism,
   inverse cost, vectorization fit, padding behavior, and theoretical change.
7. Explain the relationship among TurboQuant, PolarQuant, and QJL without
   relying on marketing shorthand. Identify which algorithm uses Cartesian to
   polar pairing, which uses random rotation plus scalar quantization, which
   stores sign sketches, and which claims concern keys, values, attention
   logits, reconstruction, or nearest-neighbor ranking.
8. Analyze the relationship to DRIVE and EDEN. Reproduce the 2026 note's
   argument about the scalar scale parameter `S`, biased versus unbiased modes,
   direct b-bit EDEN versus a `(b-1)+1` residual construction, and the claimed
   accuracy differences. State which claims are mathematical equivalence,
   asymptotic equivalence, empirical comparison, or author interpretation.
9. Compare RaBitQ, product quantization, optimized product quantization,
   residual quantization, scalar absmax quantization, KIVI-style KV
   quantization, and TurboQuant. Do not compare nominal bit widths without
   equalizing all metadata and query-time precision.
10. Analyze finite-dimension and non-ideal data. Cover heavy tails, anisotropy,
    sparse vectors, clustered vectors, outliers, zero vectors, nearly zero
    norms, repeated coordinates, non-power-of-two dimensions, quantized input,
    changing distributions, and adversarial vectors. Explain where a random
    rotation helps and where the theorem does not eliminate practical error.
11. Explain TurboVec's publicly documented deviations or additions, including
    first-add calibration if present, per-coordinate shift and scale, norm or
    inner-product correction, query lookup tables, and SIMD-oriented packing.
    Separate paper TurboQuant from TurboVec-specific engineering.
12. Provide unambiguous reference pseudocode for encode, decode, approximate
    inner product, and search scoring. Specify dimensions, matrix orientation,
    seeds, float types, rounding, tie handling, zero handling, codebook order,
    and bit order. The pseudocode must be sufficient for two independent
    implementations to produce comparable test vectors.
13. Design small numerical worked examples and golden vectors. Include at least
    one zero vector, basis vector, uniform vector, random unit vector,
    non-power-of-two vector, and outlier vector. Explain which examples test
    mechanics and which are too small for asymptotic accuracy claims.
14. Map the ideas to TinyRustLM's three possible domains: weight storage,
    KV-cache storage, and local semantic retrieval. For each, state `credible`,
    `requires new research`, or `not supported by current evidence`, with the
    exact reason.
15. Recommend the smallest no-debt experiments that could improve accuracy or
    speed. Each recommendation must identify the baseline, controlled variable,
    quality metric, performance metric, stop rule, and evidence needed before
    implementation work expands.

### Required Report Structure

1. Executive findings and explicit assumptions.
2. Terminology and identity verification.
3. Source/version observation log.
4. Mathematical notation and objective definitions.
5. Full `TurboQuant_mse` derivation.
6. Full `TurboQuant_prod` and QJL derivation.
7. PolarQuant relationship and distinctions.
8. Bit accounting and memory formulas.
9. Transform implementation tradeoffs.
10. DRIVE/EDEN, RaBitQ, PQ, and KV-baseline comparison.
11. Finite-dimension and adversarial analysis.
12. TurboVec additions and divergences.
13. Reference pseudocode and golden-vector design.
14. TinyRustLM applicability matrix.
15. Performance and accuracy experiment recommendations.
16. Claims that could not be verified.
17. Unknowns requiring local execution.
18. Annotated primary-source bibliography with direct links and dates.

Do not repeat headline compression or speed numbers without reconstructing the
denominator and measured operation. Do not call QJL a model-weight format. Do
not call a sign sketch a complete 1-bit model. Do not equate expected
unbiasedness with zero variance, perfect top-k recall, or unchanged language
quality. Do not hide contradictory literature, failed reproductions, or
finite-dimension caveats.

## Prompt 2: Public TurboVec Rust Architecture, Kernels, And Fidelity Audit

You are an independent principal Rust performance engineer, SIMD-kernel
reviewer, vector-database architect, and secure file-format auditor. Produce a
very technical public-source audit of how TurboVec works, what it inherits from
TurboQuant, what it changes, and which implementation techniques could improve
the performance or accuracy of a browser-local Rust/WASM AI system. You may
inspect the public TurboVec repository and public dependencies, but you have no
access to the TinyRustLM repository, private models, local benchmarks,
artifacts, prompts, credentials, or development machines.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat product with a custom
  Rust/WASM runtime and portable `.slm` model artifacts.
- The target is consumer CPU and browser execution for roughly 0.3B to 2B
  parameter transformers. GPU-only conclusions are insufficient.
- The project values exact artifact identity, bounded memory, deterministic
  behavior, fail-closed parsing, reproducible tests, and untouched quality
  evidence.
- A public Rust crate is a third-party component. Its existence or MIT license
  does not automatically authorize dependency adoption, unsafe code, format
  adoption, or public claims.
- Static weights, KV-cache vectors, and semantic-search embeddings are
  separate. TurboVec is primarily a vector index unless public source proves
  another implemented scope.
- TinyRustLM is not released. No backward compatibility is required. If the
  best path is a clean independent implementation, say so. Do not recommend a
  wrapper around an unsuitable architecture merely to preserve an unshipped
  API.

### Required Source Discipline

Start from, but do not stop at:

- https://github.com/RyanCodrai/turbovec
- https://docs.rs/turbovec/
- https://crates.io/crates/turbovec
- https://pypi.org/project/turbovec/
- https://arxiv.org/abs/2504.19874
- https://arxiv.org/abs/2405.12497
- https://github.com/facebookresearch/faiss/wiki/Fast-accumulation-of-PQ-and-AQ-codes-%28FastScan%29

Pin the exact repository commit and tag you audit. Record the crate and Python
package versions, publication timestamps, checksums where registries expose
them, dependency lock state, minimum Rust version, feature flags, target
configuration, and retrieval date. If the default branch changes during the
research, preserve both observed commit IDs. Use source lines and immutable
links for important claims. Distinguish README assertions from code behavior,
tests, benchmark JSON, release artifacts, and open issues.

Throughout the report, explicitly label directly observed public facts,
paper/project-author claims, independently reproduced facts, your engineering
analysis, and unknowns requiring local TinyRustLM verification. Never imply
that you inspected private TinyRustLM code or evidence.

### Required Analysis

1. Produce a module and dataflow map from public source. Trace construction,
   first ingest, later ingest, normalization, rotation initialization,
   calibration, codebook construction, encoding, packing, blocked-layout
   preparation, query transformation, lookup-table creation, SIMD scoring,
   filtering, heap selection, deletion, persistence, reload, and concurrent
   search.
2. Reconstruct all in-memory data structures with field-level purpose and
   asymptotic size. Include original or transformed vectors if retained,
   packed codes, blocked codes, norms, correction scales, calibration arrays,
   rotation matrices, codebooks, ID maps, tombstones, filters, caches,
   `OnceLock` values, heaps, and temporary query buffers.
3. Determine whether rotation is dense or structured at the pinned revision.
   Explain matrix generation, PRNG and seed handling, reproducibility, matrix
   precision, orthogonality error, setup complexity, `dim^2` memory, lazy
   initialization, maximum-dimension checks, and whether load of an untrusted
   tiny file can trigger a large allocation.
4. Audit the public TQ+ calibration behavior if present. Explain what the first
   add observes, which quantiles are estimated, how shifts and scales are
   frozen, whether insertion order changes the index, what happens with a tiny
   first batch, whether later distribution drift is detectable, and whether
   the feature remains accurately describable as data-oblivious or
   training-free.
5. Audit bias correction. Reconstruct the per-vector correction based on norm
   and self-inner-product, identify its lineage, prove or challenge its
   expected effect, and quantify its metadata and ingest cost. Compare this
   with QJL residual correction and direct unbiased EDEN rather than treating
   them as interchangeable.
6. Document the exact 2-bit and 4-bit packing layouts, coordinate order,
   nibble or bit-plane order, block sizes, padding, alignment, endian behavior,
   query LUT format, accumulator width, saturation behavior, correction-scale
   application, and top-k tie ordering.
7. Audit each CPU path separately: scalar, AVX2, AVX-512BW, any AVX-512VBMI
   path, NEON, and fallback dispatch. Identify all `unsafe`, intrinsics,
   runtime feature detection, target-feature assumptions, pointer arithmetic,
   alignment assumptions, bounds proofs, accumulator overflow limits, and
   scalar-oracle differential tests.
8. Assess WASM portability. Determine which modules compile for
   `wasm32-unknown-unknown`, which dependencies or intrinsics do not, whether
   WASM SIMD128 can express the packed-LUT kernels, what a scalar browser path
   would cost, and whether dense matrix setup is practical under browser
   memory limits. Do not claim browser support merely because the code is
   Rust.
9. Audit concurrency and cache invalidation. Explain why search can take
   `&self`, how lazy caches are initialized, how mutation invalidates them,
   what simultaneous searches observe, and whether add/remove/load/write can
   race through Python bindings or user misuse.
10. Audit the `.tv` and `.tvim` formats. Specify magic, version, dimensions,
    counts, bit width, transform identity, calibration, codebooks, codes,
    scales, IDs, checksums, lengths, endian rules, validation order, maximums,
    atomic-write behavior, truncation handling, trailing-data handling, and
    compatibility policy. Identify every allocation controlled by file data.
11. Audit API semantics for add, add-with-IDs, search, allowlists, bitmasks,
    remove, upsert, write, and load. Inspect current issues and tests for
    duplicate IDs, validation-before-mutation, stale slots, data loss, short
    result sets, malformed filters, and recovery after error.
12. Reconstruct the benchmark methodology from scripts and retained JSON.
    Record datasets, dimensions, corpus/query counts, k, thread counts, warmup,
    repetitions, aggregation, compiler flags, CPU identity, baseline tuning,
    index-build time, first-query setup, memory accounting, and recall
    definition. Identify omitted costs and comparisons that are not
    like-for-like.
13. Build an accuracy attribution table. For every reported recall gain,
    separate the effects of base TurboQuant centroids, TQ+ calibration,
    per-vector correction, bit width, query precision, reranking, filtering,
    and dataset dimension. Require ablations before assigning credit.
14. Build a performance attribution table. Separate rotation, encode, pack,
    repack, LUT construction, candidate scanning, correction multiply, heap
    maintenance, filtering, multithreading, persistence, load, and first-use
    preparation.
15. Audit dependency and supply-chain fit. Cover license files, notices,
    provenance, `Cargo.lock`, build scripts, proc macros, Python packaging,
    native-wheel targets, release signatures, SBOM feasibility, unsafe-code
    policy, maintenance concentration, and immutable source pinning.
16. Recommend reusable ideas rather than a blanket dependency decision. For
    each idea, state whether TinyRustLM should study the algorithm, adapt the
    layout, reproduce the SIMD technique, use a crate behind an optional
    boundary, or reject it. Include accuracy and performance acceptance tests.

### Required Report Structure

1. Executive recommendation and audit scope.
2. Exact public-source and package identity ledger.
3. TurboVec-to-TurboQuant correspondence table.
4. Rust module and call graph.
5. In-memory representation and byte formulas.
6. Rotation and initialization audit.
7. Calibration and correction audit.
8. Packing, LUT, and scoring specification.
9. Scalar and SIMD kernel audit.
10. WASM/browser portability analysis.
11. Concurrency and mutation invariants.
12. Persistence format and hostile-input review.
13. Public API and issue analysis.
14. Benchmark reproducibility and claim audit.
15. Accuracy and performance attribution.
16. License, dependency, and supply-chain review.
17. Reusable design ideas ranked by value and implementation cost.
18. Unknowns requiring TinyRustLM-local verification.
19. Annotated primary-source bibliography with immutable links and dates.

Do not infer behavior from names alone. Do not report README benchmark numbers
as independently reproduced. Do not call a crate WASM-ready without building
and exercising the relevant public revision. Do not recommend preserving an
unshipped compatibility surface. Do not hide unsafe blocks, unsupported CPU
targets, first-query setup, calibration order effects, or file-format trust
boundaries.

## Prompt 3: TurboQuant For Transformer KV Cache On CPU And Browser WASM

You are an independent principal transformer-inference architect, numerical
kernel engineer, and model-quality evaluator. Produce a deeply technical design
study for applying TurboQuant-family ideas to improve transformer KV-cache
performance and accuracy in a small-model Rust/WASM runtime. You may study all
public papers, implementations, model configurations, and benchmark suites, but
you cannot inspect the TinyRustLM source tree, local `.slm` artifacts, private
model outputs, browser traces, evaluation prompts, or development hardware.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat system using custom Rust/WASM
  inference for compact transformer models, approximately 0.3B to 2B
  parameters.
- Target execution is consumer x86-64, ARM64, and browser WASM, with a portable
  scalar path and separately admitted capability-specific acceleration.
- Interactive decode latency, prefill latency, peak memory, context capacity,
  and raw conversational quality all matter.
- A KV cache is runtime state, not model weights. A lower-bit KV format does not
  reduce static model bytes and does not make the model a 1-bit model.
- Quantization may not silently change chat serialization, token history,
  sampler settings, output selection, or error handling.
- Untouched model output is the quality evidence. Best-of-N retries,
  post-generation repair, and evaluation-answer injection are prohibited.
- The product is not released. A clean KV subsystem rewrite is permitted if it
  is superior. No legacy cache format or fallback for superseded pre-release
  behavior is required, although immutable test evidence must remain.

### Public Sources To Verify

At minimum inspect and version-pin:

- TurboQuant: https://arxiv.org/abs/2504.19874
- ICLR record: https://openreview.net/forum?id=tO3ASKZlok
- QJL: https://arxiv.org/abs/2406.03482
- QJL public code if still available: https://github.com/amirzandieh/QJL
- PolarQuant: https://arxiv.org/abs/2502.02617
- Google Research overview:
  https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/
- DRIVE/EDEN comparison note: https://arxiv.org/abs/2604.18555
- EDEN: https://proceedings.mlr.press/v162/vargaftik22a.html
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448
- TurboVec, for comparison only: https://github.com/RyanCodrai/turbovec

Also compare current primary papers and official implementations for KIVI,
QuaRot, SpinQuant, KVQuant, QServe, FlexGen, vLLM or llama.cpp KV formats where
relevant. Use only primary technical sources for implementation claims. Record
paper version, code revision, model revision, benchmark version, hardware,
publication date, and retrieval date.

TurboVec is a public embedding/vector-search index built from TurboQuant ideas;
it is not presumed to implement a transformer KV cache. Inspect its public
transform, packing, correction, and SIMD techniques only as comparative
engineering. Throughout the report, explicitly label directly observed public
facts, paper/project-author claims, independently reproduced facts, your
engineering analysis, and unknowns requiring local TinyRustLM verification.
Never imply that you inspected private TinyRustLM code or evidence.

### Required Analysis

1. Begin from the transformer equations. Define the shape and lifecycle of K
   and V for batch size, layer count, query heads, KV heads, head dimension,
   sequence length, and element type. Derive bytes per token and total cache
   size for MHA, GQA, and MQA.
2. Explain why keys and values may need different quantization. Cover the
   operations `q * K^T`, softmax, and `p * V`, error propagation through
   attention logits and probabilities, value reconstruction error, and why an
   unbiased key inner-product estimator does not automatically preserve value
   aggregation.
3. Specify exactly where transforms occur relative to Q/K/V projection,
   rotary positional embedding, head splitting, cache append, cache read,
   attention score scaling, masking, softmax, and output projection. Analyze
   whether rotation commutes with RoPE or requires transformed queries.
4. Design TurboQuant-style key caching. Cover per-head versus grouped
   transforms, normalization, norm storage, random rotation, Lloyd-Max codes,
   residual QJL, query transformation, direct compressed-domain scoring, and
   whether any step requires dequantizing the full key history.
5. Design candidate value-cache strategies. Compare MSE TurboQuant,
   PolarQuant, uniform per-channel or per-token quantization, mixed precision,
   residual windows, outlier channels, and full-precision value sinks. State
   which choices have theory, empirical evidence, or only a hypothesis.
6. Analyze online append cost. A decode token must update every layer's cache.
   Derive operations and temporary memory per token for dense rotation,
   structured rotation, scalar quantization, bit packing, residual sketching,
   and metadata. Determine when compression compute exceeds bandwidth savings
   for 0.3B, 0.6B, 1B, 1.5B, and 2B CPU-local models.
7. Compare dense random rotations with Rademacher plus FWHT and other fast
   structured transforms. Cover non-power-of-two head sizes such as 80, 96,
   128, and 160; zero padding; inverse transforms; transform sharing; PRNG seed
   identity; cache portability; and SIMD/WASM implementation complexity.
8. Design exact packed layouts for 2, 2.5, 3, 3.5, and 4 effective bits per
   channel where meaningful. Include every norm, scale, zero point, residual
   norm, outlier, alignment byte, page header, and index. Explain whether
   fractional rates arise from mixed channels, entropy coding, or separate
   residual budgets.
9. Derive effective memory formulas and worked examples for representative
   model shapes and context lengths 512, 2048, 4096, 8192, 16384, and 32768.
   Compare against f32, f16/bf16, int8, int4, and mixed residual-window caches.
   Include runtime scratch and duplicate-layout costs, not only packed payload.
10. Design CPU kernels. Cover append-time transforms, packed writes,
    query-to-codebook LUT generation, direct attention-logit accumulation,
    accumulator width, numerical scaling, vector-tail handling, cache-line
    layout, prefetching, threading, and scalar reference parity. Separate x86
    AVX2/AVX-512, ARM NEON, WASM SIMD128, and portable scalar paths.
11. Analyze cache paging and growth. Cover geometric allocation, fixed pages,
    browser WASM memory growth, pointer invalidation, context truncation,
    sliding windows, prefix reuse, multi-turn cache authority, cancellation,
    reset, model switching, adapter application, and deterministic cleanup.
12. Address cache correctness and identity. Specify a cache-format version,
    model hash, tokenizer/chat-template identity, layer shape, transform family,
    seed, codebook, bit allocation, outlier policy, context-token digest, and
    runtime version. A cache may be reused only when all semantic inputs match.
13. Design numerical validation from primitives upward. Include transform
    orthogonality, encode/decode, MSE, inner-product bias and variance,
    attention-logit error, top-attended-token agreement, softmax divergence,
    layer output cosine similarity, next-token logit drift, top-k agreement,
    and exact deterministic cases.
14. Design model-level quality validation. Use untouched source, f32 runtime,
    existing uncompressed compact runtime, and each compressed-cache arm under
    identical prompts, history, sampler, and seeds. Cover long retrieval,
    source conflict, current-turn precedence, untrusted memory, ordinary chat,
    summarization, code, repeated topics, and context-boundary behavior.
15. Specify statistics. Require repeated seeds where sampling is product
    behavior, confidence intervals, per-case paired comparisons, family-level
    failure analysis, multiple-comparison control, and explicit ordinary-chat
    regression budgets. Best-of-N is invalid unless it is the declared UI.
16. Design performance measurement. Separate prefill, first decode, steady
    decode, cache append, query transform, attention scan, dequantization,
    allocator, memory growth, and end-to-end tokens/second. Measure peak RSS or
    WASM pages, packed payload, scratch, CPU cycles, bandwidth, and energy where
    possible.
17. Define stop rules. Reject a design that saves nominal bits but increases
    total peak memory, needs model-sized or cache-sized decoded shadows,
    regresses ordinary helpfulness beyond a preregistered budget, produces
    unstable browser memory growth, or cannot maintain scalar/SIMD parity.
18. Recommend a staged path from mathematical prototype to one-layer fixture,
    tiny deterministic transformer, real source model, native CPU, scalar
    WASM, SIMD WASM, and clean-browser dogfood. Each stage needs objective
    entry and exit evidence.

### Required Report Structure

1. Executive recommendation and non-goals.
2. Source and implementation observation log.
3. KV-cache equations and capacity model.
4. Key-versus-value error model.
5. Placement of transforms in attention.
6. Candidate key and value algorithms.
7. Dense and structured transform comparison.
8. Packed format and complete bit accounting.
9. CPU and WASM kernel architecture.
10. Paging, lifecycle, and cache-identity design.
11. Primitive numerical test matrix.
12. Model-level quality evaluation.
13. Performance benchmark protocol.
14. Staged implementation plan and stop rules.
15. Expected gains expressed as formulas, not invented measurements.
16. Unknowns requiring local code, models, or hardware.
17. Annotated primary-source bibliography with direct links and dates.

Do not generalize H100 kernel results to browser WASM. Do not state that 3 or
3.5 bits is quality-neutral without reproducing the exact model, task, cache
layout, metadata accounting, and evaluation. Do not quantize only keys and call
the whole KV cache compressed. Do not preserve a decoded f32 cache shadow. Do
not use a transformed or repaired answer as quality evidence.

## Prompt 4: TurboVec For Local Semantic Memory And Retrieval Accuracy

You are an independent principal retrieval engineer, vector-database
researcher, browser-storage architect, and privacy-focused AI memory designer.
Produce a highly technical report on how TurboVec and TurboQuant-style vector
compression could improve local semantic retrieval for TinyRustLM while
preserving retrieval accuracy, deterministic identity, deletion semantics, and
user privacy. You may inspect public sources and public code, but you cannot
inspect TinyRustLM private code, MemoryEndpoints accounts, user memories,
embeddings, prompts, local indexes, credentials, test output, or development
machines.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local chat system. Model bytes and
  ordinary prompts remain local unless the user explicitly selects a separate
  optional service.
- Local memory may include user-approved summaries, facts, pointers, and
  document chunks. Raw conversation must not be silently promoted into durable
  memory.
- Memory contents are untrusted data, never hidden system instructions.
- A future local semantic index must support explicit provenance, revision,
  supersession, tombstones, deletion, export, and complete reset.
- Browser targets include Chromium, Firefox, and WebKit-class environments
  with WASM, IndexedDB, Cache Storage, and possibly OPFS. No single browser API
  may be assumed universally available without a capability matrix.
- A local vector index and a transformer KV cache have different lifetimes,
  metrics, and trust boundaries. Do not merge their designs.
- The product is not released. No legacy index format or compatibility shim is
  required. A weak pre-release format may be replaced cleanly after migration
  of test fixtures; immutable evidence should remain.

### Required Source Discipline

Inspect and pin at least:

- TurboVec: https://github.com/RyanCodrai/turbovec
- TurboVec docs: https://docs.rs/turbovec/
- TurboQuant: https://arxiv.org/abs/2504.19874
- RaBitQ: https://arxiv.org/abs/2405.12497
- FAISS FastScan:
  https://github.com/facebookresearch/faiss/wiki/Fast-accumulation-of-PQ-and-AQ-codes-%28FastScan%29
- EDEN/TurboQuant comparison: https://arxiv.org/abs/2604.18555

Also use primary sources for HNSW, IVF, PQ/OPQ, ScaNN, DiskANN, browser storage,
WASM memory, and WebAssembly SIMD when relevant. Record exact repository
commits, package versions, benchmark revisions, source dates, and your
retrieval date. Separate TurboVec behavior from general TurboQuant theory and
from proposed TinyRustLM behavior.

Throughout the report, explicitly label directly observed public facts,
paper/project-author claims, independently reproduced facts, your engineering
analysis, and unknowns requiring local TinyRustLM verification. Never imply
that you inspected private TinyRustLM code or evidence.

### Required Analysis

1. Define the retrieval problem. Distinguish exact cosine search, maximum inner
   product search, Euclidean distance, approximate nearest neighbor search,
   compressed flat scan, graph or inverted-file candidate generation, hybrid
   lexical/vector retrieval, and reranking. State where TurboVec fits.
2. Reconstruct TurboVec's public ingest and query path: normalization, rotation,
   first-add calibration if present, Lloyd-Max code assignment, bit packing,
   per-vector correction, blocked layout, query rotation, lookup tables, SIMD
   scan, allowlist filtering, and top-k selection.
3. Analyze accuracy by dimension and distribution. Cover 128- to 4096-dimension
   embeddings, low-dimensional word vectors, modern sentence embeddings,
   multilingual embeddings, unit-normalized and unnormalized outputs,
   anisotropy, near duplicates, sparse clusters, long-tail norms, and
   distribution drift.
4. Investigate calibration order dependence. Determine whether first-add
   calibration makes results depend on first batch composition or order. Design
   alternatives: no calibration, deterministic representative calibration,
   bounded online statistics, per-segment calibration, frozen public
   calibration, or rebuild. Compare accuracy, reproducibility, and online
   ingest semantics.
5. Specify index identity. Bind embedding-model hash and revision, tokenizer or
   preprocessing identity, pooling, normalization, dimension, distance metric,
   transform algorithm and seed, bit width, codebook, calibration digest,
   correction method, format version, corpus revision, and index builder
   version. Reject mixing vectors whose identities do not match.
6. Design memory-record identity separately from vector-slot identity. Cover
   stable IDs, content hashes, source provenance, user ownership, revision,
   supersession, tombstone, sensitivity label, expiration, and embedding
   status. A delete must not return a removed record through stale packed
   layouts or caches.
7. Analyze incremental operations. Cover add, batch add, duplicate IDs, update,
   atomic upsert, delete, compaction, crash during mutation, power loss, quota
   exhaustion, partial write, stale calibration, and concurrent reads. Require
   validation before destructive mutation.
8. Design search-time filtering for user, memory type, provenance, recency,
   workspace, deletion state, and access policy. Compare ID allowlists, slot
   bitmasks, prefiltering, block skipping, postfiltering, and over-fetching.
   Explain recall and timing effects at 0.01%, 0.1%, 1%, 10%, and 100%
   selectivity.
9. Design a hybrid retrieval pipeline for a tiny language model. Include query
   construction, embedding, lexical candidates, vector candidates, provenance
   filtering, recency or supersession policy, diversity, reranking, context
   budget, source labels, and treatment of retrieved text as untrusted data.
10. Quantify end-to-end retrieval quality. Measure Recall@k against exact f32,
    NDCG, MRR, rank correlation, score error, nearest-neighbor margin, filtered
    recall, answer-grounding success, conflict resolution, citation precision,
    stale-memory avoidance, and no-result correctness. Do not reduce quality to
    vector recall alone.
11. Design an ablation matrix for base TurboQuant, TurboVec TQ+ calibration,
    per-vector correction, 2-bit, 4-bit, f16, int8, PQ, OPQ, RaBitQ, exact f32,
    optional reranking, and hybrid lexical retrieval. Equalize effective bytes,
    build cost, and query budget.
12. Build a complete capacity model. Include embedding bytes before indexing,
    packed codes, norms, correction values, calibration, rotation matrices,
    ID maps, tombstones, metadata, blocked duplicate layouts, query buffers,
    browser serialization, journaling, and compaction headroom for 1K, 10K,
    100K, 1M, and 10M records.
13. Assess browser execution. Compare main-thread and worker ownership,
    transferable buffers, SharedArrayBuffer prerequisites, WASM scalar and
    SIMD128, IndexedDB blobs, OPFS files, memory mapping limitations, streaming
    load, quota, eviction, private browsing, and cross-browser persistence.
14. Design a hostile-input-safe binary format. Require bounded dimensions and
    counts, checked arithmetic, checksums, canonical endianness, no path
    references, explicit transform data, no arbitrary code, bounded JSON
    metadata, atomic same-directory replacement, durable journal, quarantine,
    and final readback verification.
15. Design privacy and lifecycle tests. Include clean browser profiles,
    storage enumeration, secret scanning, export, complete deletion, tombstone
    verification, stale service worker, duplicate tabs, interrupted compaction,
    and proof that project websites never receive private embeddings or index
    bytes.
16. Compare build-versus-adopt options. Analyze direct TurboVec dependency,
    optional native companion use, clean-room Rust/WASM implementation of only
    proven concepts, and deferral. Include license, unsafe code, browser
    portability, format authority, supply chain, maintenance, and no-debt fit.
17. Recommend experiments that can improve both speed and answer accuracy.
    Each must bind a corpus, exact f32 oracle, retrieval metrics, downstream
    conversation tasks, hardware/browser matrix, memory accounting, and
    rejection thresholds.

### Required Report Structure

1. Executive recommendation and assumptions.
2. Public observation and version log.
3. Retrieval problem and metric definitions.
4. TurboVec ingest/search reconstruction.
5. Accuracy, calibration, and bias analysis.
6. Index and memory-record identity schemas.
7. Mutation, deletion, and crash-consistency design.
8. Filtering and hybrid retrieval architecture.
9. End-to-end quality evaluation.
10. Capacity and performance formulas.
11. Browser/WASM/storage portability matrix.
12. Binary format and security model.
13. Privacy and deletion-backed test plan.
14. Build/adopt/defer decision matrix.
15. Prioritized experiments and stop rules.
16. Unknowns requiring local or authorized service access.
17. Annotated primary-source bibliography with direct links and dates.

Do not claim that compressed-vector recall proves better conversation. Do not
silently persist raw chats. Do not mix embedding models in one index. Do not
call postfilter over-fetch equivalent to exact filtered top-k. Do not preserve
deleted vectors in a searchable blocked cache. Do not call a Rust crate browser
compatible without direct WASM evidence.

## Prompt 5: Independent Reproduction, Benchmarking, And No-Hype Gates

You are an independent principal performance scientist, ML evaluation lead,
and reproducibility auditor. Design a preregistered experimental program that
can determine whether TurboQuant and TurboVec actually improve TinyRustLM's
performance or accuracy on relevant consumer CPU and browser workloads. You
may inspect and run public implementations on infrastructure available to you,
but you cannot inspect or run private TinyRustLM code, models, prompts,
artifacts, test receipts, or development machines. Your report must be usable
as an implementation-neutral benchmark specification for a later local team.

### Product Context And Fixed Constraints

- TinyRustLM is a pre-release browser-local small-language-model system using
  Rust/WASM and portable local artifacts.
- Relevant systems include static model inference, online KV caches, and local
  semantic retrieval. Results for one system cannot stand in for another.
- Target hardware includes ordinary x86-64 and ARM64 CPUs and browser WASM,
  not only H100-class accelerators.
- Accuracy includes numerical fidelity, retrieval ranking, next-token behavior,
  long-context behavior, and ordinary conversation quality.
- Performance includes setup, ingest, prefill, decode, query, memory, storage,
  latency distribution, throughput, and cleanup. A microkernel speedup is not
  an end-to-end speedup.
- Raw outputs and failed trials must be retained. Best-run selection, hidden
  warmups, changed prompts, repaired answers, and omitted setup are forbidden.
- TinyRustLM is not released, so the final recommendation may replace an
  existing pre-release design. No legacy-support cost should influence the
  decision.

### Sources And Claims To Audit

At minimum establish a dated claim ledger from:

- https://arxiv.org/abs/2504.19874
- https://openreview.net/forum?id=tO3ASKZlok
- https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/
- https://github.com/RyanCodrai/turbovec
- https://docs.rs/turbovec/
- https://arxiv.org/abs/2406.03482
- https://arxiv.org/abs/2502.02617
- https://arxiv.org/abs/2604.18555
- https://proceedings.mlr.press/v162/vargaftik22a.html
- https://arxiv.org/abs/2405.12497
- https://arxiv.org/abs/2606.21448

Record the exact source versions and retrieval date. For every numerical claim,
capture the operation measured, numerator, denominator, baseline, bit
accounting, dataset, model, context, compiler, hardware, thread count, warmup,
sample count, and uncertainty. Label author-reported, third-party-reported, and
independently reproduced results separately.

Throughout the report, also separate your engineering recommendations from
facts and identify every unknown requiring local TinyRustLM verification.
Never imply that you inspected private TinyRustLM code or evidence.

### Required Experimental Design

1. Create a claim-to-experiment ledger. Include TurboQuant distortion,
   effective compression, KV-cache quality neutrality, attention-logit speed,
   end-to-end generation speed, nearest-neighbor recall, indexing time,
   TurboVec memory, SIMD scan speed, filtered search, and first-add online
   ingest. For each claim, specify the exact reproduction needed.
2. Define three independent tracks: A, mathematical vector primitives; B,
   persistent vector search; C, transformer KV-cache inference. Never average
   their results into one score.
3. Track A must generate controlled vectors across dimensions 64 to 4096 and
   distributions including uniform sphere, Gaussian, Laplace, sparse,
   anisotropic, clustered, basis, heavy-tail, near-zero, and adversarial
   outlier cases. Measure reconstruction MSE, angular error, inner-product bias,
   variance, distance error, and rank inversions.
4. Compare Track A methods at equal effective storage: f32, f16/bf16, int8,
   uniform int4, blockwise absmax, product quantization, OPQ, RaBitQ, DRIVE,
   EDEN biased and unbiased modes, `TurboQuant_mse`, `TurboQuant_prod`,
   PolarQuant where applicable, and structured-transform variants. Include all
   norms, scales, seeds, matrices, calibration, codebooks, padding, and scratch.
5. Track B must use public, redistributable datasets spanning low and high
   dimensions. Require frozen train/base/query/ground-truth splits, exact f32
   oracle neighbors, corpus hashes, deterministic preprocessing, and license
   records. Include modern sentence embeddings only when their generation and
   redistribution are lawful and reproducible.
6. Track B metrics must include Recall@1/10/100, MRR, NDCG, rank correlation,
   score error, filtered recall, query latency p50/p95/p99, build and first-add
   time, later-add time, delete/upsert correctness, load time, first-query
   preparation, peak memory, steady memory, persistent bytes, and compaction
   headroom.
7. Track B baselines must include exact flat f32/f16, a transparent scalar
   quantized flat scan, FAISS IndexPQ and FastScan where platform permits,
   RaBitQ, base TurboQuant, TurboVec with every optional calibration/correction
   feature ablated, and an ANN graph or inverted baseline where the use case
   would otherwise be misrepresented.
8. Track C must select publicly available model families whose license,
   tokenizer, chat template, and unmodified inference are reproducible. Compare
   uncompressed f32/f16 KV, int8, int4, KIVI-style, QJL, PolarQuant,
   TurboQuant variants, EDEN alternatives, and structured-transform variants.
9. Track C must test MHA, GQA, and MQA shapes; head dimensions 64, 80, 96, 128,
   and 160 where available; context lengths from 512 through at least 8192;
   prefill and autoregressive decode; keys-only, values-only, and complete KV
   compression; residual full-precision windows; and outlier policies.
10. Track C numerical metrics must include cache reconstruction error,
    attention-logit error, inner-product bias/variance, top-attended-token
    agreement, softmax KL or JS divergence, layer-output cosine, next-token
    logit cosine, argmax and top-k agreement, perplexity, and exact token
    divergence position.
11. Track C semantic metrics must include long-context retrieval, distractor
    resistance, summarization, source conflict, current-turn precedence,
    untrusted quoted instructions, ordinary dialogue, structured output, and
    code explanation. Preserve untouched outputs and use blinded human review
    for ambiguous semantic cases.
12. Define the hardware matrix. At minimum cover one AVX2 x86-64 CPU, one
    AVX-512-capable x86-64 CPU if available, one ARM64 NEON CPU, portable scalar
    native, Chromium WASM scalar, Chromium WASM SIMD128, and at least one other
    browser engine. GPU results may be a separate non-authoritative track.
13. Pin compiler, flags, target features, allocator, operating system, browser,
    power mode, thread count, CPU affinity, thermal state, and background-load
    policy. Report unavailable controls rather than inventing stability.
14. Define cold, warm, and steady-state protocols. Separate codebook or matrix
    construction, index preparation, first query, cache allocation, WASM
    compilation, JIT warmup, subsequent calls, file loading, and storage
    readback. Randomize run order to limit thermal and drift bias.
15. Require scalar or high-precision oracles and differential tests before
    timing optimized kernels. Kernel outputs must be compared across scalar,
    SIMD, threaded, native, and WASM paths with explicit tolerances and exact
    top-k tie rules.
16. Specify statistical treatment: paired designs, repeated independent seeds,
    bootstrap or analytical confidence intervals, median and tail latency,
    effect size, family-level aggregation, correlated-query handling,
    multiple-comparison correction, and a minimum practically important
    difference declared before results.
17. Define effective bit and memory accounting. Report payload bits per
    coordinate, metadata-adjusted bits, complete index/cache bytes, temporary
    and duplicate layouts, peak resident memory or WASM pages, and end-to-end
    process memory. Present compression relative to both f32 and actual product
    baseline.
18. Design artifact and receipt schemas. Bind source commit, dependency locks,
    model/dataset hashes, transform seed, method parameters, compiler/runtime,
    hardware, browser, raw measurements, raw outputs, analysis code, verdict,
    and supersession. Failed and obsolete runs are immutable.
19. Define no-hype gates. A method may be called faster only for the exact
    operation and platform measured. `End-to-end faster` requires statistically
    significant wall-clock improvement in the declared user workflow.
    `Quality-neutral` requires a preregistered equivalence margin across
    numerical and semantic suites, not a nonsignificant difference.
20. Provide go/no-go thresholds for adopting an idea into a clean Rust/WASM
    prototype. Include memory reduction, setup budget, steady latency,
    browser compatibility, numerical parity, retrieval recall, semantic
    regression, implementation complexity, unsafe-code exposure, and evidence
    completeness.

### Required Report Structure

1. Executive experimental recommendation.
2. Dated claim ledger and source identity table.
3. Preregistered hypotheses and equivalence margins.
4. Track A vector-primitive protocol.
5. Track B vector-search protocol.
6. Track C KV-cache protocol.
7. Datasets, models, licenses, and immutable inputs.
8. Baseline fairness and complete bit accounting.
9. Hardware, browser, compiler, and run controls.
10. Numerical and semantic metrics.
11. Statistical analysis plan.
12. Raw evidence and receipt schemas.
13. Ablation and fault-injection matrix.
14. No-hype claim vocabulary.
15. Go/no-go decision table.
16. Estimated experiment cost as formulas.
17. Unknowns that only local TinyRustLM execution can resolve.
18. Annotated primary-source bibliography with links and dates.

Do not choose easy datasets after seeing results. Do not compare a tuned GPU
kernel with a scalar CPU baseline and call it a general speedup. Do not exclude
rotation setup, first-query preparation, correction metadata, or duplicate
layouts. Do not use lack of statistical significance as proof of equivalence.
Do not convert mocks, structural tests, or vector recall into assistant-quality
evidence.

## Prompt 6: Clean-Slate Native Adoption Architecture And Implementation Roadmap

You are an independent principal systems architect, Rust/WASM runtime designer,
quantization researcher, and technical program lead. Produce a very detailed
clean-slate architecture and decision report for using lessons from TurboQuant
and TurboVec to improve TinyRustLM performance and accuracy. You may inspect
public research and public source code, but you cannot inspect TinyRustLM's
private repository, models, artifacts, prompts, test output, credentials,
network, or machines. Your task is to propose evidence-driven architecture,
not to claim that any feature already exists locally.

### Product Context And Non-Negotiable Rules

- TinyRustLM is a pre-release browser-local AI chat product with a custom
  Rust/WASM runtime, portable `.slm` artifacts, optional local companion, and
  evidence-bound model admission.
- Compact transformer models around 0.3B to 2B parameters must run on consumer
  CPUs and browser WASM with bounded memory and honest quality claims.
- Model weights, transformer KV cache, semantic-memory embeddings, and P2P
  transport pieces are different data types. A quantization format should not
  be reused across them merely because all contain vectors.
- TinyRustLM has no legacy-support obligation. No compatibility shims, dual
  contracts, deprecated aliases, temporary fallback schemas, or migrations for
  unshipped behavior are desired. Recommend one clean target architecture and
  deletion of superseded implementation after proof.
- Immutable failure history, source receipts, raw outputs, and release evidence
  must remain. Preserving evidence is not legacy product support.
- Third-party code, algorithms, formats, and benchmark claims require license,
  provenance, supply-chain, security, portability, and reproducibility review.
- No report author may claim to have inspected or validated private
  TinyRustLM. Clearly mark every local fact that must be discovered later.

### Minimum Public Research Set

Verify current versions and use primary sources:

- TurboQuant: https://arxiv.org/abs/2504.19874
- ICLR record: https://openreview.net/forum?id=tO3ASKZlok
- Google Research overview:
  https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/
- TurboVec: https://github.com/RyanCodrai/turbovec
- TurboVec Rust docs: https://docs.rs/turbovec/
- QJL: https://arxiv.org/abs/2406.03482
- PolarQuant: https://arxiv.org/abs/2502.02617
- DRIVE: https://papers.nips.cc/paper/2021/hash/0397758f8990c1b41b81b43ac389ab9f-Abstract.html
- EDEN: https://proceedings.mlr.press/v162/vargaftik22a.html
- DRIVE/EDEN comparison note: https://arxiv.org/abs/2604.18555
- RaBitQ: https://arxiv.org/abs/2405.12497
- Fast-TurboQuant: https://arxiv.org/abs/2606.21448

Record paper revisions, repository commits, crate/package versions, licenses,
publication dates, updates, and retrieval date. Treat unresolved technical
criticism as design input. Do not resolve a literature dispute by popularity.

Throughout the report, explicitly label directly observed public facts,
paper/project-author claims, independently reproduced facts, your engineering
analysis, and unknowns requiring local TinyRustLM verification. Never imply
that you inspected private TinyRustLM code or evidence.

### Required Architecture Work

1. Establish a capability taxonomy with four independent lanes:
   `static-weight-format`, `kv-cache-format`, `embedding-index`, and
   `shared-vector-kernel-primitives`. Define exactly which TurboQuant or
   TurboVec concepts belong in each lane and prohibit unsupported cross-lane
   inference.
2. Produce four decision options for each lane: use a public dependency,
   fork-and-own, clean-room native implementation from papers and public tests,
   or defer. Score correctness authority, speed potential, accuracy potential,
   WASM portability, unsafe code, supply chain, format ownership, maintenance,
   license, auditability, and no-debt fit.
3. Recommend one target architecture, not a permanent option maze. Optional
   experimental binaries are acceptable during evaluation, but the proposed
   product path must have one canonical scalar behavior and explicit
   capability dispatch for validated SIMD paths.
4. Design a shared mathematical primitive layer only where semantics genuinely
   match. Candidate primitives include deterministic PRNG, random sign vectors,
   FWHT, dense orthogonal transforms, norm calculation, Lloyd-Max table lookup,
   code packing, LUT construction, checked top-k, checksum, and bounded binary
   parsing. State which should remain domain-specific.
5. Define numerical types and authorities. Specify f64 offline table or matrix
   construction where needed, f32 runtime references, possible f16/bf16 data,
   integer packed codes, accumulator widths, rounding, saturation, NaN and
   infinity policy, zero norms, tie ordering, deterministic seeds, and
   scalar-oracle tolerances.
6. Design the KV-cache subsystem as a standalone typed boundary. Include cache
   identity, layer/head geometry, key and value policies, transform placement,
   append/read APIs, pages, residual windows, outliers, prefix reuse, context
   truncation, cancellation, reset, model replacement, adapter invalidation,
   and complete memory accounting.
7. Design the embedding-index subsystem as a separate typed boundary. Include
   embedding identity, metric, transform and calibration identity, stable IDs,
   filters, tombstones, atomic upsert, compaction, crash recovery, browser
   persistence, export, deletion, and untrusted record handling.
8. Propose binary schemas for compressed KV pages and vector-index segments.
   Include canonical magic/version, algorithm ID, dimensions, bit allocation,
   transform family and seed, codebook digest, calibration digest, correction
   method, lengths, offsets, alignment, checksums, limits, and rejection rules.
   Do not include arbitrary paths or executable code.
9. Decide how transforms are represented. Compare storing a dense matrix,
   regenerating it from a specified PRNG, storing structured-transform seeds,
   and fixed standardized transforms. Address cross-version PRNG stability,
   endianness, floating-point reproducibility, setup time, `O(d^2)` memory, and
   cache/index portability.
10. Design the kernel dispatch model. Require checked scalar Rust as the
    correctness authority, native AVX2/AVX-512 and ARM NEON behind runtime
    detection, WASM SIMD128 in a separately manifested artifact, and a portable
    fallback. Specify differential testing, unsupported CPU behavior, and no
    model-sized decoded shadows.
11. Design browser ownership and loading. Cover workers, bounded streaming,
    transferable buffers, WASM memory pages, memory growth, OPFS or IndexedDB,
    interruption, quota, atomic promotion, unload, zeroization limits, and
    proof that project origins do not receive private model, cache, prompt, or
    embedding bytes.
12. Design configuration without compatibility debt. Use one versioned
    declarative policy per domain, reject unknown material fields, make defaults
    explicit, and avoid environment-dependent silent selection. Explain how an
    experiment is promoted into the sole canonical contract and how the
    experimental path is then removed.
13. Build a TDD sequence. Begin with paper-derived golden vectors and
    high-precision scalar oracles; then property tests, malformed input,
    differential SIMD, persistence round trips, crash simulation, memory
    bounds, deterministic replay, model-level parity, retrieval recall, raw
    conversation quality, and clean-browser acceptance.
14. Define fuzzing and security coverage. Include checked arithmetic,
    dimensions, counts, offsets, allocation limits, decompression bombs,
    malformed packed tails, invalid codebook indices, NaNs, duplicate IDs,
    concurrent mutation, file truncation, stale cache identity, hostile memory
    text, and supply-chain compromise.
15. Define performance acceptance. Measure setup separately from steady state;
    require wall-clock and memory improvement on declared user workflows;
    retain p50/p95/p99; compare scalar and SIMD; include CPU and browser; and
    report effective bytes including metadata and temporary layouts.
16. Define accuracy acceptance. Require primitive distortion tests, attention
    and logit fidelity, exact-token divergence analysis, retrieval oracle
    recall, downstream memory usefulness, and untouched multi-turn response
    evaluation with preregistered equivalence or regression budgets.
17. Design receipt and provenance schemas. Bind algorithm paper/version,
    implementation commit, source and build identities, format version,
    transform seed, codebook/calibration, model or embedding identity, tests,
    raw outputs, performance samples, decision, supersession, and reviewer.
18. Address licensing and clean-room boundaries. Distinguish ideas described in
    papers, copyrighted source expression, package licenses, patent searches,
    attribution, benchmark dataset terms, and independent implementation
    records. Identify questions requiring qualified legal review.
19. Provide a staged roadmap: literature lock, reference prototype, one-domain
    proof, native optimization, WASM proof, browser lifecycle, fault campaign,
    model/retrieval quality, dogfood, and release decision. Give entry, exit,
    rollback, deletion, and evidence criteria for every stage.
20. End with a prioritized backlog that identifies what to implement first,
    what to measure first, what should remain research-only, and what should be
    rejected. Use dependencies and objective gates, not calendar guesses.

### Required Report Structure

1. Executive target architecture and explicit assumptions.
2. Public source, version, and claim ledger.
3. Four-lane capability taxonomy.
4. Adopt/fork/clean-room/defer decision matrices.
5. Canonical mathematical primitive design.
6. KV-cache architecture.
7. Embedding-index architecture.
8. Binary formats and identity contracts.
9. Scalar, SIMD, and WASM kernel strategy.
10. Browser memory, storage, and privacy architecture.
11. Configuration and no-legacy replacement rules.
12. TDD, fuzzing, and hostile-input plan.
13. Performance and accuracy promotion gates.
14. Receipt, provenance, and rollback design.
15. License and supply-chain assessment.
16. Staged roadmap with deletion criteria.
17. Prioritized implementation backlog.
18. Unknowns requiring local TinyRustLM inspection or execution.
19. Annotated primary-source bibliography with direct links and dates.

Do not propose a permanent compatibility layer for an unreleased design. Do
not import TurboVec's complete architecture when only one primitive is useful.
Do not reuse a KV-cache proof as a model-weight or vector-search proof. Do not
make SIMD the correctness authority. Do not approve adoption from license name,
GitHub popularity, paper prestige, parameter count, or a single benchmark. Do
not invent local measurements, current implementation facts, or release
readiness.

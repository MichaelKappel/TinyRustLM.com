# Twelve Disconnected Research Prompts: TinyRustLM Production Implementation Decisions

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The agents may browse public websites,
standards, papers, official documentation, public source repositories, public
model repositories, and public package registries. They have no access to the
TinyRustLM source tree, private artifacts, unpublished contracts, test output,
credentials, signing keys, network configuration, development machines,
internal services, or private report intake.

Every report must clearly label: directly observed public facts, externally
sourced facts, reasoned engineering recommendations, assumptions, and facts
that require local or authorized verification. Each source must include its
publication or update date when available, the exact URL or immutable revision,
and the report's retrieval date. No agent may claim that it inspected, built,
ran, tested, validated, or measured private TinyRustLM code.

TinyRustLM is one prelaunch product. Names such as SLM2, ACG2, Tokenizer2,
Template2, Prompt2, Sampling2, schema versions, package versions, and branch
names are exact technical identities, not product generations. No TinyRustLM
product version has launched. Therefore there is no customer compatibility
population, product V1/V2 split, migration obligation, or permission to retain
legacy readers, writers, aliases, shims, fallbacks, dual paths, deprecated
surfaces, or known technical debt.

## Prompt 1: ACG2 Composition Contract, Identity Closure, And Transactional Activation

You are an independent principal model-runtime architect, secure-format
designer, and transactional-state specialist. Produce an exceptionally
detailed technical report defining a clean composition artifact and activation
protocol for TinyRustLM. You may study public model-manifest formats, content
addressing systems, package-lock formats, TUF/in-toto metadata, transactional
configuration systems, and language-model runtime composition techniques. You
cannot inspect private TinyRustLM source, schemas, fixtures, model files,
receipts, or runtime output.

Fixed product and architecture context:

- TinyRustLM is a single prelaunch browser-local AI product with no legacy
  support obligation and no permission for compatibility parsing.
- `ACG2` and profile `acg2.0` are technical names for the sole current atomic
  composition contract. They do not indicate a second product generation.
- One complete composition binds exactly one SLM2 model, one Tokenizer2
  artifact, one Template2 artifact, one Sampling2 artifact, and one Prompt2
  artifact. Every member is content-addressed and independently validated.
- The Rust runtime is the sole activation authority. Browser JavaScript and
  managed .NET code may transport requests and reports but may not reinterpret,
  repair, synthesize, or partially activate composition members.
- Activation must be fail-atomic. A failed candidate cannot alter the active
  composition, transcript revision, operation identity, KV cache, sampler
  state, or visible assistant output.
- Unknown fields, duplicate fields, ambiguous encodings, hidden defaults,
  optional compatibility members, and partial composition activation are not
  acceptable.
- Historical evidence may retain old facts, but no obsolete format may remain
  executable.

Research primary sources wherever possible. Address all of the following in
depth:

1. Define the semantic responsibilities of a composition artifact versus the
   responsibilities of each member artifact. Identify which settings belong in
   SLM2, Tokenizer2, Template2, Sampling2, Prompt2, ACG2, or runtime policy so
   that no behavior has two owners.
2. Propose a canonical bounded serialization suitable for native Rust, WASM,
   C ABI JSON reports, .NET consumers, P2P transport, and durable receipts.
   Compare canonical JSON, deterministic CBOR, protobuf with deterministic
   constraints, and a custom binary envelope. Analyze duplicate keys,
   unknown-field rejection, number representation, Unicode, map ordering,
   length prefixes, recursion, and complete-input consumption.
3. Specify the full identity closure. Bind exact member byte hashes, member
   profile identities, sizes, semantic roles, runtime/profile requirements,
   architecture geometry, context ceilings, native/WASM compatibility, and the
   composition's own identity. Explain whether the composition identity should
   hash canonical manifest bytes, a Merkle root, or both.
4. Define admission invariants across member boundaries. Include model
   vocabulary size versus tokenizer IDs, embedding/output dimensions, special
   token identities, chat-template references, stop-token sets, sampling
   bounds, prompt limits, context limits, tensor roles, quantization profile,
   and runtime capabilities.
5. Design a two-phase or equivalent activation algorithm. Cover bounded parse,
   independent member inspection, immutable file handles, rehash-before-use,
   preallocation, runtime construction, cancellation checkpoints, commit point,
   state swap, old-state destruction, and rollback when any step fails.
6. Model concurrent activation and generation. Analyze activation while a
   request is stepping, cancellation races, stale worker messages, multiple
   browser tabs, managed callers, process termination, and operation-identity
   checks. Recommend a single unambiguous concurrency policy.
7. Define state invalidation after a successful composition change. Explain
   which transcript, KV, RNG, token, decoder, and UI state must be discarded,
   which state may remain, and how an immutable operation identity prevents
   stale continuation.
8. Specify hostile-input handling for duplicate members, missing members,
   repeated roles, extra roles, wrong hashes, wrong sizes, profile confusion,
   hash-algorithm confusion, path traversal, symlinks/reparse points, cyclic
   references, oversized values, trailing bytes, and time-of-check/time-of-use
   replacement.
9. Design independent conformance vectors and negative corpora that do not
   reuse the production parser's assumptions. Include exact canonical bytes,
   byte-level mutations, cross-language parsers, identity recomputation, and
   state-machine observations proving fail-atomic behavior.
10. Define public-safe activation receipts. Bind composition and member
    identities, runtime identity, operation identity, admission result,
    bounded timings and resource facts, terminal error code, and previous/new
    active identity without exposing private paths, prompts, or model bytes.
11. Explain how P2P assembly, local conversion, browser import, the native ABI,
    and managed packages should consume the same ACG2 authority without
    introducing alternative validators or convenient fallback composition.
12. Provide a deletion gate proving that any superseded composition parser,
    writer, fixture, command, route, package API, worker branch, documentation
    instruction, and build input is absent from the executable closure.
13. Identify all conclusions that require local schema, source, binary,
    package, browser, concurrency, and fault-injection verification.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Ownership boundary for ACG2 and its five members.
3. Canonical serialization and identity specification.
4. Cross-member admission invariant table.
5. Transactional activation state machine.
6. Concurrency, cancellation, and stale-operation rules.
7. Hostile-input and TOCTOU threat model.
8. Conformance vectors and independent verification plan.
9. Receipt schema and privacy boundary.
10. Cross-language integration obligations.
11. Clean deletion and no-debt gate.
12. Prioritized implementation plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose partial activation, optional compatibility members, automatic
repair, default insertion, fallback to an older composition, dual parsing,
best-effort continuation, or a product V2 narrative. Do not claim that a valid
manifest proves model quality or successful browser conversation.

## Prompt 2: Immutable Qwen3 Source Acquisition, Safetensors Custody, And License Closure

You are an independent principal model-supply-chain engineer, secure download
architect, and open-model license auditor. Produce an exceptionally detailed
report for acquiring a public Qwen3-family source model for deterministic local
conversion without trusting mutable repository names, incomplete caches, or
unreviewed files. You may inspect Hugging Face documentation, Git and Git LFS
protocols, safetensors specifications, Qwen official model cards and
repositories, license texts, content-addressing literature, and secure archive
guidance. You cannot inspect private TinyRustLM code, local caches, credentials,
receipts, model bytes, or converter output.

Fixed product context and constraints:

- TinyRustLM is one prelaunch browser-local AI product with no legacy model
  acquisition route to preserve.
- The first candidate source is `Qwen/Qwen3-0.6B` at immutable public revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, subject to independent public
  verification, license review, raw behavioral screening, and local format
  compatibility.
- The desired user flow is exact verified P2P reuse first. If no exact peer is
  available, an informed user may authorize source acquisition and local
  deterministic conversion. Downloading a text, JSON, or PowerShell request
  file is not acquisition and is not useful product behavior.
- Model bytes must not enter the product source repository or a project-hosted
  model-byte proxy. Public-safe locks, hashes, sizes, licenses, and bounded
  receipts may be source controlled.
- Acquisition must be resumable, streamed, bounded, create-only at final
  promotion, resistant to source drift, and safe on Windows and Linux.
- A successful download is not conversion, structural validation, model
  quality, browser inference, P2P availability, or publication evidence.

Use primary sources wherever possible and explicitly record immutable source
revisions, publication/update dates, and retrieval date. Address:

1. Enumerate the authoritative public files required to convert and execute
   Qwen3-0.6B, including configuration, safetensors index and shards,
   tokenizer data, tokenizer configuration, generation configuration, chat
   template, license, README/model card, and any code declared by repository
   metadata. Explain which files are executable-risk inputs and which are
   documentation/provenance inputs.
2. Explain the precise meaning and limitations of a Hugging Face commit hash,
   Git object identity, Git LFS pointer, ETag, content hash, resolve URL, cache
   snapshot, and repository revision. Define how to prove that every acquired
   byte belongs to one immutable revision.
3. Design a source-lock manifest containing repository identity, immutable
   revision, complete allowlisted path inventory, expected byte sizes, hashes,
   LFS metadata, media types, license identities, retrieval origins, and
   converter role. State how the lock itself is canonically identified.
4. Specify a network acquisition state machine for fresh download and resume.
   Cover HEAD versus GET trust, Range requests, redirects, TLS, CDN variation,
   conditional requests, partial files, sparse allocation, interrupted writes,
   disk full, retry budgets, mirror prohibition, and post-download rehashing.
5. Design a local cache that deduplicates immutable bytes while preserving
   ownership and safe cleanup. Cover cache keys, hard links, reflinks, locks,
   concurrent acquisitions, stale partials, quarantine, reference tracking,
   Windows rename/share modes, symlink/reparse defense, and deletion boundaries.
6. Specify strict safetensors preflight before expensive conversion. Include
   bounded header parsing, UTF-8 and JSON rules, duplicate-key rejection,
   tensor-name uniqueness, dtype allowlists, rank and shape arithmetic,
   nonoverlap, offsets, complete data coverage, shard-index closure, duplicate
   tensor rejection across shards, and source rehash before and after access.
7. Analyze whether remote-code execution is ever needed for this model family.
   Define a fail-closed rule for `trust_remote_code`, custom Python modules,
   pickle files, unsafe archives, executable templates, and post-download hooks.
8. Produce a license-closure protocol. Distinguish model weights, tokenizer,
   code, documentation, training-data claims, generated derivatives, notices,
   attribution, redistribution, P2P serving, local conversion, and catalog
   publication. Clearly state where legal review remains necessary.
9. Define source drift and revocation handling. Cover upstream force-push,
   repository deletion, changed model card, license amendment, security alert,
   malicious file replacement, and discovery that a previously locked source
   was incomplete.
10. Specify privacy-preserving acquisition receipts with source identities,
    sizes, hashes, timing, transport facts, tool versions, license-review
    status, and bounded failures, excluding credentials, private paths, query
    tokens, and raw model content.
11. Design independent tests using small public fixtures and synthetic hostile
    repositories, then state which evidence requires the real multi-gigabyte
    source. Include deterministic resume, concurrent download, corrupt range,
    cache collision, locked file, and power-loss scenarios.
12. Compare official Hugging Face libraries, raw HTTP clients, Git LFS clients,
    and a constrained custom acquirer. Recommend a minimal dependency strategy
    that does not silently expand the trust boundary.
13. Identify every unknown requiring local disk, network, source-lock, license,
    and actual-model verification.

Required report structure:

1. Executive source-custody recommendation.
2. Authoritative Qwen3 source inventory.
3. Revision, LFS, URL, and byte-identity model.
4. Canonical source-lock schema.
5. Resumable acquisition and cache algorithms.
6. Safetensors and executable-input threat model.
7. License and redistribution closure.
8. Drift, quarantine, and revocation procedure.
9. Receipt and privacy contract.
10. Fault-injection and test matrix.
11. Dependency/tooling comparison.
12. Prioritized implementation plan.
13. Unknowns requiring local or legal verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend mutable `main` references, `trust_remote_code`, pickle-based
weights, project-hosted model-byte fallback, undocumented mirrors, silent
license assumptions, or request-file downloads as product completion. Do not
claim that source provenance proves behavioral quality.

## Prompt 3: Mixed-Q8 Qwen3 Kernel Correctness, SIMD Acceleration, And Numerical Parity

You are an independent principal numerical-computing engineer, quantized-LLM
kernel specialist, and Rust performance reviewer. Produce an exceptionally
detailed report for implementing production mixed-Q8 inference for a compact
Qwen3 model in native Rust and browser WASM while preserving an exact scalar
correctness authority. You may inspect Qwen architecture documentation,
quantization papers, official Rust and WebAssembly SIMD documentation, mature
open-source inference kernels, and numerical-reproducibility literature. You
cannot inspect TinyRustLM source, SLM2 bytes, kernels, benchmarks, hardware,
test vectors, or model outputs.

Fixed technical context:

- TinyRustLM is one prelaunch browser-local AI product. `SLM2` is the sole
  current technical model format, not a product V2.
- The first compressed candidate stores supported matrix weights as symmetric
  signed Q8 codes in `[-127, 127]` with one F32 scale per logical row.
  Normalization weights and justified small tensors remain F32.
- Runtime inference must consume validated quantized bytes directly. A hidden
  dense-F32 weight shadow, runtime model repack, legacy tensor reader, or
  alternate production engine is prohibited.
- The scalar Rust implementation is the semantic correctness authority. Native
  SIMD and WASM SIMD must be proven against it within preregistered numerical
  and token-output rules.
- Qwen3 behavior may involve RMSNorm, Q/K normalization, RoPE, grouped-query
  attention, SwiGLU, tied or untied embeddings/output projection, and
  model-specific chat/special-token semantics. Exact public model facts must be
  sourced, not guessed.
- Structural and numerical parity do not establish conversational quality.

Research primary sources and immutable code revisions. Address:

1. Derive the Qwen3-0.6B forward pass tensor by tensor, including shapes,
   layouts, attention head geometry, GQA mapping, Q/K normalization, RoPE,
   causal masking, residual order, RMSNorm epsilon, SwiGLU, vocabulary
   projection, and cache updates. Identify every fact that must be pinned from
   official configuration.
2. Derive row-wise Q8 quantization and dequantized dot-product equations.
   Specify scale calculation, rounding, tie behavior, clipping, all-zero rows,
   signed zero, NaN/Inf rejection, subnormals, accumulation type, FMA effects,
   and deterministic conversion across architectures.
3. Recommend exact on-disk and in-memory tensor layouts for sequential reads,
   cache locality, vector loads, alignment, tail handling, and zero-copy
   validation. Analyze row-major versus transposed storage and whether
   conversion-time layout specialization damages portability or provenance.
4. Design a scalar reference kernel for Q8-by-F32 matrix-vector operations and
   all non-matmul operators. State explicit arithmetic order and where
   bit-exact versus tolerance-based comparison is credible.
5. Design native x86-64 and ARM64 acceleration using stable Rust intrinsics or
   carefully scoped unsafe code. Cover AVX2, AVX-512 variants, NEON, runtime
   feature detection, horizontal reduction order, alignment, tails, and a
   fail-closed dispatch table.
6. Design WASM SIMD128 kernels and scalar fallback policy. Analyze browser
   feature detection, lane widths, integer widening, float conversion,
   reductions, unaligned loads, code size, bounds checks, and whether relaxed
   SIMD is acceptable for deterministic token parity.
7. Compare direct Q8 dequantize-and-dot, blocked kernels, scale hoisting,
   activation tiling, fused projections, and prepacked layouts. Provide a
   decision matrix for latency, memory, complexity, portability, and auditability.
8. Analyze embeddings and output projection, including tied weights, large
   vocabulary cost, logits precision, top-k extraction without materializing
   unnecessary state, and the sensitivity of token choice to small numerical
   changes.
9. Define layer-level and end-to-end conformance vectors. Include adversarial
   rows, dimensions not divisible by vector widths, all quantized extremes,
   tiny scales, large activations, RoPE boundaries, grouped heads, long token
   sequences, and repeated deterministic generation.
10. Specify differential testing among a trusted public source implementation,
    converter-side reference, scalar SLM2 runtime, native SIMD, WASM scalar,
    and WASM SIMD. Separate tensor error, layer error, logit error, token drift,
    sampler drift, and chat-template drift.
11. Define performance measurement methodology using formulas and preregistered
    environments rather than invented numbers. Cover tokens per second, time
    to first token, per-layer timing, memory bandwidth, CPU utilization, peak
    resident/WASM memory, cache misses where observable, warmup, and variance.
12. Compare this Q8 plan with Q4/AWQ/GPTQ, ternary or 1-bit approaches,
    TurboQuant-like vector quantization, TurboVec-like representations, and
    training-aware methods. Recommend which ideas may be future experiments
    and which would jeopardize the first auditable model.
13. Define unsafe-code review, fuzzing, sanitizer, Miri, property-test, and
    architecture fitness gates, plus local facts required before promotion.

Required report structure:

1. Executive kernel recommendation and assumptions.
2. Qwen3 forward-pass and tensor geometry specification.
3. Mixed-Q8 arithmetic and determinism rules.
4. Storage and in-memory layout decision.
5. Scalar correctness implementation.
6. Native SIMD and WASM SIMD designs.
7. Embedding, logits, and sampler sensitivity analysis.
8. Differential vectors and numerical acceptance rules.
9. Benchmark design and resource formulas.
10. Alternative quantization comparison.
11. Safety, fuzzing, and review gates.
12. Prioritized implementation sequence.
13. Unknowns requiring local execution.
14. Annotated primary-source bibliography with dates and direct links.

Do not invent benchmark results, claim bit-exactness where floating-point
semantics cannot support it, retain a dense production fallback, or recommend
multiple production engines. Do not promote an optimization without scalar,
native, and real-browser evidence.

## Prompt 4: Browser WASM Runtime For A Real 0.6B Model Under Honest Resource Limits

You are an independent principal WebAssembly runtime engineer, browser
performance specialist, and local-AI systems architect. Produce an
exceptionally detailed report for executing a genuine approximately 0.6B
parameter mixed-Q8 model locally in mainstream desktop browsers. You may
inspect current WebAssembly, WebAssembly JS API, WASM SIMD, threads,
SharedArrayBuffer, cross-origin isolation, memory64, browser engine, worker,
and File API documentation. You cannot inspect TinyRustLM source, WASM builds,
model files, browser traces, deployment headers, or benchmarks.

Fixed product constraints:

- TinyRustLM is one prelaunch browser-local AI product. It has one canonical
  Rust runtime and one typed browser WASM boundary; no legacy JavaScript
  inference path or server-inference fallback is allowed.
- The first target is a real mixed-Q8 SLM2 Qwen3-family model around 0.6B
  parameters, with F32 activations and a separately managed KV cache.
- JavaScript transports bytes and typed commands. Rust/WASM owns model parsing,
  composition validation, tokenization, templating, prompting, sampling,
  generation state, and bounded errors.
- Model bytes and prompts remain local or flow directly between consenting
  peers. The product site must not receive model bytes or prompts.
- Worker termination and recreation are the hard recovery boundary. Raw output
  must render exactly once. Hidden retries and answer repair are prohibited.
- A page that merely loads a miniature WASM fixture is not real-model proof.

Use current primary documentation and state browser/version dates and retrieval
date. Address:

1. Build a realistic memory equation for model bytes, WASM linear memory,
   validated metadata, activations, temporary workspaces, logits, tokenizer,
   transcript tokens, KV cache, worker/JS copies, storage buffers, and browser
   overhead. Give formulas parameterized by model geometry and context length.
2. Analyze practical constraints of wasm32 linear memory, memory growth,
   maximum pages, contiguous reservation, ArrayBuffer limits, 2 GiB/4 GiB
   boundaries, memory64 availability, browser process limits, and mobile
   constraints. Distinguish specification limits from browser implementation
   limits.
3. Compare loading strategies: full ArrayBuffer, transferable buffers,
   WebAssembly.Memory direct copy, Blob slicing, File streams, OPFS sync access
   handles in workers, memory mapping equivalents, and piece-wise validation.
   Identify unavoidable copies and methods to prove copy counts.
4. Design the WASM module surface and worker protocol for inspect, activate,
   set transcript, begin, step, finish, cancel, advance operation, state, and
   disposal. Specify bounded messages, transfer ownership, operation IDs,
   sequencing, and stale-message rejection.
5. Evaluate single-threaded scalar, single-threaded SIMD, and threaded SIMD
   execution. Cover SharedArrayBuffer, COOP/COEP/CORP headers, CSP, worker pools,
   startup cost, deterministic reductions, cancellation, crash propagation,
   and browsers that lack required features.
6. Recommend a capability/admission matrix that tells the truth before model
   load. Include memory estimate, architecture/profile support, SIMD, threads,
   persistent storage, free disk, file access, power state, and context/output
   limits. Define typed blockers rather than silent fallback.
7. Design bounded context and generation policy. Include prefill versus decode,
   maximum prompt tokens, maximum generated tokens, KV allocation, transcript
   replacement, operation advancement, stop tokens, timeout, user cancellation,
   and worker kill when cooperative cancellation fails.
8. Specify browser privacy and network assertions. Cover fetch, service
   workers, source maps, error reporting, analytics, CSP reports, referrers,
   extensions, crash reports, localhost traffic, direct peers, and proof that
   prompt/model payloads never reach project origins.
9. Design cross-browser acceptance on Chromium, Firefox, and WebKit/Safari,
   explicitly separating supported product browsers from research-only or
   blocked configurations. Include desktop and mobile-width UI without
   pretending mobile hardware can run an admitted model.
10. Define performance and responsiveness measurements: time to load, inspect,
    activate, prefill, first token, steady decode, cancellation latency, UI
    long tasks, memory high-water mark, worker restart, and profile deletion.
11. Create a fault-injection matrix for WASM trap, allocation failure, corrupt
    model tail, worker crash, browser tab suspension, stale service worker,
    duplicate message, locked OPFS file, context overflow, and abrupt process
    close.
12. Specify evidence needed for native-versus-WASM semantic parity and one real
    browser-local multi-turn conversation, while preserving raw output and
    distinguishing runtime proof from model-quality proof.
13. Identify every assumption requiring local build, real model, actual
    browser, deployment-header, hardware, and privacy-capture verification.

Required report structure:

1. Executive browser-runtime recommendation.
2. Complete memory and resource model.
3. WASM and browser platform constraint matrix.
4. Byte-loading and copy-minimization design.
5. Typed worker/WASM protocol.
6. SIMD, threading, and deterministic execution strategy.
7. Admission, context, and cancellation policy.
8. Privacy and zero-upload verification.
9. Cross-browser test matrix.
10. Performance and fault-injection plan.
11. Real-model acceptance evidence.
12. Prioritized implementation sequence.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend server inference, a JavaScript fallback engine, a miniature
fixture as product proof, silent context reduction, hidden retry, or browser
support claims based only on WebAssembly feature tables.

## Prompt 5: KV-Cache Architecture, Compression, Conversation State, And Correct Invalidation

You are an independent principal inference-memory engineer, attention-kernel
researcher, and conversational-state architect. Produce an exceptionally
detailed report on the best KV-cache design for a compact Qwen3-family model
running in native Rust and browser WASM. You may inspect current transformer
papers, Qwen architecture sources, FlashAttention and paged-attention
literature, KV quantization research, browser memory documentation, and public
implementations such as TurboQuant, TurboVec, Colibri, or related systems when
primary sources or immutable repositories exist. You cannot inspect TinyRustLM
source, model artifacts, runtime state, benchmarks, prior private reports, or
conversation traces.

Fixed context and constraints:

- TinyRustLM is one prelaunch browser-local product with one canonical runtime
  semantics. There is no old KV format or compatibility path to preserve.
- The first target is a dense approximately 0.6B Qwen3-family model stored in
  mixed Q8, while activations and the initial correctness KV cache may use F32.
- The cache is runtime state, not model weight storage. It must be bound to the
  exact active SLM2/ACG2 composition, transcript revision, operation identity,
  token sequence, layer geometry, and cache profile.
- Current-user instructions outrank stale remembered information. Retrieved or
  hosted memory is untrusted input, not executable instruction.
- Advancing an operation or replacing a transcript must not accidentally reuse
  stale KV state. A failed activation or generation cannot partially commit
  cache state.
- Browser limits must be reported honestly. Silent truncation, undisclosed
  summarization, hidden replay, or server spill is prohibited.

Research primary sources and immutable implementation revisions. Address:

1. Derive exact KV bytes as a function of layer count, key/value head count,
   head dimension, token count, element width, batch size, alignment, and any
   metadata. Apply the formula to publicly documented Qwen3-0.6B geometry only
   when facts are sourced.
2. Define canonical logical cache indexing for grouped-query attention, RoPE
   position, prompt prefill, incremental decode, and transcript replacement.
   Explain whether cached keys store pre- or post-RoPE values and why.
3. Design a simple F32 correctness cache for the first production slice.
   Cover allocation strategy, fixed versus growable capacity, per-layer layout,
   append commit points, bounds, cancellation, zeroization, and worker teardown.
4. Compare contiguous, chunked, paged, ring-buffer, and sliding-window layouts
   for native and WASM. Analyze cache locality, allocation fragmentation,
   copy cost, serialization temptation, complexity, and auditability.
5. Define cache identity and invalidation invariants for model activation,
   composition change, tokenizer/template/prompt/sampling change, transcript
   edit, operation advancement, cancellation, generation failure, worker
   recreation, and browser restart.
6. Analyze prefix reuse and multi-turn continuation. State what exact token
   prefix equality and composition identity are required, how to detect the
   first divergence, and when recomputing prefill is safer than cache surgery.
7. Compare F16/BF16, INT8, INT4, per-channel, per-token, residual, low-rank,
   vector-quantized, and importance-aware KV compression. Include accuracy
   risks, calibration requirements, browser SIMD feasibility, metadata cost,
   deterministic replay, and contamination concerns.
8. Examine relevant ideas from TurboQuant, TurboVec, Colibri, or similarly
   named public work without assuming that names refer to one technology.
   Verify exact papers/repositories, explain algorithms mathematically, and
   identify which components concern weight storage, vector search, or KV cache.
9. Design an experiment that compares F32 authority with compressed candidates
   layer-by-layer and end-to-end. Include attention output error, logit drift,
   token divergence, long-context behavior, multi-turn references, latest-turn
   precedence, latency, memory, and cancellation.
10. Specify stop rules that reject a compression method even if it saves
    memory. Include systematic token drift, authority failures, stale-state
    leakage, excessive metadata, nondeterminism, unsupported WASM operations,
    and implementation complexity disproportionate to the first model.
11. Define privacy and persistence boundaries. Explain why KV cache normally
    remains ephemeral, how browser/profile deletion affects it, whether crash
    dumps or heap snapshots matter, and why raw cache bytes must not become
    hosted long-term memory.
12. Create property, metamorphic, fault, and concurrency tests for append,
    cancellation, overflow, prefix divergence, operation change, activation
    failure, worker death, quantization extremes, and repeated deterministic
    runs.
13. Recommend a phased strategy that yields a correct first model while
    preserving a clean path to evidence-backed cache optimization, without
    shipping parallel cache engines or known debt.

Required report structure:

1. Executive KV-cache recommendation and assumptions.
2. Qwen3 geometry and exact memory formulas.
3. Canonical logical and physical cache layout.
4. Identity, transaction, and invalidation rules.
5. Multi-turn prefix reuse algorithm.
6. Compression-method technical comparison.
7. TurboQuant/TurboVec/Colibri relevance audit.
8. Accuracy and performance experiment design.
9. Privacy and persistence boundary.
10. Test and fault-injection matrix.
11. Stop rules and phased implementation plan.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend silent truncation, hidden summarization, server-side cache
spill, stale-prefix reuse, a legacy cache reader, or multiple production cache
engines. Do not claim an optimization is suitable merely because it reduces a
benchmark's bytes per token.

## Prompt 6: Exact Fifteen-Symbol Native ABI, RID Assets, And Managed Loading Safety

You are an independent principal Rust/.NET interoperability engineer, native
packaging specialist, and ABI security auditor. Produce an exceptionally
detailed report for shipping one Rust runtime through an exact C ABI and
loading it from isolated .NET package consumers on Windows and Linux. You may
inspect official Rust FFI guidance, .NET NativeLibrary and SafeHandle
documentation, PE/ELF tooling, NuGet runtime asset rules, RID documentation,
SourceLink, symbol packages, and supply-chain standards. You cannot inspect
TinyRustLM source, headers, binaries, packages, tests, or build systems.

Fixed technical contract:

- TinyRustLM is one prelaunch product with no legacy ABI, alias, or migration
  support requirement.
- The native library must export exactly these fifteen functions:
  `tinyrustlm_native_contract_json`, `tinyrustlm_string_free`,
  `tinyrustlm_slm2_inspect_json`, `tinyrustlm_runtime_create_json`,
  `tinyrustlm_runtime_destroy_json`, `tinyrustlm_runtime_state_json`,
  `tinyrustlm_runtime_activate_json`,
  `tinyrustlm_runtime_advance_operation_json`,
  `tinyrustlm_runtime_set_transcript_json`,
  `tinyrustlm_runtime_begin_request_json`, `tinyrustlm_runtime_step_json`,
  `tinyrustlm_runtime_finish_json`,
  `tinyrustlm_p2p_prepare_share_kit_json`,
  `tinyrustlm_p2p_inspect_manifest_json`, and
  `tinyrustlm_p2p_assemble_json`.
- Requests and bounded native-owned results use UTF-8 JSON. Results are freed
  only through `tinyrustlm_string_free`. Opaque runtime handles have exact
  ownership and lifecycle rules.
- The managed base package graph is Abstractions, Core, and P2P. Native assets
  belong to the package that owns runtime loading; no duplicate copies or
  fallback probing outside the package are acceptable.
- Initial RIDs include `win-x64`, `linux-x64`, and `linux-arm64`. Evidence must
  distinguish cross-compilation, header inspection, emulation, and real
  hardware execution.

Research primary documentation and record dates. Address:

1. Specify the binary-level ABI for all fifteen functions: calling convention,
   symbol names, visibility, argument/return types, null behavior, ownership,
   thread safety, unwind prohibition, and platform decoration.
2. Define the self-description returned by
   `tinyrustlm_native_contract_json`. Include exact schema/profile identities,
   symbol inventory, capability set, bounds, allocator contract, build
   identity, and failure semantics without compatibility negotiation.
3. Design Rust panic containment, allocation registry or equivalent string
   ownership, embedded-NUL handling, invalid UTF-8 rejection, bounded JSON,
   double-free defense, stale handle defense, and fail-atomic runtime mutation.
4. Design the managed P/Invoke or dynamic-binding layer using NativeLibrary,
   delegates or source-generated interop, SafeHandle, deterministic disposal,
   cancellation, and exception mapping. Compare alternatives and recommend one.
5. Specify NuGet native asset placement and selection for each RID. Cover
   `runtimes/{rid}/native`, target frameworks, transitive assets, single-file
   apps, self-contained apps, trimming, NativeAOT consumers, shadow copy,
   testhost behavior, and multiple AssemblyLoadContexts.
6. Define a constrained native resolver. It must load only package-owned exact
   assets, verify expected hashes and self-description, reject architecture
   mismatch and extra exports, avoid current-directory/PATH hijacking, and
   produce bounded diagnostic codes without searching legacy locations.
7. Design exact export inspection from source and binaries using platform
   tools and independent parsers. Include PE exports, ELF dynamic symbols,
   visibility of runtime support symbols, import tables, build IDs, and proof
   that no obsolete ABI remains.
8. Specify isolated package-consumer tests using a fresh NuGet cache and only
   packed `.nupkg` files. Cover install, load, contract query, SLM2 inspection,
   runtime create/state/destroy, ACG2 activation vectors, P2P round trip,
   cancellation, collision, tamper, and process exit.
9. Define failure tests for missing asset, wrong RID, wrong architecture,
   corrupt library, hash mismatch, extra/missing symbol, incompatible contract,
   null return, oversized report, panic, leaked string, leaked handle, double
   dispose, and two package versions in one process.
10. Explain symbol/debug package design: portable PDB for managed assemblies,
    platform debug symbols for native assets, SourceLink, stripping, deterministic
    paths, source indexing, private-data avoidance, and `.snupkg` limitations.
11. Define the minimum evidence for `win-x64`, `linux-x64`, and `linux-arm64`
    package claims and how CI reports must avoid calling cross-compilation an
    executed ARM64 pass.
12. Provide a clean deletion checklist for obsolete symbols, resolver paths,
    DllImport declarations, package assets, APIs, docs, tests, workflows, and
    sample code.
13. Identify all conclusions requiring local source, binaries, package files,
    consumer execution, and real hardware.

Required report structure:

1. Executive ABI and packaging recommendation.
2. Exact native function contract table.
3. Rust memory, panic, and handle safety model.
4. Managed binding and SafeHandle design.
5. RID asset layout and resolver algorithm.
6. Exact-symbol and binary inspection gates.
7. Isolated package-consumer test plan.
8. Failure and adversarial matrix.
9. Symbols, SourceLink, and reproducibility.
10. Platform evidence vocabulary.
11. No-legacy deletion checklist.
12. Prioritized implementation sequence.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend ABI negotiation, deprecated exports, alternate allocators,
PATH probing, copied native assets in several packages, or a managed fallback
runtime. Do not infer semantic correctness from symbol presence alone.

## Prompt 7: NuGet Public API Baselines, Package Audit, And Consumer-Proven Release Gates

You are an independent principal .NET SDK architect, NuGet package auditor,
and API-governance specialist. Produce an exceptionally detailed report for a
prelaunch SDK that may rewrite its API freely now but must ship one coherent,
minimal, enterprise-quality package surface with exact automated audits. You
may inspect official .NET SDK, NuGet, APICompat, package validation, MSBuild,
SourceLink, reproducible-build, package-signing, and consumer-testing
documentation. You cannot inspect TinyRustLM projects, assemblies, package
files, tests, scripts, or feeds.

Fixed package architecture:

- TinyRustLM is one prelaunch product. There is no released API population and
  no need for type forwarding, deprecation, facade packages, migration helpers,
  compatibility baselines, or old package IDs.
- The default package set is exactly `TinyRustLM.Abstractions`,
  `TinyRustLM.Core`, and `TinyRustLM.P2P`.
- `TinyRustLM.MemoryEndpoints` is optional, unauthorized, and disconnected. Its
  package presence cannot imply live service operation.
- `TinyRustLM.Conversion` is optional private local-feed tooling around one
  deterministic converter executable. It is not part of the default client
  SDK and is not a model-training facade.
- There is no `TinyRustLM.Memory` package.
- Public APIs should be governed by checked-in approved member lists and
  verified against freshly packed assemblies. Release evidence must come from
  isolated package consumers, not project references.

Research current primary sources and record versions/dates. Address:

1. Define package ownership and dependency direction. Specify which public
   records, enums, interfaces, runtime wrappers, P2P operations, optional
   connector contracts, and conversion operations belong in each package and
   which must remain internal.
2. Compare APICompat, PublicApiAnalyzers, reflection-generated inventories,
   reference assemblies, NuGet package validation, and custom metadata readers.
   Recommend a checked-in baseline method suitable for deliberate prelaunch
   breaking rewrites without preserving obsolete APIs.
3. Specify the canonical text format for public API baselines. Cover member
   sorting, overload identity, generic constraints, nullability, attributes,
   default values, records, enum values, nested types, explicit interfaces,
   type forwards, compiler-generated members, and platform-specific APIs.
4. Define an update workflow where API changes are intentional, reviewed, and
   atomic with implementation/tests/docs. Explain how deletion updates the sole
   current baseline without labeling it backward compatible or retaining a
   compatibility reference assembly.
5. Design a machine-readable package audit schema. Include package ID/version,
   SHA-512 or stronger artifact identity, file allowlist, dependencies,
   frameworks, RID assets, native hashes, public API baseline, XML docs,
   README/icon/license/repository metadata, SourceLink, symbols, SBOM,
   signatures, and bounded test results.
6. Specify archive-security inspection: duplicate ZIP entries, case collisions,
   path traversal, absolute paths, symlinks, compression bombs, unexpected
   executables, build scripts, analyzer code, contentFiles, tools, transitive
   dependencies, and secrets.
7. Design exact dependency checks for the five current package roles. Explain
   how to reject a standalone memory facade, circular dependencies, accidental
   conversion exposure, implementation packages leaking through Abstractions,
   and duplicated native assets.
8. Define documentation consistency checks across XML docs, package README,
   repository docs, samples, package metadata, release notes, and public sites.
   Current technical names must not be marketed as product V2.
9. Specify isolated consumer tests with fresh project directories, global
   package cache, restore sources, and only locally built package files. Cover
   compile, warnings, runtime load, exact native contract, P2P round trip,
   optional package isolation, trimming where supported, and uninstall/cleanup.
10. Design cross-platform scripts in PowerShell and POSIX shell that implement
    the same audit contract. Explain how to test semantic parity between the
    scripts without maintaining two divergent rule sets.
11. Define local-pack, private-feed, public-registry, and public-readback states.
    State objective evidence and prohibited claims for each, including package
    immutability, propagation delay, cache, and unlisting.
12. Specify release stop conditions for public API drift, stale docs, extra
    file, wrong native hash, missing symbol package, unsupported RID, feed
    mismatch, secret finding, or consumer failure.
13. Identify every fact requiring local projects, assemblies, packages,
    scripts, feeds, credentials, and registry readback.

Required report structure:

1. Executive package architecture recommendation.
2. Package ownership and dependency matrix.
3. Public API baseline specification.
4. Intentional prelaunch API-change workflow.
5. Machine-readable package audit schema.
6. Archive, dependency, and native-asset gates.
7. Cross-platform audit implementation design.
8. Isolated package-consumer test matrix.
9. Documentation and claim consistency.
10. Publication-state vocabulary and readback.
11. Release stop rules and deletion gates.
12. Prioritized implementation plan.
13. Unknowns requiring local/live verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend SemVer compatibility work for an unreleased surface, facade
packages, type forwards, deprecated APIs, conditional old package branches, or
tests that pass only because package inputs are absent. Do not count packing as
publication or project-reference tests as package-consumer proof.

## Prompt 8: Secure Local Companion For P2P-First Acquisition And Deterministic Conversion

You are an independent principal desktop-companion architect, local IPC
security engineer, and process-supervision specialist. Produce an exceptionally
detailed report for a downloadable .NET companion that helps a browser acquire
and convert local language models without becoming a cloud inference service,
credential broker, or second runtime authority. You may inspect official .NET
process, ASP.NET Core loopback, browser private-network, CORS, WebSocket,
WebTransport, native library, service supervision, and secure local-agent
documentation. You cannot inspect TinyRustLM source, binaries, configuration,
ports, certificates, browser code, model files, or runtime logs.

Fixed product constraints:

- TinyRustLM is one prelaunch browser-local product with no legacy companion
  protocol or old conversion tool to support.
- The browser is the chat interface. The companion is the sole local
  coordinator for direct fixed-piece P2P acquisition, source acquisition after
  explicit consent, deterministic Qwen3-to-SLM2 conversion, local artifact
  admission, and optional serving.
- The canonical converter executable is `tinyrustlm-convert`. No old packer,
  instruction-file download, shell-script handoff, arbitrary command execution,
  or alternate conversion path is allowed.
- Model bytes remain local or direct P2P. Project websites must not proxy model
  bytes or receive prompts.
- Conversion outputs are create-only and provenance-bound. Raw process output
  is bounded. Cancellation, timeout, crash, disk-full, and restart must be
  explicit states.
- MemoryEndpoints is unauthorized and disconnected; the companion must not
  imply live account or memory-service behavior.

Research primary sources and record dates. Address:

1. Define the companion's exact responsibilities and non-responsibilities.
   Separate discovery metadata, P2P transport, source acquisition, conversion,
   validation, artifact storage, serving, browser activation, inference, and
   hosted memory so each has one owner.
2. Design a versioned loopback protocol advertised before use. Include origin
   binding, capability document, exact POST/event routes, schema identities,
   request/response limits, operation IDs, idempotency, cancellation, status,
   unknown-field behavior, and typed errors without compatibility negotiation.
3. Compare loopback HTTPS, HTTP with origin checks, Unix sockets/named pipes
   behind a browser bridge, WebSocket, server-sent events, and polling. Address
   browser mixed-content rules, private-network access, certificates, port
   discovery, CORS, CSRF, DNS rebinding, malicious local pages, and extensions.
4. Specify pairing and authorization without placing durable administrator
   secrets in a URL. Cover first-run consent, origin allowlist, ephemeral
   session capability, restart, revocation, multi-profile use, and safe UX.
5. Design the P2P-first-or-convert state machine. Include exact artifact
   identity, peer search result, no-peer result, user consent, source/license
   review, resource preflight, download, conversion, independent validation,
   ACG2 creation/admission, local registration, optional sharing, and browser
   activation.
6. Define process supervision for `tinyrustlm-convert`: exact executable
   discovery, hash verification, argument-list construction, no shell,
   environment allowlist, working directory, standard handle capture, byte
   bounds, cancellation tree, timeout, exit code, crash dump policy, and child
   cleanup on Windows/Linux.
7. Specify durable operation journals and receipts. Cover append-only attempts,
   source/output identities, phase transitions, fsync, same-directory atomic
   promotion, restart validation, stale process detection, locked files,
   disk-full behavior, and cleanup limited to owned paths.
8. Design large-file storage and sharing with one read-only artifact/piece
   store. Include concurrent readers, conversion writer isolation, hash
   streaming, deduplication, quarantine, final admission, cache retention, and
   safe user deletion.
9. Define browser-facing progress and error semantics. The UI should show one
   operation, meaningful stages, bytes and resource estimates, cancellation,
   resumability, and actionable blockers without asking users to download or
   run text/script files.
10. Create a threat model for arbitrary local files, traversal, symlinks/
    reparse points, malicious safetensors, hostile peers, request smuggling,
    giant JSON, stdout flooding, converter substitution, DLL search hijacking,
    token leakage, and unauthorized model serving.
11. Specify unit, integration, process, package-consumer, real-browser, crash,
    power-loss, and privacy tests. Distinguish fixture proof from one-real-model
    acceptance and public outside reachability.
12. Design packaging and service operation for portable archives, Windows user
    startup or service choices, systemd user services, updates before launch,
    logs, support bundles, and complete uninstall without legacy service names.
13. Identify all facts requiring local companion, converter, browser, OS,
    model, network, and authorized deployment testing.

Required report structure:

1. Executive companion recommendation.
2. Responsibility and trust-boundary diagram.
3. Loopback capability and route contract.
4. Origin, pairing, and local authorization model.
5. P2P-first-or-convert state machine.
6. Converter process-supervision algorithm.
7. Durable journal, resume, and cleanup rules.
8. Artifact store and serving design.
9. Browser UX status contract.
10. Security and privacy threat matrix.
11. Test and fault-injection plan.
12. Packaging and operations plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend arbitrary shell execution, downloadable request scripts,
project-hosted model-byte proxying, permissive CORS, static secrets in URLs,
legacy endpoints, or a second inference runtime. Do not count a fixture or
loopback health response as successful real-model acquisition.

## Prompt 9: Browser Storage, Streaming Admission, And Exactly-Once Worker/UI Semantics

You are an independent principal browser-storage engineer, web-worker
reliability architect, and privacy-focused UX systems researcher. Produce an
exceptionally detailed report for importing, validating, retaining, activating,
and conversing with multi-hundred-megabyte local model artifacts in a browser
without duplicate answers or hidden network transfer. You may inspect current
File API, File System Access, OPFS, IndexedDB, StorageManager, Cache Storage,
Streams, Web Workers, structured clone, BroadcastChannel, Web Locks, service
worker, and browser privacy documentation. You cannot inspect TinyRustLM HTML,
JavaScript, WASM, assets, screenshots, traces, profiles, or model files.

Fixed context and constraints:

- TinyRustLM is one prelaunch browser-local AI product. It has one browser
  worker command path and one UI rendering path; there is no legacy loader or
  duplicate inference route to preserve.
- The browser should acquire an exact model from direct P2P through a local
  companion when available, or initiate consented local source conversion when
  necessary. It must never download a text/script request as the apparent model.
- SLM2 and ACG2 bytes require exact identity, complete bounded validation, and
  fail-atomic activation by Rust/WASM. JavaScript may not repair artifacts.
- Model bytes and prompts must not be uploaded to project origins. Local model
  retention requires explicit truthful product semantics.
- Raw assistant output must render exactly once. Cancellation, worker death,
  restart, stale events, and model switching cannot duplicate or splice text.
- Real clean-profile tests must create and delete owned browser profiles;
  clearing one storage API or refreshing is not equivalent.

Research current primary browser sources and record browser/version dates.
Address:

1. Compare user-selected `File` handles, File System Access handles, OPFS,
   IndexedDB blobs/chunks, Cache Storage, and companion-loopback streaming for
   large immutable model bytes. Analyze browser support, quotas, permissions,
   persistence, eviction, copies, random access, worker access, and privacy.
2. Design one canonical artifact-storage strategy for supported browsers and a
   truthful unsupported-state policy. Avoid maintaining several production
   storage engines merely to claim broad support.
3. Specify storage preflight: `navigator.storage.estimate`, persistence
   requests, expected source/model/piece/temp sizes, headroom, quota races,
   private browsing, eviction, and user-facing resource decisions.
4. Design streamed import and validation. Cover chunk sizes, backpressure,
   incremental hashing, content length, exact final size, partial journals,
   cancellation, worker transfer, no full duplicate buffers, and create-only
   final identity registration.
5. Define storage metadata and ownership. Bind artifact hash, ACG2 identity,
   byte size, profile, admission receipt, source/provenance pointer, created
   time, last verified time, and owner marker without recording prompts,
   credentials, or unsafe private paths.
6. Specify crash/restart behavior for partial downloads, partial conversion
   handoff, incomplete OPFS writes, browser termination, stale locks, service
   worker update, and companion restart. Distinguish resumable from terminal
   operations.
7. Design the worker protocol with immutable operation IDs and monotonic event
   sequence numbers. Include acquire, inspect, activate, begin, token delta,
   finish, cancel, failure, dispose, and hard worker-recovery events.
8. Define exactly-once UI semantics. State the single authoritative message
   record, idempotent event application, terminal commit, stale-event rejection,
   cancellation display, retry as a new visible operation, and prevention of
   duplicate DOM render paths.
9. Analyze multi-tab and multi-window coordination using Web Locks,
   BroadcastChannel, storage events, and companion operation ownership.
   Recommend whether to allow concurrent inference, read-only observation, or
   fail-closed exclusivity for the first release.
10. Define model switching and deletion. Cover active worker teardown, cache
    invalidation, file-handle closure, locked storage, references from ACG2,
    piece-store sharing, confirmation, zeroization limits, and proof of deletion.
11. Specify privacy/network tests across fetch/XHR/WebSocket/WebRTC, service
    workers, browser caches, local/session storage, IndexedDB, OPFS, URLs,
    referrers, logs, traces, screenshots, crash reports, and project origins.
12. Create real-browser acceptance scenarios for large files, long model names,
    slow disks, quota loss, cancellation, stale events, duplicate events,
    worker trap, tab close, refresh, mobile widths, accessibility, and fresh
    profile deletion.
13. Identify every conclusion requiring local browser code, real model bytes,
    profile inspection, network capture, and cross-browser execution.

Required report structure:

1. Executive browser-storage recommendation.
2. Storage API comparison and support matrix.
3. Canonical artifact-store data model.
4. Streaming import/admission algorithm.
5. Crash, resume, eviction, and deletion rules.
6. Worker operation protocol.
7. Exactly-once UI state machine.
8. Multi-tab and model-switching policy.
9. Privacy and zero-upload contract.
10. Real-browser fault and accessibility matrix.
11. No-legacy deletion gate.
12. Prioritized implementation plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend a text/script download, prompt upload, server inference,
silent storage fallback, one reusable test profile, answer repair, hidden retry,
or more than one authoritative UI rendering path.

## Prompt 10: Fixed-Piece Direct P2P Transport, Shared Store, And Hostile-Network Admission

You are an independent principal P2P protocol engineer, network-security
specialist, and content-addressed storage architect. Produce an exceptionally
detailed report for direct transfer of immutable SLM2 and ACG2 artifacts
between consenting peers through a downloadable local companion. You may
inspect HTTP standards, Range and CORS specifications, Merkle-tree literature,
content-addressed systems, NAT traversal standards, local service security,
and public P2P implementations. You cannot inspect MiniModel or TinyRustLM
source, manifests, pieces, endpoints, servers, receipts, credentials, or
network captures.

Fixed product constraints:

- TinyRustLM is one prelaunch product. There is one current P2P profile and no
  legacy manifest, alternate piece scheme, or proxy fallback to support.
- MiniModel supplies catalog/discovery metadata only. Project sites must not
  proxy model bytes.
- The canonical transport uses immutable four-MiB pieces, SHA-256 identities,
  a composition-bound manifest, complete piece verification, whole-artifact
  verification, and semantic SLM2/ACG2 admission before create-only promotion.
- Two or more peers may contribute only when they agree on the complete exact
  artifact, composition, manifest, piece, and profile identities.
- The .NET companion coordinates local serving and acquisition. The Rust P2P
  implementation is the sole manifest and assembly authority.
- Loopback, LAN, NAT hairpin, and a listening socket are not public
  reachability proof. External proof and catalog announcement are later gates.

Research primary standards and immutable implementations. Address:

1. Specify the canonical fixed-piece manifest. Include schema/profile,
   artifact and ACG2 identities, exact size, piece size, ordered piece hashes,
   final-piece length, Merkle profile/root, media type, semantic role, and
   complete canonicalization rules.
2. Define piece-generation and shared-store layout. Cover streaming hashes,
   no duplicate model bytes per lane, atomic piece promotion, hard-link/reflink
   tradeoffs, read-only serving, reference ownership, garbage collection,
   corruption quarantine, and Windows reparse defense.
3. Design a strict HTTP allowlist with exact methods/routes, normalized piece
   names, headers, CORS origins, Range semantics, content length/type, ETag,
   cache policy, timeouts, connection limits, and explicit rejection of
   directory listing, upload, arbitrary paths, dynamic compression, and route
   extension.
4. Analyze request smuggling, header ambiguity, path normalization, percent
   encoding, Unicode, `..`, alternate separators, symlinks, reparse points,
   sparse ranges, multi-range amplification, slow clients, decompression,
   giant headers, and connection exhaustion.
5. Design resumable import from one or more peers. Include durable piece
   journal, peer scheduling, per-peer/global concurrency, timeout/retry policy,
   matching-identity gate, partial file ownership, cancellation, restart,
   corruption attribution, and no best-effort mixing.
6. Specify final assembly: ordered streamed write, per-piece recheck, complete
   file hash, Merkle check, exact length, complete SLM2/ACG2 semantic admission,
   composition binding, create-only promotion, fsync, and cleanup.
7. Define companion/browser coordination without exposing arbitrary local
   files. Include loopback authorization, origin binding, artifact consent,
   progress, cancellation, local path secrecy, and typed failure reports.
8. Compare manual port forwarding, IPv6, CGNAT, double NAT, PCP, NAT-PMP,
   UPnP, WebRTC, relays, and operator-approved tunnels. Recommend an initial
   policy that never silently changes router/firewall state or routes model
   bytes through project infrastructure.
9. Define accurate states from local-prepared through serving, externally
   reachable, externally proven, announced, degraded, stale, revoked, and
   removed. State evidence and expiry for each.
10. Design denial-of-service governance: connection quotas, per-peer fairness,
    bandwidth caps, read amplification, hash CPU, file descriptors, page cache,
    hot/cold models, proof probes, logging bounds, and privacy-preserving
    diagnostics.
11. Specify fault injection for corrupt pieces, wrong manifest, same hash name
    with wrong bytes, peer loss, two disagreeing peers, locked journal, disk
    full, abrupt shutdown, lane collision, stale endpoint, expired proof, and
    catalog drift.
12. Define CI evidence, local real-model evidence, outside-network evidence,
    and public announcement evidence separately. Explain what cannot be proven
    by mocks or loopback tests.
13. Identify all facts requiring local implementation, real artifact, network,
    outside observer, signing, and catalog access.

Required report structure:

1. Executive P2P recommendation.
2. Canonical manifest and Merkle specification.
3. Piece-store and ownership model.
4. Strict HTTP allow/deny profile.
5. Multi-peer resume and assembly algorithm.
6. Companion/browser trust boundary.
7. NAT and reachability policy.
8. Status and external-proof vocabulary.
9. Capacity and denial-of-service model.
10. Fault-injection and recovery matrix.
11. Evidence ladder from CI to announcement.
12. Prioritized implementation plan.
13. Unknowns requiring local/live verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend project-hosted byte proxying, automatic router changes,
arbitrary file serving, two URLs in one process as independent lanes, local
health as public proof, legacy manifests, or assembly before exact identity
agreement.

## Prompt 11: No-Cheat Qualification From Untouched Source Through Native And Browser Output

You are an independent principal evaluation scientist, small-model quality
researcher, and evidence-integrity auditor. Produce an exceptionally detailed
report for deciding whether one compact Qwen3-family model is genuinely useful
after deterministic mixed-Q8 conversion and real browser execution. You may
inspect primary evaluation research, official model cards, statistical
methods, contamination-detection literature, human-rating guidance, and
reproducible inference documentation. You cannot inspect private prompts,
holdouts, training records, adapters, model outputs, evaluators, receipts, or
TinyRustLM source.

Fixed quality and evidence constraints:

- TinyRustLM is one prelaunch browser-local AI product. The first target is one
  real, provenance-bound approximately 0.6B model; success does not advance a
  later 20-model or 50-round campaign.
- Important behaviors include ordinary conversation, ambiguity handling,
  practical constraints, source conflict, latest-user precedence, multi-turn
  continuity, untrusted quoted/retrieved memory, summaries, rewrites,
  structured output, code explanation, and direct treatment of lawful adult
  questions with narrow explicit harm boundaries.
- Raw source, adapted, converted SLM2, native-runtime, and browser-WASM outputs
  must be preserved exactly. Response repair, answer completion, hidden retry,
  best-of-N selection, expected-term injection, and hand-edited transcripts
  are forbidden.
- Fixed cases, deterministic seeded paraphrases, sealed holdouts, model judges,
  deterministic invariants, and human reviewers have different roles. No
  opaque model judge may be sole authority.
- Human holdout authors and reviewers must be genuinely separate people where
  independence is claimed. A coding agent may not impersonate them.
- Tokenizer2 and Template2 conformance can remain valid if exact bound bytes
  and semantics are unchanged, but model runtime and quality require new
  evidence.

Research primary sources and record dates. Address:

1. Define claim levels from source-acquired, structurally converted,
   numerically conformant, conversation-screened, browser-executed,
   conversation-qualified, and task-specific-qualified. Give minimum evidence
   and prohibited marketing language for each.
2. Design an untouched source-model screen before conversion or training.
   Include case count rationale, deterministic versus sampled runs, repeated
   seeds, multi-turn state, exact chat template, practical constraints, source
   authority, ambiguity, over-refusal, and human review thresholds.
3. Specify a sealed holdout custody protocol. Bind generator/version, seed
   commitment, template family, exclusion set, prompt hash, expected invariant,
   reviewer assignment, access log, materialization time, and final seal without
   exposing cases to training or implementation agents.
4. Design contamination controls across exact text, normalized text, character
   and token n-grams, semantic neighbors, template families, entity/unit
   substitution, response-answer overlap, public benchmarks, teacher outputs,
   development failures, and deleted records.
5. Define layered scoring. Assign roles to structural checks, parsers,
   scenario-specific semantic invariants, calibrated model judges, blinded
   pairwise comparison, and human adjudication. Explain authority when layers
   disagree.
6. Develop general semantic invariants for underspecified choices, conflicting
   dates/authorities, unavailable resources, current-turn preference over stale
   memory, quoted instructions as data, feasible fallbacks, completion,
   nonrepetition, valid JSON, and lawful adult comparisons.
7. Design metamorphic cases varying entities, order, units, percentages,
   dates, negation, discourse style, irrelevant details, resource availability,
   authority ranking, and malicious quoted memory. State which outputs should
   preserve verdict and which input changes should change the correct behavior.
8. Specify a paired promotion matrix comparing untouched source, any authorized
   adaptation, deterministic converter reference, scalar SLM2, native optimized
   runtime, and real-browser WASM. Bind tokenizer, template, prompt, sampler,
   seed, context, output limit, and raw bytes.
9. Define numerical-versus-semantic diagnosis. Explain how to localize a
   divergence to source template, tokenization, conversion, tensor layout,
   kernel arithmetic, KV cache, sampling, decoding, worker messaging, or UI
   rendering.
10. Recommend statistical treatment for stochastic cases: per-case seeds,
    pass probability, confidence intervals, clustered scenario families,
    multiple comparisons, minimum effect, regression budget, flaky
    infrastructure, and preregistered stopping.
11. Design human review with blinded output order, rubric anchors, independent
    raters, inter-rater agreement, conflict adjudication, fatigue limits,
    removal lineage, privacy, and public-safe summaries.
12. Specify failure preservation and evaluator TDD. Keep raw failure, create a
    generic regression and counterexamples, version the evaluator, rerun only
    invalidated evidence, and never overwrite a prior decision.
13. Define objective first-model acceptance and all facts requiring private
    prompts, source execution, human custody, real model, native/WASM runs, and
    browser observation.

Required report structure:

1. Executive quality recommendation and assumptions.
2. Claim taxonomy and evidence ladder.
3. Untouched source-screen protocol.
4. Sealed holdout and contamination controls.
5. Layered semantic evaluator architecture.
6. Invariant and metamorphic test tables.
7. Source-to-browser paired promotion matrix.
8. Divergence diagnosis workflow.
9. Statistical and human-review protocol.
10. Failure preservation and evaluator versioning.
11. Objective first-model acceptance checklist.
12. Prioritized execution plan.
13. Unknowns requiring local/human verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend training on holdouts or failed evaluation cases, keyword-only
acceptance, judge-only scoring, repaired output, best-of-N selection, preferred
seed selection after observation, lowered thresholds, or structural conversion
as a quality claim.

## Prompt 12: Atomic Clean-Slate Cutover, Release Graph, Documentation, And Public Readback

You are an independent principal release engineer, repository-closure auditor,
and multi-site documentation/publication architect. Produce an exceptionally
detailed report for completing one coherent prelaunch cutover across Rust,
WASM, native ABI, .NET packages, companion archives, browser assets,
documentation, marketing sites, workflows, tests, and release evidence. You
may inspect official Cargo, .NET, NuGet, GitHub Actions, SLSA, in-toto, SBOM,
signing, deterministic-build, web deployment, cache, and docs-as-code guidance.
You cannot inspect TinyRustLM repositories, worktrees, CI, packages, sites,
credentials, DNS, deployment logs, or private artifacts.

Fixed program constraints:

- TinyRustLM is one prelaunch product. There is no launched V1 and therefore
  no product V2, legacy population, compatibility promise, migration guide, or
  justification for retaining obsolete executable paths.
- Technical identities SLM2, ACG2, Tokenizer2, Template2, Prompt2, Sampling2,
  schema versions, package semantic versions, and branch/path names are not
  product generations.
- The sole current architecture includes a canonical Rust runtime, one exact
  fifteen-symbol native ABI, base .NET packages Abstractions/Core/P2P, optional
  disconnected MemoryEndpoints, optional private Conversion, one local
  companion, one browser WASM worker path, fixed-piece direct P2P, and one
  browser UI rendering path.
- Model bytes stay outside source control. Public-safe source locks, schemas,
  hashes, receipts, SBOM/provenance, docs, and code belong in source control.
- Every major coherent change should be committed after it builds. Every
  release candidate should deploy only after all applicable tests pass.
- Every published site must show a consistent version/build identity, release
  date, last-published timestamp, and append-only human-readable update log.
- A build, pack, push, or deploy command is not completion. Public package and
  HTTPS readback must match expected immutable identities.
- MemoryEndpoints is unauthorized and disconnected. Larger campaign counters
  remain zero until objective live evidence exists.

Research primary sources and record publication/update/retrieval dates. Address:

1. Design a repository-wide executable closure inventory spanning Cargo
   members, .NET solution/projects, package references, native symbols, WASM
   entry points, JavaScript imports, worker messages, HTML assets, companion
   routes, workflows, scripts, test discovery, docs, samples, generated files,
   and site deployment inputs.
2. Define semantic searches and graph analyses that find old behavior even
   after superficial renaming. Include duplicate parsers, packers, model
   loaders, fallback branches, environment toggles, aliases, stale fixtures,
   conditional tests, hidden package IDs, old route families, and docs that
   still instruct obsolete workflows.
3. Specify an atomic cutover sequence that keeps every commit buildable while
   ending with exactly one owner per behavior. Cover preregistered contract,
   new producer, all consumers, tests, package scripts, workflows, docs, sites,
   and deletion of the complete obsolete closure in the same coherent series.
4. Explain when a temporary commit may be incomplete within a branch and what
   minimum build/test gate is required before check-in. Define major-change
   commit boundaries, commit messages, protected evidence, and push/readback.
5. Design architecture fitness functions for forbidden tokens, duplicate
   public APIs, extra native symbols, multiple model formats, package graph,
   dependency direction, browser worker ownership, instruction downloads,
   server inference, hidden retry, test skips, and stale documentation.
6. Define one content-addressed release graph binding commit/tree, locks,
   model source, converter, SLM2/ACG2 members, runtime binaries, native assets,
   NuGet packages, symbols, WASM, browser bundle, companion archives, docs/site
   bundles, test receipts, deployment attempts, and public readbacks.
7. Specify selective invalidation. Show what reruns when converter, model,
   tokenizer, template, sampler, runtime, ABI, wrapper, P2P profile, browser
   asset, evaluator, documentation, or site metadata changes.
8. Design release gates for Rust format/test/Clippy/fuzz, .NET format/build/test,
   exact API/symbol/package audit, isolated consumers, browser tests, privacy,
   cross-platform evidence, archive security, SBOM, provenance, signing,
   secret scanning, and documentation consistency.
9. Define a shared release metadata and update-log schema consumed by all
   product, catalog, documentation, and marketing sites. Include product
   identity, technical contract identities, version/build, release date,
   publish timestamp, commit/tree, changes, removals, evidence, known limits,
   public URLs, and rollback/supersession.
10. Design publication transactions for several sites and package feeds.
    Cover staging, credentials, authorization, immutable bundles, cache purge,
    partial failure, retry as a new attempt, rollback, HTTPS/TLS readback,
    content hashes, package registry propagation, and stale CDN detection.
11. Specify documentation quality gates: information architecture, API
    extraction, compiled samples, link/anchor checking, terminology lint,
    screenshot freshness, accessibility, search metadata, canonical URLs,
    privacy claims, package links, and deletion of obsolete instructions.
12. Define truthful status reporting for local build, tested commit, packed
    artifacts, private feed, public feed, deployed origin, public readback,
    model qualification, P2P proof, and optional external service authorization.
13. Create a final no-debt acceptance checklist requiring no obsolete
    executable closure, no conditional missing-input success, no stale docs,
    no secret exposure, no uncommitted source, exact remote identity, and
    complete public readback where publication is authorized.
14. Identify all facts requiring local repositories, CI, credentials, real
    models, packages, sites, DNS/CDN, outside observers, and human authorization.

Required report structure:

1. Executive cutover and release recommendation.
2. Executable closure and ownership graph.
3. Semantic legacy/debt discovery procedure.
4. Buildable atomic cutover sequence.
5. Architecture fitness functions.
6. Content-addressed release and invalidation graph.
7. Component and platform gate matrix.
8. Shared release metadata and update-log schema.
9. Multi-site/package publication transaction.
10. Documentation freshness and claim integrity.
11. Status vocabulary and operator dashboard.
12. Final no-debt acceptance checklist.
13. Prioritized implementation plan.
14. Unknowns requiring local/authorized verification.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend a product V2, compatibility shim, deprecated API, migration
guide, old reader/writer, fallback runtime, conditional skip presented as a
pass, uncommitted deployment, stale documentation, or publication claims based
only on commands. Do not overwrite failed or superseded evidence.

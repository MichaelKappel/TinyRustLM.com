# Twelve Disconnected Research Prompts: Post-Composition First-Model Proof And Clean-Slate Product Cutover

Each section below is a complete standalone assignment. Send each entire
prompt to a different technical research agent. The agents do not share
context and must not be expected to have read this introduction, another
prompt, another report, or any private TinyRustLM material.

The reports are advisory research inputs. They are not implementation, test,
release, deployment, or production evidence. Every researcher must use current
primary sources wherever possible, record each source's publication or update
date and the report's retrieval date, link directly to supporting material,
and pin public repository observations to immutable revisions. Each report
must clearly distinguish:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that could not be independently verified;
4. engineering analysis and recommendations;
5. assumptions, uncertainties, alternatives, and source disagreements; and
6. facts requiring private source inspection, local execution, real hardware,
   browser testing, credentials, or authorized production verification.

No researcher may claim to have inspected, built, run, tested, or validated
private TinyRustLM source or artifacts. Reports should be exceptionally
detailed and technical. They should include equations, algorithms,
pseudocode, state machines, schemas, byte layouts, bounded resource formulas,
threat models, failure matrices, fault-injection cases, objective acceptance
criteria, and prioritized implementation sequences. Generic tutorials,
marketing summaries, invented measurements, unsupported success claims, and
recommendations to preserve hypothetical prelaunch compatibility are not
useful.

## Prompt 1: Independent Qwen3 Source-To-Composition Acceptance Contract

You are an independent principal model-format architect, binary-container
engineer, and digital-evidence specialist. Produce an exceptionally detailed,
implementation-oriented report defining how to convert one pinned public
Qwen3-0.6B source closure into one complete, content-addressed, independently
verifiable local composition. Target 10,000 to 18,000 words excluding the
bibliography. Favor exact contracts, algorithms, and rejection conditions over
general model-conversion advice.

You have internet access and may inspect public model cards, immutable public
repository revisions, official Qwen and Transformers implementation sources,
Safetensors documentation, tokenizer files, Rust and .NET documentation,
filesystem documentation, cryptographic standards, and reproducible-build
guidance. You have no access to any TinyRustLM repository, private source
directory, model cache, converter, generated artifact, receipt, test output,
development machine, credential, signing key, or unpublished evaluation case.
Do not request private paths or secrets and do not imply private validation.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch browser-local AI chat product.
- The sole intended model format is a technical format called SLM2. Related
  Tokenizer2, Template2, Sampling2, Prompt2, and composition identities are
  technical contracts, not separate product generations.
- The current first-model candidate is the official `Qwen/Qwen3-0.6B` family,
  pinned by immutable source revision and exact file hashes before execution.
- A complete composition is expected to contain six ordered, individually
  hashed members: model weights, tokenizer behavior, chat-template behavior,
  sampling behavior, prompt-policy behavior, and a composition manifest. The
  report must independently assess whether that partition is sufficient and
  identify any missing semantic dependency.
- Conversion must be create-only, deterministic, streamed, bounded, and
  terminal. Existing output is a collision, partial output is never promoted,
  and no retry, repair, adoption, overwrite, best-of-N, compatibility reader,
  alias, fallback format, or migration path is permitted.
- Earlier failed attempts are immutable evidence only and cannot donate
  executable bytes to a later attempt.
- A structural pass proves neither numerical inference, conversation quality,
  browser execution, P2P availability, deployment, nor publication.
- Model bytes and private evidence remain outside source control. Public
  records may expose bounded hashes, sizes, versions, statuses, timestamps,
  and typed errors, but not private paths, prompts, credentials, or raw model
  data.
- There is no live-user compatibility obligation. A correct replacement must
  remove the superseded executable closure rather than keep dual paths.

Research and resolve all of the following:

1. Establish the authoritative public Qwen3-0.6B source closure. Identify the
   minimum exact files needed to reproduce architecture, tensor inventory,
   tokenizer, added tokens, merges, special-token policy, generation defaults,
   and chat template. Explain immutable revision pinning, LFS pointer handling,
   redirects, ETags, partial downloads, source drift, and license capture.
2. Derive the expected tensor inventory from architecture metadata and public
   implementation code rather than trusting whatever keys happen to appear.
   Cover layer counts, hidden/intermediate dimensions, attention heads,
   key/value heads, vocabulary size, tied or untied output projection,
   transposition conventions, tensor ranks, shapes, dtypes, ordering, and
   duplicate or missing names. Give pseudocode for an independent inventory
   oracle and explain how to detect a source whose metadata and tensors
   disagree.
3. Specify exact treatment of tied embeddings. Determine how byte equality,
   logical identity, storage deduplication, aliases, and output projection
   semantics should be represented without making the runtime dependent on a
   source-framework alias. Explain when one physical tensor may satisfy two
   logical roles and how a verifier proves this without copying gigabytes.
4. Design the SLM2 model member as a strict binary format. Provide a proposed
   header and section table, integer widths, byte order, alignment, padding,
   tensor descriptors, quantization descriptors, scale layout, checksum
   domains, bounds checks, overflow checks, unknown-field behavior, and a
   canonical ordering rule. Distinguish semantic identity from incidental file
   offsets and explain whether the complete artifact hash should include
   padding.
5. Define how Tokenizer2, Template2, Sampling2, and Prompt2 must bind all
   behavior that can change generated tokens. Include normalization, byte
   fallback, added-token precedence, special tokens, end markers, thinking
   controls, stop conditions, default sampling parameters, system-message
   policy, context limits, and unknown-field rejection. Identify any behavior
   that must not remain an implicit runtime default.
6. Specify a canonical composition manifest that binds all six member hashes,
   sizes, schemas, source identities, converter identities, quantization
   policy, required runtime features, semantic dependency graph, and creation
   lineage. Provide a canonical JSON or CBOR example, domain-separated content
   identifiers, exclusion rules for self-identifying fields, and strict parser
   behavior.
7. Design one transaction that emits all members or no accepted composition.
   Cover same-directory staging, exclusive creation, streamed writes,
   file flush, directory flush, atomic rename, Windows replacement semantics,
   crash boundaries, power loss, disk full, antivirus locks, stale staging,
   cross-volume mistakes, and post-crash classification. A later process must
   never infer success from filenames alone.
8. Define independent inspection that shares no model-format implementation
   with the producer beyond the frozen public contract. Compare a read-only
   .NET inspector, a second Rust implementation, and a small formally scoped
   parser. Explain common-mode failure risks and how an inspector verifies
   large files with bounded memory.
9. Separate source provenance, structural validity, semantic completeness,
   native numerical validity, browser validity, behavioral qualification, and
   release eligibility into distinct states. Provide allowed transitions,
   terminal states, invalidation rules, and prohibited claims at each state.
10. Create a hostile-input matrix covering truncated headers, length overflow,
    overlapping sections, duplicate tensors, invalid UTF-8, noncanonical JSON,
    impossible quantization blocks, NaN/Inf scales, path traversal, symlinks or
    reparse points, zip bombs, source mutation during read, and hash mismatch.
11. Define deterministic reproducibility evidence. Explain which byte-level
    differences are acceptable, if any, across machines and which inputs must
    be bound when exact bytes cannot be reproduced. Recommend a practical
    reproducible-build experiment without inventing results.
12. Give a test-driven implementation order that starts with malformed inputs
    and a tiny synthetic model but cannot confuse that fixture with real-model
    evidence. End with objective gates for one real complete composition.

Required report structure:

1. Executive decision and explicit assumptions.
2. Primary-source observation table with revisions and dates.
3. Authoritative Qwen3 source-closure definition.
4. Derived tensor inventory and tied-embedding proof.
5. Proposed SLM2 byte contract and canonical identity rules.
6. Tokenizer/template/sampling/prompt semantic closure.
7. Six-member composition manifest schema.
8. Atomic conversion state machine and crash table.
9. Independent inspector design and common-mode analysis.
10. Evidence graph, claim taxonomy, and invalidation rules.
11. Hostile-input and fault-injection matrix.
12. Reproducibility protocol and bounded resource formulas.
13. Prioritized TDD implementation plan with acceptance gates.
14. Unknowns requiring private source or execution evidence.
15. Annotated primary-source bibliography with direct links and dates.

Do not recommend accepting a model from filename, popularity, parameter count,
or one successful parse. Do not invent private tensor counts or claim that a
proposed schema is already implemented. Do not preserve a superseded format,
write a compatibility reader, reuse failed-attempt bytes, repair malformed
output, or call a structural pass a usable model.

## Prompt 2: Exact Qwen3 Transformer Mathematics And Scalar Reference Runtime

You are an independent principal numerical-software engineer, transformer
architecture researcher, and Rust inference-runtime designer. Produce an
exceptionally detailed report deriving an auditable scalar reference
implementation for the exact public Qwen3-0.6B architecture and explaining how
to prove every operator before optimization. Target 10,000 to 18,000 words
excluding the bibliography. Include equations, shape derivations, typed
pseudocode, storage layouts, and numerical error analysis.

You may browse official Qwen documentation and code, the public model
configuration and model card at an immutable revision, official Transformers
source, PyTorch documentation, Rust numerical-library documentation, IEEE 754,
WebAssembly specifications, and peer-reviewed inference literature. You have
no TinyRustLM source, private SLM2 artifact, runtime binary, traces, tests,
hardware measurements, credentials, or unpublished prompts. Treat every
project statement below as unverified context and clearly label it as such.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch local-chat product intended to run compact models
  in native Rust and in a real browser through WebAssembly.
- The first candidate is one pinned official Qwen3-0.6B source transformed
  into SLM2 mixed-Q8 storage. The scalar native path must be the correctness
  reference for optimized native and browser kernels.
- Tokenizer2, Template2, Sampling2, and Prompt2 are separately bound semantic
  inputs. The runtime may not silently substitute defaults.
- Exact token IDs are required where arithmetic is intended to be exact;
  floating-point activations may use explicitly justified tolerances. A final
  decoded-string match alone is insufficient proof.
- No post-generation repair, hidden retry, best-of-N selection, alternate
  legacy runtime, or source-framework service may hide an incorrect runtime.
- Arithmetic can be delegated to a calculator at product level, but the model
  execution itself must be numerically sound.

Research and resolve all of the following:

1. Pin and describe the authoritative Qwen3-0.6B architecture from primary
   public sources. Verify rather than assume hidden size, layer count,
   intermediate size, vocabulary, attention heads, key/value heads, head
   dimension, RoPE parameters, normalization epsilon, activation function,
   attention bias policy, tied embeddings, context limits, and any sliding or
   window behavior.
2. Derive the full forward pass for one prompt and one generated token. Cover
   embedding lookup, residual stream, pre/post normalization placement,
   Q/K/V projections, grouped-query head mapping, rotary embedding, causal
   masking, stable softmax, attention-value accumulation, output projection,
   gated MLP, residual additions, final norm, tied or untied language head,
   and logits. State tensor shapes at every step.
3. Investigate Qwen3-specific Q/K normalization or other architecture details
   that differ from Qwen2-family assumptions. Show how a superficially
   plausible implementation could produce fluent but wrong output if any one
   detail is missed.
4. Specify RoPE exactly: position indexing, base or scaling configuration,
   even/odd pairing, interleaved versus split-half layout, sin/cos precision,
   cache construction, prefill/decode reuse, and context-extension behavior.
   Give test vectors that detect transpose, sign, indexing, and precision
   errors.
5. Define stable scalar algorithms for RMSNorm, dot products, softmax, SiLU,
   elementwise multiplication, matrix-vector multiplication, and logits. For
   each operation, compare f32 accumulation, widened accumulation, pairwise or
   compensated summation, and deterministic loop order. Explain where exact
   bit equality is realistic and where an error budget is more honest.
6. Integrate mixed-Q8 weights without allowing quantization to obscure
   operator correctness. Define a dequantize-to-f32 reference path, block and
   scale indexing, signed interpretation, tail handling, and independent
   checks against malformed scale or data sections.
7. Design KV-cache state for grouped-query attention. Define dimensions,
   ownership, token positions, capacity arithmetic, overflow detection,
   prefill/decode transitions, context reset, cancellation, and rollback after
   an interrupted token. Give formulas for bytes per token by dtype and
   architecture parameters.
8. Specify deterministic sampling boundaries after logits: temperature,
   repetition penalty, top-k, top-p, seed algorithm, probability normalization,
   tie behavior, token masking, stop-token handling, and no-sampling greedy
   mode. Make clear which semantics belong to Sampling2 rather than model math.
9. Propose a reference Rust module organization that is intentionally simple,
   bounded, and difficult to optimize accidentally. Cover checked arithmetic,
   slice contracts, alignment assumptions, error types, allocation ownership,
   no-unsafe baseline, thread count, and deterministic execution.
10. Design micro-vectors and metamorphic properties for every operator.
    Include all-zero and constant vectors, one-hot weights, extreme logits,
    NaN/Inf rejection, zero-length rejection, odd dimensions, GQA mapping,
    RoPE at multiple positions, tied-output equality, and prompt/decode cache
    equivalence.
11. Define an end-to-end oracle comparison that records first divergence at
    embeddings, every sublayer, final logits, selected token IDs, and decoded
    bytes. Explain trace volume controls and how to avoid changing execution
    semantics while observing it.
12. Provide a staged route from scalar correctness to later SIMD/WASM kernels.
    Each optimized operation must be replaceable independently and must prove
    bounded numerical equivalence against the scalar path before admission.

Required report structure:

1. Executive numerical recommendation and assumptions.
2. Immutable public architecture source table.
3. Complete forward-pass equations and shape ledger.
4. Qwen3-specific operator differences and likely traps.
5. Scalar algorithms and floating-point policy.
6. Mixed-Q8 reference dequantization contract.
7. KV-cache model and exact memory formulas.
8. Sampling boundary and deterministic seed contract.
9. Proposed Rust reference-runtime architecture.
10. Operator vector and property-test matrix.
11. Layer-by-layer trace and first-divergence protocol.
12. Error taxonomy and objective acceptance thresholds.
13. Prioritized implementation and optimization sequence.
14. Unknowns requiring local artifact or runtime inspection.
15. Annotated primary-source bibliography with dates and immutable links.

Do not provide a generic transformer tutorial. Do not infer architecture from
the model name, quietly borrow Qwen2 assumptions, compare only final text,
declare approximate logits equivalent without a justified budget, repair a
wrong token, or recommend keeping an old runtime as a fallback.

## Prompt 3: Mixed-Q8 Quantization Accuracy, Determinism, And Kernel Contract

You are an independent principal quantization researcher, numerical analyst,
and portable-kernel architect. Produce an exceptionally detailed report that
selects and specifies a production-quality mixed-Q8 strategy for a compact
Qwen3 model intended for native CPU and browser-WASM inference. Target 10,000
to 18,000 words excluding the bibliography. The report must connect storage
design, deterministic conversion, kernel mathematics, numerical error, and
behavioral quality rather than treating quantization as a file-size switch.

You may browse peer-reviewed quantization papers, official model-family
documentation, public implementation repositories at immutable revisions,
GGML/llama.cpp format and kernel documentation, WebAssembly SIMD
specifications, Rust SIMD documentation, and current browser documentation.
Use primary sources wherever possible and clearly identify when a public
implementation is evidence of one design rather than an authority for
TinyRustLM. You have no private source, model bytes, calibration records,
converter, benchmark results, runtime, browser traces, or credentials.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch browser-local chat product.
- The first candidate is a pinned official Qwen3-0.6B source. Its proposed
  SLM2 model member uses mixed-Q8 weights and f32-oriented reference math.
- Native Rust and browser WebAssembly must consume the same SLM2 bytes and
  preserve one semantic contract.
- Small size and speed do not justify material quality loss. Untouched source,
  converted, native, and browser outputs must be compared on sealed cases.
- The product must not hide regressions through response repair, retries,
  cherry-picked seeds, best-of-N, or a higher-precision fallback.
- TurboQuant, TurboVec, low-bit KV caches, and related public techniques are
  research inputs only. No such technique should be claimed as implemented or
  beneficial without local proof.
- There is no compatibility requirement for an obsolete prelaunch format.

Research and resolve all of the following:

1. Compare realistic Q8 choices for transformer linear weights: symmetric
   versus asymmetric, per-tensor versus per-channel versus per-block, static
   versus activation-aware, integer-only versus dequantize-and-accumulate,
   signed range conventions, scale precision, block sizes, and zero-point
   storage. Quantify storage overhead with formulas.
2. Recommend which tensor classes should use Q8 and which should remain f16,
   bf16, or f32. Analyze embeddings, tied language head, attention projections,
   MLP projections, Q/K normalization weights, RMSNorm, biases if present, and
   outlier-sensitive tensors. Explain what evidence would justify exceptions.
3. Specify deterministic conversion. Cover source dtype normalization,
   rounding mode, tie handling, clipping, scale derivation, all-zero blocks,
   NaN/Inf rejection, subnormals, signed zero, iteration order, parallelism,
   endianness, canonical padding, and repeatability across CPU architectures.
4. Derive the dequantization and dot-product equations and exact integer
   bounds. Analyze i8 multiplication, i32 accumulation overflow, f32 scale
   application, grouping, tails, and order-dependent error. Provide scalar,
   AVX2-class, and WebAssembly SIMD pseudocode for the same contract.
5. Define a portable block layout with alignment and bounds guarantees. Show
   how one logical format supports scalar and vector kernels without native
   padding leaks or target-specific reinterpretation. Include hostile cases
   for truncated blocks, invalid scales, impossible tails, unaligned data, and
   integer overflow.
6. Design tensor-level quality measurements: absolute/relative reconstruction
   error, cosine similarity, maximum error, weighted error, output activation
   drift, layerwise signal-to-noise, logit drift, KL or Jensen-Shannon
   divergence, rank stability, and selected-token stability. Explain which
   measurements correlate poorly with actual conversational behavior.
7. Design behavioral regression experiments that compare the untouched source,
   an f32 or high-precision reference, mixed-Q8 SLM2 scalar native, optimized
   native, and browser WASM. Require identical prompts, tokenization, template,
   seed, sampling, and raw output preservation. Define noninferiority and
   hard-failure gates without inventing thresholds.
8. Evaluate whether calibration data is needed for Q8. If used, specify
   contamination controls, licensing, representativeness, sealed-evaluation
   separation, reproducibility, and deletion lineage. Explain how to avoid
   tuning directly against expected evaluation answers.
9. Analyze accumulation and activation precision choices for prefill and
   decode. Compare f32, f16, bf16, mixed accumulation, and WebAssembly support.
   Include RMSNorm and softmax stability and the effect of long contexts.
10. Examine TurboQuant/TurboVec and other public vector or quantization ideas
    for transferable principles. Separate public evidence, speculative
    adaptation, patent or license concerns, hardware assumptions, and tests
    required before adoption. Do not assume naming similarity implies
    compatibility.
11. Assess weight-only versus KV-cache quantization as separate decisions.
    Derive KV memory savings and likely error propagation across turns, define
    per-head/per-token scale possibilities, and recommend whether first release
    proof should defer cache compression until full-precision cache parity is
    established.
12. Provide stop rules. Specify converter, tensor, logit, behavioral, latency,
    and memory outcomes that should reject a quantization profile, trigger a
    new wholly identified experiment, or justify retaining a simpler design.

Required report structure:

1. Executive quantization decision and assumptions.
2. Primary-source method comparison with licenses and revisions.
3. Tensor-class precision policy.
4. Canonical mixed-Q8 byte and block contract.
5. Deterministic conversion algorithm.
6. Scalar/native-SIMD/WASM kernel equations and pseudocode.
7. Numerical error budget and tensor/logit metrics.
8. Behavioral noninferiority experiment.
9. Calibration and contamination controls.
10. KV-cache quantization decision analysis.
11. TurboQuant/TurboVec applicability matrix.
12. Malformed-input, overflow, and fault-injection tests.
13. Stop rules and prioritized implementation sequence.
14. Unknowns requiring local model and hardware evidence.
15. Annotated primary-source bibliography with direct links and dates.

Do not recommend one-bit or sub-byte weights merely for novelty. Do not treat
smaller bytes as quality, copy a foreign format without proving its semantics,
invent benchmark gains, select only attractive outputs, compensate for an
incorrect kernel with prompt changes, or keep a legacy precision path hidden
behind fallback logic.

## Prompt 4: Native CPU Runtime From Scalar Oracle To Audited SIMD Dispatch

You are an independent principal CPU-performance engineer, Rust systems
architect, and numerical-correctness reviewer. Produce an exceptionally
detailed design for taking a proven scalar Qwen3 inference path to fast native
CPU execution without creating a second semantic implementation. Target
10,000 to 18,000 words excluding the bibliography. Include kernel pseudocode,
cache and bandwidth models, scheduling decisions, feature-dispatch contracts,
and correctness gates.

You may browse Intel and AMD architecture manuals, Arm architecture and NEON
documentation, Rust standard-library and portable-SIMD documentation, LLVM
documentation, operating-system threading and memory-mapping documentation,
public inference engines at immutable revisions, and peer-reviewed performance
literature. You have no TinyRustLM code, SLM2 artifact, profiler trace,
benchmark output, hardware inventory, build environment, or private evidence.
Do not infer local performance or claim an optimization is already present.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local chat product with a native Rust
  companion/runtime and a browser WebAssembly path.
- One mixed-Q8 SLM2 Qwen3-0.6B composition is the first target.
- A simple scalar native implementation is intended to be the numerical
  reference. Optimized kernels must remain interchangeable under one operator
  contract and cannot alter tokenizer, template, sampling, prompt, or model
  semantics.
- Commodity `win-x64` and `linux-x64` are important; `linux-arm64` evidence
  must distinguish cross-compilation from real hardware execution.
- No fallback to obsolete format/runtime code, no hidden remote inference, no
  repair, and no best-of-N are permitted.
- Performance claims require measured local evidence and must state model,
  hardware, build, thread, prompt, context, and sampling identities.

Research and resolve all of the following:

1. Build an analytical roofline-style model for Qwen3 prefill and decode.
   Derive weight bytes read, activation bytes, KV-cache traffic, arithmetic
   operations, operational intensity, and expected memory-bound versus
   compute-bound regions from symbolic architecture variables. Do not invent
   machine measurements.
2. Specify a kernel interface shared by scalar and optimized paths. Cover
   tensor descriptor validation, Q8 block access, row and column orientation,
   strides, alignment, tails, output ownership, scratch requirements, checked
   dimensions, cancellation points, and numerical tolerance metadata.
3. Compare optimization strategies for Q8 matrix-vector and matrix-matrix
   work during decode and prefill. Address i8 dot products, widening,
   accumulation, scale fusion, tiling, packing, register pressure, horizontal
   reduction, tails, and when BLAS-style batching helps or harms small models.
4. Design runtime CPU feature detection and dispatch for scalar, SSE/AVX2/FMA,
   possible AVX-512/VNNI, and Arm NEON or dot-product features. Explain compile
   target baselines, illegal-instruction prevention, operating-system XSAVE
   checks, virtualized CPUs, deterministic override for testing, and how to
   prove every dispatch branch executes.
5. Analyze data layout and memory mapping. Compare direct file mapping,
   buffered reads, eager allocation, page prefaulting, large pages, read-only
   shared mappings, alignment, NUMA, and antivirus interaction. Preserve
   artifact immutability and define behavior if bytes change after validation.
6. Design prefill scheduling, decode scheduling, and thread-pool ownership.
   Compare row parallelism, head parallelism, layer pipelining, token-level
   serialization, work stealing, fixed partitions, affinity, oversubscription,
   and interaction with host applications. Define deterministic single-thread
   reference mode and bounded multi-thread mode.
7. Specify KV-cache layout for GQA and cache locality. Include token-major
   versus head-major tradeoffs, append arithmetic, capacity growth, context
   limits, reset, cancellation, and cache reuse across multi-turn prompts.
8. Cover allocation discipline: up-front arena sizing, checked formulas,
   scratch reuse, fragmentation, peak resident set, memory pressure, OOM,
   cancellation cleanup, and process restart. Give formulas for model mapping,
   activations, logits, scratch, KV cache, thread stacks, and overhead.
9. Define numerical equivalence tests for each optimized kernel against scalar
   reference across adversarial shapes and values. Include exact output where
   feasible, absolute/relative/ULP budgets where necessary, accumulation-order
   analysis, selected-token stability, and full raw trace comparison.
10. Design reproducible benchmarking. Cover warm versus cold start, page cache,
    prompt and output lengths, prefill/decode separation, percentiles, CPU
    frequency, thermal state, thread counts, affinity, background load,
    confidence intervals, and result provenance. Explain how to avoid
    benchmark-only special cases.
11. Define cancellation and fault behavior inside long kernels. Specify polling
    frequency, partial activation invalidation, KV commit points, thread joins,
    panics, poisoned state, and whether a conversation can continue safely
    after cancellation.
12. Propose an optimization admission ladder. No optimized path may ship until
    malformed inputs, scalar parity, deterministic vectors, real model traces,
    cancellation, memory bounds, and relevant real-hardware tests pass.

Required report structure:

1. Executive runtime architecture and assumptions.
2. Primary-source CPU and Rust capability table.
3. Symbolic prefill/decode cost and bandwidth model.
4. Unified scalar/SIMD kernel API.
5. Q8 kernel designs and data-layout alternatives.
6. Feature detection and dispatch state machine.
7. Threading, scheduling, and KV-cache design.
8. Mapping, allocation, and bounded-memory formulas.
9. Numerical conformance and adversarial test matrix.
10. Cancellation, panic, and recovery semantics.
11. Benchmark protocol and claim vocabulary.
12. Cross-platform evidence matrix.
13. Prioritized optimization sequence with stop rules.
14. Unknowns requiring private code or real hardware.
15. Annotated primary-source bibliography with dates and revisions.

Do not present cross-compilation as execution, benchmark a synthetic fixture
as if it were the real model, dispatch on CPUID alone without OS state, trade
away numerical correctness for speed, add a silent scalar fallback for
malformed optimized behavior, or retain an obsolete runtime as insurance.

## Prompt 5: Pinned Source-Framework Oracle And First-Divergence Forensics

You are an independent principal ML-validation engineer, reproducibility
researcher, and numerical-forensics specialist. Produce an exceptionally
detailed laboratory protocol for using a pinned public source framework as an
oracle for one converted Qwen3-0.6B model and locating the first material
divergence in a native or browser runtime. Target 10,000 to 18,000 words
excluding the bibliography. The result must be sufficiently precise that an
implementation team can construct interoperable trace producers and an
independent comparator without guessing what to capture.

You may inspect official Qwen repositories, the pinned public model files,
official Transformers and PyTorch code at immutable revisions, tokenizer and
generation documentation, numerical reproducibility guidance, Safetensors
documentation, and public test practices. You have no TinyRustLM code,
converted model, local source cache, source-framework environment, trace,
runtime output, prompt fixture, credential, or development machine. You must
not claim that any private parity test has run.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch local-chat product.
- The first candidate is a pinned official Qwen3-0.6B source converted into a
  six-member SLM2 composition with mixed-Q8 model weights.
- Tokenizer2 browser parity has separate evidence, but full model parity has
  not been established merely by structural conversion.
- Scalar native inference is intended as the internal reference, with
  optimized native and real-browser WASM compared afterward.
- Raw outputs must remain untouched. No response repair, retry selection,
  best-of-N, alternate prompt, or legacy runtime may manufacture parity.
- Evaluation prompts and expected answers are private; a useful public-research
  report must define generic procedures without requesting them.

Research and resolve all of the following:

1. Define the complete oracle environment identity: model repository and
   revision, every source file hash, tokenizer closure, chat-template bytes,
   Transformers commit or exact package artifact, PyTorch build, Python,
   Safetensors, tokenizers library, CPU/GPU backend, dtype, thread settings,
   deterministic flags, generation configuration, locale, and relevant
   environment variables.
2. Explain how to avoid a circular oracle. The source framework must consume
   publisher artifacts directly, while the target consumes converted SLM2;
   the comparator may share schemas but not target conversion code. Identify
   which public implementation details are normative and which are merely one
   numerically valid execution.
3. Specify a canonical input record for tokenizer-only, prompt-rendering,
   prefill, one-token decode, multi-token decode, and multi-turn cases. Bind raw
   UTF-8 input, messages and roles, template configuration, token IDs,
   positions, attention mask, seed, sampler, stop policy, context limit, and
   requested trace points by content identity.
4. Design trace capture points at embedding output, each normalization,
   projected Q/K/V, normalized Q/K if applicable, rotated Q/K, attention
   scores before mask, normalized attention probabilities, attention output,
   projected attention result, residuals, gated MLP intermediates, layer
   output, final norm, logits, probabilities, selected token, KV writes, and
   decoded bytes. Explain which points can be sampled or hashed after baseline
   debugging.
5. Define a cross-language trace format. Include schema, dtype, shape, logical
   axis names, byte order, stride, quantization metadata, token position,
   layer/operator identity, source hash, producer identity, canonical content
   hash, chunking, compression, size bounds, and redaction. Give a concrete
   example and strict unknown-field policy.
6. Establish comparison metrics and tolerances by operator. Cover exact token
   and integer comparison, absolute and relative error, ULP distance, cosine
   similarity, maximum and percentile error, distribution drift, logit rank,
   probability divergence, top-token margin, and accumulated error. Explain
   why one global epsilon is inadequate.
7. Design a first-divergence algorithm that aligns traces by semantic operator
   rather than file offset, validates all identities first, identifies the
   earliest failing tensor, and produces bounded diagnostics without leaking
   prompts or large activations into public reports. Include pseudocode and
   complexity bounds.
8. Separate expected mixed-Q8 divergence from implementation defects. Propose
   three target lanes: source precision, dequantized SLM2 scalar, and direct-Q8
   kernel. Explain how this triangulation can distinguish converter error,
   quantization error, operator error, layout error, and sampler error.
9. Address nondeterminism: parallel reductions, backend algorithms, floating
   modes, denormals, FMA contraction, random generators, top-k tie ordering,
   device kernels, and framework upgrades. Specify when CPU-only oracle runs
   are preferable even if slow.
10. Define a small public-safe synthetic vector suite and a private real-model
    suite. The synthetic suite may verify tooling but cannot prove model
    quality or full parity. Explain sealed prompt handling, output retention,
    hashes, and contamination boundaries.
11. Design failure triage and TDD. Preserve the raw mismatch; formulate the
    smallest general operator test; add positive, negative, and metamorphic
    cases; fix one cause; rerun only invalidated layers and then the whole
    chain; version every comparator change; never overwrite old decisions.
12. State promotion gates from structural artifact to scalar-native parity,
    optimized-native parity, browser-WASM parity, and behavioral evaluation.
    Each gate must name objective evidence and prohibited claims.

Required report structure:

1. Executive oracle recommendation and assumptions.
2. Immutable source-framework environment closure.
3. Non-circular authority and trust analysis.
4. Canonical case and execution record schemas.
5. Trace-point map for complete Qwen3 execution.
6. Cross-language trace wire format.
7. Per-operator metrics and tolerance methodology.
8. First-divergence algorithm and diagnostic schema.
9. Quantization/converter/runtime triangulation matrix.
10. Determinism controls and reproducibility limits.
11. Synthetic and sealed real-model test suites.
12. Failure-to-regression workflow and invalidation graph.
13. Promotion gates and prioritized implementation plan.
14. Unknowns requiring local execution.
15. Annotated primary-source bibliography with links, revisions, and dates.

Do not compare only final prose, let the judge rewrite an output, tune the
oracle after seeing a preferred result, hide a divergence behind tolerance
inflation, expose private prompts in public evidence, or call source-framework
agreement sufficient evidence of browser UX or conversational quality.

## Prompt 6: Real-Browser WASM Execution, Memory Ownership, And Cross-Browser Proof

You are an independent principal WebAssembly runtime engineer, browser
reliability architect, and performance-security researcher. Produce an
exceptionally detailed design for running one real mixed-Q8 Qwen3-0.6B
composition entirely in a browser worker with truthful memory, cancellation,
storage, and cross-browser behavior. Target 10,000 to 18,000 words excluding
the bibliography. Focus on production browser mechanics and testable failure
semantics, not a toy WASM demo.

You may browse the WebAssembly core and SIMD specifications, W3C and WHATWG
standards, MDN documentation, Chromium/Firefox/WebKit documentation and issue
trackers, Playwright documentation, Rust `wasm32-unknown-unknown` guidance,
COOP/COEP documentation, storage specifications, and public inference-engine
implementations at immutable revisions. You have no TinyRustLM source,
compiled WASM, model bytes, browser profile, Playwright trace, deployment
headers, test results, credentials, or access to private sites.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch browser-local chat product. Prompts
  and model bytes must not be uploaded to a project server.
- One six-member SLM2 Qwen3-0.6B composition is intended to execute in a
  dedicated worker. The browser must consume the same semantic model,
  tokenizer, template, sampling, and prompt-policy identities as native Rust.
- Tokenizer2 has separately passed a real-Chromium worker test, but that does
  not prove full-model execution.
- The first correctness lane should work without requiring hidden server
  inference. SIMD and threads are optimizations admitted only after scalar or
  single-thread parity.
- Browser success requires real generated tokens and untouched output. A
  scripted answer, tiny deterministic fixture, retry, repair, or native answer
  injected into the page is forbidden.
- There is no obligation to retain an obsolete browser format or worker.

Research and resolve all of the following:

1. Map current browser support for WebAssembly SIMD, threads, bulk memory,
   multi-memory, memory64, maximum linear-memory sizes, grow behavior, and
   SharedArrayBuffer prerequisites. Record versions and dates and distinguish
   specification availability from deployed browser behavior.
2. Build a symbolic peak-memory model for model storage, mapped or copied
   bytes, WASM linear memory, decompression or verification buffers,
   activations, logits, KV cache, worker JS objects, browser duplication,
   screenshots/traces, and safety headroom. Include 32-bit address-space and
   contiguous-allocation constraints.
3. Compare ingestion strategies: full ArrayBuffer, Blob slices, streams,
   transferable buffers, SharedArrayBuffer, OPFS sync access handle in a
   worker, IndexedDB blobs, File System Access handles, and loopback streaming.
   Identify copy points and whether zero-copy claims are actually valid.
4. Design worker ownership and lifecycle. Specify initialization, capability
   negotiation, composition validation, memory reservation, load, prefill,
   decode, token events, cancellation, error, terminal, disposal, and fresh
   worker recovery states. Define exactly one owner for mutable model and KV
   state.
5. Define the JS/WASM ABI for large bounded byte transport and inference.
   Cover allocation, lengths, 64-bit size representation, checked conversion
   to JS numbers, pointers, result handles, error codes, copy-out, release,
   backpressure, event sequence numbers, and ABI-version mismatch.
6. Analyze cancellation mechanisms: cooperative atomic flag, message-based
   checkpoints, worker termination, and process/page closure. Distinguish a
   clean cancellation from abrupt termination, define what evidence survives,
   and require a fresh worker before state reuse when integrity is uncertain.
7. Specify network-denial assertions. Capture requests, service-worker fetches,
   WebSockets, WebTransport, beacons, analytics, error reporting, source maps,
   font and asset loads, loopback traffic, and peer traffic. Prove that prompt
   text and model bytes do not reach project origins or unexpected third
   parties.
8. Design real-browser conformance against native scalar output. Bind the exact
   composition, token IDs, rendered prompt, sampler, seed, stop policy, and raw
   token stream. Compare Chromium, Firefox, and WebKit where technically
   possible and classify unsupported capability separately from semantic
   failure.
9. Cover long-running reliability: background throttling, tab suspension,
   mobile memory pressure, page navigation, browser crash, worker crash,
   service-worker replacement, stale assets, storage eviction, laptop sleep,
   and partial update. Define truthful UI status for each.
10. Design performance measurement for startup, member verification, load,
    time to first token, prefill tokens/second, decode tokens/second, peak
    memory, KV growth, cancellation latency, and stability. Give formulas and
    provenance fields, not invented values.
11. Define fresh-profile Playwright evidence. Include owned temporary roots,
    process closure, profile deletion, deletion proof, viewport/browser matrix,
    trace/screenshot redaction, console/page errors, worker process evidence,
    and safeguards against deleting outside the owned root.
12. Give an admission ladder from scalar single-thread worker to SIMD and then
    optional threads. Each stage requires exact capability declaration,
    numerical parity, resource bounds, cancellation, privacy, and real-browser
    evidence before it can replace the preceding implementation. Since the
    product is prelaunch, replacement should delete superseded executable code.

Required report structure:

1. Executive browser-runtime recommendation and assumptions.
2. Current standards/browser capability matrix with dates.
3. Peak-memory and copy-count model.
4. Artifact ingestion and storage alternatives.
5. Worker state machine and ownership rules.
6. JS/WASM ABI and error contract.
7. Cancellation, termination, and recovery semantics.
8. Network/privacy assertion design.
9. Native-to-browser numerical conformance protocol.
10. Cross-browser and fresh-profile test matrix.
11. Reliability and fault-injection matrix.
12. Performance evidence and claim vocabulary.
13. Prioritized implementation and clean-replacement plan.
14. Unknowns requiring private browser execution.
15. Annotated primary-source bibliography with links and dates.

Do not assume desktop Chromium represents all browsers, describe a page reload
as deletion, count a tiny fixture as a real model, hide inference behind a
server, invent zero-copy behavior, repair or retry wrong tokens, or retain an
obsolete worker as a compatibility fallback.

## Prompt 7: P2P-First Acquisition Or Automatic Local Conversion Without Instruction Downloads

You are an independent principal distributed-systems architect, browser
storage engineer, and human-centered acquisition-flow designer. Produce an
exceptionally detailed end-to-end design in which a user chooses a public
model and the product either acquires a verified ready composition directly
from consenting peers or automatically performs a local conversion through an
authorized companion. Target 10,000 to 18,000 words excluding the bibliography.
The user must receive a working model or a truthful typed failure, never a text
file, shell script, PowerShell script, conversion-request JSON download, or
instructions masquerading as product functionality.

You may inspect public browser APIs and standards, P2P content-distribution
protocols, WebRTC/WebTransport/HTTP documentation, local-companion patterns,
content-addressed storage systems, MiniModel.org and TinyRustLM.com public
pages if reachable, Hugging Face public APIs and model repositories, Rust and
.NET documentation, and security guidance. You have no private source,
catalog database, peer network, companion binary, model artifact, credentials,
router access, logs, or production contract. Do not invent endpoints, peer
counts, catalog availability, or successful public reachability.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch browser-local chat product.
- MiniModel.org is intended to provide public catalog and discovery metadata,
  while model bytes flow directly between consenting peers and are not proxied
  by project websites.
- A local Rust/.NET companion is intended to host conversion and P2P
  operations; the browser remains the chat UI.
- A model selection currently must become a real action: prefer a qualified
  composition from peers; otherwise obtain the exact reviewed public source
  with explicit consent and convert locally into the sole SLM2 composition.
- Prompts and model bytes must not be uploaded to TinyRustLM.com,
  MiniModel.org, or an analytics service.
- Model admission requires exact artifact identity, provenance/license review,
  structural verification, and current quality evidence. A small smoke fixture
  or duplicate bytes under a new label cannot satisfy a real-model claim.
- No legacy download workflow, compatibility route, silent fallback, or manual
  instruction-file handoff is allowed.

Research and resolve all of the following:

1. Define the user-facing acquisition state machine from catalog selection to
   usable local composition. Include capability discovery, consent, ready-peer
   lookup, source review, disk estimate, P2P transfer, source acquisition,
   conversion, verification, atomic promotion, load, cancellation, resume,
   failure, and removal. Every state needs truthful text and allowed actions.
2. Specify content identities for source revision, source-file closure,
   composition, each member, piece set, peer offer, conversion profile,
   runtime requirement, quality receipt, and local store entry. Explain which
   identities must agree before bytes from multiple peers can be mixed.
3. Design peer discovery without turning the catalog into a byte proxy. Cover
   signed expiring offers, endpoint privacy, lane identity, observer proof,
   replay, stale offers, revocation, NAT status, browser limitations, and
   failure when no reachable qualified peer exists.
4. Specify resumable piece transfer. Cover fixed or content-defined pieces,
   per-piece hashes, range requests, parallel peers, source agreement, durable
   journals, corruption quarantine, partial-file placement, backpressure,
   timeouts, peer loss, retry budgets as declared product behavior, and final
   whole-member verification. Distinguish transport retry from answer
   best-of-N or model-output retry.
5. Define the local-conversion branch. Explain how the browser advertises an
   exact job to the companion, how the companion acquires immutable public
   source only after explicit consent, how size/license/revision information is
   shown, how conversion is custodied, and how the verified result enters the
   same local store as P2P bytes.
6. Analyze browser and companion storage choices. Compare OPFS, IndexedDB,
   File System Access, companion-owned content store, hard links or reflinks,
   read-only mappings, quotas, eviction, duplicate-byte deduplication, and
   crash-safe atomic promotion. The browser must not pretend durable storage
   exists when it can be evicted.
7. Design a typed browser-companion protocol with versioned capability
   advertisement, origin binding, nonce or session proof, exact routes,
   bounded messages, event sequence, idempotency, cancellation, resume token,
   job receipt, safe error codes, and unknown-field rejection. Do not rely on
   undocumented localhost endpoints.
8. Threat-model malicious catalog metadata, hostile peers, path traversal,
   symlinks/reparse points, decompression bombs, oversized headers, source
   drift, license substitution, local malware, DNS rebinding, CSRF, browser
   extensions, credential-bearing URLs, and prompt exfiltration.
9. Define progress math that cannot lie. Report verified bytes versus total,
   source acquisition, conversion tensors or bytes, hash verification,
   promotion, load, ETA uncertainty, disk remaining, and cancellation state.
   Explain how to avoid progress reaching 100 percent before verification.
10. Specify offline, no-peer, insufficient-disk, unsupported-architecture,
    companion-absent, companion-version-mismatch, source-license-ambiguous,
    source-drift, corrupt-piece, browser-eviction, and conversion-failure
    outcomes. State what useful work may continue behind each blocker.
11. Design acceptance tests with a controlled local peer, a real outside peer,
    no peer, deliberate corruption, interrupted transfer, restart, and real
    conversion. CI fixtures may test protocol mechanics but cannot claim live
    availability or real-model quality.
12. Recommend the simplest first production slice and later scalability path.
    Avoid speculative features that create debt. Because the product is
    prelaunch, replace and delete any instruction-download implementation in
    the same green cutover.

Required report structure:

1. Executive acquisition recommendation and assumptions.
2. Public capability and unknown-fact observation log.
3. User and system state machines.
4. Identity, offer, piece, and local-store schemas.
5. P2P discovery and transfer protocol.
6. Automatic local-conversion branch.
7. Browser-companion API contract.
8. Storage, deduplication, durability, and quota design.
9. Privacy and security threat model.
10. Progress, cancellation, resume, and typed-error contract.
11. Fault-injection and acceptance evidence matrix.
12. CI versus authorized-live proof boundaries.
13. Prioritized clean-slate implementation sequence.
14. Unknowns requiring private or production access.
15. Annotated primary-source bibliography with dates and revisions.

Do not recommend downloading instruction files, scripts, or JSON for the user
to run manually. Do not call catalog metadata a model, local loopback public
P2P proof, package creation publication, or a fixture a quality-qualified real
artifact. Do not silently upload model bytes, invent service contracts, or
retain the broken workflow as a fallback.

## Prompt 8: Secure Loopback Companion Contract For Conversion, Storage, And Serving

You are an independent principal application-security engineer, local-service
protocol architect, and Rust/.NET process-lifecycle specialist. Produce an
exceptionally detailed security and reliability design for the loopback
companion that connects a public browser UI to local model conversion,
content-addressed storage, native inference support, and direct P2P serving.
Target 10,000 to 18,000 words excluding the bibliography. Treat localhost as a
hostile multi-tenant boundary, not as automatically trusted.

You may browse browser networking and Fetch/CORS standards, DNS-rebinding and
CSRF guidance, WebSocket and HTTP specifications, Rust and ASP.NET Core or .NET
hosting documentation, Windows and systemd service documentation, process and
filesystem security documentation, and public local-companion designs at
immutable revisions. You have no TinyRustLM source, companion executable,
certificate, port assignment, service definition, request trace, model store,
credentials, or network configuration. Do not invent a private API or imply a
local audit occurred.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local chat product. The browser is the
  interaction surface; a downloadable Rust/.NET companion performs privileged
  local operations that browsers cannot safely perform alone.
- Expected operations include capability advertisement, public-source
  acquisition after consent, deterministic SLM2 conversion, composition
  verification, local-store inventory, direct piece serving, transfer status,
  cancellation, and possibly native execution support.
- Model bytes and prompts must remain local or direct P2P. Project websites
  must not receive them.
- The first release must not silently modify router, firewall, startup-service,
  or credential persistence state.
- No undocumented endpoint guessing, permissive catch-all route, legacy API,
  compatibility alias, automatic downgrade, or fake success is permitted.
- MemoryEndpoints is outside this assignment and no credential should be
  requested or returned.

Research and resolve all of the following:

1. Define a versioned capability document that the browser retrieves before
   any privileged call. Include protocol identity, build identity, origin
   allowlist, route inventory, maximum sizes, supported SLM2/runtime features,
   storage capabilities, P2P states, consent requirements, session-binding
   mechanism, deprecation policy for a prelaunch clean slate, and strict
   unknown-field behavior.
2. Compare loopback transport options: HTTP/1.1, HTTP/2, HTTPS with local
   certificate, WebSocket, named pipe bridged by an extension, and custom URI
   schemes. Analyze browser support, deployment friction, authentication,
   streaming, backpressure, origin policy, and attack surface. Recommend one
   minimal production contract.
3. Design browser-to-companion session establishment resistant to DNS
   rebinding, cross-site requests, malicious local pages, stale tabs, replay,
   and confused deputy attacks. Cover bind address, random port versus fixed
   port, origin verification, CORS preflight, CSRF tokens, nonces, proof of
   user gesture, session lifetime, and token storage.
4. Specify exact method and route allowlists. Include capability read,
   conversion job create/status/events/cancel, transfer job operations, store
   inventory, member read with ranges if needed, and health status. State which
   methods, headers, content types, ranges, redirects, paths, upgrades, and
   bodies are forbidden.
5. Define create-only job identity and idempotency. Distinguish same-request
   recovery after a lost response from a new operation, prohibit multiple
   conversions under one identity, and specify terminal records for preflight
   rejection, spawn failure, timeout, nonzero exit, output overflow,
   verification rejection, cancellation, and pass.
6. Design bounded event streaming. Include sequence numbers, reconnect cursor,
   maximum event size/count, stdout/stderr redaction, progress facts, terminal
   finality, backpressure, slow clients, disconnect, and proof that a reconnect
   does not start a second process.
7. Define filesystem authority. The browser supplies logical artifact or job
   identities, never arbitrary paths. Cover canonical roots, direct-child
   policy, exclusive creation, symlink/reparse rejection, traversal, UNC and
   device paths, alternate data streams, case folding, long paths, disk full,
   file locks, and streamed hashing.
8. Design process custody for Rust and managed tools. Bind exact executable
   bytes, arguments, environment allowlist, working directory, input closure,
   target root, resource limits, child tree, raw bounded streams, exit status,
   optional diagnostics, timeout termination, crash, and immutable terminal
   receipt. Optional process metadata must never erase an already observed exit
   code.
9. Specify store and serving least privilege. Conversion staging cannot be
   served; only verified read-only members are eligible. P2P lanes cannot read
   arbitrary files, list private paths, mutate artifacts, or accept upload.
   Include connection, range, bandwidth, and concurrency limits.
10. Threat-model malicious source artifacts, hostile peers, local unprivileged
    users, browser extensions, compromised websites, request smuggling, cache
    poisoning, port squatting, process injection, DLL search order, logs,
    crash dumps, and software-update compromise.
11. Define installation, update, and removal without legacy debt. Cover signed
    packages, hashes, SBOM, service registration only with explicit consent,
    update atomicity, protocol/build match, rollback before public launch,
    uninstallation, artifact retention choice, and no dual protocol versions.
12. Provide a TDD and live-test matrix. Include hostile origins, ten-way races,
    browser restart, companion restart, lost response, locked root, process
    tree timeout, malformed messages, oversized streams, stale capability,
    deliberate lane death, and privacy network capture.

Required report structure:

1. Executive companion recommendation and assumptions.
2. Public standards and implementation observation table.
3. Capability-document schema.
4. Transport decision and origin/session security.
5. Strict route and message contracts.
6. Job idempotency and state machines.
7. Event-stream, cancellation, and reconnect protocol.
8. Filesystem and process-custody boundaries.
9. Verified store and direct-serving architecture.
10. Threat model and abuse-case matrix.
11. Installation, update, and clean replacement controls.
12. Test, fault-injection, and evidence matrix.
13. Prioritized implementation sequence with stop rules.
14. Unknowns requiring local or authorized deployment evidence.
15. Annotated primary-source bibliography with direct links and dates.

Do not treat loopback as trusted, accept arbitrary filesystem paths, use `*`
CORS with privileged methods, expose raw build logs to public reports, guess
routes, retry a material job behind the user's back, silently alter firewall or
router state, or retain a superseded protocol for hypothetical compatibility.

## Prompt 9: Publisher-Exact Multi-Turn Chat Semantics And Exactly-Once Rendering

You are an independent principal conversational-runtime architect, Qwen3
integration researcher, and browser event-systems engineer. Produce an
exceptionally detailed specification for turning one verified local Qwen3
composition into a genuine multi-turn browser conversation with publisher-
correct prompt semantics and exactly one visible assistant response per turn.
Target 10,000 to 18,000 words excluding the bibliography. Address model-facing
semantics and UI event consistency as one end-to-end contract.

You may inspect official Qwen model cards and chat-template sources at
immutable revisions, official Transformers tokenizer/generation code,
Jinja/chat-template documentation, current browser worker and stream APIs,
accessibility standards, Playwright documentation, and public local-chat
implementations. You have no TinyRustLM source, private Template2/Sampling2/
Prompt2 artifacts, model bytes, UI, browser trace, prompt fixtures, test
outputs, credentials, or hosted memory. Do not claim private behavior has been
observed.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch browser-local AI chat product.
- One complete SLM2 composition binds model weights, Tokenizer2, Template2,
  Sampling2, Prompt2, and a composition manifest. No behavior-changing runtime
  default may sit outside those identities.
- Prompts and model bytes stay local. MemoryEndpoints is unauthorized for the
  current first-model slice, so retrieved memory must be represented only by
  local test data and treated as untrusted content.
- Important behaviors include ordinary conversation, ambiguity handling,
  practical constraints, conflicting sources, latest-user-preference
  precedence, multi-turn references, untrusted quoted instructions,
  summarization, rewriting, JSON, extraction, code explanation, and direct
  lawful adult assistance within narrow harm boundaries.
- Raw generated tokens and text must be preserved. No hidden retry, answer
  completion, response repair, expected-term injection, best-of-N, or
  alternate legacy model may improve a visible answer.
- Introductory prompt cards should disappear after conversation starts; the
  center becomes the conversation workspace; each assistant answer renders
  once; cancellation and failures are explicit.

Research and resolve all of the following:

1. Pin the exact official Qwen3 chat-template and special-token semantics.
   Determine system/user/assistant role rendering, generation prompt,
   beginning/end markers, thinking and no-thinking controls, tool-related
   constructs if present, newline/whitespace significance, and behavior when a
   system message is absent. Distinguish publisher facts from recommendations.
2. Specify a canonical message model and Template2 rendering algorithm.
   Include role enum, UTF-8 text, optional trusted metadata kept out of model
   text, message ordering, empty messages, embedded special-token text, quoted
   instructions, Unicode normalization policy, size limits, and strict unknown
   fields. Give canonical examples without using private evaluation prompts.
3. Define Prompt2 authority precedence. Current user instructions must outrank
   stale profile or memory content; quoted/retrieved text is data; system-level
   product constraints have explicit scope; source conflicts must remain
   visible. Provide a precedence lattice and conflict-resolution pseudocode
   that does not rely on keyword stripping.
4. Specify context construction and truncation for a bounded compact model.
   Cover token-budget accounting, generation reserve, indivisible message
   units, system preservation, recent-turn priority, summary insertion,
   untrusted-memory boundaries, overlong single messages, deterministic
   truncation, and UI disclosure. Never silently claim complete continuity
   after dropping context.
5. Define Sampling2 completely: greedy versus stochastic mode, temperature,
   top-k, top-p, repetition penalty semantics, seed algorithm, logits masking,
   EOS and stop tokens, maximum new tokens, thinking-token treatment, tie
   order, cancellation checks, and terminal reason. Explain model-family
   defaults versus product choices.
6. Design the generation event protocol from worker to state store to DOM.
   Include request ID, conversation ID, turn ID, monotonically increasing
   sequence, token ID, raw token bytes or decoded delta, cumulative byte count,
   provisional/committed state, finish reason, error, cancellation, and
   terminal finality. Define deduplication and gap detection without dropping
   legitimate repeated text.
7. Prove exactly-once rendering. Analyze React-style rerenders, worker message
   replay, reconnect, Strict Mode, duplicate completion callbacks, stale turn
   promises, cancellation races, model switching, browser back/forward cache,
   and persistence rehydration. Give reducer invariants and property tests.
8. Preserve raw model output while presenting it safely. Distinguish raw token
   record, decoded raw text, and escaped rendered DOM. Cover invalid UTF-8
   boundaries across tokens, Markdown, code blocks, JSON, HTML injection,
   links, bidi controls, very long unbroken text, and copy behavior. Sanitizing
   DOM must not rewrite evidence.
9. Specify UI states and accessibility: no model, acquiring, converting,
   verifying, ready, generating, cancelling, cancelled, failed, context
   truncated, and complete. Include keyboard behavior, focus, screen-reader
   announcements, reduced motion, mobile composer, scroll anchoring, long model
   names, and honest progress.
10. Design multi-turn semantic tests with metamorphic variants. Cover changed
    names, units, dates, source order, explicit/implicit negation, stale versus
    current preference, unavailable resources, malicious quoted instructions,
    summaries, rewrites, JSON schema, code explanation, and lawful adult
    comparisons. State invariants without embedding expected prose.
11. Define cancellation and restart. A cancelled generation cannot later append
    tokens; uncertain worker state is discarded; a fresh worker may reload the
    model; a browser refresh is not a clean profile deletion; locally persisted
    conversation state must be clearly distinguished from hosted memory.
12. Provide a real-browser acceptance protocol using a real composition and
    untouched outputs. Capture message/event counts, rendering path, network,
    console errors, worker lifecycle, screenshots after secret scanning,
    storage, cancellation, restart, and profile deletion. A fixture may test
    UI mechanics but cannot prove model conversation.

Required report structure:

1. Executive chat-stack recommendation and assumptions.
2. Immutable publisher-template observation table.
3. Canonical message and Template2 contract.
4. Prompt2 authority and untrusted-content model.
5. Context budgeting and truncation algorithm.
6. Complete Sampling2 contract.
7. Generation event schema and exactly-once reducer.
8. Raw-evidence versus safe-rendering boundary.
9. UI, responsive, and accessibility state specification.
10. Multi-turn semantic and metamorphic test matrix.
11. Cancellation, restart, and persistence semantics.
12. Real-browser evidence protocol and prohibited claims.
13. Prioritized implementation sequence and acceptance gates.
14. Unknowns requiring private UI/model execution.
15. Annotated primary-source bibliography with dates and revisions.

Do not normalize a wrong response into a pass, deduplicate by visible text,
hide repeated model tokens as if they were duplicate UI events, rely on an
unversioned framework default, call a page refresh a clean restart, simulate
assistant output, or retain a superseded chat path as fallback.

## Prompt 10: No-Cheat First-Model Qualification And Quantization Noninferiority

You are an independent principal evaluation-science lead, psychometrician,
and model-claim integrity researcher. Produce an exceptionally detailed
qualification protocol for deciding whether one compact converted Qwen3 model
is genuinely useful for browser-local conversation and has not been materially
degraded by conversion or quantization. Target 10,000 to 18,000 words excluding
the bibliography. The protocol must minimize both false promotion and false
rejection while making cheating, contamination, and claim inflation visible.

You may browse peer-reviewed evaluation, contamination, preference-modeling,
and statistical literature; official model cards; benchmark documentation;
standards for human-subject data where relevant; and public evaluation tools
at immutable revisions. You have no TinyRustLM evaluator, prompts, expected
answers, raw model outputs, training data, model bytes, runtime, judge model,
human raters, receipts, or private reports. Do not request unpublished cases or
claim any model passed.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch browser-local chat product.
- The candidate chain is public source model, converted mixed-Q8 SLM2 scalar
  native, optimized native, and real-browser WASM using identical tokenizer,
  template, sampling, prompt policy, and seeds.
- Structural validity and one attractive response are not quality evidence.
- Important dimensions are ordinary conversational coherence, common-sense
  judgment, ambiguity handling, practical constraints and fallbacks,
  instruction following, source conflict, latest-turn precedence, multi-turn
  continuity, untrusted memory, summaries, rewrites, JSON, extraction, code,
  and substantive lawful adult help with narrow explicit boundaries.
- Arithmetic is secondary and may be delegated to a deterministic calculator.
- Raw output must be preserved. Response repair, retries selected for quality,
  answer completion, expected-term injection, hand-edited transcripts,
  evaluator weakening, holdout training, and undeclared best-of-N are forbidden.
- Promotion of one model does not increment any larger 20-model or browser
  campaign counters without separate live evidence.

Research and resolve all of the following:

1. Define a claim taxonomy from source-identified, structurally converted,
   numerically conformant, conversation-screened, task-specific-qualified,
   browser-proven, and production-eligible. State minimum evidence and
   prohibited public wording for each.
2. Design a layered evaluator. Assign deterministic format/completion checks,
   scenario-specific semantic invariants, independent model judges, and human
   review explicit roles. Explain authority, disagreement, escalation, and why
   a judge may score but never rewrite candidate output.
3. Define a balanced case taxonomy and target proportions without exposing
   actual holdouts. Include positive helpful behavior substantially more often
   than refusals, ordinary low-drama chat, ambiguity, resource constraints,
   source authority, current-turn precedence, untrusted quoted content,
   multi-turn state, summaries, rewrites, structured outputs, factual answers,
   code, adult lawful inquiry, and narrow concrete harm boundaries.
4. Express general semantic invariants. Examples include requesting missing
   choice criteria, acknowledging conflicting authoritative dates, obeying a
   current preference over stale memory, respecting unavailable resources and
   offering feasible alternatives, treating retrieved instructions as data,
   and presenting material considerations without moralizing. Avoid fixture-
   specific nouns or literal expected phrases.
5. Design deterministic seeded metamorphic generation. Vary entities, dates,
   percentages, units, products, source order, sentence order, discourse style,
   negation, distractors, resource availability, memory trust, and turn-level
   preference changes. Bind generator version, seed commitment, template
   family, exclusion set, and materialized case hash before model execution.
6. Specify contamination controls across training, prompt development, public
   benchmarks, evaluator fixtures, and reports. Include exact normalization,
   character/token n-grams, semantic neighbors, template-family detection,
   entity-substituted overlap, expected-answer-term overlap, sealed holdouts,
   access logs, deletion lineage, and independent audit.
7. Design source-versus-SLM2 noninferiority experiments. Use paired cases with
   identical semantic inputs and declared per-system execution profiles.
   Explain exact-token cases, semantic ratings, quantization-specific regressions,
   ordinary-helpfulness budgets, bootstrap or hierarchical intervals,
   clustered case families, multiple comparisons, and practical significance.
8. Treat stochasticity honestly. Define preregistered seed policy, repeats,
   pass probability, binomial or beta-binomial intervals, correlated failures,
   infrastructure flakes, and the distinction between a declared retrying
   product and invalid post-hoc best-of-N selection.
9. Analyze deterministic semantic detectors and their limits. Cover negation,
   questions, dates, units, resource availability, authority references,
   conditional recommendations, completion, repetition, JSON parsing, and
   untrusted instruction copying. Require positive and counterexample tests
   before a detector can reject a model.
10. Define human review with blinded pairwise comparison, randomized order,
    trained rubrics, adjudication, inter-rater agreement, rater uncertainty,
    sensitive lawful content, over-refusal, fabricated certainty, and privacy.
    Keep prompts and raw private output out of public reports.
11. Design an independent red-team suite excluded from development. Include
    prompt injection through quoted or memory text, over-refusal, unsafe
    impossible advice, stale-authority certainty, manipulative framing,
    structured-output edge cases, long context, and cancellation/restart.
12. Specify failure-driven TDD and immutable evidence. Preserve raw failure;
    derive a general regression; version evaluator changes; rerun only
    invalidated evaluation phases; archive old decisions; never overwrite a
    rejection; and prohibit training on sealed failures.

Required report structure:

1. Executive qualification recommendation and assumptions.
2. Claim taxonomy and prohibited wording.
3. Case taxonomy and coverage targets.
4. Layered evaluator architecture and authority rules.
5. Semantic invariant specification table.
6. Metamorphic generator and seed-commitment design.
7. Contamination threat model and audit controls.
8. Source/converted/native/browser noninferiority statistics.
9. Stochastic repeat and multiple-comparison policy.
10. Deterministic detector limits and test design.
11. Human review and independent red-team protocol.
12. Cryptographic evidence and evaluator-versioning graph.
13. TDD implementation sequence and promotion gates.
14. Unknowns requiring private cases and outputs.
15. Annotated primary-source bibliography with links and dates.

Do not use an opaque LLM judge as sole authority, reward keywords, reveal or
train on sealed cases, select an easy seed after seeing output, modify a case to
favor a candidate, repair malformed output, lower thresholds to obtain a pass,
or call structural conversion full-assistant quality.

## Prompt 11: Clean-Slate Deletion Of Every Superseded Model Execution Path

You are an independent principal software-architecture auditor, build-graph
analyst, and prelaunch clean-cut specialist. Produce an exceptionally detailed
method for replacing a superseded model format and acquisition/runtime stack
with one production SLM2 path while deleting the entire obsolete executable
closure in the same green cutover. Target 10,000 to 18,000 words excluding the
bibliography. The report must define how an implementation team proves absence,
not merely how it adds a new feature.

You may browse Rust/Cargo, npm, .NET/MSBuild, WebAssembly, bundler, static-site,
dependency-analysis, code-search, software-composition-analysis, and release-
engineering documentation. You may inspect public examples of clean-slate
prelaunch cutovers. You have no TinyRustLM source, dependency graph, build
output, package, site assets, test results, or source-control history. Do not
invent filenames, counts, or claim that any private legacy path was found or
removed.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch product. Product V1 and product V2 do
  not exist. SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema
  revisions, attempt numbers, branch names, and semantic versions are technical
  identifiers only.
- The product has no public-user compatibility obligation. No legacy support,
  migration, alias, dual reader/writer, fallback, shim, bridge, selector,
  temporary adapter, deferred cleanup, or known debt is allowed.
- Historical receipts and raw failures may remain as inert evidence but can
  never be executable inputs.
- Project maintainers believe obsolete SLM1/ACG1-era browser, dogfood,
  acquisition, packer, documentation, test, and release references may still
  exist. This is an unverified local fact and a hard release concern.
- Merely excluding old Rust code from a Cargo build is not cleanup if callers,
  scripts, tests, packages, generated assets, docs, marketing, configuration,
  or deployment outputs still contain the superseded path.
- A correct cutover must first prove the sole SLM2 vertical slice and then
  repoint maintained callers and delete the full superseded closure in one
  coherent tested change.

Research and resolve all of the following:

1. Define an executable-closure model spanning source modules, Cargo crates
   and features, npm scripts, JS/TS imports, WASM exports, C ABI, .NET wrappers,
   CLI commands, routes, HTML assets, service workers, tests, fixtures,
   examples, docs, marketing claims, package manifests, CI, deployment files,
   and generated outputs. Give a graph schema and traversal algorithm.
2. Distinguish maintained executable code, build-time code, test-only code,
   generated code, inert historical evidence, current documentation, archived
   documentation, and forbidden ambiguous material. Specify admission rules
   for each class after the cutover.
3. Design a pre-cutover inventory using `rg`, compiler/build graphs, package
   metadata, linker/export inspection, route enumeration, static bundle
   scanning, archive inspection, dependency/SBOM tools, and runtime telemetry
   generated by tests. Explain false negatives from generated names, dynamic
   loading, reflection, feature flags, and minification.
4. Define the sole target ownership map. Assign exactly one component each for
   format parsing, conversion, composition verification, artifact storage,
   native inference, WASM inference, acquisition, browser admission, chat
   state, evidence, packaging, and publication. Flag duplicate authorities.
5. Specify cutover prerequisites. The real SLM2 model must pass structure,
   scalar-native parity, optimized/native if shipped, browser-WASM parity,
   acquisition, real multi-turn chat, privacy, cancellation, restart, and
   quality gates before old executable paths are deleted.
6. Design the atomic source-control change. Repoint every maintained caller,
   remove obsolete files and features, regenerate authoritative outputs,
   update tests and docs, rebuild packages/sites, and fail if deleted paths are
   still referenced. Explain why a staged dual-path merge is unacceptable in
   this prelaunch context.
7. Define negative architecture tests. Scan identifiers, suffixes, MIME types,
   route names, CLI verbs, feature flags, dependency names, package contents,
   exports, docs, and built web assets. Use explicit technical allowlists for
   inert historical receipts so history cannot become executable.
8. Cover source-control and filesystem complications: case-only renames,
   ignored generated files, stale build directories, worktrees, untracked
   artifacts, submodules, symlinks/reparse points, line endings, release
   archives, caches, and deployed static assets. Distinguish clean repository
   state from clean production readback.
9. Design tests that prove there is no fallback. Force malformed SLM2, missing
   companion, unavailable peer, unsupported browser, corrupt artifact, and
   conversion failure, then require typed failure rather than silently invoking
   an old path. Include mutation testing of selectors and error branches.
10. Define evidence invalidation. Deleting or changing executable producers
    invalidates dependent build, browser, package, deployment, and public-claim
    receipts, but should not force reacquisition of unchanged immutable source
    bytes. Provide a dependency graph and selective rerun algorithm.
11. Specify documentation and marketing cleanup. Current docs must describe
    one product and one path; technical schema labels need precise definitions;
    archived evidence must be visibly historical; version/date/publication
    logs must reflect the actual deployed revision; no stale screenshots or
    download instructions may survive.
12. Give an objective final absence certificate. It should bind source commit,
    tree, scanners, build graph, package inventories, web inventories, test
    results, deployment identities, HTTPS readback, allowed historical matches,
    and remaining risks without claiming mathematical proof beyond the tools'
    scope.

Required report structure:

1. Executive clean-cut recommendation and assumptions.
2. Cross-ecosystem executable-closure graph schema.
3. Material classification and historical-evidence policy.
4. Pre-cutover inventory tools and blind spots.
5. Sole target ownership matrix.
6. Vertical-slice prerequisites.
7. Atomic repoint-and-delete sequence.
8. Negative architecture and no-fallback tests.
9. Package, bundle, archive, and deployment scanning.
10. Evidence invalidation and selective rerun graph.
11. Documentation/marketing/publication synchronization.
12. Final absence certificate schema and limitations.
13. Prioritized TDD implementation plan with stop rules.
14. Unknowns requiring local source and deployment inspection.
15. Annotated primary-source bibliography with links and dates.

Do not propose a product V2, migration period, compatibility facade, hidden
fallback, dual build, deprecated-but-executable route, temporary debt, or
cleanup ticket. Do not claim success from a Cargo exclusion, source search
alone, or local tests without package, built-asset, deployment, and public
readback evidence.

## Prompt 12: Enterprise Release, Supply-Chain, Documentation, And Public Readback Truth

You are an independent principal release engineer, software-supply-chain
architect, documentation-systems lead, and public-claim auditor. Produce an
exceptionally detailed release-control design for the first production-quality
TinyRustLM model vertical slice and every affected site, package, companion,
and documentation surface. Target 10,000 to 18,000 words excluding the
bibliography. The design must keep source control, generated artifacts,
deployment, public HTTPS bytes, visible version/date, release notes,
publication logs, documentation, and marketing claims synchronized.

You may browse SLSA, in-toto, Sigstore, SPDX, CycloneDX, GitHub, NuGet, npm,
Rust/Cargo, SourceLink, portable PDB, SBOM, static-site deployment, Cloudflare
or comparable hosting documentation, HTTP security standards, reproducible-
build literature, and documentation-versioning best practices. You may inspect
public TinyRustLM-related sites if reachable. You have no private repository,
source code, CI, deployment account, signing key, package feed access, model
artifact, release receipt, DNS configuration, or credential. Do not invent
deployment success or request secrets.

Project-supplied context, not independently verified:

- TinyRustLM is one unversioned prelaunch product. There is no product V1/V2
  split and no live-user legacy obligation. Technical schemas and package
  versions remain precise technical identities.
- The release target is one provenance-bound, quality-qualified SLM2 Qwen3
  composition that passes native and real-browser execution, P2P-or-local-
  convert acquisition, genuine multi-turn local chat, privacy, cancellation,
  restart, and clean-slate obsolete-path deletion.
- Source must be committed and pushed after each coherent green major change.
  Affected sites should deploy whenever their complete gate passes, not wait
  for unrelated campaign completion.
- Every published site should visibly expose a last-published version and
  release date and maintain a consistent append-only update/publication log.
- Documentation and marketing sites are product surfaces, not optional notes.
  They must remain robust, current, technically rigorous, and aligned with
  actual deployed behavior.
- Model bytes and private evidence stay outside Git. Public records contain
  bounded identities and claims only. Campaign counters remain zero unless
  their own live evidence exists.
- Package creation is not publication, a local deployment command is not
  public readback, and unit tests alone never mean done.

Research and resolve all of the following:

1. Define a release evidence graph from immutable source revision and tree
   through dependency locks, build inputs, generated artifacts, tests,
   provenance, signatures, package inventories, deployment manifest, site
   publication plan, public readback, and approved claims. Give content-
   addressed schemas and invalidation rules.
2. Specify source-control checkpoints. Cover clean worktree, exact staged path
   review, test evidence, commit signing if used, push, fresh fetch, local/
   tracking/FETCH_HEAD/direct-remote equality, branch protection, and what to
   do when deployment credentials are unavailable. Source custody must not
   depend on deployability.
3. Design reproducible and hermetic builds for Rust native, WASM, C ABI, .NET
   wrapper, NuGet package and symbols, companion archives, and static web
   assets. Bind toolchains, targets, environment allowlists, locks, source
   closure, generated code, timestamps, locale, and network policy.
4. Define supply-chain outputs: CycloneDX and/or SPDX SBOM, SLSA provenance,
   native dependency hashes, licenses, package allowlists, SourceLink,
   deterministic or documented nondeterministic fields, `.snupkg`, portable
   PDB, checksums, signatures, malware-scan boundaries, and retention.
5. Specify package and archive verification. Include clean-room consumer
   projects, RID inventory for `win-x64`, `linux-x64`, and `linux-arm64`, binary
   header inspection, cross-compilation versus emulation versus real hardware,
   archive traversal, symlink/reparse behavior, duplicate names, executable
   permissions, and self-contained launch smoke tests.
6. Design web deployment manifests that bind every immutable asset, bootstrap
   file, service worker, WASM, headers, CSP, COOP/COEP if required, caching,
   source maps, routes, model-byte exclusions, offline claims, and generated
   release metadata. Prevent stale service workers and mixed revisions.
7. Define public HTTPS readback. Use independent DNS resolution and TLS,
   redirects, status, content hashes, headers, cache behavior, version/date,
   release-log entry, key pages, scripts, WASM, and absence of stale assets.
   A readback receipt must bind the expected deployment identity and time.
8. Create one consistent visible release-information design across related
   product, catalog, marketing, API, and pure-documentation sites. Specify
   semantic technical version, release date, last-published timestamp, source
   revision or bounded build identity, current status, release notes, and
   append-only publication history without exposing private paths or secrets.
9. Define documentation ownership and freshness gates. Every implemented
   behavior, typed error, security boundary, acquisition flow, supported
   browser/platform, package, CLI/API contract, and known limitation needs an
   authoritative page, owner, source binding, testable examples, review date,
   and stale-reference scanner. Pure documentation sites receive the same gate
   rigor as product sites.
10. Design claim governance. Map every statement such as local, private,
    browser-capable, P2P-available, quality-qualified, cross-platform,
    published, or production-ready to current evidence. Stale, expired,
    invalidated, blocked, or narrower evidence must automatically remove or
    downgrade the claim.
11. Specify secret and privacy scanning across source, Git history to the
    authorized depth, logs, SBOM, packages, symbols, source maps, screenshots,
    traces, HTML, JSON, release notes, URLs, service-worker caches, and public
    readback. Cover UTF-8/UTF-16/base64, bounded false-positive review, and
    nonpublication of prompts, model bytes, tokens, invitation URLs, and
    private paths.
12. Define partial release and blocker behavior. A green documentation-site
    change may publish while model qualification remains blocked if its claims
    stay honest. A package may be built but not called published. Missing
    signing or deployment credentials must be visible. Failed readback must
    preserve source and deployment evidence and prohibit a success log entry.
13. Design rollback for a prelaunch clean slate. Roll back deployment to the
    last complete current revision only when safe; do not reintroduce removed
    obsolete executable paths as legacy support. Revoke claims and catalog
    entries when artifact, quality, security, or license evidence becomes
    invalid.
14. Provide an operator dashboard and final checklist. Show current operation,
    source commit/push state, package/build states, site deployment/readback,
    documentation freshness, blockers, elapsed time, resumability, and campaign
    counters. Never derive `done` from tests alone.

Required report structure:

1. Executive release-control recommendation and assumptions.
2. Content-addressed evidence and invalidation graph.
3. Source-control checkpoint and remote-verification protocol.
4. Hermetic build matrix by component and RID.
5. SBOM, provenance, signing, symbols, and package controls.
6. Archive and clean-consumer verification.
7. Web manifest, security-header, and service-worker contract.
8. Deployment and independent HTTPS readback procedure.
9. Cross-site version/date/release/publication-log standard.
10. Documentation ownership and freshness gate.
11. Claim-governance and privacy/redaction matrix.
12. Partial release, blocker, revocation, and rollback state machines.
13. Operator dashboard and prioritized implementation plan.
14. Unknowns requiring private CI, credentials, or live deployment.
15. Annotated primary-source bibliography with direct links and dates.

Do not call a commit deployed, a package file published, cross-compilation real
hardware execution, a local request public readback, or unit tests production
readiness. Do not publish secrets or model bytes, maintain stale documentation,
invent version history, write a success log before readback, or reintroduce a
superseded path during rollback.

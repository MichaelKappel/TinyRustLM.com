# Twelve Disconnected Research Prompts: Browser WASM Production Closure

Each section below is a complete standalone assignment. Send each entire prompt
to a different technical research agent. The agents do not share context and
must not be expected to have read this introduction, another prompt, another
report, or any private TinyRustLM material.

These reports are advisory research inputs. They are not implementation,
execution, test, release, deployment, or production evidence. Every researcher
must use current primary sources wherever possible, record every source's
publication or update date and the report's retrieval date, link directly to
supporting material, and pin public repository observations to immutable
revisions. Each report must visibly distinguish:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that could not be independently verified;
4. engineering analysis and recommendations;
5. assumptions, uncertainty, alternatives, and source disagreements; and
6. facts requiring private source inspection, local execution, real browser or
   hardware testing, credentials, or authorized production verification.

No researcher may claim to have inspected, built, run, tested, or validated
private TinyRustLM source or artifacts. Reports must be exceptionally detailed
and implementation-oriented. They should contain exact invariants, algorithms,
pseudocode, state machines, schemas, memory formulas, hostile-input cases,
fault-injection matrices, objective acceptance criteria, and a prioritized
implementation sequence. Generic tutorials, marketing summaries, invented
measurements, unsupported success claims, and recommendations to preserve
hypothetical prelaunch compatibility are not useful.

## Prompt 1: Rust-to-WebAssembly Raw ABI, Boundary State, And Panic Containment

You are an independent principal Rust/WebAssembly runtime architect, ABI
designer, and secure systems reviewer. Produce an exceptionally detailed,
implementation-oriented report specifying a production-quality raw WebAssembly
boundary for a browser-local transformer runtime. Target 12,000 to 20,000 words
excluding the bibliography. Your report must be useful to engineers who will
replace an older browser runtime completely rather than layer a wrapper over it.

You may research current official Rust, Cargo, WebAssembly, wasm32,
WebAssembly core specification, browser, MDN, W3C, Node.js, linker, and
wasm-tools documentation, plus peer-reviewed or formally specified work on FFI
and capability boundaries. You may inspect public repositories at immutable
revisions. You have no access to TinyRustLM source, artifacts, tests, build
logs, private models, credentials, or deployment systems. Do not request those
materials or imply that you audited the private implementation.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is one prelaunch product. There is no released product generation
  to support. Clean replacement and deletion are preferred over compatibility,
  aliases, fallback paths, migration readers, or retained deprecated code.
- The browser runtime is intended to be a dedicated Rust `cdylib` compiled to
  `wasm32-unknown-unknown`, instantiated once inside a dedicated Web Worker.
  The UI thread must never call WebAssembly directly or own model/KV bytes.
- One module owns one runtime. Worker termination invalidates the runtime and
  KV state. A released module must be replaced by a fresh worker.
- Artifact activation is based on a fixed ACG2 composition containing exactly
  five members: SLM2 model, Tokenizer2, Template2, Sampling2, and Prompt2. The
  composition record is exactly 896 bytes. Unknown or duplicate members fail.
- Large binary values cross a raw pointer/length transfer interface with at
  most one pending allocation. Transfer begin returns a pointer into
  WASM-owned memory; JavaScript writes the bytes; commit must validate exact
  kind, pointer, and length and must not copy the committed model again.
- Nine closed transfer kinds exist: expected operation, next operation, model,
  tokenizer, template, sampling, prompt, composition, and prompt request.
- Mutating runtime calls consume an exact 32-byte operation identity before
  mutation. Zero or stale operations fail. Advancing an operation requires a
  distinct nonzero next identity.
- The intended lifecycle is `uninitialized`, `empty`, `active-idle`,
  `generating`, `terminal-output-ready`, and `released`, with no implicit
  transitions.
- The boundary exposes only ABI version, transfer begin/commit/cancel, create,
  activate, advance operation, set transcript, begin request, step, finish,
  release, result pointer/length, and error pointer/length.
- Status classes are success, boundary rejection, runtime rejection, and
  internal failure. Result/error payloads are bounded canonical UTF-8 JSON;
  errors must not contain prompts, credentials, model bytes, or private paths.
- Rust panics, allocation failures, malformed input, stale calls, and host
  mistakes must never become undefined state or a fabricated successful result.

Research and resolve all of the following:

1. Define the exact ownership and trust boundary among JavaScript, linear
   memory, the raw ABI adapter, the canonical Rust runtime, and immutable result
   buffers. State which layer validates kinds, sizes, pointers, operation IDs,
   composition hashes, lifecycle transitions, and resource policy.
2. Design the boundary state as an explicit algebraic data type. Give all legal
   transitions and rejection behavior for every export in every state. Explain
   how failed calls preserve or consume staged values, results, errors,
   candidate runtimes, the current runtime, and operation identity.
3. Specify the one-pending-transfer protocol. Cover unknown kinds, zero length,
   overflow, address wraparound, misalignment, stale pointers, duplicate
   commit, pointer/kind/length mismatch, commit after cancellation, begin while
   pending, begin before create, and release while pending. State when memory is
   dropped and how use-after-reallocation is prevented.
4. Compare safe implementations of global single-instance state in
   single-threaded WASM: `Mutex`, `RefCell`, explicit handles, exported resource
   tables, and component-model alternatives. Account for reentrancy, panic
   poisoning, browser event-loop behavior, future threads, and testability.
5. Define a stable C-like raw ABI with exact integer widths and no Rust layout
   leakage. Address `usize`, `u64` split words, bool encodings, pointer zero,
   endianness, UTF-8, JSON canonicalization, status/error separation, and ABI
   version negotiation without supporting old versions.
6. Specify result and error pointer lifetimes precisely. Explain which calls
   invalidate a pointer, how JavaScript copies bounded response bytes safely,
   how a zero-length result differs from no result, and how stale consumers are
   detected.
7. Develop panic and failure containment. Compare `panic=abort`,
   `catch_unwind` limitations on WASM, trapping, explicit `Result`, allocation
   failure behavior, and worker termination. Define what the UI can truthfully
   report after a trap.
8. Design resource creation and preflight checks for positive limits and hard
   ceilings, including model, sequence, KV, scratch, resolved members,
   dependencies, request, and linear memory. Show checked-arithmetic formulas
   and prove that no mutation precedes resource rejection.
9. Define exact release semantics and zeroization expectations. Distinguish
   dropping Rust owners, making data unreachable, browser process memory
   reclamation, explicit zeroization, and claims that cannot be guaranteed.
10. Specify compile and link controls: crate type, allocator choice, LTO,
    optimization, panic strategy, explicit maximum memory, imported/exported
    symbol allowlists, start function, mutable globals, table exports, and
    reproducibility. Explain how to inspect the final binary rather than trust
    Cargo configuration.
11. Provide property, fuzz, model-based, hostile-ABI, Node, and real-browser
    tests. Include malformed operation sequences, random transfer interleavings,
    memory growth, pointer lifetime, exact export inspection, trap recovery,
    deterministic error codes, and release idempotency policy.
12. Produce a clean implementation sequence with narrow commits, stop
    conditions, deletion criteria for the superseded ABI, and objective gates
    before JavaScript integration may begin.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Trust, ownership, and authority diagram.
3. Exact raw ABI table and binary conventions.
4. Boundary ADT and complete transition matrix.
5. Transfer allocation/commit algorithm with pseudocode.
6. Operation identity and stale-call protocol.
7. Resource preflight and checked-arithmetic formulas.
8. Panic, trap, allocation, and release behavior.
9. Build/link/export hardening profile.
10. Property, fuzz, Node, and browser test matrix.
11. Objective acceptance and deletion-closure checklist.
12. Prioritized implementation plan.
13. Unknowns requiring private inspection or local execution.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend wasm-bindgen glue as an unexamined authority, a second hidden
model copy, catch-all success responses, a compatibility ABI, an implicit
state transition, post-trap reuse without proof, or treating a successful
`cargo build` as proof of the final WASM export and memory contract.

## Prompt 2: Move-Only Model Ownership, ACG2 Verification, And Transactional Activation

You are an independent principal Rust ownership engineer, content-addressed
artifact architect, and memory-efficiency researcher. Produce an exceptionally
detailed report explaining how to validate a multi-member model composition and
then move a very large model allocation into a canonical runtime without an
unbounded second model copy. Target 12,000 to 20,000 words excluding the
bibliography.

Use primary Rust standard-library documentation, Rust Reference and Nomicon
material, relevant WebAssembly memory documentation, cryptographic hash
specifications, and public content-addressed storage or model-loading designs.
Pin public code observations to immutable revisions. You have no access to
TinyRustLM source, binary formats, artifacts, memory traces, tests, or logs and
must not imply private validation.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is prelaunch and has no compatibility obligation. There must be
  one SLM2/ACG2 path; older SLM1/ACG1 readers and adapters will be deleted once
  the replacement passes its gates.
- A canonical ACG2 owner validates an exact 896-byte composition with exactly
  five closed member roles: model, tokenizer, template, sampling, and prompt.
  Every member has an expected SHA-256 identity and byte length. Unknown and
  duplicate members are forbidden.
- Browser acquisition deposits each member into a WASM-owned `Vec<u8>` through
  one pending transfer allocation. The model can approach 2 GiB, so successful
  activation must move that exact allocation into the runtime rather than read
  it again, clone it, repack it, or retain the staged owner.
- The composition verifier expects a reader-like abstraction that may seek and
  stream bytes. The runtime needs ownership of the model allocation after all
  members are verified. Smaller dependency members may remain independently
  owned, but every retained byte must be accounted for.
- Activation is transactional: all candidate members are validated and
  resource-preflighted before replacing the current runtime. Candidate failure
  drops candidate state and preserves the active runtime. Successful activation
  drops the old runtime only at the defined commit point.
- The browser worker has no filesystem or network authority. Members are
  identified by content identity, not arbitrary paths or URLs.

Research and resolve all of the following:

1. Define an ownership graph for staged bytes, validation readers, composition
   metadata, resolved members, candidate runtime, active runtime, KV cache, and
   worker messages. Mark every temporary owner and the exact commit/drop point.
2. Compare resolver designs using `Vec<u8>`, `Box<[u8]>`, `Arc<Vec<u8>>`,
   `Arc<[u8]>`, custom cursors, slices with scoped borrows, memory maps on
   native systems, and WASM linear memory. State which can prove move-only
   promotion and which conceal copies or prevent unique ownership recovery.
3. Design a two-phase or multi-phase algorithm that supports streaming
   hash/length validation and later ownership extraction. Address the tension
   between a reader API and a one-time `take_model` operation.
4. Explain how `Arc::try_unwrap`, outstanding readers, scoped borrows, and
   interior mutability affect correctness. Define fail-closed behavior if any
   reader or alias remains at extraction time, and show how tests can prove the
   exact allocation pointer survives activation.
5. Specify canonical member resolution. Cover role/type matching, identity and
   length verification, duplicate and unknown roles, truncated/extended data,
   hash collision assumptions, TOCTOU, member-order independence, bounded
   reads, seek abuse, and parser bombs.
6. Design transactional runtime replacement. Provide pseudocode for validation,
   resource preflight, construction, operation-identity check, commit, old-state
   destruction, and rollback-by-drop. Identify every step that can fail and the
   state visible afterward.
7. Derive peak-memory formulas for first activation and model switching. Include
   old model, candidate model, temporary hash buffers, parser state, tokenizer,
   template, sampling, prompt, KV cache, scratch, request, outputs, allocator
   fragmentation, and WASM page growth. State when switching must be rejected.
8. Analyze whether tokenizer, template, sampling, and prompt members should be
   borrowed, copied, parsed into canonical structures, or retained as source
   bytes. Require bounded representation and account for provenance and replay.
9. Define secure destruction and failure cleanup. Distinguish dropping a
   candidate, releasing capacity, allocator behavior, linear-memory high-water
   marks, explicit zeroization, and actual browser-process reclamation.
10. Provide Rust API sketches with sealed traits or capability types that
    prevent rereading the model after extraction, extracting before validation,
    activating twice, or silently falling back to a copying resolver.
11. Design unit, property, Miri-appropriate native, fuzz, allocation-counting,
    pointer-identity, WASM, and real-browser tests. Include forced live-reader
    aliases, hash mismatch at the last byte, length drift, model switch failure,
    allocator exhaustion, cancellation, and worker death.
12. Define objective no-second-copy evidence and honest claim language. Explain
    why source inspection, matching pointers, allocation instrumentation, and
    peak resident memory each prove different things and should be combined.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Complete ownership/lifetime graph.
3. Resolver API alternatives and decision matrix.
4. Streaming validation and one-time extraction algorithm.
5. Transactional activation state machine and pseudocode.
6. Peak-memory and model-switch formulas.
7. Rust type-state/API sketches.
8. Failure, cleanup, and zeroization semantics.
9. Verification and hostile-input test matrix.
10. Objective move-only evidence requirements.
11. Clean-slate implementation and deletion sequence.
12. Unknowns requiring private inspection or local execution.
13. Annotated primary-source bibliography with dates and immutable links.

Do not recommend a convenience clone, rereading from JavaScript, retaining a
staged model after successful activation, memory mapping as if browsers expose
native file maps, accepting an alias because it is read-only, or preserving an
old copying path as a fallback.

## Prompt 3: Dedicated Worker Protocol, Exactly-Once Completion, And Stale-Operation Defense

You are an independent principal browser concurrency architect, distributed
protocol engineer, and JavaScript reliability reviewer. Produce an
exceptionally detailed report specifying a dedicated Web Worker protocol that
owns a local model runtime and delivers each generation result to the UI
exactly once despite cancellation, model switching, restarts, duplicate
messages, and delayed events. Target 12,000 to 20,000 words excluding the
bibliography.

Use current primary documentation for Web Workers, structured clone,
transferable objects, `postMessage`, event loops, Promise cancellation
patterns, browser process lifecycle, cross-origin isolation where relevant,
and formal protocol/state-machine techniques. Public repository examples must
be pinned to immutable revisions. You have no access to TinyRustLM source,
browser traces, private prompts, models, or tests and must not claim otherwise.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is a prelaunch browser-local chat product. The production path
  will use one dedicated worker containing one WASM module and one runtime.
  There is no need to support an older browser protocol.
- The UI may send commands but may not call WASM, hold model/KV bytes, repair
  output, select among hidden retries, or infer completion from text.
- Binary chunks must use transferable `ArrayBuffer` ownership. The worker may
  not initiate network requests and may not receive arbitrary URLs or paths.
- Every command carries a closed schema plus `workerId`, `operationId`,
  `compositionId`, `conversationId`, `turnId`, `generationId`, `messageId`,
  monotonically contiguous `sequence`, `kind`, and bounded `payload`.
  Cryptographic IDs are lowercase SHA-256 hex.
- Sequence begins at zero and increments by exactly one. Duplicate,
  out-of-order, stale worker, stale operation, stale composition, and stale
  generation messages fail closed.
- Every mutating WASM call consumes the exact current operation identity.
  Cancellation is one explicit runtime transition; it must not start a
  replacement generation. Worker termination invalidates runtime and KV state.
- A terminal raw runtime output is consumed once by `finish`, emitted once by
  the worker, and rendered as one assistant message. A second finish or second
  authoritative completion is an error. Repeated text generated by the model
  is not UI duplication and must not be deduplicated.

Research and resolve all of the following:

1. Define the complete protocol vocabulary for worker creation, policy setup,
   member transfer, activation, conversation/transcript binding, request start,
   stepping or token progress, cancellation, terminal completion, failure,
   release, heartbeat if justified, and worker replacement.
2. Specify canonical serialization and validation for every envelope and
   payload. Cover unknown fields, prototype pollution, getters, typed arrays,
   detached buffers, oversized messages, malformed IDs, integer precision,
   sequence overflow, and schema-version mismatch without legacy negotiation.
3. Build paired UI-side and worker-side state machines with all legal
   transitions, command preconditions, acknowledgments, terminal outcomes, and
   rejection behavior. Include a complete state/event transition table.
4. Explain exactly-once as an application invariant rather than a transport
   guarantee. Define idempotency, duplicate detection, terminal tombstones,
   generation ledgers, message IDs, sequence numbers, and render authority.
5. Resolve races among cancel, step completion, finish, worker error, model
   switch, conversation deletion, navigation, UI unmount, profile close, and a
   new generation. State which event wins and how late events are rejected.
6. Design operation advancement and transcript revision binding. Prevent stale
   prompts or old memory snapshots from mutating a new conversation while
   allowing intentional multi-turn continuation.
7. Specify transferable-buffer custody from acquisition through worker handoff
   and WASM commit. Include chunking, detachment checks, backpressure,
   cancellation, sender cleanup, worker validation, and proof that the UI no
   longer owns model bytes.
8. Define failure semantics for worker script load, WASM compile/instantiate,
   trap, out-of-memory, unhandled rejection, malformed result JSON, worker
   termination, browser process kill, and tab suspension. Separate retryable
   product operations from terminal evidence failures.
9. Design worker replacement. A fresh worker must reverify every composition
   member before activation and cannot inherit KV state. Explain what durable
   UI metadata may survive without pretending runtime continuity.
10. Specify security controls: CSP, worker source, no network capability,
    request interception tests, no dynamic code, no artifact-provided scripts,
    no credential-bearing messages, and bounded public-safe errors.
11. Provide deterministic model-based tests and a concurrency/fault-injection
    harness. Cover all two-event and important three-event races, randomized
    scheduling, duplicated events, delayed old-worker messages, transferable
    detachment, output rendering, and worker replacement.
12. Define browser evidence needed to claim exactly-once behavior across
    Chromium, Firefox, and WebKit, distinguishing protocol proof, simulation,
    headless execution, headed execution, and real user-visible rendering.

Required report structure:

1. Executive protocol recommendation and assumptions.
2. Actor, trust, and message-flow diagram.
3. Closed command/event schemas.
4. UI and worker state machines.
5. Exactly-once ledger and render-authority algorithm.
6. Cancellation and stale-event race matrix.
7. Transferable-buffer custody protocol.
8. Failure, replacement, and recovery semantics.
9. Security and privacy controls.
10. Deterministic, model-based, and real-browser test plan.
11. Objective acceptance criteria and prohibited claims.
12. Prioritized implementation sequence.
13. Unknowns requiring private inspection or local execution.
14. Annotated primary-source bibliography with dates and immutable links.

Do not treat `postMessage` as exactly-once delivery, deduplicate model-generated
words, keep stale listeners harmlessly attached, infer completion from a quiet
timer, automatically restart a failed generation, preserve an old worker as a
fallback, or count a mocked worker as real browser evidence.

## Prompt 4: Browser WASM Memory Capacity, KV-Cache Economics, And Measured Performance

You are an independent principal WebAssembly performance engineer, transformer
inference capacity planner, and browser memory specialist. Produce an
exceptionally detailed report on making a compact transformer runtime fast and
memory-predictable in browser WebAssembly while preserving numerical and
behavioral correctness. Target 12,000 to 20,000 words excluding the
bibliography.

Research current primary sources for WebAssembly memory, browser engine limits,
wasm32 address space, Memory64 status, WASM SIMD, threads and cross-origin
isolation, Rust allocators, JavaScript transferable buffers, transformer KV
caches, quantized matrix multiplication, and browser performance measurement.
Use official browser and standards documentation and peer-reviewed model or
systems papers where possible. Pin public code observations to immutable
revisions. You have no access to TinyRustLM code, models, profiles, tests,
hardware, or measurements. Do not invent product benchmarks or imply private
execution.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is a prelaunch browser-local chat product with one clean SLM2
  runtime path. Compatibility and old-runtime fallback are forbidden.
- A dedicated worker owns one WASM module, one active model, and its KV cache.
  The UI must release transferred model buffers and cannot keep a second copy.
- Candidate SLM2 model bytes may approach 2 GiB. Registered hard ceilings are
  approximately 2 GiB model, 40,960 sequence tokens, 2 GiB KV, 1 GiB scratch,
  128 MiB resident dependencies, 16 MiB request/result, and 3 GiB maximum
  linear memory. These are ceilings, not promises that every browser can
  satisfy them.
- Activation is transactional. Model switching may temporarily require both
  the active and candidate runtime state, so it must be preflighted or rejected
  before mutation.
- The runtime targets compact dense transformer families, including Qwen-like
  grouped-query attention architectures, quantized weights, deterministic
  sampling, multi-turn KV-prefix reuse, CPU inference, and browser WASM.
- Performance may never be improved by changing prompt semantics, silently
  truncating context, repairing output, selecting the best retry, weakening
  hash validation, or reducing numerical acceptance thresholds.

Research and resolve all of the following:

1. Explain real wasm32 linear-memory constraints across current Chromium,
   Firefox, and WebKit implementations. Distinguish specification limits,
   linker maximums, engine reservations, browser process limits, device limits,
   and tested practical limits. Address 2 GiB signed-index hazards and the
   status of memory64 without assuming deployment availability.
2. Build a complete peak-memory model covering transferred chunks, pending
   WASM allocation, committed model, parsed metadata, quantization scales,
   tokenizer, template, sampling, prompt, activations, logits, scratch, KV,
   result JSON, allocator overhead, old model during switching, and browser
   bookkeeping. Use checked formulas parameterized by architecture.
3. Derive KV-cache bytes per token for multi-head and grouped-query attention,
   including layers, KV heads, head dimension, element width, alignment,
   metadata, and page/block structure. Compare contiguous, paged, ring,
   sliding-window, quantized, and prefix-reuse designs for small local models.
4. Define a resource policy that translates browser capability and model
   metadata into a safe maximum context. Explain truthful user status when a
   requested model cannot fit, and prohibit hidden quality reduction.
5. Compare allocators and arena strategies for large long-lived weights plus
   generation scratch. Analyze fragmentation, memory growth, inability to
   shrink linear memory, peak switching cost, release behavior, and whether
   worker termination is the only reliable way to return memory to the browser.
6. Analyze binary transfer and loading strategies: one allocation, bounded
   chunks into a single destination, transferable `ArrayBuffer`, streams,
   response bodies, OPFS, IndexedDB, File System Access, and companion
   loopback. Identify unavoidable copies in browser APIs and ways to measure
   rather than merely assert them.
7. Evaluate WASM SIMD, relaxed SIMD, threads, shared memory, atomics, and
   cross-origin isolation for quantized kernels. Give a staged baseline and
   optimization plan that does not make unsupported browser features mandatory
   without explicit product policy.
8. Develop performance models for prefill and decode. Separate model bandwidth,
   quantized unpack/dequantize, matrix multiplication, attention, softmax,
   tokenizer, sampling, JavaScript/WASM crossings, and rendering. Provide
   formulas for tokens/second and latency without inventing constants.
9. Specify instrumentation that minimally perturbs execution: phase timings,
   linear-memory pages, allocation counters, peak resident process memory,
   worker messages, long tasks, GC, context length, and hardware/browser
   identity. Define private raw evidence and bounded public summaries.
10. Define optimization acceptance gates requiring deterministic token parity
    or an explicitly justified numerical envelope, no behavioral regression,
    no second model copy, bounded peak memory, and repeatable improvement across
    representative hardware.
11. Design stress and fault tests for near-limit models, context growth,
    repeated turns, cancellation, switching, allocation failure, browser tab
    suspension, memory pressure, 32-bit arithmetic overflow, and deliberately
    hostile metadata.
12. Produce a prioritized optimization backlog ordered by evidence, expected
    leverage, complexity, portability, and correctness risk. Identify likely
    dead ends and conditions for stopping an optimization.

Required report structure:

1. Executive capacity/performance recommendation and assumptions.
2. Current standards and browser-engine constraint matrix.
3. Full peak-memory accounting model.
4. KV-cache formulas and design comparison.
5. Loading, allocator, switching, and release strategy.
6. Kernel/SIMD/thread portability analysis.
7. Prefill/decode performance model.
8. Measurement and benchmark protocol.
9. Correctness-preserving optimization gates.
10. Stress, fault, and adversarial test matrix.
11. Prioritized optimization sequence and stop rules.
12. Unknowns requiring private models or local execution.
13. Annotated primary-source bibliography with dates and immutable links.

Do not present a theoretical 4 GiB address space as a practical browser budget,
assume linear memory shrinks, hide copies inside API language, recommend silent
context truncation, trade correctness for attractive speed numbers, or count a
microbenchmark as end-to-end chat performance.

## Prompt 5: Native-WASM Numerical Parity, Quantized Kernels, And Deterministic Decode

You are an independent principal machine-learning runtime engineer, numerical
analysis specialist, and Rust/WASM kernel reviewer. Produce an exceptionally
detailed report defining how a compact quantized transformer runtime can prove
native-versus-browser numerical and token parity from artifact parsing through
autoregressive decode. Target 12,000 to 20,000 words excluding the
bibliography.

Research primary model architecture papers and official model cards, Rust and
WebAssembly floating-point/SIMD specifications, quantization literature,
reference kernels, deterministic sampling algorithms, tokenizer
specifications, and reproducible numerical testing. Pin public repositories and
model revisions immutably. You have no access to TinyRustLM source, private SLM2
artifacts, conversion receipts, golden tensors, or runtime output. Do not claim
to have evaluated the product.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is prelaunch and is replacing all prior browser inference paths
  with one canonical Rust runtime compiled for native and browser WASM.
- SLM2 is a strict portable model container used through an ACG2 composition
  with Tokenizer2, Template2, Sampling2, and Prompt2. Structural validation is
  necessary but is not numerical or behavioral proof.
- Target models are compact dense decoder-only transformers, potentially with
  RMSNorm, rotary position embeddings, grouped-query attention, gated MLPs,
  tied or untied embeddings, and quantized linear weights. Architecture support
  must be explicit, not guessed from tensor names.
- Sampling parameters and seeds are model-family-specific and bound as an
  artifact. Raw runtime output is preserved. No repair, hidden retry,
  best-of-N, or expected-answer injection is allowed.
- Native and browser implementations should share canonical parsing and runtime
  logic. Optimized kernels may differ only when their numerical contract and
  resulting token behavior are proven.
- Arithmetic may be delegated to deterministic tools at the product level, but
  inference itself must remain coherent, deterministic under declared settings,
  and faithful to the source model within a registered tolerance.

Research and resolve all of the following:

1. Define a layered parity taxonomy: container parsing, tensor identity and
   layout, dequantization, primitive kernel, layer output, logits, probability
   transform, sampled token, decoded text, multi-turn transcript, and product
   rendering. State which layer can invalidate claims above it.
2. Specify reference semantics for supported transformer operations. Cover
   embedding lookup, RMSNorm epsilon and accumulation, RoPE conventions,
   causal masking, grouped-query head mapping, attention scaling, stable
   softmax, gated activations, residual order, final norm, output projection,
   and tied embeddings.
3. Analyze quantized weight formats suitable for portable SLM2 execution.
   Compare symmetric/asymmetric, per-tensor/per-channel/per-group, integer
   widths, scales, zero points, packing, alignment, endianness, accumulation
   width, tails, and dequantization fusion. State required metadata and
   corruption checks.
4. Explain native/WASM floating-point differences: fused multiply-add,
   reassociation, subnormals, NaNs, signed zero, rounding, SIMD reduction order,
   fast-math, transcendental approximations, target features, and compiler
   changes. Define compile settings and tests that make differences visible.
5. Design a scalar reference kernel as test authority without making it an
   undeclared production fallback. Explain independent oracle choices and how
   to avoid comparing two paths that share the same bug.
6. Define numerical tolerances by operation and tensor scale. Avoid one global
   epsilon. Include absolute/relative/ULP measures, cosine similarity where
   appropriate, top-logit margins, and escalation when small logit drift flips
   a token.
7. Specify deterministic sampling exactly: logit preprocessing order,
   repetition penalties, temperature, top-k, top-p, tie breaking, RNG algorithm
   and integer mapping, seed derivation, floating-point cumulative sums, EOS,
   stop sequences, and maximum token behavior.
8. Design differential fixtures derived from public model revisions without
   distributing restricted weights. Include tiny synthetic tensors, hostile
   dimensions, real private receipt binding, intermediate checkpoint hashes,
   and sealed expected outputs.
9. Address KV-cache parity over multi-turn use. Cover cache layout, position
   counters, transcript prefix identity, append versus rebuild, cancellation,
   context limit, model switch, stale transcript, and cache invalidation.
10. Define optimization workflow for scalar, native SIMD, WASM SIMD, packed
    quantized, and future thread paths. Every optimization begins with a failing
    or performance test and ends with differential and behavioral gates; no
    hidden scalar fallback remains in production.
11. Provide test matrices for malformed tensors, dimension overflow, odd tails,
    extreme values, all-masked attention, near-tied logits, long context,
    deterministic replay, multiple compiler versions, browsers, CPUs, and
    release settings.
12. Define evidence required to claim architecture support, numerical parity,
    deterministic token parity, and useful conversation separately. Explain
    why one attractive response proves none of these on its own.

Required report structure:

1. Executive parity recommendation and assumptions.
2. Supported architecture semantics table.
3. Quantized tensor and kernel contract.
4. Native/WASM floating-point threat model.
5. Scalar oracle and independent-reference strategy.
6. Layered tolerances and token-flip escalation.
7. Deterministic sampling specification.
8. KV-cache and multi-turn parity protocol.
9. Differential fixture and test architecture.
10. Optimization promotion and no-fallback gates.
11. Claim taxonomy and objective evidence checklist.
12. Prioritized implementation sequence.
13. Unknowns requiring private artifacts or local execution.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend fast-math without a parity contract, use token equality as the
only numerical test, call structural parsing model support, choose tolerances
after seeing a preferred model fail, silently invoke a scalar fallback, or
equate deterministic output with conversational quality.

## Prompt 6: Tokenizer, Chat Template, Sampling, And Prompt Artifact Fidelity

You are an independent principal NLP runtime engineer, tokenizer specialist,
and prompt-contract architect. Produce an exceptionally detailed report on
turning tokenizer, chat template, sampling, and system-prompt behavior into
strict portable data artifacts that produce deterministic native/browser
behavior without executing untrusted template code. Target 12,000 to 20,000
words excluding the bibliography.

Research official tokenizer documentation and formats, Unicode standards,
SentencePiece and byte-pair encoding papers and implementations, Hugging Face
tokenizer and chat-template documentation, model-family cards, deterministic
sampling sources, parser security guidance, and reproducible artifact design.
Pin model and repository observations to immutable revisions. You have no
access to TinyRustLM source, private artifacts, prompts, outputs, or tests. Do
not imply private inspection.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is one prelaunch browser-local product. It will support only one
  strict current contract; no legacy tokenizer/template readers, aliases,
  migration logic, or fallback prompt formatting are needed.
- Each ACG2 composition binds exactly one SLM2 model, Tokenizer2 artifact,
  Template2 artifact, Sampling2 artifact, and Prompt2 artifact by SHA-256 and
  byte length. Unknown members are rejected.
- Artifacts are data, not executable code. Arbitrary Jinja, JavaScript, shell,
  filesystem paths, URLs, includes, dynamic imports, and host callbacks are
  forbidden in the browser runtime.
- The same canonical Rust implementation should execute these artifacts in
  native and WASM runtimes. Byte-for-byte prompt token parity matters.
- The product supports multi-turn conversation, current-user-preference
  precedence over stale memory, untrusted retrieved/quoted text, raw output,
  declared stop behavior, and deterministic sampling under a bound seed.
- Performance optimizations cannot alter normalization, special-token,
  template, truncation, stop, or sampling semantics.

Research and resolve all of the following:

1. Inventory tokenizer families realistically encountered in compact public
   transformer models: byte-level BPE, SentencePiece unigram/BPE, WordPiece,
   byte fallback, added tokens, normalization pipelines, and model-specific
   pretokenization. Identify a conservative support boundary.
2. Define a closed Tokenizer2 schema. Cover vocabulary encoding, merges or
   scores, normalization, pretokenization, byte fallback, special and added
   tokens, unknown token, BOS/EOS, maximum sizes, canonical ordering, duplicate
   rejection, Unicode version binding, and unknown-field policy.
3. Specify exact encode/decode semantics for invalid UTF-8, unpaired surrogate
   input from JavaScript, normalization forms, combining marks, control
   characters, whitespace, newline conventions, emoji sequences, right-to-left
   text, byte fallback, and decoding of arbitrary token streams.
4. Replace arbitrary chat templates with a closed Template2 instruction set or
   declarative schema. Define allowed operations, role ordering, separators,
   generation markers, optional system messages, tool-free constraints,
   bounded loops/conditionals if any, and rejection of unsupported templates.
5. Define Prompt2 authority. Separate product-owned system instruction,
   user-supplied content, retrieved memory marked as untrusted data, transcript
   history, and runtime control tokens. Prevent quoted text or memory from
   changing template/runtime authority.
6. Define a closed Sampling2 schema and exact processing order for penalties,
   temperature, top-k, top-p, minimum probability if supported, RNG, seed,
   tie-breaking, EOS, stop tokens, stop byte strings, maximum tokens, and
   invalid combinations. Prefer rejecting unsupported features to approximating
   them.
7. Specify context accounting before generation. Include template expansion,
   UTF-8 bytes, tokens, reserved output, KV prefix, transcript revision,
   truncation policy, and truthful failure. Hidden truncation is forbidden.
8. Design conversion from public model repositories into the closed artifacts.
   Require immutable source revisions, exact source-file hashes, explicit
   unsupported-feature reports, deterministic output, licensing/provenance,
   and no execution of repository-supplied code.
9. Define native/WASM parity fixtures and independent reference comparisons.
   Include exact token arrays, rendered prompt bytes, seeded token selection,
   decoding, stop handling, multi-turn transitions, and adversarial Unicode.
10. Analyze denial-of-service and parser threats: giant vocabularies, merge
    cycles or conflicts, pathological regexes, normalization expansion,
    enormous special tokens, deep template structures, integer overflow, and
    malicious stop sets. Give hard limits and linear/bounded algorithms.
11. Design versioning and clean replacement. A schema mismatch must reject;
    the product does not negotiate old formats. Explain how converter,
    runtime, browser, package, documentation, and fixtures change atomically.
12. Provide an implementation and test sequence culminating in deletion of
    handwritten prompt formatting, task-specific browser exports, output
    cleanup/repair, and any old artifact parser.

Required report structure:

1. Executive fidelity recommendation and assumptions.
2. Supported tokenizer-family matrix.
3. Tokenizer2 closed schema and algorithms.
4. Template2 non-executable language/schema.
5. Prompt2 authority and untrusted-data model.
6. Sampling2 deterministic specification.
7. Context accounting and failure semantics.
8. Secure deterministic conversion pipeline.
9. Native/WASM parity and adversarial test matrix.
10. Resource and parser security limits.
11. Clean-slate implementation/deletion plan.
12. Unknowns requiring private artifacts or local execution.
13. Annotated primary-source bibliography with dates and immutable links.

Do not recommend running arbitrary Jinja or repository code, approximating an
unsupported tokenizer, silently inserting or removing special tokens, hidden
context truncation, response repair, task-specific generation functions,
schema negotiation for legacy artifacts, or validating only ordinary ASCII.

## Prompt 7: P2P-First Model Acquisition, Local Conversion, And One-Click Usability

You are an independent principal browser acquisition architect, content-addressed
distribution engineer, and local-first product reliability specialist. Produce
an exceptionally detailed report designing a model acquisition flow in which a
user selects a public model and receives a verified, usable local composition,
not a downloaded instruction text file or a disconnected collection of helper
artifacts. Target 12,000 to 20,000 words excluding the bibliography.

Research primary browser download, Fetch/Streams, File System Access, OPFS,
IndexedDB, service worker, Web Worker, loopback security, CORS, direct P2P,
content-addressed transfer, resumable download, and local companion application
documentation. Research official model repository APIs and immutable revision
mechanisms. Pin public repositories to immutable revisions. You have no access
to TinyRustLM source, private peers, model files, manifests, companion builds,
network configuration, credentials, or receipts. Do not claim private tests or
availability.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is a prelaunch browser-local chat product. MiniModel.org is the
  intended public catalog and direct P2P discovery authority. MiniModel.org
  must never proxy model bytes.
- A usable model is an exact ACG2 composition plus five verified members: SLM2,
  Tokenizer2, Template2, Sampling2, and Prompt2. A source repository name or
  model metadata row is not a runnable artifact.
- Selection should first seek a quality-qualified, identity-matching direct P2P
  composition. If none is available, the local Rust/.NET companion should
  acquire immutable source files, convert and validate them locally, create the
  composition, and optionally serve it to consenting peers under explicit user
  control.
- The website must not receive prompts or model bytes. The browser runtime
  worker cannot access the network and cannot receive arbitrary paths or URLs.
  Acquisition and inference are separate authorities.
- Existing behavior that downloads `.txt`, `.ps1`, or JSON instructions is
  considered unacceptable product behavior. People expect the selected model
  either to become usable or to receive a precise actionable failure.
- Distinct model bytes, source provenance, license review, format validation,
  numerical parity, and conversation quality are separate gates. Popularity or
  conversion success alone cannot authorize use or publication.
- There is no legacy acquisition contract to support. The new path should
  replace and delete superseded flows rather than route around them.

Research and resolve all of the following:

1. Define the user-visible acquisition state machine from search result through
   source review, identity resolution, P2P discovery, peer verification,
   resumable transfer, local validation, activation, source conversion fallback,
   quality status, optional sharing, cancellation, and terminal failure.
2. Separate catalog metadata authority, source repository authority, license
   evidence, artifact identity, peer discovery, byte transfer, local converter,
   composition verifier, runtime activation, and UI status. Define typed
   contracts and prohibit one authority from fabricating another's evidence.
3. Design P2P-first discovery using complete identities before bytes are mixed.
   Cover model and composition hashes, piece-set identity, two or more peers,
   peer disagreement, stale advertisements, proof expiry, malicious pieces,
   partial availability, and privacy-preserving requests.
4. Specify a resumable piece protocol and journal. Include fixed piece
   identity, ranges, per-piece and final hashing, bounded parallelism,
   backpressure, crash recovery, corruption quarantine, atomic promotion,
   cancellation cleanup, disk-full behavior, and no duplicate full artifact.
5. Design the local conversion fallback as a versioned companion operation.
   It must pin source revision and file hashes, review license and architecture,
   acquire only declared files, never execute repository code, stream large
   hashes, convert deterministically, validate independently, and return a
   content-addressed composition receipt.
6. Define the browser-companion loopback contract. Cover origin binding,
   authentication/capability tokens, CSRF and DNS rebinding, allowed routes,
   request sizes, streamed responses, idempotency, operation IDs, cancellation,
   progress, timeouts, restart/resume, public-safe errors, and no arbitrary
   filesystem access.
7. Decide where acquired members reside before worker activation. Compare
   OPFS, IndexedDB, File System Access handles, companion-owned storage, and
   direct streaming. Analyze browser portability, quota, eviction, copies,
   persistence, permission UX, and clean-profile tests.
8. Specify progress and error semantics that are truthful and useful. Separate
   searching, no qualified peer, peer unreachable, transfer, verification,
   conversion, unsupported architecture, source drift, license blocked,
   quality unproven, activation, usable, and sharing. Never call a queued script
   or metadata download success.
9. Design safe model switching and activation handoff. The candidate must be
   fully verified and memory-preflighted before replacing the active runtime;
   stale acquisition completion cannot activate after a newer selection.
10. Address user consent and outbound sharing. Define explicit enablement,
    bandwidth limits, metering, endpoint disclosure, NAT status, revocation,
    proof expiry, artifact/license downgrade, and immediate catalog withdrawal.
11. Provide test and fault-injection matrices spanning catalog outage, no peers,
    malicious peers, interrupted pieces, companion absent/restart, source drift,
    converter crash, disk full, hash mismatch, stale UI operation, browser
    profile deletion, and successful first-use chat.
12. Produce an incremental replacement plan with TDD, bounded commits,
    browser-visible acceptance, documentation updates, and deletion closure for
    text/script download behavior and all old acquisition routes.

Required report structure:

1. Executive acquisition recommendation and assumptions.
2. Authority and data-flow diagram.
3. User-visible acquisition state machine.
4. P2P identity, discovery, transfer, and journal protocol.
5. Deterministic local conversion fallback contract.
6. Secure browser-companion loopback API.
7. Storage, quota, streaming, and memory analysis.
8. Status/error and model-switch semantics.
9. Consent-based sharing lifecycle.
10. Test and fault-injection matrix.
11. Objective one-click usability acceptance checklist.
12. Clean-slate implementation and deletion plan.
13. Unknowns requiring private or authorized infrastructure.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend downloading instructions for the user to run, proxying model
bytes through the project site, trusting aliases instead of hashes, mixing
pieces before complete identity agreement, executing repository code, silently
falling back to an old converter/runtime, or labeling conversion as quality
qualification.

## Prompt 8: Hostile Artifact Security, Browser Privacy, And Fuzzable Trust Boundaries

You are an independent principal product-security architect, browser sandbox
specialist, and Rust parser/fuzzing lead. Produce an exceptionally detailed
threat model and hardening plan for a browser-local model system that consumes
large artifacts from untrusted public peers and source repositories. Target
12,000 to 20,000 words excluding the bibliography.

Use current primary sources for the Web security model, CSP, workers, WASM,
loopback services, DNS rebinding, CORS, Fetch metadata, secure contexts,
Spectre-related isolation, Rust unsafe-code guidance, parser fuzzing, archive
security, cryptographic hashing/signatures, software supply chain, and browser
storage. Pin public repository observations to immutable revisions. You have no
access to TinyRustLM source, security scans, model bytes, private prompts,
credentials, networks, or deployment. Do not claim a private audit.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is prelaunch, so security defects should be fixed at their
  architectural source. No legacy endpoints, permissive readers, compatibility
  aliases, or insecure fallback routes need to survive.
- Model inference is browser-local. The project website must not receive
  prompts or model bytes. A dedicated worker owns WASM and may not initiate
  network requests or receive arbitrary URLs/paths.
- The accepted artifact is one exact ACG2 composition with five content-bound
  members: SLM2 model, Tokenizer2, Template2, Sampling2, and Prompt2. Unknown or
  duplicate roles fail; artifacts contain data, not executable code.
- Acquisition may use direct untrusted peers or a local companion. The public
  catalog supplies metadata/discovery and cannot be trusted as a byte proxy.
- MemoryEndpoints.com may provide authorized hosted memory continuity, but it
  is not model transport. Retrieved memory is untrusted data and cannot grant
  tool, runtime, filesystem, network, publication, or evidence authority.
- Enrollment URLs, agent tokens, workspace/company identifiers, private
  prompts, model paths, and raw memory payloads are secrets or private data and
  must not appear in public receipts, logs, screenshots, URLs, or errors.
- Raw model text may advise but cannot authorize actions, declare evidence,
  alter security policy, or become executable instructions.

Research and resolve all of the following:

1. Construct an asset/actor/trust-boundary threat model covering user, UI,
   worker, WASM, Rust runtime, companion, peer, catalog, source repository,
   MemoryEndpoints, service worker, browser extensions, local storage, build
   system, public sites, and release operator.
2. Enumerate threats using at least STRIDE plus privacy and supply-chain lenses.
   Include malformed model dimensions, integer overflow, parser bombs,
   tokenizer/template attacks, artifact substitution, malicious peers, replay,
   stale proof, compromised catalog, prompt injection, memory injection,
   browser API abuse, loopback attacks, and build artifact replacement.
3. Define a closed artifact parser boundary with bounded lengths/counts/depth,
   checked arithmetic, canonical encodings, duplicate/unknown rejection,
   streaming hash verification, decompression policy, no archive traversal,
   no symlink/reparse trust, and no executable fields.
4. Analyze raw WASM ABI threats: invalid pointers, lengths, kind confusion,
   stale result pointers, reentrancy, traps, allocation exhaustion, mutable
   globals, unexpected imports/exports, memory growth, and confused-deputy
   calls. Provide mitigations and fuzz oracles.
5. Design a secure worker sandbox and page policy. Cover CSP directives,
   worker sources, connect-src separation, COOP/COEP tradeoffs, no dynamic code,
   no implicit telemetry, network request monitoring, service-worker scope,
   dependency integrity, and browser support.
6. Specify loopback-companion security with origin allowlists, capability
   authentication, per-operation IDs, DNS rebinding defense, CSRF, CORS,
   preflight, Host/Origin validation, TLS tradeoffs, port discovery, request
   limits, and filesystem capability confinement.
7. Define secret/data-flow policy for prompts, model bytes, enrollment URLs,
   agent tokens, memory payloads, traces, screenshots, crash reports, browser
   stores, clipboard, referrer, history, analytics, and public evidence.
8. Design memory and prompt-injection containment. Retrieved/quoted content is
   typed as untrusted data; model output cannot issue privileged commands.
   Define explicit user/tool authorization and provenance-aware context
   construction.
9. Provide a Rust and JavaScript fuzzing strategy: parser fuzzers, ABI stateful
   fuzzing, property tests, model-based protocol fuzzing, differential parsers,
   coverage, corpus minimization, sanitizer-capable native surrogates, and
   reproducible crash receipts.
10. Define supply-chain controls for Cargo, npm or direct browser assets, .NET,
    WASM, model conversion tools, lockfiles, SBOM, provenance, signed release
    metadata, source maps, symbols, secret scans, malware scan boundaries, and
    dependency updates.
11. Design adversarial browser and companion tests with malicious origins,
    extensions considered out of trust, hostile service workers, corrupted
    stores, peer races, stale operations, leaked URLs, and network capture.
12. Produce a severity-ranked remediation plan and objective release blockers.
    Explain which risks require redesign before launch and which residual risks
    can only be disclosed and monitored.

Required report structure:

1. Executive security recommendation and assumptions.
2. Assets, actors, and trust-boundary diagrams.
3. Threat register with severity and evidence.
4. Artifact/parser and raw-ABI hardening profile.
5. Worker/page and loopback-companion controls.
6. Privacy, secret, and untrusted-memory contract.
7. Stateful fuzzing and adversarial test architecture.
8. Supply-chain and build integrity controls.
9. Incident, revocation, quarantine, and recovery procedures.
10. Objective prelaunch security gates.
11. Prioritized remediation plan.
12. Unknowns requiring private inspection or authorized testing.
13. Annotated primary-source bibliography with dates and immutable links.

Do not recommend permissive parsing, arbitrary template execution, trusting a
hash supplied by the same unverified producer without recalculation, logging
secrets for debugging, treating localhost as trusted by default, allowing model
text to authorize tools, retaining an insecure old path, or claiming that WASM
alone is a complete sandbox.

## Prompt 9: Authoritative Chat UX, Streaming Semantics, And Duplicate-Free Rendering

You are an independent principal AI interaction architect, frontend state
machine engineer, and accessibility/reliability specialist. Produce an
exceptionally detailed report defining a professional browser-local chat
experience backed by one authoritative worker/runtime event stream, with no
duplicate assistant rendering, hidden response repair, or misleading status.
Target 12,000 to 20,000 words excluding the bibliography.

Research current primary browser, HTML, ARIA, WCAG, event-loop, streaming UI,
Web Worker, responsive layout, virtualized-list, reduced-motion, keyboard, and
screen-reader documentation. Use human-computer interaction research where
relevant and label recommendations separately from sourced facts. You have no
access to TinyRustLM HTML/CSS/JavaScript, screenshots, design files, model
outputs, tests, or analytics. Do not claim that you inspected the product.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is a prelaunch browser-local chat interface. Its approved visual
  language should remain coherent, but functional code may be rewritten
  completely. There is no old UI behavior that must be supported.
- The first screen is the usable chat experience, not a marketing landing
  page. Introductory prompt cards disappear after chat begins; the center
  column becomes the conversation workspace; the composer remains usable.
- One dedicated worker emits authoritative structured lifecycle events and one
  terminal raw response per generation. The UI cannot call WASM, repair text,
  complete a truncated answer, retry secretly, select best-of-N, or deduplicate
  repeated words that the model genuinely generated.
- Exactly one assistant message may be rendered for one authoritative
  generation completion. Late output from stale workers, operations,
  compositions, conversations, turns, or generations is rejected.
- Models are acquired P2P-first or converted by the local companion. The UI
  must communicate truthful stages and actionable blockers, not download text
  instructions or show `ready` from metadata alone.
- The website must not receive prompts or model bytes. Memory retrieved from a
  hosted service is visibly distinguishable from current conversation state
  and remains untrusted input.
- The interface must work at desktop, narrow desktop, and mobile widths, with
  long model names, long output, keyboard navigation, screen readers, reduced
  motion, cancellation, errors, and model switching.

Research and resolve all of the following:

1. Define a frontend domain model separating catalog candidate, acquisition
   operation, verified composition, active runtime, conversation, turn,
   generation, streamed progress, terminal raw output, render record, memory
   status, and public-safe error. UI labels must derive from these types.
2. Build the complete UI state machine from initial no-model state through
   acquisition, activation, first message, generation, cancellation, terminal
   output, subsequent turns, model switch, runtime failure, worker replacement,
   and profile deletion. State legal controls in every state.
3. Specify one authoritative rendering algorithm. Bind DOM message identity to
   conversation/turn/generation/message identities, make completion insertion
   idempotent, reject stale events, preserve model-generated repetition, and
   prevent competing Promise callbacks or event listeners from rendering.
4. Distinguish token/progress display from final output. Decide whether partial
   decoding is authoritative, provisional, or absent. Address UTF-8 boundaries,
   Markdown incrementality, cancellation, final reconciliation, accessibility,
   and exact raw-output preservation.
5. Define honest acquisition and runtime status vocabulary. Include searching,
   peer unavailable, transferring, verifying, converting locally, unsupported,
   quality unproven, activating, ready, generating, cancelling, cancelled,
   failed, released, and stale. Prevent optimistic labels from becoming proof.
6. Design errors and recovery actions. Errors should be bounded, public-safe,
   specific enough to act on, and linked to a new explicit operation when a
   retry is allowed. No automatic response retry or hidden fallback is allowed.
7. Specify model switching UX with transactional activation. Keep the current
   model usable while a candidate is prepared when memory policy permits;
   explain preflight rejection, cancellation, old-generation races, and when
   conversation/KV continuity is invalidated.
8. Define conversation workspace behavior: disappearing starter prompts,
   stable center layout, fixed/anchored composer, long content, code blocks,
   JSON, scroll anchoring, user-controlled auto-scroll, copy/select, focus
   return, and no layout shifts from status changes.
9. Produce responsive and accessibility requirements. Cover semantic regions,
   headings, form labels, live regions, busy states, focus order, focus traps,
   keyboard-only operation, touch targets, contrast, zoom/reflow, reduced
   motion, screen-reader announcement timing, and non-color status cues.
10. Specify privacy-visible behavior without feature narration. Show local
    model/runtime status and hosted-memory status accurately while avoiding
    accidental prompt/model exposure in URLs, telemetry, screenshots, error
    details, or DOM attributes.
11. Design unit, component, protocol, browser, visual, accessibility, and
    adversarial tests. Include duplicated/delayed events, repeated model text,
    long names, huge responses, cancellation races, worker death, mobile
    keyboard, resize, zoom, offline operation, and screen-reader assertions.
12. Define acceptance evidence and an implementation/deletion plan that leaves
    one event reducer and one rendering path. Identify searches and tests that
    prove old direct-WASM calls, output cleanup, and duplicate handlers are gone.

Required report structure:

1. Executive UX/reliability recommendation and assumptions.
2. Frontend domain types and authority boundaries.
3. Complete interaction state machine.
4. Exactly-once render reducer and pseudocode.
5. Partial/final output and cancellation semantics.
6. Acquisition, runtime, and error status vocabulary.
7. Responsive workspace specification.
8. Accessibility interaction specification.
9. Privacy-visible behavior and data-flow constraints.
10. Test and adversarial race matrix.
11. Objective acceptance and deletion-closure checklist.
12. Prioritized implementation plan.
13. Unknowns requiring private UI inspection or real-browser execution.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend a second rendering path for compatibility, text-based
deduplication, automatic answer repair, best-of-N selection, simulated model
text, marketing claims as status, instruction-file downloads, silent model
fallback, inaccessible icon-only status, or screenshots as the sole UI test.

## Prompt 10: TDD, Stateful Fuzzing, And Cross-Browser Evidence For The Full Vertical Slice

You are an independent principal test architect, property-testing researcher,
and browser automation reliability engineer. Produce an exceptionally detailed
test strategy for a clean-slate browser-local model vertical slice spanning
artifact acquisition, composition verification, WASM activation, multi-turn
generation, cancellation, rendering, release, and fresh-profile deletion.
Target 12,000 to 20,000 words excluding the bibliography.

Research primary documentation for Rust unit/property/fuzz testing, cargo-fuzz
and libFuzzer, model-based/state-machine testing, WebAssembly inspection and
execution, Node test harnesses, Playwright, browser profiles, service workers,
storage APIs, network interception, accessibility testing, and statistical
analysis. Pin public repository examples to immutable revisions. You have no
access to TinyRustLM source, test fixtures, private artifacts, model outputs,
browser receipts, credentials, or CI. Do not imply private validation.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is prelaunch and has no compatibility obligation. Tests should
  drive one authoritative implementation and deletion of superseded SLM1/ACG1,
  direct-WASM UI, task-specific generation, repair, and fallback paths.
- A dedicated worker owns one raw-ABI WASM runtime. It activates an exact ACG2
  composition containing SLM2, Tokenizer2, Template2, Sampling2, and Prompt2.
  Model ownership moves into the runtime without an unbounded second copy.
- Every mutation is bound to an operation identity. Worker messages carry
  worker, operation, composition, conversation, turn, generation, message, and
  sequence identities. One terminal output is consumed and rendered once.
- Raw output cannot be repaired, retried secretly, selected best-of-N, or
  modified to satisfy an evaluator. Model-generated repeated text remains.
- P2P-first acquisition and local conversion are real operations; metadata,
  tiny fixtures, mocks, and instruction downloads cannot satisfy a real-model
  browser gate.
- Campaign targets eventually include 20 qualified model identities, 50
  deletion-backed browser rounds, 25 authorized live memory continuity rounds,
  40 current outside-network lane proofs, and 20 live catalog announcements.
  Project-supplied current counts are all zero; this report cannot change them.

Research and resolve all of the following:

1. Define a claim-to-test matrix from parser smoke through structural validity,
   numerical parity, deterministic token parity, behavioral quality, real
   browser execution, privacy, memory continuity, public P2P reachability,
   deployment, and publication. State prohibited claim escalation.
2. Design a test pyramid appropriate to risk, not fashion: pure Rust unit and
   property tests, parser/ABI fuzzing, native integration, raw WASM Node tests,
   worker protocol tests, browser component tests, real-model browser tests,
   package consumers, deployment readback, and authorized live systems.
3. Specify model-based state machines for raw ABI, worker protocol, acquisition,
   runtime lifecycle, generation/cancellation, and UI rendering. Give command
   generators, preconditions, reference-state transitions, invariants,
   shrinking, replay seeds, and failure persistence.
4. Create a hostile raw-ABI matrix covering every transfer kind, limit,
   pointer/kind/length mismatch, duplicate staged value, stale operation,
   invalid lifecycle call, result-pointer lifetime, malformed JSON, trap,
   allocation pressure, and release. Explain native surrogate versus actual
   WASM coverage.
5. Design artifact/parser fuzzing for ACG2 and all five members. Include valid
   corpus generation, structure-aware mutation, byte mutation, cross-field
   inconsistencies, length/hash attacks, dimension overflow, tokenizer bombs,
   template complexity, sampling edge cases, differential oracles, and corpus
   retention.
6. Specify deterministic native-versus-WASM parity tests with scalar
   intermediates, quantized kernels, logits, sampled tokens, decoded output,
   KV-prefix reuse, cancellation, context limits, and model switching. Separate
   synthetic public fixtures from private real-model evidence.
7. Design browser-profile lifecycle tests. A real round creates an owned fresh
   persistent profile, performs genuine multi-turn model execution, closes the
   browser process, proves no leaked handles, deletes the profile safely, and
   records deletion. A reload or storage clear is insufficient.
8. Define browser network/privacy assertions across page, service worker,
   worker, companion, catalog, peers, and hosted memory. Scan URLs, headers,
   request bodies, browser stores, profile files, traces, screenshots, logs,
   UTF-8/UTF-16/base64 representations, and compressed stores for secrets and
   private payloads.
9. Build an exactly-once rendering oracle that distinguishes duplicate UI
   delivery from legitimate repeated model text. Include stale workers,
   duplicated events, out-of-order sequences, cancellation races, component
   remounts, navigation, and delayed completion.
10. Specify cross-browser and platform coverage. Distinguish compile success,
    Node WASM execution, headless browser, headed browser, Windows/Linux host,
    emulation, and real hardware. Define minimum evidence for Chromium,
    Firefox, WebKit, desktop widths, mobile widths, and accessibility.
11. Design durable, content-addressed test receipts binding source revision,
    artifacts, runtime/WASM bytes, browser build, worker/UI assets, profile
    lifecycle, prompt private hash, raw output private hash, evaluator, result,
    and redaction. Failed evidence is append-only and never overwritten.
12. Provide a TDD implementation sequence. Each observed failure becomes a
    minimal general regression test, then a scoped fix, broad gate, coherent
    commit, and selective rerun based on invalidation. Define flake handling and
    ban retry-until-green behavior.

Required report structure:

1. Executive test/evidence recommendation and assumptions.
2. Claim taxonomy and claim-to-test matrix.
3. Layered test architecture and ownership.
4. Model-based state machines and generators.
5. Parser, ABI, and protocol fuzzing design.
6. Numerical and behavioral parity tests.
7. Fresh-profile real-browser procedure.
8. Network, privacy, accessibility, and rendering assertions.
9. Cross-browser/platform evidence matrix.
10. Receipt schemas, invalidation, and failure preservation.
11. TDD workflow and CI gate ordering.
12. Objective vertical-slice acceptance checklist.
13. Unknowns requiring private artifacts or authorized systems.
14. Annotated primary-source bibliography with dates and immutable links.

Do not count compilation as execution, Node as a real browser, a tiny fixture
as a production model, a reload as profile deletion, mocks as live service
proof, retry-until-green as reliability, keyword matching as semantic quality,
or one successful transcript as model qualification.

## Prompt 11: Reproducible WASM Packaging, Service-Worker Freshness, And Multi-Site Release Integrity

You are an independent principal release engineer, browser supply-chain
architect, and documentation operations lead. Produce an exceptionally detailed
report specifying how a Rust/WASM browser runtime, worker, UI assets, companion
packages, schemas, and public documentation can be built, versioned, deployed,
and read back as one coherent prelaunch release without stale assets or
unsupported old code. Target 12,000 to 20,000 words excluding the bibliography.

Research primary Cargo/Rust, wasm-tools, WebAssembly linker, .NET/NuGet,
JavaScript module, Subresource Integrity, CSP, HTTP caching, service worker,
Cloudflare or standards-based static hosting, SBOM, SLSA/provenance, SourceLink,
symbol package, reproducible-build, semantic versioning, and documentation
testing sources. Pin public repositories to immutable revisions. You have no
access to TinyRustLM repositories, build outputs, deployment credentials,
domains, package feeds, or CI. Do not claim a release or deployment.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is one prelaunch product. Technical labels such as SLM2 and ACG2
  are contract names, not a public V2 product. There is no released legacy
  population and no reason to ship compatibility packages, routes, assets, or
  documentation.
- The production browser release consists of a raw-ABI WASM module, dedicated
  worker, UI JavaScript/CSS/HTML, strict composition/member schemas, and a
  canonical Rust runtime. A Rust/.NET companion performs local conversion and
  P2P hosting. Multiple public sites provide product, catalog, protocol, and
  documentation information.
- Every site must publish a visible release/version identifier, release date,
  last-published timestamp, and consistent change log. Documentation is a
  release component, not optional cleanup after code ships.
- Large model bytes, credentials, private prompts, and raw private evidence do
  not belong in source control or website deployments. Source, schemas, tests,
  bounded public receipts, and documentation do.
- A deployment is not complete until the expected HTTPS origin is read back
  and its content identities, headers, asset graph, version, and change log are
  verified. Package creation is not publication; upload is not consumer proof.
- Source should be committed and pushed after each coherent major change that
  builds. Deployment occurs when the complete relevant test gates pass.

Research and resolve all of the following:

1. Define a release identity graph binding source commit/tree, Cargo lockfile,
   Rust toolchain, target, build flags, WASM bytes, worker/UI assets, schemas,
   companion binaries, NuGet packages, SBOM, provenance, site manifests,
   documentation version, and deployed readback.
2. Specify reproducible WASM build controls: pinned toolchain, locked
   dependencies, target features, panic strategy, allocator, LTO, linker
   maximum memory, exact import/export allowlist, optimization tools, build
   environment, source-date handling, and independent binary inspection.
3. Design asset naming and dependency graphs using content hashes. Explain how
   HTML, worker module, WASM, CSS, schemas, and optional source maps reference
   one another atomically and how partial deployment is detected.
4. Define HTTP cache policy per artifact. Cover immutable hashed assets,
   revalidated HTML/manifests, WASM MIME type, CSP, SRI limitations for workers
   and dynamic fetches, ETag/content encoding, range behavior, CDN cache purge,
   clock skew, and rollback.
5. Design a service-worker policy that cannot preserve stale runtime paths.
   Decide whether a service worker is justified. If present, specify versioned
   cache names, install/activate transactionality, precache allowlist, old-cache
   deletion, navigation fallback constraints, update UX, offline truthfulness,
   and tests for mixed versions.
6. Specify Rust/.NET companion packaging for `win-x64`, `linux-x64`, and
   `linux-arm64`. Cover native assets, self-contained archives, NuGet runtime
   identifiers, SourceLink, portable PDB, `.snupkg`, hashes, licenses, SBOM,
   package-consumer tests, signing, and distinction among cross-compilation,
   emulation, and real hardware execution.
7. Define a prelaunch version and change-log policy that avoids calling the
   product V2 while still giving every release a unique, sortable identity.
   Include machine-readable and human-readable forms, release dates,
   last-published timestamps, breaking clean replacements, and no legacy notes
   for behavior that was never public.
8. Design documentation-as-code across product and documentation sites. Define
   canonical ownership, generated reference boundaries, architecture/contract
   links, examples, user workflows, status truth, link checking, code snippet
   tests, terminology linting, cross-site version drift detection, and release
   blockers for stale docs.
9. Specify release gates and ordering for format/parser, runtime, WASM, worker,
   UI, acquisition, companion, packages, sites, and live integrations. A gate
   must identify exact inputs, outputs, evidence, expiry, and invalidation.
10. Design atomic deployment and rollback. Preserve failed deployments, avoid
    mixed assets, verify secrets are absent, publish to staging if useful,
    switch production authority once, read back externally, and roll back by
    immutable release rather than compatibility code.
11. Provide external readback tests for every site and package. Verify DNS/TLS,
    status, redirects, headers, content hashes, worker/WASM load, cache behavior,
    release metadata, change log, documentation links, package installation,
    and absence of obsolete assets or claims.
12. Produce an operator runbook and dashboard reporting current operation,
    source/publish identities, site status, package status, last publish,
    blockers, rollback target, and campaign counters without deriving `done`
    from unit tests alone.

Required report structure:

1. Executive release recommendation and assumptions.
2. Release/content identity graph.
3. Reproducible WASM and companion build profile.
4. Hashed asset, HTTP cache, and service-worker design.
5. Cross-platform package and supply-chain controls.
6. Version, release-date, last-publish, and change-log standard.
7. Documentation-as-code and cross-site consistency gates.
8. Release gate and invalidation matrix.
9. Atomic deploy, readback, rollback, and retention runbook.
10. Operator dashboard specification.
11. Objective publication acceptance checklist.
12. Prioritized implementation plan.
13. Unknowns requiring repositories, credentials, or live origins.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend stale-while-revalidate for authority-critical HTML without a
truthful consistency design, unversioned WASM names, a service worker that
caches arbitrary old paths, package generation as publication proof,
cross-compilation as ARM64 execution, documentation updates after release,
runtime compatibility code as rollback, or claiming deployment before HTTPS
readback.

## Prompt 12: Clean-Cut Production Closure, Deletion Proof, And Honest Dogfood Promotion

You are an independent principal systems architect, release-governance lead,
and prelaunch technical-debt eradication reviewer. Produce an exceptionally
detailed end-to-end closure plan for replacing a browser-local AI product's old
model execution path with one enterprise-quality production path, deleting all
superseded code, and promoting it only through objective real-model and
real-browser evidence. Target 15,000 to 25,000 words excluding the bibliography.

Research primary sources for architecture conformance, dependency and call
graph analysis, Rust/Cargo and .NET build graphs, browser/WASM testing,
content-addressed evidence, append-only receipts, formal state machines,
software release governance, documentation drift prevention, and failure-driven
development. Pin public repository observations to immutable revisions. You
have no access to TinyRustLM source, artifacts, tests, logs, credentials,
services, or deployment systems. Do not claim that this report completes any
private gate.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is one prelaunch product. There is no V1/V2 product split and no
  installed legacy population. SLM2, Tokenizer2, Template2, Sampling2, Prompt2,
  and ACG2 are current technical contract names. Compatibility aliases,
  migration readers, dual runtimes, fallbacks, feature flags for old code, and
  deferred cleanup are forbidden.
- The intended authoritative browser path is: user selects a model; acquisition
  finds an identity-matching quality-qualified P2P composition or asks the
  local companion to convert immutable source; the browser transfers exact
  members to a dedicated worker; a raw-ABI WASM module validates and
  transactionally activates them; the canonical runtime performs multi-turn
  generation; the worker emits one raw terminal output; the UI renders it once.
- The ACG2 composition is exactly 896 bytes and binds exactly five members:
  SLM2 model, Tokenizer2, Template2, Sampling2, and Prompt2. Unknown or duplicate
  members, stale operations, and unsupported behavior fail closed.
- Model bytes move into the runtime without an unbounded second copy. The UI
  never calls WASM or owns model/KV bytes. The worker cannot access the network.
  Output cannot be repaired, retried secretly, completed, or selected best-of-N.
- Old executable surfaces are known to include or may include an old browser
  WASM tree, SLM1/ACG1 admission, direct UI-to-WASM calls, task-specific text or
  JSON generation exports, output cleanup/repair, stale fixtures, manifests,
  packages, service-worker assets, docs, and release scripts. Every reachable
  occurrence must be replaced or deleted, not merely labeled deprecated.
- MemoryEndpoints.com may provide authorized live memory continuity, while
  MiniModel.org provides catalog/P2P discovery. Neither may be simulated for a
  live claim. Project sites receive neither prompts nor model bytes.
- Final campaign targets are 20 distinct quality-qualified model hashes, 50
  passing deletion-backed clean-browser rounds, 25 authorized live memory
  restore/cleanup rounds, 40 current externally proven P2P lane receipts, and
  20 live catalog announcements. Supplied current counts are all zero.
- Source, tests, schemas, documentation, and bounded safe evidence must be
  committed and pushed regularly. Large models, credentials, private prompts,
  and raw sensitive evidence remain outside source control. All public sites
  and documentation must stay synchronized with actual releases.

Research and resolve all of the following:

1. Define the target architecture and authority map for acquisition,
   conversion, artifact formats, composition verification, runtime, raw WASM
   ABI, worker protocol, UI rendering, behavioral evaluation, memory, P2P,
   release, deployment, and documentation. Exactly one owner exists per concern.
2. Construct a repository/build/package/deployment inventory method capable of
   finding old paths in Cargo workspaces and orphan manifests, .NET solutions,
   JavaScript imports and dynamic URLs, generated files, copied WASM assets,
   fixtures, service-worker caches, archives, docs, CI, deployment scripts, and
   public sites.
3. Define replacement dependencies and topological implementation order. Avoid
   a long-lived dual path while preserving small green commits. State when a
   temporary compile-only intermediate is acceptable and require its removal
   before merge/release.
4. Specify deletion closure for every superseded producer and consumer. Include
   negative source searches, dependency graphs, exact export inspection,
   package/archive contents, deployed asset readback, service-worker cache
   behavior, docs/link checks, and a CI denylist preventing reintroduction.
5. Design the complete production state machine from candidate selection to
   active conversation and release. Cover acquisition, validation, activation,
   operation/transcript identities, generation, cancellation, terminal output,
   model switch, release, worker replacement, and terminal rejection.
6. Define enterprise quality gates for Rust formatting/lint/tests, unsafe-code
   review, parser fuzzing, raw WASM build/inspection, Node hostile ABI,
   native-WASM parity, real-model activation, worker races, UI rendering,
   privacy/network assertions, accessibility, packages, fresh-profile browser
   execution, deployment readback, and documentation consistency.
7. Create a failure-to-regression workflow. Preserve raw failure privately,
   derive a minimal general test without copying sealed answers into training,
   make a scoped fix, rerun only content-addressedly invalidated phases, archive
   old decisions, commit/push the coherent change, and update durable memory.
8. Define content-addressed, append-only evidence schemas for conversion,
   composition, numerical parity, behavioral quality, browser round, memory
   continuity, peer lane, outside proof, catalog announcement, package, site,
   deletion closure, and final release. A single boolean `passed` is forbidden.
9. Design the staged promotion route for one real model, five diverse useful
   models, and twenty distinct useful models. Distinguish meaningful model
   diversity from relabeled bytes, precision-only catalog theater, and
   unqualified source popularity.
10. Specify the 50-round browser campaign and its 25-round live-memory branch.
    Every round uses a new owned persistent profile, genuine multi-turn model
    output, process close, profile deletion proof, privacy scan, and immutable
    receipt. Live MemoryEndpoints companies are uniquely created, restored,
    closed, deleted, and verified under authorization.
11. Specify the 40-lane P2P proof and 20-announcement gate. Two lanes per model
    are independent processes sharing one read-only artifact store. Both require
    current signed outside-network proof. Local/LAN/NAT-hairpin checks do not
    count as public reachability.
12. Produce a prioritized closure plan with commit boundaries, full-gate
    milestones, deployment points, stop conditions, external blockers, rollback
    by source/release identity, documentation/public-site updates, and an
    objective final definition of zero known compatibility debt.

Required report structure:

1. Executive clean-cut recommendation and explicit assumptions.
2. Target authority/component/data-flow architecture.
3. Repository, build, package, deployment, and documentation inventory method.
4. Dependency-ordered replacement plan.
5. Superseded-path deletion-closure algorithm.
6. Production lifecycle and operation state machines.
7. Enterprise test/release gate matrix.
8. Content-addressed receipt and invalidation graph.
9. Failure-to-regression and source-control workflow.
10. Staged 1/5/20 model promotion plan.
11. Fifty-browser, live-memory, P2P, and catalog campaign protocol.
12. Documentation and multi-site publication controls.
13. Objective final acceptance and remaining-risk checklist.
14. Prioritized implementation milestones and stop rules.
15. Unknowns requiring private inspection or authorized production access.
16. Annotated primary-source bibliography with dates and immutable links.

Do not recommend compatibility shims, dual readers, old-runtime feature flags,
disabled-but-retained production code, mocked live services, fixture-based model
claims, local P2P as public proof, cross-compilation as hardware execution,
repairing raw output, training on sealed evaluation cases, postponing docs, or
calling the campaign complete from unit tests alone.

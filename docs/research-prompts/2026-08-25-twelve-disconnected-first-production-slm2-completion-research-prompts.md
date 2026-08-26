# Twelve Disconnected Research Prompts: First Production SLM2 Completion

Each section below is a complete standalone assignment. Send each entire
section to a different technical research agent. The agents do not share
context and have no access to the TinyRustLM source tree, private artifacts,
source-control history, test output, development machines, credentials,
unpublished evaluation cases, prior reports, or other prompts in this packet.

The reports are advisory research inputs only. They cannot establish that
private code works, authorize an irreversible model operation, satisfy a
release gate, or advance a campaign counter. Every researcher must use current
primary sources wherever possible, record source publication or update dates,
state the report retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Every report must
clearly separate:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that could not be independently verified;
4. engineering analysis and recommendations;
5. assumptions, uncertainties, alternatives, and source disagreements; and
6. facts requiring private source inspection, local execution, physical
   browser or hardware tests, credentials, external peers, or authorized
   production access.

Every report must be exceptionally detailed and technical. Include concrete
algorithms, canonical schemas, state machines, pseudocode, equations, bounded
resource models, threat models, negative cases, fault injection, objective
acceptance criteria, and a prioritized implementation sequence. Generic
tutorials, marketing summaries, invented measurements, and proposals to retain
hypothetical prelaunch compatibility are not useful.

## Prompt 1: Formal Audit Of A Sole One-Shot Model-Composition Verification Owner

You are an independent principal reliability engineer, formal-methods
researcher, Windows process-lifecycle specialist, and cryptographic evidence
architect. Produce a deeply technical, hostile design audit for a sole process
owner that performs one irreversible model-composition operation, captures all
child-process evidence byte exactly, derives one terminal decision, and later
verifies the result without executing anything. You have internet access but
no TinyRustLM code, private files, operation requests, logs, model artifacts,
credentials, or machine access. Do not claim to have inspected or validated
private implementation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
inspection or exact-host execution. Make the report exceptionally detailed,
with algorithms, schemas, state tables, pseudocode, threat models, fault cases,
objective gates, and a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local language-model product. SLM2 is a
  technical artifact-format identity, not a product generation.
- There is no installed user base and no supported predecessor behavior.
  Clean replacement is required. Compatibility shims, aliases, migration
  paths, fallback implementations, retries, repair, best-of-N selection, and
  code debt are forbidden.
- One registered operation launches exactly two children in order: a
  deterministic converter and a managed structural inspector.
- Before execution, an output-free public registration and a closed private
  request bind exact source revision, clean Git state, tool binaries, tool
  versions, source inventories, build inventories, model inputs, profile
  identities, arguments, limits, roots, and expected evidence names.
- Execution must start only when every registered evidence and output root is
  absent. Any existing root is terminal and is never resumed, adopted,
  cleaned, overwritten, or repaired.
- The owner creates all child stdout and stderr files itself using create-only
  semantics before launch, enforces byte and time limits, terminates the full
  child process tree when a limit is exceeded, writes bounded canonical
  terminal records, and creates one final verification record.
- The managed inspector receives exact native Windows paths through a
  create-only intent. It must validate an exact ten-member composition and may
  not reinterpret paths or discover unspecified files.
- A later `verify` command is read-only. It rehashes all evidence and outputs,
  reconstructs decisions, validates the complete composition graph, and is
  forbidden to launch a converter, inspector, build, model, or browser.
- Raw private streams and private filesystem paths must never enter public
  reports. Historical failed operations remain immutable and inert.

Research current primary sources for Windows process creation and handle
inheritance, Job Objects, console and GUI process trees, NTFS create and rename
semantics, file flushing, Node.js child-process behavior where relevant,
canonical JSON, cryptographic hashing, crash consistency, and state-machine
verification. Address all of the following:

1. Define a formal state machine from unmaterialized request through validated
   preflight, durable binding, durable start, converter terminal, inspection
   intent, inspector terminal, final decision, and read-only verification.
   Enumerate every allowed transition and make every other transition invalid.
2. Identify all crash windows, including crashes before and after each create,
   write, flush, close, child spawn, process exit, timeout, process-tree kill,
   and final verification write. For each window, state exactly what may exist
   and why later execution must refuse rather than infer success.
3. Specify how to bind executable identity and actual launched image identity
   despite symlinks, hard links, reparse points, path case, 8.3 names, PATH
   search, current-directory search, environment expansion, file replacement,
   and time-of-check/time-of-use races.
4. Compare Windows Job Objects, explicit descendant enumeration, process
   groups, task-kill utilities, and inherited-kill handles for bounded
   termination. State what can and cannot prove that no descendant survives.
5. Define byte-exact stdout/stderr capture with bounded files, backpressure,
   pipe closure, partial multibyte text, binary output, simultaneous streams,
   inherited handles, child grandchildren, and output-limit races. Raw streams
   must remain evidence, not control instructions.
6. Design same-directory create-only and atomic-finalization rules for JSON and
   large files on NTFS. Cover `CREATE_NEW`, write-through, flush ordering,
   directory durability limitations, antivirus interference, disk full,
   sharing violations, power loss, and Windows rename behavior.
7. Specify canonical serialization and hash domains. Distinguish request,
   binding, start, intent, process-terminal, output-member, composition, and
   final-verification identities. Prevent ambiguous numbers, Unicode drift,
   duplicate keys, unknown fields, path normalization drift, and self-hashing
   cycles.
8. Analyze whether a final record can truthfully distinguish pass, child
   rejection, timeout, output overflow, interrupted state, owner defect,
   evidence corruption, and unverifiable state without a single misleading
   boolean.
9. Define a genuinely independent read-only verifier. Explain how to avoid
   importing the execution path, trusting stored summaries, normalizing raw
   output, rerunning children, or silently accepting additional files.
10. Develop property-based, model-based, mutation, concurrency, and fault-
    injection tests. Include preexisting roots, concurrent owners, PID reuse,
    child escape, truncated streams, replaced executables, unknown JSON fields,
    malformed UTF-8, stale Git state, and post-run tampering.
11. Propose a TLA+, PlusCal, Alloy, state-transition table, or equivalent
    tractable model that can find double-launch, overwrite, adoption, and
    false-pass traces before implementation.
12. State the minimum objective evidence required before one new operation is
    authorized, and separately state which assurances still require local
    execution on the exact Windows host.

Required report structure:

1. Executive finding and explicit assumptions.
2. Public-source observation log with dates and immutable revisions.
3. Formal state machine and invariants.
4. Crash-window and residue matrix.
5. Executable, process-tree, and stream-custody design.
6. Filesystem durability and create-only algorithm.
7. Canonical identity and receipt graph.
8. Read-only independent-verification design.
9. Threat model and hostile race analysis.
10. Test, mutation, and fault-injection matrix.
11. Formal-model sketch with safety properties.
12. Objective authorization checklist.
13. Prioritized implementation recommendations.
14. Unknowns requiring private inspection or exact-host execution.
15. Annotated primary-source bibliography.

Do not recommend resuming a partial root, deleting ambiguous evidence, retrying
an irreversible operation, selecting a favorable outcome, trusting raw child
text as authority, or weakening identity checks to make an operation run.

## Prompt 2: Publisher-Exact Qwen3 0.6B Numerical Semantics And Tensor-Layout Proof

You are an independent principal ML runtime engineer, transformer-numerics
researcher, and model-format verification specialist. Produce a deeply
technical report defining how an independent implementation can prove the
publisher-exact numerical semantics of the dense Qwen3 0.6B model family from
immutable public source artifacts through a compact local runtime. You have
internet access but no TinyRustLM repository, private SLM2 files, converted
tensors, runtime traces, model cache, credentials, or unpublished tests. Do not
claim private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
inspection or execution. Make the report exceptionally detailed, with
equations, algorithms, schemas, traces, adversarial cases, objective gates, and
a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM executes compact language models locally in Rust and browser
  WebAssembly. Prompts and model bytes must not be uploaded to a project
  server.
- The immediate target is one provenance-bound Qwen3 0.6B composition. SLM2,
  Tokenizer2, and Template2 are exact technical formats and not product
  generations.
- A structural converter may emit a model, tokenizer, template, manifests,
  receipts, and composition graph, but structural validity is not numerical
  parity or conversational quality.
- The product is prelaunch. Incorrect or redundant implementation paths should
  be replaced cleanly, with no legacy support, compatibility layer, repair,
  fallback, or hidden postprocessing.
- Promotion requires independent comparison of the immutable public source,
  converted representation, scalar Rust execution, optimized Rust execution,
  and real browser execution.

Use official Qwen model cards, configuration and tokenizer files, immutable
repository revisions, Transformers source and documentation, Safetensors
specification, relevant Qwen technical reports, and primary numerical-computing
sources. Address all of the following:

1. Pin the exact publicly available Qwen3 0.6B base and instruct variants that
   are plausible targets. Record architecture configuration, vocabulary,
   hidden width, layers, attention heads, key/value heads, intermediate width,
   maximum context, rope parameters, normalization epsilon, activations,
   embedding tying, data types, chat-template status, license, and artifact
   revision. Clearly flag any field that differs across revisions or variants.
2. Derive the forward pass mathematically, including embedding lookup,
   RMSNorm placement, grouped-query attention head expansion, rotary position
   embedding convention, causal masking, attention scaling, softmax precision,
   residual ordering, gated MLP/SwiGLU equations, final normalization, tied or
   untied output projection, and logits.
3. Map every public tensor name to semantic role, expected rank, dimensions,
   orientation, transpose rule, concatenation rule, and layer index. Cover
   shard indexes, duplicate or missing tensors, tied storage, alignment,
   endianness, and unsupported extras.
4. Specify a streaming Safetensors reader and conversion proof that never
   loads an unbounded file into memory. Define bounds, offset validation,
   overlap detection, exact byte accounting, hash timing, and rejection of
   malformed headers, ambiguous dtypes, NaNs, infinities, and shape overflow.
5. Design layerwise reference traces that reveal layout errors earlier than
   final-token comparison. Include embedding vectors, normalized activations,
   projected Q/K/V, post-RoPE values, attention probabilities, attention
   outputs, MLP gate/up/down values, residuals, final hidden state, selected
   logits, and generated token IDs.
6. Define numerically meaningful tolerance policy by dtype and operation.
   Separate exact integer/token identities, bitwise float expectations,
   absolute and relative errors, cosine error, ULP distance, top-k stability,
   KL divergence, and sequence divergence. Explain why one global epsilon is
   inadequate.
7. Design adversarial micro-models and synthetic tensors that isolate transpose
   errors, head mapping, RoPE sign/interleave errors, masking off-by-one,
   tied-embedding mistakes, normalization order, accumulation precision, and
   endianness.
8. Explain deterministic source-framework oracle generation without exporting
   hidden reasoning or relying on mutable package defaults. Bind framework,
   package lock, model revision, tokenizer revision, prompt bytes, device,
   dtype, kernels, seed, and trace schema.
9. Analyze CPU, SIMD, WASM SIMD, and optional WebGPU differences that can
   produce legal floating-point variation. State which differences are
   acceptable and which indicate semantic drift.
10. Specify cross-runtime differential tests over prompt lengths, batch size
    one, empty and unusual Unicode input, context boundaries, repeated tokens,
    long generation, and cache/no-cache execution.
11. Define failure attribution. Distinguish source mismatch, converter defect,
    format defect, scalar kernel defect, optimized kernel defect, browser defect,
    tokenizer defect, template defect, and nondeterministic oracle.
12. Produce a staged proof route from tiny synthetic tensors to one real layer,
    full prefill, one-token decode, multi-token decode, and end-to-end browser
    generation.

Required report structure:

1. Executive recommendation and assumptions.
2. Immutable public target matrix and license findings.
3. Exact architecture equations.
4. Tensor-name, shape, orientation, and shard map.
5. Streaming conversion-validation algorithm.
6. Layerwise trace schema and oracle protocol.
7. Numerical tolerance and verdict policy.
8. Synthetic and adversarial vector suite.
9. Cross-runtime differential matrix.
10. Failure-attribution decision tree.
11. Objective promotion evidence.
12. Prioritized implementation sequence.
13. Unknowns requiring local model bytes or execution.
14. Annotated primary-source bibliography with dates.

Do not infer correctness from matching file size, a successful parse, one
plausible completion, benchmark reputation, or final-token agreement alone.
Do not propose output repair or a second runtime path retained as compatibility.

## Prompt 3: Accuracy-Preserving Weight, Activation, And KV-Cache Compression For Browser Qwen3

You are an independent principal quantization researcher, information-theory
specialist, and CPU/WASM kernel architect. Produce a deeply technical report on
the best current methods for reducing weight, activation, and KV-cache cost for
a dense approximately 0.6B Qwen3-class model while preserving useful
conversation quality in a browser-local runtime. You have internet access but
no TinyRustLM source, private model, calibration corpus, SLM2 format details,
measurements, GPUs, browser profiles, or evaluation cases. Do not claim local
results.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
models, measurements, or hardware. Make the report exceptionally detailed,
with derivations, packing diagrams, pseudocode, resource formulas, ablations,
objective gates, and a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch product using Rust and browser WebAssembly for
  local inference. Model bytes and prompts stay local or move directly between
  consenting peers.
- The first goal is one useful, provenance-bound Qwen3 0.6B composition, not a
  collection of relabeled artifacts.
- Accuracy matters more than a small headline bit count. Conversational
  coherence, practical judgment, instruction following, ambiguity handling,
  current-turn precedence, untrusted-memory handling, structured output, and
  lawful adult helpfulness are primary quality dimensions.
- Arithmetic can be delegated to a deterministic calculator.
- TurboQuant, TurboVec, KV-cache quantization, activation-aware methods,
  rotation-based methods, and very-low-bit research are topics for evaluation,
  not assumed dependencies or proven solutions.
- The product is prelaunch, so one best clean implementation should replace
  weaker paths. There is no requirement for legacy formats or fallback kernels.

Use papers, official repositories pinned to immutable revisions, artifact
licenses, and framework documentation. Distinguish peer-reviewed findings from
preprints, benchmarks from real deployments, and published facts from your
recommendations. Address all of the following:

1. Explain the algorithms and assumptions behind TurboQuant and TurboVec if
   those names resolve to public work. Disambiguate similarly named projects,
   identify primary authors and repositories, state licenses, and refuse to
   invent details when public documentation is incomplete.
2. Compare weight-only PTQ methods such as round-to-nearest, GPTQ, AWQ, HQQ,
   AQLM, QuIP/QuIP#, SpQR, SqueezeLLM, rotation-based QuaRot or SpinQuant,
   SmoothQuant-style transformations, and relevant current successors.
3. Compare practical formats including FP16/BF16, FP8 where CPU/browser
   relevant, INT8, INT6, INT5, INT4, ternary, 2-bit, and genuine 1-bit or
   1.58-bit approaches. Separate post-training quantization of an ordinary
   dense checkpoint from architectures trained from scratch for low-bit
   weights.
4. Derive memory and bandwidth formulas for weights, scales, zero points,
   codebooks, outliers, metadata, alignment, temporary unpack buffers,
   activations, and KV cache. Give formulas by layer, token, head, and context
   length rather than invented TinyRustLM measurements.
5. Analyze group size, per-channel versus per-group scaling, symmetric versus
   asymmetric quantization, clipping, outlier retention, mixed precision,
   embedding/lm-head treatment, and sensitive-layer exceptions for Qwen-style
   grouped-query attention and gated MLPs.
6. Compare KV-cache quantization schemes by K/V asymmetry, per-token versus
   per-channel scales, residual windows, key outliers, dynamic ranges, cache
   eviction, sliding windows, context length, and decode overhead. Include
   KIVI, KVQuant, MiniCache, H2O/SnapKV-style token retention only where
   semantically applicable, and newer primary work.
7. Analyze CPU and WASM kernel implications: packed layouts, SIMD lane width,
   unpack cost, lookup tables, integer dot products, dequantization fusion,
   cache lines, alignment, browser bounds checks, threads, and deterministic
   scalar references.
8. Design a calibration corpus that does not contain sealed evaluations.
   Cover ordinary dialogue, multilingual and Unicode text, code, JSON, long
   context, ambiguity, source conflict, memory precedence, practical planning,
   and adversarial quoted instructions. Explain sample-count and token-budget
   reasoning without inventing a universal optimum.
9. Define an ablation matrix that isolates weight precision, KV precision,
   rotation, group size, outlier policy, context length, and kernel path.
   Require source, float baseline, each quantized candidate, native runtime,
   and real browser runtime.
10. Specify accuracy metrics beyond perplexity: layerwise error, logit error,
    token agreement, sequence stability, semantic task success, refusal drift,
    structured-output validity, calibration, and human blinded preference.
11. Define stop rules and regression budgets that reject a smaller artifact
    when ordinary helpfulness or critical semantic invariants materially
    regress. Explain multiple-comparison control when many quantizers are tried.
12. Recommend one conservative first production profile and a separately
    labeled research ladder. Make clear what must be measured locally before
    any method is selected.

Required report structure:

1. Executive recommendation with confidence levels.
2. Public identity and license table for every named method.
3. Algorithmic derivations and assumptions.
4. Weight-format and metadata comparison.
5. KV-cache and activation-compression comparison.
6. CPU/WASM kernel implications.
7. Memory, bandwidth, and compute formulas.
8. Contamination-safe calibration design.
9. Ablation and statistical experiment matrix.
10. Accuracy and conversational-quality gates.
11. Conservative production candidate and research ladder.
12. Failure modes and rollback-by-rejection strategy.
13. Unknowns requiring private execution.
14. Annotated primary-source bibliography with dates.

Do not recommend a method solely because it advertises one bit, a small file,
or a benchmark win. Do not treat precision tiers of identical behavior as
distinct useful models, hide regressions, or retain a low-quality fallback.

## Prompt 4: Byte-Exact Qwen3 Tokenizer2 Conversion And Cross-Runtime Conformance

You are an independent tokenizer implementer, Unicode and text-encoding
specialist, and differential-testing architect. Produce a deeply technical
report specifying how to convert, encode, decode, stream, validate, and prove a
publisher-exact Qwen3 tokenizer in a bounded custom Tokenizer2 representation
usable by Rust and browser WebAssembly. You have internet access but no
TinyRustLM source, Tokenizer2 schema, local tokenizer files, private test
vectors, runtime, browser, or credentials. Do not claim private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
tokenizer bytes or local execution. Make the report exceptionally detailed,
with canonical schemas, byte examples, algorithms, complexity analysis,
adversarial vectors, objective gates, and a prioritized implementation
sequence.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local language-model product. Tokenizer2
  is a technical format identity and is the only intended tokenizer path.
- The target composition is a pinned Qwen3 0.6B model plus exact tokenizer and
  declarative chat template.
- Token IDs, decoded bytes, special-token treatment, and prompt framing must
  match the immutable publisher artifacts. A tokenizer that merely opens or
  produces readable text is insufficient.
- Runtime parsers must be canonical, bounded, dependency-conscious, and safe
  on hostile local or peer-provided bytes.
- There is no installed base. The implementation must not preserve an older
  tokenizer format, aliases, heuristic import, fallback tokenization, output
  repair, or silent normalization.

Research official Qwen tokenizer artifacts and model cards at immutable
revisions, Hugging Face Tokenizers and Transformers source and documentation,
the Tokenizers JSON schema as implemented, Unicode standards, regex semantics,
and browser text-encoding APIs. Address all of the following:

1. Identify the exact tokenizer algorithm used by relevant Qwen3 0.6B
   revisions. Pin vocabulary, merges or model representation, normalizer,
   pre-tokenizer, decoder, added tokens, special tokens, post-processor,
   chat-template relationship, byte fallback, and cleanup settings.
2. Explain every observable transformation from input UTF-8 bytes to token IDs
   and from token IDs back to bytes/text. Cover invalid UTF-8 policy, NUL,
   combining marks, normalization forms, variation selectors, emoji sequences,
   ZWJ, right-to-left text, lone surrogates at JavaScript boundaries, CRLF,
   tabs, repeated spaces, and end-of-text behavior.
3. Specify a canonical bounded Tokenizer2 data model. Include exact integer
   widths, string and byte lengths, vocabulary ordering, duplicate rejection,
   merge rank representation, added-token flags, special-token identity,
   regex identity, checksums, and unknown-field rejection.
4. Analyze regex portability among Rust regex engines, fancy-regex or PCRE-like
   behavior, JavaScript regex, and the publisher implementation. Identify
   constructs that cannot be assumed equivalent and recommend a deterministic
   implementation strategy.
5. Design asymptotically sound encode and decode algorithms with explicit
   bounds. Cover trie or hash lookup, BPE priority queues, merge invalidation,
   worst-case adversarial input, streaming chunks, allocation control, and
   deterministic tie breaking.
6. Define special-token policy for ordinary text, allowed-special sets,
   disallowed-special sets, prompt construction, generation termination, and
   decoded display. Prevent prompt text from accidentally gaining control-token
   meaning.
7. Build an independent differential oracle protocol pinned to immutable
   public packages. Bind source bytes, package versions, model revision,
   options, platform, output IDs, decoded bytes, and trace identity.
8. Specify test families: publisher examples, exhaustive short byte strings,
   randomized valid Unicode, malformed boundary inputs, every vocabulary
   token, every special token, merge-edge cases, long repeated text,
   multilingual content, code, JSON, and incremental decode.
9. Define metamorphic properties such as deterministic repeatability,
   encode/decode relationships where valid, concatenation caveats, no hidden
   normalization, and stable behavior across chunk boundaries.
10. Address hostile artifact parsing: oversized arrays, duplicate JSON keys,
    integer overflow, malicious regex, degenerate merge graphs, duplicate token
    bytes, invalid ranks, hash mismatch, and decompression bombs if packaging
    is used.
11. State exact acceptance criteria for source-framework, scalar Rust, native
    optimized Rust, and browser-WASM parity. Separate byte equality from
    intentional text replacement behavior at UI boundaries.
12. Provide a clean implementation sequence that produces one tokenizer path
    and deletes superseded executable paths before product activation.

Required report structure:

1. Executive recommendation and assumptions.
2. Immutable Qwen3 tokenizer identity matrix.
3. Publisher pipeline reconstruction.
4. Canonical Tokenizer2 schema proposal.
5. Encoding and decoding algorithms with complexity bounds.
6. Unicode, regex, and JavaScript-boundary analysis.
7. Special-token and control-token security policy.
8. Independent oracle and differential test design.
9. Hostile-input and fuzzing matrix.
10. Cross-runtime acceptance criteria.
11. Prioritized clean implementation plan.
12. Unknowns requiring local artifact inspection.
13. Annotated primary-source bibliography with dates.

Do not propose approximate tokenization, automatic fallback to a package at
runtime, browser execution of arbitrary tokenizer code, or hand-edited vectors
that conceal disagreement.

## Prompt 5: Declarative Qwen3 Template2, Context Assembly, And Sampling Exactness

You are an independent chat-template systems engineer, decoding-algorithm
researcher, and adversarial prompt-boundary specialist. Produce a deeply
technical report defining one declarative, bounded, cross-runtime contract for
Qwen3 chat framing, multi-turn context assembly, generation stopping, and
seeded sampling. You have internet access but no TinyRustLM source, Template2
schema, prompts, model outputs, private evaluation cases, runtime, or browser.
Do not claim local validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
prompts, outputs, or execution. Make the report exceptionally detailed, with
grammars, canonical schemas, algorithms, state machines, adversarial examples,
objective gates, and a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local chat product. Prompts remain local.
- The target is one pinned Qwen3 0.6B composition containing exact SLM2,
  Tokenizer2, Template2, and deterministic sampling identities.
- Template2 is intended to be declarative data. The browser and companion must
  not execute arbitrary Jinja, JavaScript, Python, or repository-supplied code.
- Product quality depends on role boundaries, current-user-preference
  precedence, untrusted quoted or retrieved memory, multi-turn references,
  direct lawful adult help, narrow safety boundaries, and no hidden output
  repair.
- One production path is required. There is no compatibility requirement for
  older prompt formats or sampling defaults.

Use official Qwen model cards, tokenizer configurations and chat templates at
immutable revisions, Transformers generation documentation and source, primary
sampling literature, and relevant prompt-injection research. Address all of
the following:

1. Reconstruct the exact relevant Qwen3 chat template, control tokens, role
   ordering, generation prompt, optional thinking controls if present, and
   end-of-turn/end-of-sequence behavior. Distinguish base and instruction
   checkpoints and revision drift.
2. Define a closed declarative Template2 grammar that can express the required
   template without general-purpose code execution. Specify allowed nodes,
   ordering, bounds, escaping, unknown-field rejection, canonical bytes, and
   identity derivation.
3. Specify role and trust semantics for system instructions, user turns,
   assistant turns, tool results, short-term state, durable memory, retrieved
   text, quoted instructions, and UI metadata. Treat memory and retrieved text
   as untrusted data unless a separate authority contract says otherwise.
4. Design deterministic context assembly with explicit token budgets. Cover
   system reservation, newest-turn precedence, whole-message truncation,
   summaries, memory selection, code blocks, tool records, long individual
   turns, and refusal to generate when a safe bounded context cannot be formed.
5. Analyze prompt-injection and delimiter-confusion attacks involving literal
   control-token text, role labels, malformed Unicode, nested quotations,
   retrieved HTML/Markdown, and adversarial memory. Define structural encoding
   rather than heuristic string filtering.
6. Define generation stop semantics over token IDs, not display substrings.
   Cover EOS, end-of-turn, maximum new tokens, cancellation, invalid token ID,
   repeated stop tokens, partial UTF-8 display, and completion-state truth.
7. Specify exact greedy and stochastic decoding algorithms. Cover logits dtype,
   temperature order, top-k, top-p, minimum tokens to keep, repetition penalty,
   tie handling, NaN/infinity rejection, softmax stabilization, seed algorithm,
   PRNG state, and sampling from finite precision probabilities.
8. Compare suitable deterministic PRNGs and define cross-language integer
   arithmetic needed for byte-for-byte seed replay in Rust and JavaScript/WASM.
   Explain why host-language random APIs are not a contract.
9. Define independent oracle vectors for prompt token IDs, budget decisions,
   processed logits, candidate sets, random draws, selected IDs, stop reason,
   and decoded bytes.
10. Build metamorphic tests for role order, stale versus current preference,
    authority conflicts, quoted instructions, memory insertion, message
    permutation, context pressure, sampling parameter boundaries, and equal
    logits.
11. State when deterministic parity is required and when statistical
    equivalence is appropriate. If the declared product uses one seeded path,
    explain why best-of-N or retry selection is invalid.
12. Provide acceptance criteria for source-framework assembly, scalar native
    execution, optimized native execution, and real browser execution without
    postprocessing candidate text.

Required report structure:

1. Executive recommendation and assumptions.
2. Immutable publisher-template findings.
3. Closed Template2 grammar and canonical schema.
4. Role, authority, and trust model.
5. Context-budget and truncation algorithm.
6. Prompt-injection boundary analysis.
7. Stop and completion-state contract.
8. Sampling mathematics and PRNG specification.
9. Oracle vectors and metamorphic tests.
10. Cross-runtime acceptance matrix.
11. Failure modes and fail-closed behavior.
12. Prioritized implementation sequence.
13. Unknowns requiring private prompts or execution.
14. Annotated primary-source bibliography with dates.

Do not recommend arbitrary template execution, fuzzy role parsing, hidden
prompt rewriting, automatic answer completion, retries chosen for quality, or
runtime support for superseded framing schemes.

## Prompt 6: Rust Scalar Oracle And Production CPU Kernels For Dense Qwen3 SLM2

You are an independent principal Rust performance engineer, numerical-kernel
specialist, and CPU microarchitecture researcher. Produce a deeply technical
report defining how to implement and validate one trustworthy scalar oracle and
one production optimized CPU execution path for a compact Qwen3-class SLM2
model. You have internet access but no TinyRustLM repository, SLM2 bytes,
kernel code, benchmark results, target computers, or private traces. Do not
claim private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
kernels, model bytes, or hardware. Make the report exceptionally detailed,
with equations, packing diagrams, kernel pseudocode, unsafe-code boundaries,
hostile tests, objective gates, and a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM performs local inference in Rust and browser WebAssembly.
- One Qwen3 0.6B composition must first prove source-framework, scalar Rust,
  optimized Rust, and browser parity.
- The scalar implementation is an oracle and test boundary, not a hidden
  fallback used to make production requests appear successful.
- The production is prelaunch. Superseded kernels should be removed, and no
  legacy dispatch, compatibility wrapper, silent repair, or quality-selecting
  retry should remain.
- Measurements must be real and bound to exact hardware, build, runtime,
  model, prompt, and method.

Research current Rust SIMD facilities and stabilization status, safe and
unsafe memory rules, x86-64 and ARM64 instruction sets, BLAS and inference
kernel literature, Qwen architecture sources, and reproducible benchmark
methodology. Address all of the following:

1. Define the scalar forward-pass oracle with explicit accumulation precision,
   operation ordering, bounds checks, tensor strides, quantized decode rules,
   NaN/infinity policy, and deterministic behavior.
2. Decompose prefill and token decode into kernels: embedding, RMSNorm, RoPE,
   quantized matrix-vector or matrix-matrix products, grouped-query attention,
   softmax, cache write/read, SwiGLU, residual add, final projection, and top-k
   selection.
3. Recommend canonical tensor packing and alignment for the chosen quantized
   profile. Analyze block metadata, scale placement, tail handling, page
   boundaries, mmap or buffered access, and streaming verification.
4. Compare portable scalar, compiler autovectorization, `std::simd` status,
   architecture intrinsics, generated microkernels, and carefully selected
   dependencies. Give a decision framework based on correctness, auditability,
   licensing, maintenance, and measured benefit.
5. Design x86-64 dispatch for realistic feature sets such as SSE4.1, AVX2,
   FMA, AVX-512 variants, VNNI, and relevant recent instructions without
   executing an unsupported instruction. Address CPUID, OS state, virtualized
   environments, and reproducible feature overrides for tests.
6. Design ARM64/NEON and dot-product support, distinguishing cross-compilation,
   emulation, and real hardware execution. Do not infer ARM performance from
   x86 or emulation.
7. Analyze threading strategy for batch-one chat. Cover Rayon or custom pools,
   work partitioning, false sharing, NUMA, oversubscription, browser companion
   coexistence, cancellation, deterministic reductions, and small-matrix
   overhead.
8. Derive memory, bandwidth, and arithmetic-intensity formulas for prefill and
   decode. Identify where quantization reduces bandwidth but unpacking or scale
   work dominates.
9. Specify a benchmark harness that separates cold load, warm load, prefill,
   first token, steady decode, long-context decode, and teardown. Include CPU
   affinity, power state, warmup, sample counts, robust statistics, outliers,
   thermal throttling, and memory peaks.
10. Define differential tests at every kernel boundary and full-model layer.
    Require adversarial shapes, tails, zero dimensions where invalid, extreme
    values, misalignment, corrupted blocks, and randomized property tests.
11. Address unsafe-code review, integer overflow, aliasing, out-of-bounds reads,
    uninitialized memory, denial of service, cancellation safety, and fuzzing.
12. Propose promotion rules that permit an optimized kernel only after parity
    and measured benefit, and removal rules that prevent multiple unowned
    production paths.

Required report structure:

1. Executive architecture recommendation.
2. Scalar oracle contract.
3. Kernel decomposition and dataflow.
4. Tensor packing and memory model.
5. x86-64 dispatch design.
6. ARM64 design and evidence requirements.
7. Threading and cancellation model.
8. Performance equations and bottleneck analysis.
9. Benchmark and statistical protocol.
10. Differential, property, fuzz, and sanitizer tests.
11. Unsafe-code threat model and review checklist.
12. Promotion and clean-removal criteria.
13. Unknowns requiring private implementation or hardware.
14. Annotated primary-source bibliography with dates.

Do not present synthetic throughput as product latency, cross-compilation as
executed hardware evidence, or scalar fallback as a way to conceal a broken
optimized path.

## Prompt 7: Real Browser-WASM Qwen3 Execution, Memory, Threads, And KV-Cache Architecture

You are an independent principal WebAssembly runtime engineer, browser memory
specialist, and local-inference performance researcher. Produce a deeply
technical report defining a production browser execution architecture for one
approximately 0.6B quantized Qwen3 SLM2 composition. You have internet access
but no TinyRustLM source, WASM module, model files, browser traces, performance
measurements, development machine, or private tests. Do not claim private
validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
WASM bytes or physical-browser execution. Make the report exceptionally
detailed, with memory equations, worker diagrams, kernel mappings, pseudocode,
fault matrices, objective gates, and a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM is a browser-local chat product. The public website must not
  receive prompts or model bytes.
- A local companion may acquire or convert exact artifacts, while inference
  runs in the browser through Rust-generated WebAssembly.
- Activation must use exact SLM2, Tokenizer2, Template2, sampling, and runtime
  identities. Structural conversion alone is not execution proof.
- Exactly one browser runtime path is desired. The prelaunch product has no
  legacy requirement, and broken paths must not be hidden by fallback, retry,
  simulated text, or server inference.
- Real Chromium, Firefox, and WebKit behavior matters. A unit-test mock or a
  JavaScript-generated response cannot satisfy browser inference.

Research current W3C WebAssembly specifications and proposals, browser vendor
documentation, WebAssembly SIMD and threads, SharedArrayBuffer isolation
requirements, memory growth, memory64 status, Web Workers, OPFS, transferable
objects and streams, WebGPU only as a separately gated option, and browser
resource constraints. Address all of the following:

1. Define a capability matrix for current stable desktop and mobile Chromium,
   Firefox, and WebKit/Safari covering WASM SIMD, relaxed SIMD, threads,
   SharedArrayBuffer, cross-origin isolation, memory limits, memory growth,
   memory64, OPFS, sync access handles in workers, transferable streams, and
   WebGPU. Record exact retrieval date and primary sources.
2. Propose one baseline browser architecture with main-thread UI, dedicated
   inference worker, model storage, tokenizer/template execution, cancellation,
   and immutable composition activation. Identify optional optimizations that
   cannot be assumed in the baseline.
3. Derive a full memory budget for WASM linear memory, model weights, indexes,
   quantization metadata, tokenizer, activations, scratch buffers, logits,
   worker messaging, browser copies, and KV cache by context length. Include
   formulas and fragmentation headroom.
4. Compare full copy, memory mapping analogues, OPFS synchronous reads,
   chunked reads, Blob slicing, ArrayBuffer transfer, SharedArrayBuffer, and
   direct streaming into verified storage. Explain where browsers still force
   copies.
5. Design prefill and decode execution around browser event-loop health.
   Address cooperative cancellation, progress messages, backpressure, worker
   termination, tab suspension, background throttling, visibility changes,
   mobile memory pressure, and browser process crashes.
6. Analyze WASM SIMD mappings for quantized matrix-vector kernels, RMSNorm,
   RoPE, softmax, and SwiGLU. Discuss alignment, lane extraction, widening,
   saturating operations, integer dot-product limitations, relaxed SIMD
   determinism, and scalar reference comparison.
7. Compare single-thread and shared-memory multithread execution. Include
   worker startup, pool sizing, atomics, false sharing, deterministic reduction,
   COOP/COEP deployment, third-party asset constraints, and failure when
   isolation headers are absent.
8. Define KV-cache layout and lifecycle for grouped-query attention. Cover
   contiguous versus paged layouts, quantization, context growth, cancellation,
   conversation reset, multiple chats, and secure erasure limitations.
9. Specify transactional runtime initialization: verify composition and every
   member, allocate bounded memory, load immutable metadata, run a deterministic
   health vector, then atomically declare ready. No partially initialized model
   may answer.
10. Design real-browser parity and performance evidence. Bind browser build,
    OS, hardware, headers, WASM hash, model composition, profile, viewport,
    prompt hash, timing method, memory method, and raw token IDs.
11. Develop failure injection for WASM trap, out-of-memory, worker crash,
    storage read failure, corrupt piece, thread deadlock, cancellation race,
    stale service worker, browser restart, and tab suspension.
12. State objective go/no-go thresholds as formulas or project-selected values,
    and clearly identify which values require local product decisions and real
    measurements.

Required report structure:

1. Executive recommendation and assumptions.
2. Current browser capability matrix with dates.
3. Baseline runtime and worker architecture.
4. Complete browser memory model.
5. Storage-to-WASM data path and copy analysis.
6. SIMD and threading kernel strategy.
7. KV-cache design.
8. Initialization, cancellation, and lifecycle state machine.
9. Real-browser parity and measurement protocol.
10. Fault-injection matrix.
11. Security and privacy analysis.
12. Prioritized implementation and optimization ladder.
13. Unknowns requiring private code or physical browsers.
14. Annotated primary-source bibliography with dates.

Do not recommend server inference, simulated assistant output, browser-name
assumptions without version evidence, or a silent fallback that changes the
declared runtime semantics.

## Prompt 8: Transactional Browser Installation And Activation Of Large Immutable Model Compositions

You are an independent browser-storage architect, transactional-systems
engineer, and crash-recovery specialist. Produce a deeply technical report
defining how a web application can receive, verify, persist, and atomically
activate a large immutable language-model composition without exposing a
partial model, duplicating bytes unnecessarily, or losing truth across browser
crashes. You have internet access but no TinyRustLM source, browser database,
model files, local companion, profiles, traces, or credentials. Do not claim
private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
browser state or real-browser execution. Make the report exceptionally
detailed, with data schemas, crash diagrams, pseudocode, resource formulas,
hostile tests, objective gates, and a prioritized implementation sequence.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local chat product. The website must not
  receive prompts or model bytes.
- A composition contains an SLM2 model, Tokenizer2, Template2, manifests,
  receipts, and a canonical graph, each bound by length and cryptographic hash.
- Artifacts may arrive from a verified direct peer through a local companion or
  from deterministic local conversion of reviewed public source artifacts.
- The browser must stream and verify all bytes, persist them locally, and make
  the new composition active only after complete validation and a runtime
  health check.
- The first correct design should replace weaker prelaunch paths. No legacy
  stores, dual writes, migration scaffolding, fallback import, silent repair,
  or downloadable instruction text should remain.

Research IndexedDB, Origin Private File System, File System Access, Storage
Manager, quotas and persistence, service workers, browser storage partitioning,
Web Locks, BroadcastChannel, workers, streams, and crash behavior from primary
browser and standards documentation. Address all of the following:

1. Compare IndexedDB blobs/chunks, OPFS files, sync access handles in workers,
   and user-visible File System Access for hundreds of megabytes. Analyze
   atomicity, random access, quota, eviction, copy count, browser coverage,
   privacy, and testability.
2. Define a content-addressed schema separating immutable pieces, complete
   members, composition graphs, installation attempts, validation receipts,
   active pointer, runtime-health receipt, and garbage-collection eligibility.
3. Specify a streaming install algorithm that validates declared size,
   per-piece hash, whole-member hash, canonical manifest, graph closure, and
   storage writes under explicit bounds. Prevent path traversal, sparse-file
   abuse, decompression bombs, duplicate members, and hash confusion.
4. Design a two-phase or equivalent activation protocol. A crash at any byte or
   transaction boundary must leave either the prior active composition or no
   active composition, never a partially trusted one.
5. Analyze cross-tab races. Use Web Locks, BroadcastChannel, per-attempt
   ownership, leases only where safe, and immutable journals. Define behavior
   for two imports, import versus deletion, import versus generation, and a tab
   that disappears while holding authority.
6. Define restart reconciliation without retrying an irreversible conversion
   or pretending partial transfer is complete. Distinguish resumable byte
   acquisition from nonresumable conversion and from read-only verification.
7. Specify quota forecasting and admission. Include current usage, estimated
   final bytes, staging overhead, browser copy overhead, previous active model,
   retention, and headroom. Define truthful user states for insufficient disk,
   denied persistence, and browser eviction risk.
8. Design garbage collection based on graph reachability and immutable
   receipts. Cover shared members, interrupted installs, quarantine, active
   readers, deletion confirmation, browser crashes, and storage that cannot be
   securely erased.
9. Define service-worker boundaries. Prevent stale application code from
   activating a composition under a different schema or runtime identity, and
   prevent caches from retaining model bytes or credentials unintentionally.
10. Specify hostile and fault tests: crash after every write, quota exhaustion,
    browser kill, corrupt final chunk, hash collision-domain mismatch, stale
    lock, tab race, profile deletion, eviction, schema mismatch, and malicious
    peer metadata.
11. Design evidence that proves installation and activation without recording
    prompts, private paths, raw model bytes, tokens, or credentials. Separate
    local evidence from public claims.
12. Provide an ergonomic user-state model from selected through acquiring,
    converting, verifying, installing, initializing, ready, blocked, canceled,
    and failed. Status must reflect actual durable state.

Required report structure:

1. Executive storage recommendation.
2. Browser API capability and behavior matrix.
3. Content-addressed storage schema.
4. Streaming verification algorithm.
5. Atomic activation and crash-state diagrams.
6. Cross-tab ownership and concurrency protocol.
7. Quota, persistence, and eviction model.
8. Garbage collection and quarantine rules.
9. Service-worker and version-identity boundary.
10. Fault-injection and hostile-input matrix.
11. Privacy-minimized receipt schema.
12. User-visible state vocabulary.
13. Prioritized implementation plan.
14. Unknowns requiring real-browser tests.
15. Annotated primary-source bibliography with dates.

Do not propose `localStorage`, a page reload, one giant unverified Blob, silent
repair, dual-format support, or activation before complete graph and runtime
validation.

## Prompt 9: One Production P2P-Or-Convert Acquisition Protocol Between Browser And Local Companion

You are an independent distributed-protocol architect, local-companion
security engineer, and large-artifact transfer specialist. Produce a deeply
technical report defining one production browser-to-local-companion protocol
that turns a model choice into a working local model: obtain the exact verified
composition from consenting direct peers when available, otherwise acquire
reviewed public source artifacts and convert them locally. You have internet
access but no TinyRustLM source, companion binary, catalog implementation,
peer endpoints, network configuration, model files, credentials, or logs. Do
not claim private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
protocol inspection or authorized outside-network tests. Make the report
exceptionally detailed, with wire schemas, state machines, sequence diagrams,
threat models, fault matrices, objective gates, and a prioritized implementation
sequence.

Project-supplied context, not independently verified:

- TinyRustLM.com is the browser-local chat interface. MiniModel.org is intended
  to publish catalog and discovery metadata, not proxy model bytes.
- Model selection must perform the user's action. Downloading a text file,
  script, or instruction manifest is not a successful acquisition experience.
- A current verified direct P2P composition is preferred only when every
  identity and byte matches. Otherwise the companion may download reviewed
  public source artifacts from their pinned publisher and perform deterministic
  local conversion.
- The browser website must not receive prompts or model bytes. Loopback traffic
  is origin bound and authenticated. Remote model traffic is peer or publisher
  traffic, not a project-hosted fallback.
- The product is prelaunch. There is one clean protocol and no legacy route,
  alias, dual stack, silent fallback, retry-selected result, or compatibility
  mode.

Research loopback application security, Private Network Access, CORS, Fetch and
streaming, WebSocket/WebTransport where relevant, capability URLs, origin
binding, CSRF and DNS rebinding, resumable downloads, content addressing,
direct P2P discovery, NAT constraints, and signed metadata. Address all of the
following:

1. Define capability discovery and protocol negotiation between an HTTPS page
   and an installed loopback companion. Bind protocol schema, web origin,
   companion identity, session, executable/build identity, supported model
   formats, converter profiles, storage capacity, and expiry.
2. Design authentication that resists arbitrary websites, CSRF, DNS rebinding,
   bearer leakage, browser extensions, replay, and stale sessions. Compare
   explicit user pairing, ephemeral challenges, origin-bound tokens, local TLS,
   and operating-system-mediated approaches.
3. Specify the acquisition request schema. Bind requested public model
   revision, license-review receipt, expected composition profile, tokenizer,
   template, quantization, converter, runtime, maximum bytes, P2P policy, and
   user consent without including private paths.
4. Define the state machine from selected, discovering, peer-candidate,
   source-candidate, awaiting-consent, acquiring, converting, verifying,
   transferring, browser-installing, initializing, ready, canceled, blocked,
   and terminal failure. State exact retry and resume policy per phase.
5. Design direct-peer eligibility. Require current signed discovery metadata,
   exact complete composition identity, expiration, endpoint proof, piece set,
   allowed transport, and peer consent. Prevent relabeled bytes, mixed
   compositions, stale proof, and catalog claims from substituting for byte
   verification.
6. Specify resumable piece acquisition from one or more matching peers. Require
   complete identity agreement before mixing pieces, bounded concurrency,
   per-piece verification, durable journal, corruption quarantine, final member
   and graph verification, and privacy-preserving peer diagnostics.
7. Define the publisher-source fallback as an explicit alternative route, not
   hidden outcome selection. Cover immutable source revision, license and size
   review, user consent, content hashes, rate limits, interrupted downloads,
   deterministic conversion, nonresumable one-shot stages, and exact evidence.
8. Design streaming transfer from companion to browser with backpressure,
   cancellation, sequence numbers, lengths, hashes, restart semantics, and no
   accidental copy through project infrastructure.
9. Analyze concurrency and ownership for multiple tabs, model switches,
   companion restarts, browser restarts, source download resumption, peer loss,
   conversion terminality, and already-present exact compositions.
10. Define truthful UI status and error codes. Never report P2P success for
    loopback/LAN-only evidence, conversion success for structural partials, or
    readiness before browser runtime initialization.
11. Create a network allow/deny and privacy test plan using browser network
    capture, companion logs, DNS behavior, URL scans, headers, referrers,
    service workers, and secret scanning. Prompts and model bytes must not reach
    project sites.
12. Specify local fixture, one-real-model, outside-peer, failure-injection, and
    real-browser acceptance stages, clearly separating what CI can prove from
    authorized external-network evidence.

Required report structure:

1. Executive protocol recommendation.
2. Trust-boundary and dataflow diagrams.
3. Capability and authentication contract.
4. Acquisition schema and state machine.
5. Direct-peer eligibility and piece protocol.
6. Publisher-source conversion route.
7. Companion-to-browser streaming protocol.
8. Resume, cancellation, and concurrency semantics.
9. Network and privacy threat model.
10. User-visible status and typed-error vocabulary.
11. Test and fault-injection matrix.
12. Objective production acceptance evidence.
13. Prioritized implementation plan.
14. Unknowns requiring private or external access.
15. Annotated primary-source bibliography with dates.

Do not propose a text-file download, project-hosted model-byte proxy, implicit
router changes, unauthenticated loopback API, format compatibility route, or
best-of-N acquisition outcome.

## Prompt 10: No-Cheat Qualification Of One Useful Small Conversational Model

You are an independent evaluation-science lead, psychometrics researcher,
small-model specialist, and human-review protocol designer. Produce a deeply
technical report defining how to decide whether one compact browser-capable
Qwen3-derived composition is genuinely useful for ordinary conversation after
conversion and quantization, without training on evaluation answers or
rewarding superficial keywords. You have internet access but no TinyRustLM
source, private model, training data, prompts, raw outputs, evaluator, judges,
or unpublished holdouts. Do not claim private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
prompts, raw outputs, or authorized human review. Make the report exceptionally
detailed, with taxonomies, schemas, statistical formulas, seeded algorithms,
adversarial matrices, objective gates, and a prioritized implementation
sequence.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch local chat product. Structural SLM2 validity and
  runtime parity are prerequisites, not quality proof.
- Important behavior includes conversational coherence, common-sense judgment,
  ambiguity handling, practical constraints, source conflict, latest-user
  preference precedence, multi-turn continuity, untrusted-memory handling,
  summaries, rewrites, JSON, extraction, code explanation, and substantive
  treatment of lawful adult questions with narrow concrete-harm boundaries.
- Arithmetic is secondary and may be delegated to a deterministic calculator.
- Raw model output must be preserved exactly. Repair, retries selected for the
  best answer, expected-term injection, hand editing, and hidden answer
  completion are forbidden.
- Fixed development cases must be separated from seeded paraphrases and sealed
  holdouts. Training contamination is disqualifying.
- One useful model is the immediate goal. Campaign counters cannot advance from
  mocks, popularity, one attractive response, or parameter count.

Research current primary evaluation literature, official benchmark
documentation, contamination research, LLM-as-judge limitations, human-rating
methodology, robust statistics, and small-model evaluation. Address all of the
following:

1. Define a claim taxonomy from structural-only and runtime-parity-only through
   conversation-screened, task-qualified, and generally useful within a
   declared scope. State minimum evidence and prohibited marketing language for
   each claim.
2. Construct a behavioral taxonomy and weighting rationale for the listed
   product dimensions. Positive helpful cases must substantially outnumber
   refusal cases, while narrow safety boundaries remain directly tested.
3. Specify semantic invariants that are independent of fixture nouns and exact
   phrasing. Include underspecified choices, unavailable resources, conflicting
   authorities, current preference over stale memory, quoted instructions as
   data, uncertainty, and lawful adult comparisons.
4. Design fixed development, deterministic generated, paraphrase, metamorphic,
   adversarial, and sealed human-audit suites. Bind generator version, seed,
   template family, exclusion set, case hash, and selection procedure before
   outputs are observed.
5. Define contamination controls over prompts, expected answers, semantic
   neighbors, template families, entity-substituted cases, response phrases,
   public benchmarks, teacher data, calibration corpora, and deletion lineage.
6. Assign roles to deterministic validators, scenario-specific semantic
   detectors, reference-free or reference-based model judges, and human review.
   No opaque judge may be sole authority or rewrite the candidate output.
7. Specify stochastic repeat policy and statistics. Cover declared product
   seeds, per-case pass probabilities, confidence intervals, correlated cases,
   multiple comparisons, infrastructure flakiness, inter-rater agreement, and
   why best-of-N is invalid unless it is the actual product behavior.
8. Design blinded comparisons among publisher source, float converted model,
   quantized SLM2, native optimized execution, and browser execution. Separate
   conversion drift from quantization drift and evaluator noise.
9. Define ordinary-helpfulness regression budgets and hard critical failures.
   A smaller or faster artifact must be rejected if it materially worsens core
   utility, instruction following, source authority, or feasible planning.
10. Specify evidence schemas binding model bytes, tokenizer, template, sampling,
    runtime, evaluator, case set, raw output hash/length, judge identities,
    human decisions, and final scoped claim without publishing private prompts.
11. Design red-team suites for over-refusal, moralizing, fabricated certainty,
    impossible advice, prompt injection through memory, structured-output
    corruption, repetition, truncation, and current-turn precedence.
12. Provide a TDD workflow for evaluator defects: preserve raw failure, add a
    generic regression and counterexamples, version the evaluator, rerun only
    invalidated evaluation phases, archive old decisions, and never train on a
    sealed failure.

Required report structure:

1. Evaluation philosophy and claim taxonomy.
2. Behavioral taxonomy and weighting.
3. Semantic-invariant specification table.
4. Suite partitioning and seeded-generation protocol.
5. Contamination threat model and audit controls.
6. Layered evaluator authority rules.
7. Stochastic statistics and human-review protocol.
8. Source/float/quantized/native/browser comparison matrix.
9. Regression budgets and hard rejection rules.
10. Cryptographic evidence schema.
11. Red-team and adversarial matrix.
12. Failure-to-regression workflow.
13. Prioritized implementation sequence.
14. Unknowns requiring private outputs or authorized review.
15. Annotated primary-source bibliography with dates.

Do not lower thresholds to qualify a preferred model, expose sealed prompts to
training, accept keywords as semantics, repair output before scoring, or call a
judge score independent product proof.

## Prompt 11: Champion-And-Specialist Modular Models Without Duplicating Full Checkpoints

You are an independent principal model-composition researcher, mixture and
routing specialist, parameter-efficient adaptation expert, and local-runtime
architect. Produce a deeply technical feasibility report on complementing one
fully useful compact general model with very small task specialists while
avoiding duplicated full checkpoints and preserving browser-local privacy. You
have internet access but no TinyRustLM source, private SLM2 schema, models,
training data, routing logs, browser measurements, or evaluation cases. Do not
claim private validation.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
training, models, or measurements. Make the report exceptionally detailed,
with architecture diagrams, identity schemas, resource equations, routing
pseudocode, ablations, objective gates, and a prioritized implementation
sequence.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local chat product. One provenance-bound
  Qwen3 0.6B composition must first become a trustworthy general model.
- A possible later direction is one streamlined general champion plus small
  specialists for domains such as structured extraction, rewriting, code
  explanation, or other well-bounded tasks.
- The goal is real accuracy or capability gain per added byte, not catalog
  theater. Renaming identical bytes, shipping twenty full copies, or calling
  precision tiers distinct capabilities is not useful.
- Colibri, LoRA/DoRA, adapters, sparse deltas, shared tensor stores,
  layer-selective experts, draft models, and task routers are research topics,
  not assumed dependencies or approved designs.
- Prompt privacy must remain local. Routing must not use a project server.
- The product has no legacy obligation. If modular composition is adopted, one
  canonical design should replace experiments; compatibility shims and fallback
  chains are forbidden.

Research primary papers, official model cards, immutable repositories, and
licenses for Colibri if publicly identifiable, LoRA, DoRA, adapters,
IA3/prefix methods where relevant, mixture-of-experts, model merging, task
arithmetic, delta compression, speculative decoding, early exit, and modular
deep-learning systems. Address all of the following:

1. Disambiguate every public project or paper named Colibri relevant to model
   composition. Pin exact identity, authors, repository revisions, licenses,
   architecture, claimed results, and reproduction status. Do not conflate
   unrelated projects.
2. Define distinct modular strategies: low-rank weight deltas, additive sparse
   deltas, adapters, selected replacement layers, shared embeddings/lm head,
   shared lower trunk with specialist upper layers, MoE experts, prompt/prefix
   modules, separate tiny specialist models, and speculative draft models.
3. Derive storage and runtime formulas for each strategy, including base
   weights, delta metadata, quantization scales, duplicated layers, tokenizer,
   caches, activation memory, loading cost, switching cost, and simultaneous
   residency.
4. Analyze which components of a dense Qwen3-like model can be shared safely.
   Address tokenizer and vocabulary identity, tied embeddings, layer norms,
   RoPE configuration, GQA head counts, hidden width, quantization profile,
   adapter rank, and base-revision dependence.
5. Define immutable composition identities that bind champion, specialist,
   router, tokenizer, template, sampling, runtime, and task claim. A delta must
   be unusable with the wrong base even if shapes happen to match.
6. Compare routing architectures: explicit user-selected task mode,
   deterministic local classifier, rules over declared command structure,
   champion self-routing, confidence gating, cascades, and ensembles. Analyze
   privacy, latency, calibration, oscillation, prompt injection, and false route
   costs.
7. Explain whether routing should occur once per conversation, once per turn,
   or within generation. Define state transitions and current-user-preference
   precedence when task intent changes.
8. Design specialist training that improves one bounded capability without
   memorizing evaluations or catastrophically weakening ordinary helpfulness.
   Cover assistant-only SFT, preference optimization, distillation, hard
   negatives, counterfactual constraints, and contamination controls.
9. Define promotion experiments comparing champion alone, champion plus each
   module, a separate specialist, and a size-matched champion improvement.
   Measure task utility, misrouting harm, general-chat regressions, load time,
   peak memory, decode speed, and total distributed bytes.
10. Analyze failure containment: corrupt or malicious delta, wrong base,
    router disagreement, specialist refusal drift, prompt injection, missing
    module, partial installation, and specialist quality downgrade. Do not hide
    failure by silently switching to an unqualified model.
11. Specify a browser storage and activation graph that deduplicates immutable
    shared members while preserving transactional install, exact provenance,
    garbage collection, and independent revocation.
12. Recommend objective criteria for when a specialist is justified. Include
    minimum quality gain, maximum byte and latency budget, routing reliability,
    independent task scope, and evidence that a better champion is not the
    simpler answer.

Required report structure:

1. Executive feasibility finding and assumptions.
2. Colibri identity and public-evidence review.
3. Modular architecture taxonomy.
4. Storage, memory, and compute equations.
5. Compatibility-free composition identity design.
6. Local routing architecture and threat model.
7. Specialist training and contamination controls.
8. Promotion and ablation matrix.
9. Browser deduplication and activation graph.
10. Failure containment and revocation.
11. Decision criteria for champion versus specialist.
12. Staged route after the first champion qualifies.
13. Likely dead ends and rejection criteria.
14. Unknowns requiring private implementation or training.
15. Annotated primary-source bibliography with dates.

Do not assume that fewer stored bytes means lower peak memory, count relabeled
or precision-only copies as new capabilities, route prompts to a server, or
recommend modularity before the general champion has independently qualified.

## Prompt 12: Enterprise Clean-Browser Acceptance, Release Evidence, And Living Documentation

You are an independent principal release engineer, browser-automation lead,
supply-chain security architect, and technical-documentation systems owner.
Produce a deeply technical report defining the final enterprise-quality route
from one numerically and semantically qualified SLM2 composition to a deployed
prelaunch browser-local chat experience with current public documentation and
cryptographically bound release evidence. You have internet access but no
TinyRustLM source, CI, browser artifacts, packages, websites, credentials,
signing keys, private models, or test receipts. Do not claim private
validation or deployment.

Use current primary sources wherever possible. Record publication or update
dates and your retrieval date, link directly to material sources, and pin
public repository observations to immutable revisions. Clearly label public
facts, sourced external facts, unverified project-supplied facts, engineering
recommendations, assumptions and disagreements, and facts requiring private
source, credentials, real browsers, hardware, or production access. Make the
report exceptionally detailed, with state machines, receipt schemas,
invalidation graphs, test matrices, fault cases, objective gates, and a
prioritized implementation and publication sequence.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch product. There is no public product V1 or V2 and
  no installed base requiring compatibility. SLM2 and numbered protocol/schema
  paths are technical identities only.
- No code debt, legacy support, migration scaffolding, aliases, fallback,
  repair, best-of-N, stale documentation, or low-quality patches are allowed.
- The first release candidate must acquire a real model through direct P2P or
  deterministic local conversion, install and activate it transactionally,
  run inference in a real browser, and complete a genuine multi-turn chat.
- Every fresh-browser acceptance attempt uses a newly created owned persistent
  profile, later closes the browser process and proves deletion of that exact
  profile. Reload, storage clearing, incognito, and reused contexts do not
  count.
- The website must not receive prompts or model bytes. MemoryEndpoints access
  is a separate authorized live boundary and is not available for this first
  local-model acceptance gate.
- Broader campaign counters remain zero until their exact real-world evidence
  exists. Unit tests, fixtures, cross-compilation, package creation, and local
  probes cannot advance live counters.
- Source must be committed and pushed after every major buildable change.
  Deployment occurs whenever the complete applicable gate passes. Marketing,
  release notes, support material, architecture docs, and documentation-only
  sites must remain consistent with deployed behavior.

Research current Playwright and browser documentation, secure profile handling,
software supply-chain standards, SBOM and provenance specifications, package
signing, release attestations, accessibility standards, performance
measurement, semantic versioning alternatives for prelaunch software, and
documentation-as-code practices. Address all of the following:

1. Define a final release state machine spanning immutable source, clean build,
   unit/integration/fuzz gates, source-framework parity, native parity, browser
   parity, semantic qualification, package verification, fresh-profile
   acceptance, privacy scan, public-site build, deployment, HTTPS readback,
   release log, and final evidence verification.
2. Specify exact invalidation edges. For example, evaluator changes should
   invalidate quality decisions but not immutable acquisition bytes; runtime
   changes should invalidate parity and browser evidence; documentation-only
   factual changes should not trigger model conversion.
3. Design the fresh-profile lifecycle on Windows and Linux with owned-root
   containment, process closure, handle detection, deletion retries, proof of
   absence, crash recovery, and safeguards that prevent recursive deletion
   outside the owned root.
4. Define a genuine multi-turn acceptance conversation and UI assertions
   without exposing private prompts. Cover acquisition progress, model ready,
   exactly one assistant rendering, cancellation, completion state, scrolling,
   narrow/mobile layout, keyboard use, accessible names, reduced motion, long
   text, and truthful errors.
5. Specify network and secret scanning across requests, responses, URLs,
   referrers, WebSockets, service workers, browser stores, logs, traces,
   screenshots, profile files, packages, and generated reports. Address UTF-8,
   UTF-16, base64, compressed stores, hashes, and bounded false-positive
   adjudication.
6. Build a component-by-component release gate for Rust crates, WASM, browser
   assets, local companion, C ABI if shipped, .NET wrappers if shipped, NuGet
   packages if shipped, symbols, archives, catalog metadata, marketing sites,
   and documentation sites. Omit components that are not actually products.
7. Define cross-platform evidence for `win-x64`, `linux-x64`, and
   `linux-arm64`, separating compile success, binary-header inspection,
   emulated smoke, virtualized execution, and real hardware execution.
8. Specify supply-chain controls: pinned dependencies, lockfiles, source
   inventories, artifact hashes, license review, SBOM, SLSA-style provenance,
   SourceLink and symbols where applicable, signing, malware scanning,
   archive-traversal tests, secret scanning, retention, revocation, and
   publication authorization.
9. Design a consistent release identity suitable for a prelaunch product.
   Include machine-readable build identity, human-facing version or prerelease
   label, release date, last-published timestamp, commit, artifact identities,
   deployment target, and public readback. Avoid implying a product generation
   that does not exist.
10. Define a per-site update log and documentation freshness contract. Every
    deployment should update a consistent changelog surface, last-published
    identity, architecture/support facts, API or protocol references, and links
    among product and documentation sites. Detect stale or contradictory copy
    automatically.
11. Specify evidence minimization and retention. Public reports may expose
    hashes, sizes, versions, counts, statuses, timestamps, and bounded error
    codes, but not prompts, credentials, invitation URLs, private paths, raw
    model bytes, or hosted-memory payloads.
12. Create a final acceptance checklist that explicitly distinguishes the
    first local-model release from the future 20-model, 50-browser-round,
    25-memory-round, 40-lane, and 20-announcement campaign. No partial evidence
    may be summarized as completion.

Required report structure:

1. Executive release recommendation and assumptions.
2. End-to-end release state machine.
3. Evidence graph and invalidation matrix.
4. Fresh-profile lifecycle and deletion proof.
5. Browser conversation and UX acceptance procedure.
6. Network, privacy, and secret-scanning contract.
7. Component and cross-platform gate matrix.
8. Supply-chain, provenance, and signing controls.
9. Prelaunch release identity and publication record.
10. Living-documentation and cross-site consistency system.
11. Evidence minimization and retention policy.
12. Final acceptance checklist and remaining-risk section.
13. Prioritized implementation and deployment plan.
14. Unknowns requiring private, credentialed, or production access.
15. Annotated primary-source bibliography with dates.

Do not count a mock as live, cross-compilation as hardware execution, package
creation as publication, a local probe as public P2P proof, or unit tests as a
deployed model. Do not recommend carrying obsolete paths merely to reduce the
short-term implementation effort.

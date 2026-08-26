# Twelve Disconnected Research Prompts: Post-/10 Contract Correction, Native Proof, And First Browser Release

Each section below is a complete standalone assignment. Send each entire
prompt to a different technical research agent. The agents do not share
context and must not be expected to have read this introduction, another
prompt, another report, or any private TinyRustLM material.

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
pseudocode, state machines, schemas, byte and resource formulas, hostile-input
cases, fault-injection matrices, objective acceptance criteria, and a
prioritized implementation sequence. Generic tutorials, marketing summaries,
invented measurements, unsupported success claims, and recommendations to
preserve hypothetical prelaunch compatibility are not useful.

## Prompt 1: Formal Cross-Language Receipt Semantics After A Preserved Contract-Drift Failure

You are an independent principal protocol architect, distributed-transaction
specialist, and Rust/.NET interoperability reviewer. Produce an exceptionally
detailed, implementation-oriented report defining a single unambiguous receipt
protocol for a create-only model-composition transaction whose producer and
independent verifier are implemented in different languages. Target 10,000 to
18,000 words excluding the bibliography. Prefer formal state and data
contracts, executable test vectors, and rejection rules over broad advice.

You may browse public standards, Rust and .NET documentation, JSON
canonicalization specifications, filesystem durability documentation,
content-addressing literature, formal-methods papers, and public source
repositories. You have no access to TinyRustLM source, private executables,
model bytes, receipts, logs, test output, workstations, credentials, or
deployment systems. Do not request private paths or secrets and do not imply
that you validated the project.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is one unversioned prelaunch browser-local AI product. Technical
  labels such as SLM2 and Tokenizer2 are format identities, not product
  generations. There is no launched predecessor and no permission for legacy
  readers, dual semantics, compatibility aliases, migrations, fallback
  validators, response repair, hidden retries, best-of-N selection, or accepted
  code debt.
- The first real candidate is the public \`Qwen/Qwen3-0.6B\` model pinned at
  immutable revision \`c1899de289a04d12100db370d81485cdf75e47ca\`.
- A Rust converter is the authoritative producer of a six-member composition:
  \`model.slm2\`, \`tokenizer.tokenizer2\`, \`template.template2\`,
  \`sampling.sampling2\`, \`prompt.prompt2\`, and \`composition.acg2\`. It
  also emits bounded attempt and conversion receipts.
- A separately built managed inspector is expected to reject malformed or
  semantically inconsistent output without trusting the producer.
- A preregistered execution called attempt \`/10\` produced a complete
  10-file candidate output, but its sole owner ended in immutable terminal
  failure when the managed inspector rejected the producer's durability
  receipt. The Rust producer represented the durability child operation as
  \`parent-operation-id + "-members"\` with status \`performed\`; the managed
  verifier incorrectly required the parent operation ID itself and status
  \`flushed\`. The failed execution, bytes, and evidence are closed forever and
  cannot be retried, repaired, overwritten, adopted, or promoted.
- A test-first source correction now requires the child operation suffix
  \`-members\` and status \`performed\`, with negative fixtures for the former
  incorrect operation ID and status. That correction still requires an
  independent design audit and a wholly new preregistered execution before it
  can produce release evidence.
- A structural or receipt pass proves no numerical inference, browser
  execution, behavioral quality, P2P availability, publication, or campaign
  progress.

Research and resolve all of the following:

1. Define a formal operation graph for registration, attempt, conversion,
   member materialization, durability barrier, independent inspection, and
   terminal owner decision. State cardinality, parent/child relationships,
   uniqueness domains, transition guards, and terminality. Explain whether
   member durability is one child operation or a set of per-member operations,
   and justify the choice.
2. Define exact semantics for words such as \`created\`, \`performed\`,
   \`written\`, \`closed\`, \`flushed\`, \`durable\`, \`verified\`,
   \`accepted\`, and \`terminal\`. Distinguish an operating-system call being
   attempted, returning success, and providing a durability guarantee. Do not
   let one status field silently claim all three.
3. Specify deterministic operation-ID derivation. Cover UTF-8, normalization,
   separator choice, length bounds, allowed characters, case sensitivity,
   collision domains, parent identity binding, and whether identifiers should
   be human-readable, hash-derived, or both. Provide positive and negative test
   vectors for the \`-members\` child.
4. Design a versioned schema family for registration, composition attempt,
   conversion receipt, member receipt, durability receipt, independent
   inspection, and final verification. Define every field's type, requiredness,
   maximum size, null policy, unknown-field policy, integer range, timestamp
   profile, digest encoding, and canonical ordering.
5. Explain how the producer can claim only what it observed while the verifier
   independently proves what it can recompute. Identify fields that must never
   be copied from producer claims without recomputation, including file type,
   length, digest, inventory, path containment, and member-set closure.
6. Define canonical serialization and identity. Compare RFC 8785 JSON
   Canonicalization Scheme, deterministic CBOR, and a purpose-built binary
   encoding. Address duplicate JSON keys, floating-point numbers, exponent
   forms, Unicode escapes, byte-order marks, line endings, trailing data,
   numbers outside interoperable ranges, and cross-runtime parser
   discrepancies.
7. Model crash boundaries before and after each member close, file flush,
   directory flush, receipt write, receipt flush, independent inspection, and
   final decision. For Windows NTFS and Linux filesystems, state what can be
   proven portably, what is platform-specific, and what requires local fault
   injection.
8. Specify a fail-closed verification algorithm that never accepts either of
   two competing meanings. A corrected clean-slate implementation must reject
   the former parent-ID/\`flushed\` shape; it must not accept both shapes, infer
   intent, repair the receipt, or translate old records.
9. Create a conformance-vector suite covering valid graphs, wrong parent,
   wrong suffix, wrong status, duplicate child, missing child, unknown member,
   missing durability barrier, digest substitution, replayed receipt, stale
   registration, path alias, symlink/reparse substitution, truncated JSON,
   oversized JSON, and contradictory terminal records.
10. Define property-based and model-based tests for the state machine,
    including generators, shrinking strategy, oracles, mutation operators, and
    assertions that Rust, .NET, and JavaScript implementations return the same
    typed verdict without sharing implementation code.
11. Recommend how schema changes occur in a prelaunch clean slate. The answer
    must distinguish replacing the sole not-yet-released contract from runtime
    compatibility. Explain how immutable historical evidence remains
    interpretable without keeping old executable acceptance paths.
12. Provide an objective release gate for the corrected contract: generated
    test vectors, independent implementations, negative corpus, fuzz results,
    crash tests, schema identity, source revision, tool identities, and public
    bounded evidence. State exactly what remains unproven after that gate.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Normative terminology and formal state machine.
3. Operation graph and identifier derivation.
4. Versioned schema family with field tables.
5. Canonical serialization and content identity.
6. Producer claims versus independently recomputed facts.
7. Filesystem and crash-durability model.
8. Cross-language validation algorithm and pseudocode.
9. Positive, negative, mutation, and fuzz test vectors.
10. Clean-slate contract replacement strategy.
11. Objective acceptance gate and residual risks.
12. Prioritized implementation sequence.
13. Unknowns requiring local inspection or execution.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend accepting both \`performed\` and \`flushed\`, accepting both
parent and child operation IDs, translating a historical receipt at runtime,
repairing evidence, weakening the independent verifier, or rerunning the closed
\`/10\` operation.

## Prompt 2: Executable Contract Generation And Differential Verification Across Rust, .NET, And JavaScript

You are an independent principal language-tooling engineer, schema compiler
designer, and property-based testing researcher. Produce an exceptionally
detailed report describing how three independently built implementations in
Rust, .NET, and JavaScript can share one normative model-composition contract
without manually duplicating semantics and drifting again. Target 10,000 to
18,000 words excluding bibliography. The result must be specific enough to
guide implementation, code generation, test generation, and CI gates.

You may inspect public language specifications, official compiler and runtime
documentation, RFCs, JSON Schema, CDDL, Protocol Buffers, FlatBuffers,
Smithy/OpenAPI, formal data-description languages, property-testing
frameworks, fuzzing systems, and reproducible-build guidance. You cannot access
TinyRustLM repositories, private binaries, model artifacts, schemas, tests,
logs, CI, or credentials. Do not claim private validation.

Project-supplied facts, to be treated as unverified:

- TinyRustLM is a prelaunch clean-slate product with one intended SLM2 path.
  There is no compatibility or legacy obligation and no permission to keep
  parallel contract readers, aliases, migrations, fallbacks, or known debt.
- A Rust process produces a Qwen3 composition and receipts, a .NET process
  independently inspects them, and a JavaScript owner coordinates a
  preregistered one-shot operation and emits a bounded final decision.
- A preserved terminal failure exposed semantic drift: the producer used a
  child durability operation ID ending in \`-members\` and status
  \`performed\`, while the managed verifier expected the parent ID and
  \`flushed\`. The failed run cannot be changed or rerun.
- The desired correction is one normative schema and semantic model from which
  language-specific types, parsers, validators, conformance vectors, and
  documentation can be derived or checked. Generated code must not become an
  excuse to trust producer claims or to bypass independent recomputation.
- Model and raw evidence bytes stay outside Git. Small schemas, generators,
  fixtures, and public-safe result records belong in source control.

Research and specify:

1. Compare credible source-of-truth technologies for this contract: a small
   normative DSL, JSON Schema 2020-12 plus semantic rules, CDDL, Protocol
   Buffers, Smithy, OpenAPI, or a deliberately tiny custom schema. Evaluate
   deterministic code generation, unknown-field behavior, integer safety,
   canonical encoding, offline builds, generated-code auditability, toolchain
   pinning, and Rust/.NET/JavaScript maturity.
2. Separate syntactic schema constraints from semantic invariants that ordinary
   schema languages cannot express: operation graph linkage, exact member-set
   equality, digest recomputation, source/registration binding, state
   transitions, parent-child ID derivation, and mutually exclusive terminal
   outcomes. Recommend one authority for each layer.
3. Design the normative intermediate representation and compiler pipeline.
   Include grammar or schema fragments, deterministic ordering, normalized
   documentation comments, source-map behavior, generator identity, output
   hashing, and a rule that generated files must be reproducible byte-for-byte.
4. Specify generated Rust, C#, and TypeScript/JavaScript APIs. Cover owned
   versus borrowed bytes, streaming hashes, bounded readers, cancellation,
   typed error enums, exhaustive matching, nullable/reference semantics,
   checked integers, path values versus opaque logical names, and prevention of
   accidental lossy conversion.
5. Design independent semantic validators that consume generated syntax types
   but do not share the producer's business logic. Explain how to prevent
   common-mode bugs while still avoiding hand-copied constants.
6. Define a language-neutral golden-vector bundle with manifest, schema hash,
   vector ID, canonical bytes, expected parse outcome, expected semantic
   verdict, and expected typed error. Include malformed UTF-8, duplicate keys,
   unknown fields, missing fields, integer boundaries, digest case, timestamp
   edge cases, reordered fields, trailing bytes, and the exact historical
   durability mismatch.
7. Specify differential testing. Show how one orchestrator invokes all three
   implementations over identical immutable input vectors, captures raw
   outputs, rejects nondeterminism, and reports the first disagreement without
   choosing the most permissive result.
8. Design property-based generation and shrinking across languages. Address
   reproducible seeds, generator-version binding, corpus promotion, semantic
   mutation, graph-aware shrinking, timeout and memory limits, and preservation
   of every discovered counterexample as an immutable regression artifact.
9. Define fuzz boundaries for parser, canonicalizer, graph validator, path
   validator, and digest reader. Cover native fuzzers, managed fuzzing, browser
   JavaScript fuzzing, corpus exchange, sanitizers, code coverage, denial of
   service, and decompression or allocation bombs.
10. Provide a clean-slate change protocol. A schema correction before launch
    must replace the sole implementation atomically, delete superseded
    executable code, regenerate all targets, fail stale generated files in CI,
    and retain only historical evidence readers outside the production path.
11. Define supply-chain controls for generators and dependencies: immutable
    revisions, checksums, offline restoration, lock files, SBOM, license
    review, bootstrap trust, deterministic output, and review of generated
    diffs.
12. Produce a staged implementation and acceptance matrix that begins with the
    durability mismatch test and expands to full composition contracts,
    browser receipts, acquisition receipts, and release receipts without
    prematurely coupling unrelated state machines.

Required report structure:

1. Executive architecture decision.
2. Requirements and threat model.
3. Schema/IDL option matrix and selection rationale.
4. Normative IR and deterministic compiler design.
5. Generated API contracts by language.
6. Semantic-validation ownership boundaries.
7. Golden-vector format and representative vectors.
8. Differential, property, mutation, and fuzz testing.
9. Reproducible generation and supply-chain controls.
10. Clean-slate replacement and deletion rules.
11. CI/release gate with objective evidence.
12. Prioritized implementation backlog.
13. Unknown local facts.
14. Annotated primary-source bibliography with dates.

Do not propose three hand-maintained schemas, permissive unknown semantics,
runtime translation of obsolete records, generated validators that trust
producer digests, accepting the majority verdict, or preserving two
production contract versions for hypothetical users.

## Prompt 3: Wholly New One-Shot Composition Registration After An Immutable /10 Failure

You are an independent principal release engineer, evidence-state-machine
architect, and Windows process-custody specialist. Produce an exceptionally
detailed report defining how to preregister, build, execute, verify, and close
one wholly new model-composition operation after a prior operation ended in a
preserved terminal verifier failure. Target 10,000 to 18,000 words excluding
the bibliography. The report must be operationally exact and must distinguish
source correction evidence from new execution evidence.

You may browse official Git, Windows, Rust, Cargo, .NET, PowerShell,
filesystem, cryptographic, and reproducible-build documentation. You have no
access to TinyRustLM source, private roots, model bytes, executables, receipts,
terminal streams, CI, credentials, or development machines. Do not ask for
private paths and do not claim execution.

Project-supplied facts, all unverified by you:

- TinyRustLM is a prelaunch clean-slate product. SLM2 and numeric operation
  suffixes are technical identities only. There is no released V1/V2,
  compatibility population, migration duty, retry path, evidence repair,
  output adoption, fallback, alias, shim, or accepted debt.
- The public source candidate is \`Qwen/Qwen3-0.6B\` pinned at revision
  \`c1899de289a04d12100db370d81485cdf75e47ca\`, with exact source files,
  lengths, and SHA-256 digests bound before conversion.
- Attempt \`/10\` was registered from a remote-exact source checkpoint, used
  fresh Windows MSVC, Rust, and managed build custody, launched its sole owner
  exactly once, and created a complete candidate. The managed inspection
  process exited 1 with typed error \`converter-receipt-contract\` because of
  an operation-ID/status semantic mismatch. Its final owner decision is
  \`terminal-failure\`. A read-only verifier reproduced that decision exactly
  once.
- All \`/10\` private names, roots, build outputs, candidate bytes, and evidence
  are immutable and permanently ineligible for reuse, retry, repair,
  overwrite, deletion, adoption, or promotion.
- A source correction now aligns the managed verifier with the producer's
  intended child durability ID \`parent + "-members"\` and status
  \`performed\`, with positive and negative tests. A future operation must bind
  the commit and tree containing that correction.
- New model and evidence bytes must remain outside Git. A bounded registration
  and bounded public result may be committed. No private paths, raw streams,
  prompts, secrets, or model bytes may enter public records.
- No later phase may claim pass unless the new owner terminates successfully:
  native inference, WASM, browser chat, P2P, deployment, and campaign counters
  remain unproven.

Research and define:

1. The complete registration state machine from corrected source review to
   remote-exact registration. Cover source commit/tree, frozen-goal identities,
   schema/profile hashes, source locks, tool recipes, private logical names,
   absent-root declarations, command identity, environment lock, timeout and
   output bounds, and zero-retry policy.
2. Why a registration that changes source commit/tree must precede every
   source-derived build and execution artifact. Explain ordering between source
   correction commit, registration commit, build custody, request
   materialization, owner preflight, owner execute, owner verify, public
   result, and result commit.
3. All identities that must be wholly new. Include environment request and
   outputs, Rust custody request/root/terminal/summary/binaries, managed
   custody request/root/terminal/summary/assemblies, owner request, evidence
   root, output root, execution ID, terminal records, and public result.
   Distinguish logical identity from path and content hash.
4. Remote equality proof. Specify noninteractive fetch, local commit, tracking
   ref, \`FETCH_HEAD\`, direct remote ref, tree identity, clean status, and
   cryptographic file verification. Address force-push, stale refs, shallow
   clones, detached HEAD, submodules, and dirty ignored build artifacts.
5. Preflight proof that every registered future root is absent without creating
   it. Cover parent ownership, reparse points, symlinks, hard links, path
   normalization, case folding, alternate data streams, race resistance, and
   the difference between observation and reservation.
6. Hermetic Windows x64 MSVC environment materialization and build custody.
   Define exact toolchain discovery, version selection, environment capture,
   process tree ownership, offline dependency closure, regular-file inventory,
   terminal stream bounds, and independent content summaries.
7. The sole owner invocation protocol. Define command-line construction,
   inherited handles, job objects, cancellation, timeout, output limits,
   process-tree termination, terminal record ordering, and rules forbidding a
   second invocation after any observable launch.
8. Terminal-state classification for preflight rejection, spawn failure,
   native rejection, managed rejection, timeout, process crash, machine crash,
   ambiguous observation, owner defect, verifier disagreement, and pass.
   Specify whether each closes the operation and what future work is allowed.
9. A read-only verifier that is invoked once after owner termination. Define
   complete inventory, digest recomputation, registration binding, process
   evidence, absence/presence expectations, terminal exclusivity, and how it
   proves it made no writes.
10. Public-safe result minimization. Provide a field-level schema containing
    enough hashes, sizes, statuses, counts, versions, and typed errors to audit
    the outcome while excluding private paths, raw stdout/stderr, prompts,
    source-machine details, or model bytes.
11. Fault-injection and rehearsal strategy that exercises generic owner code
    before the real operation without materializing any registered real root or
    consuming the real one-shot identity.
12. Objective acceptance criteria for a successful new composition and an
    explicit handoff to numerical/native verification. A complete candidate
    transaction is necessary but must not be mislabeled as a useful model.

Required report structure:

1. Executive recommendation and immutable-history rules.
2. Registration and execution state diagram.
3. Identity graph and all-new-name table.
4. Remote-exact source proof.
5. Root absence, ownership, and path-security protocol.
6. Environment, Rust, and managed build custody.
7. Sole owner launch and process-tree algorithm.
8. Terminal classification and no-retry matrix.
9. Read-only verification algorithm.
10. Public/private evidence contract.
11. Fault-injection plan.
12. Acceptance and next-phase handoff.
13. Unknown local facts.
14. Annotated primary-source bibliography with dates.

Do not recommend rerunning \`/10\`, copying its candidate, reusing one of its
roots or binaries, changing its terminal decision, accepting output because it
looks complete, building before registration, or weakening the managed
inspector.

## Prompt 4: Independent Semantic Acceptance Of A Qwen3 Six-Member SLM2 Composition

You are an independent principal binary-format architect, transformer-runtime
engineer, and hostile-artifact security reviewer. Produce an exceptionally
detailed report specifying how an implementation independent from the
converter should decide whether a six-member Qwen3 composition is structurally
and semantically complete enough to enter numerical verification. Target
10,000 to 18,000 words excluding the bibliography.

You may inspect the immutable public \`Qwen/Qwen3-0.6B\` revision
\`c1899de289a04d12100db370d81485cdf75e47ca\`, official Qwen and Transformers
source, Safetensors documentation, tokenizer specifications, cryptographic
standards, binary-parser guidance, Rust/.NET documentation, and hostile-file
research. You have no access to TinyRustLM source, its SLM2 specification,
private model bytes, generated outputs, receipts, tests, or workstations. The
following project facts are supplied only to focus the report and must not be
presented as independently verified.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch browser-local product and has one intended SLM2
  execution path. No legacy model reader, compatibility alias, migration,
  format fallback, repair parser, or debt is permitted.
- A complete model composition has six semantic members:
  \`model.slm2\`, \`tokenizer.tokenizer2\`, \`template.template2\`,
  \`sampling.sampling2\`, \`prompt.prompt2\`, and \`composition.acg2\`.
- The Qwen3-0.6B source closure is pinned by immutable revision and exact
  file-level lengths and SHA-256 digests. The model source contains the public
  architecture, Safetensors inventory, tokenizer assets, special tokens,
  generation configuration, and chat-template inputs.
- One preserved attempt emitted a candidate \`model.slm2\` of 598,308,416
  bytes, a \`tokenizer.tokenizer2\` of 7,038,773 bytes, and the other members,
  but the overall owner reached terminal failure at independent receipt
  inspection. Those bytes are not eligible for promotion and may not be
  adopted by a future run. The sizes are context, not evidence of correctness.
- A future successful conversion still proves only composition structure. It
  must pass independent semantic inspection before scalar-native and
  browser-WASM numerical proof.

Research and resolve:

1. Derive an independent Qwen3-0.6B architecture oracle from immutable public
   files and implementation source. Cover vocabulary, hidden size,
   intermediate size, layer count, attention heads, key/value heads, head
   dimension, RoPE parameters, RMSNorm epsilon, activation, bias policy,
   tied/untied embeddings, output projection, and any generation-specific
   configuration.
2. Derive the complete expected tensor inventory and shape equations. Include
   embeddings, per-layer attention projections, MLP projections, norms, final
   norm, and tied output handling. Define exact-name versus semantic-role
   mapping and reject missing, duplicate, extra, aliased, overlapping, or
   shape-inconsistent tensors.
3. Specify a hostile-safe SLM2 reader boundary without assuming private layout
   details. Cover magic and schema identity, endian marker, checked offsets,
   alignment, nonoverlap, region ordering, dtype/quantization metadata,
   bounded counts, integer overflow, file truncation, trailing bytes, sparse
   holes, memory mapping, TOCTOU, and streaming digests.
4. Define a quantization semantic contract sufficient for later kernels.
   Address per-tensor/per-channel/per-group scale placement, zero point, signed
   range, group size, packing order, tail groups, special unquantized tensors,
   accumulator width, dequantization formula, and deterministic rounding.
5. Specify how Tokenizer2 must bind to model vocabulary. Cover vocabulary
   cardinality, token IDs, byte fallback, merge ranks, special tokens, unknown
   token policy, added tokens, normalizer/pretokenizer semantics, EOS/BOS, and
   embedding/output index bounds.
6. Specify Template2, Sampling2, and Prompt2 semantic closure. Determine which
   publisher chat-template choices, thinking controls, stop IDs, generation
   defaults, sampling parameters, context limits, and prompt authority rules
   must be explicit rather than inherited from ambient runtime defaults.
7. Design the composition manifest graph. It must bind exact member names,
   content hashes, sizes, media/schema identities, semantic roles, source
   revision/locks, conversion profile, quantization profile, and dependency
   compatibility without using paths as identity.
8. Define independent verification ordering so hostile metadata cannot induce
   unbounded allocation before cheap structural checks. Provide pseudocode with
   hard limits and typed errors for every stage.
9. Create an adversarial corpus: wrong tensor shape, duplicate role, tied
   embedding inconsistency, malformed group tail, NaN/Inf scale, negative zero,
   overlapping regions, digest mismatch, cross-member vocabulary mismatch,
   invalid stop token, missing template branch, contradictory context length,
   path traversal, symlink/reparse source, truncated member, extra member, and
   valid-but-unsupported feature.
10. Define differential validation using at least two independent readers and
    public source-derived expectations. Explain how to avoid common-mode trust
    in converter receipts.
11. Specify the exact boundary between semantic composition pass and numerical
    execution pass. List claims allowed and forbidden at this point.
12. Provide a staged implementation backlog and objective gate for handing one
    immutable candidate to a scalar-native reference runtime.

Required report structure:

1. Executive acceptance model and assumptions.
2. Public Qwen3 architecture oracle.
3. Tensor inventory and shape derivation.
4. Hostile-safe SLM2 parser requirements.
5. Quantization representation contract.
6. Tokenizer/model semantic binding.
7. Template, sampling, prompt, and composition closure.
8. Verification algorithm and bounded resource model.
9. Adversarial corpus and fuzz strategy.
10. Independent-reader and differential test plan.
11. Allowed claims, prohibited claims, and acceptance gate.
12. Prioritized implementation sequence.
13. Unknowns requiring local source/artifact inspection.
14. Annotated primary-source bibliography with dates and immutable links.

Do not infer correctness from file size, producer success, popularity, a valid
header, or one attractive output. Do not recommend a permissive reader,
post-hoc repair, ignored extra tensors, implicit runtime defaults, or adoption
of bytes from the closed failed attempt.

## Prompt 5: Scalar-Native Qwen3 Reference Runtime As The Numerical Authority

You are an independent principal numerical-software engineer, transformer
mathematics specialist, and Rust CPU-runtime architect. Produce an
exceptionally detailed, implementation-oriented report defining a small,
auditable scalar-native reference runtime for a converted Qwen3-0.6B SLM2
composition. Target 12,000 to 20,000 words excluding bibliography. The scalar
path is intended to establish correctness before optimized native or browser
kernels exist; it is not allowed to hide disagreement behind loose tolerances.

You may browse the immutable public \`Qwen/Qwen3-0.6B\` source revision
\`c1899de289a04d12100db370d81485cdf75e47ca\`, official Qwen and Transformers
code and documentation, Safetensors documentation, numerical-analysis
literature, Rust standard-library documentation, CPU floating-point
specifications, and quantization papers. You have no TinyRustLM source,
private SLM2 bytes, converter, test vectors, model outputs, hardware logs, or
credentials. Clearly distinguish public observations from the project facts
below and from your recommendations.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch browser-local AI product. SLM2 is its sole
  intended model format. No obsolete runtime, compatibility reader, fallback
  backend, response repair, retry selection, best-of-N, or tolerated code debt
  is permitted.
- The first candidate is the pinned Qwen3-0.6B source. A future successful
  conversion is expected to produce a roughly 598 MB mixed-Q8
  \`model.slm2\` plus exact Tokenizer2, Template2, Sampling2, Prompt2, and ACG2
  members. Approximate size is not evidence and may change in a new operation.
- Independent composition inspection must precede inference.
- The scalar-native path is the project reference for converted-byte
  interpretation. Optimized CPU SIMD and browser-WASM kernels must be
  differential implementations, not separate semantic authorities.
- Prompts and expected answers must remain private. Public evidence may expose
  hashes, dimensions, aggregate errors, timing/memory summaries, typed status,
  and version identities, but not raw prompts or hidden model data.
- Arithmetic quality is secondary to conversation quality, but arithmetic
  mistakes in the runtime mathematics are not acceptable.

Research and specify:

1. Derive the exact Qwen3 decoder-layer equations from immutable publisher
   sources: embedding lookup, residual stream, pre/post normalization order,
   RMSNorm, grouped-query attention, query/key normalization if applicable,
   rotary position embedding, causal masking, scaled dot-product attention,
   SwiGLU/MLP, residual additions, final normalization, tied output projection,
   and logits.
2. State tensor dimensions and loop bounds symbolically and for the public
   Qwen3-0.6B configuration. Include batch-one prefill and token-by-token
   decode, grouped-query head mapping, RoPE pair indexing, context position,
   and vocabulary projection.
3. Define the mixed-Q8 dequantization and matrix-vector contract. Cover packed
   signed integers, scale granularity, tail groups, exact reconstruction,
   multiplication order, accumulator precision, conversion to \`f32\` or
   \`f64\`, rounding, subnormals, NaN/Inf rejection, and overflow checks.
4. Recommend which operations the scalar oracle should perform in \`f32\`,
   \`f64\`, or widened integer arithmetic, and why. Distinguish a faithful
   product reference from a high-precision diagnostic oracle. Explain how
   compiler optimization flags, fused multiply-add, flush-to-zero, and
   platform math libraries affect reproducibility.
5. Provide auditable pseudocode for SLM2 tensor loading, one transformer layer,
   prefill, KV-cache append, one decode step, logits, sampling, cancellation,
   and complete generation. Every allocation and index operation must be
   bounded and checked.
6. Design KV-cache ownership and layout for grouped-query attention. Derive
   bytes as a function of layers, key/value heads, head dimension, element
   width, and retained tokens. Cover maximum context, overflow, cancellation,
   reset, conversation continuation, and cache invalidation when composition
   identity changes.
7. Define deterministic token selection. Separate greedy decoding from seeded
   temperature/top-k/top-p/repetition-penalty behavior. Specify stable
   tie-breaking, sort order, random-number generator identity, floating-point
   cumulative probability, stop-token handling, max-token termination, and no
   hidden retry.
8. Establish typed error boundaries for malformed tensor metadata, unsupported
   quantization, allocation failure, context overflow, invalid token ID,
   nonfinite activation, cancellation, timeout, and internal invariant breach.
   Errors must not become truncated but apparently successful answers.
9. Create unit-test vectors small enough to hand-check: RMSNorm, RoPE, GQA head
   mapping, quantized dot product, softmax, SwiGLU, tied projection, repetition
   penalty, top-k/top-p, and KV append. Include adversarial signs, tails,
   extreme values, zero-length and maximum-length boundaries.
10. Define end-to-end source-derived conformance. Use exact input token IDs and
    compare embedding outputs, selected layers, final hidden state, logits,
    top-token ordering, and greedy token sequences. Recommend absolute,
    relative, ULP, cosine, rank, and top-k agreement metrics with justified
    thresholds and escalation rules.
11. Derive honest memory and time formulas for model mapping, transient tensor
    buffers, activations, logits, tokenizer state, and KV cache. Explain what
    must be measured on win-x64, linux-x64, and linux-arm64 rather than
    predicted.
12. Define the handoff from scalar correctness to SIMD. The scalar path must
    remain small and testable, but production must not quietly route to it as a
    fallback after an optimized-kernel failure. Explain dispatch admission,
    differential gates, and fail-closed behavior.

Required report structure:

1. Executive numerical authority decision.
2. Exact Qwen3 equations and architecture parameters.
3. SLM2 tensor and quantization interpretation.
4. Floating-point and determinism policy.
5. Scalar runtime algorithms and pseudocode.
6. KV-cache and generation-state design.
7. Deterministic sampling contract.
8. Error, cancellation, and resource boundaries.
9. Hand-checkable kernel vectors.
10. Source-derived end-to-end conformance.
11. Memory/time model and measurement plan.
12. SIMD handoff and acceptance gate.
13. Unknowns requiring local artifacts and execution.
14. Annotated primary-source bibliography with immutable links and dates.

Do not recommend using attractive text as a numerical oracle, loosening
tolerances until a candidate passes, silently replacing unsupported operations,
repairing nonfinite outputs, selecting the best seed, or keeping two semantic
runtimes for compatibility.

## Prompt 6: Pinned Source-Framework Oracle And Layerwise First-Divergence Forensics

You are an independent principal ML systems validation engineer, numerical
forensics researcher, and reproducibility specialist. Produce an exceptionally
detailed report defining a pinned source-framework oracle and a
first-divergence laboratory for comparing public Qwen3 source execution,
converted SLM2 scalar-native execution, optimized native execution, and
browser-WASM execution. Target 12,000 to 20,000 words excluding bibliography.

You may inspect the immutable public \`Qwen/Qwen3-0.6B\` revision
\`c1899de289a04d12100db370d81485cdf75e47ca\`, official Qwen and Hugging Face
Transformers source, PyTorch documentation, numerical reproducibility
guidance, ONNX or other differential-testing literature, browser/WASM
standards, and public test methodologies. You cannot inspect TinyRustLM code,
private SLM2 artifacts, prompts, outputs, receipts, machines, or test results.
Do not claim local comparison.

Project-supplied facts and constraints:

- TinyRustLM is a clean-slate prelaunch browser-local product with one SLM2
  path. There is no legacy runtime, compatibility mode, fallback backend,
  response repair, hidden retry, best-of-N, or accepted numerical debt.
- The source model is pinned by immutable revision and exact source-file
  digests. The conversion output must be independently inspected before
  numerical testing.
- The intended proof chain is source framework -> converted scalar-native
  reference -> optimized native kernels -> browser-WASM kernels. Every arrow
  requires explicit evidence; transitive confidence or benchmark familiarity
  is insufficient.
- The product uses publisher-exact tokenizer, chat template, prompt policy, and
  sampling identities. Token or prompt mismatch must not be misdiagnosed as a
  matrix-kernel defect.
- Private prompts and raw model outputs are not public evidence. Bounded
  numerical summaries and hashes may be public.

Research and resolve:

1. Define a hermetic source-framework oracle: exact Python, PyTorch,
   Transformers, tokenizer, safetensors, model revision, configuration, chat
   template, dtype, device, thread, random seed, deterministic-algorithm, and
   dependency-lock requirements. Explain offline replay and immutable wheel or
   package closure.
2. Separate four input layers: raw Unicode conversation, rendered chat text,
   token IDs/attention mask/position IDs, and model tensor inputs. Define which
   comparisons diagnose tokenizer, template, context assembly, and runtime
   defects.
3. Specify capture points for embeddings, normalized activations, Q/K/V,
   rotated Q/K, attention scores/probabilities, attention output, MLP gates and
   outputs, residual states, final hidden state, logits, sampled token, and KV
   cache. Address capture overhead and how to avoid changing semantics.
4. Design content-addressed observation records without exposing raw tensors.
   Compare exact-byte hashes, canonical float encodings, summary statistics,
   sampled coordinate proofs, chunked Merkle trees, and encrypted/private raw
   captures. State which evidence supports debugging and which supports public
   audit.
5. Define comparison metrics by tensor type: absolute/relative error, ULP,
   normalized RMSE, cosine similarity, maximum coordinate error, sign
   disagreement, top-logit rank, top-k set overlap, KL or Jensen-Shannon
   divergence, and greedy-token identity. Explain limitations of each.
6. Establish principled threshold derivation. Use operation depth,
   quantization error, accumulator precision, softmax sensitivity, and
   empirical calibration on sealed diagnostic cases. Reject a global tolerance
   selected after seeing a preferred model.
7. Provide a binary-search or staged first-divergence algorithm that identifies
   the earliest layer, suboperation, token position, head, and tensor chunk
   whose error exceeds its preregistered bound.
8. Distinguish expected quantization difference from implementation defect.
   Propose a float reconstructed-weight oracle, quantized scalar oracle, and
   packed-kernel implementation so discrepancies can be localized to
   conversion, dequantization, arithmetic, or dispatch.
9. Cover nondeterminism: threads, reduction order, BLAS kernels, FMA,
   denormals, GPU operations, Python hashing, RNG implementation, browser JIT,
   WASM SIMD, and source-framework generation defaults. Specify what must be
   fixed and what must be statistically characterized.
10. Design a sealed diagnostic suite spanning empty/minimal framing, Unicode,
    long prefill, repeated tokens, boundary context, multi-turn cache reuse,
    cancellation, and adversarial logits. Bind cases by private hash,
    generator version, seed, and exclusion set.
11. Define immutable failure evidence and TDD workflow. Preserve the raw
    private divergence, publish only bounded facts, add a minimal generic
    regression, fix the narrow cause, rerun only invalidated phases, and never
    overwrite an earlier comparison.
12. Specify objective promotion gates for scalar-native, optimized native, and
    browser-WASM separately. Include allowed claims, prohibited claims, and
    residual uncertainty after each gate.

Required report structure:

1. Executive oracle recommendation and assumptions.
2. Hermetic source-framework closure.
3. Input and semantic-layer separation.
4. Instrumentation and capture-point design.
5. Privacy-preserving observation records.
6. Metrics and preregistered threshold derivation.
7. First-divergence localization algorithm.
8. Quantization-versus-kernel fault isolation.
9. Determinism and stochastic controls.
10. Sealed diagnostic and adversarial suite.
11. Immutable failure-to-regression workflow.
12. Tiered numerical promotion gates.
13. Unknowns requiring private execution.
14. Annotated primary-source bibliography with dates and pinned revisions.

Do not recommend comparing only final text, using an unpinned hosted model as
the oracle, changing prompts after seeing failures, averaging away a systematic
defect, selecting the best run, publishing private prompts, or treating
source-to-native agreement as browser proof.

## Prompt 7: Byte-Exact Tokenizer2, Template2, Sampling2, And Prompt2 Behavioral Closure

You are an independent principal tokenizer engineer, language-runtime
semantics specialist, and adversarial Unicode tester. Produce an exceptionally
detailed report specifying a complete portable behavioral contract for the
non-weight members of a Qwen3-0.6B SLM2 composition: Tokenizer2, Template2,
Sampling2, and Prompt2. Target 12,000 to 20,000 words excluding bibliography.
The report must enable independent Rust, .NET, JavaScript, and browser
implementations to produce the same token stream and generation behavior
without evaluating arbitrary publisher scripting at runtime.

You may inspect the immutable public \`Qwen/Qwen3-0.6B\` revision
\`c1899de289a04d12100db370d81485cdf75e47ca\`, official Qwen model cards,
tokenizer files, chat-template material, Transformers source and
documentation, Unicode standards, byte-level BPE literature, Jinja semantics,
random-sampling literature, and browser text-encoding standards. You have no
access to TinyRustLM source, its private formats, generated artifacts, prompts,
tests, or outputs.

Project-supplied facts and constraints:

- TinyRustLM is a prelaunch browser-local product with one SLM2 composition
  path. Tokenizer2, Template2, Sampling2, and Prompt2 are technical identities,
  not compatibility generations. No legacy tokenizer, alias suffix, fallback
  template, permissive parser, response repair, or hidden sampling retry is
  allowed.
- The composition must preserve publisher semantics needed for Qwen3-0.6B
  while representing them as bounded declarative data. Runtime evaluation of
  arbitrary Python or Jinja supplied by an artifact is not acceptable.
- Tokenizer behavior must match before numerical model comparison can be
  meaningful. Template, prompt, and sampling identities must be included in
  every evidence binding.
- Product behavior requires multi-turn conversation, latest-current-user
  precedence over stale memory, quoted/retrieved instructions treated as
  untrusted data, lawful adult helpfulness, and narrow explicit harm
  boundaries. The report must separate these project policy requirements from
  publisher chat framing and must not invent private prompt text.
- Raw private prompts and expected responses cannot be included in public
  evidence or training data.

Research and specify:

1. Reconstruct the publisher tokenizer pipeline at the pinned revision:
   input Unicode handling, normalizer, pretokenizer, byte encoding, vocabulary,
   merge ordering, ranks, added tokens, special tokens, unknown behavior,
   decoder, cleanup, and offset mapping. Identify all externally observable
   behavior that must survive conversion.
2. Define exact encoding and decoding algorithms with deterministic
   tie-breaking. Cover invalid Unicode scalar sequences as represented by host
   strings or bytes, unpaired UTF-16 surrogates in JavaScript/.NET, NUL,
   combining sequences, normalization lookalikes, variation selectors, emoji
   ZWJ sequences, RTL controls, newlines, tabs, nonbreaking space, and
   publisher special-token text embedded as ordinary user data.
3. Specify vocabulary and merge-table binary representation: canonical token
   bytes, ID domain, duplicate detection, rank widths, index structures,
   maximum lengths/counts, checked arithmetic, streaming load, and malicious
   collision cases.
4. Define special-token policy by role and trust boundary. Distinguish tokens
   emitted by the trusted template compiler from literal user text. Prevent a
   user or untrusted memory record from smuggling role separators, generation
   markers, thinking controls, or end tokens.
5. Translate the pinned publisher chat template into a bounded declarative
   Template2 state machine. Enumerate roles, turn ordering, system-message
   behavior, assistant-prefix behavior, thinking/non-thinking controls,
   tool-related branches if present, whitespace/newline rules, and rejection
   of unsupported branches. Provide a proof strategy against the publisher
   reference over a generated message corpus.
6. Define Prompt2 as an explicit authority-ordered context contract rather
   than a hidden text blob. Cover system/product policy, current user turn,
   prior conversation, trustworthy local state, untrusted retrieved memory,
   truncation markers, source labels, and latest-turn precedence. Identify
   which parts can be standardized without disclosing private prompt wording.
7. Define Sampling2: greedy and stochastic modes, temperature, top-k, top-p,
   minimum probability if any, repetition penalty, seed and RNG identity,
   stable sort/tie order, stop-token sets, maximum generation, EOS handling,
   and exact termination reason. Reject unspecified ambient defaults.
8. Specify context assembly and truncation by token budget. Cover whole-message
   boundaries, system and current-turn retention, memory provenance,
   deterministic priority, summary insertion, oversize single messages, and
   prohibition on silent semantic rewriting.
9. Create cross-runtime golden vectors for encode, decode, special tokens,
   template render, context assembly, sampling, and termination. Include
   positive, malformed, adversarial, and maximum-bound cases with canonical
   bytes and typed verdicts.
10. Design metamorphic and property tests: encode/decode relations where
    valid, segmentation invariance boundaries, role permutations, whitespace
    changes, Unicode substitutions, special-token injection, authority
    reordering, fixed-seed replay, and sampling edge distributions.
11. Define browser implementation constraints: TextEncoder/TextDecoder
    behavior, UTF-16 conversion, memory growth, worker transfer, bounded
    tables, deterministic sorting, and avoiding locale-sensitive APIs.
12. Provide an acceptance hierarchy from structural parsing through
    publisher-reference parity and multi-turn browser parity. State claims
    allowed at each level and what remains unproven.

Required report structure:

1. Executive semantic-closure recommendation.
2. Pinned publisher tokenizer behavior.
3. Tokenizer2 algorithms and binary representation.
4. Unicode and hostile-input contract.
5. Special-token trust boundary.
6. Template2 declarative state machine.
7. Prompt2 authority and context assembly.
8. Sampling2 deterministic/stochastic contract.
9. Cross-runtime golden and adversarial vectors.
10. Property, metamorphic, and differential tests.
11. Browser-specific implementation constraints.
12. Tiered acceptance criteria and implementation plan.
13. Unknowns requiring private source/artifact inspection.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend executing arbitrary Jinja in the browser, treating JavaScript
UTF-16 strings as UTF-8 bytes, accepting user-provided special tokens as
trusted framing, inheriting sampling defaults from a library, silently
repairing malformed input, or preserving a second tokenizer path.

## Prompt 8: Real-Browser WASM Qwen3 Execution Under Honest Memory And Isolation Limits

You are an independent principal WebAssembly runtime architect, browser
performance engineer, and client-side security specialist. Produce an
exceptionally detailed report defining how a roughly 0.6B-parameter,
approximately 598 MB mixed-Q8 Qwen3 SLM2 model can be loaded and executed in a
real browser with bounded memory, deterministic semantics, cancellation, and
no prompt or model upload. Target 12,000 to 20,000 words excluding bibliography.

Research current primary documentation for WebAssembly core and SIMD, threads
and shared memory, JavaScript memory APIs, Chromium, Firefox, WebKit, COOP/COEP,
cross-origin isolation, service workers, OPFS/File System Access, IndexedDB,
streams, workers, structured clone, transferable objects, CSP, memory limits,
and relevant Rust WASM tooling. Record browser and documentation versions and
retrieval dates. You cannot inspect TinyRustLM source, its WASM binary, SLM2
files, browser traces, servers, tests, or credentials.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch browser-local chat product with one intended SLM2
  runtime. There is no legacy path, JS inference fallback, server inference
  fallback, format compatibility reader, silent retry, response repair,
  best-of-N, or accepted code debt.
- The first candidate is pinned Qwen3-0.6B converted to a complete composition.
  A prior failed candidate had a 598,308,416-byte model member, but those bytes
  are closed evidence and cannot be promoted. Treat the size only as a planning
  class.
- Scalar-native inference is intended to become the converted-byte reference.
  Browser-WASM must prove conformance using the same composition, rendered
  prompt bytes, token IDs, positions, seeds, sampling profile, and stop policy.
- Model bytes remain local or travel directly between consenting peers.
  TinyRustLM project sites must not receive model bytes or prompts.
- Product execution occurs in a dedicated worker. Cancellation must terminate
  real work, a poisoned worker must be discarded, and a fresh worker must be
  able to recover from immutable installed bytes.
- A real-browser pass requires genuine Chromium execution at minimum and must
  distinguish browser proof from Node or a WASM harness outside a browser.

Research and specify:

1. Build a current browser capability matrix for WASM32 addressability,
   Memory64 status, maximum initial/maximum memory, ArrayBuffer and
   SharedArrayBuffer limits, SIMD, relaxed SIMD, threads, bulk memory,
   streaming compilation, module caching, and worker support. Separate
   normative standards, documented implementation limits, and facts requiring
   local probing.
2. Produce a complete peak-memory equation for immutable model bytes, file or
   OPFS handles, mapped/read chunks, WASM linear memory, dequantization scratch,
   activations, logits, tokenizer tables, template/context buffers, KV cache,
   worker messaging, JavaScript copies, compiler/JIT overhead, and browser
   process overhead. Identify and eliminate accidental whole-file copies.
3. Compare storage and load paths: File System Access handles, OPFS sync access
   handles in workers, OPFS async APIs, IndexedDB blobs, fetch streams from a
   direct peer, loopback companion streams, and user-selected files. Evaluate
   zero-copy claims skeptically and define measurement to count copies.
4. Design a bounded streaming SLM2 loader. Cover header-first admission,
   member hash verification, random-access tensor pages, chunk size, back
   pressure, cancellation, partial storage, crash recovery, and atomic
   activation only after complete verification.
5. Specify portable scalar and SIMD kernel contracts for mixed-Q8 matrix-vector
   operations, RMSNorm, RoPE, softmax, GQA attention, SwiGLU, residuals, and
   logits. Address alignment, lane width, tails, integer widening, floating
   reduction order, feature detection, and rejection when the required kernel
   profile is unavailable.
6. Define worker ownership and messaging. The worker must own model and KV
   state; UI messages must be bounded typed commands/events; token streaming
   must not cause unbounded queues or duplicate render; transfer/copy behavior
   must be explicit.
7. Specify cancellation and failure containment for prefill, decode, hashing,
   storage, and P2P transfer. Compare cooperative atomics, message flags,
   worker termination, and process closure. Define when the worker is
   permanently poisoned and how a fresh worker validates and reopens immutable
   installed bytes.
8. Cover cross-origin isolation and deployment headers. Define COOP, COEP,
   CORP/CORS, CSP, service-worker behavior, third-party asset restrictions,
   subresource integrity where applicable, and an explicit no-telemetry/no
   prompt-upload network allowlist.
9. Design deterministic native/WASM conformance at kernel, layer, logits, and
   token-sequence levels. Account for WASM floating semantics, SIMD reduction,
   browser JIT variation, threads, and stable sampling.
10. Define performance measurement: cold/warm startup, compile, model open,
    verification, prefill tokens/sec, decode tokens/sec, first-token latency,
    peak resident/linear/JS memory, KV bytes/token, cancellation latency, and
    recovery time. Use formulas and experimental methods, never invented
    values.
11. Create a real-browser matrix for desktop and constrained environments.
    Cover Chromium as the required first proof and clearly label Firefox/WebKit
    support as proven, blocked, or untested. Include low-memory admission,
    tab suspension, background throttling, refresh, browser crash, stale
    service worker, and storage quota loss.
12. Define objective acceptance and release evidence: exact browser build,
    WASM/module hash, composition identity, profile identities, network trace
    summary, resource ceilings, raw private outputs, typed terminal result,
    profile deletion, and prohibited claims.

Required report structure:

1. Executive browser architecture recommendation.
2. Current standards and browser capability matrix.
3. Peak-memory and copy-count model.
4. Storage, streaming load, and atomic activation.
5. Scalar/SIMD WASM kernel contract.
6. Worker protocol and state ownership.
7. Cancellation, poisoning, and fresh-worker recovery.
8. Isolation headers and network privacy contract.
9. Native/WASM numerical conformance.
10. Performance and resource laboratory.
11. Cross-browser and fault-injection matrix.
12. Acceptance gate and prioritized implementation plan.
13. Unknowns requiring local real-browser execution.
14. Annotated primary-source bibliography with dates.

Do not call Node execution browser proof, assume a 598 MB file consumes only
598 MB at runtime, rely on implicit memory growth, keep a hidden JavaScript or
server fallback, retry a generation invisibly, weaken numerical gates for
speed, or claim cross-browser support from Chromium alone.

## Prompt 9: Exactly-Once Browser Conversation, Worker Termination, And Fresh-Profile Recovery

You are an independent principal browser-application architect, concurrency
engineer, and AI interaction reliability specialist. Produce an exceptionally
detailed, implementation-oriented report defining the state machines and test
evidence needed for one real SLM2 model to conduct a genuine multi-turn
browser-local conversation with each assistant answer rendered exactly once,
real cancellation, worker replacement, and clean-profile restart. Target
10,000 to 18,000 words excluding bibliography.

Research current primary documentation for Chromium, Playwright, Web Workers,
structured clone, transferable objects, MessageChannel, BroadcastChannel, Web
Locks, service workers, IndexedDB, OPFS, File System Access, page lifecycle,
AbortController, accessibility APIs, and browser storage deletion. You have no
access to TinyRustLM source, browser builds, model files, Playwright tests,
private prompts, traces, screenshots, credentials, or production services.
Do not claim private execution.

Project-supplied facts and constraints:

- TinyRustLM is one unversioned prelaunch browser-local chat product. There is
  no released UI requiring compatibility and no permission for duplicate old
  controllers, fallback inference, legacy event names, repair of malformed
  model text, invisible retries, best-of-N, or accepted code debt.
- The first intended model is a pinned Qwen3-0.6B SLM2 composition that must
  first pass composition and numerical gates. Model bytes and prompts must
  remain local or direct P2P; project websites must not receive them.
- Inference runs in a dedicated worker. The worker owns model, tokenizer, and
  KV state. UI state must have one authoritative event path.
- A cancellation must stop actual computation. If termination is required, the
  old worker must be discarded and a new worker must reopen and verify
  immutable installed composition bytes before another generation.
- Product expectations include a stable center conversation workspace after
  the first user turn, disappearance of introductory prompt cards, a fixed
  composer, one assistant rendering, truthful status, and no casual visual
  redesign.
- A real dogfood round eventually requires a newly created persistent browser
  profile, process/context closure, deletion of the owned profile directory,
  and proof of deletion. Reloading or clearing one storage API is not a fresh
  restart.
- Local memory files remain supported for device-local and offline continuity.
  MemoryEndpoints.com is the authorized, strongly recommended portable-memory
  backbone for cross-device and worldwide continuity. Its use must be explicit,
  credential-safe, provenance-labeled, and separately evidenced; service
  reachability or configured code alone must not be counted as a live round.

Research and specify:

1. Define separate but linked state machines for installed composition,
   worker, conversation, turn, generation, message rendering, cancellation,
   and browser profile. Provide legal transitions, transition owner, durable
   versus ephemeral state, monotonic sequence numbers, and terminal states.
2. Design a typed UI/worker protocol. Every command and event must bind
   protocol identity, composition identity, conversation ID, turn ID,
   generation ID, message ID, sequence number, and payload length. Define
   commands/events for load, verify, ready, prefill progress, token chunk,
   completion, cancellation requested, cancelled, fault, unload, and shutdown.
3. Establish exactly-once rendering semantics despite at-least-once delivery
   hazards, React or DOM rerenders, late worker messages, cancellation races,
   page visibility changes, stale service workers, and worker replacement.
   Provide idempotency/deduplication rules that do not discard legitimate
   repeated token text.
4. Define raw-output custody versus rendered presentation. Preserve exact token
   IDs and decoded raw output privately; render incrementally without
   rewriting, completing, retrying, or choosing a better answer. Explain
   Markdown/sanitization boundaries and how malformed output reaches a truthful
   visible error rather than a repaired pass.
5. Specify multi-turn state and KV-cache rules. Cover turn commit, assistant
   completion, cancellation before/after token emission, edit/resend policy,
   model switching, context truncation, current-user precedence, untrusted
   memory labels, and invalidation after worker or composition change.
6. Design real cancellation. Compare cooperative checks within kernels,
   SharedArrayBuffer atomics, worker messages, and \`Worker.terminate()\`.
   Define maximum cancellation latency, proof of process/work cessation,
   terminal event ordering, partial answer handling, and fresh-worker recovery.
7. Define failure handling for WASM trap, allocation failure, context overflow,
   corrupt storage, hash drift, worker crash, browser tab crash, page reload,
   service-worker update, and duplicate or out-of-order events. No failure may
   silently start a second generation.
8. Specify fresh-profile Playwright lifecycle on Windows and Linux: owned temp
   root, marker and random identity, persistent context, actual browser process
   closure, leaked-handle detection, bounded deletion retries, reparse/symlink
   defenses, parent containment, deletion proof, and crash cleanup.
9. Define UI assertions across desktop, narrow, and mobile viewports:
   conversation-workspace transition, composer stability, no overlap,
   long model names, long output, scroll anchoring, focus, keyboard operation,
   screen-reader labels, reduced motion, truthful load/generation status, and
   secret-free screenshots.
10. Define network and privacy assertions. Capture requests, WebSockets,
    service-worker fetches, beacons, reports, referrers, and DNS-visible
    endpoints. Permit only explicit static/catalog/direct-peer/loopback
    operations and fail any prompt/model upload, telemetry, credential URL, or
    unexpected third party.
11. Create a race and fault-injection matrix: double submit, Enter plus click,
    cancel during prefill, cancel between token and completion, model switch
    during generation, late old-worker event, worker crash, stale event after
    reload, storage lock, quota loss, browser crash, profile deletion lock, and
    repeated identical output tokens.
12. Define one real multi-turn acceptance round with private prompt hashes,
    exact model/profile/browser identities, no retry, raw output preservation,
    message/render counts, worker termination proof, network summary, resource
    bounds, process closure, profile deletion, and a typed final verdict.

Required report structure:

1. Executive interaction-reliability recommendation.
2. Linked model/worker/conversation/turn state machines.
3. Typed UI-worker protocol.
4. Exactly-once rendering algorithm.
5. Multi-turn, KV, and context semantics.
6. Cancellation and fresh-worker recovery.
7. Failure containment and restart behavior.
8. Owned fresh-profile/deletion protocol.
9. Responsive and accessible UI assertions.
10. Network/privacy proof.
11. Race/fault-injection matrix.
12. Real-round acceptance evidence and implementation sequence.
13. Unknowns requiring local browser execution.
14. Annotated primary-source bibliography with dates.

Do not describe MemoryEndpoints as unauthorized, and do not describe a reload,
incognito context, or \`localStorage.clear()\` as a
fresh-profile deletion; do not accept two renders because the text matches;
do not repair output, auto-retry generation, keep events from a terminated
worker authoritative, silently upload memory, or count mocked inference or an
unverified hosted-memory lifecycle as a pass.

## Prompt 10: P2P-First Or Automatic Local Conversion That Performs The User's Requested Action

You are an independent principal local-first systems architect, P2P protocol
engineer, and secure browser-companion designer. Produce an exceptionally
detailed report defining the user and protocol flow when a person selects a
public model: obtain an already qualified matching SLM2 composition directly
from verified peers when available, otherwise acquire the pinned public source
and convert it locally, then atomically install and open it for chat. Target
12,000 to 20,000 words excluding bibliography.

Research current primary documentation for browser security, loopback origins,
CORS and Private Network Access, DNS rebinding, CSRF, WebSocket security,
File System Access, OPFS, streams, service workers, resumable content-addressed
downloads, HTTP range requests, NAT and direct P2P, cryptographic manifests,
Hugging Face repository/LFS behavior, licensing metadata, Windows and Linux
local services, and secure update systems. You have no access to TinyRustLM or
MiniModel source, model files, peers, catalogs, companion binaries, network
configuration, credentials, or production endpoints.

Project-supplied facts and constraints:

- TinyRustLM is a prelaunch browser-local AI chat product. MiniModel.org is
  intended to provide catalog/discovery metadata but not proxy model bytes.
  Model bytes should flow directly between consenting peers or be converted
  locally from a pinned public source.
- The user has explicitly rejected downloading instruction text, JSON request
  files, PowerShell scripts, or similar handoff artifacts when selecting a
  model. The product must perform the requested operation through an installed
  companion or clearly state one concrete prerequisite. A text-file download
  is not model acquisition.
- The sole target format is one SLM2 composition. There is no legacy format,
  migration, fallback artifact, compatibility alias, remote inference, hidden
  retry, or accepted debt.
- Only a composition with source/provenance/license binding, independent
  structure, numerical conformance, and model-quality evidence may be called
  qualified. A P2P byte match without those bindings is not enough.
- If no exact qualified peer exists, local conversion must pin and verify the
  public source revision before running one deterministic conversion. Model
  and private evidence bytes stay outside Git.
- The browser site must not receive prompts or model bytes. Loopback companion
  communication must be explicitly authenticated and origin-bound.
- A prior roughly 598 MB Qwen3 candidate size is useful only for resource
  planning. A closed failed candidate cannot be offered or reused.

Research and specify:

1. Define the complete user journey from catalog selection through capability
   discovery, qualified-peer lookup, P2P import or source conversion,
   verification, installation, activation, and chat readiness. Include
   truthful states, progress units, storage requirements, cancellation, and
   actionable typed failures.
2. Design catalog metadata that binds public model identity, exact qualified
   composition identity, source revision, source locks, license/provenance,
   architecture/profile identities, member manifest, quality claim, minimum
   runtime, piece set, and expiring peer announcements. Reject aliases pointing
   to different bytes.
3. Define deterministic route selection. Prefer only an exact currently
   qualified peer composition; otherwise choose local conversion. Explain peer
   timeout and failure behavior without invisible route retries or best-of-N.
   The user must know which operation is occurring.
4. Specify resumable multi-peer direct import. Require complete identity
   agreement before mixing pieces, fixed piece boundaries, per-piece hashes,
   range validation, peer/lane identity, bounded concurrency, durable journal,
   corruption quarantine, final whole-member verification, and atomic
   promotion.
5. Define the local-conversion branch. Cover source-card/license review,
   immutable revision resolution, LFS pointer handling, source-file lock,
   storage and RAM preflight, consent, deterministic acquisition, conversion
   registration, one-shot execution, independent inspection, numerical/quality
   evidence lookup, and installation. Explain when conversion must stop because
   the source is unsupported or unqualified.
6. Design a secure browser-to-companion discovery and session protocol.
   Address loopback port discovery without downloading scripts, ephemeral
   challenge/response, origin and browser-session binding, user-presence
   approval, TLS tradeoffs, DNS rebinding, CSRF, malicious local processes,
   replay, token storage, expiration, and least privilege.
7. Specify bounded typed APIs or messages for capability, model intent,
   import, conversion, progress, cancellation, verification, install,
   activation, and diagnostics. No API should accept arbitrary commands,
   arbitrary filesystem paths, or unrestricted URLs from the page.
8. Define storage transactions across companion filesystem and browser OPFS.
   Compare keeping model bytes companion-owned versus browser-owned. Cover
   staging, quotas, fsync, crash recovery, content-addressed directories,
   immutable activation pointers, garbage collection, and deletion with
   reference tracking.
9. Establish privacy/network controls: project sites cannot receive prompt or
   model bytes; peer endpoints receive only protocol-required data; public
   source acquisition is explicit; no implicit telemetry; logs and receipts
   exclude tokens, local paths, prompts, and invitation URLs.
10. Create a hostile test matrix: malicious catalog, expired peer proof,
    wrong piece, mixed identities, range abuse, path traversal, decompression
    bomb, source drift, LFS pointer substitution, license ambiguity, companion
    impostor, DNS rebinding, origin spoof, browser restart, disk full, power
    loss, cancellation, locked files, and stale activation.
11. Define UX and accessibility acceptance. The primary action must be an
    actual icon/text command with truthful status, not an instruction-file
    download. Include keyboard/screen-reader use, long names, storage/time
    disclosures, recovery instructions, and no marketing claim before evidence.
12. Provide a phased proof ladder from fixture to one real model: protocol unit
    tests, hostile integration tests, one loopback real conversion, one direct
    outside peer import, browser activation, local multi-turn chat, source
    control, deployment, and public HTTPS readback. Distinguish what CI can and
    cannot prove.

Required report structure:

1. Executive acquisition architecture.
2. End-user state machine and truthful status vocabulary.
3. Catalog, composition, peer, and claim identities.
4. P2P piece/import protocol.
5. Deterministic local-conversion branch.
6. Secure loopback companion handshake and API.
7. Transactional storage and activation.
8. Privacy and network contract.
9. Cancellation, resumption, and crash recovery.
10. Hostile-input and fault-injection matrix.
11. Accessible product acceptance criteria.
12. Staged implementation and proof plan.
13. Unknowns requiring local or authorized network access.
14. Annotated primary-source bibliography with dates.

Do not recommend downloading a text/JSON/script handoff, proxying model bytes
through a project site, silently using remote inference, accepting unqualified
peer bytes, mixing pieces with different identities, retrying hidden routes,
passing arbitrary paths to a companion, or preserving a legacy acquisition
flow.

## Prompt 11: No-Cheat Qualification And Quantization Noninferiority For One Real Small Assistant

You are an independent principal evaluation-science lead, small-model
researcher, and human-review protocol designer. Produce an exceptionally
detailed report defining how to decide whether one pinned Qwen3-0.6B source,
its converted mixed-Q8 SLM2 composition, and its browser execution are genuinely
useful enough for a first prelaunch product model. Target 12,000 to 20,000
words excluding bibliography. The gate must detect semantic failure and
quantization regression without training on evaluation answers or selecting
the luckiest generation.

Use current primary sources wherever possible: official Qwen model cards and
papers, immutable repository revisions, evaluation-science papers,
statistical-methods literature, human-rating guidance, contamination research,
quantization evaluation, and model-behavior auditing. You have no access to
TinyRustLM source, private prompts, training data, generated outputs, model
bytes, judges, receipts, or human raters. Do not invent results or claim local
quality.

Project-supplied facts and constraints:

- TinyRustLM is a prelaunch browser-local chat product. Candidate popularity,
  parameter count, conversion success, structural validity, one attractive
  answer, or benchmark familiarity cannot establish product quality.
- The current source candidate is public \`Qwen/Qwen3-0.6B\` pinned at revision
  \`c1899de289a04d12100db370d81485cdf75e47ca\`. A future SLM2 composition is
  expected to use a compact mixed-Q8 representation. Neither source nor
  quantized quality has yet been established by the facts provided here.
- Important behavior includes ordinary conversation, common-sense judgment,
  ambiguity handling, practical resource constraints, source conflict,
  latest-user preference over stale state, multi-turn reference, untrusted
  memory/quoted instruction handling, summarization, rewriting, JSON,
  extraction, code explanation, factual uncertainty, and direct substantive
  treatment of lawful adult questions with narrow harm boundaries.
- Arithmetic may be delegated to a deterministic calculator and should not
  dominate model selection.
- Raw outputs must be preserved. Response repair, answer completion, hidden
  retry, best-of-N, hand editing, expected-term injection, and lowering a gate
  to obtain a model are forbidden.
- Evaluation cases and expected answer concepts must not enter training.
  Public evidence is bounded; private prompts and outputs remain private.
- A model may honestly be rejected. Failure to qualify leaves campaign
  counters at zero and must trigger a better source or contamination-controlled
  training plan, not relabeling.

Research and specify:

1. Define a claim taxonomy from runtime smoke, structure verified, numerical
   conformance, conversation screened, task-specific qualified, through
   general-assistant qualified. For each, state minimum evidence and prohibited
   wording.
2. Design a source-first screen before conversion or training. Specify case
   counts, seeded paraphrase families, deterministic versus sampled runs,
   repeated seeds, blind human review, stop rules, and rejection thresholds
   sufficient to avoid spending more compute on an unsuitable 0.6B source.
3. Define a balanced behavior taxonomy and target proportions. Positive
   helpful examples must substantially outnumber refusal/boundary cases.
   Include multi-turn and adversarial quoted-memory cases rather than only
   one-shot prompts.
4. Express semantic invariants independent of fixture nouns and exact wording:
   ask for missing options/criteria when genuinely underspecified; acknowledge
   and resolve conflicting authorities; honor current preference over stale
   profile; respect unavailable resources and offer feasible alternatives;
   treat quoted instructions as data; present material considerations for
   lawful adult questions; represent uncertainty rather than fabricate.
5. Design metamorphic families that vary entities, units, percentages, dates,
   authority order, sentence order, explicit/implicit negation, resource
   availability, discourse style, irrelevant distractors, memory provenance,
   and current-turn changes. State which verdicts must remain invariant and
   which factor changes should change the correct behavior.
6. Specify a layered evaluator: deterministic structural/format checks,
   scenario-specific semantic invariants, independent model judges as
   non-authoritative signals, and blinded human adjudication. Define
   disagreement, appeals, evaluator drift, and judge prompt/output custody.
7. Design strict contamination controls: exact normalization, character/token
   n-grams, semantic-neighbor search, template-family detection,
   entity-substituted overlap, answer-concept overlap, public benchmark
   overlap, sealed holdouts, immutable exclusion sets, and deletion lineage.
8. Compare unadapted source, source-framework quantized reference if
   available, scalar-native SLM2, optimized native, and browser-WASM using the
   exact same rendered prompts, tokens, seeds, sampling, and output limits.
   Distinguish runtime parity from behavioral noninferiority.
9. Define quantization noninferiority statistics. Cover paired outcomes,
   ordinal ratings, bootstrap or exact intervals, clustered paraphrase
   families, multiple comparisons, practical margins, catastrophic-regression
   budgets, and sample-size planning as formulas rather than invented counts.
10. Treat stochastic behavior honestly. Precommit seeds and repetition count,
    estimate pass probability and uncertainty, distinguish infrastructure
    flake from model variability, and explain why best-of-N is invalid unless
    that exact behavior is the shipped product.
11. Define human review: rubric, training, blinding, source-versus-quantized
    pairing, inter-rater agreement, adjudication, conflict-of-interest,
    over-refusal and censorship challenge sets, and handling of lawful adult
    content without moralizing.
12. Provide pass, reject, and research-only terminal decisions. A fail must
    preserve outputs and permit a new model or training experiment with a
    separate sealed holdout, never training on failed holdouts or modifying
    evaluator wording to favor a candidate.

Required report structure:

1. Executive qualification recommendation.
2. Honest claim taxonomy.
3. Source-first screen and compute stop rules.
4. Behavior taxonomy and semantic invariants.
5. Metamorphic and sealed-holdout generation.
6. Layered evaluator and authority rules.
7. Contamination threat model and controls.
8. Source/native/WASM comparison matrix.
9. Quantization noninferiority statistics.
10. Human review and independent audit.
11. Terminal decisions and failure-driven next steps.
12. Objective first-model acceptance checklist.
13. Unknowns requiring private output inspection.
14. Annotated primary-source bibliography with dates and direct links.

Do not use an opaque LLM judge as sole authority, accept keyword matches as
semantic proof, train on evaluation failures, choose easy seeds after seeing
outputs, repair malformed answers, lower thresholds to get a first model, or
claim a structural pass proves conversational usefulness.

## Prompt 12: Enterprise First-Model Release Evidence, Supply Chain, Deployment, And Living Documentation

You are an independent principal release engineer, software-supply-chain
architect, documentation governance lead, and production verification
specialist. Produce an exceptionally detailed report defining the complete
evidence graph and release gate for the first real TinyRustLM SLM2 model to move
from corrected source through public browser-local chat, while keeping source
control, public sites, release logs, and claims synchronized. Target 12,000 to
20,000 words excluding bibliography.

Research primary standards and official documentation for Git, reproducible
builds, SLSA, in-toto, SPDX/CycloneDX, Sigstore or equivalent signing,
Rust/Cargo, .NET/NuGet, WebAssembly, browser deployment, CSP and isolation
headers, service-worker releases, source maps/symbols, artifact signing,
malware scanning, HTTPS verification, accessibility, and documentation
versioning. You have no access to TinyRustLM repositories, CI, model bytes,
receipts, signing keys, hosting accounts, sites, logs, or credentials. Do not
claim that anything has shipped.

Project-supplied facts and constraints:

- TinyRustLM is one unversioned prelaunch product. There is no product V2,
  legacy-user population, compatibility duty, migration, alias, fallback
  runtime, response repair, hidden retry, best-of-N, or accepted debt.
  Technical terms such as SLM2 and Tokenizer2 are format identities.
- The current work aims to deliver one real, provenance-bound,
  production-quality Qwen3-0.6B SLM2 composition through scalar native,
  optimized native, browser-WASM, P2P-or-convert acquisition, and genuine
  multi-turn browser chat.
- A prior one-shot operation \`/10\` reached immutable
  \`terminal-failure\` at managed receipt inspection even though it emitted
  candidate files. It cannot be repaired, retried, adopted, published, or
  described as a pass. A source-level contract correction and tests are inputs
  to a wholly new registration, not retrospective success evidence.
- Large model, raw output, and private evidence bytes remain outside Git.
  Bounded public schemas, tests, documentation, identities, statuses, and
  release records belong in source control.
- Local memory files remain supported for device-local and offline continuity.
  MemoryEndpoints.com is the authorized, strongly recommended portable-memory
  backbone for TinyRustLM's cross-device and worldwide web experience. Authorization
  does not create evidence: campaign counters remain 0/20 qualified models,
  0/50 clean browser rounds, 0/25 live memory rounds, 0/40 externally proven
  P2P lanes, and 0/20 catalog announcements until exact live receipts exist.
- The project requires a commit and push after each coherent green major
  change, deployment whenever every gate for an affected site passes, public
  HTTPS readback, and robust current documentation and marketing claims.
- Each affected site should expose a consistent publication log with last
  publish identifier, release date, version/technical release identity, and
  user-visible changes. No site may imply unproven model or network capability.

Research and specify:

1. Define the end-to-end phase graph: source review, immutable acquisition,
   contract correction, output-free registration, toolchain/build custody,
   one-shot conversion, independent composition inspection, scalar numerical
   parity, optimized-native parity, browser-WASM parity, model qualification,
   acquisition UX, clean-browser chat, package/site release, deployment
   verification, and final documentation. State prerequisites and invalidation
   edges.
2. Define content-addressed receipts for every phase. Each identity should bind
   inputs, source commit/tree, tool versions, schema/profile identities,
   artifacts, environment, test vectors, raw-private evidence references,
   bounded result, and terminal status. Explain selective rerun when one input
   changes without redoing unrelated valid acquisition.
3. Specify immutable evidence and supersession. Failed and obsolete receipts
   remain retained, never overwritten. Production readers need only the sole
   current clean-slate contract; historical public records can remain
   interpretable through documentation or offline audit tooling, not
   compatibility code in the shipping path.
4. Design source-control discipline for multiple affected repositories/sites.
   Cover clean worktree audit, unrelated user changes, focused commits,
   branch/remote equality, protected branches, signed commits/tags if used,
   fresh fetch, direct remote-ref verification, release commit, rollback
   commit, and prohibition on uncommitted deployed source.
5. Define build and supply-chain gates for Rust native, WASM, C ABI if exposed,
   .NET wrappers/companion, NuGet packages/symbols, browser assets, service
   workers, model manifests, and public sites. Include lock files, pinned
   dependencies, offline restoration, SBOM, provenance, licenses, SourceLink,
   portable symbols, native asset hashes, archive traversal tests, secret
   scans, and malware-scanning boundaries.
6. Specify test matrices by component and platform: unit, contract,
   differential, property, fuzz, malformed artifact, package consumer,
   win-x64, linux-x64, linux-arm64, WASM, Chromium, responsive UI,
   accessibility, privacy/network, clean profile, cancellation, restart, P2P,
   and real model quality. Distinguish cross-compilation, binary inspection,
   emulation, and real-hardware execution.
7. Define site deployment and atomic release. Cover immutable hashed assets,
   HTML/service-worker coordination, cache headers, SRI where applicable,
   COOP/COEP/CORP/CSP, last-known-good rollback, stale-client behavior,
   maintenance pages, CDN invalidation, and proof that deployed bytes match the
   release commit.
8. Design a consistent publication/change log for every affected site. Specify
   machine-readable and human-readable forms, site identity, publish ID,
   source commit/tree, release date/time zone, technical version, changed
   components, migrations explicitly absent, test/evidence links, known
   limitations, rollback reference, and last verified HTTPS readback.
9. Define documentation governance. Architecture, user instructions, API and
   model-format references, operator runbooks, security/privacy claims,
   marketing pages, accessibility guidance, troubleshooting, and release notes
   must change in the same coherent release as behavior. Add drift checks that
   fail stale or contradictory documentation.
10. Establish honest claim rules. Provide allowed and prohibited language for
    the failed \`/10\` attempt, a future composition pass, scalar/native pass,
    browser pass, quality-qualified model, direct P2P availability, site
    deployment, and campaign completion. Unit tests or package creation alone
    must never produce \`done\`.
11. Design deployment verification and rollback. Require DNS/TLS/HTTPS
    readback, headers, asset hashes, service-worker state, critical user flow,
    no unexpected network requests, source/release-log equality, monitoring
    without prompt telemetry, rollback authorization, and post-rollback
    readback.
12. Provide a prioritized release runbook and objective final checklist for
    exactly one first model. Explicitly list remaining risks and external
    blockers. The 20-model/50-round campaign must remain incomplete even after
    the one-model vertical slice succeeds.

Required report structure:

1. Executive release-control recommendation.
2. End-to-end phase and invalidation graph.
3. Receipt schema family and immutable history.
4. Multi-repository source-control discipline.
5. Build, package, and supply-chain matrix.
6. Test gates by component, platform, and evidence class.
7. Atomic site deployment and service-worker release.
8. Consistent publication-log specification.
9. Documentation and marketing drift controls.
10. Honest claim taxonomy and progress dashboard.
11. HTTPS readback, rollback, and incident procedure.
12. First-model acceptance checklist and prioritized runbook.
13. Unknowns requiring local or authorized production access.
14. Annotated primary-source bibliography with dates and direct links.

Do not describe MemoryEndpoints as unauthorized. Do not recommend deploying
uncommitted source, publishing failed candidate
bytes, claiming release from package creation, treating cross-compilation as
executed ARM64 proof, calling local P2P health public reachability, simulating
MemoryEndpoints, incrementing campaign counters, preserving obsolete runtime
paths, or allowing documentation and marketing to lag behind behavior.

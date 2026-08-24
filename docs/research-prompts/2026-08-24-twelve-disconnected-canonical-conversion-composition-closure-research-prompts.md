# Twelve Disconnected Research Prompts: Canonical TinyRustLM Conversion And Composition Closure

Each section below is a complete standalone assignment for a different
technical research agent. Send one whole prompt to one agent. Do not assume an
agent has received this introduction, any other prompt, or any private
TinyRustLM material.

The assignments are deliberately narrower than earlier broad architecture
research. They seek implementation-grade answers for the remaining path from
a reviewed public model source to one useful, provenance-bound SLM2
composition that a browser can acquire, activate, and use for genuine local
multi-turn chat.

Every research agent may browse public websites, standards, papers, official
documentation, public package registries, public model repositories, and
immutable public source revisions. No agent has access to the TinyRustLM
source tree, branches, local model files, build products, test output,
receipts, credentials, deployment accounts, browser profiles, internal
services, private evaluation cases, or unpublished architecture documents.
Every report must distinguish directly observed public facts, sourced
external facts, assumptions, engineering recommendations, and facts requiring
local or authorized verification. No report may imply that the agent
inspected, built, ran, tested, or validated private TinyRustLM code.

## Prompt 1: One Managed Companion Adapter Over The Canonical Rust Converter

You are an independent principal .NET interoperability engineer, Rust CLI/API
designer, process-isolation specialist, and reliability architect. Produce an
exceptionally detailed implementation report for a clean-slate managed adapter
that exposes one canonical Rust model converter to a local TinyRustLM
companion. The report must solve process discovery, typed request construction,
bounded execution, progress, cancellation, failure recovery, and artifact
verification without reimplementing conversion logic in C#.

You may inspect current public .NET, Rust, Windows, Linux, process-management,
JSON, filesystem, NuGet, native-asset, and secure-coding documentation. You
have no access to TinyRustLM source code, binaries, package output, private
schemas, or runtime logs. Do not invent the current implementation.

Public product context and fixed decisions:

- TinyRustLM is one prelaunch product. There is no launched V1, no product V2,
  no customer compatibility population, and no reason to keep obsolete
  converter names, forwarding wrappers, aliases, old request schemas, old
  receipts, alternate executable discovery, or migration logic.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, ABI identities,
  schema identities, and semantic versions are exact technical contracts, not
  product generations.
- Rust is the sole authority for source inspection, tensor conversion,
  quantization, artifact validation, hashing, canonical serialization, and
  conversion receipts. C# may orchestrate a Rust process and expose a managed
  API, but it must not duplicate model-format semantics or repair Rust output.
- The browser-facing companion must prefer an exact verified P2P composition.
  When no eligible peer exists, the same user action must begin reviewed source
  acquisition and deterministic local conversion. Downloading an instruction
  file, JSON request, PowerShell script, shell script, or text file is a
  product failure.
- A successful conversion is not just a weight file. Activation requires a
  complete, content-addressed composition containing SLM2 model bytes,
  Tokenizer2, Template2, Sampling2, Prompt2, runtime contract, declared limits,
  provenance, license decision, and validation evidence.
- The adapter must fail closed. It may not translate an unknown Rust error into
  success, select a best retry, repair output, accept unverified bytes, or
  silently use an older converter.
- Large model inputs and outputs must stay outside source control and be
  processed without whole-file buffering.
- MemoryEndpoints is unauthorized and disconnected. It is outside this task.

Use primary sources wherever possible. Record source title, publisher,
publication or update date, immutable revision when available, direct URL, and
report retrieval date. Separate normative OS/.NET behavior from implementation
details that require testing.

Research and specify all of the following in depth:

1. Select the cleanest managed boundary: spawn a versioned Rust CLI, load a
   stable C ABI, or host a Rust child service. Compare lifetime, cancellation,
   stdout/stderr framing, crash isolation, packaging, security, testability,
   and cross-platform behavior. Choose exactly one initial production design.
2. Define executable discovery without PATH ambiguity, current-directory
   search, download-on-demand execution, or multiple fallback locations.
   Address self-contained companion archives, NuGet development consumers,
   signed installation manifests, `win-x64`, `linux-x64`, `linux-arm64`, file
   identity, version identity, and tamper detection.
3. Define a managed request type that contains only validated declarative
   fields. Cover immutable source revision, source file identities, output-root
   ownership, composition profile, quantization profile, resource limits,
   operation ID, idempotency key, and expected tool/schema identities. Explain
   why arbitrary CLI fragments and arbitrary output paths are forbidden.
4. Specify canonical JSON serialization and transport. Address UTF-8, duplicate
   keys, unknown fields, number bounds, path encoding, case sensitivity,
   canonical ordering for hashes, request-size limits, stdin versus temporary
   file transport, and secret-free command lines.
5. Design process launch with exact argument arrays, no shell, inherited-handle
   control, environment allowlisting, deterministic locale/timezone, working
   directory, stdout/stderr redirection, process-tree ownership, Windows job
   objects, Linux process groups, and child cleanup after parent failure.
6. Specify a bounded progress-event protocol. Bind every event to operation,
   request, tool, phase, and sequence identities. Cover expected and completed
   bytes, tensors, shards, warnings, heartbeats, replay, truncation, malformed
   events, slow readers, stderr diagnostics, and exactly one terminal event.
7. Define cancellation semantics across acquisition, hashing, conversion,
   validation, fsync, and atomic promotion. Explain cancellation request,
   acknowledgment, process-tree termination deadlines, non-interruptible
   regions, cleanup ownership, resumable staging, and terminal-state races.
8. Design timeout and resource enforcement. Cover wall time, idle time, stdout
   volume, stderr volume, memory, CPU, open files, disk preflight, disk growth,
   and output count. Distinguish enforceable portable limits from platform
   controls requiring native integration.
9. Specify safe parsing of the Rust terminal receipt. The managed layer must
   verify schema identity, request binding, converter identity, source hashes,
   output hashes, sizes, composition identity, terminal phase, and receipt
   checksum without deciding tensor correctness itself.
10. Design create-only output ownership and idempotent recovery after browser
    reload, managed-process crash, Rust-process crash, machine restart, full
    disk, lost terminal response, duplicate operation request, and cancellation
    during promotion. No prior terminal receipt may be overwritten.
11. Define a typed managed error taxonomy that preserves authoritative Rust
    error codes while exposing safe user-facing categories. Include executable
    unavailable, identity mismatch, unsupported architecture, malformed
    source, license unresolved, source drift, disk insufficient, conversion
    failure, validation failure, cancellation, stale event, and internal
    protocol violation.
12. Provide C# interfaces and records, Rust CLI request/event/receipt structs,
    JSON examples, process-launch pseudocode, event-reader pseudocode,
    cancellation pseudocode, and recovery pseudocode. The examples must be
    internally consistent and avoid placeholders for core behavior.
13. Design test seams that use a deliberately small protocol fixture without
    allowing the fixture to satisfy a real-model gate. Include fake-process
    protocol tests, real Rust fixture tests, malformed-stream tests, forced
    crashes, cancellation races, and isolated package-consumer tests.
14. Define public API surface rules for the managed adapter. Minimize exposed
    types, prevent subprocess implementation details from leaking, specify
    async/disposal behavior, nullability, cancellation-token semantics,
    exceptions versus result types, and API-baseline review.
15. Provide a deletion checklist for obsolete converter locators, old command
    names, old request/receipt types, old output suffixes, fallback paths,
    duplicate managed conversion logic, stale tests, and stale documentation.
16. State every conclusion requiring local source inspection, package-layout
    inspection, process execution, real large-model conversion, OS testing, or
    signature verification.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Boundary comparison and selected one-authority design.
3. Executable identity, discovery, and packaging contract.
4. Managed request and canonical transport schemas.
5. Process, environment, handle, and resource controls.
6. Progress, cancellation, and terminal receipt protocol.
7. Atomic output, idempotency, and crash-recovery algorithm.
8. Typed error and user-status vocabulary.
9. C# and Rust API sketches with complete pseudocode.
10. Unit, integration, package-consumer, and fault-injection matrix.
11. Obsolete-path deletion and source-audit checklist.
12. Phased implementation plan with objective acceptance gates.
13. Unknowns requiring local or authorized proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend a shell command assembled as a string, PATH-first discovery,
multiple executable fallbacks, a managed tensor parser, unbounded output
capture, arbitrary web-supplied paths, output repair, compatibility aliases,
or a mocked conversion as real-model evidence. Do not invent current classes,
commands, packages, test counts, or local behavior.

## Prompt 2: Canonical Rust Conversion CLI And Machine Protocol For One SLM2 Path

You are an independent principal Rust CLI architect, machine-protocol
designer, model-conversion engineer, and secure parser specialist. Produce an
exceptionally detailed target specification for one canonical TinyRustLM Rust
conversion executable and its noninteractive machine protocol. The result must
be suitable for a browser-owned local companion to invoke without shell
scripts, instruction downloads, response repair, or knowledge of tensor-format
internals.

You may inspect public Rust CLI libraries, serde, JSON and CBOR standards,
safetensors specifications, Hugging Face repository conventions, operating
system process behavior, content-addressed build systems, and reproducible
conversion tools. You have no access to private TinyRustLM source, current CLI
commands, model artifacts, logs, schemas, or tests. Do not claim otherwise.

Public product context and fixed decisions:

- TinyRustLM is prelaunch and will ship one current architecture. There is no
  launched legacy contract to preserve. Obsolete command names, old artifact
  suffixes, alias commands, deprecated flags, auto-detected old schemas, and
  compatibility output are prohibited.
- SLM2 is the sole model-weight format. ACG2 is the sole composition graph.
  Tokenizer2, Template2, Sampling2, and Prompt2 are separately identified,
  immutable composition members.
- Rust owns source validation, tensor mapping, quantization, format writing,
  hashing, validation, and receipts. A managed host only starts and observes
  the process.
- The first target family is a pinned dense Qwen3-class causal transformer in
  approximately the 0.6B range, but unsupported architecture variants must
  fail explicitly rather than be guessed into a generic mapping.
- Conversion must stream large files, be deterministic for the declared
  execution profile, preserve source provenance, and leave no apparently
  valid final artifact after interruption or disk failure.
- Success means a verified complete composition, not merely an SLM2 file.
- Prompts and model bytes stay local or direct P2P. MemoryEndpoints is outside
  scope and currently disconnected.

Use primary sources and immutable public revisions wherever possible. Record
dates and retrieval date. Clearly distinguish a proposed target contract from
facts that can only be confirmed in local implementation.

Research and specify all of the following:

1. Define the executable's exact command surface. Decide whether there is one
   `convert` operation with explicit subprofiles or a small finite set of
   commands for inspect, convert, validate, and describe-capabilities. Reject
   aliases and hidden mode inference. Specify exit-code ownership.
2. Design a machine-readable capability response binding executable hash,
   semantic version, protocol schema, supported source architecture/profile,
   SLM2 version, composition versions, quantization profiles, resource-limit
   support, and maximum request sizes.
3. Define one strict conversion request schema. Include request ID,
   idempotency key, source repository and immutable revision, expected file
   hashes/sizes, model configuration identity, tokenizer/template source
   identities, composition profile, output-root identity, quantization profile,
   deterministic execution profile, and resource budgets.
4. Specify source-manifest validation before expensive work. Cover path
   normalization, duplicate logical files, symlinks/reparse points, shard
   indexes, tensor-name duplication, config consistency, tokenizer files,
   chat-template pinning, size limits, licenses, unexpected files, and source
   drift.
5. Define deterministic tensor mapping for a Qwen3-class dense transformer.
   Require an explicit source-to-SLM2 tensor table, shape equations, dtype
   rules, transpose rules, grouped-query geometry, tied or untied embeddings,
   rotary parameters, normalization epsilon, vocabulary padding, output head,
   and unsupported-variant rejection.
6. Specify mixed-Q8 quantization inputs and outputs without assuming a
   particular unpublished layout. Address per-tensor policy, scale encoding,
   rounding mode, non-finite rejection, accumulation reference, excluded
   tensors, calibration needs, deterministic parallelism, and numerical
   receipts.
7. Design bounded machine progress output. Choose JSON Lines or another
   framed format and specify sequence, operation, phase, input bytes, verified
   bytes, tensor count, output bytes, warnings, heartbeat, and terminal record.
   Define behavior for a closed observer pipe and backpressure.
8. Separate stdout machine protocol from stderr diagnostics. Define UTF-8,
   maximum record length, duplicate fields, unknown fields, structured error
   details, diagnostic redaction, and why human prose must never be parsed as a
   success receipt.
9. Define staging and atomic promotion. Cover same-volume output ownership,
   create-new semantics, temporary names, streaming hashes, fsync of files and
   directories, Windows rename behavior, ext4 semantics, full disk, antivirus
   locks, cancellation, power loss, and existing terminal outputs.
10. Design a resumability policy that does not pretend arbitrary tensor
    conversion is safely resumable. State which phases can reuse validated
    content-addressed inputs, which staging data is restartable, which phases
    must restart, and how a journal binds tool and request identities.
11. Define independent validation after writing. Include SLM2 structural
    validation, tensor count/shape/dtype verification, full streamed hash,
    Tokenizer2/Template2/Sampling2/Prompt2 validation, ACG2 closure, declared
    runtime limits, and prevention of self-attestation as the only proof.
12. Specify terminal receipt fields and canonical encoding. Bind source bytes,
    converter bytes/version, request, platform, deterministic profile, each
    output member, ACG2 root, validation tool, timing, bounded warnings, and
    terminal outcome. Explain signature versus hash requirements.
13. Provide exact success, unsupported-architecture, malformed-source,
    cancellation, disk-full, validation-failure, and identity-mismatch protocol
    examples with exit codes. All examples must be internally consistent.
14. Provide Rust type sketches, parser boundaries, error enums, high-level
    module ownership, conversion pseudocode, atomic writer pseudocode, and
    verifier pseudocode. Identify where unsafe code is unnecessary or tightly
    contained.
15. Design property, fuzz, differential, malformed-input, deterministic-repeat,
    forced-interruption, and large-file tests. Include how to prove that a
    tiny fixture cannot satisfy a real-model acceptance gate.
16. Produce a clean-cut removal checklist for old CLI verbs, old schema
    parsers, output suffixes, old manifests, request generators, script kits,
    aliases, fallback conversion modes, and documentation.
17. Identify all claims requiring private source inspection, real source
    acquisition, actual conversion, platform execution, and independent
    native/browser numerical proof.

Required report structure:

1. Executive CLI and machine-protocol recommendation.
2. Command and capability surface.
3. Strict request schema and validation rules.
4. Qwen3-class tensor mapping and unsupported-variant matrix.
5. Deterministic quantization and numerical receipt contract.
6. Progress, diagnostics, errors, and exit codes.
7. Staging, atomic promotion, and recovery algorithm.
8. Complete-composition validation and receipt schema.
9. Rust module/type sketches and pseudocode.
10. Security, malformed-input, property, and fault test matrix.
11. Clean-cut deletion checklist.
12. Implementation sequence and objective gates.
13. Unknowns requiring local proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose a generic converter tutorial, auto-detection of historical
formats, shell-script orchestration as the product path, whole-file reads,
unbounded JSON, a success line inferred from prose, in-place final writes,
repair of malformed output, or compatibility command aliases. Do not invent
current TinyRustLM commands or evidence.

## Prompt 3: Complete ACG2 Composition Assembly And Content-Addressed Activation

You are an independent principal artifact-format architect, content-addressed
storage designer, reproducible-build engineer, and ML runtime integration
specialist. Produce an exceptionally detailed target design for assembling and
activating one complete TinyRustLM model composition. The design must prevent
an SLM2 weight file from being treated as runnable unless every semantic member
needed for exact conversation behavior is present, valid, identity-bound, and
compatible.

You may inspect public Merkle-DAG systems, OCI image/index specifications,
TUF, in-toto, SLSA, reproducible-build guidance, canonical JSON/CBOR standards,
model repository formats, tokenizer/template documentation, and secure package
activation designs. You cannot inspect TinyRustLM source, private ACG2 schemas,
model files, receipts, or tests. Do not claim local validation.

Public product context and fixed decisions:

- TinyRustLM is one prelaunch product with no legacy population. There is no
  requirement for ACG1 compatibility, dual readers, version translation,
  aliases, migration code, or fallback composition inference.
- SLM2 contains model tensors and required model metadata. Tokenizer2 defines
  exact text/token behavior. Template2 defines exact chat rendering. Sampling2
  defines generation policy and random semantics. Prompt2 defines immutable
  product prompt content and precedence. ACG2 binds these members and the
  runtime contract into one activation identity.
- Technical names ending in `2` are exact formats, not a product V2.
- A model obtained from direct P2P and the same model produced by local
  conversion are equivalent only if the complete composition identity and all
  member bytes agree.
- Activation must be transactional, create-only, crash-safe, bounded, and
  independently verifiable. Partial members, mutable aliases, stale indexes,
  or an unverified weight file must never become active.
- Public evidence may include hashes, sizes, versions, timestamps, counts, and
  bounded errors, but not private local paths, prompts, model bytes, tokens, or
  credentials.
- MemoryEndpoints is unauthorized and outside scope.

Use primary sources and identify the line between sourced external facts and
the proposed TinyRustLM target. Record source dates, immutable revisions, and
retrieval date.

Research and specify all of the following in depth:

1. Define the semantic ownership of SLM2, Tokenizer2, Template2, Sampling2,
   Prompt2, runtime contract, provenance statement, license decision,
   conversion receipt, quality receipt, and resource limits. State which data
   belongs in a member versus ACG2 edges or annotations.
2. Choose an ACG2 graph model. Compare a canonical manifest, Merkle DAG, OCI-
   like index, and flat bundle. Select one approach and define node identity,
   edge identity, root identity, media/type identity, and canonical encoding.
3. Define exact member references: algorithm, digest syntax, byte length,
   semantic schema identity, role, required/optional status, and expected
   compatibility constraints. Reject mutable URLs and display names as
   authority.
4. Specify cross-member invariants. Cover model vocabulary versus tokenizer,
   special-token IDs, BOS/EOS behavior, chat-template tokens, generation
   prompt, stop-token set, context length, rotary limits, sampling vocabulary,
   prompt precedence, runtime features, quantization kernels, and KV-cache
   geometry.
5. Define Prompt2 boundaries. Explain what immutable system/product prompt
   content is bound, how user text remains runtime input rather than artifact
   content, how prompt precedence is represented, and how prompt changes
   invalidate the composition without modifying model bytes.
6. Define Sampling2 boundaries. Separate policy parameters from per-request
   seed and conversation state. Specify how deterministic sampling algorithm,
   RNG identity, logits-processing order, stop behavior, and resource limits
   participate in the composition identity.
7. Design provenance and license references. Bind source repository/revision,
   source files, immutable license evidence, converter identity, conversion
   request/receipt, and review decision without embedding unsafe local data.
   State what remains external but content-addressed.
8. Design quality evidence attachment without making a mutable score part of
   the artifact identity. Address raw-output hashes, evaluator identity,
   promotion state, revocation, supersession, and how quality downgrade blocks
   activation or catalog promotion without rewriting history.
9. Specify an assembly transaction. Validate all members, stream hashes,
   validate cross-member invariants, write a create-only root, fsync, record an
   activation candidate, and atomically switch active composition. Define
   behavior when a member already exists or hash collision is alleged.
10. Specify activation-state storage for desktop and browser environments.
    Compare immutable content store plus small pointer, SQLite, filesystem
    journal, IndexedDB, and OPFS. Define crash behavior, concurrent tabs,
    process races, profile deletion, and stale pointers.
11. Define invalidation rules when any member, runtime, validator, source,
    quality receipt, license decision, or resource declaration changes. State
    which change requires only reevaluation and which creates a new composition
    identity.
12. Design safe garbage collection. Use graph reachability, leases, active
    readers, staged operations, quarantine, retention, and deletion receipts.
    Never delete shared immutable members still referenced by another root.
13. Provide complete schemas and examples for member descriptor, ACG2 root,
    assembly request, validation receipt, activation receipt, revocation
    notice, and safe public summary. Examples must use plausible but clearly
    synthetic hashes.
14. Provide Rust type sketches, browser TypeScript types, graph validation
    pseudocode, atomic activation pseudocode, recovery pseudocode, and garbage-
    collection pseudocode.
15. Design malformed-graph, cycle, duplicate-role, wrong-size, missing-member,
    cross-member mismatch, stale-runtime, race, interruption, corruption, and
    property tests. Include independent verifier requirements.
16. Define a one-model acceptance gate proving the same ACG2 root through
    source conversion, native activation, browser transfer, browser activation,
    and P2P reimport. Distinguish identity equality from behavioral quality.
17. Identify all unknowns requiring local format inspection, actual browser
    storage tests, real model conversion, native/WASM execution, and catalog
    integration.

Required report structure:

1. Executive composition recommendation and assumptions.
2. Member ownership and trust-boundary table.
3. ACG2 graph, identity, and canonical encoding.
4. Cross-member compatibility invariants.
5. Prompt2 and Sampling2 binding rules.
6. Provenance, license, quality, and revocation references.
7. Assembly, activation, and recovery transactions.
8. Desktop/browser storage and garbage collection.
9. Complete schema examples and implementation pseudocode.
10. Adversarial, property, crash, and cross-runtime test matrix.
11. One-model acceptance evidence graph.
12. Phased implementation plan with stop rules.
13. Unknowns requiring local proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend filename identity, mutable aliases, partial activation,
implicit defaults, missing-member downloads during inference, dual ACG readers,
format migration layers, a single boolean `passed`, or self-attestation as the
only validation. Do not invent private ACG2 fields or current test results.

## Prompt 4: Deterministic Sampling2 Semantics Across Rust Native And Browser WASM

You are an independent principal numerical-computing researcher, probabilistic
algorithm designer, Rust/WASM determinism engineer, and language-model decoding
specialist. Produce an exceptionally detailed, normative Sampling2
specification that can produce auditable generation decisions across scalar
Rust native and browser WASM execution. The report must identify where exact
token parity is achievable, where floating-point implementation differences
can change selection, and how to design a reference algorithm that fails
clearly rather than hiding divergence.

You may inspect public model-generation documentation, official Qwen generation
configuration, Hugging Face Transformers source at immutable revisions, Rust
RNG implementations, IEEE 754, WebAssembly numerical semantics, browser
engines, softmax/top-k/top-p algorithms, and reproducible numerical-computing
literature. You cannot inspect TinyRustLM source, private Sampling2 bytes,
model output, test vectors, or receipts. Do not imply private execution.

Public product context and fixed decisions:

- TinyRustLM is prelaunch and has one current sampling contract. There is no
  legacy sampler, compatibility profile, auto-translated generation config,
  alias parameter, best-of-N selection, response repair, or retry chosen for a
  preferred answer.
- Sampling2 is an immutable technical artifact within an ACG2 composition.
  Per-conversation seed and current token history are runtime inputs. Technical
  identity `Sampling2` does not mean a product V2.
- Rust is the sampling authority for both native and WASM builds. JavaScript
  must not duplicate token selection or silently postprocess model output.
- Required behaviors include greedy decoding and a declared stochastic profile
  using temperature, top-k, top-p, repetition penalty, stop tokens, and seeded
  randomness. Parameter order and edge-case semantics must be explicit.
- Raw outputs are preserved. A generated token stream may not be repaired,
  completed, or replaced after scoring.
- The target includes dense Qwen3-class instruction models, but Sampling2 must
  reject unsupported publisher settings rather than approximate them silently.
- MemoryEndpoints is unauthorized and outside this work.

Use primary sources wherever possible. Pin source revisions and record dates
and retrieval date. Label publisher behavior, standards behavior, proposed
Sampling2 behavior, and local-verification requirements separately.

Research and specify all of the following in depth:

1. Inventory all decoding inputs that materially affect token selection:
   logits dtype, vocabulary length, generated history, prompt history,
   temperature, top-k, top-p, min tokens to keep, repetition penalty, presence
   or frequency penalties if supported, banned tokens, EOS/stop IDs, maximum
   new tokens, seed, and algorithm version.
2. Define the exact logits-processing order. Analyze non-commutativity among
   repetition penalty, temperature, token masks, top-k, top-p, normalization,
   and stop handling. Provide counterexamples showing why order is part of the
   artifact identity.
3. Specify repetition-penalty behavior for positive and negative logits,
   prompt versus generated tokens, duplicate history entries, special tokens,
   zero, infinities, NaNs, and empty history. Compare publisher/framework
   semantics and select one explicit rule.
4. Define top-k with ties. Cover stable token-ID ordering, `k=0`, `k=1`,
   `k>=vocabulary`, duplicate logits, negative infinity, NaN rejection, and
   bounded-memory selection algorithms. State whether full sorting is a
   reference-only implementation.
5. Define top-p precisely. Cover sort order, cumulative summation precision,
   boundary inclusion, minimum retained token count, ties, `p=0`, `p=1`,
   underflow, overflow, all-masked logits, and deterministic token-ID tie
   breaking.
6. Define softmax or equivalent probability construction. Compare f32, f64,
   compensated summation, max subtraction, approximate exponentials, SIMD,
   and WASM operations. Select the normative reference and specify allowed
   optimized behavior, if any, without weakening parity claims.
7. Choose and specify a reproducible PRNG and seed expansion. Cover algorithm
   identity, state width, endian encoding, rejection sampling versus modulo
   bias, conversion to a uniform interval, seed zero, stream position, one
   draw per emitted token, and independence from thread scheduling.
8. Define categorical selection boundary behavior. State whether the uniform
   value lies in `[0,1)` and how exact cumulative-boundary equality, rounding,
   final-bucket fallback, zero probabilities, and malformed totals behave.
9. Define greedy decoding independently from stochastic sampling. Specify tie
   breaking, NaNs, masked tokens, EOS, maximum length, and whether temperature
   zero is accepted or rejected rather than treated as an alias.
10. Specify stop semantics: single token IDs, multiple EOS IDs, whether stop
    tokens are included in raw generation, decode visibility, maximum-new-token
    precedence, cancellation, and completion reason. Distinguish byte/text
    stop strings from token stop IDs and decide whether text stops are excluded.
11. Define Sampling2 canonical serialization, schema identity, algorithm
    identifiers, parameter ranges, defaults policy, unknown fields, member hash,
    and binding to model vocabulary and Template2 special-token declarations.
12. Develop a conformance vector format containing input logits, history,
    Sampling2 bytes/hash, seed/state, intermediate candidate sets,
    probabilities, random draw, selected token, completion reason, and exact
    expected error for malformed cases.
13. Design independent implementations: simple scalar Rust oracle, production
    Rust path, raw WASM invocation, and real-Chromium worker. Explain how to
    avoid all implementations sharing the same defect and how to compare
    intermediate states before token divergence.
14. Design corpus generation with adversarial floating-point cases, ties,
    vocabulary boundaries, masked logits, extreme temperature, tiny tails,
    repetition history, malformed values, multiple seeds, and long sequential
    state. Specify deterministic seed/case derivation and sealed cases.
15. Define acceptable evidence for exact parity, numerical parity without token
    parity, and performance-only optimization. State which claim is required
    before one browser model can be promoted.
16. Provide Rust reference pseudocode, optimized-path constraints, WASM
    boundary pseudocode, serialization examples, and failure codes.
17. Identify all unknowns requiring publisher-source inspection, actual Rust
    implementation, browser execution, real-model logits, and cross-platform
    tests.

Required report structure:

1. Executive Sampling2 recommendation and assumptions.
2. Publisher/framework behavior observation table.
3. Normative input, processing-order, and error specification.
4. Top-k, top-p, softmax, greedy, and repetition semantics.
5. PRNG, seed, categorical draw, and sequential-state specification.
6. Stop/completion semantics and composition bindings.
7. Sampling2 schema and canonical examples.
8. Independent oracle and conformance-vector design.
9. Adversarial corpus and cross-runtime gate.
10. Reference pseudocode and optimization constraints.
11. Implementation plan with objective stop rules.
12. Unknowns requiring local proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend implementation-defined sort ties, host-language RNG defaults,
JavaScript sampling, best-of-N, hidden retries, repaired output, text-level
postprocessing, unspecified floating-point tolerance, or compatibility aliases.
Do not invent current TinyRustLM sampling values or parity results.

## Prompt 5: Publisher-Exact Qwen3 Conversation Composition And Turn Construction

You are an independent principal tokenizer engineer, chat-template semantics
researcher, Qwen model-integration specialist, and prompt-security architect.
Produce an exceptionally detailed report specifying how a pinned Qwen3-class
instruction model should turn structured conversation messages into the exact
token sequence consumed by a native or browser-local runtime. The report must
connect Tokenizer2, Template2, Prompt2, Sampling2, special tokens, thinking-mode
settings, and multi-turn state without treating any framework default as
implicit authority.

You may inspect immutable public Qwen model repository revisions, official
model cards, tokenizer files, generation configs, chat-template sources,
Hugging Face Transformers source, Jinja template semantics, and tokenizer
standards. You have no access to TinyRustLM source, private artifacts, local
model files, prompts, outputs, or tests. Do not claim local inspection.

Public product context and fixed decisions:

- TinyRustLM is one prelaunch product. There is no launched historical chat
  contract, no old-template compatibility, no template guessing, no fallback
  role mapping, no tokenizer alias, and no response repair.
- SLM2 model bytes, Tokenizer2, Template2, Sampling2, and Prompt2 are immutable
  members of one ACG2 composition. The `2` suffixes are technical format
  identities, not product generations.
- A Tokenizer2 browser registration and a Template2 publisher-source/native
  parity gate may be independently complete, but that does not prove the
  composed prompt tokens, sampling input, or generated conversation behavior.
- Rust is the semantic authority in native and WASM. Browser JavaScript may
  pass structured messages and display raw output, but must not recreate the
  chat template or sampling policy.
- The target is a pinned dense Qwen3-class instruction model around 0.6B
  parameters. Exact repository revision, tokenizer revision, template text,
  special tokens, generation settings, and thinking-mode semantics must be
  pinned before promotion.
- The product requires ordinary multi-turn conversation, latest-user
  precedence, untrusted quoted/retrieved content treatment, practical
  constraints, summaries, rewriting, JSON, extraction, and code explanation.
- Prompt text and model bytes remain local. MemoryEndpoints is unauthorized
  and disconnected.

Use primary sources and immutable revisions wherever possible. Record title,
publisher, revision, publication/update date, direct URL, and retrieval date.
Clearly label observed repository facts, framework behavior, recommendations,
assumptions, and local-verification requirements.

Research and specify all of the following in depth:

1. Define the immutable source set needed to reproduce Qwen3 conversation
   construction: `config.json`, tokenizer files, special-token maps, tokenizer
   config, chat template, generation config, model card instructions, and
   relevant framework implementation revision. Explain which file is
   authoritative when sources conflict.
2. Describe exact supported roles and message fields. Cover system, user,
   assistant, tool or function roles if present, assistant reasoning fields,
   content types, empty content, Unicode, embedded delimiters, quoted
   instructions, and unsupported structures. Recommend a minimal first
   production subset and fail-closed behavior for the rest.
3. Separate Prompt2 from Template2. Specify what product-level system content,
   authority rules, and privacy constraints belong in Prompt2; what structural
   role rendering belongs in Template2; and what runtime user/assistant text
   must remain outside both artifacts.
4. Analyze Qwen3 thinking and non-thinking modes from authoritative sources.
   Cover enable/disable controls, template branches, reasoning delimiters,
   expected output structure, sampling recommendations, display policy, and
   whether an unsupported mode must be rejected instead of approximated.
5. Define generation-prompt semantics. State when the assistant prefix is
   appended, what `add_generation_prompt` means, how an unfinished assistant
   turn is represented, and how accidental duplicated assistant markers are
   prevented.
6. Define BOS, EOS, padding, end-of-turn, end-of-message, and any model-specific
   control tokens. Bind symbolic token, numeric ID, tokenizer vocabulary entry,
   Template2 use, Sampling2 stop set, and runtime decode behavior.
7. Specify escaping and literal-content rules. Address text that contains
   template delimiters, role markers, Jinja syntax, Unicode controls, nulls,
   invalid UTF-8 at external boundaries, very long content, and malicious text
   asking the renderer to alter authority.
8. Define multi-turn rendering and context reconstruction. Cover complete
   prior assistant output, stopped or cancelled generations, failed turns,
   edited user messages, latest-turn precedence, stale memory snippets as
   untrusted data, and whether partial generations ever enter the next prompt.
9. Specify context-budget calculation before inference. Include system prompt,
   template overhead, user and assistant history, generation reserve,
   tokenizer special tokens, maximum model context, KV-cache budget, and
   deterministic truncation or summarization policy. Reject silent left/right
   truncation defaults.
10. Design deterministic history reduction when the context is too large.
    Compare refusing the turn, dropping oldest complete turns, retaining system
    and latest user content, using a separately qualified summarizer, and
    requiring explicit user action. State the safest initial product behavior.
11. Define the exact composition pipeline:
    structured messages -> Prompt2 authority assembly -> Template2 bytes ->
    Tokenizer2 IDs -> model input -> Sampling2 -> raw generated IDs ->
    Tokenizer2 decode -> one rendered assistant message. Specify ownership and
    error boundary at every arrow.
12. Design source-framework oracle vectors. Include structured input, mode,
    rendered UTF-8 bytes, token IDs, special-token positions, generation
    prefix, stop-token declarations, and hashes. Cover single-turn, multi-turn,
    empty/Unicode/adversarial content, tool-role rejection, and context limits.
13. Design metamorphic tests for role order, authority order, quoted malicious
    text, whitespace, newlines, Unicode normalization, entity substitution,
    current preference changes, and thinking-mode toggles. State which token
    relationships must remain invariant and which must change.
14. Provide proposed Prompt2 and composition-binding schemas, Rust message
    types, renderer/tokenizer API pseudocode, browser request types, and raw
    output handling pseudocode.
15. Define promotion evidence proving publisher framework, scalar native Rust,
    raw WASM, and real Chromium produce the expected composed input tokens and
    stop behavior for an immutable corpus.
16. Identify every fact requiring local model revision selection, source hash
    verification, Prompt2 policy approval, native/WASM execution, or actual
    behavioral evaluation.

Required report structure:

1. Executive conversation-composition recommendation.
2. Immutable Qwen3 source and authority table.
3. Supported role/message contract and rejection rules.
4. Prompt2 versus Template2 ownership.
5. Thinking mode, generation prefix, and control-token semantics.
6. Multi-turn history, context budgeting, and overflow behavior.
7. End-to-end composition pipeline and error boundaries.
8. Oracle-vector and metamorphic-test design.
9. Proposed schemas, Rust types, and pseudocode.
10. Native/WASM/Chromium promotion gate.
11. Implementation sequence and stop rules.
12. Unknowns requiring local proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend a hard-coded approximation of an unpinned publisher template,
framework defaults that are not identity-bound, JavaScript template rendering,
silent role conversion, silent context truncation, response repair, hidden
reasoning extraction, compatibility modes, or training on evaluation prompts.
Do not invent a current TinyRustLM prompt or selected model revision.

## Prompt 6: Native And Real-Chromium Composition Conformance Registration

You are an independent principal conformance-laboratory architect, browser
automation engineer, Rust/WASM test specialist, and evidence-systems designer.
Produce an exceptionally detailed preregistered test design for proving that a
complete TinyRustLM conversation composition behaves consistently from scalar
native Rust through raw WASM and two independent real-Chromium browser
profiles. The gate must exercise Tokenizer2, Template2, Prompt2, and Sampling2
together, rather than merely rechecking isolated artifact parity.

You may inspect official Playwright, Chromium, WebAssembly, Web Worker,
filesystem, cryptographic hashing, reproducible-testing, and conformance-suite
documentation. You may inspect public Qwen framework sources and numerical
testing literature. You cannot inspect TinyRustLM code, WASM modules, private
test vectors, browser profiles, output receipts, or deployment accounts. Do
not claim that any private gate has run.

Public product context and fixed decisions:

- TinyRustLM is prelaunch. There is one current conformance path and no legacy
  browser runner, compatibility fixture, alternate worker protocol, hidden
  retry, repaired output, or best-of-N.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, and Prompt2 are exact technical
  artifacts in one composition. The suffixes do not denote product versions.
- Isolated Tokenizer2 and Template2 parity, if already established, remain
  immutable accepted evidence and must not be rerun merely to create new
  timestamps. This new gate proves composition behavior and Sampling2.
- Rust is the semantic authority in scalar native and WASM. JavaScript only
  transports bounded inputs/outputs and manages worker lifecycle.
- Required browser evidence uses real Chromium processes and independent fresh
  persistent profiles. A Node WASM test, browser mock, page reload, or reused
  context is not equivalent.
- The run must use zero network, preserve raw outputs, close browser processes,
  terminate workers, prove fresh-worker recovery, delete owned profiles, and
  retain create-only evidence outside source control with a bounded public
  summary.
- MemoryEndpoints is unauthorized and outside this gate.

Use primary sources, record dates and retrieval date, and distinguish proposed
procedure from facts requiring local execution.

Research and specify all of the following in depth:

1. Define the exact claim: composed-input parity, Sampling2 intermediate-state
   parity, selected-token parity, stop-reason parity, cancellation behavior,
   fresh-worker recovery, resource bounds, and evidence integrity. State what
   the gate does not prove, including conversational quality and public P2P.
2. Design an immutable preregistration document binding composition member
   hashes, runtime binaries, WASM bytes, browser build, runner, verifier, case
   generator, corpus root, seed schedule, limits, output root, and allowed
   terminal outcomes before execution.
3. Define a deterministic case corpus that composes Prompt2, Template2,
   Tokenizer2, and Sampling2. Include role variants, Unicode, empty content,
   malicious quoted instructions, multi-turn state, thinking-mode choice,
   token ties, top-k/top-p boundaries, repetition history, stop tokens, maximum
   length, and malformed inputs.
4. Specify sealed-case derivation and anti-seed-shopping controls. Bind
   generator revision, committed seed source, case count, family proportions,
   exclusion set, normalization, materialized case hash, and review timing.
5. Design independent oracle roles. Compare publisher framework rendering,
   scalar native Rust, an intentionally simple scalar Sampling2 oracle, raw
   WASM, and Chromium worker execution. Explain how shared code can mask a
   defect and where independently computed expected values are essential.
6. Define the native runner contract. Cover bounded input records, deterministic
   environment, one output per case, intermediate hashes, exact errors,
   cancellation cases, process identity, output flushing, and no retries.
7. Define the browser runner lifecycle for profile A and profile B. Include
   owned temporary root marker, real persistent context, local static origin,
   network interception/failure, WASM loading, worker construction, case
   transfer, completion, process closure, profile deletion, and deletion proof.
8. Specify true worker termination and fresh-worker recovery. Kill the semantic
   worker during a designated operation, reject all late messages, create a
   new worker with a new epoch/session identity, reload immutable composition
   members, and prove a later case succeeds without page reload masquerading
   as recovery.
9. Define cancellation cases at template rendering, tokenization, sampling
   preparation, and sequential sampling. Require one terminal cancellation,
   no activation or output completion after cancellation, bounded cleanup, and
   successful subsequent fresh operation.
10. Define browser/worker message schemas with operation ID, worker epoch,
    monotonic event sequence, case identity, member hashes, resource limits,
    result hash, exact error, and terminal state. Address duplicate, missing,
    reordered, oversized, and stale messages.
11. Define resource budgets and measurement. Cover input bytes, token count,
    logits length, WASM linear memory, JS heap observations, worker count,
    output bytes, wall time, idle time, browser processes, profile disk, and
    verifier memory. Avoid invented universal thresholds; give formulas and
    calibration rules.
12. Specify zero-network proof. Address service workers, cached resources,
    DNS, loopback static assets, devtools/proxy observation, browser background
    traffic, allowlist versus absolute block, and evidence that no prompt or
    model bytes leave the machine.
13. Design create-only evidence. Include raw per-case native and browser
    records, process log, profile lifecycle receipt, network receipt, worker
    recovery receipt, case manifest, checksums, verifier decision, and bounded
    public summary. No rejected or obsolete result may be overwritten.
14. Define verifier independence and disagreement handling. The verifier must
    stream bounded files, validate all identity edges, detect missing/duplicate
    cases, compare exact fields, distinguish infrastructure failure from
    semantic mismatch, and never repair or rerun.
15. Provide state diagrams, JSON schemas, runner pseudocode, worker pseudocode,
    verifier pseudocode, profile-deletion pseudocode for Windows/Linux, and a
    full fault-injection matrix.
16. Define stop rules. Any semantic mismatch, network event, stale-message
    acceptance, profile leak, worker recovery failure, identity mismatch,
    evidence overwrite, or unbounded condition is terminal for that
    registration and preserved for regression work.
17. Identify every unknown requiring local binaries, real browser execution,
    OS process inspection, actual artifact hashes, or policy approval.

Required report structure:

1. Executive conformance claim and non-claims.
2. Preregistration identity graph and immutable inputs.
3. Corpus families, sealed derivation, and independent oracles.
4. Native, raw-WASM, and Chromium runner contracts.
5. Two-profile lifecycle, zero-network, and deletion protocol.
6. Cancellation, worker termination, and fresh recovery.
7. Resource limits and browser/worker message schemas.
8. Evidence directory and versioned receipt schemas.
9. Independent verifier and disagreement algorithm.
10. Fault-injection matrix and terminal stop rules.
11. Complete pseudocode and implementation sequence.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend rerunning accepted isolated registrations, a browser mock,
Node-only WASM, one reused profile, page reload as worker recovery, network
best-effort, retries after semantic mismatch, output repair, keyword scoring,
or an opaque judge. Do not invent private case counts or completed evidence.

## Prompt 7: Immutable Public Source Acquisition And Sharded Safetensors Custody

You are an independent principal ML supply-chain engineer, Hugging Face
repository specialist, large-file transfer architect, and provenance auditor.
Produce an exceptionally detailed implementation report for acquiring one
pinned public Qwen3-class source model for deterministic local TinyRustLM
conversion. The design must work for sharded safetensors, large files,
interruption, source drift, licensing uncertainty, and offline resume while
preventing an attractive repository name or mutable branch from becoming
authority.

You may inspect official Hugging Face Hub and API documentation, Git and Git
LFS behavior, safetensors specifications, HTTP range and cache semantics,
publisher model repositories and model cards, license texts, cryptographic
hashing guidance, and secure download literature. You have no access to
private TinyRustLM code, credentials, local source caches, candidate files,
receipts, or evaluation output. Do not imply private access.

Public product context and fixed decisions:

- TinyRustLM is prelaunch and will support one clean source-acquisition
  contract. Old download scripts, request-file downloads, mutable-branch
  aliases, compatibility manifests, fallback mirrors, and manually repaired
  source directories are prohibited.
- The browser asks a user-owned local companion to acquire or convert a model.
  Project websites must not proxy model bytes. Exact verified P2P composition
  acquisition is attempted first; this source path runs when no eligible peer
  composition is available and the user approves source acquisition.
- Source repository, immutable commit, every required file, size, digest,
  model architecture, tokenizer/template source, and license decision must be
  bound before conversion.
- Large source/model artifacts stay outside Git. Hashing and transfer must be
  streaming and bounded.
- Conversion targets the sole SLM2/ACG2 composition. Structural conversion
  does not prove behavioral quality.
- MemoryEndpoints is unauthorized and disconnected.

Use primary sources and immutable public revisions wherever possible. Record
all source dates, direct links, revision IDs, and retrieval date. Label direct
observations, recommendations, assumptions, and local-verification needs.

Research and specify all of the following in depth:

1. Compare Hugging Face REST APIs, Hub client libraries, Git clone/LFS, direct
   resolved URLs, and publisher mirrors for immutable acquisition. Select one
   minimal first production method and explain required trust assumptions.
2. Define source revision pinning. Cover repository ID normalization, commit
   SHA, redirects, renamed/deleted repositories, gated models, authentication,
   LFS object identity, CDN URLs, ETags, cache validators, and why a branch or
   tag alone is insufficient.
3. Define a strict source manifest for a dense Qwen3-class model. Include
   expected config, shard index, every safetensors shard, tokenizer assets,
   chat template, generation config, model card snapshot, license files,
   expected sizes/digests, and allowed optional documentation.
4. Specify discovery versus admission. Public metadata search may locate
   candidates, but immutable manifest construction, license review, architecture
   inspection, and untouched output screening occur before expensive
   conversion. Popularity and download count are not admission evidence.
5. Define sharded safetensors handling. Validate the index, unique tensor-to-
   shard mapping, referenced and unreferenced shards, duplicate tensor names,
   header limits, offsets, alignment, dtype/shape bounds, total tensor count,
   and config geometry before loading tensor data.
6. Design streaming acquisition with HTTP range or restart. Include temporary
   file ownership, expected length, sequential hashing, chunk/piece journal,
   ETag/Last-Modified binding, server range noncompliance, content encoding,
   redirects, timeout, retry budgets, and source changes during transfer.
7. Analyze whether independently downloaded byte ranges can be safely mixed.
   Define complete identity agreement, overlap checks, per-piece hashing if a
   piece manifest exists, final whole-file hash, and conditions requiring full
   restart.
8. Design disk and resource preflight. Give formulas for source shards,
   staging, final SLM2/ACG2, receipts, filesystem overhead, temporary duplicate
   allowance, and safety margin. Address sparse files, quotas, FAT/NTFS/ext4
   constraints, and whole-file buffering prohibition.
9. Specify safe filesystem layout and path handling. Cover owned root marker,
   repository/revision encoding, create-new files, symlink/reparse defense,
   traversal, reserved Windows names, case collisions, maximum path length,
   permissions, and read-only promotion.
10. Define source custody receipts. Bind manifest, immutable revision, URLs
    stripped of credentials, response metadata, transfer tool, each file hash
    and size, timestamps, interrupted attempts, terminal result, and license
    review reference. Preserve obsolete attempts rather than overwrite them.
11. Define licensing review. Distinguish repository license metadata, actual
    license files, model-card restrictions, base-model obligations, tokenizer
    licenses, generated derivative obligations, notices, and facts requiring
    legal review. License ambiguity must block promotion but need not destroy
    safely quarantined evidence.
12. Define malware/untrusted-data boundaries. Treat model files, JSON, template
    text, filenames, cards, and archives as hostile data. Cover parser limits,
    decompression bombs, HTML/script display, terminal escapes, prompt
    injection in documentation, and no code execution from the repository.
13. Design interrupted and concurrent operation recovery. Handle companion
    crash, machine restart, disk full, stale lease, duplicate browser request,
    another operation targeting the same source, abandoned staging, and source
    revocation.
14. Provide source-manifest, transfer-journal, custody-receipt, license-decision,
    quarantine, and public-summary JSON examples plus Rust/C# data types and
    streaming pseudocode.
15. Design integration tests using a local hostile HTTP fixture and synthetic
    shards, then define separate authorized real-source evidence. Include
    truncation, wrong range, mutation, redirect loops, bad index, huge header,
    duplicate tensor, path attack, crash, and resume cases.
16. Identify every unknown requiring candidate revision selection, actual
    publisher bytes, local disk resources, legal review, network execution, or
    untouched behavioral screening.

Required report structure:

1. Executive source-acquisition recommendation.
2. Public repository/API observation and trust table.
3. Immutable source manifest and architecture preflight.
4. Sharded safetensors validation.
5. Streaming transfer, resume, and drift algorithm.
6. Filesystem ownership and resource model.
7. Provenance, custody, license, and quarantine receipts.
8. Untrusted-data threat model.
9. Schemas, data types, and complete pseudocode.
10. Fixture, fault, and real-source test matrix.
11. Implementation sequence with fail-closed gates.
12. Unknowns requiring local or legal proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend mutable revision authority, executing repository scripts,
credentials in URLs or logs, whole-file buffering, unbounded safetensors
headers, mixing ranges without complete identity agreement, a manually edited
source directory, fallback mirrors without pinning, or package popularity as
quality proof. Do not invent a selected source hash or license approval.

## Prompt 8: P2P-First Or Convert User Flow With One Durable Operation State Machine

You are an independent principal product-systems architect, browser UX
reliability engineer, local-first application designer, and distributed
operation-state specialist. Produce an exceptionally detailed implementation
report for the TinyRustLM model-selection workflow in which a user selects a
model and the product makes it work: verify an exact direct-P2P composition
when available, otherwise acquire a reviewed immutable public source and
convert it locally. The workflow must never download instructions or ask the
user to manually execute a script.

You may inspect public browser APIs, accessibility guidance, local-first
application patterns, resumable download/conversion interfaces, progress UX,
finite-state-machine design, and privacy/security standards. You cannot inspect
TinyRustLM code, current UI, APIs, screenshots, companion, model catalog,
receipts, or tests. Do not claim current behavior.

Public product context and fixed decisions:

- TinyRustLM.com is the browser-local chat interface. A user wants to choose a
  model and chat, not manage request files. Prompt text and model bytes must
  not be uploaded to a project-hosted backend.
- The user-owned local companion owns direct P2P acquisition and immutable
  source acquisition/conversion. Rust owns P2P byte validation, conversion,
  model-format validation, composition identity, and receipts.
- The exact requested ACG2 composition contains SLM2, Tokenizer2, Template2,
  Sampling2, Prompt2, runtime contract, provenance, license decision, and
  resource limits. A same-name or same-weight-only peer result is ineligible.
- TinyRustLM is prelaunch. There is one current operation contract and no old
  flow to preserve. Text, JSON, PowerShell, shell-script, or conversion-kit
  downloads; alternate UI lanes; compatibility aliases; and hidden fallback
  behavior must be deleted rather than retained.
- Direct P2P means bytes flow between consenting peers. Catalog/discovery may
  provide metadata but must not proxy model bytes. Loopback success is not
  proof of public reachability.
- The UI must expose truthful progress, source size uncertainty, disk and RAM
  requirements, privacy, provenance, sharing consent, cancellation, resume,
  failures, and final activation. No fixture can satisfy a real-model gate.
- MemoryEndpoints is unauthorized and disconnected and must not appear live.

Use primary sources wherever possible, record dates/retrieval date, and label
recommendations versus public facts and local unknowns.

Research and specify all of the following in depth:

1. Map the complete user journey from catalog selection to ready-to-chat.
   Include capability check, local-active check, P2P discovery, peer preflight,
   P2P transfer, source review, source acquisition, conversion, validation,
   browser transfer/storage, activation, and first generation.
2. Define one durable operation state machine with exact states, legal
   transitions, terminal outcomes, retry transitions, and external blockers.
   Include requested, authorizing, discovering, peer preflight, peer acquiring,
   source review, source acquiring, converting, validating, transferring,
   persisting, activating, ready, cancelling, cancelled, blocked, and failed.
3. Define decision authority between browser, companion, catalog, peers,
   converter, validator, and user. The browser must not infer success from a
   filename or process exit alone; the companion must not override a user's
   source/license or sharing decision.
4. Design exact-composition P2P discovery. Bind requested ACG2 root, all member
   hashes/sizes, peer endpoint, protocol identity, proof freshness, and offer
   expiry. Define no-peer, incomplete-peer, stale-proof, conflicting metadata,
   and malicious-peer outcomes.
5. Define the transition from P2P failure to local conversion. Distinguish
   expected no eligible peer from network outage, catalog outage, privacy
   policy, unsupported source, license ambiguity, insufficient disk, and user
   cancellation. Avoid the misleading word `fallback` for a hidden old path;
   this is an explicit branch of the one current workflow.
6. Specify review and consent surfaces before source acquisition. Display
   publisher, immutable revision, license status, source-size confidence,
   expected storage formula, expected CPU/RAM class, estimated time formula,
   sharing choice, and privacy boundary without marketing promises or dense
   internal jargon.
7. Design ordered progress. Show phase, verified/expected bytes, files,
   tensors, conversion progress, validation, browser transfer, storage, elapsed
   time, resumability, and bounded status. Handle unknown totals and changing
   estimates without false percentages.
8. Define operation identity, idempotency, event sequence, browser tab/session,
   companion journal, worker epoch, and activation identity. Repeated clicks,
   reloads, duplicate tabs, lost events, and reconnects must observe one
   operation instead of creating duplicates.
9. Specify cancellation and resume UX at every phase. State what is retained,
   quarantined, deleted, or reused; when cancellation is pending; how terminal
   cancellation differs from failure; and how stale completion is prevented
   from activating after cancellation.
10. Design error disclosure. Provide typed user messages and expandable safe
    details for companion unavailable, no peer, source review needed, source
    drift, license blocked, insufficient space, transfer corruption,
    conversion unsupported, validation mismatch, browser storage failure,
    cancellation, and internal protocol violation.
11. Define browser storage and activation handoff at a behavioral level.
    Prevent partial composition activation, duplicate transfer, model-name
    collision, stale active pointers, and tiny fixtures satisfying real rounds.
12. Define one-answer rendering and chat readiness. The intro selection area
    must yield to the conversation workspace only after exact activation; one
    generation creates one assistant message; progress events never masquerade
    as assistant text.
13. Cover responsive and accessible interaction at desktop, narrow desktop,
    and mobile widths. Include focus management, screen-reader live regions,
    reduced motion, keyboard cancellation, long model names, long errors,
    status contrast, and non-overlapping fixed composer behavior.
14. Define privacy/network assertions. Allow only declared site assets,
    catalog metadata, direct peers, and loopback companion traffic. Fail on
    prompt upload, project-hosted model-byte fetch, telemetry, credentials in
    URLs, or unexpected third parties.
15. Provide wire-neutral request/event/result schemas, UI view-model types,
    reducer/state-machine pseudocode, tab-reconciliation pseudocode,
    cancellation pseudocode, and accessibility announcement examples.
16. Design unit, state-transition, adversarial-event, browser, profile-restart,
    network, corruption, cancellation, and real-model acceptance tests. State
    what a mock may prove and what requires the actual companion and model.
17. Identify all unknowns requiring local UI inspection, companion execution,
    real P2P infrastructure, actual source conversion, browser storage, or user
    testing.

Required report structure:

1. Executive workflow recommendation and principles.
2. User journey and authority map.
3. Complete state machine and transition table.
4. Exact-composition P2P and no-peer conversion branch.
5. Consent, progress, cancellation, resume, and typed errors.
6. Multi-tab idempotency and event reconciliation.
7. Browser activation and exactly-once chat readiness.
8. Responsive, accessible interaction specification.
9. Privacy and network contract.
10. Schemas, view models, and complete pseudocode.
11. Test and fault-injection matrix.
12. Implementation backlog with objective acceptance gates.
13. Unknowns requiring local or authorized proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend downloading instructions, scripts, request JSON, or text;
project-hosted model bytes; a spinner with no truthful state; retries that pick
the best result; partial activation; browser-only conversion of unreviewed
sources; a second legacy UI; or mocks as real-model proof. Do not invent current
routes, peers, progress, or screenshots.

## Prompt 9: Secure Companion-To-Browser Composition Transfer And Atomic Model Store

You are an independent principal browser-storage engineer, local-service
security architect, crash-consistency specialist, and large-object transfer
designer. Produce an exceptionally detailed implementation report for moving a
verified complete TinyRustLM ACG2 composition from a user-owned loopback
companion into browser-owned storage and activating it atomically. The report
must address multi-gigabyte streaming, content verification, profile restarts,
quota pressure, cancellation, malicious local processes, and stale browser
workers without granting the web page arbitrary filesystem access.

You may inspect current official Fetch, Streams, Service Worker, IndexedDB,
Origin Private File System, StorageManager, Web Locks, BroadcastChannel,
WebAssembly, Web Worker, Private Network Access, CORS, CSP, Chromium, Firefox,
WebKit, Windows, and Linux documentation. You cannot inspect TinyRustLM code,
private routes, model bytes, browser profiles, traces, receipts, or tests. Do
not claim local validation.

Public product context and fixed decisions:

- TinyRustLM.com is a browser-local chat UI. Model bytes and prompts must not
  be sent to a project-hosted backend. The user-owned companion may serve
  verified bytes over loopback for transfer into the browser.
- The activation unit is one exact ACG2 composition containing SLM2,
  Tokenizer2, Template2, Sampling2, Prompt2, runtime contract, provenance,
  license decision, and limits. A partial composition or same-name model must
  never be considered ready.
- TinyRustLM is prelaunch. There is one current storage and transfer contract.
  No old database, migration, dual store, alias, hidden filesystem fallback,
  instruction download, or compatibility layer is required.
- Rust is the authority for artifact validation and composition identity.
  Browser code must independently stream-check hashes and structure needed for
  safe admission, but must not invent or repair model semantics.
- A real browser profile restart and deletion are different from a page reload
  or context reset. Durable activation and clean-profile tests must state which
  property they prove.
- MemoryEndpoints is unauthorized and disconnected.

Use primary sources and record update/publication dates and retrieval date.
Separate standards guarantees, browser-specific observations,
recommendations, and local-test requirements.

Research and specify all of the following in depth:

1. Compare IndexedDB blobs/chunks, OPFS files, File System Access handles,
   Cache Storage, and companion-owned files accessed on demand for the exact
   use case. Select one canonical browser store and one bounded metadata store
   for the first production path.
2. Define the browser-support policy. Distinguish required standards features,
   Chromium-specific capabilities, Firefox/WebKit gaps, cross-origin isolation,
   secure-context requirements, mobile limits, and truthful unsupported status.
   Do not propose a hidden second store as compatibility.
3. Design a secure loopback transfer endpoint. Bind origin, session,
   operation, ACG2 root, member hash, byte length, range/chunk, content type,
   expiry, and method. Address Host/Origin validation, CORS, Private Network
   Access, DNS rebinding, CSRF, redirects, credentials, and malicious local
   listeners.
4. Decide whether the browser pulls each immutable member or one framed bundle.
   Compare resumability, random access, hashing, parser exposure, duplicate
   storage, shared members, and activation. Define strict routes and fixed
   member identifiers rather than arbitrary local paths.
5. Specify streaming transfer without whole-file JS buffering. Cover BYOB
   readers, transferable streams where supported, chunk sizes, backpressure,
   WASM memory boundaries, incremental hashes, worker ownership, browser heap,
   and cancellation.
6. Define range/resume semantics. Bind each partial journal to companion build,
   transfer session, operation, member hash/size, chunk boundaries, received
   bitmap or prefix length, and browser store transaction. Reject ranges when
   identity or content encoding changes.
7. Design quota preflight and storage estimates. Include complete composition
   bytes, staging overhead, browser metadata, temporary hashing buffers,
   active old composition if any, quota uncertainty, eviction risk,
   persistence requests, and formulas rather than invented capacity claims.
8. Define browser-side staging. Use create-only temporary identities, bounded
   metadata, incomplete markers, streamed member hashes, member validation,
   ACG2 cross-member validation, and an atomic or recoverable activation
   pointer. Explain browser transaction limits for large writes.
9. Specify crash consistency across tab crash, worker crash, browser process
   crash, OS restart, companion restart, quota exhaustion, storage eviction,
   lost terminal message, and crash during activation. State what can resume
   and what must be quarantined or restarted.
10. Define multi-tab and multi-worker arbitration. One writer owns an operation;
    observers may read progress; stale worker epochs and late messages are
    rejected; inference readers receive stable immutable members; active-model
    changes cannot invalidate an in-flight generation unexpectedly.
11. Define cancellation. Stop network reads, signal the companion, stop hash
    and validation work, mark staging terminal, preserve reusable verified
    chunks only under a bound journal, prevent later activation, and emit one
    cancellation result.
12. Design browser startup recovery. Scan bounded operation metadata, validate
    active pointer and referenced members, quarantine incomplete/stale state,
    reconcile companion journal when authorized, and expose truthful ready,
    recoverable, blocked, or corrupt status.
13. Define model switching and deletion. Use content-addressed shared-member
    references, leases for active inference, reachability-based garbage
    collection, profile-local ownership, deletion receipts, and no deletion of
    members referenced by another composition.
14. Define privacy and secret scanning for browser storage, profile files,
    URLs, logs, traces, screenshots, service-worker state, crash data, and
    companion logs. Include UTF-8, UTF-16, base64, compressed-store limits,
    synthetic sentinels, and false-positive handling.
15. Provide route schemas, transfer manifest, chunk journal, storage metadata,
    activation record, recovery record, and deletion record examples plus
    browser TypeScript/Rust WASM pseudocode for stream, hash, persist, activate,
    cancel, recover, and delete.
16. Design hostile-loopback, malformed-range, corrupt-chunk, quota, eviction,
    crash, stale-worker, duplicate-event, multi-tab, profile-restart, profile-
    deletion, and real-large-model tests. Separate fixture evidence from the
    real-model gate.
17. Identify all unknowns requiring local route inspection, browser-version
    testing, actual storage quotas, large-file execution, process/profile
    inspection, or deployed header readback.

Required report structure:

1. Executive storage and transfer recommendation.
2. Browser capability and support matrix.
3. Loopback threat model and strict transfer contract.
4. Streaming, hashing, range, and resume algorithm.
5. Storage layout, staging, and atomic activation.
6. Quota, crash, cancellation, and startup recovery.
7. Multi-tab arbitration, model switching, and garbage collection.
8. Privacy and secret-scanning contract.
9. Complete schemas and implementation pseudocode.
10. Fault, browser, profile, and real-model test matrix.
11. Phased implementation plan with objective gates.
12. Unknowns requiring local proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend arbitrary local file paths, full-file `arrayBuffer()` for
large models, mutable filename authority, partial activation, two browser
stores for old/new behavior, localStorage for model bytes, wildcard CORS,
long-lived URL secrets, page reload as deletion proof, or a tiny fixture as
real-model evidence. Do not invent current browser support or local results.

## Prompt 10: Clean Public NuGet Graph And Private Companion Release Boundary

You are an independent principal .NET package architect, NuGet supply-chain
engineer, public API governance lead, and cross-platform native-delivery
specialist. Produce an exceptionally detailed clean-slate release design for
TinyRustLM's public managed packages and its separately distributed user-owned
companion. The goal is one canonical package identity graph, no duplicate
branded lane, no package-configurable identity factory, no obsolete seed-host
package, and no accidental claim that package creation equals publication.

You may inspect official NuGet, MSBuild, .NET SDK, native asset, SourceLink,
symbol package, package signing, repository metadata, lock file, RID, and
consumer-validation documentation. You have no access to TinyRustLM project
files, packages, feeds, workflows, credentials, test output, or deployment
accounts. Do not imply private inspection.

Public product context and fixed decisions:

- TinyRustLM is one prelaunch product. There is no public compatibility
  obligation, no old package population to migrate, no product V2, and no
  justification for aliases, forwarding packages, deprecation stubs, dual
  package IDs, package-prefix switches, or old dependency modes.
- Exact technical format names such as SLM2 and schema/ABI/package versions do
  not imply a second product generation.
- The intended public managed package graph has five literal identities:
  `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`,
  `TinyRustLM.MemoryEndpoints`, and `TinyRustLM.Conversion`.
- MemoryEndpoints integration code may exist as a disconnected package, but
  live service use is unauthorized. Package existence is not a claim of live
  connectivity.
- The local companion is an operational application/archive, not a public
  NuGet library or dotnet-tool identity unless a future preregistered decision
  proves otherwise. It must consume project/package APIs without creating a
  sixth alternate public API lane.
- Rust owns model formats, inference, conversion, validation, and P2P bytes.
  Managed packages provide narrow APIs and verified native assets rather than
  duplicate model semantics.
- Public package publication requires exact clean source, passing release
  gates, immutable package hashes, feed readback, isolated consumer proof, and
  source/commit equality. Dirty builds must never be published.

Use primary sources, recording dates, URLs, revisions, and retrieval date.
Distinguish recommended target architecture from local facts requiring
inspection.

Research and specify all of the following in depth:

1. Define the responsibility and allowed dependency edges of each of the five
   package identities. Prevent cycles, facade duplication, unnecessary shared
   implementation, and leakage of companion-only operations into public APIs.
2. Define literal package identity closure. Explain why package IDs should not
   be derived from a configurable prefix or property, how tests can enforce
   exact identities, and how obsolete alternate-brand strings should be
   detected without maintaining runtime aliases.
3. Specify the public/private boundary for the companion executable and its
   managed host project. Cover `IsPackable=false`, private assembly identity,
   project references, self-contained archive publishing, installer metadata,
   and why private code must not accidentally emit a `.nupkg`.
4. Define package metadata: title, description, tags, authorship, repository
   URL/type/commit, license, readme, icon if any, package project URL, release
   notes, version, symbols, deterministic build, ContinuousIntegrationBuild,
   SourceLink, and embedded/untracked-source policy.
5. Define public API baselines and intentional-change review. Cover reference
   assemblies, nullable annotations, async/cancellation contracts, platform
   annotations, exceptions/results, analyzer diagnostics, XML docs, API
   compatibility tools used as design review rather than legacy preservation,
   and clean breaking changes during prelaunch.
6. Specify native runtime asset packaging by RID. Cover exact library names,
   ABI identity, binary header/architecture checks, `runtimes/{rid}/native`,
   managed resolver safety, extraction, self-contained consumers, single-file
   publishing, and no PATH/current-directory fallback.
7. Define converter delivery for `TinyRustLM.Conversion`. Compare native
   executable asset, library ABI, separately installed companion dependency,
   and development-only project use. Choose boundaries that avoid executing
   writable package-cache content unsafely and avoid duplicate converter
   authorities.
8. Design one package transaction for restore, build, test, pack, extract,
   audit, isolated consumer, local-feed install, symbol verification, SBOM,
   provenance, and create-only evidence. Bind exact source commit and prevent
   reuse of an existing output root.
9. Define package-content allowlists. Cover assemblies, XML docs, readmes,
   licenses, native assets, analyzers if any, symbols, forbidden build scripts,
   unexpected executables, source leakage, secrets, stale branded identities,
   duplicate assemblies, path traversal, and unbounded files.
10. Specify isolated consumer tests for each package and valid combinations.
    Cover clean NuGet cache, only declared feed, locked restore, no project
    references, runtime load, simple API use, cancellation, malformed native
    assets, and offline restore after feed materialization.
11. Define publication authorization and feed readback. Include package ID and
    version uniqueness, hash before/after push, registration/index readback,
    flat-container download, `.snupkg` readback, repository commit, signatures,
    malware-scanning boundary, rollback limits, and immutable publication.
12. Define workflow permissions and secret safety. Use least privilege,
    protected environments, OIDC or scoped API keys where supported, no pull-
    request secret exposure, artifact retention, attestations, and explicit
    human publication authorization.
13. Define a release/version policy for a prelaunch product. Separate package
    semver from product-generation language. Require visible release date,
    release log, publication status, source commit, and no implication that an
    unpublished local package is available.
14. Design cross-platform shell parity for PowerShell and Bash release scripts.
    Cover strict mode, quoting, literal paths, create-only roots, atomic files,
    streaming hashes, deterministic ordering, error propagation, and parser/
    behavior tests.
15. Provide package graph, example central MSBuild properties, example package
    metadata, content allowlist, release receipt schema, consumer matrix, and
    workflow pseudocode. Examples must keep package IDs literal.
16. Produce a deletion checklist for alternate package workflows, old package
    IDs, prefix properties, seed-host package scripts, forwarding packages,
    duplicate docs, stale feed monitors, old release claims, and test branches
    that accept either identity.
17. Identify every unknown requiring local project inspection, package build,
    native binary inspection, consumer execution, credential authorization,
    feed publication, or public readback.

Required report structure:

1. Executive package/release recommendation.
2. Five-package responsibility and dependency graph.
3. Literal identity and companion-private boundary.
4. Metadata, API baseline, and native RID design.
5. Converter-delivery decision.
6. Package transaction and content allowlist.
7. Consumer, symbols, SBOM, provenance, and supply-chain gates.
8. Publication authorization and feed readback.
9. Prelaunch version/release-log policy.
10. Cross-shell implementation guidance and schemas.
11. Obsolete-lane deletion checklist.
12. Phased implementation plan with objective acceptance gates.
13. Unknowns requiring local or authorized proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend forwarding packages, aliases, configurable package prefixes,
dual branded lanes, a public seed-host package, PATH-based native loading,
package creation as publication proof, dirty-source publishing, mocks as
consumer proof, or preserving obsolete APIs merely because they once existed
in prelaunch code. Do not invent current package versions or feed status.

## Prompt 11: One Real Qwen3 Model Promotion And Mixed-Q8 Quality Preservation

You are an independent principal small-model evaluation scientist,
quantization researcher, conversational-quality lead, and no-cheat evidence
architect. Produce an exceptionally detailed promotion protocol for one real,
public, pinned Qwen3-class instruction model around 0.6B parameters from
untouched source through deterministic mixed-Q8 SLM2 conversion, scalar native
inference, and real-browser WASM chat. The protocol must reject a model that is
structurally valid but practically unhelpful, and must measure quality loss
caused by conversion or quantization without training on evaluation answers.

You may inspect public model cards and immutable repositories, official Qwen
documentation, quantization papers, statistical evaluation literature,
language-model evaluation frameworks, and browser performance guidance. You
have no access to TinyRustLM models, evaluation cases, outputs, converter,
runtime, receipts, hardware, or private policy. Do not claim local tests.

Public product context and fixed decisions:

- TinyRustLM is prelaunch and seeks one honest model vertical slice before any
  portfolio claim. Structural validation, popularity, parameter count,
  benchmark familiarity, or one attractive answer is not model quality.
- A promotable artifact is one exact ACG2 composition containing SLM2,
  Tokenizer2, Template2, Sampling2, Prompt2, runtime contract, provenance,
  license decision, and limits. The technical suffixes are not product
  generations.
- The source, converted scalar-native output, optimized native output, raw WASM
  output, and real-Chromium output must be compared under identity-bound prompt,
  template, tokenizer, sampling, seed, and completion limits.
- Raw outputs are immutable. No answer repair, manual completion, retry chosen
  for quality, best-of-N, expected-term injection, hidden refusal rewrite, or
  case wording changes after results.
- Important behavior includes conversational coherence, ambiguity handling,
  practical constraints and fallback advice, source conflict, latest-user
  preference precedence, untrusted quoted/retrieved data, multi-turn
  continuity, lawful adult help, summaries, rewrites, JSON, extraction, and
  code explanation. Arithmetic is secondary.
- Positive useful examples must substantially outnumber refusals in any later
  training curriculum. Evaluation holdouts and answer terms must remain sealed
  from training.
- Campaign counters remain zero until live evidence exists; one model proof
  does not equal 20 models or 50 dogfood rounds. MemoryEndpoints is unauthorized
  and outside this gate.

Use primary sources and pin all public revisions. Record dates, URLs, and
retrieval date. Separate observed model claims, external evidence,
recommendations, assumptions, and local verification.

Research and specify all of the following in depth:

1. Define candidate-source admission before conversion. Require immutable
   revision, source-file hashes, architecture fit, tokenizer/template fit,
   license closure, untouched raw-output screen, resource estimate, and no
   unexplained custom code requirement.
2. Design a small source screen that is cheap enough to precede conversion but
   broad enough to reject repeated practical failures. Specify case families,
   seeded paraphrases, multi-turn cases, sampling repeats where declared,
   blinded human review, raw transcript custody, and rejection thresholds.
3. Define a claim taxonomy for source-screened, structurally converted,
   numerically conformant, behaviorally preserved, browser proven, and useful
   local assistant. State required evidence and prohibited marketing language
   at each level.
4. Design a sealed evaluation corpus independent from training/development.
   Bind generator revision, committed seed, case families, materialized case
   hashes, exclusion/contamination set, adjudication rubric, and access timing.
5. Define semantic invariants for ambiguity, source conflict, current-turn
   precedence, unavailable resources, untrusted quoted instructions, lawful
   adult comparison, summary fidelity, rewrite constraints, valid JSON,
   extraction completeness, and code explanation. Avoid fixture-specific
   expected phrases.
6. Design metamorphic cases varying entities, units, dates, percentages,
   authority order, resource availability, discourse style, preference changes,
   distractors, and quoted malicious text. State which verdicts must remain
   stable and which factual change should alter the answer.
7. Define source-versus-SLM2 comparisons. Use exact prompt tokens and sampling
   where possible, repeated fixed seeds for stochastic profiles, raw output,
   completion reason, logits or token-rank diagnostics where available, and
   separation of template/tokenizer defects from weight quantization defects.
8. Define mixed-Q8 numerical tests. Cover tensor-wise reconstruction error,
   activation/logit error, top-token rank stability, KL or alternative
   distribution metrics, layer localization, long-context drift, special-token
   behavior, and scalar reference versus optimized kernels.
9. Define behavioral regression budgets. Ordinary helpfulness, refusal rate,
   constraint adherence, completion rate, repetition, malformed output, and
   multi-turn state must not be traded away for footprint alone. Provide a
   statistically defensible approach rather than invented universal numbers.
10. Design stochastic statistics. Cover fixed seed schedule, per-case pass
    probability, Wilson or exact intervals, correlated case families, multiple
    comparisons, infrastructure flakiness, terminal semantic failures, and why
    best-of-N is invalid unless it is declared product behavior.
11. Define layered adjudication: deterministic structure/invariant checks,
    independent model judges as non-authoritative evidence, and blinded human
    review as semantic authority for ambiguous cases. Judges may not rewrite
    candidate answers.
12. Define performance/resource measurements for source runtime, scalar native,
    optimized native, raw WASM, and real browser. Include model size, startup,
    first-token latency, tokens/second, peak memory, KV growth, cancellation,
    recovery, context length, and formulas/hardware disclosure.
13. Specify real-browser multi-turn acceptance. Use a fresh owned profile,
    exact composition, zero prompt/model upload, two to six genuine turns, one
    assistant rendering per turn, stable composer/scroll, cancellation case,
    browser closure, profile deletion, and bounded evidence.
14. Define failure attribution and stop rules. Distinguish source-model
    inadequacy, tokenizer/template mismatch, sampling mismatch, conversion
    defect, quantization regression, kernel defect, browser storage/runtime
    failure, evaluator defect, and infrastructure failure. Preserve the first
    failure and add a generic regression before fixing.
15. Define contamination controls for exact text, normalized text, character
    and token n-grams, semantic neighbors, template families, entity-substituted
    overlap, expected-answer overlap, public benchmarks, deletion lineage, and
    sealed holdouts.
16. Provide evaluation manifest, case record, raw-output record, judge/human
    review record, numerical comparison, browser receipt, final promotion
    decision, and public claim summary schemas plus statistical pseudocode.
17. State every unknown requiring actual source output, private holdouts,
    converter/runtime execution, hardware measurements, browser automation,
    or human review.

Required report structure:

1. Executive promotion recommendation and assumptions.
2. Source admission and claim taxonomy.
3. Sealed corpus, semantic invariants, and metamorphic tests.
4. Source/SLM2/native/WASM comparison protocol.
5. Mixed-Q8 numerical and behavioral regression analysis.
6. Stochastic statistics and layered adjudication.
7. Resource and real-browser multi-turn acceptance.
8. Failure attribution, stop rules, and regression workflow.
9. Contamination controls and evidence schemas.
10. Staged experiment plan with objective promotion gates.
11. Unknowns requiring local or human proof.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend training on evaluation cases, changing a case after seeing a
failure, expected-keyword scoring, opaque judge-only promotion, answer repair,
best-of-N, hiding rejected outputs, lowering thresholds to claim success,
calling a fixture a model, or treating structural validity as usefulness. Do
not invent a candidate hash or performance result.

## Prompt 12: End-To-End First-Model Evidence Graph, Release, And Living Documentation

You are an independent principal release-control architect, evidence-systems
engineer, documentation-governance lead, and production verification
specialist. Produce an exceptionally detailed end-to-end control plan for
shipping TinyRustLM's first real provenance-bound SLM2 composition through
source acquisition, conversion, native and browser proof, P2P-or-convert user
flow, package release, site deployment, and public documentation. Partial
success must remain useful evidence without being mislabeled as completion.

You may inspect public content-addressed build systems, SLSA, in-toto, TUF,
Sigstore, Git, GitHub Actions, NuGet, static-site deployment, release-note,
changelog, semantic-versioning, HTTP cache, TLS, accessibility, and operational
runbook documentation. You have no access to TinyRustLM source, CI, artifacts,
credentials, sites, receipts, package feeds, or deployments. Do not claim
private verification.

Public product context and fixed decisions:

- TinyRustLM is prelaunch and has one product architecture. There is no
  launched V1, no product V2, and no compatibility population. Obsolete source
  paths, aliases, migration layers, deprecation shims, parallel release lanes,
  stale docs, and known debt must be removed rather than carried forward.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema IDs, ABI IDs,
  package versions, and source branch names are technical identities, not
  product-generation claims.
- Completion requires one cryptographically identified model with acceptable
  source provenance and license, untouched behavioral screening,
  deterministic SLM2 conversion, complete ACG2 assembly, scalar native and
  real-browser WASM proof, working P2P-first-or-local-convert UX, genuine local
  multi-turn chat, bounded evidence, source-control publication, affected-site
  deployment, and public HTTPS readback.
- Model bytes and private evidence remain outside Git. Public source contains
  bounded schemas, tests, documentation, and safe evidence summaries.
- Campaign counters remain 0/20 models, 0/50 browser rounds, 0/25 live memory
  rounds, 0/40 externally proven lanes, and 0/20 catalog announcements until
  those exact live receipts exist. One first-model release must not alter
  unrelated counters.
- MemoryEndpoints is unauthorized and disconnected. No site or release note
  may imply live connectivity.
- Every coherent major change that builds should be committed and pushed.
  Every affected site should deploy when its complete gate passes. Each site
  must display a consistent last-publication version/date and maintain a
  human-readable update log.

Use primary sources, record dates and retrieval date, and distinguish target
recommendations from local facts requiring evidence.

Research and specify all of the following in depth:

1. Define a phase/state machine for source review, immutable acquisition,
   source screen, conversion preregistration, conversion, SLM2 validation,
   composition assembly, native conformance, Chromium composition conformance,
   model qualification, P2P preparation, no-peer conversion UX, browser
   storage, multi-turn dogfood, package transaction, commit/push, deployment,
   HTTPS readback, and final memory update.
2. Define allowed transitions, retry transitions, supersession, terminal
   rejection, external blockage, cancellation, and completion. A unit test or
   local package must never move deployment/publication phases to complete.
3. Build a content-addressed evidence graph. Bind source manifest and bytes,
   license decision, screening corpus/output, converter and request, SLM2,
   Tokenizer2, Template2, Sampling2, Prompt2, ACG2, native runtime, WASM,
   browser build/profile evidence, P2P/companion operation, packages, source
   commit, site artifacts, deployment, and readback.
4. Define phase invalidation. A changed evaluator reruns evaluation but not
   immutable acquisition; changed Sampling2 invalidates composition and
   generation evidence but not SLM2 bytes; changed docs do not reconvert the
   model; changed runtime invalidates native/WASM claims. Provide a complete
   dependency matrix.
5. Specify versioned receipt schemas without a lone boolean `passed`. Include
   phase identity, input roots, tool roots, attempt, terminal state, evidence
   members, bounded metrics, timestamps, error code, supersedes link,
   redaction status, and verifier identity.
6. Define create-only durable persistence on Windows and Linux. Cover bounded
   JSON, streaming hashes, same-directory temporary files, fsync, atomic
   promotion, directory durability, output-root ownership, rename collisions,
   full disk, antivirus locks, interruption, resume validation, and immutable
   history.
7. Design privacy minimization and secret scanning. Public reports may contain
   public IDs, hashes, sizes, versions, counts, statuses, timestamps, and
   bounded errors. Exclude prompts, raw model output where private, model
   bytes, local paths, invitation URLs, tokens, credentials, private source
   URLs, and hosted-memory payloads. Include synthetic sentinel tests.
8. Define a blocker taxonomy for source drift, license ambiguity, unsupported
   architecture, source quality failure, conversion defect, Sampling2 mismatch,
   composition mismatch, browser conformance failure, insufficient resources,
   companion security defect, no eligible peer, absent public proof, package
   gate failure, signing absence, deployment mismatch, and stale docs. State
   what independent work may continue behind each blocker.
9. Design the Git checkpoint discipline. Require coherent green changes,
   scoped commits, no generated large artifacts, correct ignore rules, branch
   authority, clean status where needed, push, fresh fetch, local/tracking/
   remote equality, immutable source commit in receipts, and no false claim
   from an unpushed local commit.
10. Define package and companion release gates. Include Rust tests, managed
    tests, public API baselines, package content audit, native RID inspection,
    symbols, SBOM, provenance, isolated consumers, create-only transaction,
    release authorization, feed readback, companion archive verification, and
    no dirty-source publication.
11. Define site/documentation ownership. Inventory the product site, API/docs
    sites, package docs, MiniModel/catalog docs, companion docs, architecture,
    operator runbooks, privacy/security statements, download instructions,
    release notes, update log, visible version/date, and status language. Each
    technical change must identify affected docs before merge.
12. Design documentation freshness gates. Validate exact current package IDs,
    SLM2-only architecture, P2P-first-or-convert behavior, no instruction-file
    downloads, companion availability truth, MemoryEndpoints disconnected
    status, current version/date, working links, command correctness,
    accessibility, and absence of obsolete branded/legacy claims.
13. Define deployment and public HTTPS readback. Bind built site artifact,
    source commit, deployment target, authorization, deployment receipt, TLS
    result, response status, content hash or normalized key assertions, cache
    behavior, visible version/date, update-log entry, security headers, and
    rollback/supersession without rewriting prior evidence.
14. Define release communication and claim taxonomy. Separate implemented,
    locally tested, browser proven, package published, site deployed, public
    P2P proven, catalog announced, and campaign complete. Give prohibited
    language for every incomplete state.
15. Design a concise operator dashboard reporting current operation, elapsed
    time, resumability, active blockers, first-model phase, package/site status,
    last commit/push equality, last publication/date, and unchanged campaign
    counters. It must derive status from receipts, not mutable manual flags.
16. Define failure-to-regression workflow. Preserve raw failure, create a
    minimal generic failing test, add positive/counterexample cases, make a
    scoped root-cause fix, rerun only invalidated phases, update docs/UAI memory,
    commit/push, deploy when all affected gates pass, and archive prior
    decisions.
17. Provide complete campaign manifest, phase receipt, blocker record, source-
    control checkpoint, package release, deployment, readback, documentation
    audit, update-log entry, dashboard, and final first-model acceptance schema
    examples plus orchestration/verifier pseudocode.
18. Produce a prioritized execution plan that reaches the smallest honest
    deployable milestone first without lowering quality: canonical converter
    boundary, Sampling2 composition gate, full ACG2, one real model, P2P-or-
    convert UX, browser chat, package/source release, then sites/readback.
19. Identify every fact requiring local source inspection, authorized
    credentials, actual model/browser/P2P execution, package-feed access,
    deployment access, or public network readback.

Required report structure:

1. Executive control-plane recommendation.
2. End-to-end phase/state diagram.
3. Content-addressed evidence and invalidation graph.
4. Receipt schema family and atomic persistence.
5. Privacy/redaction and secret-scanning contract.
6. Blocker matrix with parallel work paths.
7. Git, package, companion, and supply-chain gates.
8. Site/documentation ownership and freshness gates.
9. Deployment, publication, and HTTPS readback.
10. Claim taxonomy, operator dashboard, and unchanged counters.
11. Failure-to-regression workflow.
12. Final first-model acceptance checklist.
13. Prioritized implementation plan with objective gates.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend compatibility support, legacy migration, parallel old/new
release lanes, a single mutable `passed` flag, overwritten receipts, mocks as
live proof, local P2P as outside proof, package creation as publication,
cross-compilation as executed ARM64 evidence, dirty-source publishing, stale
documentation, invented deployment claims, or changing campaign counters
without exact live receipts. Do not invent current commit, package, or site
status.

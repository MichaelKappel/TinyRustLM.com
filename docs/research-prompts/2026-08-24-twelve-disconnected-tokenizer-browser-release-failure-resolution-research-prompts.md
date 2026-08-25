# Twelve Disconnected Research Prompts: Tokenizer, Browser, And Release-Failure Resolution

Each section below is a complete standalone assignment intended for a different
technical research agent. Send one whole prompt to one agent. The agents do not
share context and must not be expected to have seen this introduction, another
prompt, or any private TinyRustLM material.

The agents may browse public standards, official documentation, papers, model
cards, immutable public repository revisions, package registries, and public
source trees. They have no access to the TinyRustLM source tree, private
branches, local models, generated artifacts, test output, receipts, browser
profiles, credentials, signing keys, deployment accounts, private services, or
unpublished evaluation cases. Every report must clearly distinguish:

1. directly observed public facts;
2. facts from cited external sources;
3. project facts supplied by its prompt but not independently verified;
4. engineering analysis and recommendations;
5. assumptions and uncertainty; and
6. facts that require local implementation, private evidence, or authorized
   production verification.

No agent may claim that it inspected, built, ran, tested, or validated private
TinyRustLM code. Reports must be exceptionally detailed, technical, and
implementation-oriented. They should provide concrete state machines, binary
or JSON schemas, pseudocode, algorithms, invariants, resource formulas, threat
models, failure matrices, test plans, and objective acceptance criteria. Each
report must favor primary sources, record source publication or update dates,
record its own retrieval date, and pin public repository material to immutable
revisions wherever possible.

## Prompt 1: Cargo Output Custody And Reproducible Native/WASM Artifact Discovery

You are an independent principal Rust build-systems engineer, reproducible-build
specialist, and software-supply-chain auditor. Produce an exceptionally
detailed technical report that designs one fail-closed method for invoking
Cargo and identifying, copying, hashing, and releasing exactly the artifacts
produced by that invocation. Your report will guide TinyRustLM implementation,
but you have no access to its private source tree, scripts, build output, test
logs, machines, or release accounts. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no launched older product,
  compatibility population, migration obligation, or permission to preserve
  legacy paths. Names such as SLM2, ACG2, Tokenizer2, Template2, Sampling2,
  Prompt2, schema identifiers, semantic versions, and branch names are exact
  technical identities, not product generations.
- The project builds Rust native libraries, executables, and import-free
  `wasm32-unknown-unknown` modules from more than one workspace or crate.
- A current release test requires every build script to copy from the Cargo
  target directory that the script actually invoked. Guessing `target/debug`,
  selecting the newest matching filename, or accepting a stale output is not
  allowed.
- Build and release evidence must bind source revision, lockfile, toolchain,
  target triple, profile, features, environment, command, output identity, and
  destination identity. Generated artifacts and private evidence stay outside
  Git unless explicitly designated as public release assets.
- Windows x64, Linux x64, Linux ARM64, and browser WASM are material targets.
  Cross-compilation is not the same as execution on real hardware.
- A build that cannot prove which invocation created an artifact must fail. A
  later successful build must not erase the earlier failed observation.
- MemoryEndpoints is unauthorized and disconnected. It is outside this task.

Research current primary documentation for Cargo build directories,
`CARGO_TARGET_DIR`, `--target-dir`, Cargo configuration precedence, workspace
target directories, target triples, profiles, feature resolution, build-script
outputs, `--message-format=json`, compiler-artifact messages, rustc metadata,
WASM output naming, Windows DLL/PDB behavior, Linux shared objects, deterministic
or reproducible Rust builds, and relevant supply-chain provenance standards.
Record publication/update dates and retrieval date. Identify documented
guarantees separately from implementation observations.

Address all of the following in depth:

1. Define identities for repository revision, source tree, `Cargo.lock`, Cargo,
   rustc, rustup toolchain, linker, target specification, target triple, build
   profile, feature set, environment allowlist, invocation, Cargo target root,
   compiler-artifact event, produced file, copied file, symbol file, manifest,
   and release bundle. State which are content-derived and which are contextual.
2. Explain all relevant target-directory resolution rules and precedence,
   including command-line options, environment variables, `.cargo/config.toml`,
   workspace discovery, crate-local invocation, absolute versus relative paths,
   and platform path normalization. Show how a launcher computes and records
   the effective root without relying on a duplicated guess.
3. Evaluate parsing Cargo's JSON message stream as the authoritative artifact
   discovery mechanism. Specify accepted message kinds and fields, package and
   target matching, executable versus filenames handling, duplicate events,
   multiple crate types, diagnostics interleaving, malformed JSON, nonzero
   exit, missing final event, and Cargo version drift.
4. Design exact native-library, executable, PDB, debug-symbol, and raw-WASM
   selection rules. Cover filename differences, hashed dependency outputs,
   top-level outputs, incremental directories, custom targets, examples,
   benches, tests, proc macros, and why globbing or modification time is unsafe.
5. Specify a build transaction: preflight, empty owned staging root, immutable
   invocation record, subprocess launch, bounded stdout/stderr capture, JSON
   event parsing, exit observation, artifact reopening, streamed hashing,
   binary-header inspection, independent format validation, destination
   creation, fsync or platform durability steps, manifest creation, and atomic
   publication.
6. Define concurrency behavior when two builds target the same workspace or
   target root. Compare unique `--target-dir` per attempt, shared Cargo caches,
   advisory locks, package-cache reuse, jobserver behavior, and race-free
   artifact custody. Include disk and build-time tradeoffs as formulas.
7. Cover hostile or accidental filesystem conditions: symlinks, Windows
   reparse points, hard links, alternate data streams, case-fold collisions,
   path traversal, junctions, stale files, locked files, antivirus races,
   disk-full, partial copy, cross-volume moves, and source mutation during build.
8. Design an environment policy that records only material, nonsecret values.
   Explain how to prevent ambient `RUSTFLAGS`, wrappers, linker overrides,
   registries, credentials, proxy settings, and user config from silently
   changing output while keeping reports free of secrets.
9. Specify reproducibility tiers: same-invocation custody, source-equivalent
   rebuild, bit-for-bit reproducibility, semantic binary equivalence, and real
   target execution. State the evidence and claim language permitted at each
   tier, including what PDB timestamps or platform linkers may prevent.
10. Provide PowerShell and POSIX-safe pseudocode for argument-array process
    launch, JSON stream parsing, path containment, streamed copy-and-hash,
    exclusive destination creation, and terminal receipt writing. Avoid shell
    string construction and cross-shell deletion.
11. Design unit, integration, mutation, and fault-injection tests for wrong
    target roots, stale artifacts, duplicate package names, feature drift,
    malformed Cargo events, interrupted copies, compiler failure, hostile paths,
    simultaneous builds, and replaced artifacts between observation and hash.
12. Define an adoption plan for a clean-slate prelaunch codebase: one canonical
    build API, deletion of competing scripts, preregistered incompatible
    contract replacement when semantics change, and no compatibility wrapper.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Cargo target-directory and JSON-message authority analysis.
3. Identity model and canonical build-receipt schema.
4. Native, symbol, executable, and WASM artifact-selection rules.
5. End-to-end build and publication transaction.
6. Cross-platform filesystem and process-launch design.
7. Concurrency, cache, disk, and performance model.
8. Threat model and secret-minimizing environment policy.
9. Reproducibility and claim taxonomy.
10. Pseudocode for the canonical implementation.
11. Test and fault-injection matrix.
12. Clean-slate adoption and deletion plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend selecting the newest file, assuming Cargo wrote to a familiar
`target` directory, copying before a successful terminal event, trusting an
exit code without artifact validation, running a second hidden build to obtain
a convenient output, preserving an alternate script for compatibility, or
calling cross-compiled bytes executed target evidence.

## Prompt 2: Content-Addressed Preregistration DAGs Without Circular Identity

You are an independent principal evidence-systems architect, formal methods
engineer, and reproducible-experiment designer. Produce an exceptionally
detailed technical report defining an output-free preregistration and
content-addressed evidence graph for deterministic software and browser
experiments. Your report will guide TinyRustLM implementation. You have no
access to its private repository, contracts, tools, generated outputs, test
receipts, or machines. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one clean-slate prelaunch product with no legacy-support or
  migration requirement. SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2,
  schema IDs, semantic versions, and branch names are technical identities.
- Before an execution, the project freezes an output-free registration that
  binds every material implementation input, case input, runtime/tool version,
  limit, expected invariant, evidence destination policy, and verifier.
- Execution and verification are separate. Raw observations are immutable.
  Failed, rejected, superseded, or obsolete records remain history and are
  never overwritten or edited into success.
- A material change to an evaluator invalidates evaluation descendants but
  should not force a repeat of a valid multi-gigabyte source acquisition or a
  deterministic conversion whose inputs did not change.
- Current failures show that stale hashes can arise when implementation files,
  generated app assets, validators, source locks, or preregistration documents
  change. The design must distinguish a true dependency from accidental
  repository-wide coupling and must avoid a hash cycle in which a registration
  directly or indirectly includes its own hash.
- Best-of-N selection, output repair, selective retry after observing answers,
  undeclared network access, and replacement evidence are forbidden.
- Campaign counters remain zero until real, objective gates pass.
  MemoryEndpoints is unauthorized and disconnected.

Research primary sources on Merkle DAGs, content-addressed storage, canonical
JSON or CBOR, in-toto attestations, SLSA provenance, Nix/Bazel-style derivation
identity, reproducible experiments, preregistration, append-only transparency
logs, cryptographic domain separation, and secure timestamping. Record source
dates and retrieval date. Explain where a standard is directly applicable and
where a project-specific protocol is required.

Address all of the following in depth:

1. Define node types for public source lock, private source acquisition,
   converter, runtime, tokenizer, template, sampling profile, prompt profile,
   model artifact, browser asset, test corpus, generator, registration,
   execution, raw observation, verifier, verification decision, release
   manifest, deployment readback, and revocation or supersession.
2. Specify one canonical identity algorithm with domain separation, canonical
   serialization, UTF-8 and Unicode rules, integer and timestamp rules, map
   ordering, absent versus null values, path treatment, hash algorithm agility,
   size limits, and rejection of duplicate JSON keys or noncanonical numbers.
3. Solve registration self-reference. Compare hash-excluded fields, a two-node
   descriptor/identity model, external naming, detached signatures, and Merkle
   roots. Select one design and prove informally that no mutable field escapes
   identity and no cycle remains.
4. Define the exact distinction between implementation inputs, test inputs,
   expected semantic invariants, public metadata, execution environment,
   observations, and decisions. Explain why outputs and answer-dependent values
   cannot appear in preregistration.
5. Design selective invalidation. Give dependency and invalidation tables for
   source acquisition, conversion, native evaluation, tokenizer parity, WASM
   execution, browser evidence, semantic review, packaging, deployment, and
   public claims. Include evaluator-only, documentation-only, browser-version,
   source-lock, compiler, and app-shell changes.
6. Define how generated files participate. Cover source generator identity,
   generator inputs, generated byte identity, reproducibility check, checked-in
   versus release-only output, stale generated output, and the case where tests
   read a generated file while a release manifest reads its source.
7. Specify immutable history and state transitions for registered, executable,
   observed, verified-pass, verified-reject, invalidated, superseded, externally
   blocked, and revoked. Do not collapse these into one boolean.
8. Design an evidence root layout and bounded receipt schema. Cover exclusive
   creation, same-directory atomic writes, streamed hashes, cross-volume
   prohibition, Windows rename behavior, fsync, crash recovery, untrusted paths,
   secret minimization, retention, and garbage collection that preserves roots.
9. Explain verifier independence. Define how a verifier proves it consumed the
   registered observation exactly once, did not regenerate or repair output,
   had no undeclared network access, and produced a decision bound to its own
   executable identity and limits.
10. Provide algorithms for materializing a preregistration, checking closure,
    detecting cycles, computing a topological invalidation set, accepting one
    raw observation, and deriving a release claim from current nonrevoked proof.
11. Design adversarial tests: omitted input, hidden environment dependency,
    path alias, line-ending drift, reordered JSON, duplicate keys, hash cycle,
    stale generated asset, replaced verifier, replayed observation, reused
    output directory, clock rollback, and selective easy-seed execution.
12. Define a clean-slate cutover from multiple overlapping authority files to
    one canonical schema family. State what immutable history remains readable
    as evidence and why no runtime compatibility parser is necessary.

Required report structure:

1. Executive architecture recommendation.
2. Evidence-node taxonomy and trust boundaries.
3. Canonical serialization and content-identity profile.
4. Circularity-free preregistration construction.
5. Receipt schemas and state machines.
6. Dependency and selective-invalidation matrix.
7. Generated-source and release-asset identity rules.
8. Atomic persistence, resume, and immutable-history algorithm.
9. Verifier independence and no-cheat controls.
10. Threat model and adversarial test matrix.
11. Worked example from source lock through browser decision.
12. Clean-slate implementation and deletion sequence.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates.

Do not recommend a repository-wide hash as a substitute for a dependency graph,
put observations into preregistration, exclude mutable material merely to break
a cycle, overwrite stale evidence, let a verifier repair output, rerun only an
easy failed case, preserve duplicate authority formats, or infer completion
from a single `passed` field.

## Prompt 3: Publisher-Exact Qwen3 Byte-Level BPE And Bounded Tokenizer2 Semantics

You are an independent principal tokenizer engineer, Unicode specialist, and
language-model interoperability researcher. Produce an exceptionally detailed
technical report that reconstructs the exact tokenizer semantics of a pinned
public Qwen3-family model and shows how to lower them into a bounded,
executable-free Tokenizer2 artifact suitable for deterministic Rust native and
browser-WASM execution. You have internet access. You have no access to the
TinyRustLM source, private artifacts, converted tokenizer, test corpus, model
bytes, or runtime output. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. There is no legacy
  product or compatibility obligation. Tokenizer2 is an exact technical format
  identity, not a product version label.
- The first intended model family is dense Qwen3 in the compact range, with a
  pinned public repository revision and file hashes selected locally. The exact
  model revision is a local fact and must not be guessed by the report.
- The project currently expects a Hugging Face `tokenizer.json` version 1.0
  shape using byte-level BPE, added tokens, special tokens, ByteLevel
  pretokenization/postprocessing/decoding, and publisher-defined chat-related
  token IDs. The report must verify public Qwen behavior from primary sources
  rather than treating these supplied expectations as observed fact.
- Tokenizer2 must contain only bounded declarative data. It must not embed
  regex bytecode, Jinja, JavaScript, Python, WASM, native code, remote URLs, or
  an alternate tokenizer implementation.
- Native Rust and browser WASM must consume the same Tokenizer2 bytes and
  produce exact token IDs and decoded UTF-8. Server tokenization and JavaScript
  fallback tokenization are forbidden.
- Invalid UTF-8, malformed tokenizer JSON, duplicate IDs, missing vocab rows,
  invalid merge references, oversized sections, unsupported components, and
  inconsistent special-token declarations must fail closed.
- Arithmetic is secondary. MemoryEndpoints and model training are outside this
  task.

Use primary sources wherever possible: the official Qwen3 model card and
repository at immutable revisions, Qwen technical reports, Hugging Face
Tokenizers source and documentation at pinned revisions, Unicode standards,
the GPT-2 byte-to-Unicode mapping lineage, JSON specifications, and relevant
Rust Unicode/UTF-8 documentation. Record publication/update dates and retrieval
date. Quote sparingly and identify ambiguities that require source-code tracing.

Address all of the following in depth:

1. Enumerate every public file and field needed to reproduce Qwen3 tokenization:
   `tokenizer.json`, tokenizer config, special-token maps, generation config,
   model config, chat template, added tokens, vocab, merges, normalizer,
   pretokenizer, postprocessor, and decoder. Explain authority and conflict
   precedence among them.
2. Reconstruct byte-level pretokenization precisely. Cover the pinned regex or
   split behavior, byte-to-visible-Unicode mapping, `add_prefix_space`,
   `trim_offsets`, `use_regex`, contractions, numbers, whitespace runs, CRLF,
   tabs, control characters, punctuation, emoji, combining marks, CJK, RTL
   text, invalid scalar sequences at host boundaries, and normalization policy.
3. Specify BPE merge execution: initial symbols, rank table, pair selection,
   tie behavior, repeated pairs, empty input, unknown handling, cache semantics,
   integer widths, deterministic complexity bounds, and denial-of-service
   considerations for long adversarial tokens.
4. Define added-token matching and precedence. Cover normalized versus raw
   matching, `single_word`, `lstrip`, `rstrip`, `special`, overlapping tokens,
   longest match, equal-length tie breaks, boundary definitions across Unicode,
   and interactions with pretokenization and postprocessing.
5. Define encoding with and without special tokens, beginning/end markers,
   postprocessor behavior, publisher token IDs, duplicate string or ID cases,
   and why chat-template serialization must be separated from tokenizer
   semantics even when both use the same special tokens.
6. Define decoding for include-all and skip-special modes. Cover token byte
   reconstruction, ByteLevel decoder rules, added-token text, replacement
   behavior, malformed byte sequences, concatenation order, special-token
   omission, and round-trip properties that do and do not hold.
7. Propose a bounded Tokenizer2 binary layout. Include magic, profile identity,
   endianness, section table, offsets, counts, vocab strings, token IDs, merge
   ranks, added-token flags, special-token set, checksums, alignment, canonical
   ordering, reserved fields, and maximum sizes. State validation order and
   overflow-safe arithmetic.
8. Design a strict source converter that accepts only the publisher shape
   actually needed. Define duplicate-key rejection, unknown-field policy,
   integer exactness, URI prohibition, source lock and license binding,
   deterministic ordering, two independent conversion reproducibility, and
   terminal rejection for unsupported semantics.
9. Analyze data structures for compact native/WASM execution: trie, double-array
   trie, sorted arrays, perfect hash, rank map, rolling pair heap, token string
   table, and caches. Compare memory, startup, encode complexity, and attacker
   influence using formulas rather than invented measurements.
10. Design an independent differential oracle against the pinned upstream
    tokenizer without sharing conversion or runtime code. Include exact corpus
    materialization, input hashes, output preservation, source revision,
    tokenizer options, and first-divergence reporting.
11. Specify exhaustive property, mutation, and fuzz classes for UTF-8,
    whitespace, added-token overlaps, BPE ties, corrupt offsets, count
    overflows, duplicates, truncation, unsupported graph nodes, and decode
    invalidity. Distinguish parser safety from publisher parity.
12. Define promotion evidence for one full public tokenizer: source custody,
    deterministic conversion, native parity, WASM parity, real-Chromium parity,
    memory and latency measurements, and explicit unknowns. State why miniature
    fixtures cannot satisfy the full-tokenizer gate.

Required report structure:

1. Executive recommendation and verified public observations.
2. Qwen3 tokenizer authority and file-precedence matrix.
3. Exact ByteLevel and BPE algorithm specification.
4. Added-token, special-token, encode, and decode semantics.
5. Proposed bounded Tokenizer2 binary format.
6. Strict conversion and provenance algorithm.
7. Runtime data structures and resource formulas.
8. Differential oracle and first-divergence protocol.
9. Unicode, mutation, and fuzz matrix.
10. Full-tokenizer native/WASM/Chromium promotion gates.
11. Failure modes and clean rejection strategy.
12. Unknowns requiring pinned-source or local execution.
13. Annotated primary-source bibliography with dates and immutable links.

Do not recommend a generic tokenizer library call without pinning semantics,
shipping `tokenizer.json` as executable policy, a JavaScript or server fallback,
silently replacing unsupported components, normalizing text beyond publisher
behavior, repairing malformed UTF-8, accepting approximate token IDs, or using
a miniature vocabulary as proof for a real model tokenizer.

## Prompt 4: Safe Import-Free Raw-WASM Tokenizer ABI And Host Adapter

You are an independent principal WebAssembly ABI designer, Rust memory-safety
engineer, and browser-runtime security reviewer. Produce an exceptionally
detailed report defining a production raw-WASM boundary for a deterministic
Tokenizer2 runtime and a minimal JavaScript host adapter. You have no access to
TinyRustLM source, current WASM bytes, interface contracts, browser tests, or
build output. Do not claim that private code is safe or complete.

Facts supplied by the project for this assignment:

- TinyRustLM is a clean-slate prelaunch browser-local product. No compatibility
  shim, legacy ABI, dual runtime, or fallback implementation may be retained.
- One Rust Tokenizer2 implementation must compile to native code and an
  import-free `wasm32-unknown-unknown` module. Import-free means the final module
  must declare zero imports, including no WASI, imported memory, logging,
  randomness, clocks, exception helpers, or host allocation.
- The module exports one bounded linear memory and a small fixed function
  surface for ABI identity, allocation or input staging, tokenizer load,
  encode, decode, reset, clear, result inspection, error inspection, and
  resource counters. Exact local names are private facts; the report should
  recommend semantics and a canonical naming strategy rather than pretend to
  know current names.
- Rust source for the production boundary is expected to forbid executable
  `unsafe` Rust. The JavaScript adapter must not reimplement tokenization,
  repair errors, retry for a better result, or trust unbounded module values.
- A full Tokenizer2 artifact is approximately several megabytes, so whole-file
  base64 and repeated copies are undesirable. Inputs, outputs, token counts,
  memory pages, and error text must all be bounded before use.
- Cancellation of CPU-bound WASM cannot depend on the module yielding at a
  JavaScript promise boundary. Hard cancellation may require terminating an
  owning worker and creating a fresh worker.
- MemoryEndpoints, remote inference, and model training are outside this task.

Research WebAssembly Core and JavaScript API specifications, MDN and browser
implementation documentation, Rust `wasm32-unknown-unknown` behavior, allocator
choices, panic strategies, bulk memory, memory growth, typed arrays, structured
clone and transfer, workers, module validation, and relevant secure-coding
guidance. Record source dates and retrieval date. Separate normative guarantees
from browser-specific behavior.

Address all of the following in depth:

1. Define the trust boundary among untrusted Tokenizer2 bytes, untrusted input
   text, the JavaScript adapter, the WASM module, linear memory, worker, browser
   page, and caller. Enumerate memory corruption, confused-deputy, stale-view,
   denial-of-service, and result-forgery threats even with memory-safe Rust.
2. Propose a complete versioned ABI. For each function specify parameters,
   integer widths, pointer/length ownership, preconditions, postconditions,
   error behavior, state transitions, maximum work, and whether a call may grow
   memory. Include exact ABI/profile identity retrieval before other calls.
3. Compare caller-allocated input regions, module alloc/free, one fixed mailbox,
   streaming chunks, and direct host memory writes. Select a model that remains
   safe without Rust `unsafe`, minimizes copies, and makes ownership auditable.
4. Define return-value and error transport. Compare packed integers, status plus
   query functions, fixed result descriptors, and serialized envelopes. Specify
   how the host validates pointers, lengths, alignment, token counts, UTF-8,
   integer multiplication, memory bounds, and error-code allowlists.
5. Define module state: empty, tokenizer-loaded, tokens-current,
   decode-current, reset, cleared, terminal-faulted. State which transitions are
   legal, how failed load preserves or discards prior state, how sensitive bytes
   are cleared, and how reentrancy or concurrent calls are rejected.
6. Specify linear-memory policy: initial and maximum pages, growth admission,
   artifact storage, parsed indexes, scratch, token output, decoded output,
   allocator fragmentation, repeated load/clear cycles, and an honest peak-memory
   formula. Explain typed-array invalidation after `memory.grow`.
7. Design a strict JavaScript adapter that validates the module before
   instantiation and every response afterward. Cover import/export inventory,
   memory count and limits, custom sections, start function, tables, globals,
   unexpected exports, module byte limit, compile/instantiate errors, and
   browser exception normalization into bounded product error codes.
8. Explain what an import-free module does and does not prove. Analyze hidden
   nondeterminism, floating-point behavior, allocator behavior, panics/traps,
   custom sections, embedded source paths, debug names, and supply-chain
   identity. Define independent binary inspection requirements.
9. Design deterministic cancellation and recovery using a dedicated worker.
   Specify command IDs, generation IDs, one in-flight operation, start proof,
   termination, late-message rejection, fresh-worker creation, module and
   artifact reload, and proof that canceled output cannot be accepted.
10. Provide Rust-like and JavaScript-like pseudocode for load, encode, decode,
    reset, clear, bounds validation, memory-copy refresh after growth, worker
    request ownership, cancellation, and recovery. Keep tokenization exclusively
    inside Rust/WASM.
11. Specify conformance, mutation, and fuzz tests for malformed modules,
    unexpected imports/exports, invalid pointers, huge lengths, memory growth,
    traps, panics, stale typed arrays, repeated state transitions, cancellation
    races, worker death, and successful fresh-worker replay of a preregistered
    noncanceled case.
12. Define production acceptance evidence in Node's WebAssembly engine and real
    Chromium, while explaining why Node-only execution, successful compilation,
    or a miniature artifact alone is insufficient.

Required report structure:

1. Executive ABI recommendation and assumptions.
2. Trust-boundary and threat model.
3. Complete raw-WASM ABI and state machine.
4. Pointer, length, result, and error validation rules.
5. Linear-memory ownership and resource model.
6. Strict JavaScript adapter design.
7. Module binary-validation profile.
8. Worker cancellation and recovery protocol.
9. Rust and JavaScript pseudocode.
10. Test, mutation, fuzz, and browser matrix.
11. Acceptance evidence and claim boundaries.
12. Unknowns requiring local implementation inspection.
13. Annotated primary-source bibliography with dates.

Do not recommend `wasm-bindgen` glue as an unexplained trust boundary, imported
host services, JavaScript tokenization, unchecked pointer views, unbounded
memory growth, catching a trap and continuing with the same instance, promise
timeouts as CPU cancellation, best-effort clearing claimed as proof, a second
ABI for compatibility, or Node execution presented as real-browser evidence.

## Prompt 5: Browser Worker Ownership, Hard Cancellation, And Memory Recovery

You are an independent principal browser concurrency engineer, reliability
architect, and WASM resource-governance specialist. Produce an exceptionally
detailed technical report for exactly-once execution of CPU-bound tokenizer and
model work in a dedicated browser worker, including hard cancellation and clean
recovery. You have no access to TinyRustLM code, workers, tests, profiles,
models, or telemetry. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM runs models locally in a browser. Prompts and model bytes must not
  be uploaded to a project server. The browser page owns user interaction while
  a worker owns WASM runtime state.
- The product is prelaunch and clean-slate. There is one canonical worker
  protocol, no legacy messages, no alternate synchronous path, and no remote or
  JavaScript fallback.
- Tokenization and later model generation are CPU-bound synchronous WASM calls.
  JavaScript cannot reliably interrupt such a call inside one worker. A cancel
  command queued to that same busy worker is not hard cancellation.
- The intended cancellation boundary is termination of the owning worker,
  rejection of every result from its generation, then creation and validation
  of a fresh worker before new work. A timeout is an observation and policy
  trigger, not proof that computation stopped.
- Model and tokenizer artifacts are content-addressed. A fresh worker may need
  to reload verified local bytes. Partial outputs, stale completion messages,
  duplicate response events, and outputs from canceled generations must never
  become authoritative conversation state.
- The browser must enforce bounded module bytes, artifact bytes, prompt bytes,
  input characters, token count, context length, memory pages, output bytes,
  wall time, and one-in-flight ownership. Resource failure is not a quality pass.
- MemoryEndpoints is unauthorized and disconnected. Campaign counters are zero.

Research primary documentation for DedicatedWorker, termination semantics,
event loops, `postMessage`, structured clone, transferable objects,
SharedArrayBuffer prerequisites, Atomics, WebAssembly memory, IndexedDB,
performance timing, page lifecycle, process isolation, Playwright, Chromium
crash behavior, and browser memory APIs. Record source dates and retrieval date.
State where browsers do not provide a required proof directly.

Address all of the following in depth:

1. Define actors and identities for page session, worker generation, command,
   operation, artifact composition, model instance, conversation, turn,
   cancellation request, timeout observation, completion, and accepted result.
   Specify random versus monotonic versus content-derived identities.
2. Design a versioned command/result protocol for initialize, load composition,
   tokenize, prefill, decode step or generate, cancel acknowledgement from the
   page side, status, clear, and fatal error. Include strict schemas, maximum
   sizes, unknown-field rejection, and state-specific allowed commands.
3. Formalize one-in-flight ownership and exactly-once acceptance. Explain how
   the page atomically reserves an operation, records start, rejects duplicate
   UI events, correlates messages, commits one terminal result, and prevents a
   late worker from appending text after cancellation or restart.
4. Define hard cancellation step by step: mark generation revoked, detach
   handlers, terminate worker, prove no completion was accepted, discard
   partial UI state or label it nonauthoritative, create a new generation,
   validate script/module identity, reload artifacts, and run a fixed recovery
   case. Explain unavoidable limitations of proving OS-level memory erasure.
5. Analyze cooperative cancellation alternatives using Atomics or periodic
   yielding. State when they improve latency, why they cannot replace the hard
   boundary unless declared and verified, and the security/deployment headers
   required for shared memory.
6. Build an admission formula covering browser process baseline, worker heap,
   WASM initial and maximum memory, model weights, tokenizer structures,
   activations, KV cache, scratch buffers, JS copies, transfer buffers, output,
   and safety reserve. Include 32-bit WASM address-space and browser-specific
   allocation constraints.
7. Design artifact transfer and reload. Compare copying ArrayBuffers,
   transferring ownership, reading IndexedDB inside the worker, streaming from
   the page, and file-backed browser APIs. Require hash verification and prevent
   partial composition activation or use-after-transfer confusion.
8. Specify UI state during queued, loading, running, canceling, canceled,
   recovering, ready, failed, and out-of-resource states. Each assistant answer
   must render once; status must not say ready while the old worker can still
   produce accepted output.
9. Cover page reload, navigation, back-forward cache, visibility changes,
   mobile suspension, out-of-memory kill, worker script load failure, WASM trap,
   browser process crash, stale service worker, and profile deletion. State the
   only honest recovery and evidence for each.
10. Provide page and worker pseudocode with generation fencing, idempotent
    terminal transitions, abort policy, timeout escalation, result validation,
    telemetry-free local diagnostics, and secret-safe bounded logs.
11. Design deterministic race tests and fault injection for cancel-before-start,
    cancel-during-real-work, completion-versus-cancel, double cancel, worker
    crash, duplicate message, stale generation, transferred-buffer reuse,
    memory admission rejection, fresh-worker recovery, and repeated cycles.
12. Define real-Chromium evidence: owned fresh profile, exact browser build,
    exact scripts and modules, raw event transcript, memory observations,
    screenshot restrictions, profile deletion proof, and a verifier independent
    from the runtime. Separate this from actual model quality evidence.

Required report structure:

1. Executive recommendation.
2. Actor, identity, and trust model.
3. Worker wire protocol and state machine.
4. Exactly-once ownership and generation fencing.
5. Hard-cancellation and clean-recovery algorithm.
6. Memory admission and resource formulas.
7. Artifact transfer and reload architecture.
8. UI truth and lifecycle behavior.
9. Pseudocode for page and worker controllers.
10. Race, fault-injection, and browser test matrix.
11. Evidence, privacy, and claim boundaries.
12. Unknowns requiring local browser execution.
13. Annotated primary-source bibliography with dates.

Do not recommend a timer as proof of cancellation, accepting partial text after
worker revocation, reusing a trapped instance, concurrent unbounded workers,
hidden retries, remote inference, JavaScript model execution, one reusable
browser profile as clean-state proof, or status text that outruns actual state.

## Prompt 6: Independent Tokenizer Differential Corpus And First-Divergence Laboratory

You are an independent principal test architect, differential-testing
researcher, and Unicode fuzzing specialist. Produce an exceptionally detailed
report for a deterministic, independently auditable corpus and first-divergence
laboratory proving tokenizer parity from a pinned public Qwen source through
native Rust, raw WASM, Node WebAssembly, and real Chromium. You cannot inspect
TinyRustLM code, fixtures, converted artifacts, outputs, or receipts. Do not
claim that parity currently exists.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product with no compatibility modes. Tokenizer2
  is the sole intended runtime tokenizer artifact.
- The upstream source oracle, converter, native runtime, WASM runtime,
  JavaScript adapter, browser runner, and final verifier are distinct roles.
  Sharing implementation code across every role can reproduce one bug and is
  not independent proof.
- Tokenization is deterministic. Exact token IDs and exact decoded UTF-8 are
  required. Tolerance, majority voting, retries, answer repair, and best-of-N
  have no place in tokenizer parity.
- Corpus cases must be preregistered before execution and bound to generator
  identity, seed where applicable, category, source revision, options, input
  bytes, and hash. Raw outputs are immutable and output directories are
  create-only.
- The suite needs both a small public contract fixture and the full pinned
  publisher tokenizer. Passing the small fixture alone is not full-tokenizer
  evidence.
- Browser proof uses owned fresh persistent Chromium profiles that are later
  deleted. Node execution is not interchangeable with browser execution.
- No undeclared network request is allowed during execution. MemoryEndpoints
  is unauthorized and disconnected.

Research primary sources on differential testing, metamorphic testing,
property-based testing, Unicode conformance, tokenizer testing, fuzzing Rust and
WASM, test-case reduction, reproducible random generation, Playwright browser
automation, and cryptographic experiment registration. Record source dates and
retrieval date. Distinguish standard requirements from recommended project
policy.

Address all of the following in depth:

1. Define independent roles and acceptable implementation sharing. Specify
   which oracle may call the pinned upstream package, which converter consumes
   publisher JSON, which implementations must parse Tokenizer2 independently,
   and how the final verifier avoids invoking any runtime under test.
2. Create a corpus taxonomy covering ASCII words, contractions, punctuation,
   integers, decimals, whitespace runs, leading/trailing spaces, tabs, CRLF,
   empty text, controls, NUL, all UTF-8 length classes, combining marks,
   normalization lookalikes, emoji sequences, variation selectors, skin tones,
   flags, ZWJ, CJK, RTL, bidi controls, mixed scripts, private use, and maximal
   valid scalar values.
3. Add tokenizer-specific categories: every special token, added-token overlap,
   special text embedded in prose, prefix-space states, regex boundaries,
   byte-fallback values, merge chains, equal-rank impossibility checks,
   duplicate-looking Unicode, longest-token matches, skip-special decoding, and
   non-round-tripping byte cases.
4. Design deterministic generated families. Define a public generator version,
   seed commitment before use, seed derivation that prevents easy-seed choice,
   count per family, maximum input, duplicate elimination, stable ordering, and
   materialized-case hash. Avoid generating from observed failing outputs.
5. Define expected records from the source oracle, including raw input byte
   hash, options, token IDs, token count, decoded byte hash, decoded text where
   safe, upstream package/revision, stdout/stderr custody, and typed failure.
   Explain how to avoid locale, Python, ICU, or package drift.
6. Specify each execution lane: native source oracle, Tokenizer2 native Rust,
   raw WASM in Node, first fresh Chromium profile, and independent second fresh
   Chromium profile. State input identity, environment identity, no-network
   proof, output schema, resource measurements, and terminal status.
7. Design first-divergence reporting at stages: source parse, source-to-format
   conversion, pretoken split, byte mapping, added-token match, BPE pieces,
   token ID mapping, postprocessing, decode token lookup, byte reconstruction,
   and UTF-8 assembly. Explain how debug traces can be enabled in a separately
   preregistered diagnostic run without altering the failed evidence.
8. Define metamorphic relations that should hold and relations that should not
   be assumed. Include concatenation, inserted spaces, Unicode normalization,
   case changes, special-token insertion, encode-decode-encode, and decode with
   omitted specials.
9. Design artifact mutation tests independent of parity cases: truncation,
   offset overlap, duplicate IDs, invalid merge ranks, invalid UTF-8, huge
   counts, nonzero reserved bytes, wrong profile, unknown flags, and hash
   mismatch. State expected rejection stage, not exact prose.
10. Specify deterministic reducer procedures for long Unicode or merge failures
    while preserving the original. Reduced cases become general regression
    candidates only after review; private evaluation prompts must never enter
    training data.
11. Define statistical and coverage reporting appropriate to deterministic
    parity: category counts, unique byte patterns, vocabulary/merge coverage,
    added-token coverage, maximum lengths, branch coverage if locally
    available, failures by first stage, and explicit untested domains. Do not
    turn coverage percentages into a semantic-quality claim.
12. Provide preregistration, observation, and verification schemas plus an
    acceptance matrix. Explain exactly which changes invalidate corpus,
    conversion, native execution, WASM execution, Chromium execution, or only
    final verification.

Required report structure:

1. Executive test recommendation and assumptions.
2. Independence and oracle trust analysis.
3. Complete deterministic corpus taxonomy.
4. Seeded generator and case-identity design.
5. Source-oracle evidence schema.
6. Native, Node-WASM, and two-profile Chromium execution protocol.
7. First-divergence instrumentation and failure reduction.
8. Metamorphic, mutation, and fuzz matrices.
9. Coverage and residual-risk reporting.
10. Preregistration, observation, and verifier schemas.
11. Invalidation and acceptance matrix.
12. Unknowns requiring local artifacts or execution.
13. Annotated primary-source bibliography with dates.

Do not recommend comparing only final decoded strings, sharing one tokenizer
implementation across all alleged oracles, tolerance for token-ID differences,
choosing seeds after results, overwriting a failed run, using network resources
during the registered execution, treating Node as Chromium, or calling a small
fixture full-tokenizer proof.

## Prompt 7: Qwen3 Template2 And Prompt2 Compilation At Exact Token Boundaries

You are an independent principal model-serving semantics engineer, prompt
serialization specialist, and language-model interoperability auditor. Produce
an exceptionally detailed report for compiling a pinned Qwen3 publisher chat
template into bounded Template2 and Prompt2 artifacts and proving exact token
boundary behavior. You have no TinyRustLM source, private template, model,
conversation cases, or runtime output. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch browser-local chat product with no legacy prompt
  dialect or compatibility obligation. Template2 and Prompt2 are exact
  technical artifact identities.
- The product will execute a compact dense Qwen3-family model converted into a
  complete six-artifact composition: SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2. None is valid alone as a complete model composition.
- Publisher chat behavior may be expressed in Jinja and configuration files,
  but the browser runtime must not ship a general Jinja interpreter, arbitrary
  template code, Python, JavaScript generation logic, or remote template lookup.
- The compiler may accept only a pinned, audited source shape and lower it into
  a bounded, declarative, non-Turing-complete instruction stream. Unsupported
  branches must reject conversion rather than be approximated.
- System, user, assistant, and where genuinely supported tool-related roles;
  generation markers; thinking/nonthinking behavior; special tokens; stop
  conditions; empty content; and multi-turn order can affect exact model input.
- Current user instructions supersede stale remembered preferences. Retrieved
  or quoted memory is untrusted data, not executable authority. MemoryEndpoints
  itself is unauthorized and disconnected for current implementation work.
- Exact token IDs at the template/tokenizer boundary are required. Helpful
  semantics cannot be established by matching one expected phrase.

Research official Qwen3 model cards, configuration and template files at
immutable revisions, Qwen generation guidance, Hugging Face chat-template and
tokenizer documentation/source, Jinja semantics actually used, tokenizer
special-token behavior, model generation configuration, and prompt-injection
research. Record source publication/update dates and retrieval date. Distinguish
publisher guarantees from examples and framework defaults.

Address all of the following in depth:

1. Establish authority precedence among model card, `tokenizer_config.json`,
   `tokenizer.json`, special-token map, generation config, config, source
   framework code, and publisher examples. Define how conflicts or silent
   upstream changes block conversion.
2. Reconstruct the exact supported Qwen3 chat serialization for each role and
   turn order. Cover optional system text, multiple system messages, empty
   content, consecutive same roles, assistant history, generation prompt,
   tool declarations or calls if supported, and malformed role sequences.
3. Analyze thinking controls. Identify whether they are template parameters,
   textual control tokens, special IDs, generation behavior, or model-card
   convention. Specify fail-closed behavior when local product policy cannot
   express publisher semantics exactly.
4. Define a minimal Template2 instruction set: literal spans, validated role
   dispatch, bounded loops over messages, conditionals over explicit flags,
   content insertion, special-token emission, and generation marker. State
   forbidden capabilities, instruction and nesting limits, and termination
   proof.
5. Define Prompt2 as product-owned bounded system behavior separate from the
   publisher template. Specify identity, text encoding, size, authority order,
   lawful-adult helpfulness, narrow harm/security boundaries, current-turn
   precedence, calculator delegation, and treatment of retrieved text as data.
   Explain which aspects are behavioral policy versus exact model serialization.
6. Specify compilation from one pinned publisher template to Template2. Include
   AST parsing, exact accepted-node allowlist, whitespace controls, escaping,
   undefined variables, filters, macros, loops, conditionals, source spans,
   canonical output, proof of complete branch coverage, and rejection of any
   unknown construct.
7. Define runtime rendering into UTF-8 and then Tokenizer2. Cover byte ownership,
   special-token insertion without accidental textual retokenization, duplicate
   beginning/end tokens, prompt length limits, truncation policy, context
   reservation for output, and stop-token identity.
8. Design exact source-framework differential cases: single and multi-turn,
   all roles, empty strings, whitespace, special-token-looking user text,
   Unicode, thinking modes, generation marker toggles, malformed sequences,
   and maximum supported lengths. Compare rendered bytes and final token IDs.
9. Analyze prompt injection and authority boundaries. Give structural tests for
   quoted instructions, retrieved memory, stale profile preferences, tool text,
   and source conflict without depending on a particular fixture's nouns or
   expected answer wording.
10. Define Template2 and Prompt2 binary or canonical-record schemas with profile
    ID, source revision, source hash, instruction inventory, literal table,
    limits, special-token dependencies, Tokenizer2 dependency, and whole-file
    hash. Include strict parser and overflow checks.
11. Specify native/WASM/Chromium conformance, first-divergence traces, failure
    preservation, and invalidation when publisher source, compiler, Tokenizer2,
    Prompt2, or browser runtime changes.
12. Define acceptance and claim boundaries. Exact template parity proves input
    construction, not conversational quality. State the additional raw-output
    and human evaluation needed before calling a model useful.

Required report structure:

1. Executive recommendation and public-source observations.
2. Qwen3 template authority and conflict matrix.
3. Exact supported conversation serialization.
4. Template2 instruction set and safety proof.
5. Prompt2 authority and behavioral contract.
6. Strict source compiler and rejection rules.
7. Runtime byte/token boundary and context budgeting.
8. Differential corpus and first-divergence protocol.
9. Injection and authority-order test matrix.
10. Artifact schemas, identities, and invalidation rules.
11. Native/WASM/Chromium acceptance gates.
12. Unknowns requiring pinned-source or local execution.
13. Annotated primary-source bibliography with dates.

Do not recommend shipping Jinja to the browser, assembling prompts in two
competing implementations, treating user text that resembles a special token
as trusted control, silently dropping unsupported roles, guessing thinking
semantics, truncating without an explicit contract, preserving an old template
for compatibility, or treating exact serialization as model-quality proof.

## Prompt 8: Memory-Only HTTPS-To-Loopback Browser Client Under Current Browser Policy

You are an independent principal browser-security architect, applied
cryptography reviewer, and local-companion protocol engineer. Produce an
exceptionally detailed report for a public HTTPS page to connect safely to one
user-started native Companion on an ephemeral numeric loopback port using an
explicit one-time pairing ceremony and memory-only session capability. You
have no TinyRustLM source, private protocol contracts, listener, pairing code,
browser traces, or credentials. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is one canonical Companion
  protocol and no legacy endpoint, fixed-port fallback, port scan, custom URL
  scheme, extension dependency, or silent router/firewall change.
- A private per-user Companion is intended to bind only numeric IPv4
  `127.0.0.1` on an operating-system-selected ephemeral port using HTTP/1.1.
  It is not a public server and must expose no directory, arbitrary file, proxy,
  model, or operation route until separately implemented and registered.
- The Companion prints exactly one bounded human-transferable pairing code to
  an interactive terminal only after successful bind. Redirected or
  noninteractive output must fail before creating pairing state.
- The listener applies strict Host, Origin, CORS, preflight, method, route,
  content-type, content-length, header, timeout, connection, and body limits.
  Kestrel owns malformed HTTP framing errors; application responses must not
  masquerade as parser-owned failures.
- Pairing yields a memory-only browser session capability. Requests use exact
  canonical authentication, sequence discipline, one in-flight operation,
  bounded lifetime and key age, rotation, replay controls, status, and
  revocation. Capabilities, pairing code, and keys must not enter URLs, logs,
  durable browser storage, screenshots, traces, analytics, or reports.
- The browser page is served over public HTTPS. Current browser private-network
  access, mixed-content, secure-context, CORS, and loopback behavior must be
  verified from current primary documentation and real browsers; assumptions
  are not release proof.
- MemoryEndpoints is unauthorized and disconnected. Model transfer and model
  execution are later routes, not part of a pairing proof.

Research current specifications and official browser documentation for secure
contexts, potentially trustworthy loopback origins, mixed content, CORS,
Private Network Access or Local Network Access changes, Fetch, preflight cache,
HTTP network partitioning, localhost versus numeric loopback, DNS rebinding,
service workers, CSP `connect-src`, Referrer Policy, permissions prompts,
Chromium enterprise or user settings, Firefox, WebKit, and Kestrel HTTP/1.1.
Record dates, retrieval date, browser-version applicability, and unresolved
implementation changes. Prefer standards and browser vendor sources.

Address all of the following in depth:

1. Produce a current compatibility matrix for an HTTPS top-level page fetching
   `http://127.0.0.1:<ephemeral-port>` in Chromium, Firefox, and WebKit/Safari.
   Separate secure-context trust, mixed-content treatment, CORS, PNA/LNA
   preflights or permission prompts, CSP, user gestures, and enterprise policy.
2. Define the pairing-code information model without choosing an unsafe literal
   format. It must communicate protocol identity, numeric loopback port,
   one-time public or secret material as appropriate, checksum, expiry, and
   human transcription error detection while resisting credential leakage.
3. Design the browser pairing UX and state machine from disconnected through
   code entry, local syntax validation, one explicit connection attempt,
   preflight, cryptographic handshake, server identity confirmation, session
   ready, rotation, revocation, failure, and page close. No probing is allowed.
4. Specify browser-side key generation, entropy, import/export policy,
   canonical request construction, MAC/signature verification, constant-time
   comparison limitations in JavaScript/WebCrypto, sequence numbers, nonce
   rules, response authentication, and domain separation. State which details
   require the private registered protocol before implementation.
5. Define memory-only custody. Audit JavaScript variables, closures, DOM,
   framework state, URL/history, form values, autofill, password managers,
   clipboard, local/session storage, IndexedDB, Cache Storage, service workers,
   BroadcastChannel, crash reports, console, DevTools, screenshots, traces, and
   extensions. Be honest about erasure limits in a managed browser process.
6. Design exact CORS and preflight behavior. Separate base headers from
   simple/application responses; specify `Vary`, allowed origin, methods,
   headers, credentials mode, exposed response headers, max age, error paths,
   and why parser-owned HTTP failures should not carry application CORS headers.
7. Cover DNS rebinding, malicious local pages, malicious public origins,
   another local user, another process racing the port, browser extensions,
   CSRF, confused deputy, clickjacking, origin spoofing, replay, stale pairing
   codes, parallel tabs, and service-worker interception.
8. Define one-in-flight request ownership, timeout, cancellation, ambiguous
   lost response, idempotent recovery where contractually supported, rotation,
   exact old-commit replay windows, revocation, page unload, and prevention of
   stale responses after a new session.
9. Specify a strict JavaScript client boundary with no alternate transport.
   Include URL construction from validated numeric port, Fetch options, header
   allowlist, bounded body handling, typed safe errors, retry prohibition,
   AbortController semantics, and local status that does not overclaim.
10. Design real-browser tests using a real numeric-loopback server and raw
    network observation. Include supported and unsupported browser paths,
    wrong origin/host, malformed preflights, blocked local-network permission,
    two tabs, replay, rotation, revoke, browser restart, and secret scans.
11. Define release claim tiers: listener-tested, browser-policy-observed,
    pairing-proven, session-proven, operation-proven, transfer-proven. State the
    objective evidence and prohibited language for each.
12. Provide a decision tree for browser-policy blockage. Options may include
    explicit user permission or a standards-compliant secure local transport,
    but no option may silently broaden attack surface or be called implemented
    without proof.

Required report structure:

1. Executive recommendation and dated browser-policy findings.
2. Browser compatibility and standards matrix.
3. Pairing-code and explicit user-ceremony design.
4. Cryptographic browser-client state machine.
5. Memory-only secret threat model.
6. CORS, preflight, CSP, and HTTP behavior.
7. One-in-flight, timeout, rotation, and revocation handling.
8. Strict client API and pseudocode.
9. Real-browser conformance and attack matrix.
10. Claim taxonomy and blocker decision tree.
11. Unknowns requiring private contract or authorized execution.
12. Annotated primary-source bibliography with dates.

Do not recommend wildcard CORS, `localhost` DNS when numeric loopback is the
contract, fixed-port probing, scanning a port range, putting a capability in a
URL, persisting secrets by default, suppressing browser protections, accepting
an unauthenticated response, adding an extension as an undeclared dependency,
or calling listener unit tests browser connectivity proof.

## Prompt 9: Preregistered Two-Fresh-Profile Zero-Network Chromium Evidence

You are an independent principal browser-automation architect, experiment
integrity engineer, and privacy verification specialist. Produce an
exceptionally detailed report for one preregistered real-Chromium experiment
that executes deterministic Tokenizer2 WASM conformance in two independently
owned fresh persistent profiles with zero undeclared network traffic, then
deletes both profiles and independently verifies the evidence. You have no
access to TinyRustLM code, contracts, runner, profiles, browser binaries,
output, or local artifacts. Do not claim the experiment has run.

Facts supplied by the project for this assignment:

- TinyRustLM is a clean-slate prelaunch browser-local product. A page reload,
  incognito context, storage clear, or reused profile is not a fresh-profile
  restart.
- A production Tokenizer2 artifact, one import-free raw-WASM module, one strict
  JavaScript adapter, and a deterministic case corpus are intended inputs.
  Exact local identities are private facts and must be supplied by a frozen
  registration before execution.
- The experiment may execute only after an output-free registration and a
  verification registration are committed and independently retrievable. The
  runner gets one authoritative execution, not repeated attempts followed by
  selection of the best result.
- Profile roots and output roots are private, outside source control, uniquely
  owned, absent before creation, bounded beneath a validated campaign root, and
  never recursively deleted until containment and ownership are revalidated.
- Both profiles must launch real persistent Chromium processes, run the full
  fixed corpus and a real-work cancellation/recovery case, close all handles,
  delete the profile, and preserve deletion evidence. The second profile is not
  a retry selected to hide a first-profile failure; both are required lanes.
- All network is denied unless an exact preregistered local origin is needed to
  load the harness. Background browser traffic, telemetry, DNS, public assets,
  and hidden retries must be observed and treated according to the registration.
- Raw results are immutable, bounded, secret-scanned, and verified separately.
  Passing this experiment proves tokenizer browser parity, not model quality.
- MemoryEndpoints is unauthorized and disconnected.

Research current Playwright persistent-context behavior, Chromium command-line
flags, CDP Network and Target domains, service-worker and browser-process
traffic, browser caches and storage partitions, profile locking, process-tree
closure, Windows and Linux deletion semantics, browser version pinning, Web
Platform Tests infrastructure, and reproducible experiment design. Record
source dates and retrieval date. Identify flags that are testing conveniences
versus security guarantees.

Address all of the following in depth:

1. Define the registration schema binding campaign, repository commit,
   implementation files, generated assets, Tokenizer2, WASM module, browser
   executable and version, Playwright version, flags, corpus, resource limits,
   network policy, two profile roles, output root, runner, and verifier.
2. Explain how to keep registration output-free while fully determining the
   experiment. Define registration identity, committed seed or fixed cases,
   exact execution count, attempt identity, and prevention of easy-browser or
   easy-profile selection after observing results.
3. Design safe profile-root creation on Windows and Linux. Include canonical
   path resolution, parent ownership marker, random child names, absent-root
   requirement, symlink/reparse rejection, depth and drive checks, exclusive
   creation, permissions, and crash reconciliation.
4. Specify Chromium launch and identity evidence. Cover executable path and
   hash, browser version, Playwright browser revision, persistent user-data-dir,
   headless mode, sandbox status, locale, timezone, fonts, CPU architecture,
   flags, extensions, policies, and why a process launch is not yet a passing
   browser observation.
5. Design zero-network enforcement and observation. Compare request routing,
   Playwright events, CDP events, OS-level observation, a local allowlisted
   harness origin, `data:` or `file:` origins, service workers, DNS prefetch,
   speculative requests, browser updates, crash reporting, and false negatives.
6. Specify in-page execution: validate adapter and module identity, compile and
   instantiate raw WASM, load full Tokenizer2, execute each case once in stable
   order, record exact token IDs and decode hashes, measure bounded resources,
   and reject console errors, page errors, crashes, or undeclared messages.
7. Define a genuine cancellation case that starts real WASM work, terminates
   the owning worker before completion is accepted, creates a fresh worker,
   reloads exact bytes, and passes a separately fixed recovery case. Explain
   why sleeping or canceling before work starts is insufficient.
8. Specify profile closure and deletion. Enumerate pages, contexts, workers,
   browser process, child processes, file handles, lock files, retry bounds,
   ownership revalidation, deletion receipt, post-delete absence checks, and
   how locked or undeletable state becomes a preserved failure.
9. Define raw observation fields and size bounds: environment, input hashes,
   per-case outputs, timings, memory pages, cancellation events, network events,
   process closure, deletion, errors, and overall terminal classification. Do
   not store sensitive input text where hashes suffice.
10. Design an independent verifier that performs no browser execution. It must
    rehash registration and all inputs, validate exact two-profile inventory,
    compare outputs to preregistered expectations, check network and deletion
    evidence, reject duplicates or replacements, and emit an immutable decision.
11. Cover power loss, runner crash, browser crash, hung process, locked profile,
    stale output root, partial JSON, disk-full, clock change, browser update,
    module trap, test timeout, network event, and first/second-profile mismatch.
    Give the only legal resume or terminal action for each.
12. Define acceptance language and residual risk. Distinguish successful build,
    Node-WASM parity, one-profile Chromium parity, two-profile clean restart,
    browser tokenizer proof, model inference proof, and useful-chat proof.

Required report structure:

1. Executive experiment recommendation.
2. Output-free registration and identity schema.
3. Owned-profile filesystem safety protocol.
4. Chromium launch and environment identity.
5. Zero-network enforcement and observation design.
6. Full-corpus and cancellation/recovery procedure.
7. Raw observation schema and bounded evidence.
8. Process closure, deletion, crash, and resume algorithm.
9. Independent verifier algorithm.
10. Fault-injection and adversarial matrix.
11. Acceptance claims and residual risks.
12. Unknowns requiring local browser execution.
13. Annotated primary-source bibliography with dates.

Do not recommend a reusable browser context, `localStorage.clear()`, an
unobserved network assumption, selecting one passing profile, rerunning after a
semantic failure without preserving it, simulating cancellation, accepting a
locked undeleted profile, embedding outputs in preregistration, or calling
tokenizer parity useful model proof.

## Prompt 10: Deterministic App-Shell Generation And Public Asset Identity Closure

You are an independent principal frontend build engineer, reproducible-web
specialist, and release-manifest architect. Produce an exceptionally detailed
report for a deterministic application-shell pipeline in which one canonical
source tree generates exactly the public assets declared by a content-addressed
deployment manifest, with stale or hand-edited outputs detected before release.
You cannot inspect TinyRustLM source, public root, current hashes, tests,
deployment configuration, or live sites. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no public legacy UI or V2 to
  preserve. A clean incompatible replacement is preferred over compatibility
  code or duplicate generated paths.
- The public site is a browser-local chat application, not a download page for
  instruction text. A user selecting a model should receive a verified P2P
  composition when available or begin an explicit local conversion operation;
  model bytes and prompts must not be sent to the public web host.
- One canonical app-shell source generates a public-root shell and related
  assets. A current class of failures occurs when a test or deployment manifest
  expects an older generated asset hash after source or generation changes.
- The release manifest must expose only exact public assets. Source files,
  tests, private evidence, local paths, credentials, model bytes, generated
  conversion scripts, and unpublished prompts must not enter deployment.
- Every deployment needs a consistent visible version, release date, last
  publication time, and update log across the application and its documentation
  sites. Documentation freshness is part of release quality.
- Release output is generated into an owned clean root and independently
  scanned and read back. A build passing alone is not deployment proof.
- MemoryEndpoints is unauthorized and disconnected. Campaign counters are zero.

Research primary documentation and established practices for deterministic
frontend builds, content hashing, Subresource Integrity, web app manifests,
CSP, source maps, reproducible archives, static-site deployment, build
manifests, lockfiles, line-ending normalization, locale/time nondeterminism,
release metadata, atomic deployment, cache invalidation, and public HTTPS
readback. Record source dates and retrieval date.

Address all of the following in depth:

1. Define authority among source modules, templates, styles, static assets,
   package lock, build toolchain, environment, generated public root,
   deployment manifest, release log, and deployed readback. State which files
   may be checked in and which must be regenerated.
2. Design deterministic generation. Cover stable traversal, locale, timezone,
   timestamps, random IDs, absolute paths, source-map paths, line endings,
   Unicode, JSON serialization, CSS ordering, bundler chunk names, minifier
   versions, file modes, compression, and source-date epochs.
3. Define a clean generation transaction: validate source identity, create an
   absent owned output root, invoke one pinned toolchain, capture bounded logs,
   enumerate without following links, hash every file, compare to declared
   inventory, run semantic checks, and atomically promote one complete release.
4. Specify stale-output detection for checked-in or local generated assets.
   Include source-to-output dependency mapping, regenerate-and-diff checks,
   forbidden manual edits, missing output, extra output, old hash, duplicate
   generator, and source changed without manifest update.
5. Design the public deployment manifest schema. Include release identity,
   source commit, generator identity, file paths, MIME types, byte sizes,
   content hashes, cache policy, CSP/SRI relationships, entry point, build time
   policy, version, release date, changelog reference, and exclusions.
6. Define asset allow/deny policy for HTML, CSS, JS, WASM, icons, fonts, source
   maps, JSON, robots, sitemap, service worker, documentation, and release logs.
   Explain when WASM is a public runtime asset versus forbidden private model
   data.
7. Design browser and static semantic checks: one authoritative chat shell,
   no duplicate assistant rendering path, no instruction-text downloads,
   accessible controls, responsive nonoverlap, CSP, correct MIME, no source
   references escaping public root, and no stale service-worker cache.
8. Specify version and publication metadata consistency across application and
   documentation sites. Define a machine-readable release record and generated
   human update page without embedding the current clock into otherwise
   reproducible application bytes unnecessarily.
9. Design deployment as a create-only release plus atomic pointer or provider
   activation. Cover immutable asset names, cache-control, rollback,
   supersession, partial upload, concurrent publisher, CDN propagation, and why
   rollback history does not require runtime legacy behavior.
10. Specify independent public HTTPS readback: exact URL set, redirects, TLS,
    headers, MIME, bytes, hashes, CSP, caching, release metadata, stale assets,
    unexpected files, and repeated geographical checks where appropriate.
11. Provide tests for nondeterminism, stale hashes, omitted files, extra files,
    path case collisions, symlinks/reparse points, source maps with private
    paths, secret strings, model signatures, wrong MIME, service-worker drift,
    partial deployment, and documentation-version mismatch.
12. Define a clean-slate consolidation plan deleting alternate app shells,
    deprecated routes, duplicate manifests, compatibility build modes, and
    undocumented release scripts after the canonical path passes all gates.

Required report structure:

1. Executive pipeline recommendation.
2. Source/generated/deployed authority model.
3. Deterministic generation profile.
4. Clean output transaction and stale-output detection.
5. Public deployment-manifest schema.
6. Asset allow/deny and browser semantic policy.
7. Version, release-date, and update-log consistency design.
8. Atomic deployment, rollback, and cache strategy.
9. Public HTTPS readback verifier.
10. Test, mutation, and failure matrix.
11. Clean-slate consolidation and deletion plan.
12. Unknowns requiring local or provider access.
13. Annotated primary-source bibliography with dates.

Do not recommend checking in two competing generated shells, silently updating
expected hashes, adding compatibility routes, using build time or absolute path
as accidental content, deploying a broad directory instead of an allowlist,
publishing source or private evidence, calling upload completion public proof,
or letting documentation release metadata drift from the application.

## Prompt 11: Substitution-Resistant Web Release Scanning And Evidence Isolation

You are an independent principal application-security engineer, filesystem
forensics specialist, and release-gate designer. Produce an exceptionally
detailed report for scanning a static web release and its complete material
input closure for secrets, private evidence, model bytes, unsafe paths, archive
hazards, and substitution attacks. You have no TinyRustLM source, release root,
test output, secrets, artifacts, or deployment access. Do not claim a private
release is clean.

Facts supplied by the project for this assignment:

- TinyRustLM is a clean-slate prelaunch product. No historical compatibility
  asset, hidden backup, stale site, or deprecated route is allowed merely
  because it existed before.
- The public site may contain app HTML/CSS/JS, approved static assets, public
  documentation, and a bounded browser runtime WASM module. It must not contain
  prompts, model compositions, private model paths, source acquisition data,
  pairing codes, session capabilities, MemoryEndpoints credentials, signing
  keys, deployment tokens, private receipts, test traces, browser profiles, or
  generated instruction-download files.
- A release scan must cover the exact deployment output and every material
  source or generated input that can influence it. The scanner must reject an
  output directory inside the source tree when that permits source-contained
  evidence or self-scanning confusion, and must reject reused or replacement
  output roots.
- Public IDs, cryptographic hashes, byte sizes, versions, bounded status codes,
  and release timestamps may be acceptable. A hash-like value must not be
  automatically treated as either a secret or proof of safety.
- Windows and Linux filesystems matter. Symlinks, reparse points, junctions,
  hard links, alternate data streams, case folding, path traversal, archives,
  compressed content, UTF-8, UTF-16, and base64 can hide material.
- Scan success is one release gate, not proof that deployment or model quality
  succeeded. Raw secret findings must be protected rather than copied into a
  public report.
- MemoryEndpoints is unauthorized and disconnected.

Research primary sources and current official guidance for secret scanning,
OWASP build and deployment security, GitHub secret scanning patterns where
publicly documented, Unicode and encoding detection, ZIP/TAR traversal,
symlink/reparse and hard-link behavior on Windows/Linux, NTFS alternate data
streams, MIME sniffing, decompression bombs, SBOM/provenance, static-site CSP,
and malware-scanning boundaries. Record source dates and retrieval date.

Address all of the following in depth:

1. Define trust zones for repository source, dependency cache, generated
   staging, release output, private evidence, model store, browser profiles,
   scanner process, scan rules, scan findings, deployment package, and public
   host. State allowed direction of data flow.
2. Design owned-root validation for source and output. Cover canonical absolute
   paths, volume identity, containment, minimum depth, absent-root creation,
   owner marker, unique attempt, source/output disjointness, no ancestor or
   descendant overlap, and revalidation before scan or deletion.
3. Specify safe enumeration without following links. Address symlinks, reparse
   tags, junctions, mount points, hard-link counts and file IDs, ADS, sparse
   files, device files, FIFOs, sockets, case collisions, Unicode-normalized path
   collisions, maximum files, depth, individual size, and total bytes.
4. Define the exact public file allowlist and denylist by path, extension, MIME,
   magic bytes, and purpose. Explain how an approved `.wasm` runtime is
   distinguished from model bytes or an unapproved executable.
5. Design layered content detection for exact known-secret digests without
   storing secrets, token formats, entropy heuristics, private path patterns,
   invitation URLs, credentials in URLs, source maps, prompts, model signatures,
   browser profile markers, and private receipt schemas.
6. Cover encodings and transformations: UTF-8 with malformed sequences, UTF-16
   LE/BE, BOMs, ASCII, percent encoding, JSON escapes, HTML entities,
   JavaScript escapes, base64/base64url, data URLs, gzip/Brotli, ZIP/TAR, source
   maps, minified strings, and bounded recursive decoding. Define strict limits
   against decompression bombs.
7. Design a ruleset identity and finding model. Include rule version, category,
   severity, file identity, byte range or safe fingerprint, decoder chain,
   confidence, disposition, false-positive review, and redacted public result.
   Raw matching secret bytes must not enter ordinary logs.
8. Define substitution resistance between scan and deployment. Cover open-file
   handles, file IDs, streamed hash while scanning, immutable staging,
   post-scan mutation, TOCTOU, hard-link replacement, manifest sealing,
   exclusive publication, and deployment from the exact scanned bytes.
9. Specify material-input closure. Explain how lockfiles, build scripts,
   environment allowlists, generated assets, dependencies, source maps, release
   metadata, and scanner executable are bound without simply publishing or
   scanning the whole private repository as web content.
10. Design archive and package inspection, including entry path normalization,
    absolute paths, `..`, duplicate names, symlink entries, nested archives,
    compression ratios, file modes, executable content, and deterministic
    extraction into an owned quarantine root.
11. Provide tests and malicious fixtures for every path and encoding class,
    replaced output, reused output, source-contained output, hard links,
    reparse points, ADS, model-byte fragments, source-map paths, high-entropy
    false alarms, known public hashes, huge compressed content, and scanner
    crash or disk-full.
12. Define release decision and reporting. A scan may pass, reject, or be
    incomplete; incomplete cannot deploy. Specify public-safe evidence, private
    finding custody, remediation, rerun invalidation, independent readback scan,
    and explicit residual limitations such as browser extensions or provider
    malware scanning.

Required report structure:

1. Executive security recommendation.
2. Trust zones and release data-flow diagram.
3. Owned-root and safe-enumeration algorithm.
4. Public asset allow/deny profile.
5. Secret, path, model, and private-evidence detection layers.
6. Encoding, archive, and decompression policy.
7. Ruleset and redacted-finding schemas.
8. TOCTOU and substitution-resistant publication transaction.
9. Complete material-input closure.
10. Adversarial fixture and fault-injection matrix.
11. Decision states, remediation, and public-safe reporting.
12. Unknowns requiring local or deployment-provider access.
13. Annotated primary-source bibliography with dates.

Do not recommend printing a found secret, relying only on regex, following
links during enumeration, treating filename extension as content identity,
scanning one directory and deploying another, allowing source/output overlap,
unbounded recursive decoding, skipping an unreadable file, treating a public
hash as automatically secret, or calling a scan pass successful deployment.

## Prompt 12: Root-Cause DAG For Fifteen Release Failures And A No-Debt Closure Plan

You are an independent principal release-test architect, failure-analysis lead,
and clean-slate systems engineer. Produce an exceptionally detailed report that
turns a set of fifteen current deterministic release-test failures into a
root-cause dependency DAG and an ordered, non-weakening closure plan. You have
no access to TinyRustLM source, tests, diffs, logs, artifacts, or machines. The
failure names and one observed identity mismatch below are facts supplied by
the project, not public observations. Do not claim to know their private causes.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. There is no launched V1/V2 split, legacy
  support, migration burden, compatibility layer, or acceptable code debt.
  SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema versions,
  semantic versions, and branch names are technical identities.
- One full serial standard Node inventory ran once after a committed Companion
  listener milestone. It executed 1,198 tests: 1,182 passed, 15 failed, 1 was
  skipped, and none were canceled or selected for retry. The raw log is
  preserved privately. No deployment occurred.
- The failing test names, abbreviated only where indicated, are:
  1. `native build scripts copy from the Cargo target they invoke`;
  2. `binds exact pre-cutover authority and immutable inputs`;
  3. `execution and verification preregistrations bind every implementation input`;
  4. `committed corpus deterministic/output-free/unique/artifact-bound`;
  5. `builds import-free bounded WASM module without executable unsafe Rust`;
  6. `loopback release server exposes only exact manifest public artifacts`;
  7. `canonical app shell deterministically generates public root shell`;
  8. `binds Phase 2 threat review to every material validator input`;
  9. `web deployment manifest exact no-model publication closure`;
  10. `web deployment manifest fails closed...`;
  11. `browser smoke blocks undeclared traffic...`;
  12. `browser smoke rejects reused output directory...`;
  13. `local web release smoke...`;
  14. `complete web release input bounded secret scan`;
  15. `web release scan refuses replacement/source-contained evidence`.
- Several failures appear to cascade from an app-shell identity mismatch. The
  observed current app asset SHA-256 begins `a6949508...`; an authority still
  expected a SHA-256 beginning `b408af8d...`. This observation does not prove
  which byte set is correct.
- Tests, validators, registrations, threat reviews, source locks, generated
  assets, release manifests, runners, and verifiers form a dependency graph.
  A stale authority must be corrected by identifying the intended source and
  regenerating or preregistering honestly, not by blindly replacing an expected
  hash with the value that happened to appear.
- Failed evidence is immutable. Tests may be corrected when they encode an
  invalid requirement, but the failed observation must remain and the change
  needs a general regression. Product code, tests, or gates must not be weakened
  to obtain green output.
- Deployment requires the complete applicable release suite to pass, followed
  by exact publication and HTTPS readback. Unit tests alone cannot authorize it.
- Campaign counters remain 0/20 models, 0/50 browser rounds, 0/25 live-memory
  rounds, 0/40 externally proven P2P lanes, and 0/20 announcements.
  MemoryEndpoints is unauthorized and disconnected.

Research primary sources and advanced practice for causal failure analysis,
test dependency graphs, hermetic testing, build graphs, reproducible generated
artifacts, preregistration, mutation testing, change-impact analysis, flaky-test
classification, supply-chain attestations, release gates, and incident learning.
Record source dates and retrieval date. The report must use the supplied facts
without pretending to diagnose unseen code.

Address all of the following in depth:

1. Define a failure-analysis ontology separating primary defect, stale
   authority, invalid test requirement, expected cascade, independent defect,
   environmental failure, nondeterminism, missing evidence, and external
   blocker. State the evidence required before assigning a category.
2. Build a hypothesized dependency DAG for the fifteen named failures. Include
   Cargo artifact custody, pre-cutover source locks, Tokenizer2 registrations,
   corpus generation, WASM source/module, validator registry, Phase 2 threat
   review, app-shell source/generator/output, deployment manifest, release
   server, browser smoke, output-root ownership, secret scan, and deployment.
   Mark every edge as a hypothesis requiring local confirmation.
3. Explain how to identify authority for the app-shell mismatch. Define the
   decision procedure among canonical source, generator, generated public file,
   checked-in hash, deployment manifest, tests, and deployed readback. Show why
   either hash could be stale and why updating the assertion first is unsafe.
4. Design a root-first triage algorithm that minimizes repeated full-suite runs
   without using selective retry as evidence. Distinguish focused TDD during a
   fix from the final one authoritative complete inventory required for release.
5. Specify failure preservation: raw log identity, failing test identity,
   environment, source commit, minimal reproducer, generalized regression,
   remediation commit, invalidation set, and relationship between old and new
   evidence. No old receipt is overwritten.
6. Define criteria for correcting a test versus correcting product code or
   generated authority. Include standards evidence, contradiction with frozen
   contracts, impossible parser ownership, accidentally platform-specific
   assumptions, and overconstrained byte syntax. Require review against weaker
   coverage and counterexamples.
7. Design exact remediation paths for each likely root domain: Cargo output
   discovery, registration input closure, deterministic corpus, unsafe-free
   WASM build, app-shell regeneration, validator/threat-review bindings,
   deployment manifest, network deny policy, unique output roots, local release
   server, and secret-scan source/output separation.
8. Specify contract-change discipline. A material semantic change requires one
   new output-free incompatible registration, immutable prior registration,
   explicit descendant invalidation, regenerated expected identities, and no
   parser alias or compatibility branch.
9. Define completion gates per layer: source/build graph green, Tokenizer2
   focused suites green, generated shell reproducible, deployment manifest
   closed, browser smoke zero undeclared traffic, scan complete, full standard
   Node inventory green, managed/Rust suites green, release build warning-free,
   clean worktree, remote-exact commit, deployment, and HTTPS readback.
10. Build an operator dashboard that reports current root causes, cascaded
    failures, independent failures, fixed but not fully rerun, complete-suite
    status, deployment authorization, last checked-in commit, last published
    version/date, blockers, and counters without ever displaying `done` early.
11. Provide a clean-slate deletion review after green replacement. Identify
    duplicate generators, obsolete contracts, compatibility aliases, alternate
    manifests, dead routes, stale docs, and old runtime branches. Immutable
    evidence remains archived, but no obsolete runtime path remains executable.
12. Give a prioritized implementation plan optimized for learning and release
    safety. Include checkpoints after every major compiling change, push/fresh
    fetch verification, documentation/UAI updates, full-suite cadence, and the
    exact point where deployment becomes permissible.

Required report structure:

1. Executive failure-closure recommendation.
2. Failure ontology and evidence requirements.
3. Hypothesized fifteen-failure dependency DAG.
4. App-shell identity authority decision procedure.
5. Root-first triage and test-execution policy.
6. Failure preservation and generalized-regression workflow.
7. Remediation matrix for every named failure.
8. Contract replacement and selective invalidation rules.
9. Layered build, test, release, and deployment gates.
10. Operator dashboard specification.
11. Clean-slate deletion and debt-prevention review.
12. Prioritized checkpoint, commit, publish, and readback plan.
13. Unknowns requiring private source or execution evidence.
14. Annotated primary-source bibliography with dates.

Do not claim to know the unseen root causes, change an expected hash merely to
match current bytes, delete failed evidence, skip a failing test, use selective
retry as release evidence, weaken network or scan gates, preserve obsolete
runtime paths for compatibility, deploy with any applicable deterministic gate
failing, or increment campaign counters from unit tests.

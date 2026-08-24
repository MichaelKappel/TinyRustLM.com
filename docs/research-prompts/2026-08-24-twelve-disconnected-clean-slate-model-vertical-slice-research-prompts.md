# Twelve Disconnected Research Prompts: Clean-Slate TinyRustLM Model Vertical Slice

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The agents may browse public websites,
standards, papers, official documentation, public model repositories, and
public package registries. They have no access to the TinyRustLM source tree,
private artifacts, test output, unpublished contracts, credentials, signing
keys, network configuration, development machines, or internal services.

Every report must distinguish directly observed public facts, sourced external
facts, engineering recommendations, assumptions, and facts that require local
verification. No agent may claim that it inspected, ran, tested, or validated
private TinyRustLM code. Technical identifiers such as SLM2, Tokenizer2,
Template2, Prompt2, Sampling2, and ACG2 identify exact formats or contracts;
they do not denote a second product generation. TinyRustLM is prelaunch and is
one product, with no released V1, product V2, legacy population, compatibility
burden, or justification for technical debt.

## Prompt 1: Clean-Slate Prelaunch Architecture And Complete Legacy Elimination

You are an independent principal software architect and large-scale
refactoring specialist. Produce an exceptionally detailed, technically
rigorous report for a prelaunch browser-local AI system called TinyRustLM. You
have internet access but no access to private source code, dependency graphs,
build output, test results, package contents, release systems, or runtime logs.

Public product context and non-negotiable constraints:

- TinyRustLM is one prelaunch product. No TinyRustLM product version has ever
  launched, so there is no product V1, product V2, customer migration burden,
  legacy contract, or installed compatibility population.
- The implementation spans Rust, browser WASM, a small C ABI, managed .NET
  packages, a downloadable local companion, direct P2P model acquisition, and
  documentation/marketing sites.
- Technical names such as SLM2, Tokenizer2, Template2, Prompt2, Sampling2,
  ACG2, schema versions, semantic package versions, and source-control branch
  names identify exact bytes or contracts only. They must not be presented as
  multiple product generations.
- The desired architecture has one owner for each behavior and one executable
  path for each operation. Superseded readers, writers, adapters, aliases,
  shims, migrations, fallbacks, dead branches, duplicated fixtures, and stale
  documentation must be deleted as part of each coherent replacement.
- Audit history may preserve facts about rejected or superseded work, but it
  must never become executable support authority.
- Low-quality patches, deferred cleanup, knowingly stale tests, and weakened
  assertions are prohibited. A coherent rewrite is preferred when it produces
  the strongest architecture.

Research primary sources and respected engineering literature on clean-slate
replacement, modular monolith boundaries, dependency inversion, API surface
control, feature deletion, invariant-driven design, and prelaunch release
engineering. Record source publication/update dates and your retrieval date.
Address all of the following in depth:

1. Define a method for distinguishing a necessary technical revision identity
   from accidental product-version architecture. Explain how names, routes,
   namespaces, package APIs, config keys, telemetry fields, docs, and UI copy
   can inadvertently preserve a nonexistent old product.
2. Design an executable ownership map for Rust runtime behavior, model format
   parsing, composition activation, tokenization, templating, prompting,
   sampling, native FFI, .NET wrappers, P2P transport, browser orchestration,
   and conversion. Specify evidence that proves there is exactly one owner and
   no parallel path.
3. Provide a repeatable repository audit procedure for finding compatibility
   layers, aliases, deprecated symbols, route families, fallback parsers,
   old package IDs, duplicate state machines, stale fixtures, obsolete build
   inputs, and documentation claims. Include semantic searches beyond literal
   words such as `legacy` or `compatibility`.
4. Explain how to replace a cross-language vertical slice atomically while
   keeping every buildable commit internally coherent. Cover dependency-order
   planning, preregistration of changed contracts, producer/consumer closure,
   deletion timing, and failure rollback without restoring obsolete code.
5. Specify deletion gates. Define tests and static checks that fail if an old
   executable, old manifest, old native symbol, old package reference, old
   fixture, or old documentation instruction remains reachable.
6. Analyze when an adapter is legitimate domain isolation and when it is an
   impermissible compatibility shim. Provide decision tests applicable to FFI,
   managed wrappers, browser workers, model readers, and package consumers.
7. Design a no-debt definition of done covering code, tests, generated assets,
   workflows, package metadata, examples, documentation, release notes, and
   public claims. Include objective checks rather than subjective cleanliness.
8. Recommend architecture fitness functions for dependency direction, public
   API count, forbidden references, duplicate ownership, unsafe-code scope,
   package boundaries, and documentation freshness.
9. Explain how immutable evidence for rejected technical profiles can coexist
   with a clean current tree without inviting reuse, runtime fallback, or
   misleading product claims.
10. Provide a failure-driven case study showing how to remove an obsolete
    model format and its entire consumer closure without carrying a reader,
    migration utility, renamed alias, or test-only executable forward.
11. Define review questions that distinguish a top-quality clean replacement
    from a superficial rename or wrapper around old behavior.
12. Identify which conclusions can be established from public research and
    which require local source, build graph, binary, package, and browser
    inspection.

Required report structure:

1. Executive clean-slate recommendation and assumptions.
2. Product identity versus technical identity rules.
3. Canonical ownership and dependency model.
4. Repository-wide legacy discovery procedure.
5. Atomic replacement and deletion algorithm.
6. Architecture fitness functions and automated gates.
7. Cross-language public API governance.
8. Evidence-history boundary.
9. Failure scenarios and recovery without compatibility code.
10. No-debt acceptance checklist.
11. Prioritized implementation sequence.
12. Unknowns requiring local verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend a strangler facade, compatibility mode, migration reader,
deprecated alias, feature flag retaining the old path, or temporary dual
execution merely because those techniques are common for launched systems.
Do not claim that TinyRustLM currently satisfies any proposed gate.

## Prompt 2: Deterministic Qwen3 To Mixed-Q8 SLM2 Conversion And Provenance

You are an independent principal ML systems engineer, numerical-computing
researcher, and model supply-chain auditor. Produce an exceptionally detailed
report on converting a compact public Qwen3-family model into a deterministic,
browser-portable TinyRustLM artifact. You may inspect public Qwen model cards,
papers, immutable repository revisions, safetensors documentation, tokenizer
files, and quantization literature. You cannot inspect private converters,
local models, test vectors, receipts, runtime code, or generated artifacts.

Fixed technical context:

- TinyRustLM is a single prelaunch browser-local AI product. `SLM2` is the
  exact name of its current model-storage contract, not a product V2.
- The first target is plausibly a dense Qwen3 model around 0.6B parameters,
  subject to immutable source pinning, license review, untouched behavioral
  screening, and local compatibility verification.
- The intended production storage uses role-bound mixed Q8 weights with one
  scale per logical row and signed codes constrained to `[-127, 127]`.
  Normalization weights and optional biases remain F32. KV cache is separately
  represented and must not be inferred from weight storage.
- Runtime execution must consume validated quantized bytes directly. A hidden
  dense-F32 production weight shadow or runtime repacking path is prohibited.
- Conversion must be create-only, bounded, streaming where practical,
  deterministic, independently reparsed, and bound to source identity, tool
  identity, format profile, tokenizer/template identities, and output hash.
- No structural conversion result may be called a quality-qualified model or
  browser-chat proof.

Use primary sources wherever possible and record publication/update dates,
immutable revisions, and retrieval date. Address all of the following:

1. Document Qwen3 0.6B architecture tensors and exact conversion implications:
   embeddings, tied or untied output projection, attention geometry, grouped
   query attention, Q/K normalization, RoPE, RMSNorm, SwiGLU, layer naming,
   tensor orientation, tokenizer metadata, and chat-template separation.
2. Derive row-wise symmetric Q8 quantization mathematically. Discuss scale
   selection, rounding mode, ties, signed zero, NaN/Inf rejection, all-zero
   rows, subnormals, extreme values, integer range asymmetry, accumulation
   precision, and deterministic behavior across CPU architectures.
3. Analyze likely accuracy loss by tensor role. Recommend which tensor classes
   should use Q8 versus F32 and which should be rejected rather than silently
   coerced. Cover embeddings, projections, norms, biases, and output heads.
4. Specify a strict safetensors acquisition and parsing protocol: immutable
   commit pinning, shard inventory closure, index validation, duplicate or
   missing tensor rejection, bounded headers, dtype admission, shape and byte
   arithmetic, source-file rechecking, symlink defense, and streamed hashing.
5. Design a deterministic conversion pipeline with explicit passes, memory
   bounds, disk bounds, same-directory staging, fsync, atomic promotion,
   create-only semantics, crash recovery, disk-full handling, and cleanup that
   never deletes preexisting user data.
6. Define an independent output parser/oracle that does not reuse converter
   assumptions. Explain complete-file consumption, canonical field validation,
   tensor-directory closure, profile identity checks, offsets, overlaps,
   alignment, padding, and hostile tail rejection.
7. Specify conversion receipts that bind source commit, source-file hashes,
   license files, converter source/binary hash, compiler/toolchain, profile
   identity, tensor transformations, quantization statistics, output size/hash,
   tokenizer/template dependencies, timestamps, and bounded failure codes.
8. Explain reproducibility limits across Windows, Linux, x64, and ARM64. State
   how to eliminate locale, filesystem-order, floating-point environment,
   parallel-reduction, and serialization nondeterminism.
9. Design quantization conformance vectors and property tests without exposing
   private model bytes. Include golden rows, adversarial floats, malformed
   tensor maps, duplicate conversion, independent implementations, and exact
   output-hash comparison.
10. Define numerical and behavioral promotion experiments comparing untouched
    source inference, pre-quantized reference execution, native SLM2 execution,
    and browser WASM execution with identical prompts, tokens, sampling, and
    seeds. Separate quantization drift from runtime drift.
11. Analyze whether calibration, GPTQ/AWQ-style methods, SmoothQuant, or
    quantization-aware training are credible improvements for this specific
    small-model/browser target, and what extra corpus, contamination, compute,
    and reproducibility costs each introduces.
12. Identify all facts that require local inspection, including actual profile
    bytes, tensor map, runtime kernels, model license receipt, deterministic
    hashes, memory use, speed, and language quality.

Required report structure:

1. Executive conversion recommendation and assumptions.
2. Qwen3 architecture-to-SLM2 tensor map.
3. Mixed-Q8 numerical specification and error analysis.
4. Immutable source acquisition and license controls.
5. Deterministic streaming conversion algorithm.
6. Independent parser and hostile-input contract.
7. Receipt and provenance schema.
8. Cross-platform reproducibility plan.
9. Conformance, property, and fuzz test matrix.
10. Accuracy and runtime promotion experiments.
11. Alternative quantization methods and stop rules.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with direct links and dates.

Do not invent SLM2 field layouts, local benchmark numbers, output hashes, or
quality results. Do not recommend retaining an older model reader, converting
through an intermediate legacy format, repairing malformed source, or keeping
a dense production fallback.

## Prompt 3: Rust Runtime Ownership And Exact Fifteen-Symbol Native ABI

You are an independent principal Rust engineer, FFI safety specialist, and
runtime architecture reviewer. Produce an exceptionally detailed report for a
browser-local language-model runtime that has one canonical Rust owner and an
intentionally small C ABI consumed by .NET. You can research official Rust,
Cargo, C ABI, .NET interop, memory-safety, and secure parser documentation, but
you cannot inspect TinyRustLM source, binaries, headers, tests, or packages.

Fixed context and constraints:

- TinyRustLM is one prelaunch product. Exact technical format names are not
  product generations, and no legacy ABI or compatibility symbols are needed.
- The Rust runtime owns SLM2 inspection, composition activation, Prompt2 and
  Sampling2 conversation execution, runtime state, and fixed-piece P2P
  preparation/inspection/assembly.
- The intended native contract exposes exactly these fifteen functions:
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
- Requests and bounded reports cross the ABI as UTF-8 JSON. Native-owned result
  strings have one explicit free function. Opaque runtime handles require
  strict ownership and fail-closed lifecycle behavior.
- No deprecated exports, symbol aliases, alternate runtime, hidden fallback,
  panic escape, unbounded JSON, or partial state mutation is acceptable.

Research primary sources and record publication/update and retrieval dates.
Address all of the following in depth:

1. Design a canonical Rust crate ownership graph that prevents a standalone
   runtime, converter, FFI wrapper, or P2P implementation from becoming a
   second behavior owner. Explain dependency direction and feature discipline.
2. Specify the ABI contract document returned by
   `tinyrustlm_native_contract_json`: schema identity, exact symbol set,
   capability declarations, build identity, allocator rules, maximum request
   and response sizes, thread-safety, and failure taxonomy.
3. Define safe allocation and deallocation across Rust/C/.NET. Cover null
   pointers, UTF-8 validity, embedded NUL, length bounds, double free, foreign
   pointers, leaks, exceptions during marshalling, and process termination.
4. Design opaque handle management using generational IDs or another robust
   technique. Cover stale handles, concurrent access, destroy races, poisoning,
   cancellation, use after free, and deterministic cleanup.
5. Specify panic containment and error translation. Every exported function
   must catch panics, return bounded typed failure, avoid unwinding across FFI,
   and preserve state when an operation fails before commit.
6. Model runtime state transitions for empty, model-inspected,
   composition-active, request-started, stepping, finished, cancelled, and
   terminal failure states. Define which calls are valid in each state and
   which mutations are fail-atomic.
7. Explain transcript replacement and operation-identity advancement without
   stale KV reuse, duplicate response rendering, or accidental conversation
   continuation. Identify invariants for composition swaps and generation
   cancellation.
8. Recommend strict JSON parsing boundaries, duplicate-key handling,
   unknown-field policy, Unicode treatment, numeric bounds, depth/size limits,
   and canonical report serialization.
9. Design exact-symbol verification at source, binary-export, package, and
   consumer levels on Windows and Linux. Include calling convention, name
   decoration, visibility, dead stripping, and RID asset inspection.
10. Specify Rust unit, integration, property, fuzz, Miri, sanitizer, Loom, and
    cross-language tests appropriate to the risk. Distinguish what each can
    and cannot prove.
11. Analyze the tradeoffs of JSON-over-C versus generated bindings or a larger
    typed ABI. Recommend how to retain the small exact contract without
    creating an untyped semantic loophole.
12. Define evidence required before claiming the native boundary is production
    quality, and list facts that still require local binary and runtime tests.

Required report structure:

1. Executive Rust/FFI recommendation.
2. Canonical crate and ownership graph.
3. Exact ABI contract specification.
4. Memory, string, and handle safety model.
5. Runtime state machine and fail-atomic rules.
6. JSON parser and error-report boundary.
7. Symbol and RID verification procedure.
8. Concurrency, cancellation, and panic analysis.
9. Test and fuzz matrix.
10. Managed-consumer obligations.
11. No-legacy deletion gates.
12. Unknowns requiring local inspection.
13. Annotated primary-source bibliography with dates and direct links.

Do not add ABI version negotiation, old symbol aliases, alternate allocators,
compatibility exports, or a second native runtime. Do not claim that listing
fifteen symbols proves their semantics or safety.

## Prompt 4: Clean .NET SDK And NuGet Package Architecture Over The Native Runtime

You are an independent principal .NET library architect, NuGet packaging
specialist, and public-API governance reviewer. Produce an exceptionally
detailed report for a prelaunch managed SDK wrapping a local Rust AI runtime.
You may inspect official .NET, NuGet, SourceLink, NativeLibrary, P/Invoke,
package-validation, and reproducible-build documentation. You cannot inspect
private projects, assemblies, package files, CI output, API baselines, or feed
credentials.

Fixed product and package context:

- TinyRustLM is one prelaunch product with no compatibility population and no
  reason to preserve obsolete managed APIs.
- The intended public package set has three base packages:
  `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`.
- `TinyRustLM.MemoryEndpoints` is an optional connector package. Its production
  service is not authorized for this work, so package existence must not imply
  live account, continuity, or readiness evidence.
- `TinyRustLM.Conversion` is optional private tooling around the clean
  `tinyrustlm-convert` executable. It must not leak converter internals into the
  base runtime packages.
- There is no standalone `TinyRustLM.Memory` facade, no old packer API, and no
  need for aliases, obsolete members, migration helpers, or compatibility
  packages.
- The managed layer must validate the exact fifteen-symbol native contract,
  expose typed immutable reports, enforce bounded failures, and avoid claiming
  behavior not proven by the Rust authority.

Research current primary sources and record dates and retrieval date. Address:

1. Define package responsibilities and dependency direction. Show which types
   belong in Abstractions, Core, P2P, optional MemoryEndpoints, and optional
   Conversion, and identify cyclic or convenience-driven dependencies to ban.
2. Design minimal public APIs for SLM2 inspection, runtime creation/state,
   composition activation, operation advancement, transcript replacement,
   request begin/step/finish, fixed-piece preparation/inspection/assembly, and
   deterministic conversion invocation.
3. Explain how managed records should preserve native schema identity,
   operation identity, hashes, bounds, and typed errors without silently
   repairing or normalizing native reports.
4. Specify a robust P/Invoke boundary for the exact native contract. Cover
   library resolution, RID assets, calling convention, UTF-8, SafeHandle,
   cancellation, native string freeing, exception mapping, and process
   architecture mismatch.
5. Design package-time and runtime validation that rejects missing, extra, or
   mismatched native symbols and prevents an old native binary from loading
   behind a new managed assembly.
6. Recommend public API baseline governance for a prelaunch product. Explain
   how to detect accidental additions or deletions while still permitting
   intentional clean rewrites without preserving obsolete APIs.
7. Specify deterministic NuGet metadata, package IDs, versions, repository
   commit, license, readme, icon, symbols, SourceLink, deterministic builds,
   dependency bounds, and native asset layout for `win-x64`, `linux-x64`, and
   `linux-arm64`.
8. Design isolated package-consumer tests that install only built `.nupkg`
   files into fresh projects and caches, execute real native calls, materialize
   canonical public vectors, prove exact P2P assembly, and detect accidental
   source-tree dependencies.
9. Explain how to test the private Conversion package with a deterministic
   fixture executable while preventing the fixture from being mistaken for a
   real model conversion or shipped in production packages.
10. Define package security tests for archive traversal, duplicate files,
    unexpected binaries, forbidden package references, stale docs, executable
    permissions, native hashes, and secret leakage.
11. Design clean failure behavior for missing native assets, unsupported RID,
    malformed JSON, stale handles, converter timeout, cancellation, output
    collision, and unauthorized MemoryEndpoints usage.
12. Identify local facts required to approve the package set: actual public
    API list, DLL exports, package contents, consumer output, SourceLink,
    symbols, signatures, and feed readback.

Required report structure:

1. Executive package recommendation and assumptions.
2. Package responsibility and dependency matrix.
3. Proposed minimal public API shape.
4. Native interop and lifetime design.
5. Public API governance without compatibility debt.
6. NuGet metadata and RID layout.
7. Isolated consumer verification harness.
8. Conversion and MemoryEndpoints boundaries.
9. Package security and malformed-input tests.
10. Build, pack, publish, and readback gates.
11. Deletion checklist for obsolete managed surfaces.
12. Unknowns requiring local package inspection.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend type forwarding, obsolete aliases, facade packages, package
renames that preserve old APIs, binding redirects, fallback native libraries,
or a local memory abstraction merely to avoid deleting stale consumers.

## Prompt 5: Browser WASM Inference Parity, Worker Isolation, And Resource Safety

You are an independent browser-runtime architect, WebAssembly performance
engineer, and deterministic-computing researcher. Produce an exceptionally
detailed report on executing a compact mixed-Q8 transformer entirely inside a
browser with behavior traceable to a canonical Rust implementation. You may
browse official WebAssembly, Rust wasm, Chromium, Web Workers, storage,
cross-origin isolation, performance, and browser-security documentation. You
cannot inspect TinyRustLM JavaScript, WASM binaries, browser tests, model files,
private profiles, or runtime evidence.

Fixed context:

- TinyRustLM is a single prelaunch browser-local chat product. Model bytes and
  prompts must remain local or flow directly between consenting peers; the
  project website must not receive them.
- The exact current technical contracts are SLM2 model storage, Tokenizer2,
  Template2, Prompt2, Sampling2, and ACG2 composition. These are contract
  identities, not product generations.
- Native scalar execution is the reference behavior. Browser WASM must use the
  same validated model bytes, rendered prompt bytes, token IDs, sampling
  profile, seed, stop IDs, and operation identity.
- A browser worker owns inference. Cancellation must truly terminate work,
  release resources, and recover through a fresh worker. Reusing a terminated
  worker, repairing output, retry-selecting, or falling back to server
  inference is prohibited.
- Tests must use fresh owned browser profiles, zero unexpected network, bounded
  resources, raw output preservation, process closure, and deletion proof.

Research primary sources and record publication/update and retrieval dates.
Address:

1. Recommend a WASM architecture for direct mixed-Q8 execution, including
   linear-memory layout, tensor alignment, row-scale access, F32 accumulation,
   KV cache, scratch buffers, tokenizer assets, and avoiding a dense weight
   shadow.
2. Compare baseline scalar WASM, SIMD128, relaxed SIMD, threads, memory64, and
   WebGPU only as evidence-supported options. State browser support,
   determinism implications, cross-origin requirements, fallback policy, and
   why an unavailable optimization must not create a second semantic path.
3. Define native/WASM conformance at token, logits, sampler decision, stop,
   transcript, and final output levels. Specify tolerances only where exact
   equality is mathematically unjustified and explain how to localize drift.
4. Design Web Worker lifecycle and message protocols for load, inspect,
   activate, begin, step, stream, cancel, finish, failure, and dispose. Include
   operation IDs that suppress stale messages and duplicate rendering.
5. Explain true cancellation: cooperative checks versus worker termination,
   transferable ownership, cleanup, stale message rejection, fresh-worker
   recovery, and verification that no background generation continues.
6. Derive resource budgets for model bytes, WASM memory, KV growth, prompt
   tokens, output tokens, transient copies, browser process overhead, and disk
   storage. Provide formulas and admission checks rather than invented numbers.
7. Design streaming local-file and P2P loading without unnecessary full-file
   copies. Cover File API, OPFS/IndexedDB tradeoffs, transferables, hashing,
   backpressure, partial data, cancellation, quota, and private browsing.
8. Specify zero-network browser tests and privacy assertions. Distinguish
   static application assets, catalog metadata, direct peers, loopback
   companion traffic, and forbidden prompt/model upload or telemetry.
9. Design a deterministic real-Chromium runner with fixed browser build,
   viewport, clean persistent profile, seeded schedules, raw evidence, timeouts,
   process shutdown, profile deletion, and no retry after a terminal result.
10. Cover browser failure modes: WASM trap, out-of-memory, detached buffer,
    stale service worker, tab suspension, page reload, worker crash, browser
    crash, corrupted model, quota loss, and cancellation races.
11. Recommend performance measurements for startup, validation, first token,
    steady-state tokens/second, peak memory, KV growth, cancellation latency,
    and long-conversation stability, including warm/cold distinctions.
12. Identify what can be concluded from standards and what requires local WASM
    binary, browser, model, hardware, and UI evidence.

Required report structure:

1. Executive WASM architecture recommendation.
2. Native-reference and browser execution model.
3. Memory, tensor, and KV layout.
4. Worker protocol and operation identity.
5. Cancellation and fresh-worker recovery.
6. Determinism and conformance methodology.
7. Resource-budget formulas and admission limits.
8. Local/P2P streaming and storage design.
9. Privacy and zero-network test contract.
10. Browser failure-injection matrix.
11. Performance qualification plan.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not propose server inference, output repair, best-of-N retries, an old WASM
fallback runtime, or a compatibility worker. Do not call fixture parity proof
of real-model quality or user-ready browser chat.

## Prompt 6: Fixed-Piece Direct P2P Model Acquisition And Verified Assembly

You are an independent P2P protocol architect, secure file-transfer engineer,
and distributed-systems reviewer. Produce an exceptionally detailed report for
direct acquisition of large local AI artifacts without proxying model bytes
through the project website. You may inspect public web standards, HTTP
specifications, content-addressed storage literature, Merkle-tree designs,
browser networking, and peer-discovery systems. You cannot inspect private
MiniModel services, TinyRustLM source, manifests, peers, observer receipts,
network configuration, or model artifacts.

Fixed product context:

- TinyRustLM is a single prelaunch browser-local chat product.
- MiniModel.org is intended to provide public catalog/discovery metadata. Model
  bytes must flow directly between consenting peers or be produced by explicit
  local conversion; MiniModel must not act as a model-byte proxy.
- The current transport concept uses immutable fixed-size pieces, normally 4
  MiB except the final piece, SHA-256 identities, a deterministic Merkle tree,
  bounded canonical manifests, and final whole-artifact verification.
- P2P-first acquisition should reuse an exact verified artifact when available.
  If no valid peer is available, the product should start an explicit local
  conversion from an immutable reviewed source, not download a text, JSON, or
  script instruction file and call that success.
- The Rust authority prepares share kits, inspects manifests, and assembles
  artifacts. ACG2 composition may bind multiple immutable artifacts, but no
  manifest may contain embedded model bytes, mutable locators, or partial
  activation.
- Local/LAN checks are not public reachability evidence. No catalog or outside
  availability claim may be invented.

Research primary sources and record dates and retrieval date. Address:

1. Define identities for artifact, manifest, piece set, piece, Merkle profile,
   source provenance, conversion receipt, peer endpoint, acquisition attempt,
   assembly operation, and final admission decision.
2. Specify canonical fixed-piece generation, including exact byte ranges,
   final short piece, empty/too-small files, streamed hashing, Merkle leaf and
   parent domain separation, odd-node treatment, and deterministic ordering.
3. Design a closed manifest schema with maximum sizes, exact hash algorithms,
   piece count/size arithmetic, artifact metadata, profile identity, and strict
   rejection of duplicates, unknown fields, overlapping ranges, unsafe paths,
   mutable URLs, and inconsistent roots.
4. Define a strict HTTP serving profile for pieces: allowed methods and routes,
   path grammar, status codes, content type/length, ranges or explicit lack of
   ranges, CORS, bounded headers, timeouts, keep-alive, cache semantics,
   symlink/reparse defense, and request-smuggling controls.
5. Design resumable acquisition from one or more peers. Require complete
   identity agreement before mixing pieces, durable journals, per-piece atomic
   promotion, corruption quarantine, peer accountability, and final streamed
   whole-file verification.
6. Explain P2P-first selection without best-of-N semantic cheating. Cover peer
   discovery, deterministic candidate ordering, concurrency limits, retries for
   transport failure, identity mismatch, timeout, cancellation, and truthful
   status transitions.
7. Specify the local-conversion branch when no exact peer exists. Define source
   review, disk/RAM estimates, explicit consent, immutable acquisition,
   create-only output, progress, cancellation, resumption, provenance, and
   transition back into ordinary verified artifact admission.
8. Design safe filesystem ownership for piece stores, staging, journals,
   quarantine, final artifacts, and shared read-only serving. Cover Windows
   rename semantics, disk full, process crash, locked files, and guarded
   recursive cleanup.
9. Define browser/companion trust boundaries. State which component downloads,
   hashes, stores, converts, serves, and exposes progress, and how loopback
   authentication prevents arbitrary websites from invoking local operations.
10. Specify privacy rules for peer IPs, model choices, prompts, logs, receipts,
    and catalog interactions. Model download choice must not reveal prompts.
11. Design unit, property, fuzz, integration, multi-peer, corruption,
    cancellation, restart, and real outside-network tests. Clearly separate CI
    evidence from authorized live evidence.
12. Identify facts that require private/local verification, including actual
    catalog contracts, endpoint availability, NAT behavior, throughput, model
    identities, receipts, and browser integration.

Required report structure:

1. Executive P2P acquisition recommendation.
2. Identity graph and canonical schemas.
3. Piece/Merkle algorithm.
4. Strict serving protocol.
5. Resumable multi-peer assembly state machine.
6. P2P-first and local-conversion decision flow.
7. Filesystem durability and recovery.
8. Browser/companion security boundary.
9. Privacy and evidence minimization.
10. Capacity and resource formulas.
11. Test and failure-injection matrix.
12. Unknowns requiring local or authorized live evidence.
13. Annotated primary-source bibliography with dates and direct links.

Do not propose a project-hosted model fallback, instruction-file download,
manifest repair, mutable piece identity, hidden router changes, local-only
reachability claims, or compatibility support for an obsolete transport.

## Prompt 7: User-Centered P2P-Or-Convert Browser Flow Without Instruction Downloads

You are an independent principal product engineer, browser UX architect, and
local-compute reliability specialist. Produce an exceptionally detailed report
for a browser-local AI product in which users choose a model and expect it to
work without downloading scripts, text files, or machine-readable instructions
they must understand. You may inspect public browser APIs, local companion
patterns, secure loopback guidance, accessibility standards, and model-manager
UX. You cannot inspect TinyRustLM UI code, screenshots, private contracts,
companion binaries, models, analytics, or user tests.

Fixed experience and security requirements:

- TinyRustLM is one prelaunch product. It has no legacy UX to preserve and no
  reason to retain obsolete download behavior.
- A selected model should be acquired by exact verified direct P2P when
  available. Otherwise, after clear source/license/resource review and user
  consent, the local companion should acquire immutable source files and
  convert them locally into the sole current SLM2 format.
- Downloading a `.txt`, `.json`, `.ps1`, or other instruction artifact is not
  model acquisition and must never be presented as success.
- Prompts and model bytes must not be uploaded to project sites. Conversion and
  inference are local. The browser may communicate with an authenticated
  loopback companion through a narrowly scoped contract.
- The UI must report real states, errors, progress, disk/RAM requirements,
  cancellation, and resumption. It must never simulate completion, choose the
  best retry, or silently switch to a server model.
- Technical SLM2/ACG2/etc. identities must not be marketed as product V2.

Research current primary sources and record dates and retrieval date. Address:

1. Design the complete state machine from catalog search through model-card
   review, exact-artifact lookup, P2P acquisition, verification, local-source
   review, conversion, admission, activation, and first chat token.
2. Define user-visible states and language for unavailable companion, no peer,
   peer found, source review required, insufficient disk/RAM, downloading,
   converting, verifying, resumable pause, cancelling, cancelled, failed,
   ready, and quarantined. Status must be truthful and actionable.
3. Explain how the browser discovers and authenticates the local companion
   without version negotiation or compatibility routes. Cover origin binding,
   CSRF, DNS rebinding, bearer-secret exposure, port discovery, CORS, loopback
   TLS tradeoffs, process identity, and explicit user authorization.
4. Specify progress semantics for unknown and known totals across peer
   discovery, piece transfer, source download, hash verification, tensor
   conversion, final validation, and activation. Avoid misleading combined
   percentages.
5. Design disk and memory preflight. Show formulas, safety margins, transient
   storage, final artifact storage, cache reuse, quota checks, and user choice
   when resources are insufficient.
6. Define cancellation and resumption UX backed by real operation identities.
   Cover page reload, browser restart, companion restart, stale events,
   duplicate clicks, interrupted conversion, partial pieces, and terminal
   failures.
7. Specify provenance and license presentation that is understandable but
   does not bury users in internals. Include source publisher, immutable
   revision, license, artifact hash, conversion status, and quality claim tier.
8. Design accessibility and responsive behavior for long model names, large
   progress values, keyboard-only operation, screen readers, reduced motion,
   narrow/mobile layouts, errors, and focus management.
9. Explain privacy-preserving network observability that can prove which hosts
   received what categories of traffic without logging prompts, secrets, or
   raw model bytes.
10. Create usability test protocols for novice and expert users, including no
    peer, slow peer, corrupted piece, source drift, companion absent, disk full,
    cancellation, browser restart, and successful first conversation.
11. Define acceptance criteria proving no instruction download remains in UI,
    routing, generated assets, content disposition, tests, documentation, or
    release bundles.
12. Identify which recommendations rely on local UI, browser, companion,
    network, and real-model validation.

Required report structure:

1. Executive experience recommendation.
2. End-to-end acquisition and activation journey.
3. User-visible state and error vocabulary.
4. Browser/companion authentication contract.
5. Progress, resource, cancellation, and resume semantics.
6. Provenance, license, and quality disclosure.
7. Privacy and network assertions.
8. Responsive and accessible interaction specification.
9. Failure-recovery UX matrix.
10. User research and automated test plan.
11. No-instruction-download deletion gate.
12. Unknowns requiring local testing.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend retaining the old download path behind an advanced toggle,
compatibility mode, or hidden fallback. Do not confuse creation of a request
file with acquisition of a usable model.

## Prompt 8: No-Cheat Qualification Of One Real Small Conversational Model

You are an independent evaluation-science lead, small-model researcher, and
statistical reviewer. Produce an exceptionally detailed report defining how to
qualify the first genuinely useful TinyRustLM model rather than merely proving
that its file parses. You may inspect public model cards, papers, evaluation
research, benchmark contamination literature, and statistical standards. You
cannot inspect private prompts, holdouts, model outputs, training data, runtime
logs, adapters, receipts, or model bytes.

Fixed context:

- TinyRustLM is a browser-local prelaunch AI chat product. A compact Qwen3
  model around 0.6B parameters is one plausible candidate, but popularity,
  parameter count, conversion success, or one attractive answer is not enough.
- The important behaviors include ordinary conversation, ambiguity handling,
  practical resource constraints, conflicting source authority, latest-user
  preference precedence, multi-turn references, untrusted quoted or retrieved
  instructions, lawful adult help, narrow concrete-harm boundaries,
  summarization, rewriting, JSON, extraction, and code explanation.
- Arithmetic may be delegated to a deterministic calculator and is secondary.
- Candidate raw output must be preserved exactly. Repair, answer completion,
  hand editing, expected-term injection, retries selected for best answer, and
  training on evaluation failures are prohibited.
- Source, adapted checkpoint, merged checkpoint, SLM2 quantization, native
  execution, and browser WASM execution require separate identities and
  comparisons.
- A technical fixture cannot count as a qualified model or campaign progress.

Use primary sources wherever possible and record dates and retrieval date.
Address:

1. Define claim tiers separating parseable, runtime-smoke, source-screened,
   conversation-qualified, task-specific-qualified, and broad-assistant claims.
   Specify minimum evidence and prohibited language for each.
2. Design a source-screen protocol that occurs before conversion or training.
   Include fixed cases, sealed seeded paraphrases, multi-turn cases, repeated
   seeds where sampling is product behavior, raw capture, blinded human review,
   rejection thresholds, and compute-spend stop rules.
3. Create a behavior taxonomy and recommended case allocation covering every
   required behavior while preserving ordinary helpfulness as the majority.
   Positive helpful examples must substantially outnumber refusals.
4. Define semantic invariants that generalize across entities and wording:
   ask for missing options/criteria, resolve authority conflict, honor current
   preference over stale memory, respect unavailable resources, treat quoted
   instructions as data, and answer lawful adult comparisons substantively.
5. Design metamorphic generation varying names, entities, dates, units,
   percentages, authority ordering, negation, resource availability, discourse
   style, distractors, and turn-level state changes. State which verdicts must
   remain invariant and which should change.
6. Specify contamination controls across public benchmarks, development cases,
   sealed holdouts, teacher data, paraphrase families, entity-substituted
   overlap, response-answer overlap, semantic neighbors, and deletion lineage.
7. Recommend a layered evaluator combining deterministic structural checks,
   semantic invariants, model judges, and human authority. Explain disagreement
   handling and prevention of judge rewriting.
8. Define statistical treatment of stochastic output: fixed seed schedules,
   pass probabilities, confidence intervals, correlated failures, multiple
   comparisons, infrastructure flakiness, and why best-of-N is invalid unless
   it is the declared product behavior.
9. Design parity experiments across untouched source runtime, optional adapter,
   merged model, quantized SLM2 native runtime, and browser WASM. Isolate prompt
   rendering, tokenization, quantization, kernel, and sampling differences.
10. Specify latency, memory, context, KV growth, cancellation, repetition, and
    long-conversation measurements with hardware/browser disclosure and no
    invented thresholds.
11. Define failure preservation and TDD: archive raw failure, add a generic
    regression, make a scoped implementation or training change, invalidate
    only dependent evidence, and never overwrite old decisions.
12. Identify facts requiring local model execution, sealed evidence, human
    review, license confirmation, and browser measurements.

Required report structure:

1. Executive qualification recommendation and assumptions.
2. Claim taxonomy and evidence thresholds.
3. Source-screen protocol and stop rules.
4. Behavior curriculum and semantic invariants.
5. Metamorphic and sealed-holdout design.
6. Contamination controls and lineage.
7. Layered evaluation authority.
8. Statistical seed and repeat policy.
9. Source/adapter/SLM2/native/WASM parity matrix.
10. Human review and independent audit.
11. Failure-to-regression workflow.
12. Unknowns requiring private execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not provide expected answer strings for private cases, recommend benchmark
memorization, lower thresholds to promote a preferred model, or infer quality
from structural validation.

## Prompt 9: Enterprise Test Architecture, Fuzzing, And Failure Preservation

You are an independent principal test architect, Rust/.NET quality engineer,
and adversarial-input specialist. Produce an exceptionally detailed report for
an enterprise-quality, prelaunch local-AI stack spanning Rust, a small C ABI,
.NET packages, conversion tools, fixed-piece P2P, browser WASM, and a chat UI.
You may inspect official test-framework, fuzzing, sanitizer, browser automation,
property-testing, and secure-coding documentation. You cannot inspect private
tests, coverage, source, fixtures, failures, binaries, or CI.

Fixed engineering rules:

- TinyRustLM is one prelaunch product with no legacy behavior to preserve.
- Tests must enforce the sole current architecture, not keep obsolete readers,
  fixtures, symbols, package IDs, or paths alive.
- No test may be weakened, skipped, repaired, or rewritten merely to make an
  implementation pass. A failed raw artifact is preserved; the general cause
  receives a regression test; dependent phases are rerun.
- Bounded deterministic fixtures prove contracts only. They are not real-model
  quality, browser-chat, public P2P, package publication, or deployment proof.
- Live-service tests require authorization and cannot be simulated. In
  particular, MemoryEndpoints is out of scope unless separately authorized.
- Exact technical identifiers are contract identities, not product V2.

Research primary sources and record dates and retrieval date. Address:

1. Design a risk-based test pyramid and ownership map for model parsers,
   quantization, tokenizer/template/prompt/sampler, composition activation,
   runtime state, native ABI, managed wrappers, converter process control,
   P2P manifests/pieces, package contents, WASM workers, and browser UX.
2. Define golden-vector design that avoids shared implementation assumptions.
   Require independent oracles, canonical bytes, exact hashes, hostile
   mutations, and provenance for every vector generator.
3. Specify property tests for byte offsets, size arithmetic, piece partitioning,
   Merkle roots, quantization, JSON closure, state transitions, operation
   identities, create-only output, and assemble-round-trip identity.
4. Build malformed-input corpora for SLM2, ACG2, P2P manifests, native JSON,
   safetensors, tokenizer data, package archives, and loopback requests. Include
   truncation, extension, duplicates, overlap, integer overflow, path traversal,
   symlinks/reparse points, malformed Unicode, NaN/Inf, deep nesting, and
   resource bombs.
5. Recommend fuzz targets, dictionaries, structured mutators, corpus retention,
   minimization, deterministic replay, time budgets, sanitizer combinations,
   Miri scope, and crash triage for Rust and native boundaries.
6. Design state-machine and concurrency tests for runtime handles, activation,
   begin/step/finish, cancellation, worker termination, stale messages, process
   timeout, redirected output, P2P partial writes, locked files, and restart.
7. Specify cross-language contract tests proving exact native symbols, JSON
   schemas, errors, hashes, and lifecycle semantics from Rust through a packed
   NuGet consumer, not merely project references.
8. Design real-browser tests with fresh owned profiles, zero unexpected
   network, authentic local files, process closure, deletion proof, viewport
   coverage, accessibility checks, and raw output preservation.
9. Define resource-exhaustion tests for bounded JSON, file size, headers,
   tensors, token count, context, output, WASM memory, KV cache, disk, process
   output, network concurrency, and timeouts.
10. Explain mutation testing and architecture fitness tests that prove tests
    fail when an obsolete path, extra ABI symbol, manifest repair, hidden retry,
    duplicate render, or server fallback is introduced.
11. Design durable failure evidence and invalidation: content identity,
    immutable attempts, rerun boundaries, environment identity, flaky
    infrastructure classification, and prohibition on pass-overwrite.
12. Define release-gate matrices and residual risks for Windows x64, Linux x64,
    Linux ARM64, native, WASM, packaged consumer, and browser execution.

Required report structure:

1. Executive test strategy.
2. Risk and ownership matrix.
3. Independent vectors and property tests.
4. Fuzz targets and malformed corpora.
5. State, concurrency, cancellation, and restart tests.
6. Cross-language and package-consumer verification.
7. Browser, privacy, and accessibility gates.
8. Resource-exhaustion test plan.
9. Mutation and architecture fitness testing.
10. Failure preservation and evidence invalidation.
11. Platform release matrix.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend retaining obsolete code solely for regression tests, using
mocks as live proof, treating cross-compilation as real ARM64 execution, or
changing expected results after seeing preferred output.

## Prompt 10: Reproducible Supply Chain, Packages, Sites, And Publication Evidence

You are an independent principal release engineer, software supply-chain
architect, and publication auditor. Produce an exceptionally detailed report
for releasing a browser-local AI product whose model, runtime, native library,
.NET SDK, companion, P2P metadata, WASM assets, documentation, and public sites
must be cryptographically traceable and honestly described. You may inspect
official SLSA, in-toto, Sigstore, SPDX/CycloneDX, Cargo, NuGet, SourceLink,
GitHub Actions, reproducible-build, and web-deployment documentation. You
cannot inspect private repositories, workflows, secrets, packages, artifacts,
hosting accounts, DNS, or production sites beyond public pages.

Fixed constraints:

- TinyRustLM is one prelaunch product, not a V1/V2 family. There is no legacy
  release to support and no permission to publish compatibility packages.
- One real model vertical slice must bind immutable source and license,
  deterministic SLM2 conversion, native and WASM runtime identities, managed
  package identities, browser assets, quality evidence, and public claims.
- Model bytes remain outside source control. Public-safe manifests, hashes,
  bounded receipts, schemas, docs, and code remain in source control.
- A local build is not a published package. A deployment command is not a
  successful deployment. Completion requires public HTTPS/package-registry
  readback tied to the expected bytes and commit.
- Secrets, prompts, enrollment URLs, tokens, private paths, and raw private
  evidence must not appear in artifacts, logs, packages, sites, or reports.
- No failure may be converted to a skip or simulated success.

Research primary sources and record dates and retrieval date. Address:

1. Design a content-addressed release graph binding Git commit/tree, lockfiles,
   toolchains, source model revision/files, converter, SLM2 model, tokenizer,
   template, prompt/sampling/composition profiles, Rust binaries, native
   exports, NuGet packages, symbols, WASM assets, companion archives, site
   bundles, and deployment receipts.
2. Specify reproducible-build controls for Cargo and .NET: pinned toolchains,
   locked dependencies, deterministic paths/timestamps, compiler flags,
   native dependencies, repository metadata, SourceLink, symbols, and clean
   builders.
3. Define SBOM and provenance coverage for source, native libraries, WASM,
   packages, companion archives, model source materials, licenses, and web
   dependencies. Explain model-specific gaps in ordinary software SBOMs.
4. Recommend signing/attestation architecture for prelaunch and later public
   operation. Compare DSSE/in-toto, Sigstore keyless signing, long-lived keys,
   TUF, threshold/offline roots, timestamps, revocation, and key rotation.
5. Design strict package/archive gates: allowlisted files, native hashes,
   duplicate entries, traversal, symlinks, executable modes, unexpected
   dependencies, secrets, malware-scan boundaries, license/readme/icon,
   symbols, and package-consumer execution.
6. Specify cross-platform evidence labels for cross-compilation, binary-header
   inspection, emulated smoke, and real hardware execution on `win-x64`,
   `linux-x64`, and `linux-arm64`.
7. Design a publication transaction for NuGet feeds and multiple public sites.
   Cover immutable staging, authorization, version/date consistency, change
   logs, cache invalidation, HTTPS readback, package hash/readme verification,
   rollback, and partial publication.
8. Define a cross-site claim registry ensuring that product, documentation,
   catalog, and marketing pages cannot claim models, packages, P2P, browser
   behavior, MemoryEndpoints, or campaign counts beyond current evidence.
9. Specify secret scanning across source, Git history, build logs, traces,
   screenshots, packages, archives, source maps, deployment output, and public
   HTML. Cover encoded and compressed forms and false-positive adjudication.
10. Design durable release/publication receipts with attempts, timestamps,
    expected/observed identities, bounded errors, public URLs, TLS/readback
    facts, cache observations, and supersession without overwrite.
11. Define gates that invalidate only affected descendants. For example, a
    documentation change should not reconvert a 3 GB source, while a converter
    change invalidates model and every descendant claim.
12. Identify all steps requiring private credentials, authorized infrastructure,
    real hardware, external observers, package registries, and public readback.

Required report structure:

1. Executive supply-chain recommendation.
2. Content-addressed release graph.
3. Reproducible Rust/.NET/WASM build controls.
4. SBOM, provenance, signing, and revocation.
5. Package/archive security matrix.
6. Cross-platform evidence vocabulary.
7. Publication transaction and rollback.
8. Cross-site claim and version consistency.
9. Secret-scanning contract.
10. Receipt schemas and invalidation rules.
11. Final release acceptance checklist.
12. Unknowns requiring authorized local/live access.
13. Annotated primary-source bibliography with dates and direct links.

Do not count a successful pack as publication, a deployment command as public
readback, a local P2P probe as outside proof, or an unsigned mutable file as
provenance. Do not propose support for an obsolete package or site contract.

## Prompt 11: Robust Living Documentation And Cross-Site Claim Integrity

You are an independent principal documentation architect, developer-experience
engineer, and technical-claims auditor. Produce an exceptionally detailed
report for keeping all public, operator, API, package, architecture, model,
P2P, and marketing documentation synchronized with a rapidly improving
prelaunch local-AI system. You may inspect public documentation standards,
docs-as-code tooling, link checkers, schema generators, package portals,
accessibility guidance, and established release-note practices. You cannot
inspect private TinyRustLM docs, repositories, CI, deployment logs, package
feeds, analytics, or hosting systems.

Fixed context:

- TinyRustLM is one prelaunch product. Documentation must never invent product
  V1/V2 generations or describe technical SLM2/ACG2/etc. identities as product
  releases.
- There is no legacy user population. Current documentation must describe only
  the sole executable architecture. Historical evidence may remain in clearly
  non-authoritative archives but must not appear in setup, API, examples,
  search results, or release instructions as supported behavior.
- The system spans the main product site, documentation-oriented sites,
  MiniModel catalog/discovery information, Rust/native/WASM APIs, .NET/NuGet
  packages, a local companion, direct P2P acquisition, model conversion, and
  quality evidence.
- Every published site should expose a consistent product version or build
  identity, release date, last-published timestamp, and human-readable change
  log. Claims must be tied to objective evidence and public readback.
- Documentation quality is part of the release gate, not cleanup deferred
  until code is considered complete.

Research primary sources and record dates and retrieval date. Address:

1. Design an authoritative documentation information architecture separating
   user tasks, concepts, reference, operator runbooks, security/privacy,
   model/evidence cards, package docs, contributor architecture, release notes,
   and immutable historical evidence.
2. Define a single-source metadata model for product identity, technical
   contract identities, package versions, commit, release date, last publish,
   supported platforms, current model claims, P2P status, and service
   authorization. Show how each site consumes it without runtime coupling.
3. Specify claim taxonomy and wording gates for structural validation, native
   execution, browser WASM parity, conversation qualification, P2P availability,
   package publication, site deployment, and optional MemoryEndpoints status.
4. Create a stale-document discovery method spanning Markdown, HTML, code
   comments, XML docs, samples, scripts, workflow names, package metadata,
   screenshots, search indexes, downloads, and external links.
5. Explain executable documentation: compile samples, isolated package-consumer
   tests, schema examples, command validation, API extraction, screenshot tests,
   link checks, anchor checks, spell/terminology lint, and secret scans.
6. Design cross-site consistency tests for versions, dates, package IDs,
   download links, model hashes, quality labels, privacy claims, release notes,
   and last-published information.
7. Recommend release-note and publication-log schemas. Cover version/build,
   release date, publish timestamp, commit/tree, affected sites/packages,
   changes, removals, evidence, known limitations, rollback, and public readback.
8. Define how to document clean deletion in a prelaunch product without
   publishing migration guidance, compatibility promises, or confusing users
   with an old/new product narrative.
9. Specify documentation review responsibilities and change coupling: which
   code changes require API docs, model cards, operator docs, security docs,
   marketing updates, package readmes, and release-note entries.
10. Design user-facing documentation for P2P-first acquisition and automatic
    local conversion that never instructs users to download a text/script
    request or manually reconstruct an internal operation.
11. Define accessibility, localization-readiness, search, canonical URLs,
    redirects for factual URL maintenance versus legacy product support, and
    offline documentation requirements.
12. Identify what requires inspection of private code/docs and what requires
    live site, package registry, cache, and search-engine readback.

Required report structure:

1. Executive documentation recommendation.
2. Information architecture by audience and task.
3. Single-source release/claim metadata schema.
4. Claim taxonomy and prohibited wording.
5. Stale-content discovery and deletion process.
6. Executable documentation test architecture.
7. Cross-site consistency and readback gates.
8. Release-note and publication-log specification.
9. Documentation change-coupling matrix.
10. P2P-or-convert user documentation blueprint.
11. No-debt documentation acceptance checklist.
12. Unknowns requiring local/live verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend a legacy docs section, compatibility guide, migration page,
or product V2 narrative for this prelaunch system. Do not treat a locally
updated Markdown file as proof that a public site or package page is current.

## Prompt 12: End-To-End One-Model Vertical Slice Control Plane And Acceptance

You are an independent principal systems architect, release-control engineer,
and AI product qualification lead. Produce an exceptionally detailed report
describing the shortest honest path to one real, provenance-bound,
conversation-qualified TinyRustLM model completing a genuine browser-local
multi-turn conversation. You may inspect public model repositories, standards,
papers, browser documentation, package registries, supply-chain guidance, and
P2P protocols. You cannot inspect private source, models, prompts, evidence,
tests, credentials, services, hardware, or deployment systems.

Fixed program context:

- TinyRustLM is a single prelaunch product with no product V1/V2 distinction,
  no legacy support, no compatibility obligations, and zero tolerance for
  knowingly retained technical debt.
- The desired first slice begins with an immutable, license-reviewed compact
  source model, plausibly Qwen3 around 0.6B, and ends with deterministic SLM2
  bytes executing through the canonical Rust runtime in native and browser
  WASM paths.
- Tokenizer2, Template2, Prompt2, Sampling2, and ACG2 are exact technical
  contracts. They must be content-identified and bound into receipts, but they
  are not separate product generations.
- Acquisition is verified P2P first. If no exact peer exists, the user may
  authorize immutable source acquisition and local deterministic conversion.
  Instruction-file download is not completion.
- The .NET SDK has clean base boundaries for Abstractions, Core, and P2P, plus
  optional unauthorized/disconnected MemoryEndpoints and optional private
  Conversion tooling. The native ABI has exactly fifteen symbols.
- Raw model output is preserved. No repair, hidden retry, best-of-N selection,
  fake service, weakened test, or simulated success is allowed.
- One successful model is not the later 20-model/50-browser-round campaign;
  all larger campaign counters remain zero until separately proven.

Use primary sources wherever possible and record dates and retrieval date.
Address:

1. Define the full state machine from candidate discovery, immutable source
   lock, license review, raw source screening, optional training/adaptation,
   conversion preregistration, deterministic SLM2 conversion, structural
   validation, native qualification, browser WASM conformance, model admission,
   P2P preparation, acquisition UX, browser conversation, package/site release,
   and public readback.
2. Specify allowed transitions, retryable infrastructure failures, terminal
   model rejection, external blockage, cancellation, supersession, and final
   acceptance. A terminal evidence result must never be overwritten.
3. Design content-addressed identities and receipt schemas for every phase.
   Explain parent binding, tool/environment identities, timestamps, bounded
   errors, raw/private versus public-safe evidence, and graph validation.
4. Create an invalidation matrix. Show exactly what must rerun when source
   bytes, license, converter, format profile, tokenizer, template, prompt,
   sampler, runtime, native ABI, managed wrapper, P2P profile, browser build,
   evaluator, docs, or site bundle changes.
5. Define durable filesystem and resume rules for large sources, models,
   pieces, profiles, browser evidence, package artifacts, and public receipts.
   Cover create-only writes, fsync, atomic rename, streamed hashing, crash,
   disk full, locked files, and guarded cleanup.
6. Specify quality gates before and after quantization, native/WASM parity,
   browser-local multi-turn conversation requirements, cancellation, duplicate
   rendering prevention, fresh-worker recovery, and zero prompt/model upload.
7. Design the P2P-or-convert product branch with truthful status, resource
   preflight, source/license consent, identity reuse, progress, cancellation,
   restart, final admission, and first activation.
8. Define package and release gates for Rust, WASM assets, exact native ABI,
   .NET packages, companion archives, public docs, marketing claims, version
   and release date, publication logs, and HTTPS/package-registry readback.
9. Create a blocker matrix for model quality, license ambiguity, source drift,
   unsupported architecture, conversion failure, runtime mismatch, browser
   resource limits, no peer, local conversion resources, package failure,
   missing signing credentials, deployment failure, and unauthorized external
   service. State work that can continue behind each blocker.
10. Design an operator dashboard that reports the current phase, immutable
    operation identity, elapsed time, resumability, model hash, evidence state,
    blockers, and truthful zero campaign counters without reducing the graph
    to one boolean `passed` field.
11. Provide a failure-to-regression workflow for source mismatch, quantization
    drift, parser defect, native ABI mismatch, stale package, corrupted piece,
    worker cancellation leak, duplicate UI answer, privacy violation, stale
    docs, and public readback mismatch.
12. Produce a prioritized implementation sequence optimized for the first
    honest usable model, with explicit stop rules and no partial claim inflation.
13. Identify every unknown requiring private source, model, human-review,
    hardware, browser, package, network, credential, or public deployment access.

Required report structure:

1. Executive vertical-slice recommendation and assumptions.
2. End-to-end phase/state diagram.
3. Identity and receipt graph.
4. Invalidation and selective-rerun matrix.
5. Durable persistence and resume algorithm.
6. Model quality and runtime parity gates.
7. P2P-or-convert acquisition branch.
8. Browser-local conversation acceptance.
9. Package, documentation, and publication gates.
10. Blocker matrix and parallel work paths.
11. Operator dashboard specification.
12. Failure-to-regression workflow.
13. Objective final acceptance checklist.
14. Prioritized implementation plan.
15. Unknowns requiring local or authorized access.
16. Annotated primary-source bibliography with dates and direct links.

Do not propose a product V2, compatibility route, legacy reader, migration,
fallback runtime, server inference, instruction-file acquisition, repaired
output, mocked live proof, or completion claim based on structural tests alone.

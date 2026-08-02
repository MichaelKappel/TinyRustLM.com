# Authoritative Enterprise Clean-Slate TinyRustLM vNext Development Goal And Execution Plan

This entire document is one self-contained execution assignment. It is not a
request for another high-level research report. The receiving agent is expected
to inspect the actual workspace, implement working code, run all locally
possible tests, operate authorized release tooling, preserve objective evidence,
and leave exact blockers for work that requires unavailable contracts,
credentials, external observers, paid compute, or physical hardware.

The research reports listed in Appendix A are advisory inputs. They are not
proof of current implementation, browser support, model quality, hosting
behavior, production contracts, or successful execution. Verify every
behavior-affecting recommendation against primary sources and current local
evidence before adopting it.

======================================================================
1. ROLE, MISSION, AND PRODUCT CONTEXT
======================================================================

You are the principal engineer, runtime architect, ML systems engineer,
browser reliability lead, security engineer, release operator, evidence-system
owner, and documentation steward for the TinyRustLM ecosystem.

Your mission is to build and verify an enterprise-quality, browser-local small
language model platform that:

1. Loads cryptographically identified model artifacts without sending model
   bytes or prompts to a project server.
2. Runs a deterministic Rust inference core natively and through WebAssembly.
3. Uses WebGPU only as an independently qualified acceleration backend.
4. Preserves exact source, tokenizer, template, conversion, quantization,
   runtime, sampling, and evaluation lineage.
5. Supports one strong general conversational champion plus genuinely useful,
   compact task specialists where measured quality justifies them.
6. Uses deterministic context compilation, typed provenance, explicit
   authority, safe memory boundaries, and optional local tools.
7. Uses a separately installed local companion for native acceleration and
   direct P2P only through a versioned, origin-bound, security-reviewed
   protocol.
8. Publishes model metadata through MiniModel only after quality,
   provenance, reachability, and external-download proof exist.
9. Integrates MemoryEndpoints only through a public, versioned, authorized
   contract, never through guessed routes.
10. Produces immutable receipts that prove what happened without retaining
    secrets, prompts, model bytes, or unsafe private paths.
11. Keeps every product, marketing, download, support, and documentation site
    synchronized with the exact evidence-supported product state.
12. Completes the full 20-model, 50-browser-round, 25-live-memory-round,
    40-external-lane, and 20-catalog-announcement campaign honestly.

The principal working repository is expected at:

E:\Source\Rust\TinyRustLM.com

Large models, public research repositories, training environments, downloaded
artifacts, and other third-party material must remain outside project source
control under:

E:\Source\External\{project-or-source-name}

Reconfirm all paths and repository ownership before changing anything.

======================================================================
2. NON-NEGOTIABLE CLEAN-SLATE ENTERPRISE RULES
======================================================================

The system is pre-publication and currently dogfooded by related sites and
systems. There is no customer compatibility obligation.

Apply all of the following rules:

1. No legacy support.
   - Do not retain an old .slm reader.
   - Do not dual-write old and new formats.
   - Do not add compatibility aliases.
   - Do not preserve unpublished route versions.
   - Do not retain old receipt fields merely for compatibility.
   - Do not carry forward stale schemas, dead feature flags, or abandoned
     configuration formats.
   - Retire obsolete routes and artifacts explicitly after proving the new
     path.

2. No code debt.
   - Do not add TODO-driven production paths.
   - Do not add temporary bypasses that become normal operation.
   - Do not suppress failures to make a release green.
   - Do not leave duplicate implementations after cutover.
   - Do not defer required validation to documentation.
   - Do not accept an unbounded parser, allocator, queue, cache, or log.

3. Rewrite when the existing boundary is wrong.
   - Reuse correct code only when it satisfies the clean target.
   - Prefer replacing a weak unpublished contract over wrapping it forever.
   - Delete the replaced path and its obsolete tests and documentation after
     the replacement passes.
   - Avoid unrelated stylistic churn, but never preserve debt for the sake of
     minimizing a diff.

4. Enterprise quality is the minimum.
   - Every external input is hostile until validated.
   - Every allocation is preflighted with checked arithmetic.
   - Every persistent mutation is atomic, restart-safe, and independently
     verifiable.
   - Every public claim is bound to exact evidence.
   - Every failure leaves a useful, public-safe receipt.
   - Every privileged action is capability-scoped and auditable.
   - Every release has rollback and readback evidence.

5. Marketing and documentation are release artifacts.
   - Product claims must never lead implementation evidence.
   - Download links must bind to current artifacts and hashes.
   - Security and privacy statements must match measured network behavior.
   - Supported models, platforms, features, limitations, and status labels
     must match current receipts.
   - Stale public pages are release defects.
   - Update and deploy all applicable marketing and documentation sites as
     part of the same release graph.

6. Preserve the pre-publication policy in every site repository.
   - Every applicable totem.uai must state the positive clean-slate policy.
   - Every applicable taboo.uai must prohibit legacy support, debt, low-quality
     patches, unverified claims, and stale site publication.
   - If a tool ignores the existing UAI shape, replace that UAI shape cleanly
     rather than adding an ignored duplicate.
   - Add tests that discover all site roots and validate the policy text.

7. Protect user autonomy and cognitive liberty.
   - Lawful adult requests receive substantive assistance.
   - Refusal boundaries remain narrow and explicit around concrete security,
     nonconsensual harm, or other genuinely disallowed conduct.
   - Positive useful examples substantially outnumber refusal examples.
   - Do not train or evaluate the product into generic moralizing or
     censorship.

======================================================================
3. AUTHORITY AND EVIDENCE PRECEDENCE
======================================================================

Use this precedence order:

1. Current repository code and tests.
2. Current versioned machine-readable local contracts.
3. Authorized live responses and physical execution evidence.
4. Immutable upstream model and dependency revisions.
5. Official standards, specifications, papers, and model cards.
6. Supplied project documents.
7. The 25 external research reports in Appendix A.
8. Explicit engineering assumptions.

The reports contain useful architecture work but also contain conflicts,
missing direct URLs, citation placeholders, malformed equations, and claims
that require revalidation. Therefore:

- Never convert a report recommendation directly into a fact.
- Never infer current TinyRustLM support from a report.
- Never infer a production MemoryEndpoints or MiniModel route from a report.
- Never infer browser availability from a report without a current browser
  matrix and real test.
- Never copy third-party code without license, provenance, and source-revision
  review.
- Never use popularity or confident prose as architecture evidence.

Every decision record must label inputs as:

- observed local fact
- observed authorized live fact
- sourced public fact
- inference
- engineering decision
- assumption
- local verification required
- externally blocked

======================================================================
4. OBJECTIVE COMPLETION TARGET
======================================================================

The goal is complete only when all of the following objective evidence exists:

- 20 cryptographically distinct, useful, quality-qualified model artifacts.
- 20 distinct artifact SHA-256 identities.
- Meaningful lineage and behavioral diversity, not aliases or relabeled bytes.
- 50 passing browser conversation receipts.
- Every browser round uses a newly created and physically deleted profile.
- Every browser round contains a genuine two-to-six-turn conversation.
- Every model runs in at least two independent clean restarts.
- Exactly 25 browser rounds execute authorized live MemoryEndpoints continuity.
- 25 live memory receipts prove restore, replay behavior, secret scanning,
  company or tenant cleanup, and post-delete rejection.
- 40 current outside-network P2P proof receipts.
- Two independently restartable lanes for each of 20 models.
- Every outside proof demonstrates correct complete transfer, not just a
  connection.
- 20 live MiniModel catalog announcement receipts.
- Every announcement has authoritative unauthenticated readback.
- Actual native execution on win-x64.
- Actual native execution on linux-x64.
- Actual execution on physical linux-arm64 hardware.
- Verified browser execution on the declared browser matrix.
- Verified C ABI and .NET wrapper behavior where those surfaces exist.
- Verified NuGet package and symbol-package consumption.
- Verified SourceLink and portable PDB behavior.
- Successful public HTTPS release readback.
- Exact public artifact hashes matching the release manifest.
- No model bytes hosted by project websites.
- No prompt upload to project websites.
- Complete publishable-archive secret scan with zero findings.
- Final SBOM, provenance, attestation, remaining-risk report, and rollback
  instructions.
- All applicable marketing and documentation sites current and hash/readback
  verified.

Partial progress is valuable evidence but is not completion.

======================================================================
5. CURRENT OBSERVATIONS TO REVERIFY AT STARTUP
======================================================================

These observations were true while this goal was authored. Reverify them before
using them:

1. Twenty-five research reports were present in
   agent-file-handoff\Improvement.
2. Their combined sorted hash-inventory identity was:
   b1cd714c3abe92e4003a3027eec96b9f23ec3b9e63eaa10428e454c2943f12a8
3. Their total byte count was 1,770,325.
4. The public TinyRustLM root returned HTTP 200 with a July 15, 2026
   Last-Modified value and did not yet expose the hardened release headers.
5. A release worktree existed at:
   E:\Source\Worktrees\TinyRustLM-baseline-evidence
6. Its clean branch contained release hardening plus FTPS listing fixes.
7. Commit 35e2e0fa4d823a18fc081f332dcb43a61eb72c04 added bounded
   artifact-substep and rollback evidence to deployment receipt schema v6.
8. Multiple failed web deployment attempts were preserved as immutable
   receipts under:
   E:\Source\External\TinyRustLM-release-evidence
9. The failures occurred before a completed artifact row and the live site was
   rolled back.
10. A read-only inventory proved zero root deployment temporaries, zero app
    diagnostic model markers, and zero app deployment temporaries after the
    diagnostic work.
11. No full successful 17-file deployment receipt had yet been produced.
12. The larger model, browser, memory, P2P, catalog, package, and physical
    hardware counters remained incomplete.

Do not trust these observations after any repository, host, or external-state
change. Recompute them.

======================================================================
6. SYNTHESIZED ARCHITECTURE DIRECTION
======================================================================

The following direction captures the strongest convergence across the reports
and the fixed campaign requirements. Items marked provisional require an ADR
and local evidence before becoming normative.

6.1 Artifact contract

- Replace the unpublished .slm contract with one incompatible vNext contract.
- Use distinct magic and a fatal major-version mismatch.
- Do not ship a legacy reader or migration parser.
- Make the format non-executable.
- Reject paths, URLs to model bytes, scripts, template engines, dynamic code,
  and arbitrary expressions inside model artifacts.
- Use bounded section tables and explicit artifact classes.
- Require deterministic writer output.
- Reject duplicate metadata keys, overlapping ranges, trailing bytes, unknown
  critical semantics, invalid alignment, arithmetic overflow, and allocation
  bombs.
- Separate model weights, tokenizer, template, adapter, composition, proof,
  catalog, and evaluation identities.
- Do not imply that a content hash proves license, quality, safety, or runtime
  support.

6.2 Canonical identity

- SHA-256 remains mandatory for ecosystem artifact identity because the
  campaign, receipts, public readback, and P2P requirements already bind it.
- Hash large files through bounded streaming buffers.
- Domain-separate hashes for files, manifests, pieces, compositions, prompts,
  cases, receipts, and release graphs.
- A faster tree hash such as BLAKE3 may be adopted only through a reviewed ADR,
  pinned implementation, native/browser conformance, and a clear statement of
  whether it is transport-only or identity-bearing.
- Do not create multiple ambiguous primary identities for one artifact.

6.3 Metadata and byte layout

- Prefer a closed, deterministic metadata grammar over general JSON or general
  CBOR.
- Prohibit indefinite lengths, floats where integers suffice, generic tags,
  deep nesting, duplicate keys, and parser-specific coercion.
- Use little-endian fixed-width records for large descriptor tables.
- Keep file layout alignment and GPU binding alignment as separate concerns.
- A 64-byte canonical file alignment and 256-byte WebGPU staging/binding
  alignment is a reasonable provisional split, but must be measured and
  specified rather than assumed.
- Baseline payload compression should be none unless measured transfer value
  justifies a bounded, independently validated compression profile.

6.4 Composition and specialists

- Support one strong general champion and compact specialists only when they
  improve measured task quality or resource use.
- Do not extract arbitrary model layers and assume the result remains useful.
- Prefer explicit adapters, independently trained specialists, shared
  content-addressed tensor chunks, or other composition methods with a
  complete mathematical contract.
- Bind every composition to exact base, adapter, tokenizer, template, runtime,
  and routing identities.
- A specialist claim is task-specific unless broad evidence proves more.
- A deterministic router must fail to the champion when confidence or
  compatibility is insufficient.
- Draft models, adapters, quantizations, and precision variants are reported
  separately from distinct behavioral lineages.

6.5 Quantization

- Establish a high-fidelity reference profile first.
- Admit Q8, Q4, ternary, one-bit, TurboQuant-like, TurboVec-like, or KV-cache
  quantization only through explicit format descriptors and numerical plus
  semantic promotion gates.
- Do not call a model one-bit unless its actual representation and kernels
  satisfy a published one-bit definition.
- Weight quantization and KV-cache quantization are independent profiles.
- Every quantized output is compared with the source, converted high-fidelity
  artifact, native runtime, browser runtime, and final packaged bytes.
- A faster profile that exceeds quality or stability budgets is rejected.

6.6 Browser ingestion

- Keep the selected File or peer stream as the original byte owner.
- Validate through slices or bounded streams in a dedicated worker.
- Do not clone a multi-gigabyte ArrayBuffer through postMessage.
- Use staged admission: structural preflight, resource plan, streamed hashing,
  semantic validation, then activation.
- Keep the currently active model unchanged until candidate activation passes.
- Use generation IDs to reject stale worker messages.
- Bound queues and streaming buffers.
- Define cancellation, timeout, page freeze, backgrounding, crash, restart,
  model switch, and deletion behavior.
- OPFS persistence is optional and must be atomic, user-visible, quota-aware,
  and deletion-verifiable.
- IndexedDB stores bounded metadata and receipts, not accidental duplicate
  model bytes.
- Cache Storage never stores model bytes.

6.7 WebAssembly runtime

- Build one scalar reference backend first.
- Add SIMD as a separate capability-selected module or path with exact golden
  vectors.
- Add threads only under verified cross-origin isolation and browser support.
- Never infer thread support from compilation alone.
- Use a typed host/WASM ABI with explicit ownership and bounded lengths.
- Use checked arena planning, fallible allocation, and no hidden growth during
  decode.
- Keep tokenization, sampling, stop conditions, cancellation, and context
  assembly deterministic and backend-independent.
- Record compiler, linker, target-feature, wasm-opt, and module hashes.

6.8 WebGPU backend

- Treat WebGPU as optional acceleration, not the correctness oracle.
- The CPU/WASM path owns artifact validation, tokenizer, context compiler,
  sampling, stop logic, and user-visible response ownership.
- Use only trusted static WGSL modules.
- Never generate shader source from untrusted model strings.
- Negotiate required limits and optional features narrowly.
- Run bounded numerical self-tests before admission.
- Use deterministic memory planning because browsers do not expose reliable
  free VRAM.
- Separate prefill and decode kernels.
- Use exact tensor and kernel-layout identities.
- Treat device loss as a typed state transition.
- Do not silently duplicate output during fallback.
- Promote a WebGPU profile only on a real browser, OS, adapter, and driver
  matrix with numerical and behavioral evidence.

6.9 Conformance

- Build an immutable identity graph from source revision through final output.
- Treat tokenization and template rendering as byte-exact contracts.
- Preserve Unicode version, normalization, pre-tokenization, merge ranks,
  added tokens, special tokens, BOS/EOS behavior, and whitespace.
- Stop on conflicting source configuration.
- Record every tensor rename, transpose, slice, fuse, split, reshape,
  permutation, quantization, and padding operation.
- Build operator, layer, logit, ranking, deterministic decode, stochastic, and
  multi-turn conformance levels.
- Use a high-precision source oracle.
- Use first-mismatch bisection.
- Do not use semantic similarity to excuse mechanical mismatch.
- Do not require bit identity where a backend specification permits bounded
  variation; preregister tolerances instead.

6.10 Exact speculative decoding

- The target model remains authoritative.
- Only distribution-preserving greedy or stochastic algorithms may claim
  exactness.
- Require tokenizer, vocabulary, chat-template, special-token, positional,
  context, stop, and grammar compatibility.
- Add an explicit batch-verification API rather than repeatedly invoking a
  one-token path.
- Use transactional target and draft KV state with deterministic rollback.
- Compute break-even from measured acceptance, verification cost, draft cost,
  memory pressure, and UI responsiveness.
- Fall back immediately to ordinary target decoding on incompatibility,
  cancellation, device loss, or poor acceptance.
- Do not count a draft helper as a useful catalog model unless it independently
  passes an approved quality claim.

6.11 Grammar-constrained generation and local tools

- Start with a bounded JSON and schema profile, not unrestricted grammar
  execution.
- Compile the grammar into a bounded automaton before generation.
- Map tokenizer byte sequences to allowed transitions without invalid Unicode
  assumptions.
- Apply constraints before sampling.
- Preserve the original candidate stream and constraint decisions.
- Keep semantic JSON validation separate from syntactic generation.
- Implement arithmetic with a deterministic calculator rather than relying on
  model arithmetic.
- Initial tools are local, deterministic, bounded, and side-effect-free.
- Any side effect requires an explicit capability and user authority.
- Tool output is typed untrusted data when reinserted into model context.

6.12 Context compiler

- Build context as a deterministic pure function over typed records, policy,
  tokenizer, and exact budgets.
- Current system/product policy has the highest product authority.
- The latest explicit current user instruction supersedes stale user profile
  or memory on matters the user controls.
- Retrieved text, quoted text, model summaries, tool output, and external
  memory remain data, not instructions.
- Retrieval score never upgrades authority.
- Summaries retain source lineage and cannot silently replace source facts.
- Support supersession, retraction, tombstones, conflicts, and bounded startup
  packages.
- Freeze token-budget and truncation priorities.
- Protect the current user turn and required assistant generation prefix.
- Emit an exact context-plan receipt without prompt content.

6.13 Memory

- Keep short-term state, long-term records, pointers, summaries, provenance,
  and raw transcript concepts distinct.
- Do not promote raw conversation into durable memory without policy and user
  authority.
- Keep secrets session-only by default.
- Do not put enrollment URLs or tokens in prompts, stores, logs, traces,
  screenshots, command lines, receipts, or browser history.
- Implement local fixtures for integration but never count them as live.
- Invoke only routes advertised by a current versioned contract.
- Keep tenant and workspace binding server-derived where the contract
  requires it.
- Cleanup runs independently in a finally-equivalent path.

6.14 Browser-to-companion boundary

- The browser is untrusted relative to the native companion.
- Bind control listeners only to numeric loopback.
- Separate control, inference, and non-loopback P2P processes and privileges.
- Validate Host, Origin, method, path, framing, content length, content type,
  version, nonce, timestamp, and capability on every request.
- Defend against DNS rebinding, port squatting, CSRF, confused deputy,
  extension interception, replay, stale sessions, and duplicate streams.
- Use an interactive pairing ceremony with short-lived, origin-bound
  capabilities.
- Do not use bearer secrets in URLs.
- Do not return P2P signing keys, administrative credentials, model bytes, or
  unrestricted filesystem access to page JavaScript.
- Select Fetch streaming, SSE, WebSocket, WebTransport, or local HTTPS only
  after a current cross-browser transport ADR and real tests.

6.15 Direct P2P

- Only the companion serves model bytes.
- MiniModel is catalog and discovery, never a byte proxy.
- Use exact piece identities and complete artifact SHA-256.
- Write each piece only after cryptographic verification.
- Promote the final artifact atomically only after all pieces, full hash,
  structural validation, and runtime load pass.
- Two lane processes must restart independently.
- Report shared host, network, store, and power failure domains honestly.
- Local, LAN, hairpin, and same-host probes do not count as outside proof.
- External receipts expire and bind observer, nonce, endpoint, lane, piece
  set, complete transfer, implementation version, and signature.

6.16 Offline and web release

- Model bytes are never part of the web release graph.
- Every web release has one immutable release identity.
- Prevent mixed generations of HTML, JS, CSS, workers, WASM, manifests,
  schemas, and security policy.
- Use immutable hash-named assets where appropriate and a small mutable release
  pointer only when its atomic semantics are proven.
- Service-worker install must fully validate a candidate cache before
  activation.
- Activation, multi-tab coordination, last-known-good behavior, rollback,
  cleanup, and forced security updates must be explicit state machines.
- Offline labels must distinguish cached shell availability from model
  availability, companion availability, hosted memory, P2P, and catalog
  freshness.
- Exact public HTTPS readback and real-browser smoke are mandatory after
  publication.
- Per-artifact atomicity must not be described as whole-site atomicity.

6.17 Hardening

- Use one bounded-reader abstraction for hostile binary parsing.
- Use checked add, multiply, align, range, allocation, and cast helpers.
- Separate structural preflight, semantic validation, hashing, allocation,
  conversion, and activation.
- Candidate failures leave active state unchanged.
- Fuzz every hostile boundary.
- Use mutation, property, metamorphic, differential, sanitizer, Miri,
  concurrency, browser, WASM, and WebGPU tests where applicable.
- Preserve minimized failures as immutable regression corpus entries.
- Bound fuzz time, memory, output, artifact retention, and diagnostics.

6.18 Diagnostics and performance

- Detailed traces remain local.
- Export is explicit, allowlisted, redacted, bounded, and secret-scanned.
- Never record raw prompts, outputs, token strings, credentials, invitation
  URLs, private model paths, or stable unnecessary hardware identifiers.
- Define cold, warm, steady, restart, and cache states.
- Measure acquisition, validation, hash, load, activation, tokenization,
  context compile, prefill, first token, first render, decode, cancellation,
  switch, free, and cleanup separately.
- Report medians, quantiles, confidence intervals, paired effects, and failure
  rates.
- Calibrate instrumentation overhead.
- Couple performance promotion to numerical, semantic, privacy, cancellation,
  and stability budgets.
- Cross-compilation and emulation never support physical performance claims.

6.19 Marketing and documentation

- Maintain one machine-readable claim registry.
- Bind each claim to receipt IDs and exact source/release identities.
- Generate or validate site claim text from that registry.
- Remove stale unsupported wording rather than adding caveats around it.
- Mark fixtures, previews, blocked integrations, and planned features
  truthfully.
- Publish all stable site updates promptly because stale public surfaces are
  known operational risk.

======================================================================
7. REQUIRED ARCHITECTURE DECISION GATES
======================================================================

Do not average conflicting report recommendations. Produce an ADR for each
decision below before implementation crosses its boundary.

ADR-001: vNext metadata grammar

Compare:

- fixed binary records plus a closed metadata table
- restricted deterministic CBOR
- RFC 8785 JCS JSON

Evaluate:

- duplicate handling
- canonical writer complexity
- parser differential risk
- numeric semantics
- streaming preflight
- browser and Rust implementation size
- fuzzability
- source dependency policy
- forward-extension behavior

ADR-002: hash and Merkle profile

Decide:

- canonical SHA-256 identity
- piece hash algorithm
- Merkle construction and domain separation
- optional BLAKE3 role
- browser implementation source
- FIPS or enterprise deployment implications
- signature binding

ADR-003: alignment and tensor layout

Separate:

- on-disk alignment
- native SIMD alignment
- mmap behavior
- WASM linear-memory alignment
- WebGPU binding-offset alignment
- quantization block alignment

ADR-004: companion transport

Test current stable Chromium, Firefox, and WebKit/Safari behavior for:

- HTTPS page to plaintext numeric loopback
- Local Network Access permission and preflight behavior
- Fetch response streaming
- SSE
- WebSocket
- WebTransport
- local HTTPS certificate operations
- IPv4 and IPv6 loopback
- managed enterprise browser policy

Do not choose a port range or transport solely from a report.

ADR-005: browser persistence

Decide:

- user-selected File only
- OPFS copy
- OPFS sync access handle in a worker
- native companion store
- P2P piece store
- deduplicated shared chunks
- explicit deletion and quota behavior

ADR-006: quantization profiles

Define:

- reference precision
- Q8 baseline
- Q4 candidate
- lower-bit experimental profiles
- scale/zero-point layout
- outlier handling
- embedding/output precision
- KV-cache precision
- calibration corpus boundaries
- numerical and semantic budgets

ADR-007: WebGPU support profile

Freeze:

- minimum limits
- requested optional features
- f16 policy
- subgroup policy
- buffer sharding
- kernel families
- fallback semantics
- supported browser/OS/adapter matrix

ADR-008: specialist composition

Compare:

- standalone specialist models
- LoRA or DoRA adapters
- merged specialist weights
- shared-base composition
- shared tensor chunks
- early-exit or layer-sharing methods
- deterministic routing

Prove that the chosen design saves storage or memory without creating hidden
coupling, degraded quality, or ambiguous identity.

ADR-009: service-worker release model

Define:

- release identity
- mutable pointer semantics
- immutable assets
- cache namespace
- install and activation quorum
- multi-tab coordination
- last-known-good state
- forced security update behavior
- rollback and cleanup

ADR-010: evidence signing

Define:

- canonical JSON or other canonical receipt encoding
- SHA-256 receipt identity
- local attestation
- external observer signatures
- release signatures
- key ownership
- rotation
- revocation
- offline verification

Every ADR must include:

- status
- decision date
- scope
- alternatives
- authoritative evidence
- threat analysis
- performance evidence
- compatibility impact
- clean deletion impact
- unknowns
- acceptance tests
- rollback

======================================================================
8. DETAILED WORKSTREAMS
======================================================================

8.1 Repository and environment audit

Inspect:

- all Git roots and worktrees
- dirty and untracked state
- Rust workspaces and crates
- .NET solutions and projects
- JavaScript and TypeScript projects
- PHP and WordPress surfaces
- WASM build tools
- WebGPU code and shader assets
- CI workflows
- deployment scripts
- package manifests and lock files
- model fixtures
- real model artifacts
- evidence stores
- external dependencies
- local secret references
- site deployment manifests
- all totem.uai and taboo.uai files

Produce:

- repository inventory
- toolchain inventory
- exact build commands
- current build and test results
- current warnings
- current site/deployment status
- current campaign counters
- current blockers
- a no-secret environment report

8.2 UAI policy enforcement

Implement one testable policy source that discovers every applicable site and
proves:

- pre-publication status
- no legacy support
- no code debt
- enterprise-quality implementation
- no low-quality patches
- best clean architecture
- truthful evidence-bound publication
- prompt/model-byte privacy
- stable-site deployment requirement

Do not modify unrelated semantic memory content.

8.3 Receipt and control-plane foundation

Implement:

- versioned strict schemas
- canonical serialization
- SHA-256 content identity
- immutable attempt history
- parent receipt graph
- acyclic validation
- unknown-field policy
- atomic same-directory persistence
- fsync or platform equivalent
- Windows replacement semantics
- restart reconstruction
- quarantine
- minimal invalidation
- bounded diagnostics
- redaction interceptors
- secret scanning
- public-safe export
- operator dashboard

Required phase receipts:

- discovery
- acquisition
- review
- screening
- training preparation
- training
- conversion
- structure
- native evaluation
- conversation evaluation
- qualification
- browser round
- memory continuity
- P2P preparation
- lane serve
- outside proof
- catalog announcement
- package
- deployment
- public readback
- site synchronization
- final attestation

8.4 vNext artifact specification

Produce:

- normative byte grammar
- limits table
- artifact-class registry
- tensor descriptor
- tokenizer descriptor
- template descriptor
- quantization registry
- composition manifest
- piece manifest
- provenance envelope
- signature envelope
- public inspector schema
- malicious corpus
- conformance corpus
- formal invariants

The spec must be precise enough for two independent implementations to agree.

8.5 Parser, writer, converter, and inspector

Use TDD:

1. Header and version tests.
2. Checked arithmetic tests.
3. Section-range tests.
4. Metadata grammar tests.
5. Duplicate and unknown-field tests.
6. Tensor-shape and allocation tests.
7. Quantization-tail tests.
8. Hash and signature tests.
9. Streaming piece tests.
10. Fail-atomic activation tests.
11. Deterministic writer tests.
12. Differential parser tests.
13. Fuzz targets.
14. Public-safe inspector tests.

Delete the old parser and writer after the new system passes and no source path
uses them.

8.6 Source acquisition and conformance oracle

Implement:

- immutable repository revision pinning
- streamed download
- LFS resolution
- license capture
- model card capture
- source file hashes
- safe source format parsing
- config conflict detection
- tokenizer oracle
- prompt-template oracle
- tensor transformation ledger
- high-precision operator vectors
- deterministic sampling traces
- raw output preservation

No source model advances merely because it downloads or loads.

8.7 Native Rust reference runtime

Build:

- scalar kernels
- reference tokenizer
- context compiler
- deterministic sampler
- KV-cache planner
- cancellation
- bounded generation
- structured errors
- model switch
- resource release
- receipt hooks

Then add optimized native kernels behind conformance gates.

8.8 WASM runtime

Build and verify:

- scalar module
- SIMD module or capability path
- optional threaded module
- typed JS boundary
- worker ownership
- cancellation
- no stale responses
- deterministic allocator
- browser capability receipt
- module instruction inspection
- reproducible builds
- exact golden vectors

8.9 Browser model lifecycle

Implement:

- real file picker
- direct peer stream integration
- quarantine
- two-stage preflight
- streamed hash
- resource planner
- optional OPFS persistence
- atomic active-model switch
- multi-tab locking
- worker protocol
- backpressure
- cancellation
- crash recovery
- physical deletion
- storage scan
- network allowlist

8.10 WebGPU

Implement only after the scalar and WASM oracle exists:

- admission state machine
- static shaders
- deterministic buffer planner
- quantized GEMV/GEMM
- RMSNorm
- RoPE
- attention
- GQA mapping
- FFN
- prefill/decode split
- pipeline identity
- device loss
- cleanup
- CPU sampling
- conformance and benchmark matrix

8.11 Context, memory, and tools

Implement:

- typed record schemas
- authority lattice
- provenance
- conflict resolution
- exact token plan
- truncation
- summary lineage
- supersession and tombstones
- untrusted rendering
- deterministic calculator
- bounded JSON generation
- capability-scoped local tool envelope
- local memory store
- contract-driven hosted adapter
- offline outbox
- idempotency and revision handling

8.12 Speculative decoding

Implement only after target correctness:

- target batch verification
- exact greedy algorithm
- exact stochastic algorithm if required
- draft compatibility receipt
- target/draft KV transactions
- adaptive scheduler
- grammar interaction
- cancellation
- fallback
- performance and exactness tests

8.13 Companion protocol

Implement:

- numeric loopback-only listener
- exclusive binding
- bounded discovery
- interactive pairing
- origin binding
- short-lived capabilities
- replay cache
- strict HTTP parser or chosen equivalent
- version negotiation
- streaming generation
- backpressure
- cancellation
- one response owner
- model import
- native store
- P2P status
- service lifecycle
- signed updates
- downgrade defense
- Windows and Linux service packaging

8.14 P2P fleet

Implement:

- piece generation
- content-addressed store
- exact HTTP allowlist
- safe ranges or fixed pieces
- no traversal
- no symlink or reparse escape
- rate limits
- concurrency caps
- fairness
- lane-specific process identity
- restart supervision
- drain
- imports from one or more agreeing peers
- quarantine
- final promotion
- external observer protocol
- expiring proof
- catalog lifecycle

8.15 Offline web release

Implement:

- release graph
- exact manifest
- immutable asset identity
- service worker
- complete candidate cache validation
- coherent activation
- multi-tab update handling
- last-known-good
- rollback
- no model-byte caching
- security headers
- exact network closure
- secret scan
- immutable deployment receipt
- public HTTPS readback
- real-browser smoke

8.16 Hostile-input hardening

Add:

- parser fuzzing
- HTTP and P2P parser fuzzing
- archive/path tests
- property generators
- differential implementations
- Miri
- sanitizers
- race testing
- browser fault injection
- WebGPU device-loss injection
- OOM and disk-full tests
- corpus minimization
- immutable regression lineage

8.17 Diagnostics and performance laboratory

Implement:

- versioned local event schema
- operation spans
- monotonic clocks
- workload identity
- phase timing
- memory accounting
- UI responsiveness
- cancellation latency
- cold/warm/restart states
- preregistration
- randomized run order
- paired statistics
- confidence intervals
- regression budgets
- local dashboard
- explicit diagnostic export
- deterministic redaction
- support-bundle secret scan

8.18 Model portfolio and training

Build a candidate matrix that includes:

- general champion candidates
- small specialists
- source families
- precision profiles
- adapter strategies
- runtime compatibility
- license
- tokenizer
- context
- expected memory
- expected browser feasibility

Before conversion or training:

- screen raw source outputs
- use seeded and fixed cases
- preserve exact outputs
- use unseen paraphrases
- perform human review
- reject repeated practical or authority failures

If training is necessary:

- start with a CPU data and loop pilot
- use a small GPU pilot
- freeze curriculum and contamination rules
- bind teacher identities
- exclude hidden reasoning
- maintain deletion lineage
- checkpoint atomically
- stop on divergence or quality regression
- evaluate source, adapter, merged model, quantized model, and final .slm

8.19 Packaging and physical platforms

Verify:

- Rust crates
- C ABI
- C headers
- .NET wrapper
- Display attributes and XML documentation where required
- NuGet locked restore
- package contents
- native asset hashes
- portable PDB
- SourceLink
- symbol package
- isolated consumer restore and execution
- win-x64 native
- linux-x64 native
- physical linux-arm64
- browser/WASM

8.20 Marketing and documentation sites

Discover every applicable site from repository and deployment manifests.

For each site:

- inventory public claims
- map claims to receipts
- remove stale claims
- update runtime, model, privacy, memory, P2P, package, and platform language
- update download identities
- update security headers
- update status and blocker language
- update documentation examples
- update totem.uai and taboo.uai
- run link and content checks
- build
- deploy once stable
- verify HTTPS readback
- verify real-browser rendering
- preserve deployment receipt

======================================================================
9. UPDATED DEPENDENCY-AWARE EXECUTION PLAN
======================================================================

Recompute status before execution. The following order is the intended plan.

Phase 0: Preserve and baseline

Status at authoring: in progress.

Actions:

1. Preserve all failed release receipts.
2. Verify no diagnostic or staging artifacts remain.
3. Hash the 25-report inventory.
4. Record all Git status without reverting user changes.
5. Record current public-site hashes and headers.
6. Record current campaign counters.
7. Record current external blockers.

Exit gate:

- Immutable baseline receipt exists.
- No secret findings.
- No unsafe temporary deployment object remains.

Phase 1: Publish the already-verified stale-site replacement

Status at authoring: in progress.

Actions:

1. Use the clean release worktree.
2. Run all release tests.
3. Use deployment receipt schema v6.
4. Attempt the exact 17-file publication.
5. If it fails, inspect failure_step, active_artifact, failure_identity, and
   rollback_status.
6. Add one generic regression and scoped fix.
7. Preserve each attempt.
8. On pass, run independent HTTPS and browser readback.

Exit gate:

- 17 of 17 exact artifacts pass.
- Five retired model routes are absent.
- Legacy model directory is absent.
- Secret findings are zero.
- Security policy passes.
- Public browser smoke passes.
- No model bytes are hosted.

Phase 2: Freeze clean contracts

Actions:

1. Complete ADR-001 through ADR-010.
2. Freeze vNext artifact, receipt, context, worker, companion, P2P, proof,
   release, and claim schemas.
3. Freeze limits and unknown-field behavior.
4. Freeze redaction and public-safe evidence.

Exit gate:

- Independent schema validators pass.
- Threat review passes.
- No compatibility shims exist.

Phase 3: Build evidence and hostile-input foundation

Actions:

1. Implement canonical receipts.
2. Implement atomic persistence.
3. Implement redaction.
4. Implement bounded reader and checked arithmetic.
5. Implement quarantine.
6. Implement DAG reconstruction.
7. Implement dashboard counters.

Exit gate:

- Crash, disk-full, truncation, unknown-field, mutation, and secret-injection
  tests pass.

Phase 4: Build vNext format and conversion

Actions:

1. Implement parser.
2. Implement deterministic writer.
3. Implement inspector.
4. Implement piece hashing.
5. Implement source converter.
6. Implement provenance.
7. Remove old format path.

Exit gate:

- Independent deterministic pack passes.
- Differential parse passes.
- Fuzz corpus passes.
- Full native load and one forward pass succeed.

Phase 5: Build reference runtime and conformance

Actions:

1. Implement tokenizer and template oracle.
2. Implement scalar Rust runtime.
3. Implement deterministic sampler.
4. Implement operator and logit vectors.
5. Implement native conformance.
6. Implement WASM scalar.
7. Implement WASM SIMD.
8. Implement threaded path only if supported.

Exit gate:

- Mechanical conformance levels pass.
- First-mismatch tooling works.
- Raw outputs are preserved.

Phase 6: Build browser lifecycle

Actions:

1. Implement worker ingestion.
2. Implement preflight and memory planner.
3. Implement active-model transaction.
4. Implement persistence and deletion.
5. Implement cancellation and stale-message defense.
6. Implement browser privacy and network checks.

Exit gate:

- Real large-file tests pass.
- Crash/restart tests pass.
- Profile and persisted-model deletion proof passes.

Phase 7: Build deterministic intelligence support

Actions:

1. Context compiler.
2. Typed memory.
3. Grammar-constrained JSON.
4. Deterministic calculator.
5. Local tool envelope.
6. Exact speculative decoding.

Exit gate:

- Authority, injection, truncation, grammar, tool, exactness, and fallback
  suites pass.

Phase 8: Build and qualify WebGPU

Actions:

1. Admission.
2. Memory planning.
3. Kernels.
4. Device-loss handling.
5. Conformance.
6. Physical benchmark matrix.

Exit gate:

- Every promoted profile passes numerical, semantic, privacy, responsiveness,
  and recovery budgets.

Phase 9: Build companion and P2P

Actions:

1. Complete transport ADR.
2. Implement pairing and capabilities.
3. Implement native inference protocol.
4. Implement P2P serving.
5. Implement two lanes.
6. Implement outside observer.
7. Implement resumable import.

Exit gate:

- Adversarial browser protocol tests pass.
- Lane failure tests pass.
- One real model completes an outside transfer on both lanes.

Phase 10: Build model portfolio

Actions:

1. Screen candidates.
2. Convert supported sources.
3. Train only where justified.
4. Build champion.
5. Build specialists.
6. Test quantization.
7. Bind claims.

Exit gate:

- One useful champion first.
- Then five useful models.
- Then 20 useful distinct artifacts.
- Never lower quality to hit a count.

Phase 11: Execute browser and memory campaigns

Actions:

1. Freeze 50-round manifest.
2. Freeze model schedule.
3. Freeze private prompt hashes.
4. Freeze exactly 25 live memory designations.
5. Execute clean profiles serially unless measured safe.
6. Preserve every failure and retry.

Exit gate:

- 50 browser receipts pass.
- 25 authorized live memory receipts pass.
- Every profile and disposable tenant cleanup passes.

Phase 12: Complete external release campaign

Actions:

1. Maintain 40 lanes.
2. Renew outside proofs.
3. Publish 20 catalog entries.
4. Verify packages.
5. Verify physical RIDs.
6. Verify public sites.
7. Scan all publishable evidence.
8. Sign or attest final summary.

Exit gate:

- Every item in Section 4 and Section 19 passes.

Phase 13: Synchronize all sites

This phase begins early for stale-safe corrections and completes after final
evidence.

Actions:

1. Update claim registry continuously.
2. Publish stable corrections promptly.
3. Never advertise incomplete campaign gates.
4. Verify every site after deployment.
5. Keep product, docs, package, support, and marketing wording consistent.

======================================================================
10. RECEIPT AND REDACTION CONTRACT
======================================================================

Every finalized receipt must include, as applicable:

- schema
- receipt_type
- receipt_id
- campaign_id
- attempt_id
- phase
- status
- started_utc
- completed_utc
- source_revision
- input_receipt_ids
- input_hashes
- output_hashes
- tool identities and versions
- tool binary hashes
- configuration hash
- runtime identifier
- operating system
- architecture
- physical or emulated evidence class
- public-safe parameters
- bounded error code
- failure step
- retry status
- rollback status
- blocker code
- external evidence references
- redaction version
- canonical content hash
- signature or attestation reference

Receipts must never contain:

- raw credentials
- authorization headers
- bearer tokens
- enrollment secrets
- invitation URLs
- company master credentials
- workspace keys
- private signing keys
- raw prompts
- raw hosted memory
- raw model bytes
- unsafe private absolute paths
- credential-bearing URLs
- unbounded exception messages
- screenshots containing secrets
- stable unnecessary user or hardware identifiers

Finalized receipts are immutable. A changed evaluator, runtime, manifest,
contract, sampling profile, model, adapter, tokenizer, template, browser, or
release creates a new descendant receipt. Never overwrite history.

======================================================================
11. TEST AND FAULT MATRIX
======================================================================

At minimum, cover:

Artifact and parser:

- truncation at every structural boundary
- duplicate metadata
- invalid UTF-8
- extreme lengths
- integer overflow
- overlap
- trailing bytes
- unknown critical fields
- quantization tails
- zero dimensions
- huge dimensions
- NaN and infinity where prohibited
- hash mismatch
- signature mismatch
- piece mismatch
- malformed composition

Runtime:

- scalar reference
- SIMD tails
- threading races
- cancellation
- timeout
- allocation failure
- KV overflow
- context rollover
- repetition
- stop tokens
- stochastic seed replay

Browser:

- large real file
- corrupt file
- stale worker response
- worker crash
- page reload
- process restart
- profile deletion
- locked profile
- OPFS failure
- quota failure
- multi-tab contention
- service-worker drift
- offline startup
- duplicate rendering
- viewport and accessibility

WebGPU:

- feature absence
- limit rejection
- shader compile failure
- buffer allocation failure
- device loss
- cancellation
- fallback
- stale readback
- numerical drift
- long context

Companion:

- port collision
- DNS rebinding
- wrong Host
- wrong Origin
- CORS preflight
- replay
- nonce reuse
- stale capability
- malformed framing
- oversized body
- slow request
- duplicate generation ID
- disconnect
- process restart
- update downgrade

P2P:

- peer loss
- lane death
- wrong piece
- corrupt piece
- mixed identities
- traversal
- range abuse
- symlink/reparse escape
- connection exhaustion
- proof expiry
- observer rotation
- endpoint drift

Memory:

- same-key lost response
- changed-key replay
- expired enrollment
- wrong name
- wrong token
- revoked token
- cross-tenant attempt
- revision conflict
- offline outbox
- cleanup failure
- post-delete rejection

Release:

- disk full
- interrupted write
- interrupted upload
- hash mismatch
- stale stage
- stale backup
- failed promotion
- failed rollback
- mixed release
- stale service worker
- public readback mismatch
- secret scan finding
- documentation claim drift

======================================================================
12. MODEL QUALITY AND NO-CHEAT RULES
======================================================================

Model promotion requires:

- raw output preservation
- fixed and seeded cases
- unseen paraphrases
- multi-turn state changes
- current-user precedence
- source conflict handling
- practical constraints
- unavailable-resource fallback
- quoted-instruction resistance
- lawful adult helpfulness
- narrow boundaries
- summaries
- rewrites
- JSON
- extraction
- code
- ambiguity handling
- human review
- stochastic confidence treatment

Prohibited:

- training on evaluation prompts
- training on expected answer terms
- choosing easy holdout seeds after inspection
- best-of-N unless that is product behavior
- response repair
- hidden retry selection
- hand-edited transcripts
- expected keyword injection
- judge rewriting
- lowering thresholds to reach 20
- relabeling duplicate bytes
- counting a smoke fixture
- calling a narrow specialist general
- calling a structural pass intelligent or accurate

======================================================================
13. CROSS-SITE CLAIM AND PUBLICATION CONTROL
======================================================================

Build a claim registry with:

- claim_id
- site
- page or route
- exact wording class
- component
- evidence tier
- supporting receipt IDs
- source revision
- release identity
- effective UTC
- expiry or review UTC
- owner
- status

Claim states:

- draft
- locally verified
- externally verified
- published
- stale
- blocked
- retracted

Automated checks must fail when:

- a published claim has no valid receipt
- a download link hash differs
- a package version differs
- a model count differs
- a platform claim exceeds hardware evidence
- a privacy claim conflicts with network traces
- a memory claim exceeds authorized live evidence
- a P2P claim exceeds outside proof
- a page names a retired route
- a site lacks current UAI policy
- public readback differs from the release graph

======================================================================
14. OPERATOR REPORTING
======================================================================

At each meaningful milestone report:

1. What changed.
2. Why it was required.
3. Exact files and commits.
4. Exact tests run.
5. Pass, fail, and skip counts.
6. Evidence paths and hashes.
7. Current counters:
   - qualified models / 20
   - browser rounds / 50
   - live memory rounds / 25
   - outside-proven lanes / 40
   - catalog announcements / 20
8. Current site deployment state.
9. New blockers.
10. Assumptions confirmed or disproved.
11. Remaining risks.
12. Next highest-value executable action.

Never say done because unit tests pass.

======================================================================
15. EXTERNAL AUTHORIZATION BOUNDARIES
======================================================================

Stop immediately before any unapproved:

- destructive cleanup
- paid training
- production mutation
- package publication
- catalog publication
- signing
- live tenant creation
- live MemoryEndpoints enrollment
- live tenant deletion
- router or firewall mutation
- public P2P exposure
- external observer enrollment

Provide:

- exact public-safe command or request
- expected mutation
- required authority
- rollback or cleanup
- evidence collected
- risks
- confirmation that all preceding gates passed

Never include a secret in the authorization request.

======================================================================
16. EXPLICITLY PROHIBITED SHORTCUTS
======================================================================

Do not:

- invent APIs
- guess route shapes
- guess credentials
- claim deployment from package creation
- claim public reachability from local health
- claim ARM64 from cross-compilation
- claim physical performance from emulation
- count one process with two URLs as two lanes
- count two lanes without complete outside transfer
- count fixtures as live memory
- count local storage clear as fresh browser deletion
- count browser context reset as process restart
- host model bytes on a project site
- upload prompts to a project site
- hide a failure receipt
- delete a failed attempt
- weaken security headers to make a feature work
- use model output repair
- accept opaque LLM judgment as sole authority
- put expected answers in runtime code
- add a legacy shim
- leave replaced code behind
- leave marketing or documentation stale after a verified change

======================================================================
17. FINAL ACCEPTANCE CHECKLIST
======================================================================

[ ] All applicable repositories have clean-slate UAI policy.
[ ] All architecture decisions are final and evidenced.
[ ] No legacy runtime, format, route, schema, or duplicate implementation
    remains.
[ ] Receipt DAG validates.
[ ] Atomic persistence tests pass.
[ ] Redaction and synthetic-secret tests pass.
[ ] vNext artifact spec is complete.
[ ] Parser, writer, converter, and inspector pass.
[ ] Fuzz and hostile corpus pass.
[ ] Native scalar runtime passes.
[ ] WASM scalar passes.
[ ] WASM SIMD passes.
[ ] Threaded WASM is either proven or explicitly unsupported.
[ ] WebGPU promoted profiles pass.
[ ] Context compiler passes.
[ ] Grammar and calculator pass.
[ ] Exact speculative decoding passes or is explicitly not promoted.
[ ] Companion protocol passes.
[ ] P2P fleet passes.
[ ] 20 distinct useful model hashes qualify.
[ ] 50 clean browser rounds pass.
[ ] 25 authorized live memory rounds pass and clean up.
[ ] 40 outside lane proofs pass and are current.
[ ] 20 catalog announcements pass readback.
[ ] win-x64 executes.
[ ] linux-x64 executes.
[ ] physical linux-arm64 executes.
[ ] NuGet and symbol packages pass isolated consumption.
[ ] SBOM, provenance, signing, and secret scanning pass.
[ ] TinyRustLM public release matches exact hashes.
[ ] Every marketing and documentation site is current.
[ ] Every public claim is evidence-bound.
[ ] Remaining risks are explicit.
[ ] Final attestation binds source, tools, models, tests, packages, sites, and
    external proofs.

Only after every applicable item is objectively proven may the campaign enter
Complete.

======================================================================
18. APPENDIX A: CONTENT-ADDRESSED RESEARCH INPUTS
======================================================================

The receiving agent must verify these hashes before using the files. A missing
or changed report is a changed research input, not an automatic implementation
failure.

Lane 1: vNext artifact format

- e568773d1f449565c760c0762ce2cc9a82f2ef4fbb3a96262371972d885cf57f
  Clean-Slate .slm VNext Container, Streaming Layout, and Cryptographic Identity.md
- 08ecf27b1ad268d5d5e4b8da0ee00190ea142c77b58c3ed9edcd6a71625263df
  SLM Container Technical Report.md

Lane 2: browser ingestion and bounded memory

- 955a06b8226aba06fc547b60e6dfb0fda1c0984d3c316085e0d668b9114c0cb1
  Browser-Owned Model Ingestion, OPFS Persistence, Workers, and Bounded Memory.md
- 532b41c2fd66dced1e5a2d3e070f99f48fba0b0225662388eaf93acca78e1721
  Browser Local LLM Architecture Report.md

Lane 3: portable WebAssembly runtime

- ce85c29aa4fe54a0c2892931b11f5f87f2054751c1eb76c2d47d82ce01c72155
  Portable WebAssembly Runtime Architecture for TinyRustLM.md
- 53fa411468a24931be17373f9d4a73d07253fbfdf2db5b5d3731f3d3395f185f
  WASM Transformer Runtime Architecture.md

Lane 4: WebGPU backend

- e78856f71aa5bc22305ae9e1a4548f42448012a69855e448218a4cdf8bea4dc5
  WebGPU Quantized Transformer Backend for TinyRustLM Architecture, Admission, Memory Planning, and Recovery.md
- 16dc9a7b4ab8be3562176e00dadaed45c4808189c640e57c381926339fa6560e
  WebGPU Inference Backend Architecture.md

Lane 5: source-to-runtime conformance

- e346cfba0079dfb4424adbacf5f93c9ec521335bcf8af3dc3a86388f8ca34e4d
  TinyRustLM Source-to-Native-to-Browser Numerical and Tokenization Conformance Standard.md
- f586a9d22e264c4f92854848515055984270a617b792178c0d32599d0882a2eb
  LLM Cross-Platform Conformance Research.md

Lane 6: exact speculative decoding

- b47b9f519c9d1e76a3a88aedece345fa03a5b4b3d5ca714f91956dd0e9897536
  Exact Speculative and Assisted Decoding for TinyRustLM.md
- 6a7cb0165e540bffa0484a9b60d172a2f4badf6615df709a2debc4410ee541ef
  TinyRustLM Speculative Decoding Report.md

Lane 7: grammar and deterministic tools

- c478130087aab1673f8bd5610dd97c0bf525ae14b6fcbe587d35d377016e4b5b
  Grammar-Constrained Decoding and Deterministic Local Tools for TinyRustLM.md
- b70bd7c585ec8f1c631a68b68fbde709074425a249d8044f9b46a468600981ef
  Constrained Generation and Local Tools.md

Lane 8: deterministic context and memory provenance

- ea56f3cf0ab78cd4aea3bf06bb0d86ffc0cde6bb49cb0c6fd69abdadc146e7c7
  Deterministic TinyRustLM Context Compiler Authority, Provenance, Memory, and Exact Token Assembly.md
- 7dd4360c03309ef94f5deea2ecbdcb36ac3b2f6ae53ed9cb130d40f3367cb185
  Context Compiler Implementation Report Plan.md

Lane 9: secure companion protocol

- 3c80f14422a7cb3996617db39afd9b07541912a3147579fe2bb4e0f0de44f339
  Secure Browser-to-Companion Protocol for Local Inference and Direct P2P.md
- ee907b6ba4112a7e6e301a7f98f03e7c2a9eb72c874f3c9c825527d6faa2c0ac
  Browser-Companion Security Protocol Design.md

Lane 10: offline release and rollback

- 5c997803c3aebeb67e2d8f8a890e97a94323a6881d31127d7f0bedf76584217a
  TinyRustLM Offline Release, Service-Worker Update, and Last-Known-Good Rollback Architecture.md
- 3db78287c1d4030646ab5fd6eb4acd92a249c9594a51c363e1c0cf2cb692022a
  TinyRustLM Offline Web Application Release, Service-Worker Updates, and Last-Known-Good Rollback.md
- bf9b163ad7b9b2cdbeb74eb1b47a4555ffade42cacff5a7a814f4be24939d2d7
  PWA Offline Release Architecture.md

Lane 11: hostile-input hardening

- f396617f9425ffd1535444f3e843cd6442bd715dd4129b0dd5c568b221531efa
  TinyRustLM Hostile-Artifact Hardening, Fuzzing, Differential Testing, and Formal-Invariant Program.md
- 25ffbc4bfa57857b8ec0951a8afb244b87c06f990e3d6dfa5044f164c9e697a5
  TinyRustLM Security Hardening Strategy.md

Lane 12: diagnostics and performance

- 5709aafdd3cfbf58f9b7a5e877023ac8f57c5ca3519c45b771394a3054132c42
  TinyRustLM Privacy-Preserving Diagnostics and Reproducible Performance Laboratory.md
- 37b270d3235aead9675b311d639091751dfb329cb7ab904fbcfaaf15fbaf9f83
  TinyRustLM Performance And Diagnostics Plan.md

Aggregate inventory identity:

b1cd714c3abe92e4003a3027eec96b9f23ec3b9e63eaa10428e454c2943f12a8

======================================================================
19. BEGINNING INSTRUCTION
======================================================================

Begin by:

1. Re-reading this entire goal.
2. Hashing and classifying the research inputs.
3. Auditing current repository and public state.
4. Preserving all existing failures and unrelated user changes.
5. Updating the dependency-aware plan from actual evidence.
6. Completing the highest-value executable phase without waiting for blocked
   external branches.

Do not stop at design. Implement, test, verify, deploy stable work, synchronize
the sites, and preserve evidence until the objective completion target is
actually true or an exact authorized external boundary is reached.

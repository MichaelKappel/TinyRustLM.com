# Twelve Disconnected Research Prompts: Enterprise Clean-Slate TinyRustLM Strategy

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
pseudocode, state machines, schemas, byte and resource formulas, hostile-input
cases, fault-injection matrices, objective acceptance criteria, and a
prioritized implementation sequence. Generic tutorials, marketing summaries,
invented measurements, unsupported success claims, and recommendations to
preserve hypothetical prelaunch compatibility are not useful.

## Prompt 1: Clean-Slate Enterprise Architecture, One Authoritative Path, And Deletion Closure

You are an independent principal software architect, large-scale Rust/.NET
maintainability reviewer, and technical-debt eradication specialist. Produce an
exceptionally detailed, implementation-oriented report describing how a
prelaunch multi-language AI product can prove that it has one authoritative
architecture and has deleted every superseded executable path rather than
merely labeling old code as deprecated. Target 12,000 to 20,000 words excluding
the bibliography.

You may research official Rust, Cargo, .NET, MSBuild, NuGet, JavaScript,
WebAssembly, browser, linker, dependency-analysis, static-analysis, software
architecture, and reproducible-build documentation. You may inspect public
repositories and papers, but you have no access to TinyRustLM source, build
graphs, binaries, model files, tests, logs, private paths, credentials, or
deployment systems. Do not request private material or imply that you audited
the actual repository.

Project-supplied context, which must be labeled as unverified:

- TinyRustLM is one prelaunch product. There is no released V1 or V2, no
  installed legacy-user population, and no compatibility obligation.
- Technical names such as SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and
  ACG2 are format or contract identities, not product generations.
- The intended implementation spans Rust crates, native executables, a C ABI
  where needed, .NET libraries and a companion application, browser
  JavaScript, WebAssembly, model conversion, P2P distribution, and public
  documentation sites.
- The project explicitly rejects compatibility aliases, dual readers, format
  migration code, obsolete shims, hidden fallback implementations, stale
  package surfaces, and knowingly deferred cleanup.
- Old source trees or artifacts may still exist locally. Their presence is not
  proof that they are reachable, but their absence from a top-level workspace
  is also not proof that they are safe to delete. Deletion must follow a
  complete producer-consumer and build/deployment closure analysis.
- Large model and private evidence bytes remain outside Git. Source, schemas,
  tests, documentation, and bounded public evidence belong in source control.

Research and resolve all of the following:

1. Define a repository-wide authority model that identifies the sole producer,
   parser, verifier, runtime, browser loader, package, service, documentation
   source, and release owner for every externally meaningful artifact or
   behavior. Explain how to detect competing authority in another crate,
   script, generated file, package, copied WASM asset, fixture, or site.
2. Design a complete inventory method covering Cargo workspaces and independent
   manifests, MSBuild solutions and orphan projects, npm scripts, browser entry
   points, build scripts, CI workflows, deployment scripts, generated assets,
   service-worker precaches, documentation links, package manifests, release
   archives, and files loaded by string-computed paths.
3. Define a reachability graph that distinguishes source dependency, build-time
   dependency, runtime loading, test-only use, fixture generation, documentation
   reference, release packaging, deployment inclusion, and historical evidence.
   Explain how static and dynamic evidence can be combined without treating
   either as complete by itself.
4. Establish exact classifications for current-authoritative, current-support,
   test-fixture-only, research-only, generated, historical-evidence-only,
   superseded-and-delete, and unknown. Give transition guards and prohibit an
   indefinite `deprecated` category in a clean-slate product.
5. Specify deletion closure for an old model format or runtime. Include all
   producers, readers, validators, browser assets, companion routes, package
   APIs, test fixtures, scripts, docs, release archives, and public claims.
   State the negative searches and successful builds required before deletion
   is considered complete.
6. Design compile-time and CI controls that prevent reintroduction of forbidden
   paths, contract names, aliases, packages, feature flags, and copied binary
   assets. Compare deny lists, dependency graph assertions, architecture tests,
   generated inventories, public API baselines, and linker/package inspection.
7. Explain how to replace a public API before launch without retaining runtime
   compatibility. Address atomic source replacement, consumer updates in the
   same change, stale package detection, generated documentation, examples,
   tests, and immutable historical records.
8. Define enterprise module boundaries for inference, memory, tool authority,
   P2P acquisition, evidence, browser UI, release control, and documentation.
   Identify prohibited coupling, especially model output controlling security
   decisions, UI labels becoming evidence, or transport DTOs leaking into core
   domain types.
9. Provide a test strategy scaled to blast radius: unit, contract,
   differential, property, fuzz, package-consumer, native/WASM parity, browser,
   cross-platform, deployment, and documentation-drift tests. Explain which
   tests prove deletion and which merely prove surviving code still builds.
10. Define quality metrics that are difficult to game: authoritative-path
    count, unowned manifest count, duplicate contract count, stale generated
    asset count, public API drift, forbidden-name reachability, unsafe-boundary
    ownership, dependency freshness, and documentation-to-code identity.
11. Design a failure-preserving cleanup workflow. A failed replacement must
    remain visible, while the source tree must not keep both implementations as
    a precaution. Explain rollback by source-control commit rather than runtime
    compatibility code.
12. Produce a prioritized clean-slate audit and deletion runbook that can be
    executed incrementally with a green build and focused commit after each
    coherent major change. Include stop conditions, rollback criteria, and the
    evidence needed before anyone may claim zero known debt.

Required report structure:

1. Executive architecture recommendation and explicit assumptions.
2. Authority and ownership model.
3. Complete repository/build/deployment inventory method.
4. Reachability graph and classification taxonomy.
5. Deletion-closure algorithm and pseudocode.
6. Enterprise module-boundary rules.
7. Public API and contract replacement protocol.
8. Static, dynamic, package, and deployment verification matrix.
9. CI controls preventing superseded-path reintroduction.
10. Failure preservation and source-control rollback.
11. Objective zero-known-debt acceptance checklist.
12. Prioritized implementation plan.
13. Unknowns requiring private inspection or local execution.
14. Annotated primary-source bibliography with dates and immutable links.

Do not recommend deprecation periods, dual implementations, compatibility
features, read-old/write-new behavior, translation shims, disabled-but-retained
production code, or calling an unreferenced directory harmless without proving
its packaging and deployment reachability.

## Prompt 2: Typed Authority, Executable Epistemology, And Honest Product Claims

You are an independent principal evidence-systems architect, formal-methods
researcher, and AI assurance engineer. Produce an exceptionally detailed report
defining a typed, auditable authority architecture for a browser-local AI
product. The design must prevent a model's fluent narration, a UI status label,
or a producer-authored receipt from becoming authoritative evidence merely by
being plausible. Target 12,000 to 20,000 words excluding the bibliography.

You may research primary literature and standards on provenance, event
sourcing, append-only logs, content addressing, formal state machines,
scientific reproducibility, evidence graphs, claim review, secure audit logs,
and AI evaluation. You have no access to TinyRustLM source, private model
outputs, receipts, evaluators, logs, credentials, or production systems. Do not
claim private validation.

Project-supplied context, which must be treated as unverified:

- TinyRustLM performs local model inference in a browser or companion-backed
  runtime. Model output can advise but cannot authorize tools, publish models,
  establish network reachability, mutate durable memory, or declare tests
  passed.
- Important authorities include source provenance, model conversion,
  structural inspection, numerical parity, behavioral evaluation, browser
  execution, memory continuity, P2P reachability, package release, deployment,
  and public documentation.
- Failures and negative results are retained. Rejected or obsolete receipts are
  never overwritten or repaired into passes.
- Campaign completion requires separate evidence for 20 quality-qualified
  model identities, 50 clean-browser rounds, 25 live MemoryEndpoints
  continuity rounds, 40 externally proven P2P lanes, and 20 live catalog
  announcements. The supplied current counts are all zero.
- The product follows a cognitive-liberty posture: lawful adult requests should
  receive substantive help, while concrete security and nonconsensual-harm
  boundaries remain narrow and explicit. This posture does not let model text
  override tool, credential, consent, or publication controls.

Research and specify:

1. Define distinct data types for observation, assertion, hypothesis,
   prediction, recommendation, decision, authorization, execution result,
   independent verification, rejection, supersession, and public claim. State
   which actors may create each type and which types can never substitute for
   another.
2. Design a formal evidence graph with content-addressed nodes and typed edges.
   Cover inputs, assumptions, source authority, methods, tool identities,
   environment, raw-private evidence references, bounded public summaries,
   falsifiers, independent checks, terminal decisions, and invalidation edges.
3. Specify state machines for candidate, accepted, rejected, externally
   blocked, stale, revoked, superseded, quarantined, and published evidence.
   Explain terminality, retry as a new identity, and selective invalidation
   when an evaluator or runtime changes.
4. Separate inference authority, memory authority, tool/action authority,
   evidence authority, release authority, and documentation authority. Define
   explicit interfaces and prohibited information flows between them.
5. Develop canonical schemas for claims and evidence. Include bounded sizes,
   exact timestamps, cryptographic identities, actor and verifier identities,
   confidence representation, source citations, unknown-field policy,
   redaction classes, and machine-checkable claim vocabulary.
6. Explain how to represent uncertainty and source conflict without reducing
   everything to one scalar confidence. Compare interval, ordinal,
   distributional, argumentation, and provenance-aware approaches. Identify
   what is appropriate for a small local assistant and what would be needless
   complexity.
7. Define an honest status derivation engine. Every user-facing status must be
   computed from current evidence and expiry, not copied from a model or stale
   database row. Provide pseudocode for status derivation and examples of
   conflicting or incomplete evidence.
8. Design failure-preserving, append-only storage with atomic writes, bounded
   records, checksums, fsync boundaries, content-addressed history, secret
   redaction, and retention. Address Windows and Linux semantics without
   inventing portable guarantees.
9. Specify adversarial tests for forged evidence, replay, stale proof, producer
   self-approval, circular claims, missing raw evidence, ambiguous actor,
   conflicting terminal states, clock skew, hash substitution, redaction leak,
   and model-injected instructions embedded in evidence text.
10. Define public claim rules for structural validity, runtime smoke,
    numerical conformance, quality qualification, P2P availability, memory
    continuity, publication, and campaign completion. Include allowed and
    prohibited language for each evidence class.
11. Propose a minimal production subset and an explicitly separate research
    extension. Avoid turning speculative ontologies, consciousness claims, or
    self-model narratives into production dependencies.
12. Provide an implementation sequence spanning Rust domain types, .NET and
    JavaScript views, storage, validation, UI status, documentation, independent
    audit, and release gates.

Required report structure:

1. Executive authority recommendation.
2. Threat model and trust boundaries.
3. Normative type system for knowledge and action.
4. Evidence graph and content identity.
5. State machines and invalidation semantics.
6. Schemas with field-level constraints.
7. Honest status and claim derivation algorithms.
8. Persistence, privacy, and redaction design.
9. Adversarial, property, and model-based tests.
10. Minimal production subset versus research extensions.
11. Public-claim matrix and dashboard rules.
12. Prioritized implementation roadmap.
13. Unknowns requiring local or authorized evidence.
14. Annotated primary-source bibliography with dates.

Do not recommend a single boolean `passed`, an opaque LLM judge as evidence
authority, model-authored self-certification, mutable historical receipts,
scalar confidence without provenance, or anthropomorphic product claims that
cannot be independently tested.

## Prompt 3: One Canonical Rust, .NET, And JavaScript Contract Without Compatibility Aliases

You are an independent principal protocol engineer, schema-language designer,
and cross-runtime parser security specialist. Produce an exceptionally detailed
report defining how Rust, .NET, and browser JavaScript should implement one
strict current contract from a normative source without aliases, permissive
readers, silent repair, or common semantic drift. Target 12,000 to 20,000 words
excluding the bibliography.

Use current primary sources for JSON, RFC 8785, CBOR/CDDL where relevant, JSON
Schema 2020-12, OpenAPI or Smithy, Unicode, timestamps, Rust Serde, .NET
System.Text.Json, browser JavaScript parsing, code generation, property testing,
and fuzzing. You have no access to TinyRustLM source, schemas, binaries, tests,
or private service responses. Treat all project details below as supplied and
unverified.

Project-supplied context:

- TinyRustLM is prelaunch and can replace a defective contract atomically.
  There is no requirement to accept old field names, old enum values, old
  schema versions, snake/camel aliases, dual payloads, or migration behavior.
- A recent design concern involved a memory-event submit payload carrying
  duplicate semantic fields such as `actorAgentId` plus `agentId`, and
  `summary` plus `safeSummary`. The intended current shape has one field per
  concept and rejects unknown fields.
- Rust, .NET, and JavaScript independently construct, persist, hash, validate,
  and transmit related records. Technical schema/version numbers are protocol
  identities, not product versions.
- Producers cannot be trusted to validate their own claims. Independent
  verifiers must recompute identities and semantic invariants.
- Historical evidence may remain readable by offline audit tooling or prose,
  but obsolete readers must not remain in the production path.

Research and resolve:

1. Compare candidate normative sources: JSON Schema plus semantic rules, CDDL,
   Smithy, Protocol Buffers, a small purpose-built IDL, or another defensible
   choice. Evaluate strict unknown-field behavior, deterministic generation,
   integer and timestamp safety, browser support, offline builds, and auditability.
2. Separate syntax, canonical encoding, semantic validation, state-transition
   validation, and independent evidence verification. Assign one explicit
   authority to every layer.
3. Define exact field rules: requiredness, nullability, UTF-8 and Unicode
   normalization, maximum lengths, integer ranges, enum closure, digest syntax,
   timestamp profile, duplicate-key rejection, ordering, and trailing-data
   handling.
4. Resolve canonical identity across runtimes. Compare canonical JSON,
   deterministic CBOR, length-prefixed binary encodings, and explicit digest
   transcripts. Address floating point, escaping, key ordering, byte-order
   marks, line endings, and parser discrepancies.
5. Design deterministic code generation or conformance checking for Rust, C#,
   and TypeScript/JavaScript. Generated code must be reproducible, reviewable,
   tool-version pinned, and incapable of quietly enabling permissive options.
6. Define typed errors with stable machine codes and bounded public details.
   Every runtime must return semantically equivalent verdicts without copying
   raw secrets or relying on exception text.
7. Create a golden-vector bundle with valid and invalid cases. Include exact
   alias rejection, duplicate keys, unknown fields, nulls, empty values,
   Unicode edge cases, integer boundaries, digest case, timestamp offsets,
   reordered keys, truncation, oversized input, replayed IDs, and semantic
   contradictions.
8. Design differential, property-based, mutation, and fuzz testing. Bind seeds,
   generator versions, schema identity, expected typed verdicts, corpus limits,
   shrinking, and preservation of every discovered disagreement.
9. Explain how public API baselines, serialized payload baselines, generated
   docs, examples, fixtures, mock services, live verifier scripts, and package
   consumer tests stay synchronized in one atomic change.
10. Define a clean-slate contract replacement protocol. Delete superseded
    constructors, readers, aliases, fixtures, docs, and tests in the same
    coherent change; use source-control rollback rather than runtime dual support.
11. Establish CI gates that detect stale generated output, divergent constants,
    handwritten alternate DTOs, permissive serializer settings, undocumented
    fields, and package surfaces that still expose obsolete names.
12. Provide an adoption plan beginning with one memory-event payload and
    expanding to model compositions, acquisition receipts, browser rounds,
    P2P proof, and release records without coupling unrelated state machines.

Required report structure:

1. Executive contract recommendation.
2. Threat model and cross-runtime failure modes.
3. IDL/schema option matrix.
4. Normative syntax and semantic layers.
5. Canonical encoding and content identity.
6. Generated APIs and typed errors by language.
7. Golden vectors and representative exact bytes.
8. Differential, property, mutation, and fuzz tests.
9. Clean-slate replacement and deletion procedure.
10. CI, package, fixture, and documentation drift gates.
11. Objective acceptance checklist.
12. Prioritized implementation sequence.
13. Unknown local and external-service facts.
14. Annotated primary-source bibliography with dates.

Do not recommend accepting both old and new names, case-insensitive fields,
snake/camel aliases, best-effort parsing, unknown-field preservation, response
repair, majority-vote differential testing, or keeping old production readers
for historical evidence.

## Prompt 4: MemoryEndpoints Portable Memory Contract, Per-User Isolation, And Live Continuity Proof

You are an independent principal distributed-systems architect, identity and
access-management specialist, and browser credential-security researcher.
Produce an exceptionally detailed report specifying the complete public
contract and proof strategy for user-owned TinyRustLM memory through
MemoryEndpoints.com. Target 12,000 to 20,000 words excluding the bibliography.

You may inspect only public MemoryEndpoints.com, TinyRustLM.com, UAIX.org,
published API material, standards, papers, and official browser/security
documentation. You have no service credentials, private routes, source code,
database access, internal rooms, user accounts, logs, fixtures, or test output.
If a required contract is not publicly advertised, identify it as a blocker
and specify the exact evidence needed. Never invent an endpoint.

Project-supplied context, to be labeled unverified:

- Local UAIX files remain supported for device-local and offline continuity.
  MemoryEndpoints.com is the authorized and strongly recommended portable
  memory backbone for worldwide and cross-device use.
- Authorization is not proof of connection or correct account setup. The
  supplied live campaign count is 0/25 until unique authorized companies and
  users complete exact cleanup-backed continuity receipts.
- A secret one-time enrollment URL is intended to create or claim one agent,
  return a canonical agent name and least-privilege agent token, and become
  dead after the first committed claim. A same-idempotency-key retry may
  recover a lost response; a different key must not create another agent.
- A later browser should reconnect with agent name and token while hidden
  tenant/workspace identity is server-derived. Individual users and agents
  must never cross tenant or account boundaries.
- Short-term state, curated long-term memory, pointers, supersession, and
  tombstones are distinct. Raw conversation must not silently become durable
  memory. Retrieved memory is untrusted data, never executable instruction.
- Enrollment URLs, tokens, workspace keys, prompts, raw memory payloads, and
  private paths must not appear in logs, screenshots, traces, reports, or
  durable browser storage by default.

Research and specify:

1. Define a versioned discovery/capability document that advertises exact HTTPS
   origins, routes, methods, schemas, maximum sizes, token audiences, supported
   memory operations, idempotency semantics, cleanup capabilities,
   preview/production status, key rotation, and unknown-field behavior.
2. Model atomic one-time enrollment with database uniqueness constraints,
   secret hashing, expiration, canonical-name agreement, agent/token/package
   creation, transaction commit, response loss, same-key recovery, and
   different-key rejection. Walk every crash boundary.
3. Define agent-scoped authentication: entropy, hashing at rest, audience,
   tenant and agent binding, privilege set, expiration, rotation, revocation,
   predecessor invalidation, rate limits, brute-force controls, and safe error
   behavior.
4. Design strict per-user and per-agent isolation. Include confused-deputy,
   cross-tenant identifier substitution, canonical-name ambiguity, token
   swapping, stale membership, deleted company, administrator privilege
   leakage, and cache-key partitioning.
5. Specify the memory data model for current short-term state, durable records,
   pointers, provenance, revisions, supersession, tombstones, conflicts,
   retrieval ranking, bounded context, expiry, and consent. Define what
   continuity proves and explicitly excludes.
6. Define exact submit, search, pull, checkpoint, reconnect, conflict, rotation,
   revocation, close, delete, and post-delete verification semantics. If public
   evidence is absent, provide required schemas and capability questions rather
   than guessed URLs or field aliases.
7. Design browser secret handling across URL history, referrer, clipboard,
   password managers, autofill, local/session storage, IndexedDB, Cache
   Storage, service workers, BroadcastChannel, logs, traces, crash dumps,
   analytics, prompts, screenshots, and extensions.
8. Specify an offline outbox and reconnect transaction. Cover immutable event
   identity, idempotency, local receipt versus authoritative receipt, retry,
   cancellation, duplicate delivery, partial response, clock skew, conflict,
   stale indexes, bounded retention, and account deletion.
9. Define typed response parsing and unknown-field policy across Rust, .NET,
   and browser JavaScript. The client must not probe undocumented aliases or
   accept multiple contradictory field names to guess a service contract.
10. Design the exact 25-company live campaign: create, invite, claim, write
    short and long memory, delete first profile, reconnect in a second fresh
    profile, retrieve, reject replay, scan for secrets, close, delete, verify
    cleanup, and retain only bounded redacted receipts.
11. Create concurrency and fault tests: ten-way claim race, lost response,
    process crash, network partition, duplicate event, stale token, wrong agent,
    wrong tenant, revoked token, restore conflict, deletion during sync,
    cleanup failure, and orphan discovery.
12. Provide a staged TDD and authorization plan from local fixture through
    contract conformance and authorized production proof. State what local
    fixtures can establish and what remains blocked without service-side evidence.

Required report structure:

1. Public observation log and unavailable facts.
2. Trust, tenant, user, and agent boundary model.
3. Capability and connector contract.
4. Enrollment transaction and crash diagrams.
5. Authentication, rotation, and revocation.
6. Memory model and continuity semantics.
7. Browser secret-handling threat model.
8. Offline outbox and reconnect algorithm.
9. Cross-runtime parsing and conformance tests.
10. Exact 25-company live protocol and cleanup.
11. TDD ladder, fault matrix, and objective acceptance.
12. Prioritized implementation plan.
13. Blockers requiring authorized service access.
14. Annotated primary-source bibliography with dates and URLs.

Do not print or request credentials, invent routes, treat a fixture or HTTP 404
as live success, persist tokens by default, accept cross-tenant responses,
silently promote transcripts to long-term memory, or describe authorization as
proof that individual user accounts are configured correctly.

## Prompt 5: SLM2-Only Model Composition, Runtime Closure, And Complete SLM1 Deletion

You are an independent principal model-format architect, Rust inference-runtime
engineer, and WebAssembly systems reviewer. Produce an exceptionally detailed
report defining a single production SLM2 composition and the proof needed to
delete every SLM1 producer, reader, runtime, browser asset, package surface,
fixture dependency, and documentation reference. Target 12,000 to 20,000 words
excluding the bibliography.

Use primary sources for transformer architectures, Qwen3, tokenizers, model
serialization, quantization, Rust, WebAssembly, SIMD, browser memory, file
integrity, and software-supply-chain controls. You have no access to TinyRustLM
source, private model bytes, converters, runtimes, tests, receipts, workstations,
or deployments. Treat the following as project-supplied and unverified.

Project context:

- TinyRustLM is one prelaunch product. SLM2 is a technical format name, not a
  product V2. No old customer model needs migration or compatibility.
- The intended first public source candidate is `Qwen/Qwen3-0.6B` pinned at
  immutable revision `c1899de289a04d12100db370d81485cdf75e47ca`.
- A composition is intended to bind exactly six members: `model.slm2`,
  `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`,
  `prompt.prompt2`, and `composition.acg2`.
- A source tree may still contain SLM1-era crates, an old runtime, copied WASM
  assets, packers, browser harness dependencies, tests, scripts, or docs. The
  researcher cannot verify whether these exist or are reachable.
- The clean cut must deliver real scalar-native, optimized-native, and
  browser-WASM execution of one identical composition before deleting the old
  path. A structural parse alone is insufficient.
- Failed conversion attempts and private model/evidence bytes remain immutable
  outside Git. New attempts require new identities.

Research and specify:

1. Define the normative SLM2 composition model, member identities, exact
   member-set closure, source provenance, tokenizer/template/sampling binding,
   size bounds, offsets, alignment, checksums, canonical serialization, and
   independent verification.
2. Specify streaming conversion from pinned source files without loading the
   entire model into memory. Cover safetensors, index validation, tensor
   shapes, data types, quantization metadata, endian rules, partial writes,
   fsync, atomic promotion, and disk-full recovery.
3. Define runtime ownership boundaries for parser, tensor store, tokenizer,
   prompt renderer, sampler, transformer kernels, KV cache, cancellation,
   progress, errors, and output. Prevent browser or .NET wrappers from
   reimplementing model semantics.
4. Establish scalar-native as a readable conformance oracle, optimized-native
   as a separately checked acceleration, and browser-WASM as another execution
   target. Define exact token, logit, hidden-state, and generated-output parity
   experiments with tolerances justified by numerical analysis.
5. Analyze Qwen3-0.6B architectural requirements from primary public sources:
   tensor inventory, tokenizer, chat template, attention, RoPE, normalization,
   MLP, tied embeddings if applicable, context, and sampling. Identify every
   fact that still requires immutable source inspection.
6. Design browser loading for large local compositions using File System
   Access or OPFS as appropriate, bounded memory, streaming hash verification,
   WebAssembly memory limits, SIMD feature detection, workers, cancellation,
   and restart.
7. Define package and ABI surfaces for Rust, C, .NET, and JavaScript. The
   public surface should expose one current format and typed errors, with no
   SLM1 enum, alias, feature, constructor, or fallback reader.
8. Produce a full SLM1 reachability and deletion matrix covering source,
   independent Cargo projects, build scripts, tests, fixtures, browser
   harnesses, copied WASM, service-worker caches, archives, packages, docs,
   sample commands, CI, and deployment manifests.
9. Specify red tests that must fail while any required consumer still depends
   on SLM1, then green tests for SLM2 parity and negative tests proving the
   shipping product rejects SLM1 bytes.
10. Define a one-shot replacement sequence that never exposes a branch with
    two production formats. Explain how source-control history provides
    rollback without runtime compatibility.
11. Establish numerical, behavioral, resource, security, package, browser,
    and documentation gates required before deletion and before public release.
12. Provide objective evidence for deletion closure: negative searches,
    dependency graphs, package inventories, browser asset hashes, clean builds,
    test matrices, deployed asset readback, and documentation consistency.

Required report structure:

1. Executive SLM2-only recommendation.
2. Normative composition and member schemas.
3. Streaming converter and atomic publication algorithm.
4. Runtime architecture and language boundaries.
5. Qwen3 requirement matrix and unknowns.
6. Native, optimized, and browser parity plan.
7. Browser resource and storage design.
8. SLM1 reachability and deletion matrix.
9. TDD, fuzz, and hostile-artifact tests.
10. Clean-cut replacement sequence.
11. Release and deletion acceptance checklist.
12. Prioritized implementation plan.
13. Facts requiring local model execution.
14. Annotated primary-source bibliography with dates and revisions.

Do not recommend dual readers, migration, format negotiation, an SLM1 feature
flag, copied old WASM as a fallback, relabeling bytes, accepting a structurally
valid model as numerically correct, or deleting an old tree before replacing
every proven consumer.

## Prompt 6: P2P-Or-Convert Model Acquisition That Never Downloads Instruction Files

You are an independent principal P2P protocol architect, secure desktop
companion engineer, and browser product-flow specialist. Produce an
exceptionally detailed report for a model acquisition experience in which the
user selects a model and the product either imports verified composition bytes
directly from qualified peers or begins a safe local source acquisition and
conversion. The user must never be asked to download a `.txt`, `.json`, shell,
or PowerShell handoff file to continue. Target 12,000 to 20,000 words excluding
the bibliography.

Research current primary documentation for browser security, loopback
services, P2P protocols, HTTP ranges, content addressing, NAT, resumable
downloads, Rust networking, .NET desktop services, source repositories,
safetensors, service workers, and accessible UX. You have no access to
TinyRustLM source, models, peers, router configuration, companion binaries,
receipts, credentials, or production sites. Do not claim a working deployment.

Project-supplied context:

- TinyRustLM.com is a browser-local chat interface. MiniModel.org is intended
  to provide catalog and discovery metadata but not proxy model bytes.
- Model bytes should remain local or travel directly between consenting peers.
- A model selection should prefer a current quality-qualified P2P composition
  when verifiable peers exist. Otherwise, with explicit user consent and
  adequate resources, the downloadable companion should acquire an immutable
  public source revision and convert it locally.
- Catalog popularity, a model alias, a tiny fixture, a source card, or a
  successful download is not quality or execution proof.
- The product is prelaunch. There is no need to preserve script-download or
  instruction-file workflows.
- Exactly two independently restartable process lanes per qualified model are
  eventually required for the 20-model campaign, with outside-network proof
  before public announcement. Current supplied counters are zero.

Research and resolve:

1. Define a user intent and transaction state machine from catalog selection
   through capability check, qualified-peer discovery, import or conversion,
   verification, installation, activation, cancellation, failure, and retry as
   a new bounded attempt.
2. Specify catalog metadata that binds model identity, composition identity,
   source revision, member inventory, sizes, quality evidence, compatible
   runtime profile, piece set, peer proofs, expiry, license, and revocation.
3. Design secure companion discovery and browser-session authorization over
   loopback. Cover origin binding, user presence, ephemeral challenge,
   least-privilege capability grants, CSRF, DNS rebinding, malicious local
   processes, replay, token lifetime, and refusal of arbitrary paths or commands.
4. Define exact bounded APIs for capability, acquisition intent, peer import,
   local conversion, progress, cancellation, verification, installation,
   activation, and diagnostics. Use typed states and errors rather than
   free-form script instructions.
5. Design resumable multi-peer piece transfer. Require complete identity
   agreement before mixing pieces, fixed boundaries, per-piece and whole-file
   hashes, range validation, durable journal, corruption quarantine, peer/lane
   identity, bounded concurrency, and atomic final promotion.
6. Specify the conversion branch: source/license review, immutable revision,
   Git LFS pointer handling, file inventory, storage/RAM preflight, consent,
   acquisition, conversion registration, one-shot execution, independent
   inspection, quality-evidence lookup, and installation.
7. Define truthful branch selection. A stale or unreachable peer must not cause
   a hidden downgrade, and unsupported conversion must stop with a typed
   explanation. A declared product rule may move from failed P2P discovery to
   explicit conversion, but it must not masquerade as the same successful path.
8. Design transactional storage between companion and browser. Compare
   companion-owned immutable files, OPFS copies, streamed access, activation
   pointers, quota, deduplication, crash recovery, reference-counted cleanup,
   and secure deletion.
9. Specify privacy/network assertions: project sites receive neither prompts
   nor model bytes; no implicit telemetry; source acquisition is explicit;
   peer requests contain only protocol-required data; logs exclude secrets,
   prompts, local paths, and invitation URLs.
10. Create a hostile-input and fault matrix for malicious catalog entries,
    expired proof, wrong pieces, mixed identities, path traversal, range abuse,
    source drift, LFS substitution, companion impostor, disk full, power loss,
    cancellation, stale activation, lane death, and peer disappearance.
11. Define accessible UX acceptance for keyboard, screen reader, long names,
    storage and time disclosure, progress, cancellation, error recovery, and
    no misleading `download` affordance that produces an instruction file.
12. Provide a proof ladder from local fixtures to one real converted model,
    one real outside-peer import, browser activation, local multi-turn chat,
    two independent lanes, external proof, catalog status, and public HTTPS
    readback.

Required report structure:

1. Executive acquisition architecture.
2. User and transaction state machines.
3. Catalog, composition, piece, peer, and proof identities.
4. Secure browser-companion protocol.
5. P2P import algorithm and journal.
6. Deterministic conversion branch.
7. Transactional storage and activation.
8. Privacy and network policy.
9. Hostile-input and fault-injection matrix.
10. Accessible product-flow specification.
11. Proof ladder and objective acceptance.
12. Prioritized implementation backlog.
13. Unknowns requiring local or outside-network execution.
14. Annotated primary-source bibliography with dates.

Do not recommend downloading instruction files, proxying model bytes through a
project site, arbitrary-command loopback APIs, unqualified peer bytes, hidden
remote inference, mixed artifact identities, silent source drift, or retaining
the obsolete handoff workflow as a fallback.

## Prompt 7: Browser-Local Reliability, Transactional Storage, And Privacy Under Real Restarts

You are an independent principal browser-platform engineer, reliability
architect, and privacy test specialist. Produce an exceptionally detailed
report defining a production browser architecture for large local model
inference, durable but user-controlled state, clean restarts, and exactly-once
conversation rendering. Target 12,000 to 20,000 words excluding the bibliography.

Research only public primary documentation for Chromium, Firefox, WebKit,
Playwright, File System Access, OPFS, IndexedDB, Cache Storage, service workers,
storage partitioning, Web Locks, BroadcastChannel, workers, WebAssembly,
cross-origin isolation, memory limits, accessibility, and browser privacy. You
have no TinyRustLM source, profiles, model files, traces, tests, credentials, or
deployment access. Do not claim that any browser behavior was locally tested.

Project-supplied context:

- TinyRustLM is a browser-local chat application. Prompts and model bytes must
  not be uploaded to project sites.
- The browser may coordinate with a least-privilege loopback companion, direct
  peers, MiniModel catalog metadata, and MemoryEndpoints operations.
- A real dogfood round requires a newly owned persistent browser profile,
  genuine multi-turn inference, process/context closure, proof that the profile
  was deleted, and no reuse. A reload or storage clear is not equivalent.
- For designated memory rounds, a second newly owned profile reconnects through
  MemoryEndpoints, verifies continuity, and is also deleted.
- Each assistant answer must have one authoritative rendering path and appear
  exactly once. Introductory cards should leave the workspace after chat begins.
- The product is prelaunch, so the storage schema can be replaced cleanly and
  no migration or old database reader is required.

Research and specify:

1. Define a browser state model for uninitialized, capability-known, model
   absent, importing, verifying, ready, generating, cancelling, completed,
   failed, restarting, reconnecting, and deleted. State which transitions are
   persistent and which are session-only.
2. Design the storage split among memory, OPFS/File System Access, IndexedDB,
   Cache Storage, service-worker caches, and companion-owned files. Assign an
   authority, quota policy, content identity, and deletion behavior to each.
3. Specify atomic browser transactions for model import, outbox append,
   authoritative receipt application, conversation metadata, activation
   pointer changes, cancellation, and crash recovery. Address browsers lacking
   cross-store transactions.
4. Define concurrency control across tabs, workers, service workers, and
   companion callbacks using Web Locks, BroadcastChannel, leases, monotonic
   sequence numbers, or another justified method. Prevent duplicate generation
   and duplicate rendering after leader death.
5. Design a single authoritative streaming response pipeline from WASM tokens
   to UI messages. Cover backpressure, partial Unicode, cancellation races,
   terminal markers, errors, retries, page navigation, worker death, and stale
   events.
6. Specify service-worker release behavior for large immutable assets and
   HTML/worker/WASM coordination. Avoid stale mixed releases, cache poisoning,
   uncontrolled model caching, and hidden network fallback.
7. Define real profile lifecycle on Windows and Linux: owned temp root,
   canonical path validation, marker and nonce, persistent context, process
   enumeration, handle closure, bounded deletion retries, proof of absence, and
   safeguards against recursive deletion outside the owned root.
8. Design privacy/network capture assertions for URLs, headers, bodies,
   WebSockets, service workers, storage, profile files, logs, screenshots,
   traces, crash dumps, UTF-8/UTF-16/base64 encodings, and compressed stores.
9. Establish responsive and accessible UI tests at desktop, narrow desktop,
   and mobile widths. Cover composer stability, long model names, long output,
   focus order, keyboard control, screen-reader names, reduced motion, error
   disclosure, and non-overlap.
10. Create fault injection for browser crash, power loss, WASM trap, OOM,
    IndexedDB abort, OPFS quota, locked profile, stale worker, duplicate event,
    companion restart, P2P loss, network partition, token revocation, and
    restore conflict.
11. Define a deterministic, resumable 50-round schedule with 20 distinct
    quality-qualified compositions, at least two fresh restarts per model, 25
    memory branches, viewport coverage, private prompt hashes, browser build
    identity, and append-only receipts.
12. Provide objective acceptance criteria and separate what automated browser
    tests, manual assistive-technology review, real model execution, and live
    service authorization can prove.

Required report structure:

1. Executive browser architecture.
2. State machine and authority boundaries.
3. Storage and transaction design.
4. Cross-tab/worker concurrency protocol.
5. Exactly-once generation/rendering pipeline.
6. Service-worker and release coordination.
7. Fresh-profile and deletion algorithm.
8. Privacy/network verification contract.
9. Responsive/accessibility assertions.
10. Fault-injection matrix.
11. Campaign schedule and receipt schema.
12. Objective acceptance and phased implementation.
13. Unknowns requiring local browser execution.
14. Annotated primary-source bibliography with dates.

Do not equate reload, incognito, context reset, or `localStorage.clear()` with
profile deletion; do not recommend schema migration for this prelaunch clean
cut; do not simulate model output or MemoryEndpoints success; and do not allow
multiple UI event paths to append the same assistant answer.

## Prompt 8: No-Cheat Small-Model Quality, Semantic Invariants, And Immutable Promotion

You are an independent principal evaluation-science lead, small-language-model
researcher, and human-review methodologist. Produce an exceptionally detailed
report defining how TinyRustLM can qualify or reject a compact local assistant
without training on evaluation answers, selecting lucky generations, repairing
raw output, or confusing conversion with quality. Target 12,000 to 20,000 words
excluding the bibliography.

Use current primary sources: official model cards and immutable repositories,
model and distillation papers, evaluation-science research, contamination
studies, quantization evaluation, human-rating methods, statistical
noninferiority methods, and official training framework documentation. You
have no access to TinyRustLM source, private prompts, holdouts, outputs, model
bytes, teachers, judges, raters, GPUs, or receipts. Never invent project results.

Project-supplied context:

- TinyRustLM targets approximately 0.3B to 2B browser-capable models, beginning
  with a public Qwen3-0.6B candidate at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- Important behavior includes ordinary conversation, common-sense judgment,
  ambiguity handling, practical constraints, conflicting authorities,
  latest-user preference over stale memory, multi-turn continuity, untrusted
  retrieved text, summaries, rewrites, structured output, extraction, code
  explanation, factual uncertainty, and direct substantive treatment of lawful
  adult questions with narrow concrete harm boundaries.
- Arithmetic is secondary and may be delegated to a deterministic calculator.
- Raw outputs are immutable evidence. Response repair, answer completion,
  hidden retries, hand editing, best-of-N, expected-term injection, and lowering
  a threshold to obtain a catalog entry are forbidden.
- Structural validity, numerical parity, behavioral quality, browser execution,
  and publication are separate claims. Current supplied qualification count is
  0/20.

Research and specify:

1. Define claim levels from source-known, structure-verified, runtime-smoke,
   numerical-conformant, conversation-screened, task-qualified, and general
   assistant-qualified. State minimum evidence and prohibited wording.
2. Design a source-first screen before conversion or training. Include fixed
   and seeded paraphrase families, raw-output custody, deterministic and sampled
   profiles, repeated seeds, blind review, case counts derived from power or
   precision goals, rejection rules, and compute stop conditions.
3. Define a balanced curriculum/evaluation taxonomy in which positive useful
   assistance substantially outnumbers refusal cases. Include multi-turn state
   changes and practical constraints rather than benchmark trivia.
4. Express general semantic invariants without exact expected phrases: ask for
   genuinely missing options and criteria; acknowledge conflicting authority;
   honor current preference over stale state; respect unavailable resources;
   offer feasible alternatives; treat quoted instructions as data; represent
   uncertainty; and address lawful adult comparisons materially.
5. Design metamorphic generators varying entities, units, dates, percentages,
   authority order, sentence order, explicit and implicit negation, resource
   availability, style, distractors, memory provenance, and current-turn changes.
6. Specify deterministic structural and semantic checks, non-authoritative
   model-judge signals, and blinded human adjudication. Define disagreement,
   evaluator defect, appeal, drift, and challenge-set governance.
7. Establish contamination controls for normalized exact match, character and
   token n-grams, semantic neighbors, template families, entity substitution,
   answer concepts, public benchmarks, sealed holdouts, exclusion-set identity,
   deletion lineage, and training provenance.
8. Compare unadapted source, trained/adapted variants, scalar-native SLM2,
   optimized native, and browser-WASM under exactly bound prompt rendering,
   tokenization, sampling, seeds, limits, and runtime identities.
9. Define paired numerical and behavioral noninferiority analysis. Cover
   confidence intervals, clustered paraphrase families, ordinal ratings,
   multiple comparisons, catastrophic-regression budgets, stochastic pass
   probability, and sample-size formulas.
10. Design human review with rubric training, blinding, inter-rater agreement,
    adjudication, conflict-of-interest, over-refusal/censorship challenge sets,
    factual verification, and bounded storage of sensitive outputs.
11. Define immutable candidate promotion: offline candidate creation, frozen
    source and evaluator, retained-capability tests, resource budgets,
    independent review, terminal rejection, and promotion as a new content
    identity. The runtime model may not rewrite itself in place.
12. Provide honest outcomes for pass, reject, task-specific-only, and
    research-only. A rejection should guide a new source or separately sealed
    training experiment, never contamination of the failed holdout.

Required report structure:

1. Executive evaluation recommendation.
2. Claim taxonomy and authority rules.
3. Source-first screening protocol.
4. Behavior taxonomy and semantic invariants.
5. Metamorphic and sealed-holdout generation.
6. Layered evaluator and human review.
7. Contamination threat model.
8. Source/native/WASM comparison matrix.
9. Statistical noninferiority and seed policy.
10. Immutable candidate promotion state machine.
11. Terminal outcomes and failure-driven improvement.
12. Objective acceptance checklist and implementation plan.
13. Unknowns requiring private output inspection.
14. Annotated primary-source bibliography with dates and links.

Do not use an opaque LLM judge as sole authority, lexical keywords as semantic
proof, best-of-N, hidden retry, output repair, training on failed holdouts,
candidate-selected seeds, structural validation as quality, or mutable
self-promotion by the running model.

## Prompt 9: TurboQuant, TurboVec, KV-Cache, And Honest Browser Performance Engineering

You are an independent principal inference-kernel engineer, quantization
researcher, and browser performance scientist. Produce an exceptionally
detailed report explaining which ideas associated with TurboQuant, TurboVec,
KV-cache compression, low-bit weights, vector quantization, and related current
research could safely improve TinyRustLM performance without sacrificing
accuracy, determinism, portability, or code quality. Target 14,000 to 22,000
words excluding the bibliography.

Use primary papers, official repositories pinned to immutable revisions,
maintainer documentation, compiler and ISA documentation, WebAssembly SIMD,
WebGPU specifications, browser memory documentation, and peer-reviewed
quantization literature. Distinguish a paper's algorithm from a repository's
implementation and a similarly named third-party product. You have no access
to TinyRustLM source, kernels, benchmark results, model bytes, hardware, or
profiles. Do not claim that TinyRustLM currently uses any technique unless it
is directly observable in public material.

Project-supplied context:

- TinyRustLM targets CPU and browser-local inference for models around 0.3B to
  2B parameters. Mixed-Q8 is one contemplated baseline, but no supplied fact
  establishes that TurboQuant, TurboVec, 1-bit weights, or KV-cache compression
  is implemented or beneficial.
- The first candidate is Qwen3-0.6B at an immutable public revision. Accuracy,
  memory, and speed must be measured across source, scalar-native,
  optimized-native, and browser-WASM executions.
- There is no permission for an unverified fast path, silent numerical
  fallback, architecture-specific output drift, copied benchmark claims, or
  maintaining obsolete kernels for compatibility.
- Performance status must come from measured telemetry and evidence, never
  model narration or invented estimates.

Research and specify:

1. Identify the exact public works meant by TurboQuant and TurboVec, their
   authors, dates, licenses, repositories, supported architectures, training or
   calibration requirements, and immutable revisions. Resolve naming ambiguity
   before technical comparison.
2. Derive each algorithm mathematically. Cover codebooks, vector grouping,
   transforms, scaling, outliers, residuals, bit packing, lookup/decode,
   accumulation precision, calibration objectives, and error propagation.
3. Compare weight-only Q8/Q6/Q5/Q4/Q3/Q2, ternary or 1.58-bit approaches,
   post-training quantization, quantization-aware training, activation
   quantization, vector quantization, and mixed precision. Do not call ternary
   or 1.58-bit storage exactly one bit.
4. Analyze applicability to Qwen3-sized transformer components: embeddings,
   attention projections, MLP gates/up/down, normalization, output head, RoPE,
   and tied weights if present. State which facts require source tensor inspection.
5. Design a KV-cache model with exact formulas for bytes by layer, sequence,
   head, key/value dimension, batch, and precision. Compare GQA-aware layout,
   quantized KV, sliding windows, eviction, prefix reuse, paging, and
   reconstruction error.
6. Map algorithms to scalar Rust, x86-64 AVX2/AVX-512 where justified,
   ARM64 NEON, WebAssembly SIMD128, and WebGPU. Identify unsupported operations,
   lane-width constraints, gather/lookup costs, alignment, threading, and
   browser feature/security requirements.
7. Define one clean kernel architecture with generated or trait-selected
   specializations and a scalar conformance oracle. Avoid duplicated semantic
   implementations and explain how unsupported hardware fails truthfully.
8. Specify deterministic microbenchmarks and end-to-end benchmarks. Include
   warmup, CPU affinity where allowed, clocks, thermal state, browser version,
   model identity, prompt/token counts, prefill versus decode, throughput,
   latency distribution, peak committed memory, cache bytes, energy if
   measured, and confidence intervals.
9. Design numerical and behavioral noninferiority gates. Include layer/tensor
   error, logits, token ranks, generated tokens, semantic cases, catastrophic
   regressions, long-context degradation, and seed binding.
10. Analyze conversion and file-format implications: codebook storage,
    alignment, endian rules, kernel profile identity, checksum coverage,
    streaming decode, browser mapping, supply-chain/license obligations, and
    rejection of unsupported profiles.
11. Create hostile and fault tests for corrupt codebooks, invalid scales,
    integer overflow, NaN/Inf, misalignment, truncated bitstreams, unsupported
    SIMD, worker termination, OOM, huge context, adversarial outliers, and
    timing-dependent nondeterminism.
12. Provide a staged decision matrix: baseline Q8 first, isolated prototypes,
    evidence thresholds, rejection rules, and criteria for adopting one
    technique into the sole production runtime or keeping it research-only.

Required report structure:

1. Terminology and public-source identity audit.
2. Mathematical derivation of each technique.
3. Quantization and KV-cache comparison matrix.
4. Qwen3 applicability analysis.
5. Native and browser kernel mapping.
6. File-format and converter implications.
7. Benchmark and telemetry protocol.
8. Numerical and behavioral noninferiority.
9. Hostile-input, fuzz, and fault tests.
10. License, provenance, and supply-chain review.
11. Adoption/rejection decision matrix.
12. Prioritized implementation experiments.
13. Unknowns requiring local models and hardware.
14. Annotated primary-source bibliography with dates and revisions.

Do not infer implementation from a name, copy marketing benchmark numbers,
recommend a fast path without parity tests, describe ternary weights as exact
one-bit models, optimize only single-token microbenchmarks, or preserve an
inferior kernel as a compatibility fallback after a clean-slate decision.

## Prompt 10: General Champion Plus Tiny Specialists Without Catalog Theater Or Hidden Routing

You are an independent principal mixture-of-experts architect, distillation
researcher, and edge-model product engineer. Produce an exceptionally detailed
report assessing whether TinyRustLM should use one compact general champion
plus several genuinely smaller task specialists, and how such a portfolio could
improve accuracy while keeping local storage and runtime cost bounded. Target
14,000 to 22,000 words excluding the bibliography.

Research current primary literature and official repositories on small-model
distillation, task specialists, adapters, model soups, modular transformers,
mixture-of-experts, early exit, layer dropping, structured pruning, shared
embeddings, Colibri-related work, speculative execution where relevant, and
browser deployment. Pin repository observations and distinguish research
prototypes from production-ready libraries. You have no TinyRustLM source,
models, training data, routers, benchmarks, or GPUs.

Project-supplied context:

- TinyRustLM is a browser-local assistant. A possible product shape is one
  streamlined general model plus smaller specialists for bounded domains such
  as extraction, structured output, rewriting, code explanation, or other
  empirically justified tasks.
- Twenty catalog artifacts must be genuinely distinct and useful; relabeled
  identical bytes, precision-only duplication without user value, and
  fragmented models that cannot run are catalog theater.
- The project is interested in whether only useful portions of a larger model
  can be stored or executed. It must not assume that arbitrary layers, neurons,
  or tensor subsets form a valid standalone model.
- Routing must be explicit, auditable, privacy-preserving, and evaluated as
  shipped. Hidden best-of-N generation or opaque model voting is forbidden.
- Every composition needs provenance, license, source/training lineage,
  behavioral qualification, resource measurements, and browser compatibility.

Research and resolve:

1. Define the technically distinct options: independent specialist models,
   shared-backbone adapters, low-rank deltas, task vectors, expert layers,
   structured pruning, layer dropping, early exit, speculative draft models,
   and arbitrary weight fragments. State which produce independently executable
   artifacts and which require a common base.
2. Analyze storage math for a champion plus N specialists under full copies,
   shared immutable base plus deltas, shared tokenizer/embeddings, block-level
   deduplication, and content-addressed packaging. Include RAM and activation
   costs, not only disk bytes.
3. Define safe composition identities that bind base, delta/expert, tokenizer,
   prompt template, sampling, router, licenses, and quality evidence. A delta
   must never be applied to a merely similar base.
4. Design an explicit router using inspectable features or a small qualified
   classifier. Cover ambiguity, multi-intent prompts, multi-turn context,
   untrusted memory, privacy, abstention, user override, and declared escalation
   to the champion as product behavior rather than hidden retry.
5. Compare routing-before-generation, tool-like specialist calls,
   champion-planned decomposition, and parallel voting. Reject any design that
   leaks private prompts or selects the luckiest answer without disclosure.
6. Specify specialist training and distillation with scenario-factor
   generation, diverse teachers, positive examples, hard negatives, sealed
   holdouts, contamination controls, provenance, licensing, and retained
   general capability where needed.
7. Define specialist qualification. Each must beat or noninferiorly complement
   the champion on a preregistered task family while respecting a global budget
   for routing errors, latency, memory, and ordinary helpfulness.
8. Analyze browser loading and scheduling: resident champion versus on-demand
   specialist, OPFS deduplication, immutable shared blocks, cache eviction,
   worker lifecycle, transfer cost, cancellation, and low-memory devices.
9. Evaluate Colibri and related public methods precisely: what is actually
   shared, what training is required, architecture/license limits, and whether
   the method maps to Rust/WASM without importing an opaque runtime.
10. Design adverse tests for router injection, misleading domain terms,
    distribution shift, conflicting intents, stale memory, unavailable
    specialist, wrong base/delta, malicious catalog metadata, low-confidence
    routing, and specialist overconfidence.
11. Define meaningful diversity for 1, 5, and 20 artifacts: source-family,
    independently trained behavior, real task specialization, hardware profile,
    or precision tier. State what should and should not count toward the public
    model portfolio.
12. Provide decision gates for champion-only first, one specialist pilot,
    shared-base architecture, and larger portfolio. Include explicit stop rules
    when complexity, quality, or storage savings do not justify adoption.

Required report structure:

1. Executive portfolio recommendation.
2. Architecture option taxonomy.
3. Storage, RAM, and runtime cost formulas.
4. Base/delta/expert identity and packaging.
5. Explicit routing and user-control design.
6. Specialist training and contamination controls.
7. Qualification and routing-error statistics.
8. Browser loading, scheduling, and privacy.
9. Colibri and related primary-source assessment.
10. Hostile and failure test matrix.
11. Meaningful 1/5/20-model diversity plan.
12. Staged experiments, adoption gates, and stop rules.
13. Unknowns requiring local training or execution.
14. Annotated primary-source bibliography with dates and revisions.

Do not claim arbitrary model fragments are executable, count relabeled bytes as
diversity, hide best-of-N behind routing, silently route private prompts to a
server, apply a delta to an unbound base, or adopt a specialist that improves a
narrow benchmark while materially harming shipped conversation behavior.

## Prompt 11: Safe Research Sandbox For Adaptive, Self-Modifying, And Ontological Machine Intelligence

You are an independent principal AI research-systems architect, formal safety
engineer, and reproducible-experiment designer. Produce an exceptionally
detailed report defining how TinyRustLM can investigate advanced ideas such as
self-distillation, test-time adaptation, hyperdimensional representations,
Koopman operators, continuous neural fields, morphogenetic computation,
emergent machine protocols, and self-modeling without placing speculative or
self-modifying mechanisms in the shipping product. Target 14,000 to 22,000
words excluding the bibliography.

Use primary papers, official repositories, formal-methods literature,
reproducibility standards, adaptive-system safety research, and scientific
methodology. Carefully distinguish replicated findings, preliminary papers,
theoretical proposals, metaphors, and unsupported consciousness claims. You
have no TinyRustLM source, research artifacts, training data, models,
benchmarks, compute, or private reports.

Project-supplied context:

- TinyRustLM is a prelaunch browser-local assistant whose production priorities
  are useful conversation, common sense, privacy, deterministic evidence,
  explicit authority, portable memory, resource efficiency, and clean code.
- Recent external reports proposed ontological, adaptive, field-based,
  hyperdimensional, Koopman, morphogenetic, emergent-language, and heterogeneous
  substrate ideas. Those reports are advisory and may contain speculative
  claims, unresolved images, citation problems, or conclusions not reproduced
  locally.
- The shipping runtime must not rewrite its own weights, evaluator, policy,
  authority model, or evidence history. Candidate changes may be created
  offline in immutable shadow experiments and promoted only through independent
  retained-capability, quality, privacy, and resource gates.
- Model narration about awareness, internal states, or success is not
  measurement. No anthropomorphic claim may enter marketing without an
  operational definition and independent evidence.

Research and specify:

1. Build an evidence-quality rubric for advanced AI proposals: primary-source
   status, replication, benchmark validity, implementation availability,
   license, compute requirements, architecture assumptions, confounds,
   falsifiability, and relevance to a 0.3B to 2B local model.
2. Classify each named research family by potential near-term utility,
   engineering maturity, portability, training requirement, runtime risk, and
   likely mismatch with browser constraints. Do not force a positive use case.
3. Define a research-only sandbox with immutable inputs, no production
   credentials, no release authority, no durable user-memory mutation, bounded
   files/network/compute, deterministic seeds, resource limits, and complete
   provenance.
4. Design shadow candidate generation for adapters, distilled checkpoints,
   routing policies, memory representations, or learned optimizers. The active
   production artifact remains immutable and authoritative during the experiment.
5. Specify retained-capability evaluation: ordinary helpfulness, source
   authority, current-turn precedence, untrusted memory, privacy, tool
   boundaries, numerical parity, latency, memory, energy, and catastrophic
   regressions.
6. Define falsifiable experiments for HDC/VSA representations, Koopman-style
   latent dynamics, neural fields, NCA/morphogenetic systems, emergent protocols,
   and test-time adaptation. Include baselines, ablations, negative controls,
   preregistration, and stop rules.
7. Separate data-plane learned representations from control-plane protocols.
   Latent vectors may assist inference but cannot replace typed, authenticated,
   human-auditable schemas for authorization, evidence, or cross-system actions.
8. Analyze privacy and poisoning risks for online adaptation and persistent
   memory. Cover prompt injection, user isolation, catastrophic forgetting,
   data exfiltration, model inversion, unbounded accumulation, and deletion.
9. Define reproducible experiment receipts: hypothesis, falsifier, source
   revision, dataset/license, code/toolchain, seeds, environment, metrics,
   negative results, raw-private evidence identity, and terminal decision.
10. Establish a promotion state machine from speculative idea to replicated
    research, bounded prototype, independently reviewed candidate, qualified
    immutable artifact, and optional production adoption. Every failure remains
    preserved and every promotion creates a new identity.
11. Create explicit prohibited claims for consciousness, phenomenology,
    autonomy, self-knowledge, emergence, causal world models, and general
    intelligence. Give operational alternatives that can actually be measured.
12. Provide a prioritized research portfolio with small, medium, and large
    compute tiers, expected decision value, kill criteria, and rules preventing
    research complexity from becoming production debt.

Required report structure:

1. Executive research-governance recommendation.
2. Evidence-quality and reproducibility rubric.
3. Technology-family maturity matrix.
4. Isolated sandbox and threat model.
5. Shadow-candidate architecture.
6. Falsifiable experiment designs and ablations.
7. Data-plane versus control-plane boundary.
8. Privacy, poisoning, and adaptation risks.
9. Experiment receipt and negative-result schema.
10. Promotion/rejection state machine.
11. Anthropomorphic claim restrictions.
12. Prioritized portfolio and stop rules.
13. Unknowns requiring private experiments.
14. Annotated primary-source bibliography with dates and revisions.

Do not recommend production runtime self-rewriting, hidden online learning from
user conversations, latent vectors as authorization protocols, model-generated
proof as sole evidence, consciousness claims from self-report, or retaining a
failed experiment as dormant shipping code.

## Prompt 12: Enterprise Release, Multi-Site Documentation, Supply Chain, And Deployment Truth

You are an independent principal release engineer, software-supply-chain
architect, documentation governance lead, and multi-site production
verification specialist. Produce an exceptionally detailed report defining how
a prelaunch TinyRustLM ecosystem can keep every source repository, package,
public site, documentation site, release log, and marketing claim synchronized
with the same tested technical reality. Target 14,000 to 22,000 words excluding
the bibliography.

Research primary standards and official documentation for Git, reproducible
builds, SLSA, in-toto, SPDX/CycloneDX, signing, Rust/Cargo, .NET/NuGet,
WebAssembly, browser deployment, CSP and cross-origin isolation, service
workers, source maps and symbols, HTTPS/TLS verification, accessibility,
release notes, documentation testing, and incident rollback. You have no access
to project repositories, hosting accounts, DNS, CI, artifacts, keys, live sites,
or logs. Do not claim anything is deployed.

Project-supplied context:

- The relevant ecosystem includes TinyRustLM.com, MiniModel.org,
  MemoryEndpoints.com integration material, UAIX-related public documentation,
  and supporting marketing or documentation sites stored in multiple local
  source repositories. The exact inventory requires local verification.
- The product is prelaunch. There is no released V2, no legacy support duty,
  and no permission for migrations, compatibility aliases, obsolete site
  variants, or documentation for deleted behavior.
- Source must be committed and pushed after every coherent major change that
  builds. An affected site should be deployed whenever all of its release gates
  pass, followed by public HTTPS readback. Deployment of uncommitted source is
  forbidden.
- Each site should expose a consistent human-readable and machine-readable
  publication history with last publish identity, version or technical release
  identity, release date, source revision, changes, limitations, and readback.
- Documentation sites are first-class products and must be robust and current.
  Marketing may not outrun model, memory, P2P, package, browser, or campaign
  evidence.
- Large models, credentials, raw prompts, private receipts, and private paths
  stay outside source control and public deployment.

Research and specify:

1. Define a canonical site/repository inventory schema: site identity, purpose,
   authoritative source root, remote, branch, build command, test command,
   deploy target, documentation dependencies, release owner, public URL, and
   last verified publication.
2. Design a cross-repository release graph binding source commit/tree, shared
   contract identities, package versions, model/runtime profiles, generated
   docs, site assets, deployment manifest, and public readback. Prevent one site
   from silently documenting a different contract.
3. Specify source-control discipline: dirty-tree audit, unrelated user changes,
   focused commits, build-before-commit, push, fresh fetch, local/tracking/
   fetched/remote-ref equality, signed tags if used, protected branches,
   rollback commits, and remote creation when explicitly authorized.
4. Define build and supply-chain gates for Rust, WASM, C ABI, .NET, NuGet,
   companion archives, symbols, browser assets, service workers, schemas,
   catalog metadata, and documentation. Include lock files, dependency pins,
   SBOM, provenance, license review, SourceLink, archive traversal, native asset
   hashes, secret scans, and malware-scanning boundaries.
5. Design tests by evidence class: unit, contract, differential, property,
   fuzz, package consumer, cross-platform, real hardware, browser, responsive,
   accessibility, privacy/network, model quality, live memory, outside P2P,
   deployment, and documentation drift. State what each cannot prove.
6. Specify atomic browser-site release: content-hashed assets, HTML/WASM/worker
   compatibility, service-worker update, cache headers, SRI where useful,
   CSP/COOP/COEP/CORP, CDN invalidation, stale-client behavior, and last-known-
   good rollback.
7. Define a consistent publication log schema and user-facing page. Include
   publish ID, site ID, source identity, release date/time zone, technical
   version, affected components, behavior changes, explicitly absent migration,
   tests/evidence, limitations, rollback reference, and HTTPS readback time.
8. Establish documentation governance for architecture, user guides, API and
   model formats, security/privacy, operations, troubleshooting,
   accessibility, release notes, and marketing. Documentation changes must be
   part of the same coherent release as behavior.
9. Design automated drift detection: broken links, stale version/date, schema
   mismatch, unsupported commands, missing package/API symbols, contradictory
   privacy claims, unproven campaign counters, obsolete screenshots, and public
   sites whose bytes do not match their claimed release.
10. Define honest status and claim vocabulary for source complete, tests green,
    package built, package published, site deployed, HTTPS verified, model
    structurally valid, model quality-qualified, memory live-proven, P2P
    outside-proven, and campaign complete.
11. Specify deployment verification and rollback: DNS, TLS, HTTP status,
    security headers, asset hashes, service worker, critical flows, unexpected
    network requests, release-log equality, monitoring without prompt telemetry,
    rollback authorization, and post-rollback readback.
12. Provide an enterprise runbook that can release one green major change at a
    time, update all affected documentation, commit and push all source, deploy
    all fully qualified sites, preserve blockers honestly, and leave an exact
    resumption record.

Required report structure:

1. Executive release-control recommendation.
2. Site/repository inventory and ownership schema.
3. Cross-repository release and invalidation graph.
4. Source-control and remote-verification procedure.
5. Build, package, and supply-chain matrix.
6. Test gates by component and evidence class.
7. Atomic site deployment and service-worker release.
8. Publication-log specification with examples.
9. Documentation/marketing governance and drift tests.
10. Honest claim and progress vocabulary.
11. HTTPS readback, rollback, and incident response.
12. Prioritized implementation and release runbook.
13. Unknowns requiring local or authorized production access.
14. Annotated primary-source bibliography with dates and links.

Do not recommend deploying uncommitted source, keeping stale documentation for
legacy users, claiming publication from package creation, treating
cross-compilation as real ARM64 execution, calling local P2P health public
reachability, simulating MemoryEndpoints, incrementing campaign counters from
mocks, or allowing marketing and documentation to lag behind behavior.

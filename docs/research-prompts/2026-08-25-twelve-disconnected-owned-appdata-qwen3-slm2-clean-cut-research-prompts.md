# Twelve Disconnected Research Prompts: Owned Build State, Qwen3 SLM2 Proof, And Clean Browser Cutover

Each section below is a complete standalone assignment. Send each entire
section to a different technical research agent. The agents do not share
context and have no access to the TinyRustLM source tree, private artifacts,
source-control history, local test output, development computers, credentials,
unpublished evaluation cases, prior reports, or other prompts in this packet.

The reports are advisory research inputs only. They cannot prove that private
code works, authorize an irreversible model operation, satisfy a release gate,
or advance a campaign counter. Each researcher must use current primary sources
wherever possible, identify publication or update dates, state the report's
retrieval date, link directly to every material source, and pin public
repository observations to immutable revisions. Every report must clearly
separate:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that could not be independently verified;
4. engineering analysis and recommendations;
5. assumptions, uncertainties, alternatives, and source disagreements; and
6. facts requiring private source inspection, local execution, browser tests,
   real hardware, credentials, external peers, or authorized production access.

Every report should be exceptionally detailed and technical. Include concrete
algorithms, canonical schemas, state machines, pseudocode, equations, bounded
resource models, threat models, failure matrices, fault-injection cases,
objective acceptance criteria, and a prioritized implementation sequence.
Generic tutorials, marketing summaries, invented measurements, and proposals
to retain hypothetical prelaunch compatibility are not useful.

## Prompt 1: Proving The Complete Windows Application-State Closure For Offline .NET Builds

You are an independent principal Windows build engineer, .NET SDK internals
researcher, NuGet client specialist, and hermetic-build assurance architect.
Produce a deeply technical report defining how to prove the complete writable
and readable environment closure of one offline, no-restore .NET release build
executed in a deliberately minimal Windows process environment. You have
internet access but no TinyRustLM repository, private project files, build
roots, `project.assets.json`, binaries, machine access, credentials, or prior
test output. Do not claim to have inspected or validated private code.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local language-model product. There is
  no product V1 or V2. Names such as SLM2, profile `/4`, and execution `/9` are
  technical format or evidence identities, not product generations.
- Because the product is prelaunch, a defective build contract is replaced
  completely. No legacy reader, compatibility mode, migration path, fallback,
  automatic retry, output repair, stale-output adoption, or known debt may
  remain in the maintained path.
- A source-controlled custody owner launches exact Rust and .NET child builds
  with a closed allowlisted environment, bounded streams, new owned roots, and
  create-only evidence. It does not inherit the ambient caller environment.
- A terminal prior operation ran a .NET SDK build with no restore and failed
  with `NETSDK1060`, an assets-lock read failure, and `Value cannot be null.
  (Parameter 'path1')`. The same child also created a zero-byte relative
  `NuGet/Migrations/1` file under its source working directory. That operation
  is immutable and may never be retried, repaired, cleaned, or reinterpreted.
- A separate causal experiment used the installed .NET SDK 10.0.400, MSBuild
  18.9.6, and a NuGet assembly reporting product version
  `7.9.0-rc.38015+14fbf8d...`. With neither `APPDATA` nor `LOCALAPPDATA`, the
  build reproduced `NETSDK1060` and the relative migration marker. Binding only
  `APPDATA` to an owned roaming directory made the no-restore build succeed but
  left the relative marker. Binding both `APPDATA` and `LOCALAPPDATA` to owned
  directories made the build succeed and moved migration state under the owned
  local-application-data directory.
- The proposed sole technical custody profile binds
  `APPDATA=<owned>/home/AppData/Roaming`,
  `LOCALAPPDATA=<owned>/home/AppData/Local`, and
  `TEMP=TMP=<owned>/temp`. It also binds `USERPROFILE`, `HOMEDRIVE`, and
  `HOMEPATH` to the same owned home. The owner precreates and no-follow inspects
  exactly `home`, `home/AppData`, `home/AppData/Local`,
  `home/AppData/Roaming`, and `temp` before child launch.
- The build consumes a previously restored, immutable assets file and package
  cache. The registered build may not restore packages, mutate source, choose a
  new package graph, inherit ambient state, or retry after failure.

Research current Microsoft .NET SDK and MSBuild documentation, NuGet.Client
source at immutable revisions, Windows known-folder APIs, environment-variable
resolution, first-run experience, workload resolution, telemetry, certificate
and trust stores, Roslyn and SourceLink behavior, native-host resolution,
temporary-file behavior, and reproducible-build literature. Address all of the
following in depth:

1. Trace how modern .NET SDK, MSBuild, NuGet, Roslyn, SourceLink, workload
   resolvers, native hosting, and signing-related code derive every user or
   machine location. Distinguish environment variables, Win32 known folders,
   registry reads, current-directory fallbacks, executable-relative paths, and
   hard-coded shared locations.
2. Explain the exact roles and precedence of `APPDATA`, `LOCALAPPDATA`,
   `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`, `TEMP`, `TMP`, `DOTNET_CLI_HOME`,
   `NUGET_PACKAGES`, `NUGET_HTTP_CACHE_PATH`, `NUGET_PLUGINS_CACHE_PATH`,
   `MSBuildSDKsPath`, `DOTNET_ROOT`, `DOTNET_MULTILEVEL_LOOKUP`,
   `DOTNET_NOLOGO`, `DOTNET_SKIP_FIRST_TIME_EXPERIENCE`, telemetry variables,
   and any version-specific alternatives. State which are material for an
   offline no-restore build and which are unnecessary or dangerous.
3. Analyze why missing `APPDATA` can plausibly produce a null-path assets-lock
   failure and why missing `LOCALAPPDATA` can send NuGet migration state to a
   relative path. Pin explanatory source lines to immutable NuGet commits, but
   clearly state that public code cannot prove the private installed binary's
   behavior.
4. Define a procedure for discovering hidden reads and writes without granting
   the build broad access. Compare Process Monitor with boot logging disabled,
   Event Tracing for Windows, Windows Sandbox, AppContainer, low-privilege
   users, file-system minifilter observation, access-denied canaries, registry
   auditing, and before/after inventories. Explain observer effects and how to
   avoid treating an incomplete trace as a proof of absence.
5. Specify a minimal environment algorithm. Begin from an empty map, add only
   exact toolchain and owned-state bindings, reject duplicates
   case-insensitively, canonicalize paths without following attacker-controlled
   links, and prove every writable location is either an owned scratch root or
   a declared immutable dependency root.
6. Build a read/write authority matrix for source, SDK, reference packs,
   workload manifests, package cache, assets file, intermediate files, output,
   temporary storage, roaming state, local state, certificate stores, registry,
   and network. State the required access mode and expected mutation for each.
7. Explain how `--no-restore`, locked restore metadata, deterministic MSBuild
   properties, `ContinuousIntegrationBuild`, `PathMap`, source embedding,
   SourceLink, portable PDB, generated assembly attributes, timestamps, locale,
   timezone, and machine paths affect reproducibility. Separate deterministic
   metadata from byte-for-byte reproducibility.
8. Design an installed-SDK drift gate. Bind executable bytes, SDK directory
   identity, runtime host, MSBuild and NuGet assemblies, reference packs,
   workload state, package graph, environment, and command. Define when a
   patched SDK invalidates prior evidence even if `dotnet --version` is
   unchanged.
9. Define post-child inspection that can detect source mutation, unexpected
   writes, package-cache mutation, registry writes where observable, network
   attempts, path escapes, reparse traversal, and residual processes. Include
   exact handling of NuGet migration markers and first-run sentinels.
10. Create a hostile test matrix covering absent and malformed application
    variables, external paths, case-colliding keys, relative paths, UNC paths,
    alternate data streams, junction swaps, read-only profile directories,
    disk full, package-cache denial, stale assets files, SDK mismatch, locale,
    long paths, non-ASCII user names, concurrent builds, and observer failure.
11. State what constitutes sufficient evidence that the application-state
    closure is complete for one exact SDK build, and what must remain an honest
    residual risk. Explain why one successful build is necessary but not
    sufficient.
12. Give a clean adoption plan for a sole maintained profile. The predecessor
    profile must be deleted from current code and documentation, with old bytes
    retained only in immutable historical evidence. No dual-profile selector
    or transition period is allowed.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Primary-source observation log with dates and immutable revisions.
3. .NET, MSBuild, NuGet, and Windows location-resolution map.
4. Minimal environment specification and precedence table.
5. Read/write authority matrix.
6. Trace and closure-discovery methodology.
7. Canonical path and no-follow validation algorithm.
8. Reproducibility and toolchain-drift analysis.
9. Post-child inspection and evidence schema.
10. Threat model and hostile-input matrix.
11. Deterministic and installed-SDK test plan.
12. Acceptance criteria and residual risks.
13. Migration-free implementation sequence.
14. Unknowns requiring private local execution.
15. Annotated primary-source bibliography.

Do not recommend inheriting the full parent environment, running restore inside
the registered build, copying an ambient user profile, allowing external temp
paths, ignoring relative side effects, accepting success from output presence,
retrying the terminal operation, or retaining the old profile as a fallback.

## Prompt 2: Independent Formal And Hostile Audit Of A One-Shot Windows Build-Custody Owner

You are an independent principal systems-security engineer, Windows process
specialist, filesystem-race researcher, and evidence-protocol auditor. Produce
a rigorous independent design audit for a source-controlled one-shot build
custody owner that must launch exactly one registered child process, capture
authoritative termination, inspect every owned output and scratch path, and
publish an immutable terminal result. You have internet access but no
TinyRustLM source, custody implementation, request bytes, private roots,
binaries, tests, machine access, or credentials. Do not imply that you reviewed
or executed private code.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch product with no product generations and no
  users requiring compatibility. SLM2 and custody `/4` are technical
  identities only. A defective profile is replaced and removed rather than
  negotiated with or retained.
- The current proposed owner is a Node.js process with a closed canonical JSON
  request and a source-built Rust Windows no-follow scratch inspector. It
  launches an exact Rust or .NET command with `shell:false` and an exact
  environment derived from a separately bound MSVC authority plus bounded
  supplemental values.
- The request binds source commit and tree, branch, owner bytes, Node runtime,
  exact executable and argument vector, working directory, task-termination
  binary, MSVC environment authority, output and scratch-inspector profiles,
  required outputs, stream ceilings, timeout, and three wholly new absent
  sibling roots: control, target, and environment.
- Before launch the owner validates the request without writing, regenerates
  the MSVC environment, proves source and Git exact, proves each root absent
  under a direct non-reparse parent, writes a create-only binding, creates
  roots, writes a create-only start, and launches exactly one child.
- The owner opens separate bounded binary stdout and stderr captures, durably
  records child status before optional diagnostics, revalidates source and
  environment after every outcome, inventories required outputs only after
  zero exit, launches the exact scratch inspector once, and writes one
  create-only terminal record. It never retries, resumes, cleans, repairs, or
  adopts output.
- Owned environment state may contain a same-root Windows directory junction
  only when a source-built no-follow inspector proves the reparse tag, target,
  same-volume containment, lack of chaining, lack of cycles, stable file
  identity, and two matching streamed inventories. External, chained,
  symbolic-link, file, unknown-tag, malformed, drifting, or over-limit reparse
  state is rejected.
- Application data and temporary paths are exact owned bindings:
  `APPDATA=<environment>/home/AppData/Roaming`,
  `LOCALAPPDATA=<environment>/home/AppData/Local`, and
  `TEMP=TMP=<environment>/temp`. Five exact directories are precreated and
  directly inspected before launch.
- Several predecessor executions are immutable terminal evidence. Their roots
  and outputs may never be reused or cleaned. A later build requires an exact
  committed profile and wholly new names.

Research Node.js `child_process`, Windows `CreateProcessW`, process handles,
job objects, console control, pipe semantics, NTFS/ReFS durability, reparse
points, `FSCTL_GET_REPARSE_POINT`, file IDs, rename/link behavior, Rust Windows
APIs, process-tree termination, and crash-consistent evidence stores. Address:

1. Model the trust boundary and identify every authority: request producer,
   custody owner, Node runtime, OS process manager, MSVC environment owner,
   child tool, scratch inspector, filesystem, Git reader, terminal-record
   consumer, and human operator. State which pairings must not collapse into
   one unreviewed authority.
2. Formalize request validation using a closed schema, canonical bytes,
   collision-resistant identity, case-insensitive environment-key uniqueness,
   exact ordered argument vectors, typed path roles, and unknown-field
   rejection. Explain how to avoid path-string equality being mistaken for
   object identity.
3. Give a complete state machine from `unmaterialized` through validation,
   binding, root creation, start, child running, process terminal, output
   inventory, scratch inspection, and custody terminal. List all forbidden
   transitions, terminal states, and crash snapshots.
4. Analyze exactly-once launch. Cover observer restart, double-clicked
   commands, concurrent owners, stale lock files, PID reuse, process creation
   before start-record durability, start-record publication before process
   creation, and terminal publication after owner death. Explain what can be
   proven and what becomes terminally indeterminate.
5. Design authoritative exit capture. Distinguish process handle signaling,
   exit code, NTSTATUS, `ExitTime`, output text, child-created files, shell
   status, timeout termination, and observer failure. Optional metadata must
   never erase an already captured exit status.
6. Audit bounded stream handling. Address simultaneous pipe draining, pipe
   backpressure, invalid UTF-8, NULs, enormous lines, per-stream and aggregate
   ceilings, streaming hashes, fsync ordering, child behavior after overflow,
   and preserving enough evidence to distinguish truncation from child output.
7. Specify process-tree ownership using Windows job objects or an equally
   strong mechanism. Cover inherited handles, breakaway flags, grandchildren,
   detached children, child-created jobs, Ctrl-C, timeout races, natural exit
   concurrent with termination, taskkill limitations, and proving tree closure.
8. Audit no-follow filesystem handling. Cover TOCTOU between validation and
   creation, path-component replacement, mount points, junctions, symlinks,
   hard links, case aliases, 8.3 names, UNC and device paths, alternate data
   streams, file-ID reuse, cross-volume targets, and held-handle strategies.
9. Evaluate the narrow same-root junction allowance. Define formal containment
   invariants and whether two inventories plus stable file identities are
   sufficient. Propose adversarial tests for target swaps, nested reparse
   chains, loops, target deletion, target recreation, and junction-count
   exhaustion.
10. Design crash-consistent create-only evidence. Compare exclusive create,
    same-directory temporary file plus file flush and atomic publication,
    hard-link publication, write-through handles, directory flushes, and
    manifest-last protocols. Explain honest guarantees under process crash,
    power loss, disk full, antivirus interference, and network filesystems.
11. Build an outcome taxonomy separating child build status, custody integrity,
    output qualification, inspector status, source drift, environment drift,
    and evidence-publication status. A zero child exit must not become a pass
    when any custody edge is incomplete.
12. Produce an independent hostile test and review plan using tiny child
    programs. Include zero/nonzero exit, inherited-handle leaks, stream floods,
    invalid bytes, sleep, process escape, owner kill at every state, disk full,
    root races, executable mutation, source mutation, Git mutation, environment
    drift, missing outputs, malformed PE, inspector compromise, and record
    collision.

Required report structure:

1. Executive audit opinion and assumptions.
2. Primary-source observation log.
3. Trust and authority diagram.
4. Canonical request model.
5. Formal state machine and crash-state table.
6. Process, handle, pipe, and job-object analysis.
7. No-follow path and reparse-point analysis.
8. Durable evidence protocol.
9. Outcome and claim taxonomy.
10. Hostile test harness specification.
11. Independent review and trust-bootstrap procedure.
12. Clean replacement acceptance criteria.
13. Likely defects and rejected alternatives.
14. Unknowns requiring local Windows tests.
15. Annotated primary-source bibliography with dates.

Do not recommend parsing a successful build line, trusting executable presence,
launching through an ambiguous shell string, best-effort cleanup, same-attempt
retry, stale-root adoption, an unbounded in-memory capture, mutable latest
evidence, broad reparse traversal, or a compatibility reader for predecessor
profiles.

## Prompt 3: Output-Free Registration And One Irreversible Qwen3 Composition Operation

You are an independent principal evidence-systems architect, transaction
protocol researcher, release-control engineer, and formal-methods reviewer.
Design a complete output-free preregistration and one-shot execution ceremony
for the next real Qwen3 composition operation after eight terminal attempts.
You have internet access but no private repository, source-control permissions,
artifacts, model bytes, prior receipts, build machine, credentials, or local
test output. Produce research and design only. Do not claim that private gates
have passed.

Project-supplied context, not independently verified:

- TinyRustLM is a single prelaunch browser-local product. There is no product
  V1 or V2. SLM2, Tokenizer2, Template2, Sampling2, Prompt2, ACG2, custody
  `/4`, and execution `/9` are technical identities only.
- Clean replacement is mandatory. There are no compatibility readers,
  migration writers, aliases, fallbacks, hidden retries, repair, best-of-N,
  output adoption, or accepted known debt.
- The public source lock identifies `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, Apache-2.0, with an exact
  1,503,300,328-byte `model.safetensors` and exact tokenizer/config files. The
  source lock calls this an upstream base model, so conversion cannot by itself
  establish assistant quality.
- The required composition contains six members:
  `model.slm2`, `tokenizer.tokenizer2`, `template.template2`,
  `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`, plus bounded
  attempt, component-receipt, and exactly one terminal pass or rejection file.
- Executions `/1` through `/8` are immutable terminal evidence. They include
  binding-order, tensor-inventory, Tokenizer2 output-contract, process-custody,
  source-anchor, missing-MSVC-environment, scratch-junction, and missing
  application-data failures. None may be retried, resumed, repaired, cleaned,
  adopted, completed, or relabeled.
- Execution `/8` launched one registered Rust build successfully and one
  registered managed build that exited nonzero. It did not create a managed
  output, composition request, controller evidence root, composition output,
  SLM2 composition, or verification. Twelve of fifteen registered names exist;
  the other three must remain absent forever.
- A new sole custody profile `/4` binds owned `APPDATA`, `LOCALAPPDATA`,
  `TEMP`, and `TMP`, has focused synthetic tests, and has an installed-SDK
  causal regression. It must be committed, pushed, freshly fetched, and bound
  exactly before any later operation is registered.
- Registration must occur while every new logical request, control, build,
  evidence, and output name is absent. The registration commit and tree must be
  pushed and independently read back from the authoritative remote before any
  private material is created. No source commit may intervene between remote
  verification and execution.
- Structural composition is not source-framework parity, native inference,
  browser-WASM inference, browser chat, semantic quality, P2P availability,
  catalog publication, deployment, MemoryEndpoints, or campaign credit.
  Counters remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

Research transparency logs, in-toto and SLSA provenance, content-addressed
builds, append-only journals, two-phase commit, write-ahead logging, state
machines, source-control attestations, and filesystem transactions where
useful. Address all of the following:

1. Define the threat model for output-aware registration, easy-attempt
   selection, stale binary discovery, root prepopulation, source drift, tool
   drift, environment drift, path substitution, reparse substitution, branch
   movement, remote mismatch, operator duplication, and history rewriting.
2. Design a canonical closed preregistration schema binding parent commit and
   tree, branch and remote, source locks, all current profiles and their byte
   identities, custody owner and runtime, exact Rust and .NET commands,
   environment authority, all new logical names, resource ceilings, expected
   outputs, phase graph, predecessor dispositions, privacy rules, and success
   and rejection predicates.
3. Solve the registration-commit circularity. Explain how a registration can
   bind the exact parent source while its own commit necessarily changes the
   tree. Distinguish implementation parent, registration commit, execution
   source, branch tip, and post-execution result commit. Provide a precise
   invariant that prevents an unrelated commit from invalidating or silently
   changing the operation.
4. Define root and request identities without future output. Compare readable
   operation IDs, cryptographic nonces, UUIDs, registration hashes, and
   commit-derived names. Prevent collision, circular derivation, reuse of the
   three absent `/8` names, and accidental placement beneath predecessor roots.
5. Specify the complete output-free ceremony: source cleanliness, profile
   verification, test evidence, root-absence proof, registration generation,
   canonical byte verification, commit, push, fresh fetch into an independent
   reader, direct remote advertisement check, changed-path review, second
   absence proof, and authorization. Give abort rules for each step.
6. Define a one-shot phase DAG for environment materialization, Rust custody,
   managed custody, request creation, controller launch, converter launch,
   six-member publication, independent managed inspection, final verification,
   and bounded public result. State which phase creates which names and who
   owns each write.
7. Separate process terminal from custody terminal, build qualification,
   converter outcome, composition structural validity, and independent
   agreement. Design distinct create-only records so an infrastructure failure
   cannot be confused with a model defect or successful conversion.
8. Define crash classification at every write boundary. Existing roots and
   partial outputs become immutable terminal evidence; recovery means
   classification and a new operation identity, never resumption. Explain when
   an absent file is meaningful and how absence is observed without creating
   it.
9. Specify a receipt graph binding registration, source locks, environment,
   executables, request bytes, raw-stream hashes, process terminals, custody
   terminals, output inventories, artifact hashes, parser observations, and
   final decision. Include graph validation and conflict-detection algorithms.
10. Design independent verification that is read-only and starts only after
    the writer closes. Prevent the verifier from filling missing members,
    rewriting metadata, normalizing malformed bytes, or sharing the writer's
    parser implementation as its only authority.
11. Define bounded public disclosure. Identify safe public fields and forbidden
    fields, including private paths, model bytes, raw prompts, credentials,
    raw build logs, invitation URLs, and hosted-memory payloads. Include secret
    scanning and redaction tests.
12. Produce formal invariants and a hostile audit matrix covering root races,
    reparse swaps, commit drift, command reorder, tool replacement, child
    overlaunch, terminal collisions, verifier mutation, missing receipt edges,
    disk full, power loss, owner death, output overproduction, and public
    overclaiming.

Required report structure:

1. Executive protocol recommendation.
2. Explicit supplied facts and unavailable evidence.
3. Threat model and trust roles.
4. Canonical preregistration schema.
5. Commit, tree, remote, and root identity model.
6. Output-free registration ceremony.
7. Complete execution phase DAG and transition table.
8. Create-only receipt graph.
9. Crash snapshot and terminal classification table.
10. Independent verification boundary.
11. Privacy-safe public result schema.
12. Formal invariants and proof obligations.
13. Hostile audit and fault-injection matrix.
14. Prioritized implementation plan.
15. Unknowns requiring private execution.
16. Annotated primary-source bibliography with dates.

Do not propose a mutable `latest.json`, boolean-only pass, same-attempt retry,
cleanup of failed roots, creation of the three absent `/8` names, stale-binary
adoption, registration after output, branch rewind, output repair, verifier
mutation, secret-bearing public receipts, or campaign progress from structural
conversion alone.

## Prompt 4: Exact Qwen3 0.6B Safetensors-To-SLM2 Conversion And Quantization Audit

You are an independent principal transformer-runtime engineer, model-format
specialist, numerical-computing researcher, and secure conversion-pipeline
auditor. Produce an implementation-grade technical report for converting one
pinned Qwen3 0.6B safetensors checkpoint into a compact, deterministic SLM2
artifact without changing architecture semantics or hiding quantization loss.
You have internet access and may inspect public Qwen and Hugging Face sources,
but you have no TinyRustLM source, private checkpoint copy, SLM2 bytes,
converter, conversion receipts, local tests, machine, or credentials. Do not
claim that you inspected or validated private code.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local product. There is no product V2.
  SLM2 and producer `/2` are technical format identities. A new correct path
  replaces every predecessor path; no legacy parser, format selector,
  migration writer, alias, fallback, repair, or known debt may remain.
- The public source lock names `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, Apache-2.0. It binds
  `model.safetensors` at 1,503,300,328 bytes and SHA-256
  `f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b`,
  plus exact `config.json`, `generation_config.json`, tokenizer files, README,
  and license.
- The locked model is identified as `Qwen3ForCausalLM`, a base-model artifact,
  with vocabulary 151,936, hidden width 1,024, intermediate width 3,072, 28
  layers, 16 query heads, 8 key/value heads, head dimension 128, context 40,960,
  tied embeddings, no QKV bias, Q/K normalization, and rotary position
  embeddings.
- Project planning expects 311 physical source tensors but 310 logical SLM2
  tensors because a redundant tied output tensor must be byte/numerically
  proven equal to the embedding tensor and not emitted twice. It expects
  751,632,384 physical source parameters and 596,049,920 logical parameters.
- The intended conversion is a mixed q8 representation with checked scales and
  finite-value validation. Exact private format and producer bytes require
  local verification. A structural conversion does not prove source parity,
  generation quality, assistant behavior, browser performance, or release
  eligibility.
- The converter must stream reads and hashes, reject missing/surplus/duplicate
  or ambiguously mapped tensors, write deterministically into a wholly new
  absent root, publish members create-only and atomically, and preserve every
  failure. It may not retry, repair, normalize malformed input, or adopt partial
  output.

Research the exact pinned public repository, official Qwen3 documentation and
technical report, Transformers implementation at compatible immutable
revisions, safetensors specification and implementation, quantization
literature, and deterministic binary-format practices. Address:

1. Reconstruct the exact architecture from public `config.json` and official
   implementation. Enumerate layer order, RMSNorm placement, Q/K normalization,
   projection shapes, grouped-query expansion, rotary convention, causal mask,
   gated MLP formula, residual order, final norm, tied output, dtype, and all
   semantically material flags.
2. Produce an exact expected safetensors inventory algorithm. Validate header
   length, JSON bounds, unique names, dtype allowlist, rank and dimensions,
   nonoverlapping contiguous data ranges where required, overflow-safe byte
   counts, file length, finite values, and zero unclaimed payload. Explain
   how sharded checkpoints would differ even though this source is supplied as
   one file.
3. Provide a complete source-name-to-logical-role mapping table for embeddings,
   every per-layer norm/projection, final norm, and output head. Identify
   transpose requirements and prove them from publisher code rather than
   convention. State how to reject aliases and unexpected tensors.
4. Analyze the supplied 311-to-310 tied-output rule. Define byte equality,
   element equality, dtype normalization, shape equality, and signed-zero/NaN
   handling. Explain whether exact source bytes or decoded equality is the
   correct criterion and why the omitted output remains semantically bound.
5. Design the q8 quantization contract. Compare per-tensor, per-row,
   per-channel, groupwise, symmetric, asymmetric, and mixed-precision choices
   for embeddings, attention, MLP, norms, and output. Give exact scale and
   rounding equations, zero handling, saturation, tie rounding, subnormal,
   infinity, and NaN rules.
6. Recommend which tensors must remain f32 or another higher precision and
   justify the choice with sensitivity evidence. Address RMSNorm weights,
   embeddings, output projection, Q/K normalization, and outlier-heavy MLP
   matrices. Do not invent accuracy measurements.
7. Define deterministic parallel conversion. Explain chunk boundaries,
   worker ordering, reduction order, scale computation, endian conversion,
   hash streaming, canonical tensor order, alignment padding, zeroed reserved
   bytes, and how repeated clean runs produce identical bytes independent of
   thread scheduling.
8. Specify bounded memory and disk formulas for a 1.503 GB source and roughly
   596 million logical parameters. Include header parsing, row buffers,
   quantization scratch, output staging, source and output hashes, receipts,
   free-space preflight, cancellation, and disk-full behavior.
9. Design atomic publication of model plus receipts. Cover same-directory
   staging, file flush, directory durability, create-only final names, hard-link
   publication versus rename, collision behavior, interruption snapshots, and
   why a partial model cannot later be adopted.
10. Define independent structural verification that does not call the writer's
    code as its only authority. Include a language-neutral parser, a managed
    inspector, random row dequantization, tensor-role reconstruction, tied
    output proof, resource-plan calculation, and full streamed rehash.
11. Build a corruption and adversarial matrix: truncated headers, duplicate
    keys, malformed UTF-8, huge dimensions, offset overlap, gap/surplus bytes,
    wrong layer count, swapped Q/K, wrong transpose, wrong GQA mapping, negative
    scales, nonfinite values, all-zero rows, ties, source mutation during read,
    and output mutation before terminal publication.
12. Define evidence and claim language for source-locked, structurally
    converted, independently parsed, numerically compared, native executed,
    browser executed, and quality qualified. Conversion must never imply the
    later claims.

Required report structure:

1. Executive conversion recommendation and assumptions.
2. Public source observation log with immutable revisions.
3. Exact Qwen3 architecture reconstruction.
4. Safetensors validation and inventory algorithm.
5. Full tensor mapping and transpose table.
6. Tied-output proof.
7. Quantization specification with equations.
8. Deterministic writer and bounded resource model.
9. Atomic publication and failure-state table.
10. Independent parser and verification design.
11. Numerical-risk analysis and proposed parity vectors.
12. Corruption and hostile-input matrix.
13. Evidence schema and claim taxonomy.
14. Prioritized implementation sequence.
15. Unknowns requiring private bytes and local execution.
16. Annotated primary-source bibliography with dates.

Do not recommend guessing tensor mappings, accepting surplus tensors, silently
transposing by heuristic, ignoring nonfinite values, using nondeterministic
parallel reductions, lowering precision solely to meet a size target, emitting
two tied copies without need, repairing malformed source, adopting partial
output, or calling a structural conversion a quality pass.

## Prompt 5: Publisher-Exact Qwen3 Tokenizer Conversion And Independent Parity Proof

You are an independent principal tokenizer engineer, Unicode and regex
specialist, language-runtime interoperability researcher, and binary-format
auditor. Produce a deeply technical design for converting a pinned public Qwen3
tokenizer into one bounded declarative Tokenizer2 artifact and proving exact
encode/decode parity through independent implementations. You have internet
access but no TinyRustLM source, private tokenizer copy, Tokenizer2 bytes,
converter, browser bundle, tests, unpublished vectors, or credentials. Do not
claim private inspection or validation.

Project-supplied context, not independently verified:

- TinyRustLM is a single prelaunch product. Tokenizer2 `/2` is a technical
  producer identity, not a product generation. The maintained product accepts
  one exact current tokenizer format; no `.tok2` compatibility suffix, old
  reader, alias, migration, fallback, runtime JavaScript tokenizer, or known
  debt may remain.
- The locked source is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. The source lock binds
  `tokenizer.json` at 11,422,654 bytes, `tokenizer_config.json` at 9,732 bytes,
  `vocab.json` at 2,776,833 bytes, and `merges.txt` at 1,671,853 bytes, each
  with exact SHA-256 identities.
- The target vocabulary size is 151,936. The current planned artifact name is
  `tokenizer.tokenizer2`, with a supplied expected length of 7,038,773 bytes
  and expected SHA-256
  `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
  Those private output facts require local verification and must not be treated
  as independently observed.
- The artifact must represent exact token IDs and byte strings, merge pairs and
  ranks, special and added tokens, normalization, pretokenization, ByteLevel
  behavior, regex semantics, byte fallback, postprocessing, and decoding. It
  cannot embed executable publisher JavaScript, Python, Jinja, or arbitrary
  regex execution not covered by the frozen profile.
- Rust is intended to own the writer, parser, encoder, and decoder. A genuinely
  independent public-source oracle and browser-WASM replay must compare exact
  vectors. Unknown fields, duplicate tokens/merges, invalid ranks, malformed
  Unicode, overlength records, and allocation overflow fail closed.
- Tokenizer structural parity is not language-model quality, prompt-template
  parity, native generation, browser chat, or release proof.

Research the exact source files at the pinned revision, Hugging Face Tokenizers
source at compatible immutable revisions, Qwen tokenizer documentation,
ByteLevel BPE, Unicode and regex specifications, Rust regex limitations,
WebAssembly text encoding, and tokenizer differential-testing literature.
Address:

1. Reconstruct the complete tokenizer pipeline from source: normalizer,
   pretokenizer sequence, regex pattern and engine semantics, ByteLevel byte
   alphabet, BPE merge behavior, unknown handling, added-token matching,
   postprocessor, decoder, cleanup, and every special token used by Qwen3.
2. Determine which source file is authoritative when `tokenizer.json`,
   `vocab.json`, `merges.txt`, and `tokenizer_config.json` overlap or disagree.
   Define a fail-closed consistency check rather than precedence that hides
   drift.
3. Specify canonical Tokenizer2 bytes: header, version, flags, section table,
   endian order, alignment, token table, byte pool, merge table, added-token
   metadata, regex/profile identity, bounds, reserved bytes, and whole-file
   identity. Unknown required flags must reject.
4. Design source conversion. Stream or bound all inputs, validate exact
   inventories, prove token-ID continuity, reject duplicate byte strings where
   semantically forbidden, validate merge operands and ranks, and preserve
   source-to-artifact lineage without circular self-hashes.
5. Give an exact BPE encoding algorithm with deterministic tie behavior and a
   suitable data structure for a 151,936-token vocabulary. Compare heap-based,
   linked-list, trie, hash, and rank-table approaches by complexity, memory,
   browser portability, and adversarial worst case.
6. Define decode semantics over arbitrary token IDs and byte sequences. Address
   UTF-8 split across tokens, invalid UTF-8, replacement behavior, round-trip
   byte preservation, special-token skipping, whitespace cleanup, combining
   marks, bidirectional text, NULs, and lone surrogate input from JavaScript.
7. Analyze regex portability. Compare Rust `regex`, fancy-regex, PCRE2, Oniguruma,
   JavaScript RegExp, Python regex behavior, and a purpose-built declarative
   scanner. Identify Qwen's exact features and define how parity is proven
   without shipping a general executable regex engine if avoidable.
8. Design an independent oracle. Pin Python, Transformers, Tokenizers, and
   source revisions; preserve environment and source hashes; materialize
   language-neutral vectors without calling the Rust implementation; and
   explain how to prevent a shared malformed fixture from making both sides
   agree incorrectly.
9. Build a comprehensive corpus: empty input, ASCII, repeated spaces, tabs,
   CR/LF variants, leading/trailing whitespace, punctuation, code, JSON,
   Markdown, emoji, combining forms, CJK, Arabic, Indic scripts, private-use
   code points, NUL, invalid byte sequences, special-token text, very long
   tokens, and adversarial regex backtracking candidates.
10. Define browser-WASM verification. Cover JavaScript strings to UTF-8,
    transfer to WASM, allocation ceilings, deterministic output arrays,
    incremental decode, worker messages, memory growth, cancellation, and exact
    comparison with native and oracle vectors.
11. Create hostile parser tests for truncation at every boundary, integer
    overflow, overlapping sections, noncanonical ordering, duplicate IDs,
    invalid merge references, rank gaps, gigantic lengths, unknown flags,
    invalid UTF-8 metadata, surplus bytes, and checksum-correct semantic
    corruption.
12. Define performance and resource measurements without sacrificing parity:
    cold parse time, persistent memory, encode/decode throughput by input class,
    worst-case behavior, browser transfer copies, and cache policy. Measurements
    must be obtained locally and never invented in the report.

Required report structure:

1. Executive recommendation and assumptions.
2. Immutable public-source observation log.
3. Exact publisher tokenizer pipeline.
4. Source-authority and consistency rules.
5. Canonical Tokenizer2 binary specification.
6. Conversion and validation algorithm.
7. Encode/decode pseudocode and complexity analysis.
8. Regex and Unicode portability analysis.
9. Independent oracle and vector-generation protocol.
10. Native and WASM differential matrix.
11. Hostile parser and corpus plan.
12. Performance and memory measurement plan.
13. Evidence and claim boundaries.
14. Clean implementation sequence.
15. Unknowns requiring private bytes or browser runs.
16. Annotated primary-source bibliography with dates.

Do not recommend retaining `.tok2`, executing arbitrary tokenizer code,
choosing a convenient source file when locked files disagree, normalizing away
a parity failure, replacing exact token bytes with Unicode guesses, relying on
one implementation as its own oracle, weakening bounds for the real tokenizer,
or treating tokenizer parity as model quality.

## Prompt 6: Declarative Qwen3 Chat Framing, Prompt Assembly, And Deterministic Sampling

You are an independent principal chat-template engineer, language-model serving
researcher, deterministic-sampling specialist, and prompt-boundary security
architect. Produce an implementation-grade design for publisher-exact Qwen3
message framing, bounded prompt assembly, stop behavior, and deterministic
sampling using declarative Template2, Prompt2, and Sampling2 artifacts. You have
internet access but no TinyRustLM source, private artifact bytes, source
checkpoint, raw model outputs, browser application, test suite, or credentials.
Do not claim private validation.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local chat product. There is no product
  V2. Template2, Prompt2, and Sampling2 are technical schema identities only.
  The project will delete superseded framing and sampling code rather than
  retain compatibility templates, selectors, fallbacks, or repair paths.
- The current structural source lock is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, explicitly classified as a base
  model. A public tokenizer configuration may contain a chat template, but that
  does not prove the base checkpoint has assistant post-training. The report
  must keep framing parity separate from behavioral suitability.
- One composition is intended to bind exactly one model, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2 identity. A browser may not evaluate
  arbitrary Jinja, Python, or JavaScript from a model repository.
- The declarative template must specify legal roles/order, inserted token IDs,
  separators, message content, generation prompt, stop tokens, empty content,
  thinking behavior, content and message limits, and malformed-input rejection.
- Sampling must cover greedy and one exact seeded method with explicit PRNG,
  temperature, top-k, top-p, repetition penalty, stable ties, nonfinite-logit
  handling, vocabulary bounds, stop tokens, maximum output, cancellation, and
  context exhaustion. Hidden retries, best-of-N, response completion, and
  judge rewriting are prohibited.
- Current private planning supplies fixed 512-byte Prompt2 and 65,800-byte
  Sampling2 artifacts plus exact hashes. These are local facts requiring
  verification, not public evidence.
- MemoryEndpoints is unauthorized and disconnected. Retrieved or quoted text
  is untrusted data and may not become instruction authority or simulated
  hosted memory.

Research official Qwen3 model cards, tokenizer configuration and template at
the exact pinned revision, compatible Transformers template execution,
generation configuration, thinking and non-thinking behavior, special tokens,
deterministic PRNG standards, top-k/top-p algorithms, repetition penalties,
and prompt-injection boundary research. Address:

1. Determine exactly what public framing data exists at the pinned revision
   and which checkpoint classes it applies to. Distinguish base, pretrained,
   instruct, chat, reasoning, and thinking-enabled variants. State what cannot
   be inferred about the locked base model.
2. Reconstruct the official message-rendering algorithm for supported roles,
   including system, user, assistant, and tool roles only where actually
   documented. Enumerate inserted token IDs, literal byte sequences, generation
   prompt, stop tokens, assistant-prefix behavior, and empty-message handling.
3. Explain Qwen3 thinking controls at the pinned revision. Identify defaults,
   template arguments, visible/hidden reasoning delimiters, stop behavior, and
   differences among Transformers versions. Recommend an explicit mode; never
   inherit an undocumented default.
4. Design a non-Turing-complete Template2 instruction set with the minimum
   operations needed for exact rendering. Define canonical binary or canonical
   structured encoding, closed operands, role dispatch, bounded iteration over
   messages, literal insertion, content insertion, conditional flags, and
   rejection of arbitrary expressions or field access.
5. Specify Prompt2 as the bounded assembly owner. Bind template output,
   tokenizer identity, model vocabulary/context, trusted product instructions,
   untrusted quoted/retrieved data, conversation turns, truncation policy,
   generation budget, and final token sequence. Define precedence so the latest
   user instruction supersedes stale profile state without allowing quoted
   text to become authority.
6. Design context truncation using exact tokenizer counts. Preserve complete
   role framing, latest turns, current user request, and necessary trusted
   instructions. Address summaries, tool material if supported, oversized
   single turns, context exhaustion, and truthful errors. Do not silently turn
   raw chat into durable memory.
7. Define Sampling2 bytes and semantics. Select and fully specify one seeded
   PRNG, seed serialization, random-number-to-float mapping, temperature
   transformation, stable top-k ordering, top-p cumulative selection,
   renormalization, repetition-penalty token history, and categorical draw.
8. Analyze floating-point determinism across native Rust, scalar WASM, WASM
   SIMD, JavaScript oracles, x86-64, and ARM64. Identify operations requiring
   scalar reference semantics, canonical tie handling, or tolerance versus
   exact token-selection vectors.
9. Specify fail-closed logit sanitization. Cover NaN, positive/negative
   infinity, all-masked vocabularies, zero total probability, overflow,
   underflow, temperature zero, top-k zero or above vocabulary, top-p boundary
   values, negative repetition penalty, and out-of-range token IDs.
10. Design stop, cancel, and completion rules. Address one-token and multi-token
    stop sequences, stop prefixes spanning generated tokens, EOS, maximum
    tokens, context limit, user cancellation, worker termination, and preserving
    partial raw output without promoting it to completed quality evidence.
11. Build publisher-parity and metamorphic vectors: role permutations,
    empty/systemless conversations, Unicode, code, JSON, quoted malicious
    instructions, thinking toggles, long turns, repeated tokens, tied logits,
    extreme sampling parameters, exact seeds, and malformed artifacts.
12. Define an evidence ladder from source-template equivalence and sampling
    vectors through native/WASM token parity and untouched multi-turn quality.
    State why a correct template cannot make an unsuitable base model into a
    useful assistant.

Required report structure:

1. Executive recommendation and assumptions.
2. Public Qwen3 template/generation observation log.
3. Checkpoint capability and applicability analysis.
4. Publisher-exact rendering specification.
5. Declarative Template2 schema and interpreter.
6. Prompt2 assembly, precedence, and truncation design.
7. Sampling2 schema and mathematical specification.
8. Native/WASM determinism analysis.
9. Stop, cancel, and terminal-state model.
10. Security and untrusted-data threat model.
11. Differential and hostile test vectors.
12. Claim taxonomy and promotion evidence.
13. Clean implementation sequence.
14. Unknowns requiring private artifacts or outputs.
15. Annotated primary-source bibliography with dates.

Do not recommend executing arbitrary Jinja or JavaScript, inventing a chat
template, advertising a base checkpoint as instruction-tuned, retaining old
framing for compatibility, relying on an implicit thinking default, hiding
reasoning accidentally, choosing a favorable seed after output, retrying a
generation, repairing malformed output, or treating template parity as quality.

## Prompt 7: Independent Source-Framework Oracle And Layerwise Numerical Parity Protocol

You are an independent principal numerical-verification engineer, PyTorch and
Transformers researcher, differential-testing architect, and model-inference
auditor. Produce a rigorous protocol for proving that a converted Qwen3 0.6B
artifact and its native and browser runtimes preserve the intended source-model
computation within preregistered tolerances. You have internet access and may
inspect public model and framework sources, but you have no TinyRustLM source,
private SLM2 artifact, source checkpoint copy, conversion output, runtime,
test vectors, raw logits, browser profile, or credentials. Do not claim local
execution or private validation.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch product. SLM2 and evidence suffixes are technical
  identities, not product generations. A wrong numerical path is replaced and
  deleted; no compatibility implementation, alternate legacy kernel, repair,
  retry, best-of-N, or loosened post-hoc tolerance is allowed.
- The locked public source is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, with exact source files and an
  Apache-2.0 disposition. It is a base-model checkpoint, so numerical parity
  says nothing by itself about assistant quality.
- Supplied architecture facts are vocabulary 151,936, hidden width 1,024,
  intermediate width 3,072, 28 layers, 16 query heads, 8 key/value heads, head
  dimension 128, context 40,960, tied embeddings, Q/K normalization, no QKV
  bias, RMSNorm, rotary embeddings, and a gated MLP.
- The intended SLM2 model uses mixed q8 storage. Tokenizer2, Template2,
  Prompt2, Sampling2, and ACG2 are separate bound artifacts. Parity must begin
  with exact tokenizer and prompt tokens before comparing model tensors.
- The project has an unsafe-free scalar Rust correctness authority and intends
  to compare an immutable source-framework oracle, converted SLM2, scalar
  native runtime, and browser-WASM runtime on identical inputs. Exact private
  implementations require local inspection.
- Tolerances, vector families, seeds, comparison points, and stop rules must be
  preregistered before observing candidate results. First failures are
  preserved. A failed vector is fixed generically, not removed or rewritten.
- Raw model inputs, intermediate tensors, and outputs may be private. Public
  results may expose safe identities, shapes, hashes, aggregate errors, and
  bounded verdicts, not secret prompts or full model data.

Research the exact Qwen3 source and compatible immutable Transformers/PyTorch
revisions, safetensors loading, CPU determinism, bfloat16/float32 behavior,
quantized-model validation, numerical error metrics, conformance testing, and
browser WebAssembly floating-point semantics. Address:

1. Define the oracle environment. Pin model revision, tokenizer files,
   Transformers commit, PyTorch build, safetensors version, Python version,
   device, thread count, dtype, deterministic flags, BLAS backend, CPU feature
   state, locale, and every material environment variable. Explain which facts
   must be content-addressed rather than represented by a version string.
2. Reconstruct source forward-pass semantics from official code. Enumerate
   embedding lookup, each RMSNorm, Q/K/V projection, Q/K norm, reshape and head
   ordering, RoPE, grouped-query replication, mask values, softmax precision,
   attention output, output projection, residuals, gated MLP, final norm, and
   logits.
3. Define a language-neutral vector schema. Bind artifact and implementation
   identities, prompt-token IDs, position IDs, attention mask, cache state,
   selected checkpoints, dtype, shape, byte encoding, hash, and comparison
   rules. Keep vectors bounded while retaining enough data to localize the
   first divergence.
4. Design a trace strategy that avoids dumping every activation for a 28-layer
   model. Compare full tensors, deterministic slices, projection outputs,
   per-row hashes, norms, statistics, Merkle trees, and challenge-selected
   elements. State when a compact trace is diagnostic evidence rather than
   proof of complete equality.
5. Separate three comparisons: source framework versus dequantized converted
   weights; source forward pass versus a high-precision SLM2 reference; and
   native scalar versus browser-WASM runtime. Define which should be exact and
   which require numerical tolerances.
6. Propose tolerances before results. Give principled absolute, relative, ULP,
   cosine, norm-ratio, KL, top-k overlap, and token-rank criteria for weights,
   intermediate activations, logits, and selected tokens. Address values near
   zero, outliers, accumulated depth error, and quantization error budgets.
7. Design vector families that isolate semantics: one token, repeated token,
   multiple positions, long position/RoPE, GQA head identity, masked prefixes,
   cache prefill, one-step decode, cache reuse, context edge, tied output,
   Unicode-derived tokens, and stop-token generation.
8. Specify KV-cache parity. Compare prefill and incremental decode against
   full recomputation; bind cache layout, dtype, layer/head/position indexing,
   RoPE application point, growth, reuse, truncation, and cancellation. Detect
   off-by-one and stale-cache contamination.
9. Define seeded generation parity. First prove logits, then greedy selection,
   then declared seeded sampling. Explain when tiny logit differences may alter
   a sampled token and how to report that honestly without retrying or choosing
   a favorable seed.
10. Prevent oracle monoculture. Recommend an independent mathematical reference
    for selected layers or operations and a second parser for SLM2 metadata.
    Analyze risks when both oracle and converter derive assumptions from the
    same Transformers code.
11. Design first-failure triage. Use binary search across layers/operations,
    preserve raw failed vectors, classify format, mapping, transpose,
    quantization, kernel, cache, sampler, or oracle defect, add a generic
    regression, and rerun only invalidated phases under a new evidence identity.
12. Create a fault-injection matrix for wrong tensor order, swapped Q/K, missing
    Q/K norm, incorrect RoPE interleave, wrong base, GQA replication error,
    mask sign, f16 overflow, q8 scale error, SIMD reduction order, cache stride,
    tied-output duplication, tokenizer drift, and oracle version drift.

Required report structure:

1. Executive verification recommendation.
2. Public source and framework observation log.
3. Pinned oracle environment manifest.
4. Exact forward-pass operation graph.
5. Language-neutral vector and trace schemas.
6. Comparison layers and preregistered tolerances.
7. Quantization-error methodology.
8. KV-cache and incremental-decode protocol.
9. Greedy and seeded generation parity.
10. Independent-oracle strategy.
11. First-failure localization workflow.
12. Fault-injection matrix.
13. Evidence, privacy, and claim boundaries.
14. Prioritized implementation plan.
15. Unknowns requiring private artifacts and hardware.
16. Annotated primary-source bibliography with dates.

Do not recommend selecting tolerances after seeing failures, comparing only
final text, treating matching token IDs as proof of matching logits, using one
implementation as its own oracle, hiding failed vectors, changing prompts or
seeds to obtain a pass, repairing outputs, or equating numerical parity with
conversational quality.

## Prompt 8: Qwen3 0.6B Native And Browser-WASM Kernels, Memory, And KV-Cache Engineering

You are an independent principal CPU inference engineer, WebAssembly
performance researcher, transformer-kernel specialist, and resource-bounded
systems architect. Produce a deeply technical design for running a mixed-q8
Qwen3 0.6B model efficiently and accurately on local desktop CPUs and in a
browser WebAssembly worker. You have internet access but no TinyRustLM source,
SLM2 artifact, benchmark logs, browser profiles, runtime binaries, hardware,
or credentials. Do not invent measurements or claim private execution.

Project-supplied context, not independently verified:

- TinyRustLM is a single prelaunch browser-local product. SLM2 is a technical
  format identity, not a product V2. Performance work must leave one maintained
  architecture with one scalar correctness authority. It may not retain an old
  runtime, duplicate parser, compatibility kernel, silent fallback, or known
  debt.
- The target architecture is supplied as 596,049,920 logical parameters,
  vocabulary 151,936, width 1,024, MLP width 3,072, 28 layers, 16 query heads,
  8 KV heads, head dimension 128, context ceiling 40,960, tied embeddings,
  Q/K normalization, GQA, RMSNorm, RoPE, and gated MLP.
- The intended model storage is mixed q8 with bounded higher-precision tensors.
  A scalar Rust implementation is the planned numerical authority. Native and
  browser-WASM optimized execution must first pass exact structure and declared
  numerical parity vectors.
- Browser model bytes and prompts stay local or direct P2P. Large-model parse,
  hashing, inference, and cache management run off the UI thread. The browser
  must avoid unbounded copies and give truthful memory/capability errors.
- Arithmetic helpers may be deterministic, but model generation cannot use
  hidden remote inference, canned responses, retries, best-of-N, response
  repair, or simulated model output.
- Real measurements are required for initialization, first token, decode rate,
  peak resident memory, browser memory, storage, scratch, and cache growth. The
  report should provide formulas and methodology, not fabricated results.

Research current Rust CPU SIMD, x86-64 AVX2/AVX-512 and ARM64 NEON, WebAssembly
SIMD, relaxed SIMD, threads, shared memory, cross-origin isolation, browser
memory limits, quantized GEMV/GEMM, KV-cache quantization, paged attention,
FlashAttention concepts relevant to CPU, and edge-inference literature.
Address:

1. Build an exact compute and memory model for prefill and token decode. Derive
   operations and bytes moved for embeddings, every attention projection,
   Q/K norm, RoPE, attention scores, value reduction, output projection, gated
   MLP, final norm, and vocabulary projection.
2. Derive model storage, mapped/resident pages, dequantization scratch,
   activation buffers, logits, tokenizer, prompt, worker-transfer, and KV-cache
   formulas. Show cache bytes per token for f32, f16, bf16, q8, and candidate
   compressed layouts across 28 layers and 8 KV heads of dimension 128.
3. Recommend one reference tensor layout and one optimized packed layout only
   if both are semantically bound and the latter is generated deterministically.
   Analyze row alignment, blocks, scales, cache locality, false sharing,
   endianness, and zero-copy file mapping or browser views.
4. Design q8 matrix-vector and matrix-matrix kernels. Give loop nests,
   blocking, widening types, accumulation precision, scale application,
   horizontal reduction, tail handling, alignment, and stable error behavior.
   Compare prefill GEMM and decode GEMV requirements.
5. Define CPU feature policy. Compare one WASM SIMD baseline, runtime feature
   gating, native multiversioning, build-time targets, and explicit unsupported
   states. Feature selection must not preserve an obsolete implementation as a
   hidden compatibility fallback.
6. Analyze threading. Cover layer and matrix parallelism, work-stealing versus
   fixed partitions, Web Workers, `SharedArrayBuffer`, COOP/COEP, atomics,
   oversubscription, NUMA, cancellation, deterministic reductions, and the
   point at which threading overhead exceeds benefit for one-token decode.
7. Design KV-cache ownership and layout. Address layer/head/position strides,
   prefill versus append, maximum context, sliding windows only if the publisher
   model supports them, quantized cache scales, cache reuse across turns,
   cancellation rollback, model switching, and stale-generation isolation.
8. Evaluate TurboQuant-, TurboVec-, KIVI-, HQQ-, AWQ-, GPTQ-, SmoothQuant-, and
   other relevant weight or KV techniques strictly from primary sources.
   Separate training-time, post-training, hardware-specific, and browser-
   portable methods. Identify which concepts can be independently implemented
   without importing incompatible formats or unsupported claims.
9. Specify memory-pressure behavior. Preflight model plus worst-declared cache,
   cap context, allocate incrementally, detect allocation failure, avoid memory
   growth invalidating JavaScript views, free deterministically, and surface a
   typed truthful error instead of crashing or silently shortening context.
10. Design browser-WASM loading with at most one bounded transfer or direct
    backing strategy. Compare `ArrayBuffer`, transferable buffers, shared
    memory, OPFS sync access handles in workers, IndexedDB blobs, memory-mapped
    native files, and chunked validation. Count every unavoidable copy.
11. Define benchmark methodology. Pin CPU, microcode, power mode, browser,
    WASM flags, runtime/artifact hashes, thread count, context, prompt tokens,
    output tokens, warmup policy, repetitions declared in advance, clocks,
    confidence intervals, and thermal throttling. Report distributions, not a
    best run.
12. Create correctness and fault tests for alignment, tails, scale zero,
    nonfinite values, integer overflow, SIMD feature mismatch, thread races,
    cancellation, worker death, memory growth, cache bounds, context edge,
    model switch, and native/WASM token divergence.

Required report structure:

1. Executive runtime recommendation and assumptions.
2. Primary-source technology matrix.
3. Qwen3 operation and byte-traffic model.
4. Complete memory and KV-cache formulas.
5. Tensor and cache layout specification.
6. Native and WASM kernel pseudocode.
7. SIMD and threading policy.
8. Quantization and compressed-cache evaluation.
9. Browser memory and zero-copy analysis.
10. Cancellation and resource-lifecycle design.
11. Benchmark and statistical protocol.
12. Correctness and fault-injection matrix.
13. Clean implementation sequence.
14. Rejected approaches and residual risks.
15. Unknowns requiring private artifacts and real hardware.
16. Annotated primary-source bibliography with dates.

Do not recommend a second legacy runtime, opaque hardware-only kernels without
parity, predequantizing the full model into an unbounded second copy, assuming
40,960 tokens fit because the format declares them, silently reducing context,
benchmarking only the best run, inventing browser performance, selecting a
different quantization after failures without a new identity, or using remote
inference as a fallback.

## Prompt 9: Transactional Browser Installation, Worker Execution, And Exactly-Once Chat State

You are an independent principal browser-runtime architect, storage and worker
specialist, reliability engineer, accessibility lead, and privacy-focused AI
interaction tester. Produce a complete design for installing a verified
multi-file Qwen3 SLM2 composition in a browser, activating it transactionally,
running generation off the UI thread, and rendering exactly one assistant
message per turn. You have internet access but no TinyRustLM source, browser
bundle, design files, private model artifacts, Playwright traces, screenshots,
credentials, or test machines. Do not claim to have inspected or tested the
private product.

Project-supplied context, not independently verified:

- TinyRustLM.com is a prelaunch browser-local chat product. There is one
  product, no product V1/V2, and no reason to retain old model import, old
  storage schema, duplicate renderer, compatibility worker, fallback runtime,
  or known debt. A clean cut must delete the superseded executable closure.
- A model is one immutable composition binding six members: SLM2 model,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. Every member has exact
  length and SHA-256 identity and is parsed with bounded canonical rules before
  activation.
- Model bytes come from a reviewed local conversion or a verified direct P2P
  peer, never a project-hosted model endpoint. Prompts and generated text do
  not go to project sites. MemoryEndpoints is unauthorized and disconnected.
- Ingestion, streamed hashing, parsing, persistence, and generation must run
  outside the UI thread. There must not be a second unbounded full-model copy.
- The currently active model remains usable until every member of a candidate
  composition validates and a startup smoke succeeds. Activation is atomic.
  Failure preserves truthful evidence and does not repair or partially install
  the candidate.
- One conversation turn has one request identity, one generation owner, one
  terminal status, and one assistant rendering path. Duplicate, stale,
  out-of-order, or post-terminal worker events must not append text twice.
- The approved visual language is locked. Functional improvements must keep a
  stable conversation workspace, fixed usable composer, introductory cards
  that disappear after chat begins, truthful progress/errors, responsive
  layout, keyboard access, screen-reader support, and reduced motion.

Research current IndexedDB, OPFS, File System Access, Storage Buckets where
available, quota and eviction, service workers, Dedicated/Shared Workers,
WebAssembly memory, transferable streams and buffers, Web Locks,
BroadcastChannel, structured cloning, browser process isolation, Playwright,
and accessibility standards. Address:

1. Compare IndexedDB blobs, chunk records, OPFS files, sync access handles in a
   worker, user-selected file handles, and hybrid metadata/blob designs for a
   roughly 0.6 GB q8 model plus sidecars. Analyze browser support, copy count,
   atomicity, durability, random access, quota, backup, and deletion.
2. Define one current storage schema with no predecessor reader. Bind
   composition identity, member identities, lengths, validation status,
   installation transaction, active pointer, last successful runtime smoke,
   and deletion state. Unknown or stale records fail closed.
3. Design streaming acquisition and hashing. Handle chunk boundaries,
   backpressure, cancellation, restart, partial verified state, duplicate
   chunks, wrong length, hash mismatch, source closure, and browser crash while
   avoiding full buffering in JavaScript memory.
4. Specify transactional installation. Use candidate staging, complete member
   verification, bounded parse, resource preflight, worker startup smoke,
   durable candidate commit, and atomic active-pointer change. Classify every
   crash snapshot and guarantee the previous active composition remains valid.
5. Define quota and eviction behavior. Estimate required storage before
   acquisition, call persistence APIs honestly, detect partial eviction or
   external deletion, revalidate on startup, protect unrelated origin data,
   and present actionable errors without claiming data is durable when the
   browser can evict it.
6. Design worker ownership and protocol. Specify closed message schemas,
   conversation/turn/generation IDs, monotonically increasing sequence numbers,
   exact artifact identity, request cancellation, terminal events, bounded
   diagnostics, and rejection of duplicate, stale, malformed, or unexpected
   messages.
7. Give an exactly-once UI reducer algorithm over at-least-once or reordered
   event delivery. Preserve raw token IDs separately from incremental decoded
   text, handle UTF-8 sequences split across tokens, sanitize rendered Markdown,
   and prevent multiple event listeners or retry paths from appending one
   answer twice.
8. Define generation lifecycle under cancel, timeout, WASM trap, worker crash,
   tab suspension, navigation, page reload, browser process death, and model
   switch. Partial output remains labeled partial; late events cannot change a
   terminal state.
9. Design service-worker and application deployment upgrades. Bind runtime
   assets to a release identity, prevent a stale service worker from pairing
   incompatible code with a composition, support atomic static-asset updates,
   and avoid retaining an obsolete runtime as compatibility support.
10. Specify privacy and network assertions. Instrument fetch, XHR, WebSocket,
    WebTransport if used, service-worker traffic, navigation, referrer, CSP,
    reporting, analytics, and crash logs. Fail on prompt/model upload,
    credential-bearing URLs, hidden telemetry, or unexpected third parties.
11. Design responsive and accessible assertions for desktop, narrow desktop,
    and mobile. Cover overlap, stable composer, scroll anchoring, long model
    names, long unbroken output, focus, keyboard order, screen-reader labels,
    live-region throttling, reduced motion, cancellation, and truthful status.
12. Produce a clean-profile acceptance protocol: create an owned persistent
    browser profile, install a real composition, execute two to six genuine
    turns, cancel once, close the full browser process, prove handles closed,
    restart, verify declared persistence, delete model state, delete the owned
    profile with guarded path checks, and scan evidence for secrets.

Required report structure:

1. Executive browser architecture recommendation.
2. Primary-source browser capability matrix with dates.
3. Storage technology comparison and chosen ownership model.
4. Canonical storage and installation schemas.
5. Streaming ingestion and transactional activation algorithm.
6. Quota, eviction, restart, and deletion semantics.
7. Worker protocol and exactly-once state machine.
8. Incremental decoding and safe rendering design.
9. Failure, cancellation, and model-switch matrix.
10. Service-worker/runtime release coherence.
11. Privacy and network allow/deny contract.
12. Responsive/accessibility assertion matrix.
13. Clean-profile acceptance and evidence protocol.
14. Prioritized clean implementation sequence.
15. Unknowns requiring private UI and browser tests.
16. Annotated primary-source bibliography with dates.

Do not recommend localStorage for model bytes, one giant unbounded ArrayBuffer,
a second complete model copy, partial activation, silent eviction recovery,
multiple assistant appenders, response repair, page reload as a clean profile,
an old storage reader for compatibility, hidden prompt telemetry, project-
hosted model bytes, or simulated browser evidence.

## Prompt 10: Authenticated Loopback P2P-Or-Convert Acquisition That Performs The User's Action

You are an independent principal local-companion protocol architect, P2P
transfer engineer, browser-security researcher, and long-running workflow
designer. Produce a production-grade design for a browser action that obtains
an exact TinyRustLM composition from direct peers when available and otherwise
acquires reviewed public source files and performs local conversion through an
authenticated companion. You have internet access but no TinyRustLM source,
companion binary, private model files, catalog account, peer endpoints,
network configuration, browser traces, credentials, or production access. Do
not claim that any private or live path was tested.

Project-supplied context, not independently verified:

- TinyRustLM.com is a prelaunch browser-local chat product. MiniModel.org is
  intended to provide catalog and discovery metadata, not model bytes. Model
  bytes move only from reviewed local files, pinned public source hosts during
  local conversion, or consenting direct peers.
- There is one product and one maintained acquisition path. There is no product
  V2, no legacy text-file download, generated script download, compatibility
  command, fallback UI, migration path, hidden retry, stale-output adoption, or
  known debt. Clicking the model action must perform the requested workflow,
  not download instructions for the user to interpret.
- A composition contains exact SLM2, Tokenizer2, Template2, Sampling2, Prompt2,
  and ACG2 identities. Hash equality of one model file alone is insufficient.
  Catalog metadata must bind the complete composition, provenance, license,
  structural evidence, quality claim level, and current peer eligibility.
- Direct P2P is preferred only when an eligible peer advertises the exact
  verified composition and every streamed piece verifies. If no eligible peer
  exists, the companion may acquire exact pinned public source files after a
  clear review/consent step, verify source locks, convert locally, independently
  validate the composition, and transfer it to the browser.
- Browser-to-companion operations are loopback-only, versioned, origin-bound,
  capability-authorized, replay-resistant, bounded, resumable where the
  declared product supports it, and observable through typed states. The page
  must never execute downloaded shell text or trust a URL merely because it is
  loopback.
- A loopback or LAN success is not public P2P reachability. Sharing, firewall,
  router, tunnel, and catalog-announcement state require explicit consent and
  separate outside-network evidence.
- Prompts and generated text remain local. Project sites must not receive model
  bytes. MemoryEndpoints is unauthorized and disconnected.

Research browser Private Network Access, Fetch/CORS, loopback origin security,
DNS rebinding, CSRF, WebSocket security, capability URLs and tokens, native
messaging alternatives, resumable HTTP transfers, content-addressed P2P
protocols, Merkle/piece verification, Hugging Face immutable downloads,
service discovery, and secure local daemon design. Address:

1. Define one user-visible state machine from selection through catalog
   resolution, source/provenance review, capability establishment, peer
   discovery, P2P preflight, source-acquisition decision, transfer/conversion,
   validation, browser installation, activation, completion, cancellation,
   resumable blockage, and terminal failure.
2. Specify catalog records. Bind model and complete composition identities,
   source revisions, license, quality claim, piece set, peer endpoints,
   expiration, revocation, proof status, companion protocol requirements, and
   local-conversion source locks. Unknown, stale, surplus, or contradictory
   fields fail closed.
3. Design authenticated loopback enrollment. Compare ephemeral pairing codes,
   origin-bound capabilities, proof of possession, public-key challenge,
   browser extension/native messaging, and mTLS. Defend against DNS rebinding,
   malicious websites, CSRF, token leakage, localhost port scanning, replay,
   browser restart, and another local user.
4. Define a closed command protocol. Bind request ID, browser origin and release,
   companion identity, operation, composition, source or peer plan, resource
   limits, cancellation authority, prior progress identity, and expected
   terminal receipt. No shell command, arbitrary path, arbitrary URL, or
   page-supplied executable argument is accepted.
5. Design exact peer discovery and selection. Verify signed metadata where
   applicable, expiry, composition equality, piece-set identity, endpoint
   normalization, peer independence, privacy, failure history, and honest
   statuses. Do not call metadata a proof that a peer is reachable.
6. Specify resumable piece transfer. Use fixed piece identities, streamed
   hashing, range semantics, bounded concurrency, journal durability, duplicate
   suppression, peer mixing only after complete identity agreement, corruption
   quarantine, cancellation, peer loss, companion restart, and atomic final
   promotion.
7. Define the local-conversion branch. Review immutable source repository and
   file identities, license, expected download size and free space, acquire
   directly from pinned public source hosts, hash while streaming, preserve
   resumable partials safely, invoke one exact registered converter, and never
   disguise source download as P2P success.
8. Design browser transfer after companion validation. Compare loopback HTTP
   range transfer, streamed Fetch, WebSocket, and user-selected file handles.
   Bind every byte to the composition, apply backpressure, avoid full duplicate
   buffers, and integrate with transactional browser installation.
9. Specify privacy/network policy. Permit only exact project static assets,
   catalog metadata, authorized direct peer traffic, pinned public source hosts
   in the conversion branch, and authenticated loopback. Fail on prompt/model
   upload to project sites, hidden telemetry, arbitrary third parties,
   credential-bearing URLs, and silent proxying.
10. Define explicit sharing controls. Local conversion does not automatically
    publish, seed, open a firewall, alter a router, announce a peer, or expose
    an endpoint. Design opt-in, bandwidth/storage limits, shutdown, revocation,
    and truthful configured/local/public statuses.
11. Design long-running UX. Show exact phase, source and composition identity,
    total/received/verified bytes, conversion phase, measured rate, bounded
    estimate, required space, resumability, cancel result, provenance, quality
    state, and actionable typed errors. Avoid fake percent completion.
12. Produce a real acceptance ladder: hostile catalog fixtures, loopback attack
    tests, fake bounded pieces, one real immutable source acquisition, one real
    local conversion, one independent direct peer, deliberate peer loss,
    companion restart, browser restart, transactional activation, network
    capture, and outside proof only when authorized.

Required report structure:

1. Executive acquisition recommendation.
2. Public standards and implementation observation log.
3. End-to-end user and operation state machines.
4. Catalog and complete-composition schema.
5. Loopback authentication and threat model.
6. Closed command and receipt protocol.
7. P2P discovery, transfer, and resumability design.
8. Local source-acquisition and conversion branch.
9. Browser transfer and transactional-install integration.
10. Network/privacy allow-and-deny contract.
11. Sharing consent and public-proof boundary.
12. Long-running UX specification.
13. Fault-injection and acceptance matrix.
14. Clean implementation sequence.
15. Unknowns requiring private code, peers, or credentials.
16. Annotated primary-source bibliography with dates.

Do not recommend downloading a text explanation or script, executing page-
supplied commands, trusting loopback without authentication, accepting one file
hash instead of the complete composition, mixing incompatible peer pieces,
using project sites as a model proxy, hiding source conversion behind a P2P
label, silently opening network state, retaining the old download behavior, or
counting loopback as public reachability.

## Prompt 11: Migration-Free Removal Of Every SLM1 And ACG1 Executable Path

You are an independent principal software-architecture auditor, Rust and
browser build-graph specialist, package-surface reviewer, and clean-slate
cutover engineer. Produce a rigorous methodology and implementation plan for
replacing a prelaunch product's entire predecessor model-format closure with
one SLM2-only architecture and proving that no executable legacy path remains.
You have internet access but no TinyRustLM source, build graph, packages,
documentation repository, CI output, browser bundle, deployment account, or
credentials. Do not claim to have inspected the private codebase.

Project-supplied context, not independently verified:

- TinyRustLM is not public and has no product V1 or V2. It is one prelaunch
  product. SLM1/SLM2 and ACG1/ACG2 name technical formats, not supported product
  generations. There are no existing users or artifacts that justify runtime
  compatibility.
- Project policy requires the best current architecture with zero known debt.
  A replacement becomes the sole maintained path and deletes its complete
  superseded executable closure in the same fully tested cutover. Excluding an
  old crate from the default build is insufficient if any caller, package,
  test helper, documentation, site asset, or operator command can still reach
  it.
- A current internal audit reportedly finds old SLM1 runtime/packer source
  under paths analogous to `tinyrustlm/runtime` and
  `tinyrustlm/tools/slm_pack`, ACG1 or `.acg1` browser and dogfood admission,
  direct `tinyrustlm-slm-pack` smoke and qualification callers, and 76 tracked
  files across six preregistered deletion paths. Exact private paths and
  references require local verification.
- The intended replacement includes Rust SLM2 parsing and runtime, Tokenizer2,
  Template2, Sampling2, Prompt2, ACG2 composition, conversion, independent
  inspection, native and WASM inference, browser storage/activation, companion
  acquisition, tests, packages, documentation, and site guidance.
- Immutable historical receipts and raw failures may retain old terms as inert
  audit evidence. Negative tests may contain forbidden old identities solely
  to prove rejection. Historical preservation must never become an executable
  reader, fixture-generation path, or advertised compatibility feature.
- No release or deployment is allowed while known predecessor code, aliases,
  feature flags, fallback behavior, migration branches, stale docs, or weak
  tests remain in the released closure.

Research clean-slate replacement strategies, build graph and call graph
analysis, Rust Cargo workspace behavior, JavaScript module graphs, WebAssembly
linkage, .NET package assets, C ABI exports, binary and archive inspection,
dead-code elimination limitations, docs-as-code, and negative capability tests.
Address:

1. Define the complete meaning of an executable predecessor closure. Include
   source, generated code, build scripts, Cargo members/features, binary entry
   points, C ABI, .NET P/Invoke and wrappers, WASM exports/imports, JavaScript
   workers, browser UI, service workers, fixtures, test helpers, CLIs, package
   assets, scripts, examples, docs commands, and deployed static files.
2. Distinguish legitimate inert history from maintained legacy support. Give
   machine-checkable rules for Git history, append-only receipts, archived raw
   reports, negative rejection vectors, current source, current docs, and
   package contents.
3. Design an ownership map in which every current responsibility has exactly
   one SLM2-era owner: format parser, model validator, converter, tokenizer,
   template, prompt assembly, sampler, composition resolver, native runtime,
   WASM runtime, browser installer, companion protocol, evaluator, and release
   evidence.
4. Specify dependency-order cutover. Complete and verify each replacement
   contract before repointing callers, then delete every predecessor owner and
   caller in the same coherent change. Explain how to avoid temporarily wiring
   an undefined format into the browser and accidentally preserving it.
5. Build a repository audit method using `cargo metadata`, crate graphs,
   feature enumeration, `rg`, language-aware AST/call analysis, JavaScript
   import graphs, MSBuild project assets, generated bindings, symbol tables,
   archive inventories, WASM import/export inspection, package extraction, and
   site artifact scans.
6. Address false positives and false negatives. Old terms may appear in
   historical receipts or negative tests, while legacy behavior can survive
   under renamed symbols or generic format dispatch. Define semantic checks,
   allowlisted historical locations, and review of generic selectors.
7. Design negative product tests. Old magic bytes, extensions, schema IDs,
   CLI names, routes, worker messages, package APIs, catalog records, and
   storage records must reject through the one current boundary. Tests must not
   ship an old parser merely to demonstrate rejection.
8. Define deletion proof for source and generated artifacts. Cover clean build
   from a fresh checkout, target/bin/obj removal, lockfile updates, package
   rebuild, static-site rebuild, service-worker cache invalidation, symbol and
   string scans, and fresh browser profile behavior.
9. Audit public API and package surfaces. Explain how to remove old Rust APIs,
   C exports, .NET types, NuGet native assets, CLI commands, docs examples, and
   browser-facing actions without aliases, deprecation windows, or migration
   helpers in a product that has not launched.
10. Design documentation and marketing cutover. Every current architecture,
    API, model lifecycle, user workflow, error message, download action,
    release note, and public claim must describe the sole SLM2 path. Historical
    design records remain clearly labeled noncurrent and nonexecutable.
11. Create a no-debt review gate. Check bounded parsing, single authority,
    fail-closed errors, no TODO workaround, no duplicate pipeline, no fallback,
    no disabled old code, no stale tests, complete docs, security/privacy
    boundaries, and explicit residual risks. Define objective evidence for each.
12. Produce a cross-component acceptance matrix and source-control ceremony:
    focused tests, full Rust and managed tests, Clippy/warnings, formatting,
    fuzz/hostile cases, package consumers, native and WASM parity, browser tests,
    secret scans, docs/link checks, changed-path review, commit, push, fresh
    fetch, package inspection, deploy, and HTTPS readback.

Required report structure:

1. Executive clean-cut recommendation.
2. Explicit supplied facts and unavailable private facts.
3. Definition of executable closure versus inert history.
4. Sole-owner architecture map.
5. Dependency-ordered replacement and deletion plan.
6. Repository/build/package/site audit algorithms.
7. False-positive and renamed-legacy analysis.
8. Negative rejection test specification.
9. API, ABI, package, browser, and storage cutover matrix.
10. Documentation and marketing currency plan.
11. No-debt review gate.
12. Fresh-build and release verification matrix.
13. Source-control and deployment ceremony.
14. Prioritized implementation backlog.
15. Unknowns requiring private source inspection.
16. Annotated primary-source bibliography with dates.

Do not recommend deprecation, compatibility readers, dual writers, migration
utilities, aliases, hidden feature flags, disabled old source, a product V2
label, default-build exclusion as deletion proof, stale examples, or an interim
release that knowingly retains the predecessor closure.

## Prompt 12: First Useful Model Qualification, Enterprise Release Evidence, And Current Documentation

You are an independent principal ML evaluation scientist, release-assurance
architect, supply-chain engineer, and documentation-governance lead. Produce a
complete plan for deciding whether the first real Qwen-family SLM2 composition
is genuinely useful, proving its browser behavior without cheating, and
publishing source, packages, sites, and documentation with claims exactly
bounded by evidence. You have internet access but no TinyRustLM source, model
artifacts, training data, sealed evaluations, raw outputs, browser receipts,
CI, package feeds, deployment credentials, external peers, or production
services. Do not claim that private or live gates have passed.

Project-supplied context, not independently verified:

- TinyRustLM is one prelaunch browser-local product. There is no product V1 or
  V2 and no installed base requiring compatibility. Technical format, schema,
  evidence, package, site-publication, and commit identities remain precise,
  but no legacy code, migration support, fallback, repair, or known debt may be
  released.
- The current structural target is the base checkpoint
  `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, Apache-2.0. Because it is a base
  model, a structurally correct conversion may be useful for numerical proof
  yet fail assistant qualification. A suitable pinned instruct derivative or
  independently trained derivative may be needed; that decision must follow
  untouched source screening and provenance review.
- Product quality includes ordinary conversation, common-sense judgment,
  ambiguity handling, practical resource constraints, conflicting source
  authority, latest-user preference, multi-turn references, untrusted quoted
  or retrieved data, summarization, rewriting, structured output, extraction,
  code explanation, and substantive treatment of lawful adult questions with
  narrow explicit harm boundaries. Arithmetic may be delegated to a
  deterministic calculator.
- Raw candidate outputs must be preserved exactly. Expected-answer injection,
  output completion, response repair, hidden retry, best-of-N, judge rewriting,
  training on holdouts, and threshold changes after observing results are
  prohibited.
- The first-model release requires source lock and license, complete six-member
  composition, independent structural inspection, source/native/WASM numerical
  parity, actual resource measurements, untouched semantic evaluation, genuine
  multi-turn clean-profile browser chat, exactly-once rendering, privacy and
  network proof, package verification, site deployment, current docs, and an
  explicit remaining-risk statement.
- MiniModel.org is catalog/discovery metadata only; model bytes remain local or
  direct P2P. MemoryEndpoints is unauthorized and disconnected, so no hosted
  memory claim or counter is allowed.
- Larger campaign counters remain exactly `0/20` qualified models, `0/50`
  deletion-backed browser rounds, `0/25` authorized live memory rounds,
  `0/40` current outside-network lane proofs, and `0/20` live catalog
  announcements. A first-model milestone does not silently advance them.
- Source should be committed and pushed after every major coherent change that
  builds. Deployment occurs when all applicable tests pass. Each affected site
  must expose a consistent last-published version, UTC publication date, and
  update log, and its marketing and technical documentation must match current
  evidence.

Research current small-model evaluation, contamination detection, model cards,
statistical testing, human review, browser automation, SLSA/in-toto, SBOM and
signing, reproducible packages, changelog and release-note practices,
docs-as-code, deployment attestations, accessibility, privacy testing, and
prelaunch versioning. Address:

1. Define a source-model screen before conversion or training. Use fixed and
   seeded unseen paraphrases, multiple declared seeds only where sampling is
   product behavior, genuine multi-turn cases, untouched outputs, blinded
   human review, practical rejection criteria, and an explicit compute-spend
   stop rule.
2. Design claim levels: source identified, structurally converted,
   independently parsed, numerically matched, runtime smoke, conversation
   screened, task-specific proven, browser-product proven, P2P-ready,
   externally reachable, catalog announced, package published, and site
   deployed. State minimum evidence and prohibited language for each.
3. Specify a layered semantic evaluator. Deterministic checks own objective
   structure; scenario invariants own concrete obligations; model judges are
   advisory and blinded; humans adjudicate consequential ambiguity. Prevent a
   judge from rewriting or completing the candidate answer.
4. Design scenario families and metamorphic variants for all supplied quality
   dimensions. Vary entities, units, resources, authority order, preference
   changes, discourse style, quoted malicious instructions, distractors, and
   multi-turn state. State which verdicts should remain invariant.
5. Define sealed holdout custody and contamination controls. Include exact
   normalization, character/token n-grams, template-family overlap,
   entity-substituted overlap, semantic neighbors, response/answer terms,
   public benchmark overlap, train/eval provenance, deletion lineage, and a
   proof that developers could not choose an easy seed after seeing output.
6. If no public source qualifies, define a derivative path without evaluation
   leakage: licensed curriculum, teacher provenance, assistant-only SFT,
   preference data, distillation options credible at 0.6B, positive-helpful
   dominance over refusals, independent training and evaluation custodians,
   checkpoint lineage, merged-model screening, and compute stop rules.
7. Specify stochastic statistics. Address per-case seed policy, pass
   probability, confidence intervals, correlated failures, multiple
   comparisons across candidates, infrastructure flakes, minimum human review,
   inter-rater agreement, regression budgets, and why best-of-N is invalid
   unless declared as product behavior.
8. Design one real clean-profile browser acceptance run. Bind exact model and
   site release, use a new owned profile, acquire or convert the real
   composition, conduct two to six genuine turns, preserve each raw answer,
   assert exactly-once rendering and cancellation, close the browser process,
   restart according to declared persistence, delete state and profile, and
   scan network/storage/evidence for secrets.
9. Define the first-model assurance case and evidence DAG. Bind source,
   converter, artifacts, parser, oracle, native/WASM runtimes, tokenizer,
   template, sampler, evaluation cases, outputs, browser build/profile,
   network capture, packages, source commit/tree, deployment, and docs. Specify
   invalidation edges and append-only supersession.
10. Build release gates for Rust CLI/crates, native runtime, C ABI if current,
    WASM, browser assets, .NET inspector/companion, NuGet packages, symbols,
    source maps, self-contained archives, SBOM, provenance, signatures, catalog
    metadata, TinyRustLM.com, MiniModel documentation, and public HTTPS readback.
11. Design a no-debt source-control and deployment ceremony. Require focused
    and full tests, warnings denied, format/lint, hostile/fuzz tests, clean
    package consumers, browser/accessibility/privacy tests, secret scan,
    changed-path and forbidden-legacy audit, commit, push, fresh remote readback,
    deploy, cache invalidation, and independent public readback.
12. Define consistent site release ledgers and docs governance. Each affected
    site exposes publication identity, UTC date, source commit/tree where safe,
    deployment identity, changes, security/privacy impact, known limitations,
    supersession/rollback state, and links. Every API, format, workflow,
    architecture, model card, privacy promise, and operational runbook has one
    owner and automated stale-doc triggers.
13. Specify an operator dashboard that never collapses evidence into one green
    boolean. Show first-model phase, exact identities, current operation,
    terminal attempts, resumable acquisition, blockers, evidence freshness,
    release/site versions, and all five unchanged campaign counters.
14. Provide final acceptance and rejection checklists. A useful first model is
    accepted only when all first-model evidence is current and no known legacy
    path or debt remains. Otherwise publish a bounded truthful blocker and the
    next highest-value action, not a diluted claim.

Required report structure:

1. Executive qualification and release recommendation.
2. Explicit project-supplied facts and unavailable evidence.
3. Source-screen and candidate-rejection protocol.
4. Claim taxonomy and prohibited language.
5. Semantic invariant and metamorphic test matrix.
6. Holdout custody and contamination threat model.
7. Derivative training route if public sources fail.
8. Stochastic statistics and human-review protocol.
9. Clean-profile browser acceptance design.
10. First-model assurance case and evidence DAG.
11. Component/package/site release gate matrix.
12. Supply-chain, privacy, and secret controls.
13. Source-control and deployment ceremony.
14. Cross-site release-ledger and docs-currentness schema.
15. Operator dashboard specification.
16. Final acceptance/rejection checklists.
17. Prioritized implementation plan.
18. Unknowns requiring private or authorized live access.
19. Annotated primary-source bibliography with dates.

Do not recommend promoting a base model because it parses, training on sealed
cases, keyword-only scoring, an opaque judge as sole authority, hidden retries,
best-of-N, repaired answers, mocks counted as browser/P2P/live proof, package
creation counted as publication, campaign counter changes without receipts,
product V2 language, legacy support, stale marketing, documentation updated
only at the end, or deployment while a known debt or predecessor path remains.

# Twelve Disconnected Research Prompts: TinyRustLM Package Closure And Template2 Gate

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The report-producing agents may browse
public websites, standards, papers, official documentation, public source
repositories, public model repositories, and public package registries. They
have no access to the TinyRustLM source tree, private artifacts, unpublished
contracts, test output, credentials, signing keys, network configuration,
development machines, internal services, or private report intake.

Every report must distinguish directly observed public facts, externally
sourced facts, reasoned engineering recommendations, assumptions, and facts
that require local or authorized verification. Sources must include an exact
URL or immutable repository revision, publication or update date when
available, and the report's retrieval date. No agent may claim that it
inspected, built, ran, tested, validated, or measured private TinyRustLM code.

TinyRustLM is one prelaunch product. SLM2, ACG2, Tokenizer2, Template2,
Sampling2, Prompt2, schema versions, ABI revisions, package versions, and
branch names are exact technical identities, not product generations. No
TinyRustLM product version has launched. There is no customer compatibility
population, product V1/V2 split, migration obligation, or permission to retain
legacy readers, writers, aliases, shims, fallbacks, dual paths, deprecated
surfaces, or known technical debt.

## Prompt 1: Canonical NuGet Identity Closure And Complete Alternate-Lane Deletion

You are an independent principal .NET package architect, NuGet ecosystem
specialist, and clean-slate API-governance reviewer. Produce an exceptionally
detailed technical report defining how a prelaunch Rust-backed SDK should
close one exact NuGet identity graph and prove that every alternate package
lane, configurable identity mechanism, facade, alias, and obsolete host package
has left the executable and publication closure. You may inspect current
Microsoft and NuGet documentation, package registries, deterministic-build
guidance, MSBuild behavior, public package-validation tools, and strong public
examples. You cannot inspect TinyRustLM source, project files, packages,
workflows, registry credentials, test output, or private release evidence.

Fixed product context and target architecture:

- TinyRustLM is one prelaunch product. There are no users who require an old
  package identity, migration package, type forward, compatibility dependency,
  deprecation cycle, or package tombstone.
- The sole default public graph is intended to contain exactly
  `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`.
- `TinyRustLM.MemoryEndpoints` is optional, disconnected, and cannot imply
  production authorization. `TinyRustLM.Conversion` is private local tooling,
  not a default public dependency.
- The Rust runtime is authoritative. Managed packages may expose checked
  contracts and native bindings but may not contain a second runtime, parser,
  sampler, converter, model-repair path, or response-repair path.
- Alternate branded package IDs, configurable package-ID prefixes, public
  facades, duplicate browser-specific packages, obsolete seed-host packages,
  and old package scripts must be deleted rather than preserved.
- Exact technical names such as SLM2 and ACG2 do not authorize a product-V2
  story or compatibility surface.

Research primary sources wherever possible and address all of the following:

1. Define every identity layer that must be closed: NuGet package ID, package
   version, assembly name, module name, root namespace, public type namespace,
   package dependency ID, tool command name, native library name, package tags,
   repository metadata, symbol package ID, SourceLink document identity, and
   release-archive name. Explain which identities may differ and why.
2. Analyze how MSBuild properties, `Directory.Build.props`, environment
   variables, command-line property overrides, conditional item groups,
   central package management, transitive dependencies, and pack targets can
   accidentally recreate an alternate package family from the same source.
3. Recommend a clean-slate identity policy that makes the exact five allowed
   package roles explicit while making every other package ID impossible to
   produce through supported build entry points. Include private-versus-public
   pack behavior and optional package behavior.
4. Explain whether package IDs should be literal in project files, generated
   from one checked manifest, or validated against one checked manifest.
   Compare drift resistance, auditability, local ergonomics, CI behavior, and
   the risk of creating a second source of truth.
5. Define an exact dependency graph and legal target-framework groups. Require
   rejection of duplicate dependencies, version ranges, unbounded versions,
   unexpected framework groups, build-only leakage, private tooling leakage,
   and cyclic package relationships.
6. Specify how to remove an obsolete public host or seed package when the
   product has never launched. Cover project deletion, solution references,
   build targets, workflow inputs, docs, tests, local feeds, package allowlists,
   release archives, public API baselines, and registry checks without creating
   a compatibility package.
7. Design a repository-wide absence gate for forbidden IDs and concepts.
   Discuss exact-string search, case folding, generated outputs, binaries,
   XML docs, nuspec metadata, lock files, cached packages, scripts, workflow
   matrices, documentation, and intentional historical evidence.
8. Distinguish executable closure from append-only historical evidence.
   Explain how a historical receipt may retain an obsolete identity while no
   current build, package, docs instruction, test fixture, or release action can
   consume or emit it.
9. Define package-content allowlists for `.nupkg` and `.snupkg`: expected
   nuspec, managed assemblies, XML docs, README/license/icon, native RID assets,
   PDBs, SourceLink, and forbidden source, secrets, caches, duplicate binaries,
   authoring tools, model bytes, or unrelated runtime assets.
10. Specify public API baseline governance for a prelaunch product. Explain how
    intentional replacement updates the sole current baseline and deletes the
    superseded API without adding `[Obsolete]`, type forwards, forwarding
    assemblies, compatibility namespaces, or aliases.
11. Design isolated-consumer tests that install exact locally built package
    files into an empty NuGet cache, explicitly install all declared package
    roles, reject undeclared feed resolution, and prove the dependency graph
    and runtime-loading boundary.
12. Define registry-facing checks that distinguish a locally valid package,
    an uploaded package, an indexed package, a downloadable exact package, and
    a package whose symbol and metadata identities have been independently read
    back. Explain why none of these alone proves a working model.
13. Provide a deletion sequence that never leaves the repository temporarily
    dependent on an alternate package lane and that can be committed as one
    coherent, buildable clean-slate transaction.
14. List every conclusion that still requires private project, package,
    binary, workflow, registry, and consumer verification.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Canonical package and identity graph.
3. MSBuild identity-confusion threat model.
4. Exact package and dependency policy.
5. Package-content and symbol allowlists.
6. Public API replacement policy.
7. Obsolete-lane deletion algorithm.
8. Repository and artifact absence gates.
9. Isolated-consumer verification design.
10. Registry publication-state taxonomy.
11. Adversarial package matrix.
12. Prioritized implementation and deletion order.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend compatibility packages, redirects, aliases, package-ID
overrides, type forwards, deprecated facades, dual publication, migration
guides for nonexistent customers, or a product-V2 narrative. Do not infer that
package creation or registry presence proves native execution, model quality,
browser inference, deployment, or public release completion.

## Prompt 2: Non-Weakenable Package Test Architecture And Coverage-Preserving Replacement

You are an independent principal test architect, mutation-testing specialist,
and .NET/Rust interop verification engineer. Produce an exceptionally detailed
report describing how to replace a large obsolete package test suite with a
smaller current-contract suite without weakening behavioral, security,
packaging, ABI, or release evidence. You may research official .NET test and
reflection APIs, NuGet package-validation tooling, mutation testing, property
testing, native ABI inspection, archive security, and public high-assurance
release systems. You cannot inspect TinyRustLM source, tests, packages,
coverage reports, native binaries, CI output, or private artifacts.

Fixed product context and quality rules:

- TinyRustLM is prelaunch and has one current architecture. Obsolete tests must
  be deleted when the obsolete behavior is deleted; they must not force legacy
  APIs or alternate package lanes to survive.
- Deleting obsolete tests is not permission to lose the invariant they once
  protected when that invariant still applies to the current architecture.
- The default public package graph is exactly `TinyRustLM.Abstractions`,
  `TinyRustLM.Core`, and `TinyRustLM.P2P`. Optional
  `TinyRustLM.MemoryEndpoints` remains disconnected; private
  `TinyRustLM.Conversion` is local tooling.
- The managed runtime boundary validates an exact fifteen-symbol native ABI,
  owns native handles safely, consumes bounded UTF-8 reports, and must not
  repair native output.
- Packages must be create-only, content-audited, public-API-audited, and
  installed in isolated consumer projects from exact local files.
- Tests, mocks, fixtures, and local feeds cannot be counted as real-model,
  browser, P2P-publication, registry-publication, or live-service proof.

Research and specify all of the following:

1. Define a semantic coverage ledger that maps current product invariants to
   one or more independent test mechanisms. Explain how to retire tests by
   invariant, not by line count or historical class name.
2. Separate compile-time API shape, package archive shape, nuspec metadata,
   dependency graph, native binary exports, managed marshalling, state-machine
   behavior, malicious-input rejection, isolated consumption, publication
   scripts, and public-feed readback into explicit coverage domains.
3. Recommend how to baseline a public managed API from compiled metadata
   without depending on source formatting. Cover constructors, methods,
   properties, events, fields, nested types, generic constraints, nullability,
   accessibility, inheritance, interfaces, enums, attributes, and XML docs.
4. Explain how to prevent an approved API baseline from becoming a ratchet
   that preserves obsolete APIs. Define review rules for replacement, removal,
   additive changes, accidental visibility, compiler-generated members, and
   intentional clean-slate contraction.
5. Design exact package archive tests using structured ZIP and nuspec parsers.
   Cover duplicate entries, path aliases, case collisions, traversal,
   backslashes, symlinks, compression bombs, trailing data, unexpected target
   frameworks, duplicate native assets, and symbol-package confusion.
6. Define a native ABI verification strategy independent of managed P/Invoke
   declarations. Include PE and ELF export inspection, architecture and RID
   checks, calling convention, symbol count, unexpected exports, dependency
   allowlists, loader search policy, and exact native-byte hashes.
7. Specify managed interop tests for UTF-8, embedded NUL, invalid JSON,
   oversized output, null pointers, double free, use after dispose, safe-handle
   finalization, cancellation, process architecture mismatch, missing symbols,
   and schema identity mismatch.
8. Design an isolated package consumer that begins with an empty source list
   and cache, installs exact package files, compiles without repository project
   references, copies RID assets correctly, invokes only public APIs, and
   exercises create-only collision and tamper rejection.
9. Explain how mutation testing or deliberate fault seeding can prove that
   tests fail when package IDs, dependencies, native hashes, public APIs,
   symbols, archive entries, docs, or runtime receipts drift. Recommend bounded
   mutation campaigns suitable for CI.
10. Define equivalence requirements between PowerShell and POSIX-shell test
    launchers so one platform cannot silently execute a weaker test set.
11. Design meta-tests that inspect test discovery results, expected test
    partitions, zero-skip policy, stderr, timeouts, process leaks, and required
    failure branches. Explain how to detect a test file that is no longer
    discovered.
12. Recommend a coverage-preserving deletion review artifact that records
    obsolete test intent, current replacement invariant, replacement test
    identity, deliberate nonreplacement rationale, reviewer, and commit.
13. Provide a minimum package release suite and an expanded hostile suite,
    including which failures are terminal and which infrastructure failures
    permit a clean rerun without selecting a preferred result.
14. Identify all conclusions that require local source, package, binary, RID,
    consumer, mutation, and CI execution.

Required report structure:

1. Executive test-architecture recommendation.
2. Current-invariant coverage ledger schema.
3. Public API baseline specification.
4. Package and symbol archive test plan.
5. Native ABI independent-verification plan.
6. Managed interop hostile-test matrix.
7. Isolated-consumer laboratory.
8. Mutation and deliberate-fault strategy.
9. Cross-shell and test-discovery equivalence.
10. Coverage-preserving deletion protocol.
11. Minimum and exhaustive gate definitions.
12. TDD implementation sequence.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not use test count, code coverage percentage, or a green build as the sole
measure of preserved assurance. Do not retain obsolete APIs to satisfy old
tests, weaken an assertion, exclude a failing platform, convert a failure to a
skip, or treat a fixture as live evidence.

## Prompt 3: Cross-Shell Create-Only Release Transactions And Crash-Consistent Resume

You are an independent principal release-automation engineer, Windows/POSIX
filesystem specialist, and transactional-build architect. Produce an
exceptionally detailed report defining semantically equivalent PowerShell and
POSIX-shell release transactions for a Rust-backed .NET SDK. The design must
be create-only, interruption-safe, independently auditable, and incapable of
publishing stale or mixed-revision output. You may inspect official PowerShell,
Bash, .NET SDK, Cargo, Windows filesystem, Linux filesystem, NuGet, and CI
documentation. You cannot inspect TinyRustLM scripts, worktrees, artifacts,
pipelines, package feeds, credentials, or release output.

Fixed product and transaction context:

- TinyRustLM is one prelaunch product with no compatibility or alternate
  release lane.
- A default package transaction produces exactly three public packages and
  corresponding symbol packages. Optional disconnected and private packages
  require explicit, separately recorded inclusion.
- Release RIDs are exactly `win-x64`, `linux-x64`, and `linux-arm64` unless a
  future current contract is deliberately rewritten before publication.
- Output roots are create-only. A transaction must not reuse, merge into,
  clean in place, or silently overwrite an existing output directory.
- Source must be committed, clean, pushed, freshly fetched, and equal to its
  configured remote before release evidence or publication is authoritative.
- Cross-compilation and binary-header inspection are not real-hardware
  execution evidence.
- A failed transaction remains evidence and cannot be edited into a pass.

Research and address all of the following:

1. Define one language-neutral transaction state machine covering preflight,
   source identity, toolchain identity, build, test, native assets, managed
   pack, canonicalization, audit, isolated consumer, publication staging,
   upload, index wait, public readback, and closure.
2. Specify exact preconditions for an absent owned output root. Cover absolute
   normalization, reparse points, symlinks, drive roots, UNC paths, reserved
   names, case folding, mount points, parent ownership, and prevention of
   recursive deletion outside the owned root.
3. Compare create-in-final-directory, same-parent staging plus atomic rename,
   and immutable content-addressed child directories. Analyze Windows rename
   semantics, open handles, antivirus interference, Linux durability, fsync,
   and network filesystems.
4. Define crash-consistent journal records for every phase. Include schema,
   transaction ID, source commit, tree state, input hashes, tool versions,
   command identity, output hashes, start/end time, status, terminal error,
   and predecessor receipt without storing secrets or private paths.
5. Explain which phases are safely resumable, which must restart into a new
   transaction root, and which external publication operations require
   idempotency or read-before-write. Avoid a generic boolean `passed` field.
6. Specify semantic parity between PowerShell and shell implementations:
   argument grammar, default values, path handling, process invocation, exit
   propagation, timeouts, encoding, JSON serialization, glob behavior,
   environment isolation, sorting, hash format, and failure cleanup.
7. Recommend a shared declarative manifest or executable authority so the two
   launchers cannot independently drift. Explain where language-specific code
   remains unavoidable and how differential tests cover it.
8. Design process supervision for Cargo, `dotnet`, package canonicalizers,
   consumer tests, and network clients. Cover Ctrl+C, CI cancellation, child
   process trees, stdout/stderr bounds, deadlock, timeout, and post-exit handle
   verification on Windows and Linux.
9. Define deterministic package canonicalization without making unsupported
   claims of byte reproducibility. Address ZIP timestamps, entry order,
   compression, nuspec XML, PDB identity, SourceLink, deterministic compiler
   flags, native binaries, and toolchain changes.
10. Specify disk-space and resource preflight formulas for native builds,
    managed builds, package staging, isolated NuGet caches, symbol packages,
    logs, and duplicate readback. Include disk-full behavior at each commit
    boundary.
11. Design cross-shell conformance tests using frozen fake tools and real
    package transactions. Compare receipts and outputs semantically and, where
    specified, byte-for-byte. Include injected failures at every phase.
12. Define secret boundaries for API keys, OIDC assertions, environment
    dumps, command lines, process listings, logs, receipts, CI annotations,
    crash files, and retained failed transaction roots.
13. Provide a release-operator dashboard that reports current phase,
    transaction identity, source identity, resumability, verified outputs,
    external state, and blockers without ever reporting `done` from local
    tests alone.
14. Identify all conclusions requiring local Windows, Linux, ARM64 hardware,
    CI, NuGet, filesystem-fault, and publication verification.

Required report structure:

1. Executive transaction recommendation.
2. Language-neutral state machine.
3. Owned-root and filesystem safety contract.
4. Journal and receipt schema family.
5. Resume and retry matrix.
6. PowerShell/POSIX semantic-equivalence table.
7. Process, cancellation, and resource controls.
8. Package determinism and canonicalization policy.
9. Fault-injection and differential-test matrix.
10. Credential and evidence-minimization boundary.
11. Operator dashboard specification.
12. Prioritized implementation sequence.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose in-place cleanup, output-root reuse, partial publication,
best-effort continuation, shell-specific weaker gates, unbounded logs, secrets
in receipts, or a compatibility release lane. Do not count cross-compilation
as executed ARM64 evidence or upload success as public readback.

## Prompt 4: Source-Bound NuGet Publication, Symbols, Provenance, And Public Readback

You are an independent principal software-supply-chain engineer, NuGet
publication specialist, and provenance verifier. Produce an exceptionally
detailed report defining a publication gate that binds exact source to exact
native assets, managed packages, symbol packages, SBOMs, attestations, upload
operations, registry indexing, and independent public download. Use current
primary documentation for NuGet.org, the .NET SDK, SourceLink, portable PDB,
Sigstore or equivalent provenance systems, GitHub Actions OIDC where relevant,
SLSA, SPDX or CycloneDX, and platform signing. You cannot inspect TinyRustLM
source, packages, workflows, credentials, registry accounts, or private release
receipts.

Fixed release context:

- TinyRustLM is prelaunch and has one package lane. No duplicate browser,
  compatibility, migration, preview-old, or legacy package family is allowed.
- The default public set is exactly `TinyRustLM.Abstractions`,
  `TinyRustLM.Core`, and `TinyRustLM.P2P`, with matching `.snupkg` files.
- Native assets are Rust-built and packaged only for `win-x64`, `linux-x64`,
  and `linux-arm64` under the current release contract.
- Optional `TinyRustLM.MemoryEndpoints` is disconnected and must not imply live
  service readiness. Private `TinyRustLM.Conversion` must not be accidentally
  published by a default transaction.
- Publication is allowed only from a clean committed source revision whose
  local, upstream, fresh-fetch, and remote identities agree.
- Package creation, upload response, search indexing, public download, symbol
  availability, and deployed-site documentation are different evidence states.

Research and specify all of the following:

1. Define the full identity graph from Git commit and tree through Cargo lock,
   .NET SDK, Rust toolchain, dependencies, native binary, managed assembly,
   portable PDB, nupkg, snupkg, SBOM, provenance statement, publication
   operation, registry resource, and independent readback bytes.
2. Explain which identities can be cryptographically bound inside a package,
   in an external receipt, in an attestation, or only through a trusted release
   log. Avoid circular hashes and unverifiable self-claims.
3. Specify deterministic-build and SourceLink requirements. Cover repository
   URL, commit identity, embedded source policy, document checksums, portable
   PDB path mapping, private path leakage, source archive availability, native
   debug information, and reproducibility limits.
4. Compare package signing, repository signing, Sigstore keyless signing,
   GitHub artifact attestations, NuGet repository signatures, Authenticode,
   and detached checksums. State what each mechanism proves and does not prove.
5. Design an SBOM for mixed Rust/.NET/native packages. Include Cargo and NuGet
   dependencies, build tools, licenses, native RID assets, bundled notices,
   hashes, component relationships, optional/private package distinctions, and
   scanner limitations.
6. Define a secure publisher authorization model using least privilege,
   environment protection, OIDC or scoped keys, package-ID ownership,
   approval, key rotation, revocation, audit events, and prevention of secrets
   reaching logs, package content, subprocess arguments, or receipts.
7. Specify a no-overwrite publication algorithm for immutable NuGet versions.
   Address preflight existence checks, races, retry after lost response,
   duplicate rejection, partial graph upload, symbols uploaded separately,
   package unlisting, and why a failed graph cannot be completed by silently
   rebuilding the same version.
8. Define registry state transitions: locally verified, publication authorized,
   upload attempted, server accepted, indexed, registration-readable,
   flat-container-readable, exact-byte-read-back, symbol-readable, docs updated,
   public HTTPS read-back, superseded, unlisted, and revoked.
9. Design independent public readback that does not trust the publisher's
   workspace or local cache. Rehash exact package bytes, parse package identity,
   compare dependencies and native hashes, test SourceLink, and compile a clean
   consumer from public sources.
10. Specify package-hash and feed-current reports with bounded schemas,
    canonical URL handling, timestamps, registry ETags or versions, exact
    expected package allowlists, terminal errors, and no credentials.
11. Define multi-package atomicity semantics for a registry that does not offer
    a true transaction. Recommend publication order, visibility policy,
    readiness manifest, site claims, rollback/unlisting, and user behavior
    during a partially indexed graph.
12. Design malware, secret, license, archive, dependency, and policy scanning
    boundaries. Distinguish scanner evidence from proof of absence and define
    manual review triggers.
13. Define release notes, version, release date, last-published facts, and
    machine-readable update logs that every affected documentation or product
    site must read back before the package release is declared complete.
14. Identify all facts requiring local build, registry authorization,
    publication, independent network, symbol-server, clean-consumer, and public
    site verification.

Required report structure:

1. Executive publication recommendation.
2. End-to-end cryptographic identity graph.
3. Deterministic build and SourceLink contract.
4. Signing, attestation, and SBOM design.
5. Publisher credential and authorization model.
6. Immutable multi-package publication algorithm.
7. Registry state machine and retry rules.
8. Independent public-readback procedure.
9. Report schemas and evidence minimization.
10. Partial-publication and rollback runbook.
11. Documentation and release-log closure.
12. Prioritized implementation sequence.
13. Unknowns requiring authorized verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not treat a successful pack, push command, HTTP success, index listing, or
local consumer test as complete publication. Do not recommend mutable versions,
rebuilding an uploaded version, publishing private conversion tooling by
default, or retaining alternate package identities.

## Prompt 5: Clean-Slate Local Companion Replacement And One Operational Host Boundary

You are an independent principal local-agent architect, desktop security
engineer, and Rust/.NET process-lifecycle specialist. Produce an exceptionally
detailed report defining the sole clean-slate local companion for a browser-
local language-model product. The report must determine what should replace
obsolete seed-host, helper, script-download, and duplicate companion paths
without preserving their packages or contracts. You may inspect public browser
security documentation, loopback-service patterns, Windows service and user
process guidance, systemd user services, secure local IPC designs, package and
self-contained deployment documentation, and comparable open-source systems.
You cannot inspect TinyRustLM source, existing companion code, installers,
ports, routes, package IDs, model artifacts, credentials, or runtime logs.

Fixed product context and required user journey:

- TinyRustLM is one prelaunch product with no legacy companion users and no
  compatibility obligation. A coherent rewrite is allowed and preferred over
  preserving weak host abstractions.
- The browser is the chat interface. Rust owns model validation, conversion,
  composition, and inference semantics. Managed code may host and transport
  bounded operations but cannot reinterpret model contracts.
- When a user selects a supported model, a verified direct P2P artifact is
  preferred. If none is genuinely available, the companion should acquire the
  pinned upstream source and perform reviewed deterministic local conversion.
- Users must not receive a `.txt`, JSON request, PowerShell script, shell
  script, or explanatory download in place of the working action.
- Model bytes and prompts must not flow through project-hosted websites.
- MemoryEndpoints is unauthorized and disconnected and must not shape the
  companion's current authentication or persistence design.
- Obsolete seed-host package IDs, duplicate URLs within one process, old host
  tools, and compatibility routes must be deleted after replacement.

Research and address all of the following:

1. Define the companion's sole responsibilities and explicit nonresponsibilities
   across browser UI, Rust runtime, converter, P2P transport, source acquisition,
   artifact store, catalog metadata, operating system, and public websites.
2. Compare a single Rust executable, a thin .NET host over Rust libraries, a
   Rust child process supervised by .NET, and a packaged tool plus native
   assets. Recommend one design based on attack surface, process ownership,
   deployment, crash behavior, update atomicity, and duplicate-authority risk.
3. Define one process and service model for interactive use and optional
   continuous P2P hosting. Explain whether these should be one process, two
   independently supervised lanes, or separate executables sharing one
   read-only store, without reviving obsolete seed-host abstractions.
4. Design the browser-to-loopback protocol. Cover origin authentication,
   explicit user consent, ephemeral session binding, CSRF, DNS rebinding,
   malicious websites, CORS, preflight, WebSocket versus HTTP, request bounds,
   operation IDs, cancellation, and no credential in a URL.
5. Specify a versioned capability document and exact route allowlist for model
   identity lookup, acquisition, conversion, progress, cancellation, artifact
   streaming, activation handoff, health, and shutdown. Unknown routes and
   fields must fail closed.
6. Define one-owner lifecycle rules: startup lock, port selection, prebinding,
   readiness, browser reconnect, duplicate launch, child failure, task failure,
   graceful drain, forced termination, update, uninstall, and stale-process
   recovery on Windows and Linux.
7. Design a create-only operation journal for P2P lookup, source download,
   safetensors custody, conversion, hashing, and artifact promotion. Cover
   idempotency, lost responses, crash at every boundary, resume, cancellation,
   quarantine, and disk-full behavior.
8. Specify the shared artifact store's path safety, ownership, permissions,
   immutable identities, temporary files, piece store, symlink/reparse-point
   defense, streamed hashing, retention, garbage collection, and prevention of
   model-byte duplication per serving lane.
9. Define accurate progress and terminal states visible to ordinary users.
   Separate searching peers, acquiring source, downloading, converting,
   verifying, importing, ready, blocked, cancelled, and failed; never expose a
   script as the primary action.
10. Compare self-contained archives, installer packages, a .NET global tool,
    native package managers, and downloadable companion bundles for
    `win-x64`, `linux-x64`, and `linux-arm64`. Include signing, update, rollback,
    uninstall, symbols, SBOM, and public readback.
11. Design hostile tests for malicious websites, loopback races, port theft,
    stale capabilities, partial downloads, peer corruption, source drift,
    converter crash, output collision, disk full, process death, and concurrent
    browser tabs.
12. Provide a complete deletion manifest for obsolete hosts, projects,
    packages, tools, routes, docs, tests, workflows, service definitions, and
    package-ID override mechanisms after the replacement passes its gate.
13. Define what CI can prove and what requires real browser, real operating
    system, real model, outside peer, signed release, and public deployment
    evidence.
14. Identify every unknown requiring local architecture, filesystem, process,
    browser, package, and deployment inspection.

Required report structure:

1. Executive companion recommendation.
2. Authority and responsibility diagram.
3. Executable and process architecture.
4. Loopback protocol and capability schema.
5. Lifecycle and supervision state machine.
6. Acquisition/conversion operation journal.
7. Artifact-store security and retention.
8. User-visible progress/status vocabulary.
9. Cross-platform distribution and update model.
10. Adversarial and fault-injection matrix.
11. Obsolete-host deletion checklist.
12. Staged implementation and acceptance plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose retaining an old seed host as a fallback, two companion APIs,
script downloads as product behavior, implicit router or firewall changes,
project-hosted model bytes, hidden telemetry, durable browser secrets, or a
product-V2 migration story.

## Prompt 6: Living Multi-Site Documentation, Release Logs, And Claim-Integrity Gates

You are an independent principal documentation-systems architect, release
communications engineer, and public-claim auditor. Produce an exceptionally
detailed report defining how a prelaunch ecosystem with several product and
documentation sites can keep every public claim, package instruction, version,
release date, and update log synchronized with implementation and deployment
truth. You may inspect current docs-as-code systems, schema validation, static
site generators, software bill-of-materials portals, changelog standards,
release-note practices, web archival techniques, accessibility standards, and
public deployment verification. You cannot inspect TinyRustLM repositories,
sites' source, deployment accounts, package feeds, build output, analytics, or
private release receipts.

Fixed ecosystem context:

- TinyRustLM is one prelaunch product. Technical names such as SLM2 and
  Template2 are not product versions. Public copy must not describe a V1/V2
  migration or legacy support obligation.
- The ecosystem includes product sites and pure documentation sites. A pure
  documentation site is a release surface, not optional marketing collateral.
- Documentation must remain robust and current after every major buildable
  change. Every deployed site must display a truthful last-published version,
  release date, and accessible update history using consistent semantics.
- The default public .NET graph is exactly `TinyRustLM.Abstractions`,
  `TinyRustLM.Core`, and `TinyRustLM.P2P`. Optional disconnected and private
  tooling must be labeled accurately.
- The user-facing model flow is P2P-first and otherwise automatic reviewed
  local conversion; no documentation may teach users to download a text file
  or script instead of completing the action.
- No site may claim a real model, browser conversation, live MemoryEndpoints
  account, outside P2P reachability, registry publication, or campaign credit
  without evidence for that exact claim.
- Current campaign counters are 0/20 qualified models, 0/50 clean browser
  rounds, 0/25 live memory rounds, 0/40 outside-proven lanes, and 0/20 catalog
  announcements until exact receipts exist.

Research and specify all of the following:

1. Define a machine-readable claim registry that assigns each public claim an
   ID, owner, scope, evidence class, source receipt, first-valid revision,
   current status, expiry, affected sites/pages, and prohibited broader wording.
2. Design one release manifest shared semantically across sites. Include
   product identity, exact version, release date, publish time, source commit,
   deployment identity, package identities, artifact hashes, change entries,
   known blockers, remaining risks, and previous release pointer without
   exposing private paths or secrets.
3. Distinguish source version, package version, site content version, deployment
   ID, release date, last successful publish time, and last verified public
   readback time. Recommend precise user-facing labels for each.
4. Define a consistent update-log schema and editorial taxonomy for added,
   changed, fixed, removed, security, documentation, known limitation, and
   evidence-only updates. Explain how prelaunch removals should be recorded
   without promising compatibility.
5. Design cross-repository documentation tests that validate exact package
   IDs, command names, supported RIDs, URLs, architecture names, counters,
   authorization status, and absent forbidden legacy terms without copying
   brittle prose between sites.
6. Explain how to keep product docs, API docs, architecture docs, operator docs,
   package READMEs, tutorials, release logs, site navigation, metadata, search
   indexes, sitemaps, and structured data synchronized.
7. Specify stale-page detection based on claim dependencies rather than a
   generic age threshold. A package graph change should invalidate every page
   that teaches package installation even if its prose was recently edited.
8. Define a deployment closure gate: clean source, tests, built site, link and
   accessibility checks, secret scan, claim validation, deployment, HTTPS
   readback, cache/CDN verification, version/readback comparison, and retained
   receipt.
9. Design an independent readback crawler that compares rendered DOM,
   downloadable assets, headers, canonical URLs, release metadata, navigation,
   status pages, and update logs against the release manifest across desktop
   and mobile paths.
10. Address partial deployment when one of several sites fails. Define accurate
    status, retry boundaries, rollback versus forward repair, cache expiry,
    cross-site links, and the rule for withholding ecosystem-wide claims.
11. Define documentation security and privacy controls for credentials, model
    paths, raw prompts, private receipts, invite URLs, local IPs, internal host
    names, source maps, build logs, analytics, and screenshots.
12. Specify accessibility and usability requirements for release histories,
    dates, version selectors, status badges, package instructions, long tables,
    code examples, mobile layouts, keyboard use, and screen readers.
13. Provide governance for frequent check-ins and quality-gated deployments:
    what constitutes a coherent docs commit, which changes block deployment,
    which sites are affected, and how to avoid waiting for unrelated work.
14. Identify all conclusions requiring local repository inventory, site build,
    package feed, deployment platform, DNS/CDN, browser, and public network
    verification.

Required report structure:

1. Executive documentation-control recommendation.
2. Claim registry schema and evidence taxonomy.
3. Release manifest and version/date semantics.
4. Update-log schema and editorial policy.
5. Cross-repository dependency and invalidation graph.
6. Documentation test and forbidden-claim matrix.
7. Deployment and independent-readback state machine.
8. Partial-deployment and rollback runbook.
9. Security, privacy, and accessibility controls.
10. Operator dashboard and freshness indicators.
11. Commit/deploy governance.
12. Prioritized implementation plan.
13. Unknowns requiring local or authorized verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend hand-maintained dates that can drift, vague `latest` claims,
copying unverified package commands, counting local builds as deployed sites,
using technical contract numbers as product generations, or retaining legacy
documentation for nonexistent customers. Do not let a pure documentation site
fall outside the release gate.

## Prompt 7: Immutable Qwen Publisher Template Source Forensics And Semantic Pinning

You are an independent principal tokenizer/template researcher, open-model
supply-chain auditor, and reproducibility engineer. Produce an exceptionally
detailed technical report identifying how to pin and interpret the exact
publisher chat-template authority for a compact Qwen3-family model without
executing untrusted repository code or confusing a mutable model card with an
immutable semantic source. You may inspect public model repositories, official
model cards, tokenizer files, chat-template files, Transformers source and
documentation, immutable Git revisions, licenses, and publisher documentation.
You cannot inspect TinyRustLM source, selected private source receipts,
Tokenizer2 artifacts, Template2 drafts, model files, tests, or runtime output.

Fixed product and gate context:

- TinyRustLM is a prelaunch browser-local language-model product. The next
  gate is one exact declarative `template2.0` profile for the selected Qwen3
  production family.
- A previously accepted Tokenizer2 identity is an immutable dependency. This
  assignment must not propose changing or rerunning that accepted tokenizer
  gate merely to make template work easier.
- Template2 must reproduce the pinned publisher's supported chat semantics
  exactly while remaining bounded and non-Turing-complete.
- Runtime execution of arbitrary Jinja, JavaScript, Python, remote code,
  publisher plugins, or repository hooks is prohibited.
- Thinking-mode behavior must be explicit. Hidden publisher or library
  defaults are not acceptable.
- Exact source parity is required before deterministic sampling, real-model
  qualification, or browser-chat claims can advance.
- Technical suffixes such as Tokenizer2 and Template2 are contract names, not
  product generations, and no compatibility template reader is allowed.

Research current primary sources and address all of the following:

1. Inventory every plausible publisher authority for the selected compact
   Qwen3 family: `tokenizer_config.json`, `chat_template.json`, embedded
   `chat_template` fields, model card examples, generation configuration,
   special-token maps, Transformers integration code, publisher documentation,
   and immutable repository history.
2. Establish an authority hierarchy for conflicts among these sources. Explain
   how revision dates, repository commits, signed tags, model-file revisions,
   library versions, and publisher statements affect the decision.
3. Identify the exact immutable repository revision and file identities an
   implementation receipt should bind. If model variants differ, document the
   compatibility boundary by exact source family without inventing support.
4. Analyze the Jinja/template language features actually exercised by the
   pinned publisher template: variables, filters, tests, whitespace control,
   concatenation, loops, conditionals, namespaces, state mutation, exceptions,
   tool schemas, content lists, and date or environment inputs.
5. Separate semantic requirements from incidental source syntax. Determine the
   exact role ordering, message serialization, inserted markers, separators,
   generation prompt, stop IDs, empty-content behavior, assistant prefill,
   tool calls, tool results, and unsupported combinations.
6. Explain Qwen3 thinking-mode behavior from primary sources. Cover explicit
   enable/disable controls, `<think>` markers, empty thinking blocks, assistant
   history handling, generation prompts, tool use interactions, and library
   version changes. Clearly mark unresolved or variant-specific facts.
7. Map every inserted textual marker to tokenizer behavior and special-token
   identity. Distinguish literal text that is tokenized from preinserted token
   IDs and state how to prove the intended interpretation.
8. Analyze whitespace exactly: leading/trailing newlines, Jinja trim markers,
   spaces around role markers, empty messages, Unicode newlines, adjacent
   special tokens, final generation marker, and byte-versus-Unicode identity.
9. Define supported versus rejected role/content shapes. Include system, user,
   assistant, tool, developer-like aliases, multipart content, null content,
   names, tool schemas, tool-call IDs, nested JSON, and unknown fields.
10. Identify version-drift risks in Transformers' `apply_chat_template`, Jinja,
    tokenizer post-processing, default `add_generation_prompt`, thinking flags,
    tool parsing, and publisher repository updates.
11. Design a source-custody receipt that records URLs, immutable commits, file
    hashes, byte sizes, media types, retrieval time, license facts, authority
    decision, library references, and unresolved conflicts without embedding
    executable code in runtime artifacts.
12. Propose a public-safe semantic profile extracted from the source, along
    with a separately retained immutable source snapshot and review record.
13. Define independent checks another researcher can perform without access to
    TinyRustLM: retrieve the same immutable files, recompute hashes, inspect
    semantics, and challenge the authority decision.
14. List every conclusion that requires local Tokenizer2 identity, source
    receipt, converter, renderer, oracle, native output, or browser verification.

Required report structure:

1. Executive authority recommendation.
2. Public observation log and immutable source inventory.
3. Source-conflict authority hierarchy.
4. Exact publisher-template semantics.
5. Thinking-mode analysis.
6. Role, content, tool, and prefill support matrix.
7. Special-token and whitespace mapping.
8. Library/version drift threat model.
9. Source-custody receipt schema.
10. Independent replication procedure.
11. Proposed bounded semantic profile inputs.
12. Prioritized next actions.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not choose the most convenient template source, execute repository code,
silently inherit a library default, broaden support beyond the pinned source,
rewrite publisher semantics for aesthetics, or recommend a general Jinja
runtime. Do not claim that template parity proves model inference or quality.

## Prompt 8: Canonical Template2 Byte Format And Non-Turing-Complete Renderer Semantics

You are an independent principal binary-format designer, programming-language
semantics specialist, and memory-safe parser architect. Produce an
exceptionally detailed specification for one exact `template2.0` artifact and
renderer capable of representing a pinned Qwen publisher chat contract without
embedding source code or a general template engine. You may research canonical
binary formats, deterministic CBOR, bounded AST formats, parser combinators,
formal-language techniques, content addressing, WASM constraints, and secure
serialization standards. You cannot inspect TinyRustLM source, current schema
drafts, artifacts, fixtures, tokenizer bytes, tests, or private receipts.

Fixed architecture and semantic constraints:

- TinyRustLM is one prelaunch product. `Template2` is the sole current
  technical contract and does not imply product V2 or require an older reader.
- The Rust implementation is authoritative in native and WASM environments.
  JavaScript and .NET may transport bytes but may not interpret or repair the
  template.
- One Template2 artifact is content-addressed and bound to one exact
  Tokenizer2 identity and one pinned publisher-template source identity.
- The renderer is declarative, bounded, deterministic, total over accepted
  input, and non-Turing-complete. It cannot run Jinja, JavaScript, Python,
  arbitrary expressions, loops over unbounded attacker data, plugins, or
  callbacks.
- Supported roles, fields, operations, markers, thinking mode, tool behavior,
  generation prompt, and stop tokens must be explicit. Unknown fields and
  operations fail closed.
- Rendering must be byte- and token-exact where the profile defines each
  layer, with checked resource preflight before allocation.

Research and specify all of the following:

1. Define the semantic input model: canonical message sequence, roles, content
   representation, optional tool schema and call/result structures, explicit
   thinking mode, generation-prompt flag, assistant prefill policy, and every
   rejected shape.
2. Compare a fixed profile with no instructions, a bounded opcode program, a
   typed expression tree, deterministic CBOR, canonical JSON, and a custom
   binary section format. Recommend one representation and explain why it
   cannot grow into a general-purpose template language accidentally.
3. Specify the complete artifact envelope: magic, profile/version, flags,
   byte order, header length, total length, section directory, section types,
   required ordering, alignment, checksums or hashes, source identity,
   Tokenizer2 identity, and complete-input consumption.
4. Define a minimal typed instruction or node set, if any. For each operation,
   give operands, type rules, maximum cardinality, execution semantics, output
   accounting, failure behavior, and proof of bounded termination.
5. Define exact text and token insertion semantics. Distinguish UTF-8 literal
   bytes, strings sent through Tokenizer2, validated preinserted token IDs,
   separators, role markers, thinking markers, stop IDs, and generation prompt.
6. Specify canonical encoding rules for integers, booleans, enums, lengths,
   strings, arrays, maps, duplicate fields, unknown fields, padding, Unicode,
   normalization, noncharacters, invalid UTF-8, zero-length sections, and
   trailing bytes.
7. Define all static cross-checks performed at parse/admission time: referenced
   operation validity, role reachability, marker validity, token-ID range,
   Tokenizer2 identity, duplicate role definitions, source receipt identity,
   output limits, feature closure, and dead or ambiguous branches.
8. Design checked rendering preflight for message count, per-content bytes,
   nesting, tool-schema bytes, aggregate input, rendered bytes, token count,
   instruction count, arithmetic overflow, allocation, and context ceiling.
9. Specify transactional parser and renderer behavior. A failed artifact load
   cannot replace the active template; a failed render cannot mutate transcript
   revision, operation identity, tokenizer, output buffer, sampler, or KV cache.
10. Define stable machine-readable error taxonomy with no attacker-controlled
    unbounded text. Include parse, canonicality, linkage, semantic, resource,
    role-order, field-shape, thinking-mode, tool, generation-prompt, and output
    errors.
11. Design language-neutral positive vectors and hostile byte corpora. Include
    every boundary, one-byte truncations, bit flips, reordered sections,
    duplicate operations, integer overflow, oversized values, invalid token
    references, unsupported features, and semantically equivalent but
    noncanonical encodings.
12. Explain how to version the sole current profile without adding permissive
    unknown-field behavior, compatibility readers, profile negotiation,
    fallback, or dual writing before launch.
13. Provide a formal or mechanically checkable argument for determinism,
    termination, canonical identity, output bounds, and fail-atomic state.
14. Identify all conclusions requiring local source template, Tokenizer2,
    native Rust, WASM, browser, fuzz, and composition verification.

Required report structure:

1. Executive format recommendation.
2. Semantic input type system.
3. Complete byte-level artifact specification.
4. Minimal renderer operation semantics.
5. Text/token insertion and Tokenizer2 linkage.
6. Canonicality and static-admission rules.
7. Resource preflight and transactional state machine.
8. Stable error taxonomy.
9. Positive and hostile conformance corpus.
10. Determinism and termination argument.
11. Clean-slate profile evolution policy.
12. Prioritized implementation sequence.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose a Jinja runtime, embedded source code, arbitrary expressions,
unbounded loops, callbacks, dynamic imports, unknown-field tolerance,
auto-repair, inferred defaults, a compatibility reader, or partial activation.
Do not let Template2 own sampling or model-runtime behavior.

## Prompt 9: Audited Publisher-Template Compiler And Exact Semantic Equivalence Proof

You are an independent principal compiler engineer, differential-testing
researcher, and reproducible-build specialist. Produce an exceptionally
detailed report defining an offline, reviewed compiler that converts one
immutable publisher chat template into one canonical bounded Template2
artifact and proves semantic equivalence without shipping the publisher engine
to production. You may inspect current Jinja semantics, Hugging Face
Transformers template behavior, compiler validation techniques, translation
validation, proof-carrying compilation, differential testing, and immutable
source-repository practices. You cannot inspect TinyRustLM code, its proposed
compiler, source receipt, Template2 artifact, Tokenizer2, cases, or outputs.

Fixed product and compiler context:

- TinyRustLM is prelaunch and supports one current Template2 profile. No legacy
  compiler mode, alternate artifact writer, compatibility source parser, or
  general template runtime is permitted.
- The compiler runs only in reviewed conversion/build tooling, never in the
  browser inference path or managed runtime.
- Input is one exact immutable Qwen publisher-template source plus explicit
  supporting metadata. The compiler must reject every source construct outside
  the audited subset.
- Output is canonical Template2 bound to exact source and Tokenizer2
  identities. The compiler may not silently rewrite whitespace, role rules,
  thinking mode, tool behavior, generation prompt, or stop tokens.
- A separately implemented publisher oracle and a separately implemented
  Template2 oracle are required; the compiler cannot certify itself.
- Exact parity evidence is a template gate only, not model-quality or browser-
  conversation proof.

Research and address all of the following:

1. Define the trusted computing base: source retriever, hash verifier, Jinja
   parser or inspected source parser, subset analyzer, semantic translator,
   Template2 writer, independent source oracle, independent Template2 oracle,
   vector materializer, and receipt generator.
2. Compare direct AST translation, semantic extraction into a handwritten
   profile, partial evaluation, translation validation, and synthesis from
   observed examples. Reject approaches that cannot prove behavior beyond a
   finite friendly corpus.
3. Specify an exact allowed publisher-language subset and explicit rejection
   rules for loops, recursion, mutation, namespaces, arbitrary filters/tests,
   object access, dynamic keys, environment/time inputs, imports, macros,
   exceptions, undefined-value quirks, and library-specific extensions.
4. Define source parsing and whitespace semantics, including Jinja trim/lstrip
   settings, escaped literals, Unicode, line endings, comments, concatenation,
   branch boundaries, and version-specific undefined behavior.
5. Design a typed intermediate representation that captures roles, legal
   ordering, markers, content, thinking behavior, tools, generation prompt,
   stop IDs, and bounds without retaining executable source syntax.
6. Specify compiler static analyses: exhaustiveness, unreachable branches,
   overlapping predicates, unsupported input shapes, unbounded output,
   Tokenizer2 references, constant folding safety, integer overflow, and
   canonical operation ordering.
7. Define translation validation that compares source AST semantics, typed IR,
   emitted Template2, and recomputed canonical identity. Explain which checks
   are independent of the compiler implementation.
8. Design a factorized equivalence corpus spanning role sequences, message
   counts, empty content, whitespace, multilingual and adversarial Unicode,
   thinking on/off, assistant history, generation prompt on/off, tools, malformed
   inputs, boundary sizes, and unsupported features.
9. Add metamorphic relations that should preserve or deliberately change
   output: field order, irrelevant unknown field rejection, line-ending source
   changes, equivalent Unicode code points, role permutation, explicit versus
   absent defaults, tool order, and thinking-state changes.
10. Define byte-level and token-level comparison. Explain how source-rendered
    Unicode becomes UTF-8 bytes, how Tokenizer2 is applied, how special tokens
    are represented, and how decode is used only as diagnostic rather than a
    substitute for token identity.
11. Specify deterministic compiler receipts binding source files, source
    revision, parser/library versions, compiler binary, allowed-subset profile,
    Tokenizer2, corpus, oracle binaries, output artifact, and every verdict.
12. Design negative tests proving the compiler rejects source drift, a changed
    library semantic, an extra unsupported construct, altered metadata,
    incorrect special token, hidden default, output collision, and stale
    receipt.
13. Define update policy: any upstream source or tool semantic change creates a
    new reviewed current artifact and invalidates dependent gates; it does not
    add a fallback compiler or continue accepting the prior source silently.
14. Identify every conclusion requiring local source bytes, compiler, oracles,
    Tokenizer2, artifact, corpus, and native/browser replay.

Required report structure:

1. Executive compiler recommendation.
2. Trusted computing base and independence map.
3. Publisher-language allowed subset.
4. Typed intermediate representation.
5. Compiler and translation-validation algorithm.
6. Source/byte/token semantic mapping.
7. Equivalence and metamorphic corpus design.
8. Negative and source-drift test matrix.
9. Receipt and identity schema.
10. Update and invalidation policy.
11. Failure modes and likely dead ends.
12. Prioritized implementation plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend runtime Jinja, accepting an unknown construct, inferring
semantics only from examples, rewriting output after comparison, selecting
friendly cases, changing the source to fit the compiler, or retaining an old
compiler mode after a current rewrite.

## Prompt 10: Template2 Differential Corpus, Independent Oracles, And Token-Level Parity

You are an independent principal conformance-laboratory designer, Unicode and
tokenization specialist, and statistical test engineer. Produce an
exceptionally detailed report for a no-cheat Template2 parity laboratory that
compares a pinned publisher authority, a Rust native renderer, an independent
non-Rust oracle, raw WASM, and real Chromium. You may inspect public tokenizer
and template documentation, Unicode standards, differential-testing research,
property-testing frameworks, browser automation documentation, and model-family
chat-template sources. You cannot inspect TinyRustLM code, Template2 artifacts,
Tokenizer2 bytes, private corpora, render output, browser profiles, or receipts.

Fixed conformance context:

- TinyRustLM is prelaunch and has one exact Template2 profile linked to one
  immutable accepted Tokenizer2 identity and one pinned Qwen publisher source.
- The accepted Tokenizer2 browser gate is immutable and must not be rerun or
  altered to accommodate template output. Template2 may consume the accepted
  tokenizer as a dependency.
- Raw renderer outputs must be preserved exactly. No normalization, repair,
  answer completion, whitespace cleanup, retry selection, or best-of-N is
  allowed.
- The publisher oracle, independent Template2 oracle, Rust renderer, WASM
  boundary, browser adapter, runner, and verifier must have explicit
  independence and version identities.
- Parity means exact bytes and exact token IDs for accepted cases plus exact
  rejection classes for invalid cases. Human-readable decode is diagnostic.
- This gate does not prove model inference, response quality, P2P availability,
  deployment, or campaign credit.

Research and specify all of the following:

1. Define the comparison layers: canonical input document, publisher-rendered
   string, UTF-8 bytes, Template2-rendered bytes, Tokenizer2 token IDs, inserted
   special-token IDs, generation prompt, stop-token set, terminal verdict, and
   bounded resource observations.
2. Design a factor model for corpus generation: role sequence, message count,
   content length, empty content, whitespace form, Unicode class, thinking mode,
   assistant history, generation prompt, assistant prefill, tool presence,
   tool-call count, JSON shape, malformed field, and boundary value.
3. Specify deterministic pairwise or covering-array generation plus hand-
   selected semantic edge cases. Explain how to control corpus size while
   covering interactions likely to expose template defects.
4. Cover Unicode and byte hazards: CR/LF variants, tabs, trailing spaces,
   nonbreaking spaces, combining marks, normalization pairs, bidi controls,
   zero-width characters, astral code points, replacement characters,
   unpaired surrogate inputs at language boundaries, invalid UTF-8, and NUL.
5. Define exact cases for system/user/assistant/tool ordering, repeated system
   messages, assistant prefill, empty histories, consecutive same roles,
   malformed tool results, missing call IDs, nested tool JSON, and unsupported
   roles. Distinguish accepted parity from matched rejection.
6. Design thinking-mode cases covering explicit enabled/disabled state,
   historical thinking blocks, empty blocks, user-supplied marker text,
   generation prompt, tool use, and attempts to confuse literal markers with
   inserted control tokens.
7. Specify metamorphic tests. Examples include changing only field order,
   content whitespace, role order, thinking mode, tool order, irrelevant
   metadata, Unicode normalization, or generation-prompt flag, with a declared
   expected relation for each.
8. Define oracle independence requirements. The independent implementation
   must not call Rust code, reuse generated production tables, consume the
   production artifact parser, import the production browser adapter, or copy
   expected outputs from candidate results.
9. Specify comparison rules for JSON object order, array order, primitive type,
   Unicode strings, UTF-8 bytes, token arrays, error code, output completeness,
   timing, and unavailable resource metrics.
10. Design corpus sealing and preregistration before candidate output exists.
    Bind generator version, seed, source template, Tokenizer2, factor catalog,
    inclusion/exclusion rules, case count, corpus bytes, and hash. Prevent easy
    seed selection after observation.
11. Define public-safe result minimization. Preserve raw outputs privately but
    publish only case counts, identity hashes, mismatch counts, bounded error
    classes, maxima, environment identity, and terminal status.
12. Analyze false parity: both implementations sharing one wrong assumption,
    publisher-library drift, source oracle normalization, token-decoder masking,
    skipped unsupported cases, output truncation, stale caches, and malformed
    cases accepted by all implementations.
13. Provide stop rules, failure preservation, regression extraction, and
    rerun policy. A semantic mismatch requires a new versioned registration,
    not editing cases or retrying until pass.
14. Identify every conclusion requiring local source, artifact, Tokenizer2,
    native, Node or other oracle, WASM, browser, and private-output verification.

Required report structure:

1. Executive conformance recommendation.
2. Comparison-layer and authority model.
3. Factor catalog and corpus-generation algorithm.
4. Role/tool/thinking semantic matrix.
5. Unicode and byte-edge matrix.
6. Metamorphic relation table.
7. Oracle-independence contract.
8. Exact comparison and rejection rules.
9. Preregistration and corpus-custody schema.
10. False-parity threat model.
11. Failure-to-regression workflow.
12. Public-safe result format.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not use expected strings embedded in production code, normalize candidate
output before scoring, accept decoded-text equality in place of token equality,
drop difficult cases, choose seeds after seeing output, or let the candidate
renderer generate its own expected results.

## Prompt 11: Template2 Raw-WASM And Chromium Boundary, Cancellation, And Recovery

You are an independent principal WebAssembly engineer, browser reliability
architect, and hostile-boundary security reviewer. Produce an exceptionally
detailed report defining a production-shaped Template2 Rust-to-WASM boundary
and one preregistered real-Chromium parity experiment. You may inspect current
WebAssembly specifications, browser memory APIs, Playwright documentation,
Chromium worker behavior, CSP/COOP/COEP guidance, structured clone, JavaScript
typed-array semantics, and browser profile/storage documentation. You cannot
inspect TinyRustLM source, including its Rust or JavaScript, or inspect its
WASM modules, browser harnesses, Template2/Tokenizer2 artifacts, corpora,
profiles, outputs, or receipts.

Fixed browser-gate context:

- TinyRustLM is browser-local. Rust must own Template2 artifact parsing,
  canonical validation, message validation, rendering, Tokenizer2 invocation,
  special-token insertion, output bounds, and stable errors in both native and
  WASM environments.
- JavaScript transports bytes and typed results only. It may not implement a
  second renderer, tokenizer, role normalizer, Jinja evaluator, repair path, or
  fallback.
- One accepted Tokenizer2 artifact and WASM behavior are immutable dependencies.
  The Template2 gate must not rerun or broaden the completed Tokenizer2
  registration.
- Exactly two independent fresh Chromium profiles should replay one frozen
  Template2 corpus only after all inputs, tools, limits, runner behavior, and
  verifier behavior are preregistered.
- The page must perform zero network requests during registered replay. Every
  browser process must close and every owned profile must be deleted.
- Cancellation requires actual worker termination followed by a new worker
  loading the same artifacts and proving clean recovery. Cooperative
  cancellation alone is insufficient.
- This is template parity evidence only, not real-model inference, user chat,
  deployment, or campaign credit.

Research and address all of the following:

1. Define the smallest raw WASM export/import contract for allocation, release,
   artifact load, render request, result/error retrieval, state inspection, and
   clear. Prefer zero imports and caller-owned transfer buffers where feasible.
2. Specify pointer/length validation, memory growth, alignment, integer
   overflow, stale views, detached buffers, copy-in/copy-out ownership, result
   lifetime, double release, use after clear, and failure atomicity.
3. Define bounded binary or JSON request/result schemas for canonical messages,
   explicit mode flags, artifact linkage, token IDs, rendered bytes, errors,
   and metrics. Explain why JavaScript cannot reinterpret a failed report.
4. Design transactional loading of Tokenizer2 and Template2. A failed Template2
   load cannot replace either active identity or leave cross-linked partial
   state. Clear must remove active and output state deterministically.
5. Specify browser adapter validation of exact module imports/exports, module
   hash, artifact hashes and lengths, active identities, vocabulary counts,
   output ceilings, and stable schema identities before any corpus work.
6. Design a dedicated worker protocol with immutable operation ID, request
   sequence, terminal message, progress bounds, cancellation ownership, stale
   message rejection, and one authoritative rendering path.
7. Define the forced-cancellation experiment. It must prove real renderer work
   began, terminate the worker, observe a quiet period with no completion, start
   a fresh worker, reload exact artifacts, and reproduce a registered recovery
   case.
8. Specify two truly independent fresh persistent-profile runs: unique owned
   roots, clean launch, no shared browser process or context, complete corpus,
   process closure, handle checks, deletion retries, deletion proof, and root
   removal on Windows and Linux.
9. Design network isolation: `about:blank` or equivalent local page, request
   interception, service-worker blocking, no extension, no telemetry, no CDN,
   zero console/page errors, and proof that cached network content is irrelevant.
10. Define memory and timing observations: module instantiation, artifact load,
    render and tokenize phases, WASM linear-memory high water, output sizes,
    JavaScript heap when available, operation ceiling, and resource failures.
11. Specify independent verification of both raw browser result documents
    against frozen native/oracle outputs and against each other. Bind browser
    executable, Playwright, OS, module, adapter, runner, verifier, profiles,
    corpus, artifacts, limits, and source revision.
12. Design hostile browser tests for malformed messages, oversized transfer,
    wrong artifact pair, module substitution, stale worker response, duplicate
    terminal event, worker crash, WASM trap, timeout, profile lock, deletion
    failure, process leak, and unexpected request.
13. Define preregistration and one-shot execution rules, including absent
    output roots, exact invocation counts, immutable failure evidence, no hidden
    retry, and criteria requiring a new versioned experiment.
14. Identify every conclusion requiring local WASM build, browser executable,
    OS process, filesystem, artifact, private output, and verifier execution.

Required report structure:

1. Executive WASM/browser recommendation.
2. Raw WASM interface and memory ownership.
3. Request/result schema and transactional artifact state.
4. Browser adapter and worker protocol.
5. Forced-cancellation and clean-recovery procedure.
6. Fresh-profile/process/deletion lifecycle.
7. Network-isolation contract.
8. Resource ceilings and observations.
9. Independent verifier specification.
10. Fault-injection matrix.
11. Preregistration and one-shot custody rules.
12. Prioritized implementation plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose a JavaScript renderer/tokenizer, cooperative-only cancellation,
reusable browser context, page refresh as profile deletion, hidden retry,
network-loaded artifacts, output repair, or rerunning an already accepted
Tokenizer2 experiment.

## Prompt 12: Template2 Admission Into ACG2, State Invalidation, And Gate Evidence Closure

You are an independent principal model-composition architect, state-machine
verification engineer, and evidence-control-plane designer. Produce an
exceptionally detailed report defining how a proven Template2 artifact enters
one atomic ACG2 composition, invalidates dependent state correctly, and closes
the exact gate before deterministic Sampling2 and real-model work begin. You
may inspect public content-addressing systems, transactional activation
patterns, cache invalidation research, language-model serving systems,
in-toto/TUF-style metadata, formal state-machine methods, and reproducible test
evidence. You cannot inspect TinyRustLM source, ACG2/Template2 artifacts,
receipts, runtime state, tests, browser output, or private campaign data.

Fixed architecture and evidence context:

- TinyRustLM is one prelaunch product. ACG2, SLM2, Tokenizer2, Template2,
  Sampling2, and Prompt2 are sole current technical contracts, not product
  generations. No compatibility composition or fallback member is allowed.
- One ACG2 composition binds exactly one SLM2, one Tokenizer2, one Template2,
  one Sampling2, and one Prompt2 artifact by exact content identity.
- The accepted Tokenizer2 gate is immutable. Template2 must bind its exact
  identity and pass source, native, independent-oracle, raw-WASM, and real-
  Chromium parity before activation evidence can be accepted.
- Rust is the sole activation and generation authority. JavaScript and .NET
  cannot partially activate members, repair reports, supply hidden defaults,
  or preserve stale state after a composition change.
- Activation is fail-atomic. Failure cannot change the active composition,
  transcript revision, operation ID, Tokenizer2, Template2, Prompt2, Sampling2,
  RNG state, KV cache, pending request, or visible assistant output.
- Gate evidence must be content-addressed, append-only, bounded, privacy-safe,
  and source-revision-bound. A changed verifier invalidates its dependent
  decision but does not rerun an immutable accepted prerequisite unnecessarily.
- Current campaign counters remain zero until separate real-model, browser,
  live-service, outside-network, and catalog receipts exist.

Research and address all of the following:

1. Define the exact identity closure among pinned publisher source, source
   custody receipt, Tokenizer2, Template2 compiler, Template2 artifact, parity
   corpus, native result, independent oracle, WASM module, browser result,
   verifier, and ACG2 composition.
2. Specify cross-member admission invariants: tokenizer identity, vocabulary
   size, special and stop token IDs, model embedding/output vocabulary,
   supported roles, context ceiling, rendered token ceiling, thinking mode,
   tool capabilities, Prompt2 framing, Sampling2 stop behavior, and runtime
   capabilities.
3. Assign one owner to every behavior. Explain which facts belong in
   Tokenizer2, Template2, Prompt2, Sampling2, SLM2, ACG2, immutable source
   receipts, or runtime policy so no setting has two authorities.
4. Design two-phase activation: bounded parse, identity/hash verification,
   independent member inspection, cross-check, allocation preflight, runtime
   construction, cancellation checkpoints, commit point, atomic state swap,
   prior-state destruction, and failure rollback.
5. Model concurrent activation and generation. Cover an in-progress request,
   streaming output, cancellation race, two browser tabs, managed callers,
   stale worker messages, companion restart, and operation-ID checks.
6. Define exact state invalidation after a successful composition change.
   Address transcript revision, rendered prompt cache, tokenized prompt cache,
   KV cache, RNG state, repetition history, pending output, stop matcher,
   decoder state, UI stream, browser persistence, and operation journals.
7. Specify content-addressed receipt types and dependency invalidation. A
   Template2 verifier change should rerun only the decision phases that depend
   on it; it should not reacquire source or rerun an immutable accepted
   Tokenizer2 gate when identities are unchanged.
8. Design preregistration before the first parity observation. Bind source
   revision, tools, artifacts, corpus, cases, limits, browser, invocation
   counts, output roots, process/profile rules, comparison semantics, and
   terminal failure policy.
9. Define an objective Template2 gate checklist: byte profile frozen, source
   authority resolved, compiler subset reviewed, hostile corpus accepted,
   native parity exact, independent oracle exact, WASM exact, two Chromium
   profiles exact, cancellation/recovery exact, zero network, profile deletion,
   bounded resources, and public-safe result.
10. Specify negative evidence and regression workflow for source mismatch,
    compiler defect, tokenizer linkage error, whitespace mismatch, thinking-
    mode mismatch, browser duplicate event, worker leak, profile deletion
    failure, verifier defect, or stale composition.
11. Define the handoff from Template2 to Sampling2. State exactly which
    Template2 evidence becomes immutable input, which questions remain open,
    and why seeded sampling must not begin by smuggling template behavior into
    sampler configuration.
12. Design a concise operator dashboard showing current gate, exact operation,
    accepted immutable prerequisites, pending receipts, resumability, failures,
    blockers, elapsed time, and all campaign counters without claiming overall
    readiness.
13. Provide a deletion gate for any executable Jinja, JavaScript renderer,
    alternate template artifact, old composition member, fallback parser,
    duplicated special-token table, fixture-only production path, stale docs,
    or obsolete test launcher.
14. Identify every conclusion requiring local source, artifact, parser,
    runtime, concurrency, browser, filesystem, verifier, and composition
    activation inspection.

Required report structure:

1. Executive gate-closure recommendation.
2. Complete identity and receipt graph.
3. Cross-member invariant and ownership matrix.
4. Transactional activation state machine.
5. Concurrency and state-invalidation rules.
6. Preregistration and exact acceptance checklist.
7. Receipt invalidation and selective-rerun algorithm.
8. Failure preservation and regression workflow.
9. Template2-to-Sampling2 handoff contract.
10. Operator dashboard specification.
11. Clean deletion and no-debt gate.
12. Prioritized implementation plan.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose partial activation, fallback members, duplicated ownership,
retaining stale KV or RNG state, editing a failed receipt into a pass, rerunning
an immutable prerequisite without identity invalidation, executing publisher
code at runtime, or claiming that Template2 completion proves a useful model or
complete browser product.

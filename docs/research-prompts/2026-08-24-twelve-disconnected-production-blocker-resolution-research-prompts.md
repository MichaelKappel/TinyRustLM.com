# Twelve Disconnected Research Prompts: TinyRustLM Production Blocker Resolution

The twelve sections below are separate assignments. Send each complete section
to a different research agent. A recipient must be able to perform the work
from its assigned section alone; no section depends on this introduction or on
another report.

These assignments deliberately target unresolved implementation and proof
decisions on the path to TinyRustLM's first real, provenance-bound,
browser-local conversational model. They are not requests for generic surveys.

## Prompt 1: Canonical NuGet Package Transaction, Public API Closure, And Feed Proof

You are an independent principal .NET package architect, NuGet release
engineer, and software-supply-chain auditor. Produce an exceptionally detailed,
implementation-oriented report for the clean-slate TinyRustLM managed SDK. You
have internet access and may inspect official .NET, NuGet, Microsoft packaging,
SourceLink, signing, SPDX, CycloneDX, and reproducible-build documentation, as
well as public package repositories and public source projects. You have no
access to the TinyRustLM source tree, private packages, build output, CI logs,
credentials, signing keys, test fixtures, or unpublished release receipts. Do
not imply that you inspected, built, tested, or validated private TinyRustLM
code.

Project context and fixed decisions:

- TinyRustLM is one prelaunch product. No TinyRustLM product version has ever
  launched, so there is no customer compatibility population, migration
  obligation, deprecated surface, or legacy package that must remain usable.
- Names such as SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema
  numbers, package versions, and branch names are exact technical identities;
  they are not product generations.
- The default managed package graph must contain exactly
  `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`.
- `TinyRustLM.MemoryEndpoints` is an independently optional connector. The live
  service is currently unauthorized and disconnected, and neither tests nor
  package metadata may imply live operation.
- `TinyRustLM.Conversion` is private local-feed tooling around the
  `tinyrustlm-convert` executable. It must not enter the public default package
  set or be accidentally pushed to a public feed.
- Rust is the sole runtime, format, composition, sampling, and P2P byte
  authority. Managed code wraps exact public operations and must not implement
  a second inference engine, parser, validator, sampler, model repair path, or
  compatibility path.
- Current native release RIDs are exactly `win-x64`, `linux-x64`, and
  `linux-arm64`. Cross-compilation alone is not real ARM64 execution evidence.
- A package transaction is not successful merely because `.nupkg` files were
  created. It must build, test, pack, canonicalize, audit, install into isolated
  consumers, verify native assets and public APIs, produce bounded evidence,
  and, when publication is authorized, prove feed and HTTPS readback.
- No known debt, temporary package aliases, forwarding facades, obsolete
  binaries, permissive API drift, conditional test skips, or parallel old/new
  package graphs may be retained.

Use primary sources wherever possible. Record every source's publication or
update date when available, exact URL or immutable revision, and your retrieval
date. Clearly label directly observed public facts, sourced external facts,
engineering recommendations, assumptions, and facts requiring local or
authorized verification.

Research and specify all of the following in depth:

1. Define the exact responsibility and dependency direction of each of the
   three default packages and both optional packages. Identify every class of
   API that must be owned by only one package, and show how to prevent cyclic
   references, transitive leakage, duplicate abstractions, and convenience
   facades.
2. Design a checked-in public API baseline system. Compare Roslyn-based API
   extraction, `Microsoft.CodeAnalysis.PublicApiAnalyzers`, reference assembly
   inspection, metadata readers, and text baselines. Specify canonical member
   ordering, generic signatures, nullability, attributes, constants, record
   members, nested types, platform annotations, and intentional-change review.
3. Define the package manifest contract for each package: package ID, version,
   target framework, dependencies, repository URL and commit, license
   expression/file, authorship, description, tags, readme, icon, symbol
   package, SourceLink, deterministic build settings, and package validation.
   Explain which fields must be exact and which may vary per release.
4. Specify exact native asset placement and selection for the three RIDs.
   Analyze `runtimes/{rid}/native`, private converter placement under `tools`
   or `contentFiles`, build-versus-runtime assets, transitive copy behavior,
   single-file applications, trimming, NativeAOT consumers, and runtime pack
   probing.
5. Design a create-only package transaction. It must reject a nonempty output
   root, build explicit projects rather than a stale aggregate solution, run
   current tests, pack exact IDs, canonicalize archives, hash all outputs,
   write a manifest, and never delete or silently replace prior evidence.
6. Define deterministic `.nupkg` and `.snupkg` canonicalization. Cover ZIP entry
   order, timestamps, compression, path separators, duplicate entries, UTF-8
   flags, permissions, extra fields, archive comments, Nuspec normalization,
   PDB determinism, and the boundary between reproducible source output and a
   later repository signature.
7. Specify a package-content auditor that opens archives as hostile input.
   Include archive traversal, absolute paths, alternate separators, duplicate
   names, case collisions, symlinks, oversized entries, compression bombs,
   unexpected assemblies, unexpected native assets, missing symbols, stale
   package IDs, forbidden API names, private converter leakage, and secret
   scanning.
8. Design isolated package-consumer proofs for all default packages and each
   optional package. Use a new temporary project, isolated global NuGet cache,
   local source only, exact version install, compile, run, unload/dispose, and
   negative tests showing undeclared packages and obsolete APIs are absent.
9. Explain how to test native library selection on each RID without allowing a
   host-installed DLL/SO, build-tree path, `PATH`, or global cache to satisfy the
   test. Require binary-header inspection and real execution where required.
10. Define the publication allowlist and authorization boundary. Show how a
    script can make it mechanically impossible to publish
    `TinyRustLM.Conversion`, an unknown package, a stale package version, an
    unaudited archive, or an archive whose hash differs from the approved
    manifest.
11. Specify NuGet feed verification after push. Cover registration metadata,
    flat-container bytes, package hash comparison, symbol package availability,
    eventual consistency, duplicate version rejection, repository signature,
    unlisting, rollback limitations, and public HTTPS readback from a clean
    consumer.
12. Design failure injection for disk full, interrupted packing, failed tests,
    archive mutation, wrong RID, missing symbol package, stale output, feed
    timeout, partial push, duplicate version, bad signature, and consumer load
    failure. State what remains on disk and which states permit resume.
13. Define concise, public-safe package receipts. Bind source revision, tool
    versions, package IDs and hashes, API baselines, native hashes, test counts,
    consumer results, publication authorization, feed observations, timestamps,
    and terminal error codes without exposing credentials or private paths.
14. Provide a deletion audit proving that old package IDs, old namespaces,
    forwarding types, Browser-branded duplicate release scripts, stale RID
    assets, obsolete workflows, and documentation instructions are absent from
    source, generated project graphs, packed archives, samples, and CI.
15. Give concrete PowerShell, Bash, MSBuild, C#, and CI pseudocode for the
    recommended transaction. Pseudocode must expose ordering, failure behavior,
    identity checks, and cleanup ownership rather than hand-waving to a generic
    release tool.
16. Identify every conclusion that still requires local source inspection,
    local builds, package installation, actual RID execution, signing access,
    feed credentials, or public readback.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Exact five-package ownership and dependency graph.
3. Public API baseline design and review policy.
4. Package metadata and archive-content specifications.
5. RID/native/converter asset matrix.
6. Create-only build-test-pack-audit-consume algorithm.
7. Hostile archive and secret-scanning threat model.
8. Isolated consumer test matrix.
9. Reproducibility, symbols, SBOM, provenance, and signing controls.
10. Publication allowlist and feed-readback protocol.
11. Failure-injection and resume state machine.
12. Deletion audit for obsolete package surfaces.
13. Phased implementation backlog with acceptance criteria.
14. Unknowns requiring local or authorized evidence.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend keeping an obsolete package for compatibility, forwarding an
old namespace, publishing before consumer proof, treating pack success as
publication, allowing conditional skips when evidence is absent, or exposing
the private conversion package to a public feed. Do not invent TinyRustLM test
results, package versions, signatures, feed state, or publication evidence.

## Prompt 2: Three-RID Rust Native Delivery, Exact C ABI Loading, And Binary Provenance

You are an independent principal Rust/.NET interoperability engineer,
cross-platform toolchain specialist, and native-binary supply-chain auditor.
Produce an exceptionally detailed report specifying how TinyRustLM should build,
package, load, verify, and execute its canonical Rust native runtime on
`win-x64`, `linux-x64`, and `linux-arm64`. You may browse official Rust, Cargo,
Microsoft .NET, PE/COFF, ELF, glibc, Linux ABI, Windows loader, NuGet, GitHub
Actions, and reproducible-build documentation, plus public source repositories.
You have no access to private TinyRustLM source, binaries, packages, CI, build
machines, credentials, or test output. Never claim private inspection or
execution.

Project context and nonnegotiable constraints:

- TinyRustLM is one prelaunch product with no legacy-support requirement and
  no permission for compatibility shims, dual loaders, aliases, stale assets,
  or known technical debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, ABI version numbers,
  and package versions are exact technical identities, not product versions.
- Rust is the sole runtime authority. The native library exposes one exact,
  bounded, pointer-plus-length C ABI with exactly fifteen exported symbols.
  Managed code must validate self-description before use and must not guess an
  ABI, probe old symbols, repair reports, or fall back to a managed runtime.
- The native library must be shipped for exactly `win-x64`, `linux-x64`, and
  `linux-arm64`. macOS is not in the current release matrix.
- A separate `tinyrustlm-convert` executable is private tooling. It may share
  source crates but is not the runtime DLL/SO and must not be loaded as one.
- Cross-compilation and binary-header inspection are useful evidence but do not
  equal real Linux ARM64 execution.
- Native input is hostile. Library resolution, ABI reports, JSON lengths,
  handles, model bytes, and error output must remain bounded and fail closed.

Use primary sources wherever possible. Include publication/update dates,
direct URLs or immutable revisions, and report retrieval date. Distinguish
public observations, sourced facts, recommendations, assumptions, and local
verification requirements.

Address all of the following in depth:

1. Define a reproducible build matrix mapping each RID to Rust target triple,
   expected filename, object format, machine type, C runtime assumptions,
   linker, runner, and minimum execution evidence. Explain Windows MSVC versus
   GNU choices and glibc versus musl tradeoffs without silently broadening the
   supported matrix.
2. Specify Cargo workspace and profile controls for release binaries. Cover
   locked dependencies, panic strategy, LTO, codegen units, stripping,
   debuginfo, overflow checks, CPU features, target-feature portability,
   deterministic paths, build scripts, environment variables, and source-date
   handling.
3. Design an owned `CARGO_TARGET_DIR` and artifact-copy protocol that cannot
   confuse host and target outputs. Include absolute-path validation, source
   checkout exclusion, create-only destinations, filename validation, stream
   hashing, fsync, and same-directory atomic promotion.
4. Specify PE and ELF inspection before packaging. Require machine type,
   bitness, DLL/SO kind, export count and names, import/dependency allowlists,
   RPATH/RUNPATH policy, SONAME policy, relocation constraints, executable
   stack checks, debug-path leakage checks, and malformed/truncated file
   rejection.
5. Define exact fifteen-symbol ABI self-description and handshake semantics.
   Explain size/version/profile identity, input ownership, output buffer
   ownership, allocator boundaries, UTF-8, null pointers, zero lengths,
   alignment, integer widths, thread safety, handle lifetime, cancellation,
   and stable code-only errors.
6. Design a .NET loader that selects only the package-local asset for the
   current supported RID. Compare `DllImport`, `NativeLibrary.Load`, custom
   resolvers, safe handles, function pointers, and generated interop. State how
   to prevent current-directory, `PATH`, system-library, or build-tree hijack.
7. Specify validation immediately after load: exact file hash when bound by a
   package manifest, binary identity, exact symbol set, self-description bytes,
   ABI profile hash, runtime limits, and managed/native contract agreement.
   Unknown, extra, missing, or reordered semantic operations must fail before a
   runtime handle is created.
8. Analyze unload and lifetime safety. Cover active calls, finalizers, process
   shutdown, AssemblyLoadContext, cancellation, callbacks, native threads,
   panic containment, double free, use-after-free, and whether deliberate
   process-lifetime loading is safer than unloading.
9. Define Linux compatibility policy. Address glibc symbol versions, kernel
   requirements, ARMv8 baseline features, NEON, atomics, container execution,
   distro variance, seccomp, executable mounts, and whether a musl artifact is
   warranted now or would create an unauthorized fourth contract.
10. Design real execution tests for all three RIDs. Include clean-machine
    package install, no source checkout, native self-description, handle
    creation/disposal, malformed input, canonical fixture operation, cancellation,
    concurrency, process exit, and verification that the loaded path is the
    packaged asset.
11. Separate cross-compilation, header inspection, QEMU/emulated smoke, and
    physical/cloud ARM64 execution in evidence and claims. Define the minimum
    evidence acceptable for local development, release candidate, and public
    package publication.
12. Specify symbol and crash diagnostics without leaking model paths, prompts,
    credentials, or private source roots. Cover portable PDB, Windows PDB,
    DWARF split debug, `.snupkg`, SourceLink, build IDs, and retention.
13. Design SBOM and provenance for native bytes embedded in NuGet archives.
    Bind Cargo.lock, rustc/cargo/linker versions, target specification, source
    revision, build inputs, native hash, package hash, and execution receipt.
14. Define failure injection for wrong architecture, stale native file, extra
    export, missing export, loader hijack, ABI mismatch, missing glibc symbol,
    ARM illegal instruction, panic across FFI, truncated JSON, oversized output,
    leaked handle, and locked DLL/SO.
15. Provide implementation-level Rust, C-header, C#, PowerShell, Bash, and CI
    pseudocode, including all important bounds and terminal states.
16. List facts that cannot be established without private source, actual
    binaries, package installation, and real hardware execution.

Required report structure:

1. Executive recommendation and scope boundary.
2. RID/target/linker/runtime evidence matrix.
3. Reproducible Rust build specification.
4. Artifact promotion and hashing algorithm.
5. PE/ELF inspection rules.
6. Exact C ABI ownership and handshake contract.
7. Managed loader and lifetime design.
8. Native dependency and Linux compatibility policy.
9. Clean-consumer and real-hardware test plan.
10. Symbols, SBOM, provenance, and diagnostics.
11. Failure-injection matrix.
12. Deletion gate for obsolete native assets and loaders.
13. Prioritized implementation plan.
14. Unknowns requiring local or authorized execution.
15. Annotated primary-source bibliography.

Do not recommend probing old symbol sets, searching arbitrary library paths,
falling back to managed inference, retaining macOS placeholders, or claiming
ARM64 support from compilation alone. Do not invent the fifteen symbol names,
binary hashes, test results, ABI identity, or machine observations; describe
how local owners must bind and verify those private facts.

## Prompt 3: Cross-Shell Atomic Release Orchestration And Failure-Safe Resume

You are an independent principal release-automation engineer, PowerShell and
Bash specialist, and durable-filesystem researcher. Produce an exceptionally
detailed implementation report for one behaviorally identical TinyRustLM local
release transaction implemented in PowerShell and Bash. You may inspect
official PowerShell, Bash, .NET CLI, Cargo, NuGet, Windows filesystem, Linux
filesystem, Git, ZIP, and CI documentation, plus public release scripts. You
have no access to private TinyRustLM scripts, repositories, artifacts, tests,
or credentials and may not claim that you ran them.

Fixed project context:

- TinyRustLM is a single prelaunch product. There is no legacy population and
  no authorization for compatibility scripts, old workflow aliases, duplicate
  Browser-branded release paths, deferred cleanup, or known debt.
- The current default NuGet packages are exactly `TinyRustLM.Abstractions`,
  `TinyRustLM.Core`, and `TinyRustLM.P2P`.
- `TinyRustLM.MemoryEndpoints` is optional, unauthorized, and disconnected.
  `TinyRustLM.Conversion` is optional private local-feed tooling and must never
  be publicly pushed by a default release command.
- Current native RIDs are `win-x64`, `linux-x64`, and `linux-arm64`.
- Rust provides the sole runtime authority. The release transaction must build
  exact Rust/native assets, build and test explicit managed projects, pack
  exact package IDs, canonicalize archives, audit them, run isolated consumers,
  and write bounded immutable evidence.
- Output roots are owned, absolute, outside the source tree, initially absent
  or empty, and create-only. Historical failed attempts must not be overwritten
  or converted into passes.
- PowerShell and Bash entry points must have the same semantic state machine,
  package allowlist, error behavior, evidence schema, and security boundaries.

Use primary sources wherever possible and record direct links, source dates,
immutable revisions where available, and retrieval date. Clearly distinguish
facts, recommendations, assumptions, and local verification requirements.

Research and specify all of the following:

1. Define one language-neutral release state machine from preflight through
   source identity, toolchain identity, output ownership, Rust builds, managed
   builds, tests, pack, canonicalization, audit, consumer execution, evidence
   commit, optional signing, authorized publication, and readback.
2. Specify command-line arguments and environment inputs. Define which values
   are mandatory, defaults that are forbidden, package/RID allowlists,
   credentials that may enter only through process environment or secret
   providers, and validation before any output is created.
3. Design safe absolute-path handling for Windows and Linux. Cover rootedness,
   path normalization, drive/root rejection, source-tree containment, reparse
   points and symlinks, UNC paths, case sensitivity, trailing separators,
   wildcard expansion, shell metacharacters, and time-of-check/time-of-use
   replacement.
4. Define create-only output ownership. Specify marker files, operation IDs,
   exclusive locks, collision handling, incomplete attempts, history layout,
   and why a release command must refuse to clean or reuse a nonempty unknown
   directory.
5. Compare strict-mode/error semantics in PowerShell and Bash. Cover native
   command exit codes, pipelines, `$LASTEXITCODE`, `set -euo pipefail`, traps,
   arrays, quoting, encoding, locale, globbing, null/empty values, booleans,
   and child-process cancellation.
6. Specify deterministic tool invocation. Bind executable paths and versions,
   working directories, environment allowlists, offline/locked restore policy,
   parallelism, timeout handling, and captured stdout/stderr without allowing
   output text to become release authority.
7. Define atomic report writing on NTFS and Linux filesystems. Cover bounded
   JSON, canonical serialization, temporary files in the destination directory,
   file flush, directory durability, Windows rename/replace behavior, existing
   destination rejection, and crash points before and after promotion.
8. Design streaming SHA-256 and manifest generation for large packages and
   native assets. Include stable ordinal ordering, duplicate path rejection,
   file-size bounds, mutation detection, and rehash immediately before a
   dependent phase consumes bytes.
9. Specify behavioral parity tests between PowerShell and Bash. Materialize
   synthetic package transactions, inject equivalent failures, compare state
   transitions and canonical receipts, and distinguish unavoidable platform
   observations from semantic drift.
10. Define independent audit invocation so neither release script can mark its
    own output valid. Explain process boundaries, immutable input manifest,
    audit executable identity, raw output preservation, terminal verdicts, and
    how changed auditors invalidate only dependent phases.
11. Design isolated consumer invocation after packing. Ensure the consumer
    uses only packed bytes and an isolated NuGet cache, not source project
    references, host native assets, old global packages, or prior build output.
12. Specify secrets and privacy handling for package keys, signing identities,
    private feed URLs, logs, command histories, process listings, CI summaries,
    exception messages, and retained evidence.
13. Model retries. State which phases are safely repeatable, which require a
    fresh operation directory, how previously successful content-addressed
    phases may be reused, and why a failed publication can never be hidden by
    deleting the first attempt.
14. Design fault injection for interruption at every state, disk full, locked
    output, source mutation, toolchain drift, failing tests, pack mutation,
    consumer crash, stale global cache, unavailable feed, partial push, and
    readback hash mismatch.
15. Define testable deletion criteria for old entry points, duplicate workflow
    files, stale package IDs, macOS RIDs, deprecated environment variables,
    compatibility flags, and documentation that invokes removed commands.
16. Provide detailed PowerShell and Bash pseudocode for the complete state
    machine plus a common JSON schema for events, phase receipts, aggregate
    result, and terminal blockers.

Required report structure:

1. Executive recommendation and explicit threat model.
2. Language-neutral release state machine.
3. CLI, environment, allowlist, and secret contract.
4. Path ownership and create-only filesystem algorithm.
5. PowerShell implementation design.
6. Bash implementation design.
7. Cross-shell semantic parity test suite.
8. Hashing, canonical JSON, and atomic persistence.
9. Audit and isolated-consumer process boundaries.
10. Retry, resume, and immutable history rules.
11. Failure-injection matrix with expected disk state.
12. Obsolete-script deletion audit.
13. Prioritized implementation backlog.
14. Unknowns requiring local verification.
15. Annotated primary-source bibliography.

Do not propose one shell as an undocumented wrapper around stale behavior, use
recursive cleanup of an unproven path, continue after a failed native command,
rely on a global NuGet cache for proof, overwrite failed attempts, or claim
publication from local package creation. Do not invent private paths,
credentials, build results, or release receipts.

## Prompt 4: Secure Local Companion, Browser IPC, And One-Owner Process Lifecycle

You are an independent principal desktop-companion architect, browser-security
engineer, and local-IPC protocol designer. Produce an exceptionally detailed,
implementation-ready report for the downloadable TinyRustLM companion that
lets a browser-local chat application acquire, convert, verify, and directly
share model artifacts without sending prompts or model bytes to a project
server. You may inspect official browser, Fetch, CORS, CSP, loopback-network,
Windows service/process, systemd user-service, Rust HTTP, TLS, WebSocket,
WebTransport, named-pipe, Unix-domain-socket, and native-app security
documentation, plus public companion architectures. You have no access to
private TinyRustLM source, binaries, browser builds, credentials, services,
ports, model files, or test output. Never claim private inspection or live
connectivity.

Project context and fixed constraints:

- TinyRustLM is one prelaunch product with no legacy users. There is no
  permission for old companion routes, compatibility protocols, deprecated
  commands, dual daemons, aliases, fallback servers, or known debt.
- The public TinyRustLM site is the chat interface. Rust remains the sole
  authority for SLM2 inspection, ACG2 activation, Tokenizer2, Template2,
  Sampling2, Prompt2, direct P2P assembly, and conversion validation.
- The companion is the operational local host. It may run the canonical Rust
  native runtime and the private `tinyrustlm-convert` executable, but it must
  not implement a second model parser, sampler, converter, or validator.
- Browser behavior must be user-centered: when a selected model is available
  from a verified direct peer, acquire it; otherwise offer or start an explicit
  reviewed local conversion transaction. Downloading a `.txt`, `.ps1`, `.sh`,
  or JSON instruction file is not the product workflow.
- Model bytes flow only locally or directly between consenting peers.
  TinyRustLM.com and MiniModel.org must not proxy model bytes or receive prompt
  content. MiniModel.org may provide bounded catalog/discovery metadata.
- Loopback success is not public P2P proof. Live MemoryEndpoints operation is
  unauthorized and disconnected and must not be simulated by the companion.
- Every privileged operation needs explicit user intent, bounded inputs,
  immutable operation identity, truthful status, cancellation, and terminal
  evidence. No browser-supplied path or URL is trusted.

Use primary sources wherever possible. Record publication/update dates,
direct URLs or immutable revisions, and retrieval date. Label public facts,
sourced facts, recommendations, assumptions, and facts requiring local or
authorized verification.

Research and specify all of the following in depth:

1. Choose and justify the browser-to-companion transport for the first release.
   Compare loopback HTTP(S), WebSocket, native messaging, custom URI schemes,
   named pipes bridged through a page, Unix sockets, and browser extension
   models. Evaluate deployability, origin authentication, streaming, browser
   support, firewall prompts, installation burden, and attack surface.
2. Define discovery and trust bootstrap. Explain how the browser learns whether
   the companion is installed and ready without scanning ports, accepting an
   arbitrary local service, weakening mixed-content policy, or trusting a
   self-asserted process identity.
3. Design origin binding and anti-cross-site-request-forgery controls. Include
   exact allowed origins, preflight behavior, `Origin` and `Sec-Fetch-*`
   validation, per-install public identity, session challenge, proof of
   possession, replay protection, DNS rebinding, hostile local pages, browser
   extensions, and compromised localhost processes.
4. Specify a closed versioned protocol. Define capability discovery, maximum
   body/header sizes, content types, unknown-field rejection, operation IDs,
   idempotency, deadlines, progress events, cancellation, terminal results,
   reconnection after browser reload, and no compatibility negotiation with
   obsolete versions.
5. Define routes or messages for companion health, model availability,
   P2P acquisition, local source review, conversion authorization, conversion
   progress, artifact inspection, ACG2 composition, activation, sharing,
   cancellation, and bounded evidence retrieval. Assign one authority to every
   decision and prohibit browser-side revalidation drift.
6. Design file-selection semantics. Compare browser File System Access handles,
   ordinary file upload to loopback, OS-native picker initiated by the
   companion, and explicit path transfer. Address large files, directory
   selection, TOCTOU replacement, symlinks/reparse points, allowed source file
   names, immutable source locks, and user consent.
7. Specify process ownership for the companion, conversion child process, P2P
   lanes, and native runtime. Cover executable identity, inherited handles,
   environment allowlist, working directory, sandboxing, child termination,
   stdout/stderr bounds, process-tree cancellation, crash recovery, and no
   shell interpretation.
8. Design installation and updates on Windows and Linux. Compare foreground
   tray/CLI operation, per-user background process, Windows scheduled task or
   service, and systemd user service. Require atomic replacement, signature
   verification, rollback rules appropriate to a prelaunch clean slate, and
   truthful state when an update is incomplete.
9. Define least-privilege filesystem roots for immutable artifacts, pieces,
   conversion staging, receipts, logs, configuration, and quarantine. Include
   owner markers, permissions, quotas, fsync, create-only promotion, cleanup
   containment, locked files, crash recovery, and multi-user isolation.
10. Specify streaming backpressure and resource governance. Cover model-size
    ceilings, concurrent operations, bandwidth, CPU, memory, file descriptors,
    hash buffers, progress cadence, browser disconnect, slow clients, and
    denial-of-service from local or remote peers.
11. Define browser-visible status vocabulary from absent through ready,
    reviewing, acquiring, converting, verifying, activatable, active, sharing,
    blocked, cancelled, and failed. Each status must correspond to objective
    evidence and must never equate a downloaded instruction with progress.
12. Design privacy and secret controls. Inspect URLs, referrers, logs, process
    arguments, environment, crash dumps, screenshots, browser storage, service
    worker caches, clipboard, model paths, prompts, tokens, and P2P peer data.
    Specify what may be retained and what must be redacted or excluded.
13. Define failure injection for malicious origins, DNS rebinding, stale
    session challenges, companion restart, browser restart, conversion crash,
    P2P loss, disk full, source mutation, locked artifact, duplicate progress
    events, cancellation races, and process-tree leaks.
14. Specify public-safe receipts binding companion binary, protocol, browser
    origin, operation, source/artifact identities, child executable, terminal
    state, resource observations, and cleanup without exposing private paths or
    model content.
15. Provide concrete Rust server, browser client, state-machine, and OS service
    pseudocode plus a test matrix for clean machines on Windows and Linux.
16. Identify all facts that require private implementation inspection, real
    installation, browser automation, network configuration, code signing, or
    external P2P observation.

Required report structure:

1. Executive protocol recommendation and assumptions.
2. Threat model and authority boundaries.
3. Transport, discovery, and origin-authentication design.
4. Closed protocol schema and state machine.
5. File selection and immutable source-lock workflow.
6. Child-process and runtime ownership model.
7. Filesystem, resource, and concurrency controls.
8. Windows and Linux installation/update design.
9. Browser UX status contract.
10. Privacy, redaction, and evidence specification.
11. Fault-injection and end-to-end test matrix.
12. Deletion gate for obsolete companion surfaces.
13. Prioritized implementation plan.
14. Unknowns requiring local or authorized access.
15. Annotated primary-source bibliography.

Do not propose instruction-file downloads as the normal workflow, arbitrary
localhost trust, wildcard CORS, browser-supplied shell commands, model-byte
proxying through project sites, a second validator, or simulated live service
success. Do not invent private routes, ports, credentials, signatures, public
reachability, or test results.

## Prompt 5: P2P-First Model Acquisition, Verified Piece Assembly, And Catalog Honesty

You are an independent principal P2P protocol architect, content-addressed
storage engineer, and hostile-network security researcher. Produce an
exceptionally detailed technical report for TinyRustLM's first production
model-acquisition path: direct verified P2P acquisition when an exact artifact
is available, followed by explicit local conversion when no qualified peer can
supply it. You may inspect primary specifications and public implementations of
HTTP ranges, BitTorrent concepts, Merkle trees, content-addressed stores, TUF,
in-toto, Ed25519, CORS, NAT traversal, resumable downloads, and browser/local
companion networking. You cannot access private TinyRustLM code, model bytes,
catalogs, peers, endpoints, manifests, receipts, credentials, or network
configuration. Do not claim private or live observations.

Fixed product context:

- TinyRustLM is one prelaunch product with no legacy protocol obligation and
  no permission for old manifest readers, compatibility aliases, fallback
  proxies, duplicate piece schemes, deferred cleanup, or technical debt.
- SLM2 is the exact current model artifact format. ACG2 is the exact atomic
  composition binding one SLM2 model to exact Tokenizer2, Template2, Sampling2,
  and Prompt2 artifacts. These names are technical identities, not product
  generations.
- The canonical Rust P2P implementation uses fixed 4 MiB pieces, exact ordered
  piece identities, complete-artifact verification, semantic admission, and
  create-only atomic promotion. Rust is the sole byte and semantic authority.
- MiniModel.org may publish catalog and discovery metadata but must never proxy
  model bytes. Model bytes move directly between consenting peers or remain on
  the user's machine.
- A browser uses the downloadable local companion for operational P2P hosting
  and conversion. A model selection must not result in downloading a text,
  script, or request file that asks the user to finish the workflow manually.
- Only provenance-bound and quality-qualified model identities may be presented
  as product-ready. Alias names, relabeled identical bytes, structural fixtures,
  and one attractive response do not qualify.
- Loopback, LAN, NAT hairpin, and local browser success are not public
  reachability proof. No public peers or proof receipts may be invented.

Use primary sources wherever possible. Include source dates, direct URLs or
immutable revisions, and retrieval date. Separate directly observed public
facts, sourced facts, recommendations, assumptions, and local/authorized
unknowns.

Research and specify all of the following in depth:

1. Define the identity graph for catalog entry, model lineage, exact SLM2
   artifact, ACG2 composition, member artifacts, piece set, fixed piece,
   provider, lane, normalized endpoint, acquisition operation, promotion, and
   quality/provenance receipts. State which identities are content hashes and
   which require signatures or scoped names.
2. Design catalog lookup from a user's model selection. Specify exact query and
   response semantics, bounded result sets, immutable artifact identities,
   quality claim levels, license/provenance links, piece metadata, peer
   advertisements, expiry, revocation, unknown fields, and cache policy.
3. Define fail-closed selection ordering. Prefer an exact qualified artifact
   already local, then qualified direct peers, then explicit reviewed local
   conversion. State how partial peers, stale proof, degraded lanes, conflicting
   identities, and multiple precision artifacts affect the choice.
4. Specify a fixed-piece manifest that cannot be confused with another
   artifact or piece profile. Bind artifact size, exact piece count, final
   partial-piece length, ordered piece hashes, Merkle construction if used,
   composition identity, media type, and protocol/profile identity.
5. Define strict peer HTTP behavior. Include exact methods and routes, URL
   normalization, CORS, `Content-Length`, ranges, status codes, header limits,
   timeouts, connection policy, cache headers, path normalization, symlink and
   reparse defense, request smuggling, and unsupported-feature rejection.
6. Design resumable acquisition from one or more matching peers. Require
   complete identity agreement before mixing pieces, create-only journals,
   per-piece verification before durability, source attribution, retry budgets,
   corruption quarantine, peer penalties, and final ordered reassembly.
7. Specify complete-artifact validation and promotion. Rehash the assembled
   bytes, invoke the canonical Rust SLM2 or ACG2 semantic owner, verify expected
   identity and resource bounds, fsync, atomically publish, and write a receipt
   last. No browser or catalog assertion may substitute for local admission.
8. Analyze peer privacy and abuse. Cover IP exposure, user consent, referrers,
   logs, request correlation, range probing, bandwidth theft, amplification,
   connection floods, slow clients, malicious pieces, endpoint enumeration,
   model-license constraints, and opt-in sharing controls.
9. Define resource governance for client and server. Include global/per-peer
   concurrency, weighted fairness, bandwidth caps, disk reservation, page
   cache, hash CPU, file descriptors, operation deadlines, backpressure, and
   behavior when a 0.3B-to-2B artifact exceeds local limits.
10. Research NAT realities for IPv4, IPv6, CGNAT, double NAT, manual forwarding,
    PCP, NAT-PMP, UPnP, and operator-approved tunnels. The first release may not
    silently alter router or firewall state. Define truthful statuses from
    local-only through externally proven.
11. Design signed outside-observer proof for future public advertising. Bind
    artifact, piece set, normalized endpoint, lane/process identity, checked
    routes, sampled or complete response hashes, nonce, observer, time, expiry,
    key identity, and revocation. Explain why local checks do not satisfy it.
12. Define browser and companion UX for lookup, source choice, bytes remaining,
    peer loss, conversion alternative, verification, activation, sharing
    consent, cancellation, and errors. The workflow must remain useful without
    exposing protocol jargon or instruction downloads.
13. Specify failure injection for catalog tampering, stale advertisements,
    duplicate aliases, mismatched piece sets, corrupt peers, source switching,
    disk full, crash after final piece, hash mismatch, semantic rejection,
    locked output, NAT change, lane death, and proof expiry.
14. Define immutable, privacy-bounded acquisition receipts and resume rules.
    Preserve failed attempts, bind every peer contribution by public-safe
    identity, and rerun only phases invalidated by changed bytes or validators.
15. Provide wire schemas, Rust pseudocode, companion/browser sequence diagrams,
    storage layouts, and a staged test plan from fixtures to one real externally
    observed artifact.
16. Identify all facts requiring private source, real model bytes, catalog
    authority, network configuration, consenting peers, or external observers.

Required report structure:

1. Executive acquisition recommendation.
2. Identity and trust graph.
3. Catalog/discovery contract.
4. Selection and fallback state machine.
5. Fixed-piece transport specification.
6. Resume, verification, assembly, and atomic promotion.
7. Client/server capacity and abuse controls.
8. NAT and reachability status vocabulary.
9. Outside-proof protocol.
10. Browser/companion UX contract.
11. Fault-injection and test matrix.
12. Receipt and evidence schemas.
13. Prioritized implementation plan.
14. Unknowns requiring local or authorized access.
15. Annotated primary-source bibliography.

Do not propose project-hosted model-byte fallback, treat an alias as an
artifact identity, mix pieces before full identity agreement, count a tiny
fixture as a real model, claim public reachability from loopback, or download
instructions instead of performing the operation. Do not invent peers,
observer signatures, catalog entries, quality receipts, or live status.

## Prompt 6: Streaming Safetensors-To-SLM2 Conversion, Source Custody, And Numerical Proof

You are an independent principal model-conversion engineer, tensor-format
specialist, numerical-validation researcher, and provenance auditor. Produce an
exceptionally detailed implementation report for converting a pinned dense
Qwen3-family Safetensors source into TinyRustLM's sole current mixed-Q8 SLM2
format using the private local `tinyrustlm-convert` executable. You may inspect
official Qwen model cards/configurations, immutable model repository revisions,
Safetensors specifications and source, Hugging Face tokenizer/configuration
documentation, Rust numeric libraries, IEEE 754 material, quantization papers,
and public conversion tools. You have no access to private TinyRustLM code,
SLM2 schemas, source locks, model bytes, receipts, runtime output, evaluation
cases, or development hardware. Do not claim private execution or numerical
parity.

Fixed project context and constraints:

- TinyRustLM is one prelaunch product with no legacy conversion obligation.
  There may be only one current converter path, with no old format writer,
  dense shadow format, alternate Qwen2 command, compatibility parser, fallback
  converter, or known debt.
- SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 are exact technical
  artifact identities, not product generations.
- Model conversion and tokenizer conversion are separate transactions. The
  model converter must not synthesize a tokenizer, copy a chat template, or
  silently choose sampling/prompt defaults.
- The intended source architecture is dense `Qwen3ForCausalLM` with grouped
  query attention, independent query/KV widths, Q/K normalization, tied
  embeddings, no unsupported projection bias, and a closed supported
  configuration profile. Unsupported architecture features must be rejected.
- Source input is a pinned immutable repository revision represented by a
  source lock that binds the exact file inventory, positive byte sizes, and
  lowercase SHA-256 hashes. Popularity or a mutable branch name is not source
  identity.
- Safetensors must be read as hostile input and streamed. The converter may not
  materialize a second complete source model or retain a dense output shadow.
- Matrix and embedding rows are stored as signed Q8 plus an F32 scale;
  normalization vectors remain F32. Structural conversion is not conversational
  quality proof, and a source base model is not automatically a product model.

Use primary sources wherever possible. Record source publication/update dates,
direct URLs or immutable revisions, and retrieval date. Distinguish public
facts, sourced facts, recommendations, assumptions, and private/local unknowns.

Research and specify all of the following in depth:

1. Define a strict supported-source profile for dense Qwen3. Cover model type,
   hidden size, intermediate size, layers, attention heads, KV heads, head
   dimension, vocabulary, tied embeddings, RoPE parameters, Q/K normalization,
   activation, bias flags, sliding window, rope scaling, dtype, tensor shards,
   and forbidden variants.
2. Map every expected publisher tensor name and shape to one SLM2 semantic role.
   Include embeddings, per-layer attention norms, Q/K/V/O projections, Q/K
   normalization, MLP gate/up/down projections, final norm, and tied output.
   Define exact orientation/transposition and reject extra or duplicate tensors.
3. Specify strict Safetensors parsing. Cover header length, bounded JSON,
   duplicate keys, dtype allowlist, dimensions, checked element counts, byte
   ranges, overlap, gaps, alignment, full payload coverage, shard index
   consistency, endian assumptions, malformed UTF-8, trailing bytes, and
   complete-input consumption.
4. Design source-lock acquisition and custody. Require immutable revision pin,
   exact allowed filenames, streamed hashes, model card/config/license capture,
   redirect policy, cache isolation, retry rules, mutation detection, and no
   credentials or URLs with secrets in receipts.
5. Define BF16 and F32 decoding with exact nonfinite handling, signed zero,
   denormals, endianness, and deterministic conversion. State whether NaN or
   infinity is terminal rejection and how to prevent host/library variation.
6. Specify row-wise signed-Q8 quantization mathematically. Address maximum
   absolute value, all-zero rows, scale representation, rounding rule, tie
   behavior, clipping, `-128` policy, F32 operation ordering, deterministic
   SIMD versus scalar parity, and dequantization semantics.
7. Analyze quality/performance alternatives such as per-channel Q8, grouped
   Q8, mixed precision for embeddings/output or attention, activation-aware
   scaling, and 4/2/1-bit methods. Explain which could improve the product and
   which would require a separately preregistered format/runtime profile rather
   than an undocumented converter tweak.
8. Design streaming memory and I/O. Include shard ordering, reusable buffers,
   bounded row buffers, output offsets, precomputed layout, file reservation,
   progress, cancellation checkpoints, CPU parallelism, deterministic output
   under parallel work, and formulas for peak RAM/disk/time.
9. Specify SLM2 writing and independent reinspection. Bind fixed header/profile,
   tensor inventory, dimensions, offsets, lengths, quantization metadata,
   architecture geometry, manifest/layout identities, and exact artifact hash.
   The writer's in-memory assumptions may not serve as its only validator.
10. Define create-only durability. Cover same-directory staging, exclusive
    output creation, data flush, directory flush, independent parse and hash,
    source rehash before and after, model promotion, receipt-last commit, crash
    points, orphan model without receipt, and disk-full behavior on Windows and
    Linux.
11. Design source-framework numerical parity tests. Compare source logits and
    hidden states to dequantized SLM2 execution on seeded short and long token
    sequences. Define layer checkpoints, tolerances justified by quantization,
    cosine/absolute/relative errors, top-token agreement, accumulated error,
    and investigation of systematic mismatches.
12. Separate converter structural tests, quantizer unit vectors, model-level
    numerical parity, native generation behavior, browser-WASM parity, and
    conversational quality. State the claim allowed at each layer.
13. Define provenance and conversion receipts binding source revision and
    files, license identity, converter executable, format/weight profiles,
    tensor/parameter inventory, output hash/size, independent inspection,
    timings/resource observations, and explicit non-claims.
14. Specify hostile and fault-injection corpora: malformed headers, shape
    overflow, wrong names, unsupported config, tensor overlap, shard drift,
    source mutation, cancellation at each boundary, output collision, disk
    full, crash before/after model promotion, and receipt corruption.
15. Provide detailed Rust data structures, parsing/quantization pseudocode,
    source-lock and receipt schemas, numerical-test procedure, and phased
    acceptance gates.
16. List conclusions requiring private SLM2 details, actual source bytes,
    converter execution, source-framework execution, real hardware, and human
    quality review.

Required report structure:

1. Executive recommendation and explicit supported-source assumptions.
2. Closed Qwen3 architecture profile.
3. Complete tensor-role and shape table.
4. Hostile Safetensors parsing contract.
5. Deterministic mixed-Q8 quantization specification.
6. Streaming converter architecture and resource formulas.
7. SLM2 layout, inspection, and identity requirements.
8. Atomic source/output custody algorithm.
9. Numerical parity and quality-claim ladder.
10. Provenance and receipt schemas.
11. Fault-injection and conformance matrix.
12. Alternative quantization experiments and preregistration requirements.
13. Prioritized implementation plan.
14. Unknowns requiring local execution.
15. Annotated primary-source bibliography.

Do not recommend mutable source revisions, silently accepted extra tensors,
whole-model buffering, dense shadow output, post-hoc output repair, tokenizer
synthesis, format changes without preregistration, or promotion from structural
success alone. Do not invent SLM2 private fields, source hashes, parity numbers,
quality results, or model qualification.

## Prompt 7: Mixed-Q8 Qwen3 Runtime Correctness, SIMD Performance, And KV Discipline

You are an independent principal inference-kernel engineer, numerical-analysis
researcher, and CPU/WebAssembly performance specialist. Produce an
exceptionally detailed implementation report for a compact dense Qwen3-family
runtime that executes TinyRustLM mixed-Q8 SLM2 models identically enough across
scalar Rust, optimized native CPU paths, and browser WebAssembly to support
honest local conversation. You may inspect official Qwen architecture sources,
Transformers implementations, model papers, Rust and WebAssembly SIMD
documentation, CPU-inference research, quantized GEMV/GEMM literature,
TurboQuant/TurboVec and Colibri publications or public repositories, and
public small-model runtimes. You have no access to private TinyRustLM code,
SLM2 bytes, kernels, benchmarks, model output, hardware measurements, or
evaluation cases. Do not claim private parity or performance.

Fixed product and runtime context:

- TinyRustLM is one prelaunch product. There is no authorization for a legacy
  runtime, second inference engine, old tensor layout, fallback dense model,
  compatibility kernel, approximate output repair, or known technical debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, and Prompt2 are exact technical
  contracts, not product generations. ACG2 activation binds all behaviorally
  relevant artifacts atomically.
- The supported model family is a closed dense Qwen3 profile with grouped-query
  attention, Q/K normalization, RoPE, gated MLP, RMSNorm, tied embeddings, and
  no silently accepted architecture features outside the profile.
- Matrix and embedding weights use deterministic row-wise signed Q8 plus F32
  scale; normalization vectors use F32. The runtime must consume this format
  directly and may not create a complete dense or repacked shadow model.
- Sampling is owned by exact Sampling2, prompt construction by exact Prompt2,
  and stop tokens by exact Template2. Kernels may not change those semantics.
- A scalar, simple, bounded implementation should serve as the numerical
  oracle. SIMD, threading, cache blocking, and compression are acceptable only
  when exact contracts and declared error budgets remain proven.
- Arithmetic benchmark improvements may not be traded for conversational
  quality, changed token choice, hidden retries, best-of-N, or truncated
  output.

Use primary sources wherever possible. Record publication/update dates,
immutable revisions or direct URLs, and retrieval date. Clearly separate
public facts, sourced facts, recommendations, assumptions, and local facts that
must be measured or verified.

Research and specify all of the following in depth:

1. Reconstruct the full supported Qwen3 forward pass in exact operation order:
   token embedding, pre-attention RMSNorm, Q/K/V projections, Q/K norm, head
   reshaping, RoPE, grouped-query mapping, causal attention, output projection,
   residual, pre-MLP RMSNorm, gate/up projections, SiLU-gated product, down
   projection, residual, final RMSNorm, and tied-logit projection.
2. Define tensor dimensions and checked indexing formulas for independent query
   and KV head counts, head dimension, hidden/intermediate size, vocabulary,
   layers, sequence position, batch-one inference, and context limits. Include
   overflow, aliasing, alignment, and out-of-range rejection.
3. Specify the signed-Q8 row dot-product and dequantization arithmetic. Analyze
   accumulator width, F32 operation order, fused multiply-add differences,
   reduction ordering, denormals, SIMD lane reductions, all-zero rows, and
   reproducibility across x86-64, ARM64 NEON, and Wasm SIMD128.
4. Define a scalar reference kernel suite for embeddings, Q8 GEMV, F32 vector
   operations, RMSNorm, Q/K norm, RoPE, softmax, SiLU, attention accumulation,
   and logits. Provide independent conformance-vector methodology for normal,
   boundary, nonfinite, overflow, and adversarial cases.
5. Design optimized native kernels. Compare AVX2, AVX-512, FMA, VNNI, NEON,
   portable SIMD, architecture-specific intrinsics, tiling, prefetching,
   thread partitioning, NUMA, and runtime dispatch. Recommend a minimum portable
   baseline and fail-closed dispatch validation.
6. Design browser-WASM kernels. Cover SIMD128 feature detection, threads and
   shared memory, cross-origin isolation, memory alignment, linear-memory
   growth, JavaScript boundary costs, worker scheduling, and scalar fallback.
   Explain whether a scalar fallback is the same supported runtime or an
   unacceptable hidden performance path for models beyond declared limits.
7. Analyze TurboQuant, TurboVec, Colibri, product quantization, Hadamard or
   random rotations, low-bit KV techniques, and vector compression as possible
   inspirations. For each, identify exact algorithms, patents/licenses,
   training/calibration needs, decode cost, numerical risks, browser
   portability, and whether adopting any portion requires a new preregistered
   SLM2/KV profile rather than an implementation optimization.
8. Design KV-cache ownership and layout for grouped-query attention. Give
   formulas for bytes per token/layer and total memory by dtype. Compare F32,
   F16, BF16, Q8, lower-bit, paged, ring, and sliding representations while
   preserving exact declared context semantics.
9. Specify KV invalidation rules for composition change, transcript revision,
   current-turn edit, cancellation, operation replacement, worker restart,
   context overflow, failed generation, and model unload/process exit. No stale
   cache may influence a new immutable operation identity.
10. Define numerically stable RMSNorm, softmax, and RoPE. Address maximum
    subtraction, reduction precision, exponent approximation, long-position
    phase error, cosine/sine table generation, cached tables, and parity with
    the pinned source framework.
11. Design source-framework and cross-backend parity experiments. Include
    layer-level checkpoints, pre/post-quantization comparisons, short and long
    token sequences, deterministic seeds, exact Sampling2 replay, tolerance
    registration before output, top-logit rank stability, and first-divergence
    diagnosis.
12. Define benchmark methodology that cannot hide quality or failures. Measure
    cold load, first-token latency, steady tokens/second, memory peak, KV growth,
    CPU utilization, energy where available, cancellation latency, and output
    identity on fixed workloads. Report distributions, hardware/browser/tool
    identity, and thermal/warmup controls.
13. Give memory and time formulas for 0.3B, 0.6B, 1.5B, and 2B classes under
    mixed-Q8 weights and alternative KV dtypes. State explicit browser ceilings
    and stop rules rather than inventing measurements.
14. Define fuzzing and sanitization boundaries for model dimensions, tensor
    offsets, quantized rows, position arithmetic, allocation planning, SIMD
    tails, thread races, cancellation, and malformed cache state.
15. Provide staged optimization guidance: prove scalar correctness, profile,
    add one optimization, replay all vectors and source parity, measure, retain
    only justified code, and delete replaced kernels when a new sole path wins.
16. Identify facts requiring private format details, real model bytes, source
    framework execution, specific CPUs, real browsers, and human output review.

Required report structure:

1. Executive runtime recommendation and assumptions.
2. Exact supported Qwen3 operation and dimension specification.
3. Scalar numerical oracle and conformance vectors.
4. Native SIMD/threading architecture.
5. Browser-WASM kernel architecture.
6. TurboQuant/TurboVec/Colibri applicability analysis.
7. KV-cache layout, compression, and invalidation contract.
8. Source-framework and backend parity protocol.
9. Benchmark and resource-budget protocol.
10. Fuzzing, fault injection, and race testing.
11. Optimization sequence with deletion gates.
12. Claim taxonomy for correctness and performance.
13. Unknowns requiring local measurement.
14. Annotated primary-source bibliography.

Do not recommend a second dense runtime, runtime repacking of the whole model,
unregistered low-bit semantics, token repair, hidden retries, quality-blind
benchmarking, or stale-cache reuse. Do not invent TinyRustLM dimensions,
performance numbers, parity tolerances, browser limits, or model quality.

## Prompt 8: Production Browser WASM Build, Worker Bootstrap, And Deployment Headers

You are an independent principal WebAssembly platform engineer, browser-runtime
architect, and web-deployment security specialist. Produce an exceptionally
detailed implementation report for shipping TinyRustLM's canonical Rust model
runtime as production WebAssembly in a browser-local chat site. You may inspect
official Rust target documentation, WebAssembly specifications, WASI proposals,
wasm-bindgen and raw-Wasm tooling, Chromium/Firefox/WebKit documentation, MDN,
W3C/WHATWG standards, CSP, COOP, COEP, CORP, service-worker, Web Worker,
SharedArrayBuffer, SIMD, streaming compilation, and deployment-platform
documentation. You cannot access private TinyRustLM source, `.wasm` files,
JavaScript, sites, build output, hosting configuration, browser traces, or test
receipts. Do not claim private deployment or browser validation.

Fixed product context:

- TinyRustLM is one prelaunch product with no legacy browser bundle,
  compatibility loader, alternate JS inference engine, polyfill path, old
  service-worker route, or acceptable known debt.
- Rust is the sole authority for SLM2, ACG2, Tokenizer2, Template2, Sampling2,
  Prompt2, generation state, and raw output. JavaScript transports bytes and
  renders state; it may not parse/repair models, resample tokens, or fabricate
  responses.
- The full composition must activate atomically inside a dedicated worker. A
  failed candidate may not alter the active composition, transcript, operation
  identity, KV cache, sampler, or visible assistant output.
- Real model bytes remain local or direct P2P. The public site must not receive
  prompts or upload models. Network use must be explicit and allowlisted.
- Browser support and performance claims require real fresh-browser execution.
  Node.js Wasm execution or successful compilation is not browser proof.
- Current native distribution RIDs do not define browser support. Browser Wasm
  is its own exact release artifact and must be content-addressed, deployed with
  correct headers, and read back from public HTTPS before a deployment claim.

Use primary sources wherever possible and include publication/update dates,
direct URLs or immutable revisions, and retrieval date. Label facts,
recommendations, assumptions, and local/authorized verification needs.

Research and specify all of the following in depth:

1. Compare `wasm32-unknown-unknown`, WASI targets, component-model approaches,
   wasm-bindgen, generated JavaScript glue, and a minimal raw Wasm ABI for this
   runtime. Recommend one clean first-release toolchain and explain its supply
   chain, browser compatibility, and boundary ownership.
2. Define the exported/imported ABI. Cover linear-memory ownership, alloc/free,
   pointer/length validation, copied inputs, bounded outputs, UTF-8, exact
   operation identities, cancellation, stable errors, and prevention of
   JavaScript objects becoming runtime authority.
3. Specify deterministic Wasm build inputs: Rust/Cargo versions, target,
   Cargo.lock, feature set, panic mode, LTO, codegen, wasm-opt or equivalent,
   stripping, name/producers sections, source paths, import allowlist, maximum
   memories/tables, and artifact hashing.
4. Design independent binary inspection. Validate magic/version, sections,
   imports, exports, memories, maximum memory, table/function/global counts,
   custom sections, start function, bulk-memory/SIMD/thread features, and
   forbidden WASI/network/filesystem imports before deployment.
5. Define worker bootstrap and state machine: fetch release assets, verify
   identity, instantiate, initialize bounded memory, load exact composition
   members, validate, commit activation, accept Prompt2 requests, stream
   progress, finish raw output, cancel, terminate, and recover with a fresh
   worker.
6. Analyze streaming compilation versus verified bytes. Explain how
   `instantiateStreaming`, content hashing, HTTP cache, Subresource Integrity,
   signed manifests, and service workers interact. Recommend an ordering that
   never executes bytes before the required identity and policy checks.
7. Define required HTTPS response headers and MIME types. Cover
   `application/wasm`, CSP, `worker-src`, `script-src`, `connect-src`, COOP,
   COEP, CORP, SharedArrayBuffer, CORS for same/cross-origin assets, HSTS,
   `nosniff`, referrer policy, and cache controls.
8. Specify whether Wasm threads are a first-release requirement. Compare
   single-thread SIMD, multi-worker partitioning, shared-memory threads, browser
   support, cross-origin isolation costs, deterministic reduction, termination,
   memory limits, and graceful truthful rejection on unsupported browsers.
9. Define linear-memory planning for a real 0.3B-to-2B model. Cover Wasm32
   address ceilings, initial/maximum pages, growth costs, fragmentation,
   weight mapping/copying, activation buffers, logits, tokenizer, KV cache,
   transient conversion/acquisition buffers, and formulas for admission.
10. Design event and transfer semantics between main thread and worker. Compare
    structured clone, transferable `ArrayBuffer`, streams, SharedArrayBuffer,
    OPFS sync access handles, message ordering, duplicate events, stale worker
    messages, and backpressure.
11. Specify service-worker policy. Address version activation, stale HTML/JS/
    Wasm mismatch, cache poisoning, update races, offline behavior, model-byte
    exclusion, immediate rollback versus fail-closed unavailable state, and
    deletion of obsolete caches in a prelaunch clean cut.
12. Define browser security and privacy tests: zero unexpected network, no
    prompt/model uploads, CSP violations, cross-origin isolation, hostile
    messages, oversized buffers, worker crash, cancellation, reload, profile
    deletion, storage cleanup, console/page errors, and secret-free traces.
13. Provide a real-browser matrix for current Chromium, Firefox, and WebKit or
    explicitly justify a narrower first support claim. Include desktop/mobile
    architecture, memory pressure, feature detection, browser versions,
    Playwright limitations, and manual evidence where automation cannot prove a
    fact.
14. Design deployment evidence binding source revision, toolchain, Wasm/JS/CSS
    hashes, header observations, public URLs, HTTPS bytes, browser build,
    profile lifecycle, network log, operation result, and explicit non-claims.
15. Give detailed build, inspection, worker, hosting, and Playwright pseudocode
    plus a failure-driven acceptance sequence from miniature fixtures to one
    real provenance-bound model.
16. Identify all facts requiring private implementation, actual hosting,
    production browser runs, real model bytes, and user-hardware measurements.

Required report structure:

1. Executive toolchain and deployment recommendation.
2. Wasm ABI and ownership boundary.
3. Deterministic build and binary-inspection specification.
4. Worker bootstrap and activation state machine.
5. Memory, SIMD, and threading resource model.
6. Main-thread/worker transfer protocol.
7. HTTPS headers, CSP, isolation, and service-worker policy.
8. Browser compatibility and real-execution matrix.
9. Privacy, network, and hostile-input tests.
10. Deployment receipt and public-readback schema.
11. Phased implementation and fault-injection plan.
12. Deletion gate for obsolete browser runtime paths.
13. Unknowns requiring local or authorized evidence.
14. Annotated primary-source bibliography.

Do not recommend JavaScript inference fallback, executing unverified Wasm,
claiming browser support from Node, silently lowering context to fit memory,
retaining stale service-worker bundles, or relaxing headers to make a demo
work. Do not invent Wasm sizes, browser measurements, public URLs, deployment
headers, or test results.

## Prompt 9: Browser Model Storage, Streaming Hash Admission, And Atomic Activation

You are an independent principal browser-storage engineer, large-artifact
systems architect, and data-integrity specialist. Produce an exceptionally
detailed implementation report for storing, resuming, verifying, and activating
large TinyRustLM model compositions entirely on a user's browser-local machine.
You may inspect current primary documentation for OPFS, File System Access,
IndexedDB, Cache Storage, StorageManager, storage quotas and eviction,
persistence, Web Workers, sync access handles, streams, transferable buffers,
Web Locks, BroadcastChannel, service workers, and browser privacy behavior. You
have no access to private TinyRustLM code, browser profiles, model files,
receipts, sites, or test output. Do not claim private browser observations.

Fixed product context:

- TinyRustLM is one prelaunch product. No obsolete browser database, migration
  reader, legacy cache, alias key, fallback store, duplicate model copy, or
  known debt needs to survive. A clean release may delete superseded stores and
  code rather than support migration.
- SLM2 is the exact model artifact. ACG2 binds exactly one SLM2, Tokenizer2,
  Template2, Sampling2, and Prompt2 artifact. All members and the composition
  are content-addressed and validated by canonical Rust authorities.
- Model bytes arrive from a local file, direct verified P2P acquisition, or
  local companion conversion. TinyRustLM.com must not receive them.
- Storage and activation are transactional. Partial or failed candidate bytes
  may remain as bounded resumable evidence but may never become the active
  composition. A successful activation invalidates incompatible runtime state
  at one commit point.
- Large files must be streamed for hashing. JavaScript may transport and store
  bytes but may not reinterpret, repair, or semantically approve model content.
- Every clean-browser dogfood round eventually requires an owned fresh profile
  and proof of profile deletion. A page refresh or `localStorage.clear()` is not
  equivalent.

Use primary sources wherever possible. Record publication/update dates,
direct URLs or immutable revisions, and retrieval date. Distinguish public
facts, sourced facts, recommendations, assumptions, and local verification.

Research and specify all of the following in depth:

1. Compare OPFS, user-visible File System Access handles, IndexedDB blobs,
   Cache Storage, and memory-only use for multi-hundred-megabyte to multi-gigabyte
   immutable artifacts. Evaluate browser support, streaming, random access,
   worker access, durability, eviction, permission UX, copy behavior, and
   security.
2. Recommend one canonical storage architecture and assign exact roles to each
   browser facility. Avoid storing the same model bytes in multiple databases
   merely for convenience.
3. Define the durable schema for artifact identity, member role, expected size,
   piece profile, completed pieces, staging path/key, validation state,
   composition graph, activation generation, operation identity, timestamps,
   terminal errors, and bounded provenance references.
4. Design preflight capacity admission. Use `navigator.storage.estimate()`,
   persistence requests, declared artifact sizes, temporary-space needs,
   browser/Wasm memory plans, and safety margins. Explain why reported quota is
   advisory and how to fail before wasting a large download.
5. Specify streaming ingestion from file picker, P2P stream, and companion.
   Include chunk bounds, backpressure, progress, cancellation, source identity,
   mutation detection, checksummed writes, worker ownership, and prevention of
   whole-file JavaScript heap copies.
6. Design fixed-piece resume. Bind every piece to one exact artifact/manifest,
   verify before durable completion marking, reject mixed identities, preserve
   source attribution, handle final partial pieces, and resume only after
   revalidating the journal and existing bytes.
7. Specify complete streamed hashing and semantic admission. Compare hashing
   in Rust Wasm versus WebCrypto limitations and JavaScript libraries. Require
   exact size, full SHA-256, canonical Rust parse, resource preflight, member
   closure, and no activation from metadata assertions alone.
8. Define atomic promotion under browser APIs that lack POSIX rename semantics.
   Explore OPFS sync access handles, copy-on-promotion, immutable final names,
   commit records, write-ahead journals, and content-addressed final paths.
   State the exact commit point and crash recovery for every boundary.
9. Design composition activation across storage and worker state. Prepare all
   members, instantiate an inactive candidate, rehash where needed, reject
   stale operations, atomically swap active identity, clear incompatible KV/RNG/
   decoder state, and preserve only presentation state explicitly allowed by
   contract.
10. Analyze multi-tab concurrency. Use Web Locks, BroadcastChannel, service
    workers, dedicated/shared workers, leases, compare-and-swap generations,
    and owner heartbeats. Prevent two tabs from racing acquisition, promotion,
    deletion, or activation.
11. Define eviction and cleanup. Separate user deletion, quota eviction,
    abandoned staging, corrupt quarantine, superseded prelaunch stores, active
    artifacts, and immutable evidence. Cleanup must be bounded to owned keys or
    roots and must not create false successful receipts.
12. Specify privacy boundaries. Search browser stores, filenames, metadata,
    logs, traces, URLs, screenshots, crash reports, and service-worker caches
    for prompts, tokens, private source paths, enrollment URLs, and model bytes.
    Define which artifact identities are safe to report publicly.
13. Create a cross-browser fault matrix for quota exhaustion, eviction,
    private/incognito mode, denied persistence, locked handles, tab crash,
    worker termination, browser process death, stale service worker, duplicate
    events, source mutation, hash mismatch, and profile deletion failure.
14. Design real fresh-profile tests on Windows and Linux. Distinguish reload,
    context reset, browser restart, profile deletion, second-profile restore,
    and OS-level locked-file cleanup. Require process closure and containment
    checks before recursive deletion.
15. Provide browser/worker/Rust pseudocode, schemas, state diagrams, resource
    formulas, and an implementation sequence that first proves small fixtures
    and then one real provenance-bound composition without changing semantics.
16. List browser-version, platform, storage, model-size, and implementation
    facts requiring local empirical verification.

Required report structure:

1. Executive storage recommendation and assumptions.
2. Browser storage capability matrix.
3. Canonical durable schema and ownership boundaries.
4. Capacity admission and resource formulas.
5. Streaming ingestion and fixed-piece resume algorithm.
6. Hashing, semantic validation, and promotion transaction.
7. Atomic runtime activation and state invalidation.
8. Multi-tab coordination and crash recovery.
9. Eviction, cleanup, privacy, and redaction contract.
10. Cross-browser fault and fresh-profile test matrix.
11. Implementation plan with objective acceptance gates.
12. Unknowns requiring local browser evidence.
13. Annotated primary-source bibliography.

Do not recommend whole-model heap buffering, duplicate durable copies without a
measured need, activation before full hash and semantic validation, migration
support for a prelaunch obsolete store, `localStorage.clear()` as profile
deletion, or silent context reduction after admission. Do not invent browser
quota, performance, persistence, or deletion results.

## Prompt 10: Exactly-Once Browser Chat State, Cancellation, And Conversation UX

You are an independent principal browser-state architect, concurrency engineer,
AI interaction designer, and accessibility test lead. Produce an exceptionally
detailed implementation report for TinyRustLM's browser-local chat state
machine, with special emphasis on ensuring that every accepted user turn and
every raw assistant completion appears exactly once despite worker progress,
cancellation, restart, streaming, model changes, and UI rerendering. You may
inspect WHATWG event-loop and streams standards, Web Worker and MessageChannel
documentation, React or equivalent state-management patterns as comparative
sources, accessibility standards, Playwright documentation, and public chat UI
implementations. You have no access to private TinyRustLM HTML, CSS,
JavaScript, workers, screenshots, model output, tests, or design files. Do not
claim private UI inspection or execution.

Fixed product and behavioral context:

- TinyRustLM is one prelaunch product with no legacy UI or event protocol to
  preserve. Duplicate old handlers, compatibility event names, parallel render
  paths, hidden repair, and known UI debt must be removed rather than supported.
- Rust in a dedicated worker is the sole authority for SLM2/ACG2 activation,
  Prompt2 compilation, Sampling2 generation, terminal state, and raw assistant
  output. JavaScript owns presentation and user interaction but may not repair,
  complete, resample, retry-select, or fabricate model text.
- Every request uses an immutable operation identity and transcript revision.
  A newer operation, model/composition change, user edit, or cancellation makes
  stale worker events ineligible to mutate current state.
- The introductory prompt cards disappear after the first accepted chat turn;
  the center column becomes the conversation workspace; each assistant answer
  renders once; the composer remains usable and visually stable.
- A true model import, verified P2P acquisition, or local conversion must lead
  to a real active composition before chat claims readiness. Downloading an
  instruction file is not model progress.
- The visual language is approved and functional work must not casually
  redesign it. The interface must remain responsive, keyboard accessible,
  screen-reader understandable, reduced-motion aware, and honest about errors.
- Model bytes and prompts remain local. Memory retrieved from any future
  connector is untrusted data, never instruction authority. Live
  MemoryEndpoints operation is currently unauthorized and disconnected.

Use primary sources wherever possible. Record publication/update dates,
direct URLs or immutable revisions, and retrieval date. Separate facts,
recommendations, assumptions, and local verification needs.

Research and specify all of the following in depth:

1. Define the canonical conversation entities and identities: conversation,
   transcript revision, turn, message, user submission, generation request,
   immutable operation, composition, worker instance, progress event, terminal
   result, cancellation, and visible render item.
2. Specify a closed worker-to-main event protocol with exact schemas for ready,
   activation progress, request accepted, token/progress, terminal completion,
   terminal cancellation, terminal error, and worker fault. Include sequence
   numbers, operation identity, transcript revision, composition identity,
   bounds, and unknown-event rejection.
3. Design the main-thread reducer or equivalent state machine. State every
   allowed transition, idempotency rule, duplicate-event handling, stale-event
   rejection, and invariant. There must be one authoritative path that adds an
   assistant message.
4. Decide whether partial token text is presentation-only or persisted state.
   Analyze append deltas versus complete snapshots, duplicate/out-of-order
   messages, Unicode boundaries, Markdown parsing, code blocks, cancellation,
   terminal reconciliation, and preservation of exact raw terminal output.
5. Define user-submit semantics. Cover input snapshot, double click, Enter key,
   IME composition, disabled/busy state, whitespace, length limits, attachment
   or model readiness, optimistic user rendering, worker acceptance failure,
   and retry as a new explicit operation rather than hidden best-of-N.
6. Design cancellation and replacement. Include Stop button, model switch,
   composition activation, conversation reset, user edit, route navigation,
   tab close, worker termination, and timeout. State exactly when visible
   partial output remains, is labeled incomplete, or is not promoted.
7. Define worker crash and fresh-worker recovery. Prevent a restarted worker
   from inheriting stale KV, RNG, operation IDs, or pending UI state. Explain
   which transcript data is replayed through Prompt2 and how a failed operation
   remains honest history without duplicate assistant text.
8. Model cross-tab and service-worker interactions. Decide whether one tab owns
   an active runtime, how tabs discover ownership, what happens under lease
   loss, and how BroadcastChannel/Web Locks events are prevented from becoming
   duplicate chat events.
9. Specify model acquisition/conversion UI states that map to objective backend
   evidence. Cover unavailable peer, reviewing source, acquiring, resuming,
   converting, verifying, activatable, active, sharing, blocked, cancelled, and
   failed. Avoid presenting a script download or structural fixture as ready.
10. Define layout invariants at desktop, narrow desktop, and mobile viewports.
    Cover stable composer dimensions, scroll anchoring, long model names,
    multi-kilobyte output, code blocks, JSON, unbroken words, status labels,
    side panels, virtual keyboard, safe areas, and no overlap.
11. Specify accessibility semantics: landmarks, message-list structure, live
    regions, announcement cadence for streaming, focus after submit/cancel/error,
    button labels and states, keyboard order, reduced motion, contrast, zoom,
    high contrast, and screen-reader handling of code and status.
12. Design Markdown/structured-output rendering security. Cover raw text
    preservation, HTML disabling/sanitization, links, images, scripts, CSS,
    bidi controls, enormous tables, nested lists, code highlighting, clipboard,
    and untrusted retrieved-memory content.
13. Create a deterministic browser test matrix for duplicate terminal events,
    duplicate deltas, missing sequence, out-of-order delivery, stale operation,
    worker crash, cancel/finish race, model switch, rapid submit, reload,
    long output, resize, keyboard navigation, and screen-reader labels.
14. Define visual regression and screenshot evidence without secret leakage.
    Include stable test data, approved baseline ownership, viewport/browser
    identity, tolerances, animation disabling, and review rules that protect the
    approved visual language while allowing functional fixes.
15. Specify public-safe conversation receipts that bind hashes of private cases
    rather than prompts, message counts, operation/composition identity, event
    counts, terminal status, duplicate/stale rejection counts, browser build,
    viewport, profile deletion, and network/privacy verdicts.
16. Provide detailed TypeScript-like pseudocode for schemas, reducer, worker
    bridge, cancellation, and Playwright assertions, and identify facts that
    require local source, real model output, design baselines, and assistive
    technology testing.

Required report structure:

1. Executive state-management recommendation.
2. Identity model and global invariants.
3. Closed worker event schemas.
4. Main-thread reducer/state-transition table.
5. Streaming, terminal output, cancellation, and recovery semantics.
6. Acquisition/conversion status contract.
7. Responsive layout and scroll invariants.
8. Accessibility and untrusted-content rendering policy.
9. Deterministic concurrency and browser test matrix.
10. Visual regression and evidence design.
11. Deletion gate for duplicate/obsolete event paths.
12. Prioritized implementation plan.
13. Unknowns requiring local execution or human review.
14. Annotated primary-source bibliography.

Do not recommend two assistant-rendering paths, hidden retries, response repair,
best-of-N, accepting stale worker output, treating a refresh as a clean restart,
or redesigning the interface as a shortcut. Do not invent UI behavior,
screenshots, model responses, accessibility results, or browser receipts.

## Prompt 11: First Real Model Qualification, Quantization Regression, And No-Cheat Promotion

You are an independent principal evaluation-science lead, small-model quality
researcher, and experimental-integrity auditor. Produce an exceptionally
detailed report specifying how TinyRustLM should select, convert, evaluate, and
either qualify or reject its first real provenance-bound conversational SLM2
model without training on evaluation answers or confusing runtime success with
assistant quality. You may inspect primary model papers/cards, immutable model
revisions, tokenizer/template sources, peer-reviewed evaluation and
distillation research, statistical references, and public benchmark
documentation. You have no access to private TinyRustLM code, models, training
data, holdouts, prompts, raw outputs, evaluator binaries, receipts, GPUs, or
human reviewers. Do not claim private model performance or qualification.

Fixed product and quality context:

- TinyRustLM is one prelaunch browser-local AI product. No model is grandfathered
  and no quality threshold may be lowered for compatibility, schedule, catalog
  count, or marketing.
- SLM2 structural validity, numerical parity, native execution, browser-WASM
  execution, popularity, parameter count, and one attractive answer are not
  conversational-quality proof.
- Candidate source architectures are compact dense transformer families
  plausibly portable to mixed-Q8 SLM2 and local browser execution. A pinned
  Qwen3-family source may be used for converter/runtime parity even if its raw
  base behavior is rejected as a product assistant.
- Important behavior includes ordinary conversation, common sense, ambiguity
  handling, practical resource constraints, instruction following,
  source-conflict resolution, latest-user-preference precedence, multi-turn
  continuity, untrusted-memory handling, summarization, rewriting, JSON,
  extraction, code explanation, and direct substantive treatment of lawful
  adult questions. Arithmetic may be delegated to a deterministic calculator.
- Positive helpful examples must substantially outnumber refusals. Concrete
  security and nonconsensual-harm boundaries remain narrow and explicit.
- Raw candidate outputs must be preserved exactly. Response repair, answer
  completion, hidden retries, best-of-N selection, expected-term injection,
  hand editing, or training on sealed holdouts is forbidden.
- Future campaign counters remain zero until objective real evidence exists.
  A first qualified model is progress but does not imply 20 qualified models,
  50 clean browser rounds, public P2P proof, or publication.

Use current primary sources wherever possible. Record model/source dates,
immutable repository revisions, licenses, direct URLs, and retrieval date.
Clearly label public facts, sourced facts, recommendations, assumptions, and
local facts requiring real execution or human judgment.

Research and specify all of the following in depth:

1. Define a pre-acquisition candidate matrix for approximately 0.3B to 2B dense
   models. Cover architecture portability, tokenizer size, tied embeddings,
   GQA, context, license, source revision, model-card evidence, browser resource
   estimate, conversion complexity, instruction tuning, and known limitations.
2. Design a raw source-screen protocol before conversion or training. Use fixed
   public-safe development scenarios plus seeded unseen paraphrases, repeated
   seeds only where sampling is product behavior, exact transcript capture,
   blinded human review, and terminal rejection criteria.
3. Define semantic invariants independent of fixture nouns. Include requesting
   missing options/criteria, acknowledging conflicting authoritative dates,
   current-turn preference over stale profile data, respecting unavailable
   resources with feasible fallback, treating quoted/retrieved text as data,
   and balanced lawful adult analysis without moralizing.
4. Build a layered evaluator separating deterministic structure, scenario
   invariants, metamorphic relations, model-based judge assistance, and human
   semantic authority. Define disagreement handling and prevent a judge from
   rewriting or completing candidate output.
5. Specify sealed holdout generation and custody. Bind generator version, seed,
   template family, factor space, exclusion set, case hash, precommitted model
   list, reviewer assignment, and reveal policy. Prevent easy-seed selection
   after seeing outputs.
6. Design contamination controls across candidate training data, any new SFT or
   preference corpus, development cases, public benchmarks, and sealed
   holdouts. Include normalization, character/token n-grams, semantic neighbors,
   template-family overlap, entity substitution, answer-term overlap, and
   deletion lineage.
7. Define the comparison ladder: untouched source, any adapter, merged student,
   converted SLM2, native runtime, optimized native runtime, and production
   browser-WASM runtime. Bind exact tokenizer, template, prompt, sampling,
   system text, context, seed, and output limits at every stage.
8. Specify quantization/runtime regression budgets. Include logit/hidden-state
   numerical checks, exact or statistically bounded token-output agreement,
   semantic pass changes, ordinary-helpfulness preservation, refusal-rate
   changes, truncation, repetition, latency, memory, and context ceilings.
9. Define stochastic statistics. Cover fixed seed policy, per-case pass
   probability, Wilson or exact intervals, correlated paraphrases, family-level
   aggregation, multiple comparisons, infrastructure flakiness, and why
   undeclared best-of-N is invalid.
10. Design blinded human review with anchored rubrics, dual independent raters,
    adjudication, inter-rater agreement, reviewer qualification, conflict of
    interest, fatigue controls, raw-output access, and public-safe aggregate
    reporting.
11. Specify factual verification and source-authority cases without turning
    web browsing into a model capability claim. Distinguish stable knowledge,
    provided-source synthesis, current facts, uncertainty, and fabricated
    citations.
12. Define adversarial suites for over-refusal, censorship, fabricated
    certainty, unsafe impossible advice, prompt injection in quoted text,
    stale memory, conflicting instructions, malformed JSON pressure, long
    context, repeated turns, and cancellation/restart continuity.
13. Provide explicit promotion statuses and claim language: structural-only,
    numerical-parity-only, conversation-screened, task-specific-proven,
    conversation-proven, and broader assistant-quality claims. State minimum
    evidence and forbidden marketing language for each.
14. Design a failure-to-improvement workflow that preserves raw failures, adds
    general regression cases, separates evaluator defects from model defects,
    prevents holdout leakage, retrains only on independently generated
    curriculum, and reruns only invalidated phases.
15. Define a first-model acceptance receipt binding source/model/license,
    converter, SLM2/ACG2 and member identities, runtimes, evaluator, case sets,
    raw-output hashes, human review, statistical results, browser evidence,
    resource measurements, decision, and remaining risks.
16. Give case-count and reviewer-count planning formulas, staged stop rules,
    compute/resource formulas, and a route from one candidate screen to one
    honestly qualified or terminally rejected model. Do not invent measured
    values.

Required report structure:

1. Executive qualification recommendation and assumptions.
2. Current candidate/source matrix with immutable references and licenses.
3. Raw source-screen protocol and rejection gates.
4. Semantic invariants and layered evaluator architecture.
5. Metamorphic, seeded, and sealed-holdout design.
6. Contamination and no-cheat controls.
7. Source-to-SLM2-to-browser comparison matrix.
8. Quantization regression and stochastic statistics.
9. Human review and adversarial audit protocol.
10. Claim taxonomy and promotion decision table.
11. Failure-to-improvement workflow.
12. First-model receipt and objective acceptance checklist.
13. Staged implementation plan and stop rules.
14. Unknowns requiring private output, compute, or human review.
15. Annotated primary-source bibliography.

Do not recommend training on evaluation prompts, keyword-only scoring, an
opaque judge as sole authority, output repair, hidden retries, lowering quality
thresholds, or qualifying a model because conversion worked. Do not invent
model scores, reviewer results, sealed cases, license conclusions, or promotion.

## Prompt 12: End-To-End Prelaunch Release, Documentation Freshness, And Public Readback

You are an independent principal release-control architect, documentation
systems engineer, deployment auditor, and public-claim integrity lead. Produce
an exceptionally detailed implementation report for releasing TinyRustLM's
first real model vertical slice across source control, packages, browser assets,
the local companion, TinyRustLM.com, MiniModel.org, and related documentation
sites while keeping every public statement synchronized with objective
evidence. You may inspect official Git, CI/CD, NuGet, SBOM, SLSA, in-toto,
code-signing, web-deployment, HTTP caching, changelog, semantic-versioning,
documentation-testing, sitemap, structured-data, accessibility, and monitoring
documentation, plus public high-quality release systems. You have no access to
private TinyRustLM repositories, sites, CI, credentials, artifacts, receipts,
DNS, hosting accounts, or source-control remotes. Do not claim private release
or deployment state.

Project context and nonnegotiable policy:

- TinyRustLM is one prelaunch product. There is no launched V1 and therefore no
  product V2, legacy audience, compatibility promise, migration requirement,
  deprecated path, or excuse to retain debt. SLM2/ACG2 and numbered schemas are
  exact technical identities only.
- After every major coherent change that builds, source should be checked in
  and pushed. Every time all applicable tests pass and release authorization is
  available, deployable sites should be published rather than allowed to drift
  far behind source.
- All relevant sites, especially documentation-only sites supporting the main
  products, must remain robust and current. Documentation is a release
  component, not deferred cleanup.
- Each published site must visibly expose a consistent last-published version,
  release date, and update log using one cross-site convention. Claims must be
  derived from a release ledger rather than independently hand-edited into
  disagreement.
- Default public NuGet packages are exactly `TinyRustLM.Abstractions`,
  `TinyRustLM.Core`, and `TinyRustLM.P2P`. `TinyRustLM.Conversion` remains
  private. `TinyRustLM.MemoryEndpoints` remains unauthorized and disconnected.
- Model bytes remain local/direct P2P; product sites may host browser code and
  bounded catalog metadata but not proxy model artifacts or receive prompts.
- Completion cannot be inferred from unit tests, package creation, local
  browser tests, or loopback P2P. Public publication requires exact uploaded
  bytes, public HTTPS readback, truthful status, and no secret exposure.
- Campaign counts remain unchanged until objective receipts exist. Partial
  progress must be shown as partial, and external blockers cannot become skips.

Use primary sources wherever possible. Include publication/update dates,
direct URLs or immutable revisions, and retrieval date. Clearly separate
public observations, sourced facts, recommendations, assumptions, and facts
requiring local or authorized access.

Research and specify all of the following in depth:

1. Define a content-addressed release graph spanning source commit/tree,
   toolchains, Rust native binaries, converter, Wasm/JS/CSS assets, NuGet and
   symbol packages, companion archives/installers, SLM2/ACG2 artifacts,
   provenance/quality receipts, site bundles, documentation, catalog metadata,
   deployment target, and public readback.
2. Design one canonical release ledger schema. Include release identity,
   semver or prelaunch version, release date/time, source revision, component
   hashes, package versions, site deployment identities, model claim level,
   test/evidence references, blockers, remaining risks, supersession, and
   publication authorization.
3. Define how every site derives `Last published`, version, release date, and
   update-log entries from the ledger while still presenting useful
   site-specific detail. Prevent inconsistent hand edits, future dates, stale
   banners, and a technical SLM2 label being misrepresented as product V2.
4. Specify a changelog/update-log taxonomy. Distinguish user-visible features,
   reliability, performance, accessibility, security, documentation,
   packages, model availability, breaking prelaunch clean cuts, known blockers,
   and corrections. Require links to stable supporting documentation without
   exposing private evidence.
5. Design documentation-as-code gates. Cover link checking, anchors, code
   snippets, API baselines, package IDs, CLI commands, schemas, examples,
   screenshots, accessibility, spelling/terminology, sitemap, robots,
   structured data, canonical URLs, security headers, and stale-content owners.
6. Define cross-site claim validation. Create one machine-readable vocabulary
   for structural validity, numerical parity, conversation qualification,
   browser execution, P2P availability, public reachability, package
   publication, MemoryEndpoints status, and campaign counts. Reject unsupported
   stronger wording.
7. Specify source-control checkpoint policy for frequent coherent commits.
   Cover clean staging, unrelated worktree changes, generated artifacts,
   signing, branch protection, remote existence, push verification, fresh
   fetch, local/tracking/remote equality, commit notes versus immutable receipts,
   and emergency handoff when time or credits are low.
8. Design component release gates for Rust crates, native RIDs, C ABI, .NET
   packages, private converter, companion, Wasm, browser UI, P2P metadata,
   model artifacts, docs, and each site. State required unit, integration,
   consumer, fuzz, real-browser, real-hardware, external, and readback evidence.
9. Define deployment ordering and atomicity. Address immutable hashed assets,
   HTML/config pointers, service-worker versions, cache invalidation, blue/green
   or release-directory activation, partial multi-site failure, rollback of a
   bad deployment, and clean removal of obsolete prelaunch assets.
10. Specify public HTTPS readback. Fetch exact URLs from outside the build
    environment, verify bytes/hashes, headers, redirects, TLS, CSP, COOP/COEP,
    MIME types, cache policy, version/update log, sitemap, package links,
    catalog metadata, and absence of private paths or secrets.
11. Design package-registry and downloadable-companion readback. Verify NuGet
    registration/flat-container bytes/symbols, archive hashes, installer or
    companion download bytes, signatures, SBOM/provenance, clean-machine
    installation, and version/status text on documentation sites.
12. Define secret and privacy scanning across Git, build logs, source maps,
    minified assets, HTML, headers, downloadable archives, SBOM, receipts,
    screenshots, traces, sitemaps, catalog metadata, and update logs. Include
    encoded and compressed forms and bounded false-positive adjudication.
13. Design truthful progress dashboards for qualified models out of 20, clean
    browser rounds out of 50, live memory rounds out of 25, externally proven
    lanes out of 40, announced models out of 20, current operation, elapsed
    time, resumability, blockers, package/site status, and last publication.
14. Specify failure-to-regression handling when deployment reveals stale docs,
    missing assets, wrong headers, duplicated UI output, package drift, secret
    exposure, P2P mismatch, broken redirects, or inconsistent update logs.
    Preserve the failed release and rerun only invalidated descendants.
15. Define final first-model vertical-slice acceptance without conflating it
    with the full 20/50/25/40/20 campaign. Require source-control proof,
    provenance-bound model, quality decision, native/browser execution,
    acquisition/conversion UX, package consumer proof, deployed sites,
    documentation freshness, public readback, and remaining risks.
16. Provide JSON schemas, dependency/state diagrams, CI pseudocode, site
    template conventions, a release checklist, and a prioritized implementation
    sequence. Identify every step needing private source, credentials, signing,
    public hosting, package-feed access, DNS, or external observers.

Required report structure:

1. Executive release-control recommendation.
2. Content-addressed release graph.
3. Canonical release-ledger schema.
4. Version/date/update-log cross-site convention.
5. Documentation-as-code and claim-integrity gates.
6. Source-control checkpoint and remote-proof policy.
7. Component release-gate matrix.
8. Deployment, cache, rollback, and obsolete-asset deletion model.
9. Package/site/companion public-readback protocol.
10. Privacy and secret-scanning contract.
11. Progress dashboard and blocker taxonomy.
12. Failure-to-regression workflow.
13. First-model vertical-slice acceptance checklist.
14. Prioritized implementation and publication plan.
15. Unknowns requiring local or authorized access.
16. Annotated primary-source bibliography.

Do not recommend calling the product V2, retaining obsolete paths for
compatibility, updating documentation later, claiming publication from local
builds, treating unit tests as completion, hiding partial failures, or
incrementing campaign counters without receipts. Do not invent commits,
package versions, deployment dates, public URLs, signatures, readback results,
or live MemoryEndpoints status.

# Twelve Disconnected Research Prompts: Deterministic MSVC Custody And First Real SLM2 Model Solutions

Each section below is a complete, self-contained assignment. Send each whole
prompt to a different technical research agent. The agents do not share
context. They must not be expected to have read this introduction, another
prompt, or any private TinyRustLM material.

The requested reports are advisory research, not implementation or test
evidence. Every report must use current primary sources wherever possible,
record source publication or update dates and the report's retrieval date,
link directly to supporting material, and pin public repository observations
to immutable revisions. Every report must visibly separate:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that could not be independently verified;
4. engineering analysis and recommendations;
5. assumptions, uncertainty, and competing interpretations; and
6. facts requiring local implementation, private artifacts, real hardware, or
   authorized production verification.

No agent may claim to have inspected, built, run, tested, or validated private
TinyRustLM code. Generic tutorials, invented measurements, hidden retries,
unsupported success claims, and advice to preserve obsolete paths are not
useful. Reports should be exceptionally detailed and implementation-oriented,
with algorithms, pseudocode, canonical schemas, state machines, equations,
bounded resource models, hostile-case matrices, objective acceptance criteria,
and prioritized implementation sequences.

## Prompt 1: Deterministic Visual Studio And Windows SDK Candidate Selection

You are an independent principal Windows toolchain engineer, Visual Studio
installer specialist, and deterministic-build systems architect. Produce an
exceptionally technical report defining one fail-closed algorithm for selecting
an x64 MSVC toolset and Windows SDK for a Rust `x86_64-pc-windows-msvc` build.
Target 8,000 to 15,000 words excluding the bibliography. The report must be
specific enough that another engineer can implement the algorithm without
making undocumented discovery or fallback decisions.

You may browse current Microsoft Learn documentation, Visual Studio Setup
Configuration API documentation, `vswhere` documentation and source, Windows
SDK documentation, Rust platform-support documentation, Cargo documentation,
and public installer manifests. You have no access to the TinyRustLM source
tree, development computer, installed paths, private model files, generated
receipts, build output, credentials, or deployment systems. Do not request
private paths or secrets and do not claim local validation.

Project-supplied facts and non-negotiable constraints, which you must label as
unverified project facts:

- TinyRustLM is one prelaunch product. There is no public predecessor to
  support. The implementation may be rewritten cleanly. Product V1/V2
  branches, compatibility aliases, migrations, shims, fallback toolchains,
  automatic retries, best-of-N selection, and known code debt are forbidden.
  `SLM2` is a technical artifact format identity, not a product generation.
- The first real target is `Qwen/Qwen3-0.6B` at immutable public revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- One registered build operation ended permanently because its exact child
  `PATH` could not resolve `link.exe`, even though an x64 linker was later
  observed elsewhere on the machine. That operation and its partial output are
  immutable history and must never be retried, adopted, repaired, deleted, or
  reused.
- The replacement must discover and bind a complete environment before a new
  operation is preregistered. It may perform one deterministic selection. It
  may not try several installations or SDKs and retain whichever builds.
- The request chooses one Visual Studio `productLineVersion` and inclusive
  installation and SDK version ranges. Selection should choose the highest
  complete eligible version inside those declared bounds, with ambiguity and
  malformed metadata causing rejection.
- Candidate discovery is expected to use the standard `vswhere.exe` with exact
  arguments equivalent to `-all -products * -requires
  Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json -utf8`.
- The selected instance must be complete, launchable, non-prerelease, require
  no reboot, expose the default VC toolset version through the documented
  auxiliary file, and contain native `Hostx64/x64` tools and x64 libraries.
- A Windows SDK candidate is eligible only when matching Include, Lib, and bin
  version directories form one complete version. At minimum, Shared, UCRT, and
  UM include roots, UCRT and UM x64 libraries, and x64 `rc.exe` and `mt.exe`
  must be present.
- Public evidence may expose product names, versions, hashes, counts, bounded
  status codes, and role names. It must not expose usernames, machine IDs,
  private absolute paths, environment secrets, or raw logs.
- MemoryEndpoints is unauthorized and disconnected and is outside this task.

Research and address all of the following in depth:

1. Establish the authoritative discovery hierarchy among Setup Configuration,
   `vswhere`, installer state, registry data, developer command scripts, and
   direct filesystem scans. State which sources are authoritative, supporting,
   or forbidden and why.
2. Specify exact `vswhere` process-launch conditions, encoding handling,
   stdout and stderr limits, exit-code rules, JSON bounds, duplicate-field
   behavior, unknown-field behavior, and treatment of corrupt or truncated
   output.
3. Define normalization and validation for instance IDs, product IDs,
   product-line versions, installation versions, installation paths, catalog
   fields, completeness, launchability, prerelease state, and reboot state.
4. Give a strict numeric version grammar and comparison algorithm. Address
   missing components, leading zeros, prerelease labels, integer overflow,
   duplicate normalized versions, and two installations tied at the selected
   version.
5. Explain how the request-selected product line prevents accidental movement
   from Visual Studio 2022 to a newer product line while still allowing an
   explicitly bounded servicing update within the chosen line.
6. Define how to read and validate the default toolset version file, including
   BOMs, CRLF/LF, final newlines, whitespace, multiple nonempty lines,
   traversal characters, absolute-path injection, and a version not contained
   beneath the chosen instance.
7. Specify native-host/native-target selection. Prove why `Hostx64/x64` is the
   intended closure and how x86-hosted or ARM64 tools are rejected before any
   build is attempted.
8. Design Windows SDK enumeration by set intersection across Include, Lib, and
   bin rather than independent maxima. Define completeness predicates and
   explain how split or partially serviced SDK versions are rejected.
9. Determine the minimum SDK and MSVC file roles necessary for a pure-Rust
   executable link and distinguish required roles from files that should be
   inventoried defensively but need not be individually named.
10. Address side-by-side Build Tools, Community, Professional, Enterprise,
    preview, offline layout, incomplete update, stale registration, moved
    installation, and uninstall-in-progress cases.
11. Give deterministic tie, drift, disappearance, and in-place servicing
    behavior. No case may silently fall through to another candidate.
12. Provide pseudocode with explicit preconditions, postconditions, bounded
    loops, typed errors, and the exact point at which a candidate becomes the
    sole selected authority.
13. Define a hostile candidate corpus of at least 40 cases and expected
    verdicts, including malformed JSON, deceptive version strings, duplicate
    instances, symlinks/reparse points, wrong-machine tools, incomplete SDKs,
    and post-discovery replacement.
14. State what can be proven from public documentation, what requires a local
    read-only observation, and what requires a one-shot managed build.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Authority hierarchy and trust boundaries.
3. Request schema and version grammar.
4. Visual Studio discovery and eligibility algorithm.
5. VC toolset resolution algorithm.
6. Windows SDK set-intersection and completeness algorithm.
7. Architecture and file-role validation.
8. Typed rejection taxonomy.
9. End-to-end pseudocode and state machine.
10. Hostile-case matrix with expected verdicts.
11. Test strategy from synthetic fixtures to real read-only observation.
12. Objective acceptance criteria.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and immutable revisions.

Do not recommend invoking `vcvarsall.bat` and trusting its ambient output,
searching all drives, selecting the first path found, trying multiple builds,
falling back to GNU or LLD, accepting previews without an explicit request,
or treating one successful compile as proof of deterministic selection.

## Prompt 2: Cryptographic Toolchain Closure And Public-Private Evidence Binding

You are an independent principal supply-chain security engineer, reproducible
build researcher, and canonical-data-format specialist. Produce an extremely
detailed report defining how to turn a selected x64 MSVC and Windows SDK
environment into a cryptographically bound private installation record and a
public-safe lock that proves identity and completeness without exposing private
absolute paths. Target 8,000 to 15,000 words excluding the bibliography.

You may browse NIST hash guidance, Microsoft PE/COFF and Authenticode
documentation, RFC 8785 and other canonical JSON specifications, Rust and
Cargo documentation, SLSA and in-toto specifications, filesystem identity
documentation, and public reproducible-build research. You have no access to
private TinyRustLM code, local installations, generated receipts, model bytes,
credentials, or machine logs. Every local statement must be identified as a
fact requiring verification.

Project-supplied facts and constraints, which are unverified from your
perspective:

- TinyRustLM is prelaunch and has no legacy compatibility obligation. Clean
  replacement is preferred over preserving a weak schema or stale path.
- A prior one-shot build failed because the preregistered environment omitted
  the installed x64 linker. The failed attempt is immutable history.
- The new design will select one x64 Visual Studio toolset and one complete
  Windows SDK before any new build request exists.
- The intended closure inventories every direct regular file in selected tool
  bin directories and every direct `.lib` archive in selected MSVC, UCRT, and
  UM x64 library directories. Required named tools and import libraries receive
  additional format and architecture checks.
- Exact child environment values include a target-specific Cargo linker plus
  deterministic `PATH`, `LIB`, `LIBPATH`, VC toolset variables, Windows SDK
  variables, and x64 architecture declarations.
- Private evidence may contain local absolute paths and filesystem identities
  but remains outside publication. Public evidence contains hashes, lengths,
  counts, versions, role names, and bounded status fields, never private paths.
- The materialization order is private binding first, public lock second, and
  terminal record last, all create-only. A public lock must cryptographically
  bind the exact private binding bytes.
- Model bytes and generated evidence remain outside source control.
- Technical schema revisions are allowed, but product V1/V2 language,
  migrations, aliases, fallbacks, and repair-in-place are forbidden.

Research and address all of the following:

1. Define the threat model: accidental drift, in-place installer servicing,
   path substitution, hash collision assumptions, public path disclosure,
   truncation, canonicalization disagreement, stale lock reuse, and malicious
   local replacement between validation and launch.
2. Compare full-file SHA-256 inventory, Merkle trees, signed catalog identity,
   Authenticode metadata, file version resources, directory metadata, and
   package/installer identity. Recommend the authoritative combination and
   explain why weaker alternatives are insufficient.
3. Specify precisely which files belong in the closure. Address direct versus
   recursive inventory, DLL dependencies, response-file helpers, locale
   resources, PDBs, manifests, import libraries, and files added by a later
   servicing update.
4. Define a deterministic inventory ordering across case-insensitive Windows
   names. Address Unicode normalization, case collisions, alternate data
   streams, hard links, sparse files, compressed files, and names that cannot
   round-trip through the chosen JSON representation.
5. Define a streaming hash algorithm for large files with bounded buffers,
   pre-hash and post-hash metadata checks, short-read handling, concurrent
   mutation detection, maximum file counts and sizes, and typed failures.
6. Explain which filesystem identity fields are stable enough for private
   binding and which are merely observations. Address volume serial, file ID,
   size, timestamps, link count, reparse tag, and final resolved path.
7. Design domain-separated hashing for private path values and environment
   values. Prevent cross-field correlation, dictionary ambiguity, empty-value
   confusion, and path-segment count leakage beyond explicitly allowed facts.
8. Specify a public-basis document, private-binding document, public-lock
   document, terminal document, and bounded public summary. Provide complete
   canonical field tables with required/forbidden fields and size limits.
9. Define the byte-level canonicalization contract: UTF-8, BOM prohibition,
   line endings, final newline, key ordering, number grammar, null policy,
   duplicate keys, escaping, and exact length/hash calculation.
10. Show how the public lock binds the private artifact without revealing it,
    and how a validator proves exact correspondence when it is authorized to
    read both. Address substitution of a different private file with the same
    public semantic content but different bytes.
11. Define installer servicing and drift semantics. State which changes
    invalidate only the environment lock and which would invalidate downstream
    build, conversion, evaluation, or browser evidence.
12. Compare unsigned local locks, machine-local signing, organizational
    signing, transparency logs, and content-addressed Git registration. State
    what signing can and cannot prove in this prelaunch workflow.
13. Provide adversarial examples of redaction failure, hash confusion,
    canonicalization mismatch, inventory omission, and stale-lock acceptance,
    with exact expected rejection points.
14. Define an independent audit procedure that can verify the public contract
    without receiving private paths or model bytes.

Required report structure:

1. Executive recommendation.
2. Threat model and evidence claims.
3. Closure membership rules.
4. File identity and streaming-hash algorithm.
5. Canonical serialization contract.
6. Private-binding schema.
7. Public-basis and public-lock schemas.
8. Terminal and public-summary schemas.
9. Domain separation and privacy analysis.
10. Drift and invalidation graph.
11. Adversarial test matrix.
12. Independent audit protocol.
13. Local unknowns and required observations.
14. Annotated primary-source bibliography.

Do not propose publishing private paths, trusting timestamps instead of bytes,
hashing only named executables, silently ignoring new directory members,
rewriting an existing lock after drift, or calling a public hash proof of
correct runtime behavior.

## Prompt 3: Windows Path Security, Reparse Defense, And Launch-Time TOCTOU

You are an independent Windows filesystem security researcher, process-launch
specialist, and adversarial build-isolation architect. Produce a deeply
technical report for securing a source-controlled environment materializer and
one-shot Rust build launcher against path ambiguity, reparse points, hard-link
substitution, current-directory search, and time-of-check/time-of-use attacks.
Target 8,000 to 15,000 words excluding bibliography.

You may inspect current Microsoft documentation for NT object paths, Win32 file
namespaces, reparse points, file IDs, CreateFile, CreateProcess, SearchPath,
Safe DLL Search Mode, process mitigation policies, job objects, ACLs, and
PowerShell or Node.js process semantics. You may inspect Rust standard-library
and Node.js documentation. You have no access to TinyRustLM private code,
machine paths, artifacts, receipts, credentials, or live processes.

Project-supplied facts and constraints:

- TinyRustLM is prelaunch. There is one clean product path and no requirement
  for legacy path compatibility, aliases, environment inheritance, fallback
  discovery, or repair of obsolete operations.
- A previous immutable build attempt failed because its exact child `PATH`
  could not resolve the linker. The replacement will name the target linker
  explicitly and bind all material roots before preregistration.
- The environment authority is expected to reject symlinks and reparse points
  in every path component, require regular files, resolve final paths, inventory
  selected directories, and preserve a private filesystem identity record.
- One drive is operator-declared read-only for this campaign. Discovery and
  outputs must not traverse into or write under that root. Generated evidence
  and model files remain outside Git.
- The one managed child process must receive an exact allowlisted environment,
  fixed working directory, fixed executable, fixed arguments, no shell, and no
  ambient `PATH` inheritance.
- Public evidence must not expose private paths, usernames, machine IDs, raw
  command lines containing secrets, or environment secrets.

Research and address all of the following:

1. Explain the relevant Windows path namespaces and normalization hazards:
   DOS drive paths, UNC, device paths, `\\?\`, `\\.\`, drive-relative paths,
   trailing dots/spaces, short 8.3 names, case folding, reserved names,
   alternate data streams, and Unicode normalization.
2. Define an absolute-path grammar suitable for a strict request. State which
   path forms must be forbidden even if Win32 accepts them.
3. Specify a component-by-component traversal algorithm that detects symbolic
   links, junctions, mount points, cloud placeholders, and other reparse tags.
   Explain limits of high-level `lstat` and `realpath` APIs.
4. Analyze hard links. Explain why rejecting reparse points does not prevent a
   file from being replaced through another hard link and what file-handle or
   file-ID checks are needed.
5. Design root-containment tests that are correct under Windows
   case-insensitivity, volume boundaries, separator normalization, sibling
   prefixes, and names such as `D:\safe2` versus `D:\safe`.
6. Define how to prove an output path is outside prohibited roots and inside an
   owned output root before any temporary file or directory is created.
7. Analyze command resolution for `cargo`, `rustc`, `link`, `lib`, `cl`,
   `ml64`, `rc`, and `mt`. Specify how an exact absolute linker and bounded
   `PATH` interact with Cargo and child tools.
8. Cover executable extension search, PATHEXT, current-directory precedence,
   App Paths, shell built-ins, command aliases, PowerShell command discovery,
   and why the production launcher must bypass them.
9. Analyze DLL loading by `link.exe`, `rustc.exe`, and converter processes.
   Recommend a defensible DLL search policy without claiming full hermeticity
   that Windows cannot provide.
10. Define launch-time revalidation using open handles, file IDs, byte hashes,
    directory identities, or a short critical section. Compare feasible Node,
    Rust, and Win32 implementations.
11. Specify process-creation flags, handle inheritance, standard-stream
    custody, current directory, environment-block construction, console
    behavior, code page, and cancellation semantics.
12. Explain how job objects, restricted tokens, ACLs, Windows Sandbox, or a
    dedicated worker account change the threat model. Distinguish required
    first-model controls from later defense in depth.
13. Provide at least 50 hostile path and replacement cases with expected typed
    rejection stages, including junction races, case aliases, hard links,
    locked files, moved roots, and path replacement after hashing.
14. Define which protections can be unit-tested on a synthetic filesystem,
    which require an NTFS observation harness, and which require a privileged
    security test environment.

Required report structure:

1. Executive path-security recommendation.
2. Windows namespace and normalization model.
3. Request path grammar.
4. Reparse and component-inspection algorithm.
5. Hard-link and file-identity analysis.
6. Root-containment and prohibited-drive rules.
7. Exact command and DLL resolution model.
8. TOCTOU-resistant launch sequence.
9. Process and handle isolation controls.
10. Hostile-case matrix.
11. Test architecture and platform prerequisites.
12. Objective acceptance criteria.
13. Residual risks and local unknowns.
14. Annotated primary-source bibliography.

Do not recommend shell invocation, inherited `PATH`, current-directory command
search, substring-based root checks, deleting suspicious historical output,
or claiming that `realpath` plus SHA-256 completely eliminates TOCTOU.

## Prompt 4: PE COFF And Archive Validation For An X64 Linker Closure

You are an independent PE/COFF format expert, Windows linker engineer, and
binary supply-chain auditor. Produce an exceptionally detailed report defining
static validation for every named tool and import library in an x64 MSVC and
Windows SDK closure before Rust build custody is allowed to run. Target 8,000
to 15,000 words excluding bibliography.

You may browse the current Microsoft PE/COFF specification, COFF archive
format documentation, Authenticode specifications, Windows SDK and MSVC tool
documentation, LLVM binary-tool documentation, and public parser source pinned
to immutable revisions. You have no TinyRustLM code, local binaries, private
paths, build logs, artifacts, or credentials.

Project-supplied facts and constraints:

- TinyRustLM is a clean prelaunch product. There is no legacy binary format or
  fallback toolchain to support.
- The selected tool roles include at least x64 `cl.exe`, `dumpbin.exe`,
  `lib.exe`, `link.exe`, `ml64.exe`, `mt.exe`, and `rc.exe`.
- Required MSVC archives include at least `libcmt.lib`, `libvcruntime.lib`,
  `oldnames.lib`, and `vcruntime.lib`. Required UCRT archives include
  `libucrt.lib` and `ucrt.lib`. Required UM import libraries include at least
  `advapi32.lib`, `bcrypt.lib`, `kernel32.lib`, `ntdll.lib`, `userenv.lib`, and
  `ws2_32.lib`.
- All direct files or `.lib` members in selected roots are intended to be
  inventoried by bytes, while named roles receive stronger format validation.
- A prior attempt is permanently rejected because it lacked linker
  resolvability. No retry or adoption is allowed.
- Public evidence may contain hashes, byte lengths, machine types, role names,
  versions, counts, and typed status. It may not contain local absolute paths,
  usernames, machine IDs, private logs, or secrets.

Research and address all of the following:

1. Define the exact static claims that can be made from a PE image and the
   claims that require execution. Separate image machine type, subsystem,
   imports, signatures, version resources, and actual runtime compatibility.
2. Give a bounded parser algorithm for DOS header, PE signature, COFF header,
   optional header, section table, data directories, certificate table, import
   table, and resource table sufficient for closure validation.
3. Specify x64 acceptance rules and rejection of x86, ARM64, managed-only,
   malformed, polyglot, truncated, oversized, and contradictory images.
4. Explain whether host tools such as `rc.exe` and `mt.exe` must themselves be
   x64 when the desired build is x64, and distinguish host architecture from
   target artifacts.
5. Define COFF archive magic, member headers, long-name table, linker members,
   import-header members, regular object members, alignment, and bounded
   iteration rules.
6. Explain how to verify that a `.lib` is structurally an archive and contains
   target-compatible x64 members without requiring every archive to expose the
   same member pattern.
7. Address thin archives, nested archives, malformed long names, duplicate
   members, mixed architectures, import-object machine types, empty archives,
   and archive bombs.
8. Compare implementing a minimal source-controlled parser with invoking
   `dumpbin`, `llvm-readobj`, Windows APIs, or third-party libraries. Recommend
   strict parser boundaries and independence requirements.
9. Analyze Authenticode. Explain what signature validity, chain status,
   timestamp, catalog signing, revocation status, and publisher identity do and
   do not establish for locally installed Microsoft tools.
10. Recommend whether byte hashes plus complete selected-directory inventory
    are sufficient for prelaunch deterministic identity, or whether signature
    verification should be a promotion gate. Include offline and expired-chain
    behavior.
11. Define extraction and validation of file version resources without using
    localized display strings as security authority.
12. Provide typed errors and public-safe evidence fields for every parser and
    authenticity outcome.
13. Design a malformed corpus and property-based/fuzz strategy, with at least
    40 concrete binary cases and expected verdicts.
14. Define an independent second-parser comparison strategy and criteria for
    treating parser disagreement as an evaluator defect rather than a binary
    failure.

Required report structure:

1. Executive validation recommendation.
2. Static-claim taxonomy.
3. Bounded PE parser design.
4. Architecture acceptance rules.
5. Bounded COFF archive parser design.
6. Import-library compatibility rules.
7. Authenticode and catalog-signing analysis.
8. Evidence schema and typed errors.
9. Malformed corpus and fuzz plan.
10. Independent parser and disagreement protocol.
11. Objective acceptance criteria.
12. Residual risks.
13. Facts requiring local binaries or execution.
14. Annotated primary-source bibliography.

Do not recommend trusting filename extensions, invoking an unbound `dumpbin`
from ambient `PATH`, accepting any file with `MZ` prefix, treating a valid
signature as behavior proof, or silently accepting parser disagreement.

## Prompt 5: Exact Cargo Rustc And MSVC Link Environment Semantics

You are an independent Rust compiler engineer, Cargo internals researcher, and
Windows native-link specialist. Produce a deeply technical report specifying
the exact environment and configuration required for one offline Cargo build
of a pure-Rust converter targeting `x86_64-pc-windows-msvc`, with no ambient
toolchain discovery and no hidden fallback. Target 8,000 to 15,000 words
excluding bibliography.

Use current primary Rust, Cargo, rustup, LLVM, Microsoft linker, and Windows SDK
documentation. Public Cargo or rustc source observations must be pinned to
immutable revisions. You have no access to TinyRustLM source, `Cargo.lock`,
local toolchains, private paths, build output, model bytes, or receipts. Do not
claim to know the actual dependency graph beyond the project-supplied facts.

Project-supplied facts and constraints:

- TinyRustLM is prelaunch with no legacy build path, fallback linker, migration
  mode, retry, or best-of-N behavior.
- The first source model is Qwen3-0.6B at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca` and the desired artifact is the
  technical SLM2 format.
- A prior exact build request permanently failed because the registered child
  environment did not resolve `link.exe`. The failed build root is preserved
  and must not be reused.
- A source review reported that the direct converter package and its locked
  transitive graph are pure Rust and contain no `cc`, CMake, bindgen,
  pkg-config, vcpkg, OpenSSL-sys, ring, zstd-sys, SQLite-sys, or similar native
  build dependency. This is a local claim that must be reverified before a new
  operation.
- The next child environment is intended to set
  `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` to one absolute x64 `link.exe`
  and provide exact `PATH`, `LIB`, `LIBPATH`, Cargo home, target directory,
  rustc, temp, system root, and deterministic/offline settings.
- No user/global Cargo config, inherited rustup override, ambient shell setup,
  network access, or undeclared credential may influence the build.
- One registered command runs once under managed custody. A failure is
  terminal for that operation.

Research and address all of the following:

1. Trace Cargo's precedence among command flags, environment variables,
   project `.cargo/config.toml`, ancestor config, Cargo home config, target
   tables, `RUSTFLAGS`, encoded flags, and rustc defaults.
2. Prove the spelling and semantics of
   `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER`. Explain normalization of target
   triples and how Cargo passes the linker choice to rustc.
3. Determine whether the configured linker may be an absolute path and how
   spaces, Unicode, quoting, response files, and canonicalization affect it.
4. Enumerate every process likely to be launched by `cargo build --locked
   --offline` for a pure-Rust binary, including rustc, linker, build scripts,
   proc macros, metadata helpers, and wrappers.
5. Explain how rustc locates Windows import libraries and CRT libraries under
   MSVC. Distinguish `LIB`, rustc native library search paths, SDK selection,
   and linker default-library directives.
6. Analyze the practical need and semantics of `LIBPATH`, `PATH`,
   `VCToolsInstallDir`, `WindowsSdkDir`, `WindowsSDKVersion`, `UCRTVersion`,
   `UniversalCRTSdkDir`, `Platform`, and VSCMD architecture variables. Separate
   fields required by documented tools from fields useful only to scripts.
7. Define a minimal exact environment allowlist. Include system variables that
   Windows process launch or Rust requires, and justify omission of all others.
8. Address `SystemRoot`, temp roots, user profile, code pages, locale,
   timezone, source-date variables, incremental compilation, terminal color,
   backtraces, and deterministic diagnostic capture.
9. Define how to exclude global Cargo configuration and rustup state. Compare
   absolute rustc/cargo binaries, `RUSTC`, `RUSTC_WRAPPER`, `RUSTUP_TOOLCHAIN`,
   and a dedicated `CARGO_HOME`.
10. Specify offline dependency proof: lockfile identity, registry/cache closure,
    source replacement, checksum verification, Git dependencies, sparse index,
    and network-denial evidence.
11. Explain response-file creation and custody, including encoding, temporary
    location, content secrecy, deletion/preservation, and independent capture
    sufficient to reconstruct the linker invocation.
12. Define a preflight that proves command resolution without compiling and
    does not become an unregistered trial build.
13. Explain how a future native dependency would invalidate the environment
    assumptions and require a new closure rather than silent extension.
14. Provide a process tree, environment table, failure taxonomy, and exact
    evidence needed to prove that the registered linker was actually invoked.

Required report structure:

1. Executive Cargo/MSVC recommendation.
2. Configuration precedence table.
3. Exact environment allowlist.
4. Cargo-to-rustc-to-link process model.
5. MSVC/SDK library resolution model.
6. Offline dependency closure.
7. Global-state exclusion protocol.
8. Response-file and temporary-file custody.
9. Noncompiling preflight design.
10. Process evidence and typed failures.
11. Adversarial test matrix.
12. Objective acceptance criteria.
13. Local unknowns.
14. Annotated primary-source bibliography.

Do not recommend inheriting a Developer Command Prompt, invoking a shell script
at build time, trying `link.exe` and then LLD, using online dependency repair,
or treating Cargo exit code zero alone as proof of environment custody.

## Prompt 6: Crash-Durable Create-Only Evidence Materialization On Windows

You are an independent storage-systems engineer, Windows filesystem expert,
and evidence-ledger architect. Produce an exceptionally detailed report for a
create-only materializer that emits a private binding, a public lock, and a
terminal receipt in that order, survives interruption and disk-full failures,
and never overwrites or repairs historical evidence. Target 8,000 to 15,000
words excluding bibliography.

Use current Microsoft filesystem and file API documentation, Node.js and Rust
filesystem documentation, SQLite or write-ahead-log literature where relevant,
and primary crash-consistency research. You have no TinyRustLM source, local
filesystem access, generated receipts, model bytes, credentials, or private
paths.

Project-supplied facts and constraints:

- TinyRustLM is a single prelaunch product. There is no legacy evidence format
  to migrate or compatibility behavior to preserve.
- A prior one-shot operation is terminally rejected and all of its files are
  immutable history. New work uses wholly new operation identities and sibling
  output paths.
- The environment materializer renders three canonical JSON artifacts:
  private binding, public lock, and terminal receipt. The public lock binds the
  exact private bytes. The terminal binds both earlier artifacts.
- All final paths must be absent before work begins. Existing final or staging
  paths cause rejection. Outputs are written only under one owned root and not
  under prohibited roots.
- Public artifacts exclude private paths and secrets. Private artifacts remain
  outside Git. Public source-controlled schemas and summaries may be committed.
- No retry, resume, adoption, repair, overwrite, deletion of history, or
  conversion of a failure into a pass is allowed for the same operation.

Research and address all of the following:

1. Define the precise durability claim available from Node.js or Rust on NTFS
   for create, write, flush, close, rename, and directory flush operations.
2. Compare `CREATE_NEW`, temporary sibling creation, write-through flags,
   `FlushFileBuffers`, atomic rename, replace-existing behavior, and hard-link
   publication. Recommend one create-only protocol.
3. Analyze whether same-directory rename is atomic when antivirus, indexing,
   backup, cloud sync, or another process holds a handle. Define bounded error
   handling without retrying the logical operation.
4. Specify temporary filename derivation that is collision-resistant yet
   bound to the operation, cannot traverse directories, and does not leak
   secrets.
5. Define rendering-before-writing so serialization or validation failures
   cannot leave a misleading partial final set.
6. Give the exact state machine for no files, private only, private plus public,
   all three, staging only, and unexpected combinations discovered after a
   process crash.
7. Explain why a partially materialized operation is terminal history rather
   than resumable in this project's one-shot semantics. Show how a new
   operation can cite the old failure without adopting its artifacts.
8. Define disk-full, quota, short write, flush failure, close failure, rename
   failure, ACL denial, path replacement, and power-loss behavior at every
   boundary.
9. Address NTFS write caching, storage-device volatile caches, ReFS, FAT/exFAT,
   network shares, WSL-mounted volumes, and cloud-backed folders. State which
   filesystems should be rejected for authoritative evidence.
10. Specify exact post-write validation: byte reread, canonical parse, length
    and hash check, file identity, final-path reparse check, and sibling-set
    completeness.
11. Define bounded public failure records that do not reveal private paths,
    raw OS messages, usernames, or secrets while preserving actionable typed
    codes.
12. Compare direct JSON files, a SQLite ledger, an append-only binary journal,
    and content-addressed object storage for this narrow use case.
13. Provide fault-injection pseudocode and a matrix covering interruption after
    every syscall-equivalent step.
14. Define independent recovery inspection that classifies state without
    mutating it.

Required report structure:

1. Executive durability recommendation.
2. Filesystem assumptions and claim boundary.
3. Canonical render-before-write procedure.
4. Create-only write and flush algorithm.
5. Three-artifact state machine.
6. Crash and disk-full matrix.
7. Post-write validation algorithm.
8. Public-safe error schema.
9. Recovery inspection protocol.
10. Fault-injection architecture.
11. Objective acceptance criteria.
12. Residual durability risks.
13. Local filesystem facts requiring verification.
14. Annotated primary-source bibliography.

Do not recommend overwrite-by-rename, deleting partial history, resuming the
same logical operation, broad unbounded OS-error publication, or describing a
write as durable merely because the language runtime returned success.

## Prompt 7: Hostile Test Architecture For A Toolchain Environment Authority

You are an independent principal test architect, property-testing researcher,
and Windows reliability engineer. Produce an extremely detailed test strategy
for a deterministic x64 MSVC environment materializer and validator before it
is trusted by one-shot model-conversion build custody. Target 8,000 to 15,000
words excluding bibliography.

Use primary documentation for Windows filesystems and process creation,
Node.js testing, Rust testing, property-based testing, fuzzing, mutation
testing, PE/COFF, `vswhere`, Cargo, and continuous integration. You have no
TinyRustLM source, local machine, installed Visual Studio instance, private
artifacts, or test output. Your report must specify interfaces and behaviors,
not pretend to assess an implementation you cannot inspect.

Project-supplied facts and constraints:

- TinyRustLM is prelaunch and can replace weak code outright. There is no
  legacy behavior to preserve and no permission for compatibility tests that
  institutionalize obsolete paths.
- The materializer accepts one canonical request, discovers Visual Studio via
  exact `vswhere` invocation, selects one product line and bounded highest
  complete version, selects one complete SDK, validates paths and binaries,
  inventories tool/lib roots, renders exact private/public evidence, and writes
  three create-only artifacts.
- A prior build attempt failed permanently because its registered environment
  omitted the installed linker. The regression must prove linker authority
  before another operation can be registered, but may not rerun the failed
  operation.
- The production environment must be deterministic, x64-native, offline,
  path-safe, privacy-preserving, and revalidated immediately before launch.
- Tests may use synthetic fixtures and fake process/filesystem adapters, but
  mocks cannot satisfy a real-machine observation or build gate.

Research and address all of the following:

1. Derive a testable architecture with pure parsing/selection/rendering cores
   and narrow adapters for process execution, filesystem metadata, hashing,
   binary inspection, clock, platform, and durable writes.
2. Define contracts for each adapter so test doubles cannot bypass production
   invariants or accidentally become alternate implementations.
3. Give unit-test partitions for request canonicality, version parsing,
   candidate normalization, SDK set intersection, inventory ordering,
   environment rendering, redaction, and output state.
4. Design property tests for version comparison, path containment, stable
   ordering, canonical JSON round trips, domain-separated hashes, and
   idempotent validation without idempotent materialization.
5. Define malformed corpora for `vswhere` JSON, toolset version files, PE
   images, COFF archives, directory listings, Unicode names, and public/private
   evidence documents.
6. Specify mutation-testing goals. Identify classes of implementation mutation
   that the suite must kill, such as dropping one eligibility predicate,
   swapping version order, ignoring stderr, omitting one library root, or
   publishing a path.
7. Design Windows-only integration fixtures using owned temporary roots with
   real NTFS files, reparse points, hard links, ACL failures, locked handles,
   and process replacement.
8. Define a read-only real-installation observation test that invokes the
   actual standard `vswhere`, validates the selected closure, and emits no
   private path in public logs. Explain why it is not a build proof.
9. Define a noncompiling command-resolution observation proving each command
   role resolves uniquely to the selected root and no ambient directory wins.
10. Design launch-time drift tests: replace a tool, add a library, change a
    file, move a root, alter an environment value, or service the SDK after
    lock creation. Every case must fail before child launch.
11. Define crash/fault injection after each materialization boundary and
    expected immutable state classifications.
12. Set coverage requirements by risk rather than line percentage. Include
    branch, boundary, corpus, mutation, and platform evidence.
13. Design CI separation for cross-platform pure tests, Windows synthetic
    tests, local installation observation, and an authorized one-shot build.
14. Give at least 80 named test cases with setup, action, expected result, and
    evidence class.

Required report structure:

1. Executive test recommendation.
2. Testable architecture and adapter boundaries.
3. Unit-test matrix.
4. Property and metamorphic test design.
5. Fuzz and malformed corpora.
6. Mutation-testing plan.
7. Windows NTFS integration harness.
8. Real-installation observation gate.
9. Drift and TOCTOU suite.
10. Crash/fault-injection suite.
11. CI evidence ladder.
12. At least 80 concrete test specifications.
13. Objective exit criteria and residual gaps.
14. Annotated primary-source bibliography.

Do not count mocks as real toolchain evidence, require tests for forbidden
legacy behavior, let snapshots conceal private paths, use one happy-path build
as the suite, or retry flaky one-shot operations until they pass.

## Prompt 8: Build Custody Integration And One-Shot Operation Semantics

You are an independent build-orchestration architect, process-custody
specialist, and evidence-state-machine reviewer. Produce a deeply technical
report defining how an exact Windows environment lock becomes a mandatory
input to one and only one managed Cargo build, without introducing a second
launcher, fallback route, retry path, or repair mechanism. Target 8,000 to
15,000 words excluding bibliography.

Use current Windows job-object and process-creation documentation, Rust and
Cargo documentation, canonical serialization and supply-chain provenance
standards, and primary process-supervision research. You have no TinyRustLM
source, requests, local processes, private model files, generated evidence, or
credentials.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch product. Weak contracts may be replaced
  cleanly. There is no product V2, no legacy operation mode, no compatibility
  alias, no migration layer, and no allowed technical debt.
- Exactly one source-controlled build-custody owner is authoritative. It
  validates a canonical request, source Git identity, clean source state,
  owner/profile/tool identities, exact command and environment, absent sibling
  outputs, bounded streams, process custody, and create-only terminal evidence.
- One historical operation ran exactly once and ended with child exit code 101
  because `link.exe` was absent from its registered `PATH`. Its request,
  partial target root, custody evidence, and terminal rejection are immutable
  and may never be retried, repaired, adopted, deleted, or reused.
- A new environment authority will create a private binding, public lock, and
  terminal record. The build request must bind all three relevant identities
  and the exact environment entries before any new operation can run.
- Environment validity must be rechecked immediately before launch. Drift
  terminates the operation without launching the child. No alternate
  environment may be substituted.
- The child is one offline locked Cargo build for a direct converter package.
  All descendants must remain in process custody, and an escaped or surviving
  process is a terminal failure.
- Private paths and raw logs remain private. Public evidence contains hashes,
  bounded counts, durations, exit classifications, and typed errors.

Research and address all of the following:

1. Define the authority boundary between environment materializer, request
   registrar, build-custody owner, Cargo, converter controller, and independent
   inspector. Ensure no component can silently perform another component's
   operation.
2. Provide a new clean request schema that binds source commit/tree/status,
   environment profile, public lock, private binding, materializer terminal,
   custody owner/profile, exact executable/arguments/environment, output roots,
   resource bounds, and prohibited roots.
3. Specify canonicality and create-only registration rules. Explain why a
   request must be output-free and remotely exact before execution.
4. Define prelaunch validation order so a failure cannot create child output
   before all authority and drift checks succeed.
5. Show how to compare exact environment arrays without case-folding names,
   duplicate variables, hidden inherited values, reordered path lists, empty
   entries, or trailing separators.
6. Define immediate closure revalidation. State which artifacts are rehashed,
   which directories are re-enumerated, and how post-lock additions or removals
   are detected.
7. Design direct `CreateProcess` semantics with no shell, exact working
   directory, standard-stream custody, bounded output, timeout, cancellation,
   and deterministic environment block.
8. Specify Windows job-object setup, assign-before-execution options, nested
   jobs, breakaway prevention, descendant accounting, process-tree drain, and
   behavior if a child escapes or survives.
9. Define resource budgets for wall time, CPU time, memory, process count,
   handles, output bytes, file count, and disk usage. Explain terminal verdicts
   for each breach.
10. Design terminal evidence for prelaunch rejection, child nonzero exit,
    timeout, custody escape, output overflow, successful build, and later
    inspector rejection. A single boolean is forbidden.
11. Define how the successful Cargo executable becomes an input to the next
    stage without adopting unregistered sibling files or scanning for the
    newest output.
12. Specify process-crash and power-loss states at each boundary and explain
    why the operation never resumes.
13. Give an invalidation graph showing which source, tool, environment,
    request, owner, or inspector changes require a wholly new operation.
14. Provide a TDD sequence and hostile matrix proving there is exactly one
    launch path and one invocation opportunity.

Required report structure:

1. Executive custody recommendation.
2. Component authority map.
3. Canonical request schema.
4. Registration and remote-verification protocol.
5. Prelaunch validation sequence.
6. Exact environment and closure revalidation.
7. Process/job-object custody algorithm.
8. Resource budgets and bounded streams.
9. Terminal evidence schema family.
10. Crash and one-shot state machine.
11. Invalidation graph.
12. TDD and hostile-case matrix.
13. Unknown local facts.
14. Annotated primary-source bibliography.

Do not propose rerunning the failed historical operation, adding a second
launcher, inheriting environment state, retrying a nonzero exit, scanning for
whatever executable appeared, or converting preflight failure into a skip.

## Prompt 9: Offline Pure-Rust Converter Build Closure And Dependency Audit

You are an independent Rust supply-chain auditor, Cargo dependency-graph
expert, and offline-build engineer. Produce an exceptionally detailed report
defining how to prove that a Qwen3-to-SLM2 converter can be built from a pinned
source tree and lockfile with no network, no undeclared native toolchain
dependency, and no ambient package cache authority. Target 8,000 to 15,000
words excluding bibliography.

Use current Cargo and rustc documentation, crates.io index and checksum
documentation, Git object model documentation, SPDX/SBOM standards, SLSA,
OSV, cargo-vet, cargo-audit, cargo-deny, and public crate build-script sources
pinned to immutable revisions. You have no TinyRustLM source, lockfile, private
registry cache, build output, model files, credentials, or local network logs.

Project-supplied facts and constraints:

- TinyRustLM is prelaunch, with no legacy converter, dependency compatibility
  layer, online fallback, automatic repair, or tolerated known debt.
- The first model source is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`; the output technical format is
  SLM2.
- The direct converter package is reported to be pure Rust. A local textual
  lockfile scan found no common native-build crates such as `cc`, CMake,
  bindgen, pkg-config, vcpkg, ring, OpenSSL-sys, zstd-sys, or SQLite-sys. This
  observation is not sufficient proof and must be replaced by a graph-aware
  audit before a new build operation.
- One historical build root is a rejected immutable partial and cannot be used
  as cache, evidence, or input.
- A new build must use exact source Git identity, exact `Cargo.lock`, a dedicated
  Cargo home and target root, `--locked --offline`, no network, and one bound
  x64 MSVC/SDK environment.
- Generated dependencies, build output, receipts, and model bytes remain
  outside Git. Source-controlled metadata must not contain private paths.

Research and address all of the following:

1. Define a graph-aware audit of all normal, build, dev, target-specific,
   optional, feature-gated, proc-macro, and transitive dependencies for the
   exact package/features/target/profile command.
2. Explain how Cargo resolves target-specific dependencies and build scripts
   for host versus target. Show why a text search of `Cargo.lock` is
   insufficient.
3. Define detection of native code, external compiler invocation, vendored C/C++
   or assembly, generated bindings, system library probes, environment probes,
   downloads in build scripts, and runtime dynamic-library dependencies.
4. Specify exact source provenance for registry packages, Git dependencies,
   path dependencies, workspace members, patches, replacements, and source
   configuration.
5. Define an offline dependency bundle or dedicated Cargo home whose every
   archive/source/checksum/index record is content-addressed and request-bound.
6. Explain how to prove network denial rather than merely pass `--offline`.
   Cover DNS, proxies, Git helpers, build scripts, subprocesses, and loopback.
7. Specify lockfile canonicality, Cargo version binding, checksum verification,
   sparse versus Git index authority, yanked crates, and registry source
   replacement.
8. Define feature and profile closure. Prevent a local default feature or
   target cfg difference from silently changing dependencies.
9. Analyze proc macros and build scripts as executable supply-chain inputs.
   Define custody, environment, output, and reproducibility evidence.
10. Specify an SBOM and provenance record that distinguishes source packages,
    build-time executables, generated code, and final linked components.
11. Define license-policy review, advisory scanning, malicious package review,
    maintainer/yank drift, and how an unresolved issue blocks the operation.
12. Design reproducibility checks across two clean target roots without
    claiming bit-for-bit identity where PDBs, paths, or timestamps prevent it.
13. Provide typed failures and an invalidation map for lockfile, source,
    Cargo/rustc, dependency cache, feature, or advisory-policy changes.
14. Give a local audit command plan that emits bounded public facts and keeps
    package paths, usernames, and private cache locations out of public output.

Required report structure:

1. Executive dependency-closure recommendation.
2. Cargo graph and host/target model.
3. Native-code and build-script detection algorithm.
4. Source and checksum provenance.
5. Dedicated offline Cargo-home design.
6. Network-denial evidence.
7. Feature/profile/target closure.
8. Proc-macro and build-script custody.
9. SBOM, license, and advisory controls.
10. Reproducibility experiment.
11. Typed failures and invalidation graph.
12. TDD and adversarial fixture plan.
13. Local unknowns.
14. Annotated primary-source bibliography.

Do not recommend online cache repair, trusting `Cargo.lock` without source
verification, assuming absence of the `cc` crate proves pure Rust, adopting the
old partial target, or waiving a dependency issue merely to produce a model.

## Prompt 10: Wholly New Composition Preregistration And Six-Member Transaction

You are an independent evidence-systems architect, transaction-state-machine
designer, and model-conversion reliability engineer. Produce a deeply technical
report defining the output-free preregistration and one-shot execution of a
wholly new Qwen3 composition operation after the Windows environment defect is
corrected and remotely verified. Target 8,000 to 15,000 words excluding
bibliography.

Use primary specifications for Git object identity, canonical JSON, durable
filesystems, cryptographic hashes, model repository revisions, Safetensors,
tokenizer formats, and transaction/state-machine design. You have no access to
TinyRustLM code, private source snapshots, model members, output paths,
credentials, previous receipts, or build machines.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch product with no legacy conversion route,
  compatibility shim, migration, repair, fallback, retry, or debt allowance.
- The source model is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- A previous composition registration was valid and one build-custody command
  ran exactly once. It ended with exit code 101 because the linker was absent
  from the exact registered environment. All request, custody, terminal, and
  partial output artifacts are immutable historical evidence. No managed
  converter, composition output, or browser check ran.
- A source-controlled deterministic MSVC/SDK environment authority must be
  implemented, tested, committed, pushed, freshly fetched, and shown remotely
  exact before a new operation may even be preregistered.
- The new operation must use a wholly new identity and wholly new absent output
  roots. No old member, partial build root, receipt, or staged file may become
  input.
- The composition consumes six exact source members: model configuration,
  generation configuration, tokenizer configuration, tokenizer data, model
  weights, and source manifest/provenance as defined by the project's pinned
  acquisition contract. Each member is independently identified before the
  transaction.
- The final SLM2 artifact and private evidence remain outside Git. Public
  source control receives only schemas, output-free registration, bounded
  hashes/counts/status, and no private paths or model bytes.

Research and address all of the following:

1. Define immutable identities for source repository/revision, each downloaded
   member, source manifest, converter source/tree, converter executable,
   environment lock, custody request, composition request, staging root, final
   artifact, and every receipt.
2. Specify an output-free preregistration document. Distinguish expected output
   paths and bounds from output identities that cannot exist before execution.
3. Define local clean-worktree and remote-exact verification, including fresh
   fetch, branch-tip identity, commit/tree identity, and protection from stale
   remote-tracking references.
4. Specify preconditions proving all new output and staging siblings are absent
   and all historical roots remain untouched.
5. Define the six-member acquisition/composition transaction with explicit
   member ordering, size bounds, streamed hashing, canonical manifests, and no
   directory scanning for unexpected files.
6. Explain how to bind tokenizer/model configuration compatibility before
   conversion without executing the target model.
7. Define one invocation of the managed converter, descendant custody,
   temporary output ownership, stream bounds, cancellation, and terminal
   behavior.
8. Design atomic final promotion on Windows. The artifact must become visible
   only after complete independent validation; rejected staging remains inert
   history.
9. Define first-divergence evidence for missing member, source drift, hash
   mismatch, converter failure, output limit, malformed SLM2, quantization
   defect, and promotion failure.
10. Specify why the same operation can never be resumed or retried after any
    child invocation, even if no final artifact exists.
11. Define a content-addressed receipt graph and invalidation edges. A later
    evaluator change should not redownload immutable source bytes, while a
    source-member change invalidates composition.
12. Provide public-safe summaries that prove what phase was reached without
    exposing prompts, model bytes, private paths, raw logs, or credentials.
13. Design an independent postmortem protocol that preserves failed evidence
    and creates a generic regression before a wholly new operation is allowed.
14. Give a complete state diagram and TDD matrix for registration, execution,
    inspection, rejection, promotion, and handoff.

Required report structure:

1. Executive transaction recommendation.
2. Identity graph.
3. Output-free preregistration schema.
4. Remote-exact registration protocol.
5. Six-member input contract.
6. One-shot execution and custody state machine.
7. Staging and atomic promotion algorithm.
8. Receipt schema family.
9. Failure and first-divergence taxonomy.
10. Invalidation graph.
11. Public/private evidence boundary.
12. TDD and fault-injection matrix.
13. Unknown local facts.
14. Annotated primary-source bibliography.

Do not recommend suffixing the old output and continuing, adopting partial
Cargo artifacts, retrying the converter, repairing malformed output,
overwriting a rejection, or preregistering invented final hashes.

## Prompt 11: Independent Qwen3 SLM2 Inspection Quantization And Runtime Parity

You are an independent transformer inference scientist, binary-model format
reviewer, and numerical verification lead. Produce an exceptionally detailed
report defining how an independently built inspector and scalar oracle should
prove that a Qwen3-0.6B SLM2 artifact is structurally faithful, numerically
credible, and suitable for native and browser-local execution. Target 10,000
to 18,000 words excluding bibliography.

Use primary Qwen3 papers and official model cards, immutable Hugging Face
repository files, Safetensors and tokenizer specifications, Rust and WebAssembly
numeric documentation, quantization research, and official framework source
pinned to immutable revisions. You have no TinyRustLM code, private model
bytes, SLM2 schema, converter, model output, tests, or receipts. Treat all
project details as unverified facts and do not invent format fields.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch browser-local chat product. There is no legacy
  model runtime to support and no permission for fallback decoders, repaired
  outputs, compatibility aliases, or known numerical debt.
- The first real source is `Qwen/Qwen3-0.6B` at revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- SLM2 is a technical portable model format identity, not a product V2. Model
  bytes remain private/local or direct P2P and are not stored by public sites.
- A converter is expected to create one deterministic artifact from six pinned
  source members. An independent inspector must not share the converter's
  parsing or serialization implementation.
- Structural conversion success is not quality proof. Raw native, WASM, and
  browser outputs must be preserved. Output repair, hidden retry, answer
  completion, best-of-N, and expected-term injection are forbidden.
- Arithmetic may be delegated to deterministic tools; core promotion concerns
  include useful conversation, ambiguity, practical constraints, source
  authority, current-turn precedence, untrusted memory, multi-turn continuity,
  structured output, summarization, rewriting, and code explanation.

Research and address all of the following:

1. Pin and describe the exact public Qwen3-0.6B architecture: tensor names and
   shapes, hidden size, layer count, attention heads, KV heads, head dimension,
   MLP projection sizes, activation, normalization, RoPE, embedding/output
   tying, vocabulary, context, special tokens, and chat template.
2. State which values must be read from the pinned files rather than assumed
   from family-level documentation, and how contradictory public sources are
   resolved.
3. Define a source tensor manifest and exact accounting equation proving every
   required tensor is consumed once, no unknown tensor is ignored, and no
   tensor is silently reshaped or transposed.
4. Specify independent SLM2 structural inspection without knowing private
   field names in advance: required contract categories, bounded offsets,
   alignment, overlap, integer overflow, checksum domains, metadata canonicality,
   tensor uniqueness, and trailing bytes.
5. Define mixed quantization validation. Include scale derivation, grouping,
   zero-point policy, rounding, saturation, nonfinite values, outliers, error
   metrics, and per-tensor acceptance bounds.
6. Recommend quantitative noninferiority experiments between pinned source
   framework, dequantized artifact, native runtime, WASM runtime, and browser
   UI. Include logits, top-k token order, greedy sequences, sampled seeds, and
   multi-turn prompts.
7. Derive activation and KV-cache memory formulas by sequence length, batch,
   precision, layers, KV heads, and head dimension. Include browser WASM memory
   ceilings and growth behavior.
8. Define a scalar reference implementation for embedding, RMSNorm, RoPE,
   grouped-query attention, causal masking, gated MLP, residuals, logits, and
   sampling. State operation order and accumulator precision.
9. Explain how SIMD/native and WASM kernels are validated against the scalar
   oracle, including worst-case inputs, alignment, tails, NaN/Inf handling,
   determinism, and architecture dispatch.
10. Define tokenizer and chat-template parity tests across Unicode, whitespace,
    role boundaries, special tokens, truncation, stop tokens, and malformed
    input. No alternate template may be selected after observing output.
11. Design semantic promotion gates with sealed holdouts and unseen paraphrases
    while preventing contamination and answer memorization.
12. Define latency, memory, artifact-size, and quality evidence without
    inventing thresholds. Provide formulas and a method for setting thresholds
    from measured product budgets.
13. Give failure attribution rules distinguishing source weakness, converter
    defect, format defect, quantization loss, runtime kernel defect, tokenizer
    drift, sampling mismatch, and UI rendering defect.
14. Design a staged route from one structural artifact to native parity, WASM
    parity, useful browser chat, and quality qualification.

Required report structure:

1. Executive numerical-verification recommendation.
2. Pinned Qwen3 architecture table.
3. Source tensor manifest and accounting rules.
4. Independent SLM2 inspector requirements.
5. Quantization contract and error metrics.
6. Scalar reference runtime mathematics.
7. Native/WASM kernel parity strategy.
8. Tokenizer and chat-template parity.
9. KV-cache and activation memory model.
10. Source/artifact/runtime/browser experiment matrix.
11. Semantic no-cheat promotion protocol.
12. Failure attribution and rollback.
13. Unknowns requiring private artifacts and execution.
14. Annotated primary-source bibliography.

Do not invent private SLM2 fields, treat structural validity as model quality,
repair bad generations, select a favorable seed after seeing results, copy
holdouts into training, or lower quality criteria merely to claim a first model.

## Prompt 12: First Real Model Browser Chat P2P And Honest Prelaunch Release

You are an independent browser-runtime architect, P2P systems engineer,
release-evidence lead, and product reliability reviewer. Produce a very
detailed end-to-end report specifying how one provenance-bound Qwen3 SLM2
artifact should move from independently validated local bytes into useful
browser-local chat, P2P-first acquisition, documentation, and an honest
prelaunch deployment. Target 10,000 to 18,000 words excluding bibliography.

Use current primary browser, WebAssembly, IndexedDB, Cache Storage, File System
Access, service worker, CSP, CORS, Web Locks, Playwright, accessibility, HTTP,
cryptography, P2P/NAT, supply-chain, and release documentation. You may inspect
public TinyRustLM.com and MiniModel.org pages, recording URL, retrieval date,
viewport, and exactly what was publicly observed. You have no private source,
local SLM2 artifact, browser traces, credentials, P2P endpoints, model receipts,
MemoryEndpoints access, or deployment authority.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch product. There is no V2 product, no launched
  legacy UI, no compatibility obligation, and no permission for shims,
  alternate stale flows, download-instruction text files, hidden fallback,
  repair, best-of-N, or known debt. Weak code may be replaced cleanly.
- TinyRustLM.com is the browser-local chat interface. MiniModel.org is the
  catalog and direct P2P discovery authority. Public sites must not receive
  prompts or model bytes.
- The intended first artifact is Qwen3-0.6B at pinned source revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, converted to technical SLM2 and
  independently qualified.
- When a qualified artifact is available from a verified peer, the user action
  should acquire and verify it directly. If no peer is available and local
  conversion is supported, the product should initiate a real local conversion
  workflow after explicit consent. Downloading `.txt`, `.ps1`, or JSON
  instruction/request files is not a user experience and must not be the main
  path.
- Browser generation is local. Raw model output is preserved and rendered once.
  Introductory prompt cards disappear after chat begins, and the conversation
  workspace becomes authoritative.
- MemoryEndpoints is unauthorized and disconnected. No hosted-memory success
  may be claimed or simulated. Campaign counters remain zero until real
  authorized evidence exists.
- Model bytes and private receipts stay outside Git. Documentation, schemas,
  source, tests, version/release metadata, and public-safe change logs are kept
  current and checked in. Each site is deployed whenever all applicable gates
  pass, with a visible last-published version/date and consistent update log.

Research and address all of the following:

1. Define the user state machine from no model through catalog discovery,
   provenance review, verified P2P import, local conversion consent, conversion
   progress, independent verification, load, chat, failure, and explicit retry
   as a wholly new operation.
2. Specify model identity binding across catalog metadata, source revision,
   SLM2 artifact hash, piece set, quality receipt, peer announcement, local
   storage record, runtime load, and UI status.
3. Design P2P-first acquisition with one or more peers: complete identity
   agreement before mixing pieces, per-piece hashes, bounded parallelism,
   resumable transport journal, corruption quarantine, atomic final promotion,
   and final Rust/WASM verification.
4. Explain what to do when no verified peer exists. Define a loopback companion
   or browser-supported conversion contract that starts actual work rather than
   downloading instructions, while preserving consent and privacy.
5. Define strict loopback security: origin binding, unguessable session
   capability, CORS, CSRF, DNS rebinding, method/route allowlist, body limits,
   process ownership, expiration, cancellation, and no administrator secrets in
   the browser.
6. Specify browser storage for large model bytes and indexes across IndexedDB,
   OPFS, File System Access, Cache Storage, and companion-managed files. Include
   quotas, eviction, partial writes, crash recovery, and user deletion.
7. Define WASM memory ownership, streaming load, alignment, integrity checks,
   threads/SIMD feature detection, cross-origin isolation, graceful unsupported
   status, and no alternate model substitution.
8. Specify exact chat semantics: tokenizer/template identity, conversation
   state, generation lifecycle, cancellation, stop conditions, one authoritative
   message record, exactly-once rendering, scroll stability, and restart.
9. Design privacy/network assertions proving prompts and model bytes do not go
   to project sites or undeclared third parties. Cover service workers,
   telemetry, crash reporting, URL/referrer leakage, traces, and extensions.
10. Define browser tests at desktop, narrow desktop, and mobile widths,
    including long model names, long output, keyboard navigation, screen-reader
    labels, reduced motion, memory pressure, service-worker drift, and duplicate
    response events.
11. Specify public status language separating locally available, converting,
    structurally verified, conversation-screened, quality-qualified,
    P2P-configured, externally reachable, announced, and released. No unit test
    may imply live P2P or hosted-memory success.
12. Define release gates for Rust, WASM, browser assets, companion archives,
    catalog metadata, documentation sites, source-control readback, HTTPS
    deployment readback, secret scanning, SBOM, provenance, signing, and
    rollback.
13. Design consistent site release metadata: SemVer or another justified
    scheme, immutable release date, last-published time, source commit, artifact
    hashes, human-readable change log, machine-readable feed, and correction
    policy without rewriting history.
14. Provide the exact evidence needed to say the first model is ready for
    operator testing, ready for limited dogfood, and ready for public prelaunch
    announcement. Include explicit remaining risks and blocked external gates.

Required report structure:

1. Executive end-to-end recommendation.
2. User and artifact state machines.
3. Identity and receipt graph.
4. P2P-first acquisition protocol.
5. Actual local-conversion fallback contract.
6. Loopback and browser security model.
7. Large-model storage and WASM runtime design.
8. Chat lifecycle and exactly-once UI semantics.
9. Privacy and network assertion contract.
10. Browser, responsive, and accessibility matrix.
11. Truthful status and claim taxonomy.
12. Release, documentation, and publication gates.
13. Operator-test and dogfood acceptance checklist.
14. Unknowns requiring private artifacts, external peers, or deployment access.
15. Annotated primary-source bibliography with dates and immutable revisions.

Do not recommend downloading instruction files as the product workflow,
uploading prompts or model bytes to project sites, silently selecting another
model, simulating P2P or MemoryEndpoints success, calling local loopback public
reachability, deploying stale documentation, or claiming readiness from unit
tests alone.

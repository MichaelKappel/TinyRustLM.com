# Twelve Disconnected Research Prompts: MSVC Environment, New Qwen3 Composition, And Browser Closure

Each section below is a complete standalone assignment. Send each whole prompt
to a different technical research agent. The agents do not share context and
must not be expected to have read this introduction, another prompt, or any
private TinyRustLM material.

The reports are advisory research inputs, not implementation or test evidence.
Every agent must use current primary sources wherever possible, record source
publication or update dates and its own retrieval date, link directly to the
supporting material, and pin public repository observations to immutable
revisions. Every report must label and keep separate:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that the agent could not independently verify;
4. engineering analysis and recommendations;
5. assumptions, uncertainty, and competing interpretations; and
6. facts requiring local implementation, private evidence, real hardware, or
   authorized production verification.

No agent may claim that it inspected, built, ran, tested, or validated private
TinyRustLM code. A useful report is exceptionally technical and actionable: it
contains algorithms, pseudocode, state machines, schemas, equations, bounded
resource models, failure matrices, adversarial tests, objective acceptance
criteria, and a prioritized implementation sequence. Generic tutorials,
marketing summaries, invented measurements, and unsupported success claims
are not useful.

## Prompt 1: Exact X64 MSVC Toolchain Discovery, Selection, And Identity Closure

You are an independent principal Windows toolchain engineer, software supply
chain architect, and adversarial path-security reviewer. Produce an
exceptionally detailed, implementation-oriented report specifying how a
source-controlled program can discover exactly one usable x64 Microsoft C/C++
toolchain and Windows SDK installation, prove their identities, materialize a
linker-complete child-process environment, and reject every ambiguous or stale
installation. Target 8,000 to 15,000 words excluding the bibliography; prefer
dense technical substance over repetition.

You may browse current Microsoft documentation, Visual Studio Setup
Configuration API documentation and samples, `vswhere` documentation and
source, Windows SDK documentation, Rust and Cargo documentation, PE/COFF
specifications, Authenticode documentation, Windows path and reparse-point
documentation, and public source repositories. You have no access to the
TinyRustLM source tree, development computer, installed toolchain paths,
private model files, generated artifacts, build logs, receipts, credentials,
or deployment systems. Do not request private paths or secrets and do not
claim local validation.

Project-supplied facts and constraints, which the report must label as
unverified project facts:

- TinyRustLM is one prelaunch product. There is no launched predecessor and no
  permission for product V1/V2 branches, legacy support, migration code,
  aliases, compatibility shims, fallback toolchains, automatic retries,
  best-of-N selection, or known code debt. Technical names such as SLM2 and an
  execution suffix such as `/7` are format or attempt identities, not product
  generations.
- The first real conversion target is `Qwen/Qwen3-0.6B` at immutable public
  revision `c1899de289a04d12100db370d81485cdf75e47ca`. Model bytes and generated
  evidence remain outside Git.
- A public, output-free composition execution registration was committed and
  remotely verified before a single Rust build-custody operation was invoked.
  That operation ended permanently with exact child exit code 101 because the
  registered child environment could not resolve the x64 MSVC linker. The
  failure and partial private build root are preserved and must never be
  retried, adopted, repaired, deleted, or reused.
- A compatible x64 MSVC linker was later observed to be installed, but it was
  outside the registered `PATH`. No later managed build, converter controller,
  composition output, or browser verification ran.
- The next implementation must be a general source-controlled environment
  materializer and validator. It must bind one exact x64 MSVC toolset, one
  exact Windows SDK closure, linker and supporting-tool identities, all
  material search roots, ordering, target architecture, and rejection rules.
  It must be committed, pushed, and freshly verified before any wholly new
  output-free attempt can be preregistered.
- The design may select one supported toolchain deterministically, but it may
  not try several toolchains or builds and choose whichever works. It may not
  read or write a separate drive that the operator has declared read-only.
- Public evidence may contain public product names, versions, file hashes,
  bounded counts, statuses, and error codes. It must not disclose usernames,
  machine identifiers, private absolute paths, credentials, environment
  secrets, or raw logs.
- MemoryEndpoints is unauthorized and disconnected and is outside this task.

Research current primary sources and address all of the following in depth:

1. Compare the Visual Studio Setup Configuration COM API, `vswhere`, documented
   registry data, environment variables, installer state, and filesystem scans
   as discovery authorities. Recommend one normative authority and narrowly
   bounded corroborating checks. Explain why recursive drive scans, newest
   directory selection, and ambient developer-shell state are insufficient.
2. Define the exact instance requirements for Build Tools or Visual Studio:
   completeness, launchability, product state, required workloads/components,
   host architecture, target architecture, toolset family, preview status,
   servicing state, and Windows SDK presence. Include explicit behavior when
   zero, one, or multiple valid instances exist.
3. Specify deterministic selection without preference probing. Compare pinned
   instance identity, pinned installation version, allowed version interval,
   exact component version, and lexicographic selection. State what must be
   preregistered and what must cause fail-closed drift rather than reselection.
4. Reconstruct the x64 MSVC tool closure needed by `rustc` for an
   `x86_64-pc-windows-msvc` executable. Cover `link.exe`, `lib.exe`, resource
   compilation, manifest embedding, assembler use, compiler helpers, runtime
   redistributable implications, and tools that may be invoked by Cargo build
   scripts or native dependencies.
5. Define binary identity fields for each selected executable: canonical path
   held privately, normalized relative identity for public use, byte length,
   streaming SHA-256, PE machine, subsystem, timestamp treatment, file version,
   product version, Authenticode signer and verification status, and filesystem
   file identity. State which fields are security evidence and which are only
   diagnostic metadata.
6. Explain how to prove x64 host and x64 target selection. Cover `Hostx64/x64`,
   accidental x86-host selection, ARM64 installations, PE machine values,
   imported library architecture, and cross-target components. Define the
   exact rejection for a tool whose filename is correct but architecture is
   wrong.
7. Design canonical path handling on Windows. Address drive-relative paths,
   UNC and extended-length forms, case folding, trailing separators, short
   names, Unicode, device paths, alternate data streams, hard links, junctions,
   mount points, symlinks, reparse tags, parent replacement, and time-of-check
   to time-of-use races.
8. Specify the complete child environment, including `PATH`, `LIB`, `INCLUDE`,
   `LIBPATH`, `TMP`, `TEMP`, `SystemRoot`, `ComSpec`, architecture markers,
   locale, code page, Cargo/Rust variables, and deliberately excluded ambient
   variables. Explain whether `VCVARSALL` output may be parsed, used only as an
   oracle, or must be replaced with structured materialization.
9. Define environment ordering and duplicate handling. Explain why the same
   directories in a different order may resolve different binaries or
   libraries. Require an algorithm that proves `link.exe` resolution returns
   exactly the pinned file and that no earlier path member contains a competing
   executable under Windows command-search semantics.
10. Specify filesystem identity and mutation defenses between discovery,
    registration, and child launch. Include directory handles where practical,
    volume and file IDs, last-write metadata, executable rehashing, parent
    reparse checks, ACL inspection boundaries, and exact behavior after Visual
    Studio servicing changes any member.
11. Design a bounded, canonical, public-safe toolchain lock schema and a
    separate private binding schema. Include schema ID, discovery implementation
    hash, selected instance ID hash, component versions, relative members,
    ordered environment hashes, public binary digests, private-path references,
    validation time, and invalidation reasons. Avoid circular identity.
12. Provide language-neutral and Rust-oriented pseudocode for discovery,
    instance filtering, deterministic selection, closure enumeration, path
    canonicalization, PE inspection, hash streaming, environment construction,
    command-resolution proof, and final validation.
13. Develop an adversarial test matrix covering fake `link.exe` earlier in
    `PATH`, missing SDK, partial installer state, preview-only toolset, two valid
    instances, servicing drift, same version with different bytes, x86 linker,
    ARM64 library, junctioned tool root, parent replacement, inaccessible file,
    long path, non-ASCII path, duplicate path entry, empty path entry, quoted
    path member, trailing space, environment-size overflow, and read-only-drive
    contamination.
14. Define the minimum evidence required before a build request may be written.
    Separate `toolchain-discovered`, `toolchain-identity-bound`,
    `environment-materialized`, `command-resolution-proven`, and
    `build-authorized`; do not collapse them into one boolean.
15. State which findings can be established from public sources and which
    require implementation tests on a clean Windows machine, a machine with
    multiple installations, and the authorized private build machine.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Primary-source observation log with dates and immutable links.
3. Windows toolchain discovery-authority comparison.
4. Instance and component eligibility contract.
5. Deterministic selection and drift policy.
6. X64 MSVC executable and component closure.
7. Canonical path, reparse, and filesystem-identity rules.
8. Complete ordered child-environment specification.
9. Tool and binary identity schemas.
10. Materialization and validation algorithms with pseudocode.
11. Adversarial and mutation test matrix.
12. Public/private evidence and redaction contract.
13. Objective pre-build acceptance checklist.
14. Prioritized implementation sequence.
15. Unknowns requiring local execution.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend inheriting an interactive developer prompt, recursively
searching every drive, choosing the newest installation without a declared
rule, trying multiple linkers until one builds, falling back to an unpinned
toolchain, accepting a filename as binary identity, exposing private paths, or
rerunning the preserved failed operation. Do not claim that discovering an
installed linker proves the private build or model conversion succeeds.

## Prompt 2: Windows SDK, UCRT, Import-Library, And Link Search Closure

You are an independent Windows ABI engineer, PE/COFF linker specialist, and
hermetic-build researcher. Produce an exceptionally detailed report defining
the exact Windows SDK and Microsoft runtime closure required to link a native
x64 Rust executable predictably with MSVC, including the complete ordered
library search contract and objective diagnostics for every missing or wrong
member. Target 8,000 to 15,000 words excluding the bibliography.

You may browse current Microsoft Windows SDK, UCRT, MSVC runtime, PE/COFF,
linker, manifest, resource compiler, Rust target, and Cargo documentation, plus
public source repositories and standards. You have no access to the TinyRustLM
source tree, build machine, private paths, toolchain installation, model files,
generated outputs, logs, receipts, credentials, or deployment systems. Do not
request private data and do not claim local validation.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is a clean-slate, prelaunch browser-local AI product. There is no
  legacy product to support and no permission for compatibility layers,
  fallback environments, automatic retry, best-of-N selection, or knowingly
  deferred code debt.
- Its first real source candidate is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- One preregistered Rust build-custody operation was executed exactly once and
  permanently failed with exit code 101 because the registered environment
  could not resolve the MSVC linker. The failed root and logs remain preserved;
  the operation cannot be retried, cleaned, repaired, or adopted.
- A compatible x64 `link.exe` appears to be installed outside the registered
  command path. No proof yet establishes that the matching Windows SDK import
  libraries, UCRT libraries, headers, resource tools, or runtime closure are
  complete and internally consistent.
- Before a wholly new attempt is even registered, a source-controlled
  materializer must select and validate one exact linker-complete environment.
  The output must bind versions, paths privately, hashes publicly where safe,
  ordering, architecture, and rejection reasons. No build may be used as a
  discovery probe.
- The release executable is a build-time converter/controller, not permission
  to redistribute Microsoft tools. The report must separate tools needed only
  on the build machine from runtime dependencies of produced executables.
- MemoryEndpoints and live campaign counters are outside this task.

Research primary sources and address all of the following in depth:

1. Explain the Windows SDK directory and version model relevant to x64 desktop
   linking. Cover KitsRoot discovery, SDK product version, include and library
   version directories, `um`, `ucrt`, `shared`, `winrt`, `cppwinrt`, and `km`
   boundaries, and which are ordinarily relevant to a Rust console executable.
2. Distinguish MSVC toolset libraries from Windows SDK libraries and UCRT
   libraries. Map typical import and static libraries such as kernel, user,
   synchronization, shell, networking, C runtime, exception support, startup,
   security-cookie, and compiler support to their owning component without
   inventing project-specific dependencies.
3. Explain how `rustc` and `link.exe` derive default libraries and search paths
   for `x86_64-pc-windows-msvc`. Cover CRT linkage modes, `/DEFAULTLIB`,
   `/NODEFAULTLIB`, response files, target specifications, native dependencies,
   build scripts, and environment variables.
4. Specify the ordered `LIB` closure for x64. State how to bind MSVC `lib/x64`,
   Windows SDK `ucrt/x64`, Windows SDK `um/x64`, any required auxiliary roots,
   and why host and target directories must not be confused.
5. Specify `INCLUDE` and `LIBPATH` semantics even if the immediate pure-Rust
   build does not invoke a C compiler. Explain how future build scripts, bindgen,
   resource compilation, or C dependencies alter the closure, and how the
   validator should reject undeclared native compilation rather than silently
   expanding authority.
6. Define exact validation for every library directory: canonical location,
   regular-directory type, reparse status, access, architecture sample or full
   inventory policy, expected sentinel files, byte identity, version
   consistency, duplicate filenames, and ordering.
7. Explain COFF archive and import-library structure sufficiently to validate
   target architecture without linking. Cover archive members, import headers,
   machine values, thin/archive edge cases, malformed lengths, and bounded
   parsing.
8. Define how to verify `rc.exe`, `mt.exe`, and any manifest/resource support
   if the build or linker invokes them. State when they are required, how their
   versions relate to the selected SDK, and how absence should be classified.
9. Analyze dynamic runtime consequences of `/MD`, static CRT modes, Rust's MSVC
   runtime expectations, UCRT operating-system servicing, app-local
   redistribution, and self-contained release goals. Separate converter build
   dependencies from the browser WASM product and .NET companion distribution.
10. Design a version-consistency graph joining Visual Studio instance, MSVC
    toolset version, Windows SDK version, host architecture, target
    architecture, linker binary, import libraries, compiler support libraries,
    resource tools, and runtime policy. State which cross-version combinations
    are supported by public documentation and which require local proof.
11. Define diagnostic error taxonomy before any real build: linker missing,
    toolset library missing, SDK library missing, wrong architecture, malformed
    archive, access denied, reparse point, version drift, duplicate resolution,
    search-order shadowing, environment overflow, unsupported CRT policy, and
    unknown native dependency.
12. Provide a bounded lock schema for SDK closure and library search. Include
    exact versions, public hashes or aggregate Merkle roots, member counts,
    ordered path identities, sentinel identities, architecture verdicts,
    environment block digest, and public-safe error codes.
13. Give pseudocode for SDK discovery, version selection, directory closure,
    COFF/import-library inspection, ordered environment construction,
    response-file audit, executable dry resolution without executing a build,
    and prelaunch validation.
14. Design hostile tests for a missing `ucrt` directory, mismatched SDK
    include/lib versions, x86 libraries in an x64 root, duplicate `kernel32.lib`,
    malicious archive lengths, junctioned `um/x64`, stale SDK registry data,
    partial SDK uninstall, multiple SDK versions, unreadable sentinel,
    environment mutation, command-line `/LIBPATH` override, response-file
    injection, and undeclared build-script native dependency.
15. Define acceptance evidence that supports only the claim "the declared
    Windows x64 linker environment is complete under its published closure."
    Explain why this still does not prove a successful Rust build, converter
    execution, correct SLM2 bytes, native parity, browser inference, or model
    quality.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Primary-source observation log with dates.
3. Windows SDK, UCRT, and MSVC ownership map.
4. X64 link input and default-library model.
5. Ordered `LIB`, `INCLUDE`, and `LIBPATH` contract.
6. COFF and import-library bounded inspection design.
7. Resource, manifest, and auxiliary-tool closure.
8. CRT and redistribution analysis.
9. Toolset/SDK version-consistency graph.
10. Environment-lock and evidence schemas.
11. Validation pseudocode and module boundaries.
12. Failure taxonomy and hostile test matrix.
13. Objective acceptance checklist and prohibited claims.
14. Prioritized implementation sequence.
15. Unknowns requiring local execution.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend copying arbitrary library directories into the repository,
shipping Microsoft build tools without license analysis, treating headers and
libraries as interchangeable versions, using the build itself as environment
discovery, accepting the first directory that contains `kernel32.lib`, or
falling back to an ambient SDK. Do not claim that a complete SDK closure proves
the model converter or browser product works.

## Prompt 3: Cargo And Rustc MSVC Link Invocation, Native Dependency, And Artifact Proof

You are an independent Rust compiler-toolchain engineer, Cargo build-graph
auditor, and Windows process-forensics specialist. Produce an exceptionally
detailed report explaining how a release Cargo build for an
`x86_64-pc-windows-msvc` converter must be modeled, constrained, observed, and
proved from Cargo invocation through the exact linker process and final PE
artifact. Target 8,000 to 15,000 words excluding the bibliography.

You may browse official Rust, Cargo, rustc, target-specification, Cargo JSON
message, build-script, native-linking, MSVC, linker, and Windows process
documentation, plus immutable public Rust source revisions where documentation
is incomplete. You have no access to TinyRustLM code, `Cargo.toml`,
`Cargo.lock`, build machine, target directory, private models, generated
outputs, raw logs, receipts, credentials, or deployment services. Do not
request private source and do not claim local validation.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch product with no legacy-support obligation. The
  implementation may be rewritten cleanly; no compatibility path, fallback
  build, automatic retry, output repair, or knowingly retained debt is allowed.
- A source-controlled build-custody owner launches an exact direct Cargo
  command, captures stdout and stderr separately, records the child process,
  and owns a create-only private build root. It does not use a shell.
- A public registration bound the Cargo and rustc executable hashes, versions,
  command, parent source commit/tree, build profile, output roots, and zero
  retries. The direct Cargo child returned exact exit code 101. Raw stderr
  identified that `link.exe` could not be found in the registered child
  environment.
- That `/6` operation is permanently closed. Its private request, evidence,
  logs, and partial build root must remain preserved and must never be retried,
  adopted, cleaned, repaired, or reused.
- A later wholly new operation may be registered only after a general
  source-controlled x64 MSVC and Windows SDK environment materializer and
  validator is implemented, hostile-tested, committed, pushed, and freshly
  verified. The new operation must have all-new absent names and roots.
- The desired Rust artifact is a release `tinyrustlm-convert` executable that
  later participates in an exact six-member Qwen3 composition transaction.
  A successful Cargo build alone proves none of the model claims.
- The implementation must use structured process and Cargo evidence rather
  than guessing `target/release` paths or parsing a human sentence from logs.
- MemoryEndpoints is unauthorized and outside this assignment.

Research primary sources and address all of the following in depth:

1. Reconstruct the full process and data flow from direct Cargo launch through
   package graph resolution, build scripts, procedural macros, rustc
   invocations, response files, native tools, linker invocation, post-link
   processing, Cargo `compiler-artifact` emission, and process exit.
2. Specify every input that can affect the build beyond source commit and
   `Cargo.lock`: Cargo config hierarchy, environment variables, target spec,
   rustflags, linker config, runner config, registry/cache content, build
   script outputs, job count, incremental state, profile settings, path
   dependencies, git dependencies, source replacement, and current directory.
3. Explain rustc's linker selection precedence on Windows MSVC: target spec,
   `-C linker`, Cargo target configuration, environment-derived settings,
   default discovery, and relevant self-contained/linker-flavor options. State
   how to prove the selected linker is exactly the registered binary.
4. Define the ordered and minimized environment passed to Cargo and inherited
   by rustc, build scripts, and linker descendants. Include variables that must
   be fixed, scrubbed, allowed, hashed, or prohibited, with rationale.
5. Design a native-dependency policy. Explain how `build.rs`, the `cc` crate,
   bindgen, CMake, pkg-config, NASM, resource compilers, and prebuilt libraries
   can enter a nominal Rust graph. Recommend pre-build graph and source audits
   plus runtime process observation that fail on undeclared tools.
6. Specify how to consume Cargo's JSON message stream robustly while retaining
   raw stdout separately. Cover mixed compiler messages, non-JSON build-script
   output, `compiler-artifact` fields, executable presence, multiple binaries,
   examples/tests/build scripts, malformed or oversized records, and duplicate
   candidates.
7. Define exact artifact selection without path guessing: package ID, target
   name, target kinds, crate types, profile, features, target triple,
   executable field, build completion, and uniqueness. Include behavior if the
   expected target is absent or emitted more than once.
8. Design process-tree observation that proves the linker actually invoked is
   the registered linker. Compare Windows ETW, Job Objects plus process
   enumeration, kernel audit mechanisms, wrappers, rustc verbose output,
   response-file custody, and controlled `-C linker` injection. State trust
   assumptions and limitations.
9. Specify executable capture after Cargo success: regular-file and reparse
   checks, file handle, streaming hash, PE bounds, machine and subsystem,
   imports, Authenticode status if applicable, debug artifacts, timestamp
   treatment, Cargo artifact binding, and rehash immediately before launch.
10. Analyze reproducibility and stale-output hazards: incremental compilation,
    shared target directories, build-script rerun rules, environment-triggered
    rebuilds, dep-info, hard links, antivirus locks, concurrent Cargo, partial
    prior state, and source mutation. Recommend a create-only owned target root
    and exact reuse prohibition.
11. Define an evidence graph for source commit/tree, Cargo lock, dependency
    closure, toolchain lock, environment lock, build request, process start,
    Cargo event stream, linker observation, artifact capture, child terminal,
    and independent verification. Avoid circular identities and mutable
    `latest` files.
12. Provide Rust-oriented pseudocode for command construction, environment
    scrub/materialization, bounded dual-stream capture, incremental Cargo JSON
    parsing, artifact selection, process-tree custody, PE validation, terminal
    classification, and public-safe result emission.
13. Design hostile tests for missing linker, wrong linker earlier in `PATH`,
    `RUSTFLAGS` linker override, `.cargo/config.toml` override, malicious build
    script, extra executable artifact, malformed JSON line, output overflow,
    partial target root, concurrent Cargo lock, source change, lock drift,
    linker response-file mutation, linker crash, post-link mutation, and child
    success with no valid artifact.
14. Give failure-specific operator guidance that preserves one-shot evidence.
    Distinguish prelaunch validation failure from started build failure,
    controller ambiguity, child nonzero, Cargo graph rejection, linker identity
    mismatch, artifact ambiguity, and post-capture mutation. None may silently
    become a retry of the same registration.
15. Define the narrow claim supported by a completed, independently verified
    build and list all still-prohibited claims about converter semantics,
    Qwen3 composition, numerical parity, browser execution, quality, P2P, and
    publication.

Required report structure:

1. Executive recommendation and assumptions.
2. Primary-source observation log with immutable links and dates.
3. Cargo/rustc/native-tool process and input graph.
4. Linker selection and exact-identity proof.
5. Environment minimization and native-dependency policy.
6. Cargo JSON evidence parser and artifact-selection contract.
7. Process-tree and response-file custody design.
8. Artifact identity, PE inspection, and mutation controls.
9. Reproducibility and stale-output threat model.
10. Versioned evidence graph and schemas.
11. Rust implementation pseudocode and module boundaries.
12. Failure taxonomy and one-shot closure rules.
13. Hostile test and fault-injection matrix.
14. Objective acceptance checklist and prohibited claims.
15. Prioritized implementation sequence.
16. Unknowns requiring private execution.
17. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend invoking a developer shell as an opaque setup step, inheriting
ambient `RUSTFLAGS`, guessing `target/release`, selecting the newest executable,
using human log text as the only artifact authority, trying several linkers,
rerunning the preserved operation, or treating Cargo success as model proof.

## Prompt 4: Source-Controlled Windows Build-Environment Materializer And Validator

You are an independent principal Rust security engineer, configuration-language
designer, and Windows build-platform architect. Produce an exceptionally
detailed implementation design for a small source-controlled component that
discovers, locks, materializes, and validates one exact x64 MSVC plus Windows
SDK child environment without invoking a real project build. Target 8,000 to
15,000 words excluding the bibliography.

You may browse official Rust, Cargo, Windows, Visual Studio Setup,
`CreateProcessW`, environment-block, path-search, filesystem, PE/COFF, and
canonical-serialization documentation, plus public source repositories. You
have no access to TinyRustLM source code, local installations, private paths,
model bytes, generated output, test results, receipts, credentials, or
deployment systems. Do not request private artifacts and do not claim that your
design has been implemented or tested locally.

Project-supplied facts and constraints, to be clearly labeled as unverified:

- TinyRustLM is a prelaunch, clean-slate product. There is no legacy behavior
  to preserve. The project prohibits compatibility shims, fallback discovery,
  automatic retries, best-of-N selection, hidden repair, product V1/V2 forks,
  and knowingly retained debt.
- A preregistered one-shot Rust build ended permanently because `link.exe` was
  not resolvable in its exact registered child environment. The failed request,
  logs, evidence, and partial target root remain preserved and inert. They may
  not be retried, adopted, cleaned, repaired, or reused.
- A suitable x64 linker appears installed but was outside the registered
  `PATH`. The project now needs a general correction, not a hard-coded private
  path or one-machine patch.
- The correction must be source-controlled and hostile-tested before the next
  output-free operation is preregistered. It must discover one supported Visual
  Studio/MSVC instance and one compatible Windows SDK, bind exact identities,
  construct a complete ordered environment, prove command resolution, and fail
  before output on ambiguity or drift.
- Public locks and results must not reveal usernames, machine IDs, private
  absolute paths, credentials, or raw environment values. Private binding may
  contain necessary local paths but remains outside Git. The two records must
  be cryptographically joined without allowing the public lock to reconstruct
  private paths.
- The materializer may perform bounded metadata reads, hashes, and format
  inspection. It may not launch Cargo, rustc, the linker, or the converter as a
  trial. A later build is one irreversible registered operation.
- One operator-declared drive is read-only for this effort and must never
  appear in a write destination, temporary directory, Cargo root, target root,
  or derived environment entry.
- MemoryEndpoints is disconnected and not part of the design.

Research primary sources and address all of the following in depth:

1. Propose clean module boundaries for discovery adapters, canonical path
   logic, instance selection, component closure, PE/COFF inspection, hashing,
   environment construction, command resolution, public lock generation,
   private binding generation, and prelaunch validation. Keep policy separate
   from platform mechanics.
2. Define typed inputs rather than ambient configuration. Include supported
   target triple, host/target architecture, allowed toolset policy, allowed SDK
   policy, required tools, required library classes, prohibited roots,
   environment allowlist, output destinations, and schema identities.
3. Define typed outputs and status vocabulary. Distinguish not-discovered,
   ambiguous, selected, identity-bound, environment-materialized,
   resolution-proven, drifted, rejected, and authorized. Explain why a single
   `valid: true` field is inadequate.
4. Design the discovery abstraction so tests can inject a synthetic instance
   catalog without production code accepting arbitrary test records. Specify
   trait boundaries, sealed production implementations, test-only constructors,
   and how to prevent fixture or mock status from satisfying a real gate.
5. Specify deterministic selection as a pure function over a normalized
   catalog and declared policy. Give tie-breaking or ambiguity-rejection rules,
   stable sorting keys, duplicate detection, and exact diagnostics.
6. Design private path canonicalization and ownership checks. Cover
   `GetFinalPathNameByHandleW`, file IDs, volume serials, case-insensitive
   comparison, long paths, UNC, reparse points, symlink/junction ancestors,
   short names, alternate data streams, and inaccessible ancestors.
7. Define the public/private split. The public lock should bind schema,
   implementation identity, tool and component versions, byte hashes, relative
   member identities, ordered environment digest, architecture, and policy.
   The private binding should map opaque path IDs to local canonical paths and
   file identities. Explain anti-correlation and redaction limits.
8. Specify canonical serialization and digest construction. Address field
   ordering, UTF-8, LF, Unicode normalization policy, integer bounds, duplicate
   keys, unknown fields, timestamps, optional values, arrays whose order is
   semantic, domain-separated hashes, and schema upgrades in a prelaunch
   clean-cut codebase.
9. Define exact environment-block construction for `CreateProcessW`: sorted or
   semantically ordered variables, case-insensitive names, duplicate names,
   NUL termination, maximum size, expansion prohibition, empty values,
   inherited drive-current-directory variables, and redacted logging.
10. Design command-resolution proof that emulates the exact later launch
    behavior. Compare explicit absolute executable path, `lpApplicationName`,
    command-line parsing, `SearchPathW`, safe search mode, PATHEXT, current
    directory, application directory, system directories, and `PATH` entries.
    Recommend a construction that avoids ambiguous search entirely where
    possible.
11. Define drift validation at three boundaries: materialization, operation
    preregistration, and immediately before child creation. State which hashes
    and file identities must be rechecked, how to handle servicing changes, and
    why any material change invalidates the future operation rather than being
    silently absorbed.
12. Design bounded diagnostics. Errors must identify a stable public code,
    affected opaque member ID, expected/observed metadata hashes, stage, and
    safe remediation class without disclosing private paths or suggesting an
    automatic retry.
13. Provide Rust data types, error enums, trait sketches, and pseudocode for all
    major algorithms. Address Windows API string conversion, handle lifetime,
    integer overflow, memory bounds, cancellation, and deterministic iteration.
14. Define source-control tests for pure policy and parsers plus authorized
    Windows integration tests. Include golden canonical records, property tests,
    fuzz targets, synthetic Setup catalogs, temporary owned roots, reparse
    attacks, environment collisions, and real-toolchain observation that does
    not launch the project build.
15. Give a migration-free implementation sequence that deletes any superseded
    draft path once the new component is authoritative. Documentation, schemas,
    tests, and operational memory must change in the same commit; no stale
    alternate workflow may remain executable.
16. Define the exact acceptance evidence needed before a future composition
    preregistration can name the environment lock and private binding. Explain
    why the materializer's own success is not build, conversion, parity,
    browser, P2P, or release evidence.

Required report structure:

1. Executive architecture recommendation and assumptions.
2. Primary-source observation log with dates.
3. Threat model and trust boundaries.
4. Module and data-flow architecture.
5. Typed policy, input, output, and error model.
6. Discovery and deterministic-selection algorithms.
7. Path, handle, file-identity, and reparse defenses.
8. Public lock/private binding schemas.
9. Canonical serialization and hash rules.
10. Child environment and command-resolution proof.
11. Drift-validation lifecycle.
12. Rust types and implementation pseudocode.
13. Unit, property, fuzz, and Windows integration tests.
14. Objective acceptance criteria and prohibited claims.
15. Clean-cut implementation and deletion plan.
16. Unknowns requiring local verification.
17. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend hard-coding one developer's absolute path, invoking `vcvarsall`
as an unexplained magic step, accepting mocks as production evidence, inheriting
the parent environment, trying a build to see what is missing, adding a fallback
toolchain, retaining the failed workflow as a compatibility path, or changing
the preserved failed operation.

## Prompt 5: Hostile Verification And Fuzzing Of Windows Toolchain Environment Locks

You are an independent principal test architect, Windows adversarial-filesystem
specialist, and Rust fuzzing engineer. Produce an exceptionally detailed
verification strategy capable of falsifying a source-controlled MSVC/Windows
SDK environment materializer before it is allowed to authorize a one-shot real
model-converter build. Target 8,000 to 15,000 words excluding the bibliography.

You may browse Microsoft filesystem and process documentation, Visual Studio
Setup documentation, PE/COFF specifications, Rust testing and fuzzing
documentation, property-testing frameworks, security research, and public
source repositories. You have no access to TinyRustLM source code, local
toolchains, test fixtures, private paths, model files, build results, receipts,
credentials, or production systems. Do not claim local testing.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is prelaunch and permits a clean rewrite. No legacy support,
  compatibility alias, fallback, automatic retry, best-of-N, hidden repair, or
  known debt may remain.
- A prior preregistered build operation permanently failed because its child
  environment did not resolve the MSVC linker. Its evidence and partial root
  are immutable history and cannot be reused or cleaned.
- The next gate is a new source-controlled component that selects one x64 MSVC
  toolset and one compatible Windows SDK, binds exact tool and library
  identities, emits a canonical public lock plus private path binding,
  constructs a minimized ordered child environment, and proves exact command
  resolution without running the project build.
- A future one-shot operation may be preregistered only after this component's
  behavior is covered by general tests. The tests must prevent a local fixture,
  synthetic catalog, or mocked Setup API from satisfying the real-machine gate.
- The implementation must reject reparse points, path ambiguity, wrong
  architecture, drift, missing members, environment shadowing, undeclared
  roots, and any destination on an operator-declared read-only drive.
- Public failures may disclose stable codes, hashes, versions, counts, and
  stages, but not private paths, usernames, machine IDs, credentials, or raw
  environment data.
- The report must test general rules, not encode the exact text of the prior
  failure or make one known machine the only passing fixture.

Research primary sources and address all of the following in depth:

1. Build a test taxonomy separating pure deterministic unit tests, parser
   tests, canonicalization tests, property tests, state-machine tests, fuzzing,
   Windows temporary-filesystem integration, synthetic Setup-catalog tests,
   authorized installed-toolchain observation, and one-shot build evidence.
   State which layer can prove what.
2. Define a generative model for Visual Studio instances, packages, toolsets,
   SDKs, executable members, library roots, path ancestry, versions,
   architectures, and installer states. Include constraints that produce both
   valid and subtly inconsistent catalogs.
3. Specify metamorphic properties: input enumeration order must not alter a
   deterministic verdict; equivalent path spellings must normalize identically
   when truly equivalent; changing ordered search precedence must alter the
   environment identity; changing any bound byte must invalidate the lock;
   adding an undeclared valid installation must trigger the declared ambiguity
   or selection policy.
4. Design a fake filesystem abstraction for fast tests while preserving
   production Windows semantics. Identify behaviors that must not be mocked,
   such as actual reparse resolution, handle-based final paths, file IDs,
   case-insensitive collisions, and process environment behavior.
5. Enumerate path attacks: junction at root or ancestor, symlink leaf, mount
   point, hard-linked executable, alternate data stream, 8.3 alias, UNC alias,
   extended-length alias, case collision, trailing dot/space, reserved device
   name, non-ASCII normalization pair, environment variable expansion, quoted
   path entry, empty `PATH` member, current-directory shadow, and parent swap.
6. Enumerate executable attacks: wrong PE machine, truncated PE, oversized
   offsets, malformed section table, same version but different bytes, valid
   signature on wrong product, expired or unverifiable signature, fake
   `link.exe`, file mutation after hash, replacement through hard link, and
   executable inaccessible only at launch.
7. Enumerate SDK/library attacks: wrong-architecture COFF member, duplicate
   library filename in earlier root, truncated archive, enormous member count,
   inconsistent SDK include/lib versions, partial uninstall, stale registry,
   missing UCRT, preview SDK only, mixed ARM64/x64 members, response-file
   override, and undeclared `/LIBPATH`.
8. Enumerate environment attacks: duplicate variable names with different case,
   inherited `RUSTFLAGS`, inherited linker override, parent `LIB` contamination,
   `TMP` on prohibited drive, oversized environment block, NUL injection,
   invalid UTF-16, locale variance, code-page variance, `ComSpec` shadowing,
   PATHEXT manipulation, and drive-current-directory variables.
9. Define state-machine and persistence tests for discovery, selection,
   materialization, registration binding, drift, prelaunch revalidation,
   rejection, and permanent closure. Exercise crash or cancellation at every
   write boundary and verify create-only records are never overwritten.
10. Design property-test generators and shrinkers that preserve semantic
    relationships. Include bounded sizes and termination guarantees so a
    malicious catalog or binary cannot exhaust memory, descriptors, recursion,
    or test time.
11. Define fuzz targets for Setup metadata parsing, version parsing, canonical
    JSON, path normalization, PE headers, COFF archives, environment blocks,
    Cargo JSON events, and public/private binding resolution. State seed corpus,
    dictionaries, invariants, maximum input, timeout, and crash triage.
12. Specify differential oracles where appropriate. Compare project path
    normalization against documented Windows APIs, PE parsing against a second
    independent parser, version ordering against Windows semantics, and command
    resolution against a deliberately isolated child probe that never launches
    the project build.
13. Design real-Windows test matrices for no Visual Studio, Build Tools only,
    Community/Professional/Enterprise, one and multiple toolsets, one and
    multiple SDKs, x86-host-only components, ARM64 host, long path, non-ASCII
    installation path, restricted user, antivirus lock, and concurrent
    servicing. Distinguish CI feasibility from authorized hardware evidence.
14. Define negative-evidence requirements. A rejection test passes only when
    it produces the exact typed reason, creates no build/output root, launches
    no Cargo/rustc/linker process, writes nowhere prohibited, preserves prior
    evidence, and exposes no private path.
15. Define coverage and mutation-testing goals tied to security properties,
    not a vanity percentage. Identify high-risk conditions whose surviving
    mutants block preregistration.
16. Provide a TDD sequence for the actual correction: preserve the raw failure,
    write a general failing test, implement the smallest clean general rule,
    add positive and counterexample tests, fuzz parsers, run widened suites,
    update schemas/docs/UAI, commit/push/fresh-verify, and only then authorize a
    new registration.

Required report structure:

1. Executive verification recommendation.
2. Primary-source observation log with dates.
3. Test-layer authority and evidence matrix.
4. Generative catalog and filesystem model.
5. Metamorphic and property-test specification.
6. Path, binary, SDK, and environment attack matrices.
7. State-machine and crash-persistence tests.
8. Fuzz targets, bounds, corpora, and triage.
9. Differential-oracle design and trust limits.
10. Real-Windows configuration matrix.
11. Negative-evidence and no-side-effect assertions.
12. Coverage and mutation-test gates.
13. TDD implementation sequence.
14. Objective preregistration acceptance checklist.
15. Unknowns requiring local or authorized machines.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend a single happy-path machine test, mocks as real-toolchain
proof, snapshotting private paths into source control, fuzzing without bounds,
tests that launch the real conversion, deleting prior evidence during cleanup,
or weakening a rejection to make one installation pass.

## Prompt 6: Reproducible Offline Rust Builds And Supply-Chain Provenance On Windows

You are an independent reproducible-builds engineer, Rust supply-chain
specialist, and Windows release-security architect. Produce an exceptionally
detailed report specifying how to make a one-shot Windows release build of a
Rust model converter as deterministic, offline, provenance-bound, and
independently auditable as practical, while accurately distinguishing bitwise
reproducibility from weaker environmental repeatability. Target 8,000 to 15,000
words excluding the bibliography.

You may browse official Cargo, rustc, rustup, Microsoft linker, PE/COFF,
SourceLink, SPDX, CycloneDX, SLSA, Sigstore, in-toto, reproducible-builds, and
Windows signing documentation, plus public package registries and immutable
source repositories. You have no access to TinyRustLM source, dependency graph,
`Cargo.lock`, local caches, toolchain installations, private models, generated
artifacts, logs, receipts, credentials, signing keys, CI, or production
systems. Do not request private material or claim local reproducibility.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is one prelaunch product. There is no compatibility or migration
  burden. The clean implementation may delete superseded draft paths and must
  not add fallback builds, automatic retries, best-of-N, hidden repair, or
  deferred code debt.
- The first real composition uses `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`; private source bytes and all
  generated model evidence stay outside Git.
- A preregistered Cargo build ran exactly once and permanently failed because
  the registered child environment could not locate `link.exe`. Its request,
  logs, receipts, and partial target root remain immutable and cannot be
  retried or reused.
- The next source change will create a general x64 MSVC and Windows SDK
  environment lock/materializer. A new build may be registered only after that
  correction is tested, committed, pushed, and remotely verified.
- The build must use one exact source commit/tree, exact Cargo/rustc binaries,
  exact dependency lock, one owned absent build root, bounded logs, direct
  process custody, and zero retries. A changed dependency, tool, environment,
  build recipe, or source requires a distinct registration.
- Private build paths and machine information must not appear in Git or public
  reports. Public evidence may include hashes, versions, counts, public package
  IDs, statuses, timestamps, and bounded error codes.
- A successful converter build is only build evidence. It does not prove the
  six-artifact model composition, numerical parity, browser execution, model
  quality, P2P availability, or publication.

Research primary sources and address all of the following in depth:

1. Define reproducibility levels: source identity, dependency reproducibility,
   toolchain reproducibility, environment reproducibility, semantic artifact
   equivalence, normalized PE equivalence, and bit-for-bit identity. State the
   evidence and claim language for each.
2. Inventory all Cargo dependency inputs: registry index state, crate archives,
   checksums, git dependencies, submodules, path dependencies, source
   replacement, sparse versus git index, build dependencies, proc macros,
   target-specific dependencies, and optional features. Design a complete
   content lock beyond merely saying `--locked`.
3. Specify offline acquisition and cache custody. Cover `cargo fetch`, vendor
   directories, registry caches, immutable archive hashes, checksum validation,
   network denial during build, certificate and proxy independence, licenses,
   yanked packages, and proving no undeclared bytes entered the graph.
4. Bind the Rust toolchain: rustc, Cargo, standard library, target libraries,
   LLVM components, rustup manifests, profile, host triple, target triple, and
   toolchain channel/revision. Explain what a binary hash proves and what it
   omits.
5. Bind native build tools and inputs: MSVC toolset, Windows SDK, linker,
   resource/manifest tools, native libraries, response files, environment,
   and any build-script-spawned executable. Require explicit rejection of
   undeclared tools.
6. Analyze known PE nondeterminism and normalization hazards: COFF timestamps,
   PDB GUIDs and paths, `/Brepro`, incremental linking, section ordering,
   absolute source paths, environment strings, debug information, manifests,
   signatures, resource timestamps, randomized temp names, and parallelism.
7. Analyze Rust-specific nondeterminism: metadata hashes, codegen units,
   incremental compilation, LLVM version and flags, remap-path-prefix,
   build-script timestamps, filesystem enumeration, locale, hash-map iteration,
   proc macro behavior, and generated code.
8. Recommend a release profile and build command policy for a converter that
   prioritizes correctness and evidence over minimum build time. Cover LTO,
   codegen units, panic strategy, debug symbols, strip policy, overflow checks,
   incremental off, deterministic path remapping, features, and target CPU.
9. Define a two-build reproducibility experiment that never mutates the
   one-shot registered output. Use separately preregistered roots or an earlier
   non-model toolchain-validation phase, compare byte hashes and normalized
   structures, and avoid choosing the preferred artifact after results.
10. Design independent artifact inspection: PE headers, sections, imports,
    relocations, resources, manifests, debug directory, PDB identity,
    Authenticode, executable hash, symbol package, and runtime dependency
    closure. Include bounded parsers and a second implementation.
11. Define SBOM and provenance documents that bind source commit/tree,
    dependency closure, toolchain/environment lock, exact command, artifact,
    build-custody evidence, and verifier. Compare SPDX, CycloneDX, SLSA, and
    in-toto roles without turning one framework into unsupported proof.
12. Address signing order. Explain how code signing changes executable bytes,
    how to bind unsigned and signed identities, timestamp authority trust,
    offline constraints, key custody, revocation, and why signing is not a
    substitute for reproducibility or quality.
13. Design failure and drift handling for cache mismatch, missing crate,
    changed registry metadata, tool servicing, SDK drift, nondeterministic
    build script, absolute-path leak, PDB path leak, unexpected network,
    artifact mismatch, and signing failure. No failure may silently trigger a
    fallback or overwrite evidence.
14. Provide canonical provenance schemas, hash-domain rules, and pseudocode for
    dependency closure, offline preflight, environment binding, build launch,
    artifact inspection, reproducibility comparison, SBOM creation, and
    public-safe redaction.
15. Define practical acceptance gates for the immediate first converter and a
    later enterprise release. Explicitly state which ideal properties can be
    deferred only as visible blockers, not hidden debt, and which are mandatory
    before any real model operation.

Required report structure:

1. Executive recommendation and reproducibility claim taxonomy.
2. Primary-source observation log with dates.
3. Complete Rust dependency and toolchain input graph.
4. Offline acquisition and cache-custody design.
5. MSVC/SDK/native-tool provenance closure.
6. PE and Rust nondeterminism analysis.
7. Recommended deterministic release profile.
8. Independent artifact inspection design.
9. Reproducibility experiment and comparison algorithm.
10. SBOM, provenance, and signing schemas.
11. Failure, drift, and no-fallback policy.
12. Implementation pseudocode and module boundaries.
13. Objective immediate and release acceptance gates.
14. Prioritized implementation sequence.
15. Unknowns requiring local builds.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not equate `Cargo.lock` or `--locked` with a hermetic build, recommend a
network-enabled fallback, reuse the preserved failed target directory, hide
nondeterminism by choosing one of several outputs, strip evidence merely to
obtain matching hashes, expose private paths, or claim that an SBOM or signature
proves model correctness.

## Prompt 7: One Declared Windows Linker Policy: MSVC Link, LLD-Link, Or Rust LLD

You are an independent compiler-backend architect, Windows ABI expert, and Rust
portability engineer. Produce an exceptionally detailed decision report
comparing Microsoft `link.exe`, LLVM `lld-link`, and Rust-distributed linker
options for building a production x64 MSVC-targeted Rust model converter, then
recommend one declared policy with no runtime fallback or trial-and-selection
behavior. Target 8,000 to 15,000 words excluding the bibliography.

You may browse primary Microsoft linker and PE/COFF documentation, LLVM LLD
documentation and immutable source, official Rust/rustc target and linker
documentation, license texts, release notes, conformance tests, and relevant
public issue trackers. You have no access to TinyRustLM source code,
dependencies, build scripts, local toolchains, private paths, generated models,
test output, receipts, credentials, CI, or deployment systems. Do not claim
that any option works in the private project.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is a single prelaunch product with no legacy-support obligation.
  It may select the best clean architecture now, but may not keep old and new
  linker paths, automatic fallback, compatibility shims, retry-until-success,
  best-of-N output choice, or known code debt.
- The project currently targets `x86_64-pc-windows-msvc` for an exact Rust
  release executable named `tinyrustlm-convert`.
- A preregistered one-shot build permanently failed because its registered
  child environment could not resolve Microsoft's `link.exe`. The operation is
  immutable history and cannot be retried or repaired.
- An installed x64 MSVC linker appears available outside that old environment.
  A general source-controlled toolchain and SDK materializer is required before
  a new operation, regardless of which linker policy is selected.
- The future policy must bind exact linker bytes, version, license disposition,
  target architecture, response-file grammar, SDK and library closure, command
  construction, and independent artifact inspection. It cannot probe several
  linkers on the real build and retain the preferred result.
- Model source and generated outputs remain outside Git. Public evidence cannot
  reveal private machine paths or identities.
- A successful build is not conversion, model parity, browser, quality, P2P,
  or release proof.

Research primary sources and address all of the following in depth:

1. Precisely distinguish `link.exe`, standalone `lld-link`, LLVM's COFF linker
   implementation, `rust-lld`, rustc self-contained linker modes, linker-flavor
   selection, and GNU-style `ld.lld`. Explain packaging and invocation
   differences across current stable Rust and LLVM distributions.
2. Compare PE/COFF feature coverage relevant to Rust executables: sections,
   relocations, import libraries, delay imports, COMDAT, weak externals,
   exception/unwind metadata, TLS, security cookie, Control Flow Guard, CET,
   SafeSEH where applicable, ASLR, DEP, high entropy VA, resources, manifests,
   PDB/CodeView, incremental linking, LTCG/LTO, exports, and subsystem flags.
3. Analyze rustc compatibility and official support status for each option.
   Include target defaults, response-file encoding, command-line quoting,
   library name translation, CRT linkage, raw-dylib behavior, sanitizer or
   profiler implications, and version coupling to LLVM code generation.
4. Analyze native dependency compatibility. Cover MSVC-produced `.lib` files,
   Windows SDK import libraries, static C/C++ libraries, Rust build scripts,
   CMake/cc output, `/FAILIFMISMATCH`, linker directives embedded in objects,
   LTO bitcode, and libraries that rely on Microsoft-specific behavior.
5. Compare diagnostics and machine-readable observability: exit codes, stdout
   versus stderr, response files, map files, reproducer archives, verbose
   modes, version output, fatal warning support, and stable error
   classification. Explain how diagnostics affect evidence, not just usability.
6. Compare deterministic-build controls: timestamp behavior, `/Brepro`, build
   IDs, PDB generation, path embedding, section ordering, parallelism,
   incremental behavior, and known sources of cross-linker byte differences.
7. Compare security posture and servicing: signed Microsoft tool, LLVM release
   provenance, Rust toolchain coupling, CVE response, update cadence, attack
   surface, response-file parsing, path handling, and supply-chain lock size.
8. Analyze licensing and redistribution. Separate use of an installed Visual
   Studio Build Tools linker from redistributing it, standalone LLVM license
   terms, Rust component distribution, Windows SDK redistribution boundaries,
   and what must be verified by counsel or official licensing text.
9. Define the complete environment needed by each choice. Explain why using
   LLD may reduce linker-binary discovery but does not eliminate Windows SDK,
   UCRT, MSVC runtime libraries, architecture validation, or native dependency
   closure.
10. Establish a decision rubric weighted for correctness, current official
    support, deterministic identity, install burden, auditability, native
    compatibility, diagnostics, security, licensing, and long-term maintenance
    in a clean-slate prelaunch project.
11. Design public, non-project-specific conformance experiments for the chosen
    linker. Include a matrix of pure Rust, proc macros, build scripts, C static
    library, resource/manifest, unwind/panic, TLS, atomics, networking, PDB,
    LTO, and representative PE security flags. Do not use the real model build
    as a bake-off.
12. Define a one-policy implementation contract: exact binary identity,
    explicit rustc/Cargo linker configuration, exact SDK/library closure,
    response-file custody, no fallback, drift invalidation, and error taxonomy.
13. If recommending a change from Microsoft `link.exe`, identify every source,
    test, schema, document, and operational assumption that should be replaced
    atomically. Since there is no public legacy, do not propose dual-path
    migration or deprecation windows.
14. Define artifact-equivalence and independent inspection needed to establish
    that the chosen linker emits a valid x64 PE. Explain why matching execution
    on one machine is weaker than semantic conformance and why byte differences
    alone do not prove incorrectness.
15. State a decisive recommendation, explicit disqualifiers, and the evidence
    still requiring local dependency-graph audit and authorized Windows tests.

Required report structure:

1. Executive decision and assumptions.
2. Primary-source observation log with versions, revisions, and dates.
3. Linker identity and distribution matrix.
4. PE/COFF feature and security comparison.
5. Rust/rustc and native-dependency compatibility.
6. Diagnostics, observability, and evidence custody.
7. Determinism and reproducibility comparison.
8. Security, servicing, and licensing analysis.
9. Complete environment closure by option.
10. Weighted decision rubric and recommendation.
11. Public conformance experiment matrix.
12. One-policy implementation and clean-cut replacement plan.
13. Objective acceptance checklist and prohibited claims.
14. Unknowns requiring local verification.
15. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend trying all linkers on the private build, choosing whichever
produces an executable, retaining a fallback linker, claiming LLD eliminates
the Windows SDK, treating equivalent command-line spelling as equivalent
semantics, or presenting popularity as compatibility evidence.

## Prompt 8: Output-Free Preregistration Of A Wholly New Composition Operation

You are an independent evidence-systems architect, irreversible-workflow
designer, and release-control engineer. Produce an exceptionally detailed
report specifying how to preregister a wholly new Qwen3 composition operation
after a preserved terminal build-environment failure, without reusing any
prior identity and without creating output before the registration is committed
and remotely verified. Target 8,000 to 15,000 words excluding the bibliography.

You may browse standards and primary documentation for cryptographic hashing,
canonical JSON, Git object identity, append-only evidence, state machines,
Windows filesystem semantics, process creation, Cargo structured messages,
and software provenance. You have no access to TinyRustLM source code, private
directories, models, output roots, logs, receipts, credentials, signing keys,
or deployment systems. Do not request private artifacts and do not claim that
any new operation has been registered or executed.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is one prelaunch product. There is no product V2 and no permission
  for legacy support, migration, compatibility aliases, fallback, automatic
  retries, best-of-N, response repair, or known debt. Technical suffixes such
  as `/6` and `/7` are distinct attempt identities only.
- The model source is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. The reviewed direct-file closure
  contains exactly nine regular files totaling 1,519,207,688 bytes; the model
  tensor member is 1,503,300,328 bytes. Large bytes stay outside Git.
- An accepted Tokenizer2 source/native/two-independent-Chromium verification
  checkpoint is an immutable dependency and must not be rerun merely for
  convenience.
- Six earlier composition identities are terminal history. The sixth was
  preregistered, committed, pushed, freshly verified, and then invoked once.
  Its Rust build child exited 101 because the exact registered environment did
  not resolve the MSVC linker. Its request, raw evidence, logs, and partial
  root remain preserved. Managed build, converter controller, composition
  output, and browser verification never ran.
- `/6` may never be retried, adopted, cleaned, repaired, overwritten, or
  reused. Any next operation must use all-new names, roots, request IDs,
  timestamps/nonces, and evidence identities whose absence is proved before
  public registration and again after fresh remote verification.
- Before a new registration, a general source-controlled x64 MSVC/Windows SDK
  environment materializer and hostile tests must be committed, pushed, and
  freshly verified. Its exact public lock and private binding identities become
  immutable registration inputs.
- The exact future sequence is Rust build custody, managed build custody,
  converter/controller execution, six-member composition output, and private
  independent verification. A failure in an earlier stage permanently prevents
  all later stages for that identity.
- Public evidence must omit private absolute paths, usernames, machine IDs,
  credentials, model content, prompts, raw logs, and environment secrets.
- Campaign counters remain zero until their live criteria are actually met.
  MemoryEndpoints is unauthorized and outside this task.

Research primary sources and address all of the following in depth:

1. Define identities for source commit/tree, public source locks, private source
   closure, Tokenizer2 checkpoint, toolchain lock, private environment binding,
   build recipe, Rust custody request/root, managed custody request/root,
   controller request/root, composition root, verification root, and final
   public result. Explain domain separation and anti-circular construction.
2. Design a two-phase public/private registration if exact private paths cannot
   appear in Git. State which public fields are immutable, which private path
   mappings are cryptographically bound, when each record is created, and how
   neither can be substituted after push.
3. Specify new-name derivation. Compare sequential suffix, commit prefix, source
   prefix, nonce, timestamp, and random UUID. Require collision checks and
   explain why a predictable suffix is acceptable only when combined with
   create-only absence evidence.
4. Define absence proof for every future request, custody root, build root,
   controller evidence root, and composition root. Cover case-insensitive path
   equality, aliases, reparse ancestry, hard-link limitations, parent ownership,
   read-only prohibited drives, and time-of-check to time-of-use.
5. Bind source-control state. Require exact parent commit/tree, exact changed
   registration paths, clean worktree, no source edits after registration,
   branch identity, remote ref, fresh fetch, `FETCH_HEAD`, tracking ref, direct
   remote readback, and commit signature policy if used.
6. Define the exact no-output precondition. Clarify which public docs/tests are
   allowed before commit, which private request may be materialized only after
   remote proof, and which root creation or tool launch would irreversibly
   invalidate registration.
7. Design stage dependencies and fail-closed transitions. Rust custody must
   terminal-pass before managed custody request creation; both builds and
   executable captures must pass before controller request creation; controller
   terminal pass must precede independent composition verification.
8. Specify command and environment binding. Include executable identities,
   argument vector, current directory, ordered environment digest, timeout,
   stdout/stderr limits, process-tree custody, target architecture, output
   identities, zero retry, and terminal evidence semantics.
9. Define preregistration tests that prove canonical JSON, strict schema,
   immutable dependency hashes, source closure, exact parent state, absent
   outputs, no private disclosure, no prohibited drive, no mutable `latest`
   pointer, and no hidden retry path.
10. Define execution authorization after remote verification. Require fresh
    fetch, equality of local/tracking/FETCH_HEAD/direct remote hashes, exact
    changed paths, clean worktree, revalidation of all public and private inputs,
    and continued absence of all future roots.
11. Model terminal outcomes: prelaunch rejection, child-started nonzero,
    timeout, output overflow, custody ambiguity, terminal build pass, managed
    inspection rejection, controller rejection, composition structural pass,
    and independent verification rejection. None may be overwritten.
12. Specify preservation and non-adoption rules for partial roots. Explain why
    deletion-and-rerun, copying successful members, editing a request, changing
    PATH after registration, or continuing later stages after an earlier
    failure invalidates one-shot evidence.
13. Provide canonical public preregistration, private binding, custody request,
    terminal result, and closure-report schema sketches with bounded fields and
    public-safe redaction.
14. Give pseudocode for registration validation, Git remote proof, private
    create-only request materialization, prelaunch revalidation, stage
    authorization, terminal reconciliation, and public closure.
15. Provide a fault matrix for remote ref movement, source drift, toolchain
    servicing, environment-lock drift, absent-root collision, request collision,
    disk full, access denial, crash before child creation, child nonzero,
    controller crash, partial output, terminal collision, and public report
    redaction failure.
16. Define the narrow claim supported at each state and why structural
    composition still does not prove framework parity, native inference,
    browser inference, quality, P2P, publication, or campaign progress.

Required report structure:

1. Executive control recommendation and assumptions.
2. Identity and receipt graph.
3. Public registration/private binding split.
4. New-name and absence-proof algorithm.
5. Git commit, push, and fresh-readback gate.
6. No-output preregistration state machine.
7. Ordered stage authorization and terminal closure.
8. Canonical schema family and redaction contract.
9. Registration and execution pseudocode.
10. Adversarial tests and fault-injection matrix.
11. Objective claim taxonomy and acceptance checklist.
12. Prioritized implementation sequence.
13. Unknowns requiring local execution.
14. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend retrying `/6`, reusing any prior root or request name, deleting
partial evidence, changing the environment after registration, registering
after output exists, allowing later stages after an earlier failure, mutable
latest-result files, private paths in Git, or campaign credit from structural
tests.

## Prompt 9: Windows Job-Object Custody For Cargo, Rustc, Linker, And Converter Trees

You are an independent Windows process-lifecycle engineer, Rust asynchronous-I/O
specialist, and forensic logging architect. Produce an exceptionally detailed
report defining reliable child-process custody for nested Cargo, rustc, linker,
managed-build, and converter/controller process trees, including exact start,
termination, output, timeout, crash, and ambiguous-state evidence. Target 8,000
to 15,000 words excluding the bibliography.

You may browse primary Windows Job Object, process, handle, console,
`CreateProcessW`, I/O completion port, pipe, wait, termination, error code,
crash dump, ETW, and filesystem documentation, plus official Rust standard
library and Tokio documentation and immutable public source where needed. You
have no access to TinyRustLM source code, process controller, local machine,
private paths, model artifacts, logs, receipts, credentials, or deployment
systems. Do not claim private process behavior.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is prelaunch with no legacy support, compatibility shims,
  automatic retries, fallback execution, best-of-N, hidden repair, or accepted
  debt.
- A source-controlled build-custody owner launches an exact command directly,
  records binding and start evidence, captures stdout/stderr separately, and
  writes create-only process and final terminal records.
- One preregistered Rust custody operation started Cargo exactly once and
  received child exit code 101 because the registered environment could not
  find the MSVC linker. Zero stdout bytes and bounded stderr were preserved.
  The operation is terminal and cannot be retried, repaired, deleted, or
  adopted. No related child remained running afterward.
- Before a new operation, the project will implement a source-controlled exact
  x64 MSVC/Windows SDK environment materializer. The custody design must launch
  the exact preregistered executable, arguments, working directory, and child
  environment without a shell.
- Later stages may include Cargo spawning rustc and `link.exe`, `dotnet build`
  spawning compiler and build processes, and a controller spawning a captured
  converter plus an independent managed inspector. A dead descendant must not
  be hidden by a live parent, and a leaked descendant must prevent a clean
  terminal pass.
- Raw private logs remain outside Git. Public evidence exposes only bounded
  counts, hashes, timestamps, statuses, exit/error codes, and redacted member
  identities.
- A timeout or controller crash cannot silently become a rerun. Ambiguity must
  be preserved and a wholly new attempt explicitly registered later.

Research primary sources and address all of the following in depth:

1. Define the trust and process model for controller, direct child, descendants,
   helper processes, detached processes, breakaway, console processes,
   inherited handles, services, and processes created before job assignment.
2. Specify safe creation using `CreateProcessW` suspended, explicit application
   name, correctly quoted command line, explicit Unicode environment block,
   restricted handle list, no shell, assignment to a new Job Object, evidence
   persistence, and only then resume. Analyze every failure boundary.
3. Define Job Object limits and flags: kill-on-close, breakaway prohibition,
   active process limits where appropriate, CPU/memory limits, completion port,
   process notifications, nested jobs, Windows version differences, and
   interaction with CI or parent jobs.
4. Explain how to detect all descendants and terminal quiescence. Cover job
   accounting, completion messages, process IDs and reuse, handle-based
   identity, active-process-zero notification, race after parent exit, and
   helpers that attempt to escape.
5. Design concurrent stdout/stderr capture with anonymous or named pipes.
   Prevent deadlock, pipe inheritance leaks, half-close confusion, invalid
   UTF-8 assumptions, unbounded memory, output truncation ambiguity, and loss
   during controller crash. Include incremental hash and byte-count custody.
6. Specify output limits. Distinguish retained raw bytes, bounded in-memory
   buffers, streaming file writes, prefix/suffix diagnostic views, overflow
   status, and policy when a child exceeds its allowance. Redaction must never
   rewrite the raw private evidence.
7. Define time using wall and monotonic clocks. Address process creation time,
   start evidence, timeout deadline, clock rollback, sleep/resume, debugging,
   slow antivirus, and graceful-drain interval before forced termination.
8. Specify cancellation and timeout semantics. Compare console control events,
   `GenerateConsoleCtrlEvent`, window messages, cooperative protocol, process
   termination, job termination, and kill-on-close. State which are reliable for
   non-console toolchain children.
9. Design exit classification: process never created, process created but start
   evidence failed, exact child exit, Windows exception status, job limit,
   timeout, operator cancellation, output overflow, controller crash, capture
   error, descendant leak, terminal-record collision, and unknown ambiguity.
10. Define crash recovery. On controller restart, inspect create-only binding,
    start, process handles or durable identifiers, raw streams, job lifetime
    limitations, output roots, terminal records, and live processes. Explain
    which facts can be reconciled and when ambiguity is permanent.
11. Address child executable identity. Open and hash before launch, bind file ID,
    prevent replacement, use explicit application path, record PE metadata,
    inspect the actual process image after start, and rehash retained artifact
    after exit.
12. Design filesystem durability for binding, start, stream, process-terminal,
    and final-terminal records. Cover create-only writes, temporary same-directory
    files, flush, directory durability limitations on Windows, disk full,
    antivirus locks, and no overwrite.
13. Provide Rust FFI or Windows-crate pseudocode for handle setup, attribute
    lists, suspended creation, job assignment, pipe readers, completion-port
    monitor, timeout, termination, stream finalization, terminal classification,
    and RAII cleanup that does not erase evidence.
14. Develop hostile tests for child-before-job race, breakaway attempt, grandchild
    leak, inherited write pipe, pipe flood, invalid UTF-8, child hang, parent
    exit while descendant lives, controller kill, power loss, PID reuse,
    executable replacement, environment mismatch, access denied, disk full,
    job assignment failure, completion-port loss, and terminal collision.
15. Define the minimum evidence for `not-started`, `started-terminal-nonzero`,
    `started-terminal-zero`, `timed-out`, `ambiguous`, and `independently
    verified`. Explain why exact process custody still proves no model semantics.

Required report structure:

1. Executive custody recommendation and assumptions.
2. Primary-source observation log with dates.
3. Process, job, handle, and trust model.
4. Suspended-create and job-assignment algorithm.
5. Descendant tracking and quiescence proof.
6. Dual-stream bounded log custody.
7. Timeout, cancellation, and forced-termination policy.
8. Exit and ambiguity taxonomy.
9. Crash recovery and durable evidence state machine.
10. Executable identity and mutation defense.
11. Rust/Windows pseudocode and module boundaries.
12. Hostile tests and fault-injection matrix.
13. Public/private evidence and redaction schema.
14. Objective acceptance checklist and prohibited claims.
15. Unknowns requiring local execution.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend shell invocation, accepting the direct parent's exit while a
descendant remains, merging stdout and stderr, unbounded capture, silent log
truncation, automatic retry after ambiguity, process-name matching as identity,
or cleanup that deletes failed evidence.

## Prompt 10: Hermetic Managed Build Custody And Independent Composition Inspector

You are an independent .NET build-system architect, binary-format validation
engineer, and cross-language assurance specialist. Produce an exceptionally
detailed report specifying how to build and capture one managed composition
inspector under strict custody, then use it as an implementation-independent
oracle without sharing the Rust parser or accepting correlated defects. Target
8,000 to 15,000 words excluding the bibliography.

You may browse official .NET SDK, MSBuild, NuGet, deterministic-build,
runtime-identifier, single-file, trimming, NativeAOT, PE/COFF, cryptography,
JSON, and process documentation, plus public package registries and immutable
source repositories. You have no access to TinyRustLM source code, project
files, package lock, local SDKs, private model compositions, generated outputs,
logs, receipts, credentials, CI, signing keys, or deployment services. Do not
claim private build or inspection results.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is a clean-slate prelaunch product. It prohibits legacy readers,
  compatibility models, schema aliases, fallback inspectors, automatic retries,
  best-of-N selection, result repair, and known debt.
- The first real source is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- A successful future composition transaction is expected to emit exactly six
  canonical members: `model.slm2`, `tokenizer.tokenizer2`,
  `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and
  `composition.acg2`, plus bounded transaction evidence. Format suffixes are
  technical identities, not product versions.
- The Rust converter and native reader are one implementation family. The
  managed inspector is intended to parse the binary and graph contracts
  independently so shared code or FFI cannot make one defect look like
  agreement.
- A sixth preregistered operation terminated during Rust build because its
  registered environment could not resolve the MSVC linker. Managed build and
  inspection never ran. That operation is permanently closed and cannot be
  retried or reused.
- In a new operation, managed build custody may begin only after the new Rust
  build has terminal-passed and its executable identity is captured. Managed
  failure permanently prevents controller/composition execution for that
  identity.
- The managed build must use one exact `dotnet` executable and SDK, a locked
  dependency closure, a create-only target root, network denial, bounded logs,
  direct process custody, structured build evidence, and zero retries.
- Private paths and model content remain outside Git and public reports.
  MemoryEndpoints is unauthorized and outside this task.

Research primary sources and address all of the following in depth:

1. Compare framework-dependent, self-contained, single-file, trimmed,
   ReadyToRun, and NativeAOT inspector forms for evidence independence,
   deployment closure, determinism, build complexity, runtime dependencies,
   and x64 Windows execution. Recommend one immediate form and justify it.
2. Define exact .NET SDK identity: muxer bytes, hostfxr/runtime packs, SDK
   feature band, MSBuild, Roslyn, targeting packs, runtime packs, workload
   manifests, roll-forward policy, `global.json`, and environment. Explain how
   to prevent an installed newer SDK from being selected silently.
3. Define NuGet closure and offline restore: package lock, central package
   management if present, package source mapping, local cache, archive hashes,
   signatures, transitive dependencies, runtime-specific assets, vulnerability
   metadata boundaries, license records, and network denial during build.
4. Specify deterministic build settings: continuous integration flag,
   deterministic compilation, path mapping, SourceLink, repository URL/commit,
   portable PDB, embedded sources policy, timestamps, assembly version, file
   version, informational version, generated files, resource order, and locale.
5. Design managed build custody analogous to Rust custody. Include exact direct
   argument vector, environment scrub, working directory, owned absent output
   root, process tree/Job Object, bounded stdout/stderr, timeout, disk bounds,
   terminal status, and no reuse after a started failure.
6. Specify structured artifact discovery. Compare MSBuild binary log, file list,
   project assets file, output item queries, `dotnet publish` output, and
   filesystem inventory. Do not guess `bin/Release`; require exact expected
   target and uniqueness.
7. Define managed executable capture: regular-file checks, hashes, PE machine,
   CLR header, target framework, runtime config, deps graph, PDB, native assets,
   apphost, single-file bundle structure if selected, and final runtime closure.
8. Define independence requirements for the inspector. It must not call Rust
   through C ABI, reuse Rust source generated into C#, consume Rust verdicts,
   or share generated parser tables whose defect could be identical. Identify
   acceptable shared normative schemas and independently generated constants.
9. Design bounded parsers for each composition member. Cover magic/version,
   lengths, offsets, alignment, integer overflow, duplicate sections, unknown
   tags, UTF-8, JSON bounds, hash algorithms, tensor inventory, quantization
   metadata, tokenizer tables, chat template, sampling profile, prompt policy,
   graph references, terminal records, and trailing bytes.
10. Define semantic cross-member invariants: model/tokenizer vocabulary,
    special token identities, embedding/output tie policy, architecture fields,
    context limits, prompt/template compatibility, sampling references, source
    lock identity, member hashes and lengths, composition graph reachability,
    no cycles where prohibited, exact root count, and no unexpected members.
11. Specify differential test corpora created from public synthetic fixtures,
    not private model bytes. Include one-field corruptions, truncations,
    overflows, swapped hashes, duplicate IDs, unknown required tags, adversarial
    strings, graph cycles, architecture mismatch, quantization mismatch, and
    valid boundary values. Require Rust and managed verdict comparison while
    preserving implementation independence.
12. Define disagreement handling. If Rust accepts and managed rejects, or the
    reverse, preserve both raw verdicts, classify as blocked, add a general
    regression only after understanding the normative contract, and never
    change bytes or parser settings to manufacture agreement.
13. Give C# data types and pseudocode for bounded file mapping/streaming,
    little-endian reads, checked arithmetic, section indexing, hash streaming,
    graph resolution, diagnostic emission, and deterministic result
    serialization.
14. Design package-consumer and clean-machine tests for `win-x64`, and explain
    what additional `linux-x64` and `linux-arm64` inspection evidence would
    mean if the inspector is intended to be cross-platform. Do not count
    cross-compilation as execution.
15. Define exact stage evidence and narrow claims for managed-build-pass,
    inspector-artifact-captured, composition-inspected, cross-implementation
    agreement, and disagreement. Explain why inspection still does not prove
    source-framework numerical parity or browser behavior.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Primary-source observation log with dates.
3. Managed deployment-form decision matrix.
4. Exact SDK, NuGet, and offline-build closure.
5. Deterministic build and process-custody design.
6. Structured artifact discovery and identity capture.
7. Inspector independence threat model.
8. Six-member bounded parser specifications.
9. Cross-member invariant table.
10. Differential corpus and disagreement protocol.
11. C# pseudocode and module boundaries.
12. Cross-platform and package-consumer tests.
13. Evidence schemas, claims, and acceptance checklist.
14. Prioritized implementation sequence.
15. Unknowns requiring local execution.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend using the Rust parser through FFI, accepting matching booleans
without independent diagnostics, online restore fallback, SDK roll-forward,
guessing the build output path, rerunning a failed custody identity, repairing
composition bytes, or calling structural agreement numerical parity.

## Prompt 11: Six-Member Qwen3 Composition Transaction And First-Divergence Handoff

You are an independent principal model-format engineer, transactional-storage
designer, and numerical-parity test architect. Produce an exceptionally
detailed report defining the clean transaction from immutable Qwen3 source
through six canonical composition members, independent structural acceptance,
and a handoff into source-framework first-divergence analysis. Target 8,000 to
15,000 words excluding the bibliography.

You may browse the immutable public Qwen3 repository revision, official Qwen3
and Transformers source and model documentation, safetensors and tokenizer
documentation, quantization research, filesystem standards, cryptographic hash
standards, and public numerical-parity literature. You have no access to
TinyRustLM source code, private model bytes, converter, composition files,
receipts, logs, runtime output, evaluation cases, credentials, or production
systems. Do not request private data or claim conversion success.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM is one prelaunch browser-local AI product. No legacy format,
  compatibility reader, migration alias, fallback converter, automatic retry,
  best-of-N, output repair, or known code debt is allowed.
- The public source is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, reviewed under Apache-2.0. The
  direct-file closure is exactly nine regular files totaling 1,519,207,688
  bytes; `model.safetensors` is 1,503,300,328 bytes.
- Supplied architecture values are: `Qwen3ForCausalLM`, vocabulary 151,936,
  maximum context 40,960, hidden size 1,024, intermediate size 3,072, 28
  layers, 16 query heads, 8 KV heads, head dimension 128, tied embeddings, no
  QKV bias, Q/K normalization, RoPE theta represented by float bits
  `0x49742400`, and RMS normalization epsilon represented by float bits
  `0x358637bd`.
- The intended transaction emits exactly `model.slm2`,
  `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`,
  `prompt.prompt2`, and `composition.acg2`, plus bounded evidence. Technical
  suffix `2` identifies a clean-cut format, not a product V2.
- Tokenizer2 already has an accepted checkpoint against pinned source behavior,
  native Rust, and two independent clean Chromium runs over 2,048 cases and
  69,294 tokens with zero network. It is an immutable dependency, not permission
  to rerun or replace it casually.
- Six execution identities are terminal history. The sixth ended during Rust
  build because the registered environment could not locate the MSVC linker;
  no converter or composition output ran. It cannot be retried or reused.
- A future operation may run only after a general linker-complete Windows build
  environment correction is committed and preregistered under new identities.
- Structural success is not source-framework numerical parity, inference,
  browser chat, quality, P2P, publication, or campaign credit.

Research primary sources and address all of the following in depth:

1. Independently reconstruct the exact public Qwen3-0.6B architecture and
   tensor inventory at the pinned revision. Enumerate expected tensor families,
   names, shapes, data types, counts, byte formulas, tied embedding behavior,
   Q/K normalization, GQA relationships, and all config values material to
   inference.
2. Define strict source-lock validation before conversion: exact direct regular
   files, sizes, hashes, no symlinks/reparse points, no extras, safetensors
   header bounds, tensor ranges, non-overlap, dtype/shape/byte agreement,
   tokenizer closure, license and model-card identity.
3. Specify clean lowering into SLM2. Cover canonical tensor IDs and order,
   layout transforms, transpose policy, endianness, alignment, mixed-Q8 block
   geometry, scale representation, exceptional tensors, tied output treatment,
   metadata float bit preservation, per-tensor provenance, and rejection of
   unknown source tensors.
4. Define quantitative mixed-Q8 acceptance per tensor family: error norms,
   cosine similarity, max absolute/relative error, clipping/saturation,
   zero/constant/non-finite blocks, scale error, reconstruction sampling, and
   whole-tensor versus block-sampled proof. Use formulas, not invented results.
5. Define Tokenizer2 adoption from the accepted immutable checkpoint. Explain
   how the composition binds exact accepted bytes and receipt identities without
   recomputing, renaming, aliasing, or accepting a second tokenizer path.
6. Define Template2, Sampling2, and Prompt2 contracts from immutable public
   source behavior and declared product policy. Separate publisher-defined chat
   template facts from project decisions, and reject invention of missing
   instruction tuning behavior.
7. Specify ACG2 graph semantics: root identity, six member nodes, hashes,
   lengths, media types, schema IDs, source lock, converter identity, dependency
   edges, role uniqueness, reachability, acyclicity where required, unknown
   fields, and canonical serialization.
8. Design create-only transaction semantics. The composition root begins absent;
   staging is owned and bounded; every file is written, flushed, hashed, and
   independently parsed; terminal pass or rejection is written last; no partial
   root is promoted, repaired, or reused after a started failure.
9. Define Rust and managed independent verification. Both must inventory the
   exact root, inspect regular-file/reparse status, parse bounded formats,
   recompute hashes, resolve graph invariants, compare architecture and
   tokenizer contracts, and emit independent verdicts without shared parser
   code.
10. Design source-framework oracle capture at the same immutable revision.
    Bind framework/package revisions, tokenizer, chat template, dtype, device,
    kernels, seed, decode profile, prompt tokens, hidden-state tap points, and
    output logits. Prohibit remote custom code and moving dependencies.
11. Define first-divergence comparison between source framework, dequantized
    SLM2 scalar reference, optimized native Rust, and later WASM. Include token
    IDs, embeddings, Q/K norm, RoPE, attention scores/probabilities, GQA
    expansion, residual streams, MLP projections/activation, per-layer outputs,
    final normalization, logits, selected token, KV state, tolerances, and
    diagnostic localization.
12. Separate representation error from implementation error. Define expected
    quantization envelopes, float accumulation effects, deterministic versus
    sampled decoding, exact-token-prefix criteria, and when a mismatch blocks
    the model versus only an optimization.
13. Design hostile composition corruptions: missing/extra member, swapped hash,
    graph cycle, duplicate role, trailing bytes, offset overflow, overlapping
    section, wrong tensor shape, wrong head count, untied output substitution,
    tokenizer mismatch, float-bit change, quant block corruption, unknown
    required tag, terminal collision, and source-lock substitution.
14. Provide bounded schema sketches and pseudocode for source validation,
    lowering, quantization, atomic composition, independent inspection,
    framework capture, and first-divergence comparison.
15. Define objective claim gates for source-locked, structurally composed,
    independently inspected, scalar-parity-proven, native-parity-proven, and
    browser-parity-proven. State prohibited language at every earlier stage.

Required report structure:

1. Executive recommendation and assumptions.
2. Public Qwen3 immutable-source observation log.
3. Exact architecture and tensor-schema oracle.
4. Source closure and safetensors validation.
5. SLM2 lowering and mixed-Q8 contract.
6. Tokenizer2/Template2/Sampling2/Prompt2 binding.
7. ACG2 graph and six-member transaction schema.
8. Crash-safe create-only transaction algorithm.
9. Independent Rust/managed structural verification.
10. Pinned framework oracle and first-divergence laboratory.
11. Quantization versus implementation error policy.
12. Corruption and adversarial test matrix.
13. Objective claim taxonomy and acceptance checklist.
14. Prioritized implementation sequence.
15. Unknowns requiring private output and execution.
16. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not infer tensor correctness from total size, duplicate tied weights without
declaring it, accept unknown tensors, repair malformed output, rerun a failed
identity, compare only final prose, tune tolerances after seeing a preferred
result, or treat structural validity as numerical or conversational quality.

## Prompt 12: Corrected Build To Native, WASM, Browser Chat, P2P, And Honest Release

You are an independent principal systems integrator, browser-WASM performance
engineer, model-evaluation scientist, and enterprise release architect. Produce
an exceptionally detailed end-to-end plan for carrying one newly composed,
provenance-bound Qwen3 model from corrected Windows build custody through
independent inspection, numerical parity, native and browser execution,
untouched multi-turn chat, local/P2P acquisition, public documentation, and an
honest first prelaunch release. Target 10,000 to 18,000 words excluding the
bibliography.

You may browse current primary documentation for Rust, WASM, WebAssembly SIMD,
threads and memory limits, browser workers and storage, Playwright, service
workers, IndexedDB and OPFS, File System Access, HTTP/CORS, CSP, COOP/COEP,
Qwen3, Hugging Face, P2P protocols, accessibility, SBOM/provenance, and public
release systems. You have no access to TinyRustLM source code, websites'
private deployment configuration, model bytes, browser traces, evaluation
prompts, receipts, credentials, signing keys, peer endpoints, or production
services. Do not claim local or live success.

Project-supplied facts and constraints, to be labeled as unverified:

- TinyRustLM.com is a browser-local AI chat product. MiniModel.org is intended
  to provide catalog and direct P2P discovery for `.slm` artifacts; project
  websites must not proxy model bytes or receive user prompts.
- The project is prelaunch and has one current product, not product V1/V2.
  There is no legacy support obligation. Superseded draft paths should be
  deleted once the clean path is authoritative. No compatibility shims,
  fallback runtimes, server inference, script/text download workflow,
  automatic retries, best-of-N, response repair, or known code debt is allowed.
- The first public source is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. A base model is only a parity
  ancestor and may not be advertised as a qualified conversational assistant.
- A composition is expected to contain exactly six canonical artifacts:
  `model.slm2`, `tokenizer.tokenizer2`, `template.template2`,
  `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`.
- Tokenizer2 already has a source/native/two-independent-Chromium verification
  checkpoint over 2,048 cases and 69,294 tokens with zero network, deleted
  profiles, worker recovery, and bounded resources. This does not prove model
  inference.
- Six composition execution identities are immutable terminal history. The
  sixth started one Rust build and failed because the registered child
  environment could not resolve the MSVC linker. No managed build, converter,
  composition, numerical parity, browser model inference, or release followed.
- The next work must first implement and hostile-test a source-controlled exact
  x64 MSVC/Windows SDK environment materializer, commit/push/fresh-verify it,
  then preregister a wholly new one-shot operation with new absent roots. No
  previous operation may be retried or reused.
- Product behavior must use publisher-exact tokenizer/template semantics,
  preserve untouched raw model output, render each assistant response exactly
  once, and avoid hidden retries or output repair.
- A model action in the browser must do useful work: fetch and verify a
  qualified P2P artifact when available, otherwise initiate a consented local
  conversion through the companion. It must not download instruction text,
  PowerShell, JSON request files, or scripts as the primary user experience.
- MemoryEndpoints is unauthorized and disconnected. Live counters remain
  exactly 0/20 qualified models, 0/50 clean browser rounds, 0/25 live memory
  rounds, 0/40 externally proven P2P lanes, and 0/20 catalog announcements
  until objective live evidence exists.
- Documentation and marketing sites must remain rigorous, current, consistent,
  and truthfully versioned. Every production publish must update a visible
  release/change log with version, release date, last-published time, commit or
  artifact identity, verification scope, and remaining risks.

Research primary sources and address all of the following in depth:

1. Define the complete phase graph from linker-environment acceptance through
   new registration, Rust and managed builds, conversion, six-member inspection,
   source-framework scalar parity, optimized native parity, WASM parity,
   browser chat, P2P/local-conversion acquisition, qualification, publication,
   and public readback. Include retry-forbidden and new-identity transitions.
2. Define content-addressed receipts and invalidation edges for source,
   toolchain, environment, build, converter, composition, inspector, framework
   oracle, native runtime, WASM binary, web assets, browser build, evaluation,
   P2P proof, deployment, and documentation. A change reruns only dependent
   phases but never rewrites history.
3. Specify native inference acceptance for Qwen3: scalar oracle first, mixed-Q8
   dequantization, Q/K normalization, RoPE, GQA, causal attention, SwiGLU,
   RMSNorm, tied output, KV cache, deterministic sampling, stop conditions,
   context bounds, cancellation, and exact first-divergence diagnostics.
4. Define optimization gates from scalar to SIMD. Cover CPU feature detection,
   portable scalar fallback as the normative implementation rather than a
   legacy path, x86-64 SIMD variants, alignment, tails, thread count,
   determinism, numerical budgets, benchmark methodology, memory ownership,
   and dispatch tests.
5. Design the WASM runtime with one semantic implementation. Cover wasm32
   address limits, maximum and committed memory, large-model admission,
   streaming/zero-copy limits, worker isolation, transfer versus copy,
   `SharedArrayBuffer`, COOP/COEP, threads, SIMD, allocator behavior, cache
   growth, cancellation, worker crash/restart, and no server fallback.
6. Provide resource formulas for model bytes, mapped/loaded representation,
   quantization metadata, tokenizer, temporary conversion, activations,
   logits, KV cache by sequence/layers/KV heads/head dimension/precision,
   browser overhead, storage quota, hashing, P2P pieces, and safety reserve.
   Define fail-before-load admission and honest user-facing statuses.
7. Define real-browser parity tests across current Chromium, Firefox, and
   WebKit/Safari constraints where feasible. Require clean owned profiles,
   exact model/composition hashes, zero unexpected network, worker identity,
   deterministic tokens/logits at checkpoints, memory peaks, profile deletion,
   and no fixture satisfying a real-model gate.
8. Define publisher-exact chat behavior for a base versus instruction-tuned
   source. Cover chat template provenance, thinking controls if supported,
   special tokens, prompt ownership, multi-turn state, latest-user precedence,
   untrusted quoted memory, cancellation, end conditions, context truncation,
   and truthful product claims. Do not invent assistant quality.
9. Design exactly-once UI rendering. Use one authoritative generation event
   identity, state transitions, token sequencing, terminal event, React or DOM
   ownership principles, restart behavior, cancellation, stale worker messages,
   duplicate channel delivery, long output, scrolling, accessibility, and
   screenshot/network assertions.
10. Design the user acquisition action. First obtain signed catalog metadata,
    locate a quality-qualified exact composition hash, request direct P2P
    pieces from consented peers, verify each piece and final composition, and
    atomically import. If no qualified peer exists, obtain explicit consent and
    invoke a local companion conversion through a secure loopback contract.
11. Specify the loopback security boundary: origin allowlist, capability token
    not in URL, CSRF defense, CORS, host validation, TLS or channel-binding
    options, request size, exact source identity, filesystem authority,
    progress events, cancellation, idempotency, secret redaction, and no
    page-supplied executable script.
12. Define no-cheat quality qualification after parity. Include untouched raw
    outputs, fixed and seeded holdouts, unseen paraphrases, multi-turn
    continuity, ambiguity, practical constraints, source conflict, current-turn
    precedence, untrusted memory, structured output, code explanation,
    ordinary helpfulness regression budgets, stochastic statistics, model-based
    judge limits, blinded human review, and contamination controls.
13. Define P2P admission and public proof. A composition needs provenance and
    quality receipts, distinct bytes, exact piece manifest, two independently
    restartable process lanes, outside-network signed expiring proof, direct
    import verification, renewal, revocation, and truthful catalog lifecycle.
    Local or LAN health is not public reachability.
14. Define release gates for Rust, WASM, browser assets, C ABI, C#/.NET wrapper,
    NuGet, symbols, companion archives, SBOM, provenance, signing, secret
    scanning, archive traversal, malware scanning boundaries, cross-platform
    execution, public HTTPS readback, rollback, and publication authorization.
15. Specify documentation and marketing synchronization. Define one canonical
    release record projected consistently to each relevant site, version/date
    rules, last-published field, change categories, verification evidence,
    known blockers, no stale screenshots, link checking, schema/API docs,
    operator runbooks, model cards, accessibility, and automated drift tests.
16. Design progress reporting that can never infer completion from unit tests.
    Keep the five campaign counters at zero until live evidence exists; show
    current operation, terminal history, resumable state, blockers, elapsed
    time, last checkpoint, and next authorized action without exposing secrets.
17. Provide a failure-to-regression workflow for linker drift, converter
    rejection, parity divergence, WASM trap, browser duplicate response,
    profile deletion failure, unexpected network, P2P corruption, deployment
    mismatch, and stale documentation. Preserve raw failure, add a general test,
    make a clean scoped fix, invalidate only descendants, commit/push, and
    publish only when all applicable gates pass.
18. Give a prioritized implementation plan that reaches one honest usable model
    before scaling to 5 or 20. Identify external blockers explicitly and do not
    turn missing MemoryEndpoints authorization, external observers, signing
    credentials, or catalog capability into skips or mocks.

Required report structure:

1. Executive end-to-end recommendation and assumptions.
2. Current primary-source observation log with dates.
3. Phase state machine and content-addressed receipt graph.
4. Corrected build, composition, and inspection gates.
5. Native scalar, SIMD, and source-framework parity plan.
6. WASM architecture, browser limits, and resource formulas.
7. Cross-browser real-model verification protocol.
8. Publisher-exact chat and exactly-once UI contract.
9. P2P-first/local-conversion acquisition workflow.
10. Loopback companion security design.
11. No-cheat quality and contamination controls.
12. P2P admission, external proof, and catalog lifecycle.
13. Enterprise release and supply-chain gate matrix.
14. Documentation, marketing, version, and publish-log contract.
15. Progress dashboard and honest-claim vocabulary.
16. Failure-to-regression and selective invalidation workflow.
17. Prioritized route to 1, 5, and 20 useful models.
18. Unknowns requiring private, browser, hardware, or authorized live access.
19. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend a product V2, legacy or compatibility paths, server inference
fallback, downloading instructions or scripts as the model action, best-of-N,
output repair, using a fixture as real-model proof, calling structural
conversion quality, counting local reachability as public P2P proof, counting
cross-compilation as hardware execution, claiming deployment from a local
build, incrementing live counters from mocks, or allowing documentation to lag
behind a production publish.

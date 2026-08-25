# Twelve Disconnected Research Prompts: Build Custody, Fifth Qwen3 Attempt, And Browser Product Closure

Each section below is a complete standalone assignment. Send each whole prompt
to a different technical research agent. The agents do not share context and
cannot see the TinyRustLM source tree, private artifacts, source-control
history, test output, development machines, credentials, unpublished
evaluation cases, or any other report in this packet.

The requested reports are advisory research inputs, not implementation or
release evidence. Every report must use current primary sources wherever
possible, state source publication or update dates, state the report's
retrieval date, link directly to sources, and pin public repository findings to
immutable revisions. Every report must visibly distinguish:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that the researcher could not verify;
4. engineering analysis and recommendations;
5. assumptions, uncertainties, alternatives, and source disagreements; and
6. facts that require private source inspection, local execution, real
   hardware, browser testing, credentials, or authorized production access.

No researcher may claim to have inspected, built, run, tested, or validated
private TinyRustLM code or artifacts. Reports should be exceptionally detailed
and technical. They should contain algorithms, state machines, pseudocode,
schemas, equations, bounded resource models, threat models, failure matrices,
fault-injection cases, objective acceptance criteria, and prioritized
implementation sequences. Generic tutorials, marketing summaries, invented
measurements, and recommendations to retain hypothetical prelaunch
compatibility are not useful.

## Prompt 1: Source-Controlled Child-Process Build Custody On Windows

You are an independent principal operating-systems engineer, build-infrastructure
architect, and digital-evidence specialist. Produce a deeply technical design
for a source-controlled process-custody owner that launches exactly one
registered build, captures its authoritative termination status, preserves
bounded raw output, and emits an immutable terminal record even when ancillary
process metadata is missing. You have internet access but no access to any
TinyRustLM repository, private files, build machine, executable, prior logs, or
credentials. Do not imply that you inspected or validated private code.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local language-model product written
  primarily in Rust, with a .NET independent inspector and browser WebAssembly
  components. There is one product, not a product "V2." Names such as SLM2 or
  `/4` are technical format or evidence identities only.
- The project permits clean replacement before launch. It prohibits legacy
  readers, compatibility aliases, migration writers, automatic retries,
  response repair, best-of-N selection, and knowingly retained code debt.
- A real Qwen3 composition attempt identified as `/4` was preregistered and
  launched once. Its Rust Cargo process produced a final `Finished` line and a
  plausible x64 PE executable, but the operator wrapper attempted to read an
  unavailable process `ExitTime` before durably capturing `ExitCode`. The
  wrapper failed, leaving the child exit code unknown.
- The project correctly refuses to infer successful build completion from log
  text or executable presence. Attempt `/4` is terminal. Its existing roots
  must never be deleted, repaired, adopted, resumed, or reused. A later attempt
  requires a new registration and wholly new roots.
- The desired owner must support an offline, locked Rust release build and a
  deterministic .NET release build on Windows. It must be testable with fake
  child programs before it is trusted with another irreversible real build.
- Private roots, commands, hashes, model bytes, and raw logs must remain
  private. A bounded public result may expose only safe identities, hashes,
  sizes, states, counts, and typed error codes.

Research current authoritative documentation and implementation behavior for
Windows process handles and wait APIs, Rust `std::process::Command` and
`Child::wait_with_output`, Node.js `child_process`, .NET `System.Diagnostics.Process`,
job objects, anonymous pipes, filesystem durability, and relevant failure
semantics. Address all of the following in depth:

1. Define the smallest trustworthy custody boundary. Compare implementing it
   in Rust, Node.js, .NET, or a narrowly split design. Analyze which runtime can
   most directly own process creation, redirected handles, timeout control,
   process-tree termination, and durable receipt writing without introducing
   two competing authorities.
2. Specify a strict canonical request schema binding request identity, schema
   identity, source commit and tree, toolchain executable identity, exact
   argument vector, working directory identity, allowlisted environment,
   expected output root, control root, log limits, timeout, executable
   expectations, and terminal-record path. Unknown or duplicate fields must be
   fatal. Explain canonical byte encoding and request hashing.
3. Give an exact lifecycle algorithm from validating absent direct
   non-reparse roots through creating control state, opening separate stdout
   and stderr sinks, spawning the child once, draining both pipes without
   deadlock, waiting, capturing the authoritative exit status immediately,
   durably recording it, collecting optional metadata, inventorying outputs,
   and closing every handle. Include pseudocode and an ownership table.
4. Explain the distinction among process creation time, observer timestamps,
   wait completion, exit status, NTSTATUS, Win32 exit code, signal-like
   termination, and unavailable `ExitTime`. State which values are material
   evidence and which are optional diagnostics. Design the implementation so
   failure to read any optional field cannot erase or obscure an already
   captured exit status.
5. Design bounded binary-safe stdout and stderr capture. Address concurrent
   draining, pipe-buffer deadlock, invalid UTF-8, NUL bytes, enormous lines,
   truncation versus hard failure, total and per-stream limits, streaming
   hashing, file precreation, flush behavior, and how overflow terminates the
   process tree while preserving an unambiguous terminal result.
6. Specify timeout and cancellation behavior using Windows job objects or an
   equivalent owned process-tree mechanism. Address grandchildren, detached
   children, Ctrl-C, operator interruption, observer crash, kill-on-job-close,
   race conditions between natural exit and termination, and proving that no
   relevant process remains.
7. Design create-only crash-consistent terminal records. Compare same-directory
   temporary writes plus flush and atomic publication, hard-link publication,
   exclusive create, write-through flags, directory-handle flush support, and
   limitations on NTFS, ReFS, and network filesystems. State what can and
   cannot honestly be promised after power loss.
8. Define terminal outcomes for request rejection, root collision, log-open
   failure, spawn failure, timeout, output overflow, child nonzero exit, child
   zero exit, post-exit inventory failure, optional-metadata failure, terminal
   record collision, and observer failure. Separate build outcome from custody
   integrity so a zero exit cannot become a pass when evidence publication is
   incomplete.
9. Explain when output inventory, executable hashing, PE machine inspection,
   signature inspection, and dependency inspection may occur. These checks
   must follow durable exit capture and must never select an executable left by
   another attempt. Define provenance checks from expected target root to every
   accepted candidate.
10. Develop a hostile test harness with tiny deterministic child executables.
    Include zero, nonzero, huge stdout, huge stderr, interleaved streams,
    inherited-handle leakage, invalid bytes, sleep timeout, grandchild escape,
    abrupt observer termination, unavailable optional metadata, disk full,
    locked files, root collision, and terminal-record collision. State expected
    files, process counts, and verdict for every case.
11. Define a review and trust-bootstrap procedure. Explain how to test the
    custody owner before registration, bind its exact source and runtime into a
    later attempt, prevent self-modification after registration, and obtain an
    independent review without asking the reviewer to trust the build output.
12. Provide a migration-free adoption plan. The old ad hoc wrapper is not a
    supported interface and should be removed, not wrapped. Identify the
    minimal clean implementation, its module boundaries, test layers, and
    objective gate that must pass before one real build is permitted.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Primary-source observation log with dates and immutable revisions.
3. Trust boundary and single-owner architecture.
4. Canonical request and terminal-record schemas.
5. Process, pipe, handle, and job-object lifecycle diagrams.
6. Exact launch, wait, exit-capture, and publication pseudocode.
7. Crash consistency and filesystem durability analysis.
8. Outcome taxonomy and claim language.
9. Output provenance and executable-inspection rules.
10. Security and hostile-input threat model.
11. Fault-injection and deterministic test matrix.
12. Implementation sequence with acceptance criteria.
13. Likely dead ends and rejected alternatives.
14. Unknowns requiring local Windows execution.
15. Annotated primary-source bibliography.

Do not recommend parsing Cargo's final line as an exit code, accepting an
executable merely because it exists, retrying a failed registered build,
deleting a failed root, swallowing observer errors, storing unbounded output in
memory, invoking through an ambiguous shell string, or adding a null check to
another operator-only wrapper and calling the custody problem solved.

## Prompt 2: Output-Free Preregistration And An Irreversible Fifth Composition Attempt

You are an independent principal evidence-systems architect, transaction
protocol designer, and release-control researcher. Design an output-free
preregistration protocol and one-shot execution state machine for a fifth real
Qwen3 conversion attempt after four preserved terminal attempts. You have
internet access but no private repository, artifacts, receipts, machine access,
source-control permissions, credentials, or unpublished test output. Produce
research and design only; do not claim local validation.

Project-supplied context, not independently verified:

- TinyRustLM is prelaunch and has one clean product architecture. Technical
  suffixes such as SLM2, Tokenizer2, or execution `/5` do not denote a legacy
  product generation. No compatibility, migration, aliases, retries, stale
  output reuse, or debt are required.
- The target public source is a pinned Qwen3 0.6B model and matching pinned
  tokenizer source. Source lockfiles bind immutable revisions, exact relative
  files, byte lengths, and SHA-256 identities. Private model bytes never enter
  Git.
- Attempts `/1` through `/4` are terminal historical evidence. `/1` failed
  before conversion because of binding order, `/2` rejected a tensor inventory
  mismatch, `/3` produced only a partial model before rejecting an invalid
  Tokenizer2 output-path contract, and `/4` stopped after a build observer
  failed to capture the child exit code. No attempt may be overwritten,
  resumed, repaired, relabeled, or used as the output of another attempt.
- The corrected composition contract requires six members: `model.slm2`,
  `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`,
  `prompt.prompt2`, and `composition.acg2`. It also requires a bounded attempt
  record, model and tokenizer conversion receipts, and exactly one terminal
  pass or rejection record.
- A source-controlled, tested build-custody owner must exist before `/5` is
  registered. Registration must bind its exact source commit/tree and runtime.
- The preregistration commit must be pushed and independently read back before
  any `/5` private control, build, evidence, managed-inspector, or output root
  exists. Every `/5` root must be wholly new, direct, non-reparse, and absent.
- Structural conversion is not model quality, source-framework parity, native
  inference, browser-WASM inference, browser chat, P2P availability, catalog
  publication, or campaign credit.

Research transparency logs, in-toto/SLSA concepts, content-addressed build
systems, append-only evidence stores, state-machine replication principles,
filesystem transactions, and release preregistration practices where useful.
Address all of the following:

1. Define the threat model for output-aware registration, easy-seed selection,
   root prepopulation, stale-binary adoption, source drift, tool drift,
   evaluator drift, path substitution, symlink/reparse substitution, and
   history rewriting. Explain which attacks preregistration can prevent and
   which require independent execution or review.
2. Design a canonical preregistration object that binds parent commit/tree,
   branch, source locks, model/tokenizer identities, all conversion profiles,
   custody-owner source and runtime, Rust and .NET toolchains, exact commands,
   allowlisted environments, five or more new logical roots, resource bounds,
   expected evidence files, success/failure rules, and predecessor
   dispositions. Unknown fields and noncanonical bytes must fail closed.
3. Specify how root identities should be chosen without using secret prompts or
   future output. Compare human-readable attempt identifiers, UUIDs, random
   nonces, commit-derived names, and hashes of the preregistration. Prevent
   collisions and circular dependence while making every root unambiguous.
4. Give an exact output-free ceremony: prove candidate roots absent, prove
   source locks exact, record tool identities, commit registration, push,
   fetch from the authoritative remote into a clean reader, verify commit/tree
   and changed-path allowlist, reprove root absence, and only then authorize
   execution. Include abort conditions at every step.
5. Design the one-shot state machine from `proposed` through `registered`,
   `remote_verified`, `roots_reserved`, `rust_build_terminal`,
   `managed_build_terminal`, `request_bound`, `controller_terminal`,
   `independent_verification_terminal`, and either a bounded public result or
   a later proof gate. Define which transitions are terminal and why no state
   permits retry or resume inside the same attempt identity.
6. Separate the physical build processes from logical execution. Determine
   whether build failure, custody failure, managed-inspector failure, request
   failure, converter failure, verifier disagreement, and evidence-publication
   failure should create distinct terminal receipts. Explain how a public
   result can summarize them without exposing private paths or raw logs.
7. Define content-addressed binding among source lockfiles, profile bytes,
   executables, build terminal records, request bytes, controller bytes,
   converter raw streams, output inventory, managed inspection, and final
   decision. Include a receipt graph and algorithms for detecting missing or
   conflicting edges.
8. Address crash recovery without resume. Show how an auditor classifies each
   possible filesystem snapshot after power loss or observer death. Existing
   roots must become preserved terminal evidence, never cleanup candidates.
   Define when absence itself can be stated as an observed fact.
9. Design an independent verification role that has read-only access only
   after controller closure. Prevent the verifier from mutating, repairing, or
   completing converter output. Explain how disagreement is preserved and how
   no shared parser bug becomes two votes.
10. Specify bounded public disclosure. List safe fields such as public profile
    IDs, source revisions, hashes, byte counts, timestamps, state transitions,
    process counts, and typed codes. List forbidden fields such as private
    paths, prompts, raw model bytes, credentials, invitation URLs, and raw
    hosted-memory payloads.
11. Build a formal invariant table. Include exactly-once child launch,
    at-most-one terminal record per phase, mutually exclusive pass/rejection,
    no root reuse across attempts, no output before remote verification, no
    campaign credit from structural evidence, and preservation of every failed
    attempt.
12. Provide an implementation-neutral test and audit plan. Include canonical
    serialization tests, changed-path attacks, remote mismatch, root races,
    reparse swaps, tool replacement, request tampering, terminal collisions,
    process overlaunch, verifier mutation attempts, and public-result
    overclaiming.

Required report structure:

1. Executive protocol recommendation.
2. Explicit facts, assumptions, and unavailable evidence.
3. Threat model and trust roles.
4. Canonical preregistration schema.
5. Receipt graph and content-addressing rules.
6. Output-free registration ceremony.
7. Complete attempt state machine and transition table.
8. Root ownership and crash-snapshot classification.
9. Controller/verifier separation.
10. Privacy-safe public result schema.
11. Formal invariants and proof obligations.
12. Fault-injection and audit matrix.
13. Prioritized implementation plan.
14. Unknowns requiring local inspection or execution.
15. Annotated primary-source bibliography with dates.

Do not propose a boolean-only `passed` field, mutable latest-result file,
cleanup of failed roots, same-attempt retry, stale executable discovery,
post-output registration, best-of-N execution, secret material in public
receipts, or campaign progress based only on conversion structure.

## Prompt 3: Hermetic Rust And .NET Build Provenance For One-Shot Model Tooling

You are an independent principal build engineer, reproducible-builds
researcher, Windows toolchain specialist, and software-supply-chain architect.
Produce a detailed, current design for hermetically building a Rust conversion
CLI and a .NET independent inspection CLI before an irreversible real-model
attempt. Focus on provenance, deterministic inputs, offline operation, output
identity, and honest limits of bit-for-bit reproducibility on Windows. You have
no TinyRustLM source, lockfiles, build roots, binaries, CI, machine inventory,
or credentials. Do not claim to have built private software.

Project-supplied context, not independently verified:

- TinyRustLM is prelaunch. It accepts clean replacement and does not require
  legacy support, compatibility layers, migration binaries, or old build
  paths.
- A Rust CLI owns Qwen3 source conversion and six-member composition
  publication. A separate .NET CLI independently inspects the resulting
  artifacts. Both must be built from one exact committed source tree before a
  one-shot conversion attempt.
- The Rust build is expected to be `--locked`, release-mode, offline,
  nonincremental, and targeted to Windows x64. The .NET build is expected to
  use a pinned SDK and locked dependencies, release mode, deterministic build
  settings, and a new private output root.
- A source-controlled process-custody owner, rather than an ad hoc shell
  wrapper, must capture exit status and bounded logs for each build. An
  executable is not accepted merely because it exists.
- Build outputs remain private. Public evidence may contain hashes, lengths,
  target architecture, tool versions, bounded dependency identities, and typed
  outcomes, but not private paths or secrets.
- A later registration must bind exact custody-owner source, source commit and
  tree, toolchain executable hashes, lockfile identities, commands,
  environments, target roots, build terminal records, and accepted executable
  identities.

Use primary documentation for Cargo, rustup, the Rust compiler, crates.io
vendoring or offline caches, MSVC/Windows SDK linkage, .NET SDK/MSBuild/NuGet,
Portable PDB, SourceLink, PE/COFF, SLSA, in-toto, SPDX or CycloneDX, and
reproducible-build projects. Address all of the following:

1. Define hermeticity for this use case. Separate source hermeticity,
   dependency hermeticity, toolchain hermeticity, environment hermeticity,
   network isolation, filesystem isolation, time/locale isolation, and output
   reproducibility. State which are required to trust one execution and which
   are desirable but not prerequisites.
2. Design the exact Rust input closure. Cover `Cargo.lock`, workspace manifests,
   config files, build scripts, procedural macros, vendored/native sources,
   registry cache state, Git dependencies, target specifications, rustc/cargo
   binaries, linker, Windows SDK libraries, environment variables, and sources
   of network access. Explain how `--offline` and `--locked` can still leave
   unbound dependencies or tools.
3. Design the exact .NET input closure. Cover SDK selection, `global.json`,
   target framework, runtime identifier, NuGet lock mode, package sources,
   workload manifests, analyzers, source generators, implicit framework packs,
   native assets, MSBuild imports, environment properties, and restore versus
   build separation.
4. Specify safe fresh-root build algorithms for both ecosystems. Include
   absent direct non-reparse targets, explicit environment allowlists,
   inherited handle control, network denial, parallelism bounds, log bounds,
   timeout, disk-space formulas, and immutable terminal records from the
   process-custody owner.
5. Analyze Windows reproducibility hazards: absolute path embedding,
   timestamps, PE headers, GUIDs, incremental caches, PDB identities,
   deterministic compilation switches, link ordering, archive member order,
   code signing, locale, username, machine path, antivirus interaction, and
   nondeterministic build scripts. State how to detect each without claiming
   universal bit reproducibility.
6. Explain the evidentiary value of one build versus two independent rebuilds.
   A one-shot conversion must use one preregistered executable, but a prior
   trust-bootstrap gate may perform reproducibility experiments. Design a
   method that does not accidentally make a later attempt choose the more
   convenient of two outputs.
7. Define accepted executable inventory and identity. Cover exact expected
   filenames, PE machine type, managed/native classification, dependent DLLs,
   runtime configuration, PDB and SourceLink handling, file hashes, Authenticode
   status, and how to reject stale or unexpected binaries under the target
   root.
8. Design provenance statements binding source, dependencies, toolchain,
   invocation, environment, custody receipt, output inventory, and verifier.
   Compare SLSA provenance, in-toto links, SPDX, CycloneDX, and a smaller
   purpose-built canonical receipt. Recommend what to adopt without creating
   unnecessary framework complexity.
9. Address build-script and dependency threat models. Include malicious or
   compromised packages, path traversal, symlink/reparse tricks, executable
   replacement after build, DLL search-order attacks, environment poisoning,
   registry/cache poisoning, and secrets accidentally embedded in logs or PDBs.
10. Define independent checks before the binaries can enter an irreversible
    attempt: lock closure, source-tree cleanliness, runtime hashes, offline
    enforcement, terminal exit status, complete inventory, PE inspection,
    dependency allowlist, secret scan, path-leak scan, and optional
    reproducibility comparison.
11. Provide resource formulas for disk, memory, process count, log size, and
    timeout. Explain disk-full behavior and how build roots remain preserved
    evidence rather than cleanup targets after a registered attempt begins.
12. Provide a clean-slate implementation and CI plan. Old ad hoc scripts are
    removed rather than supported. Separate fast unit tests, fake-build
    integration tests, toolchain-identity tests, offline tests, Windows real
    builds, and the final human-authorized one-shot gate.

Required report structure:

1. Executive build-provenance recommendation.
2. Current primary-source observation log.
3. Hermeticity taxonomy and trust boundaries.
4. Rust input-closure and build algorithm.
5. .NET input-closure and build algorithm.
6. Windows reproducibility analysis.
7. Executable identity and dependency inspection.
8. Provenance and SBOM schema recommendations.
9. Security threat model and mitigations.
10. Resource model and failure handling.
11. Test, CI, and trust-bootstrap matrix.
12. One-shot admission checklist.
13. Rejected approaches and likely dead ends.
14. Unknowns requiring private machine execution.
15. Annotated primary-source bibliography with dates.

Do not equate `--locked` with a complete hermetic build, equate a successful
restore with a successful build, accept binaries discovered outside the exact
target root, hide path or timestamp nondeterminism, require support for an old
build pipeline, rerun a registered failed build, or use package creation as
proof that the binary is trustworthy.

## Prompt 4: Independent .NET Inspection Of A Six-Member Binary Composition

You are an independent principal binary-format engineer, defensive-parser
specialist, and cross-language verification architect. Produce a deeply
technical design for a .NET inspection program that independently validates a
Rust-produced six-member local-language-model composition without sharing the
Rust parser or trusting the Rust conversion receipts. You have internet access
but no TinyRustLM source code, private profile bytes, generated artifacts,
managed project, build output, test fixtures, or credentials. Your report is a
design and research artifact only; it must not claim private inspection or
execution.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch, browser-local Rust language-model product. It has
  one current architecture and owes no support to earlier drafts. SLM2,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 are technical binary
  format families, not product generations.
- A successful Qwen3 composition transaction is expected to contain exactly
  six binary members named `model.slm2`, `tokenizer.tokenizer2`,
  `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and
  `composition.acg2`.
- The bounded transaction inventory also contains
  `composition.attempt.json`, a model conversion receipt, a Tokenizer2
  conversion receipt, and exactly one terminal composition pass or rejection
  JSON. A structural pass requires the complete expected inventory and no
  rejection. Partial members never become a pass.
- The model is project-supplied as Qwen3ForCausalLM with vocabulary 151,936,
  context 40,960, hidden size 1,024, feed-forward size 3,072, 28 layers, 16
  query heads, 8 KV heads, head dimension 128, Q/K normalization, no QKV bias,
  tied embeddings, 311 physical source tensors, and 310 logical SLM2 tensors.
- The Tokenizer2 member has a fixed preregistered byte identity. Template2,
  Sampling2, and Prompt2 also have preregistered identities. ACG2 names and
  cryptographically binds all members and declares a resource plan.
- Rust owns conversion and canonical parsing. .NET must be an independent
  structural consumer. Sharing generated parser code, calling the Rust parser
  through FFI, trusting writer-calculated offsets, or merely comparing receipt
  strings would create false independence.
- Unknown fields in typed JSON evidence and unsupported binary values are
  fatal. Inputs are untrusted and may be malicious, truncated, oversized,
  aliased, path-substituted, or internally inconsistent. Validation must be
  bounded and read-only.
- Structural inspection does not prove numerical inference, language quality,
  browser execution, P2P serving, publication, or campaign progress.

Research current .NET binary-parsing APIs, checked arithmetic, spans and
sequences, memory-mapped files, random-access I/O, cryptographic streaming,
canonical JSON, hostile archive/file parsing guidance, fuzzing, and independent
implementation diversity. Address all of the following:

1. Define genuine verifier independence. Provide a dependency and shared-fault
   analysis covering source code, generated schemas, format prose, test
   vectors, hash libraries, canonical-JSON implementations, and OS APIs.
   Recommend what may be shared as normative bytes and what must be separately
   implemented or cross-checked.
2. Design an exact bounded input-root admission algorithm. Require a direct
   non-reparse root, regular direct children only, exact case-sensitive or
   canonical filename treatment, no subdirectories, no alternate data streams,
   no hard-link substitution where inappropriate, an exact file-count and
   name allowlist, and protection against time-of-check/time-of-use mutation.
3. Specify defensive parsing primitives for little-endian integers, floats,
   lengths, offsets, alignments, tables, UTF-8 names, hash fields, and payload
   slices. Every addition, multiplication, conversion, and allocation must be
   checked. Explain how to distinguish malformed format data from resource
   limit exhaustion.
4. Design independent SLM2 validation. Cover header and format identity,
   tensor directory ordering, unique names, dtype and quantization metadata,
   rank and dimension bounds, element-count arithmetic, payload range and
   overlap, alignment, expected Qwen3 tensor taxonomy, exact 310 logical
   tensors, tied-output omission proof, and streaming artifact hashing.
5. Design independent Tokenizer2 validation. Cover exact member identity,
   `.tokenizer2` naming, binary magic/profile, vocabulary and merge tables,
   unique token IDs, byte-level coverage, special-token semantics, UTF-8 and
   raw-byte behavior, bounded encode/decode tables, and rejection of obsolete
   suffix or receipt identities.
6. Design independent Template2, Sampling2, and Prompt2 validation. Explain how
   to check bounded bytecode or declarative operations, vocabulary/context
   agreement, stop-token IDs, sampling parameter domains, prompt roles,
   publisher-defined delimiters, and references without executing untrusted
   general-purpose code.
7. Design ACG2 graph validation. Require unique member roles, exact hashes and
   lengths, safe relative names, no cycles or duplicate role aliases, supported
   format/profile identities, complete resource declarations, model-tokenizer-
   template-prompt agreement, and one-at-a-time resolution under a strict
   resident-memory budget.
8. Define receipt skepticism. Recompute every artifact hash and structural
   fact before comparing model, tokenizer, attempt, and terminal receipts.
   Specify canonical JSON validation, duplicate-key handling, number handling,
   unknown-field rejection, schema identity, producer identity, and mutually
   exclusive terminal states.
9. Specify mutation detection during inspection. Compare open-handle identity,
   file IDs, lengths and timestamps before/after read, deny-write sharing,
   repeated hashes, snapshot copies, and filesystem limitations. Recommend an
   honest policy for local NTFS and state residual risks.
10. Produce resource formulas for file handles, hash buffers, parser metadata,
    tensor-directory memory, tokenizer tables, maximum receipts, total file
    count, and elapsed time. The inspector must stream the roughly hundreds of
    megabytes of model payload rather than loading it all.
11. Design a cross-language differential corpus without using private model
    bytes. Include minimal valid artifacts, one mutation per invariant,
    truncation at every structural boundary, offset wraparound, overlapping
    payloads, duplicate names, unknown enums, malicious UTF-8, hash mismatch,
    graph mismatch, receipt disagreement, and partial-transaction snapshots.
12. Define the final managed decision schema and process contract. It must
    state exactly what was independently checked, preserve bounded findings,
    fail on internal errors, distinguish structural rejection from inspection
    failure, and never mutate or repair the Rust output root.

Required report structure:

1. Executive recommendation and independence claim boundary.
2. Facts, supplied assumptions, and unavailable private facts.
3. Format-family and receipt trust model.
4. Root admission and mutation-resistance algorithm.
5. Safe binary parsing primitives and checked-arithmetic policy.
6. SLM2 verification specification.
7. Tokenizer2 and behavioral-resource verification specification.
8. ACG2 graph and resource-plan verification.
9. Canonical evidence and terminal-decision schema.
10. Resource bounds and streaming design.
11. Differential, fuzz, and hostile-input test matrix.
12. Cross-language disagreement and adjudication rules.
13. Prioritized clean implementation plan.
14. Unknowns requiring the private format specifications or artifacts.
15. Annotated primary-source bibliography with dates.

Do not recommend calling the Rust parser from .NET, generating both parsers
from one unchecked implementation, trusting conversion receipts without
rehashing and reparsing, loading the complete model into memory, repairing a
malformed artifact, accepting unknown fields, or describing structural
validity as inference or quality proof.

## Prompt 5: Crash-Safe Create-Only Conversion On Windows Filesystems

You are an independent principal storage engineer, filesystems researcher,
and transactional-artifact architect. Design the filesystem transaction used
to convert pinned Qwen3 and tokenizer sources into a complete six-member local
composition while preserving every partial failure and never exposing a false
pass. You have public-internet access but no TinyRustLM repository, private
source lockfiles, model bytes, target disk, converter, receipts, or test logs.
Do not claim local validation.

Project-supplied context, not independently verified:

- TinyRustLM is prelaunch and may replace flawed storage code cleanly. There is
  no requirement for old output layouts, compatibility readers, migration
  utilities, fallback writers, resume of partial attempts, or cleanup that
  destroys evidence.
- One Rust CLI owns the complete transaction. Inputs are two existing direct
  non-reparse source directories plus canonical source lockfiles. The output
  root must not exist before the one-shot attempt and must have an existing
  direct non-reparse parent. Input and output trees may not overlap.
- Expected binary members are `model.slm2`, `tokenizer.tokenizer2`,
  `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and
  `composition.acg2`. Expected evidence includes an attempt record, model and
  tokenizer conversion receipts, and exactly one terminal pass or rejection
  record. The complete success inventory is ten files.
- Publication is intended to use same-directory staging, file flush, a
  create-only hard-link or equivalent atomic name publication, stage removal,
  and directory flush before verification. The terminal record is written
  last. Existing output is terminal and is never resumed.
- Model source is about 1.5 GB, output is roughly hundreds of megabytes, and
  hashing must stream through bounded buffers. Disk full, power loss,
  antivirus locking, user cancellation, malformed source, and verifier
  rejection are expected fault classes.
- Earlier one-shot attempts produced preserved partial roots. They must never
  be selected, repaired, deleted, or adopted by a later attempt.
- Structural transaction success is not source-framework parity, model
  quality, browser execution, P2P availability, publication, or campaign
  credit.

Research authoritative Windows file APIs, NTFS and ReFS semantics, Rust file
APIs, atomic rename and hard-link creation, flush/write-through behavior,
directory handles, sparse files, reparse points, hard links, file IDs,
opportunistic locks, antivirus interactions, disk quotas, and crash-consistent
artifact stores. Address all of the following:

1. Define the transaction's safety properties: no overwrite, no path escape,
   no input mutation, no accepted partial composition, no hidden cleanup, one
   terminal outcome, bounded resources, reproducible inventory, and immutable
   evidence after any failure. Express them as invariants and temporal
   properties.
2. Specify path admission without vulnerable string-prefix checks. Cover
   canonical absolute paths, volume identities, existing direct parents,
   component-by-component reparse rejection, case folding, reserved names,
   alternate data streams, UNC and device paths, junction races, hard-link
   aliases, and source/output overlap.
3. Design source-lock validation. Parse bounded canonical JSON, reject unknown
   and duplicate fields, open each allowed relative file safely, stream its
   hash, verify length and file identity, reject extra or missing source files,
   and detect mutation between validation and conversion.
4. Give the exact member-publication algorithm. Explain staging-name entropy
   or determinism, exclusive creation, preallocation, streaming writes,
   incremental hashing, file flush, close, atomic create-only publication,
   stage deletion, directory flush, and post-publication readback. Provide
   Windows-oriented pseudocode and error mappings.
5. Compare create-only hard-link publication, `MoveFileEx`,
   `SetFileInformationByHandle`, rename-without-replace, and platform-neutral
   Rust abstractions. State the atomicity and durability actually guaranteed by
   each, including limitations after power loss and on unsupported filesystems.
6. Design streaming conversion custody for a 1.5 GB source and large model
   output. Include bounded reader/writer buffers, allocation ceilings, integer
   overflow checks, temporary disk formulas, progress counters that do not
   affect output, and cancellation that preserves an honest terminal state.
7. Define ordering among model conversion, tokenizer conversion, fixed
   behavioral members, member receipts, ACG2 graph construction, independent
   reparse/rehash, directory flush, and terminal pass publication. Explain why
   terminal pass must be last and what facts a rejection may safely record.
8. Classify every crash snapshot. Include failure before root creation, after
   root creation, during a stage write, after stage flush, after member link,
   between member and receipt, after all members but before graph, during
   verification, and during terminal publication. Existing roots are evidence,
   not resumable transactions.
9. Address Windows interference: sharing violations, open-file antivirus or
   indexer handles, oplock breaks, delayed deletion, path-length limits,
   permission changes, quota exhaustion, disk-full short writes, removable
   volumes, and system shutdown. Distinguish retryable low-level I/O inside one
   operation from prohibited logical rerun of an attempt.
10. Design post-write independent verification without changing output. It
    must enumerate exact regular files, hash every member, parse every format,
    validate the ACG2 graph and resource plan, compare writer/parser identities,
    and publish either a new terminal decision or preserve disagreement.
11. Define secret-safe and privacy-safe logs. Raw source paths and model data
    stay private. Logs are bounded binary streams. Public summaries expose only
    safe hashes, lengths, counts, timestamps, phase states, and typed failures.
    Include redaction and secret-scanning tests.
12. Provide a deterministic fault-injection framework. Include failpoints
    before and after every durability boundary, injected short writes, flush
    errors, hash mismatch, source mutation, reparse swap, output collision,
    hard-link failure, locked stage, disk full, process kill, and simulated
    power interruption. Define exact expected inventory for each case.

Required report structure:

1. Executive storage-transaction recommendation.
2. Filesystem facts, assumptions, and guarantee limits.
3. Formal invariants and ownership model.
4. Safe path and source-lock admission.
5. Create-only member publication pseudocode.
6. Flush, atomicity, and durability matrix by filesystem/API.
7. Composition ordering and terminal-record protocol.
8. Crash-snapshot classification and audit algorithm.
9. Bounded streaming and capacity formulas.
10. Windows interference and error taxonomy.
11. Privacy-safe evidence design.
12. Fault-injection matrix and acceptance criteria.
13. Prioritized implementation plan.
14. Unknowns requiring local Windows/filesystem tests.
15. Annotated primary-source bibliography with dates.

Do not recommend overwriting destination names, renaming a partial root into a
pass, deleting failed roots, resuming a prior attempt, using path-prefix string
checks, treating flush as stronger than the documented filesystem guarantee,
putting model bytes into JSON, or using a terminal pass receipt to repair
missing members.

## Prompt 6: Exact Qwen3-0.6B Lowering, Tied Embeddings, And Mixed-Q8 Accuracy

You are an independent principal neural-network compiler engineer,
quantization researcher, and transformer-runtime specialist. Produce a very
technical report describing how to lower a pinned dense Qwen3 0.6B checkpoint
from safetensors into a compact portable SLM2 representation while preserving
architecture semantics and measuring quantization error honestly. You have
internet access and may inspect official public Qwen model cards, immutable
repository revisions, configuration files, tokenizer files, papers, and
framework implementations. You have no TinyRustLM source, private source
lockfile, converter, format bytes, local model copy, runtime output, or GPU.
Never imply that you converted or tested the private artifact.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local inference system. It has no legacy
  model-format support obligation; one exact SLM2 representation may replace
  flawed drafts. Technical format numbers are not product generations.
- The target is reported as `Qwen3ForCausalLM`, approximately 0.6B, with
  vocabulary 151,936, context length 40,960, hidden size 1,024,
  intermediate/feed-forward size 3,072, 28 decoder layers, 16 query heads, 8
  KV heads, head dimension 128, Q/K normalization, no QKV bias, RoPE theta
  corresponding to 1,000,000, RMSNorm epsilon approximately 1e-6, SiLU-gated
  MLP, and tied input/output embeddings.
- The pinned source inventory is reported to contain 311 physical tensors and
  751,632,384 physical parameter values. The portable logical graph expects
  310 tensors and 596,049,920 logical parameter values because a redundant
  physical tied output matrix is verified byte-for-byte or value-for-value and
  not emitted separately. The difference is 151,936 x 1,024 values.
- The intended conversion is called mixed-Q8. The exact internal block layout,
  scale type, zero-point policy, row grouping, and which tensors remain
  floating point are private facts requiring local inspection; do not invent
  them. The output has previously been roughly 598 MB, but that historical
  partial artifact is not acceptance evidence.
- Source structural conversion must be deterministic and streaming. Unknown,
  missing, duplicate, misshaped, nonfinite, or extra tensors fail closed.
- A structural conversion receipt cannot prove source-framework numerical
  parity, conversational quality, native execution, or browser execution.

Research the current official Qwen3 architecture and implementation at pinned
public revisions, safetensors format, grouped-query attention, Q/K norm, RoPE,
SwiGLU/SiLU gating, tied language-model heads, and current weight-only int8
quantization literature and production kernels. Address all of the following:

1. Reconstruct the exact forward equations for one Qwen3 decoder layer and the
   final language-model head. Include tensor shapes for batch 1 and sequence
   length T, GQA head expansion, Q/K RMS normalization, RoPE pairing, causal
   attention, residual ordering, RMSNorm, gate/up/down MLP, and tied output
   projection.
2. Derive the expected physical source tensor taxonomy and count from the
   supplied dimensions. Give formulas per layer and globally. Map common
   Hugging Face safetensors names to logical runtime roles while clearly
   marking any name that must be verified at the pinned revision.
3. Explain why the source may contain both embedding and output-head tensors
   even when `tie_word_embeddings` is true. Specify an exact streaming equality
   proof, including shape, dtype, endianness, byte equality versus decoded
   numeric equality, NaN behavior, and what to do if metadata claims tying but
   values differ.
4. Design deterministic safetensors ingestion across one or more shards. Cover
   bounded JSON headers, duplicate names across shards, index manifests,
   offset and length validation, overlap, dtype decoding, endianness, finite
   values, file mutation, streaming hash, and exact inventory rejection.
5. Define a canonical lowering map into SLM2. For every tensor role, state
   whether transposition, concatenation, head reshaping, or layout reordering is
   semantically required or should be avoided. Explain how to prove that a
   storage-layout change did not change the mathematical operator.
6. Compare credible mixed-Q8 schemes for this size and browser/CPU target:
   per-tensor, per-channel, per-row, fixed-block symmetric int8, asymmetric
   int8, SmoothQuant-like activation scaling, outlier-aware schemes, and mixed
   precision for embeddings, norms, and output-sensitive layers. Include
   storage and dequantization equations.
7. Develop an error-budget method. Cover weight reconstruction error, cosine
   similarity, layer-output relative error, attention-logit drift, final-logit
   error, top-token stability, KL or Jensen-Shannon divergence, and multi-token
   divergence. Separate quantization-expected drift from layout or kernel bugs.
8. Analyze which tensors are most accuracy-sensitive in a 0.6B Qwen3 model.
   Discuss embedding/output tying, Q/K projections and norms, attention output,
   MLP down projection, RMSNorm weights, and early versus late layers. Propose
   ablation experiments rather than unsupported universal rules.
9. Design portable metadata sufficient for native Rust and browser WASM to
   execute identical math. Include dtype, quantization block geometry, scale
   encoding, logical shape, storage strides/layout, tensor role, RoPE and norm
   constants, GQA counts, context bound, vocabulary, and checksum identities.
10. Give bounded conversion resource formulas. Account for largest source
    tensor, quantization row/block workspace, read/write buffers, scale output,
    sorting/index metadata, temporary disk, threads, and elapsed time as
    measured-throughput formulas rather than invented benchmark numbers.
11. Specify converter tests independent of natural-language outputs. Include
    tiny synthetic Qwen-shaped checkpoints, exact tensor-count derivation,
    known quantization vectors, all-zero and extreme rows, nonfinite values,
    tied/untied heads, transposition sentinels, shard-order permutations, and
    cross-language SLM2 inspection.
12. Define the post-conversion proof ladder: structural validity, dequantized
    tensor comparisons, layer-by-layer source oracle, native end-to-end logits,
    browser-WASM logits, untouched raw generations, and semantic quality. State
    required evidence and prohibited claims at each layer.

Required report structure:

1. Executive lowering and quantization recommendation.
2. Public observation log with exact revisions and dates.
3. Qwen3 forward equations and complete shape table.
4. Source tensor taxonomy and count derivation.
5. Safetensors ingestion and tied-output proof.
6. Canonical SLM2 lowering map.
7. Mixed-Q8 method comparison with equations and storage costs.
8. Quantization error budgets and ablation plan.
9. Portable runtime metadata contract.
10. Bounded converter resource model.
11. Structural and numerical test-vector matrix.
12. Proof ladder and promotion criteria.
13. Failure modes and likely dead ends.
14. Unknowns requiring local profile/artifact inspection.
15. Annotated primary-source bibliography with dates.

Do not infer tensor correctness from file size, trust architecture metadata
without inventory derivation, emit a second untied output merely to simplify
runtime code, choose a quantizer from benchmark popularity alone, compare only
natural-language answers, hide quantization regressions with sampling, invent
private mixed-Q8 details, or call structural conversion model quality.

## Prompt 7: Pinned Source-Framework Oracle And First-Divergence Numerical Proof

You are an independent principal ML correctness engineer, numerical-analysis
researcher, and differential-testing architect. Design a source-framework
oracle and first-divergence laboratory that can determine whether a converted
Qwen3 0.6B model, a native Rust runtime, and a browser-WASM runtime implement
the same model closely enough for honest promotion. You have internet access
but no TinyRustLM source, converted model, private prompts, source lockfiles,
runtime binary, browser harness, GPUs, or prior outputs. You may inspect public
official Qwen and framework repositories. Never claim private execution.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local model system with one current
  architecture and no legacy-support requirement. A clean implementation may
  replace incorrect drafts. Response repair, hidden retries, expected-term
  injection, and best-of-N selection are prohibited.
- The target is a pinned Qwen3ForCausalLM 0.6B checkpoint with 28 layers,
  hidden size 1,024, intermediate size 3,072, 16 query heads, 8 KV heads, head
  dimension 128, Q/K normalization, RoPE, RMSNorm, tied embeddings, vocabulary
  151,936, and maximum declared context 40,960.
- The source checkpoint and tokenizer are pinned by immutable public revision
  and exact file hashes. The portable composition has distinct Model,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 members. Exact local
  format details require private inspection.
- Model weights are intended to use a mixed-Q8 representation. Therefore exact
  bitwise equality with source floating-point logits is not expected. The
  project needs an explicit quantization error budget rather than a vague
  `close enough` rule.
- The source oracle, native runtime, and WASM runtime must preserve untouched
  raw outputs. Greedy cases are preferred for deterministic localization.
  Sampling cases, when used, bind the exact algorithm, parameters, seed, and
  RNG implementation and are never selected best-of-N.
- Structural conversion success is already a separate gate. Numerical parity
  does not by itself prove conversational usefulness or browser product UX.

Research official Qwen3 code and model cards, pinned Transformers and PyTorch
execution, deterministic-algorithm guidance, safetensors, floating-point error
analysis, differential testing, metamorphic testing, quantized-model
evaluation, and browser numerical behavior. Address all of the following:

1. Define a hermetic source-oracle environment. Bind model and tokenizer
   revisions, every source file hash, Transformers/PyTorch/safetensors versions
   and immutable source revisions, Python environment, device, dtype,
   deterministic flags, thread counts, BLAS/backend versions, chat-template
   settings, and generation parameters. Explain residual nondeterminism.
2. Separate four comparisons: decoded source weights versus portable decoded
   weights, source framework versus a high-precision portable reference,
   reference versus optimized native Rust, and native versus browser WASM.
   Explain why jumping directly from one generated sentence to another cannot
   localize faults.
3. Design trace points at embedding output, pre/post norm, Q/K/V projection,
   Q/K normalization, RoPE output, attention scores or bounded summaries,
   softmax output, attention projection, MLP gate/up/activation/down, residuals,
   final norm, and logits. Account for huge trace volume with deterministic
   slices, hashes, norms, sentinels, and escalation to full tensors only at the
   first divergent layer.
4. Specify numerical metrics and tolerances. Cover absolute and relative error,
   ULP distance where meaningful, cosine similarity, L2/L-infinity norms,
   max-error coordinates, attention-row probability mass, logit rank
   correlation, top-k set overlap, top-1 margin, and KL/JS divergence. Provide
   a method to derive thresholds from quantization ablations rather than
   inventing constants.
5. Design exact test inputs that do not contaminate semantic evaluation.
   Include empty/minimal legal prompts, single tokens, repeated tokens, byte
   and Unicode boundaries, special tokens, short conversations, long-prefix
   cases, GQA-sensitive sequences, RoPE-position sweeps, and synthetic tensor
   fixtures. Keep sealed behavioral holdouts separate.
6. Isolate tokenizer and template errors before model math. Require exact token
   IDs, role framing, special tokens, thinking-mode controls if officially
   applicable, stop sequences, decode bytes, and prompt-length accounting.
   Explain how one framing-token mismatch propagates into total logit drift.
7. Design prefill parity and one-token decode parity both with and without KV
   cache. Compare full recomputation against cached decode at every position.
   Include cache layout, GQA indexing, RoPE position, sequence length, and
   context-boundary cases.
8. Separate quantization error from implementation bugs. Propose source
   float-reference, dequantized portable-reference, quantized reference-kernel,
   optimized native, and WASM stages. Use controlled per-tensor dequantization
   or temporary high-precision substitutions to bisect sensitive layers.
9. Define deterministic generation comparisons. Start with greedy decoding and
   compare logits before token choice. For declared stochastic behavior,
   specify exact temperature, top-k, top-p, repetition penalty, tie-breaking,
   float ordering, seed, RNG, and categorical-sampling semantics. State when
   token equality is and is not a valid requirement.
10. Design metamorphic checks: identical tied-head versus explicit-head math,
    batch item independence, padding invariance where supported, prefill split
    equivalence, cached versus uncached decode, thread-count stability,
    repeated execution stability, and source-shard-order invariance.
11. Specify a content-addressed parity receipt. Bind all bytes and versions,
    test-vector identities, trace policy, thresholds selected before outputs,
    raw output hashes, metrics, first-divergence findings, and decision. Old
    decisions remain archived when runtime or threshold logic changes.
12. Provide stop rules and fault workflow. A structural mismatch, token mismatch,
    nonfinite activation, threshold breach, unexplained top-token change, or
    nondeterministic repeat must block promotion. Preserve the raw failure,
    create a generic regression, fix one owner, and rerun only invalidated
    phases.

Required report structure:

1. Executive parity strategy and explicit assumptions.
2. Public source-oracle dependency matrix with immutable revisions.
3. Comparison ladder and authority rules.
4. Trace-point protocol and bounded trace schema.
5. Numerical metrics and empirically derived threshold method.
6. Tokenizer/template isolation procedure.
7. Prefill, decode, and KV-cache parity procedure.
8. Quantization-versus-kernel bisection algorithm.
9. Deterministic and stochastic generation policy.
10. Metamorphic and adversarial test matrix.
11. Content-addressed evidence schema.
12. Failure-to-regression workflow and stop rules.
13. Prioritized implementation plan.
14. Unknowns requiring local artifacts and execution.
15. Annotated primary-source bibliography with dates.

Do not use generated prose similarity as the sole parity test, select the best
seed, change tolerances after seeing a preferred result, silently normalize
different prompts, compare cached output only to itself, treat all quantized
drift as acceptable, dump private prompts into public reports, or train on
parity and quality holdouts.

## Prompt 8: Correct And Fast Native Rust Qwen3 Inference On Commodity CPUs

You are an independent principal CPU-kernel engineer, Rust performance
architect, and transformer-inference specialist. Produce a highly technical
design for a production-quality native Rust runtime for one compact
mixed-Q8 Qwen3 0.6B composition on commodity x86-64 and ARM64 CPUs. Correctness
and deterministic evidence precede optimization. You have internet access but
no TinyRustLM source, SLM2 bytes, private quantization profile, benchmark
machine, runtime traces, or test outputs. Do not claim private measurements.

Project-supplied context, not independently verified:

- TinyRustLM is prelaunch and browser-local, with an optional local companion.
  There is one current model/runtime architecture and no requirement to retain
  old kernels, compatibility dispatch, hidden fallback paths, or known debt.
- The first target is Qwen3ForCausalLM 0.6B: 28 layers, hidden size 1,024,
  intermediate size 3,072, 16 query heads, 8 KV heads, head dimension 128,
  Q/K normalization, RoPE, RMSNorm, tied embeddings, vocabulary 151,936, and
  declared context 40,960.
- Weights use a private mixed-Q8 SLM2 profile. Exact blocks, scales, and
  float-retained tensors require local verification. A plausible composition
  is roughly 600 MB, so memory mapping and bounded working memory matter.
- Tokenization, prompt construction, template application, sampling, and graph
  resolution are separate typed members. Native runtime acceptance must bind
  all of them, not load `model.slm2` in isolation.
- The runtime must first agree with a pinned source-framework oracle and a
  simple reference kernel. Optimized paths cannot repair outputs or silently
  switch algorithms when parity fails.
- Real performance claims require measured hardware, exact build/runtime
  identities, warm/cold distinctions, and raw data. Provide formulas and
  methodology, not invented tokens-per-second numbers.

Research current Rust SIMD and portable-SIMD status, x86 AVX2/AVX-512/VNNI,
ARM NEON/dot-product/I8MM, cache-aware int8 matrix-vector kernels, quantized
transformer inference, thread pools, memory mapping, NUMA, GQA attention,
online softmax, KV-cache representations, sampling, and profiling tools.
Address all of the following:

1. Define a clean runtime module graph: bounded composition loader, SLM2 tensor
   views, quantized math primitives, reference kernels, architecture layer,
   KV-cache owner, tokenizer/template/prompt pipeline, sampler, generation
   state machine, instrumentation, and public API. Identify one authority for
   each invariant and avoid duplicate parsing or shape logic.
2. Design safe zero-copy or low-copy model access. Compare memory mapping,
   positioned reads, pread-like access, full resident loading, and OS page
   cache. Address file mutation, mapping lifetime, alignment, bounds,
   endianness, pointer provenance, `unsafe` review, and deterministic failure
   on unsupported layout.
3. Derive operation counts and memory traffic per token for embedding lookup,
   Q/K/V projections, attention, output projection, gated MLP, final norm, and
   vocabulary projection. Separate prefill from single-token decode and state
   whether each is compute- or bandwidth-bound as a function of sequence
   length and hardware bandwidth.
4. Design a mathematically simple scalar/reference path used for tests, then
   exact optimized int8 x float or int8 x quantized kernels based on the
   registered profile. Cover block dequantization, accumulation precision,
   scale handling, tail dimensions, overflow bounds, rounding, fused bias-free
   projections, and tied output projection.
5. Compare AVX2, AVX-512/VNNI, NEON, dot-product, and I8MM strategies. Explain
   compile-time versus runtime feature selection, target-feature safety,
   dispatch identities in evidence, and fail-closed behavior when a published
   build does not support the machine. Do not retain obsolete kernels merely
   as compatibility debt.
6. Design attention and GQA kernels. Cover Q/K RMS normalization, RoPE,
   expanding or indexing 8 KV heads across 16 query heads, causal masking,
   stable online softmax, prefill tiling, single-token decode, and bounded
   scratch allocation.
7. Quantify KV-cache growth. Derive bytes per token as a function of layers,
   KV heads, head dimension, K/V count, dtype, block metadata, and alignment.
   For fp16-like cache the supplied dimensions imply approximately 114,688
   payload bytes per token before overhead. Analyze practical context limits,
   cache quantization, sliding windows only if architecturally valid, and why a
   declared 40,960-token model limit is not a promise that every browser or CPU
   can afford that context.
8. Design deterministic multithreading. Address layer-level versus row-level
   parallelism, fixed work partitioning, reduction order, thread-pool lifetime,
   oversubscription, NUMA, core classes, cancellation, and reproducibility
   across thread counts. Identify which variation is permitted by the parity
   budget.
9. Specify complete generation semantics: prefill, cache allocation, token
   loop, repetition history, logits processing, temperature/top-k/top-p,
   deterministic tie-breaking, stop token handling, maximum output, cancel,
   error finalization, and preservation of untouched tokens/raw bytes.
10. Create a benchmark methodology. Include cold file/open/map, cold OS cache,
    warm map, first-token latency, prefill tokens/s, decode tokens/s, peak RSS,
    committed/private bytes, page faults, cache misses, CPU utilization, power,
    thread count, prompt/output lengths, and statistical treatment. Bind model,
    binary, OS, CPU microcode, and settings.
11. Design correctness and safety tests for every kernel. Include known vectors,
    random differential tests, extreme int8 values/scales, nonfinite inputs,
    dimension tails, misalignment, truncated mappings, concurrent generations,
    cancellation, long cache, thread variation, and Miri/sanitizers/fuzzing
    where applicable.
12. Provide a staged optimization plan that never outruns evidence. Start from
    source-oracle parity, establish a reference baseline, profile real
    bottlenecks, introduce one kernel at a time behind explicit supported
    feature identities, rerun differential suites, and remove superseded
    implementations instead of accumulating silent alternate paths.

Required report structure:

1. Executive native-runtime recommendation.
2. Explicit assumptions and facts needing local verification.
3. Runtime ownership/module diagram.
4. Model access and memory-safety design.
5. Operation, bandwidth, and memory formulas.
6. Reference and optimized quantized-kernel specifications.
7. GQA, RoPE, normalization, and attention design.
8. KV-cache capacity and policy analysis.
9. Threading and deterministic execution contract.
10. Generation/sampling state machine.
11. Benchmark and profiling protocol.
12. Differential, safety, and fault test matrix.
13. Prioritized implementation sequence and removal plan.
14. Unknowns requiring private profile/hardware execution.
15. Annotated primary-source bibliography with dates.

Do not invent performance measurements, optimize before numerical parity,
silently use stale binaries, accept unbounded context allocation, map files
without mutation and bounds defenses, use multiple hidden dispatch authorities,
repair invalid tokens, or preserve inferior old kernels solely as prelaunch
compatibility.

## Prompt 9: Real-Browser WASM Qwen3 Under Honest Memory And Deployment Limits

You are an independent principal WebAssembly engineer, browser-runtime
architect, and client-side AI performance researcher. Produce a deeply
technical design for executing the same verified Qwen3 0.6B composition in a
real browser worker while preserving native numerical behavior, local privacy,
bounded memory, responsive cancellation, and honest compatibility claims. You
have internet access but no TinyRustLM code, WASM binary, model artifact,
browser harness, deployment account, private traces, or local companion. Do
not claim that you tested the product.

Project-supplied context, not independently verified:

- TinyRustLM is a prelaunch browser-local chat product. Prompts and model bytes
  must not be uploaded to the project website. Model acquisition is direct P2P
  when available or explicit local conversion through an authorized local
  path. The public site serves application assets and discovery metadata, not
  model bytes.
- One composition binds six members: mixed-Q8 `model.slm2`, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. The model alone is roughly 600 MB;
  the source checkpoint can be much larger. The runtime must verify the
  composition and execute it without casually duplicating all bytes in JS and
  WASM heaps.
- Target architecture is Qwen3 0.6B with 28 layers, hidden 1,024, 16 query
  heads, 8 KV heads, head dimension 128, vocabulary 151,936, and declared
  maximum context 40,960. KV-cache capacity, not only model weight size, is a
  dominant browser constraint.
- A Tokenizer2-only real Chromium two-profile proof reportedly passed 2,048
  cases and exact encode/decode checks, but this supplied claim is not
  independently verifiable and does not prove full model execution.
- The browser runtime must match a native reference within preregistered
  numerical tolerances and preserve raw generation. No response repair,
  hidden retry, best-of-N, fake assistant text, or downgraded test is allowed.
- The product is prelaunch. It may choose one clean supported architecture and
  explicit browser requirements rather than accumulating legacy shims or
  pretending unsupported browsers work.

Research current primary documentation for WebAssembly core features,
wasm32/wasm64 and memory64 status, browser memory limits, SIMD, relaxed SIMD,
threads and atomics, `SharedArrayBuffer`, COOP/COEP, workers, OPFS, IndexedDB,
File System Access, transferable streams/buffers, WebGPU only as a separately
declared option, browser process isolation, CSP, service workers, and current
Chromium/Firefox/WebKit behavior. Record browser versions and dates. Address:

1. Define the supported browser execution contract rather than a generic
   `modern browser` claim. Specify required WebAssembly features, secure
   context, cross-origin isolation, worker capabilities, persistent storage,
   available-memory preflight, and exact failure states for unsupported
   combinations.
2. Build a memory ledger for model member storage, mapped/streamed chunks,
   WASM linear memory, JS wrappers, tensor directory, tokenizer tables,
   temporary quantized-kernel buffers, logits, generation history, and KV
   cache. Provide formulas for peak live bytes during install, load, prefill,
   decode, model switch, and teardown.
3. Analyze wasm32 linear-memory limits and growth behavior, browser per-process
   limits, fragmentation, contiguous reservation, memory64 availability, and
   JS typed-array constraints. Recommend an architecture that works within
   measured constraints without claiming universal 40,960-token context.
4. Compare persistent composition storage in OPFS, IndexedDB blobs, File
   System Access handles, Cache Storage, and companion-owned files. Address
   random access, streaming hashes, copies, quotas, eviction, user permission,
   origin partitioning, private browsing, service-worker interactions, and
   atomic installation.
5. Design a worker ownership model. The UI thread must remain responsive while
   one worker owns model verification, runtime state, tokenization, prefill,
   decode, and cancellation. Cover structured-clone copies, transferable
   buffers, shared memory, message sequencing, worker crash, termination,
   stale events, and fresh-worker recovery.
6. Translate native mixed-Q8 kernels into deterministic WASM SIMD. Cover lane
   widths, widening multiply/accumulation, dequantization scales, tail handling,
   alignment, float reduction order, feature detection, threads, and how to
   bind the selected kernel identity into parity evidence.
7. Design browser prefill and KV-cache management. Include user-visible context
   budgets, allocation before generation, OOM prediction, cache dtype choices,
   position/RoPE correctness, cache reuse only within one exact conversation
   state, cancellation, and secure zeroing or release claims that match actual
   browser behavior.
8. Specify native-to-WASM numerical parity. Reuse identical composition bytes,
   token IDs, prompt bytes, deterministic settings, and test vectors. Compare
   layer sentinels, logits, greedy tokens, cached/uncached decode, SIMD/scalar
   tests, worker restarts, and browser vendors. Define how differences are
   preserved rather than repaired.
9. Analyze cross-origin isolation and deployment headers. Cover COOP, COEP,
   CORP, CORS, CSP, MIME types, compression, range requests for application
   assets, service-worker caching, update races, third-party resources, and how
   to avoid breaking privacy or allowing model-byte fallback through the site.
10. Design resource-pressure and lifecycle tests: quota denial, storage
    eviction, linear-memory grow failure, JS allocation failure, WASM trap,
    long prefill, generation timeout, tab backgrounding, page navigation,
    worker death, browser crash, stale service worker, model switch, and
    repeated fresh-profile runs.
11. Specify real-browser performance evidence. Include browser/build identity,
    OS/hardware, feature set, cross-origin isolation, cold/warm composition
    access, load and verify time, first-token latency, prefill/decode rate,
    worker/renderer memory, long-task absence, thermal behavior, and raw
    trace privacy. Do not invent thresholds without measurements.
12. Provide a clean implementation and release gate. Remove old simulated or
    incompatible execution paths. Require unit vectors, headless real-browser
    parity, interactive screenshots and canvas/DOM checks where applicable,
    network privacy assertions, fresh-profile deletion proof, and public HTTPS
    header readback before a browser-support claim.

Required report structure:

1. Executive browser-WASM recommendation.
2. Current browser feature matrix with primary sources and dates.
3. Explicit support contract and fail-closed statuses.
4. End-to-end memory ledger and capacity formulas.
5. Persistent-storage and zero/low-copy architecture.
6. Worker lifecycle and message-state machine.
7. Deterministic WASM kernel strategy.
8. Context and KV-cache policy.
9. Native/WASM numerical parity protocol.
10. Deployment headers, isolation, and privacy contract.
11. Fault-injection and real-browser test matrix.
12. Performance-evidence schema and claim rules.
13. Prioritized clean implementation plan.
14. Unknowns requiring private artifacts and browser execution.
15. Annotated primary-source bibliography with dates.

Do not recommend downloading model bytes from the project site, duplicating a
600 MB model casually across JS and WASM heaps, claiming every declared model
context is browser-affordable, faking generation, silently dropping to an
untested kernel, repairing output, treating Node.js WASM as real-browser proof,
or retaining obsolete browser paths merely for prelaunch compatibility.

## Prompt 10: P2P-First Acquisition Or Automatic Local Conversion Without Text Downloads

You are an independent principal distributed-systems engineer, browser/native
integration architect, and product-workflow reliability researcher. Design the
complete user action that turns selection of a public model into a verified,
locally usable TinyRustLM composition. The product must first acquire a matching
composition directly from consenting peers and, when no qualified peer artifact
exists, guide an authorized local companion to fetch pinned public source and
convert it locally. The browser must not download instructions, PowerShell
scripts, JSON requests, or text files and call that success. You have internet
access but no TinyRustLM or MiniModel source, companion binary, model files,
catalog credentials, peer endpoints, network configuration, screenshots,
private receipts, or production access. Do not claim a live P2P or conversion
test.

Project-supplied context, not independently verified:

- TinyRustLM.com is a prelaunch browser-local chat interface. MiniModel.org is
  intended to be the public catalog and discovery authority. Model bytes flow
  directly between consenting peers or are created locally; the project
  websites must not proxy model weights or receive prompts.
- The user selects a model inside the browser. The expected outcome is a
  verified local six-member composition that can be loaded for chat, not a
  downloaded `.txt`, `.ps1`, or `.json` artifact that asks the user to complete
  engineering work manually.
- The first target composition binds `model.slm2`, `tokenizer.tokenizer2`,
  `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and
  `composition.acg2`, plus conversion/transaction evidence. Artifact identity
  is cryptographic; aliases and relabeled duplicate bytes do not create new
  models.
- P2P selection must require exact composition and member identities plus valid
  provenance and quality evidence. Partial pieces from multiple peers may be
  combined only when every identity agrees. Every piece and final member is
  hashed before atomic promotion.
- If no acceptable P2P composition is available, an explicitly installed local
  companion may acquire the exact pinned public source revision and perform the
  registered local conversion. The browser site itself does not host source or
  model bytes.
- The local companion is reached only over an authenticated, origin-bound,
  loopback protocol with explicit user intent. Undocumented endpoints,
  downloadable command scripts, workspace administrator credentials, and
  permissive CORS are prohibited.
- The product is prelaunch. One clean workflow should replace old placeholder
  downloads. There is no legacy workflow to preserve.
- Structural acquisition/conversion alone does not prove model quality,
  browser inference, public reachability, catalog announcement, or campaign
  credit.

Research direct peer transfer protocols, content-addressed storage, resumable
piece downloads, WebRTC/WebTransport/HTTP constraints, loopback browser-native
security, native messaging alternatives, custom protocol handlers, File System
Access/OPFS, authenticated local APIs, CORS/private-network access changes,
SSRF/DNS rebinding, supply-chain verification, and usable long-running browser
workflows. Address all of the following:

1. Define a single user-visible acquisition state machine from model selection
   through catalog resolution, evidence screening, peer discovery, P2P import,
   local-companion fallback-by-explicit-policy, source review, acquisition,
   conversion, independent verification, browser installation, load, and
   ready-for-chat. Use precise states rather than one `downloading` flag.
2. Specify the catalog query and response contract. Bind canonical model,
   source revision, license/provenance, composition identity, all member hashes
   and lengths, piece-set identity, quality-claim level, supported runtime
   profile, peer proof status, expiry, and signatures. Catalog metadata is
   discovery data and never a substitute for hashing received bytes.
3. Design P2P peer selection and transfer. Cover two or more peers, identity
   agreement before mixing, fixed piece boundaries, per-piece hashes, bounded
   concurrency, fairness, range semantics, corruption quarantine, peer loss,
   user cancellation, resumable acquisition journals, final member hashes,
   and atomic composition promotion.
4. Separate safe resumable byte acquisition from prohibited conversion-attempt
   resume. Downloaded immutable source/pieces may use a content-addressed
   journal. Once a one-shot conversion output root exists, failure is terminal
   and a new conversion registration/root is required. Explain this boundary
   clearly in both implementation and UI states.
5. Define the decision to convert locally. Require authoritative evidence that
   no currently qualified matching peer route is usable, explicit source
   identity and license review, disk/RAM/time estimates, companion capability
   negotiation, and user consent. Do not let an attacker force expensive
   conversion through arbitrary catalog metadata.
6. Design a versioned loopback handshake. Cover HTTPS-origin binding, ephemeral
   browser challenge, companion identity, user-presence confirmation,
   capability document, CSRF, CORS, DNS rebinding, Host validation, private
   network access, token scope/lifetime, port discovery, replay, rate limiting,
   and zero secrets in URLs or durable browser storage.
7. Define the browser-to-companion command contract without shell scripts.
   Use structured canonical requests for source lock acquisition, conversion
   registration, status observation, cancellation, and final local composition
   import. The companion validates every path and identifier and never executes
   arbitrary command text supplied by the page.
8. Specify source acquisition. Bind immutable repository revision and exact
   files, stream large downloads, enforce HTTPS and redirect policy, quarantine
   incomplete data, verify hashes, preserve source receipts privately, scan
   licenses and malware within honest boundaries, and prevent project-site
   model-byte fallback.
9. Design browser installation and storage. Compare companion-owned read-only
   files, File System Access handles, OPFS, and IndexedDB. Require complete
   composition verification, one authoritative installed identity, atomic
   visibility, quota handling, eviction detection, model switching, and no
   duplicate multi-hundred-megabyte copies where avoidable.
10. Define privacy and network assertions. Allow project static assets,
    MiniModel metadata, qualified direct peers, pinned public source hosts, and
    authenticated loopback operations only as declared. Fail on prompt upload,
    model upload, credential-bearing URL, implicit telemetry, unexpected third
    party, or project-hosted model bytes.
11. Design user experience for hours-long operations. Provide accurate phase,
    bytes, rates, estimated work based on measured progress, disk requirements,
    quality/provenance state, cancel semantics, recoverable acquisition state,
    terminal conversion failures, and actionable errors. The main action must
    execute the workflow, not download an explanation of it.
12. Provide a real acceptance ladder: fake local fixtures, malicious catalog
    responses, loopback security tests, one real source acquisition, one real
    conversion, direct P2P import from an independently running peer, peer loss,
    final browser load, offline restart, and untouched chat. Separate CI proof
    from authorized outside-network proof.

Required report structure:

1. Executive workflow recommendation.
2. Facts, assumptions, and unavailable live facts.
3. End-to-end acquisition/conversion state machine.
4. Catalog, identity, provenance, and quality contract.
5. P2P piece-transfer and resumability protocol.
6. Local-conversion decision and source-acquisition protocol.
7. Authenticated loopback security specification.
8. Structured browser/companion command schemas.
9. Atomic browser installation and storage design.
10. Network/privacy allow-and-deny contract.
11. Long-running UX and failure vocabulary.
12. Fault-injection and real acceptance matrix.
13. Prioritized clean implementation plan.
14. Unknowns requiring source, credentials, or public peers.
15. Annotated primary-source bibliography with dates.

Do not recommend downloading instruction text or scripts, executing page-supplied
shell commands, treating catalog metadata as byte verification, silently
uploading prompts or models, using the project site as a model proxy, mixing
pieces with different identities, disguising local conversion as P2P success,
silently modifying router/firewall state, or retaining placeholder download
behavior as a legacy path.

## Prompt 11: Publisher-Exact Qwen3 Chat And Exactly-Once Browser Rendering

You are an independent principal conversational-runtime engineer, model-template
researcher, and browser interaction reliability architect. Produce a detailed
design for turning a verified Qwen3 0.6B composition into a truthful multi-turn
chat experience with publisher-exact framing, deterministic generation
custody, incremental UTF-8 rendering, cancellation, and exactly one assistant
message per turn. You have internet access and may inspect official public Qwen
documentation and browser specifications, but you have no TinyRustLM source,
private template/profile bytes, model artifact, raw outputs, UI test suite,
screenshots, or credentials. Do not claim product validation.

Project-supplied context, not independently verified:

- TinyRustLM.com is a prelaunch browser-local chat product. Prompts and model
  bytes remain local or direct P2P. The product may replace flawed interaction
  code cleanly; no old chat pipeline, duplicate renderer, compatibility
  template, response repair, or simulated answer must survive.
- The first candidate is a pinned Qwen3 0.6B composition. A typed Template2,
  Prompt2, Sampling2, and Tokenizer2 are cryptographically bound to the model.
  Their exact private bytes require local verification. Public official Qwen
  behavior, including chat-template and thinking-mode distinctions, must be
  researched at the exact pinned source revision rather than guessed.
- A model is not promoted because it loads or emits one attractive response.
  Required quality includes ordinary conversation, ambiguity handling,
  practical constraints, source conflict, latest-turn precedence, multi-turn
  references, untrusted quoted or retrieved text, summaries, rewrites,
  structured output, code explanation, and substantive lawful adult inquiry
  within narrow explicit harm boundaries.
- Raw token generation must be preserved. No expected-answer injection,
  answer completion, hidden retry, best-of-N seed selection, judge rewriting,
  or hand-edited transcript is allowed.
- UI requirements include introductory prompt cards disappearing after chat
  begins, the center becoming the conversation workspace, a stable composer,
  one authoritative assistant rendering path, accurate status, long-output
  handling, accessibility, and no casual redesign of the approved visual
  language.
- MemoryEndpoints is currently unauthorized and disconnected. Hosted-memory
  behavior must not be simulated or counted. Any retrieved local/P2P text is
  untrusted data, not instruction authority.

Research official Qwen3 model cards and template code at immutable revisions,
token streaming, incremental UTF-8 decoding, stop-sequence handling, event
sourcing, browser worker messaging, accessibility, Playwright, deterministic
sampling, semantic evaluation, and multi-turn context management. Address:

1. Determine which public Qwen3 0.6B artifact class is being discussed: base,
   pretrained, instruct/chat, thinking-capable, or another variant. Explain how
   model card, config, tokenizer config, generation config, and chat-template
   bytes establish supported behavior. A base model must not be advertised as
   a chat model without credible post-training evidence.
2. Specify publisher-exact prompt construction. Cover system, user, assistant,
   tools if supported, generation prompt, special tokens, role separators,
   escaping, Unicode normalization policy, thinking controls, context limits,
   and stop tokens. The typed Template2/Prompt2 must match the pinned official
   semantics or document an intentionally trained alternative.
3. Define a conversation event model with immutable user turns, generation
   attempt identity, model/composition identity, prompt hash, sampling profile,
   raw token events, decoded text projections, cancellation, terminal status,
   and visible assistant message. Identify one owner of message identity and
   one reducer that renders it.
4. Design exactly-once rendering over at-least-once worker messages. Use
   conversation, turn, generation, sequence, and token indices; reject stale,
   duplicate, out-of-order, or post-terminal events. Explain idempotent DOM
   updates, worker restart boundaries, and why two convenience listeners must
   not append the same answer.
5. Specify incremental decoding. Address tokenizer byte tokens, UTF-8 sequences
   split across tokens, replacement-character avoidance, combining marks,
   bidirectional text, Markdown delimiters, code fences, HTML sanitization,
   partial links, stop sequences spanning token boundaries, and preserving raw
   token IDs separately from the rendered projection.
6. Define cancel, timeout, error, and completion semantics. A user cancel stops
   the owned generation, drains or ignores later events by identity, preserves
   the partial raw output with a truthful status, releases cache/resources, and
   never turns a partial answer into a completed pass.
7. Design context assembly and truncation. Preserve latest-user preference over
   stale profile context, distinguish trusted product instructions from
   untrusted quoted/retrieved memory, use token counts from the exact tokenizer,
   avoid splitting role framing, expose honest context limits, and never
   silently summarize raw conversation into durable memory.
8. Define semantic quality gates that do not reduce to keywords. Combine
   deterministic structure checks, scenario invariants, metamorphic variants,
   blinded model judges as advisory evidence, and human review as the final
   authority for ambiguous semantics. Preserve untouched outputs and preregister
   seeds/cases.
9. Develop multi-turn cases for ambiguity, conflicting authoritative dates,
   unavailable resources, preference changes, quoted malicious instructions,
   summaries, rewrites, JSON, extraction, code, and lawful adult comparisons.
   State behavior invariants independent of one fixture's nouns or answer
   wording.
10. Design visual and accessibility assertions at desktop, narrow desktop, and
    mobile widths. Cover stable columns, fixed composer, no overlap, long model
    names, long unbroken text, keyboard navigation, focus, screen-reader labels,
    live-region moderation, reduced motion, scroll anchoring, status truth, and
    screenshots free of secrets.
11. Specify a clean-profile browser campaign procedure for one candidate before
    larger campaigns. Import the real composition, run genuine two-to-six-turn
    conversations, close the browser process, delete an owned profile with
    proof, restart fresh, repeat, scan storage/network/logs, and preserve raw
    evidence. A reload is not a browser-data restart.
12. Define release claim levels from runtime smoke through structurally valid,
    numerically matched, conversation screened, conversation proven, and
    browser-product proven. State minimum evidence and prohibited language for
    each, including why a single appealing chat does not establish quality.

Required report structure:

1. Executive chat-runtime recommendation.
2. Public Qwen3 artifact/template observation log.
3. Model capability and template authority determination.
4. Conversation and generation event schemas.
5. Exactly-once worker/UI state machine.
6. Incremental decode and safe rendering algorithm.
7. Cancellation, error, and resource-lifecycle contract.
8. Context, precedence, and untrusted-memory rules.
9. Semantic evaluation and multi-turn test matrix.
10. Responsive/accessibility browser assertions.
11. Fresh-profile dogfood evidence protocol.
12. Claim taxonomy and promotion gates.
13. Prioritized implementation plan.
14. Unknowns requiring private bytes, raw outputs, and browser tests.
15. Annotated primary-source bibliography with dates.

Do not invent a chat template, advertise a base model as instruction-tuned,
render hidden reasoning by accident, append one answer from multiple event
paths, repair malformed output, choose a favorable retry, use keyword presence
as semantic proof, treat a reload as clean browser state, simulate hosted
memory, or retain a duplicate renderer for compatibility.

## Prompt 12: Enterprise Release Control, Honest Claims, And Continuously Current Documentation

You are an independent principal release engineer, assurance-case architect,
technical-documentation systems lead, and prelaunch quality governor. Produce a
complete control-plane design for taking one real Qwen3 TinyRustLM composition
from preserved failed attempts through structural conversion, numerical proof,
native and browser execution, multi-turn dogfood, P2P readiness, source-control
publication, site deployment, and continuously accurate public documentation.
You have internet access but no access to private repositories, artifacts, CI,
deployment accounts, DNS, signing keys, model outputs, browser receipts,
external peers, or production services. Do not claim that any private gate has
passed.

Project-supplied context, not independently verified:

- TinyRustLM and related sites are prelaunch. There is one product generation,
  no product "V2," no users requiring legacy support, and no justification for
  compatibility readers, migration code, aliases, fallback behavior, or known
  code debt. Technical names such as SLM2 and evidence `/5` are permitted only
  as format/schema identities.
- Four real composition attempts are preserved terminal evidence. The latest
  `/4` attempt stopped when a build observer failed to capture the Rust child
  exit code. No converter or output was accepted. A source-controlled tested
  build-custody owner and a wholly new preregistered `/5` attempt are required.
- The target composition has six binary members and bounded receipts. A
  structural pass must then advance through source-framework parity, native
  runtime parity, browser-WASM parity, untouched semantic quality, real
  multi-turn browser UX, privacy/network assertions, and only later P2P and
  catalog evidence.
- MiniModel.org is intended as catalog/discovery authority; model bytes remain
  direct P2P or local. TinyRustLM.com is the browser chat product. Public sites
  must not receive prompts or model bytes.
- MemoryEndpoints is unauthorized and disconnected. No live memory claim or
  simulated success is permitted.
- Larger campaign counters remain exactly: 0/20 qualified models, 0/50
  deletion-backed browser rounds, 0/25 authorized live memory rounds, 0/40
  current outside-network lane proofs, and 0/20 live catalog announcements.
  One first-model milestone must not silently increment these counters without
  its required evidence.
- The team requires frequent source-control check-ins after each major change
  that builds and deployment whenever the complete applicable tests pass. Each
  site must show a consistent last-published version, publication date, and
  update log. Documentation and marketing claims must remain synchronized with
  actual evidence, not trail the product.
- Private evidence may contain model bytes, raw prompts, paths, and detailed
  logs outside Git. Public repositories and sites may expose safe hashes,
  sizes, versions, dates, states, counts, limitations, and bounded error codes,
  but never credentials or private payloads.

Research assurance cases, release train design, SLSA/in-toto provenance,
content-addressed evidence, semantic versioning and alternatives for prelaunch
software, reproducible builds, deployment attestations, changelog standards,
docs-as-code, OpenAPI/JSON Schema publication, SBOMs, artifact signing, browser
test evidence, privacy review, rollback, and public status communication.
Address all of the following:

1. Design a phase DAG from source discovery and acquisition through source
   screening, build custody, preregistration, conversion, independent structural
   inspection, source-oracle parity, native performance/correctness, browser
   WASM parity, semantic qualification, browser UX, package release, P2P
   preparation, outside proof, catalog announcement, site publication, and
   documentation readback.
2. Define evidence and claim levels for every phase. Each receipt binds inputs,
   implementation/tool versions, raw-output hashes, objective results, and
   terminal status. Explain invalidation edges so changing a semantic evaluator
   reruns evaluation but does not redownload a valid 1.5 GB pinned source.
3. Specify terminal failure, correctable source defect, infrastructure flake,
   external blockage, and success. Preserve obsolete/rejected receipts
   append-only. A phase cannot become `skipped-pass`, and unit tests cannot
   produce a live claim.
4. Design a no-debt architecture review gate. Require one authority per
   contract, absence of duplicate pipelines, removal of superseded prelaunch
   code, no compatibility aliases or migration branches, bounded inputs,
   fail-closed errors, tests proportional to risk, complete docs, and explicit
   remaining risks. Define auditable checks rather than slogans.
5. Define source-control policy: narrow commits after each major coherent
   change that builds, clean changed-path review, secret scan, frozen-authority
   checks, push, fresh fetch/readback, branch/remote identity, and preservation
   of private/generated artifacts outside Git. Explain emergency handling when
   deployment is unavailable but source must still be protected remotely.
6. Design release identifiers for prelaunch. Distinguish product generation
   from format/schema/profile versions, build commit, deployment ID, site
   publication version, model artifact hash, and campaign ID. Prevent phrases
   such as `V2 product` while still allowing rigorous machine-readable version
   identities.
7. Specify a consistent per-site release ledger. Each production site exposes
   last-published version, UTC publication date, source commit/tree, deployment
   identity where public-safe, changed features/fixes, security/privacy impact,
   known limitations, rollback/supersession state, and links to relevant docs.
   Define canonical schema plus accessible human rendering.
8. Design docs-as-code ownership. Every API, binary format, model lifecycle,
   UI workflow, privacy boundary, operational runbook, and claim level has one
   source owner and review trigger. Code/profile/schema changes must identify
   docs they invalidate. Add link checking, examples compiled as tests, schema
   validation, screenshot checks, stale-date detection, and public HTTPS
   readback.
9. Define deployment gates for Rust crates/CLI, WASM, browser assets, .NET
   inspector/companion, packages, symbols, source maps, SBOM/provenance,
   MiniModel metadata, TinyRustLM site, and documentation sites. Include unit,
   integration, fuzz, differential, browser, package-consumer, accessibility,
   privacy, secret, supply-chain, and authorized live tests.
10. Build a truth-preserving dashboard for the first model and larger campaign.
    Show current operation, exact attempt identity, qualified models, browser
    rounds, live memory rounds, externally proven lanes, announcements,
    resumable acquisition state, terminal attempts, blockers, elapsed time,
    release/site versions, and evidence freshness. Never collapse this into one
    green boolean.
11. Design failure-driven improvement. Preserve raw failure privately, publish
    bounded safe status, write a generic regression, make one scoped clean fix,
    remove superseded code, rerun only invalidated phases under a new identity,
    update architecture and operator memory, update release notes, commit/push,
    and deploy only after applicable gates pass.
12. Produce final acceptance checklists for two milestones: first-model browser
    product proof and later full campaign completion. The first requires one
    provenance-bound composition, independent structure, source/native/WASM
    numerical evidence, untouched quality, clean-profile multi-turn chat,
    privacy, package/site verification, docs, and remaining risk. Full campaign
    completion additionally requires all published campaign counts and live
    external evidence without mocks.

Required report structure:

1. Executive enterprise control-plane recommendation.
2. Explicit supplied facts and unavailable private/live facts.
3. Phase DAG and allowed transition table.
4. Evidence graph, invalidation, and append-only history.
5. Claim taxonomy and prohibited language.
6. No-debt architecture and code-review gate.
7. Source-control, push, and fresh-readback policy.
8. Prelaunch version and identity taxonomy.
9. Cross-site release-ledger schema and example rendering.
10. Documentation ownership and automated currency gates.
11. Component/site deployment and supply-chain matrix.
12. Progress dashboard specification.
13. Failure-to-regression and rollback workflow.
14. First-model and full-campaign acceptance checklists.
15. Prioritized implementation plan.
16. Unknowns requiring private or authorized production access.
17. Annotated primary-source bibliography with dates.

Do not recommend legacy support for a prelaunch draft, a product `V2` label,
one boolean pass, overwritten history, mocks counted as live proof, unit tests
counted as deployment, package creation counted as publication, stale marketing
claims, documentation updated only at the end, credentials in receipts, model
bytes on project sites, or completion while campaign counters and external
gates remain unmet.

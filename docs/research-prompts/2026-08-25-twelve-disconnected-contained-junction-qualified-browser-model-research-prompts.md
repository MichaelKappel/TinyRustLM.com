# Twelve Disconnected Research Prompts: Contained Junction Custody To A Qualified Browser Model

Each section below is a complete, self-contained assignment. Send each whole
prompt to a different technical research agent. The agents do not share
context. They must not be expected to have read this introduction, another
prompt, any TinyRustLM source file, or any private project artifact.

The requested reports are advisory research inputs, not implementation, test,
release, or campaign evidence. Each report must use current primary sources
wherever possible, record every source's publication or update date and the
report's retrieval date, link directly to supporting material, and pin public
repository observations to immutable revisions. Each report must keep these
categories visibly separate:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that could not be independently verified;
4. engineering analysis and recommendations;
5. assumptions, uncertainty, disputed behavior, and viable alternatives; and
6. facts requiring private implementation, local artifacts, real hardware, or
   authorized production verification.

No agent may claim to have inspected, built, run, tested, or validated private
TinyRustLM code. Generic tutorials, marketing summaries, invented benchmarks,
undocumented API guesses, success inferred from structural validity, and
recommendations to retain obsolete paths are not useful. Reports should be
exceptionally detailed and implementation-oriented. They should include exact
algorithms, language-neutral and Rust-oriented pseudocode, state machines,
canonical schemas, equations, bounded resource models, threat models, hostile
case matrices, objective acceptance criteria, and prioritized implementation
sequences.

## Prompt 1: Exact Windows Reparse-Point Classification For Build Custody

You are an independent principal Windows filesystem engineer, NT I/O
researcher, and secure-build custody architect. Produce an exceptionally
technical report defining how a security-sensitive build owner can identify
and classify every Windows reparse-point entry without following it. Target
10,000 to 18,000 words excluding the bibliography. The result must be precise
enough to implement in production Rust or a small audited native helper without
guessing at Windows behavior.

You may browse Microsoft Learn, Windows Driver Kit documentation, Windows
protocol specifications, public Windows SDK headers, public Rust and Node.js
documentation, public source repositories, and peer-reviewed filesystem or
TOCTOU research. You have no access to TinyRustLM source, local disks, private
paths, model bytes, generated receipts, executable output, credentials, or test
results. Do not request any secret or claim local validation.

Project-supplied facts and constraints, which you must label as unverified
project facts:

- TinyRustLM is one unversioned prelaunch product. There is no launched
  predecessor and no requirement to preserve an obsolete reader. A clean
  replacement is preferred. Product V1/V2 concepts, legacy support,
  compatibility modes, migrations, aliases, shims, fallback behavior,
  automatic retries, warning-only security failures, and accepted code debt
  are forbidden. Names such as SLM2 or custody profile `/3` are technical
  identities only.
- One preregistered Windows x64 Rust build completed successfully and produced
  the expected PE executable, but the build was correctly rejected by custody
  because its owned scratch tree contained one reparse entry that the current
  no-reparse contract could not represent. That attempt is immutable failed
  evidence and its executable can never be adopted or reused.
- A read-only post-failure observation reported a directory link at relative
  path `home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5` whose
  normalized target was the direct same-root relative directory
  `home/AppData/Local/Microsoft/Windows/INetCache/IE`. The inspector did not
  traverse the link. This observation does not prove the reparse tag or make
  the failed attempt pass.
- The replacement contract may accept a bounded, proven, same-root internal
  directory junction. It must reject external targets, mount points that leave
  the owned tree, symbolic links, file links, cloud placeholders, application
  execution aliases, device links, chained links, cycles, dangling targets,
  unknown tags, and race-ambiguous entries.
- A literal exception for `Content.IE5`, a broad `allowReparse` option, shelling
  out to an ambient PowerShell process, trusting `Dirent.isSymbolicLink()` as a
  complete classifier, or following a link during inventory is unacceptable.
- Public evidence may contain relative paths, normalized relative targets,
  reparse tags, hashes, counts, sizes, versions, and bounded errors. It must not
  expose private absolute roots, usernames, machine IDs, raw logs, or secrets.
- MemoryEndpoints is unauthorized and disconnected and is outside this task.

Research and address all of the following in depth:

1. Build a taxonomy of Windows reparse points relevant to recursive directory
   custody. Include at least `IO_REPARSE_TAG_MOUNT_POINT`,
   `IO_REPARSE_TAG_SYMLINK`, Microsoft versus third-party tags, name-surrogate
   tags, directory versus file attributes, cloud tags, WIM/SIS/DFS tags,
   application execution aliases, deduplication, and unknown future tags.
2. Explain the exact distinction among an NTFS junction, volume mount point,
   directory symbolic link, file symbolic link, hard link, shortcut file,
   OneDrive placeholder, and ordinary directory. State which metadata is
   authoritative and which Win32 conveniences collapse distinctions.
3. Specify a no-follow open sequence using `CreateFileW` and appropriate flags,
   including `FILE_FLAG_OPEN_REPARSE_POINT`, `FILE_FLAG_BACKUP_SEMANTICS`,
   desired access, share modes, creation disposition, and attribute flags.
   Explain which flag combinations accidentally resolve the target.
4. Define use of `DeviceIoControl(FSCTL_GET_REPARSE_POINT)`. Cover output buffer
   sizing, `MAXIMUM_REPARSE_DATA_BUFFER_SIZE`, alignment, length validation,
   malformed offsets, substitute and print names, tag-specific structures,
   unexpected success lengths, and typed rejection of unknown layouts.
5. Explain mount-point and symbolic-link substitute-name grammars, including
   `\??\`, `\\?\`, UNC, volume GUID, drive-relative, rooted, relative, and NT
   object-manager paths. Show how a junction's substitute name should be parsed
   without treating the print name as authority.
6. Determine whether a junction can target a file, a network path, a different
   volume, another reparse point, a missing path, or a path containing case or
   8.3 aliases. State documented guarantees versus behavior requiring hostile
   local tests.
7. Compare `GetFileInformationByHandleEx` classes, `GetFinalPathNameByHandleW`,
   `GetVolumePathNameW`, `GetVolumeNameForVolumeMountPointW`,
   `GetFileInformationByHandle`, and direct reparse-buffer parsing. Define the
   minimum authoritative evidence needed to classify the link and its direct
   target.
8. Address NTFS, ReFS, Dev Drive, SMB, FAT/exFAT, WSL interop, projected
   filesystems, filter drivers, and future filesystems. Recommend a fail-closed
   filesystem allow/deny policy rather than assuming all Windows volumes expose
   NTFS semantics.
9. Explain how case-insensitive names, case-sensitive directories, Unicode
   normalization, trailing dots/spaces, reserved device names, alternate data
   streams, 8.3 aliases, extended-length paths, and path-prefix normalization
   affect classification and evidence identity.
10. Define immutable private and public evidence fields for one classified
    entry: relative path bytes, attributes, reparse tag, substitute-name bytes,
    normalized target, volume identity, file identity, target type, parser
    version, and bounded rejection code. Identify which fields are safe to
    publish.
11. Give a strict allowlist predicate for one internal directory junction and
    a deny-by-default predicate for every other reparse point. The allowlist
    must be semantic and tag-based, not path-name-based.
12. Analyze TOCTOU boundaries between enumeration, no-follow open, reparse-data
    read, target-component validation, target open, inventory completion, and
    terminal receipt creation. Identify where stable handles are mandatory.
13. Provide Rust FFI type definitions or crate recommendations for every
    required Windows API. Discuss layout, UTF-16, unsafe-code boundaries,
    handle ownership, error preservation, and dependency provenance.
14. Provide at least 50 adversarial reparse fixtures with expected verdicts,
    including malformed buffers, unknown tags, external and cross-volume
    targets, chained links, cycles, dangling links, target replacement, case
    collisions, target-to-root, target-to-parent, and benign same-root junctions.
15. State precisely which conclusions public documentation can establish and
    which still require Windows tests under standard-user, developer-mode,
    administrator, NTFS, ReFS, and Dev Drive configurations.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Primary-source observation log with dates and immutable links.
3. Reparse taxonomy and trust boundary.
4. No-follow handle-opening algorithm.
5. Reparse-buffer parser specification.
6. Path namespace and target normalization rules.
7. Filesystem and volume policy.
8. Exact internal-junction acceptance predicate.
9. Evidence schema and bounded error taxonomy.
10. Rust/native implementation design and unsafe-code boundary.
11. TOCTOU analysis.
12. Fifty-case adversarial matrix.
13. Test plan across Windows configurations.
14. Objective acceptance criteria.
15. Unknowns requiring local verification.
16. Annotated primary-source bibliography.

Do not recommend checking only `FILE_ATTRIBUTE_REPARSE_POINT`, accepting all
mount-point tags, matching `Content.IE5`, resolving with a normal directory
open, using the print name as authority, or converting a classification error
into a warning.

## Prompt 2: Race-Resistant Proof Of A Same-Root Internal Directory Junction

You are an independent principal secure-filesystem algorithm designer,
capability-security researcher, and Windows race-condition specialist. Produce
an exceptionally detailed report defining a race-resistant proof that one
directory junction is a bounded alias to one direct directory inside the same
owned scratch root. Target 10,000 to 18,000 words excluding the bibliography.
The report must describe an implementable algorithm, not merely advise callers
to use canonical paths.

You may inspect current public Microsoft filesystem/API documentation, public
Windows SDK headers, filesystem security papers, Rust documentation, and public
implementations of capability-based traversal. You cannot inspect TinyRustLM
code, its computer, private paths, output trees, receipts, or tests. Treat all
project facts below as unverified and never claim private validation.

Project-supplied facts and constraints:

- TinyRustLM is a prelaunch product with no legacy compatibility obligation.
  The current blanket no-reparse profile will be replaced, not retained behind
  a compatibility switch. No fallback, automatic retry, cleanup-and-retry,
  broad reparse allowance, special-case filename, or accepted debt is allowed.
- A completed but terminally rejected Rust build had one observed Windows
  directory link under an owned scratch root. Its relative link path was
  `home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5`; the observed
  normalized relative target was
  `home/AppData/Local/Microsoft/Windows/INetCache/IE`.
- The prior attempt and all bytes it produced are immutable failed evidence.
  A later attempt requires a new profile, owner, preregistration, and wholly new
  output identities.
- A future owner may accept only a verified internal directory junction. It
  must never traverse the link. It must inventory the target only through its
  direct path exactly once. It must reject external, cross-volume, chained,
  cyclic, dangling, file, unknown, case-conflicting, duplicate-alias, and raced
  cases.
- The proof must remain valid even if an untrusted concurrent process can
  rename, replace, or retarget entries during inspection. A path string alone
  is not identity.
- Public receipts may expose normalized relative names, tags, hashes, file
  counts, and bounded status codes but not private absolute roots or machine
  identity. MemoryEndpoints is outside scope.

Research and address all of the following:

1. Define the security property formally. Specify root ownership, strict
   descendant, direct target, no-follow, exactly-once inventory, alias
   uniqueness, volume identity, entry identity, snapshot consistency, and the
   adversary's allowed filesystem mutations.
2. Explain why lexical containment, `Path.GetFullPath`, `realpath`,
   `GetFinalPathNameByHandleW`, prefix comparison, or a pre/post directory walk
   alone is insufficient. Give concrete attack traces for each weak approach.
3. Define how to acquire and retain a no-follow root handle and whether Win32
   alone can perform handle-relative component opens. Evaluate
   `NtCreateFile`/`OBJECT_ATTRIBUTES.RootDirectory`, `CreateFileW` by absolute
   extended path, file-ID opens, and other documented or stable options.
4. Specify component-by-component validation from the root to the link parent
   and from the root to the target. Every component must be direct, present,
   directory-typed, on the expected volume, and stable. Explain how to prove
   that no component resolves through a second reparse point.
5. Define the link identity captured before reading its reparse data and the
   observations repeated afterward. Include volume serial or GUID, file ID,
   attributes, tag, size fields, change time where useful, and handle-based
   identity limitations.
6. Parse and normalize the substitute target without resolving it. Define the
   accepted grammar, path-segment bounds, `.`/`..` handling, separator rules,
   root equality rejection, target-to-link rejection, and strict descendant
   proof.
7. Open the target by its direct path without following any intermediate
   reparse entry. Prove target directory type, same volume, expected file ID,
   and relationship to the normalized target string.
8. Design cycle and chain detection even though the accepted target should be
   direct. Cover self-targets, two-link cycles, longer chains, target ancestors,
   junctions targeting a directory containing the junction, and hard-link-like
   identity anomalies.
9. Define duplicate alias policy. Analyze two junctions to one target, one
   junction reachable under two case spellings, 8.3 aliases, hard-linked
   metadata files, and duplicate target file IDs. Recommend deterministic
   rejection or canonical representation with rationale.
10. Design the complete tree inventory so the link is recorded but never
    enqueued, while the direct target path is walked once. Explain ordering,
    bounds, aggregate byte accounting, and how to detect an unvisited target or
    an alias that hides otherwise unreachable content.
11. Define a two-snapshot or handle-anchored reconciliation algorithm. Specify
    all observations repeated at the end, the exact equality predicates, and
    which changes make the result terminally ambiguous rather than retryable.
12. Address Windows rename semantics with open handles, delete-pending entries,
    directory replacement, oplocks, sharing flags, transactions no longer
    generally available, antivirus/filter-driver intervention, and system
    known-folder activity.
13. Provide language-neutral pseudocode with bounded loops and a Rust-oriented
    decomposition into safe wrappers around a minimal unsafe Win32 layer.
14. Give an explicit proof sketch for safety and liveness. State every OS
    assumption. Identify what the algorithm proves, what it merely observes,
    and what no user-mode algorithm can guarantee against a privileged kernel
    adversary.
15. Provide at least 60 hostile race schedules and expected outcomes. Include
    retarget-before-open, retarget-after-open, parent rename, target replace,
    target deletion, case toggle, volume remount, chain insertion, entry-count
    overflow, path-length overflow, and concurrent benign file creation.
16. Recommend deterministic error codes and public-safe evidence sufficient for
    an independent verifier to understand why an entry was accepted or denied.

Required report structure:

1. Executive recommendation and formal property.
2. Threat model and OS assumptions.
3. Failure analysis of path-only approaches.
4. Root and component handle strategy.
5. Target grammar and containment proof.
6. Link/target identity model.
7. Complete no-follow inventory algorithm.
8. Snapshot reconciliation and race policy.
9. Cycle, chain, duplicate, and case-collision policy.
10. Pseudocode and Rust module boundaries.
11. Safety proof sketch.
12. Sixty-case race/adversarial matrix.
13. Evidence schema and typed failures.
14. Performance and resource bounds.
15. Objective acceptance criteria.
16. Unknowns requiring local verification.
17. Annotated primary-source bibliography.

Do not propose resolving the link and checking whether the resulting string
starts with the root, opening the target normally and trusting its final path,
temporarily blocking other processes, deleting the link after the build, or
retrying until two observations happen to agree.

## Prompt 3: Clean-Slate Build-Custody Profile And Receipt Schema

You are an independent principal evidence-systems architect, canonical-schema
designer, and secure build-pipeline engineer. Produce a deeply technical report
specifying the sole clean-slate custody profile and receipt family for a build
owner that permits rigorously proven internal directory junctions while
rejecting all other link ambiguity. Target 10,000 to 18,000 words excluding the
bibliography. The report must be implementable without preserving or reading an
obsolete profile.

You may research canonical JSON, CBOR, content-addressed systems, in-toto,
SLSA, NIST hashing guidance, Rust build evidence, Windows filesystem metadata,
atomic-file persistence, and public schema-evolution literature. You have no
access to TinyRustLM source, prior private requests, local paths, receipts,
artifacts, credentials, or tests. Do not infer local behavior.

Project-supplied facts and constraints:

- TinyRustLM is one unversioned prelaunch product. There is no public legacy
  format to support. The current custody profile and reader may be removed in a
  clean cut after immutable historical evidence is committed. The new current
  implementation must not include a legacy reader, migration, alias, shim,
  fallback, dual-write, optional compatibility mode, repair path, or known debt.
- A previous one-shot build is permanently terminal because its profile
  prohibited every reparse point and its scratch tree contained one observed
  same-root directory junction. The build's executable is not adoptable.
- The replacement must represent direct files, direct directories, and a
  bounded set of semantically verified internal directory junctions. It may not
  broadly allow reparse entries. Every accepted link must be non-traversed and
  bind relative link path, normalized relative direct target, reparse class,
  identity evidence, and validation algorithm identity.
- Source, target, scratch, and control roots are create-only and separately
  owned. The request is validated while all future roots are absent. A build
  operation executes at most once and writes immutable terminal evidence. Any
  failure closes that operation; it does not authorize retry or partial-output
  adoption.
- Public records contain only public identifiers, hashes, lengths, counts,
  tool versions, relative names where safe, bounded timestamps, and typed
  status. Private records may bind absolute paths and machine-local filesystem
  identities but remain outside Git and publication.
- The implementation is expected to be Node-controlled with a Rust/MSVC child,
  but the report should define language-neutral contracts. MemoryEndpoints is
  unauthorized and irrelevant.

Research and address all of the following:

1. Define the profile's normative vocabulary: direct entry, internal directory
   junction, owned root, absent future root, private binding, public lock,
   preflight, execute, terminal, inventory, supplement, closure, and drift.
2. Specify one canonical profile document with explicit schema identity,
   unknown-field rejection, numeric bounds, string grammar, canonical byte
   encoding, final-newline rule, hash domain, and no optional behavior that
   could change security semantics.
3. Define limits for total entries, files, directories, junctions, path bytes,
   target bytes, depth, aggregate regular-file bytes, individual file bytes,
   stream bytes, environment variables, supplement entries, and terminal size.
   Explain how limits are chosen from formulas rather than current fixture size.
4. Define the accepted-entry algebra. Direct files and directories must have
   deterministic identity. Junction records must never be represented as
   ordinary directories. Unknown, unsupported, or multiply classified entries
   must be terminal failures.
5. Specify inventory ordering under Windows case behavior and a portable
   canonical ordering. Cover case collisions, Unicode, separators, reserved
   names, duplicate normalized paths, and target aliases.
6. Design private versus public schemas. Show how a public terminal can bind a
   private absolute-path record by hash and byte length without leaking the
   path, username, volume serial, or raw environment.
7. Define request, preflight, start, process-terminal, inventory, executable
   capture, and final-terminal records. State which are create-only, which are
   written last, and how each binds all predecessors without a circular hash.
8. Define terminal status as a typed state, not one boolean. Include pass,
   request rejection, ownership rejection, environment drift, spawn failure,
   timeout, output overflow, process failure, inventory rejection, reparse
   rejection by category, executable mismatch, and ambiguous interruption.
9. Design deterministic same-directory atomic persistence for bounded JSON and
   streaming hash evidence on Windows. Cover `CREATE_NEW`, flush, rename,
   parent-directory durability limits, disk full, antivirus locks, and
   terminal-name collision.
10. Specify how a new owner rejects every obsolete profile/schema identity
    rather than silently parsing it. Explain how immutable historical Git and
    private evidence remain readable by archaeology without shipping a runtime
    legacy reader.
11. Define independent verification. A verifier must recompute canonical bytes,
    hash relationships, inventory totals, link records, executable identity,
    terminal exclusivity, and absence of unregistered output. State which
    private facts cannot be independently checked from the public result.
12. Provide complete JSON examples using invented safe relative names and fake
    hashes clearly labeled as examples. Include one pass, one external-target
    rejection, one race-ambiguous rejection, and one unknown-tag rejection.
13. Define a schema-conformance suite with positive, negative, boundary, and
    metamorphic cases. Require duplicate-key rejection, number-form rejection,
    unknown-field rejection, invalid UTF-8 rejection, noncanonical bytes, path
    collisions, count mismatch, and predecessor-hash mismatch.
14. Provide an implementation sequence that deletes the superseded reader,
    lands the sole new profile and owner together, proves no stale references,
    runs full tests, commits and remotely verifies the change, and only then
    permits a wholly new output-free build registration.
15. State objective gates that must pass before another real build is allowed.

Required report structure:

1. Executive architecture decision.
2. Normative vocabulary and trust model.
3. Canonical profile schema.
4. Entry and junction algebra.
5. Bounds and resource formulas.
6. Private/public receipt graph.
7. State machine and typed terminal taxonomy.
8. Atomic persistence algorithm.
9. Independent verifier design.
10. Canonical example documents.
11. Schema-conformance and adversarial tests.
12. Clean-cut implementation and deletion plan.
13. Objective preregistration gate.
14. Unknowns requiring local verification.
15. Annotated primary-source bibliography.

Do not propose an `allowReparse: true` field, a profile-version negotiation
layer, a reader that accepts both old and new schemas, warning-only unknown
fields, mutable receipts, post-hoc conversion of a failed terminal to pass, or
copying an executable out of a rejected root.

## Prompt 4: Auditable Native Inspection Boundary For A Node-Controlled Owner

You are an independent principal Node.js runtime engineer, Rust FFI architect,
and Windows native-security reviewer. Produce an exceptionally detailed report
selecting and designing the smallest auditable implementation boundary that
allows a Node-controlled build owner to obtain authoritative Windows reparse
metadata and handle identity. Target 10,000 to 18,000 words excluding the
bibliography. Compare alternatives rigorously and give one recommended design.

You may inspect current official Node.js, N-API, Rust, Cargo, Microsoft Win32,
Windows SDK, and package-signing documentation plus immutable public source
revisions. You have no access to the TinyRustLM codebase, package manifests,
local toolchain, private build roots, generated evidence, or tests. You must not
claim that any dependency is already present or that a proposed API works in
the private project.

Project-supplied facts and constraints:

- TinyRustLM is prelaunch, one product, and free to make a clean architectural
  replacement. No legacy reader, compatibility package, dual path, fallback,
  automatic retry, temporary script, ambient shell dependency, or accepted
  debt is permitted.
- The current build owner is project-supplied as Node-controlled and launches
  an exactly bound Rust/Cargo child in a deterministic MSVC environment. A
  previous operation terminally failed because its scratch inspector could
  detect a reparse entry but could not represent and prove a contained
  directory junction.
- The required correction needs no-follow Win32 handles, authoritative reparse
  tags/data, file and volume identity, component validation, bounded evidence,
  and pre/post drift checks. The owner may not trust Node path resolution alone
  or shell out to PowerShell, `cmd`, `fsutil`, or an unbound helper.
- A helper, if used, must itself be content-addressed, architecture-checked,
  preregistered, built once under custody, invoked with a bounded canonical
  protocol, and unable to mutate the inspected tree. Bootstrap circularity must
  be resolved explicitly.
- The build target is Windows x64. Public evidence cannot expose private paths,
  environment values, usernames, or raw streams. MemoryEndpoints is outside
  scope.

Research and address all of the following:

1. Inventory what current Node.js `fs` APIs expose for `lstat`, `Dirent`,
   `readlink`, real paths, file handles, BigInt stats, Windows file IDs, volume
   IDs, reparse tags, open-no-follow semantics, and directory-relative opens.
   Pin claims to current official documentation and public source where needed.
2. Compare five implementation strategies: pure Node.js; N-API native addon;
   Rust N-API addon; separately launched Rust inspector executable; and direct
   JavaScript FFI. Include security, audit size, build bootstrap, deployment,
   ABI stability, error fidelity, performance, deterministic packaging, and
   cross-platform behavior.
3. Determine the minimum native operations required. Prefer a narrow primitive
   protocol over exporting a general filesystem API. Define operations for root
   open, component no-follow open, reparse read, identity read, target direct
   open, and final reconciliation.
4. Resolve bootstrap circularity. The owner needs native inspection to qualify
   a build scratch tree, but a native helper may itself need to be built. Give a
   trust-minimized way to source, pin, build, capture, and authorize the helper
   before it inspects a later build. Compare checked-in source, checked-in
   binary, operating-system API bridge, and separately custodied prerequisite.
5. Specify a canonical IPC or addon-call schema. Include UTF-8/UTF-16 path
   representation, maximum request/response bytes, array bounds, duplicate-key
   rejection, status and Win32 error separation, binary reparse data encoding,
   request nonce, operation identity, and stdout/stderr prohibition or custody.
6. Define process restrictions for an executable helper: inherited handles,
   environment allowlist, working directory, job object, timeout, output caps,
   stdin closure, network denial where enforceable, executable hash check,
   PE machine check, and child-process prohibition.
7. Define addon restrictions: initialization side effects, Node ABI/N-API
   version, DLL search order, transitive DLL closure, panic/exception crossing,
   thread safety, async work, handle leaks, and process crash implications.
8. Describe the Rust unsafe boundary around `windows-sys`, `windows`, or manual
   bindings. Compare dependency footprint and generated bindings. Require RAII
   handle wrappers, exact buffer parsing, no unbounded allocation, and preserved
   `GetLastError` values.
9. Design read-only enforcement. Analyze access masks, share modes, APIs that
   might mutate metadata, directory enumeration side effects, opportunistic
   locks, and how to test that the helper cannot create, delete, rename, or
   retarget entries.
10. Define deterministic error mapping from Win32 codes and parser failures to
    project-level bounded errors without leaking absolute paths.
11. Provide a performance model for trees with up to `N` entries and `J`
    junctions. Compare per-entry process IPC, one batched inspection, and an
    in-process addon. Include handle and memory bounds.
12. Give at least 40 hostile protocol and native-boundary tests: malformed
    UTF-16, overlong paths, invalid tags, short buffers, helper replacement,
    wrong architecture, DLL hijack, timeout, output overflow, handle leak,
    target race, and addon panic.
13. Recommend one clean implementation and one explicit rejected alternative.
    Include module boundaries, build order, source/dependency pinning, test
    layers, and removal of the superseded inspection path.
14. State what can be unit-tested synthetically, what requires real NTFS
    junctions, and what requires a privileged or hostile race harness.

Required report structure:

1. Executive decision.
2. Current Node capability matrix.
3. Alternative architecture comparison.
4. Minimum native primitive set.
5. Bootstrap and supply-chain solution.
6. Canonical protocol or addon API.
7. Rust unsafe-code design.
8. Process/addon confinement.
9. Read-only and race guarantees.
10. Error taxonomy and public evidence.
11. Resource model.
12. Forty-case adversarial test matrix.
13. Clean implementation and deletion sequence.
14. Objective acceptance criteria.
15. Unknowns requiring local verification.
16. Annotated primary-source bibliography.

Do not recommend PowerShell inspection, `fsutil`, WMI, an unsigned downloaded
helper, a general-purpose privileged service, an addon with unbounded surface,
or retaining pure-Node and native implementations as fallback paths.

## Prompt 5: Hostile Windows Filesystem Laboratory, Fuzzing, And Race Injection

You are an independent principal test architect, Windows filesystem red-team
engineer, and property-based testing researcher. Produce an exceptionally
detailed report specifying a laboratory and automated test system that can
demonstrate whether a build-custody inspector safely handles direct entries and
same-root directory junctions under hostile mutation. Target 10,000 to 18,000
words excluding the bibliography. Every recommended pass condition must be
observable and every dangerous condition must have a deterministic expected
rejection.

You may browse official Windows filesystem, security-token, symbolic-link,
junction, job-object, process, and test-signing documentation; current Rust,
Node.js, fuzzing, and property-testing documentation; and public filesystem
test suites. You have no TinyRustLM source access, local machine access,
private paths, implementation details, generated artifacts, receipts,
credentials, or test output. Do not claim to have run any private test.

Project-supplied facts and constraints:

- TinyRustLM is prelaunch and may replace weak implementation cleanly. There is
  no legacy compatibility obligation. No mock-only gate, test skip converted to
  success, flaky retry, best-of-N race result, broad allowlist, filename-only
  exception, weakened assertion, or accepted debt is permitted.
- One one-shot Rust build is immutable terminal failure because its owned
  scratch tree contained an observed same-root Windows directory junction that
  the current blanket no-reparse contract could not represent. Its successful
  child exit and executable do not make it adoptable.
- A new sole inspector is intended to accept only a semantically proven,
  bounded, same-root direct directory junction without traversing it. It must
  reject external, cross-volume, chained, cyclic, dangling, file, unknown,
  duplicate-alias, case-conflicting, and race-ambiguous entries.
- The target development platform is Windows x64 with standard-user execution.
  Tests may have separately labeled developer-mode or elevated lanes, but the
  production predicate may not depend on elevation merely to inspect.
- Real filesystem fixtures are required for authoritative integration gates.
  Synthetic parser fixtures remain valuable but cannot prove Win32 behavior.
  MemoryEndpoints and live services are outside scope.

Research and address all of the following:

1. Define a test pyramid separating pure reparse-buffer parser tests, path and
   schema property tests, fake API state-machine tests, real NTFS fixture tests,
   race-injection tests, process-level custody tests, and full one-shot build
   tests. State the claim boundary of each layer.
2. Specify safe owned-root creation and deletion on Windows. The harness must
   prove the root is under a configured test parent, contains an unpredictable
   ownership marker, is not itself a link, is not a drive or share root, and is
   closed before bounded deletion. Recursive deletion must be impossible
   outside that root even when hostile links exist.
3. Define how to create real directory junctions without traversing them during
   setup or cleanup. Compare `CreateSymbolicLinkW`, reparse control codes,
   public Rust/Node APIs, and command-line tools. Clearly label privilege and
   developer-mode requirements.
4. Provide fixture-construction recipes for direct files/directories, benign
   same-root junction, junction to root, junction to ancestor, external same-
   volume target, different-volume target, UNC target, volume mount point,
   directory symbolic link, file symbolic link, dangling link, two-link chain,
   self-cycle, two-link cycle, unknown tag, and malformed reparse data where a
   safe test driver or parser fixture is required.
5. Design case, Unicode, separator, extended-prefix, trailing-dot/space, 8.3,
   alternate-data-stream, hard-link, sparse, compressed, encrypted, Dev Drive,
   ReFS, OneDrive, and projected-filesystem cases. State which are mandatory in
   CI and which belong in scheduled hardware laboratories.
6. Define a deterministic race coordinator. It should pause the inspector at
   named barriers and let an adversary process rename parents, replace the
   link, retarget it, replace the target, insert a chain, delete an entry, or
   add a file. Avoid timing sleeps as the primary synchronization mechanism.
7. Describe injectable API seams or a separately instrumented test build that
   permits barriers without shipping race hooks in production. Ensure tests do
   not create a second production implementation.
8. Provide a state-transition model suitable for model checking or systematic
   schedule exploration. Define operations, invariants, linearization points,
   terminal states, and state-space bounds.
9. Design fuzzers for raw reparse buffers, UTF-16 path components, canonical
   receipt JSON, tree inventories, and API-result sequences. Include corpus
   seeding, structure-aware mutation, shrinking, sanitizer use, crash triage,
   deterministic replay, and maximum input bounds.
10. Define property-based invariants: accepted links always target a strict
    same-root direct directory; no accepted inventory traverses a link; every
    direct entry appears exactly once; canonical output is order-independent;
    adding an unsupported entry cannot convert rejection to pass; and mutation
    cannot produce a pass without a stable final snapshot.
11. Specify process and handle leak detection after every case. Include open
    handles, child processes, locked directories, pending deletes, job-object
    membership, and how failures are preserved without contaminating later
    cases.
12. Define fault injection for access denied, sharing violation, disk full,
    path too long, malformed UTF-16, API short buffer, antivirus delay, helper
    crash, output overflow, timeout, parent disappearance, and machine restart.
13. Give a minimum matrix for Windows 11 standard NTFS, Windows Server, Dev
    Drive/ReFS where supported, case-sensitive directory mode, developer mode
    on/off, and administrator versus standard user. Never count cross-
    compilation as executed Windows evidence.
14. Specify evidence emitted by tests: seed, fixture recipe identity, OS/build,
    filesystem, privilege, executable hashes, barrier schedule, expected and
    actual typed verdict, inventory hash, and cleanup result. Exclude private
    absolute paths and usernames from public reports.
15. Provide at least 100 named test cases with setup, mutation schedule,
    expected result, and the exact property guarded. At least 30 must be real
    junction/reparse integration cases and at least 30 must be race schedules.
16. Define release gates: which exact suites must pass before the replacement
    custody profile can be committed, before a real preregistration can be
    created, and before a one-shot Rust child may launch.

Required report structure:

1. Executive test strategy.
2. Threat model and claim taxonomy by test layer.
3. Owned-root laboratory safety protocol.
4. Real fixture construction catalog.
5. Deterministic race-injection architecture.
6. Model-checking/state-exploration design.
7. Parser, schema, and path fuzzers.
8. Property-based invariants.
9. Platform and privilege matrix.
10. One-hundred-case hostile test catalog.
11. Leak, cleanup, and failure-preservation rules.
12. Evidence schema.
13. CI versus scheduled-lab gates.
14. Objective acceptance criteria.
15. Unknowns requiring local verification.
16. Annotated primary-source bibliography.

Do not recommend relying on mocks for the release gate, sleeping until a race
probably occurs, requiring administrator rights in production, recursively
deleting a path discovered through a link, rerunning flaky schedules until
they pass, or omitting hostile fixtures because the expected application only
creates one known junction.

## Prompt 6: Deterministic Windows Scratch Topology And Ambient-State Elimination

You are an independent principal Windows process-environment engineer, Cargo
and Rust build reproducibility researcher, and application-data isolation
architect. Produce a deeply technical report explaining why a hermetic build
may create or observe Windows known-folder junctions inside a synthetic home
tree and how to design the smallest deterministic child environment that
avoids unnecessary ambient state. Target 10,000 to 18,000 words excluding the
bibliography. The report must compare eliminating the source of the junction
with safely representing an unavoidable same-root junction; it may not assume
either answer in advance.

You may browse official Microsoft Known Folders, User Shell Folders, WinINet,
environment variable, process creation, profile, temporary-file, and
application compatibility documentation; official Cargo and rustup
documentation; current Git for Windows and Node.js documentation; and public
source code at immutable revisions. You cannot inspect TinyRustLM code, its
machine, its actual environment values, private scratch trees, raw build logs,
or generated evidence. Treat all project facts as unverified.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch product with no legacy or compatibility duty.
  The build path may be rewritten cleanly. Ambient fallbacks, inheriting the
  operator profile, automatic retries, cleanup after inspection, literal
  `Content.IE5` exceptions, and accepted debt are forbidden.
- A preregistered Windows x64 Rust build used an exact materialized MSVC/SDK
  environment, completed with exit code zero, and produced the expected PE.
  Custody still rejected the attempt because its owned scratch tree contained
  one observed junction:
  `home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5` to direct
  same-root target `home/AppData/Local/Microsoft/Windows/INetCache/IE`.
- The attempt is immutable and cannot be retried or repaired. A future attempt
  needs a new deterministic profile and wholly new roots.
- The build owner is expected to control `PATH`, `LIB`, `LIBPATH`, compiler and
  SDK variables, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, temporary
  directories, Cargo/rustup homes, and other admitted child variables. It
  should not expose private paths publicly.
- The correction must be general. Even if a cleaner environment prevents this
  particular link, the custody inspector still needs an honest bounded policy
  for any filesystem link it observes.
- Network access, package acquisition, automatic toolchain installation,
  MemoryEndpoints, and user-profile persistence are outside the one-shot
  offline build.

Research and address all of the following:

1. Map the Windows sources of truth for `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`,
   `HOME`, `APPDATA`, `LOCALAPPDATA`, `TMP`, `TEMP`, Known Folder APIs, registry
   User Shell Folders, loaded user profiles, and process tokens. Explain when
   environment overrides do and do not change API results.
2. Research the historical and current purpose of `INetCache`, `Content.IE5`,
   and the `IE` target. Determine which Windows components create the junction,
   whether creation is per-profile or on-demand, and which facts are documented
   versus requiring Process Monitor/ETW observation.
3. Inventory potential participants in an offline Rust build: Cargo, rustc,
   linker, resource compiler, manifest tool, Git metadata queries, Node owner,
   C runtime, Windows loader, certificate APIs, crash reporting, antivirus, and
   shell/known-folder libraries. Identify which might touch profile or cache
   directories even if no network request is made.
4. Define a strict environment allowlist for an offline
   `x86_64-pc-windows-msvc` Cargo build. For each variable, state whether it is
   required, optional, forbidden, synthesized, or inherited only after exact
   binding. Include locale, code page, time zone, proxy, telemetry, incremental
   compilation, color, terminal, Git, Cargo, rustup, and compiler cache fields.
5. Compare three topologies: one synthetic `USERPROFILE` with all application
   data beneath it; separately owned home/config/cache/temp roots; and an
   operating-system-created disposable local user profile. Evaluate privilege,
   determinism, link creation, cleanup, performance, and evidence complexity.
6. Determine whether precreating direct `INetCache/IE` and `Content.IE5`
   directories, omitting `LOCALAPPDATA`, redirecting Known Folders, loading a
   profile hive, or denying creation is correct, unsupported, or dangerous.
   Reject approaches that merely conceal evidence or depend on undocumented
   compatibility behavior.
7. Specify child working directory, drive-current directories such as `=C:`,
   DLL search behavior, `%CD%`, path normalization, and inherited handle rules.
8. Design an observation experiment using ProcMon, ETW, API tracing, or a
   constrained test process to attribute the first creator of the junction.
   Include filters, timestamps, process tree identity, event preservation,
   privacy redaction, and a no-inference rule when attribution is ambiguous.
9. Define pre-build and post-build scratch inventories. Explain whether an
   initially empty scratch is realistic, what explicitly seeded direct
   directories are permitted, and how every seed becomes part of the request.
10. Compare source-date reproducibility with environment hermeticity. Address
    timestamps, PDB paths, debug info, incremental state, temp filenames,
    Cargo target layout, and compiler/linker nondeterminism.
11. Provide a resource model for scratch, target, control, temp, Cargo home,
    rustup home, logs, page cache, and antivirus overhead. Include free-space
    admission and create-before-child restrictions.
12. Define typed failures for ambient path escape, unexpected variable,
    unexpected inherited handle, unregistered seed, profile API divergence,
    unexpected link, creator ambiguity, and post-build drift.
13. Give a decision framework: when should the system eliminate a junction by
    correcting environment topology, when may it accept a rigorously proven
    internal junction, and when must it fail closed?
14. Provide at least 40 controlled experiments varying environment topology,
    profile loading, Cargo configuration, process participants, and Windows
    editions. Give expected observations rather than invented outcomes.
15. Produce a recommended clean child-environment profile and a prioritized
    local investigation plan that does not consume another one-shot production
    build registration.

Required report structure:

1. Executive recommendation and confidence level.
2. Windows profile/Known Folder authority map.
3. `Content.IE5` junction origin research.
4. Build-process participant analysis.
5. Exact child-environment allowlist.
6. Scratch topology comparison.
7. Attribution experiment design.
8. Pre/post inventory and seeded-state contract.
9. Reproducibility and resource model.
10. Typed blocker taxonomy.
11. Forty-experiment matrix.
12. Decision tree: eliminate, represent, or reject.
13. Recommended clean implementation sequence.
14. Unknowns requiring local observation.
15. Annotated primary-source bibliography.

Do not recommend inheriting the interactive user's environment, setting every
plausible variable, deleting unexpected profile content after the build,
precreating a fake junction by filename alone, disabling the custody check, or
claiming a component created the link without attributable process evidence.

## Prompt 7: One-Shot Qualified Rust And Managed Build After A Custody Correction

You are an independent principal release engineer, reproducible-build
architect, and forensic process-custody specialist. Produce an exceptionally
detailed report defining the exact clean sequence for performing one new Rust
converter build and one new managed inspector build after a filesystem custody
contract has been corrected and independently tested. Target 10,000 to 18,000
words excluding the bibliography. Focus on preregistration, one-shot execution,
artifact qualification, crash semantics, and honest closure.

You may research official Git, Rust, Cargo, .NET SDK/MSBuild, Windows process,
job object, filesystem, PE/COFF, portable executable, canonical JSON, SLSA,
in-toto, and hashing documentation. You have no TinyRustLM source access,
private model/source trees, local paths, credentials, generated receipts,
toolchain installations, or test output. No private validation claim is
permitted.

Project-supplied facts and constraints:

- TinyRustLM is one unversioned prelaunch product. There is no legacy path to
  preserve. Compatibility readers, migrations, aliases, fallback compilers,
  repair, retry, best-of-N, output adoption, and accepted debt are forbidden.
- The intended source model is `Qwen/Qwen3-0.6B` at immutable public revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- One earlier build operation completed with exit code zero and created an x64
  converter, but custody terminally rejected its scratch tree because the then-
  current contract could not represent one contained Windows directory
  junction. That converter and all its roots are immutable failed evidence and
  must never be copied, executed, compared as a candidate, or adopted.
- A deterministic Windows environment was previously observed selecting
  Visual Studio 2022 installation `17.14.37531.7`, MSVC `14.44.35207`, Windows
  SDK `10.0.26100.0`, and target `x86_64-pc-windows-msvc`. These are project-
  supplied observations, not public proof that they remain installed.
- Before another build, the repository must contain one sole corrected custody
  profile/owner, all hostile tests must pass, the change must be committed and
  pushed, and a fresh fetch must prove local/tracking/FETCH_HEAD/direct-remote
  equality. Only then may a new output-free registration bind wholly new absent
  control, target, scratch, managed-build, controller, and composition names.
- Exactly one Rust child and one managed child may be launched if their
  respective preflights pass. A terminal failure prohibits every dependent
  phase. No cleanup or rerun changes the outcome.
- Generated model/build evidence remains outside Git. Public records exclude
  private paths, raw streams, usernames, machine IDs, credentials, and model
  bytes. MemoryEndpoints is unauthorized and disconnected.

Research and address all of the following:

1. Define the identity graph from source commit/tree through remote equality,
   custody profile, owner bytes, test closure, toolchain lock, environment
   authority, registration, request, process start, raw streams, inventory,
   executable, terminal, and independent verification.
2. Explain output-free preregistration without circularly requiring a future
   executable hash. Design a constrained future-capture rule that cannot switch
   package, target, profile, features, compiler, command, or output root.
3. Define exact remote verification before private material exists. Address
   force-push risk, branch identity, immutable commit/tree, annotated tag or
   transparency options, and direct remote comparison.
4. Specify absence and ownership proofs for every future root/name. Include
   canonical paths, direct-parent identity, no links, non-overlap, volume
   policy, case collisions, stale abandoned roots, and create-only semantics.
5. Define a read-only preflight that revalidates the registration, toolchain
   closure, environment lock, Git closure, profile/owner hashes, free space,
   process absence, and future-root absence without creating output.
6. Design process launch for Cargo and `dotnet`/MSBuild. Include exact
   executable identity, argument arrays, current directory, environment
   allowlist, inherited handles, Windows job object, process tree, timeout,
   binary stdout/stderr drains, maximum bytes, and terminal timestamps.
7. For Cargo, require `--locked`, offline behavior, exact target and profile,
   structured `--message-format=json`, one compiler-artifact selection, and no
   guessed target path. Explain how to reject multiple or missing executable
   artifacts.
8. For the managed inspector, define deterministic restore/build rules,
   lockfiles, NuGet source policy, RID, self-contained versus framework-
   dependent output, native assets, deps/runtimeconfig files, and executable
   identity. No network restore may occur inside an offline one-shot phase.
9. Define target, scratch, and control inventories with direct-entry classes,
   accepted internal junction evidence, bounds, streaming hashes, case rules,
   and pre/post reconciliation.
10. Specify PE architecture and format checks, imported DLL review, Authenticode
    observation, debug-path leakage scan, source-path leakage scan, symbol
    custody, and malware-scan claim boundaries.
11. Design terminal reconciliation for zero exit plus custody rejection, nonzero
    exit plus output, controller crash, child leak, timeout, stream overflow,
    disk full, machine loss, terminal collision, and ambiguous process state.
12. State which dependent phases remain absent after each failure. The system
    must not create a managed request after Rust terminal failure or a
    composition request after either build fails.
13. Define independent verification that does not trust the owner: canonical
    record checks, inventory rewalk without mutation, executable hash and PE
    checks, terminal exclusivity, process absence, and no unregistered names.
14. Give resource formulas for disk, RAM, handles, logs, target output,
    intermediate compilation, NuGet cache, and verification passes. Define
    fail-before-output reserves.
15. Provide a 50-case fault matrix and an exact operator state machine from
    source-controlled correction to permanent pass or permanent terminal
    failure.
16. Define the narrow claims enabled by qualified build evidence and list all
    prohibited model, conversion, parity, browser, quality, P2P, deployment,
    and campaign claims.

Required report structure:

1. Executive one-shot recommendation.
2. Identity and dependency graph.
3. Remote-exact prerequisite gate.
4. Output-free registration schema.
5. Root absence and ownership algorithm.
6. Rust build custody procedure.
7. Managed build custody procedure.
8. Inventory and internal-junction handling.
9. Process supervision and crash state machine.
10. Independent verification.
11. Resource formulas.
12. Fifty-case fault matrix.
13. Public/private evidence contract.
14. Objective acceptance checklist.
15. Prohibited downstream claims.
16. Unknowns requiring local verification.
17. Annotated primary-source bibliography.

Do not recommend reusing the previous successful executable, comparing two
builds and selecting one, deleting a failed root, restoring from an unpinned
package feed, relying on process exit code alone, or creating dependent output
before its prerequisite terminal pass exists.

## Prompt 8: Streaming Qwen3-0.6B Safetensors To A Complete SLM2 Composition

You are an independent principal transformer-runtime engineer, model-format
architect, and streaming conversion specialist. Produce an exceptionally
detailed report defining how to convert immutable `Qwen/Qwen3-0.6B` source
files into a compact, complete, verifiable browser-oriented composition without
loading or duplicating the whole model in memory. Target 12,000 to 20,000 words
excluding the bibliography. Use primary Qwen, Hugging Face, Safetensors,
tokenizer, transformer, and numerical-format sources wherever possible.

You may inspect public model cards, configuration and tokenizer files,
Safetensors documentation/source, Transformers source, Qwen technical reports,
Rust crates, WebAssembly documentation, and quantization literature. Pin model
and repository observations to immutable revisions. You have no TinyRustLM
source access, private source closure, converter, custom format schemas, model
output, local measurements, or evaluation data. Do not invent private format
details; mark every unknown requiring local verification.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch browser-local AI product. It may replace weak
  format or conversion code cleanly and has no legacy-reader requirement. No
  compatibility aliases, migrations, fallback converters, automatic retries,
  output repair, tensor-name guessing, silent defaulting, or accepted debt is
  permitted.
- The first source is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. A project-supplied content lock
  reports nine direct regular files totaling 1,519,207,688 bytes, including
  `model.safetensors` at 1,503,300,328 bytes.
- A project-supplied source inspection expects 311 physical source tensor
  entries and 310 logical tensors because a tied output tensor is physically
  redundant and must be proven byte/value equivalent by streaming comparison
  before any generated output is created. Do not assume this count from public
  sources; independently inspect the immutable public revision where possible
  and label any discrepancy.
- A successful project composition is expected to contain six technical
  artifacts: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`,
  `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. These names
  reveal identities, not their private schemas. Structural completion must be
  proven before runtime or quality evaluation, and it does not itself prove
  native inference, browser inference, conversational quality, P2P
  availability, or publication.
- Source bytes and generated bytes remain local/private. Public evidence may
  contain public revision, filenames, hashes, sizes, tensor names where safe,
  shapes, dtypes, counts, schema identities, and bounded statuses. The public
  website must not receive prompts or model bytes. MemoryEndpoints is outside
  scope.

Research and address all of the following:

1. Reconstruct the exact public Qwen3-0.6B architecture at the pinned revision:
   layer count, hidden size, intermediate size, vocabulary, head counts,
   grouped-query attention, head dimension, RoPE parameters, RMSNorm epsilon,
   activation, tied embeddings, biases, context limit, special tokens, and any
   sliding-window or rope-scaling behavior. Cite immutable files and primary
   documentation.
2. Enumerate expected Safetensors keys, shapes, dtypes, and byte sizes from the
   architecture. Provide formulas and a machine-checkable mapping table from
   source tensor roles to a runtime-neutral logical graph.
3. Specify strict Safetensors parsing: header length, maximum header bytes,
   duplicate JSON keys, allowed dtypes, dimensions, integer overflow, offsets,
   overlap, gaps, ordering, file length, alignment, unknown tensors, missing
   tensors, and trailing bytes.
4. Define tensor-name mapping without heuristics. Unknown, duplicate, missing,
   shape-mismatched, or role-conflicting names must reject the conversion before
   output creation.
5. Design the tied-output proof. Compare metadata aliasing, identical byte
   ranges, separate equal tensors, dtype/shape equality, chunked byte equality,
   semantic value equality, NaN representations, endianness, and hash binding.
   State the exact condition permitting one logical tensor.
6. Specify a streaming conversion plan with bounded buffers. Include tensor
   iteration order, transposition or packing, dtype conversion, quantization
   hooks, checksum accumulation, temporary storage, write-ahead metadata,
   failure cleanup rules, and create-only final promotion.
7. Minimize peak disk and memory without compromising evidence. Provide
   formulas for source mapping, read buffers, output buffers, quantization
   workspace, metadata, temporary members, page cache, and final verification.
8. Define numerical transformations for embeddings, Q/K/V/O projections,
   gated MLP projections, norms, rotary layout, and output head. Identify which
   can be byte-preserving and which require deterministic repacking.
9. Specify tokenizer extraction and validation from the pinned public files:
   vocabulary, merges or model type, added tokens, normalization, pretokenizer,
   decoder, special IDs, byte fallback, Unicode behavior, and exact encode/decode
   corpus. Do not assume the runtime uses Hugging Face code.
10. Specify chat-template extraction and semantic validation. Cover Qwen3
    thinking/non-thinking behavior, system/user/assistant roles, generation
    prompt, special-token placement, tool-related template branches if present,
    malformed templates, and a product decision to expose or disable unsupported
    modes explicitly.
11. Define `sampling`, `prompt`, and aggregate composition contracts at a
    runtime-neutral level. Bind model, tokenizer, template, context, special
    IDs, EOS rules, sampling profile, and component hashes so incompatible
    components cannot be mixed.
12. Design create-only transaction semantics for six components plus receipts.
    No terminal pass may exist until all members are flushed, re-read, hashed,
    structurally parsed, graph-resolved, and cross-bound.
13. Define independent post-conversion verification that uses a separate
    implementation or parser boundary where practical. Include complete tensor
    inventory, section offsets, hashes, graph references, tokenizer corpus,
    template vectors, and aggregate identity.
14. Provide corruption and fault cases: truncated header, offset overflow,
    source mutation, tied mismatch, disk full, output collision, crash after
    each member, malformed tokenizer, chat-template drift, unknown architecture
    field, and graph hash mismatch.
15. State objective structural acceptance criteria and every broader claim that
    remains prohibited until runtime, parity, browser, and quality evidence
    exists.

Required report structure:

1. Executive conversion recommendation.
2. Immutable public-source observation log.
3. Qwen3-0.6B architecture reconstruction.
4. Tensor inventory and role-mapping table.
5. Strict Safetensors parser contract.
6. Tied-output proof algorithm.
7. Streaming conversion and resource formulas.
8. Numerical layout transformations.
9. Tokenizer and chat-template extraction.
10. Six-component composition contract.
11. Atomic write and terminal state machine.
12. Independent verification design.
13. Fault and corruption matrix.
14. Objective structural acceptance checklist.
15. Unknown private format facts.
16. Annotated primary-source bibliography.

Do not recommend loading all tensors into RAM, guessing tensor roles by suffix,
silently dropping an unknown tensor, trusting a successful file write, repairing
malformed output, treating tied weights as equal without proof, or claiming
model quality from structural conversion.

## Prompt 9: Accuracy-Preserving Quantization And Compact Runtime Layout For Qwen3-0.6B

You are an independent principal model-compression scientist, low-bit kernel
engineer, and browser-inference performance researcher. Produce an
exceptionally technical report selecting an evidence-led quantization and
runtime-layout strategy for `Qwen/Qwen3-0.6B` that improves browser-local size
and speed without disguising quality loss. Target 12,000 to 20,000 words
excluding the bibliography. Include equations, bit budgets, kernel implications,
calibration design, and promotion experiments rather than a list of methods.

You may browse current peer-reviewed papers, official project repositories,
model cards, kernel documentation, WebAssembly SIMD/thread documentation, and
public implementations. Investigate public work using names such as
TurboQuant, TurboVec, Colibri, BitNet, GPTQ, AWQ, SmoothQuant, HQQ, AQLM,
QuIP/QuIP#, SpQR, K-quants, activation-aware quantization, vector quantization,
and KV-cache quantization. Resolve naming collisions and distinguish published
algorithms from unrelated products. Pin code observations to immutable
revisions. You have no TinyRustLM code, custom format schema, model bytes,
calibration corpus, runtime measurements, private evaluation cases, or browser
test artifacts. Never claim private performance or accuracy.

Project-supplied facts and constraints:

- TinyRustLM is one unversioned prelaunch browser-local product. It may replace
  weak kernels or layouts cleanly. There is no requirement for legacy model
  readers, compatibility aliases, fallback kernels, repair, automatic retries,
  best-of-N response selection, or accepted code debt.
- The first source candidate is `Qwen/Qwen3-0.6B` at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`; its project-supplied source
  closure is about 1.52 GB and primarily BF16 Safetensors.
- The product values practical conversation, common-sense constraints,
  ambiguity handling, source conflict, current-user precedence, multi-turn
  continuity, untrusted-memory handling, summaries, rewrites, structured
  output, code explanation, and direct treatment of lawful adult questions.
  Arithmetic may be delegated to a deterministic calculator.
- Conversion success, small file size, perplexity alone, public benchmark
  familiarity, and one attractive answer are not quality proof. Raw outputs
  must be preserved. Expected answers and sealed evaluation prompts may not
  enter calibration or training.
- The model must run through a Rust native runtime and a browser WASM runtime.
  Model bytes stay local or direct P2P; public sites must not proxy model bytes
  or prompts.
- A compact general champion may later be complemented by independently
  qualified specialists, but this report must first establish a credible full
  Qwen3-0.6B baseline. Do not propose omitting arbitrary layers or tensors as
  quantization.
- Technical format revisions are allowed, but product V2, legacy fallback, and
  parallel weak readers are forbidden. MemoryEndpoints is outside scope.

Research and address all of the following:

1. Reconstruct a parameter and byte budget for Qwen3-0.6B by tensor role. Give
   formulas for BF16, FP16, FP8 where applicable, INT8, 6-bit, 5-bit, 4-bit,
   3-bit, 2-bit, ternary, and codebook/vector-quantized storage including scales,
   zero points, codebooks, alignment, metadata, and tied embeddings.
2. Compare weight-only, weight-activation, activation-aware, outlier-aware,
   mixed-precision, vector, lattice, product, and binary/ternary quantization.
   State training, calibration, kernel, and hardware assumptions for each.
3. Investigate TurboQuant and TurboVec from their authoritative public sources.
   Explain their mathematical transforms, vector representation, error bounds,
   data layout, compute path, hardware assumptions, licenses, maturity, and
   whether their published claims apply to transformer weight matrices, KV
   cache, embeddings, or only narrower workloads.
4. Investigate Colibri and any relevant submodel, tensor-subset, or compact-
   specialist techniques. Distinguish actual learned conditional computation
   from simply deleting model tensors. State whether a complete general model
   can safely share immutable base tensors with specialist deltas or modules.
5. Compare post-training quantization with quantization-aware training for a
   0.6B model. Include Hessian/second-order methods, activation calibration,
   clipping, group size, per-channel versus per-group scales, symmetric versus
   asymmetric quantization, and outlier routing.
6. Design a mixed-precision assignment experiment by tensor role and layer.
   Consider embeddings, output head, first/last layers, attention projections,
   MLP up/gate/down, norms, and recurrently sensitive values. Prohibit choosing
   a profile after inspecting sealed final results.
7. Define a calibration curriculum excluded from sealed evaluation. Include
   ordinary dialogue, long context, code, JSON, multilingual text if supported,
   rare tokens, system/user role boundaries, and activation outliers. Specify
   sample counts as formulas and contamination controls.
8. Define native and WASM kernel layouts. Address packed word order, nibble or
   bit extraction, group alignment, SIMD128 lanes, integer dot products,
   widening, dequantize-on-load versus fused dequantization, cache tiling,
   transpose choices, tail handling, endianness, and deterministic scalar
   reference kernels.
9. Analyze browser constraints: WASM SIMD availability, threads and
   `SharedArrayBuffer`, cross-origin isolation, memory32 limits, memory growth,
   copy overhead, JIT warm-up, mobile thermal limits, and browsers lacking a
   desired SIMD primitive. Recommend one required current capability set rather
   than an indefinite fallback ladder.
10. Treat KV cache separately. Give exact byte-growth formulas using layer,
    head, head-dimension, token, batch, and dtype variables. Compare FP16/BF16,
    INT8, INT4, per-token/per-channel scaling, residual cache, sliding windows,
    and eviction. Define accuracy tests for long-context retrieval and recent-
    turn precedence.
11. Design an ablation matrix from unmodified source-framework baseline through
    unquantized converted model and each candidate quantization. Preserve raw
    outputs and fixed seeds. Measure model bytes, startup, peak memory, prefill,
    decode, energy where possible, and quality dimensions with confidence
    intervals.
12. Define no-cheat promotion budgets. Include maximum aggregate and critical-
    category regression, worst-case tails, stochastic repeat policy, human
    blinded review, source-versus-quantized paired comparisons, and a rule that
    size/speed cannot compensate for critical behavioral failure.
13. Analyze meaningful champion-plus-specialist storage. Compare full separate
    models, shared immutable base plus deltas, adapters, sparse experts,
    vocabulary/task heads, independently trained tiny specialists, and router
    overhead. Require cryptographic identity and independent qualification for
    every deployable composition.
14. Define custom-format metadata needed for quantization: algorithm, version,
    group geometry, scale dtype, codebook identity, tensor role, original dtype,
    layout, kernel contract, calibration lineage hash, and complete checksum.
15. Provide staged recommendations for a correctness baseline, first compact
    profile, performance profile, KV-cache profile, and later specialists. Give
    stop rules and likely dead ends.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Current primary-source landscape and license matrix.
3. Qwen3-0.6B parameter/byte budget.
4. Quantization mathematics and error mechanisms.
5. TurboQuant, TurboVec, and Colibri applicability analysis.
6. Mixed-precision and calibration design.
7. Native/WASM packed layout and kernels.
8. KV-cache compression plan.
9. Contamination-resistant experiment matrix.
10. Statistical and human quality gates.
11. Champion-plus-specialist composition options.
12. Format metadata and verification requirements.
13. Staged implementation sequence and stop rules.
14. Unknowns requiring local execution.
15. Annotated primary-source bibliography.

Do not recommend selecting the smallest file regardless of behavior, calibrating
on evaluation prompts, counting a paper's GPU kernel as browser evidence,
calling layer deletion quantization, silently falling back to a different
kernel, or treating multiple precision encodings of identical behavior as a
portfolio of distinct useful models.

## Prompt 10: Source-Framework, Rust-Native, And Converted-Graph Numerical Parity

You are an independent principal numerical-validation scientist, transformer
implementation auditor, and deterministic inference engineer. Produce an
exceptionally detailed report defining a layer-by-layer parity harness for
proving that a converted Qwen3-0.6B graph and Rust runtime implement the pinned
public source model rather than merely producing plausible text. Target 12,000
to 20,000 words excluding the bibliography. Include reference-vector design,
numeric tolerances, mismatch localization, and evidence binding.

You may inspect the immutable public Qwen3 model revision, official Qwen and
Transformers implementations, PyTorch numerical documentation, Safetensors,
tokenizer/template sources, Rust numerical libraries, and relevant
reproducibility research. Pin every public-code observation to an immutable
commit. You have no access to TinyRustLM code, converted bytes, source locks,
private prompts, runtime logs, evaluation output, GPUs, or browser artifacts.
Do not claim that any private layer is correct.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch product with no legacy runtime obligation. Weak
  operators or graph readers may be replaced cleanly. Compatibility modes,
  output repair, alternate hidden implementations, automatic retry, best-of-N,
  expected-token injection, and accepted numerical debt are forbidden.
- The first source is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`.
- The intended composition binds technical components named SLM2, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. These are format identities, not
  product generations. Their private schemas and current implementation are
  unavailable to you.
- Structural conversion is not inference proof. The required path must compare
  untouched source-framework observations with converted Rust-native
  observations under preregistered inputs and settings. Raw outputs are
  immutable evidence. A later quantized profile must be compared both with the
  source and with the unquantized converted baseline.
- Product quality emphasizes ordinary and multi-turn conversation, but this
  report concerns numerical and semantic implementation parity, not final
  behavioral promotion. MemoryEndpoints is outside scope.

Research and address all of the following:

1. Reconstruct the authoritative forward pass for Qwen3-0.6B: token embedding,
   RMSNorm placement, Q/K/V projections, head reshaping, Q/K normalization if
   present, RoPE, grouped-query expansion, attention scale and mask, softmax,
   output projection, residual ordering, gated MLP, final norm, and tied output.
2. Pin source-framework versions and identify behavior controlled by config,
   model code, tokenizer, generation config, chat template, PyTorch kernels,
   dtype, device, and attention backend. State how to disable nondeterministic
   or fused paths in the reference observation.
3. Design a reference-vector manifest with public-safe synthetic token IDs and
   optional private natural-language prompts. Bind model revision, dependency
   lock, Python environment, hardware, dtype, attention backend, seed, sequence
   length, mask, positions, and every captured tensor role.
4. Determine which intermediate values should be captured: embeddings, each
   layer's normalized input, Q/K/V before and after RoPE, attention scores or
   selected slices, softmax rows, attention output, MLP gates, residual output,
   final hidden state, logits, and KV cache. Balance diagnostic power with
   evidence size.
5. Define exact equality versus tolerance by transformation and dtype. Include
   BF16/FP16 conversion, FP32 accumulation, reduction order, FMA, SIMD, exp
   approximation, denormals, NaNs, infinities, signed zero, and quantized
   dequantization. Avoid one global epsilon.
6. Recommend metrics such as max absolute/relative error, ULP distance, cosine
   similarity, normalized RMSE, top-k agreement, logit rank correlation, KL or
   JS divergence, and token-sequence identity. State limitations and thresholds
   justified by propagation experiments rather than invented constants.
7. Design minimal diagnostic sequences: one token, repeated token, all special
   tokens, rare vocabulary IDs, two-token positional contrast, long RoPE
   positions, padding/mask variants, GQA-sensitive patterns, and context
   boundary cases.
8. Define tokenizer parity separately. Require exact bytes-to-IDs and IDs-to-
   bytes for Unicode normalization, combining marks, emoji, invalid byte
   fallback, whitespace, newlines, code, JSON, special tokens, and random byte
   corpora.
9. Define template and prompt parity. Require exact rendered bytes/token IDs for
   system, user, assistant, multi-turn, generation prompt, thinking mode or its
   explicit exclusion, special-token injection attempts, and malformed roles.
10. Define prefill and incremental decode parity. Compare full-sequence logits
    with token-by-token KV-cache logits at every position. Include cache reset,
    clone, truncation, context limit, and batch-size-one assumptions.
11. Design mismatch localization using bisection by layer/tensor and stable
    capture hashes. Explain how to distinguish tensor mapping, transpose,
    endian, RoPE, normalization, attention mask, softmax, and cache-layout
    defects.
12. Define deterministic generation comparisons for greedy decoding and fixed-
    seed sampling. Explain why identical token streams may be too strict for
    some floating implementations yet top-token divergence at a wide margin is
    a defect.
13. Design quantized parity as a bounded degradation analysis, not exact
    equality. Compare source, unquantized converted, quantized scalar reference,
    native optimized kernel, and browser kernel.
14. Specify evidence identities binding model bytes, tokenizer/template,
    runtime binary, graph, operator version, vector manifest, source script,
    raw observations, comparison tool, and verdict. Evaluator changes create
    new decisions without overwriting history.
15. Provide at least 60 parity cases and a TDD workflow for turning each real
    mismatch into a general regression without embedding a preferred final
    answer.
16. State the minimum evidence for claims of tokenizer parity, graph parity,
    native prefill parity, native decode parity, and quantized bounded parity.
    Keep browser and conversational-quality claims separate.

Required report structure:

1. Executive parity strategy.
2. Immutable source-framework authority lock.
3. Exact Qwen3 forward-pass specification.
4. Reference-vector manifest and capture plan.
5. Operator-specific numeric tolerances.
6. Tokenizer/template/prompt parity.
7. Prefill, decode, and KV-cache parity.
8. Mismatch localization decision tree.
9. Quantized degradation analysis.
10. Evidence graph and versioning.
11. Sixty-case parity matrix.
12. TDD and regression workflow.
13. Objective claim gates.
14. Unknowns requiring private execution.
15. Annotated primary-source bibliography.

Do not recommend checking only final generated text, choosing tolerances after
seeing a favored model, repairing logits, skipping difficult tokens, accepting
one correct greedy sequence as graph proof, or using a model-based judge to
decide numerical parity.

## Prompt 11: Browser-WASM Loading, Memory, KV Cache, And Interactive Decode

You are an independent principal WebAssembly runtime engineer, browser storage
architect, and local-inference performance specialist. Produce an exceptionally
detailed report defining a production browser path that loads a real compact
Qwen3-0.6B composition from local or direct-P2P bytes and performs responsive
multi-turn inference without uploading prompts or model data to a project
server. Target 12,000 to 20,000 words excluding the bibliography. Use current
browser and WebAssembly primary documentation and distinguish standardized,
shipping, origin-trial, and proposed capabilities.

You may inspect official WebAssembly, WHATWG, W3C, MDN where primary browser
documentation is unavailable, Chromium, Firefox, WebKit, Rust wasm toolchain,
and public inference-runtime sources at immutable revisions. You have no
TinyRustLM source, WASM binary, custom model format, browser traces, local model
file, P2P endpoints, credentials, or private prompts. Do not claim that a
feature works in the private application.

Project-supplied facts and constraints:

- TinyRustLM is one prelaunch browser-local chat product. It may replace weak
  runtime/storage code cleanly. No legacy browser path, compatibility fallback,
  hidden server inference, model proxy, automatic response retry, simulated
  assistant text, stale fixture, or accepted debt is allowed.
- The first intended source is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, converted into a composition that
  cryptographically binds model, tokenizer, template, sampling, prompt, and
  graph components.
- Model discovery should prefer a quality-qualified direct P2P artifact. If no
  verified artifact is available but a supported public source is selected,
  the product should begin an explicit real local conversion workflow through
  its authorized local companion. Downloading a `.txt`, `.ps1`, or JSON
  instruction file is not a model workflow.
- Model bytes remain local or flow directly between consenting peers. The
  public TinyRustLM and MiniModel sites may serve application/catalog metadata
  but must not receive prompts or proxy model pieces.
- Native Rust parity, structural conversion, browser load, browser inference,
  conversation quality, P2P reachability, and publication are separate claims.
  MemoryEndpoints is unauthorized and disconnected for this phase.

Research and address all of the following:

1. Give a current capability matrix for Chromium, Firefox, and WebKit/Safari on
   desktop and mobile: WASM SIMD, relaxed SIMD, threads, atomics,
   `SharedArrayBuffer`, cross-origin isolation, bulk memory, multi-memory,
   memory64, tail calls, exceptions, component model, WebGPU where relevant,
   File System Access, OPFS, storage quotas, and transferable streams.
2. Recommend one explicit minimum browser capability contract for the first
   production runtime. Unsupported browsers must receive truthful status rather
   than silently selecting a different inference implementation.
3. Define the complete byte path for local file selection, OPFS-cached model,
   direct P2P piece import, and local companion conversion output. Include
   content identity, streaming hash, manifest-first validation, piece bounds,
   cancellation, resumability, corruption quarantine, and atomic promotion.
4. Analyze browser file/storage APIs. Compare `File`/Blob slicing, File System
   Access handles, OPFS sync access handles in workers, IndexedDB Blob storage,
   Cache Storage, service workers, and memory mapping not available on the web.
   Recommend a sole current storage path and explicit import boundaries.
5. Minimize copies from stored bytes to WASM linear memory and kernels. Quantify
   unavoidable copies, JavaScript typed-array views, memory growth invalidating
   views, transfer versus share semantics, alignment, chunk size, decompression,
   and packed quantized tensor access.
6. Give memory formulas for model bytes, parsed metadata, runtime tensor views,
   temporary dequantization, activations, logits, tokenizer, conversation token
   history, and KV cache. Calculate symbolic budgets for Qwen3-0.6B at several
   weight and KV precisions rather than inventing device measurements.
7. Design a worker architecture for model loading, prefill, decode, tokenizer,
   P2P IO, and UI updates. Address one authoritative generation owner,
   cancellation, backpressure, progress events, worker crash, stale events,
   duplicate assistant rendering, and clean model switch.
8. Define SIMD and threading kernel strategy. Cover matrix tiling, quantized
   unpack/dequantization, reductions, softmax, RMSNorm, RoPE, GQA, MLP, cache
   locality, work partitioning, thread startup, oversubscription, and a scalar
   correctness oracle that is not shipped as a silent product fallback.
9. Design KV-cache allocation and growth. Include maximum context admission,
   fixed versus paged allocation, quantized cache, cache reset, incremental
   decode parity, cancellation, context truncation policy, and out-of-memory
   behavior before browser termination.
10. Define responsive generation: time-sliced event delivery, token batching,
    compositor responsiveness, progress truth, first-token and decode metrics,
    cancellation latency, background-tab throttling, visibility changes,
    mobile thermal pressure, and long-task observation.
11. Specify browser privacy and network assertions. Permit only declared static
    assets, catalog metadata, direct peers, and loopback companion traffic.
    Fail on prompt upload, project-hosted model bytes, unexpected telemetry,
    credential-bearing URLs, referrer leakage, or service-worker forwarding.
12. Define model and conversation lifecycle across reload, browser process
    restart, fresh profile, profile deletion, cache eviction, storage pressure,
    and explicit user removal. Do not confuse reload with fresh state.
13. Design parity and performance evidence binding browser build, OS, device
    class, WASM hash, composition hash, capability set, settings, raw token IDs,
    timings, peak memory where observable, and terminal status.
14. Provide a browser test matrix for desktop, narrow desktop, and mobile
    viewports; long model names; long outputs; keyboard and screen-reader use;
    reduced motion; cancellation; OOM; worker crash; corrupt P2P piece; stale
    service worker; duplicate token event; and model switch.
15. Define objective gates for real browser load, native/browser token parity,
    successful multi-turn chat, privacy, and user-ready status. List claims that
    still require independent quality or public-P2P evidence.

Required report structure:

1. Executive browser architecture.
2. Current capability matrix with dates.
3. Minimum supported-browser contract.
4. Local/P2P/conversion byte-flow state machine.
5. Storage and zero-copy analysis.
6. Complete memory and KV-cache formulas.
7. Worker and generation ownership design.
8. SIMD/thread kernel plan.
9. Responsiveness and cancellation contract.
10. Privacy/network allowlist.
11. Lifecycle and fresh-profile semantics.
12. Browser evidence schema.
13. Fault, responsive, and accessibility test matrix.
14. Objective acceptance gates.
15. Unknowns requiring local browser execution.
16. Annotated primary-source bibliography.

Do not recommend downloading an instruction text file, using a tiny fixture as
real-model proof, proxying model bytes through the website, sending prompts to
a server, hiding unsupported browsers behind a slow fallback, or counting a
page reload as profile deletion.

## Prompt 12: Honest End-To-End Promotion From Model Selection To User-Ready Chat

You are an independent principal AI product-release architect, semantic
evaluation lead, browser reliability engineer, and evidence auditor. Produce an
exceptionally detailed report defining the final promotion path for one real
Qwen3-0.6B-derived composition from public source selection through qualified
browser-local multi-turn chat. Target 12,000 to 20,000 words excluding the
bibliography. The design must prevent structural success, attractive demos, or
UI optimism from being misrepresented as a useful released model.

You may browse current primary model-evaluation research, official Playwright
and browser documentation, supply-chain and provenance standards, accessibility
standards, public model cards/licenses, and public P2P/security standards. You
have no TinyRustLM source, model files, converter, evaluation cases, raw model
outputs, browser artifacts, P2P services, deployment credentials, or private
receipts. Do not claim to have tested a private product or live service.

Project-supplied facts and constraints:

- TinyRustLM is one unversioned prelaunch browser-local AI chat product. There
  is no V2 product and no public predecessor to support. Everything may be
  rewritten to remove debt. Legacy readers, compatibility paths, migrations,
  aliases, shims, fallback implementations, response repair, hidden retries,
  best-of-N selection, stale documentation, weak tests, and knowingly deferred
  cleanup are forbidden.
- The first target source is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. A valid technical composition is
  expected to bind SLM2 model, Tokenizer2, Template2, Sampling2, Prompt2, and
  ACG2 graph identities. These numbered names are technical formats, not
  product generations.
- An earlier one-shot build completed but terminally failed custody due to an
  unrepresentable contained Windows directory junction. Its converter is
  immutable failed evidence and cannot be used. A clean custody correction and
  wholly new preregistered build must precede conversion.
- Model selection should be direct and useful: fetch and verify a qualified P2P
  composition when available; otherwise, for a supported public source, start
  an explicit authorized local conversion workflow. Downloading `.txt`, `.ps1`,
  or request JSON files for an ordinary user is a product failure.
- Model bytes remain local or direct P2P, and prompts remain local. Public
  project sites may provide application and catalog metadata but may not proxy
  model bytes or receive prompts.
- Quality priorities are conversational coherence, common sense, ambiguity
  handling, practical constraints, instruction following, source conflict,
  latest-user preference, multi-turn continuity, untrusted-memory treatment,
  summaries, rewrites, structured output, code explanation, and substantive
  treatment of lawful adult requests within narrow concrete harm boundaries.
- Arithmetic is secondary and may use a deterministic calculator. Evaluation
  answers and sealed prompts may not enter conversion, calibration, training,
  or hand-authored runtime rules.
- MemoryEndpoints is unauthorized and disconnected. No live memory claim or
  campaign credit is possible. Current campaign counters are project-supplied
  as `0/20` qualified models, `0/50` browser rounds, `0/25` live memory rounds,
  `0/40` externally proven P2P lanes, and `0/20` announcements.

Research and address all of the following:

1. Define a claim taxonomy from public-source-reviewed, acquired, structurally
   converted, independently verified, source-parity-proven, native-runtime-
   proven, browser-runtime-proven, conversation-screened, conversation-proven,
   P2P-available, catalog-announced, and production-deployed. Give minimum
   evidence and prohibited language for every state.
2. Design an end-to-end state machine beginning at model search. Include model
   card/license review, immutable revision, source lock, qualified P2P lookup,
   peer verification, local acquisition, conversion eligibility, local
   companion authorization, one-shot conversion, independent inspection,
   native parity, browser load, semantic evaluation, human review, and
   promotion.
3. Specify the user interaction when a P2P artifact exists, when peers are
   temporarily unavailable, when no qualified artifact exists but conversion
   is supported, when the source is too large, when the architecture is
   unsupported, and when license or provenance is ambiguous. No branch may
   silently download an instruction file or claim that work happened elsewhere.
4. Define model identity displayed to the user: source organization/model,
   immutable revision, artifact hash, quantization, size, context, license,
   qualification state, provenance, local/P2P origin, and last verification.
   Avoid aliases that permit duplicate bytes to appear distinct.
5. Design layered structural, numerical, semantic, browser, privacy, and human
   gates. State which layer is authoritative for which failure. An opaque LLM
   judge may assist triage but cannot be sole authority or rewrite an answer.
6. Define a contamination-resistant semantic suite with fixed preregistered
   cases, seeded generated holdouts, unseen paraphrases, metamorphic variants,
   multi-turn state changes, and sealed independent audit. Preserve raw outputs
   exactly. Do not choose an easy seed after seeing results.
7. Specify semantic invariants for ambiguity, conflicting dates/authorities,
   current-turn precedence over stale memory, unavailable resources and
   feasible fallback, quoted instructions as data, summaries, rewrites, JSON,
   code explanation, ordinary chat, and balanced lawful adult analysis.
8. Design stochastic statistics: declared product sampling profile, fixed seed
   schedule, per-case repeats only when preregistered, pass-probability
   confidence intervals, correlated failures, multiple comparisons, flaky
   infrastructure separation, and why best-of-N is invalid unless exposed as
   actual product behavior.
9. Define human review with blinded source-versus-converted comparisons,
   independent raters, adjudication, inter-rater agreement, critical-failure
   rules, over-refusal review, fabricated-certainty review, and no post-hoc
   answer editing.
10. Define real browser dogfood for the first model: clean owned profile,
    process restart, real file or P2P import, two to six turns, one assistant
    rendering per turn, completion/cancellation, scroll stability, responsive
    layout, accessibility, network capture, secret scan, process close, profile
    deletion, and deletion proof.
11. Specify privacy assertions over local/session storage, IndexedDB, OPFS,
    Cache Storage, service workers, URLs, referrers, logs, screenshots, traces,
    network captures, crash records, and companion communication. Fail on
    prompt upload, project-hosted model bytes, telemetry drift, or credentials
    in URLs.
12. Design P2P claim boundaries. Local loopback, LAN, NAT hairpin, and browser-
    local probes are not public reachability. State the evidence for direct
    piece transfer, complete hash verification, peer identity, outside-network
    proof, expiry, and removal of stale advertisements.
13. Define release and deployment evidence across Rust, WASM, browser assets,
    local companion, model metadata, documentation, and public sites. Include
    version/release date, last-published marker, change log, public HTTPS
    readback, source commit, artifact hashes, rollback, and no-secret scan.
14. Require documentation to change in the same releasable commit as behavior.
    Define operator, user, model-card, privacy, troubleshooting, and release-
    note content. A stale documentation site blocks release rather than becoming
    accepted debt.
15. Design a failure-to-regression workflow: preserve raw failure, add one
    general failing test plus positive/counterexamples, make a scoped clean
    correction, rerun only invalidated phases plus release gates, archive old
    evidence, update durable project memory, commit after every major green
    change, and deploy whenever all deployment gates pass.
16. Give a final objective checklist for one user-ready model. It must include
    distinct artifact identity, complete provenance, structural and parity
    evidence, native and browser inference, semantic quality, privacy, clean
    browser round, current docs, source-control push, and production readback.
    It must not claim MemoryEndpoints, public P2P, catalog, or campaign credit
    without their separate live evidence.
17. Provide a prioritized implementation plan from the current custody blocker
    through the first honest user test, with stop conditions and parallel work
    that remains valid behind each external blocker.

Required report structure:

1. Executive promotion recommendation.
2. Claim taxonomy and prohibited language.
3. Complete model-selection/conversion state machine.
4. User interaction and truthful status vocabulary.
5. Provenance and model-identity contract.
6. Layered evaluation authority matrix.
7. Semantic, metamorphic, and sealed-holdout design.
8. Statistics and human-review protocol.
9. Fresh-browser dogfood procedure.
10. Privacy and network contract.
11. P2P and catalog claim boundaries.
12. Release, deployment, documentation, and change-log gates.
13. Failure-to-regression workflow.
14. Final first-model acceptance checklist.
15. Prioritized implementation plan and blockers.
16. Unknowns requiring private or authorized production access.
17. Annotated primary-source bibliography.

Do not recommend a marketing-only demo, a tiny deterministic fixture, response
repair, seed shopping, opaque-judge-only scoring, a text/script/request-file
download as the user workflow, public model-byte fallback, mock memory or P2P
success, stale documentation, or declaring campaign progress from unit tests.

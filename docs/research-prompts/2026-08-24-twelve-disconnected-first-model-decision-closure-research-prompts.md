# Twelve Disconnected Research Prompts: First-Model Decision Closure

Each section below is a complete, self-contained assignment for a different
technical research agent. Send one whole prompt to one agent. The agents may
browse public websites, standards, papers, official documentation, immutable
public repositories, public model cards, and package registries. They do not
have access to any TinyRustLM source tree, private branch, local model, build
output, test result, receipt, browser profile, machine configuration,
credential, signing key, deployment account, internal service, or unpublished
evaluation case.

Every report must explicitly distinguish:

1. directly observed public facts;
2. sourced external facts;
3. project facts supplied by the assignment but not independently verified;
4. assumptions and inferences;
5. engineering recommendations; and
6. facts requiring local implementation or authorized production proof.

No agent may state or imply that it inspected, built, ran, tested, or validated
private TinyRustLM code. These assignments seek decisions, not broad surveys.
Each report must be exceptionally detailed, technical, implementation-oriented,
and decisive. It must use current primary sources wherever possible, identify
publication or update dates and immutable revisions, record the retrieval date,
compare credible alternatives, select one recommendation, and provide exact
contracts, state tables, schemas, algorithms, pseudocode, resource formulas,
fault matrices, stop rules, and objective acceptance criteria.

## Prompt 1: Exact Attempt Identity And Explicit Recovery After A Conversion Interruption

You are an independent principal transaction-protocol architect, durable-work
queue designer, and model-conversion reliability engineer. Produce an
exceptionally detailed, implementation-ready report that resolves how one
user-authorized source-to-model conversion operation should be identified,
reconciled, resumed, rejected, or superseded after parent-process failure. You
have internet access, but no access to TinyRustLM source code, private files,
operation journals, model bytes, test output, credentials, or machines. Do not
claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. There is no public installed population,
  compatibility obligation, migration requirement, old product path, fallback
  behavior, or permission to preserve technical debt. Technical identifiers
  such as SLM2, Tokenizer2, Template2, Sampling2, Prompt2, ACG2, and versioned
  schemas are exact contract names, not separate product generations.
- A user-owned desktop Companion performs a durable acquisition operation. It
  first seeks an eligible exact composition from direct peers. If no eligible
  peer is available and the user approves an immutable public source, it may
  acquire source files and invoke one canonical converter.
- One successful conversion creates a previously absent, create-only output
  root containing exactly six ordered composition artifacts: SLM2 model bytes,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. Bounded attempt,
  component, and terminal receipts close the evidence graph.
- A terminal pass and terminal rejection are mutually exclusive. Existing,
  incomplete, rejected, obsolete, or tampered output is preserved. It is never
  overwritten, repaired, renamed into success, deleted to hide failure, or
  automatically retried.
- A parent Companion journal records states conceptually equivalent to queued,
  peer discovery, peer fetch, peer verification, source acquisition,
  converting, composition verification, available, cancelled, and rejected.
- The parent may fail before launch, while the child runs, after the child has
  durably committed a valid terminal root, or while the parent is recording the
  final journal transition. The child might still be alive after a GUI or
  parent crash. PID and timestamp alone are not trusted identities.
- The logical request may be content-derived from approved source identity and
  conversion policy. A second user-authorized attempt must not collide with or
  overwrite the first attempt, yet arbitrary retries and best-of-N selection
  are forbidden.
- Windows and Linux are required. Large model files are streamed. Private
  paths and prompts must not appear in public evidence. MemoryEndpoints is
  unauthorized and outside this assignment.

Research current primary sources on idempotency keys, durable job systems,
transactional outboxes, content-addressed operations, append-only journals,
crash recovery, Windows Job Objects and process handles, Linux process groups
and pidfds, file locks, filesystem durability, cancellation, and retry safety.
Clearly separate API idempotency from computation attempt identity and from
artifact content identity.

Address all of the following in depth:

1. Define a complete identity vocabulary for user intent, normalized request
   bytes, request hash, logical operation ID, attempt ID, launch nonce,
   executable identity, source-lock identities, conversion-profile identity,
   output-root identity, terminal-receipt identity, composition identity, and
   six artifact identities. State which values are deterministic hashes, which
   are cryptographically random, and which are human-facing only.
2. Decide whether repeated submission of byte-identical user intent means
   idempotent observation of the existing logical operation, explicit creation
   of a new attempt, or rejection. Specify exact behavior for each journal
   state and explain how user authorization for a new attempt is represented.
3. Compare at least four designs: deterministic operation ID only; deterministic
   operation plus random attempt nonce; monotonic attempt ordinal under a
   logical operation; and content-addressed attempt roots with a separate
   intent record. Select one design and reject the others with concrete failure
   examples.
4. Define the immutable prelaunch intent record that must exist before the
   converter starts. Include schema ID, operation and attempt identities,
   normalized private source paths, source hashes, output root, executable
   path and hash, profile hash, resource limits, expected artifact inventory,
   cancellation policy, and maximum encoded size.
5. Design legal state transitions for a new attempt, current observation,
   explicit resume, explicit retry, cancellation, terminal rejection, durable
   pass discovered by reconciliation, and tamper blockage. Include compare-and-
   append semantics and concurrent caller behavior.
6. Resolve the absent-output-root case after restart. Distinguish never
   launched, launch failed, child still running, child exited before creating
   output, output deleted externally, and insufficient evidence. State whether
   each case is resumable, rejected, blocked, or requires operator action.
7. Resolve the incomplete-root case. State whether partial computation may ever
   continue. If continuation is allowed, require a preregistered checkpoint
   protocol that proves every partial byte and stage. If it is disallowed,
   explain how the preserved attempt becomes terminal and how a new output root
   is selected without losing the original evidence.
8. Resolve a valid terminal pass discovered while the journal still says
   converting, while a cancellation request is pending, or after the user has
   closed the UI. State which fact wins and why. Include a valid terminal
   rejection, pass-plus-rejection collision, malformed receipt, and unexpected
   inventory.
9. Specify process split-brain handling. A restarted parent must not launch a
   second converter while an orphaned first child may still own the attempt.
   Define the ownership proof, observation-only state, bounded waiting policy,
   and fail-closed path when ownership cannot be established.
10. Define idempotent UI and API semantics. A status poll, browser reload, app
    restart, or duplicate network request must never create another attempt.
    A deliberate retry must be visually and cryptographically distinct and
    must not become best-of-N answer selection.
11. Design cancellation at every boundary: before durable intent, after intent
    but before launch, during child work, after durable terminal pass, during
    parent verification, and during journal commit. Define cancellation receipt
    identity and precedence.
12. Define retention and garbage-collection rules for failed attempts. Include
    disk pressure, private evidence, operator deletion authorization, legal or
    audit retention, content references, and proof that active or terminal
    evidence is not accidentally removed.
13. Provide strict JSON examples for logical operation, attempt intent, launch,
    process ownership, cancellation, reconciliation observation, terminal
    state, and explicit-new-attempt authorization. Require duplicate-key and
    unknown-field rejection, bounded UTF-8, canonical hashing, and secret-safe
    public error codes.
14. Provide language-neutral pseudocode plus concrete C# and Rust sketches for
    create operation, start attempt, observe, reconcile, cancel, authorize new
    attempt, and append state with optimistic concurrency.
15. Build a complete race table covering two UI tabs, two Companion instances,
    duplicate starts, restart during launch, stale status clients, simultaneous
    cancel and pass, process exit during reconciliation, and disk-full during
    state append.
16. Design deterministic fault injection. Kill parent and child independently
    at every durability boundary; reuse PIDs; mutate intent; swap executable;
    replace a source lock; create foreign roots; delay file flush; and run two
    reconcilers. State expected preserved evidence and state after each test.
17. Define what ordinary CI can prove, what requires real Windows and Linux,
    what requires process-orphan tests, and what requires destructive power-cut
    testing.
18. Produce a staged clean-slate implementation plan that results in one
    operation model only. It must leave no compatibility reader, hidden retry
    path, alternate root convention, or ambiguous status.

Required report structure:

1. Executive decision and explicit assumptions.
2. Identity taxonomy and trust boundaries.
3. Alternatives considered and selected attempt model.
4. Normative state machine and transition table.
5. Prelaunch intent and process-ownership contracts.
6. Recovery decisions for absent, incomplete, rejected, valid, and tampered roots.
7. Explicit resume, retry, cancellation, and supersession semantics.
8. Strict schemas and canonical-hash rules.
9. Algorithms and C#/Rust pseudocode.
10. Race, threat, and fault-injection matrices.
11. Cross-platform evidence plan.
12. Prioritized implementation sequence and stop rules.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend automatic retries, PID-only ownership, timestamp-based stale
detection, output overwrite, deletion of failed evidence, converting a partial
root into success without preregistered proof, best-of-N selection, a generic
`passed` boolean, or a compatibility path. Do not invent current TinyRustLM
behavior or claim that any local recovery test has run.

## Prompt 2: Orphan-Proof Converter Process Ownership On Windows And Linux

You are an independent principal operating-systems engineer, Windows service
specialist, Linux process-supervision specialist, and adversarial local-process
researcher. Produce an exceptionally detailed report selecting one robust
cross-platform process-ownership design for a private desktop Companion that
launches a long-running model converter and must reconcile safely after parent
failure. You may browse public sources, but you have no access to TinyRustLM
code, executables, logs, process lists, test machines, credentials, or model
artifacts. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is prelaunch and can adopt one clean architecture. There is no
  need for compatibility with an earlier process manager, protocol, or install.
- A user-owned Companion launches one canonical Rust conversion executable.
  Conversion may run for a long time, consume substantial CPU and disk, and
  stream multi-gigabyte source files into one create-only six-artifact
  composition root.
- The parent must enforce bounded wall time, idle time, stdout/stderr size,
  memory where feasible, cancellation, and whole-process-tree termination. A
  child exit code or stdout statement is not durable success; an independently
  verified terminal composition root is authority.
- The parent can crash or be killed while the converter remains alive. The
  machine can sleep, resume, log off, reboot, or run multiple user sessions.
  A restarted Companion must neither kill an unrelated process nor start a
  duplicate converter for the same attempt.
- PID, parent PID, process name, executable path string, command line,
  timestamp, and lock-file age are individually insufficient identities.
- Source and output paths are private. No credential or private path may leak
  through command lines, crash reports, public logs, or process-list-visible
  arguments when an alternative exists.
- Windows x64, Linux x64, and Linux arm64 are target environments. A successful
  cross-compile is not executed-platform proof. MemoryEndpoints is outside the
  task.

Research current primary documentation for Windows Job Objects, process and
job handles, restricted tokens, named pipes, handle inheritance, mutex and file
locking, service/user-session isolation, process mitigation policies, CTRL
events, and termination. Research Linux pidfds, process groups, sessions,
`prctl`, parent-death signals, cgroups v2, systemd user services, file locks,
Unix sockets, namespaces, and signal semantics. Include .NET and Rust process
APIs only where official documentation establishes behavior.

Address all of the following in depth:

1. Define the threat and failure model: benign parent crash, power loss,
   malicious same-user process, PID reuse, executable replacement, command-line
   spoofing, inherited-handle leak, child spawning grandchildren, child
   detachment, suspended process, antivirus delay, debugger attachment, two
   parent instances, and user-session crossover.
2. Compare kill-on-parent-close ownership with survivable child ownership.
   Decide whether conversion should die with the Companion or continue through
   UI/parent restart. Quantify user experience, recovery complexity, evidence
   integrity, and duplicate-work risks.
3. On Windows, compare Job Objects with
   `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, a broker/service-owned job, duplicated
   job handles, process handles, named mutexes, lock files, named pipes, and a
   dedicated per-user service. Select one exact design.
4. On Linux, compare parent-death signal, pidfd, process group/session,
   cgroups v2, systemd user scope/service, `flock`, Unix-domain control socket,
   and a dedicated per-user daemon. Select one exact design with an arm64 path.
5. Define a common logical ownership protocol above platform primitives. Bind
   operation ID, attempt ID, random launch nonce, executable hash, parent
   instance, child acknowledgement, control-channel identity, and output-root
   identity.
6. Specify a prelaunch handshake that prevents PID races. Include creation of
   control primitives, passing handles or descriptors, child challenge-response,
   executable self-hash or trusted launch identity, durable launch record, and
   timeout behavior.
7. Decide how sensitive path and source-lock information reaches the child.
   Compare command-line arguments, environment variables, inherited anonymous
   pipes, named pipe/Unix socket, temporary sealed request file, and standard
   input. Analyze process listings, crash dumps, shell history, logs, ACLs, and
   cleanup.
8. Define startup reconciliation while an old child may still run. State how a
   new Companion finds the legitimate owner, authenticates the control channel,
   observes progress without taking ownership incorrectly, and handles a child
   that is alive but unresponsive.
9. Define takeover or non-takeover. If takeover is supported, specify a safe
   protocol and proof that only the rightful per-user Companion can adopt the
   child. If unsupported, specify truthful blocked state and bounded cleanup.
10. Design whole-tree cancellation and graceful shutdown. Include stop request,
    checkpoint prohibition or support, grace period, descendant enumeration,
    job/cgroup termination, exit observation, locked files, and evidence
    preservation.
11. Define resource governance: CPU priority, memory and commit limits, file
    descriptor/handle limits, I/O priority, disk quota or preflight, thread
    count, process count, and denial-of-service protection. Separate hard
    enforceable limits from best-effort telemetry.
12. Analyze sleep/resume, clock changes, hibernation, logoff, fast user
    switching, service restart, container/WSL boundaries, and reboot. Use
    monotonic time for timeouts and state what cannot survive reboot.
13. Define executable immutability during a run. Cover open-file handles,
    Windows replacement semantics, Linux unlinked executables, code signing,
    hash-before-launch versus hash-after-open, working directory, DLL/shared
    object search, environment sanitization, and child library loading.
14. Provide exact platform abstraction interfaces and pseudocode for create,
    launch, authenticate, observe, cancel, wait, dispose, and startup reconcile.
    Include Rust and C# API sketches without assuming private classes.
15. Provide public-safe error taxonomy and bounded event records. Logs must not
    contain command lines, private paths, model prompts, tokens, environment
    dumps, or arbitrary child output.
16. Design tests for PID reuse, forged mutex/lock, rogue control server,
    executable swap, grandchild escape, double parent, parent kill, child kill,
    blocked stdout, pipe closure, job/cgroup loss, logoff, sleep, and reboot.
17. Define minimum evidence on real Windows x64, Linux x64, and Linux arm64.
    Distinguish unit mocks, emulation, cross-compilation, virtual-machine
    execution, and real hardware execution.
18. Recommend one clean installation and update ownership boundary, including
    per-user ACLs, single-instance election, binary update while idle, rollback
    before launch, and refusal to update during an owned conversion.

Required report structure:

1. Executive cross-platform ownership decision.
2. Threat and failure model.
3. Windows primitive analysis and selected design.
4. Linux primitive analysis and selected design.
5. Common launch and child-authentication protocol.
6. Parent failure, orphan observation, takeover, and cancellation semantics.
7. Resource, path, executable, and library security.
8. Platform abstraction and pseudocode.
9. Error/event schema and privacy boundary.
10. Fault-injection and real-platform evidence matrix.
11. Installation, update, and single-instance rules.
12. Staged implementation plan with objective gates.
13. Unknowns requiring local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend PID files as authority, process-name matching, broad process
killing, trusting command lines, age-based lock deletion, silent child adoption,
unbounded output capture, a hidden detached helper, or separate compatibility
implementations. Do not invent the current Companion lifecycle.

## Prompt 3: Independent Verification Of A Terminal Six-Artifact Composition Without Stdout

You are an independent principal supply-chain verifier, binary-format security
engineer, and strict-parser architect. Produce an exceptionally detailed report
designing an independent verifier for a completed model-composition directory.
The verifier must establish success or typed rejection solely from durable
bytes and immutable identities, even when all child-process stdout, stderr,
exit status, timing, and in-memory results were lost. You have no access to
TinyRustLM source code, format implementations, private schemas, artifacts,
receipts, test output, or machines. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product with one accepted composition contract.
  There is no old format, migration reader, permissive fallback, repaired
  response, or alternate success path.
- One complete composition has exactly six ordered members: SLM2 model,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. The ACG2 graph closes the
  member identities and their semantic relationships.
- Conversion consumes exact immutable model and tokenizer source locks, an
  exact conversion profile, and one exact converter executable identity. It
  creates one previously absent root and bounded attempt, component, and
  terminal receipts.
- The parent process must verify an existing terminal root after restart. It
  may not recreate a lost stdout summary, infer success from exit code, trust a
  terminal `passed` field alone, repair JSON, ignore extra files, or rewrite
  receipts.
- The verifier streams large files, rejects unsafe paths and links, uses strict
  bounded parsing, and produces public-safe bounded findings. Private paths,
  source contents, prompts, and raw credentials stay outside public evidence.
- A valid pass, valid rejection, incomplete root, malformed root, foreign root,
  and pass/rejection collision are distinct outcomes. MemoryEndpoints and live
  campaign counts are outside this assignment.

Research primary sources for secure archive and directory validation,
TOCTOU-resistant file opening, symlink and Windows reparse-point defense,
strict JSON/I-JSON/duplicate-key handling, canonical JSON and deterministic
CBOR, cryptographic hash agility, content-addressed graphs, in-toto/SLSA-style
provenance, Merkle DAGs, large-file hashing, safetensors validation, and Rust
and .NET filesystem APIs.

Address all of the following in depth:

1. Define the verifier trust root. State which expected identities are supplied
   out of band from the immutable parent intent and which may be learned from
   the root. Explain why the root cannot authenticate itself.
2. Define exact inventory policy. Compare fixed filenames, manifest-declared
   filenames, ordered member slots, subdirectories, component receipts, one
   terminal receipt, and an ownership marker. Select one canonical inventory
   and reject undeclared files, alternate casing, Unicode aliases, streams,
   links, devices, and nested roots.
3. Define secure path opening on Windows and Linux. Cover absolute/relative
   normalization, drive and UNC paths, reserved names, case sensitivity,
   alternate data streams, hard links, symlinks, junctions, reparse points,
   mount crossings, race-free handles, and file identity rechecks.
4. Define bounded parsing for every JSON or binary header. Require maximum
   file and field sizes, maximum nesting, duplicate-key rejection, unknown-field
   policy, UTF-8 validity, number grammar, canonical hash representation,
   trailing-byte rejection, and denial-of-service protection.
5. Define streamed verification order that minimizes wasted I/O while never
   trusting unverified metadata. Include root ownership, intent binding,
   terminal exclusivity, receipts, small artifacts, ACG2 closure, SLM2 header,
   and full large-file hash.
6. Define structural verification for each artifact kind without inventing the
   private format. State the minimum generic invariants a format-specific
   parser must expose: schema ID, version, length, checksum, model dimensions,
   vocabulary closure, template/tokenizer relationship, sampling limits,
   prompt contract, graph references, and trailing data.
7. Define source and tool lineage closure. Verify model lock hash, tokenizer
   lock hash, immutable source file hashes, license decision identity,
   conversion profile, converter executable, converter source revision,
   operation and attempt IDs, and expected output root.
8. Distinguish content identity from semantic acceptance. Exact hashes prove
   which bytes exist but not model quality, native numerical correctness,
   browser execution, or conversation usefulness. Design explicit claim levels.
9. Define terminal pass verification. Require all component receipts, exact
   artifact order, sizes and hashes, graph closure, no rejection receipt, and
   independent parse. Define terminal rejection verification and what evidence
   it may safely omit.
10. Define classification precedence for pass plus rejection, duplicate
    receipts, stale receipt, unknown attempt, changed converter, changed source
    lock, unexpected artifact, incomplete write, zero-length artifact, hash
    mismatch, malformed header, and I/O uncertainty.
11. Design a verifier API that separates durable composition facts from live
    process observations such as duration and stdout hash. A recovered valid
    composition must not require fabricating live-only fields.
12. Compare one shared Rust verifier called through a narrow ABI, independent
    Rust and C# implementations, and a C# orchestrator over format-specific
    Rust parsers. Select an architecture that avoids both duplicated semantic
    authority and circular self-verification.
13. Provide normative result types for verified composition, verified terminal
    rejection, incomplete evidence, foreign/tampered evidence, resource
    failure, and verifier defect. Do not reduce them to one boolean.
14. Provide strict schema examples for expected-intent input, per-file finding,
    member record, lineage record, terminal decision, and public-safe evidence.
    Include deterministic serialization and maximum sizes.
15. Provide streaming pseudocode and Rust/C# sketches for safe open, inventory,
    strict read, file hashing, graph closure, result construction, and
    cancellation. Explain TOCTOU boundaries that remain.
16. Design malicious fixtures: duplicate JSON keys, overlong numbers, Unicode
    confusables, case collisions, sparse huge files, short reads, growing file,
    replaced file, hard link, symlink, reparse point, alternate stream, extra
    file, receipt cycle, hash cycle, pass/rejection collision, and decompression
    bomb if compression is permitted.
17. Design independent differential tests where converter and verifier are
    developed from the same public contract but do not share receipt-writing
    code. Include mutation testing and parser fuzzing.
18. Define CI, cross-platform, and physical-filesystem evidence required before
    this verifier may promote a composition to available.

Required report structure:

1. Executive verifier architecture and assumptions.
2. Trust roots, identity graph, and claim boundaries.
3. Canonical directory and receipt inventory.
4. Cross-platform secure-path and TOCTOU model.
5. Strict parser and resource-limit contract.
6. Verification order and artifact-specific interfaces.
7. Pass, rejection, incomplete, and tamper classifications.
8. Durable result types and API boundary.
9. Normative schemas and pseudocode.
10. Malicious fixture, fuzz, mutation, and differential test plan.
11. Cross-platform evidence matrix and acceptance criteria.
12. Prioritized implementation sequence.
13. Unknowns requiring private format verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend trusting stdout, exit code, path existence, a self-asserted
manifest, one `passed` field, permissive JSON, filename extensions, repaired
receipts, ignored extra files, or duplicated compatibility verifiers. Do not
claim that any TinyRustLM composition has passed this design.

## Prompt 4: Numeric-Loopback Discovery And Installation Without A Fixed Unsafe Port

You are an independent principal browser-platform architect, local-application
protocol designer, and desktop installation security engineer. Produce an
exceptionally detailed report selecting one usable and secure method by which
an HTTPS web application can discover and connect to its user-owned desktop
Companion on explicit numeric loopback without a fixed globally vulnerable
port, hostname trust, browser extension, instruction-file download, or public
proxy. You have no access to TinyRustLM source code, deployed assets, local
ports, installers, certificates, logs, credentials, or browser profiles. Do
not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is a prelaunch browser-local AI chat product. It can choose one
  clean installation and browser-connection protocol and delete all alternate
  experiments before launch.
- The public site is HTTPS. Model inference is local. Prompts and model bytes
  must not be sent to project servers. The site may supply static application
  assets and public metadata.
- The desktop Companion performs direct-P2P acquisition and deterministic local
  conversion. Browser interaction with it is allowed only through an exact,
  closed, capability-authorized HTTP/1.1 protocol on numeric loopback. The
  initial accepted IPv4 address is exactly `127.0.0.1`; `::1` may be added only
  if independently proven. Wildcard, LAN, hostname, mDNS, public, and
  project-hosted model-byte listeners are forbidden.
- No current port, route, media type, installer behavior, or discovery method
  is authoritative. The protocol must be preregistered before implementation.
- A browser page must not scan large port ranges, probe unrelated local
  services, weaken CORS or Private Network Access, trust a response merely
  because it came from loopback, or silently install anything.
- Installation and pairing require clear user presence. Session credentials
  must not appear in URLs, cookies, referrers, localStorage, browser history,
  command lines, screenshots, or public logs. MemoryEndpoints is unauthorized
  and outside this task.

Research current primary sources for secure contexts, potentially trustworthy
loopback origins, Fetch, CORS, Private Network Access, mixed content, CSP
`connect-src`, service workers, WebSockets if considered, custom URI schemes,
app links, native messaging, browser extension constraints, WebTransport,
TLS on loopback, local certificate trust, DNS rebinding, port allocation, IANA
guidance, Windows and Linux per-user installation, and browser launch behavior.
Test current claims against official Chromium, Firefox, and WebKit/Safari
documentation where available; record version and date sensitivity.

Address all of the following in depth:

1. State the exact browser security constraints for HTTPS-to-HTTP numeric
   loopback Fetch in current Chromium, Firefox, and WebKit. Separate standards,
   implemented behavior, experiments/flags, and uncertain future policy.
2. Compare at least six discovery designs: one registered fixed port; a small
   preregistered port set; OS-assigned ephemeral port plus user-entered code;
   custom URI scheme returning through a browser channel; loopback rendezvous
   file exposed through user action; browser extension/native messaging; and
   local TLS with a stable port or certificate. Reject any design that violates
   project constraints.
3. Select one first-release design. Specify how the page learns exactly one
   numeric address and port without broad scanning, project-server mediation,
   hostname resolution, clipboard dependence, or placing a capability in a URL.
4. Define the install-detection experience when the Companion is absent,
   installed but stopped, installed but unpaired, busy, incompatible with the
   exact technical contract, or blocked by browser policy. Status text must be
   truthful and actionable without downloading a text/script instruction file.
5. Define user-presence installation and first launch. Cover signed installer,
   package source, per-user versus machine install, elevation, update channel,
   executable identity, one-instance ownership, firewall behavior, and no
   silent router or firewall changes.
6. Define loopback bind rules: numeric address, ephemeral/fixed port selection,
   exclusive bind, prebinding all required sockets, address family, reuse
   options, wildcard rejection, inherited listeners, and collision behavior.
7. Define a public, unauthenticated discovery surface if one is unavoidable.
   Minimize it to constant-size non-sensitive data, rate-limit it, bind it to
   exact origin and installation identity, and explain why it cannot become a
   cross-site oracle or local-service fingerprint.
8. Analyze DNS rebinding even though numeric loopback is required. Cover Host
   validation, absolute-form requests, proxy behavior, forwarded headers,
   IPv4-mapped IPv6, decimal/octal/hex IP forms, redirects, service workers,
   and browser cache poisoning.
9. Define exact CORS and PNA behavior. Include allowed Origin bytes, preflight,
   methods, request/response headers, credentials mode, `Vary`, null/file/data
   origins, redirects, caching, and failure response behavior.
10. Define CSP and website deployment requirements. Include `connect-src`,
    frame/embed policy, referrer policy, COOP/COEP interactions, service-worker
    scope, cache busting, asset hashes, and public HTTPS readback.
11. Define protocol-version negotiation without an old protocol fallback.
    A mismatch must produce a typed terminal incompatibility and guide one
    clean update; it must not probe multiple route families or downgrade.
12. Define multi-user and multi-session isolation on shared Windows and Linux
    machines. A page in one OS account must not find or control another user's
    Companion.
13. Define privacy and telemetry boundaries. Discovery must not expose model
    inventory, private paths, user identity, operation history, tokens, prompts,
    network topology, or diagnostic dumps.
14. Provide an exact sequence diagram from page load through install detection,
    user launch, numeric endpoint discovery, pairing handoff, authenticated
    capability establishment, operation use, page close, and token destruction.
15. Provide normative discovery/install manifest schemas, maximum sizes,
    timeout and retry budgets, HTTP status/error taxonomy, and UI state table.
16. Design adversarial tests from a malicious website, iframe, extension,
    local process, proxy, second OS user, stale service worker, port squatter,
    DNS rebinding server, origin lookalike, and downgraded Companion.
17. Define a real-browser matrix covering ordinary and private windows,
    Chromium/Firefox/WebKit where supported, Windows/Linux, IPv4, disabled
    Companion, stale Companion, and policy changes. No developer flags may
    satisfy production evidence.
18. Produce a clean implementation and deployment sequence with an output-free
    preregistration gate before any listener or route output is created.

Required report structure:

1. Executive discovery and installation recommendation.
2. Current browser/standards fact matrix with dates.
3. Alternatives and rejection rationale.
4. Selected numeric-loopback discovery protocol.
5. Installation, launch, bind, and multi-user lifecycle.
6. CORS, PNA, CSP, mixed-content, and DNS-rebinding controls.
7. Exact sequence, schemas, limits, and UI states.
8. Privacy and local-attack threat model.
9. Adversarial and real-browser test matrix.
10. Output-free registration and implementation plan.
11. Objective acceptance criteria and stop rules.
12. Unknowns requiring local/browser verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend broad port scanning, wildcard/LAN binding, localhost hostname
trust, a capability in a query string, permissive CORS, disabled browser
security, a public relay, browser extension as an undeclared requirement,
silent installation, instruction-file downloads, or protocol downgrade. Do not
invent current TinyRustLM ports or deployment behavior.

## Prompt 5: User-Presence Pairing And A Least-Privilege Loopback Capability

You are an independent principal application-security architect,
capability-system researcher, browser cryptography engineer, and local-service
penetration tester. Produce an exceptionally detailed, implementation-ready
report selecting one exact user-presence pairing and session-capability
protocol between an HTTPS TinyRustLM browser application and a private desktop
Companion on numeric loopback. You may browse public sources. You have no access
to TinyRustLM code, ports, route tables, tokens, browser profiles, installations,
logs, credentials, or test output. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. It may adopt one clean security protocol
  and delete all alternative experiments. There is no old token, route,
  migration, compatibility, downgrade, or fallback requirement.
- The browser application is served from one exact HTTPS production origin.
  The Companion listens only on explicit numeric loopback and exposes a closed,
  preregistered HTTP/1.1 API. It never binds wildcard, LAN, or public addresses.
- The Companion may discover or acquire an exact model composition, convert an
  explicitly approved immutable source, expose bounded status, stream exactly
  six verified artifacts, and accept cancellation. It must not expose arbitrary
  files, commands, environment data, diagnostics, prompts, credentials, generic
  proxying, or unrelated local services.
- A complete composition is exactly SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2. Every operation and artifact is content-bound.
- Pairing requires explicit user presence. Browser credentials are session-only
  by default and are destroyed when the page/session ends. A persistent secret
  would require a separate explicit product design and is not part of the
  first protocol.
- Secrets must not appear in URLs, query strings, fragments sent to servers,
  cookies, referrers, browser history, localStorage, IndexedDB, Cache Storage,
  service-worker state, command lines, screenshots, traces, analytics, crash
  logs, clipboard by default, or public reports.
- The threat model includes hostile websites, iframes, extensions, local
  unprivileged processes, port squatters, DNS rebinding, replay, stale tabs,
  same-origin script compromise, multiple OS users, and accidental leakage.
  Full compromise of the user's OS account may be declared out of scope only
  with explicit residual-risk language.
- Model bytes and prompts stay local or move directly between consenting peers.
  MemoryEndpoints is unauthorized and outside this task.

Research current primary sources on capability security, OAuth proof-of-
possession concepts where relevant, Web Crypto, CSPRNGs, HKDF/HMAC, ephemeral
keys, origin binding, CSRF, CORS, Private Network Access, DNS rebinding,
constant-time comparisons, bearer-token leakage, replay caches, channel
binding, local IPC, browser lifecycle, and secret erasure limitations. Prefer
standards and official browser/OS cryptography documentation over blogs.

Address all of the following in depth:

1. Define assets, principals, and trust boundaries: website origin, top-level
   browsing context, tab, Worker, service worker, Companion installation,
   Companion process instance, OS user, operation, model composition, peer,
   and project server. State which parties must never receive prompts or model
   bytes.
2. Compare bearer capability, per-request HMAC, ephemeral browser signing key,
   mutually authenticated ephemeral key exchange, one-time pairing code, QR
   code, user-entered code, OS confirmation dialog, and custom-URI launch
   challenge. Select the minimum design that provides meaningful protection on
   plaintext numeric loopback without pretending loopback is confidential from
   same-user malware.
3. Define user presence precisely. A button click in a malicious webpage is not
   sufficient by itself. Specify the Companion-owned UI or OS affordance,
   displayed origin and installation identity, challenge confirmation, timeout,
   cancellation, accessibility, and anti-clickjacking behavior.
4. Specify the bootstrap request and response byte-for-byte at the semantic
   level: exact method/path, Origin handling, media type, body fields, nonce
   entropy, size limits, preflight, timeout, and constant-size errors. The
   bootstrap surface must reveal no model or user information.
5. Define a challenge-response protocol bound to exact HTTPS origin, numeric
   endpoint, Companion installation key or identity, process instance,
   browser ephemeral key, top-level user confirmation, protocol profile, issue
   time, expiry, and random nonces. Explain canonical encoding and signature or
   MAC input.
6. Decide whether the Companion needs a long-lived installation key. If yes,
   specify generation, secure storage, ACLs, rotation, update continuity,
   compromise recovery, backup prohibition, public-key display, and uninstall.
   If no, explain how the browser authenticates the intended Companion rather
   than a port squatter.
7. Define the resulting capability. Include unguessable identifier, proof-of-
   possession or bearer semantics, allowed origin, operation scopes, artifact
   scope, process instance, expiration, inactivity limit, request count or rate
   limits, and non-exportability assumptions.
8. Define least privilege for each route: capability creation, operation start,
   status, cancel, manifest, artifact streaming, and capability revocation.
   Explain why no wildcard scope or ambient installation-wide token is needed.
9. Specify request authentication and replay resistance. Include request method,
   normalized target, selected headers, body hash, monotonic sequence or nonce,
   clock independence where possible, replay-cache bounds, parallel requests,
   streaming bodies, and cancellation.
10. Define origin and browser-context binding. Cover exact byte comparison,
    default ports, trailing dots, punycode, case, subdomains, preview origins,
    `null`, file/data/blob origins, sandboxed iframes, opener navigation,
    bfcache, tab duplication, and same-origin compromised script.
11. Define token custody in JavaScript. Compare main-thread closure, dedicated
    Worker, SharedWorker, service worker, Web Crypto non-extractable key,
    `CryptoKey` transfer, page reload, bfcache, DevTools, extensions, crash
    dumps, and garbage collection. Select one design and state unavoidable
    limitations honestly.
12. Define teardown and revocation on page close, navigation, timeout, Companion
    restart, browser crash, installation update, suspected leak, and explicit
    disconnect. Account for unreliable unload events.
13. Analyze CSRF, CORS, PNA, DNS rebinding, request smuggling, Host spoofing,
    malicious localhost services, response confusion, content sniffing,
    redirects, cache poisoning, WebSocket upgrade, and HTTP proxy interference.
14. Define safe HTTP errors. Unauthorized callers must not distinguish installed
    models, active operation, valid capability IDs, user identity, or file
    existence. Authorized errors must be typed and bounded without reflecting
    attacker strings.
15. Define multi-tab and multi-user behavior. Decide whether each tab pairs
    separately, whether a tab may delegate a capability, how concurrent tabs
    contend for one operation, and how OS account/session boundaries are
    enforced.
16. Provide normative schemas and canonical-signature examples for bootstrap,
    challenge, confirmation, capability grant, authenticated request,
    authenticated response, revoke, and audit event. Include maximum sizes and
    cryptographic algorithm agility without downgrade.
17. Provide protocol pseudocode for browser, Companion, and user-presence UI.
    Include CSPRNG failure, clock change, duplicate response, lost response,
    process restart, replay, and cancellation.
18. Design an adversarial test matrix: malicious origins, iframe, compromised
    service worker, extension, port squatter, forged Companion, second local
    user, replayed grant, stolen bearer, request mutation, sequence wrap,
    origin lookalike, race, and resource exhaustion.
19. Define exactly which cryptographic and browser facts require local proof,
    which can be unit-tested with public vectors, and which require independent
    security review before release.
20. Provide a clean implementation sequence beginning with output-free protocol
    registration and ending with real-browser negative and positive tests.

Required report structure:

1. Executive security decision and assumptions.
2. Assets, principals, scope, and residual risk.
3. Alternative pairing/capability designs and rejection rationale.
4. Normative user-presence and bootstrap protocol.
5. Installation identity, key custody, and rotation.
6. Capability scope, proof, replay resistance, and teardown.
7. Browser secret custody and lifecycle.
8. HTTP, origin, CORS, PNA, and local-attack defenses.
9. Exact schemas, canonical bytes, and pseudocode.
10. Threat and adversarial test matrix.
11. Independent review and acceptance gates.
12. Prioritized implementation plan and stop rules.
13. Unknowns requiring browser/local verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend a token in a URL, cookie authentication, localStorage,
permissive CORS, origin reflection, hostname trust, a static shared secret,
long-lived browser bearer by default, silent pairing, user-presence theater,
route downgrade, or assuming loopback defeats malicious local software. Do not
invent current TinyRustLM keys or security behavior.

## Prompt 6: One Bounded Six-Artifact HTTP Transfer With Backpressure And Safe Resume

You are an independent principal streaming-protocol engineer, browser Fetch
specialist, and content-addressed storage architect. Produce an exceptionally
detailed report selecting one exact HTTP/1.1 transfer protocol that streams a
verified six-artifact TinyRustLM composition from a private loopback Companion
into browser-owned staging storage with bounded memory, end-to-end hashing,
backpressure, cancellation, restart-safe resume, and no arbitrary file access.
You have no access to TinyRustLM code, routes, artifacts, file names, model
sizes, test output, capabilities, or machines. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product and will ship one transfer protocol. It
  needs no prior route, alternate framing, compatibility response, or fallback
  download mode.
- A composition contains exactly six ordered artifacts: SLM2, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. The complete composition, members,
  source lineage, and quality evidence have cryptographic identities.
- The Companion independently verifies a complete composition before exposing
  it. The browser must independently verify all bytes before atomic activation.
  Neither side may trust filenames, content type, or a terminal pass flag alone.
- SLM2 may be hundreds of megabytes or larger. The browser must not buffer an
  artifact into one JavaScript `ArrayBuffer` merely to hash or store it.
- The transport is authenticated by a short-lived least-privilege capability
  established through explicit user-presence pairing. The capability and
  private paths never appear in URLs, redirects, logs, traces, screenshots,
  persistent browser state, or public evidence.
- HTTP routes are exact and closed. There is no directory listing, arbitrary
  range over a path, generic file route, upload, command, proxy, or model-byte
  path through a project server.
- Cancellation must stop network reads, storage writes, hashing, and operation
  ownership. Resume may reuse only independently verified pieces from the same
  exact composition and transfer profile. No bytes from different identities
  may be mixed.
- Chromium is the first real-browser proof target. Firefox and WebKit behavior
  must be researched, but unsupported behavior must be stated honestly.
  MemoryEndpoints is outside the task.

Use current primary sources for Fetch streaming, ReadableStream backpressure,
AbortController, HTTP/1.1 message framing, Content-Length,
Range/Content-Range, ETag and If-Range, Digest fields and current HTTP
content-digest standards, CORS/PNA, streaming cryptographic hashing,
WebAssembly incremental hash libraries, OPFS/IndexedDB streaming writes,
browser quota, and connection cancellation. Record browser/version limits and
primary-source dates.

Address all of the following in depth:

1. Compare one multipart response, one manifest plus six artifact routes,
   fixed-size piece routes, byte ranges over artifact routes, and a framed
   streaming envelope. Select one protocol optimized for strictness,
   resumability, browser implementation, and minimum attack surface.
2. Define the transfer identity graph: operation, capability, composition,
   manifest, artifact slot/kind, artifact hash and size, piece profile, piece
   index, piece hash, response representation, and browser staging attempt.
3. Define manifest retrieval and validation. Include exact method/path,
   authentication, media type, schema, maximum body size, six ordered entries,
   declared sizes, hashes, graph identity, source/quality receipt references,
   transfer-profile identity, and expiry or immutability semantics.
4. Define artifact or piece routes without exposing filesystem paths. Route
   parameters must be opaque fixed-format identities selected from the verified
   manifest. Specify method allowlist, normalized path grammar, Host and Origin,
   headers, CORS, status codes, and rejection of query strings or fragments.
5. Define HTTP framing. Require exact Content-Length where applicable, reject
   ambiguous Transfer-Encoding/Content-Length combinations, duplicate critical
   headers, compression/content encoding, redirects, multipart ambiguity,
   content sniffing, trailer dependence, and connection reuse hazards.
6. Decide the resume granularity. Provide formulas comparing whole-artifact,
   byte-range, and fixed-piece resume for a model of size `M`, piece size `P`,
   receipt overhead `R`, failure probability `f`, and storage budget `B`.
7. If Range is used, define legal single-range requests, If-Range/strong ETag,
   exact Content-Range validation, maximum range size, overlap/gap handling,
   416 behavior, and why multipart ranges are accepted or rejected.
8. If fixed pieces are used, define piece size, final short piece, per-piece
   identity, route, ordering, parallelism, fairness, retry budget, and final
   artifact hash. Explain whether P2P and loopback piece profiles should be
   identical or separately content-bound.
9. Define browser backpressure from network socket through Fetch stream,
   incremental hasher, staging writer, progress accounting, and durable piece
   journal. Bound every queue and copy. Explain how slow storage propagates
   backpressure rather than accumulating memory.
10. Resolve streaming SHA-256 in browsers where `SubtleCrypto.digest` requires
    complete input. Compare incremental Rust/WASM hashing, JavaScript libraries,
    tree hashes, and server-provided hashes. Select one independent browser
    verification design and bind the hasher implementation identity.
11. Define exact copy and memory accounting. Include browser networking buffers,
    JS chunks, WASM linear memory, hash state, OPFS/IndexedDB write buffers,
    service-worker interception, and developer instrumentation limits.
12. Define cancellation semantics at manifest, response headers, mid-piece,
    between pieces, final hash, and activation. State which partial verified
    pieces remain resumable and how unverified tail bytes are discarded without
    deleting evidence incorrectly.
13. Define restart-safe resume. Reopen a bounded staging journal, verify
    composition/profile identity, rehash stored pieces or rely on durable
    per-piece receipts with a revalidation policy, and issue only missing piece
    requests. Handle changed Companion process and expired capability.
14. Define corruption and drift handling: wrong size, wrong hash, duplicate
    piece, stale manifest, changed graph, truncated body, extra body bytes,
    reordered responses, connection reset, Companion restart, browser crash,
    storage failure, and malicious local server.
15. Define progress truth. Report manifest verified, bytes received, bytes
    durably staged, pieces verified, full artifact verified, composition
    verified, and activated as separate facts. Never infer completion from 100%
    network bytes.
16. Provide strict schemas for manifest, piece descriptor, staging journal,
    verified-piece record, transfer event, cancellation, terminal success, and
    terminal rejection. Include size bounds, duplicate-key rejection, canonical
    hashing, and public-safe codes.
17. Provide browser and Companion pseudocode, including Fetch/ReadableStream,
    incremental WASM hash, storage writer, AbortSignal propagation, bounded
    concurrency, and resume.
18. Design a hostile protocol test server producing every malformed header and
    body combination. Add slowloris, tiny chunks, huge declared length,
    premature EOF, extra bytes, wrong range, compressed bomb, replay,
    capability expiry, and connection churn.
19. Define real-browser resource and performance tests with formulas rather
    than invented values. Include peak memory, copy count, throughput,
    cancellation latency, resume savings, storage amplification, and CPU hash
    cost.
20. Define output-free registration, implementation, fault testing, and
    promotion gates for the one selected transfer protocol.

Required report structure:

1. Executive protocol decision and assumptions.
2. Alternative framing/resume comparison.
3. Identity graph and strict manifest contract.
4. Exact HTTP methods, paths, headers, statuses, and limits.
5. Piece/range policy and resource formulas.
6. Browser backpressure, hashing, storage, and copy architecture.
7. Cancellation, resume, corruption, and drift semantics.
8. Progress states and normative schemas.
9. Browser/Companion pseudocode.
10. Hostile-server, crash, and performance test matrix.
11. Preregistration and objective acceptance gates.
12. Unknowns requiring local/browser proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend arbitrary file routes, directory listing, query capabilities,
whole-model buffering, trusting a server hash without local hashing, ambiguous
HTTP framing, transparent compression, best-effort resume across changed
identities, silent restart, or an instruction-file download. Do not invent
current TinyRustLM transfer behavior or measurements.

## Prompt 7: Crash-Consistent Browser Composition Storage And Atomic Activation

You are an independent principal browser-storage engineer, database recovery
architect, and offline-web reliability specialist. Produce an exceptionally
detailed report selecting one browser persistence architecture that admits a
large six-artifact TinyRustLM composition through staging, independently
verifies it, atomically activates exactly one complete immutable composition,
recovers after browser or worker failure, and safely reclaims obsolete bytes.
You have no access to TinyRustLM code, current IndexedDB schemas, OPFS files,
service workers, browser profiles, artifacts, test output, or machines. Do not
claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is a prelaunch browser-local AI chat application. It may replace
  all experimental storage with one clean schema and has no migration or
  compatibility obligation.
- A usable model is one immutable composition containing exactly SLM2,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. No individual member is
  independently active. Every artifact, graph, transfer profile, and composition
  has a cryptographic identity.
- The browser receives bytes as bounded verified pieces from a private numeric-
  loopback Companion or directly from consenting peers. It stages bytes,
  performs independent per-piece and full-artifact verification, parses every
  member, verifies ACG2 closure, and only then may expose the composition to an
  inference Worker.
- SLM2 can be hundreds of megabytes or larger. Storage and hashing must stream.
  The design must account for quota, eviction, disk full, private browsing,
  multiple tabs, service workers, crashes, cancellation, and profile deletion.
- Activation must be atomic at the logical composition level even if the
  browser platform cannot atomically rename a directory containing all files.
  A crash cannot expose five new members with one old member or a graph pointing
  at missing bytes.
- Existing rejected, incomplete, or tampered evidence is not silently promoted
  or rewritten. User-authorized cleanup may remove unreferenced private bytes
  under explicit rules. Prompts and session pairing secrets must not enter the
  model store.
- Chromium is the first proof target. Other engines must be analyzed honestly.
  A page reload is not profile deletion. MemoryEndpoints is outside this task.

Research current primary documentation for IndexedDB transactions and
durability, OPFS, File System Access, StorageManager persistence and estimates,
quota and eviction, synchronous access handles, dedicated Workers, Web Locks,
BroadcastChannel, service-worker lifecycle, origin storage buckets where
available, private browsing, bfcache, crash recovery, and browser profile data
deletion. Distinguish standards from browser-specific behavior and versioned
experiments.

Address all of the following in depth:

1. Compare IndexedDB blobs/chunks, OPFS files plus IndexedDB metadata, OPFS only,
   Cache Storage, and File System Access user-selected directories. Select one
   first-release architecture and explain why the others fail requirements.
2. Define the storage identity model: origin, schema profile, staging attempt,
   composition, six member slots, artifact, piece profile, piece, verification
   receipt, activation generation, lease, and garbage-collection epoch.
3. Define exact physical layout. Specify OPFS directory/file naming from hashes,
   fixed casing and grammar, metadata object stores and keys, bounded journals,
   no user-controlled paths, and rejection of links or external handles.
4. Define admission preflight. Use `navigator.storage.estimate()` cautiously,
   calculate required source/transfer/staging/final/headroom bytes, request
   persistent storage if appropriate, and produce truthful states when capacity
   is insufficient or estimates are unreliable.
5. Define streaming piece writes. Cover dedicated Worker ownership, synchronous
   versus asynchronous OPFS access, chunk boundaries, flush semantics, short
   writes, browser kill, final length, per-piece hash, and durable metadata
   ordering.
6. Define the transaction protocol from absent staging through manifest bound,
   pieces present, artifacts verified, members parsed, graph closed,
   activation-ready, active, rejected, cancelled, and reclaimable. List every
   legal transition and crash recovery action.
7. Design logical atomic activation. Compare an IndexedDB transaction that swaps
   one active-composition pointer, generation records, immutable manifest roots,
   and copy/rename approaches. Select one authority and prove readers cannot
   observe a torn composition.
8. Define reader snapshot and Worker lease semantics. An inference Worker must
   hold one immutable generation while a new composition is staged or old data
   is reclaimed. Cover tab close, worker crash, stale lease, heartbeat pitfalls,
   and no timestamp-only deletion.
9. Define concurrency across tabs, windows, dedicated Workers, SharedWorkers,
   and service workers. Compare Web Locks with transactional compare-and-swap,
   define single writer and multiple readers, prevent deadlock, and handle an
   uncooperative stale context.
10. Define startup reconciliation. Enumerate metadata without scanning arbitrary
    origin storage, verify bounded staging roots, detect missing/extra pieces,
    recover committed activation, quarantine malformed records, and never infer
    success from a file's presence.
11. Define cancellation and cleanup. Distinguish unverified tail, verified
    reusable pieces, terminal rejected evidence, active composition, obsolete
    composition, and orphan metadata. Require reference closure before deletion.
12. Define quota eviction and browser-initiated data loss. A missing active file
    must produce a typed unavailable/corrupt state and invalidate inference,
    not trigger hidden network or source fallback.
13. Define schema replacement before launch. Since there is no public user
    population, choose one exact current schema and cleanly delete alternate
    experimental stores. Do not retain migration readers.
14. Define service-worker boundaries. Decide whether it may touch model bytes,
    metadata, or transfer requests. Analyze stale service-worker code, cache
    poisoning, offline assets, update activation, and prompt/token leakage.
15. Define browser-profile deletion proof for dogfood. Close contexts and
    processes, release handles, delete an owned fresh profile under a verified
    root, retry locked deletion safely, prove absence, and distinguish this from
    clearing one storage API.
16. Provide strict schemas for staging manifest, piece state, artifact state,
    composition verification, activation generation, reader lease, rejection,
    and GC decision. Include canonical hashes, limits, and unknown-field policy.
17. Provide TypeScript and Worker pseudocode for admit, write piece, verify,
    activate, open snapshot, close lease, reconcile, cancel, and collect.
18. Design fault injection at every metadata and file boundary: tab kill,
    worker kill, browser kill, disk full, quota revocation, short write, stale
    lock, concurrent activation, missing file, changed file, malformed metadata,
    stale service worker, and browser update.
19. Define real-browser tests and evidence on Chromium desktop and constrained
    environments. Include storage persistence, peak disk amplification,
    activation latency, recovery time, and exact profile deletion.
20. Produce a clean implementation sequence with preregistered schema, test
    oracle, one-time destructive schema replacement before launch, and no
    compatibility code.

Required report structure:

1. Executive storage architecture decision.
2. Browser standards/implementation fact matrix.
3. Identity model and physical layout.
4. Admission, streaming write, and durability protocol.
5. Logical atomic activation and reader snapshots.
6. Concurrency, crash reconciliation, cancellation, and GC.
7. Quota, eviction, service-worker, and privacy handling.
8. Strict schemas and TypeScript/Worker pseudocode.
9. Fault-injection and clean-profile test matrix.
10. Objective promotion gates and resource formulas.
11. Clean-slate implementation plan.
12. Unknowns requiring local/browser verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend Cache Storage for opaque model authority without proof,
whole-model blobs as the only path, timestamp-based lease expiry, non-atomic
six-file activation, hidden reacquisition, storage migration code, service-
worker secret custody, or equating `localStorage.clear()` with profile deletion.
Do not invent current TinyRustLM browser storage behavior.

## Prompt 8: A Viable Browser-WASM Memory Architecture For A Real 0.6B Q8 Model

You are an independent principal WebAssembly runtime architect, browser memory
specialist, and ML systems performance engineer. Produce an exceptionally
detailed report selecting a viable memory and execution architecture for real
browser-local inference of a dense Qwen3-family model around 0.6B parameters
with mixed-Q8 weights. The design must fit honest production browser limits,
avoid unnecessary copies, preserve scalar-native semantics, support cancellation
and fresh-Worker recovery, and fail truthfully on unsupported devices. You have
no access to TinyRustLM code, WASM binaries, model artifacts, browser traces,
benchmarks, private machines, or tests. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product with one current runtime.
  It will not ship an old runtime, hidden remote inference, alternate model
  format, compatibility kernel, repaired output, or silent low-quality fallback.
- One complete composition includes SLM2 mixed-Q8 model bytes, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. Scalar native Rust is the portable
  reference. Browser WASM must consume the same composition, prompt token IDs,
  sampling bytes, seed, context limits, and raw-output contract.
- The likely first source is a dense Qwen3 model near 0.6B parameters. Weights
  alone may occupy hundreds of megabytes after Q8 quantization. Runtime memory
  also includes WASM pages, dequantization or kernel scratch, activations,
  logits, tokenizer/template state, KV cache, JS/Worker buffers, browser storage
  buffers, and browser overhead.
- The browser receives and stores the composition through a streaming verified
  path. It may not read the whole SLM2 into a second JavaScript buffer just to
  copy it into WASM.
- Chromium without developer-only flags is the first required execution proof.
  SIMD or threads may be used only when runtime feature detection and deployment
  headers establish them. Unsupported devices must receive an accurate resource
  decision before destructive allocation.
- Cancellation must terminate the owning Worker and release model/KV state.
  A fresh Worker must reopen verified immutable composition state and recover
  cleanly. One assistant answer renders once. Model bytes and prompts do not
  leave the device. MemoryEndpoints is outside this task.

Research current primary sources on WebAssembly 32-bit and memory64 limits,
browser ArrayBuffer and typed-array limits, multiple memories, memory growth,
WASM SIMD, threads and SharedArrayBuffer, COOP/COEP, JSPI if relevant, OPFS
synchronous access handles, transferable streams/buffers, structured clone,
Web Workers, WebGPU only as a separately evaluated option, browser process
memory behavior, and Qwen3 tensor/KV dimensions. Record browser versions,
feature maturity, and dates.

Address all of the following in depth:

1. Build a symbolic memory model for a dense decoder transformer. Express
   weight bytes, quantization metadata, embeddings, per-layer scratch,
   activations, logits, token buffers, and KV cache as formulas using parameter
   count, hidden size, layers, heads, KV heads, head dimension, context length,
   batch, bytes per value, group size, and alignment.
2. Produce worked estimates for plausible 0.6B Qwen3 published dimensions using
   sourced configuration values, clearly labeling them as estimates until a
   model revision is pinned. Include peak and steady-state memory, not weights
   alone.
3. Explain wasm32 addressing and practical browser caps. Distinguish the 4 GiB
   theoretical address space, engine reservation, maximum pages, typed-array
   views, contiguous allocation, OS process limits, 32-bit devices, and mobile
   constraints. Assess current memory64 readiness without assuming availability.
4. Compare four architectures: copy all weights into one linear memory; map or
   page weights from OPFS into bounded buffers; split immutable weights across
   JS/OPFS and copy per kernel/layer; and multiple WASM memories or memory64.
   Select one current first-release architecture.
5. If weights are not fully resident in WASM, design deterministic layer or
   tensor paging. Include OPFS read ownership, page size, prefetch, double
   buffering, cache eviction, alignment, hash verification, I/O/compute overlap,
   and prevention of stale or mixed composition bytes.
6. Define exact copy accounting from Fetch through browser store to runtime.
   Identify every unavoidable and avoidable copy, allocation lifetime, transfer
   versus clone, typed-array view invalidation on memory growth, and peak overlap.
7. Define mixed-Q8 kernel memory layout for scalar and SIMD execution. Include
   blocks/groups, scales, zero points if any, alignment, packing, tail handling,
   dequantization strategy, accumulation precision, scratch reuse, and endian
   assumptions.
8. Design activation and scratch reuse across attention and MLP without
   aliasing errors. Cover residual streams, normalization, Q/K/V, RoPE,
   attention scores, softmax, GQA, gated MLP, final logits, and selected-token
   extraction.
9. Design KV-cache allocation and growth. Include exact formula, maximum context
   admission, preallocation versus paged growth, token commit boundary, rollback
   on cancellation, multi-turn append, prompt-prefix reuse only when identities
   match, and invalidation on composition/template/sampling change.
10. Analyze threads. Specify COOP/COEP deployment requirements, SharedArrayBuffer
    feature detection, worker pool lifecycle, memory sharing, deterministic
    reduction, contention, cancellation, and a policy when threads are absent.
    A slower scalar/SIMD implementation may be the same runtime mode, but not a
    semantically different hidden fallback.
11. Analyze SIMD. Cover runtime feature detection, compilation targets, lane
    width, unaligned loads, tail code, reduction ordering, numerical tolerance,
    and scalar differential oracle. Recommend kernels worth optimizing first.
12. Evaluate WebGPU only as a separately gated future execution backend. State
    whether it should be excluded from the first proof due to portability,
    shader precision, adapter limits, compilation, or semantic divergence.
13. Define resource admission before model open. Use device memory hints only
    as non-authoritative inputs, probe bounded allocations safely, consider
    storage headroom and context, and provide truthful supported/unsupported
    reasons without crashing the tab.
14. Define Worker protocol and lifecycle. Include immutable composition handle,
    initialization progress, generation ID, prompt bytes/tokens, output events,
    cancellation, terminal event, worker termination, stale-event rejection,
    and fresh-worker reopen.
15. Define OOM and trap behavior. Browser process kill may produce no catchable
    exception. Specify heartbeats that do not claim success, parent detection,
    state invalidation, user-visible errors, and no automatic retry loop.
16. Define numerical conformance from scalar Rust to WASM scalar and SIMD.
    Include trace points, integer exactness, float tolerances, top-logit margins,
    selected-token equality, seeded sampling, and first-divergence localization.
17. Define performance measurements and formulas: cold open, bytes read,
    prefill latency, time to first token, decode tokens/sec, peak resident
    memory, WASM pages, JS heap, storage reads, KV growth, cancellation latency,
    and fresh-worker recovery. Do not invent target measurements.
18. Design real Chromium tests at several memory classes and contexts. Include
    repeated turns, long context, cancellation during each kernel class,
    backgrounding, sleep/resume, storage loss, browser restart, and no network.
19. Provide Rust/WASM/TypeScript interface sketches and a staged optimization
    plan in which each kernel must preserve the scalar oracle before replacing
    it. Failed optimized code is deleted rather than retained as compatibility.
20. Define objective go/no-go criteria for the 0.6B model and honest criteria
    for selecting a smaller source if the required browser class cannot fit.

Required report structure:

1. Executive memory architecture decision and assumptions.
2. Current WASM/browser capability matrix with dates.
3. Symbolic and worked memory budget.
4. Weight residency, paging, and copy architecture.
5. Mixed-Q8 layout, scratch, activation, and KV design.
6. SIMD, threads, Worker, cancellation, and recovery.
7. Resource admission, OOM, and truthful UX states.
8. Native/WASM conformance and first-divergence plan.
9. Performance and real-browser test matrix.
10. Rust/WASM/TypeScript interface sketches.
11. Staged implementation and optimization gates.
12. Go/no-go and model-size stop rules.
13. Unknowns requiring local browser proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend whole-model duplicate buffering, theoretical 4 GiB as proof
of practical support, developer flags, silent remote inference, a semantically
different fallback model, swallowed OOM, automatic retry after Worker death,
or performance claims without real-browser evidence. Do not invent TinyRustLM
memory use or throughput.

## Prompt 9: One Deterministic Mixed-Q8 Profile For Qwen3 Accuracy And Portable Speed

You are an independent principal quantization scientist, CPU-kernel engineer,
and numerical-validation researcher. Produce an exceptionally detailed report
selecting one deterministic mixed-Q8 weight representation and conversion
profile for a dense Qwen3-family model around 0.6B parameters, optimized for
portable Rust CPU and browser-WASM inference while preserving practical
conversation quality. You may browse public papers, model repositories, and
public implementations, but you have no access to TinyRustLM code, private
models, conversion profiles, calibration data, evaluation prompts, kernels,
benchmarks, artifacts, or test output. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product with one SLM2 runtime and one accepted
  conversion path. It needs no previous quantization format, compatibility
  kernel, alternate model reader, hidden full-precision fallback, or temporary
  low-quality patch.
- The likely first source is a dense Qwen3-family model near 0.6B parameters.
  Source weights, tokenizer, template, generation configuration, model card,
  license, and repository revision must be pinned immutably before conversion.
- A complete composition contains SLM2 model bytes, Tokenizer2, Template2,
  Sampling2, Prompt2, and ACG2. Quantization profile, converter executable,
  source locks, tensor receipts, and artifact bytes are content-addressed.
- Scalar native Rust is the portable inference reference. Optimized native
  SIMD and browser WASM must preserve registered numerical and selected-token
  conformance. Output is never repaired or selected from retries.
- Browser memory pressure strongly favors approximately eight-bit weights, but
  quality matters more than hitting an arbitrary file size. Mixed-Q8 means the
  profile may deliberately retain selected tensors or metadata at higher
  precision when justified by measured sensitivity; it does not permit a
  hidden second model.
- Quality priorities include ordinary conversation, ambiguity handling,
  practical constraints, source conflict, latest-user precedence, untrusted
  quoted text, multi-turn continuity, lawful adult help, summaries, rewrites,
  JSON, extraction, and code explanation. Arithmetic is secondary.
- Calibration or training data must be provenance-reviewed and contamination-
  controlled. Sealed evaluation prompts, paraphrase families, expected-answer
  terms, and failed holdouts may never enter calibration, tuning, or kernel
  fixtures.
- Large source tensors are streamed. The first proof targets ordinary CPU and
  Chromium WASM without developer flags. MemoryEndpoints is outside the task.

Research current primary literature and official public implementations for
weight-only INT8, per-tensor/per-channel/per-group quantization, symmetric and
asymmetric schemes, SmoothQuant, AWQ, GPTQ, SpQR, activation-aware scaling,
outlier handling, QLoRA where relevant, integer and float accumulation,
rounding, calibration, TurboQuant/TurboVec concepts if publicly documented,
WebAssembly SIMD, and Qwen3 architecture. Record paper dates, repository
revisions, licenses, and retrieval date. Distinguish techniques that require
special hardware instructions from portable ones.

Address all of the following in depth:

1. Reconstruct the relevant Qwen3 tensor classes from official configuration
   and model documentation: embeddings, attention Q/K/V/O, normalization,
   MLP gate/up/down, output head, tied weights, biases if any, RoPE parameters,
   and GQA. Mark model-revision-dependent facts.
2. Compare per-tensor, per-output-channel, per-input-channel, and grouped
   weight-only Q8. Include metadata overhead, dot-product organization,
   vectorization, browser memory, random access, dequantization, and accuracy.
3. Compare symmetric signed int8, asymmetric uint8 with zero point, and other
   eight-bit encodings. Select exact value range, scale type, zero-point policy,
   rounding rule, clipping rule, treatment of NaN/Inf/subnormal/negative zero,
   and deterministic tie behavior.
4. Select group geometry per tensor class. State axis, group size, tail padding,
   scale placement, row stride, block alignment, endian order, and exact byte
   formula. Explain how geometry maps to scalar, x86 SIMD, arm64 SIMD, and WASM
   SIMD without transposition ambiguity.
5. Define mixed precision deliberately. Analyze embeddings, LM head, first and
   last layers, norms, attention projections, and outlier channels. Select which
   tensors remain f16/f32 or use a different Q8 grouping only if an objective
   sensitivity experiment justifies it.
6. Compare data-free min/max or MSE scaling with calibration-based methods.
   If calibration is recommended, specify a provenance-safe public corpus,
   sample construction, token budget, sequence lengths, language/task balance,
   deterministic seed, and contamination firewall. Explain what evaluation
   material is categorically excluded.
7. Design tensor sensitivity experiments. Quantize one class/layer at a time,
   measure weight reconstruction error, activation error, logit divergence,
   top-k agreement, perplexity on an independent public corpus, and sealed
   behavioral regression. Define preregistered thresholds as formulas or
   procedures, not invented numbers.
8. Define deterministic conversion. Include source tensor order, streaming
   safetensors reads, finite checks, stable reductions, scale computation,
   rounding independent of host SIMD, padding bytes, thread scheduling,
   receipts, converter identity, and byte-for-byte repeatability.
9. Define exact SLM2 quantized tensor metadata and payload invariants at a
   language-neutral level. Include tensor semantic name/slot, shape, source
   dtype/hash, quantized dtype/profile, axis, group, scale dtype, strides,
   alignment, payload offsets, payload hash, and trailing-byte rejection.
10. Design scalar reference kernels for Q8-by-f32/f16 matrix-vector operations.
    Specify accumulation precision, scale application order, loop order,
    overflow bounds, fused bias or activation policy, and deterministic output.
11. Design native SIMD and WASM SIMD kernels. Compare widen-multiply,
    dot-product instruction availability, packed lanes, horizontal reductions,
    scale broadcasting, tails, alignment, and feature detection. Every optimized
    kernel needs a scalar differential gate.
12. Analyze whether activation quantization helps this model/browser target.
    Include quality, calibration, runtime conversion, scratch memory, SIMD, and
    portability costs. Select inclusion or exclusion for the first profile.
13. Treat KV-cache precision as a separate registered decision. Compare f32,
    f16, and quantized KV for memory and quality, but do not silently bundle an
    unproven cache compression into the weight profile.
14. Define numerical conformance across source framework, dequantized converted
    weights, scalar Rust, optimized Rust, raw WASM, and Chromium. Include trace
    points, absolute/relative/ULP metrics, cosine similarity, top-logit margin,
    selected-token equality, and first-divergence search.
15. Define quality promotion. Compare untouched source, converted Q8, and any
    higher-precision mixed variant on identical sealed cases, tokens, prompts,
    template, seeds, and Sampling2. Require ordinary-helpfulness floors and
    explicit regression budgets.
16. Define performance and resource experiments: artifact size, metadata
    overhead, conversion RAM, conversion time formula, cold read, kernel
    throughput, prefill, decode, peak memory, energy where measurable, and KV
    growth. Separate measured facts from predictions.
17. Design malformed-input, property, fuzz, and mutation tests for bad scales,
    all-zero groups, overflow, wrong axis, wrong stride, tail corruption,
    endian swap, unaligned blocks, duplicate tensor, tied-weight drift, SIMD
    tail bug, and host-dependent rounding.
18. Compare useful public TurboQuant/TurboVec ideas to the selected profile.
    Identify transferable principles, architecture-specific assumptions,
    license constraints, and claims that need independent reproduction. Do not
    import branding or unverified benchmark claims as design authority.
19. Define objective stop rules. Reject the profile if repeat conversion is not
    byte-identical, scalar parity fails, optimized parity fails, browser memory
    is infeasible, or sealed quality regression exceeds the preregistered
    budget. State the next clean experiment rather than retaining failed code.
20. Produce a staged implementation plan from a tiny public tensor fixture to
    one immutable real model, native reference, optimized kernels, Chromium,
    and behavioral promotion.

Required report structure:

1. Executive quantization decision and assumptions.
2. Current Qwen3 tensor/architecture facts.
3. Technique comparison and selected mixed-Q8 profile.
4. Exact encoding, group, scale, rounding, and layout contract.
5. Calibration firewall and sensitivity experiments.
6. Deterministic streaming conversion and receipts.
7. Scalar, native SIMD, and WASM SIMD kernels.
8. Numerical and selected-token conformance.
9. Behavioral quality promotion and stop rules.
10. Resource/performance formulas and experiment matrix.
11. Malformed-input, fuzz, and differential tests.
12. TurboQuant/TurboVec transferable lessons and limits.
13. Prioritized implementation sequence.
14. Unknowns requiring local/model proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend choosing Q8 solely by file size, hiding a full-precision model,
host-dependent rounding, calibration on evaluation cases, response repair,
best-of-N, broad unexplained tolerances, an unproven KV change inside the weight
profile, or retaining failed kernels as compatibility fallbacks. Do not invent
TinyRustLM quality or performance.

## Prompt 10: Publisher-Exact Qwen3 Composition Semantics At One Immutable Revision

You are an independent principal model-format archaeologist, tokenizer and chat
template specialist, and ML supply-chain auditor. Produce an exceptionally
detailed report identifying and specifying one publisher-exact dense
Qwen3-family source near 0.6B parameters that is plausibly suitable for
TinyRustLM's first browser-local composition. The report must close every
semantic input needed to turn user messages into generated token IDs without
relying on undocumented defaults or mutable repository state. You have internet
access but no TinyRustLM source code, private source locks, local models,
conversion output, test fixtures, evaluation cases, credentials, or machines.
Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product and will support one clean first-model
  path. There is no need to retain an old tokenizer, template, prompt wrapper,
  sampling default, architecture alias, or remote-code fallback.
- A complete composition contains exactly SLM2 model bytes, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. The six members are independently
  identified and ACG2 binds their allowed relationships.
- The likely initial family is a public dense Qwen3 model near 0.6B parameters.
  A candidate must be pinned to an immutable repository revision with exact
  source-file hashes and a license decision. Popularity, download count, one
  attractive answer, and a mutable branch name are not promotion evidence.
- Tokenizer2 must reproduce publisher token IDs and decoding exactly. Template2
  is a bounded non-Turing-complete executable contract compiled from a reviewed
  publisher template. Prompt2 holds explicit product-owned prompt policy and
  cannot smuggle evaluation answers. Sampling2 contains exact deterministic or
  seeded generation semantics.
- Browser and native paths must consume the same six artifacts. Browser code
  may not retokenize differently, reconstruct a template ad hoc, invent default
  sampling, repair output, or choose a better retry.
- Untouched source behavior is screened before conversion or training. If the
  source is not useful, it is rejected or improved through a separately
  preregistered contamination-controlled process.
- Model prompts and bytes stay local. MemoryEndpoints is unauthorized and
  outside this task.

Use primary sources: official Qwen model cards, organization repositories,
immutable commit revisions, configuration files, tokenizer files, templates,
generation configuration, papers/technical reports, Transformers source and
documentation at pinned revisions, safetensors index files, and licenses.
Record exact URLs, commit identifiers, file hashes when publicly retrievable,
publication/update dates, and report retrieval date. Clearly identify mutable
facts that must be locally pinned.

Address all of the following in depth:

1. Build a current candidate matrix of dense public Qwen3 models in roughly the
   0.3B to 1.7B range, emphasizing the model near 0.6B. Include base versus
   instructed status, parameter count, architecture type, context, vocabulary,
   tokenizer assets, template availability, source size/shards, license,
   remote-code requirement, and immutable revision availability.
2. Select one leading source revision for the first experiment and one backup
   only as a separately rejected/queued candidate, not a runtime fallback.
   Explain selection using browser feasibility and untouched conversational
   potential rather than popularity.
3. Enumerate the exact public repository closure needed before bytes are
   accepted: model config, safetensors index and every shard or single tensor
   file, tokenizer JSON/model/vocabulary/merges as applicable, tokenizer config,
   special-token map, chat template, generation config, model card, license,
   and any publisher code that defines semantics.
4. Analyze architecture configuration field by field: hidden size, layers,
   attention heads, KV heads, head dimension, intermediate size, activation,
   normalization and epsilon, RoPE parameters/scaling, context limit, tie-word-
   embeddings, vocabulary size, BOS/EOS/PAD IDs, sliding window if any, and
   attention implementation assumptions.
5. Reconstruct the complete tensor-name and shape schema from official public
   sources. Include expected count, tied weights, transpose/layout semantics,
   shard mapping, missing/duplicate rejection, dtype, and total parameter/byte
   accounting formulas.
6. Close Tokenizer2 semantics. Identify tokenizer algorithm, base vocabulary,
   merges, added tokens, special tokens, normalization, pretokenization,
   byte/Unicode behavior, offsets, duplicate content, token priority, unknown
   handling, encoding of special strings, and decode cleanup. State exact counts
   and how each is sourced.
7. Analyze publisher chat-template semantics at the selected revision. Cover
   system/user/assistant roles, multiple system messages, empty content, tools
   if present, generation prompt, assistant continuation, whitespace/newlines,
   special tokens, thinking blocks, and malformed/unsupported roles.
8. Resolve Qwen3 thinking and non-thinking behavior. Identify official template
   controls, `/think` or `/no_think` directives if documented, hidden or visible
   reasoning delimiters, default mode, output parsing, and product implications.
   Recommend one explicit first-composition mode without silently stripping or
   repairing generated content.
9. Separate publisher template from product Prompt2. Define what exact product
   policy belongs in Prompt2, how it is source-controlled and hashed, and why
   publisher defaults, system prompt, evaluation answers, memory, and current
   user messages must remain distinct inputs.
10. Close Sampling2 semantics. Inspect official generation configuration and
    model-card recommendations, then specify required explicit fields: maximum
    new tokens, temperature, top-k, top-p, min-p if supported, repetition
    penalty, seed, EOS/stop behavior, deterministic tie order, and unsupported
    parameters. Do not assume library defaults.
11. Define context construction and truncation. Include six-member identity,
    previous turns, current user turn, untrusted retrieved text if later used,
    template rendering, Prompt2 placement, token counting, maximum context,
    maximum output reservation, turn-boundary preservation, and typed refusal
    to overrun rather than silent semantic truncation.
12. Define immutable source acquisition: manifest-before-bytes, HTTPS and
    redirect policy, exact allowlist, streamed sizes/hashes, shard-index
    closure, LFS pointer handling, upstream drift, resume, terminal rejection,
    license capture, and no remote execution.
13. Define public differential vectors that do not use sealed behavioral cases.
    Include tokenization and decode edge cases, multilingual text, emoji,
    whitespace, special-token literals, role combinations, thinking mode,
    generation prompt, long context boundaries, and template error cases.
14. Define independent oracles. Compare pinned Python Transformers/publisher
    behavior, a standalone tokenizer implementation, Rust Tokenizer2, raw WASM,
    and Chromium. Require exact rendered bytes and token IDs before inference.
15. Define ACG2 closure constraints between selected model dimensions,
    vocabulary/token IDs, template special tokens, Prompt2 placement, Sampling2
    EOS/limits, runtime architecture profile, and quantization profile.
16. Define source-screen protocol before conversion. Include fixed cases,
    sealed seeded paraphrases, multi-turn state changes, untouched raw output,
    exact seeds/sampling, human review, source-conflict and practical-constraint
    invariants, and rejection criteria.
17. Define unsupported feature handling. Tool calling, multimodal inputs,
    unsupported roles, remote code, speculative decoding, long-context scaling,
    and publisher updates must fail closed or require a new independently
    registered composition, never an alias or fallback.
18. Provide exact source-lock, tokenizer-lock, Template2-source, Prompt2,
    Sampling2, and composition-manifest schema examples with maximum sizes,
    canonical identities, and provenance fields.
19. Provide a local verification checklist that turns every remaining mutable
    public observation into an immutable source lock before conversion.
20. Produce a staged route from public-source audit to source lock, untouched
    screen, Tokenizer2/Template2/Sampling2 closure, complete conversion, native
    oracle, and browser proof.

Required report structure:

1. Executive candidate and immutable-revision recommendation.
2. Current candidate/license/source matrix.
3. Selected repository closure and acquisition plan.
4. Architecture and tensor schema.
5. Publisher-exact Tokenizer2 semantics.
6. Template2, thinking mode, and Prompt2 separation.
7. Sampling2, context, stop, and truncation semantics.
8. ACG2 cross-member invariants.
9. Differential vector/oracle plan.
10. Untouched source screen and rejection criteria.
11. Strict lock/manifest schema examples.
12. Local verification checklist and stop rules.
13. Prioritized implementation plan.
14. Unknowns requiring immutable local acquisition or execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend a mutable branch as identity, undocumented library defaults,
remote-code execution, ad hoc chat strings, hidden thinking-text repair,
tokenizer substitution, architecture aliases, popularity-based promotion,
training on screening cases, or a backup model as runtime fallback. Do not
invent current TinyRustLM source locks or model quality.

## Prompt 11: Contamination-Safe Quality Rescue For One Small General Assistant

You are an independent principal post-training researcher, evaluation-science
lead, and small-model curriculum architect. Produce an exceptionally detailed,
decision-oriented report defining what TinyRustLM should do if an untouched
public Qwen3-family model near 0.6B parameters is structurally portable but not
good enough for practical browser-local conversation. The report must select a
minimal quality-rescue path, protect sealed evaluation integrity, preserve
ordinary helpfulness, and state when to reject the model instead of spending
more compute. You have internet access but no TinyRustLM code, GPUs, local
models, private datasets, sealed prompts, outputs, receipts, training runs, or
test results. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. It can replace poor experiments cleanly
  and has no obligation to ship a weak model, old checkpoint, adapter fallback,
  compatibility route, or artificial portfolio of relabeled bytes.
- The immediate goal is one genuinely useful, provenance-bound browser-local
  composition, not twenty nominal artifacts. The likely source is a dense
  Qwen3-family model near 0.6B parameters, pinned immutably and screened in
  untouched form before conversion or training.
- Quality dimensions are conversational coherence, common sense, ambiguity
  handling, practical constraints, source conflict, latest-user preference,
  multi-turn continuity, untrusted quoted or retrieved text, summarization,
  rewriting, structured JSON, extraction, code explanation, factual humility,
  and direct substantive treatment of lawful adult questions. Arithmetic is
  secondary and may use a deterministic calculator.
- Positive helpful examples must substantially outnumber refusals. Concrete
  security and nonconsensual-harm boundaries should remain narrow and explicit.
  Over-refusal, moralizing, fabricated certainty, impossible advice, stale
  memory precedence, and instruction following from quoted data are failures.
- Raw source and adapted outputs are preserved exactly. Response repair,
  best-of-N selection, hidden retries, expected-term injection, hand editing,
  and lowering thresholds are forbidden.
- Sealed holdouts, paraphrase seeds, expected answers or semantic invariants,
  failed evaluation outputs, and product dogfood transcripts may not enter
  training, teacher prompts, calibration, rejection sampling, or routine
  development fixtures. Independent custody and deletion lineage are required.
- A CPU LoRA pilot is possible; later GPU training may be authorized. Any
  adapter promoted to product must be merged into distinct checkpoint bytes and
  converted into the sole six-artifact composition. There is no runtime adapter
  fallback.
- A future system might use specialized small models, but the first general
  model must stand on its own. Routing complexity may not disguise a weak
  assistant. MemoryEndpoints is outside this task.

Research current primary papers and official frameworks for SFT, assistant-
only loss, LoRA, DoRA, full fine-tuning, DPO, ORPO, KTO if relevant,
sequence-level distillation, token-level KL/top-k logit distillation,
curriculum design, synthetic-data review, contamination detection, benchmark
leakage, human evaluation, inter-rater agreement, statistical promotion, and
small-model scaling. Record dates, licenses, immutable revisions, and compute
assumptions.

Address all of the following in depth:

1. Define a pretraining-spend source screen. Specify public-safe development
   cases, independently sealed holdouts, seeded paraphrases, multi-turn cases,
   sample counts as a defensible procedure, repeated seeds where stochastic,
   human review, and immediate rejection conditions.
2. Define a claim taxonomy from untouched-screened through adapted-candidate,
   merged-checkpoint, quantized-composition, native-conformant, browser-
   conformant, conversation-screened, and conversation-proven. State prohibited
   language for each level.
3. Build a decision tree comparing: accept untouched source; change explicit
   template/sampling only when publisher-correct; CPU LoRA; GPU LoRA/DoRA; full
   SFT; preference optimization; sequence distillation; logit distillation;
   select a larger/smaller source; or reject the family. Select a minimal first
   experiment and stop rules.
4. Explain which weaknesses post-training can plausibly fix at 0.6B and which
   reflect capacity, pretraining, tokenizer, architecture, or knowledge limits.
   Avoid promising common-sense ability that data quantity alone cannot create.
5. Design a small CPU LoRA pilot. Bind base revision/hash, target modules,
   rank, alpha, dropout, precision, optimizer, learning-rate schedule, sequence
   length, packing, assistant-only masking, batch/accumulation, seed, checkpoint
   intervals, deterministic environment, RAM formula, step-time formula, and
   termination criteria.
6. Define a scalable behavioral curriculum with target proportions for every
   named quality dimension. Include ordinary chat as the largest anchor,
   factual/source-grounded work, summaries/rewrites/extraction/JSON/code, and a
   minority of narrow boundary cases. Explain count progression from pilot to
   larger run.
7. Design scenario-factor generation that teaches rules rather than answer
   phrases: authority permutations, changed current preference, unavailable
   resources, entity/unit/date substitution, implicit and explicit negation,
   varied discourse forms, multi-turn state change, irrelevant distractors,
   adversarial quoted instructions, and counterfactual outcomes.
8. Define teacher generation. Compare one teacher, ensemble, disagreement
   sampling, final-answer-only records, hidden reasoning exclusion, deterministic
   replay, factual verification, rubric review, policy-artifact detection, and
   malicious teacher outputs. Address API/output licensing and provenance.
9. Define human review and adjudication. Include blind source labels, reviewer
   training, rubrics, double review, disagreements, inter-rater agreement,
   factual checks, removal lineage, personally identifying information, and
   public-safe evidence.
10. Define contamination controls: exact normalization, Unicode handling,
    character/token n-grams, semantic-neighbor search, template-family overlap,
    entity-substituted overlap, response-answer overlap, benchmark overlap,
    teacher-prompt overlap, source contamination, and deterministic exclusion
    manifests.
11. Propose an independent custody model. Training agents cannot see sealed
    cases, holdout generators, seeds, expected terms, or verdicts beyond bounded
    aggregate feedback. Explain how evaluator improvements do not leak failed
    cases into the curriculum.
12. Define hard negatives and preference records without teaching canned
    refusals. Positive answers must dominate. Include practical impossibility,
    stale memory, quoted injections, false authority, moralizing, unsafe
    certainty, incomplete JSON, and verbose nonanswers.
13. Compare assistant-only SFT, full-sequence SFT, LoRA, DoRA, full fine-tune,
    DPO/ORPO, sequence distillation, top-k KL, hidden-state matching, and self-
    distillation specifically for 0.6B and 1.5B students. Provide compute and
    data thresholds as formulas, not invented run times.
14. Define checkpoint evaluation. Compare untouched source, adapter, merged
    checkpoint, mixed-Q8 composition, scalar native, and Chromium on identical
    prompts/tokens/template/sampling/seeds. Preserve raw output and forbid
    cherry-picking checkpoints after sealed output.
15. Define statistical promotion: per-case pass probability, confidence
    intervals, correlated paraphrase families, multiple comparisons, practical
    effect sizes, ordinary-helpfulness floor, catastrophic invariant failures,
    reviewer agreement, and fixed evaluation schedule.
16. Define quality versus performance tradeoffs. Quantization may reduce quality;
    the merged source and mixed-Q8 result require separate gates. A faster or
    smaller model does not pass if practical usefulness regresses materially.
17. Analyze a future general-champion plus specialist portfolio. State when a
    specialist is meaningful, how routing is independently evaluated, how
    duplicated base bytes affect size, and why specialists must not postpone or
    mask the first general model's acceptance.
18. Define training supply-chain controls: dataset licenses, source URLs/hashes,
    teacher terms, PII removal, malware/content scanning boundaries, immutable
    manifests, environment locks, checkpoints outside Git, SBOM/provenance, and
    deletion lineage.
19. Define failed-run preservation and rollback. A failed adapter/checkpoint is
    retained as private evidence, never promoted, and not left as runtime code.
    State how the next experiment changes one registered variable.
20. Produce prioritized routes to one accepted 0.6B model, escalation to a
    larger model if browser resources allow, or honest rejection if no candidate
    meets both quality and browser limits.

Required report structure:

1. Executive quality-rescue decision and assumptions.
2. Untouched source screen and claim taxonomy.
3. Method decision tree and likely capacity limits.
4. Exact CPU LoRA pilot with compute formulas and stop rules.
5. Curriculum taxonomy and scenario generation.
6. Teacher, human review, provenance, and licensing.
7. Contamination threat model and independent custody.
8. Checkpoint, quantization, native, and browser promotion matrix.
9. Statistical decision policy and ordinary-helpfulness floor.
10. Specialist-model analysis without routing theater.
11. Supply-chain, failure preservation, and rollback.
12. Prioritized accept/escalate/reject paths.
13. Unknowns requiring local training or sealed evaluation.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend training on evaluation prompts, failed holdouts, expected
answers, or dogfood transcripts; best-of-N; repaired output; hidden reasoning
as required targets; refusal-heavy curricula; popularity-based source choice;
lowered thresholds; runtime adapter fallback; or specialist routing that masks
a weak general model. Do not invent TinyRustLM training or quality results.

## Prompt 12: Executable Proof Plan From Durable Conversion To Real Browser-Local Chat

You are an independent principal release-evidence architect, browser acceptance
lead, ML systems verifier, and prelaunch quality owner. Produce an exceptionally
detailed end-to-end proof plan for taking one immutable, quality-qualified
Qwen3-family source through durable six-artifact conversion, independent
verification, secure Companion-to-browser acquisition, atomic browser
activation, scalar-native conformance, real-Chromium WASM inference, and one
genuine multi-turn browser-local conversation. You have internet access but no
TinyRustLM source code, local model, build output, private prompt, evaluation
case, browser profile, receipt, credential, signing key, deployment account,
P2P observer, or test machine. Do not claim private validation.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. Everything may be rewritten cleanly.
  There is no product-generation split, legacy support, migration, alias,
  compatibility reader, remote-inference fallback, instruction-download path,
  response repair, best-of-N, fake success, weakened test, or acceptable code
  debt.
- The immediate acceptance target is one real, useful, provenance-bound model
  composition containing exactly SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2. Distinct cryptographic identity, not filename or marketing
  name, determines the composition.
- Source model, tokenizer, template, generation configuration, license, source
  repository revision, every source file, converter, conversion profile, and
  all six outputs are immutable and content-bound.
- Conversion is one create-only transaction into a previously absent root.
  Terminal pass and rejection evidence is immutable and mutually exclusive.
  Parent crash recovery independently verifies durable bytes; stdout and exit
  code are never success authority.
- The browser first requests an exact eligible composition from direct peers.
  If no peer is eligible, it asks the user to approve an immutable source and
  the local Companion converts it. The product must work directly; it must not
  download text, JSON, PowerShell, shell, or other instruction handoffs.
- Browser-to-Companion communication uses one preregistered, least-privilege,
  user-paired numeric-loopback capability protocol. The browser streams all six
  artifacts with bounded memory, verifies them, and atomically activates only
  the complete composition.
- Scalar native Rust is the runtime reference. Optimized native and browser
  WASM consume identical composition bytes, prompt token IDs, Template2,
  Prompt2, Sampling2, seed, context, and output limits. Raw output is preserved.
- The browser Worker owns inference. Cancellation terminates ownership and stale
  events are rejected. A fresh Worker reopens the immutable composition. Each
  assistant answer renders once. Prompts and model bytes never go to project
  servers.
- Quality requires practical conversation, ambiguity handling, resource
  constraints, source conflict, latest-turn precedence, untrusted quoted text,
  continuity, lawful adult help, summary/rewrite/JSON/extraction/code ability,
  and ordinary helpfulness. Structural validity alone is not quality.
- MemoryEndpoints is unauthorized and disconnected. No live memory claim is
  allowed. The broader counters remain exactly 0/20 qualified campaign models,
  0/50 browser rounds, 0/25 live memory rounds, 0/40 externally proven lanes,
  and 0/20 catalog announcements unless later objective live evidence changes
  them. This first-model proof must not inflate those counters.

Research current primary sources for reproducible builds, content-addressed
evidence, SLSA/in-toto provenance, model cards, safetensors, Qwen3,
quantization validation, WebAssembly, browser storage and Workers, Playwright
persistent contexts, network interception, secret scanning, statistical
evaluation, SBOMs, package provenance, software signing, and public deployment
readback. Record dates, revisions, licenses, and retrieval date.

Address all of the following in depth:

1. Define a claim ladder with exact minimum evidence and prohibited language:
   candidate discovered, source acquired, license reviewed, structurally
   supported, untouched screened, conversion complete, composition verified,
   native structural, native numerical, browser loaded, browser numerical,
   conversation screened, one browser chat proven, P2P eligible, externally
   reachable, catalog announced, package published, and site deployed.
2. Define one content-addressed evidence DAG binding user intent, source locks,
   source bytes, license decision, optional training, converter source and
   executable, conversion profile, six artifacts, component/terminal receipts,
   native runtime, WASM module, browser assets, sampling, prompts by private
   hash, raw outputs, tests, packages, deployments, and final decision.
3. Define output-free preregistration gates before every one-time or
   cherry-pick-sensitive experiment: conversion reconciliation, loopback route
   creation, first real model conversion, source screening, optional training,
   native/WASM conformance, two-profile Chromium execution, and final
   conversation acceptance.
4. Design phase invalidation. A changed evaluator reruns evaluation but not
   immutable acquisition; changed converter invalidates conversion onward;
   changed Tokenizer2 invalidates template/prompt/inference; changed WASM
   invalidates browser proof; changed website asset invalidates deployment
   readback. Preserve obsolete evidence and never overwrite decisions.
5. Define source acquisition and custody evidence. Include exact allowlist,
   sizes/hashes, shard closure, immutable revision, redirects, streamed hashing,
   license, source-card capture, terminal upstream drift, and private large-file
   placement outside source control.
6. Define untouched quality screening and optional rescue. Bind fixed and
   sealed cases, generator/seed, tokenizer/template/sampling, raw outputs,
   human reviews, statistical decision, contamination exclusions, stop rules,
   and no access from training agents to sealed evidence.
7. Define conversion proof at every crash boundary. Include durable intent,
   process ownership, create-only output, streamed tensors, strict inventory,
   six member receipts, terminal exclusivity, independent verifier, parent
   journal transition, restart reconciliation, and failure preservation.
8. Define source-framework-to-native conformance. Gate token and rendered prompt
   parity first; then tensor/weight receipts, trace points, quantization error,
   logits, selected token, sampling, KV mutation, cancellation, and multi-turn
   state. Separate exact identities from tolerance-based floating comparisons.
9. Define secure browser acquisition proof. Include user-presence pairing,
   exact Origin/CORS/PNA, capability scope, manifest, piece transfer,
   incremental hashing, backpressure, resume, cancellation, no arbitrary files,
   atomic storage, and restart reconciliation.
10. Define real-Chromium WASM proof. Use ordinary production browser features,
    immutable asset hashes, zero unauthorized network, bounded memory, cold
    open, prompt prefill, first token, decode, KV growth, termination, fresh-
    Worker reopen, raw output, and exact model/token/prompt/sampling identities.
11. Define two-profile execution without turning it into a campaign count.
    Each profile is newly owned, process-backed, closed, and deletion-proven.
    Run one registered execution per profile or as preregistered, never retry
    terminal output, and preserve failures outside Git with bounded public-safe
    summaries.
12. Define the genuine multi-turn conversation acceptance case while keeping
    private content sealed by hash. It must exercise ambiguity, practical limits,
    changed current preference, conflicting sources, quoted untrusted text,
    continuity, and one transformation task across turns. Require one rendering
    per assistant answer and no hand editing.
13. Define network privacy proof. Allow exact static assets, catalog metadata,
    direct consenting peers, and numeric loopback operations. Fail on prompt or
    model upload to project sites, public model-byte fallback, telemetry,
    credential-bearing URLs, unexpected third parties, or unregistered routes.
14. Define resource evidence: source/acquisition disk, conversion peak RAM and
    disk amplification, browser storage headroom, WASM pages, JS heap, KV
    formula, CPU time, timeout, output bounds, cancellation latency, profile
    size, and cleanup. Use formulas and measured fields, never invented values.
15. Define enterprise tests by layer: strict parsers, unit, property, fuzz,
    mutation, malformed source, converter integration, crash injection, native
    differential, WASM differential, hostile loopback, storage corruption,
    Playwright, accessibility, privacy, package consumer, RID execution, and
    public readback.
16. Define package and supply-chain gates for Rust, WASM, browser assets, native
    ABI, .NET wrappers, NuGet packages, symbols, Companion archives, SBOM,
    provenance, dependency locks, native hashes, signing, malware scanning,
    secret scanning, archive traversal, and publication authorization.
17. Define documentation freshness as a release gate. Technical architecture,
    user instructions, model provenance, limitations, marketing claims, visible
    version, release date, release notes, per-site publication log, package
    metadata, and public HTTPS content must agree with evidence. Stale docs are
    a failed release.
18. Define commit and publication cadence. After each coherent major change
    builds and tests pass, commit and push exact source, fresh-fetch remote
    identity, preserve a clean worktree, and deploy every affected site whose
    complete gate passes. Partial external blockage is recorded, not converted
    to a skip.
19. Define final acceptance evidence for this one model and explicit nonclaims.
    Explain why one qualifying model does not satisfy the 20-model, 50-round,
    25-memory, 40-lane, or 20-announcement campaigns.
20. Produce a dependency-aware implementation plan with parallel paths,
    blockers, retry/terminal rules, clean deletion before launch, stop rules,
    remaining risk, and the smallest deployable major milestone after each
    phase.

Required report structure:

1. Executive proof strategy and assumptions.
2. Claim ladder and prohibited-language table.
3. Content-addressed evidence DAG and phase invalidation.
4. Preregistration and immutable custody controls.
5. Source quality, optional training, and contamination boundary.
6. Conversion, crash recovery, and independent verification.
7. Native numerical and generation conformance.
8. Secure transfer, browser storage, and Worker proof.
9. Genuine multi-turn acceptance and privacy evidence.
10. Resource, fault, and enterprise test matrices.
11. Package, supply-chain, documentation, and deployment gates.
12. Commit/push/deploy cadence and public readback.
13. Final one-model checklist, counters, and nonclaims.
14. Dependency-aware implementation plan and blockers.
15. Unknowns requiring local or authorized external proof.
16. Annotated primary-source bibliography with dates and direct links.

Do not reduce evidence to one `passed` field; count mocks as live proof; call
cross-compilation executed ARM64 evidence; call loopback public reachability;
invent P2P peers, model quality, browser performance, publication, or
deployment; upload prompts or model bytes to project servers; repair or retry
answers; weaken tests; retain obsolete paths as compatibility code; or advance
campaign counters from this one-model proof.

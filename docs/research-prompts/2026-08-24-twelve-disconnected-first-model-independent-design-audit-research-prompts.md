# Twelve Disconnected Research Prompts: First-Model Independent Design Audit

Each section below is a complete, self-contained assignment for a different
technical research agent. Send one whole prompt to one agent. Do not assume the
agent has received this introduction or any of the other eleven prompts.

The research agents may browse public websites, standards, papers, official
documentation, immutable public repositories, model cards, and package
registries. They do not have access to a TinyRustLM source tree, private branch,
local model, build output, test result, receipt, browser profile, machine
configuration, credential, signing key, deployment account, internal service,
or unpublished evaluation case. No report may state or imply that the agent
inspected, built, ran, tested, or validated private TinyRustLM code.

Every report must explicitly distinguish directly observed public facts,
sourced external facts, project facts supplied by the assignment but not
independently verified, assumptions and inferences, engineering
recommendations, and facts requiring local or authorized production proof.
Reports must be exceptionally detailed, technical, implementation-oriented,
and decisive. Broad surveys are insufficient. Current primary sources are
preferred; every source needs a publication or update date, retrieval date,
direct link, and immutable revision where one exists.

## Prompt 1: Independent Audit Of Create-Only Conversion Intent And Terminal Reconciliation

You are an independent principal transaction-protocol architect, formal-methods
reviewer, and model-conversion reliability engineer. Produce an exceptionally
detailed adversarial design audit of a proposed source-model conversion
protocol. Your task is to find ambiguities, split-brain paths, false-success
conditions, irrecoverable states, and insufficient evidence, then recommend one
precise corrected protocol. You have internet access, but no access to any
TinyRustLM code, private files, model bytes, journals, test output, credentials,
or machines. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. SLM2, ACG2, Tokenizer2, Template2,
  Sampling2, and Prompt2 are technical contract names, not an older and newer
  product pair. There is no installed population, compatibility obligation,
  migration path, alias, legacy reader, fallback format, or permission to add
  technical debt.
- A user-owned desktop Companion may convert one approved immutable public
  source into a browser-local composition. Before launch, it writes a private,
  create-only, canonical conversion-intent record and binds its SHA-256 digest
  into an append-only operation journal.
- The intent binds operation identity, source-lock paths and hashes, source
  directories, conversion-profile hash, output root, converter executable path
  and hash, wall-time limit, stdout/stderr limits, and the terminal rule.
- The converter receives a previously absent output root. Success means exactly
  six ordered artifacts plus bounded attempt, component, and terminal evidence.
  Rejection means a strict terminal rejection record. Pass and rejection are
  mutually exclusive. Partial, malformed, foreign, obsolete, or contradictory
  roots remain preserved and cannot be repaired or overwritten into success.
- Live stdout, stderr, elapsed time, process exit, and parent memory are useful
  observations but are not durable success authority. After parent loss, a new
  Companion instance reads the exact bound intent and independently inspects
  terminal files. A valid pass may advance a stale converting or verifying
  journal to available. A valid rejection may advance it to rejected. An absent
  or nonterminal root remains pending without relaunch. Invalid terminal
  evidence becomes a typed rejection while preserving files.
- Automatic retry, process adoption from PID or timestamp, output deletion,
  best-of-N selection, transcript repair, and success inferred from exit code
  are forbidden. A deliberate new attempt requires explicit user authorization
  and a distinct create-only root.
- Windows x64, Linux x64, and Linux arm64 matter. Large files are streamed.
  Private paths remain out of public reports. MemoryEndpoints is unauthorized
  and outside this assignment.

Research primary sources for write-ahead logging, append-only state machines,
idempotency, transaction recovery, content-addressed evidence, crash-only
software, durable process execution, Windows and POSIX filesystem semantics,
and independently verifiable build receipts. Evaluate the proposal as if an
adversary can terminate either process at every instruction boundary and can
modify untrusted files while the Companion is stopped.

Address all of the following in depth:

1. Define the safety properties, liveness properties, trust boundaries, and
   linearization points. State exactly what may be proven after a crash and
   what must remain unknown.
2. Model operation identity, intent identity, source identity, executable
   identity, attempt identity, output-root identity, artifact identities,
   terminal identity, and composition identity. Identify any missing nonce,
   ordinal, generation, or parent-child binding.
3. Determine whether a deterministic intent hash is sufficient to distinguish
   logical idempotence from a deliberate new attempt. Give a normative design
   for duplicate requests, concurrent callers, and explicit user retry.
4. Audit the order of durable intent creation, hash binding, journal transition,
   process creation, child ownership publication, and output creation. For
   every adjacent pair, inject a crash and state the only legal recovery.
5. Decide whether a root that is absent after restart may remain pending
   indefinitely. Distinguish never launched, launch failed, child still alive,
   child died before root creation, external deletion, and lost storage.
6. Audit reconciliation when the journal says converting, verifying,
   cancelled, rejected, or available. State which states may be reconciled and
   why terminal states must or must not be immutable.
7. Resolve cancel-versus-pass and cancel-versus-rejection races. Specify which
   durable fact wins when a valid terminal result exists before, during, or
   after a cancellation request.
8. Specify strict validation for the success tree: exact direct inventory,
   regular-file requirement, no links or reparse points, exact bounded sizes,
   hashes, component identities, cross-file references, and aggregate identity.
9. Specify strict validation for rejection evidence: operation, attempt,
   source, tool, profile, safe-no-op semantics, bounded error taxonomy, and
   proof that no artifact was promoted.
10. Analyze pass-plus-rejection collision, duplicate terminal files,
    unexpected nested directories, output-root-as-file, case-colliding names,
    alternate data streams, sparse files, hard links, symlinks, reparse points,
    and time-of-check/time-of-use replacement.
11. Decide whether validation should hold directory handles, file handles, or
    identity metadata while hashing. Compare practical Windows and Linux
    defenses and state residual races.
12. Define canonical intent encoding requirements: duplicate and unknown field
    rejection, exact field order, UTF-8 rules, line ending, path normalization,
    integer limits, maximum bytes, domain-separated hashing, and schema ID.
13. Provide a complete state-transition table with preconditions, durable
    writes, postconditions, retry behavior, and public-safe typed errors.
14. Provide language-neutral pseudocode and concrete C# and Rust sketches for
    create intent, bind intent, launch once, inspect terminal, reconcile,
    cancel, reject invalid evidence, and authorize a distinct attempt.
15. Build a fault matrix covering process death, power loss, disk full, short
    write, torn metadata, stale cache, source replacement, converter
    replacement, output mutation, two reconcilers, and clock movement.
16. Design model-based or property-based tests that establish transition
    invariants without embedding private paths or real model bytes.
17. Separate what ordinary CI can prove from what requires real Windows,
    Linux, destructive filesystem testing, or a real multi-gigabyte conversion.
18. Give a decisive verdict: accept the supplied protocol, accept only with
    enumerated corrections, or reject it. Rank every correction by severity
    and implementation order.

Required report structure:

1. Executive verdict and explicit assumptions.
2. Formal safety, liveness, and trust model.
3. Identity graph and linearization points.
4. Normative state machine and crash table.
5. Intent and terminal schemas.
6. Filesystem and hostile-mutation analysis.
7. Cancellation, concurrency, and explicit-retry semantics.
8. Algorithms with C# and Rust sketches.
9. Fault-injection and property-test plan.
10. Cross-platform evidence matrix.
11. Required corrections ranked by severity.
12. Unknowns requiring private verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend automatic relaunch, PID-only ownership, timestamp-based stale
detection, output overwrite, deletion of failed evidence, permissive JSON,
stdout-derived success, a generic `passed` boolean, or compatibility behavior.
Do not invent current implementation results.

## Prompt 2: Strict Canonical Records And Cross-Language Content Identity

You are an independent principal serialization engineer, cryptographic-protocol
reviewer, and hostile-input parser designer. Produce an exceptionally detailed,
implementation-ready report selecting one strict canonical record design for a
Rust, C#, and browser JavaScript system whose security and resumability depend
on byte identity. You have internet access but no access to TinyRustLM code,
schemas, private records, binaries, tests, or credentials. You must not claim
that you validated a private implementation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is prelaunch and will use one clean record family. There is no
  legacy JSON, compatibility parser, migration reader, alias, alternate
  spelling, silent default, or permissive fallback to preserve.
- A desktop Companion writes private conversion intents and append-only journal
  records. Rust conversion emits bounded attempt, component, rejection, and
  terminal receipts. A browser later receives public-safe manifests and
  verifies a six-artifact composition consisting of SLM2, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2.
- Some records include private canonical filesystem paths and remain local.
  Public evidence may include hashes, sizes, schema IDs, tool identities,
  statuses, timestamps, and bounded error codes, but not credentials, prompts,
  invitation URLs, private source paths, or raw model output.
- Proposed records are UTF-8 without BOM, use one exact schema identifier and
  fixed property order, end with one LF, reject duplicate, unknown, missing,
  case-mismatched, or out-of-order fields, enforce small byte limits, and use
  SHA-256 over exact canonical bytes. Large artifacts are hashed by streaming.
- C#, Rust, and browser JavaScript must agree exactly. A semantically similar
  reserialization is not automatically the same identity. Numbers used for
  limits and sizes must avoid JavaScript precision loss. Untrusted records may
  be malicious.
- This assignment concerns technical contracts named with `2`; those are not
  product versions. The product has no public legacy. MemoryEndpoints is not
  authorized and is outside scope.

Research primary standards and official documentation for JSON, I-JSON, JCS,
UTF-8, Unicode normalization, SHA-256, multihash or domain separation where
relevant, numeric interoperability, path normalization, streaming hash APIs,
and parser denial-of-service. Compare fixed writer-order canonical JSON against
RFC 8785 JCS, deterministic CBOR, canonical MessagePack if applicable, and a
custom binary envelope. The answer must select one approach for this product.

Address all of the following in depth:

1. Define the exact threat model: duplicate keys, parser differential,
   confusable field names, Unicode normalization, negative zero, exponent
   notation, integer overflow, huge nesting, huge strings, invalid UTF-8,
   embedded NUL, trailing data, BOM, line endings, and decompression bombs.
2. Compare at least four canonicalization choices. Evaluate implementation
   maturity in Rust, .NET, and modern browsers, auditability, byte stability,
   streaming, schema evolution, and denial-of-service surface.
3. Decide whether fixed declared property order plus exact byte comparison is
   sound. Explain how readers can parse once for safety while also proving that
   the original bytes equal the sole canonical re-encoding.
4. Specify top-level and nested object rules, array ordering, strings, escapes,
   booleans, nullability, integers, timestamps, hashes, enum strings, and URI
   fields. Forbid ambiguous representations explicitly.
5. Resolve JavaScript integer limits for file sizes, offsets, token counts,
   durations, and timestamps. Compare decimal strings, safe integers, BigInt,
   and two-word integer encodings. Choose per field class.
6. Specify Unicode treatment for user-facing labels versus identity fields.
   State whether NFC is required, forbidden, or applied before encoding and
   how confusables and case folding are handled.
7. Define canonical path treatment for private Windows and Linux paths without
   pretending they are portable. Address drive letters, UNC paths, extended
   paths, separators, dot segments, trailing separators, case sensitivity,
   reserved names, symlinks, and reparse points.
8. Define hash syntax, lowercase or uppercase policy, exact byte length,
   algorithm agility or intentional non-agility, domain separation, and rules
   preventing a digest for one record type from being accepted as another.
9. Design a schema identity and change policy suitable for a clean-slate
   prelaunch system. A schema change may invalidate dependent phases, but no
   compatibility reader or migration path may remain in production.
10. Specify maximum encoded sizes, nesting depth, field counts, string lengths,
    array lengths, and parse time. Give formulas and recommended hard limits by
    record class rather than invented measurements.
11. Define safe write and read algorithms: create-only temporary file, flush,
    rename or link strategy, directory durability, open flags, read bounds,
    exact hash, strict parse, canonical re-encode, and equality check.
12. Provide normative examples for a private conversion intent, a journal
    transition, an artifact descriptor, a composition manifest, a rejection,
    and a public evidence summary. Include their byte-level endings.
13. Provide at least thirty invalid vectors covering every parser differential
    class and at least ten valid boundary vectors. Specify expected typed
    failures consistently across Rust, C#, and JavaScript.
14. Design a cross-language golden-vector harness. Explain how to establish
    independent encoders and decoders without one implementation merely
    copying another implementation's mistakes.
15. Explain how content identities compose into a receipt DAG and how a schema,
    tool, evaluator, or source change invalidates only dependent evidence.
16. Design fuzzing and property tests for parsers, encoders, hashes, and
    bounded streaming. Include corpus minimization and preservation of failures.
17. Define secret scanning and redaction tests for private and public record
    classes, including UTF-8, UTF-16, base64, URL encoding, and truncated
    secret fragments.
18. Deliver a normative mini-specification that can be translated directly
    into Rust, C#, and browser TypeScript with no policy decisions left open.

Required report structure:

1. Executive decision and assumptions.
2. Threat model and parser-differential taxonomy.
3. Format comparison and selected canonical form.
4. Normative encoding and validation rules.
5. Numeric, Unicode, path, URI, and hash rules.
6. Schema identity and clean-slate change policy.
7. Atomic read/write and streaming-hash algorithms.
8. Normative valid and invalid vectors.
9. Cross-language conformance, fuzzing, and redaction plan.
10. Receipt-DAG implications and invalidation rules.
11. Implementation sequence and acceptance criteria.
12. Unknowns requiring local verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend permissive parsing, first-key-wins or last-key-wins behavior,
floating-point representation of arbitrary byte counts, silent Unicode or path
normalization, hash comparison after lossy parsing, unbounded JSON, schema
migration readers, or dual formats.

## Prompt 3: Cross-Platform Filesystem Durability And Hostile Local Mutation

You are an independent principal filesystem engineer, Windows storage
specialist, Linux durability specialist, and adversarial local-state reviewer.
Produce an exceptionally detailed report defining how a desktop model
acquisition and conversion system can make honest durability claims on Windows
and Linux. You may inspect public standards and official documentation, but you
have no access to TinyRustLM code, a machine, filesystem image, journal, model
artifact, test output, or credential. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product with a user-owned desktop
  Companion. It can adopt one clean filesystem protocol and has no legacy or
  migration obligation.
- Source acquisition and conversion may involve multi-gigabyte immutable model
  files. A successful composition has exactly six artifacts: SLM2 model bytes,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2, plus bounded evidence.
- Each attempt owns a previously absent output root. Existing roots are never
  overwritten, merged, repaired, silently deleted, or renamed into success.
  Failed and malformed evidence is retained until explicit authorized cleanup.
- Small records require bounded canonical bytes and content hashes. Large
  artifacts must be streamed. Journal and intent writes must survive realistic
  interruption. A new process must validate before resume or reconciliation.
- The threat model includes crash, power loss, disk full, quota, antivirus or
  indexer interference, locked handles, symlink and reparse attacks, hard links,
  sparse files, alternate data streams, case-colliding names, mount changes,
  network or removable filesystems accidentally selected, and local untrusted
  mutation while the Companion is stopped.
- Required platforms are Windows x64, Linux x64, and Linux arm64. Cross-compile
  alone is not execution evidence. Private paths cannot enter public reports.
  MemoryEndpoints is unauthorized and outside scope.

Research primary Microsoft, Linux kernel, filesystem, .NET, and Rust sources
for file creation flags, rename and replace semantics, directory flush,
`FlushFileBuffers`, `fsync`, `fdatasync`, open-by-handle behavior, file IDs,
reparse points, symlinks, hard links, sparse files, copy-on-write, case
sensitivity, write-through options, and crash-consistency testing. Distinguish
API guarantees from common filesystem behavior and from storage hardware
assumptions.

Address all of the following in depth:

1. Define honest meanings for written, flushed, metadata-durable,
   directory-durable, content-verified, terminal, and recoverable. State what
   cannot be promised after power loss on ordinary consumer storage.
2. Compare NTFS, ReFS where relevant, ext4, XFS, Btrfs, APFS only if relevant
   to future portability, network shares, removable media, and virtualized
   filesystems. Recommend an allowed-volume policy for the first release.
3. Specify same-directory atomic creation for bounded records on Windows and
   Linux. Address create-new semantics, temporary names, flushing file and
   parent directory, rename collision, replace prohibition, and cleanup after
   interruption.
4. Decide how an append-only journal should be represented: one immutable file
   per transition, length-delimited append log, SQLite, or another durable
   store. Compare torn-write detection, concurrency, auditability, and recovery.
5. Define create-only output-root ownership and exact inventory validation.
   Include path canonicalization, root ancestry checks, link-count policy,
   reparse and symlink rejection, nested directory rejection, file type,
   alternate streams, case collisions, and forbidden names.
6. Resolve time-of-check/time-of-use races while streaming hashes. Explain what
   handles or file IDs should remain stable and what metadata must be checked
   before and after reading.
7. Design streaming acquisition and conversion writes that never expose a
   partially written file as a valid artifact. Include chunk checksums,
   temporary object identity, final hash, final length, and terminal manifest
   ordering.
8. Specify behavior under disk full at every boundary: intent write, journal
   append, source download, model output, small receipt, terminal receipt,
   directory flush, and cleanup record. No case may report success from memory.
9. Define handling for locked directories, antivirus quarantine, delayed close,
   Windows rename sharing modes, Linux deleted-open files, and process crashes
   with inherited handles.
10. Design external-mutation detection after a terminal pass. State whether
    composition identity alone is enough, when full rehash is required, and
    whether file IDs or trusted read-only stores add value.
11. Define safe owned-root deletion for browser profiles and failed staging
    trees. Require ancestry proof, sentinel identity, no traversal, no links,
    bounded retries, and evidence that recursive deletion cannot escape.
12. Explain retention and operator-authorized cleanup without debt. There must
    be one cleanup protocol, no hidden best-effort path, and no deletion that
    rewrites history.
13. Provide Windows and Linux pseudocode for canonical bounded write,
    immutable large-file finalization, exact-directory inspection, journal
    append, recovery scan, and safe deletion.
14. Build a failure-injection matrix with process kills, VM power cuts, disk
    exhaustion, quota changes, handle locking, file replacement, reparse swap,
    hard-link insertion, bit flips, short reads, and stale directory metadata.
15. Recommend tools and techniques for crash testing, filesystem images, fault
    injection, and invariant checking using only reproducible public tooling.
16. State minimum real-platform evidence for Windows x64, Linux x64, and Linux
    arm64. Distinguish unit tests, emulation, VM tests, and physical hardware.
17. Provide objective release gates and typed failure categories. A skipped or
    unsupported durability test must remain visible and cannot become a pass.
18. Rank the highest-risk assumptions that must be checked against the actual
    implementation and deployment volumes.

Required report structure:

1. Executive durability contract and assumptions.
2. Platform and filesystem guarantee matrix.
3. Small-record atomic-write protocol.
4. Large-artifact finalization protocol.
5. Journal representation and recovery algorithm.
6. Exact-tree validation and hostile-mutation defense.
7. Disk-full, locks, and cleanup behavior.
8. Windows and Linux implementation sketches.
9. Fault-injection laboratory and evidence levels.
10. Release gates and residual risks.
11. Prioritized implementation plan.
12. Unknowns requiring local verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not equate rename with full crash durability, assume local filesystems are
all identical, accept links or unexpected inventory, overwrite an existing
root, delete failed evidence silently, hash large files by loading them wholly
into memory, or count cross-compilation as real-platform execution.

## Prompt 4: Secure Ephemeral Numeric-Loopback Browser Capability Protocol

You are an independent principal browser-security architect, local-agent
protocol designer, and web-platform interoperability researcher. Produce an
exceptionally detailed, implementation-ready security report selecting one
browser-to-local-Companion protocol for TinyRustLM. You may browse public sites,
standards, browser documentation, and browser source discussions, but you have
no access to private TinyRustLM code, an installed Companion, browser profile,
traffic capture, credential, or test result. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is a public HTTPS browser-local chat interface. Prompts and model
  bytes must not be uploaded to project web servers. A user-owned desktop
  Companion handles exact-model direct P2P acquisition or local conversion and
  may stream a verified composition to the browser.
- The product is prelaunch and will have one clean protocol. There is no legacy
  fixed port, alternate route family, migration, browser extension dependency,
  custom URI fallback, localhost hostname fallback, or permissive compatibility
  mode to preserve.
- The desired transport uses an ephemeral numeric loopback address, not a
  public listener. Browser access requires explicit user presence and a
  least-privilege, short-lived, operation-bound capability. An arbitrary web
  origin, local process, stale tab, different user account, or copied URL must
  not gain general filesystem, model-store, conversion, or status access.
- Discovery and pairing must not put a bearer secret in URL query strings,
  fragments, history, referrers, analytics, screenshots, logs, command lines,
  or durable browser storage. The website cannot truthfully claim the Companion
  is connected until a real authenticated handshake succeeds.
- The first browser use case is one bounded six-artifact composition transfer
  plus operation status and cancellation. No generic file server, directory
  listing, arbitrary proxy, shell, plugin API, or admin API is allowed.
- Chromium is the immediate proof browser; Firefox and WebKit behavior should
  be researched and accurately classified. Windows x64, Linux x64, and Linux
  arm64 matter. MemoryEndpoints is unauthorized and outside scope.

Research current primary sources for secure contexts, mixed content, loopback
origins, Private Network Access and Local Network Access, CORS, Fetch Metadata,
Origin and Referer behavior, DNS rebinding, CSRF, browser preflights, service
workers, CSP, COOP/COEP, WebSockets, WebTransport, HTTP streaming, TLS on
localhost, native messaging alternatives, custom schemes, and desktop app
activation. Record browser versions and dates; browser behavior is temporally
unstable and must be verified from current primary evidence.

Address all of the following in depth:

1. Define the attacker model: malicious public origin, compromised tab, XSS,
   DNS rebinding, drive-by requests, CSRF, malicious local process, another OS
   user, stale browser profile, replayed capability, extension, proxy, and
   loopback request smuggling.
2. Compare at least five discovery and pairing designs: user-entered numeric
   port plus code, desktop-opened browser handoff, browser-opened custom scheme,
   local bootstrap file, WebSocket rendezvous, and any stronger standards-based
   option. Select one and reject the others explicitly.
3. Determine whether HTTPS TinyRustLM can fetch plain HTTP numeric loopback in
   current Chromium. Analyze mixed-content exemptions, secure-context status,
   PNA/LNA preflight, enterprise policies, private browsing, and future risk.
4. Decide whether the Companion should use HTTP, HTTPS with a locally trusted
   certificate, WebSocket, or another transport. Include operational and
   security costs of certificate creation and trust installation.
5. Specify the exact user-presence ceremony. Define what the desktop displays,
   what the browser submits, timing, accessibility, retries, cancellation, and
   how consent is bound to one origin, one browser session, one operation, and
   one composition.
6. Define capability entropy, derivation, audience, scope, expiry, single-use
   or bounded-use semantics, storage, comparison, rotation, revocation, and
   redaction. Explain why capability possession alone is or is not sufficient.
7. Specify origin allowlisting and normalization. Address IDNA, default ports,
   trailing dots, redirects, opaque origins, `null` origins, development
   origins, subdomains, and scheme changes.
8. Define exact preflight, request, and response headers including CORS, Fetch
   Metadata, cache control, content type, content length, range policy, CSP
   interactions, and connection behavior. Reject all unspecified methods,
   routes, headers, and media types.
9. Design a canonical handshake transcript with nonces and binding to Companion
   installation identity, protocol schema, origin, numeric endpoint, operation,
   composition identity, expiry, and server process instance. Prevent replay
   after Companion restart or browser profile deletion.
10. Resolve port selection, bind-before-ready, IPv4 versus IPv6, dual-stack
    ambiguity, port collision, endpoint publication, firewall prompts, proxy
    bypass, and fail-closed behavior if only a non-loopback bind succeeds.
11. Specify route inventory for health without disclosure, pair, authorize
    operation, manifest, artifact stream, status, cancel, and close. Decide
    which routes should not exist in the first release.
12. Address browser reload, duplicate tabs, back-forward cache, service worker,
    stale in-memory capability, page crash, Companion restart, sleep/resume,
    and two simultaneous pairing attempts.
13. Define rate limits, header and body bounds, idle and total timeouts,
    concurrency, cancellation, audit fields, and privacy-preserving diagnostics.
14. Provide normative request/response examples and a finite state machine.
    Secrets in examples must be clearly synthetic and structurally redacted.
15. Build a hostile-origin test site matrix and browser automation plan. Test
    DNS rebinding, forbidden origins, no-cors modes, forms, images, scripts,
    redirects, preflight cache, service workers, and capability replay.
16. State exactly what Playwright can prove and what requires manual browser,
    installed desktop, OS-user isolation, firewall, proxy, and browser-update
    testing.
17. Define visible product status language from unavailable through paired,
    authorized, transferring, expired, revoked, and failed. No optimistic
    connected status is allowed.
18. Produce one normative protocol recommendation with a small first-release
    attack surface and a browser-change monitoring plan.

Required report structure:

1. Executive protocol decision and assumptions.
2. Current browser behavior observation matrix.
3. Threat model and trust boundaries.
4. Discovery and user-presence alternatives.
5. Selected handshake and capability state machine.
6. Normative HTTP or transport contract.
7. Origin, PNA/LNA, CORS, CSP, and DNS-rebinding defenses.
8. Restart, replay, concurrency, and revocation behavior.
9. Adversarial browser and OS test matrix.
10. Product status and error vocabulary.
11. Implementation sequence and stop rules.
12. Unknowns requiring local or authorized proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend a fixed bearer token, query-string secret, wildcard CORS,
hostname-based trust, arbitrary file serving, public bind, silent firewall or
certificate changes, optimistic connection status, browser extension as a
hidden requirement, or an undocumented fallback transport.

## Prompt 5: Companion Installation Identity, Distribution, And Multi-User Isolation

You are an independent principal desktop-security architect, software-supply-
chain engineer, and Windows/Linux installation specialist. Produce an
exceptionally detailed report defining one clean installation and identity
model for the TinyRustLM Companion. You may browse primary operating-system,
package, signing, and deployment documentation, but you have no access to any
TinyRustLM source code, installer, binaries, signing keys, machines, deployment
account, or test results. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. Its HTTPS browser UI
  performs local inference. A downloadable desktop Companion acquires exact
  model compositions from consenting direct peers or invokes one canonical
  local converter when no eligible peer is available and the user approves.
- The product may choose one clean installation design. There is no installed
  legacy population, upgrade compatibility requirement, old service, old port,
  old credential store, alternate package, migration code, alias, or fallback
  launcher to preserve.
- The Companion must listen only on a numeric loopback endpoint, prove a real
  authenticated browser pairing before reporting connected, and expose only a
  bounded operation-scoped capability. It is not a generic local API or file
  server.
- Each installation needs a cryptographically meaningful identity that can be
  bound into a browser pairing transcript and invalidated on reinstall or
  reset. It must not expose a workspace administrator credential, cloud token,
  signing key, or reusable bearer secret to the website.
- Model and source files may be large and live outside the program directory.
  Two process lanes may later share one read-only artifact store, but arbitrary
  OS users must not gain access. A browser tab for one signed-in OS user must
  not control another user's Companion operation.
- Required release targets are Windows x64, Linux x64, and Linux arm64. The
  .NET application wraps a Rust native runtime through a deliberately small C
  ABI. Package creation or cross-compilation is not execution proof.
- Public evidence can include versions, hashes, signer identities, package
  identities, RID, statuses, and timestamps. It cannot include private paths,
  pairing secrets, tokens, prompts, or model contents. MemoryEndpoints is
  unauthorized and outside scope.

Research current primary sources for Windows MSIX/MSI or other appropriate
installer technology, Authenticode, SmartScreen implications, per-user versus
per-machine install, ACLs, DPAPI, CNG, Windows services and scheduled tasks,
Linux package formats, systemd user services, XDG directories, file modes,
secret-service APIs, code signing, Sigstore and provenance, update frameworks,
process mitigation, and native dependency loading. Evaluate realistic
prelaunch distribution without assuming a private enterprise management plane.

Address all of the following in depth:

1. Define the identities for release, package, archive, native library,
   executable, installation, OS user, running process, loopback endpoint,
   operation, and pairing capability. State which are signed, hashed, random,
   ephemeral, or human-facing.
2. Compare per-user install, per-machine install with per-user process, system
   service plus user broker, portable archive, MSIX, MSI, winget-style package,
   Linux distribution package, and self-contained archive. Select one first-
   release shape per OS and reject unsafe or debt-producing alternatives.
3. Decide how installation identity is generated, stored, protected, rotated,
   reset, and destroyed. Compare platform key stores, protected files, TPM or
   hardware-backed options, and software-only keys. Specify the minimum viable
   trust claim honestly.
4. Design first-run user presence and browser pairing. Bind the ceremony to one
   signed installation, one OS user, one process instance, one allowed HTTPS
   origin, and one short-lived operation capability.
5. Specify multi-user isolation on shared Windows and Linux machines. Address
   sessions, fast user switching, remote desktop, containers, WSL, sudo,
   administrator or root powers, home-directory permissions, and inherited
   environment variables.
6. Define program, configuration, journal, cache, source, model store, staging,
   log, crash dump, and secret paths. Give normative ACL or mode requirements
   and prohibit writable code or library search locations.
7. Audit native library loading for DLL or shared-object hijacking, search-path
   confusion, RID mismatch, architecture mismatch, side loading, quarantine,
   and tampered package assets. Specify exact hash and signature checks.
8. Decide whether the Companion should auto-start. Compare explicit launch,
   per-user startup entry, systemd user service, Windows service, scheduled
   task, and browser-triggered activation. Include UX, attack surface, and
   process-ownership implications.
9. Specify update semantics for a prelaunch clean slate. A new release may
   replace the sole supported version, but active conversion attempts and
   immutable evidence must not be silently rewritten. Define drain, stop,
   install, rollback, and fail-closed rules without leaving compatibility code.
10. Define uninstallation and reset. Distinguish executable removal, identity
    revocation, private evidence retention, model-store retention, explicit
    destructive cleanup, and proof that no active operation is deleted.
11. Design package contents and allowlists for Windows x64, Linux x64, and
    Linux arm64. Cover symbols, licenses, SBOM, SourceLink, native hashes,
    provenance, signatures, and archive traversal defenses.
12. Define public release metadata and a signed update or download manifest.
    Address key rotation, revocation, expiry, rollback attack, mirror behavior,
    HTTPS readback, and compromised release response.
13. Specify process mitigations, privilege dropping, environment scrubbing,
    command-line secrecy, crash-dump policy, logging bounds, and telemetry-off
    defaults.
14. Build an adversarial test matrix for another OS user, stale installation,
    copied data directory, replaced executable, malicious DLL, world-writable
    path, unsigned update, downgrade, endpoint collision, and simultaneous
    sessions.
15. Distinguish package inspection, sandbox tests, clean-VM install, real user
    switching, real signing, and real hardware evidence. State the minimum
    release gate per RID.
16. Provide PowerShell, C#, Rust, shell, and systemd pseudocode where useful,
    but do not assume undocumented private APIs.
17. Define operator-visible states and typed errors for unavailable,
    untrusted-installation, identity-missing, identity-reset, origin-denied,
    paired, busy, draining, update-required, and revoked.
18. Produce a staged implementation and release plan that leaves one supported
    installation path per platform and no dormant legacy code.

Required report structure:

1. Executive installation decision and assumptions.
2. Identity and trust graph.
3. Installer and process-model alternatives.
4. Selected Windows and Linux layouts.
5. Installation key, pairing, and multi-user protocol.
6. Filesystem, ACL, secret, and native-loading controls.
7. Update, rollback, uninstall, and reset semantics.
8. Package, signing, SBOM, and provenance contract.
9. Threat and adversarial test matrix.
10. RID evidence and release gates.
11. Prioritized implementation plan.
12. Unknowns requiring local or signing access.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend administrator credentials in the browser, public listeners,
world-writable stores, command-line secrets, unsigned silent updates, generic
plugin loading, automatic router or firewall changes, dual installers for
compatibility, or an auto-start mechanism whose ownership cannot be proved.

## Prompt 6: Bounded Six-Artifact Transfer With Resume And End-To-End Identity

You are an independent principal streaming-protocol engineer, content-addressed
storage architect, and browser networking specialist. Produce an exceptionally
detailed report specifying one bounded protocol by which a local desktop
Companion transfers one already verified TinyRustLM composition to a browser.
You may browse public standards and official browser, HTTP, Rust, and .NET
documentation. You have no access to TinyRustLM code, model files, manifests,
traffic, a browser profile, or test output. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product and can use one sole protocol with no
  legacy routes, alternate manifest, compatibility range behavior, migration,
  fallback download, or generic file API.
- The HTTPS browser UI runs inference locally. Model bytes and prompts must not
  traverse project web servers. A user-owned Companion first acquires an exact
  eligible composition by direct P2P or creates it with an approved local
  conversion. Only then may it offer the composition on numeric loopback to an
  explicitly paired browser operation.
- One composition contains exactly six ordered artifacts: SLM2 model,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. Every artifact has an
  exact byte length, SHA-256 identity, media type, role, and ordering. ACG2
  closes the identities and relevant runtime/profile contracts.
- The browser must verify the complete identity graph before atomic activation.
  A tiny fixture, partial set, stale alias, same-name model, relabeled bytes,
  or source metadata row cannot satisfy a real-model operation.
- The transfer must be bounded, streaming, cancellable, backpressured, and
  resumable only from independently verified units. It must survive browser
  worker termination, page crash, Companion restart, network interruption on
  loopback, disk quota, and duplicate requests without best-of-N behavior or
  silent restart from unverified data.
- A secure short-lived capability binds origin, installation, operation,
  composition, and expiry. No bearer secret may appear in a URL or durable
  browser store. No arbitrary path, directory listing, upload, proxy, or public
  listener is allowed.
- Chromium is the immediate proof target; current Firefox and WebKit support
  should be classified. MemoryEndpoints is unauthorized and outside scope.

Research current primary sources for HTTP semantics, conditional requests,
range requests, content digests, Web Streams, Fetch, BYOB readers, AbortSignal,
backpressure, service worker behavior, OPFS synchronous access in workers,
streaming SHA-256 options, BLAKE3 only as a comparison, and browser memory-copy
behavior. Compare whole-artifact endpoints, fixed content-addressed pieces,
framed multiplexed streams, and one archive stream. Select one protocol.

Address all of the following in depth:

1. Define transfer identities for composition, artifact, piece, transfer
   session, capability, request, verified extent, checkpoint, and activation.
   Separate durable identity from retry or observation identity.
2. Compare whole files, fixed-size pieces, variable content-defined chunks,
   archive framing, HTTP ranges, and custom frames. Evaluate memory, resume,
   integrity, cacheability, attack surface, and implementation complexity.
3. Select piece size or a formula with hard bounds. Include effects on a 0.6B
   mixed-Q8 model, small metadata artifacts, SHA-256 work, journal size, OPFS
   writes, HTTP overhead, and cancellation latency without inventing timings.
4. Specify a canonical manifest delivered before bytes. Include exact schema,
   ordered inventory, sizes, artifact and piece hashes, media types, profile
   identities, aggregate size, limits, capability binding, and expiry.
5. Define exact routes, methods, request headers, response headers, status
   codes, and bodies. Address `HEAD`, `GET`, ranges if used, content length,
   content type, cache control, ETag semantics, CORS, Fetch Metadata, and
   connection closure. Reject everything unspecified.
6. Design browser admission before transfer. Verify schema, exact inventory,
   aggregate resource limits, available quota, runtime compatibility, identity
   closure, capability scope, and the absence of an already active conflicting
   operation.
7. Specify streaming and backpressure from disk through Companion, HTTP stack,
   browser network stack, worker, hasher, and OPFS. Identify every possible
   whole-artifact copy and how to prevent it.
8. Define checkpoint persistence and resume. A checkpoint must bind manifest,
   piece identities, exact verified bytes, browser store generation, protocol
   version, and operation. State how duplicate and out-of-order pieces behave.
9. Resolve Companion restart during transfer. Decide whether a new process may
   honor the old capability or must conduct a fresh user-present authorization,
   and how already verified browser pieces remain reusable without replay risk.
10. Define cancellation at manifest fetch, piece request, streaming read,
    hashing, durable write, checkpoint commit, final verification, and
    activation. No stale event may later convert cancellation into success.
11. Address malicious or corrupt Companion responses: wrong length, truncated
    stream, extra bytes, hash mismatch, reordered pieces, duplicate headers,
    compressed content, redirect, slow response, endless stream, and identity
    swap between requests.
12. Define concurrency. Decide whether pieces may transfer in parallel, give
    global and per-composition limits, weighted fairness, bandwidth controls,
    and memory formulas. Explain why maximum parallelism is not always faster.
13. Specify final full-artifact and composition verification independently of
    transport. Decide whether piece hashes plus lengths eliminate a final
    streamed full hash or whether both are required.
14. Provide normative manifest and HTTP examples using synthetic hashes, plus
    browser TypeScript, C#, and Rust pseudocode for transfer and resume.
15. Build a fault-injection matrix for aborts, dropped connections, stale
    capability, process death, worker death, quota exhaustion, corrupt piece,
    duplicate response, changed manifest, and store tampering.
16. Define network assertions proving model bytes travel only over numeric
    loopback or direct peer paths and never through public project origins,
    analytics, service workers, or third-party hosts.
17. Specify performance measurements and formulas for useful throughput,
    memory high-water mark, storage amplification, hash CPU, time to cancel,
    and resumed-byte savings. Require raw measurements from local proof.
18. Produce objective acceptance criteria for one real composition transfer,
    cancellation, restart, resume, final activation handoff, and profile
    deletion.

Required report structure:

1. Executive protocol decision and assumptions.
2. Identity and trust model.
3. Chunking and transport alternatives.
4. Normative manifest and HTTP contract.
5. Browser admission and resource policy.
6. Streaming, backpressure, and memory model.
7. Checkpoint, resume, restart, and cancellation algorithms.
8. Integrity, hostile-response, and privacy analysis.
9. C#/Rust/TypeScript pseudocode and examples.
10. Fault-injection and browser test matrix.
11. Performance evidence and acceptance gates.
12. Unknowns requiring local verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend an instruction-file download, public model-byte fallback,
arbitrary file path, unbounded response, archive extraction without an exact
allowlist, unchecked HTTP range assembly, resume from unhashed bytes, wildcard
CORS, capability in a URL, or fixture bytes as proof of a real model transfer.

## Prompt 7: Crash-Consistent Browser Composition Store And Atomic Activation

You are an independent principal browser-storage architect, transactional-state
engineer, and web reliability researcher. Produce an exceptionally detailed,
implementation-ready report selecting one durable browser storage and atomic
activation design for a real TinyRustLM composition. You may inspect public
browser standards, implementation documentation, and storage research, but you
have no access to TinyRustLM code, a browser profile, model files, receipts,
screenshots, or test results. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local chat product. It may adopt one clean
  storage layout and has no legacy IndexedDB schema, cache migration, old model
  format, alias, fallback reader, or dual activation path to preserve.
- One model composition consists of exactly six content-addressed artifacts:
  SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. The browser receives
  them from an explicitly paired numeric-loopback Companion after exact
  manifest admission and streamed verification.
- A composition is unusable until all six artifacts, their sizes and hashes,
  cross-references, runtime compatibility, and aggregate identity validate.
  Partial or corrupt bytes must never become the current model. A previously
  valid composition must not be lost merely because a new admission fails.
- The browser performs inference in a dedicated worker. Worker termination,
  page crash, browser process crash, browser update, operating-system restart,
  quota pressure, storage eviction, and fresh-profile deletion are distinct
  events and must be reported honestly.
- Large model files must be streamed without whole-model JavaScript heap copies.
  The first target is Chromium, with Firefox and WebKit accurately classified.
  The product must not upload prompts or model bytes, and must not leave secrets
  in durable browser storage. MemoryEndpoints is unauthorized and outside
  scope.

Research current primary documentation and specifications for OPFS, File System
Access, IndexedDB transactions, Cache Storage, StorageManager estimates and
persistence, storage buckets where available, eviction, origin partitioning,
private browsing, service workers, Web Locks, BroadcastChannel, structured
clone, worker synchronous access handles, browser profile deletion, and quota
behavior. Record implementation versions and dates because support changes.

Address all of the following in depth:

1. Define identities for staging generation, artifact object, verified piece,
   complete composition, activation record, current selection, worker lease,
   and deletion receipt. Separate content identity from mutable UI preference.
2. Compare OPFS, IndexedDB blobs, Cache Storage, File System Access handles,
   memory-only operation, and a hybrid. Evaluate size limits, streaming,
   transactionality, worker APIs, eviction, portability, and privacy.
3. Select one first-release storage architecture and define exact ownership of
   bytes and metadata. State which browser facilities are authoritative and
   which are only caches or indexes.
4. Design a staging namespace that is create-only by operation and composition
   identity. Prevent collisions, path traversal, case ambiguity, stale aliasing,
   and accidental reuse of a different manifest.
5. Specify durable piece writes and verified extents. Address synchronous versus
   asynchronous OPFS access, flush semantics, transaction boundaries, worker
   death, browser crash, and the limitations of durability guarantees.
6. Define finalization: close all handles, verify exact artifact lengths and
   hashes, verify ACG2 cross-references, write a complete immutable record, then
   atomically switch a tiny activation pointer. Identify the linearization
   point and every crash outcome.
7. Decide how to represent the activation pointer and generation metadata.
   Compare one IndexedDB transaction, OPFS file replacement, append-only event
   log, and content-addressed pointer records.
8. Resolve simultaneous tabs and workers. Use Web Locks or an alternative to
   ensure one writer, bounded readers, deterministic cancellation, and no
   duplicate activation. Address crash release and unsupported browsers.
9. Specify startup recovery. Enumerate active valid generation, no activation,
   missing artifact, partial staging, stale checkpoint, changed runtime,
   incompatible schema, corrupted metadata, and externally evicted bytes.
10. Define storage preflight and quota policy. Give formulas for source transfer
    size, piece metadata, temporary amplification, final bytes, runtime scratch,
    KV cache, evidence, and safety margin. Do not invent universal quotas.
11. Address `navigator.storage.persist()`: user gesture, browser discretion,
    truthful UI, denial, later eviction, and why persistence permission is not
    proof that bytes still exist.
12. Define model switching and deletion. A user command may select or delete a
    complete composition, but active worker leases and references must be
    drained. Failed staging cleanup must never delete an active composition.
13. Specify secret and privacy scanning of OPFS, IndexedDB, Cache Storage,
    service worker state, logs, traces, screenshots, and URLs. Model bytes may
    be local, while operation capabilities and prompts have stricter retention.
14. Provide TypeScript pseudocode for admit, stage piece, checkpoint, finalize,
    activate, open worker lease, switch, recover, and explicitly delete.
15. Build deterministic fault injection for every write and transaction
    boundary, quota exhaustion, worker kill, page kill, browser kill, profile
    deletion, two tabs, stale service worker, and storage eviction simulation.
16. Design real-browser evidence that distinguishes page reload, context reset,
    browser process restart, OS restart, profile reuse, and actual owned-profile
    deletion. Define what Playwright can and cannot prove.
17. Define portability tiers for Chromium, Firefox, and WebKit without adding a
    fallback storage path. Unsupported capability must be a truthful typed
    blocker, not a weaker silent mode.
18. Give objective gates for one real composition: zero partial activation,
    restart recovery, cancellation, corruption rejection, old-valid retention,
    explicit deletion, bounded memory, and no secret persistence.

Required report structure:

1. Executive storage decision and assumptions.
2. Current browser capability matrix.
3. Identity, ownership, and trust model.
4. Selected physical and logical layout.
5. Staging, verification, and atomic activation algorithm.
6. Concurrency, leases, restart, and recovery.
7. Quota, persistence, eviction, and deletion policy.
8. Privacy and secret boundary.
9. TypeScript pseudocode and record schemas.
10. Fault-injection and real-browser proof matrix.
11. Acceptance gates and residual risks.
12. Unknowns requiring local verification.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend `localStorage`, one giant in-memory Blob, activation before all
hashes close, service-worker cache as unquestioned authority, silent storage
fallback, migration code, best-effort deletion claims, or a page reload as
proof of browser-profile restart.

## Prompt 8: Browser-WASM Memory Architecture For A Real Qwen3 0.6B Composition

You are an independent principal WebAssembly runtime engineer, transformer
inference architect, and browser performance scientist. Produce an
exceptionally detailed report determining whether and how a real Qwen3-class
approximately 0.6B dense model can run usefully in a modern browser under one
clean TinyRustLM runtime design. You may inspect public papers, model cards,
immutable model repositories, WebAssembly specifications, browser
documentation, and engine sources. You have no access to any TinyRustLM source,
SLM2 file, benchmark, browser trace, machine, or test result. Do not claim
private validation or invent performance numbers.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local chat product. It will support one
  production SLM2 composition path, not an older runtime plus a compatibility
  runtime. Technical names such as SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2 are exact contract identities.
- The first target is a provenance-bound Qwen3-class approximately 0.6B model,
  likely using a deterministic mixed-Q8 weight profile. The exact immutable
  source revision, architecture values, tokenizer, chat semantics, and license
  must be verified separately before promotion.
- The browser receives six verified artifacts and performs inference in a
  dedicated worker. The model should not be copied wholesale through the
  JavaScript heap. Prompts and model bytes remain local. Cancellation must
  terminate real work, and recovery must start a fresh worker and reopen only
  a complete verified composition.
- Scalar native Rust is the correctness reference. Browser WASM must use the
  same model identity, token IDs, prompt bytes, Template2, Sampling2, seeds, and
  declared numerical tolerances. Response repair, best-of-N, hidden retries,
  output substitution, and simulated tokens are forbidden.
- Browser resource status must be truthful. Unsupported SIMD, threads, memory,
  storage, or isolation is a typed blocker. No low-quality fallback runtime is
  permitted. Chromium is the first proof target; Firefox and WebKit support
  should be classified without pretending unexecuted support.
- MemoryEndpoints is unauthorized and outside scope.

Research current primary sources for WebAssembly 32-bit and memory64 address
spaces, multi-memory, SIMD, relaxed SIMD, threads and atomics, SharedArrayBuffer,
COOP/COEP, transferable and shared buffers, module compilation caching, OPFS
synchronous access handles, memory mapping limitations, JS/WASM copies,
browser process limits, and WebGPU only as a separately evaluated alternative.
Research Qwen3 architecture from immutable official sources.

Address all of the following in depth:

1. Build a symbolic memory model for quantized weights, scales, metadata,
   tokenizer tables, prompt tokens, activations, temporary matmul buffers,
   logits, sampler state, KV cache, WASM linear memory, JS wrappers, storage
   read buffers, browser overhead, and safety margin.
2. Use official Qwen3 architecture values where publicly verifiable and retain
   variables where not. Give formulas for KV bytes by layers, KV heads, head
   dimension, context tokens, element width, batch, and cache strategy.
3. Compare eager full-weight loading, staged layer loading, OPFS-backed reads,
   windowed weight buffers, multiple memories, and browser-native mapping if any
   exists. State which designs are actually possible in current browsers.
4. Determine whether a WASM32 linear memory is sufficient after alignment and
   transient copies. Explain memory growth costs, fragmentation, maximum pages,
   browser-specific caps, and why nominal 4 GiB is not usable headroom.
5. Evaluate memory64 and multi-memory maturity in current Chromium, Firefox,
   WebKit, Rust toolchains, wasm-bindgen, and deployment pipelines. Do not base
   first-release correctness on experimental support without explicit gating.
6. Design a zero-or-minimal-copy path from OPFS to WASM. Identify unavoidable
   copies and propose bounded slabs, alignment, prefetch, and double buffering.
7. Specify mixed-Q8 tensor layout for CPU/WASM SIMD consumption: block size,
   scale storage, zero-point policy, row alignment, tails, endianness,
   accumulation precision, overflow bounds, and deterministic reduction order.
8. Compare scalar, WebAssembly SIMD, threaded SIMD, and WebGPU execution. Select
   the correctness reference and acceleration tiers. Explain how unsupported
   tiers fail without a hidden lower-quality model or altered sampling.
9. Design KV-cache storage and invalidation for multi-turn conversation. Cover
   GQA, RoPE positions, prefix reuse, current-turn precedence, cancellation,
   model switching, context truncation, quantized KV only if quality is proven,
   and fresh-worker recovery.
10. Define worker ownership and cancellation. Compare cooperative atomic flag,
    bounded polling, worker termination, process isolation, and partial output.
    State when raw output is retained and how stale messages are rejected.
11. Specify initialization phases and visible status: capability check, manifest
    open, artifact verification, module compile, model admission, weight access,
    warmup if allowed, prompt encode, prefill, decode, cancel, and close.
12. Design deterministic native/WASM conformance at tensor, layer, logits,
    token, and raw-output levels. Define absolute, relative, ULP, cosine, rank,
    and top-k-set tolerances only where justified.
13. Specify benchmark methodology for cold and warm startup, first-token
    latency, tokens per second, peak resident memory, WASM pages, storage read,
    KV growth, cancellation latency, and long-session stability. Use formulas,
    not invented measurements.
14. Define a device and browser matrix with low, middle, and high resource
    classes. State admission thresholds and stop rules before allocating model
    memory.
15. Build a failure-injection matrix for WASM trap, out-of-memory, failed grow,
    worker death, corrupted tensor, invalid alignment, storage eviction,
    cancellation race, stale message, browser backgrounding, and sleep/resume.
16. Analyze security: bounds checks, malformed model dimensions, integer
    overflow, allocation bombs, speculative external fetches, timing data,
    cross-origin isolation, and untrusted model metadata.
17. Separate claims provable in unit tests, headless Chromium, headed Chromium,
    multiple physical devices, Firefox, WebKit, and long-duration dogfood.
18. Give a go/no-go decision framework and a prioritized experimental plan that
    can reject an infeasible design early without lowering quality gates.

Required report structure:

1. Executive feasibility decision and assumptions.
2. Verified Qwen3 architecture inputs and unknowns.
3. Complete symbolic memory budget.
4. Browser/WASM capability matrix with dates.
5. Selected weight-loading and kernel architecture.
6. KV cache, worker, and cancellation design.
7. Native/WASM numerical conformance protocol.
8. Benchmark and device matrix.
9. Fault, security, and resource-admission matrix.
10. Staged experiments, stop rules, and acceptance gates.
11. Unknowns requiring local execution.
12. Annotated primary-source bibliography with dates and direct links.

Do not invent tokens-per-second or memory measurements, assume nominal WASM
limits equal usable limits, copy the whole model through JavaScript, count a
tiny fixture as a real-model proof, use WebGPU as an unverified magic answer,
hide fallback behavior, repair raw output, or count headless-only execution as
complete browser evidence.

## Prompt 9: Publisher-Exact Qwen3 Semantics And Six-Artifact Lowering

You are an independent principal transformer-format engineer, tokenizer
specialist, and cross-runtime conformance researcher. Produce an exceptionally
detailed report defining how one immutable official Qwen3 approximately 0.6B
source revision should be interpreted and lowered into a complete TinyRustLM
composition without relying on undocumented framework defaults. You may browse
official model repositories, model cards, source framework documentation,
tokenizer libraries, papers, and immutable public code revisions. You do not
have access to any TinyRustLM code, private source lock, SLM2 artifact,
converter, tests, model output, or machine. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. It will support one
  clean production composition path with no legacy model reader, format alias,
  architecture guess, automatic default, compatibility shim, output repair, or
  fallback model.
- The first intended source family is an official Qwen3 dense model near 0.6B
  parameters, subject to immutable revision, provenance, license, architecture,
  and behavioral screening. The report must verify current public facts rather
  than trust the supplied family label.
- A complete composition contains exactly six ordered artifacts. SLM2 carries
  architecture and quantized tensor bytes. Tokenizer2 carries exact tokenizer
  semantics. Template2 carries deterministic conversation serialization.
  Sampling2 carries the declared decoding algorithm and parameters. Prompt2
  carries the exact product-owned system prompt identity. ACG2 closes all
  artifact identities, compatibility claims, source revision, and conversion
  profile.
- Scalar native Rust is the reference runtime. Browser WASM must receive the
  same artifacts, token IDs, prompt bytes, positions, masks, logits semantics,
  seed, and sampler decisions. Framework output is an external oracle for
  comparison, not a source of hidden defaults.
- Raw output is preserved. No retry chosen for best output, expected-token
  injection, answer completion, stop-token stripping beyond the declared
  contract, transcript repair, or altered browser prompt is allowed.
- The product uses technical schema names ending in `2`; that does not create a
  public product V2 or compatibility obligation. MemoryEndpoints is
  unauthorized and outside scope.

Research the exact official Qwen3 source revision and all files needed to
reconstruct semantics: configuration, safetensors index and shards, tokenizer
JSON and configuration, special-token map, generation configuration, chat
template, model code, and license. Pin commit hashes and file hashes where
possible. Use primary source framework code to identify behavior that model
metadata alone does not specify.

Address all of the following in depth:

1. Identify the strongest candidate official approximately 0.6B source and one
   immutable repository revision. Record publisher, repository, revision,
   release/update dates, retrieval date, license text and conditions, gated or
   ungated status, file inventory, and unresolved provenance questions.
2. Enumerate every architecture value required for exact inference: model type,
   vocabulary, hidden and intermediate sizes, layers, query and KV heads, head
   dimension, GQA mapping, normalization kind and epsilon, activation, RoPE
   theta and scaling, maximum positions, attention bias, embedding tying,
   output head, and tensor dtype.
3. Derive the exact tensor inventory from configuration and safetensors index.
   Give names, shapes, expected counts, shard mapping, aliases or tying,
   transpose requirements, and rejection rules for missing, duplicate, extra,
   overlapping, or unsupported tensors.
4. Specify all numerical operations and ordering: RMS normalization, Q/K/V
   projection, RoPE pairing and position convention, attention scaling, causal
   mask, grouped-query expansion, softmax precision, output projection,
   residuals, gated MLP, final norm, tied or separate logits, and accumulation.
5. Reconstruct Tokenizer2 exactly. Cover normalization, pre-tokenization, BPE or
   other model, merges, byte fallback, added tokens, special tokens, whitespace,
   Unicode, invalid input, encode/decode asymmetry, and deterministic test
   vectors. Distinguish tokenizer library behavior from files.
6. Reconstruct the official chat template. Cover system, user, assistant, tool
   roles if present, start/end delimiters, generation prompt, assistant prefix,
   empty content, multiple system messages, multi-turn history, and special
   options such as thinking mode only if the pinned source actually defines
   them.
7. Decide which chat behaviors belong in Template2 and which are deliberately
   unsupported. Compile the selected behavior into a finite deterministic
   contract with no arbitrary template interpreter in production.
8. Define Prompt2 boundaries. Separate publisher template, product system
   prompt, user conversation, retrieved untrusted memory, and tool output. State
   exact precedence and prevent text data from becoming control instructions.
9. Reconstruct generation defaults from official sources, then explain why the
   product should encode an explicit Sampling2 instead of inheriting mutable
   framework defaults. Cover temperature, top-k, top-p, minimum probability if
   relevant, repetition penalty, seed, EOS, stop sequences, maximum new tokens,
   and greedy mode.
10. Specify prompt/token position and KV-cache semantics across multi-turn
    conversation, cancellation, continuation, context truncation, and a fresh
    worker. Define what can be cached and what must invalidate.
11. Design the source-lock record and acquisition verification: exact files,
    hashes, sizes, immutable URL or revision, license decision, downloader
    identity, retrieval receipt, and rejection on repository drift.
12. Define the SLM2 lowering profile. Map every source tensor and architecture
    value to an explicit destination field, alignment, quantization class,
    byte order, checksum, and component receipt. Unknown values fail closed.
13. Define ACG2 closure: source identity, six artifact identities, conversion
    profile, runtime ABI, required browser features, context ceiling, quality
    receipt identity, and prohibited claims.
14. Provide golden conformance cases from tiny synthetic tensors through a
    small public checkpoint and finally the real pinned source. Include token
    vectors, prompt bytes, per-layer probes, logits, sampled tokens, and raw
    text.
15. Design first-divergence tooling that compares the pinned source framework,
    scalar Rust, optimized native Rust, and browser WASM without one
    implementation hiding another's error.
16. Analyze framework/version drift. Pin every package and code revision needed
    to materialize oracle outputs; archive public-safe identities without
    treating mutable latest behavior as authority.
17. Define rejection criteria for license ambiguity, unsupported architecture,
    tokenizer mismatch, template ambiguity, unexpected remote code,
    safetensors mismatch, numerical divergence, or missing immutable revision.
18. Produce a staged implementation checklist in dependency order with no
    semantic decision left to runtime heuristics.

Required report structure:

1. Executive source and semantics decision.
2. Immutable source, provenance, license, and file inventory.
3. Architecture and tensor schema.
4. Exact forward-pass semantics.
5. Tokenizer2 specification and vectors.
6. Template2 and Prompt2 specification.
7. Sampling2 specification.
8. SLM2 lowering and ACG2 identity closure.
9. Source-framework/native/WASM conformance plan.
10. Drift, rejection, and residual-risk matrix.
11. Prioritized implementation sequence.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not infer architecture from a family name, use a mutable branch as source
identity, execute unreviewed remote code, inherit framework defaults at runtime,
ship a general-purpose chat-template interpreter, silently add or remove
special tokens, repair generated text, or declare parity from one attractive
response.

## Prompt 10: Mixed-Q8 Quantization And SIMD Kernels With Measured Quality Preservation

You are an independent principal quantization researcher, CPU kernel engineer,
and numerical-validation scientist. Produce an exceptionally detailed report
selecting one deterministic mixed-Q8 conversion and execution profile for an
official Qwen3 approximately 0.6B model in TinyRustLM. Investigate relevant
lessons from TurboQuant, TurboVec, and comparable public research, but do not
assume those names describe a directly reusable library or license. You may
browse papers, official repositories, model cards, and hardware documentation.
You have no access to TinyRustLM code, model artifacts, kernels, benchmarks,
evaluation outputs, or machines. Do not claim private validation or invent
speedups.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is a prelaunch browser-local AI product with one clean SLM2 model
  path and no legacy quantizer, compatibility kernel, alternate model format,
  low-quality fallback, or permission to retain code debt.
- The first target is a provenance-bound dense Qwen3-class model near 0.6B
  parameters. Candidate promotion requires untouched conversational quality,
  practical judgment, ambiguity handling, current-turn precedence, untrusted
  memory handling, summaries, rewrites, structured output, code explanation,
  and direct treatment of lawful adult questions. Arithmetic is secondary.
- The intended first profile is mixed-Q8: eight-bit weight storage for most
  matrices, with explicitly justified exceptions for quality or runtime
  requirements. The exact scheme, scale granularity, metadata, tensor
  exceptions, activation precision, and accumulation precision are not to be
  guessed.
- Scalar Rust inference is the correctness reference. Native SIMD and browser
  WASM SIMD must implement the same declared model and quantization semantics.
  Sampling uses one explicit profile and fixed seeds for conformance.
- Conversion is deterministic and create-only. Every tensor has source and
  destination hashes, shape, quantization parameters, error metrics, and an
  aggregate receipt. Raw source and model outputs are preserved outside public
  evidence.
- Performance and quality claims require local measurement. Structural
  conversion, parameter count, popularity, or one response is not proof.
  MemoryEndpoints is unauthorized and outside scope.

Research primary quantization literature and official implementations covering
symmetric and asymmetric int8, per-tensor, per-channel, per-row and groupwise
scales, weight-only and weight-activation quantization, SmoothQuant, GPTQ, AWQ,
HQQ, SpinQuant or QuaRot where relevant, outlier handling, activation-aware
calibration, integer and floating accumulation, KV-cache quantization, and
vectorized lookup or unpacking. Analyze TurboQuant and TurboVec only from
verifiable public sources and separate transferable principles from unsupported
marketing or implementation claims.

Address all of the following in depth:

1. Establish a terminology table for bit width, effective bits per weight,
   block metadata, scale precision, zero points, packing, activation dtype,
   accumulator dtype, and end-to-end storage. Prevent a nominal `8-bit` label
   from hiding materially larger storage.
2. Compare at least six credible quantization profiles for this model and CPU/
   WASM target. Include simple deterministic round-to-nearest symmetric int8,
   groupwise variants, activation-aware methods, rotation/outlier methods, and
   any credible TurboQuant-related approach.
3. Select one conservative first profile and one research-only challenger.
   Explain why the first profile is portable, deterministic, auditable, and
   likely to preserve behavior, and define stop rules for the challenger.
4. Decide tensor-by-tensor treatment for embeddings, Q/K/V/O projections, gate,
   up and down projections, normalization weights, output head, tied weights,
   biases if any, scales, and small metadata tensors. Justify every exception.
5. Specify quantization math exactly: grouping axis and size, min/max or norm
   statistics, scale formula, clipping, zero-point rule, tie rounding,
   saturation, NaN/Inf handling, signed-byte encoding, scale dtype, tails,
   endianness, and deterministic parallel reduction.
6. Analyze calibration requirements. Determine whether weight-only Q8 can be
   calibration-free and what activation-aware alternatives require. If a
   corpus is used, define provenance, licensing, contamination separation,
   sample selection, sequence length, and reproducibility.
7. Define per-tensor error evidence: maximum absolute and relative error,
   RMSE, cosine similarity, signal-to-quantization-noise ratio where useful,
   outlier counts, clipping counts, and size. Explain which metrics predict
   little about behavioral quality.
8. Design scalar dequantization and matmul as the executable specification.
   Cover accumulator precision, reduction order, FMA differences, overflow,
   alignment, tails, and deterministic threading.
9. Design native SIMD kernels for relevant x86-64 and arm64 feature levels.
   Compare AVX2, AVX-512 variants only when present, NEON, dot-product
   extensions, and portable fallback as a correctness tier rather than a
   different model. Include dispatch and feature attestation.
10. Design WebAssembly SIMD kernels under current standardized operations.
    Explain signed byte widening or dot operations, horizontal reductions,
    scale application, alignment, memory layout, and browser-engine variance.
11. Extract any useful TurboVec lessons for layout, cache blocking, vector
    width, prefetch, packing, fused operations, and dispatch. Clearly label
    inference where public sources do not expose implementation details.
12. Analyze weight layout for streaming conversion and browser loading. Define
    rows, blocks, alignment, offset table, size formulas, checksum boundaries,
    and random access without full unpacking.
13. Decide whether KV-cache quantization belongs in the first model. Quantify
    memory formulas and quality risks; require an independent gate and reject
    bundling it into weight-Q8 claims without evidence.
14. Design numerical conformance from float source to quantized scalar, native
    SIMD, and WASM SIMD at tensor, layer, logit, rank, sampled-token, and raw-
    output levels. Define when exact equality is expected and when tolerance is
    justified.
15. Design untouched behavioral promotion experiments comparing source float,
    quantized scalar, optimized native, and browser WASM. Use fixed cases,
    seeded unseen paraphrases, multiple declared seeds, blinded human review,
    and explicit ordinary-helpfulness regression budgets.
16. Define performance measurement for conversion throughput, file size,
    startup, prefill, decode, memory high-water mark, cache behavior, energy
    where measurable, and cancellation. Report formulas and methodology, not
    imagined numbers.
17. Build malformed-input, integer-overflow, tail, odd-shape, extreme-scale,
    all-zero, NaN, corrupted-block, wrong-feature, and cross-endian tests plus
    fuzz/property tests.
18. Produce objective promote, revise, and reject rules. A faster kernel that
    changes declared outputs or a smaller model that loses practical quality
    must fail.

Required report structure:

1. Executive profile decision and assumptions.
2. Public TurboQuant/TurboVec fact versus inference table.
3. Quantization alternative matrix.
4. Normative mixed-Q8 tensor policy and equations.
5. SLM2 layout and conversion receipt design.
6. Scalar, x86-64, arm64, and WASM kernel designs.
7. Numerical and behavioral conformance protocol.
8. Performance methodology and resource formulas.
9. Malformed-input, fuzz, and fault matrix.
10. Promotion thresholds, stop rules, and residual risks.
11. Prioritized implementation and experiment sequence.
12. Unknowns requiring local execution.
13. Annotated primary-source bibliography with dates and direct links.

Do not claim one-bit or sub-byte behavior for an eight-bit profile, infer
TurboQuant or TurboVec internals without sources, use benchmark answers for
calibration, hide scale overhead, change sampling to rescue quantization,
select best-of-N outputs, invent speed or quality measurements, or retain
multiple production quantizers as compatibility debt.

## Prompt 11: Contamination-Safe Quality Rescue For One Tiny General Assistant

You are an independent principal small-model training scientist, evaluation-
integrity lead, and behavioral data engineer. Produce an exceptionally detailed
decision report for making one approximately 0.6B Qwen3-class source genuinely
useful for TinyRustLM without training on evaluation answers or confusing
benchmark familiarity with conversational ability. You may browse model papers,
official model cards, datasets, licenses, training frameworks, and peer-reviewed
post-training research. You have no access to TinyRustLM code, private prompts,
sealed holdouts, source outputs, datasets, adapters, GPUs, receipts, or test
results. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local chat product. It needs one honest
  provenance-bound model vertical slice before attempting a larger portfolio.
  There is no need to preserve a weak model, old adapter, compatibility path,
  refusal-heavy policy artifact, or training debt merely because it already
  exists.
- The candidate student is an official dense Qwen3-class model near 0.6B
  parameters, subject first to immutable source, license, architecture,
  tokenizer, template, and untouched raw-output screening. If the unadapted
  source already fails repeatedly, conversion success cannot promote it.
- Important behavior includes natural conversation, common-sense judgment,
  ambiguity clarification, practical constraints and feasible fallback,
  conflicting-source handling, current user preference over stale memory,
  multi-turn references, untrusted quoted or retrieved text as data,
  summarization, rewriting, JSON, extraction, code explanation, factual
  humility, and substantive treatment of lawful adult questions. Narrow
  security and nonconsensual-harm boundaries remain explicit. Helpful positive
  examples must substantially outnumber refusals. Arithmetic may be delegated
  to a deterministic calculator.
- Raw model output is preserved. Response repair, expected-term injection,
  answer completion, hidden retry, best-of-N, cherry-picked seeds, weakened
  thresholds, and training on failed holdouts are forbidden.
- Development evaluation and sealed independent audit must remain disjoint.
  Training data, removals, teacher outputs, adapters, merged checkpoints,
  quantized artifacts, runtime, prompts, templates, samplers, and decisions are
  content-addressed. Public evidence excludes private prompts and raw outputs.
- CPU-only pilots are useful for pipeline proof, but realistic training may
  require authorized GPU compute. Time estimates must be formulas based on
  measured throughput, not invented durations. MemoryEndpoints is unauthorized
  and outside scope.

Research current primary literature and official documentation for small-model
instruction tuning, assistant-only SFT, LoRA, DoRA, full fine-tuning,
preference optimization, sequence-level distillation, logit distillation,
teacher ensembles, data curation, contamination detection, evaluation
statistics, and catastrophic forgetting. Pin publication dates, framework
versions, dataset revisions, and licenses.

Address all of the following in depth:

1. Design an untouched source-screen protocol before conversion or training.
   Specify case families, private template generation, seeded paraphrases,
   repeated sampling seeds, raw-output custody, human review, minimum sample
   sizes, hard failures, and stop rules.
2. Define a claim taxonomy from runtime-only through conversation-screened,
   task-specific-proven, conversation-proven, and full-assistant-quality. State
   evidence and prohibited marketing language for each level.
3. Specify a pilot curriculum and a scale-up curriculum with exact percentage
   targets and record counts by behavior class. Justify ordinary chat,
   ambiguity, planning, source conflict, current-turn precedence, trusted and
   untrusted memory, multi-turn continuity, lawful adult analysis, narrow
   boundaries, facts, summaries, rewrites, JSON, extraction, and code.
4. Design scenario-factor generation that teaches rules rather than answer
   phrases. Include entity, product, date, percentage, unit, authority, order,
   resource availability, discourse style, user preference, and turn-state
   permutations.
5. Define counterfactual pairs, hard negatives, adversarial quoted
   instructions, contradictory memory, unavailable-resource cases, incomplete
   choices, source disagreement, answer revisions, and teacher disagreement.
6. Compare assistant-only SFT, full-sequence SFT, LoRA, DoRA, upper-layer
   adapters, full fine-tuning, DPO, ORPO, sequence-level distillation,
   token-level KL, top-k logits, hidden-state matching, and self-distillation
   specifically for a 0.6B student. Select a staged method and reject
   disproportionately expensive or fragile options.
7. Specify teacher selection and generation. Cover immutable teacher identity,
   prompt and sampler identity, final answers rather than hidden reasoning,
   diversity, factual verification, licensing, policy bias, over-refusal,
   personally identifying information, malicious artifacts, and deterministic
   replay.
8. Design human and automated review with explicit rubrics, double review,
   inter-rater agreement, disagreement adjudication, removal reasons,
   correction lineage, and reviewer blinding. An LLM judge may assist but may
   not silently rewrite or solely decide promotion.
9. Define contamination defenses: exact normalization, character and token
   n-grams, semantic-neighbor search, template-family detection, entity-
   substituted overlap, response-answer overlap, public benchmark overlap,
   sealed holdouts, access control, and deletion lineage.
10. Explain how to prove that prompts, expected answer terms, rubric-specific
    phrases, and failed holdouts did not enter training. Address probabilistic
    semantic overlap and false assurance.
11. Design a CPU pipeline pilot and GPU scale-up recipe. Include sequence
    lengths, packing, mixed precision, optimizer state, gradient accumulation,
    checkpointing, deterministic seeds, validation cadence, restart safety,
    RAM/VRAM formulas, throughput measurements, and cost formulas.
12. Define early termination rules for loss instability, no generalization,
    ordinary-chat regression, over-refusal, memorization, evaluator leakage,
    license defect, corrupted checkpoint, and insufficient compute.
13. Design promotion comparisons for unadapted source, adapter, merged model,
    deterministic quantized SLM2, scalar native output, and real-browser WASM.
    Use the exact same semantic contracts and preserve every raw output.
14. Specify stochastic statistics: predetermined seed set, per-case pass
    probability, confidence intervals, correlated failures, multiple
    comparisons, infrastructure flake, and why best-of-N is invalid unless it
    is declared product behavior.
15. Define metamorphic and unseen tests. State which verdicts remain invariant
    under names, units, dates, authority order, sentence order, politeness,
    negation, distractors, and malicious memory, and which changes legitimately
    alter behavior.
16. Design a sealed independent audit with blinded source-versus-adapted
    comparison, challenge sets for over-refusal, fabricated certainty,
    impractical advice, stale-preference use, prompt injection, and lawful adult
    discussion, plus a human escalation protocol.
17. Define artifact and data provenance: dataset snapshot, record hash,
    generator, teacher, reviewer decision, removal, trainer, hyperparameters,
    checkpoint, adapter, merge, conversion, evaluator, and promotion receipt.
18. Produce a staged route to one qualifying model with explicit rollback,
    compute stop, and clean-slate deletion of superseded training code before
    production. Do not optimize for a target count of catalog entries.

Required report structure:

1. Executive training decision and assumptions.
2. Untouched source-screen and claim taxonomy.
3. Curriculum table with counts and proportions.
4. Scenario generation and teacher protocol.
5. Method comparison and selected staged recipe.
6. Review, provenance, privacy, and licensing.
7. Contamination threat model and auditable controls.
8. CPU/GPU compute formulas and stop rules.
9. Promotion, statistics, and metamorphic evaluation.
10. Independent audit and rollback plan.
11. Prioritized route to one useful model.
12. Unknowns requiring local or authorized compute.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend copying evaluation prompts into training, tuning after viewing
sealed answers, repairing model output, picking the best seed, using an opaque
LLM judge as sole authority, lowering a quality threshold, hiding failed runs,
assuming a popular source is useful, or retaining superseded training paths as
legacy support.

## Prompt 12: End-To-End First-Model Evidence, Release, Documentation, And Public Readback

You are an independent principal release engineer, evidence-systems architect,
browser acceptance lead, and technical documentation auditor. Produce an
exceptionally detailed control-plane report for proving and publishing one real
TinyRustLM model vertical slice without overstating any result. You may inspect
public standards, official tool documentation, package registries, security
guidance, and public TinyRustLM-related websites. You have no access to a
private source tree, branch, model, build, CI, receipt, browser artifact,
signing credential, deployment account, production log, or internal service.
Do not claim private validation, and clearly date every public observation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied here but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources wherever possible and record each
source's publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. There is no public V1
  versus V2 product split, installed legacy population, compatibility burden,
  migration route, alias, hidden fallback, tolerated debt, or reason to retain
  obsolete code. SLM2 and other names ending in `2` are technical contracts.
- Completion means one cryptographically identified, provenance- and license-
  acceptable model that passes untouched semantic screening, deterministically
  converts into a six-artifact composition, passes scalar-native and real-
  Chromium WASM conformance, is acquired through verified-P2P-first or explicit
  local conversion UX without instruction-file downloads, and completes a
  genuine multi-turn browser-local chat with no prompt or model upload.
- The six artifacts are SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and
  ACG2. Every source, tool, schema, prompt, sampler, artifact, evaluator, raw
  output, decision, browser build, and release input is cryptographically bound.
- The desktop Companion uses create-only intent and terminal evidence,
  numeric-loopback user-presence pairing, least-privilege capability, bounded
  streaming, and explicit cancellation. The browser uses a fresh owned profile,
  verifies exact composition identity, activates atomically, runs inference in
  a worker, terminates the worker, opens a fresh worker, and proves recovery.
- Raw outputs and terminal failures are preserved. No retries selected for best
  answers, response repair, fixture substitution, fake public reachability,
  simulated P2P, mock live service, skipped gate converted to pass, or campaign
  counter inflation is allowed.
- MemoryEndpoints is unauthorized and disconnected. The larger campaign remains
  at zero qualified models out of twenty, zero browser rounds out of fifty,
  zero live memory rounds out of twenty-five, zero externally proven lanes out
  of forty, and zero catalog announcements out of twenty until objective live
  evidence exists. One first-model proof must not silently increment unrelated
  gates.
- Required software surfaces include Rust native and WASM, a small C ABI, .NET
  wrappers, NuGet packages, symbols, self-contained Companion archives, browser
  assets, MiniModel metadata, documentation, marketing claim surfaces, release
  notes, publication logs, visible version/release date, source control, and
  public HTTPS deployments. Required RIDs include Windows x64, Linux x64, and
  Linux arm64, with evidence levels kept distinct.

Research primary sources for SLSA, in-toto, SPDX or CycloneDX, Sigstore and code
signing, reproducible builds, SourceLink and NuGet symbols, Cargo and NuGet
locking, WebAssembly packaging, Playwright browser profiles, HTTP deployment
readback, SBOM, release rollback, evidence retention, and technical
documentation operations. Public website observations must be labeled as such,
with URL, date, viewport where relevant, and no inference about private code.

Address all of the following in depth:

1. Define the complete phase graph: immutable source discovery, acquisition,
   license review, untouched screening, optional training, conversion,
   composition verification, scalar inference, optimized native conformance,
   browser transfer, storage activation, WASM conformance, multi-turn chat,
   cancellation/recovery, package verification, deployment, and public readback.
2. Assign content-addressed identities to every phase input and output. Show
   exactly which downstream phases are invalidated by changes to source,
   quantizer, tokenizer, template, prompt, sampler, runtime, evaluator,
   browser, UI, package, documentation, or site assets.
3. Design a versioned receipt schema family without one generic `passed` field.
   Include status, input identities, tool identities, bounded facts, terminal
   reason, predecessor, supersession, timestamp, environment facts, private
   evidence reference, and public-safe projection.
4. Define append-only receipt history. A rejected or obsolete result may be
   superseded but never overwritten. Explain retry, explicit new attempt,
   reevaluation after evaluator change, and reuse of still-valid multi-gigabyte
   acquisition or conversion evidence.
5. Specify the exact first-model acceptance matrix for provenance, license,
   source behavior, contamination, conversion, six artifacts, native runtime,
   WASM, browser UI, privacy, network, cancellation, restart, resources,
   accessibility, packages, RIDs, docs, and deployment.
6. Design the clean-browser proof. Require a fresh owned persistent profile,
   real file or Companion transfer, genuine two-to-six-turn conversation, raw
   model text, one authoritative rendering, no duplicate answer, cancellation,
   process/context closure, profile deletion, and a second fresh profile only
   where a declared recovery case requires it.
7. Define network evidence proving project origins receive no prompts or model
   bytes. Include request allowlists, DNS, URLs, headers, bodies, WebSocket or
   loopback traffic, service workers, analytics, telemetry, direct peers, and
   false positives from hashes.
8. Define secret scanning over source, packages, archives, logs, screenshots,
   traces, browser stores, profiles, crash dumps, URLs, UTF-8, UTF-16, base64,
   compressed data, and public receipts. State malware-scanning boundaries for
   multi-gigabyte model files honestly.
9. Specify release gates for Rust crates, WASM assets, C ABI header and symbols,
   C# wrapper, NuGet package, `.snupkg`, native RID assets, self-contained
   Companion archives, MiniModel metadata, websites, and documentation.
10. Distinguish cross-compilation, binary-header inspection, package-consumer
    loading, emulated execution, VM execution, and real hardware execution for
    Windows x64, Linux x64, and Linux arm64. Set a minimum evidence level for
    each release claim.
11. Design reproducible supply-chain controls: pinned dependencies, lock files,
    immutable source revisions, package allowlists, native hashes, SBOM,
    provenance, signatures, key custody, rotation, revocation, archive traversal
    defense, SourceLink, symbols, and authorized publication.
12. Define release numbering and date policy for a prelaunch product without
    inventing a public legacy generation. Every deployment must record last
    published version, release date, source commit, affected surfaces, test
    evidence, deployment identity, and HTTPS readback.
13. Design one consistent update log and publication log pattern across product,
    documentation, marketing, catalog, and support sites. Technical docs and
    marketing claims must update in the same coherent release, not drift for
    weeks after code.
14. Define robust living-documentation ownership. Cover architecture decisions,
    contracts, threat models, operator runbooks, user docs, package docs,
    privacy statements, limitations, release notes, and machine-readable
    workspace memory. Stale claims are release blockers.
15. Define deployment procedure with build-from-clean-source, immutable output,
    secret scan, staging readback, production publish, cache invalidation,
    public HTTPS readback, rollback authorization, and proof that the public
    bytes correspond to the tested source commit.
16. Design a concise operator dashboard for this one-model slice plus the
    unchanged campaign counters. It must report current operation, elapsed
    time, resumable state, evidence freshness, blockers, and why `done` is not
    inferred from unit tests.
17. Define failure-to-regression workflow. Preserve raw failure, write a
    general failing test, make a scoped clean fix, rerun only invalidated
    phases, archive old evidence, update docs and long-term memory, commit,
    push, fresh-fetch, and deploy only when the affected gate is green.
18. Produce a prioritized execution plan with frequent coherent commits,
    remote-equality verification, publish-on-green discipline, explicit stop
    rules, and a final remaining-risk section. No phase may be marked live from
    mocks or public plans.

Required report structure:

1. Executive control-plane recommendation.
2. Phase, identity, and invalidation graph.
3. Receipt schema family and append-only history.
4. First-model acceptance matrix.
5. Clean-browser, network, privacy, and restart proof.
6. Component and RID release gates.
7. Supply-chain, package, signing, and publication controls.
8. Documentation, marketing, version, and update-log contract.
9. Deployment, HTTPS readback, and rollback algorithm.
10. Progress dashboard and blocker taxonomy.
11. Failure-to-regression workflow.
12. Prioritized execution and publication plan.
13. Unknowns requiring local or authorized production access.
14. Annotated primary-source bibliography with dates and direct links.

Do not count source popularity, structural conversion, package creation, unit
tests, a fixture, headless-only execution, local P2P, or a mocked service as the
completed product. Do not overwrite rejected evidence, inflate campaign
counters, retain legacy code, invent deployment success, publish stale docs, or
claim public bytes without an HTTPS readback bound to the tested commit.

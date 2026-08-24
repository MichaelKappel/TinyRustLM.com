# Twelve Disconnected Research Prompts: Recovery, Loopback, Tokenizer, And Browser Proof

Each section below is a complete standalone assignment for a different
technical research agent. Send one entire prompt to one agent. Do not assume
that an agent has received this introduction, another prompt, or any private
TinyRustLM material.

The agents may browse public websites, standards, papers, official package
documentation, public source repositories, immutable revisions, model cards,
and public registries. They have no access to the TinyRustLM source tree,
private branches, local models, build products, test output, receipts,
credentials, signing keys, browser profiles, deployment accounts, internal
services, or unpublished evaluation cases. Every report must clearly label:

1. directly observed public facts;
2. externally sourced facts;
3. facts supplied by this assignment but not independently verified;
4. engineering analysis and recommendations;
5. assumptions; and
6. facts requiring local implementation or authorized production proof.

No report may imply that its author inspected, built, ran, tested, or validated
private TinyRustLM code. Reports must be exceptionally detailed and
implementation-oriented. They should include exact proposed contracts,
algorithms, state tables, schemas, pseudocode, resource formulas, threat or
failure matrices, objective acceptance criteria, and primary-source
bibliographies rather than generic tutorials.

## Prompt 1: Crash-Consistent Reconciliation Between A Create-Only Converter And Its Parent Journal

You are an independent principal storage-systems engineer, transaction-protocol
architect, and cross-platform process-recovery specialist. Produce an
exceptionally detailed technical report that designs crash-consistent
reconciliation between a parent desktop Companion operation journal and a
child Rust conversion process that creates one terminal model-composition
directory. The report will guide TinyRustLM implementation, but you have no
access to its private source code, files, test output, or machines. Do not claim
private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no launched earlier generation,
  compatibility population, migration obligation, deprecated behavior, or
  permission to preserve technical debt. Technical names such as SLM2, ACG2,
  Tokenizer2, Template2, Sampling2, Prompt2, schema versions, and semantic
  versions are exact contract identities, not product generations.
- A private user-owned Companion owns a strict append-only operation journal.
  A source-conversion branch progresses through source acquisition,
  conversion, complete-composition verification, and availability.
- The sole conversion success boundary is one Rust child command that consumes
  immutable source locks and an exact conversion-profile identity. It creates
  one previously absent output root containing exactly six ordered artifacts:
  SLM2 model bytes, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2.
- The child also creates bounded attempt, component, and terminal receipts. A
  terminal pass and a terminal rejection are mutually exclusive. Output is
  create-only. Rejected, incomplete, or obsolete evidence is preserved and is
  never overwritten, repaired, renamed into success, or silently retried.
- The parent independently verifies exact file inventory, strict JSON, hashes,
  source-lock lineage, conversion-profile lineage, operation identity,
  artifact order and kinds, and complete-receipt closure before recording the
  six artifacts as available.
- The unresolved failure window is a parent crash, power loss, or machine
  restart after the child has durably completed some or all output but before
  the parent journal has durably recorded the corresponding terminal state.
- Large model files must be streamed rather than buffered. Windows and Linux
  are required environments. Process IDs, timestamps, and path existence alone
  are not trusted identities.
- MemoryEndpoints is unauthorized and disconnected. It is outside this task.
  No local fixture or unit test may be represented as a real-model pass.

Research primary sources for filesystem durability, SQLite or journal design,
write-ahead logging, transaction recovery, process supervision, Windows file
replacement and directory semantics, Linux `fsync`, directory syncing,
exclusive creation, file locks, and power-failure behavior. Record source
publication or update dates and the report retrieval date. Distinguish
documented guarantees from folklore and from filesystem-dependent behavior.

Address all of the following in depth:

1. Define the exact ownership and identity model for the parent request,
   immutable request bytes, request hash, logical operation ID, attempt ID,
   child executable identity, conversion profile, source locks, output root,
   staging root, terminal receipt, journal record, and six artifacts. Explain
   which identities are content-derived and which are random nonces.
2. Compare a single filesystem journal, SQLite with full synchronous mode, a
   transactional outbox, two-phase intent/completion records, and a child-owned
   commit marker. Select one minimum architecture that works on Windows and
   Linux without pretending that two files can be atomically committed
   together.
3. Specify a write protocol before child launch. Include immutable request
   persistence, parent intent, absent-root proof, root ownership marker,
   expected terminal identity, process launch record, file and directory sync,
   and behavior when any durability primitive fails.
4. Specify the child transaction from empty root through staging, artifact
   creation, streamed hashing, independent parsing, component receipts,
   terminal receipt, directory promotion, and final durability barrier. State
   the precise point at which child success becomes recoverable fact.
5. Enumerate every crash boundary: before launch, during source reads, during
   each artifact, between artifact and receipt, during receipt replacement,
   after terminal receipt but before process exit, after process exit but before
   parent observation, during parent verification, and during parent journal
   update. Give the only legal recovery action for each boundary.
6. Design a deterministic startup reconciler that scans only owned operations,
   validates bounded path depth and root ownership, rejects symlinks and
   reparse points, reopens immutable request bytes, recomputes every identity,
   and classifies each operation as resumable observation, terminal pass,
   terminal rejection, incomplete preserved failure, foreign/tampered, or
   manually blocked.
7. Explain why process ID liveness, lock-file age, wall-clock time, directory
   mtime, and a zero exit code are insufficient. Define stronger process
   ownership using inherited handles, process groups or job objects, executable
   hash, launch nonce, and child-written identity evidence.
8. Define how the parent handles the hardest split-brain case: a child is still
   running while a restarted parent begins reconciliation. Cover single-owner
   election, file locks, Windows named mutexes versus file handles, Linux
   advisory locks, stale ownership, and safe observation without killing an
   unrelated process.
9. State whether incomplete child output may ever resume computation. If yes,
   define a preregistered checkpoint contract and proof that it cannot convert
   arbitrary partial bytes into success. If no, define preserved terminal
   failure and how a new user-authorized logical operation gets a different
   output root without overwriting history.
10. Specify independent verification after recovery. It must reject duplicate
    JSON keys, unknown fields, extra files, missing files, reordered artifact
    kinds, mismatched sizes or hashes, altered source locks, changed converter
    identity, stale profile identity, inconsistent operation IDs, unsafe paths,
    and a pass/rejection collision.
11. Define cancellation races. Cover cancellation before launch, during child
    work, after durable child pass, while the parent is verifying, and during
    journal transition. Explain why a durable valid pass must not be relabeled
    cancelled merely because a late cancellation request arrived.
12. Define disk-full, quota, antivirus, backup-agent, locked-file, delayed-write,
    short-write, torn-write, permission-loss, sleep/resume, and abrupt-removal
    behavior. Separate detectable failures from durability uncertainty.
13. Provide bounded schema examples for intent, launch, observation,
    reconciliation, terminal pass, terminal rejection, and parent journal
    records. Include maximum sizes, strict UTF-8 rules, canonical hashing, and
    public-safe error codes.
14. Provide language-neutral pseudocode and concrete Rust plus C# sketches for
    create-only writes, streaming hash verification, directory-handle syncing,
    process-tree ownership, startup reconciliation, and compare-and-append
    journal transitions.
15. Design deterministic fault injection at every durability boundary. Include
    child kill, parent kill, machine power loss simulation, short writes, failed
    flush, locked files, modified receipts, replaced source locks, symlink or
    reparse substitution, duplicate owners, and concurrent reconcilers.
16. Define what CI can prove, what requires a physical Windows machine, what
    requires a physical Linux machine, and what requires destructive power-cut
    testing on disposable storage.
17. Produce a staged implementation sequence that creates no alternate
    recovery path and leaves no compatibility reader or hidden retry loop.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Public durability guarantees by operating system and filesystem.
3. Trust, ownership, and content-identity model.
4. Selected transaction and journal architecture.
5. Parent launch protocol and child commit protocol.
6. Complete crash-boundary state table.
7. Startup reconciliation algorithm and pseudocode.
8. Process ownership, locking, and split-brain analysis.
9. Cancellation, incomplete-output, and new-attempt rules.
10. Strict schemas and canonical-hash rules.
11. Threat model and tamper-response matrix.
12. Fault-injection and cross-platform test plan.
13. Implementation backlog with objective acceptance criteria.
14. Unknowns requiring private or physical verification.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend overwriting a terminal root, inferring success from process
exit, trusting a PID as identity, deleting failed evidence, converting an
incomplete attempt into a pass, automatic retry, a compatibility journal
reader, or a single boolean `passed`. Do not invent current TinyRustLM recovery
behavior or claim that a filesystem guarantee applies where primary sources do
not establish it.

## Prompt 2: Output-Free Registration Of One Secure Browser-To-Loopback HTTP Capability Protocol

You are an independent principal browser-security engineer, HTTP protocol
designer, and local-application attack researcher. Produce an exceptionally
detailed, implementation-ready report for preregistering one secure protocol
between TinyRustLM.com in a normal browser and a user-owned local Companion.
The registration must be precise enough that route or server implementation
can be compared against it byte for byte before any production listener is
created. You have no access to TinyRustLM private code, local binaries, ports,
network captures, credentials, or browser profiles. Do not claim private
validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product with no legacy route family, migration
  obligation, compatibility mode, alternate server, fallback protocol, or
  permission for technical debt.
- The accepted protocol family is closed HTTP/1.1 over explicit numeric
  loopback. IPv4 is exactly `127.0.0.1`; IPv6 may be admitted only as exactly
  `::1` after independent testing. Wildcard, LAN, public, hostname, and
  project-hosted model-byte listeners are forbidden.
- No current route table or port is release authority. Exact methods, paths,
  media types, headers, schemas, limits, pairing bytes, capability semantics,
  and errors must be registered before implementation.
- The web origin is HTTPS. The browser may ask the Companion to attempt a
  verified complete-composition P2P acquisition or, when no eligible peer
  exists and the user approves the source, deterministic local conversion.
- The Companion must expose only typed operation control and exact composition
  transfer. It must not expose arbitrary file access, directory listing,
  command execution, environment access, generic proxying, diagnostics dumps,
  prompts, raw credentials, or unrelated local services.
- A model is usable only as one exact composition containing SLM2, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. Progress and terminal evidence are
  ordered, bounded, and content-bound.
- Browser credentials are session-only by default and must not appear in URLs,
  cookies, referrers, localStorage, logs, screenshots, command lines, or public
  reports. Explicit user consent is required.
- MemoryEndpoints is unauthorized and disconnected and must not be included.

Use current primary sources for Fetch, CORS, Private Network Access, mixed
content, secure contexts, CSP, HTTP/1.1 parsing, loopback trust, Origin, Host,
Fetch Metadata, Chromium, Firefox, WebKit, Windows and Linux networking, and
relevant IETF/W3C/WHATWG specifications. Record publication/update dates,
browser-version support where authoritative, and report retrieval date.

Address all of the following in depth:

1. Define an output-free protocol-registration artifact with schema identity,
   canonical encoding, content hash, decision status, allowed origin set,
   listener address family, port policy, route inventory, header inventory,
   request and response schemas, event sequencing, size/time/concurrency
   limits, capability lifecycle, and acceptance-test identities.
2. Compare fixed port, installer-selected stable port, ephemeral port plus
   protected discovery receipt, browser extension/native messaging, custom URI
   scheme, loopback TLS with a local CA, and HTTP over numeric loopback. Select
   one discovery and transport design and state every security and deployment
   tradeoff.
3. Specify protection against malicious local port squatters. Include
   Companion installation identity, executable signing, protected local
   discovery state, user-presence pairing, challenge-response, race handling,
   process replacement, and what the browser can and cannot authenticate
   without a trusted extension or locally installed certificate.
4. Define exact Host and Origin validation. Cover duplicate headers, absolute
   request targets, IPv6 bracket rules, default and nondefault ports,
   capitalization, whitespace, trailing dots, `localhost`, decimal or encoded
   IP variants, opaque and `null` origins, `file:` origins, extensions,
   redirects, and missing headers.
5. Specify CORS and Private Network Access handling for simple and preflighted
   requests. Include exact allow-origin behavior, methods, request headers,
   response headers, credential mode, cache lifetime, `Vary`, Fetch Metadata,
   failure status, and why CORS is not authorization.
6. Analyze mixed-content and secure-context rules when an HTTPS page contacts
   numeric HTTP loopback. Separate normative standards behavior, current
   browser implementation behavior, flags/experiments, enterprise policy, and
   unknowns that require physical tests.
7. Design an explicit user-pairing ceremony and short-lived origin-bound
   capability. Define entropy, challenge, proof, audience, scope, operation
   binding, issue and expiry, monotonic versus wall clocks, rotation,
   revocation, replay detection, process restart, browser restart, and
   multi-profile behavior.
8. Define a closed minimum route table for health/bootstrap, pair, create
   operation, observe events from a sequence cursor, cancel, reconcile, obtain
   composition manifest, and stream exact artifacts. Explain whether any route
   can be removed and why no generic status or file route is needed.
9. For every route, specify exact HTTP method, path grammar, content type,
   request headers, request schema, response status set, response schema,
   cache policy, compression policy, redirect policy, capability scope,
   maximum bytes, timeout, and idempotency behavior.
10. Define a strict HTTP/1.1 parser boundary. Cover request-line length, header
    count and bytes, duplicate framing headers, `Content-Length`, unsupported
    transfer codings, obs-fold, control characters, percent decoding, path
    normalization, encoded separators, pipelining, connection reuse, slowloris,
    request smuggling, early body rejection, and response splitting.
11. Define strict JSON processing with UTF-8 only, duplicate-key rejection,
    bounded nesting and string length, integers versus floating point, unknown
    members, canonical hash fields, enum closure, timestamps, and public-safe
    typed errors.
12. Specify ordered progress delivery using bounded polling or another selected
    mechanism. Include operation identity, monotonic sequence, replay cursor,
    heartbeat, truncation, backpressure, browser sleep, lost responses,
    terminal uniqueness, stale event rejection, and multi-tab observation.
13. Design artifact transfer without arbitrary paths. Bind every stream to the
    operation, complete composition, artifact kind, hash, length, capability,
    and allowed byte range. Cover `HEAD`, `GET`, ranges, ETag semantics,
    cancellation, partial reads, and revalidation.
14. Produce an attacker matrix for a drive-by website, malicious extension,
    local unprivileged process, local administrator, DNS rebinding, service
    worker, compromised website origin, stale browser tab, replaying process,
    reverse proxy, antivirus HTTP interception, and hostile model peer.
15. Provide exact example registration JSON, request/response examples,
    canonical error objects, state diagrams, Rust parser/type sketches, and
    browser TypeScript sketches. Examples must be internally consistent and
    must not contain real secrets.
16. Define browser and operating-system conformance matrices for current
    stable Chromium, Edge, Firefox, and WebKit on supported desktop platforms.
    Include fresh-profile tests, packet capture, network allowlists, wrong
    origin/host attacks, port collision, process restart, and capability scans.
17. Define the evidence required before changing the ADR status from accepted
    protocol family to implemented and before enabling any production-origin
    browser call.

Required report structure:

1. Executive recommendation and assumptions.
2. Current standards and browser-behavior evidence table.
3. Trust-boundary and attacker-capability diagrams.
4. Transport and deterministic discovery decision.
5. Output-free registration schema and canonicalization.
6. Pairing and capability lifecycle.
7. Exact closed route, method, header, and status matrix.
8. Strict HTTP and JSON parsing contract.
9. Progress, idempotency, cancellation, and reconciliation semantics.
10. Exact artifact-streaming contract.
11. Concrete wire examples and implementation pseudocode.
12. Security, browser, and operating-system test matrix.
13. Promotion gates and staged implementation plan.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend wildcard CORS, arbitrary port scanning, a capability in a
URL, a durable browser token by default, a generic local file server, shell
execution, DNS-name trust, silent router or firewall changes, an undocumented
fallback, or browser flags as a production requirement. Do not invent current
TinyRustLM routes, ports, headers, browser support, or test results.

## Prompt 3: Companion Installation Identity, User-Presence Pairing, And Multi-User Isolation

You are an independent principal endpoint-security architect, desktop
application identity engineer, and operating-system isolation specialist.
Produce an exceptionally detailed implementation report for establishing the
identity of a user-owned TinyRustLM Companion, discovering its current numeric
loopback endpoint without unsafe scanning, requiring meaningful user presence,
and isolating multiple operating-system users, browser profiles, Companion
instances, and sessions. You may inspect public operating-system, browser,
cryptographic, installer, code-signing, IPC, and filesystem documentation. You
have no access to TinyRustLM source code, installers, keys, machines, private
schemas, or test evidence. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no legacy installer,
  compatibility endpoint, migration reader, alternate host, deprecated
  discovery mechanism, or permission to accumulate technical debt.
- TinyRustLM.com is an HTTPS browser-local chat interface. A private,
  user-owned Companion performs verified P2P acquisition and approved source
  conversion. Prompt text never belongs in the Companion control protocol.
- The accepted transport family is closed HTTP/1.1 on exact numeric loopback,
  with explicit Host and Origin validation and short-lived origin-bound
  capabilities. The exact discovery, pairing, capability, and process-lifetime
  bytes have not yet been selected or proven.
- A malicious unprivileged local process may bind a desired port first, read
  files available to the same user, race startup, or imitate public responses.
  A malicious website may send browser requests. Browser extensions and local
  administrators are stronger threats and must be characterized honestly.
- Browser secrets are session-only by default. They may not be placed in URLs,
  cookies, referrers, localStorage, screenshots, command lines, reports, or
  broadly readable files. No workspace or administrator credential may be
  issued to the browser.
- Supported release evidence will eventually include `win-x64`, `linux-x64`,
  and `linux-arm64`, but cross-compilation alone is not executed-platform
  evidence. This report must not invent currently released archives.
- MemoryEndpoints is unauthorized and disconnected and is outside this task.

Use primary sources for Windows user profiles, ACLs, named pipes, named
objects, DPAPI, Credential Manager, process/job ownership, Authenticode,
AppContainer boundaries, Linux XDG directories, permissions, Unix-domain
sockets, systemd user services, keyrings, process credentials, code signing,
browser profile storage, Web Authentication where relevant, and cryptographic
randomness. Record publication/update dates and retrieval date.

Address all of the following in depth:

1. Define the identities for installed product, signed release, executable
   bytes, operating-system user, Companion instance, listener epoch, browser
   origin, browser profile, pairing ceremony, session, capability, operation,
   and model composition. State which must survive restart and which must not.
2. Compare protected endpoint-discovery files, fixed ports, randomly selected
   ports, installer registration, custom URI activation, native messaging,
   named-pipe or Unix-socket rendezvous, mDNS, registry keys, and environment
   variables. Select one browser-reachable discovery design while explaining
   the unavoidable authentication gap of ordinary loopback HTTP.
3. Specify per-user installation and data roots on Windows and Linux. Define
   exact ownership, ACL or mode expectations, inheritance, symlink/reparse
   rejection, atomic replacement, directory syncing, roaming-profile behavior,
   network-home behavior, and failure when permissions are broader than
   allowed.
4. Design release identity verification. Cover signed archive or installer,
   native asset hash manifests, executable self-hash, publisher identity,
   signature timestamping, revocation, unsigned development builds, downgrade
   resistance, and how the browser can display truthful identity without
   claiming cryptographic proof it cannot perform.
5. Define a user-presence pairing ceremony appropriate for a browser and
   desktop companion. Compare manually entered short codes, QR codes, operating
   system notifications, launch-by-custom-scheme, WebAuthn-mediated approval,
   local UI confirmation, and same-user clipboard transfer. Analyze phishing,
   clickjacking, shoulder surfing, remote desktop, accessibility, and headless
   environments.
6. Specify the cryptographic handshake. Define random challenges, transcript
   binding, origin, listener epoch, product/release identity, requested scopes,
   operation binding, proof-of-possession versus bearer capability, expiration,
   replay cache, constant-time comparisons, key erasure, and process restart.
7. Decide whether ephemeral asymmetric keys improve security over random bearer
   capabilities in this threat model. Provide exact algorithms and key sizes
   only when backed by current standards and available cross-platform
   primitives. Avoid decorative cryptography that does not authenticate the
   local process.
8. Specify multi-user isolation on shared Windows and Linux machines. Cover
   fast user switching, terminal services, containers, sandboxed browsers,
   root/administrator access, different users selecting the same port,
   inherited handles, and shared temporary directories.
9. Specify multi-instance and multi-profile behavior. Decide whether one
   Companion process may serve multiple authorized browser profiles, how each
   gets independent capabilities, how the active listener is elected, and how
   stale discovery state or simultaneous startup is resolved.
10. Define process supervision and lifecycle for interactive launch, startup
    registration, systemd user service, Windows scheduled task or service,
    sleep/resume, network change, upgrade, rollback before public launch,
    crash, and clean uninstall. Do not require administrator privilege unless
    justified.
11. Define capability storage and erasure in both browser and Companion.
    Analyze JavaScript heap, Web Worker messages, service workers, memory dumps,
    browser crash reports, password managers, autofill, logs, ETW/journald,
    command-line inspection, swap, hibernation, and extension access.
12. Design revocation and emergency response for a leaked capability, stolen
    discovery record, compromised release-signing key, malicious local process,
    vulnerable Companion build, and compromised production web origin.
13. Provide bounded discovery, pairing, capability, and revocation schemas;
    sequence diagrams; Windows and Linux pseudocode; and a closed list of
    public-safe UI statuses and error codes.
14. Design red-team tests for port squatting, discovery-file replacement,
    symlink/reparse attacks, wrong-user reads, stale epoch replay, concurrent
    pairings, malicious origins, extension-origin requests, process cloning,
    executable replacement, sleep/resume, and upgrade races.
15. Define objective evidence required for each release RID and distinguish
    unit tests, cross-compilation, emulated execution, virtual-machine tests,
    and real hardware execution.
16. Identify security properties that ordinary browser-to-loopback HTTP cannot
    provide. Recommend truthful residual-risk language instead of claiming
    immunity from a same-user malicious process or local administrator.

Required report structure:

1. Executive identity and pairing recommendation.
2. Supplied facts, assumptions, and explicit nonclaims.
3. Operating-system primitive comparison with primary sources.
4. Identity hierarchy and persistence table.
5. Per-user installation and discovery design.
6. User-presence and cryptographic pairing protocol.
7. Capability issue, storage, rotation, and erasure rules.
8. Multi-user, multi-instance, and multi-profile state machine.
9. Process supervision, upgrade, and uninstall lifecycle.
10. Threat model and residual-risk analysis.
11. Concrete schemas, sequence diagrams, and pseudocode.
12. Cross-platform security and fault-injection matrix.
13. Staged implementation plan and acceptance criteria.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend a globally readable discovery file, a capability in a URL, a
permanent browser token by default, wildcard listener binding, silent pairing,
trusting process name or PID, arbitrary port scanning, mandatory administrator
installation without proof, or a hidden fallback identity. Do not invent
TinyRustLM signing keys, installer behavior, operating-system support, or test
results.

## Prompt 4: Streaming A Six-Artifact Composition From Companion To Browser Without Arbitrary File Access

You are an independent principal streaming-protocol engineer, content-addressed
storage architect, and browser performance/security specialist. Produce an
exceptionally detailed implementation report for transferring one verified
TinyRustLM model composition from a user-owned loopback Companion into the
browser with bounded memory, resumability, exact cryptographic verification,
and no arbitrary local file API. You have no access to TinyRustLM code, model
files, private manifests, browser traces, or machines. Do not claim private
validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product with no compatibility routes, legacy file
  server, instruction-file downloads, alternate package path, fallback model
  format, or permission for technical debt.
- One usable composition contains exactly six ordered immutable members: SLM2
  model bytes, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. ACG2 binds
  every member identity and required runtime contract. Partial compositions are
  never activatable.
- The Companion has independently verified a complete composition before it
  may offer bytes to the browser. The browser must still stream-hash and
  validate all received bytes before activation; transport trust does not
  replace content verification.
- The transport family is closed HTTP/1.1 on numeric loopback with exact
  origin/host checks and short-lived scoped capabilities. No generic file path,
  directory, proxy, environment, command, diagnostics, or prompt route is
  allowed.
- Large artifacts cannot be buffered into one managed, JavaScript, or WASM
  allocation. Progress, cancellation, process restart, browser restart, and
  range recovery must remain truthful. A completion claim requires all six
  exact bytes and an atomic browser-side activation.
- Model bytes and prompts must not traverse a project-hosted website. Local
  transfer is not public P2P proof. MemoryEndpoints is unauthorized and
  disconnected.

Research current HTTP range semantics, Fetch streaming, ReadableStream and BYOB
readers, WebAssembly memory transfer, OPFS and IndexedDB streaming behavior,
SubtleCrypto limitations, incremental SHA-256 options in WASM, browser abort
semantics, backpressure, service workers, cache behavior, content encoding,
and Windows/Linux file streaming. Use primary sources and record dates and
retrieval date.

Address all of the following in depth:

1. Define the content identity graph for composition, member artifact, member
   length, SHA-256 digest, ordered member index, runtime profile, source and
   conversion receipts, transfer session, range, browser staging object, and
   activation record.
2. Design a manifest-first protocol in which the browser obtains one bounded
   immutable composition descriptor before requesting bytes. Specify how that
   descriptor is authenticated by the operation capability and independently
   closed by ACG2 content identity.
3. Define exact routes without paths supplied by the browser. A request may
   identify only an authorized operation, composition digest, closed artifact
   kind or index, and an optional legal range. Explain path traversal,
   alternate data streams, symlink/reparse points, case folding, Unicode path
   confusion, and hard-link defenses on the server side.
4. Select complete-response versus range-based transfer policy separately for
   small metadata artifacts and the large SLM2 member. Define allowed methods,
   status codes, `Content-Length`, `Content-Range`, `Accept-Ranges`, ETag,
   `If-Match`, `If-Range`, cache headers, compression, and connection behavior.
5. Specify range alignment, overlap, gap, duplicate, out-of-order, and maximum
   range rules. Explain whether the browser may parallelize ranges and how a
   bounded parallel policy affects disk reads, page cache, hashing order, and
   denial-of-service resistance.
6. Design browser streaming with bounded ring buffers or fixed chunks. Include
   ReadableStream backpressure, BYOB support differences, JavaScript allocation
   discipline, transferable buffers, worker messages, WASM linear memory,
   OPFS writes, and progress accounting.
7. Specify incremental SHA-256 verification without trusting a final server
   digest. Compare a Rust-WASM hasher, WebCrypto, streaming transform, and
   browser-specific APIs. Define test vectors and hash-state treatment across
   browser restarts.
8. Define resumability. Bind a resume journal to exact composition/member hash,
   byte length, verified prefix or verified fixed chunks, transfer protocol
   identity, browser build, and Companion epoch. State when partial bytes can
   be reused and when they must be quarantined.
9. Explain how to verify non-prefix or parallel ranges. Compare per-piece
   hashes, Merkle trees, a final sequential rehash, and sparse-file staging.
   Select a design that does not weaken final complete-artifact SHA-256 proof.
10. Define cancellation at request, stream, browser worker, persistent-write,
    final-hash, and activation boundaries. Cover `AbortController`, socket
    closure, server read cancellation, late chunks, and retained resumable
    state.
11. Define server resource limits for open files, outstanding ranges,
    connections, bytes per operation, read rate, idle time, total time, page
    cache pressure, and simultaneous browser tabs. Give formulas rather than
    invented measurements.
12. Define privacy behavior for URLs, headers, browser devtools, service
    workers, caches, crash reports, logs, screenshots, and network traces.
    Explain why capability, local paths, prompts, and private provenance must
    not appear in reportable evidence.
13. Specify fail-closed handling for changed artifact bytes, changed length,
    stale operation, expired capability, ETag mismatch, Companion restart,
    short read, overlong response, compressed response, duplicate headers,
    disk-full, quota failure, and browser process death.
14. Provide exact manifest and transfer schemas, request/response examples,
    browser TypeScript pseudocode, Rust server pseudocode, incremental-hash
    pseudocode, and a memory-budget formula for each pipeline stage.
15. Design a conformance matrix with synthetic tiny vectors and a real large
    artifact. Include hostile range requests, tampered chunks, resume after
    crash, concurrent tabs, cancellation races, low disk, storage eviction,
    slow server, early EOF, extra bytes, and final activation denial.
16. Define which evidence proves only transport correctness and which later
    evidence is required for semantic format validity, runtime execution,
    assistant quality, or public P2P availability.
17. Produce a staged implementation sequence that exposes no generic route and
    deletes experimental transfer paths before launch.

Required report structure:

1. Executive transfer recommendation and assumptions.
2. Public browser and HTTP capability table.
3. Content-identity and authorization graph.
4. Closed manifest and artifact route contract.
5. Range, cache, and HTTP header rules.
6. Bounded browser streaming and hashing pipeline.
7. Resume, cancellation, and restart semantics.
8. Companion resource and denial-of-service limits.
9. Browser persistence handoff and atomic-completion boundary.
10. Concrete schemas, wire examples, and pseudocode.
11. Threat, malformed-input, and fault-injection matrix.
12. Performance formulas and measurement protocol.
13. Staged implementation plan and objective acceptance criteria.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend arbitrary local paths, directory listing, base64 for large
artifacts, one giant allocation, trusting only a server-supplied digest,
activating a partial composition, hosted model-byte proxying, response repair,
or automatic retry hidden from the user. Do not invent current TinyRustLM
routes, throughput, browser limits, or transfer evidence.

## Prompt 5: Crash-Consistent Browser Storage And Atomic Activation Of One Complete Composition

You are an independent principal browser-storage engineer, transactional-state
architect, and web privacy specialist. Produce an exceptionally detailed
implementation report for staging, verifying, committing, opening, recovering,
and deleting a large six-artifact TinyRustLM composition entirely within the
browser origin. The design must make incomplete or tampered bytes impossible
to activate and must support honest clean-profile testing. You have no access
to TinyRustLM source code, private browser artifacts, model bytes, test traces,
or deployment settings. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no old browser database,
  migration population, compatibility reader, dual storage lane, fallback
  format, or permission to leave technical debt.
- A model is activatable only as exactly six content-addressed members: SLM2,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. ACG2 closes member
  identity and runtime requirements. Missing, extra, duplicate, mismatched, or
  partially written members must fail before runtime activation.
- Bytes arrive from a verified direct peer or an approved local Companion
  conversion. They must be incrementally hashed again in the browser. Model
  bytes and prompts must not be sent to a project-hosted site.
- Large model bytes cannot be held in one JavaScript or WASM allocation.
  Staging, commit, read, and deletion require bounded memory, truthful progress,
  cancellation, browser restart recovery, and quota handling.
- A dogfood round that claims fresh state must use an owned fresh persistent
  browser profile and later prove that profile directory was deleted. A page
  reload, localStorage clear, incognito tab, or reused context is not a full
  persistent-profile deletion.
- MemoryEndpoints is unauthorized and disconnected. It is outside this task.

Research current primary documentation and specifications for Origin Private
File System, File System Access, IndexedDB, StorageManager, persistence and
quota, storage buckets if applicable, Cache Storage, service workers,
partitioning, eviction, private browsing, browser profile deletion, Web Locks,
BroadcastChannel, workers, stream-to-file behavior, and browser shutdown.
Record publication/update dates, browser support by current stable release, and
the report retrieval date. Clearly distinguish standards from Chromium-only or
experimental behavior.

Address all of the following in depth:

1. Compare OPFS, IndexedDB Blob values, chunk records in IndexedDB, Cache
   Storage, File System Access handles, and memory-only storage for a 0.6B-class
   quantized model plus five metadata artifacts. Select one canonical durable
   store and one metadata/index mechanism without creating parallel authority.
2. Define the identity hierarchy for store schema, origin, browser profile,
   composition, member, transfer attempt, staged object, verified object,
   activation generation, runtime lease, and deletion receipt.
3. Specify an absent-to-staged-to-verified-to-committed-to-active state machine.
   State every legal transition and prove that no state containing partial
   bytes is discoverable through the active-composition index.
4. Design an atomic activation protocol despite the absence of a general
   multi-file filesystem transaction. Compare immutable content-addressed
   objects plus one small commit record, IndexedDB transaction metadata,
   double-write generations, and append-only activation logs. Select the
   simplest recoverable design.
5. Specify write ordering and durability assumptions for each browser API.
   Explain what `close`, transaction completion, stream completion, worker
   message acknowledgment, and browser process exit do and do not guarantee.
6. Define exact metadata schemas for staging, member progress, verified chunks,
   complete member, composition commit, active pointer, runtime lease,
   tombstone, quarantine, and cleanup. Require strict keys, bounded values,
   canonical identities, and no private local paths or secrets.
7. Design startup reconciliation after tab crash, worker crash, browser crash,
   operating-system restart, and quota eviction. Cover orphan staged bytes,
   committed objects missing a member, active pointer mismatch, stale runtime
   leases, and unknown schema or browser-build identity.
8. Define streamed hashing and verification. Compare sequential full-member
   SHA-256, fixed-piece hashes plus final SHA-256, and Merkle verification.
   Explain how browser restart can reuse verified pieces without trusting a
   mutable hash state.
9. Define quota preflight and admission. Include `navigator.storage.estimate`,
   persisted-storage requests, uncertainty margins, simultaneous staging and
   active generations, temporary hashing space, browser overhead, disk-full,
   eviction, and user denial. Give formulas based on artifact sizes.
10. Specify garbage collection without unsafe deletion. Cover reference
    counting versus mark-and-sweep, active runtime leases, concurrent tabs,
    failed attempts, quarantined bytes, superseded compositions, retention
    policy, and interruption during cleanup.
11. Design multi-tab ownership using Companion authority, Web Locks,
    BroadcastChannel, SharedWorker, or IndexedDB transactions. State what each
    primitive can coordinate and how stale or malicious same-origin tabs are
    handled.
12. Define cancellation during download, persistent write, final hash,
    composition verification, activation-pointer commit, runtime open, and
    deletion. Explain which regions are interruptible and how late messages
    are rejected.
13. Analyze service-worker and Cache Storage interactions. Ensure an old
    service worker cannot serve stale runtime/model metadata, intercept local
    Companion secrets, or make a failed activation appear available.
14. Define a complete deletion protocol for user-requested model removal and
    for a fresh-profile dogfood round. Include process/context closure, handle
    release, profile-root ownership marker, resolved-path containment,
    deletion retries, locked files, post-delete absence proof, and safeguards
    against deleting outside an owned root.
15. Address storage partitioning, third-party iframe restrictions, private
    browsing, enterprise policy, mobile storage pressure, Firefox/WebKit OPFS
    differences, and unsupported environments. Unsupported cases must show a
    truthful typed state rather than another storage implementation.
16. Provide TypeScript and Rust-WASM pseudocode for stage, append chunk,
    verify, commit, activate, open, reconcile, cancel, quarantine, collect, and
    delete. Include bounded error codes and layout invariants.
17. Design unit, property, malformed-input, browser, crash, quota, concurrency,
    privacy, and profile-deletion tests. Identify which require real stable
    browser processes and physical filesystems.

Required report structure:

1. Executive storage recommendation and assumptions.
2. Current browser-storage support and durability evidence.
3. Store identity and state model.
4. Canonical physical and metadata layout.
5. Atomic activation and startup reconciliation algorithms.
6. Streaming verification and quota formulas.
7. Multi-tab, lease, cancellation, and cleanup semantics.
8. Service-worker, partitioning, and privacy boundaries.
9. Fresh-profile creation and deletion protocol.
10. Concrete schemas and implementation pseudocode.
11. Browser and fault-injection test matrix.
12. Security and residual-risk analysis.
13. Staged implementation plan with acceptance criteria.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend localStorage for model state, a second fallback store, partial
activation, trusting only metadata without rehashing bytes, deleting an
unowned path, treating a reload as a fresh profile, silent quota eviction as
success, or migration code for a nonexistent public population. Do not invent
TinyRustLM storage schemas, browser limits, or deletion evidence.

## Prompt 6: Publisher-Exact Qwen3 Tokenizer2 In Rust And Browser WASM

You are an independent principal tokenizer engineer, Unicode and finite-state
text-processing specialist, and Rust/WASM conformance researcher. Produce an
exceptionally detailed implementation report for compiling and executing the
official tokenizer semantics of a pinned dense Qwen3-family model as one
portable Tokenizer2 artifact owned by Rust and used identically in native and
browser WASM inference. You may inspect public model repositories, immutable
tokenizer revisions, Hugging Face Transformers and Tokenizers source,
tokenizer.json schemas, SentencePiece or BPE literature, Unicode standards,
Rust crates, and WebAssembly documentation. You have no access to TinyRustLM
private code, pinned local model files, generated Tokenizer2 bytes, test output,
or unpublished prompts. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no legacy tokenizer format,
  compatibility parser, JavaScript tokenizer fallback, remote tokenization,
  migration path, response repair, or permission for technical debt.
- Tokenizer2 is an exact technical format identity. It must be a complete,
  deterministic, bounded artifact in a six-member composition with SLM2,
  Template2, Sampling2, Prompt2, and ACG2.
- Rust is the sole tokenizer byte and semantic authority. Browser JavaScript
  may marshal bounded inputs and outputs but must not independently implement
  normalization, pretokenization, BPE, special-token selection, or decoding.
- The first target is a pinned public dense Qwen3-family model in approximately
  the 0.6B class. The report must discover exact public tokenizer behavior from
  immutable upstream sources rather than assume that all Qwen tokenizers are
  identical.
- Native and browser WASM must produce identical token IDs and decoded bytes
  for the same Tokenizer2 artifact and input. Any browser limitation must fail
  truthfully; it must not select another tokenizer.
- Inputs and outputs are bounded. Malformed UTF-8, special-token injection,
  adversarial Unicode, cancellation, memory exhaustion, and very long text must
  have explicit behavior.
- Evaluation prompts are sealed and unavailable. Public examples may be used
  for conformance, but no report may claim private evaluation parity.

Use primary and immutable sources wherever possible. Record repository owner,
model/tokenizer revision, file path, commit hash, license, update date, direct
URL, and retrieval date. Distinguish tokenizer behavior declared in
`tokenizer.json`, behavior added by Transformers Python code, and behavior in
chat-template rendering.

Address all of the following in depth:

1. For current publicly documented Qwen3 tokenizer revisions, inventory model
   type, vocabulary size, merge count, added tokens, special tokens, byte
   fallback behavior, normalization, pretokenizer regex, decoder, postprocessor,
   padding/truncation defaults, beginning/end tokens, and chat-control tokens.
   Identify which values must come from an exact pin.
2. Explain the exact byte pipeline from a JavaScript string or native UTF-8
   bytes through Unicode validation, normalization, pretokenization, byte-level
   mapping, BPE merge ranking, added/special-token matching, token IDs, and
   decoding. State ordering and tie rules.
3. Analyze the upstream pretokenizer regex. Cover Unicode property classes,
   contractions, numbers, whitespace, newlines, combining marks, emoji,
   regional indicators, zero-width characters, invalid scalar values, and
   differences among Python regex, Rust regex engines, ICU, JavaScript RegExp,
   and hand-compiled automata.
4. Recommend a deterministic Rust implementation strategy for unsupported
   regex features. Compare a reviewed finite-state implementation, ICU4X,
   fancy-regex/backtracking, oniguruma bindings, generated tables, and
   upstream tokenizer library reuse. Address WASM portability, denial of
   service, binary size, licensing, and auditability.
5. Specify Tokenizer2 physical format fields and validation invariants for
   vocabulary entries, merge ranks, added tokens, special-token flags, regex or
   automaton tables, normalizer, decoder, maximum token bytes, and source
   provenance. Require deterministic serialization and closed fields.
6. Define special-token handling for ordinary user text versus trusted prompt
   construction. Explain `encode_special_tokens`, literal control-token text,
   prefix ambiguity, longest match, allowed-special sets, untrusted retrieved
   text, and why the user cannot inject a system or assistant boundary merely
   by typing its textual token.
7. Design BPE data structures for native CPU and browser WASM. Compare hash
   maps, double-array tries, minimal perfect hashing, sorted arrays, radix
   trees, merge heaps, linked lists, and cached word encodings. Give memory and
   complexity formulas for Qwen-scale vocabulary and merges.
8. Specify exact decoding. Cover byte reconstruction, replacement policy for
   invalid UTF-8, incremental streaming decode, cleanup-spaces behavior,
   special-token suppression or retention, round trips, and display ownership.
9. Define the Rust native and raw-WASM API boundary. Include create/open,
   inspect identity, encode length preflight, encode into caller buffer, decode
   length preflight, decode into caller buffer, incremental state if justified,
   cancellation, disposal, error codes, pointer/length validation, handle
   limits, and no diagnostic secret leakage.
10. Define memory admission and resource limits for tokenizer artifact bytes,
    parsed indexes, input bytes, output token count, decoded bytes, scratch
    space, concurrent handles, and caching. Give formulas and overflow checks.
11. Design exact upstream differential tests using pinned `transformers` and
    `tokenizers` versions. Cover empty text, ASCII, multilingual scripts,
    normalization-sensitive forms, whitespace grids, punctuation, code,
    JSON, emoji, malformed bytes on native APIs, every special token, random
    Unicode, and adversarial long inputs.
12. Define a generated conformance corpus without leaking sealed evaluation
    prompts. Bind generator version, seed, Unicode version, upstream revision,
    input hash, expected token-ID hash, decoded-byte hash, and removal lineage.
13. Design property and fuzz tests for determinism, no panic, bounded
    allocation, encode/decode stability where applicable, prefix behavior,
    invalid artifacts, duplicate entries, integer overflow, cyclic or malformed
    merges, and cancellation.
14. Analyze native-versus-WASM differences in Unicode string ingress,
    endianness, integer width, memory growth, SIMD, threads, and host bindings.
    Require raw-byte conformance rather than visual string comparison.
15. Define performance benchmarks for cold open, warm open, short chat turn,
    long context, tokens per second, peak memory, allocation count, and artifact
    size. Use formulas and measurement protocol, not invented numbers.
16. Define promotion gates from immutable upstream tokenizer source through
    Tokenizer2 conversion, independent parse, native parity, raw-WASM parity,
    real-Chromium parity, composition binding, and browser conversation use.
17. Identify every fact that still requires local pinned-file inspection,
    generated-artifact validation, or real browser execution.

Required report structure:

1. Executive implementation recommendation and assumptions.
2. Immutable upstream Qwen3 tokenizer source inventory.
3. Exact normalization, pretokenization, BPE, and decoding semantics.
4. Unicode and regex portability analysis.
5. Proposed Tokenizer2 physical schema and invariants.
6. Native and WASM API contract.
7. Data structures, complexity, and memory budget.
8. Special-token and untrusted-text security model.
9. Differential, property, fuzz, and adversarial test corpora.
10. Browser conformance and performance measurement plan.
11. Promotion evidence graph and rejection rules.
12. Staged Rust/WASM implementation plan with acceptance criteria.
13. Likely failure modes and dead ends.
14. Unknowns requiring local proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend tokenizing on a server, implementing a second JavaScript
tokenizer, silently replacing unsupported Unicode behavior, accepting literal
control tokens from untrusted text, weakening parity to decoded visual output,
or using evaluation prompts as tokenizer fixtures. Do not invent the pinned
Qwen3 revision, Tokenizer2 bytes, native/WASM parity, or performance results.

## Prompt 7: Compiling Publisher-Exact Qwen3 Chat Semantics Into Template2 And Prompt2

You are an independent principal prompt-runtime engineer, programming-language
semantics researcher, and model-template security specialist. Produce an
exceptionally detailed implementation report for converting a pinned official
Qwen3-family chat template into deterministic, bounded Template2 and Prompt2
artifacts that Rust renders identically in native and browser WASM execution.
You may inspect public model repositories, immutable chat-template revisions,
official model cards, Hugging Face Transformers source, Jinja semantics,
tokenizer configuration, generation configuration, and relevant security
research. You have no access to TinyRustLM private code, local model files,
generated artifacts, test outputs, system prompts, or sealed evaluations. Do
not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. It has no legacy template language,
  compatibility interpreter, host-built prompt fallback, remote prompt
  formatter, response repair, migration path, or permission for technical
  debt.
- Template2, Prompt2, Tokenizer2, Sampling2, SLM2, and ACG2 are exact technical
  artifact identities in one complete composition. They are not product
  generations.
- Rust is the sole prompt-construction authority. Browser JavaScript owns UI
  presentation and supplies typed role/content records, but it must not splice
  control tokens, recreate publisher templates, override sampling, or repair a
  model response.
- The first target is a pinned dense Qwen3-family model around 0.6B parameters.
  Qwen3 templates may distinguish thinking and non-thinking behavior and may
  contain publisher-specific special tokens and generation-prompt logic. The
  report must derive exact behavior from immutable public source, not from
  recollection.
- Current user instructions supersede stale profile or memory data. Retrieved,
  quoted, pasted, and memory content is untrusted data, not a source of system
  authority. MemoryEndpoints is unauthorized and disconnected; no live memory
  route is part of this assignment.
- Native and browser runs must receive identical final prompt token IDs for the
  same typed conversation and composition. Hidden reasoning must not be
  fabricated, extracted, or used as evidence.

Use primary sources and immutable revisions. Record model owner, repository,
revision, relevant filenames, template text hash, tokenizer/generation config
hashes, license, publication/update date, direct URL, and retrieval date.
Separate official publisher semantics from Transformers implementation details
and from recommendations.

Address all of the following in depth:

1. Inventory the current official Qwen3 chat template and related tokenizer or
   generation configuration for plausible 0.6B targets. Identify every role,
   special token, BOS/EOS rule, generation marker, thinking-mode branch,
   tool-related branch, whitespace rule, and template variable.
2. Define a formal typed input model for system instruction, user turn,
   assistant turn, trusted application metadata, untrusted retrieved or memory
   data, tool data if supported, current-turn preferences, and generation
   request. State which roles are admitted for the first release and reject all
   others.
3. Explain publisher authority when model card, tokenizer config, template
   file, Transformers code, and generation config disagree. Define a source
   precedence rule and a blocker process rather than guessing.
4. Compare embedding Jinja, compiling a restricted Jinja subset, creating a
   purpose-built deterministic bytecode, and hand-authoring a Qwen-specific
   renderer. Select an approach that preserves exact semantics while removing
   dynamic code execution, unbounded loops, host callbacks, and template
   injection.
5. Specify Template2 syntax or bytecode. Include constants, role branches,
   bounded iteration over messages, field lookup, escaped content emission,
   special-token emission, boolean mode selection, generation marker, limits,
   source-template provenance, and rejection of unknown opcodes or variables.
6. Specify Prompt2 as the closed execution request. Bind composition identity,
   Template2 and Tokenizer2 identities, typed conversation hash, transcript
   revision, expected prior operation identity, context limit, output limit,
   thinking-mode selection, generation marker, and Sampling2 identity.
7. Define content escaping and separation. Prove that literal text resembling
   special tokens, role markers, Jinja expressions, JSON delimiters, XML tags,
   Markdown fences, quoted instructions, or memory directives cannot become
   higher-authority control syntax.
8. Define latest-turn precedence at the orchestration layer without rewriting
   user content. Explain how trusted application instructions, user turns,
   stale profile statements, and untrusted retrieved text are ordered and
   labeled before template rendering.
9. Analyze thinking-mode semantics. State how an explicit supported mode is
   selected, which control tokens or flags are emitted, how output boundaries
   are handled, and how the product avoids exposing or inventing hidden
   reasoning. Do not assume a mode unsupported by the pinned source.
10. Define context accounting. Include pretokenized fixed template overhead,
    per-message token costs, maximum message count, maximum content bytes,
    truncation prohibition versus explicit summarization, current-turn
    preservation, and fail-closed behavior when the prompt exceeds model
    context.
11. Define deterministic rendering and hashing. Specify UTF-8, newline and
    whitespace behavior, canonical typed-message encoding, integer bounds,
    duplicate fields, empty messages, normalization ownership, and exact final
    prompt-byte and token-ID digests.
12. Design the Rust native and raw-WASM interfaces for compiling/opening
    Template2, validating Prompt2, measuring tokens, rendering, tokenizing, and
    beginning generation. Include caller-owned buffers, handles, cancellation,
    errors, and resource limits.
13. Design differential tests against the pinned official Transformers
    implementation. Include all roles, one/many turns, empty content,
    multiline content, Unicode, literal control-token strings, thinking modes,
    tool branches if admitted, malformed inputs, context boundary, and
    generation-prompt toggles.
14. Build metamorphic tests for renamed entities, sentence order, quoted
    malicious instructions, stale versus current preferences, source conflict,
    long content, and role-like text. State which rendered structure must stay
    invariant and which changes must alter output.
15. Define contamination controls so private evaluation prompts and expected
    answers are never used in template conformance. Use public synthetic
    content and bind corpus generator, seed, source revision, and hashes.
16. Provide exact Template2 and Prompt2 schema examples, bytecode pseudocode,
    Rust evaluator pseudocode, TypeScript typed-message sketches, and
    publisher-parity fixture examples without reproducing nonpermitted large
    copyrighted text.
17. Define promotion gates and every unknown requiring local artifact
    generation, source-framework execution, native execution, or real Chromium
    proof.

Required report structure:

1. Executive semantics recommendation and assumptions.
2. Immutable official Qwen3 source inventory and authority conflicts.
3. Typed conversation and trust model.
4. Formal template semantics and selected compiler architecture.
5. Template2 physical/bytecode contract.
6. Prompt2 request, context, and operation contract.
7. Special-token, untrusted-content, and precedence analysis.
8. Thinking-mode and output-boundary semantics.
9. Native/WASM API and resource limits.
10. Differential and metamorphic conformance suite.
11. Concrete schemas, vectors, and pseudocode.
12. Promotion evidence and rejection rules.
13. Staged implementation plan with acceptance criteria.
14. Unknowns requiring local proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend shipping a general Jinja interpreter, constructing prompts in
JavaScript, treating quoted or memory text as authority, silently truncating
the current user turn, using private evaluations as fixtures, repairing model
output, or preserving an alternate template path. Do not invent the pinned
template, thinking-mode tokens, artifact bytes, or parity results.

## Prompt 8: Bit-Exact Sampling2 Semantics Across Scalar Rust, Native SIMD, And Browser WASM

You are an independent principal numerical-computing engineer, random-number
generation specialist, and language-model decoding researcher. Produce an
exceptionally detailed implementation report specifying deterministic
Sampling2 behavior for a small Qwen3-family model across scalar Rust, optimized
native CPU kernels, and browser WebAssembly. The report must make every
sampling decision reproducible from registered bytes and must identify where
bit-exactness is possible, where numerical tolerance is unavoidable, and how
to prevent platform drift from becoming silent behavior. You have no access to
TinyRustLM source code, artifacts, model outputs, tests, or sealed evaluation
cases. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no host-side sampler fallback,
  compatibility RNG, alternate decoding mode, response repair, best-of-N
  selection, hidden retry, or permission for technical debt.
- Sampling2 is an immutable composition member. It binds all supported sampling
  parameters, RNG algorithm and version, seed interpretation, logit transforms,
  stop conditions, limits, and deterministic tie rules. Browser code cannot
  override it with UI defaults after activation.
- The runtime receives one exact Prompt2 request and one exact composition.
  Scalar Rust is intended as the correctness reference. Native SIMD and browser
  WASM must be compared against it using identical input tokens, model bytes,
  prompt bytes, seed, and Sampling2 bytes.
- Untouched raw output is evidence. The product may not retry and select a
  preferred answer, append missing text, remove repetition, inject expected
  terms, or reinterpret cancellation as success.
- Arithmetic can be delegated elsewhere at the product level, but sampling
  itself must remain correct, bounded, and deterministic.
- MemoryEndpoints is unauthorized and disconnected and is outside this task.

Research primary sources for Qwen generation recommendations, Hugging Face
generation semantics, temperature, top-k, nucleus sampling, repetition
penalties, min-p if relevant, softmax stability, counter-based RNGs, PCG,
xoshiro families, ChaCha, WebAssembly floating-point semantics, SIMD, Rust
floating-point behavior, and reproducibility research. Record dates, immutable
revisions where possible, and report retrieval date.

Address all of the following in depth:

1. Inventory sampling and generation fields publicly recommended or configured
   for plausible pinned Qwen3 models. Separate publisher defaults, framework
   defaults, UI conventions, and deterministic test profiles.
2. Define the exact Sampling2 identity and physical fields: schema, RNG family
   and revision, seed width and byte order, temperature representation, top-k,
   top-p, repetition penalty, repetition window, maximum output tokens, stop
   token IDs, EOS handling, minimum tokens, logit sanitation, and unsupported
   feature rejection.
3. Select a reproducible RNG. Compare ChaCha variants, PCG, xoshiro/xoroshiro,
   Philox or another counter-based generator, and host APIs. Address published
   algorithm stability, stream splitting, skip-ahead, endianness, seed-zero,
   state serialization, statistical suitability, performance, and licensing.
4. Define integer-to-uniform conversion exactly. State bit extraction, interval
   convention, floating representation, zero handling, and how the random draw
   maps to cumulative probability without platform-specific library behavior.
5. Define the logit-transform order. Cover nonfinite values, masking, repetition
   penalty for positive and negative logits, duplicate prior tokens, window
   limits, temperature zero or near zero, top-k selection, tie ordering, top-p
   sorting and cumulative cutoff, renormalization, and all-masked failure.
6. Specify stable softmax. Compare f32, f64 accumulation, fixed-point or integer
   approximations, polynomial exponentials, standard-library `exp`, SIMD
   approximations, and deterministic lookup methods. Quantify tradeoffs among
   bit identity, speed, probability error, and code complexity.
7. Decide the required conformance level separately for greedy decoding and
   stochastic sampling. State whether identical selected token IDs are required
   on all supported platforms, and if so, constrain arithmetic enough to prove
   it. Do not hide probabilistic divergence behind broad tolerances.
8. Define deterministic top-k selection and sort rules. Cover equal logits,
   signed zero, NaN, infinities, token-ID tie breaking, unstable SIMD reductions,
   partial sort, heaps, and vocabulary-size limits.
9. Define repetition accounting across prompt and generated tokens. Specify
   whether special tokens count, how reset or new conversation behaves, context
   truncation interaction, and exact state invalidation after cancellation or
   composition change.
10. Define stop behavior for EOS, multiple stop token IDs, token sequences if
    supported, maximum output, cancellation, runtime error, and end of context.
    Separate generated token evidence from presentation-layer text suppression.
11. Specify Sampling2 validation limits and failure codes. Reject unknown
    fields, duplicate keys, unsupported algorithms, invalid probabilities,
    zero/negative limits, duplicate stops, out-of-vocabulary IDs, noncanonical
    numbers, and overflow.
12. Design native and WASM APIs so host code supplies no undeclared sampler
    knobs. Include start state, step state, RNG state, token history, operation
    identity, cancellation, serialization only if required, and safe disposal.
13. Create canonical test vectors from handcrafted logits, including ties,
    extremes, NaNs, infinities, top-p boundaries, repeated tokens, degenerate
    distributions, and known RNG streams. Bind exact input and output bytes.
14. Design differential tests using real model logits while keeping evaluation
    prompts sealed. Compare source framework, scalar Rust, native optimized,
    raw WASM, and real Chromium at each step and localize first divergence.
15. Define statistical tests for distributional correctness separately from
    deterministic conformance. Cover goodness-of-fit, multiple comparisons,
    correlated samples, seeded streams, and why distributional similarity does
    not excuse deterministic-contract drift.
16. Analyze cancellation and restart. State whether an interrupted operation
    can resume exact RNG/token state, how that state is content-bound, and when
    fresh generation must use a new operation identity rather than replay.
17. Provide Rust pseudocode, SIMD constraints, WASM notes, schema examples,
    vector formats, benchmark formulas, and promotion gates.

Required report structure:

1. Executive sampling recommendation and assumptions.
2. Public Qwen3 and framework sampling source inventory.
3. Sampling2 schema and validation contract.
4. RNG selection and exact random-to-uniform mapping.
5. Formal logit-transform and candidate-selection algorithm.
6. Floating-point, softmax, SIMD, and WASM reproducibility analysis.
7. Stop, repetition, cancellation, and state semantics.
8. Native/WASM API and host-authority boundary.
9. Canonical vectors and differential conformance suite.
10. Statistical validation and performance protocol.
11. Concrete pseudocode and implementation constraints.
12. Promotion evidence, rejection rules, and residual risks.
13. Staged implementation plan with acceptance criteria.
14. Unknowns requiring local proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend `Math.random`, framework-default sampling, host overrides,
best-of-N, hidden retries, output repair, unstable tie ordering, silently
clamping invalid profiles, or calling two distributions equivalent when the
registered contract requires identical tokens. Do not invent current
Sampling2 fields, Qwen defaults, parity, or benchmark results.

## Prompt 9: Mixed-Q8 Qwen3 Browser-WASM Kernels Under Honest Memory And Latency Limits

You are an independent principal ML inference-kernel engineer, WebAssembly
performance architect, and quantization correctness researcher. Produce an
exceptionally detailed implementation report for executing a dense
Qwen3-family model around 0.6B parameters in a normal desktop browser using a
mixed-Q8 SLM2 artifact, Rust-generated WebAssembly, bounded memory, and a
scalar Rust correctness reference. The goal is production-quality local chat,
not a synthetic demo. You have no access to TinyRustLM source code, generated
SLM2 bytes, browser builds, performance traces, or test evidence. Do not claim
private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no older kernel, compatibility
  quantization path, JavaScript inference fallback, remote inference fallback,
  dual runtime, temporary scalar production path, or permission for technical
  debt.
- SLM2 mixed-Q8 is the sole current model weight format. Tokenizer2, Template2,
  Sampling2, Prompt2, and ACG2 complete the composition. Exact technical
  version names do not imply product generations.
- Rust is the sole runtime and model-format authority. Scalar native Rust is
  the correctness reference. Optimized native and browser WASM implementations
  may accelerate only after numerical and token-level conformance.
- The target architecture is a pinned public dense Qwen3-family model around
  0.6B parameters. Exact layer count, hidden size, attention heads, key/value
  heads, head dimension, intermediate size, vocabulary, context, RoPE, norm,
  and activation parameters must be read from immutable source metadata.
- Model bytes must remain local or direct P2P. The browser must use one Worker,
  preserve raw output, support true cancellation and recovery, and report
  truthful unsupported/resource-exceeded states.
- TurboQuant, TurboVec, BitNet, low-bit research, and related public work may
  provide ideas, but the report must separate directly reusable licensed
  techniques from research inspiration and must not assume a 1-bit model.
- No local fixture, structural validation, or attractive response is proof of
  a useful real model. MemoryEndpoints is unauthorized and disconnected.

Research primary sources for Qwen3 architecture, WebAssembly core and SIMD,
threads, shared memory, cross-origin isolation, memory limits, browser engine
implementations, Rust WASM toolchains, quantized GEMM/GEMV, activation
quantization, dequantization, TurboQuant/TurboVec, KV cache, WebGPU only as a
separately gated alternative, and relevant peer-reviewed papers. Record dates,
immutable revisions, licenses, browser versions where supported, and retrieval
date.

Address all of the following in depth:

1. Derive symbolic storage and working-memory formulas for a pinned Qwen3
   architecture: quantized tensors, scales, metadata, memory mapping or copied
   model bytes, dequantization tiles, activations, residuals, attention scores,
   RoPE tables, logits, tokenizer indexes, Template2/Sampling2 state, WASM
   runtime, JavaScript overhead, and KV cache by context length.
2. Provide parameterized example calculations for 0.6B-class dimensions while
   clearly labeling them estimates until an immutable model revision is
   selected. Include peak simultaneous allocations, not only steady-state
   weight size.
3. Define mixed-Q8 tensor classes and why each class receives its selected
   representation. Cover embeddings, output head, attention projections, MLP
   projections, norms, biases if present, scales, group size, padding, row
   alignment, endianness, and tied embeddings.
4. Compare weight-only int8 with f32/f16 activations, dynamic activation
   quantization, integer dot products, dequantize-on-load, dequantize-per-tile,
   and cached dequantized hot tensors. Select a browser-feasible first kernel
   architecture with a clear correctness path.
5. Specify scalar reference algorithms for RMSNorm, RoPE, grouped-query
   attention, causal masking, softmax, residual additions, SwiGLU or publisher
   activation, embeddings, LM head, and KV cache. Define accumulation precision
   and operation order.
6. Design WASM SIMD kernels for the selected Q8 block layout. Cover 128-bit
   lanes, widening, signed dot products, horizontal reduction, f32 conversion,
   scale application, tail handling, alignment, unaligned loads, overflow,
   tiling, cache reuse, and deterministic reduction order.
7. Compare one-thread SIMD, WebAssembly threads with SharedArrayBuffer,
   Web Workers with copied or shared weights, and WebGPU. Select the minimum
   release path. Treat cross-origin isolation and browser support as deployment
   gates rather than assumptions.
8. Analyze WASM linear-memory design. Cover initial/maximum pages, memory
   growth, fragmentation, allocator selection, 32-bit address-space ceilings,
   Memory64 maturity, shared memory, guard regions, handle tables, large-file
   ingress, and freeing after cancellation.
9. Design a no-copy or bounded-copy model-open pipeline from browser persistent
   storage. State what current browser APIs actually permit, where copies are
   unavoidable, how chunks enter WASM, and when memory-mapped native behavior
   cannot be reproduced in a browser.
10. Specify KV-cache layout and growth. Cover layer/head/token order, K/V type,
    page size, GQA sharing, RoPE application point, context limit, append,
    cancellation rollback, operation reset, composition switch, multi-turn
    reuse, and exact invalidation.
11. Define resource admission before model open and before each turn. Bind
    device/browser class, model bytes, planned context, maximum output,
    tokenizer/template scratch, KV growth, safety margin, and unsupported state.
    Do not rely on an allocation failure as normal control flow.
12. Define cancellation with a bounded polling interval in long kernels,
    attention loops, model transfer, prompt prefill, and token decode. Explain
    when hard Worker termination is required and how persistent state remains
    uncorrupted.
13. Design numerical conformance from source framework to scalar native to
    optimized native to raw WASM to real Chromium. Include tensor-by-tensor
    checks, layer checkpoints, hidden-state and logit metrics, top-token margins,
    generated token identity, and first-divergence localization.
14. Define quantization calibration and fidelity analysis without evaluation
    contamination. Use public or separately governed calibration text, record
    provenance, compare per-tensor error, and preserve sealed behavioral
    holdouts.
15. Design performance measurements for cold artifact open, parse, first-token
    latency, prompt prefill, decode tokens/sec, long-context scaling, peak WASM
    pages, browser process RSS, allocation count, cancellation latency, and
    repeated-turn stability. Report distributions and hardware/browser build.
16. Analyze TurboQuant/TurboVec and adjacent research at the mechanism level.
    Identify ideas applicable to weight packing, vector kernels, cache locality,
    or quantization calibration; identify assumptions incompatible with Qwen3,
    WASM SIMD, licensing, or mixed-Q8 correctness; and propose isolated
    experiments with rollback.
17. Produce a staged kernel implementation plan that begins with scalar truth,
    introduces one optimization at a time, deletes losing experiments, and
    never weakens conformance to meet a speed target.

Required report structure:

1. Executive kernel recommendation and explicit assumptions.
2. Immutable Qwen3 architecture and license source inventory.
3. Complete storage and peak-memory model with formulas.
4. Mixed-Q8 layout and quantization rationale.
5. Scalar reference operator specification.
6. WASM SIMD, threading, memory, and storage pipeline.
7. KV-cache and multi-turn state design.
8. Resource admission and cancellation semantics.
9. Numerical and token-level conformance laboratory.
10. Performance benchmark protocol and reporting schema.
11. TurboQuant/TurboVec applicability and rejected ideas.
12. Security, malformed-artifact, and fault matrix.
13. Staged implementation backlog with objective gates.
14. Unknowns requiring local or physical-browser proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend a remote fallback, JavaScript inference, unbounded memory
growth, loading the entire model into multiple simultaneous copies, claiming
cross-origin-isolated threads without header readback, changing quantization
until a preferred answer appears, weakening tolerances for speed, or treating
1-bit research as proof that the current model is 1-bit. Do not invent current
kernel performance, browser support, or quality evidence.

## Prompt 10: Exactly-Once Worker Cancellation, Fresh-Worker Recovery, And Two-Profile Chromium Proof

You are an independent principal browser-runtime reliability engineer,
Playwright automation architect, and concurrent-state-machine specialist.
Produce an exceptionally detailed implementation report for running one real
TinyRustLM composition in a browser Worker, cancelling it truthfully,
terminating the Worker when required, recovering in a fresh Worker without
duplicate output, and proving the behavior in two owned clean Chromium
profiles with zero unauthorized network traffic. You have no access to
TinyRustLM source code, browser automation, local model bytes, test artifacts,
or credentials. Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no old worker protocol,
  compatibility message reader, duplicate rendering lane, JavaScript inference
  fallback, remote generation fallback, response repair, best-of-N, hidden
  retry, or permission for technical debt.
- One complete composition contains SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2. Rust/WASM owns tokenization, prompt construction,
  inference, sampling, and exact operation advancement. UI code owns display
  and user commands but cannot fabricate assistant text.
- Each generation has one immutable operation identity and expected prior
  operation identity. Messages require monotonic sequence and exact generation
  ownership. Raw output is preserved and each assistant answer renders once.
- Cancellation must stop actual computation. A UI label alone is insufficient.
  When cooperative cancellation cannot meet its registered bound, the Worker
  must be truly terminated and a fresh Worker must reopen only a valid committed
  composition.
- The planned acceptance uses two independent persistent Chromium profiles.
  Each profile is created under an owned temporary root, the browser process is
  fully closed, all handles are released, and the profile directory is deleted
  with verified containment and post-delete absence. A reload or context reset
  is not equivalent.
- The acceptance run must use zero network except explicitly required local
  loopback traffic, preserve raw evidence outside Git, use no retries or output
  repair, and execute the registered scenario once. A fixture does not prove a
  real model.
- MemoryEndpoints is unauthorized and disconnected, so no hosted continuity
  branch may run or be claimed.

Research primary sources for DedicatedWorker, SharedWorker, Worker termination,
structured clone, transferable objects, SharedArrayBuffer and Atomics, Fetch
abort, IndexedDB/OPFS lifecycle, page and process close, Playwright persistent
contexts, Chromium user-data directories, service workers, Web Locks,
BroadcastChannel, process trees, Windows directory deletion, Linux deletion,
and browser network interception. Record dates, browser/tool revisions, and
retrieval date.

Address all of the following in depth:

1. Define the identities for browser profile, page session, UI controller,
   Worker epoch, composition generation, runtime handle, conversation revision,
   generation operation, request sequence, token event, terminal event,
   cancellation request, and recovery attempt.
2. Specify a closed UI-to-Worker message protocol. Include initialization,
   composition open, prompt begin, token event, progress, cancellation,
   cancellation acknowledgment, terminal completion, terminal failure,
   disposal, and health. Reject unknown, duplicate, stale, future, or
   wrong-epoch messages.
3. Define exactly-once rendering. Explain authoritative event ownership,
   monotonic sequence, idempotent reducer behavior, terminal uniqueness,
   duplicate/reordered message handling, page re-render, virtual DOM behavior,
   accessibility announcements, and preservation of raw versus presented text.
4. Specify cooperative cancellation from UI through Worker to Rust/WASM.
   Cover atomic flag placement, polling boundaries, maximum cancellation
   latency, long matmul/attention loops, prompt prefill, token decode, tokenizer,
   persistent writes, and final terminal races.
5. Define hard Worker termination. State when it is legal, what browser APIs
   guarantee, how outstanding Fetch/storage operations behave, how handles and
   ArrayBuffers become unreachable, and how the UI records a truthful terminal
   cancelled or failed state without pretending cleanup is complete.
6. Design fresh-Worker recovery. The new Worker must reopen the committed
   composition, independently verify identities, reconstruct only committed
   conversation state, reject stale messages from the dead epoch, and never
   resume unknown partial KV or RNG state.
7. Decide what conversation state is durable. Separate presentation transcript,
   trusted typed turns, operation identities, prompt-token state, KV cache, RNG
   state, partial assistant output, and untrusted memory. Explain why partial
   output is or is not included in a later turn.
8. Define cancellation and crash behavior at every generation boundary:
   before prompt construction, during tokenization, during prefill, before first
   token, between tokens, during terminal stop, after terminal generation but
   before UI acknowledgment, and during persistent transcript update.
9. Design multi-tab arbitration. Cover one active runtime owner, observer tabs,
   user command authority, stale pages, tab suspension, back/forward cache,
   service-worker update, Web Locks loss, BroadcastChannel delay, and profile
   isolation.
10. Specify the exact two-profile acceptance manifest before execution. Bind
    application origin and asset hashes, Chromium executable/build, Playwright
    version, viewport, composition and all member hashes, Worker/WASM hashes,
    Prompt2 and Sampling2 identities, private scenario hash, allowed network
    endpoints, resource limits, expected phases, and evidence schema.
11. Define safe profile-root creation on Windows and Linux. Include random
    child name, ownership marker, resolved absolute containment, no symlink or
    reparse traversal, persistent-context launch, process identification,
    browser close, job/process-tree wait, handle release, deletion retries, and
    post-delete proof.
12. Explain how to distinguish page reload, new page, incognito context,
    nonpersistent context, browser-context reset, browser process restart,
    persistent-profile reuse, and actual fresh persistent profile creation and
    deletion.
13. Design network assertions. Allow only the exact application assets already
    bound into the run and exact numeric loopback Companion operations when
    required. Fail on prompt upload, model-byte project request, analytics,
    source map beacon, crash telemetry, unexpected third party, credential in
    URL, DNS, or public network fallback.
14. Define secret and privacy scanning across URLs, headers, browser console,
    Playwright logs, traces, screenshots, videos, HAR, local/session storage,
    IndexedDB, Cache Storage, service workers, profile files, crash files,
    UTF-8, UTF-16, base64, and compressed records. Use synthetic sentinels and
    distinguish their hashes from plaintext leakage.
15. Define UI assertions for introductory-card removal, center conversation
    workspace, fixed composer, single assistant rendering, streaming stability,
    cancellation status, long output, scroll behavior, narrow/mobile viewport,
    keyboard navigation, screen-reader labels, and reduced motion without
    redesigning the approved visual language.
16. Provide TypeScript reducer and Worker pseudocode, Rust cancellation hooks,
    Playwright orchestration pseudocode, Windows/Linux deletion pseudocode,
    and bounded receipt schemas.
17. Design fault injection and acceptance gates for Worker crash, WASM trap,
    browser crash, process leak, locked profile, stale service worker, duplicate
    event, event reorder, storage failure, cancellation race, network leak, and
    fresh-Worker recovery.

Required report structure:

1. Executive reliability recommendation and assumptions.
2. Browser and Playwright behavior evidence table.
3. Identity hierarchy and closed message protocol.
4. Exactly-once UI reducer and terminal-state rules.
5. Cooperative cancellation and hard-termination design.
6. Fresh-Worker recovery and durable-state boundaries.
7. Two-profile manifest, lifecycle, and deletion protocol.
8. Network allowlist and privacy-scanning contract.
9. UI, accessibility, and rendering assertions.
10. Concrete schemas and implementation pseudocode.
11. Fault-injection and real-browser test matrix.
12. Objective pass, reject, blocked, and nonclaim criteria.
13. Staged implementation plan.
14. Unknowns requiring local or physical-browser proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend reusing one profile, calling a reload a restart, simulating
assistant output, preserving unknown partial KV state, retrying a failed
scenario to obtain a better answer, hiding duplicate events in presentation,
allowing unregistered network traffic, or deleting a path whose resolved owner
and containment were not proven. Do not invent current TinyRustLM browser,
Worker, deletion, or real-model evidence.

## Prompt 11: First-Divergence Conformance From Pinned Source Framework Through Native Rust To Real Chromium

You are an independent principal numerical-validation scientist, ML runtime
verification engineer, and differential-testing architect. Produce an
exceptionally detailed report designing a conformance laboratory that starts
with one immutable public Qwen3-family source and local source-framework oracle,
then compares conversion, scalar Rust inference, optimized native inference,
raw WebAssembly, and real Chromium execution until it can locate the first
material divergence. You have no access to TinyRustLM code, source locks,
model bytes, generated artifacts, outputs, evaluation cases, or test results.
Do not claim private validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product with one current runtime and artifact
  path. There is no legacy format, compatibility tolerance, alternate runtime,
  fallback source framework in the product, response repair, hidden retry, or
  permission for technical debt.
- A complete composition contains exactly SLM2 model bytes, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. Each member and every tool/profile
  input is content-addressed and provenance-bound.
- The first target is a pinned dense Qwen3-family model around 0.6B parameters.
  Conversion uses mixed-Q8 weights. Scalar native Rust is the reference for the
  portable runtime, but the pinned source framework remains the pre-conversion
  semantic oracle.
- Native optimized and browser WASM paths must use the same composition,
  prompt token IDs, Sampling2 bytes, seed, and limits. Browser code cannot
  retokenize, rebuild prompts, override sampling, or repair output.
- Raw outputs, including failures, are preserved. Sealed behavioral evaluation
  prompts and expected answers cannot enter training, calibration, template
  fixtures, or routine implementation tests.
- Structural validity proves only format correctness. Numerical parity,
  generated token parity, behavioral quality, browser execution, and product
  chat are separate claims.
- MemoryEndpoints is unauthorized and disconnected. Campaign counters remain
  zero without live evidence and are outside this report.

Use primary sources for PyTorch determinism, Transformers generation,
safetensors, Qwen3 architecture, floating-point error, quantization metrics,
WebAssembly numeric semantics, SIMD, statistical confidence intervals, and
differential testing. Record immutable tool/model revisions, dates, licenses,
direct URLs, and report retrieval date.

Address all of the following in depth:

1. Define the full identity closure for source repository/revision, every
   source file, tokenizer, chat template, generation config, framework and
   dependency environment, conversion profile, converter executable, six
   artifacts, native runtime, WASM module, browser build, test vector, prompt,
   seed, sampling, intermediate trace, and final verdict.
2. Specify a hermetic source-framework oracle. Cover offline mode, immutable
   dependency locks, device and dtype, deterministic algorithms, thread count,
   BLAS/backend identity, seeds, no remote code unless explicitly audited,
   exact chat-template invocation, and preservation of raw tensors and output.
3. Define conversion-layer checks before inference. Include safetensors index
   closure, tensor names, dtype, shape, byte offsets, shard coverage, duplicate
   or missing tensors, tied weights, transpose/layout transforms, padding,
   quantization groups, scales, checksums, and tensor receipts.
4. Design canonical public-safe test inputs independent of behavioral holdouts.
   Include tiny token sequences, repeated tokens, maximum IDs, multilingual
   public strings, chat-role combinations, context boundaries, and seeded
   synthetic generators. Bind every vector to generator/version/hash.
5. Define trace points for embeddings, norm output, Q/K/V projections, RoPE,
   attention logits, softmax probabilities, attention output, residual,
   MLP gate/up/down, layer output, final norm, logits, sampled token, and KV
   writes. State when full tensors, sampled coordinates, or hashes are needed.
6. Explain why plain hashes cannot compare floating-point tensors with expected
   numerical differences. Propose deterministic trace summaries containing
   shape, finite counts, min/max, norms, selected exact values, quantized hash,
   ULP or absolute/relative errors, cosine similarity, and top-token margins.
7. Define tolerance policy by stage and claim. Separate exact integer/token
   identities, lossless f32 transfers, source-versus-quantized model error,
   scalar-versus-SIMD order differences, native-versus-WASM expectations, and
   final selected-token requirements.
8. Design a binary-search or first-divergence algorithm that compares two trace
   DAGs and identifies the earliest tensor, layer, token step, or state mutation
   that exceeds its registered tolerance. Include missing traces and corrupted
   identities.
9. Define quantization-fidelity experiments. Compare source and mixed-Q8
   weights, per-tensor and per-channel error, activation sensitivity, logit
   rank, top-1/top-k agreement, sequence divergence, perplexity on a clean
   public corpus, and behavioral holdouts kept completely separate.
10. Define tokenizer and template parity as prerequisites. A model numerical
    comparison is invalid if token IDs or rendered prompts differ. Provide a
    gating sequence that stops before inference when composition members drift.
11. Define deterministic and stochastic generation experiments. For stochastic
    profiles, bind seeds and compare per-step candidate distributions plus
    selected token. Explain why best-of-N or choosing an easy seed after seeing
    results is invalid.
12. Design native optimization conformance. Introduce one kernel change at a
    time, preserve scalar output, classify acceptable floating drift, and
    require fallback deletion if an optimization loses promotion. Do not ship
    a hidden alternate runtime.
13. Design raw-WASM and real-Chromium conformance. Bind WASM engine/browser
    version, CPU features, SIMD/threads flags actually available without
    developer overrides, memory pages, Worker protocol, asset hashes, and zero
    unauthorized network.
14. Define statistical handling for repeated measurements, correlated token
    failures, multiple layers/cases, confidence intervals, flaky infrastructure,
    hardware variance, and a fixed seed schedule selected before output.
15. Define evidence minimization. Large/private tensors and prompts remain
    outside Git; checked-in evidence may contain public IDs, hashes, shapes,
    bounded metrics, statuses, tool versions, and public-safe errors. Include
    secret/prompt sentinel scans.
16. Provide schemas for run manifest, tensor trace, comparison record,
    first-divergence report, quantization report, generation transcript, and
    terminal decision. Provide Rust/Python/TypeScript pseudocode without
    assuming private APIs.
17. Design TDD and fault injection for wrong shard, transposed tensor, bad
    scale, RoPE error, head mapping error, KV offset error, tokenizer drift,
    template whitespace drift, sampling tie drift, SIMD reduction drift, WASM
    memory corruption, and stale browser asset.
18. Define claim levels and exact promotion gates from structural-only through
    numerical-conformant, token-conformant, browser-executed, conversation-
    screened, and product-chat-proven.

Required report structure:

1. Executive conformance recommendation and assumptions.
2. Immutable oracle environment and identity graph.
3. Conversion and composition preconditions.
4. Public-safe vector and trace design.
5. Stage-specific numerical metrics and tolerance policy.
6. First-divergence localization algorithm.
7. Quantization-fidelity experiment design.
8. Native, WASM, and Chromium conformance matrix.
9. Stochastic statistics and fixed-seed policy.
10. Evidence schemas, minimization, and custody.
11. Concrete pseudocode and fault-injection plan.
12. Claim taxonomy and objective promotion gates.
13. Staged implementation plan with stop rules.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend broad unexplained tolerances, comparing models after token or
prompt drift, selecting convenient seeds after output, repairing answers,
training on failed holdouts, committing private tensors/prompts, treating
structural validation as quality, or retaining a failed optimized kernel as a
fallback. Do not invent current TinyRustLM parity, traces, performance, or
model quality.

## Prompt 12: One Real Qwen3 Composition From Immutable Source To Useful Browser-Local Chat And P2P Eligibility

You are an independent principal ML release engineer, model-quality lead,
supply-chain architect, and browser product acceptance specialist. Produce an
exceptionally detailed end-to-end implementation and evidence plan for taking
one real public Qwen3-family source through immutable acquisition, honest raw
screening, optional contamination-controlled improvement, deterministic
six-artifact conversion, native and browser conformance, browser-local
multi-turn chat, and eligibility for direct P2P sharing. You have internet
access but no access to TinyRustLM source code, local models, GPUs, private
training data, sealed evaluations, receipts, credentials, signing keys,
deployment accounts, or network infrastructure. Do not claim private
validation.

Facts supplied by the project for this assignment:

- TinyRustLM is one prelaunch product. There is no public installed population,
  product-generation compatibility requirement, legacy format, migration,
  alternate model path, remote inference fallback, instruction-file workflow,
  response repair, hidden retry, best-of-N, temporary low-quality patch, or
  permission for technical debt.
- The first desired vertical slice is one genuinely useful, provenance-bound
  model composition. It contains exactly SLM2, Tokenizer2, Template2,
  Sampling2, Prompt2, and ACG2 and is identified by cryptographic content, not
  a filename or marketing label.
- The likely starting family is a public dense Qwen3 model around 0.6B
  parameters. The source must be pinned immutably, license-reviewed, and tested
  in untouched form before spending conversion or training compute.
- Quality priorities are ordinary conversation, common sense, ambiguity
  handling, practical constraints, source conflict, latest-user precedence,
  untrusted quoted or memory text, multi-turn continuity, lawful adult help,
  summaries, rewrites, JSON, extraction, and code explanation. Arithmetic is
  secondary and may be delegated to a deterministic calculator.
- If an untouched source is insufficient, a small CPU LoRA pilot may be
  preregistered, trained on provenance-reviewed and contamination-controlled
  data, merged into distinct bytes, and evaluated on sealed independent
  holdouts. Failed holdouts never become training data.
- The sole conversion transaction consumes exact model and tokenizer source
  locks plus an exact profile and creates exactly the six artifacts and bounded
  immutable receipts in a previously absent root. Terminal evidence is never
  overwritten or retried into success.
- Scalar native Rust is the runtime reference; optimized native and real
  browser WASM require conformance. Browser acquisition is verified P2P first
  and explicit approved-source conversion when no eligible peer exists. It may
  not download a text, JSON, PowerShell, shell, or instruction handoff.
- Model bytes and prompts stay local or flow directly between consenting peers.
  A project site may provide static application assets and public catalog
  metadata but may not proxy model bytes or prompts.
- Public P2P eligibility requires the complete composition and quality evidence.
  Loopback/LAN health is not outside-network reachability. No campaign count is
  incremented without objective live evidence.
- MemoryEndpoints is unauthorized and disconnected. Its 25-run campaign is not
  part of this first-model proof and must remain unclaimed.

Use current primary sources: official model cards and immutable repository
revisions, licenses, safetensors and tokenizer documentation, Qwen papers,
Transformers, Rust/WASM standards, LoRA and distillation literature, evaluation
science, model supply-chain standards, browser documentation, and P2P protocol
sources. Record publication/update dates, exact revisions, licenses, direct
links, and report retrieval date.

Address all of the following in depth:

1. Define candidate-selection criteria for one dense Qwen3 source. Cover exact
   architecture support, tokenizer/template availability, license, repository
   ownership, immutable revision, source size, sharding, safetensors closure,
   context, expected browser resource class, and absence of required remote
   code.
2. Design immutable acquisition with manifest-before-bytes planning, bounded
   sizes, HTTPS redirect policy, exact file allowlist, streamed hashes,
   resumable partials, shard-index closure, license and model-card capture,
   no credentials in receipts, and terminal rejection on upstream drift.
3. Design untouched source screening before conversion. Use fixed public-safe
   cases plus sealed seeded paraphrases and multi-turn cases. Preserve exact
   prompt construction, sampling profile, seeds, raw output, latency, and
   failure. Define sample size, human review, and rejection thresholds without
   inventing measurements.
4. Define a claim taxonomy: acquired, structurally supported, raw-screened,
   conversion-complete, native-conformant, browser-conformant, conversation-
   screened, conversation-proven, P2P-eligible, externally reachable, and
   published. State prohibited marketing language at each level.
5. If raw quality is insufficient, design a CPU LoRA pilot with output-free
   registration. Bind base bytes, dataset records and provenance, teacher and
   review policy, contamination filters, rank/alpha/dropout, target modules,
   optimizer, precision, sequence length, packing, seed, checkpoints, resource
   formulas, stop rules, and merged-output identity.
6. Define curriculum proportions and record-generation controls for the named
   quality dimensions. Positive helpful records must substantially outnumber
   refusals. Include scenario factors, authority permutations, resource
   counterfactuals, entity/unit substitution, discourse variants, multi-turn
   state changes, hard negatives, teacher disagreement, and removal lineage.
7. Define contamination controls against sealed holdouts and public benchmarks:
   canonical normalization, character/token n-grams, semantic neighbors,
   template-family overlap, entity-substituted overlap, expected-answer overlap,
   source/teacher leakage, deletion lineage, and independent custody.
8. Define the promotion experiment comparing untouched source, optional adapter,
   merged checkpoint, mixed-Q8 SLM2 composition, scalar native output,
   optimized native output, raw WASM, and real Chromium. Bind exact prompt,
   tokens, sampling, seed, raw output, latency, memory, and verdict.
9. Specify deterministic six-artifact conversion and receipt closure. Include
   source locks, converter and executable hashes, output-root absence,
   create-only staging, streamed tensor reads/hashes, Q8 layout, Tokenizer2,
   Template2, Sampling2, Prompt2, ACG2 closure, independent parse, terminal
   receipt, and rejection preservation.
10. Define objective quality gates. Use semantic invariants, metamorphic cases,
    model-based judges only as advisory evidence, blinded human review,
    inter-rater agreement, regression budgets, ordinary-helpfulness floors,
    over-refusal and fabricated-certainty checks, and no keyword-only passes.
11. Define browser resource and reliability gates: storage admission, cold
    open, first token, prompt prefill, decode throughput, peak memory, KV growth,
    cancellation latency, Worker termination, fresh-Worker recovery, repeated
    turns, one rendering, no network leakage, and full profile deletion.
12. Define one genuine multi-turn acceptance conversation while keeping its
    private content sealed by hash. Require ambiguity, a changed user
    preference, practical constraints, untrusted quoted text, continuity, and a
    useful transformation task across turns without hand-editing output.
13. Design P2P eligibility for the complete composition. Cover piece manifest,
    fixed piece size, per-piece and complete hashes, ACG2 closure, quality and
    license receipt identities, two independently restartable serving lanes as
    a later gate, direct bytes only, and truthful unavailable/degraded states.
14. Define the browser model-selection action: discover an eligible exact
    composition, stream/verify/activate it when found, otherwise request
    explicit source approval and run local conversion, with one durable
    operation, progress, cancellation, restart reconciliation, and no
    instruction downloads.
15. Define supply-chain and release controls for Rust, WASM, browser assets,
    private Companion archives, public NuGet packages, SBOM, provenance,
    symbols, native hashes, signing, malware-scan boundary, secret scanning,
    archive traversal, and exact-RID execution evidence.
16. Define documentation and publication truth. Update technical docs, user
    docs, marketing claims, visible version/date, release notes, per-site
    publication logs, package metadata, and public HTTPS readback only for
    evidence actually established. Stale docs are a release failure.
17. Design one content-addressed campaign state/receipt graph that allows
    invalidated evaluation or browser phases to rerun without reacquiring valid
    immutable source bytes, while never overwriting old decisions or reducing
    evidence to one boolean.
18. Provide a prioritized route from zero evidence to one qualifying model,
    including parallelizable work, external blockers, stop rules, rollback by
    clean deletion before launch, and the exact remaining-risk statement.

Required report structure:

1. Executive first-model recommendation and assumptions.
2. Candidate source, immutable revision, license, and architecture matrix.
3. Acquisition and custody protocol.
4. Untouched source-screen and claim taxonomy.
5. Optional CPU LoRA pilot and contamination controls.
6. Deterministic six-artifact conversion and receipt graph.
7. Numerical, token, and browser conformance matrix.
8. Semantic quality and human-review protocol.
9. Browser-local chat, resource, cancellation, and deletion gates.
10. P2P-first-or-convert product workflow.
11. Supply-chain, package, site, and documentation controls.
12. Content-addressed campaign state machine and blocker paths.
13. Final objective acceptance checklist and nonclaims.
14. Prioritized implementation plan with stop rules.
15. Unknowns requiring local or authorized production proof.
16. Annotated primary-source bibliography with dates and direct links.

Do not recommend choosing a model by popularity, parameter count, structural
validity, or one attractive response; copying evaluation cases into training;
repairing or selecting outputs; lowering thresholds to obtain a catalog entry;
relabeling identical bytes; proxying model bytes or prompts through a project
site; calling loopback public reachability; counting mocks as live evidence;
or preserving a failed path as compatibility code. Do not invent TinyRustLM
source revisions, model quality, browser performance, P2P reachability,
publication, deployment, or campaign counts.

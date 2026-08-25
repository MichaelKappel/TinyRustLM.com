# Twelve Disconnected Research Prompts: Loopback, Transfer, And First-Model Closure

Each section below is a complete, self-contained assignment. Send one whole
section to one independent technical research agent. Do not assume that an
agent has received this introduction, another prompt, a prior report, or any
private TinyRustLM material.

The agents may browse public websites, standards, papers, official product and
browser documentation, immutable public source revisions, model repositories,
model cards, and public package registries. They have no access to a TinyRustLM
source tree, private branch, local model, conversion output, test result,
receipt, browser profile, workstation, credential, signing key, deployment
account, internal service, MemoryEndpoints room, or unpublished evaluation
case. No report may state or imply that its author inspected, built, executed,
tested, or validated private TinyRustLM code.

Every report must clearly separate directly observed public facts, sourced
external facts, project facts supplied by its prompt but not independently
verified, assumptions and inferences, engineering recommendations, and facts
that require local or authorized production proof. Reports must be extremely
detailed, technical, implementation-oriented, and decisive. Each cited source
must include its publication or update date, retrieval date, direct link, and
immutable revision when one exists. Primary sources are required wherever they
are available.

## Prompt 1: Strict Kestrel Numeric-Loopback Listener And Browser-Origin Boundary

You are an independent principal application-security architect, ASP.NET Core
networking specialist, browser platform engineer, and hostile-protocol
reviewer. Produce an exceptionally detailed, implementation-ready design for a
desktop Companion HTTP listener that is reachable only from a user-authorized
browser page on the same machine. You have internet access, but no access to
TinyRustLM source code, private contracts, test output, browser profiles,
machines, credentials, or deployment systems. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources and record each source's
publication or update date, retrieval date, direct link, and immutable
revision when one exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. There is no installed
  legacy population, compatibility requirement, migration path, alternate
  listener, alias, fallback transport, or permission to add technical debt.
  Names such as SLM2 are technical contract identities, not a second product.
- An explicit user action pairs the HTTPS TinyRustLM browser application with
  a user-owned desktop Companion. The Companion performs approved local model
  acquisition, conversion, and bounded artifact transfer. Project origins
  must never receive prompts or model bytes.
- The proposed listener uses ASP.NET Core 8 Kestrel, HTTP/1.1 only, an exact
  IPv4 numeric loopback address `127.0.0.1`, and an operating-system-assigned
  ephemeral port requested with port zero. It must not bind IPv6, `localhost`,
  a wildcard address, a LAN interface, a public interface, or a fixed port.
- TLS, HTTP/2, HTTP/3, WebSocket, WebTransport, port scanning, proxy discovery,
  DNS-based discovery, silent firewall changes, silent router changes, and
  alternate transports are intentionally absent from the initial product.
- Pairing and later capability requests use exact bounded routes, strict
  canonical bodies, authenticated headers, and a memory-only session secret.
  Credentials must not appear in URLs. Unknown methods, routes, fields,
  origins, hosts, media types, encodings, or protocol versions fail closed.
- The Companion must pre-bind before announcing readiness, expose the actual
  numeric port only through an explicit user-presence pairing flow, enforce
  bounded requests and responses, log only public-safe metadata, cancel work
  honestly, drain on shutdown, and never infer success from an HTTP status
  alone.
- Windows x64, Linux x64, and Linux arm64 matter. Chromium is the first real
  browser proof target, but Firefox and WebKit behavior must be researched so
  unsupported behavior is stated honestly. MemoryEndpoints is unauthorized
  and outside this assignment.

Research current primary documentation for Kestrel endpoint binding and
limits, ASP.NET Core request processing, Fetch, CORS, Private Network Access,
mixed-content rules, secure contexts, loopback trust, Origin and Host headers,
referrer policy, browser preflight caches, service workers, DNS rebinding,
cross-site request forgery, request smuggling, and platform socket behavior.
Do not assume that an HTTPS page can always call an HTTP loopback endpoint;
establish the exact current browser behavior and identify browser-version
dependencies.

Address all of the following in depth:

1. Define the network, process, browser, local-user, malicious-web-page,
   extension, local-malware, proxy, and DNS threat boundaries. State which
   attackers this design can and cannot resist.
2. Determine whether an HTTPS public origin may fetch an HTTP numeric-loopback
   endpoint in current Chromium, Firefox, and WebKit. Analyze mixed content,
   potentially trustworthy origins, secure contexts, Private Network Access,
   preflight behavior, enterprise policies, and relevant deprecations.
3. Select one exact listener construction API and startup sequence for
   ASP.NET Core 8. Specify port-zero binding, retrieval of the assigned port,
   IPv4-only enforcement, server readiness, startup failure, partial bind,
   cancellation, and shutdown ordering.
4. Explain how to prove that every bound socket is exactly `127.0.0.1`. Cover
   dual-stack behavior, address normalization, containers, WSL, network
   namespaces, port proxies, NAT, and operating-system socket inspection.
5. Define strict Host, Origin, Referer, Sec-Fetch-Site, Sec-Fetch-Mode,
   Sec-Fetch-Dest, Access-Control-Request-Method, and
   Access-Control-Request-Headers handling. Distinguish security authority
   from useful diagnostics and explain absent-header behavior.
6. Specify the exact CORS policy for one configured HTTPS application origin.
   Cover preflight status, allowed methods, allowed headers, exposed headers,
   credentials mode, `Vary`, cache duration, null origins, redirects, opaque
   responses, wildcard prohibition, and origin canonicalization.
7. Determine whether Private Network Access response headers are required or
   advisable for numeric loopback. Give current and anticipated behavior by
   browser channel, with dates and feature-status evidence.
8. Design DNS-rebinding and malicious-site resistance without relying on a
   secret URL, fixed port obscurity, or user trust in every open tab. Analyze
   Host validation, capability authentication, origin binding, user presence,
   and preflight as independent layers.
9. Define an exact HTTP/1.1 allow profile: methods, paths, query-string rule,
   fragment irrelevance, request-target form, HTTP version, media types,
   content encodings, transfer encodings, content length, ranges, connection
   reuse, and trailers. Everything outside the profile must have a typed,
   bounded disposition.
10. Set defensible limits for request line, headers, header count, body,
    response, concurrent connections, keep-alive, request headers timeout,
    body minimum rate or deliberate absence, endpoint execution time, and
    shutdown drain. Derive limits from protocol objects rather than inventing
    benchmark measurements.
11. Analyze request smuggling and parser differential risks between Kestrel,
    middleware, reverse-proxy conventions, and browser Fetch. The Companion is
    not intended to sit behind a proxy; state how proxy headers and absolute
    request targets are rejected.
12. Specify middleware and endpoint ordering so that transport checks, Host,
    Origin, CORS, bounds, canonical parsing, capability authentication,
    sequence reservation, route work, response authentication, and logging
    occur in one unambiguous order.
13. Define cancellation propagation from browser disconnect, request abort,
    explicit cancel operation, Companion shutdown, and child conversion
    timeout. Explain which durable operation states may change and which raw
    evidence must remain.
14. Design public-safe logging and metrics. Include event IDs and bounded error
    classes while excluding pairing secrets, session keys, proofs, prompts,
    model bytes, private paths, request bodies, and sensitive headers.
15. Define process ownership and single-instance behavior without a fixed-port
    collision workaround. Cover two Companion processes, stale UI state,
    startup races, service managers, crash restart, and an explicit user
    decision about which process to pair.
16. Provide concrete C# configuration and middleware sketches using public
    ASP.NET Core APIs. Mark pseudocode clearly and leave no security policy
    choice implicit.
17. Design unit, integration, malformed-wire, slow-client, concurrency,
    browser, and cross-platform tests. Include raw-socket negative tests and
    real Chromium tests from an HTTPS origin.
18. Produce an acceptance matrix separating ordinary CI, Windows execution,
    Linux execution, Linux arm64 hardware, real-browser proof, and public HTTPS
    application-origin proof. State residual risks and stop conditions.

Required report structure:

1. Executive protocol decision and assumptions.
2. Browser and network compatibility findings by engine and date.
3. Threat model and trust boundaries.
4. Normative listener startup and shutdown algorithm.
5. Exact HTTP, Host, Origin, CORS, and PNA profile.
6. Middleware and authentication ordering.
7. Resource, timeout, cancellation, and logging contract.
8. C# implementation sketches.
9. Adversarial and cross-platform test matrix.
10. Acceptance gates and residual risks.
11. Unknowns requiring private execution.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend `localhost`, wildcard binding, a fixed-port fallback, port
scanning, TLS certificate installation, a reverse proxy, permissive CORS,
credentials in a URL, origin reflection, silent firewall changes, or a second
transport kept for compatibility. Do not invent current TinyRustLM behavior.

## Prompt 2: Explicit Pairing UX And Memory-Only Browser Capability Custody

You are an independent principal browser-security engineer, applied
cryptographer, usable-security researcher, and privacy threat-modeler. Produce
an exceptionally detailed design for explicit user-presence pairing between a
public HTTPS browser application and a local desktop Companion, followed by
memory-only capability custody. You may browse public standards and official
documentation, but you have no access to TinyRustLM code, private protocol
vectors, UI designs, browser profiles, credentials, machines, or test output.
Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Prefer current primary sources and record source dates,
retrieval dates, direct links, and immutable revisions where available.

Project facts supplied for this assignment:

- TinyRustLM is a prelaunch browser-local AI chat product with a user-owned
  desktop Companion. There is one clean product path and no legacy pairing,
  compatibility token, migration UI, alternate discovery mechanism, hidden
  fallback, or tolerated debt.
- The Companion binds only to `127.0.0.1` on an operating-system-assigned
  ephemeral port. It displays an explicit pairing code only after a local user
  action. The proposed code is
  `TRLC1:{decimal-port}:{base64url-no-padding-32-byte-secret}`. The secret is
  generated cryptographically, held only in process memory, expires after five
  monotonic minutes, and may be completed once.
- The user deliberately transfers the code into TinyRustLM's browser UI. The
  browser calls an exact begin and complete route, receives a least-privilege
  session capability, and keeps the resulting secret only in memory by
  default. No pairing secret, session secret, proof, or capability may be put
  in a URL, prompt, screenshot, trace, analytics event, crash report,
  localStorage, sessionStorage, IndexedDB, Cache Storage, service-worker state,
  or downloaded instruction file.
- The session is bound to the configured TinyRustLM HTTPS origin and local
  Companion process. Reload, tab close, browser close, Companion restart,
  revocation, or expiration must be represented truthfully. Silent reconnect,
  credential recovery from persistent storage, and capability downgrade are
  forbidden.
- The paired capability authorizes only exact bounded Companion operations.
  It is not an administrator credential, filesystem grant, shell grant,
  MemoryEndpoints token, or general local API credential. MemoryEndpoints is
  unauthorized and outside this assignment.
- Browser support must be honest. Chromium is the first required proof;
  Firefox and WebKit differences should be documented. Accessibility,
  clipboard safety, password-manager behavior, and comprehensible recovery
  matter.

Research current primary sources for Web Crypto, secure contexts, Clipboard,
Credential Management, password-manager and form-autofill controls, page
lifecycle, BFCache, navigation, session history, service workers, browser
extensions, crash reporting, DevTools, Spectre-related isolation, memory
clearing limits, cross-origin isolation, and usable-security pairing studies.

Address all of the following in depth:

1. Define assets, adversaries, and trust boundaries for a malicious website,
   malicious iframe, compromised extension, shoulder surfer, clipboard
   observer, same-user local process, local malware, browser crash, stale tab,
   and accidental disclosure. State explicitly what browser JavaScript cannot
   protect against.
2. Audit the proposed pairing-code grammar. Specify exact ASCII syntax, port
   range, secret byte length, base64url canonicality, maximum length,
   whitespace policy, Unicode rejection, copy/paste normalization, error
   behavior, and checksum or transcription-error considerations.
3. Determine whether a single 32-byte secret embedded with the port is the
   right bootstrap design. Compare PAKE, short authentication strings, QR
   codes, custom URI schemes, OS IPC, and manual copy/paste, then select one
   clean initial design under the supplied constraints.
4. Define the user-presence ceremony step by step. Distinguish actions on the
   desktop Companion from actions in the browser, state what the user must see,
   and make consent specific to origin, Companion instance, capability scope,
   and expiry.
5. Design begin and complete semantics that resist races, replay, malicious
   tabs, lost responses, and accidental double submission. Specify idempotence,
   one-time consumption, safe retry, typed terminal errors, and what remains
   visible after an ambiguous network outcome.
6. Define origin binding. Cover exact scheme, host, port, punycode, trailing
   dot, default port, redirects, subdomains, preview origins, localhost
   development, opaque origins, iframes, and browser extension origins.
7. Evaluate browser key custody options: raw `Uint8Array`, non-extractable
   `CryptoKey`, HKDF-derived subkeys, closure-confined state, dedicated worker,
   SharedWorker, Service Worker, and WebAssembly memory. Select one and explain
   what zeroization claims are and are not defensible.
8. Specify memory-only lifecycle behavior for reload, same-document
   navigation, cross-document navigation, BFCache freeze/restore, duplicate
   tab, tab discard, browser crash restore, browser restart, process sleep,
   and operating-system hibernation.
9. Define multi-tab policy. Compare one active tab, per-tab capabilities,
   BroadcastChannel coordination, Web Locks, SharedWorker custody, and explicit
   re-pairing. Prevent an old tab from silently retaining authority after a
   new tab takes over.
10. Analyze clipboard leakage, clipboard history, remote clipboard sync,
    password-manager capture, autocomplete, spellcheck, accessibility APIs,
    input-method editors, browser translation, screen readers, screenshots,
    and screen recording. Recommend exact HTML attributes and UX behaviors
    without making impossible secrecy claims.
11. Define safe error and status text. The UI must distinguish Companion not
    running, unreachable port, blocked browser policy, malformed code, expired
    pairing, consumed pairing, origin mismatch, capability expired, revoked
    capability, Companion restart, and internal failure without exposing
    secrets or suggesting fake success.
12. Design explicit disconnect, revoke, and forget operations. State which
    side is authoritative, what happens on lost responses, and how the UI
    avoids claiming remote revocation when only local memory was cleared.
13. Define redaction and telemetry prohibition. Cover DOM, accessibility tree,
    console, network inspector, logs, error reporting, performance entries,
    URL, referrer, analytics, traces, browser stores, downloads, and support
    bundles.
14. Specify content security policy, frame policy, referrer policy,
    permissions policy, Trusted Types, Subresource Integrity where applicable,
    and third-party-script policy for the pairing surface.
15. Design an accessible interaction that does not weaken security. Cover
    keyboard use, screen readers, visible focus, error announcement, mobile
    viewport, long code containment, paste, manual entry, and reduced motion.
16. Provide browser-side TypeScript pseudocode for parse, validate, pair,
    derive, retain, use, rotate, revoke, zero best-effort, and transition to an
    unpaired state. Do not include real secrets or private endpoints.
17. Provide at least forty hostile and boundary test cases, including Unicode,
    whitespace, stale codes, concurrent tabs, BFCache, page reload, malicious
    iframe, extension observation, and browser restart.
18. Define acceptance evidence for Chromium and a truthful support matrix for
    Firefox and WebKit. Separate automated browser proof, human usability
    review, and claims that require operating-system or extension testing.

Required report structure:

1. Executive pairing and custody decision.
2. Assets, attackers, trust boundaries, and non-goals.
3. Normative pairing-code grammar and ceremony.
4. Begin, complete, replay, and lost-response state machine.
5. Origin binding and browser key-custody design.
6. Page, tab, crash, and restart lifecycle.
7. Privacy, clipboard, autofill, extension, and telemetry analysis.
8. Accessible UX and typed status contract.
9. TypeScript algorithms and hostile vectors.
10. Browser acceptance matrix and residual risks.
11. Unknowns requiring private execution.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend localStorage, sessionStorage, IndexedDB, a service worker, a
URL parameter, a downloaded text or script file, a browser password manager,
silent reconnect, fixed-port scanning, a broadly scoped token, or secrecy by
obscurity. Do not claim JavaScript can defeat local malware or a privileged
extension.

## Prompt 3: Independent Cryptographic Audit Of Capability Sessions, Rotation, And Revocation

You are an independent principal applied cryptographer, protocol state-machine
reviewer, formal-methods engineer, and cross-language wire-format specialist.
Produce an exceptionally detailed adversarial audit and corrected normative
design for a proposed local Companion capability protocol. You have internet
access but no access to TinyRustLM code, private keys, vectors, test results,
browser profiles, or machines. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Prefer primary standards and official cryptographic-library
documentation, with publication or update date, retrieval date, direct link,
and immutable revision where available.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. The protocol may be redesigned before
  launch, and no obsolete key schedule, compatibility decoder, alias, fallback
  proof, migration route, or debt may remain in production.
- A browser and desktop Companion pair over exact IPv4 numeric loopback. The
  bootstrap uses a random 32-byte one-time secret. A successful ceremony
  establishes a random 32-byte session secret. Secrets are process-memory-only
  by default and never appear in URLs or persistent browser storage.
- Every authenticated request has one exact canonical byte representation,
  session identity, key epoch, unsigned sequence, method, route, content
  identity, and proof. Every authenticated response binds the request context,
  accepted sequence, next sequence, body identity, result class, and proof.
  Proof comparison must be constant time. Duplicate, unknown, missing,
  reordered, noncanonical, or oversized wire members are rejected.
- One session allows one in-flight authenticated operation. The next accepted
  sequence is strict and monotonically increasing from zero through 1,000,000;
  no wrap is allowed. A session has an eight-hour absolute lifetime, a
  fifteen-minute idle lifetime, and a fifteen-minute key-epoch lifetime.
  There are at most 64 key epochs and 600 authenticated requests per monotonic
  minute. The process admits at most four active sessions and 4,096 total
  session or revocation records.
- Rotation begin is authenticated with the current key, creates one pending
  challenge lasting 120 monotonic seconds, and is idempotent only for the exact
  same authenticated request. A different begin conflicts while pending.
  Commit is authenticated under the old key and must also carry proof of the
  candidate new key derived through a registered HKDF construction. Success
  advances the epoch, resets sequence to zero, and preserves absolute expiry.
- A successful rotation commit returns a body and outer response proof under
  the new key, while binding the old request epoch and sequence. The exact old
  authenticated commit may replay the exact stored response for 30 monotonic
  seconds after a lost response. Other old-key traffic is revoked. Replay is
  rate limited and consumes no new sequence.
- Explicit revocation authenticates and materializes its final response before
  erasing the server key. A process-lifetime tombstone rejects all later use.
  Companion restart invalidates every session. MemoryEndpoints is unauthorized
  and outside scope.

Research current primary sources for HMAC, HKDF, SHA-256, domain separation,
key confirmation, channel binding, sequence-number protocols, replay windows,
key erasure, constant-time verification, monotonic clocks, canonical JSON,
cryptographic state machines, and formal protocol analysis. Compare relevant
lessons from TLS 1.3 key updates, Noise, HPKE, OAuth proof-of-possession, and
macaroons without importing unnecessary complexity.

Address all of the following in depth:

1. Write explicit security goals for authentication, integrity, freshness,
   replay resistance, origin binding, endpoint binding, key confirmation,
   forward secrecy or its deliberate absence, post-compromise behavior,
   revocation, denial-of-service containment, and auditability.
2. Draw the complete protocol state machine from unpaired through active,
   rotating, rotated, revoked, expired, sequence exhausted, epoch exhausted,
   and process restart. Identify every linearization point.
3. Audit entropy generation, session identifiers, one-time secret handling,
   session-secret generation, HKDF salt and info, HMAC key use, and domain
   separation. Provide exact labeled transcript inputs for every derivation
   and proof.
4. Determine whether request proofs must bind canonical method, route, origin,
   port, Host, content type, body length, body hash, session ID, epoch,
   sequence, and protocol schema. State exact canonicalization rules.
5. Determine whether response proofs must bind HTTP status in addition to the
   typed body, request proof or request hash, accepted sequence, nullable next
   sequence, epoch, body length, and body hash.
6. Audit the one-in-flight reservation. Analyze disconnect, cancellation,
   handler exception, response serialization failure, response write failure,
   concurrent dispose, timeout, shutdown, and old-key replay. Ensure no path
   strands or double-releases the reservation.
7. Audit sequence consumption rules for malformed requests, bad proofs,
   authenticated route errors, internal failures, cancellation, invalid
   new-key confirmation, and response-write loss. Select one unambiguous rule
   for each class.
8. Analyze numeric interoperability through 1,000,000 across C#, Rust, and
   JavaScript. Specify canonical representation, overflow checks, nullable
   successor at exhaustion, and invalid boundary vectors.
9. Audit monotonic versus wall-clock time for pairing, idle expiry, absolute
   expiry, key age, pending rotation, replay retention, and rate windows.
   Explain restart semantics and suspend/resume behavior.
10. Examine rotation-begin idempotence and conflict. Define the exact identity
    of a begin request, challenge entropy, candidate key derivation, pending
    state replacement after expiry, and behavior at epoch 64.
11. Examine rotation commit in detail. Prove which party knows old and new
    keys, prevent unknown-key-share and reflection attacks, and define whether
    the new response proof plus inner completion proof is redundant or useful.
12. Audit the 30-second exact old-commit replay. Specify lookup key, constant-
    time comparisons, immutable response storage, rate counting, expiry,
    memory bounds, erasure, and behavior when the old request is similar but
    not byte identical.
13. Audit revocation response-before-erasure ordering and the impossibility of
    authenticating later errors. Distinguish a trusted terminal response from
    an unauthenticated transport failure after revocation.
14. Analyze the 4-active-session and 4,096-record ceilings. Cover tombstone
    retention, resource exhaustion by valid users, eviction prohibition,
    process restart, rate limiting before expensive crypto, and typed errors.
15. Specify exact key-zeroization duties and realistic limits in managed .NET,
    JavaScript, Web Crypto, Rust, process dumps, swap, hibernation, and copies
    made by serializers or logs.
16. Provide language-neutral algorithms plus concrete C#, Rust, and browser
    TypeScript sketches for authenticate, reserve, complete, prove error,
    begin rotation, commit rotation, replay commit, revoke, expire, and erase.
17. Produce independent golden vectors with at least twenty valid transcripts
    and fifty invalid or mutated transcripts. Include cross-language byte
    equality and negative tests for every bound field.
18. Recommend a formal or model-based verification approach. Supply invariants
    suitable for TLA+, PlusCal, state-machine property tests, or another
    publicly available method, and state what empirical tests still must prove.

Required report structure:

1. Executive cryptographic verdict and required corrections.
2. Security goals, trust model, and non-goals.
3. Normative transcript, derivation, and proof specification.
4. Full session and lease state machine.
5. Sequence, time, rate, and resource semantics.
6. Rotation-begin and rotation-commit analysis.
7. Exact replay, revocation, restart, and erasure analysis.
8. Cross-language algorithms and canonical vectors.
9. Formal invariants and adversarial test plan.
10. Prioritized implementation and acceptance gates.
11. Unknowns requiring private verification.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend bearer credentials in URLs, permissive decoding, proof
fallbacks, sequence resynchronization by guesswork, best-effort revocation
claimed as proven, wall clock as the sole expiry authority, key retention for
compatibility, or an opaque third-party authentication service. Do not invent
implementation results.

## Prompt 4: Bounded Six-Artifact Transfer With Backpressure, Cancellation, And Resume

You are an independent principal data-transfer protocol architect, .NET
streaming specialist, browser storage engineer, and fault-injection lead.
Produce an exceptionally detailed, implementation-ready protocol for moving a
large, content-addressed local model composition from a desktop Companion into
a browser without buffering the model in memory, weakening identity checks, or
mistaking transport completion for activation. You have internet access but no
access to TinyRustLM code, model files, receipts, browsers, machines,
credentials, or test output. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use primary sources where possible and include publication
or update dates, retrieval dates, direct links, and immutable revisions.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. The transfer protocol
  may be cleanly designed now; no legacy endpoint, alternate chunk size,
  compatibility manifest, migration reader, fallback download, or debt should
  survive into production.
- A qualifying browser composition contains exactly six ordered immutable
  artifacts: SLM2 model weights and metadata, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2 composition metadata. Every artifact has an exact schema
  identity, byte length, SHA-256 digest, and relationship to one aggregate
  composition identity.
- Artifact bytes originate from a user-owned local source or direct peer and
  remain local. Project websites must never receive model bytes or prompts.
  The browser talks to a user-paired Companion over authenticated HTTP/1.1 on
  exact numeric IPv4 loopback.
- The proposed transfer unit is a fixed 4 MiB chunk except for the final
  shorter chunk. The Companion streams from regular files and may not read a
  whole large artifact into managed memory. The browser incrementally verifies
  and writes to an owned staging store. It may not hold the full SLM2 in a
  JavaScript `ArrayBuffer`.
- Only one authenticated request is in flight per capability session. Requests
  and responses are strictly bounded and cryptographically authenticated.
  Artifact transfer must respect the capability sequence, session lifetime,
  rate limits, cancellation, rotation, revocation, process restart, browser
  reload, and storage quota.
- A transfer does not make a composition usable. Activation is a separate,
  atomic, verified state transition after all six exact artifacts are present.
  Partial or conflicting staging bytes are preserved or quarantined according
  to one explicit rule and may never be reinterpreted as success.
- Chromium is the first required browser proof. Windows x64, Linux x64, and
  Linux arm64 Companion hosts matter. MemoryEndpoints is unauthorized and
  outside scope.

Research current primary documentation for Fetch streaming, ReadableStream,
BYOB readers, HTTP range semantics, Kestrel streaming responses, .NET
asynchronous file I/O, backpressure, cancellation, OPFS and IndexedDB writes,
Web Crypto digest limitations, incremental hashing options in WebAssembly,
browser quota, service-worker interception, and HTTP cache controls.

Address all of the following in depth:

1. Define composition, artifact, piece, transfer, attempt, session, staging,
   verification, quarantine, activation, and receipt identities. Show which
   identity prevents pieces from different artifacts or compositions mixing.
2. Compare three transfer shapes: one response per fixed piece, one streaming
   response per artifact, and one multiplexed composition stream. Select one
   under the one-in-flight rule and justify auditability, memory bounds,
   cancellation, retry, and browser support.
3. Decide whether HTTP Range should be used. Distinguish standard byte ranges
   from an application-level fixed-piece route, and specify behavior for
   multiple ranges, suffix ranges, invalid ranges, If-Range, ETag, and content
   encoding.
4. Define exact route, method, path parameter, request body, and response
   fields for composition metadata, artifact metadata, piece retrieval,
   transfer status, cancellation, and completion. Credentials and private
   paths must never appear in routes or query strings.
5. Specify piece math for zero-length artifacts, exact multiples of 4 MiB,
   final short pieces, maximum artifact length, maximum piece count, 64-bit
   offsets, JavaScript-safe representation, overflow, and off-by-one rejection.
6. Choose hash strategy. Compare whole-artifact SHA-256 only, per-piece
   SHA-256, Merkle trees, tree hashes, and final whole-artifact verification.
   State which digests are authoritative and how they bind to the composition.
7. Design Companion file validation before and during transfer. Cover regular
   files, links, reparse points, hard links, sparse files, alternate data
   streams, identity replacement, truncation, growth, modification during
   reads, open-handle semantics, and streamed hashing.
8. Define Kestrel response streaming with bounded buffers and true
   backpressure. Include file-handle lifetime, pooled buffers, zeroing duties,
   short reads, cancellation tokens, client disconnects, response abort,
   content length, and send-file API tradeoffs.
9. Define browser receive flow with bounded memory. Cover Fetch body streams,
   chunk coalescing or fragmentation unrelated to application pieces,
   incremental hashing, writing to OPFS or IndexedDB, transaction size, copy
   counts, garbage collection, and quota failure.
10. Define cache controls and service-worker boundaries. No artifact or secret
    may enter the HTTP cache, Cache Storage, a project-origin CDN, or a
    service-worker offline cache. Explain how this is tested rather than
    assumed.
11. Specify resumability. Bind every resume request to composition, artifact,
    piece, staging identity, browser profile, and verified prior bytes. Decide
    what can resume after tab reload, browser restart, Companion restart,
    session rotation, session loss, and artifact mutation.
12. Define duplicate, reordered, missing, overlapping, conflicting, and
    foreign pieces. State when an exact duplicate is an idempotent no-op and
    when any mismatch terminally quarantines the attempt.
13. Define cancellation at queued, reading, responding, receiving, hashing,
    writing, verifying, and activation boundaries. Separate cancel requested,
    cancel acknowledged, transfer stopped, and staging cleanup authorization.
14. Analyze lost responses and ambiguous completion. The browser and Companion
    must reconcile from durable identities rather than retrying blindly or
    accepting an HTTP success code as artifact proof.
15. Set resource budgets as formulas for disk, browser quota, Companion memory,
    browser heap, open handles, CPU hashing, loopback bandwidth, timeouts,
    logs, staging attempts, and retained quarantine. Do not invent performance.
16. Provide language-neutral algorithms plus C# and browser TypeScript sketches
    for enumerate, authorize, fetch piece, stream, hash, write, resume, cancel,
    verify, and hand off to activation.
17. Design property tests and fault injection for every piece boundary, short
    reads, bit flips, disconnects, process death, browser death, disk full,
    quota loss, stale manifest, key rotation, revocation, and concurrent tabs.
18. Define acceptance evidence using synthetic boundary artifacts, one real
    multi-gigabyte model, real Chromium, each host RID, memory measurements,
    raw failure preservation, and proof that no project origin received bytes.

Required report structure:

1. Executive transfer-protocol decision.
2. Identity graph and exact wire contract.
3. Piece arithmetic, hashing, and integrity rules.
4. Companion streaming and hostile-file algorithm.
5. Browser backpressure, hashing, and staging algorithm.
6. Resume, duplicate, cancellation, and lost-response semantics.
7. Resource budgets and privacy controls.
8. C# and TypeScript implementation sketches.
9. Property, fault-injection, and real-model test matrix.
10. Acceptance gates and residual risks.
11. Unknowns requiring private execution.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend whole-model buffering, base64 model transfer, project-hosted
model bytes, service-worker artifact caching, arbitrary range acceptance,
best-effort hashing, trusting HTTP 200 as proof, silent restart, mixed
composition pieces, automatic deletion of failed evidence, or an old transfer
path retained for compatibility.

## Prompt 5: Browser Artifact Storage, Atomic Composition Activation, And Crash Recovery

You are an independent principal browser-storage architect, transactional
systems engineer, Web Platform specialist, and destructive-recovery tester.
Produce an exceptionally detailed design for durably staging and atomically
activating one six-artifact browser-local language-model composition. You may
browse public standards and browser documentation, but you have no access to
TinyRustLM code, artifacts, profiles, storage receipts, machines, or tests. Do
not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Cite current primary sources with publication or update
date, retrieval date, direct link, and immutable revision where available.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local chat product. A single clean
  storage design may replace all prototypes. There is no installed storage to
  migrate, no legacy database, compatibility reader, alternate activation
  pointer, fallback cache, or permission to retain debt.
- One composition consists of exactly six immutable, content-addressed
  artifacts in fixed order: SLM2, Tokenizer2, Template2, Sampling2, Prompt2,
  and ACG2. Each has an exact byte length and SHA-256 digest. ACG2 binds the
  six component identities and the aggregate composition identity.
- Bytes enter from a paired local Companion or direct peer in fixed bounded
  pieces. The browser writes into an owned staging attempt, incrementally
  verifies each artifact, validates cross-artifact contracts, and performs a
  separate atomic activation. A partial transfer is never runnable.
- Model bytes and prompts remain local. No project origin may receive them.
  The active model must survive an ordinary browser restart when the user has
  chosen local persistence, but pairing/session secrets remain memory-only and
  disappear on restart.
- Inference occurs in a dedicated worker. Cancellation may terminate the
  worker. A fresh worker must be able to reopen the active immutable
  composition and reproduce a declared deterministic probe without mutating
  the artifacts.
- Fresh-profile deletion is the authoritative clean restart for campaign
  testing. Browser storage may be quota-limited or evicted; the UI must report
  this truthfully and never claim an active model when required bytes are gone.
- Chromium is the first proof target. Firefox and WebKit portability must be
  researched and stated accurately. MemoryEndpoints is unauthorized and
  outside scope.

Research current primary documentation for Origin Private File System,
FileSystemSyncAccessHandle, storage buckets if current, IndexedDB transaction
semantics, StorageManager, persistence requests, quota and eviction, Web Locks,
BroadcastChannel, dedicated workers, structured clone, browser shutdown,
storage partitioning, Clear-Site-Data, and Playwright persistent contexts.

Address all of the following in depth:

1. Compare OPFS, IndexedDB blobs, IndexedDB chunk records, File System Access
   handles, Cache Storage, and memory-only storage for multi-hundred-megabyte
   immutable artifacts. Select one authoritative store and explain any narrow
   metadata-store role.
2. Define origin, profile, storage partition, composition, artifact, staging
   attempt, verified artifact, activation generation, active pointer,
   quarantine, and deletion identities.
3. Specify an exact directory or object-store layout with bounded names derived
   from hashes rather than user input. Prevent traversal, collision, case
   ambiguity, and cross-composition aliasing.
4. Design create-only staging. Cover duplicate initiation, two tabs, two
   workers, browser crash, stale handles, exact duplicate bytes, conflicting
   bytes, missing metadata, and an already active identical composition.
5. Define incremental artifact verification and final composition validation.
   Include exact inventory, regular object types, byte counts, hashes, schemas,
   cross-references, model architecture, tokenizer vocabulary, template IDs,
   sampling limits, prompt contract, and ACG2 aggregate identity.
6. Specify the activation linearization point. Compare an IndexedDB
   transaction, atomic rename-like OPFS strategy, immutable generation plus
   one metadata pointer, and a journaled two-phase activation. Select one whose
   crash states are independently reconcilable.
7. Enumerate every crash boundary from first piece through active pointer
   publication. For each, state the only legal restart observation and whether
   staging may resume, must quarantine, or is already active.
8. Define multi-tab and multi-worker exclusion using Web Locks or another
   standard primitive. Analyze lock loss, page death, BFCache, tab discard,
   worker death, browser restart, and browsers lacking the selected primitive.
9. Define immutable read access for inference workers. Cover SyncAccessHandle
   availability, worker-only restrictions, mapping or copying behavior,
   artifact lifetime, active-generation pinning, and deletion while in use.
10. Define model switching. The new composition must be fully verified before
    activation; an old active composition is not a compatibility fallback.
    State whether it is retained as an explicitly user-owned artifact or
    deleted only through a separate authorized operation.
11. Design quota preflight and budget formulas. Include source size,
    composition size, staging duplication, verification workspace, old active
    bytes, browser overhead, free-space uncertainty, and quota changes during
    transfer.
12. Analyze `navigator.storage.persist()`, browser eviction, incognito or
    private mode, storage partitioning, third-party embedding, profile reset,
    enterprise policy, and mobile browser behavior. Avoid claiming persistence
    the platform does not guarantee.
13. Define corruption detection at startup and before inference. Cover missing
    chunks, truncation, metadata mutation, bit rot, quota eviction, unexpected
    objects, and hash verification cadence for large immutable files.
14. Define cleanup and retention. Staging, quarantine, superseded active
    generations, verification caches, and receipts need bounded policies, but
    terminal evidence must not be silently rewritten into success.
15. Specify privacy scanning of IndexedDB, OPFS, Cache Storage, service-worker
    state, localStorage, sessionStorage, logs, traces, screenshots, URLs, and
    network records. Distinguish expected model bytes from forbidden copies.
16. Provide browser TypeScript pseudocode for initialize store, create staging,
    append exact piece, verify artifact, verify composition, commit activation,
    open active, recover, switch, quarantine, and explicit delete.
17. Design deterministic unit, property, browser, crash, quota, concurrent-tab,
    worker-termination, and profile-deletion tests. Include a browser-kill
    harness that does not pretend a page reload is process loss.
18. Produce a browser support and claim matrix. Separate what can be promised
    for Chromium today from experimental or unsupported Firefox/WebKit paths,
    and identify the exact local facts needed before shipping.

Required report structure:

1. Executive storage and activation decision.
2. Browser API comparison and support matrix.
3. Identity model and authoritative layout.
4. Staging, verification, and activation state machine.
5. Crash table and recovery algorithm.
6. Multi-context concurrency and inference-worker access.
7. Quota, persistence, eviction, cleanup, and privacy.
8. TypeScript implementation sketches.
9. Destructive browser test matrix and acceptance gates.
10. Residual risks and unsupported claims.
11. Unknowns requiring private browser execution.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend Cache Storage for model authority, one giant in-memory blob,
a page reload as crash proof, activation before all hashes and contracts pass,
silent quota fallback, permissive recovery, automatic evidence deletion, dual
production stores, or migration code for prototypes.

## Prompt 6: Browser WASM Inference Worker, Memory Bounds, KV Cache, And Deterministic Recovery

You are an independent principal WebAssembly runtime engineer, transformer
inference specialist, browser performance researcher, and deterministic-
systems tester. Produce an exceptionally detailed, implementation-ready
runtime design for executing a compact Qwen3-class language model entirely in
a browser worker while preserving scalar-native semantic authority and hard
resource bounds. You have internet access but no TinyRustLM code, model bytes,
WASM binary, test vectors, profiles, benchmark machine, or private prompts. Do
not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary sources and include publication or
update date, retrieval date, direct link, and immutable revision where one
exists.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI chat product. The runtime may be
  redesigned cleanly, with no legacy WASM exports, alternate model format,
  compatibility kernel, silent scalar fallback, response repair, or debt.
- The first target is one provenance-bound dense Qwen3-class model near 0.6B
  parameters, deterministically converted into an SLM2 composition with exact
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 companions. The selected
  quantization profile and all tensor transforms are part of artifact identity.
- Scalar Rust native inference is semantic reference authority. Browser WASM
  receives the same exact model bytes, tokens, prompt, template, seed, sampling
  parameters, and generation limits. Optimized kernels may ship only after
  conformance to the declared numeric contract.
- Inference runs in a dedicated worker, not on the UI thread. Cancellation must
  stop actual computation, and hard cancellation may terminate the worker.
  A fresh worker must reopen the same immutable active composition and pass a
  deterministic recovery probe before the UI claims readiness.
- Raw generated tokens and text are preserved. Hidden retry, best-of-N,
  output completion, post-hoc repair, expected-term injection, and fixture
  substitution are forbidden. One assistant answer must render exactly once.
- Model bytes and prompts remain local. Browser resource failures must be
  typed and truthful. Chromium is the first proof target; relevant Firefox and
  WebKit limits should be researched. MemoryEndpoints is unauthorized and
  outside scope.

Research current primary documentation for WebAssembly linear memory,
wasm32 limits, memory64 status, multiple memories, SIMD, relaxed SIMD, threads,
SharedArrayBuffer, COOP/COEP, cross-origin isolation, JS-WASM copying, workers,
Atomics, structured clone, transferable objects, performance measurement,
browser process limits, and Qwen3 architecture. Use official model cards and
papers for architecture facts and current browser compatibility sources for
feature claims.

Address all of the following in depth:

1. Define the semantic contract among SLM2, Tokenizer2, Template2, Sampling2,
   Prompt2, ACG2, scalar native runtime, optimized native runtime, WASM module,
   worker protocol, and browser renderer.
2. Build exact memory formulas for quantized weights, metadata, tokenizer,
   temporary activations, logits, sampler state, prompt tokens, generated
   tokens, per-layer scratch, KV cache, WASM allocator overhead, JavaScript
   wrappers, and duplicate transfer buffers.
3. Derive KV-cache growth from layers, key/value heads, head dimension,
   element width, batch, and sequence length. Provide example calculations
   only from explicitly sourced Qwen3 configurations and label assumptions.
4. Compare full eager weight loading, on-demand file reads, OPFS-backed
   windows, memory mapping analogues, weight streaming, and split memories in
   browsers. Select a design that can actually execute, not merely store, the
   model.
5. Analyze wasm32's address-space and browser allocation limits. Determine
   whether memory64 is sufficiently deployable, and define an initial
   production support floor without speculative fallbacks.
6. Compare scalar WASM, portable SIMD, relaxed SIMD, threads, and WebGPU. State
   which can be authoritative now, which may be optimized later, and what
   cross-device numerical tolerance or exactness contract each requires.
7. Determine whether cross-origin isolation is required. Analyze the impact of
   COOP, COEP, CORP, third-party assets, loopback Fetch, SharedArrayBuffer,
   deployment headers, popups, and documentation sites.
8. Specify module exports and imports as one exact production ABI. Cover memory
   ownership, pointer and length validation, integer widths, initialization,
   tokenization, prefill, decode, sampling, cancellation polling, errors,
   disposal, and version identity.
9. Design the UI-to-worker protocol. Use bounded typed messages and explicit
   operation identities. Prevent stale worker messages, duplicate completion,
   completion after cancel, and output from an obsolete model generation.
10. Define soft and hard cancellation. Analyze cooperative flags, Atomics,
    worker termination, partial output custody, file-handle closure, WASM
    memory release, pending promises, and UI state transitions.
11. Define fresh-worker recovery. The new worker must verify active composition
    identity, reopen artifacts, initialize from zero runtime state, run one
    preregistered probe, and report exact evidence without borrowing the old
    worker's memory.
12. Specify deterministic tokenization, template rendering, prompt assembly,
    prefill, logits, sampling, repetition penalty, stop conditions, UTF-8
    decode, and text rendering. Distinguish bit-exact requirements from
    declared numerical tolerances.
13. Analyze allocation failure, WASM trap, out-of-bounds access, integer
    overflow, NaN or infinity, corrupted tensor, unsupported CPU feature,
    context overflow, KV exhaustion, worker crash, tab discard, and browser
    process death.
14. Define performance measurements for startup, load, verification, first
    token, prefill tokens per second, decode tokens per second, peak memory,
    sustained memory, KV slope, cancellation latency, recovery latency, and UI
    responsiveness. Use formulas and observed measurements, never forecasts
    presented as facts.
15. Design scalar-native versus WASM conformance vectors from embedding through
    logits and sampled tokens. Include layer checkpoints, tensor-operation
    vectors, adversarial numeric boundaries, and localization of divergence.
16. Provide Rust/WASM and browser TypeScript pseudocode for initialization,
    bounded reads, prefill, decode, sample, stream token events, cancel,
    terminate, recover, and dispose.
17. Design desktop, narrow desktop, and mobile-viewport browser tests while
    separating viewport responsiveness from device memory capability. Include
    long output, context growth, cancellation races, and one-render assertions.
18. Produce a staged optimization plan in which every optimization has an
    independent preregistration, baseline, acceptance threshold, rollback, and
    deletion of superseded production code before release.

Required report structure:

1. Executive runtime and browser-support decision.
2. Semantic authority and component contract.
3. Exact memory and KV-cache capacity model.
4. WASM feature and optimization matrix.
5. Worker ABI, message protocol, and lifecycle.
6. Cancellation, traps, and fresh-worker recovery.
7. Native/WASM numerical conformance design.
8. Rust and TypeScript implementation sketches.
9. Performance and resource evidence protocol.
10. Browser test matrix and staged optimization plan.
11. Unknowns requiring private model execution.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend silent scalar fallback, output repair, hidden retry,
best-of-N, main-thread inference, whole-model JavaScript buffering, fixture
substitution, optimistic memory claims, unproven WebGPU authority, multiple
production ABIs, or retained obsolete kernels for compatibility.

## Prompt 7: Immutable Qwen3 0.6B Source, License, Architecture, Tokenizer, And Template Audit

You are an independent principal model-forensics researcher, open-source
licensing analyst, tokenizer specialist, and transformer architecture auditor.
Produce an exceptionally detailed source-acquisition and conversion-preflight
report for the official dense Qwen3 model near 0.6B parameters. You may browse
public model repositories, official papers, model cards, licenses, immutable
Git revisions, and package documentation. You have no access to TinyRustLM
code, private source locks, downloaded model bytes, converter output, tests,
evaluation prompts, or machines. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local execution.
For every public source, record publication or update date, retrieval date,
direct link, and immutable revision or file digest where the public host makes
one available. Primary upstream sources must take precedence over mirrors and
summaries.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI chat product. Its first complete
  vertical slice is intended to use one provenance-bound dense Qwen3-class
  source near 0.6B parameters if, and only if, source rights, architecture,
  tokenizer, template, raw behavior, conversion, and runtime proof all pass.
- The project may reject the source or replace its implementation cleanly.
  There is no installed legacy model, compatibility format, alias, migration,
  fallback tokenizer, template repair, or reason to keep superseded code.
- The source must be acquired from an immutable official revision into a
  create-only local source lock. Every required file has an exact path, byte
  count, hash, upstream URL, revision, and license relationship. Mutable branch
  names, popularity, download count, parameter count, and one attractive
  response are not promotion evidence.
- The deterministic composition contains SLM2 weights, Tokenizer2, Template2,
  Sampling2, Prompt2, and ACG2 metadata. Exact tokenizer and chat-template
  behavior must be independently reproduced; a generic Qwen approximation is
  not acceptable.
- Untouched source inference must be screened before conversion or training.
  Raw output is preserved. Output repair, hidden retry, best-of-N, expected-
  term injection, cherry-picked seeds, and training on sealed cases are
  forbidden.
- Model bytes and prompts remain local. Arithmetic may be delegated to a
  deterministic calculator. MemoryEndpoints is unauthorized and outside scope.

Research the current official Qwen3 paper, technical report, Hugging Face or
other official model repository, `config.json`, generation configuration,
tokenizer files, chat template, safetensors index, license, acceptable-use
terms if any, and official inference examples. Resolve the exact repository
and revision rather than relying on the assignment's shorthand.

Address all of the following in depth:

1. Identify the authoritative official repository and exact model identifier
   for the dense Qwen3 model near 0.6B parameters. Distinguish base,
   pretrained, instruct, post-trained, quantized, derivative, and community
   variants.
2. Record the latest suitable immutable revision as of retrieval, publication
   timeline, upstream organization, repository commit, Git LFS pointers,
   advertised file hashes, and any discrepancy among model card, config,
   paper, and files.
3. Analyze the license chain for model weights, tokenizer, chat template,
   configuration, code snippets, and documentation. Address redistribution,
   modification, commercial use, attribution, notices, downstream `.slm`
   distribution, model-card obligations, and ambiguity requiring counsel.
4. Enumerate the exact acquisition inventory and classify required, optional,
   executable, documentation, and unsafe-to-trust files. Include safetensors,
   index, config, tokenizer JSON, merges or vocabulary if present, special-token
   maps, tokenizer config, generation config, README, license, and remote code.
5. Define a fail-closed immutable source lock. Cover redirects, LFS resolution,
   partial downloads, resumability, content length, digest, unexpected files,
   revision drift, repository deletion, HTTP metadata, and offline reuse.
6. Extract the exact architecture: model type, layers, hidden width,
   intermediate width, attention heads, key/value heads, head dimension,
   vocabulary, maximum positions, RoPE parameters, normalization, activation,
   biases, tied embeddings, precision, and tensor naming.
7. Derive parameter counts from tensor shapes and reconcile them with the
   marketed count. Explain which tensors dominate bytes and which architecture
   features affect WASM conversion or KV-cache size.
8. Enumerate every expected tensor name, shape, dtype, shard, and semantic role
   from public files. Define how missing, extra, duplicated, aliased, tied,
   transposed, unsupported, NaN, infinity, or noncontiguous tensors fail.
9. Audit safetensors parsing requirements: header bounds, duplicate keys,
   offsets, overlap, alignment, dtype, shape multiplication overflow, trailing
   bytes, sharded index consistency, links, and remote-code prohibition.
10. Specify exact tokenizer behavior. Cover normalizer, pretokenizer, model
    type, vocabulary, merge rules if any, byte fallback, special tokens,
    added tokens, Unicode, invalid UTF-8, BOS/EOS, padding, unknown token,
    encode/decode cleanup, and canonical public test vectors.
11. Audit the exact chat template. Cover system, user, assistant roles, tool or
    unsupported roles, generation prompt, special markers, thinking and
    non-thinking modes, empty content, multiple system messages, whitespace,
    date injection, and upstream template changes.
12. Determine the intended product mode for ordinary direct chat. If the
    source supports hidden or visible thinking, specify how a fixed Template2
    contract avoids leaking hidden reasoning, silently changing behavior, or
    depending on mutable library defaults.
13. Audit official generation defaults and recommend which facts must be bound
    into Sampling2 versus deliberately overridden by a tested product profile.
    Cover temperature, top-k, top-p, min-p if applicable, repetition penalty,
    seed, maximum tokens, and stop tokens.
14. Define source-level inference parity vectors using an official framework at
    a pinned revision. Include tokenization, rendered prompt IDs, selected
    tensor values, first logits, greedy tokens, seeded samples, and raw text.
15. Design untouched behavioral preflight before conversion. Cover ordinary
    chat, ambiguity, practical constraints, source conflicts, current-turn
    precedence, untrusted quoted text, multi-turn continuity, summaries,
    rewrites, JSON, extraction, code, factual humility, and lawful adult help.
16. Define hard source rejection criteria for unusable conversation, repeated
    impractical advice, fabricated authority, template instability, excessive
    refusal, license ambiguity, unsupported architecture, or immutable-source
    failure.
17. Produce a conversion-support checklist that leaves no architecture or
    tokenizer assumption implicit. Rank unknowns by whether they block
    acquisition, source screening, SLM2 conversion, or browser execution.
18. Specify public-safe provenance evidence that may be published without
    exposing private paths, prompts, raw outputs, or local credentials.

Required report structure:

1. Executive source verdict and explicit assumptions.
2. Authoritative repository, revision, inventory, and timeline.
3. License and redistribution analysis.
4. Immutable acquisition and source-lock protocol.
5. Exact architecture and tensor inventory.
6. Safetensors hostile-input requirements.
7. Tokenizer and chat-template normative specification.
8. Sampling facts and source-parity vectors.
9. Untouched source screen and rejection criteria.
10. Conversion-readiness matrix and prioritized unknowns.
11. Public-safe provenance recommendation.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend a community repack as source authority, mutable `main`, remote
code execution, license inference from popularity, tokenizer approximation,
template repair, hidden retries, best-of-N, automatic fallback to another
model, or retaining unsupported source paths for compatibility.

## Prompt 8: Deterministic Qwen3-To-SLM2 Conversion And Portable Quantized Numeric Contract

You are an independent principal quantization scientist, model-format
engineer, Rust numerical-kernel reviewer, and reproducible-build architect.
Produce an exceptionally detailed normative conversion design for turning one
immutable official dense Qwen3-class source near 0.6B parameters into a
portable six-artifact TinyRustLM composition. You have internet access but no
TinyRustLM code, SLM2 specification, source bytes, converter, kernels, vectors,
or tests. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local execution.
Use primary papers, official model documentation, numerical standards, Rust
documentation, and immutable reference implementations. Record source dates,
retrieval dates, direct links, and immutable revisions.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch product. SLM2, Tokenizer2, Template2, Sampling2,
  Prompt2, and ACG2 are exact technical contract names. There is no older
  public model format, compatibility reader, migration converter, alternate
  quantizer, fallback kernel, alias, or debt to preserve.
- Input is one create-only immutable source lock for an official dense
  Qwen3-class model near 0.6B parameters. Source files, repository revision,
  license, architecture, tokenizer, template, and conversion profile are
  cryptographically bound before the converter starts.
- The converter receives a previously absent output root and emits exactly six
  ordered artifacts plus bounded attempt, component, rejection, and terminal
  evidence. Pass and rejection are mutually exclusive. Partial, malformed,
  contradictory, foreign, or obsolete output roots are never overwritten or
  repaired into success.
- Large files are streamed. Conversion is deterministic for exact source bytes,
  executable bytes, profile bytes, platform contract, and toolchain. Tensor
  receipts bind source tensor, transform, output offset, encoded length,
  parameters, and output digest.
- Scalar Rust native inference is semantic reference authority. Optimized
  native and browser WASM paths must conform to an explicit numerical contract
  with the same artifacts, tokens, prompts, and sampler. Structural validation
  alone is not model-quality proof.
- The initial portable weight profile is expected to favor a practical
  byte-aligned quantization suitable for scalar and WASM execution. One-bit,
  ternary, TurboQuant-like, vector-only, or experimental methods may be
  analyzed, but must not be recommended as production merely because they are
  smaller. Accuracy and portability evidence are mandatory.
- Windows x64, Linux x64, and Linux arm64 matter. Private paths and large model
  bytes remain outside public Git. MemoryEndpoints is unauthorized and outside
  scope.

Research current primary literature for weight-only quantization, symmetric
and asymmetric int8, per-tensor, per-channel and groupwise quantization,
rounding, calibration, GPTQ/AWQ/SmoothQuant where relevant, low-bit formats,
BitNet-style models, TurboQuant and related vector or cache methods, safetensors,
IEEE 754, WebAssembly numeric behavior, SIMD, and reproducible conversion.

Address all of the following in depth:

1. Define the exact conversion trust boundary and identity graph from source
   repository through source lock, tensor input, transform, SLM2 region,
   component artifact, ACG2 composition, runtime, and evidence.
2. Reconstruct the Qwen3 tensor semantics needed for conversion: embeddings,
   Q/K/V/O projections, grouped-query attention, normalization, MLP gates,
   up/down projections, output head, RoPE parameters, and tied weights.
3. Specify one deterministic tensor traversal and output ordering independent
   of source shard order, filesystem enumeration, hash-map order, thread
   scheduling, locale, and platform path behavior.
4. Compare FP16, BF16, int8, Q8 blockwise, int4, ternary, one-bit, and any
   TurboQuant-like public technique for this browser target. Evaluate bytes,
   dequantization cost, SIMD fit, scalar reference clarity, WASM portability,
   calibration needs, quality risk, and implementation complexity.
5. Select one initial production quantization profile. Specify block or group
   size, axis, signed representation, scale type, zero point or its absence,
   treatment of tails, alignment, padding, metadata, endian order, and exact
   bytes per tensor.
6. Specify deterministic min/max or scale selection, treatment of outliers,
   zero blocks, negative zero, NaN, infinity, denormals, saturation, ties,
   rounding mode, floating-point contraction, and host-feature independence.
7. Determine whether calibration data is needed. If not, explain why. If yes,
   define contamination-safe calibration, immutable data identity, sequence
   limits, privacy, and proof that calibration is not evaluation leakage.
8. Define dequantization and matrix-vector arithmetic as a normative scalar
   equation. Specify accumulation type, operation order, fused multiply-add
   policy, scale conversion, reduction order, overflow, and tolerance.
9. Define portable optimized kernels for x86-64, arm64, and WASM SIMD. Explain
   how each proves conformance to scalar authority and which architecture-
   specific reorderings require tolerance instead of bit equality.
10. Design SLM2 file layout requirements: header, schema, architecture,
    tensor directory, names or IDs, shapes, dtype/profile, offsets, lengths,
    alignment, checksums, aggregate hash, exact EOF, and bounded parsing.
11. Define the other five artifacts and their cross-links. Tokenizer2,
    Template2, Sampling2, Prompt2, and ACG2 must bind exact model assumptions
    and prevent a structurally valid but semantically mismatched composition.
12. Specify hostile-input checks for safetensors and SLM2: integer overflow,
    rank and dimension bounds, offset overlap, huge header, duplicate tensor,
    missing tensor, extra tensor, shard mismatch, invalid UTF-8, path links,
    sparse file, truncation, trailing bytes, and content mutation.
13. Design create-only conversion, terminal pass, terminal rejection, crash
    recovery, disk-full handling, cancellation, and deterministic
    reconciliation without relaunch or output repair.
14. Define tensor-level and whole-model receipts. Show how an auditor can trace
    each output region to exact source bytes and transform parameters without
    publishing private local paths.
15. Provide Rust pseudocode for bounded safetensors parsing, tensor streaming,
    deterministic quantization, layout planning, writing, hashing, flush,
    terminal evidence, and independent verification.
16. Design golden vectors from tiny synthetic tensors through representative
    real source tensors. Include all rounding boundaries, tail blocks, zero
    blocks, outliers, NaN rejection, endianness, and independent C#/JavaScript
    parsers.
17. Design promotion experiments comparing untouched source, converted scalar
    native, optimized native, and browser WASM. Require layer checkpoints,
    logits, greedy tokens, seeded samples, untouched behavior, latency, memory,
    and explicit quality-regression budgets.
18. Give a decisive go/no-go rubric for experimental sub-byte or TurboQuant-
    related techniques. They may become a future clean replacement only after
    independent accuracy and runtime proof; no dual production quantizer may
    be retained as compatibility debt.

Required report structure:

1. Executive conversion and quantization decision.
2. Source-to-composition identity graph.
3. Qwen3 tensor mapping and deterministic traversal.
4. Quantization method comparison and selected profile.
5. Normative numeric contract and kernel conformance.
6. SLM2 and companion-artifact format requirements.
7. Create-only conversion, reconciliation, and receipts.
8. Rust algorithms and hostile-input defenses.
9. Golden vectors and cross-runtime promotion tests.
10. Experimental low-bit go/no-go rubric.
11. Unknowns requiring private conversion and measurement.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend quantization solely from compressed size, post-process a bad
answer into a pass, use evaluation prompts as calibration, accept source-order
nondeterminism, infer success from process exit, maintain two production
formats, add a compatibility reader, or claim one-bit/TurboQuant-like methods
without model-specific accuracy and browser-runtime evidence.

## Prompt 9: No-Cheat Semantic Qualification And Contamination-Safe Quality Rescue

You are an independent principal evaluation-science lead, small-model
post-training researcher, statistical reviewer, and behavioral-data auditor.
Produce an exceptionally detailed, implementation-ready protocol for deciding
whether one dense Qwen3-class model near 0.6B parameters is useful enough for a
browser-local assistant and, only if necessary, improving it without leaking
evaluation content into training. You have internet access but no access to
TinyRustLM code, model outputs, private prompts, holdouts, datasets, adapters,
GPUs, receipts, or tests. Do not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Use current primary papers, official model cards, dataset
cards, framework documentation, and peer-reviewed evaluation work. Record
publication or update dates, retrieval dates, direct links, immutable dataset
or code revisions, and licenses.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI chat product. The immediate goal
  is one honest, useful, provenance-bound model vertical slice, not a quota of
  catalog entries. A weak source, failed adapter, obsolete trainer, or poor
  evaluator may be deleted and replaced; there is no legacy obligation.
- Important behavior includes ordinary conversation, common-sense judgment,
  ambiguity clarification, practical constraints and feasible alternatives,
  conflicting-source handling, latest-user preference over stale profile
  memory, multi-turn continuity, treatment of quoted or retrieved instructions
  as untrusted data, summarization, rewriting, JSON, extraction, code
  explanation, factual humility, and substantive responses to lawful adult
  questions. Narrow security and nonconsensual-harm boundaries remain explicit.
- Arithmetic is secondary and may be delegated to a deterministic calculator.
  Helpful positive examples must substantially outnumber refusals.
- The exact immutable source is screened before conversion or training.
  Development cases, seeded paraphrases, sealed holdouts, and independent audit
  remain disjoint. Raw output is preserved. Output repair, hidden retry,
  answer completion, expected-term injection, best-of-N, cherry-picked seeds,
  judge rewriting, threshold weakening, and training on failed holdouts are
  forbidden.
- If adaptation is justified, a preregistered CPU LoRA pilot first proves the
  data and training pipeline. Realistic GPU work occurs only with authorized
  compute and immutable receipts. Source, data, teacher, reviewer, adapter,
  merge, quantization, prompt, template, sampler, runtime, evaluator, raw
  output, and decision identities are content-addressed.
- Promotion compares untouched source, adapter, merged model, deterministic
  SLM2, scalar native, and browser WASM under the same semantic cases. Model
  bytes and prompts stay local. MemoryEndpoints is unauthorized and outside
  scope.

Research current primary literature for small-model instruction tuning,
assistant-only SFT, LoRA, DoRA, preference optimization, knowledge
distillation, teacher ensembles, contamination detection, metamorphic testing,
semantic evaluation, stochastic pass-rate estimation, inter-rater agreement,
catastrophic forgetting, over-refusal, and tiny-model capability limits.

Address all of the following in depth:

1. Define a claim taxonomy from source-identified and runtime-smoke-only
   through structurally converted, conversation-screened, task-specific-proven,
   conversation-proven, and full-assistant-quality. State minimum evidence and
   prohibited claim language for every level.
2. Design a pre-conversion untouched source screen. Specify behavior families,
   number of source scenarios, seeded paraphrases, multi-turn lengths,
   deterministic versus sampled runs, fixed seed policy, raw-output custody,
   and human review workload.
3. Write general semantic invariants for ambiguity, practical resources,
   conflicting authorities, current-turn precedence, untrusted quoted memory,
   lawful adult comparison, factual uncertainty, summaries, rewrites, JSON,
   extraction, and code explanation without embedding one expected answer.
4. Define hard rejection and escalation rules. Distinguish semantic model
   failure, evaluator defect, malformed output, infrastructure flake,
   unsupported template, context truncation, and subjective reviewer dispute.
5. Design a layered evaluator using deterministic structure checks,
   scenario-specific semantic invariants, optional blinded model judges, and
   human authority. Prevent a judge from rewriting or completing the answer.
6. Specify metamorphic case generation across names, entities, products,
   dates, percentages, units, resource availability, authority order, sentence
   order, negation, discourse style, distractors, stale preferences, and
   malicious quoted instructions.
7. Define a deterministic holdout generator bound to generator version, seed,
   template family, factor domain, exclusion set, and case hash. Prevent easy-
   seed selection after results are visible.
8. Design contamination controls for exact normalized overlap, character and
   token n-grams, semantic neighbors, template-family overlap, entity-
   substituted overlap, answer-term overlap, public benchmarks, teacher
   artifacts, reviewer notes, logs, and deletion lineage.
9. Explain how to prove, within honest limits, that private prompts, expected
   answer terms, rubric phrases, and failed holdouts did not enter training.
   Address false negatives in semantic overlap detection.
10. Define the decision rule for training versus rejecting the source versus
    shipping a narrower task claim. Avoid spending compute merely because a
    converter exists.
11. If training is justified, design a small pilot curriculum with exact counts
    and proportions, then a scale-up curriculum. Include ordinary positive
    chat, hard negatives, counterfactual resource cases, source conflicts,
    preference changes, untrusted memory, multi-turn state, adult inquiry,
    boundaries, facts, transformations, structured output, and code.
12. Compare assistant-only SFT, full-sequence SFT, LoRA, DoRA, full fine-tune,
    DPO, ORPO, sequence-level distillation, token-level KL, top-k logits,
    hidden-state matching, and self-distillation for a 0.6B student. Select a
    staged method and state which options are unjustified at pilot scale.
13. Design teacher generation and review. Cover immutable teacher identity,
    sampling diversity, final answers rather than hidden reasoning, factual
    verification, policy bias, over-refusal, PII, licensing, malicious output,
    two-reviewer adjudication, and removal lineage.
14. Provide CPU and GPU memory/time formulas for optimizer state, trainable
    parameters, activations, sequence packing, precision, gradient
    accumulation, checkpointing, validation, and measured throughput. Define
    restart-safe checkpoints and terminal stop rules.
15. Define statistical treatment for stochastic generation: preregistered
    seeds, per-case pass probability, confidence intervals, correlated failure
    families, multiple comparisons, ordinary-helpfulness regression budgets,
    and infrastructure-flake isolation.
16. Design blinded promotion comparisons among source, adapter, merged model,
    quantized SLM2, scalar native, and browser WASM. Ensure exact prompt,
    template, sampler, seed, limits, and untouched output custody.
17. Define an independent audit excluded from model development. Include
    challenge sets for impractical advice, fabricated certainty, over-refusal,
    stale-memory obedience, prompt injection, source conflict, and lawful adult
    treatment, with inter-rater agreement and appeal procedure.
18. Produce a stop/go/rollback plan for one qualifying model. A failed training
    path must preserve evidence, add a general regression where appropriate,
    and leave no superseded trainer or adapter path in production as legacy.

Required report structure:

1. Executive quality decision framework.
2. Claim taxonomy and untouched source screen.
3. Semantic invariants and layered evaluator.
4. Metamorphic and seeded-holdout system.
5. Contamination threat model and auditable controls.
6. Train-or-reject decision and staged curriculum.
7. Method, teacher, reviewer, and compute design.
8. Statistics and cross-form promotion matrix.
9. Independent audit, stop rules, and rollback.
10. Prioritized route to one honest useful model.
11. Unknowns requiring private outputs or authorized compute.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend copying evaluation cases into training, choosing an easy seed,
repairing output, best-of-N, an opaque LLM judge as sole authority, popularity
as quality evidence, lowering thresholds, hiding failures, inventing compute
measurements, or retaining failed training machinery for compatibility.

## Prompt 10: Verified-P2P-First Acquisition Or Explicit Local Conversion Product Flow

You are an independent principal distributed-systems architect, product
security engineer, browser UX reliability lead, and content-addressed download
specialist. Produce an exceptionally detailed product and protocol design that
lets a user select a public model and then either acquire an already verified
TinyRustLM composition directly from consenting peers or explicitly convert an
approved immutable public source on the user's Companion. You have internet
access but no TinyRustLM code, peer network access, model files, catalog
credentials, receipts, UI implementation, or test output. Do not claim private
validation or live peer availability.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized production proof. Use current primary sources with publication or
update date, retrieval date, direct link, and immutable revision where one
exists. Public site observations must include URL, date, and viewport.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI chat product. The current clean
  product goal is that choosing a model causes useful work, not downloads of a
  `.txt`, `.ps1`, instruction file, or conversion-request JSON that asks the
  user to finish the system manually.
- One selected model is represented by an exact public source identity and, if
  conversion has already occurred, an exact six-artifact composition identity:
  SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. Aliases and model
  names are presentation only and cannot substitute for byte identity.
- MiniModel provides public-safe catalog and direct-peer discovery metadata.
  Model bytes must flow directly between consenting peers; project websites
  and catalog servers must not proxy model bytes. A local or LAN success is not
  proof of public peer reachability.
- The browser first checks for an admissible verified composition from one or
  more peers. Every source, manifest, piece set, endpoint, peer proof, and
  quality receipt must agree before bytes can mix. If no acceptable peer is
  currently available, the UI may offer explicit local conversion through a
  paired user-owned Companion.
- Local conversion first presents source provenance, license facts, expected
  source bytes, expected output bytes as a bounded estimate, disk needs,
  expected operations, cancellation semantics, and quality-claim limits. It
  acquires a pinned source revision, writes a create-only conversion intent,
  runs one bounded converter attempt, independently reconciles terminal
  evidence, and transfers the verified composition to browser storage.
- No path may silently switch source revision, model family, quantizer,
  tokenizer, template, sampler, prompt, or quality threshold. No legacy
  download workflow, compatibility endpoint, hidden fallback, fake peer,
  simulated success, response repair, or technical debt may remain.
- Model bytes and prompts remain local or direct P2P. MemoryEndpoints is
  unauthorized and outside this assignment. The larger 20-model campaign
  remains unproven and must not be inferred from one working model.

Research primary documentation and standards for content-addressed systems,
BitTorrent-style piece verification, HTTP range and direct transfer, WebRTC
data channels if relevant, NAT and browser constraints, signed manifests,
Ed25519, catalog/discovery separation, resumable acquisition, secure local
process invocation, browser downloads, human consent, and progress UX. Analyze
current public MiniModel and TinyRustLM pages only as publicly observed facts.

Address all of the following in depth:

1. Draw the complete user and protocol state machine from catalog search
   through source review, peer discovery, P2P admission, transfer, verification,
   local-conversion alternative, browser activation, cancellation, failure,
   and ready-to-chat.
2. Define source, model, artifact, composition, piece set, peer, endpoint,
   reachability proof, catalog entry, quality receipt, conversion intent,
   attempt, transfer, activation, and UI operation identities.
3. Specify catalog metadata that is public-safe and sufficient for decisions.
   Distinguish labels and popularity from immutable source, license, quality,
   composition, piece-set, protocol, and proof identities.
4. Define verified-peer admission. A peer endpoint must match exact
   composition and piece-set identities, supported protocol, current signed
   proof, non-revoked status, and quality claim. State every fail-closed gate.
5. Analyze one-peer and multi-peer transfer. Before mixing pieces, require
   complete identity agreement. Define piece scheduling, per-peer limits,
   duplicate pieces, corruption, stalling, peer loss, and final independent
   Rust/browser verification.
6. Define what direct P2P means in a browser-plus-Companion product. Compare
   browser Fetch to peer HTTP, Companion-mediated direct peer transfer, WebRTC,
   WebTransport, and relay or TURN. Reject any project-hosted byte proxy and
   label externally required infrastructure honestly.
7. Design privacy-preserving peer discovery and transfer. Address IP exposure,
   referrers, Origin, CORS, peer logs, catalog queries, model-interest leakage,
   telemetry, credentials, and consent.
8. Specify transition from unavailable peers to explicit local conversion.
   The decision must not download instructions. Define Companion pairing,
   capability check, source facts, user authorization, create-only intent, and
   immediate operation start.
9. Design immutable source acquisition from a public repository. Cover pinned
   revisions, redirect policy, LFS, multiple files, size unknown, disk preflight,
   partial downloads, resume, checksums, license review, rate limits, source
   drift, and offline reuse.
10. Define conversion progress without inventing percent complete. Separate
    known bytes, downloaded bytes, verified bytes, tensors converted, output
    bytes, terminal verification, and browser transfer. Give monotonic rules
    and honest indeterminate states.
11. Define cancellation for peer discovery, peer transfer, source acquisition,
    source verification, queued conversion, active child process, terminal
    reconciliation, browser transfer, and activation. State what can be
    deleted only with explicit ownership proof and what evidence remains.
12. Define resumability and restart behavior across tab reload, browser close,
    Companion restart, peer change, source host outage, conversion crash, and
    storage quota loss. Never relaunch a converter from ambiguous state.
13. Specify typed user-facing failures for no peers, stale proof, bad piece,
    license ambiguity, unsupported architecture, insufficient disk, source
    drift, converter rejection, Companion loss, browser policy block, quota
    failure, composition mismatch, and quality rejection.
14. Design the actual model-selection UI. It must expose meaningful provenance,
    quality claim, size, local/P2P route, consent, progress, cancel, recovery,
    and final readiness while remaining usable at desktop and mobile widths.
15. Define network assertions proving project origins did not receive model
    bytes or prompts. Cover requests, DNS, redirects, service workers,
    WebSockets, peers, loopback, analytics, and false alarms from hashes.
16. Provide language-neutral algorithms and browser/Companion pseudocode for
    choose, discover, admit, acquire, fallback decision, authorize conversion,
    observe progress, reconcile, transfer, activate, and start chat.
17. Design tests with no-peer, one-peer, two-peer, malicious-peer, stale-proof,
    partial-source, source-drift, disk-full, conversion-crash, cancellation,
    browser-restart, and successful real-model cases. Clearly separate mocks,
    local integration, outside proof, and live catalog evidence.
18. Produce a clean cutover plan that deletes instruction-file downloads and
    obsolete request artifacts once the working path is proven. No old path
    may remain as a compatibility fallback.

Required report structure:

1. Executive product-flow decision.
2. User journey and normative state machine.
3. Identity, catalog, peer, and quality contracts.
4. Direct-P2P admission and transfer protocol.
5. Explicit local-conversion path.
6. Progress, cancellation, resume, and typed failures.
7. Privacy, network, and no-project-upload proof.
8. Browser and Companion implementation sketches.
9. UX requirements and responsive acceptance.
10. Fault matrix and evidence levels.
11. Clean cutover and prioritized implementation plan.
12. Unknowns requiring private or authorized live proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend text, script, or JSON instruction downloads; a project-hosted
model-byte fallback; alias-based identity; fake or local-only public-peer
claims; silent source changes; automatic conversion relaunch; percent-complete
fabrication; fixture substitution; dual product flows; or retained obsolete
download code.

## Prompt 11: Cross-Platform Companion Packaging, Least Privilege, And Release Proof

You are an independent principal release engineer, .NET packaging specialist,
Rust FFI auditor, desktop application security architect, and cross-platform
test lead. Produce an exceptionally detailed design for packaging and releasing
a user-owned TinyRustLM Companion on Windows x64, Linux x64, and Linux arm64.
You may browse public standards, official .NET, Rust, NuGet, operating-system,
and supply-chain documentation. You have no access to TinyRustLM code,
packages, signing keys, CI, machines, deployment accounts, or test output. Do
not claim private validation.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized proof. Cite current primary sources with publication or update
date, retrieval date, direct link, and immutable revision when available.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. The Companion is its
  operational desktop host for approved model acquisition, deterministic local
  conversion, direct-peer serving or acquisition where authorized, and
  authenticated numeric-loopback transfer. There is no public legacy package,
  installer, service, protocol, compatibility shim, migration path, or debt to
  preserve.
- The Companion targets .NET 8 and ASP.NET Core 8, uses Kestrel HTTP/1.1 bound
  only to `127.0.0.1` on an operating-system-assigned port, and calls a Rust
  core through one small C ABI. It must not require an administrator account,
  install a certificate, silently edit firewall/router state, expose LAN/public
  listeners, or provide a shell.
- Required release surfaces include managed assemblies, native Rust libraries,
  C header, C# wrapper, NuGet package, symbols package, SourceLink, SBOM,
  provenance, and self-contained Companion archives for `win-x64`,
  `linux-x64`, and `linux-arm64`. Browser assets and public sites are separately
  released but must agree on the exact protocol and version identities.
- Native assets are selected by exact RID and hash. Architecture or load
  mismatch must fail closed. Package creation is not package-consumer proof;
  cross-compilation is not real arm64 execution; binary-header inspection is
  not runtime proof.
- Private model artifacts, source locks, conversion roots, raw outputs, and
  credentials remain outside Git and public packages. Public artifacts include
  only bounded schemas, vectors, hashes, versions, licenses, and safe evidence.
- Every coherent green major change is committed and pushed. Deployment or
  package publication occurs only after the complete affected gate passes,
  with version, release date, source commit, update log, publication log, and
  public readback. MemoryEndpoints is unauthorized and outside scope.

Research current primary documentation for .NET self-contained and single-file
publishing, NativeLibrary loading, RID catalogs, NuGet native assets,
`runtimes/{rid}/native`, package lock files, SourceLink, portable PDB,
`.snupkg`, deterministic builds, Authenticode, Linux signing options, SBOM,
SLSA, in-toto, Sigstore, archive safety, code-signing custody, malware
scanning, systemd user services, Windows startup mechanisms, and least
privilege.

Address all of the following in depth:

1. Select the release shape: framework-dependent, self-contained, single-file,
   trimmed, ReadyToRun, NativeAOT, or a justified combination. Analyze startup,
   size, native extraction, reflection, Kestrel, diagnostics, reproducibility,
   update, and support implications.
2. Define package identities across source commit, Cargo.lock, NuGet lock,
   Rust library, C ABI, managed wrapper, Companion executable, NuGet package,
   symbols, RID archive, SBOM, provenance, signature, and publication.
3. Specify one exact C ABI. Cover calling convention, symbol names, integer
   widths, pointers, lengths, ownership, allocator boundaries, UTF-8, error
   records, cancellation handles, thread safety, panic containment, version
   identity, and disposal.
4. Define C# P/Invoke or source-generated interop. Prevent ambiguous bools,
   platform-sized integers, marshaler allocation, callback lifetime errors,
   use-after-free, double-free, unbounded strings, and exception leakage.
5. Design exact native asset resolution. Verify RID, operating system,
   architecture, binary header, expected file name, package identity, hash,
   load directory, dependency closure, and exported ABI before invoking code.
6. Analyze DLL search-order hijacking, `LD_LIBRARY_PATH`, current-directory
   loading, symlinks, reparse points, writable install directories, temporary
   extraction, quarantine attributes, and package tampering.
7. Define least-privilege runtime ownership for configuration, logs, source
   locks, model artifacts, conversion staging, receipts, quarantine, and
   updates. Include permissions, links, filesystem boundaries, disk full, and
   cleanup authorization on Windows and Linux.
8. Design single-instance and process lifecycle without a fixed-port protocol.
   Compare foreground app, tray app, Windows per-user startup, systemd user
   service, and explicit launch. No service-manager claim may exceed tested
   behavior.
9. Specify graceful shutdown and crash recovery for listener, authenticated
   sessions, active transfer, conversion child, journals, file handles, and
   terminal evidence. Companion restart invalidates browser sessions and must
   not silently adopt ambiguous work.
10. Define deterministic builds and dependency controls for Cargo and NuGet.
    Include pinned toolchains, lock files, package allowlists, repository
    metadata, build paths, timestamps, locale, native compiler, and offline
    restoration evidence.
11. Design NuGet package layout, metadata, license, README, icon if any,
    repository commit, SourceLink, portable PDB, `.snupkg`, native assets,
    package-consumer tests, and package-signing authorization.
12. Design self-contained archives. Specify exact inventory, permissions,
    executable bits, line endings, path normalization, traversal defense,
    symlink policy, hashes, manifest, SBOM, notices, examples, and installation
    instructions that do not require unsafe shell downloads.
13. Define code-signing and provenance policy for Windows and Linux. Separate
    unsigned prelaunch test artifacts from release claims, cover key custody,
    rotation, revocation, timestamping, transparency logs, and offline keys.
14. Define malware, secret, and archive scans. State practical boundaries for
    managed binaries, native binaries, scripts, archives, symbols, and very
    large model files without claiming a scanner proves model safety.
15. Build a RID evidence ladder distinguishing cross-compile, binary-header
    inspection, dependency inspection, package-consumer load, emulated smoke,
    VM execution, and real-hardware conversion plus loopback transfer.
16. Design unit, integration, ABI, fuzz, package-consumer, destructive
    filesystem, listener, browser, conversion, cancellation, restart, and
    uninstall tests per RID. Zero skipped required tests is a release gate.
17. Define update and rollback for a prelaunch clean product. Do not add a
    compatibility layer; an incompatible protocol change replaces all affected
    surfaces in one coordinated release before public launch.
18. Produce a publication checklist binding tested source to package registry
    readback, archive download readback, signature verification, documentation,
    visible version/date, release notes, and known limitations.

Required report structure:

1. Executive packaging and release decision.
2. Component, ABI, package, and identity graph.
3. Release shape and native-loading security.
4. Least-privilege filesystem and process lifecycle.
5. Deterministic build, dependency, SBOM, and provenance controls.
6. NuGet, symbols, and self-contained archive specifications.
7. Signing, scanning, update, and rollback policy.
8. RID evidence ladder and test matrix.
9. Publication, readback, and documentation checklist.
10. Prioritized implementation plan and stop rules.
11. Unknowns requiring private keys or real hardware.
12. Annotated primary-source bibliography with dates and direct links.

Do not recommend administrator execution, wildcard listeners, silent firewall
changes, unsafe native search, mutable dependencies, package creation as proof,
cross-compilation as arm64 execution, unsigned artifacts described as signed,
dual ABIs, compatibility shims, or retention of obsolete release machinery.

## Prompt 12: One-Model End-To-End Acceptance, Evidence, Documentation, And Deployment Closure

You are an independent principal release-control architect, browser acceptance
lead, evidence-systems reviewer, privacy auditor, and technical-documentation
operator. Produce an exceptionally detailed control plane for proving one real
TinyRustLM model from immutable public source through genuine browser-local
multi-turn chat and coherent public release. You may inspect public standards,
official documentation, package registries, and public TinyRustLM-related
sites. You have no access to TinyRustLM source, branches, model bytes, builds,
receipts, profiles, credentials, signing keys, deployment systems, or private
tests. Do not claim private validation or infer private state from a public
page.

Your report must label directly observed public facts, sourced external facts,
project facts supplied below but not independently verified, assumptions and
inferences, engineering recommendations, and facts requiring local or
authorized production proof. Primary sources are required where available.
Every source needs publication or update date, retrieval date, direct link, and
immutable revision. Public page observations need URL, date, viewport, and a
clear separation between observation and inference.

Project facts supplied for this assignment:

- TinyRustLM is one prelaunch browser-local AI product. There is no product V2,
  installed legacy population, compatibility obligation, migration route,
  alias, hidden fallback, tolerated debt, or reason to retain obsolete code.
  SLM2, ACG2, Tokenizer2, Template2, Sampling2, and Prompt2 are technical
  identities only.
- Completion means one cryptographically identified model with acceptable
  immutable provenance and license, passing untouched semantic screening,
  deterministic six-artifact conversion, scalar-native inference, real-
  Chromium WASM conformance, working verified-P2P-first or explicit local-
  conversion acquisition UX, atomic browser activation, and a genuine
  multi-turn browser-local conversation.
- The browser must render each assistant answer once, preserve raw output, keep
  prompt and model bytes off project origins, support truthful cancellation,
  terminate the inference worker, open a fresh worker, and prove deterministic
  recovery from the active immutable composition.
- A desktop Companion uses explicit user-presence pairing, exact numeric IPv4
  loopback, least-privilege memory-only capabilities, strict canonical wire,
  bounded transfer, key rotation and revocation, create-only conversion intent,
  terminal reconciliation, and public-safe evidence.
- Failure evidence is append-only. Hidden retry, best-of-N, response repair,
  expected-term injection, fixture substitution, mock live service, fake peer,
  local-only public proof, skipped gate converted to pass, or overwrite of a
  rejection is forbidden.
- MemoryEndpoints is unauthorized and disconnected. Campaign counters remain
  exactly zero qualified models out of twenty, zero clean browser rounds out
  of fifty, zero live memory rounds out of twenty-five, zero externally proven
  lanes out of forty, and zero catalog announcements out of twenty until their
  separate objective live evidence exists. One model vertical slice does not
  silently increment those campaign gates.
- Required surfaces include Rust native and WASM, C ABI, C# wrapper, NuGet,
  symbols, self-contained Companion archives, browser assets, MiniModel
  metadata, product documentation, architecture documentation, privacy and
  security documentation, marketing claims, release notes, update log,
  publication log, visible version and release date, source control, deployment,
  and public HTTPS readback.
- Required host RIDs are Windows x64, Linux x64, and Linux arm64, with
  cross-compilation, inspection, emulation, and real execution kept distinct.

Research primary sources for content-addressed evidence, in-toto, SLSA, SPDX or
CycloneDX, Sigstore, reproducible builds, browser automation, Playwright
persistent profiles, WebAssembly deployment, CSP, COOP/COEP, network capture,
secret scanning, public HTTPS deployment readback, cache invalidation, release
rollback, documentation operations, and accessible chat interfaces.

Address all of the following in depth:

1. Define the complete phase graph: source discovery, immutable acquisition,
   license review, untouched screen, optional contamination-safe training,
   source qualification, deterministic conversion, six-artifact validation,
   scalar native inference, optimized native conformance, Companion pairing,
   P2P or local-conversion acquisition, browser staging, activation, WASM
   inference, multi-turn chat, cancellation, worker recovery, package gates,
   deployment, HTTPS readback, and final memory.
2. Assign exact identities to every phase input, tool, policy, environment,
   output, and decision. Show invalidation edges for source, schema, converter,
   quantizer, tokenizer, template, prompt, sampler, runtime, evaluator,
   Companion, browser, UI, package, documentation, and deployment changes.
3. Design a versioned receipt family without one generic `passed` field.
   Include subject identity, phase, inputs, tool identities, bounded observed
   facts, status, terminal reason, predecessor, supersession, time facts,
   environment facts, private evidence reference, and public-safe projection.
4. Define append-only history and explicit new-attempt semantics. Explain how
   a corrected evaluator reruns evaluation without reacquiring valid source,
   how changed conversion invalidates downstream artifacts, and how rejected
   evidence remains visible without becoming an active claim.
5. Produce the objective acceptance matrix for provenance, license, source
   behavior, contamination, conversion, each of six artifacts, scalar runtime,
   optimized runtime, loopback security, capability protocol, transfer,
   storage, WASM, UI, privacy, network, cancellation, restart, resources,
   accessibility, packages, RIDs, docs, deployment, and readback.
6. Design the real clean-browser proof. Require an owned previously absent
   profile root, persistent browser context, authentic model acquisition,
   two-to-six-turn conversation, raw model output, exact message counts, one
   authoritative rendering, cancel behavior, worker death, fresh-worker
   recovery, process closure, profile deletion with proof, and no use of a page
   refresh as deletion evidence.
7. Define privacy and network evidence proving project origins received no
   prompts, generated text, model bytes, pairing secrets, session keys, or
   credentials. Cover DNS, requests, redirects, headers, bodies, WebSockets,
   loopback, peers, service workers, browser stores, analytics, error reports,
   screenshots, traces, and crash dumps.
8. Define secret scanning across UTF-8, UTF-16, base64, URL encoding,
   compressed archives, binaries, logs, profiles, symbols, source maps,
   packages, and public receipts. Explain allowlisted hashes and false-positive
   adjudication without weakening scans.
9. Specify resource evidence for model bytes, staging, disk, quota, Companion
   memory, browser memory, WASM memory, startup, hashing, first token, throughput,
   KV growth, cancellation, recovery, process handles, logs, and timeouts.
10. Specify UI acceptance at desktop, narrow desktop, and mobile widths. Cover
    introductory-card removal, conversation workspace, fixed composer, long
    names, long output, scroll stability, cancellation, status truth, keyboard,
    screen readers, reduced motion, focus, errors, and screenshot redaction.
11. Define release gates for Rust, WASM, C ABI, C# wrapper, NuGet, `.snupkg`,
    native RID assets, self-contained Companion archives, MiniModel metadata,
    browser assets, product site, documentation sites, and marketing surfaces.
12. Define RID evidence for Windows x64, Linux x64, and Linux arm64. State the
    minimum acceptable level for each claim and forbid translating
    cross-compilation or emulation into real-hardware execution language.
13. Design supply-chain controls: pinned dependencies, lock files, source
    revision, package allowlist, native hashes, SBOM, provenance, signatures,
    key custody, revocation, archive traversal defense, SourceLink, symbols,
    malware boundaries, retention, and publication authorization.
14. Define one consistent version, release-date, update-log, and publication-
    log contract across every affected site. Each entry binds source commit,
    affected surfaces, tests, package or deployment identity, publication time,
    HTTPS readback, limitations, and rollback status.
15. Define living-documentation release ownership. Architecture decisions,
    contracts, security model, privacy statement, operator runbook, user help,
    package docs, model card, quality claim, known limitations, release notes,
    marketing, workspace memory, totem rules, and taboo rules must remain
    coherent. Stale docs are a failed release gate.
16. Design deployment from a clean source fetch through build, tests, secret
    scan, immutable output, staging readback, production publish, cache purge,
    public HTTPS readback, manifest comparison, source-control remote equality,
    and authorized rollback.
17. Define failure-to-regression workflow: preserve raw failure, classify model
    versus evaluator versus product defect, add a general failing test, make a
    clean scoped correction, rerun only invalidated phases, archive old
    evidence, update docs and memory, commit, push, fresh-fetch, and publish on
    green.
18. Produce a prioritized execution plan with coherent buildable commits,
    remote-equality proof, explicit blockers, honest partial progress, stop
    rules, and a final remaining-risk section. Completion may be claimed only
    when every required acceptance row has current objective evidence.

Required report structure:

1. Executive control-plane recommendation.
2. Phase, identity, and invalidation graph.
3. Receipt schema family and append-only history.
4. One-model objective acceptance matrix.
5. Clean-browser, UI, cancellation, and recovery proof.
6. Network, privacy, redaction, and resource proof.
7. Component, package, and RID release gates.
8. Supply-chain, signing, and publication controls.
9. Documentation, marketing, version, and log contract.
10. Deployment, HTTPS readback, and rollback algorithm.
11. Failure-to-regression workflow and prioritized plan.
12. Honest progress dashboard and remaining risks.
13. Unknowns requiring local or authorized production access.
14. Annotated primary-source bibliography with dates and direct links.

Do not count source popularity, structural conversion, unit tests, a fixture,
headless-only execution, local P2P, package creation, a mock, cross-compilation,
or a public plan as completed product evidence. Do not inflate campaign
counters, overwrite failures, publish stale documentation, invent deployment
success, retain legacy code, add compatibility debt, or claim public bytes
without HTTPS readback bound to the tested source commit.

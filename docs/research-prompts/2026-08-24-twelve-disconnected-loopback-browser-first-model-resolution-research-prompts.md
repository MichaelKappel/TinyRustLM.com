# Twelve Disconnected Research Prompts: Loopback, Browser, And First-Model Resolution

Each section below is a complete standalone assignment intended for a
different independent technical research agent. Send one whole section to one
agent. An agent must not be expected to have received this introduction, any
other prompt, or any private TinyRustLM material.

The assignments deliberately overlap at important trust boundaries while
asking for different professional perspectives. The goal is not twelve generic
tutorials. The goal is twelve exceptionally detailed, implementation-oriented
reports that can resolve current engineering decisions using public evidence.

## Prompt 1: Exact Kestrel HTTP/1.1 Parser Ownership And Raw-Wire Conformance

You are an independent principal HTTP implementation engineer, ASP.NET Core
Kestrel specialist, protocol-security reviewer, and adversarial test architect.
Produce an exceptionally detailed technical report that determines how to
build and verify one strict browser-to-loopback HTTP/1.1 listener without
claiming application control over malformed traffic that Kestrel rejects
before middleware executes.

You have internet access and may inspect public standards, official Microsoft
documentation, tagged ASP.NET Core source revisions, browser documentation,
security advisories, and public test suites. You have no access to the private
TinyRustLM source tree, branches, contracts, test output, machines, browser
profiles, credentials, model files, unpublished failures, or deployment
accounts. Treat every TinyRustLM detail below as a project-supplied design fact,
not as independently observed behavior. Do not state or imply that you built,
ran, inspected, fuzzed, or validated private code.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch product. There is no released predecessor,
  compatibility population, migration obligation, or permission to retain
  technical debt. Names such as SLM2, ACG2, Tokenizer2, Template2, Sampling2,
  Prompt2, schema identifiers, and protocol identifiers are technical contract
  identities, not product generations.
- A private per-user Companion is intended to use ASP.NET Core 8 Kestrel from
  `Microsoft.AspNetCore.App`. It must bind exactly one IPv4 numeric-loopback
  endpoint, `127.0.0.1`, on an operating-system-assigned port. HTTP/1.1 is the
  only admitted transport.
- IPv6, `localhost`, wildcard interfaces, LAN/public interfaces, fixed ports,
  reverse proxies, TLS termination, HTTP/2, HTTP/3, WebSockets, response
  compression, and a `Server` response header are outside the admitted first
  implementation.
- The only admitted browser authority is exact `Host: 127.0.0.1:{bound-port}`.
  The only admitted web origin is exact `https://tinyrustlm.com`. Missing,
  duplicated, alternate, development, opaque, `null`, or malformed Host and
  Origin values fail closed.
- The route set is closed and finite: pairing begin, pairing complete, session
  status, rotation begin, rotation commit, revocation, operation creation,
  operation status, operation cancellation, and one fixed artifact-chunk
  route family. Methods, request headers, media types, and body limits are
  route-specific allowlists.
- Valid CORS preflight returns status 204, zero body bytes, no Content-Length,
  no Content-Type, no credentials permission, no private-network permission,
  and no session proof. It mutates no pairing, session, sequence, or operation
  state. This follows RFC 9110's prohibition on Content-Length in a 204.
- Application-owned rejections require one bounded canonical JSON error and a
  stable status/code mapping. If a valid session authenticated the request,
  the error must consume the accepted sequence and carry a response proof.
  Invalid or unauthenticated requests carry no session proof.
- Kestrel-parser-owned failures occur before application dispatch. The
  candidate contract expects malformed request-line or HTTP/1.1 framing to
  produce 400, an over-limit request line to produce 414, header-count or
  header-byte excess to produce 431, and the global body limit to produce 413.
  Such responses are not required to contain the application's canonical JSON
  error or CORS headers, but must expose no server identity, session proof, raw
  secret, or reflected attacker bytes and must mutate no application state.
- Candidate listener bounds include a 2,048-byte request-line limit, 32 header
  fields, 16 KiB total request-header budget, 64 KiB global request-body
  ceiling, route-specific smaller bodies, bounded keep-alive/header/body
  timing, a connection cap, and `Connection: close` responses.
- A parser-owned response is diagnostic evidence only. It cannot satisfy a
  successful browser, model, publication, or campaign gate.
- MemoryEndpoints is unauthorized and disconnected for this assignment.

Research the exact behavior of the pinned .NET 8/Kestrel implementation and
the controlling HTTP, Fetch, and CORS standards. Prefer primary sources and
tagged source links over summaries. Record the version, tag or commit, source
publication/update date, and your retrieval date for every material claim.
Distinguish normative protocol requirements, documented Kestrel guarantees,
behavior inferred from source, behavior requiring an executable public
reproducer, and behavior that still requires local verification.

Address all of the following in depth:

1. Draw the complete inbound pipeline from TCP accept through Kestrel's
   HTTP/1 parser, request limits, connection features, hosting middleware,
   endpoint dispatch, response generation, and connection close. Mark every
   boundary where application code can no longer determine status, headers,
   body, logging, or state.
2. Identify the exact .NET 8 Kestrel options and feature interfaces controlling
   request-line length, total request headers, header count, body size,
   keep-alive timeout, request-header timeout, minimum request-body rate,
   maximum concurrent connections, synchronous I/O, HTTP protocols, endpoint
   binding, and server-header emission. State whether each option is enforced
   before or after middleware.
3. Audit exact parser behavior for origin-form, absolute-form, authority-form,
   and asterisk-form request targets; duplicate Host; absent Host; whitespace
   variants; illegal control bytes; non-ASCII octets; invalid percent escapes;
   fragments; encoded separators; dot segments; backslashes; and path
   normalization. Explain which raw target and decoded path APIs must be
   compared and why.
4. Analyze message framing attacks: duplicate Content-Length with equal or
   unequal values, comma-joined lengths, leading signs or zeros, overflow,
   Transfer-Encoding plus Content-Length, repeated Transfer-Encoding,
   unsupported transfer codings, malformed chunks, trailers, premature EOF,
   extra bytes, pipelined second requests, and request smuggling assumptions
   when there is intentionally no reverse proxy.
5. Determine whether the candidate exact parser-owned status mapping of 400,
   414, 431, and 413 is guaranteed by Kestrel 8, merely current behavior, or
   incorrect for any case. Provide tagged-source citations and a minimal raw
   TCP reproducer for every status class. Do not broaden an assertion simply
   to make an expected test pass.
6. Explain all circumstances in which Kestrel can emit HTML, plain text, an
   empty body, `Date`, `Server`, `Connection`, `Content-Length`, chunked
   framing, or other headers before application code runs. Specify which
   fields can be disabled, which are implementation-owned, and which must be
   treated as variable evidence.
7. Define an exact application-owned validation order for connection address,
   protocol, raw target, Host, Origin, route, method, header allowlist, Fetch
   Metadata, framing, media type, body length, strict UTF-8, strict canonical
   JSON, session authentication, and dispatch. Explain what information may be
   returned at each stage without creating an oracle.
8. Analyze CORS preflight under this closed protocol. Cover required and
   forbidden request headers, duplicate header handling, method matching,
   lowercasing and sorting of allowed headers, `Vary`, cache lifetime, 204
   framing, absence of credentials, explicit exposed response headers, and
   why preflight must be state-free.
9. Explain RFC 9110 Content-Length rules for 1xx, 204, CONNECT, HEAD, 304, and
   ordinary responses. Give concrete Kestrel response-writing guidance that
   produces zero body bytes on 204 while preserving exact Content-Length on
   normal bounded responses.
10. Design a mechanism proving parser-owned failures never reach route
    dispatch and mutate no pairing/session/operation state. Include monotonic
    counters or state snapshots that do not themselves become remotely useful
    endpoints.
11. Analyze request cancellation, half-close, slowloris behavior, timeout
    races, client disconnect during response, and application cancellation.
    State which exceptions and callbacks are expected and how to avoid turning
    disconnects into unhandled process failures.
12. Analyze concurrent requests on one session when the application protocol
    admits only one exact next sequence. Explain connection-level concurrency,
    pipeline behavior, request serialization, sequence reservation, and why an
    in-flight conflict must not deadlock the server.
13. Specify a raw-socket adversarial corpus with exact byte strings or
    generators for every parser and application boundary. Include positive
    controls, one-variable counterexamples, split writes, delayed writes,
    body truncation, oversized lines/headers/bodies, duplicate singleton
    headers, CL/TE ambiguity, invalid UTF-8, and post-body garbage.
14. Design property-based and coverage-guided fuzzing around Kestrel without
    replacing Kestrel with a custom HTTP parser. Define invariants, corpus
    retention, deterministic seeds, resource ceilings, crash triage, and
    regression minimization.
15. State which assertions are stable enough for exact tests and which must be
    version-bound observations. Define the evidence that must be regenerated
    after a .NET runtime or Kestrel servicing update.
16. Provide concrete C# 12/.NET 8 configuration and middleware sketches, raw
    TCP test pseudocode, and an acceptance matrix suitable for Windows and
    Linux. Code must be illustrative and source-independent.
17. Identify any candidate requirement that cannot be achieved reliably with
    Kestrel 8 under these constraints. Recommend one clean correction with no
    compatibility reader, proxy, second listener, or hidden fallback.

Required report structure:

1. Executive determination and explicit assumptions.
2. Version-pinned public source and standards ledger.
3. Kestrel parser-to-application ownership diagram.
4. Option and feature table with enforcement boundaries.
5. Request-target, header, and framing analysis.
6. Exact parser-owned status findings.
7. Application validation and dispatch algorithm.
8. CORS/preflight and 204 wire contract.
9. Timeout, disconnect, concurrency, and resource model.
10. Raw-socket corpus with expected results.
11. Fuzzing and failure-preservation plan.
12. Cross-platform executable test matrix.
13. Recommended corrections and implementation sequence.
14. Unknowns requiring private execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend a fixed port, wildcard bind, hostname bind, reverse proxy,
TLS fallback, HTTP/2, WebSocket bridge, bearer token, permissive CORS, custom
HTTP parser, legacy endpoint, response repair, or weakened test. Do not claim
that application middleware controls bytes rejected by Kestrel before
dispatch. Do not represent parser rejection as successful Companion proof.

## Prompt 2: Current Browser Access From Public HTTPS To A Numeric Loopback Companion

You are an independent principal browser-networking architect, Fetch/CORS
standards researcher, web-platform security engineer, and cross-browser test
lead. Produce an exceptionally detailed and current report determining whether
and how a page served from `https://tinyrustlm.com` can safely communicate with
an explicitly user-paired Companion at `http://127.0.0.1:{ephemeral-port}`.

You have internet access and may inspect current browser release notes,
standards, platform-status pages, browser source, official security guidance,
WPT tests, and public issue trackers. You have no access to TinyRustLM private
source, contracts, local browser profiles, test output, desktop binaries,
credentials, models, or deployment systems. Treat the details below as
project-supplied intended semantics, not proven behavior. Never claim that you
tested TinyRustLM or observed its private implementation.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch, clean-slate product with no legacy-support or
  migration requirement. SLM2 and similarly numbered names are technical
  identities, not a second product version.
- The browser UI is delivered from exact origin `https://tinyrustlm.com`.
  Prompts and model bytes must not be sent to the public site.
- A user-installed per-user Companion listens only on numeric IPv4 loopback
  `127.0.0.1` and an operating-system-selected port. The user transfers one
  short-lived, high-entropy pairing value into the page. The page does not
  scan ports or call an unauthenticated health route.
- The first transport is HTTP/1.1. There is no local TLS certificate, reverse
  proxy, `localhost` hostname, IPv6 endpoint, wildcard/LAN bind, fixed port,
  WebSocket, browser extension, custom URI scheme, or native-messaging bridge.
- Requests use exact Origin and Host checks, route-specific CORS preflight,
  explicit custom-header allowlists, no cookies, no HTTP authentication, no
  client certificates, and no `Access-Control-Allow-Credentials`.
- Preflight intentionally does not return
  `Access-Control-Allow-Private-Network`. Whether current browsers require a
  different standards-compliant design is an open research question; the
  report must answer it from current primary evidence rather than assuming
  either outcome.
- Session secrets remain only in browser memory. Browser refresh/profile
  deletion requires explicit re-pairing. The public application must fail
  honestly when the local browser/Companion path is unsupported.
- MemoryEndpoints is unauthorized and disconnected. No external hosted-memory
  route can be used as a transport fallback.

Research the web platform as it exists on the report retrieval date, not as it
worked in an old browser article. Record exact browser product/version,
feature-flag or trial state, platform, source date, and retrieval date. Prefer
WHATWG/W3C text, Chromium/Firefox/WebKit source and status pages, MDN only as a
secondary overview, and reproducible public test pages. Clearly label
normative rules, shipped behavior, experiments, enterprise-policy effects,
and unresolved implementation differences.

Address all of the following in depth:

1. Analyze secure-context and mixed-content rules for an HTTPS page fetching
   `http://127.0.0.1`. Distinguish loopback's potentially trustworthy origin
   treatment from ordinary HTTP private-network addresses, and explain any
   difference among fetch, navigation, workers, WebSockets, EventSource, and
   subresources.
2. Explain the historical Private Network Access proposal and the current
   Local Network Access direction, including preflight headers, permission
   prompts, target address-space declarations, rollout/rollback status,
   browser flags, origin trials, and current shipping plans. State precisely
   whether numeric loopback is included.
3. Build a current support matrix for stable Chrome, Edge, Firefox, and Safari
   on Windows, macOS, Linux, Android, and iOS where relevant. Include Chromium
   embedded variants only if they materially affect a downloadable desktop
   product. Mark supported, permission-gated, blocked, unimplemented, and
   requiring local verification.
4. Analyze DNS rebinding and why numeric `127.0.0.1` plus exact Host validation
   changes, but does not eliminate, the threat. Compare `localhost`, custom
   hostnames, mDNS, IPv6 loopback, and public DNS pointing to loopback without
   recommending them as hidden fallbacks.
5. Define exact CORS behavior for non-simple custom-header requests: Origin,
   Access-Control-Request-Method, Access-Control-Request-Headers, exposed
   response headers, credentials mode, preflight cache, redirects, response
   filtering, opaque failures, and how JavaScript observes network versus CORS
   failure.
6. Analyze Fetch Metadata request headers (`Sec-Fetch-Site`,
   `Sec-Fetch-Mode`, `Sec-Fetch-Dest`) for cross-origin loopback requests.
   State which are browser-controlled, when they may be absent, and whether a
   strict server can depend on them across the support matrix.
7. Determine the required production CSP, especially `connect-src`, for
   dynamic numeric-loopback ports. Analyze whether `http://127.0.0.1:*` or the
   applicable CSP syntax is valid and sufficiently narrow, and how CSP
   reporting could leak local endpoint details.
8. Analyze referrer, cookies, HSTS, HTTP cache, service workers, speculative
   connections, preconnect, password managers, proxy settings, VPNs,
   antivirus interception, enterprise policies, and browser extensions. State
   which could redirect, persist, disclose, or block local requests.
9. Evaluate the security and operational tradeoffs of local HTTPS, generated
   certificates, user trust installation, custom schemes, native messaging,
   browser extensions, WebTransport, and WebSockets solely as alternatives.
   Do not recommend an alternative unless it is strictly necessary; quantify
   its deployment and trust cost.
10. Specify a no-port-scan discovery and pairing UX in which the user supplies
    the exact ephemeral port and high-entropy secret. Analyze clipboard risks,
    typo behavior, expired values, browser autofill, URL history, screenshots,
    accessibility, and the distinction between explicit user intent and
    drive-by probing.
11. Define browser JavaScript error classification that never converts an
    opaque fetch/CORS/local-network denial into a false Companion or model
    success. Include offline site, absent process, wrong port, blocked local
    access, malformed response, invalid proof, timeout, and revoked session.
12. Design a public, source-independent conformance harness using a harmless
    local fixture server and a static HTTPS test page. Include test isolation,
    exact browser command lines, clean profiles, permissions reset, packet
    capture, expected preflights, negative origins, and proof that prompts or
    models are never uploaded.
13. Define the minimum real-browser matrix required before claiming production
    support. Separate Playwright's bundled Chromium, installed stable browsers,
    headed permission UX, mobile devices, and browser automation limitations.
14. Explain how deployment headers, service-worker caching, and a stale public
    page can invalidate an otherwise correct local protocol. Define public
    HTTPS readback and cache-bypass evidence.
15. Recommend a single clean production design under current browser behavior.
    If the supplied HTTP loopback design cannot work on a required browser,
    state that plainly and define the narrowest clean-slate contract change,
    without preserving the rejected path as legacy support.

Required report structure:

1. Executive compatibility determination as of the retrieval date.
2. Normative standards and browser-shipping timeline.
3. Secure-context and mixed-content analysis.
4. Private/Local Network Access analysis.
5. Browser/platform support matrix.
6. CORS, Fetch Metadata, CSP, and response visibility contract.
7. DNS-rebinding and same-machine threat model.
8. Pairing UX and browser secret-boundary recommendations.
9. Failure/status vocabulary for the product UI.
10. Reproducible public test harness.
11. Required real-browser acceptance matrix.
12. Clean production recommendation and rejected alternatives.
13. Unknowns requiring local or deployed-site verification.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend silent port scanning, permissive CORS, wildcard origins,
cookies, bearer authentication, public relays, prompt upload, model upload,
fixed ports, browser fingerprinting, an undocumented browser flag, or a stale
compatibility branch. Do not call a Playwright fixture proof of stable browser
support. Do not invent the state of Local Network Access; verify it from
current primary sources.

## Prompt 3: Formal Cryptographic Audit Of Pairing, Session Proofs, Rotation, And Revocation

You are an independent principal applied cryptographer, protocol-verification
engineer, browser key-custody specialist, and secure-channel red-team lead.
Produce an exceptionally detailed, adversarial report assessing a candidate
capability protocol between a public browser application and a per-user
numeric-loopback Companion. The result must either validate the protocol
design assumptions or identify exact clean-slate changes before deployment.

You may inspect public cryptographic standards, formal-method papers, official
Web Crypto and .NET cryptography documentation, public protocol analyses, and
well-reviewed implementations. You have no access to TinyRustLM private source,
test vectors, credentials, pairing values, binaries, models, logs, or machines.
All protocol details below are project-supplied candidate facts, not evidence
that an implementation exists or is correct. Never claim private code review,
execution, penetration testing, or production validation.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one clean-slate prelaunch product. No deployed predecessor,
  compatibility behavior, migration path, weak fallback, or technical debt
  needs to be preserved. Numbered protocol and artifact names are exact
  technical identities rather than product versions.
- The trusted user explicitly transfers a one-time value of the form
  `TRLC1:{ephemeral-port}:{base64url-secret}` from the local Companion into
  `https://tinyrustlm.com`. The secret contains 256 random bits and expires
  after five minutes. It is not a human-memorable low-entropy PIN.
- Pairing begin binds a random claim ID and 256-bit browser nonce. The
  Companion returns a random server nonce, random session ID, installation
  identity, process-instance identity, exact numeric Host, exact production
  Origin, initial key epoch, expirations, and a server proof under the pairing
  secret.
- The browser derives a session key using HKDF-SHA-256 over the pairing secret
  and complete domain-separated transcript, verifies the server proof, and
  sends a browser completion proof. The Companion returns a completion proof.
  The one-time pairing authority is then consumed.
- Subsequent requests use HMAC-SHA-256 proofs over a canonical domain-separated
  context including protocol ID, installation ID, process ID, session ID,
  key epoch, exact Host, exact Origin, method, raw route, monotonically
  increasing sequence, request body length, and request body SHA-256.
- Responses are separately HMAC-proven and bind request identity, status,
  response body length/hash, and a canonical hash of relevant response
  metadata. Artifact responses additionally bind artifact identity, role,
  length/hash, chunk index/count/offset/length, and response content hash.
- Only one request may be in flight per session. The exact next sequence is
  accepted atomically after all pre-authentication checks and a valid request
  proof. Authenticated application errors consume that sequence and are
  response-proven. Parser-owned and unauthenticated failures are not proven.
- Candidate lifetimes are: pairing display 300 seconds, pending pairing 30
  seconds, completion replay 60 seconds, session absolute 8 hours, session idle
  15 minutes, key epoch 15 minutes, pending rotation 120 seconds, and exact
  rotation-commit replay 30 seconds. At most four pending pairings and four
  active sessions exist per process.
- Rotation is an authenticated two-step challenge/commit. Old and new keys
  prove the transition; a lost successful commit response may be recovered by
  exact replay for a bounded interval. Revocation is authenticated, terminal,
  and response-proven. Revoked/expired keys cannot silently re-pair.
- Browser session keys exist only in JavaScript memory. They are not stored in
  localStorage, sessionStorage, IndexedDB, Cache Storage, OPFS, service-worker
  state, URLs, logs, analytics, screenshots, or reports.
- The Companion binds only `127.0.0.1` and accepts only exact origin
  `https://tinyrustlm.com`. There are no cookies, bearer tokens, client
  certificates, remote relay, browser extension, or MemoryEndpoints fallback.

Research the construction against current primary standards and literature.
Record algorithms, parameter sizes, publication/update dates, immutable source
revisions where used, and retrieval date. Clearly distinguish a standard
security property, an argument about this supplied design, a proposed proof,
and facts requiring implementation or production verification.

Address all of the following in depth:

1. Define the threat model: malicious websites, compromised third-party script
   on the allowed origin, DNS rebinding, same-machine unprivileged processes,
   local administrators, browser extensions, malware, clipboard observers,
   shoulder surfing, crash dumps, swap, stale tabs, multiple tabs, replay,
   reordering, truncation, concurrency, and malicious model artifacts. State
   which threats can and cannot be addressed by a loopback capability.
2. Analyze whether a 256-bit user-transferred secret requires a PAKE. Compare
   the supplied transcript to SPAKE2, OPAQUE, Noise patterns, channel binding,
   and simple proof-of-possession. Explain precisely when an offline guessing
   attack exists and why conclusions for a six-digit PIN do not automatically
   apply to a 256-bit secret.
3. Specify exact HKDF extract/expand inputs, salt rules, info domains, transcript
   encoding, and output lengths. Identify risks from omitted fields,
   ambiguous concatenation, Unicode, case normalization, decimal encoding,
   alternate Base64 encodings, or reuse across pairing, request, response, and
   rotation domains.
4. Audit HMAC request and response constructions for reflection, cross-protocol
   substitution, chosen-message attacks, body/header substitution, status
   substitution, route aliasing, method confusion, and length-extension
   misconceptions. State what must be encoded as raw bytes versus parsed
   semantic values.
5. Analyze one-at-a-time sequence semantics, atomic acceptance, authenticated
   error consumption, lost response, retry, browser crash, timeout uncertainty,
   and simultaneous requests. Define a state machine that never permits
   best-effort sequence guessing or retry with a changed body.
6. Audit the pairing replay and tombstone model. Cover duplicate begin with the
   same or changed body, duplicate complete, completion-response loss, reuse of
   the pairing value by a second browser, expiration races, resource limits,
   and ten-way concurrent claims.
7. Audit key rotation under every message-loss and crash boundary. Define old
   key, pending key, new key, epochs, challenge nonces, commit identity,
   completion proof, replay cache, and zeroization. Prove or refute that exactly
   one epoch becomes authoritative.
8. Audit revocation and expiration. Cover in-flight requests, late responses,
   rotation/revocation races, process restart, browser sleep, clock rollback,
   monotonic versus wall clock, tombstone retention, and whether a new process
   instance invalidates every old session by construction.
9. Analyze memory handling in .NET and browsers: managed byte arrays,
   `CryptographicOperations.ZeroMemory`, copies made by JSON/Base64/Web Crypto,
   JavaScript garbage collection, structured clone, devtools, exception
   messages, crash reporting, and realistic limits of claiming zeroization.
10. Define constant-time comparison requirements and side-channel boundaries.
    Include proof lengths, decoding failures, timing oracles, error-code
    granularity, rate limits, CPU exhaustion, and uniform treatment of unknown
    sessions.
11. Define canonical transcript and wire encodings with strict UTF-8, no BOM,
    exact property order where applicable, shortest unsigned decimal, lowercase
    hexadecimal hashes, unpadded Base64url, duplicate-key rejection, maximum
    lengths, and domain labels. Explain how to avoid depending on default JSON
    serialization.
12. Provide language-independent test vectors and pseudocode, plus illustrative
    C# and Web Crypto implementations for HKDF, HMAC, transcript construction,
    request proof, response proof, rotation, and constant-time verification.
    Vectors must contain synthetic public values only.
13. Propose a formal model in TLA+, PlusCal, ProVerif, Tamarin, or another
    justified tool. Define safety and liveness properties for one-time pairing,
    sequence uniqueness, response authenticity, epoch monotonicity, revocation,
    and absence of unauthorized operation dispatch.
14. Design negative and metamorphic tests: altered host/origin/method/route,
    changed body byte, reordered JSON, alternate hash case, sequence gaps,
    replay, mixed epoch, swapped response metadata, truncated chunks, stale
    process ID, and concurrent commit/revoke.
15. Give a go/no-go conclusion. List every property established by design,
    every needed correction, every implementation proof, and every residual
    risk that must remain explicit to users and release operators.

Required report structure:

1. Executive cryptographic verdict and assumptions.
2. Threat actors, trust boundaries, and out-of-scope powers.
3. Primitive and parameter review.
4. Canonical transcript specification.
5. Pairing security analysis and state machine.
6. Request/response proof and sequence analysis.
7. Rotation, lost-response, and revocation analysis.
8. Browser and managed-memory custody limits.
9. Formal model and stated properties.
10. Cross-language public test vectors.
11. Adversarial test matrix.
12. Required design corrections and implementation gates.
13. Residual risks and unknown private facts.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend a low-entropy PIN, bearer token, cookie, URL query secret,
persistent browser key, permissive origin, silent retry, sequence resynchronizing
guess, weak compatibility mode, or invented encryption claim. Do not call
HMAC encryption. Do not claim JavaScript secrets can be perfectly zeroized.
Do not declare the protocol secure merely because it uses standard primitives.

## Prompt 4: Secure Per-User Companion Host, Startup, Discovery, And Distribution

You are an independent principal desktop-host architect, Windows and Linux
process-lifecycle engineer, least-privilege installation specialist, and secure
software-distribution reviewer. Produce an exceptionally detailed report for a
private per-user Companion that becomes ready only after exact numeric-loopback
binding and reveals one short-lived pairing value only through an explicit
interactive user-presence surface.

You may research public operating-system documentation, .NET 8 hosting and
deployment guidance, Windows service/task/process APIs, systemd user services,
filesystem permissions, code-signing systems, package formats, and supply-chain
standards. You have no access to TinyRustLM source, binaries, machines, signing
keys, deployment accounts, logs, model files, or tests. Treat the requirements
below as project-supplied design constraints, not observed implementation.
Never claim to have installed, launched, inspected, signed, or validated a
private Companion.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch clean-slate product. No previous operational host
  or compatibility path must survive. Technical `/1`, `/2`, SLM2, and ACG2
  names are exact protocol/schema identities, not product release generations.
- The downloadable Companion is the sole local operational host for model
  acquisition, deterministic conversion, direct P2P preparation, and transfer
  to the browser. The website remains the chat UI.
- The candidate host uses .NET 8/Kestrel for a strict HTTP/1.1 control surface
  and invokes canonical Rust functionality rather than reimplementing model
  conversion in managed code.
- It binds only `127.0.0.1` on operating-system port zero. Readiness is false
  until exactly one numeric-loopback endpoint is successfully bound and the
  capability state has been created for that exact port and process instance.
- There is no fixed port, public/LAN bind, IPv6 listener, hostname listener,
  unauthenticated health route, port scan, reverse proxy, TLS certificate,
  browser extension, custom protocol handler, or MemoryEndpoints fallback.
- A pairing display value contains protocol label, bound port, and a 256-bit
  random secret. It may be issued only after bind, expires after five minutes,
  and must never appear in process arguments, environment variables, durable
  configuration, ordinary logs, telemetry, crash reports, shell history,
  redirected stdout/stderr, screenshots, or release receipts.
- A durable installation record may contain a nonsecret random installation
  identity. A process-instance identity is fresh for each start. Session keys
  are process-local and disappear on exit.
- The first required release targets are `win-x64`, `linux-x64`, and
  `linux-arm64`. Cross-compilation alone is not real ARM64 execution proof.
- The process must run without administrator/root privileges and must not
  silently change firewall, router, proxy, certificate, browser, or machine
  security settings.

Research primary operating-system and framework sources. Record exact version,
publication/update date, and retrieval date. Clearly separate documented
guarantees, recommended architecture, platform-specific behavior, and facts
requiring physical-machine or signed-package verification.

Address all of the following in depth:

1. Define process roles and trust boundaries for launcher, interactive pairing
   surface, Kestrel listener, capability state, operation controller, Rust
   child converter, shared artifact store, update mechanism, and browser.
   Recommend whether these belong in one process or multiple processes and
   justify the smallest trustworthy design.
2. Specify exact startup ordering from executable identity verification through
   per-user root validation, installation record load/create, exclusive process
   ownership, port-zero bind, endpoint inspection, capability-state creation,
   readiness, and user-requested pairing display. Define rollback at every
   failed step.
3. Design single-instance ownership per OS user without trusting a PID or stale
   lock-file timestamp. Compare Windows named mutexes, locked file handles,
   job objects, Unix advisory locks, PID files, abstract sockets, and systemd
   ownership. Cover abandoned owners and simultaneous starts.
4. Define per-user filesystem roots and permissions on Windows and Linux.
   Address ACL inheritance, umask, symlinks, junctions, reparse points, hard
   links, mount substitution, roaming profiles, network shares, case folding,
   long paths, and multi-user machines.
5. Design the interactive pairing surface. Compare console, tray UI, minimal
   native window, and browser-independent local UI. Cover redirected handles,
   screen readers, clipboard opt-in, timeout, regeneration, shoulder surfing,
   remote desktop, terminal scrollback, and headless systems. Choose one clean
   first-release behavior.
6. Explain how the public page learns the exact port without scanning and why
   no durable discovery endpoint is needed. Define parsing, validation,
   expiration, typo, wrong-process, stale-code, and copy/paste behavior.
7. Design process-tree ownership for the canonical Rust converter. Cover
   Windows job objects and kill-on-close, Linux process groups/cgroups/systemd
   scopes, inherited handles, stdout/stderr capture without secrets, child
   executable identity, cancellation, parent crash, and startup reconciliation.
8. Define shutdown and drain semantics for Ctrl+C, window close, logoff,
   session end, OS shutdown, update, process crash, and forced termination.
   State which in-flight state is durable and which capabilities become
   invalid immediately.
9. Analyze Windows service, scheduled task, startup app, tray app, systemd
   system service, and systemd user service options. Account for interactive
   user presence, per-user secret isolation, unattended model sharing, and the
   rule against administrative installation side effects.
10. Define logging and diagnostics that are useful but provably secret-free.
    Include structured allowlists, bounded error codes, event IDs, redaction
    tests, ETW/journald behavior, stdout/stderr, crash dumps, support bundles,
    retention, and explicit user export.
11. Design self-contained and framework-dependent distribution for all three
    RIDs. Cover native Rust assets, content hashes, executable permissions,
    quarantine bits, code signing, notarization only if relevant, symbols,
    SBOM, provenance, malware scanning, archive traversal, and package
    allowlists.
12. Specify update semantics for a prelaunch clean-slate product. An update may
    replace the whole host contract and invalidate sessions, but it must not
    leave two listeners, two converters, an old compatibility reader, or a
    partially replaced executable graph. Cover rollback only as last-known-good
    artifact restoration, not legacy behavior.
13. Define multi-user and remote-session isolation tests. Include two OS users,
    fast user switching, concurrent RDP sessions, root/administrator observation,
    copied pairing values, changed home directory, and a hostile unprivileged
    local process.
14. Define release evidence for bind identity, no non-loopback sockets, no
    secret leakage, process supervision, graceful drain, crash recovery,
    package integrity, real RID execution, and public download readback.
15. Provide implementation-oriented C#/.NET and OS API pseudocode, an exact
    startup state machine, a fault matrix, and a staged backlog with objective
    acceptance criteria.

Required report structure:

1. Executive host architecture and assumptions.
2. Process/trust-boundary diagram.
3. Startup, readiness, pairing, and shutdown state machines.
4. Single-instance and multi-user ownership model.
5. Filesystem root and permission contract.
6. User-presence pairing UX specification.
7. Child-process supervision and recovery.
8. Windows deployment and lifecycle plan.
9. Linux x64/ARM64 deployment and lifecycle plan.
10. Secret-free diagnostics contract.
11. Supply-chain, signing, and update controls.
12. Adversarial and physical-machine test matrix.
13. Prioritized clean-slate implementation plan.
14. Unknowns requiring private or signed-package proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend administrative execution, fixed ports, wildcard binds,
firewall modification, router automation, persistent pairing secrets, command
line secrets, environment-variable secrets, log redaction after collection,
port scanning, multiple operational hosts, or a compatibility launcher. Do not
count a packaged archive, cross-compile, or unit test as real platform proof.

## Prompt 5: Memory-Only Browser Capability Client And Exactly-Once Request Ownership

You are an independent principal browser-runtime engineer, JavaScript
cryptography implementer, concurrency/state-machine specialist, and client-side
security tester. Produce an exceptionally detailed implementation report for a
browser client that pairs with a local Companion, keeps all capability secrets
only in memory, sends exactly one authenticated request at a time, verifies
every authenticated response before use, and fails closed across reload,
cancellation, tab duplication, and process restart.

You may inspect public ECMAScript, Web Crypto, Fetch, HTML lifecycle, Page
Lifecycle, Web Locks, AbortController, CSP, Trusted Types, and browser testing
documentation. You have no access to private TinyRustLM source, web assets,
tests, profiles, credentials, models, receipts, or deployment accounts. Treat
the requirements below as project-supplied intended behavior, not as proof of
an existing implementation. Do not state that you inspected or executed
TinyRustLM.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch clean-slate product. There is no public legacy
  client, compatibility behavior, migration, alias, or fallback to preserve.
  Numbered names identify exact technical contracts.
- The top-level page at exact origin `https://tinyrustlm.com` owns explicit
  connection and pairing. A user supplies
  `TRLC1:{numeric-port}:{256-bit-base64url-secret}` after asking the local
  Companion to display it. The value is never placed in a URL.
- The browser uses `fetch` with CORS mode, omitted credentials, `no-store`
  cache, redirect error, no referrer, no keepalive, exact
  `http://127.0.0.1:{port}`, and route-specific methods and headers.
- Pairing uses strict canonical JSON, nonces, HKDF-SHA-256, HMAC-SHA-256, and
  mutual transcript proofs. Subsequent requests and responses are
  domain-separated and proof-bound to session, epoch, exact sequence, Host,
  Origin, method, route, body length/hash, status, response content, and
  relevant response metadata.
- Only one request may be in flight per session. The browser sends exactly the
  next sequence. A valid authenticated application response, including a
  response-proven error, consumes that sequence. A transport/CORS/parser
  failure may leave completion uncertain and must not trigger a guessed retry.
- The session has absolute and idle expiration, bounded key epochs, explicit
  two-step rotation, bounded exact commit replay, and explicit revocation.
- Pairing secrets and session keys must not enter localStorage, sessionStorage,
  IndexedDB, Cache Storage, OPFS, File System Access files, service-worker
  state, BroadcastChannel, SharedWorker, URLs, console output, analytics,
  traces, screenshots, exception messages, or reports. Refresh, tab close,
  browser restart, profile deletion, or Companion restart requires re-pairing.
- Nonsecret operation IDs and content identities may be stored for resumable
  artifact acquisition, but they must never be treated as authority.
- The completed cutover has one browser client. No old bridge global, fixed
  port, health probe, bearer header, alternate protocol, or compatibility
  adapter remains.
- MemoryEndpoints is unauthorized and disconnected.

Research primary standards and current browser behavior. Record specification
and browser versions, publication/update dates, and retrieval date. Clearly
separate normative behavior, browser-specific behavior, architectural
recommendation, and facts requiring real-browser validation.

Address all of the following in depth:

1. Define the complete client state machine from disconnected through pairing
   input, parsed secret, pairing begin, server-proof verification, pairing
   complete, connected, request in flight, rotating, revoked, expired,
   uncertain outcome, and disconnected. List legal events and transitions and
   make every illegal transition fail closed.
2. Define data ownership for port, installation/process identity, pairing
   secret, nonces, transcript, session key, epoch, next sequence, pending
   request, operation ID, and artifact-resume metadata. Specify exact lifetime,
   mutability, visibility, and zeroization limitations for each value.
3. Specify strict parsing of the pairing value: ASCII only, exact label,
   shortest decimal port, admitted port range, unpadded canonical Base64url,
   exactly 32 decoded secret bytes, no surrounding hidden characters, no
   Unicode normalization, bounded input, and immediate DOM clearing.
4. Provide exact browser-side transcript, SHA-256, HKDF, HMAC, Base64url,
   hexadecimal, canonical unsigned-decimal, strict UTF-8, and constant-time
   comparison routines. Explain Web Crypto key extractability, `CryptoKey`
   lifetime, ArrayBuffer copies, and why serializer defaults are unsafe.
5. Design one-request-at-a-time ownership without persisting a mutex or
   sequence. Compare a closure-owned promise chain, explicit state machine,
   async mutex, dedicated worker, Web Locks, and UI disabling. Account for
   reentrancy, double click, React-style remounts even if no framework is used,
   event replay, and exceptions between reservation and fetch.
6. Define the exact sequence commit rule on the browser. Cover verified success,
   verified authenticated error, invalid response proof, response truncation,
   fetch rejection, timeout, AbortController cancellation, tab close, and
   ambiguous loss after the server may have committed.
7. Specify response verification order: HTTP/CORS visibility, singleton headers,
   bounded Content-Length, media type, complete body read, content hash,
   metadata hash, response proof, strict JSON, schema, semantic constraints,
   and only then state mutation or UI rendering. Explain why parsing before
   authentication can still be safe only under strict limits and no action.
8. Design rotation and commit-replay behavior in the browser. Cover pending old
   and new keys, challenge verification, lost commit response, exact replay,
   replay-window expiry, old-key rejection, new-key activation, page suspension,
   and cancellation. Do not permit heuristic epoch probing.
9. Define revocation UX and semantics. The client must materialize and verify
   the terminal response before erasing its key, prevent later actions, clear
   sensitive DOM state, and not advertise disconnection as proof that server
   revocation succeeded if the response was lost.
10. Analyze tab duplication, `window.open`, same-origin iframes, BFCache,
    prerendering, page freeze/resume, visibility changes, navigation, devtools,
    extensions, service workers, SharedWorkers, BroadcastChannel, and
    structured clone. Define hard controls preventing secret propagation.
11. Analyze XSS and supply-chain risk because allowed-origin script can use an
    in-memory capability. Specify CSP, Trusted Types, dependency minimization,
    Subresource Integrity where applicable, build pinning, no third-party
    analytics, DOM injection rules, and release asset hashing.
12. Define error vocabulary that distinguishes user action required,
    permission denied, Companion unavailable, pairing expired, proof invalid,
    session expired, revoked, uncertain request outcome, operation rejection,
    storage failure, and unsupported browser without exposing sensitive
    protocol detail.
13. Design deterministic unit tests using public synthetic vectors and real
    browser tests against a harmless fixture. Include altered bytes, duplicate
    headers, wrong content length, wrong proof, stale epoch, sequence replay,
    concurrent UI actions, abort at every await, BFCache, reload, two tabs, and
    secret scanning of all browser stores and artifacts.
14. Define a static or dynamic taint-style secret scanner for DOM, console,
    error objects, storage, traces, screenshots, URLs, requests, referrers,
    service-worker caches, heap snapshots where practical, UTF-8/UTF-16, and
    Base64 representations. Discuss false positives and the limits of heap
    inspection.
15. Provide source-independent modern JavaScript/TypeScript pseudocode and a
    staged implementation sequence that deletes the old browser bridge only
    when the sole new client and all real-browser tests pass.

Required report structure:

1. Executive client architecture and assumptions.
2. Complete state/event/transition table.
3. Secret and nonsecret data-ownership ledger.
4. Canonical cryptographic encoding specification.
5. Pairing implementation algorithm.
6. Exactly-once request and sequence algorithm.
7. Response verification and error handling.
8. Rotation, replay recovery, and revocation.
9. Browser lifecycle and multi-context threat analysis.
10. XSS and web supply-chain controls.
11. Unit, vector, and real-browser test matrices.
12. Secret-scanning protocol.
13. Clean cutover implementation plan.
14. Unknowns requiring private browser execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend browser persistence of authority, a service-worker secret,
BroadcastChannel key sharing, a bearer token, an automatic retry with a new
sequence, best-of-N response selection, hidden fallback transport, permissive
CORS, or keeping an old bridge beside the new client. Do not promise perfect
JavaScript memory zeroization. Do not treat a fetch response as trusted before
its complete proof has been independently verified.

## Prompt 6: Authenticated Operation API Over A Crash-Consistent Companion Journal

You are an independent principal transaction-systems architect, durable
workflow engineer, Rust/.NET process-integration specialist, and API
idempotency reviewer. Produce an exceptionally detailed report specifying how
an authenticated loopback operation API should project one crash-consistent,
append-only Companion journal for either verified P2P acquisition or canonical
source conversion, without exposing local paths or inventing successful work.

You may inspect public database, filesystem, process-supervision, HTTP
idempotency, Rust, .NET, Windows, and Linux documentation. You have no access
to TinyRustLM private source, operation records, artifacts, tests, machines,
credentials, catalog state, peers, or model files. Treat all details below as
project-supplied requirements. Never claim that you inspected, ran, or
validated the private operation controller.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch clean-slate product. There is no legacy operation
  schema, compatibility reader, migration, alias, fallback, or debt to retain.
  SLM2/ACG2 and other numbered names are exact contract identities.
- The product behavior is P2P first when an exact, verified complete composition
  is available. Otherwise the Companion starts a canonical source-acquisition
  and conversion operation after explicit user approval. It must never respond
  by downloading instruction `.txt`, `.ps1`, or `.json` files for the user to
  run manually.
- One logical operation chooses exactly one branch: verified P2P import or
  source conversion. A branch cannot silently change after execution begins.
- Source conversion invokes one canonical Rust child command using immutable
  source locks and a pinned conversion profile. The child creates a previously
  absent terminal root containing exactly six role-ordered artifacts:
  composition/ACG2, model/SLM2, Tokenizer2, Template2, Sampling2, and Prompt2.
- The parent owns a create-only, append-only operation journal and independently
  verifies child terminal evidence. A terminal pass and rejection are mutually
  exclusive. Interrupted, rejected, obsolete, or tampered evidence is
  preserved and never overwritten, repaired into success, or silently retried.
- The loopback API has authenticated create, read, and cancel routes. Requests
  and responses are proof-bound and strictly sequenced. A lost mutation
  response is recovered by reading the same deterministic operation identity,
  never by creating a second logical operation.
- A bounded operation projection contains schema, operation ID, journal
  sequence, state, selected branch, completed bytes, optional total bytes,
  optional exact six-artifact metadata, and optional stable error code. It
  contains no prompts, source URL, private path, credential, invitation, raw
  child output, or arbitrary exception text.
- Artifact availability is projected only from a validated terminal journal
  state. Structural conversion output is not model-quality qualification.
- MemoryEndpoints is unauthorized and disconnected. No fixture, mock peer,
  child exit code, or local structural test is a live model or campaign pass.

Research durable workflow and process-boundary patterns using primary sources.
Record versions, publication/update dates, and retrieval date. Separate
normative guarantees, architecture recommendations, and facts requiring local
or power-failure validation.

Address all of the following in depth:

1. Define all identities: immutable create-request bytes/hash, logical operation
   ID, branch, attempt ID, idempotency ID, cancellation ID, source locks,
   catalog/composition identity, converter executable/profile identity, child
   launch nonce, output root, terminal receipt, journal sequence, and six
   artifact identities. State which are content-addressed and which are random.
2. Define a complete state machine covering requested, branch selected,
   acquiring, verifying source or pieces, converting, verifying composition,
   available, rejected, cancelled before irreversible work, interrupted,
   externally blocked, and tampered. Specify legal transitions, terminal
   states, retry rules, and projection values.
3. Compare a filesystem append journal, SQLite WAL with full durability,
   transactional outbox, event log, and hybrid child commit marker. Choose one
   architecture that works on Windows and Linux without pretending a database
   and model directory can commit atomically.
4. Specify create idempotency. Cover exact replay, same ID with changed bytes,
   lost successful response, two concurrent creates, duplicate browser clicks,
   process restart, and branch-selection drift. The same logical request must
   never create two operations.
5. Define the P2P branch gates: immutable catalog record, exact composition ID,
   piece set, peer proof, per-piece hash, resume journal, quarantine, complete
   artifact verification, final Rust validation, license/provenance closure,
   and terminal promotion. State how peer loss differs from model rejection.
6. Define the source-conversion branch gates: source revision lock, file list,
   ETags/content hashes, license record, safe acquisition, streamed hashing,
   child request, create-only output, child terminal evidence, parent
   independent verification, and availability.
7. Enumerate parent/child crash boundaries before launch, during acquisition,
   during every output file, after terminal child commit, before child exit,
   after exit, during parent verification, and during journal append. Give the
   only legal recovery action at each boundary.
8. Design startup reconciliation without trusting PID, mtime, zero exit code,
   stdout, directory existence, or path names. Include exclusive ownership,
   running-child detection, process-instance/launch identity, bounded scanning,
   symlink/reparse rejection, and foreign/tampered roots.
9. Define cancellation semantics and idempotency. Cover cancel before branch
   selection, during download, during child conversion, after durable child
   pass, during parent verification, after availability, and a lost cancel
   response. Explain why late cancellation cannot relabel valid durable success.
10. Specify the operation projection serializer: strict UTF-8, exact property
    order, duplicate/unknown-field rejection, shortest decimals, maximum size,
    nullable-field rules, enum closure, six-artifact role order, and canonical
    content hash. Provide bounded examples for every state.
11. Define stable public-safe errors and status mapping for not found, terminal,
    unavailable, branch blocked, source drift, license ambiguity, unsupported
    architecture, conversion rejection, tamper, disk full, resource limit,
    cancellation conflict, and internal failure. Do not leak private paths.
12. Explain how the authenticated sequence commits relative to API validation
    and journal action. An authenticated application rejection consumes the
    request sequence; a mutation journal failure produces a proven failure or
    uncertain outcome but never a fabricated projection.
13. Define progress accounting using streamed verified bytes and monotonic
    journal facts. Analyze unknown totals, source servers without lengths,
    piece retries, conversion phases without byte progress, and avoiding
    percentages that move backward or imply success.
14. Design deterministic fault injection for power loss, disk full, short
    write, failed fsync, antivirus lock, replaced child executable, altered
    source lock, corrupted piece, duplicate parent, child orphan, journal tail
    damage, and cancellation at every boundary.
15. Provide language-neutral algorithms plus illustrative C# and Rust boundary
    contracts. Include startup reconciliation, child launch ownership,
    compare-and-append, canonical projection, and explicit cleanup that never
    deletes historical terminal evidence.
16. Define objective acceptance evidence and a staged implementation backlog.
    Separate CI, real filesystem/process execution, destructive power testing,
    real P2P, real source acquisition, model quality, and browser proof.

Required report structure:

1. Executive architecture and assumptions.
2. Identity and trust ledger.
3. Complete operation state/transition table.
4. Selected journal and durability model.
5. P2P branch transaction.
6. Source-conversion branch transaction.
7. Parent/child crash and reconciliation matrix.
8. API idempotency, cancellation, and sequencing.
9. Canonical operation projection schemas.
10. Error and blocker taxonomy.
11. Fault-injection and cross-platform tests.
12. Implementation pseudocode and boundary APIs.
13. Acceptance evidence and prioritized backlog.
14. Unknowns requiring private or authorized execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend instruction downloads, shell scripts as product UX, mutable
terminal receipts, retry-selected success, branch switching, PID/mtime success
inference, child-exit-code promotion, local-path projection, compatibility
readers, or one boolean `passed`. Do not count structural output as semantic
model quality or a mock peer as real P2P availability.

## Prompt 7: Authenticated Six-Artifact Streaming, Resume, And Identity Closure

You are an independent principal streaming-protocol engineer, browser I/O and
backpressure specialist, content-addressed storage architect, and hostile-file
transfer reviewer. Produce an exceptionally detailed report specifying a
bounded authenticated transfer of one complete TinyRustLM composition from a
local Companion into browser-owned storage without whole-file buffering,
arbitrary file access, best-chunk selection, or partial activation.

You may inspect public HTTP, Fetch streams, Web Crypto, browser file/storage,
.NET streaming, Rust hashing, and content-addressed transfer literature. You
have no access to TinyRustLM source, artifacts, manifests, private paths,
profiles, tests, models, peers, or credentials. Treat the contract below as
project-supplied candidate semantics, not verified implementation. Do not
claim private transfer execution or model validation.

Project facts and constraints supplied for this assignment:

- TinyRustLM is a clean-slate prelaunch product with no legacy transfer route,
  migration, alias, fallback, or compatibility reader to preserve. Numbered
  artifact/protocol names are exact technical identities.
- A composition is complete only when it contains exactly six artifacts in
  this order: `composition` (ACG2), `model` (SLM2), `tokenizer` (Tokenizer2),
  `template` (Template2), `sampling` (Sampling2), and `prompt` (Prompt2).
- The authenticated operation projection exposes for each role only an
  artifact ID, lowercase SHA-256, byte count, and chunk count. It exposes no
  local path or source URL.
- Chunks are fixed at 4,194,304 bytes except the final positive remainder.
  Chunk count is ceiling(byteCount / 4,194,304), with at most 16,384 chunks per
  artifact. Candidate ceilings are 64 GiB per artifact and 68 GiB for a whole
  composition, even though the first real model is expected to be much smaller.
- A chunk is requested by exact operation ID, closed artifact role, and
  shortest unsigned decimal chunk index. Range, multipart, HEAD, arbitrary
  offset/length, path, filename, and user-supplied filesystem selectors are
  forbidden.
- Every response binds operation, artifact role/ID/full hash/full byte count,
  chunk index/count/offset/length, chunk content hash, response status, and
  response body hash into canonical response metadata and an authenticated
  response proof. The browser verifies all of it.
- The Companion resolves bytes only from a validated journal artifact identity,
  requires a regular direct non-reparse file, rehashes the whole artifact
  before first chunk, and rechecks artifact identity after the last chunk.
- The browser hashes every chunk and the completed artifact. Resume means
  request the next missing already-determined chunk under the identical
  operation and artifact identity. Retry selection, parallel best-of-N chunks,
  partial activation, and identity drift are forbidden.
- All six independently verified artifacts are required before one atomic
  browser composition activation. Model bytes and prompts never traverse the
  public TinyRustLM site.
- Session proofs and secrets are browser-memory-only. MemoryEndpoints is
  unauthorized and disconnected.

Research current primary documentation and standards. Record versions,
publication/update dates, and retrieval date. Separate protocol guarantees,
framework/browser behavior, recommended implementation, and facts requiring
large-file or real-browser execution.

Address all of the following in depth:

1. Define every identity and byte range from operation projection through
   artifact, chunk, response metadata, response body, browser staging file,
   completion receipt, and activated composition. Specify canonical encodings
   and maximum field sizes.
2. Analyze whether fixed application chunks over ordinary 200 responses are
   preferable to HTTP Range for this local authenticated design. Cover caches,
   proxies, content codings, partial responses, ambiguity, and browser APIs.
3. Specify server preflight verification before opening a model file: valid
   authenticated session, exact sequence, operation available, role closed,
   chunk canonical, journal identity current, path derived only from journal,
   direct regular file, no symlink/reparse point, exact expected size/hash, and
   resource admission.
4. Design whole-artifact revalidation without buffering. Discuss startup hash
   caches, file identity handles, Windows sharing flags/file IDs, Linux
   inode/device handles, concurrent mutation, replacement, truncation, sparse
   files, network filesystems, and the limits of checking only before/after.
5. Specify response-header and proof construction. Explain how to commit status,
   content length, content hash, metadata hash, and HMAC proof before streaming
   bytes while still detecting read failures. Identify whether prehashing each
   fixed chunk is required and what durable cache may safely hold.
6. Define server backpressure, buffer sizes, asynchronous file reads, response
   body writes, cancellation, client disconnect, output minimum rate, timeout,
   connection cap, file-handle cap, and fairness across sessions.
7. Specify browser response-verification order and streaming hash computation.
   Cover Content-Length mismatch, early EOF, extra bytes, wrong headers,
   duplicate headers, body stream error, response proof failure, chunk hash
   failure, metadata substitution, and no writes into activated storage.
8. Design staging writes that do not hold a multi-gigabyte ArrayBuffer. Compare
   OPFS synchronous access handles in workers, writable streams, IndexedDB
   blobs, File System Access, and memory-mapped/native alternatives. Select the
   browser path with the clearest bounded-memory behavior.
9. Define durable resume metadata. It may contain operation ID, composition
   identity, artifact identities, verified contiguous chunk boundary, and
   independent hashes, but no authority. Explain how a fresh pairing safely
   resumes without trusting stale metadata.
10. Analyze whether an incremental SHA-256 state can be durably serialized.
    If not standardized, define rehash-on-resume formulas and cost. If a custom
    implementation serializes state, specify versioning, validation, and why it
    does not weaken final full-file hashing.
11. Define cancellation and crash behavior at every boundary: before request,
    during server prehash, before headers, mid-body, after body before browser
    flush, after chunk flush before resume receipt, after final chunk, during
    full hash, and during composition activation.
12. Analyze disk-full, quota eviction, browser process kill, OS power loss,
    storage corruption, stale operation, Companion restart, changed artifact,
    locked file, antivirus, and browser backpressure stalls. Give one legal
    recovery state for each.
13. Define denial-of-service controls for giant declared sizes, maximal chunk
    counts, repeated first-chunk requests, slow readers, hash CPU, open handles,
    multiple sessions, and malicious local origins that cannot authenticate.
14. Produce exact public synthetic vectors for a six-artifact miniature
    composition, including metadata transcript, hashes, chunk boundaries,
    final-short-chunk case, zero-length rejection, and deliberately altered
    fields. Synthetic fixtures must never count as a real model.
15. Design tests at unit, raw HTTP, real Kestrel, browser stream, multi-gigabyte
    sparse/non-sparse file, Windows, Linux x64, and Linux ARM64 levels. Include
    memory high-water measurement and first-divergence failure preservation.
16. Provide server/browser pseudocode, resource formulas, and a staged
    implementation plan with objective acceptance criteria and no alternate
    transfer path.

Required report structure:

1. Executive transfer recommendation and assumptions.
2. Content and operation identity graph.
3. Exact route, metadata, and proof contract.
4. Companion file-validation and streaming algorithm.
5. Browser verification and bounded-write algorithm.
6. Backpressure, timeout, and resource model.
7. Resume and fresh-pairing reconciliation.
8. Mutation, crash, and cancellation state table.
9. Hostile-file and denial-of-service analysis.
10. Synthetic cross-language vectors.
11. Cross-platform and real-browser test matrix.
12. Prioritized implementation plan.
13. Unknowns requiring private large-model execution.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend arbitrary paths, Range as a second compatibility route,
whole-model buffering, trust in Content-Length alone, skipped full-file hash,
parallel best-source selection, silent chunk substitution, partial activation,
public-site model transfer, or fixture promotion. Do not claim that a chunk
response proves semantic model quality.

## Prompt 8: Crash-Consistent Browser Composition Store And Atomic Activation

You are an independent principal browser-storage engineer, transactional-state
architect, storage-quota specialist, and destructive-recovery test designer.
Produce an exceptionally detailed report for storing one complete six-artifact
TinyRustLM composition in browser-owned storage and activating it atomically
only after every byte, identity, and semantic manifest relationship has been
verified.

You may inspect public File System Standard, OPFS, IndexedDB, Storage API, Web
Locks, service-worker, quota/eviction, browser source, and WPT documentation.
You have no access to TinyRustLM private source, profiles, artifacts, tests,
models, credentials, or deployment accounts. Treat the requirements below as
project-supplied candidate behavior. Do not claim to have inspected or tested
the private browser model store.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch clean-slate product. There is no legacy browser
  store, migration, compatibility reader, alias, fallback, or dual-write
  obligation. SLM2, ACG2, Tokenizer2, Template2, Sampling2, and Prompt2 are
  exact technical identities.
- A complete composition has exactly six role-ordered artifacts:
  composition/ACG2, model/SLM2, Tokenizer2, Template2, Sampling2, and Prompt2.
  The ACG2 record binds the other five content identities and runtime contract.
- Artifact bytes arrive from an authenticated numeric-loopback Companion in
  fixed 4 MiB chunks. Every chunk, full artifact, response metadata, and final
  composition relationship is independently verified by the browser.
- Staging may resume using nonsecret content and operation identities after a
  new explicit pairing. Session keys and pairing secrets are never durable.
- No partial artifact, five-of-six set, stale manifest, structurally invalid
  SLM2, or identity-mismatched composition may become active or selectable.
- The runtime must open only one immutable active composition identity.
  Activation cannot depend on a display name, mutable alias, path, modification
  timestamp, or last-write-wins behavior.
- Large model bytes must be streamed with bounded memory. Browser profile
  deletion must remove the owned composition. Public web servers must never
  receive the model or prompt bytes.
- Interrupted, rejected, corrupt, obsolete, or superseded staging evidence may
  be retained under bounded policy for diagnosis, but it must never be
  overwritten into success or confused with an active model.
- A clean browser profile and an actual deleted profile are required for later
  dogfood evidence; clearing localStorage is not equivalent.
- MemoryEndpoints is unauthorized and disconnected.

Research current primary sources and browser behavior. Record browser/version,
publication/update dates, and retrieval date. Distinguish API guarantees,
implementation observations, recommended transaction design, and facts
requiring power-loss or real-browser verification.

Address all of the following in depth:

1. Compare OPFS, IndexedDB blobs, Cache Storage, File System Access, Origin
   Private File System sync access handles, and combinations thereof for
   multi-gigabyte immutable artifacts. Evaluate streaming, random access,
   worker availability, atomicity, durability, quotas, portability, and
   deletion.
2. Select one canonical store layout using content identities rather than model
   names. Define roots, staging transaction ID, artifact temp entries, verified
   artifact entries, composition commit record, active pointer, history,
   quarantine, and bounded resume metadata.
3. Explain the lack of one transaction spanning OPFS files and IndexedDB.
   Design a recoverable intent/artifact/commit protocol that never assumes
   cross-API atomicity. Identify the exact durable fact that makes a composition
   eligible for activation.
4. Specify create-only or fail-if-present semantics despite browser APIs that
   may default to truncate/replace. Define collision handling, content-address
   reuse, existing-byte independent verification, and why last-write-wins is
   forbidden.
5. Define write ordering for each chunk: authenticated network verification,
   bounded stream read, staging write, flush/close behavior, persisted verified
   boundary, and recovery. State what browser APIs do and do not promise about
   physical durability.
6. Define full-artifact and full-composition verification. Include byte count,
   streamed SHA-256, strict parsers for SLM2/Tokenizer2/Template2/Sampling2/
   Prompt2/ACG2, closed file inventory, role order, ACG2 references, runtime
   version constraints, and no unknown fields or extra files.
7. Design atomic logical activation. Compare rename/move, a small committed
   pointer record, IndexedDB transaction, directory swap, and content-addressed
   root selection. Define crash states before, during, and after active-pointer
   update.
8. Specify startup reconciliation. It must enumerate only bounded owned roots,
   validate names and records, reject malformed/foreign entries, recompute
   identities where required, distinguish committed active, complete inactive,
   resumable staging, corrupt quarantine, and unreachable orphan, and never
   infer success from existence or mtime.
9. Analyze concurrent tabs, workers, and processes. Compare Web Locks,
   IndexedDB transactions, BroadcastChannel notifications without secrets,
   OPFS exclusive access handles, and optimistic compare-and-commit. Define
   one writer and many safe readers without deadlock.
10. Define runtime handoff and lifecycle. Cover worker boot, immutable file
    handles, active composition switch, in-flight inference, cancellation,
    old worker termination, KV-cache invalidation, and why two compositions
    must not be mixed during a turn.
11. Analyze storage persistence requests, quota estimation, eviction,
    incognito/private mode, mobile constraints, partitioning, third-party
    contexts, site-data clearing, browser updates, profile corruption, and
    user-visible storage management. Provide honest preflight admission
    formulas.
12. Define deletion and cleanup. Cover user-requested model removal, staging
    cleanup, active-model protection, locked handles, browser crash, profile
    deletion, deletion proof for dogfood, and retention of only public-safe
    receipts outside the deleted profile.
13. Analyze service-worker updates and origin deployments. Ensure stale JS
    cannot write an incompatible store, secrets never enter the service worker,
    and an application release cannot silently reinterpret an old schema.
    Because the product is prelaunch, recommend a clean invalidation and
    explicit re-import rather than a compatibility reader when contracts change.
14. Design fault injection: terminate tab/worker/browser/OS after every write,
    quota exhaustion, eviction, modified chunk, replaced commit record,
    duplicate writer, stale lock, partial active pointer, corrupt IndexedDB,
    corrupt OPFS, service-worker skew, and profile deletion with locked files.
15. Define real-browser test coverage for Chromium, Firefox, and WebKit/Safari
    according to actual API support. Separate automated API tests, headed tests,
    physical disk/power tests, and unsupported-browser product behavior.
16. Provide browser pseudocode, strict schemas, state diagrams, resource
    formulas, and a prioritized implementation plan with objective gates.

Required report structure:

1. Executive storage choice and assumptions.
2. Current browser API/support matrix.
3. Content-addressed store layout.
4. Staging and chunk-commit algorithm.
5. Six-artifact verification contract.
6. Atomic logical activation protocol.
7. Startup reconciliation state table.
8. Concurrency and runtime handoff.
9. Quota, eviction, deletion, and privacy behavior.
10. Service-worker/release skew controls.
11. Fault-injection and real-browser test matrix.
12. Schemas and implementation pseudocode.
13. Prioritized clean-slate backlog.
14. Unknowns requiring private large-model execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend localStorage for model state, Cache Storage as an arbitrary
binary database, whole-model buffering, last-write-wins, path/name identity,
partial activation, cross-API atomicity assumptions, durable session secrets,
silent schema migration, dual-write compatibility, or clearing localStorage as
profile-deletion proof. Do not call an API close operation proof of physical
fsync unless primary documentation establishes it.

## Prompt 9: Immutable Qwen3 0.6B Source Custody And Complete Six-Artifact Conversion

You are an independent principal model-format engineer, Hugging Face source
forensics researcher, tokenizer/chat-template specialist, and deterministic
conversion architect. Produce an exceptionally detailed report specifying how
to acquire one immutable Qwen3 0.6B source revision and convert it into one
complete, provenance-bound TinyRustLM composition without guessing publisher
semantics or treating structural conversion as model quality.

You have internet access and may inspect official Qwen papers, model cards,
immutable Hugging Face revisions, repository files, tokenizer and Transformers
source, Safetensors specifications, licenses, and public inference examples.
You have no access to TinyRustLM private source, model files, converter,
training data, tests, receipts, machines, credentials, or unpublished
evaluation prompts. Treat project details below as supplied requirements, not
observed implementation. Never claim private conversion or inference proof.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch clean-slate product. There is no released model
  format to preserve, no compatibility converter, no migration, no alias, no
  fallback, and no permission to retain technical debt. SLM2, ACG2,
  Tokenizer2, Template2, Sampling2, and Prompt2 are exact technical contracts,
  not product version labels.
- The immediate target is one genuinely useful general conversational model
  in approximately the 0.6B class, with Qwen3 0.6B as the candidate family.
  The report must determine an exact public repository and immutable revision;
  do not assume a moving branch or popularity proves suitability.
- Source screening precedes conversion. Untouched publisher-framework output
  must be preserved under fixed prompts, seeded cases where sampling is used,
  and unseen paraphrases. A source that repeatedly fails practical constraints,
  current-turn authority, ambiguity, or useful conversation is rejected before
  conversion compute.
- A successful conversion produces exactly six artifacts in role order:
  ACG2 composition, SLM2 model, Tokenizer2, Template2, Sampling2, and Prompt2.
  Availability requires all six and complete identity closure.
- The candidate SLM2 weight profile is deterministic mixed Q8, not 1-bit
  marketing. Any lower precision is a separately preregistered experiment and
  cannot silently replace the accepted profile.
- Conversion is one canonical Rust child operation consuming immutable source
  locks and one conversion-profile identity. Output is create-only. The parent
  independently verifies the terminal composition. Python or Transformers may
  serve as an offline reference oracle but are not a hidden product runtime.
- Tokenizer2 must preserve publisher-exact tokenization and decoding.
  Template2/Prompt2 must preserve publisher chat semantics, special tokens,
  thinking/non-thinking controls, assistant-prefix behavior, generation prompt,
  and multi-turn composition. Sampling2 must state exact decoding behavior.
- Raw conversion/model output may not be repaired, completed, keyword-injected,
  retry-selected, or trained on sealed evaluation cases.
- Source/model artifacts are large and private to the user-owned local path;
  they stay outside Git. Git contains only bounded public-safe contracts,
  hashes, provenance, code, tests, and receipts.
- MemoryEndpoints is unauthorized and disconnected. No fixture or conversion
  receipt is a quality-qualified model or campaign pass.

Research only current primary sources where possible. Record model/repository
identity, immutable revision hash, each source file's identity/size/hash where
publicly obtainable, license revision, publication/update dates, library
versions, and report retrieval date. Clearly label observed repository facts,
paper/model-card claims, engineering inference, recommendations, and facts
requiring local source acquisition or execution.

Address all of the following in depth:

1. Identify the exact official Qwen3 0.6B base/instruct candidates and immutable
   revisions. Compare base versus post-trained variants for local assistant
   use, license, context, tokenizer, chat template, thinking behavior, source
   size, and conversion complexity. Recommend exactly one first source or a
   fail-closed screening sequence.
2. Build an immutable source-lock manifest: repository ID, commit, model card,
   license, config, generation config, tokenizer JSON/config, special-token
   map, chat-template source, Safetensors index and shards, checksums, byte
   counts, ETags/LFS OIDs, allowed hosts, and retrieval tool identity. Explain
   what cannot be established without downloading bytes.
3. Decode the exact architecture from official config and implementation:
   hidden size, layers, attention heads, KV heads, head dimension, intermediate
   size, vocabulary, tied embeddings, normalization, activation, RoPE base and
   scaling, attention bias, sliding window, context limit, GQA, embedding
   scaling, logits behavior, and any Qwen-specific mechanisms.
4. Enumerate expected Safetensors keys, shapes, dtypes, shard mapping, and
   semantic role. Define a closed tensor inventory and rejection rules for
   missing, duplicate, extra, aliased, nonfinite, malformed, overlapping,
   out-of-bounds, wrong-endian, unsupported dtype, or shape-inconsistent data.
5. Specify safe immutable acquisition with explicit user approval, HTTPS/TLS
   validation, redirects, resume validators, changed ETags, content lengths,
   streamed SHA-256, disk admission, partial files, crash recovery, source
   drift, and license ambiguity. A resumed shard must remain bound to one exact
   revision.
6. Design untouched source screening before conversion. Give a case taxonomy,
   minimum case/review counts, deterministic environment, exact chat-template
   use, raw output preservation, seeds, repetition, rejection criteria, and
   methods preventing the later training corpus from containing sealed cases.
7. Specify Tokenizer2 lowering from publisher files. Cover normalization,
   pre-tokenization, byte fallback, BPE/merge ranking, added tokens, special
   tokens, Unicode, invalid UTF-8 policy, whitespace, encode/decode cleanup,
   BOS/EOS, token ID range, exact vocabulary hashes, and differential vectors.
8. Specify Template2 and Prompt2 lowering. Enumerate every publisher template
   branch used by the selected model, system/user/assistant/tool roles,
   generation prompt, thinking tags or controls, empty messages, multi-turn
   order, escaping, date/context injection if any, and explicit rejection of
   unsupported template features rather than semantic guessing.
9. Specify Sampling2 from publisher defaults and product needs. Distinguish
   deterministic greedy conformance from declared sampling, temperature,
   top-k, top-p, min-p if applicable, repetition penalty, seed, stop tokens,
   maximum generation, and thinking/non-thinking profiles. Do not infer
   defaults from a generic Qwen family member.
10. Define mixed-Q8 conversion at tensor-role granularity. State which tensors
    remain exact or higher precision, quantization group/row layout, scale
    dtype, rounding, zero-point or symmetric rule, nonfinite handling,
    padding, alignment, endian behavior, and deterministic byte order. Explain
    why quantization profile identity is part of artifact identity.
11. Define the SLM2 layout and lowering order sufficiently for an independent
    implementation: header, bounded metadata, tensor table, aligned payloads,
    checksums, architecture ID, quant profile, source identity, and rejection
    of unknown/duplicate entries. If project-specific details are unknown,
    give design requirements rather than inventing current bytes.
12. Define Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 canonical
    serialization, cross-links, role order, hashes, byte counts, schema IDs,
    runtime requirements, and complete-composition identity. Explain which
    object is the root of trust and how circular hashes are avoided.
13. Specify a create-only conversion transaction using bounded staging, streamed
    source reads, deterministic output offsets, incremental hashing, component
    receipts, final independent parsing, terminal pass/rejection, fsync or
    platform equivalent, and parent re-verification.
14. Design differential conformance against the pinned source framework:
    tokenizer IDs, rendered prompt bytes/IDs, dequantized tensors, embeddings,
    selected layer activations, logits, greedy tokens, sampled tokens under
    fixed RNG, stop behavior, and multi-turn output. Define first-divergence
    evidence.
15. Define license/provenance and redistribution decisions. Distinguish source
    weights, converted bytes, tokenizer data, generated manifests, model card,
    attribution, catalog metadata, P2P sharing permission, and facts requiring
    counsel or publisher clarification.
16. Give a staged implementation and stop-rule plan: metadata-only pilot,
    tiny synthetic fixture, exact source screening, full acquisition, dry-run
    inventory, complete conversion, native conformance, browser conformance,
    semantic qualification, and only then P2P/catalog eligibility.

Required report structure:

1. Executive source/conversion recommendation and assumptions.
2. Candidate and immutable-revision matrix.
3. Source-lock and license/provenance ledger.
4. Exact architecture and tensor inventory.
5. Safe acquisition and resume algorithm.
6. Untouched source-screen protocol.
7. Tokenizer2 specification.
8. Template2, Prompt2, and Sampling2 specification.
9. Mixed-Q8 and SLM2 conversion specification.
10. ACG2 identity and six-artifact closure.
11. Create-only conversion transaction.
12. Differential conformance and failure evidence.
13. Prioritized implementation plan and stop rules.
14. Unknowns requiring local source/model execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend a moving source revision, guessed tensor mapping, generic chat
template, lossy tokenizer substitution, unregistered lower precision, source
output repair, best-of-N output selection, training on holdouts, partial
composition, relabeled duplicate model, compatibility converter, or license
assumption. Do not call structural validation useful conversational quality.

## Prompt 10: Mixed-Q8 Qwen3 Browser-WASM Runtime, KV Cache, And Honest Performance

You are an independent principal quantized-inference engineer, WebAssembly
kernel architect, CPU microarchitecture specialist, and model-quality
performance scientist. Produce an exceptionally detailed report for executing
one mixed-Q8 Qwen3 0.6B composition locally in a browser with bounded memory,
portable correctness, and measured quality preservation.

You may inspect public Qwen sources, WebAssembly and SIMD specifications,
browser engine documentation, Rust compiler guidance, quantization papers,
TurboQuant/TurboVec public sources, KV-cache research, and reproducible kernel
implementations. You have no access to TinyRustLM private runtime, models,
benchmarks, machines, test output, or conversion profiles. Treat the project
details below as requirements under design, not existing results. Do not claim
private performance or accuracy measurements.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one clean-slate prelaunch product with no legacy runtime,
  compatibility kernel, migration, hidden fallback, or debt to preserve.
  SLM2 and other numbered names are exact technical identities.
- The first target is one real Qwen3-class 0.6B general assistant composition
  using a deterministic mixed-Q8 weight profile. It is not currently a 1-bit
  model. Lower precision, TurboQuant-like transforms, TurboVec techniques,
  sparse specialists, and compressed KV caches are research candidates only
  until preregistered experiments show parity and practical benefit.
- The canonical scalar Rust implementation is the numerical reference. Native
  SIMD and browser WASM SIMD may accelerate the same semantics but cannot
  silently change quantization, accumulation, sampling, or output contracts.
- The browser receives exactly six verified artifacts and runs locally. Model
  and prompt bytes are not uploaded. Inference should occur in a dedicated
  worker so UI responsiveness, cancellation, and fresh-worker recovery are
  testable.
- Runtime admission must account for SLM2 bytes, linear-memory residency or
  streaming/mapping strategy, dequant scratch, activations, logits, tokenizer,
  prompt tokens, KV cache, worker overhead, browser/OS headroom, and temporary
  duplication during load.
- Required proof includes scalar native, accelerated native where supported,
  raw WASM, and real Chromium. Cross-compilation or a tiny fixture is not a
  real-model browser pass.
- Quality is more important than an attractive throughput number. Raw outputs
  may not be repaired, truncated into a pass, retry-selected, or compared only
  on benchmark answers seen during development.
- MemoryEndpoints is unauthorized and disconnected.

Use primary sources and immutable revisions. Record hardware, compiler,
browser, flags, source dates, and retrieval date for every benchmark or claim.
Separate published measurements from formulas, estimates, recommendations,
and facts requiring local execution.

Address all of the following in depth:

1. Derive exact memory formulas for weights, per-tensor scales, metadata,
   embeddings, activations, residuals, normalization scratch, attention
   scores, logits, tokenizer, prompt IDs, KV cache by layer/head/token/dtype,
   worker overhead, and transient copies. Instantiate formulas symbolically for
   Qwen3 0.6B and clearly mark values requiring the pinned config.
2. Analyze browser WebAssembly linear-memory constraints today: wasm32 address
   space, practical contiguous allocation, memory growth, ArrayBuffer
   detachment, maximum pages, Memory64 shipping status, engine-specific limits,
   32-bit devices, and interaction with OPFS/file streaming.
3. Compare model-loading strategies: full SLM2 into linear memory, staged
   tensor loading, OPFS reads, synchronous worker access handles, bounded layer
   streaming, shared memory, and native Companion inference. Select the browser
   architecture that can honestly support the target without counting the
   Companion as browser inference.
4. Specify the mixed-Q8 representation: tensor classification, row/group size,
   signed integer coding, scale precision, symmetric/asymmetric choice,
   rounding, saturation, alignment, tail handling, endian order, and exact
   dequantization equation. Identify tensors that should remain F16/F32 or
   higher precision and why.
5. Design scalar reference kernels for embedding lookup, RMSNorm, Q/K/V
   projections, RoPE, grouped-query attention, softmax, output projection,
   gated MLP, residual, final norm, and logits. State accumulation precision,
   operation order, NaN handling, and deterministic test vectors.
6. Design WASM SIMD128 kernels with feature detection and the same contract.
   Cover `i8x16`, widening dot products where available, lane reduction,
   scale application, tiling, cache locality, unaligned loads, tails, and
   compiler autovectorization versus explicit intrinsics.
7. Analyze native x86-64 and ARM64 acceleration only as conformance peers.
   Cover AVX2/AVX-512/VNNI/NEON/dot-product features, runtime dispatch, binary
   portability, and why hardware dispatch is not legacy product support.
8. Evaluate browser threads and SharedArrayBuffer. State exact COOP/COEP/CORP
   deployment requirements, third-party asset consequences, worker pool costs,
   deterministic reduction issues, mobile/browser support, and when single
   threaded WASM should remain the sole first gate.
9. Design the KV cache. Include GQA dimensions, layer-major versus token-major
   layout, preallocation versus growth, maximum admitted context, conversation
   truncation, RoPE positions, cache invalidation on prompt/template/model
   change, cancellation rollback, and reuse across turns. Quantified cache
   compression must remain an experiment until proven.
10. Evaluate TurboQuant and TurboVec ideas from primary papers/repositories:
    random transforms, quantized vectors, distance/attention approximations,
    cache quantization, codebook or residual methods, and SIMD-friendly
    layouts. Identify which ideas apply to transformer weights, KV cache,
    retrieval vectors, or none. Reject name similarity as evidence.
11. Define performance methodology: cold load, warm load, prompt processing,
    time to first token, decode tokens/second, peak committed memory, linear
    memory high-water, OPFS throughput, UI frame responsiveness, cancellation
    latency, energy where measurable, and confidence intervals. Use formulas
    instead of invented device measurements.
12. Define numerical and quality budgets from source FP/BF16 through scalar
    mixed-Q8, native SIMD, raw WASM, and real browser. Include tensor error,
    cosine/RMSE, logit top-k agreement, token agreement, perplexity on clean
    text, semantic evaluation, ordinary-helpfulness regression, and catastrophic
    per-category stop rules.
13. Design adversarial kernels tests for extreme scales, all-zero rows,
    saturation, tails, odd dimensions, NaN/Inf source rejection, long context,
    repeated tokens, cancellation mid-layer, memory-growth failure, and worker
    restart.
14. Define build reproducibility and feature detection: Rust toolchain, target
    features, wasm-opt or equivalent, linker flags, deterministic binaries,
    source maps/symbol handling, CSP-compatible loading, MIME types, and
    deployment headers.
15. Provide an experiment ladder in which every optimization has an exact
    reference, preregistered hypothesis, isolated implementation, quality
    gate, resource gate, and deletion rule if it loses. No failed experimental
    path remains in production as debt.

Required report structure:

1. Executive runtime recommendation and assumptions.
2. Qwen3 computation and memory model.
3. Browser WASM limits and storage/load architecture.
4. Mixed-Q8 canonical numeric specification.
5. Scalar, WASM SIMD, x64, and ARM64 kernel designs.
6. KV-cache and multi-turn state design.
7. TurboQuant/TurboVec applicability audit.
8. Performance laboratory and formulas.
9. Numerical/semantic quality gates and stop rules.
10. Fault, cancellation, and recovery matrix.
11. Reproducible build and deployment requirements.
12. Prioritized experiment/implementation plan.
13. Unknowns requiring private real-model execution.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend 1-bit weights merely for file size, approximate attention as
an unmeasured default, native execution labeled browser inference, whole-model
copies without accounting, benchmark-only promotion, output repair, hidden
scalar fallback after claiming SIMD, disabled quality tests, or retained failed
experiments. Do not invent browser memory limits or device throughput.

## Prompt 11: First-Divergence Conformance And No-Cheat Quality Qualification

You are an independent principal ML evaluation scientist, numerical-conformance
engineer, tokenizer/template auditor, and browser acceptance architect. Produce
an exceptionally detailed report for proving that one converted mixed-Q8
Qwen3 0.6B composition preserves publisher semantics from the pinned source
framework through scalar Rust, accelerated native execution, raw WASM, and a
real browser, and is genuinely useful without evaluation contamination.

You may inspect public model/evaluation papers, official Qwen and Transformers
sources, tokenizer/template documentation, statistical methods, browser test
documentation, and reproducibility standards. You have no access to TinyRustLM
source, model bytes, outputs, prompts, holdouts, test receipts, or machines.
Treat all project details below as supplied goals, not proof of current results.
Never claim that you evaluated a private model or saw unpublished cases.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch clean-slate product. No old runtime behavior,
  compatibility threshold, migration, alias, fallback, or test weakness must
  be retained. Numbered artifact names are exact technical identities.
- One complete model composition consists of ACG2, SLM2, Tokenizer2, Template2,
  Sampling2, and Prompt2. All six identities and the pinned source revision are
  part of the evaluated subject.
- The candidate source is an immutable official Qwen3 0.6B revision selected
  only after untouched source screening. The target is a deterministic
  mixed-Q8 conversion.
- Evaluation must distinguish source-framework behavior, converted scalar Rust,
  native accelerated kernels, raw WASM, and deployed real-browser execution.
  A pass in one lane cannot be copied to another lane.
- Important behavior includes ordinary conversation, common sense, ambiguity,
  practical resource constraints, conflicting authority, current-turn
  precedence over stale memory, multi-turn continuity, untrusted quoted or
  retrieved instructions, summarization, rewriting, JSON/extraction, code
  explanation, and direct treatment of lawful adult questions with narrow
  concrete-harm boundaries. Arithmetic may be delegated to a deterministic
  calculator.
- Raw outputs are immutable evidence. Response repair, answer completion,
  keyword injection, retry-selected best answer, hidden prompt changes,
  evaluator changes after seeing preferred outputs, and training on sealed
  holdouts are forbidden.
- Structural validity, one attractive response, model popularity, parameter
  count, benchmark familiarity, or a tiny fixture is not assistant quality.
- MemoryEndpoints is unauthorized and disconnected. No live-memory continuity
  claims may be made.

Research current primary evaluation and conformance methods. Record versions,
source dates, immutable revisions, and report retrieval date. Clearly separate
external empirical claims, proposed acceptance criteria, statistical
assumptions, and facts requiring local model execution.

Address all of the following in depth:

1. Define the evaluated identity closure: source repository/revision/files,
   tokenizer, chat template, generation config, source framework/version,
   converter/profile, six artifacts, runtime binary, WASM binary, browser
   assets, system prompt, sampling profile, evaluator, cases, seeds, raw
   outputs, and decision. Specify content-addressed receipt links.
2. Design tokenizer conformance covering encode IDs, decode text, round trips,
   special/added tokens, Unicode normalization, byte fallback, whitespace,
   invalid text policy, long input, random bytes where admitted, and exact
   differential vectors.
3. Design Template2/Prompt2 conformance covering every admitted role sequence,
   thinking mode, generation prompt, special tokens, empty content, multiple
   turns, quoted instructions, stale/current preferences, stop boundaries, and
   exact rendered bytes/token IDs.
4. Define weight-conversion evidence: closed tensor inventory, shape/dtype,
   scale statistics, dequantization error by tensor role, outlier handling,
   and exact source-to-SLM2 identity. State which metrics can reveal a swapped
   or transposed tensor.
5. Build a first-divergence numerical ladder: embeddings, each layer's norm,
   Q/K/V, RoPE, attention scores/probabilities/output, MLP gates/output,
   residual, final logits, selected top-k, and generated token. Define absolute,
   relative, ULP, cosine, and rank-based tolerances by dtype/operation.
6. Separate deterministic greedy conformance from stochastic sampling
   conformance. For sampling, specify a portable RNG, float-to-probability
   ordering, top-k/top-p ties, repetition penalties, multinomial boundary
   cases, seeds, and when token identity must be exact versus statistically
   equivalent.
7. Design cross-lane tests for source framework, scalar Rust, x64 SIMD, ARM64
   SIMD, raw WASM engine, and real Chromium. Include identical inputs,
   artifact identities, environment capture, cold/warm state, and independent
   raw-output hashes.
8. Define quantization quality gates using clean public corpora and private
   sealed behavior suites. Include perplexity or loss deltas, token/logit
   agreement, semantic category scores, catastrophic regressions, ordinary
   helpfulness floor, latency, and memory. Explain why aggregate mean can hide
   unacceptable category failure.
9. Design general semantic invariants rather than fixture keyword checks for
   ambiguity, conflicting sources, latest-user preference, unavailable
   resources, untrusted memory, lawful adult comparison, summaries, JSON, and
   code. Specify deterministic checks, model judges, and human authority roles.
10. Define metamorphic testing with entity, date, unit, percentage, authority
    order, resource availability, sentence order, negation, discourse style,
    irrelevant distractor, and malicious quoted-instruction substitutions.
    State which verdicts must remain invariant and which should change.
11. Define contamination controls across source screening, training or quality
    rescue, evaluation, and audit: exact normalization, character/token n-gram,
    semantic-neighbor search, template-family detection, entity-substituted
    overlap, expected-answer overlap, public benchmark overlap, sealed
    holdouts, access logs, and deletion lineage.
12. Define stochastic statistics: fixed preregistered seeds, repeats, pass
    probability, confidence intervals, correlated cases, multiple comparisons,
    infrastructure flakes, and why best-of-N is invalid unless it is declared
    product behavior.
13. Design blinded human review with reviewer training, material rubrics,
    inter-rater agreement, adjudication, source/model blinding, exact raw
    preservation, and independent challenge suites excluded from development.
14. Define browser acceptance beyond text quality: exact one assistant render,
    completion state, cancellation, fresh worker, fresh browser profile,
    deleted profile, bounded memory, no prompt/model upload, and screenshots or
    traces scanned for secrets.
15. Define evaluator versioning and failure-driven TDD. Preserve raw failure,
    write a generic regression, add positive/counterexamples, version the
    evaluator, invalidate only dependent phases, and archive all old decisions.
16. Provide promotion claims and prohibited language for structural-only,
    numerically conformant, conversation-screened, conversation-proven,
    task-specific, and general-assistant evidence. Specify a go/no-go matrix.

Required report structure:

1. Executive qualification philosophy and assumptions.
2. Evaluated identity and receipt graph.
3. Tokenizer/template/prompt conformance.
4. Tensor and first-divergence numerical laboratory.
5. Deterministic and stochastic decoding conformance.
6. Cross-runtime and real-browser matrix.
7. Semantic invariant and metamorphic suite.
8. Quantization quality/statistical gates.
9. Contamination and no-cheat controls.
10. Human review and independent audit.
11. Failure-to-regression/versioning workflow.
12. Promotion claim taxonomy and go/no-go matrix.
13. Unknowns requiring private model execution.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend expected-keyword scoring as semantic proof, opaque LLM judge
as sole authority, output repair, best-of-N selection, training on holdouts,
threshold reduction to obtain a pass, copied evidence across runtimes, or
browser claims from Node/WASM alone. Do not call one model qualified before its
exact six-artifact composition and deployed-browser subject are bound.

## Prompt 12: End-To-End First-Model Release, Public Claim Integrity, And Living Documentation

You are an independent principal release engineer, evidence-control-plane
architect, software supply-chain specialist, and technical-documentation
governance lead. Produce an exceptionally detailed report specifying the
objective release path from a clean repository state to one real, useful,
browser-local TinyRustLM model available through the production site, while
keeping packages, public sites, release logs, and documentation synchronized
with exactly what has been proven.

You may inspect public release-engineering standards, SLSA, SPDX/CycloneDX,
Sigstore and platform signing guidance, NuGet documentation, Rust and .NET
tooling, browser deployment guidance, reproducible-build literature, and public
website practices. You have no access to TinyRustLM private source, branches,
artifacts, CI, credentials, signing keys, DNS, hosting, packages, model files,
test results, or campaign receipts. Treat every detail below as a supplied
project requirement, not an observed current status. Do not claim private
build, publication, or deployment proof.

Project facts and constraints supplied for this assignment:

- TinyRustLM is one prelaunch product. There is no product V2, released legacy
  population, migration obligation, compatibility support, fallback path, or
  acceptable code debt. Technical names containing `2`, protocol paths, schema
  IDs, semantic versions, and branch names are exact identities, not parallel
  product generations.
- The first major releasable goal is one immutable, provenance-bound, genuinely
  useful model that completes the entire path: source screening, source lock,
  acquisition, six-artifact conversion, native verification, real-browser
  import, browser-WASM inference, semantic qualification, and honest product
  availability.
- The six artifacts are ACG2, SLM2, Tokenizer2, Template2, Sampling2, and
  Prompt2. Model files and generated private evidence stay outside Git; all
  source, bounded public-safe contracts, tests, documentation, and release
  metadata must be committed and pushed.
- The public experience is P2P first for an exact verified composition; if no
  verified peer exists, explicit user approval starts local source conversion.
  Downloading instruction `.txt`, `.ps1`, or `.json` files is not product
  success.
- The downloadable Companion is a private per-user operational host. Required
  RIDs are `win-x64`, `linux-x64`, and `linux-arm64`. The website is the browser
  chat UI. Model and prompt bytes remain browser-local or flow directly between
  consenting peers, never through the public website.
- A source-control checkpoint should follow each major change that builds.
  Deployment should follow when all applicable gates pass. Published sites
  must show a consistent last-published version, release date, and update log,
  and documentation must remain robust rather than lagging the product.
- Existing failures cannot be hidden, overwritten, reclassified as skips, or
  bypassed by weaker tests. Partial success is useful evidence but not release
  completion. A last-known-good deployment rollback restores known bytes; it
  does not preserve rejected legacy code.
- No secret, credential, enrollment URL, token, private path, prompt, raw
  hosted-memory payload, or model bytes may enter Git, logs, public receipts,
  screenshots, traces, release notes, or websites.
- MemoryEndpoints is unauthorized and disconnected. Current eventual campaign
  targets are 20 qualifying models, 50 deletion-backed browser rounds, 25 live
  memory-continuity rounds, 40 current outside-network lane proofs, and 20 live
  catalog announcements, but no count may increase from mocks, structural
  tests, this report, or the one-model engineering milestone alone.

Research primary release, supply-chain, package, deployment, and documentation
sources. Record versions, publication/update dates, and retrieval date. Clearly
label externally observed facts, recommended controls, assumed project facts,
and evidence requiring authorized private or production access.

Address all of the following in depth:

1. Define the complete dependency/receipt DAG from source repository and
   license through source files, conversion profile, converter, six artifacts,
   native runtime, C ABI, managed SDK, Companion, WASM, browser assets,
   evaluator, model decision, packages, deployment, P2P metadata, and public
   documentation. State exact invalidation edges.
2. Define phase states richer than one boolean: unstarted, registered, running,
   passed with evidence, rejected terminally, interrupted, externally blocked,
   obsolete, superseded, deployed, and publicly read back. Define legal
   transitions and retry/new-attempt identity.
3. Specify source-control policy for frequent safe checkpoints: branch identity,
   clean diff review, format/build/test gates, secret scan, artifact allowlist,
   commit scope, push, fresh fetch, local/remote equality, and immutable
   evidence links. Explain how to checkpoint incomplete but building work
   honestly.
4. Define a test-gate matrix for Rust runtime/converter, C ABI, .NET SDK,
   Companion listener, raw HTTP protocol, operation journal, P2P transfer,
   browser client, storage, WASM runtime, semantic evaluator, packages, and
   sites. Include unit, integration, property, fuzz, fault, consumer, RID,
   real-browser, and authorized live tests.
5. Define real-platform evidence for `win-x64`, `linux-x64`, and
   `linux-arm64`: compilation, binary-header inspection, emulated execution,
   real hardware execution, package install, listener bind, child conversion,
   browser integration, and uninstall/cleanup. State minimum gates by release
   channel.
6. Design deterministic package creation and verification for Cargo outputs,
   native assets, .NET/NuGet packages, symbols, self-contained Companion
   archives, WASM assets, and source maps. Cover lock files, repository
   metadata, SourceLink, portable PDB, `.snupkg`, hashes, SBOM, provenance,
   signing, archive traversal, executable bits, and dependency allowlists.
7. Define static-site deployment as a content-addressed transaction. Include
   build identity, asset manifest, cache headers, immutable hashed assets,
   HTML/service-worker update ordering, CSP/COOP/COEP/CORP, MIME types,
   rollback, CDN invalidation, DNS/TLS facts, and HTTPS readback from an
   independent network.
8. Specify a consistent release-information contract across every related
   public product and documentation site: product/version identifier, release
   date/time zone, last-published timestamp, commit/build identity, concise
   changes, fixed issues, known limits, evidence level, rollback status, and
   links to detailed documentation. Define machine-readable and human-readable
   forms.
9. Design living-documentation governance. Map code/contracts/tests to required
   architecture docs, operator docs, user docs, security docs, model cards,
   API docs, release notes, and site copy. Define stale-doc detection,
   link/anchor checks, generated-reference boundaries, review ownership, and a
   release gate that blocks contradictory claims.
10. Define claim taxonomy for installed, bound, paired, operation-capable,
    structurally converted, numerically conformant, browser-executed,
    conversation-screened, quality-qualified, P2P-prepared, externally proven,
    catalog-announced, and deployed. State prohibited marketing language for
    every incomplete level.
11. Specify one-model acceptance evidence: immutable source and license,
    complete six-artifact identities, parent/child terminal receipts, native
    conformance, raw-WASM conformance, deployed real-browser multi-turn output,
    clean profile creation/deletion, network privacy proof, resource metrics,
    semantic/human review, package verification, public site readback, and no
    secret exposure.
12. Define failure preservation and scoped invalidation. Cover listener/parser
    defects, browser local-network denial, pairing flaw, journal recovery bug,
    source drift, conversion mismatch, tokenizer/template divergence,
    quantization regression, WASM trap, duplicate UI output, stale site asset,
    bad package, and documentation contradiction.
13. Define publication authorization and rollback. Separate developer build,
    release candidate, signed artifact, uploaded artifact, feed/CDN acceptance,
    public readback, and operator approval. A failed deployment must not leave
    claims for artifacts that users cannot retrieve.
14. Design a concise operator dashboard showing current operation, evidence
    phase, elapsed time, resumable state, blockers, one-model milestone, package
    status, site deployment/readback, documentation freshness, and unchanged
    campaign counters. It must never display `done` from unit tests alone.
15. Define secret scanning across source, Git history, build output, packages,
    SBOM/provenance, screenshots, traces, logs, release notes, website assets,
    source maps, and deployment manifests. Include encoded/UTF-16/compressed
    forms, bounded false-positive adjudication, and publication stop rules.
16. Provide a prioritized end-to-end implementation and publication sequence
    with checkpoint boundaries after every major buildable change and deploy
    boundaries only after all dependent gates pass. No step may depend on a
    hidden legacy path.

Required report structure:

1. Executive release-control recommendation and assumptions.
2. Complete identity/receipt/invalidation graph.
3. Campaign and one-model phase state machine.
4. Source-control checkpoint policy.
5. Component/RID/browser test-gate matrix.
6. Reproducible package and supply-chain controls.
7. Static-site deployment and public-readback transaction.
8. Cross-site release-information schema and example.
9. Living-documentation governance and stale-doc gates.
10. Claim taxonomy and prohibited language.
11. Objective first-model acceptance checklist.
12. Failure preservation, rollback, and invalidation workflow.
13. Operator dashboard specification.
14. Prioritized build/checkpoint/deploy plan.
15. Unknowns requiring private or authorized production access.
16. Annotated primary-source bibliography with dates and direct links.

Do not recommend waiting for perfection before source control, deploying on
failing gates, package creation as publication proof, local URL checks as
outside readback, cross-compilation as real ARM64 execution, mocks as campaign
credit, documentation as an afterthought, secrets in reports, compatibility
branches, dual implementations, hidden fallbacks, or marketing claims ahead of
evidence. Do not overwrite rejected or obsolete receipts.

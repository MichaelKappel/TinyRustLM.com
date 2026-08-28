# ADR-004: Companion Transport

## Status

Accepted

The sole executable contract is
`tinyrustlm.companion.loopback-capability/4`. It combines the closed loopback
capability protocol with the source-only request, operation, projection, and
evidence contracts preregistered by
`tinyrustlm.companion.source-operation-owner/1` and its output-free composition
profile correction. Profiles `/1`, `/2`, and `/3` remain immutable design and
failure history with no runtime reader. The private `/4` listener and process
host are implemented and locally verified; operation dispatch, physical
production-browser proof, and release verification are still required before
either is exposed.

## Decision Date

2026-08-24

## Scope

This decision governs the private user-owned Companion boundary used by
TinyRustLM.com for reviewed source conversion, progress, cancellation, and
complete composition transfer. Direct-peer import is an intended later route,
but it is absent from the current request and state machine until a verified
six-member importer owns its evidence.

It does not authorize model-byte proxying through a project site, public P2P
announcement, MemoryEndpoints access, arbitrary local file access, arbitrary
process execution, model-quality claims, or a released installer.

**Observed local fact**: the nonpackable `TinyRustLM.Companion` component owns
the strict `tinyrustlm.companion.acquire.v2` request, the strict
`tinyrustlm.companion.operation.v3` record, create-only execution, source
acquisition intent, source acquisition receipt, and source conversion intent
evidence, an owned create-only journal, and a source coordinator that invokes
only the complete `qwen3-composition` transaction. The request admits only one
exact Qwen3 source descriptor and one explicit attempt ID. Its cache, staging,
model, tokenizer, lock, and conversion roots must be distinct and nonnested.
Its source intent preregisters the canonical
`tinyrustlm.source-payload-inventory.v1` identity, and its acquisition receipt
must reproduce the exact nine-file inventory SHA-256
`59e57ba08d4dc6e0914f6089f3321c073739ed60a506edd533068d8d0d2b2da9`;
an arbitrary digest-shaped claim is not admitted.
The coordinator can independently reconcile a strict terminal pass or
rejection from the exact bound intent after process loss, but it does not
infer, adopt, relaunch, or kill work for an absent or nonterminal root. It now
also owns the private exact IPv4 Kestrel listener,
pairing, session status, rotation, revocation, and truthful unavailable
operation responses. `TinyRustLM.CompanionHost` owns one argument-free,
interactive process entry point and one private per-user installation root.
The web source owns a strict memory-only capability client, and the managed
component owns canonical operation projection, create-only cancellation
intent, terminal-race-safe service semantics, and independently reverified
fixed-chunk source-composition transfer. The client is not loaded, the service
is not dispatched by the listener, and no real acquisition executor exists.
No current route table or port is release authority.

## Decision

**Engineering decision**: the Companion exposes one closed HTTP/1.1 capability
protocol over one numeric IPv4 loopback listener bound exactly to
`127.0.0.1` on operating-system-selected port zero. The process never binds
IPv6, `localhost`, a fixed port, a wildcard, LAN address, public address, or
hostname.

The listener accepts only an exact registered Host value for its active
loopback endpoint and an exact registered `Origin` value for TinyRustLM.com.
Missing, duplicated, malformed, opaque, `null`, unpaired development, or
unexpected Origin values fail before route dispatch. DNS names are not treated
as proof of loopback identity.

The protocol uses explicit user pairing and short-lived origin-bound
proof-of-possession sessions. The pairing secret and derived session key never
cross the wire. Every authenticated request and response carries a
domain-separated HMAC-SHA-256 proof that binds protocol, installation, process,
session, epoch, sequence, method or status, exact Host, exact Origin, path,
content type, byte length, and SHA-256 of the exact body bytes. There is no
bearer capability, cookie, Authorization header, URL secret, or durable browser
key.

The pairing, rotation, revocation, expiry, replay, CORS, Local Network Access,
HTTP parser, and artifact-transfer primitives derive from the preserved `/3`
registration. The sole current operation contract is frozen by
`contracts/vnext/companion-source-operation-owner-preregistration.v1.json` and
`contracts/vnext/companion-source-operation-owner-profile-identity-correction-preregistration.v1.json`.
The current cross-language corpus is
`contracts/vnext/companion-loopback-capability-vectors.v2.json`; the v1 corpus
is retained only as historical evidence and is not copied into current test or
package output. IPv6, localhost names, a fixed port, port scanning, and
alternate protocols are not part of this contract.

The route table is closed and versioned. Unknown method, path, media type,
schema, field, operation, state, sequence, artifact kind, range, or capability
fails with one bounded public-safe error. There is no generic file route,
directory route, proxy route, command route, environment route, diagnostics
dump, or extension route.

The current acquisition request is source-only and permits exactly the pinned
public source and sole canonical converter path after explicit consent. It has
no peer candidate, arbitrary URL, or arbitrary path. P2P-first selection can be
added only by cleanly replacing this sole contract after a complete six-member
peer importer and its proof authority pass their own gate. A TXT, JSON,
PowerShell, shell, README, conversion kit, or instruction download is never a
model action.

The managed and browser request validators each own the exact same immutable
repository, revision, source-lock, composition-profile, and source-byte
constants. Browser syntax acceptance cannot widen the managed source authority.

Artifact transfer streams only the six members of one journaled available
composition. Each response binds operation ID, artifact kind, byte length, and
SHA-256. The browser independently hashes every complete member and performs
one fail-atomic Rust admission. Partial members never activate.

Progress is a projection of immutable Companion journal history. Cancellation
is request-bound, race-safe, terminal, and owns the complete child-process or
transfer cancellation tree. A lost response does not create a second logical
operation. Restart recovery must inspect immutable evidence and may only
recover the same operation or produce a typed terminal rejection.

HTTP request parsing has explicit line, header-count, header-byte, body-byte,
connection, idle, operation, and response limits. Request bodies use exact
length; ambiguous framing, conflicting lengths, unsupported transfer coding,
obs-fold, request smuggling forms, and slow-body abuse fail closed. Response
compression is disabled for secret-bearing control responses.

Prompts never traverse this transport. Model and composition bytes remain
between the user's browser, user-owned Companion, reviewed public source, and
consenting direct peers. TinyRustLM.com and MiniModel.org do not proxy them.

## Alternatives

Loopback HTTPS with a locally installed private CA was rejected as the first
transport because certificate installation, trust-store mutation, enterprise
interception, rotation, and removal enlarge installer privilege and failure
surface. It can be reconsidered only through a new preregistered decision.

Native messaging was rejected as the sole browser path because it requires
browser-specific extension installation and policy integration. It may inform
future deployment research but is not a fallback.

WebSocket was rejected for the initial contract because bidirectional framing,
upgrade handling, long-lived connection ownership, proxy behavior, and replay
state add complexity that bounded HTTP request and response operations do not
need.

Custom URI schemes were rejected for transporting secrets or model bytes.
They have difficult browser UX, logging, quoting, and handler-substitution
boundaries.

Downloading scripts or instruction files was rejected because it transfers
operational burden and security decisions to the user while failing to deliver
the requested working model.

An in-browser hosted conversion service was rejected because prompts or model
bytes must not be sent to a TinyRustLM, MiniModel, or other project-operated
backend.

## Authoritative Evidence

**Observed local fact**: the current managed solution passes 252 tests: 125
Companion, 86 Core, and 41 package-boundary tests, with zero failures or skips.
Its Release build completes with warnings treated as errors, reports zero
warnings and errors, and has no formatting drift. The complete standard Node
partition passes 1,702 tests, fails zero, and retains three declared skips
across 1,705 tests. It includes the
current registration, cross-language vector, browser contract, documentation,
release-closure, and real Chromium smoke boundaries. Diff hygiene passes.

The Companion tests include real IPv4 TCP exchanges for exact bind, Host and
Origin authority, CORS preflight, pairing, authenticated status, application
errors, sequence replay, rotation lost-response replay, revocation, duplicate
Content-Length, malformed framing, request-line, header-count, header-byte,
and global-body parser limits. They also cover request v2, operation v3,
projection v2, vector v2, explicit attempt identity, source-only authority,
private execution/source-evidence linkage, cross-root journal isolation,
ancestor/descendant custody rejection, ten-way cancellation binding, terminal
race precedence, reference-counted exact-key mutation-gate reclamation,
bounded cancellation-gate wait, one-record current-cache recovery,
pre-mutation current-cache repair,
canonical source-inventory derivation and drift rejection,
complete member hashing, fixed-chunk assembly, concurrent reads, and final
mutation rejection.

The detailed current checkpoint is
`wiki/runtime-mirust/reports/tinyrustlm-companion-source-operation-contract-memory-2026-08-28.md`.

The private host accepts no arguments, derives one
`TinyRustLM.Companion` directory below the current user's local application
data root, and refuses redirected or noninteractive output before creating
state. A captured launch returned only
`tinyrustlm-companion-host-failed:interactive-output-required`, exit code 2,
and left the previously absent root absent. A successful interactive host run
has not yet been promoted as physical release evidence.

Three bounded failures remain preserved outside Git: the RFC-valid leading-zero
Content-Length overconstraint (6,098 bytes, SHA-256
`c8745b95dd8f162ad9044aaa905735be2c32405a0fa40f8b48ec6a3e5e5a6c7f`),
the accidental preflight exposure header (5,089 bytes, SHA-256
`25ce5f560515d75a9cd64e10ad41004c4eb73b57d90235eaf099d4755469b4f2`),
and application ownership of the global body-limit 413 (5,570 bytes, SHA-256
`709ff032082548eaafb712a6d1e4314aa93aed8461d3a5772847964849965a64`).
Each produced a general regression test before its scoped correction. None is
campaign, model, browser, or release evidence.

The exact complete conversion profile is
`tinyrustlm.qwen3-complete-composition-conversion/4` at SHA-256
`19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8`.
It binds only model producer `tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/2`
and model receipt schema `tinyrustlm.qwen3_conversion_receipt.v2`, plus
Tokenizer2 producer `tinyrustlm.qwen-bytelevel-to-tokenizer2/2` and tokenizer
receipt schema `tinyrustlm.qwen_tokenizer2_conversion_receipt.v2`; no prior
producer, filename suffix, receipt, or composition identity is accepted by the
transport owner.

The architecture inventory test requires this ADR to remain accepted,
decision-specific, and complete. The package and browser contract tests reject
the removed instruction-download and public host paths.

**Local verification required**: current tests prove the local listener and
raw HTTP behavior, but do not prove a deployable browser client, browser Local
Network Access permission, a physical interactive host ceremony, real source
acquisition, operation dispatch, six-artifact streaming, browser admission, an
installation archive, or public release. A deterministic converter fixture is
not real-model proof.

## Threat Analysis

The primary remote threats are hostile public origins, CSRF, DNS rebinding,
Host substitution, Origin ambiguity, capability theft, capability replay,
operation guessing, stale tabs, malicious service workers, extensions,
oversized requests, slow requests, parser differentials, request smuggling,
response splitting, and resource exhaustion.

The primary local threats are port squatting, Companion impersonation,
symlink or reparse substitution, arbitrary-path access, process-argument
injection, environment leakage, crash-dump leakage, stale owned roots, partial
conversion, corrupted terminal evidence, and concurrent operation mutation.

Mitigations are exact numeric loopback binding, exact Host and Origin checks,
explicit proof-of-possession pairing, short-lived memory-only session keys,
per-request and per-response proofs, strict sequence replay defense, closed
routes, strict duplicate-rejecting JSON, no shell execution, create-only owned
roots, immutable operation identity, streamed hashing, bounded resources,
typed errors, and terminal-state immutability.

Same-user malware can read another process or browser under many operating
system configurations and is not solved by loopback HTTP. The design still
minimizes ambient authority and never returns administrator, workspace, cloud,
signing, or MemoryEndpoints credentials to the browser.

## Performance Evidence

No production transport performance is claimed. The current managed tests use
small deterministic process fixtures and do not establish startup latency,
stream throughput, peak RSS, connection capacity, hashing cost, cancellation
latency for a real model, or browser persistence cost.

Promotion requires measured first-response latency, steady streaming
throughput, hashing throughput, memory, CPU, file-handle count, cancellation
latency, and restart behavior for one real six-artifact composition on each
claimed operating system and browser profile.

Performance must not weaken identity checks, buffer the model in one managed
allocation, omit browser rehashing, keep unbounded connections, or introduce a
less secure fallback route.

## Compatibility Impact

TinyRustLM is prelaunch and has one product generation. There is no prior
Companion protocol to support. Technical schema identifiers carry exact
contract identity and do not imply a second product generation.

No legacy route, deprecated route, response-repair reader, alternate host,
package alias, dual listener, migration endpoint, script handoff, or old
SeedHost behavior is retained.

Browsers and operating systems are supported only after the exact current
build passes the registered physical matrix. Unsupported environments receive
a truthful unavailable state rather than another protocol.

## Clean Deletion Impact

The accepted Companion is the sole local serving boundary. No parallel host,
script handoff, executable-discovery path, browser fixture, package lane,
command family, route family, test lane, documentation lane, or deployment job
may implement the same responsibility.

Any experimental transport that loses promotion is deleted before launch with
its route registration, installer changes, tests, secrets, and documentation.
It is not left behind a feature flag.

## Unknowns

**Local verification required**: exact Chrome, Edge, Firefox, and WebKit mixed-
content and Private Network Access behavior must be observed against the
selected numeric loopback origin from the production HTTPS site.

The browser discovery and explicit-connect ceremony, current production
headers, Local Network Access permission, fixed-chunk transfer, browser
streaming and rehash, interactive host lifecycle, and multi-user isolation
still require physical verification. The local listener's selected-port,
pairing, session, rotation, revocation, CORS, and parser behavior are covered
by deterministic real-TCP tests only.

Windows firewall prompts, endpoint security products, enterprise proxies,
Linux sandboxing, IPv6 availability, sleep and resume, port collision, browser
restart, Companion restart, and OS restart need physical evidence.

The source-acquisition owner, peer-discovery authority, and authenticated
process-ownership protocol for an absent or nonterminal conversion root remain
separate implementation gates. MemoryEndpoints is authorized and strongly
recommended for portable continuity, but it is outside this transport and has
no authenticated live campaign receipt.

## Acceptance Tests

1. Keep the exact route, schema, header, origin, proof, size, timeout,
   concurrency, and error registration immutable before comparative server
   output.
2. Prove the listener binds only `127.0.0.1`, never IPv6, a wildcard, LAN,
   public interface, or substituted hostname.
3. Reject wrong or duplicate Host, Origin, method, route, media type, field,
   capability, operation, sequence, range, and framing.
4. Prove pairing requires explicit user action and session keys expire,
   rotate, revoke, never cross the wire, and resist replay across origins and
   operations.
5. Stream all six exact members with bounded memory and independently verify
   length and SHA-256 in the browser before one atomic activation.
6. Exercise P2P success, no-peer source conversion, native rejection,
   cancellation, lost response, duplicate request, process crash, browser
   crash, Companion restart, and machine-restart recovery.
7. Scan URLs, headers, logs, traces, screenshots, browser storage, profile
   files, command lines, environment, and crash artifacts for secrets, prompts,
   private paths, and model-byte leakage.
8. Run clean-profile Chromium, Edge, Firefox, and WebKit tests at supported
   desktop and mobile viewports with exact production-origin mapping.
9. Execute signed Companion archives on every RID claimed as executed and
   independently read back published bytes and checksums before install UI is
   enabled.
10. Keep all campaign counters at zero unless separate live receipt gates are
    satisfied.

## Rollback

Because the product is prelaunch, rollback means deleting an unpromoted
transport implementation and returning the browser to a truthful unavailable
state. It never means restoring SeedHost, an instruction download, a hosted
model proxy, a compatibility endpoint, or an unverified listener.

Immutable failed registrations, raw test evidence, and typed rejection history
remain preserved. A replacement transport requires a new output-free
registration and must pass the full acceptance matrix before it can become the
sole implementation.

No real model, browser conversation, public peer lane, Companion release, or
site deployment is claimed by this decision. Campaign counters remain 0/20,
0/50, 0/25, 0/40, and 0/20.

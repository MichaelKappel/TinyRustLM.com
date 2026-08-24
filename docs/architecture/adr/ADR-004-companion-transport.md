# ADR-004: Companion Transport

## Status

Accepted

The protocol family and security invariants are accepted. Exact route schemas,
limits, installation discovery, and pairing bytes must still be preregistered
and physically verified before a listener is implemented or exposed.

## Decision Date

2026-08-24

## Scope

This decision governs the private user-owned Companion boundary used by
TinyRustLM.com for verified direct-peer acquisition, reviewed source
conversion, progress, cancellation, and complete composition transfer.

It does not authorize model-byte proxying through a project site, public P2P
announcement, MemoryEndpoints access, arbitrary local file access, arbitrary
process execution, model-quality claims, or a released installer.

**Observed local fact**: the nonpackable `TinyRustLM.Companion` component owns
the strict `tinyrustlm.companion.acquire.v1` request, the strict
`tinyrustlm.companion.operation.v2` record, the private create-only
`tinyrustlm.companion.source-conversion-intent.v1` envelope, an owned
create-only journal, and a source coordinator that invokes only the complete
`qwen3-composition` transaction. The coordinator can independently reconcile a
strict terminal pass or rejection from the exact bound intent after process
loss, but it does not infer, adopt, relaunch, or kill work for an absent or
nonterminal root. No loopback listener or browser capability implementation
exists. No current route table or port is release authority.

## Decision

**Engineering decision**: the Companion will expose one closed HTTP/1.1
capability protocol over explicit loopback listeners. IPv4 binds exactly
`127.0.0.1`; an IPv6 listener, when enabled and tested, binds exactly `::1`.
The process never binds a wildcard, LAN address, public address, or hostname.

The listener accepts only an exact registered Host value for its active
loopback endpoint and an exact registered `Origin` value for TinyRustLM.com.
Missing, duplicated, malformed, opaque, `null`, unpaired development, or
unexpected Origin values fail before route dispatch. DNS names are not treated
as proof of loopback identity.

The protocol uses explicit user pairing and short-lived origin-bound bearer
capabilities. Capabilities are carried in a request header, never in a URL,
cookie, referrer, command line, report, screenshot, or durable browser store by
default. Pairing, capability issue, rotation, expiry, revocation, and replay
semantics are part of the future output-free registration.

The route table is closed and versioned. Unknown method, path, media type,
schema, field, operation, state, sequence, artifact kind, range, or capability
fails with one bounded public-safe error. There is no generic file route,
directory route, proxy route, command route, environment route, diagnostics
dump, or extension route.

Acquisition is P2P-first only when the requested immutable composition has a
currently eligible peer candidate and exact evidence. Otherwise, explicit
source-acquisition consent permits the pinned public source and sole canonical
converter path. A TXT, JSON, PowerShell, shell, README, conversion kit, or
instruction download is never a model action.

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

**Observed local fact**: the current managed solution passes 163 tests: 80
Core tests, 38 package-boundary tests, and 45 Companion tests. These tests prove
strict complete-conversion orchestration, immutable-request and intent tamper
rejection, operation-v2 hash invariants, terminal pass and rejection
reconciliation, pending-root immutability, process-tree cancellation races,
pre-cancel nonlaunch, typed process-start failure, live-violation
non-laundering, and fixture evidence retention.

The exact complete conversion profile is
`tinyrustlm.qwen3-complete-composition-conversion/1` at SHA-256
`2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158`.

The architecture inventory test requires this ADR to remain accepted,
decision-specific, and complete. The package and browser contract tests reject
the removed instruction-download and public host paths.

**Local verification required**: no current test proves an HTTP listener,
browser pairing, CORS behavior, Private Network Access behavior, DNS-rebinding
resistance, real source acquisition, real artifact streaming, installation,
or public release. A deterministic converter fixture is not real-model proof.

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
explicit pairing, short-lived least-privilege capabilities, closed routes,
strict duplicate-rejecting JSON, no shell execution, create-only owned roots,
immutable operation identity, streamed hashing, bounded resources, typed
errors, and terminal-state immutability.

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

The deterministic installation-discovery mechanism, selected port lifecycle,
pairing ceremony, capability lifetime, CORS header set, preflight behavior,
range policy, response streaming primitive, and multi-user isolation require
output-free preregistration before implementation.

Windows firewall prompts, endpoint security products, enterprise proxies,
Linux sandboxing, IPv6 availability, sleep and resume, port collision, browser
restart, Companion restart, and OS restart need physical evidence.

The source-acquisition owner, peer-discovery authority, and authenticated
process-ownership protocol for an absent or nonterminal conversion root remain
separate implementation gates. MemoryEndpoints is unauthorized and
disconnected.

## Acceptance Tests

1. Register exact route, schema, header, origin, capability, size, timeout,
   concurrency, and error contracts before comparative server output.
2. Prove listeners bind only `127.0.0.1` and explicitly tested `::1`, never a
   wildcard, LAN, public interface, or substituted hostname.
3. Reject wrong or duplicate Host, Origin, method, route, media type, field,
   capability, operation, sequence, range, and framing.
4. Prove pairing requires explicit user action and capabilities expire,
   rotate, revoke, and resist replay across origins and operations.
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

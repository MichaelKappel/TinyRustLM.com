# ADR-004: Companion Transport

## Status

Accepted. One canonical companion contract is implemented for its exact IPv4
loopback profile.
Broader browser, operating-system, IPv6, and native-inference claims remain
unpromoted until target execution evidence exists.

## Decision Date

2026-08-08

## Scope

This ADR defines the browser-to-desktop-companion transport, trust boundary,
pairing, capability, framing, and streaming profile. It does not define public
P2P serving, MemoryEndpoints, arbitrary local automation, or model semantics.

## Decision

The browser uses ordinary Fetch over HTTP/1.1 to the explicit numeric endpoint
http://127.0.0.1:43127. The closed, unversioned route table is the sole
companion interface. The browser does not scan ports or contact loopback before
explicit user action.

The protocol permits only GET, POST, and CORS OPTIONS generated for its closed
route table. It has:

- exact Host validation for 127.0.0.1 and the configured port;
- an exact approved HTTPS Origin allowlist;
- explicit CORS response headers and no wildcard origin;
- no cookies, ambient browser authentication, URL credentials, or query
  credentials;
- one host-visible, expiring, single-use pairing code;
- origin-bound, short-lived capabilities with exact scopes;
- capability rotation and revocation;
- replay identifiers for mutations;
- bounded JSON request and response bodies with exact fields;
- typed bounded error codes;
- complete model and composition streams with exact byte count and SHA-256
  headers;
- cancellation and durable operation status for imports and conversions.

Model acquisition is P2P-first. When no complete identity-matched peer offer
can be used, the same companion downloads the pinned reviewed source revision,
converts it, revalidates the artifact and composition, stores them locally,
and streams the usable result into the browser. The browser never downloads a
TXT, README, JSON request kit, shell script, or PowerShell handoff for the user
to run.

Long operations use bounded polling of durable operation status. Byte payloads
use Fetch response streams. The baseline does not use WebSocket, WebTransport,
server-sent events, gRPC-Web, custom URL schemes, or a browser extension.

The route table exposes no arbitrary path, shell command, process control,
generic HTTP proxy, credential store, or remote desktop function. Public P2P
listeners are separate processes and contracts; the loopback bridge never
becomes a public listener.

Local Network Access request metadata may be used where a qualified browser
requires it, but it is not treated as a universal capability. Browser support
is named only from physical tests.

## Alternatives

- **WebSocket** was rejected because the current operation model needs
  request/response, bounded polling, and streaming bodies, not an extra
  bidirectional framing and origin surface.
- **WebTransport** was rejected because it adds certificate, availability, and
  implementation complexity without a measured first-release benefit.
- **Native messaging or a browser extension** was rejected because it creates
  browser-vendor packaging and privileged extension boundaries.
- **Custom URL schemes and downloaded handoff files** were rejected because
  they create confusing, spoofable, non-idempotent user workflows.
- **HTTPS loopback with a locally minted certificate** was rejected for the
  current profile because certificate enrollment and trust-store mutation add
  material risk. Any future change needs a new ADR.
- **Automatic port discovery** was rejected because it expands cross-origin
  probing and ambiguous-host behavior.

## Authoritative Evidence

- **Observed local fact**: tinyrustlm/app/companion-bridge.js accepts only
  http://127.0.0.1:43127 and the canonical closed route table.
- **Observed local fact**:
  dotnet/src/TinyRustLM.SeedHost/SeedHostBridgeServer.cs implements
  loopback-only HTTP/1.1, exact Host and Origin checks, scoped sessions, closed
  routes, and complete artifact/composition streaming.
- **Observed local fact**: automated .NET package, core, and SeedHost tests
  exercise the protocol and security policy.
- **Sourced public fact**: Fetch and CORS remain browser-enforced boundaries;
  Local Network Access is an evolving WICG specification at
  https://wicg.github.io/local-network-access/.
- **Engineering decision**: the smallest closed HTTP surface meets the current
  product requirements.
- **Local verification required**: every promoted browser/OS pair needs a real
  installed-companion test; compilation and unit tests are insufficient.

## Threat Analysis

Threats include DNS rebinding, hostile websites on the same browser, forged
Host or Origin, CORS confusion, pairing-code theft, capability replay, stale
capabilities, oversized or slow bodies, route traversal, arbitrary file
access, operation-ID guessing, response smuggling, port collision, and public
listener exposure.

The server must bind loopback before readiness, validate one Host and one
Origin header, reject duplicate security headers, impose request/header/time
limits, consume pairing atomically, hash capabilities at rest where persisted,
bind every operation to the authorized session and scope, and return
path-free public-safe inventory. Mutations require replay protection.

No token, pairing code, source request, prompt, model path, or model byte may
enter logs, URLs, screenshots, release receipts, or project servers.

## Performance Evidence

Existing tests prove behavior, not production throughput. Promotion of large
model acquisition requires measured:

- streaming throughput and CPU utilization;
- peak browser, companion, and operating-system memory;
- conversion progress cadence and polling overhead;
- cancellation latency;
- restart and resume cost;
- one, five, and twenty model inventory behavior.

The browser and companion must stream bounded chunks without constructing a
second complete in-memory model. Poll intervals must be bounded and must stop
on completion, cancellation, session loss, or page disposal.

## Compatibility Impact

The unversioned route table is the only browser bridge contract. There are no
versioned route aliases, request-file transports, scripts, migration readers,
or silent fallback transports. Every maintained browser, companion, test, and
dogfood client changes together.

IPv6 loopback, another port, another browser transport, or native inference
commands require an explicit revised profile and new evidence. Failure to
reach the companion leaves browser-local file import available; it does not
activate a hidden transport.

## Clean Deletion Impact

The retired conversion-kit, import-kit, share-kit, README, TXT, JSON handoff,
shell, and PowerShell browser workflows are deleted and guarded by tests.
Protocol cutover also removes old route handlers, compatibility field names,
unused scopes, and documentation that asks a user to run generated files.

## Unknowns

- Stable Local Network Access behavior across the declared Chromium, Firefox,
  and WebKit matrix.
- Physical Linux and macOS packaging behavior if those operating systems are
  promoted.
- Whether native inference needs additional narrowly scoped routes after the
  model/runtime ABI is finalized.
- Operator-approved update and downgrade controls for the installed companion.

## Acceptance Tests

1. Wrong Host, Origin, port, method, route, scope, capability,
   pairing code, replay ID, and duplicate header fail closed.
2. DNS names and non-loopback endpoints are rejected by the browser client.
3. Oversized, malformed, slow, truncated, and extra-field JSON fail with
   bounded errors.
4. Pairing is single-use under concurrent attempts; rotation invalidates the
   predecessor and revocation terminates access.
5. Import and conversion survive process restart through identity-bound
   durable journals or report a typed resumable state.
6. Artifact and composition streams match declared byte counts and SHA-256
   identities before browser activation.
7. Browser acquisition triggers zero file downloads and zero project-site
   model-byte or prompt requests.
8. Physical browser/OS tests cover install, pair, acquire, cancel, resume,
   revoke, and clean uninstall before support is claimed.

## Rollback

Rollback reverts the browser assets and companion package as one
content-addressed release pair and revokes sessions issued by the replaced
pair. It never adds route aliases or handoff-file workflows. Models already
verified in the local store remain inert data until the selected release
revalidates them.

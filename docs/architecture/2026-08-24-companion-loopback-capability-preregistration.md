# Companion Numeric-Loopback Capability Preregistration

## Decision Status

Registered before implementation and before comparative transport output.

The machine-readable authority is
`contracts/vnext/companion-loopback-capability-preregistration.v1.json`, with
profile identity `tinyrustlm.companion.loopback-capability/1`. The registered
profile is 39,311 bytes and has SHA-256
`81e3f2f3795a51c0bce86e1aca66f6a7234608a3dd044cd7a9b1cbbf90c9ba77`.
It binds the preimplementation parent commit
`480a22c58d1acedcb5e83d36bfa0ea75e43041b6` and tree
`46f15125f6d9b02a6582dcdb78b0dd5641cc884b`.

This registration does not start a listener, bind a port, generate a pairing
secret, create a browser session, serve an artifact, create an operation,
convert or activate a model, build or publish a package, deploy a site, contact
MemoryEndpoints, or advance a campaign counter.

## Evidence Classes

### Directly Observed Local Facts

At the registered parent, `TinyRustLM.Companion` owns strict acquisition
requests, operation-v2 records, create-only operation journals, source
conversion intents, complete six-artifact conversion coordination, and
terminal reconciliation. It has no HTTP listener or process host.

The browser still contains the superseded `companion-bridge.js` design. That
design uses fixed port 43127, an unauthenticated health probe, a bearer
capability returned over the wire, a broader old route family, and
`BroadcastChannel` state. This registration does not adapt that design. It
registers both the old browser module and its test for deletion and registers a
single replacement browser owner, `companion-capability.js`.

The registered source closure records the exact byte length and SHA-256 of 18
parent-tree files. An invariant test reconstructs those bytes with `git show`
from the registered parent rather than trusting mutable working-tree files.

### Sourced Public Facts

The Fetch Living Standard defines Fetch, Origin, CORS, and preflight behavior.
The current Local Network Access draft describes user-mediated access from a
public site to local and loopback address spaces. Chrome's current launch
documentation describes Local Network Access permission and states that the
older Private Network Access preflight approach is paused. Secure Contexts
classifies numeric loopback addresses as potentially trustworthy. Web Crypto
Level 2 exposes cryptographic random generation, SHA-256, HMAC-SHA-256, and
HKDF-SHA-256. RFC 5869 defines HKDF. RFC 9112 defines HTTP/1.1 message framing
and the ambiguity that strict parsing must reject. ASP.NET Core 8 Kestrel
documents endpoint binding and server limits.

These sources support the design inputs. They do not prove that any browser,
site header, OS package, endpoint security product, or deployed Companion
actually works with this protocol.

### Engineering Decisions

The exact transport, cryptographic transcripts, route set, limits, browser
storage boundary, artifact-transfer behavior, implementation ownership, and
tests below are preregistered engineering decisions. They are intentionally
narrower than the maximum behavior allowed by the underlying standards.

### Facts Requiring Local Or Physical Verification

Kestrel parser behavior must be tested with raw sockets, not inferred from
configuration alone. Current Chromium, Edge, Firefox, and WebKit behavior must
be observed from clean profiles against the production HTTPS origin and the
numeric loopback endpoint. The production CSP and Permissions Policy must be
read back over public HTTPS. Windows and Linux installation ownership must be
physically verified. Model transfer, activation, native inference, browser
WASM inference, quality, P2P reachability, package publication, and site
deployment remain separate gates.

## Product And Authority Boundary

TinyRustLM is one prelaunch product. Technical `/1` route and `.v1` schema
identities are contract identities, not product generations. There is no
legacy protocol to preserve and no compatibility reader, migration writer,
alias, fallback, response repair, retry selection, best-of-N selection,
instruction-file handoff, or hosted model proxy.

Only `https://tinyrustlm.com` is an admitted production browser origin.
MemoryEndpoints is unauthorized and disconnected. Prompts are outside this
transport. The Companion never returns cloud, workspace, signing,
administrator, or MemoryEndpoints credentials.

## Transport Selection

The process host will use ASP.NET Core 8 Kestrel through
`Microsoft.AspNetCore.App`. It will expose HTTP/1.1 only and bind exactly
`127.0.0.1` on operating-system-assigned port zero. The bound port must be in
1024 through 65535 and must be known before the pairing code is displayed.

The first implementation has no IPv6 listener. It does not bind `localhost`,
`::1`, a wildcard, a LAN address, or a public address. It does not scan ports,
reserve a fixed port, accept proxy or forwarded headers, or expose TLS,
HTTP/2, HTTP/3, WebSocket, WebTransport, compression, or a Server header.

Only origin-form request targets with a literal registered path are admitted.
Queries, fragments, percent-encoded paths, absolute-form, authority-form, and
asterisk-form targets are rejected. Every response closes the connection.

The browser never probes loopback on page load, startup, from a service worker,
or before an explicit Connect action. An unsupported or denied browser gets a
truthful unavailable result, not another protocol.

## Installation And Process Identity

The host root contains one create-only canonical `installation.json` record
using schema `tinyrustlm.companion.installation.v1`, UTF-8 without a BOM, one
final LF, and at most 4,096 bytes. The installation ID is 16 cryptographically
random bytes encoded as 32 lowercase hexadecimal characters. A reinstall
creates a new installation ID.

Each process creates a separate nondurable 16-byte process-instance ID. On
Windows, the root ACL admits only the current user and SYSTEM. On Linux, the
root is mode `0700` and the file is mode `0600`. A shared-machine service,
permission drift, or a missing installation record in a nonempty host root
causes startup rejection. No migration is attempted. The installation record
contains no secret.

## Explicit Pairing Ceremony

After the exact bind succeeds, an interactive, nonredirected Companion output
may display exactly one code with grammar:

```text
TRLC1:{decimal-port}:{base64url-no-padding-32-byte-secret}
```

The exact regular expression is
`^TRLC1:([1-9][0-9]{3,4}):([A-Za-z0-9_-]{43})$`. The browser performs no
normalization. The 32-byte secret comes from a cryptographic random-number
generator, lives for 300 seconds, remains process memory only, and is never
placed in HTTP, a URL, command line, environment variable, log, report,
screenshot, trace, or browser store. The browser clears the code from the DOM
immediately after parsing it.

Pairing has two HTTP exchanges:

1. `POST /tinyrustlm-companion/1/pairings/begin` sends a strict 2,048-byte-or-
   smaller request containing schema, a 16-byte lowercase-hex claim ID, and a
   32-byte browser nonce. It never sends the pairing secret.
2. The server returns installation, process, claim, nonce, session, epoch, and
   expiry data plus an HMAC-SHA-256 server proof under the pairing secret. The
   proof covers the exact Host and Origin.
3. The browser verifies that proof locally, derives a 32-byte session key with
   HKDF-SHA-256, and sends a strict completion request carrying a browser proof
   under that derived key.
4. The first valid completion atomically consumes the pairing secret and
   creates exactly one session. The response is proven with the derived key;
   the browser must verify it before reporting Connected.

An exact begin replay returns the stored begin response. Reusing a claim ID
with changed bytes returns `pairing-claim-conflict`. An exact completion replay
may recover its stored response for 60 seconds. A different completion after
consumption returns `pairing-consumed`. Neither begin nor an invalid browser
proof consumes the secret. At most four pending claims exist, each for 30
seconds, with eight begin and eight completion requests per minute.

This proof-of-possession exchange prevents a process that merely squats on the
displayed port from impersonating the selected Companion without the secret.
The pairing secret and derived session key never cross the wire.

## Cryptographic Encoding

.NET randomness uses `RandomNumberGenerator.Fill`; browser randomness uses
`crypto.getRandomValues`. Hashing is SHA-256, message authentication is
HMAC-SHA-256, and derivation is HKDF-SHA-256 under RFC 5869. Proofs encode
exactly 32 bytes as base64url without padding and compare in constant time.

Every transcript is domain separated and consists of ordered UTF-8 fields,
each prefixed by its unsigned 32-bit big-endian byte length. No field exceeds
65,536 bytes. Distinct frozen domains exist for server pairing proof, browser
pairing proof, pairing completion, session-key derivation, request proof,
response proof, and rotation-key derivation. Concatenating unframed strings or
serializing an implementation-dependent object is not conforming.

## Session Request And Response Proofs

A session has a random 16-byte lowercase-hex ID, an eight-hour absolute
lifetime, a 15-minute idle lifetime, and a 15-minute key epoch. At most four
sessions exist. Epochs are limited to 64. Sequence numbers begin at 1, accept
only the exact next value, and stop at 1,000,000 per epoch. One authenticated
request may be in flight per session, with at most 600 authenticated requests
per minute.

Authenticated requests carry:

```text
X-TinyRustLM-Session
X-TinyRustLM-Epoch
X-TinyRustLM-Sequence
X-TinyRustLM-Content-SHA256
X-TinyRustLM-Request-Proof
```

The request proof covers, in frozen order, the request-proof domain, protocol,
installation, process, session, decimal epoch, decimal sequence, method, exact
Host, exact Origin, path, content type or empty string, decimal content length,
and SHA-256 of the exact transferred body bytes.

Authenticated responses echo session, epoch, sequence, content hash, and a
response proof. That proof covers the response-proof domain, protocol,
installation, process, session, epoch, sequence, request method, request path,
status, content type, response length, and response-body hash. The browser
trusts no authenticated response until it independently hashes the body and
verifies the proof.

There is no cookie, Authorization header, bearer token, durable browser key,
cross-tab key transfer, or service-worker key transfer. The key remains in
private JavaScript memory. Browser or Companion restart requires new pairing.
The server monotonic clock, not the browser wall clock, controls expiry.

## Rotation And Revocation

Rotation is a two-phase begin and commit exchange. Begin is authenticated by
the current key and binds a rotation ID and browser nonce. The server returns a
server nonce and current and next epochs. Commit requires both old-key request
authentication and proof under the newly derived key. The committed response
is proven by the new key.

Only one rotation may be pending for 120 seconds. After commit, the old key can
recover only the exact commit response for 30 seconds; every other old-key
request is revoked. The browser retains old and new keys until it verifies
commit. A lost response is recovered by exact commit replay or a status probe
with the new key, never by creating a second rotation.

Revocation is an authenticated POST that binds a revocation ID. The server
materializes a response proven by the current key and then erases the key.
Later requests return `capability-revoked`. Process restart invalidates all
sessions without requiring durable revocation state.

## Closed Route Table

The only routes are:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/tinyrustlm-companion/1/pairings/begin` | Obtain a server proof without exposing the pairing secret |
| POST | `/tinyrustlm-companion/1/pairings/complete` | Prove browser possession and atomically create one session |
| GET | `/tinyrustlm-companion/1/session` | Read the authenticated current session state |
| POST | `/tinyrustlm-companion/1/session/rotation/begin` | Begin one key rotation |
| POST | `/tinyrustlm-companion/1/session/rotation/commit` | Commit a proven new epoch key |
| POST | `/tinyrustlm-companion/1/session/revoke` | Revoke and erase the current session key |
| POST | `/tinyrustlm-companion/1/operations` | Create or recover one deterministic acquisition operation |
| GET | `/tinyrustlm-companion/1/operations/{operation-id}` | Read a public-safe journal projection |
| POST | `/tinyrustlm-companion/1/operations/{operation-id}/cancel` | Apply one idempotent cancellation intent |
| GET | `/tinyrustlm-companion/1/operations/{operation-id}/artifacts/{artifact-role}/chunks/{chunk-index}` | Transfer one verified fixed chunk |

Unknown methods, paths, schemas, fields, media types, operation IDs, artifact
roles, chunk indexes, or headers fail closed. No generic health, file,
directory, command, environment, proxy, diagnostic-dump, or extension route
exists.

## Acquisition And Projection

Operation creation accepts only the current strict
`tinyrustlm.companion.acquire.v1` request. Its canonical request hash produces
the deterministic lowercase-hex SHA-256 operation ID. Repeating the same
canonical request returns the same operation and current projection. The host
does not choose a preferred result, retry, or second logical operation after a
lost response.

The public projection schema is
`tinyrustlm.companion.loopback.operation-projection.v1`, with only schema,
operation ID, sequence, state, branch, completed bytes, total bytes, artifact
identities, and a bounded error code. It comes only from a validated operation
journal and contains no private path, source URL, prompt, or secret.

Cancellation binds one cancellation ID. Exact replay is idempotent. Terminal
evidence remains authoritative in a race, and a different cancellation after
terminal state returns `operation-terminal`.

## Six-Artifact Transfer

Transfer is available only after the operation is strictly `Available` and is
limited to these roles in order: composition, model, tokenizer, template,
sampling, and prompt. A browser path never selects a local filesystem path.
The Companion resolves each file only from the validated journal identity and
requires a regular, direct, non-reparse file.

Chunks are fixed at 4 MiB, except for the final positive remainder. The index
is shortest-form unsigned decimal without a leading zero. Range, multipart,
HEAD, arbitrary chunk size, and best-chunk retry selection are forbidden. Each
response exposes the artifact identity, artifact length, chunk index and
count, offset and length, exact chunk hash, and a session response proof.

Before the first chunk, the Companion rehashes the complete artifact. After
the final chunk, it rechecks the artifact identity. The browser hashes every
chunk and every complete artifact. A partial, repeated, corrupt, drifted, or
wrong-role artifact never activates. All six complete identities must be
present before one atomic Rust activation. Resume requests only the next
missing verified chunk under the same operation and artifact identity.

Each artifact is limited to 64 GiB, the six-member composition to 68 GiB, and
one artifact to at most 16,384 chunks. These are rejection limits, not target
model sizes.

## Browser Security Boundary

The production page initiates Fetch only in the top-level window after an
explicit user action. Every request uses `mode: "cors"`,
`credentials: "omit"`, `cache: "no-store"`, `redirect: "error"`,
`referrerPolicy: "no-referrer"`, and `keepalive: false`. Web Crypto is
mandatory.

The pairing code and key never enter localStorage, sessionStorage, IndexedDB,
Cache Storage, OPFS, a service worker, BroadcastChannel, URL, console, error,
trace, or screenshot. The nonsecret operation ID may be persisted as bounded
resume metadata. A page refresh or browser restart deliberately loses the key
and requires a new ceremony.

The production site must serve CSP `connect-src` authority for
`http://127.0.0.1:*` and Permissions Policy `loopback-network=(self)`. Their
exact deployed values must be read back before the Connect control is enabled.
This design uses current browser-mediated Local Network Access permission. It
does not accept or emit the paused legacy Private Network Access request or
response headers.

## Origin, CORS, And DNS-Rebinding Defense

The server compares the serialized Origin exactly with
`https://tinyrustlm.com` and Host exactly with `127.0.0.1:{bound-port}` before
route dispatch. Missing, duplicated, `null`, malformed, development, hostname,
wrong-port, or substituted values fail. Forwarded and proxy headers are not
authority.

Preflight accepts OPTIONS only for a registered route, exact Host, exact
Origin, an allowed method, and a subset of the registered script headers. It
does not mutate state and caches for at most 300 seconds. The response uses an
exact `Access-Control-Allow-Origin`, no credentials flag, and `Vary: Origin`.
Host or Origin failures do not receive CORS headers.

This boundary limits hostile-origin and DNS-rebinding access. It does not
claim to defeat same-user malware, a compromised browser, or an extension with
equivalent local authority.

## HTTP Parser And Resource Limits

The server enforces a 2,048-byte request line, 32 headers, 16 KiB aggregate
headers, 64 KiB request body, JSON depth 16, 4 KiB JSON strings, eight
concurrent connections, five-second headers timeout, ten-second request-body
and control-response timeouts, and a 60-second chunk-response timeout.

POST requires one exact Content-Length. Every response has exact
Content-Length. Transfer-Encoding, Content-Length plus Transfer-Encoding,
duplicate security headers, obs-fold, trailers, upgrades, Expect, compressed
responses, redirects, and cookies are rejected. Raw-socket tests must prove
that Kestrel and middleware enforce these decisions before dispatch.

Errors are at most 256 bytes and contain only schema
`tinyrustlm.companion.loopback.error.v1` and one registered stable code. They
never reflect input, expose a raw exception, private path, credential, or
prompt. Authenticated errors are response-proven.

## Threat Model And Required Rejections

The tests must cover hostile origins, DNS rebinding, port squatting, Host
substitution, pairing replay, claim races, capability theft and replay, stale
tabs, sequence races, rotation loss, malicious service workers, oversized and
slow requests, parser differentials, request smuggling, path substitution,
symlinks and reparse points, artifact drift, partial files, operation guessing,
process restart, browser restart, and resource exhaustion.

Security-sensitive duplicate headers are rejected. The server admits only the
registered browser header vocabulary and rejects Cookie, Authorization,
Referer, Forwarded, X-Forwarded variants, Proxy-Authorization, and unknown
headers. This allowlist must be validated against real clean-profile browser
traffic; necessary current user-agent headers may be added only through a new
output-free registration, not permissive runtime acceptance.

## Implementation Ownership And Clean Replacement

The implementation is registered as five new Companion units for protocol,
pairing, session state, server ownership, and artifact transfer; one private
`TinyRustLM.CompanionHost` executable; three .NET test units; one browser
capability module; and one browser unit-test module. The Companion project,
solution, app composition, HTML, browser E2E suite, transport ADR, and Companion
documentation are the only registered modifications.

`companion-bridge.js` and `companion-bridge.test.js` are deleted. Fixed port
43127, the health probe, bearer capability, BroadcastChannel state, old route
family, old global API, and any compatibility adapter are not retained.

## Verification Sequence

1. Pin this profile and decision by byte length and SHA-256.
2. Reconstruct and hash all 18 registered source files from the parent commit.
3. Prove every new implementation path was absent from the parent.
4. Commit and push only the output-free registration, then verify local,
   tracking, fresh-fetch, and direct-remote commit equality.
5. Implement transcript codecs and independent .NET/browser vectors before
   accepting server output.
6. Implement pairing, session, rotation, revocation, strict routing, and raw-
   socket parser tests.
7. Implement bounded artifact transfer and browser verification without model
   activation shortcuts.
8. Delete the superseded bridge in the same coherent cutover.
9. Run unit, integration, malformed-input, race, resource, secret-scan, and
   clean-profile physical browser gates.
10. Update product, operator, package, release, and deployment documentation
    only to the level physically proven.

## Claim Boundary

Passing registration tests proves only that an immutable design was recorded
before implementation output. Later unit tests may establish exact bind,
pairing-proof conformance, session-proof conformance, and bounded local
artifact transfer. They do not by themselves prove a real model, model
quality, native generation, production browser WASM generation, multi-turn
chat, public P2P reachability, signed package publication, site deployment,
MemoryEndpoints authorization, or campaign credit.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

## Unknowns And Stop Conditions

Implementation stops on transcript ambiguity, a browser that silently sends
unregistered authority-bearing headers, inability to suppress ambiguous HTTP
framing, secret persistence, inability to distinguish exact process or
installation identity, unbounded buffering, artifact path substitution, or a
need for a compatibility route. The design is corrected through a new
registration; tests are not weakened and failures are not repaired into pass.

Physical promotion remains blocked until clean-profile browser permission,
production header readback, package execution, and six-artifact transfer are
observed. A browser denial, unsupported API, endpoint-security block, or OS
ownership failure is reported truthfully and does not select another protocol.

## Primary Sources

- [Fetch Living Standard](https://fetch.spec.whatwg.org/), updated 2026-08-20,
  retrieved 2026-08-24.
- [Local Network Access Draft](https://wicg.github.io/local-network-access/),
  updated 2026-08-07, retrieved 2026-08-24.
- [Chrome Local Network Access permission](https://developer.chrome.com/blog/local-network-access),
  updated 2025-09-29, retrieved 2026-08-24.
- [Secure Contexts](https://w3c.github.io/webappsec-secure-contexts/), living
  draft, retrieved 2026-08-24.
- [Web Cryptography API Level 2](https://w3c.github.io/webcrypto/), living
  draft, retrieved 2026-08-24.
- [RFC 5869: HKDF](https://www.rfc-editor.org/rfc/rfc5869.html), May 2010,
  retrieved 2026-08-24.
- [RFC 9112: HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.html), June 2022,
  retrieved 2026-08-24.
- [ASP.NET Core 8 Kestrel endpoints](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/endpoints?view=aspnetcore-8.0),
  updated 2025-07-24, retrieved 2026-08-24.
- [ASP.NET Core 8 Kestrel options](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/options?view=aspnetcore-8.0),
  updated 2025-07-24, retrieved 2026-08-24.

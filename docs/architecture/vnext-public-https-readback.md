# TinyRustLM vNext Production HTTPS Exact Readback

## Decision

TinyRustLM has one clean-slate production HTTPS verifier at
`tinyrustlm/tools/vnext-public-https-readback.js`. It accepts the exact static
asset inventory and frozen security-header profile selected by one release
manifest, resolves one canonical public HTTPS origin, pins one publicly
routable address, and streams every response exactly once. A successful
return means only that this process observed the declared bytes and metadata
through production HTTPS.

This checkpoint does not create a receipt, authorize a release, prove that an
upload occurred, establish an independent outside-network observer, publish a
claim, change a campaign counter, or declare a site complete. Those are later
forward-only descendants in the release graph.

The sole frozen profile is
`contracts/vnext/public-https-readback-profile.v1.json`, with SHA-256
`0cfeb00065d45fd860813f501d6c07417f8a6e6587dd524a81e5be426a84c419`.
There is no compatibility reader, caller-selected profile, legacy alias,
fallback verifier, or permissive mode.

## Trust Boundary

The verifier owns DNS and HTTPS access. Its production operation accepts
exactly three input fields:

- `publicOrigin`, a canonical HTTPS root origin;
- `webAssets`, the complete sorted release inventory; and
- `webSecurityHeaderProfileBytes`, the exact canonical control document.

It does not accept a transport, resolver, response, body, clock, verdict,
expected-success bit, retry policy, or alternate profile from its caller. Node
DNS and HTTPS functions are captured when the module loads. Pure exported
metadata and body helpers exist for deterministic conformance tests, but they
cannot produce the production result schema or a campaign receipt.

The host process, operating-system resolver, system trust store, and current
module bytes remain trusted dependencies. The result binds the verifier source
hash and profile hash so a later receipt can name the exact implementation.

## Input Admission

Input is copied through closed data-property validation before network access.
Accessors, symbols, prototypes other than ordinary data objects and arrays,
sparse arrays, extra fields, unsorted assets, duplicate paths, and over-limit
collections fail closed.

The origin must already be its canonical URL serialization. It must use HTTPS,
end at `/`, contain no credentials, query, fragment, non-default spelling, or
IP literal, and fit the 2,048-byte limit. Localhost and recognized local name
suffixes are rejected. Production site releases must use their canonical DNS
origin.

Assets use the same closed role, media-type, cache-policy, and seven-field
record vocabulary as `release_manifest.v3`. Paths are ASCII public paths and
reject query or fragment delimiters, backslashes, dot segments, encoded dot,
slash or backslash separators, cross-origin URL resolution, and values over
2,048 bytes. Exactly one `/` bootstrap asset is required. Individual assets
are limited to 8 GiB, the inventory to 512 assets, and the aggregate to 64 GiB.
Every asset must bind the exact security-header profile hash. Model-byte paths
are forbidden, immutable assets must contain their complete SHA-256 in the
path, and an optional single service worker must be JavaScript with `no-cache`.

## Security-Header Profile

The security profile must be RFC 8785/JCS bytes followed by one LF, with no
BOM, CR, pretty-print variation, duplicate key, unknown field, or trailing
content. The profile is frozen and must include exact cache controls for
`immutable`, `no-cache`, and `no-store`.

Every response must contain exactly one instance and the exact declared value
of every profile header. The minimum accepted profile requires:

- Content-Security-Policy with exact `default-src 'self'`,
  `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`
  directives;
- Cross-Origin-Embedder-Policy `require-corp`;
- Cross-Origin-Opener-Policy `same-origin`;
- Cross-Origin-Resource-Policy `same-origin`;
- Permissions-Policy denying camera, geolocation, microphone, payment, and
  USB;
- Referrer-Policy `no-referrer`;
- Strict-Transport-Security
  `max-age=63072000; includeSubDomains; preload`;
- X-Content-Type-Options `nosniff`; and
- X-Frame-Options `DENY`.

`Content-Encoding`, `Content-Range`, `Location`, `Refresh`, `Set-Cookie`, and
`Transfer-Encoding` are forbidden. This makes a redirect, compressed variant,
partial response, cookie-setting response, and chunked representation
ineligible for exact release readback.

## DNS And TLS

The verifier performs one all-address system lookup with verbatim ordering,
canonicalizes and deduplicates each result, and rejects the complete operation
if any result is malformed, non-IP, private, loopback, link-local,
carrier-grade NAT, documentation, benchmarking, translation, multicast, or
otherwise reserved. IPv4 and IPv6 deny lists are intentionally separate
because Node maps IPv4 into IPv6 when matching a mixed `BlockList`.

The verifier orders the accepted set deterministically and tries addresses
only until one completes the root bootstrap response. A semantic response
failure does not fall through to an easier address. The selected address is
then pinned for every remaining asset through a verifier-owned lookup
callback. Every connected socket must report that exact remote address.

TLS uses the operating system trust configuration, normal hostname
verification, the original DNS host as SNI, certificate authorization, and
TLS 1.2 or 1.3. The leaf certificate DER hash is added to a bounded set.
Certificate material and raw network addresses are not returned; their
domain-separated set identities, counts, and the separately domain-separated
pinned-address identity are returned instead.

This blocks DNS rebinding to a local service and prevents a caller from
substituting loopback success for public readback. It does not prove that the
machine is on an independent external network. Outside-network proof remains
a distinct signed evidence class.

## Request And Response Contract

Each asset receives one fresh HTTPS `GET` with connection close, no redirect
handling, `Accept-Encoding: identity`, no-cache request directives, a fixed
user agent, a 32 KiB response-header ceiling, a 30-minute request inactivity
limit, and a four-hour whole-operation limit.

The response must be status 200 and provide one canonical decimal
`Content-Length` exactly equal to the manifest length. `Content-Type` must
match the manifest media type. A single unquoted `charset=utf-8` parameter is
allowed only for text, JSON, JavaScript, manifest JSON, or XML media types.
Cache-Control must exactly match the asset's manifest cache policy. Required
security headers are exact-once and exact-value.

The body is never accumulated as one response buffer. Chunks update one
SHA-256 context and byte counter. The response is destroyed immediately on
overflow or stream failure. End-of-stream requires Node's complete-response
signal, the exact declared byte count, and the exact manifest SHA-256. There is
no response repair, decompression, retry-for-better-bytes, or alternate hash.

## Result And Disclosure

The canonical result content uses
`tinyrustlm.vnext.public_https_readback_result.v1`. It records:

- the verifier profile and source identities;
- the canonical public origin;
- exact asset and total-byte counts;
- DNS-address and certificate counts;
- domain-separated identities for the sorted observation inventory, complete
  DNS set, pinned address, and certificate set;
- the security-header profile hash; and
- one sorted observation per asset containing path, size, SHA-256, status,
  media type, cache control, security-profile hash, and TLS protocol.

Canonical result bytes omit raw response bodies, raw headers, IP addresses,
certificates, credentials, paths outside the public URL space, and host
filesystem locations. The returned wrapper adds the SHA-256 of those canonical
content bytes and gives defensive byte copies. The result itself is not a
receipt and has no authority or currentness semantics.

## Failure Semantics

All semantic failures use bounded `VnextEvidenceError` codes. Raw DNS, TLS,
socket, filesystem, and response text are not reflected into evidence. A
transport failure before a response may try the next already admitted public
address for the bootstrap only. Once an address is selected, any transport,
TLS, metadata, body, timeout, or identity failure terminates the operation.

No file is written by this module. Therefore interruption leaves no partial
readback evidence to resume or promote. The campaign release surface must
reconstruct the authorized lineage, invoke this verifier, scan the canonical
result and proposed receipt, and persist immutable descendants in dependency
order.

## Verification

`tinyrustlm/tests/vnext-public-https-readback.test.js` proves the frozen profile
hash and exact exports; canonical security-profile admission; strong baseline
headers; IPv4, IPv6, mapped-address, local-origin, and canonical-origin
boundaries; exact response status, headers, cache, content type and security
metadata; release asset vocabulary and path rejection; streaming overflow,
truncation and hash drift; defensive returned bytes; and rejection of caller
transport or accessor injection.

These tests use only pure conformance helpers. They do not mock a production
pass, create a public-readback receipt, or increment a live count.

## Release-Surface Integration

`vnext-campaign-release-surface.js` now accepts only one stored
`deployment-attempt-only` receipt, reruns current authorization, invokes this
production operation itself, independently validates the canonical result,
binds the exact result and inventory into a `public-readback` receipt, scans
result and receipt bytes, and persists the redaction receipt before the
readback receipt. Restart recovery accepts only exact dependency-prefix states
and byte-identical replay.

The release-surface conformance test substitutes the module before the surface
is loaded so deterministic fixture observations can exercise orchestration and
crash recovery. That substitution is not reachable through a surface input,
does not test public DNS or HTTPS, and earns no live receipt or campaign count.
The standalone verifier tests continue to cover its pure network admission
rules without fabricating a production pass.

## Next Publication Gate

Generate and bind the current-release pointer and immutable history entry only
as forward descendants, derive evidence-bound published `claim.v2` records,
verify current `site-publisher` authority, and cut maintained entry points to
that sole graph. Delete the superseded mutable public-readback stack only after
the complete replacement passes. No current production readback or publication
is asserted by this checkpoint.

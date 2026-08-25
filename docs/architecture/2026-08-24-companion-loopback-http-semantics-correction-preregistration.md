# Companion Loopback HTTP Semantics Correction Preregistration

Date: 2026-08-24 Pacific / 2026-08-25 UTC

Status: output-free correction registered after one preserved listener-test
failure and before any corrected listener output

## Decision

The sole current Companion loopback authority is
`tinyrustlm.companion.loopback-capability/3`. It adopts the complete
content-addressed v1/v2 design except for four explicit HTTP corrections:

1. a `204` preflight has zero body and no `Content-Length` header;
2. Kestrel parser-owned rejections are distinguished from canonical
   application-owned errors;
3. `X-TinyRustLM-Response-Metadata-SHA256` is CORS-exposed;
4. `X-TinyRustLM-Artifact-Id` is CORS-exposed.

The v1 and v2 registrations remain immutable historical evidence. Runtime code
does not read any registration, select among versions, migrate stored state, or
retain a compatibility path. This is one prelaunch protocol and one clean
implementation target.

## Why A Correction Is Required

The first six real-TCP listener tests reached five passes and one failure. The
failed preflight test expected the v2-registered `Content-Length: 0` header on a
`204` response. ASP.NET Core 8 Kestrel emitted a standards-compliant `204` with
zero body and omitted that header. The public-safe external log is 6,582 bytes
at SHA-256
`fe861068499002c76d634ce0e436b1972ed83e57d298377d0681682a200972c7`.
It is not stored in Git, is not a pass receipt, and creates no campaign credit.

RFC 9110 Section 8.6 says a server must not generate `Content-Length` in a
`204` response. Forcing the old registration would require bypassing or
fighting the selected HTTP implementation and would deliberately emit an
invalid wire. The prelaunch no-debt rule requires correcting the contract,
preserving the failure, and testing the corrected behavior.

## Preflight Wire

A valid preflight remains state-free and has:

- status `204`;
- zero body bytes;
- no `Content-Length`;
- no `Content-Type`;
- exact production origin;
- the exact one registered requested method;
- the lowercase, sorted, exact requested allowed-header set;
- maximum age `300`;
- exact three-value `Vary`;
- `Cache-Control: no-store`;
- `Pragma: no-cache`;
- `X-Content-Type-Options: nosniff`;
- `Connection: close`;
- no credentials, Private Network Access, cookie, or session-proof header.

Every non-204 application response still requires an exact `Content-Length`.
The correction is limited to the status class for which HTTP forbids it.

## Rejection Ownership

Kestrel parses the request line and headers before application middleware can
construct a TinyRustLM error body. Therefore two rejection classes are now
explicit.

### Application-Owned Rejections

When middleware receives a request, it applies exact connection, target,
authority, route, header, framing, body, and capability checks. Its errors use
only canonical schema `tinyrustlm.companion.loopback.error.v1`, one v2 stable
code, and that code's one registered status. An error after valid session
authentication is proven under the consumed sequence. Invalid or unknown
authority remains unproved and is not trusted by the browser.

### Kestrel-Parser-Owned Rejections

Malformed HTTP/1 framing, an over-limit request line, over-limit headers, and a
global over-limit body can be rejected before dispatch. Those responses:

- mutate no pairing, session, rotation, operation, or artifact state;
- have no CORS or session-proof authority;
- have no `Server` header and reflect no raw input;
- close the connection;
- are mapped by the browser to local Companion unavailability;
- cannot satisfy model, browser, campaign, or deployment evidence.

The registered statuses are `400` for malformed request-line or framing,
`414` for the request-line limit, `431` for header count or byte limits, and
`413` for the global body limit. A canonical TinyRustLM body is not asserted
for parser-owned responses because application code did not produce them.
Raw-socket tests prove the exact status class, absence of authority, and lack of
state mutation.

This is not a test waiver. It assigns each byte to its actual implementation
owner and tightens the claims made by each test.

## CORS Exposure Correction

V2 requires every authenticated response proof to bind a response-metadata
hash. It also requires artifact metadata to include an artifact ID. V1's
adopted CORS exposure list accidentally omitted both custom headers, which
would prevent browser JavaScript from independently validating artifact
metadata.

The exact exposed custom vocabulary now includes both
`x-tinyrustlm-response-metadata-sha256` and `x-tinyrustlm-artifact-id`. There is
no wildcard exposure and no credentials mode. This correction reveals only
public artifact identity and proof material already required on the wire; it
does not reveal paths, source URLs, prompts, keys, or model bytes.

## Preserved Invariants

The correction does not change:

- numeric IPv4 loopback and operating-system port zero;
- HTTP/1.1-only Kestrel ownership;
- exact Host and production Origin;
- explicit user-entered pairing code;
- in-memory-only pairing and session secrets;
- proof transcript fields, HKDF, HMAC, hashes, or identifier grammar;
- sequence reservation and one-in-flight state;
- key rotation, exact old-key commit replay, or revocation;
- the ten-route closed table;
- operation, projection, and six-artifact identities;
- request and response bounds;
- verified-P2P-first or explicit local-conversion semantics;
- the ban on a fixed port, health probe, bearer token, compatibility path,
  fallback, response repair, or fake success.

MemoryEndpoints remains unauthorized. No production site or model claim is
created by this registration.

## Implementation Order

1. Commit and push only this correction registration, decision, and validator.
2. Fetch and prove local, tracking, `FETCH_HEAD`, and direct remote equality.
3. Correct the preflight and exposed-header assertions.
4. Add exact raw-socket tests for each parser-owned status class and prove no
   dispatch or state mutation.
5. Complete the six-route pairing/session listener and private host.
6. Run the full managed, browser-vector, registration, format, and current
   inventory gates.
7. Commit a bounded implementation checkpoint only after the coherent listener
   gate is green.
8. Continue to the memory-only top-window browser client. Deployment remains
   forbidden until the complete affected gate passes.

## Acceptance

The corrected listener milestone requires all of the following:

- exact numeric-loopback bind and port disclosure only after bind;
- canonical pairing, status, rotation, replay, and revocation over real TCP;
- exact application-owned errors and proven authenticated errors;
- standards-compliant `204` preflight with no body-length fields;
- parser-owned 400/413/414/431 rejection tests with no authority or mutation;
- complete explicit CORS exposure required for later artifact verification;
- no server, cookie, redirect, compression, proxy, or forwarded authority;
- zero warnings, zero required skips, and no weakened existing test;
- frozen goal SHA-256 unchanged;
- all five campaign counters unchanged at zero.

Passing this milestone proves only the local control transport. It does not
prove a browser permission grant, artifact transfer, model conversion, model
quality, P2P availability, deployment, or campaign progress.

## Primary Sources

- RFC 9110, HTTP Semantics, Section 8.6 Content-Length, retrieved 2026-08-25:
  <https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6>
- Microsoft ASP.NET Core 8 Kestrel options, retrieved 2026-08-25:
  <https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/options?view=aspnetcore-8.0>
- WHATWG Fetch Standard CORS response-header exposure, retrieved 2026-08-25:
  <https://fetch.spec.whatwg.org/#http-new-header-syntax>

## Claims

Qualified models remain `0/20`; deletion-backed browser rounds remain `0/50`;
authorized live memory rounds remain `0/25`; current outside-network lane
proofs remain `0/40`; live catalog announcements remain `0/20`.

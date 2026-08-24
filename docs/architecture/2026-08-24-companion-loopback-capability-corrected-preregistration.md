# Corrected Companion Loopback Capability Preregistration

## Status

Registered before listener, browser-client, cryptographic-conformance, or
protocol output.

The sole implementation authority is
`contracts/vnext/companion-loopback-capability-preregistration.v2.json`, profile
`tinyrustlm.companion.loopback-capability/2`, 22,681 bytes, SHA-256
`6ad07dda97ae50d8e6c3fc1a581e6742d2e18c66484a4a9864e1b3bc7a57ae81`.
It binds parent commit `0f08fb6b53f50013220a156ebb8006e258c5c0d1` and
tree `9137bc158e83fc35df2da77f6edfb61eafe60cb9`.

Technical profile `/2` is a byte-contract identity for the same single
prelaunch product. It is not a product V2 and creates no compatibility reader,
migration, fallback, or alternate protocol.

## Why Correction Was Required

### Directly Observed Local Fact

The first output-free registration is immutable at 39,311 bytes and SHA-256
`81e3f2f3795a51c0bce86e1aca66f6a7234608a3dd044cd7a9b1cbbf90c9ba77`.
It correctly froze numeric loopback binding, pairing shape, session limits,
closed routes, browser storage policy, HTTP limits, and six-artifact transfer.
It did not order every field in the pairing, completion, HKDF, and rotation
transcripts. It also did not freeze network JSON bytes, session-status wire,
error-to-status mapping, sequence commit point, or proof binding for artifact
metadata headers.

Those omissions permit two reasonable implementations to produce different
cryptographic bytes while each appears to follow the prose. That is an
implementation-blocking ambiguity, not a documentation nicety.

### Correction Rule

No implementation output existed when the ambiguity was found. The first
registration remains byte-identical, retained, and explicitly non-executable.
The corrected profile binds it as a content-addressed design input, adopts its
named top-level decisions, replaces exactly three ambiguous pointers, and adds
the exact missing wire sections. Runtime code reads neither registration and
contains no version negotiation.

The three replacements are the generic transcript-encoding statement and the
request- and response-proof field lists. All other first-registration
decisions remain mandatory. The response proof gains an exact
`response-metadata-sha256` field so artifact identity headers cannot be
substituted independently of a valid body proof.

## Canonical Network Bytes

Every JSON HTTP body is UTF-8 without a BOM, leading whitespace, trailing
whitespace, or a final LF. Object members occur in the registered schema order.
Unknown members, duplicates, comments, trailing commas, depth beyond 16, and
non-ASCII control strings reject. Unsigned integers use shortest decimal with
no sign or leading zero. Timestamps use UTC whole-second RFC 3339 spelling
`yyyy-MM-ddTHH:mm:ssZ`.

`application/json` and `application/octet-stream` are exact media types with no
parameters. SHA-256 values are lowercase hexadecimal over the exact transferred
body bytes. The empty-body digest is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

The installation file is deliberately different from an HTTP body only in
having one final LF. Before that LF, it is a canonical two-member object:
schema followed by installation ID. It has no timestamp or secret. This keeps
installation identity create-only and deterministic to parse without making a
creation clock part of authority.

## Transcript Encoding

Each transcript field is exact UTF-8 preceded by its unsigned 32-bit big-
endian byte length. There is no delimiter, normalization, object serializer,
or platform encoding. A field is limited to 65,536 bytes, a transcript to 32
fields and 131,072 bytes. Empty fields are legal only where a field name
explicitly says `or-empty`.

This encoding is used for all HMAC, HKDF salt, HKDF info, and artifact-metadata
inputs. Independent browser and .NET vector implementations must produce the
same bytes before either implementation is permitted to accept live output.

## Pairing Core

The shared pairing core is ordered as:

1. protocol ID
2. installation ID
3. process-instance ID
4. claim ID
5. browser nonce
6. server nonce
7. session ID
8. decimal key epoch
9. exact Host
10. exact Origin
11. session expiry
12. decimal idle timeout

The server proof prepends domain
`TinyRustLM companion pairing server proof 1` and uses the raw 32-byte pairing
secret as the HMAC-SHA-256 key. The browser proof prepends domain
`TinyRustLM companion pairing browser proof 1` and uses the derived session
key. The completion proof prepends domain
`TinyRustLM companion pairing completion proof 1`, uses the session key, and
appends SHA-256 of the exact completion-request body.

The Browser verifies the server proof before sending completion and verifies
the completion proof before reporting Connected. The pairing secret and
session key never cross HTTP.

## Session-Key HKDF

HKDF input key material is the raw pairing secret. Salt is SHA-256 of a framed
transcript beginning `TinyRustLM companion session capability salt 1` and
binding protocol, installation, process, claim, both nonces, session, epoch,
Host, and Origin. Info is the framed transcript beginning
`TinyRustLM companion session capability key 1`, binding the same fields plus
session expiry and idle timeout.

Extract is HMAC-SHA-256 with salt as key and the pairing secret as message.
Expand is the RFC 5869 one-block operation HMAC-SHA-256 over exact info followed
by byte `0x01`. The first 32 bytes are the complete session key. There is no
empty-salt convention, framework-default info, text key, or second block.

## Authenticated Request State Machine

The request proof field order is domain, protocol, installation, process,
session, epoch, sequence, method, Host, Origin, path, content type or empty,
content length, and body hash. The response proof field order is domain,
protocol, installation, process, session, epoch, sequence, request method,
request path, status, content type, content length, response-metadata hash, and
body hash.

Before authentication, the server checks connection and parser limits, request
target form, header bounds and duplicates, exact Host and Origin, closed route
and method, header allowlist, framing and body bounds, exact content hash,
session/epoch/sequence shape, session existence and expiry, and the request
proof in constant time.

Only after all those checks pass does it atomically reserve the exact next
sequence and one in-flight slot. Reservation occurs before route handling. A
valid authenticated request consumes one sequence even when its JSON or
contract is rejected; that error is response-proven under the same sequence.
An invalid proof, unknown session, or wrong sequence consumes nothing. A
handler exception becomes a bounded, proven `internal-failure`; it does not
rewind sequence.

Preflight and pairing do not consume session sequence. An error with no valid
session proof is untrusted by the browser regardless of its body. The browser
maps it to `companion-unavailable` and never treats an unproved server-provided
code as authority.

## Session Status

The exact status body contains schema, protocol, installation, process,
session, epoch, accepted sequence, next sequence, session expiry, key expiry,
and idle timeout. The authenticated request itself consumes its sequence, so
`acceptedSequence` equals the response proof sequence and `nextSequence` is
its successor unless the epoch is exhausted.

All session IDs and random operation IDs are exact lowercase hex or base64url
under registered grammars. Decimal route indexes and header numbers reject
signs, whitespace, plus signs, and leading zeroes.

## Rotation

The new rotation key is HKDF-SHA-256 with the current session key as input key
material. Salt and info separately bind protocol, installation, process,
session, rotation ID, browser nonce, server nonce, current epoch, next epoch,
Host, and Origin under distinct registered domains.

The new-key proof uses the new key and binds those same fields. The completion
proof additionally binds SHA-256 of the exact commit request. The commit HTTP
response header proof uses the new key. After commit, the old key can recover
only the stored exact commit response for 30 seconds. That exact replay does
not consume another sequence; every other old-key request is revoked.

## Revocation

Revocation has exact two-member request and three-member response schemas. The
response always says `revoked: true`. The body and proof headers are fully
materialized before key erasure. Later traffic cannot receive a trusted
authenticated error because the key no longer exists.

## Operation Projection

The public operation projection has exactly schema, operation ID, journal
sequence, state, branch, completed bytes, nullable total bytes, nullable
artifacts, and nullable error code. State and branch use current exact managed
enum names.

An available artifact array contains exactly six entries in composition,
model, tokenizer, template, sampling, and prompt order. Each entry contains
role, artifact ID, SHA-256, byte count, and chunk count. Chunk count is the
ceiling of byte count divided by 4 MiB. The projection contains no local path,
source URL, prompt, credential, or model bytes.

## Artifact Metadata Proof

For every binary chunk, the server creates a framed metadata transcript with a
domain, operation ID, role, artifact ID, artifact SHA-256, artifact bytes,
chunk index, chunk count, chunk offset, and chunk bytes. It sends the lowercase
SHA-256 of that transcript in
`X-TinyRustLM-Response-Metadata-SHA256` and includes that hash in the normal
response proof.

The browser independently reconstructs the transcript and verifies its hash
before accepting the chunk. This binds every identity-bearing artifact header
to the response key and body. Body-only proof is insufficient.

## Error And Preflight Wires

Every stable error code has exactly one registered HTTP status. Host mismatch
uses 421. Syntax, framing, CORS preflight, and JSON failures use 400; authority
or proof failures use 403; unknown routes and operations use 404; method uses
405; state conflicts use 409; expired/consumed/revoked authority uses 410;
oversize uses 413; media type uses 415; semantic contracts and artifact
selectors use 422; bounded capacity uses 429; Companion unavailability uses
503; and unexpected internal failure uses 500.

The error body is only schema and code. Unknown or invalid sessions receive no
response proof, and the browser does not trust their code.

A valid preflight returns 204 with zero body and exact Content-Length zero. It
echoes only the one registered requested method and the lowercase sorted exact
requested allowed-header set. It sets the exact origin, 300-second maximum age,
the three-value Vary header, and no-store. It emits no credentials, legacy
Private Network Access, or session proof header and changes no state.

## Implementation Sequence

1. Commit, push, fresh-fetch, and direct-remote verify this correction.
2. Implement canonical JSON, identifier, and framed-transcript codecs.
3. Freeze independent browser and .NET vectors for every proof and HKDF stage.
4. Implement pairing and session state against fake monotonic time.
5. Implement rotation and revocation, including exact lost-response replay.
6. Implement the strict Kestrel listener and raw-socket rejection suite.
7. Implement the memory-only top-window browser client and clean-profile Local
   Network Access observations.
8. Implement canonical operation projection and six-artifact chunk transfer.
9. Delete the superseded fixed-port bridge and test in the same cutover.
10. Fix all observed complete-gate failures and require a zero-failure complete
    gate before deployment.

No implementation step may infer an omitted byte, add a permissive reader, or
retain the superseded browser path.

## Verification And Claim Boundary

The corrected registration must prove the v1 bytes unchanged and
non-executable, reproduce every bound parent blob, show every planned
implementation path absent at registration, validate all adopted base keys,
cover every stable error code once, and assert all output and campaign fields
false.

Registration is not cryptographic conformance. Unit vectors are not physical
browser proof. Loopback is not public P2P. A fixture is not a real model.
Structural composition is not quality. A package build is not publication and
a local site is not deployment.

At this registration, no listener started, no port bound, no secret or session
was created, no browser request was sent, no chunk was served, no operation or
implementation file was created, and no model, package, site, MemoryEndpoints,
or campaign action occurred. Counters remain `0/20`, `0/50`, `0/25`, `0/40`,
and `0/20`.

## Sources And Unknowns

The public sources and retrieval dates remain exactly those bound by the first
registration: Fetch, Local Network Access, Chrome's LNA launch documentation,
Secure Contexts, Web Crypto Level 2, RFC 5869, RFC 9112, and ASP.NET Core 8
Kestrel endpoint and limit documentation.

Physical browser permission behavior, Kestrel raw-parser behavior, endpoint
security, Windows and Linux installation ownership, sleep/resume, browser and
Companion restart, throughput, memory, six-artifact transfer, and production
site headers remain local verification requirements. A mismatch stops
promotion; it does not authorize another protocol.

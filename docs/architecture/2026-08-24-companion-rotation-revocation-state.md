# Companion Rotation And Revocation State

Date: 2026-08-24

## Status

This record closes the in-memory rotation and revocation implementation step
for the one TinyRustLM prelaunch product. It implements the already registered
two-phase key transition, exact lost-response recovery, authenticated session
status, and explicit revocation rules under sole executable capability profile
`tinyrustlm.companion.loopback-capability/2`.

The work adds no listener, network route, browser request, durable session,
compatibility reader, migration, alternate protocol, fixed-port probe,
fallback, retry selection, response repair, or fake success. Technical schema
suffixes, capability profile `/2`, and key-epoch numbers are exact protocol
identities. They are not product generations.

This record supersedes only the earlier implementation-boundary statement that
rotation and revocation were still absent. The earlier installation, pairing,
and session evidence remains valid. The output-free corrected registration
remains unchanged and authoritative. Profile `/1` remains immutable,
non-executable registration history and has no runtime reader.

## Authority

The implementation is constrained by:

- `contracts/vnext/companion-loopback-capability-preregistration.v2.json`;
- `contracts/vnext/companion-loopback-capability-preregistration.v1.json` only
  for sections explicitly adopted by the corrected profile;
- `docs/architecture/2026-08-24-companion-loopback-capability-corrected-preregistration.md`;
- `docs/architecture/2026-08-24-companion-loopback-capability-codec-and-vectors.md`;
- `docs/architecture/2026-08-24-companion-installation-pairing-session-state.md`;
- the cross-language vector corpus at
  `contracts/vnext/companion-loopback-capability-vectors.v1.json`.

The changed implementation boundary is deliberately small:

- `dotnet/src/TinyRustLM.Companion/CompanionLoopbackWire.cs` owns exact network
  JSON for status, rotation, and revocation;
- `dotnet/src/TinyRustLM.Companion/CompanionCapabilityState.cs` remains the
  sole installation, pairing, session, rotation, and revocation state owner;
- `dotnet/tests/TinyRustLM.Companion.Tests/CompanionRotationStateTests.cs`
  owns the new protocol-state adversarial tests;
- the existing capability-state tests retain pairing and basic session
  coverage.

No state owner was added to the browser, a service worker, a second process,
or a package API.

## Canonical Network Bodies

The wire codec now accepts exactly these registered schemas and exact member
orders:

| Purpose | Schema | Maximum bytes |
| --- | --- | ---: |
| Session status | `tinyrustlm.companion.loopback.session-status.v1` | 4,096 |
| Rotation begin | `tinyrustlm.companion.loopback.rotation-begin.v1` | 2,048 |
| Rotation challenge | `tinyrustlm.companion.loopback.rotation-challenge.v1` | 4,096 |
| Rotation commit | `tinyrustlm.companion.loopback.rotation-commit.v1` | 4,096 |
| Rotation committed | `tinyrustlm.companion.loopback.rotation-committed.v1` | 4,096 |
| Revoke request | `tinyrustlm.companion.loopback.revoke-request.v1` | 1,024 |
| Revoked response | `tinyrustlm.companion.loopback.revoked.v1` | 1,024 |

Encoding is UTF-8 without BOM, final LF, or leading or trailing whitespace.
Members are emitted in schema order. Decoding rejects unknown, duplicate,
missing, reordered, escaped control, malformed, oversized, and noncanonical
representations. Identifiers, nonces, proofs, timestamps, epochs, sequences,
and booleans are validated under the corrected registration.

An authenticated status request consumes its sequence before dispatch. Its
`acceptedSequence` therefore equals the sequence in the response proof.
`nextSequence` is the exact successor through sequence 999,999 and is the JSON
literal `null` when accepted sequence 1,000,000 exhausts the epoch. A numeric
substitute for exhausted state and a null substitute before exhaustion are
both rejected.

## Authentication And Lease Ownership

The existing preauthentication order is unchanged. Installation, process,
Host, Origin, session, lifetime, epoch, body identity, proof, exact-next
sequence, one-in-flight reservation, and rate limit all pass before a sequence
is committed and a lease is returned.

The lease now has an explicit three-state lifecycle: open, executing, and
finished. Only one response-producing operation can enter it. Successful
materialization clears its private key copy and releases the in-flight
reservation exactly once. A failed authenticated route operation reopens the
same lease so the listener can later materialize one proven typed error with
the already consumed sequence. Concurrent disposal is remembered and releases
the reservation after an executing operation completes or fails; it cannot
strand the session in-flight.

An exact old-key rotation-commit replay lease is intentionally different. It
owns no new sequence, no in-flight reservation, and no key. It can return only
the stored committed response. It cannot be repurposed for status, another
rotation, revocation, a generic proven response, or an operation route.

## Rotation Begin

Rotation begin must be a valid authenticated `POST` to
`/tinyrustlm-companion/1/session/rotation/begin` with the exact canonical body.
The current key authenticates the request and proves the response.

The state admits one pending rotation per session. A first valid begin creates
a 32-byte cryptographic server nonce, binds the registered rotation proof
context, and advertises an expiry exactly 120 seconds from the current wall
clock while enforcing expiry with monotonic time. Repeating the same canonical
begin body under a later valid sequence returns the same challenge. A different
begin while one is pending returns `rotation-conflict`.

At monotonic age 120 seconds, the pending rotation is removed and its one-item
expired marker returns `rotation-expired` for that rotation identity. A fresh
rotation identity can begin without repairing or reviving the expired state.
The expired marker is bounded and later pruned.

Epoch 64 is the registered ceiling. An authenticated attempt to begin another
rotation at epoch 64 consumes that request sequence and returns a proven
`capability-expired` route error without changing the current key.

## Rotation Commit

Rotation commit must be a valid authenticated `POST` to
`/tinyrustlm-companion/1/session/rotation/commit`. The request is authenticated
by the current key and must exactly match the pending rotation ID, browser
nonce, server nonce, current epoch, and next epoch.

The Companion derives a candidate 32-byte key with the registered RFC 5869
HKDF-SHA-256 construction. The current key is input key material. Salt and info
separately bind protocol, installation, process, session, rotation ID, both
nonces, both epochs, exact numeric Host, and exact production Origin. The
commit is refused with `rotation-proof-invalid` unless the submitted proof
verifies under that candidate key.

An invalid new-key proof does not alter the pending rotation or server key. Its
request sequence remains consumed because valid old-key request authentication
already completed. The same lease can therefore produce the registered proven
403 error under the old key, and a corrected commit must use the next old-key
sequence.

For a valid commit, the state completes these operations under one lock:

1. Compute the completion proof under the candidate new key, additionally
   binding SHA-256 of the exact canonical commit request.
2. Materialize the canonical committed body.
3. Materialize the outer HTTP response proof under the new key while retaining
   the authenticated old-epoch request context and sequence in that proof.
4. Preserve an immutable copy of that exact response for bounded recovery.
5. Clear the server's old key bytes.
6. Install the new key and next epoch.
7. Reset accepted sequence to zero, so the first new-key request is sequence
   one.
8. Reset monotonic key age and advertised key expiry without changing the
   session's original absolute expiry.
9. Clear pending and expired rotation state.

The lease then clears its separate old-key copy and releases the one-in-flight
reservation. No operation retains the old key.

## Lost Commit Response

For exactly 30 monotonic seconds after commit, only the exact stored old-key
commit authentication context and proof can produce a replay lease. The caller
must also present the same canonical commit body. The replay returns a fresh
copy of the byte-identical body, response-proof context, and proof produced by
the original commit.

Replay consumes no new sequence and does not reserve the new epoch. It does
count against the registered 600 authenticated requests per rolling minute.
Every other request using an older epoch returns `capability-revoked`. At age
30 seconds the replay authority is removed, and even the formerly exact commit
request returns `capability-revoked`.

The browser's alternative recovery remains a new-key authenticated status
probe at sequence one. No second rotation, key repair, retry selection, or
server-side guess is introduced.

## Revocation

Revocation must be a valid authenticated `POST` to
`/tinyrustlm-companion/1/session/revoke` with the exact two-member request. The
state creates the exact three-member response with `revoked: true`, hashes its
body, and computes the response proof with the current lease key before
changing terminal state.

Only after the complete response object exists does the session transition to
`capability-revoked` and clear the server key bytes. The lease then clears its
private key copy. Later requests return the terminal code without a lease and
therefore cannot receive a trusted authenticated error, as required by the
registration.

Revocation tombstones survive for the life of the Companion process. Other
expired terminal sessions retain the existing bounded one-minute tombstone.
To make process-lifetime revocation exact without unbounded memory, production
admits at most 4,096 total session records in one process. Once that record
ceiling is reached, a valid new pairing completion returns `resource-limit`
without deleting or forgetting any revoked identity. Restart clears all
sessions and tombstones, creates a new process identity, and invalidates every
old session as the protocol requires.

The smaller record ceiling accepted by the internal constructor exists only
for deterministic tests. Public production construction always uses 4,096,
system monotonic time, and cryptographic randomness.

## Verified Cases

The Companion test project passes 71 of 71 tests with zero skips. The nine new
cases cover:

- canonical status, rotation, and revocation round trips and mutations;
- canonical `nextSequence: null` only at sequence exhaustion;
- old-key begin and commit followed by new-key completion and response proofs;
- byte-identical old-commit replay and rejection of every other old-key route;
- invalid new-key proof, consumed sequence, old-key proven error, and corrected
  next-sequence commit;
- pending begin idempotence, conflict, exact 120-second expiry, and fresh
  replacement;
- key-age reset without absolute-session-expiry reset;
- exact 30-second replay expiry;
- replay admission under the registered rolling request-rate ceiling;
- all 63 permitted transitions from epoch one through epoch 64 and refusal of
  a 65th epoch;
- response-before-erasure revocation, day-later in-process tombstone behavior,
  and restart invalidation;
- bounded process session records while retaining the earliest revocation.

Core passes 80 of 80, package tests pass 38 of 38, and the complete managed
solution passes 189 of 189 with zero skips. The Release solution build succeeds
with zero warnings and zero errors. `dotnet format --verify-no-changes` reports
no formatting changes.

The independent Node cryptographic oracle and browser WebCrypto implementation
pass 8 of 8 vector tests. The focused accepted-ADR, corrected and historical
registration, and vector union passes 59 of 59. Those tests continue to prove
the registered byte rules and that profile `/1` has no executable authority.

The complete standard Node inventory was rerun after this implementation. It
passes 1,173 of 1,189 tests, fails 15, and skips one. Its complete private log
is 275,220 bytes at SHA-256
`0a65f69297247eae1ab4a97842c0055499469602c31fd9ddbb7d06afa50e7d74`.
The 15 failures reduce to six preserved root classes outside this state change:

- one native-build-script assertion expects `$TargetDir` while the script uses
  `$targetDirectory`;
- one immutable pre-cutover SLM2 registration compares the working-tree
  `Cargo.toml` byte count with the registered Git blob across line-ending
  representation;
- two Template2 cases reject current verifier source-closure identity;
- one SLM2 WASM conformance case expects an SLM2-only export list from the
  current combined SLM2 and ACG2 conformance module;
- one Phase 2 threat-review case contains a stale validator-registry identity;
- nine static-server, shell, manifest, browser-smoke, local-smoke, and secret-
  scan cases cascade from one stale `app.js` identity in the canonical shell.

This current run replaces the older numerical observation but does not convert
any failure to a skip, expected failure, or pass. Deployment remains blocked
until every root cause is corrected generally and the complete inventory
passes with zero required skips.

## Claim Boundary

This milestone proves deterministic in-process rotation, exact commit replay,
status, and revocation state against fake monotonic time plus production crypto
construction. It does not prove:

- a Kestrel listener, numeric bound port, HTTP parser, raw-socket rejection,
  CORS response, or browser-mediated Local Network Access;
- a browser client, memory-only browser secret lifecycle, actual fetch, clean
  profile, Chromium, Firefox, or WebKit behavior;
- operation projection, cancellation, six-artifact transfer, browser hashing,
  IndexedDB transaction, ACG2 activation, or Worker recovery;
- real model acquisition, training, conversion, native generation, browser
  WASM generation, assistant quality, or product chat;
- P2P reachability, package publication, deployment, public HTTPS readback, or
  site-release authorization;
- MemoryEndpoints access or any live campaign result.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain exactly 0/20 qualified models, 0/50 deletion-backed browser rounds,
0/25 authorized live memory rounds, 0/40 current outside-network lane proofs,
and 0/20 live catalog announcements.

The current complete Node gate remains a deployment blocker until its recorded
root causes are fixed and the complete gate reaches zero failures. This focused
state milestone does not waive, relabel, or hide those failures.

## Next Ordered Work

The next implementation step is the strict ASP.NET Core 8 Kestrel listener and
raw-socket rejection suite under this same capability state. It must bind only
numeric `127.0.0.1` on OS-selected port zero, accept only HTTP/1.1, enforce the
closed method and route table, exact Host and Origin, header allowlists,
duplicate-security-header rejection, framing, body and timeout bounds, exact
CORS and current Local Network Access preflight, response proof headers, and
connection close behavior.

Only after that listener is green may the memory-only top-window browser client
be connected. Operation projection and the fixed six-artifact transfer follow,
with complete deletion of the superseded fixed-port bridge in the same cutover.
No compatibility path, migration, alternate listener, fallback, repair,
automatic retry, stale documentation, weakened evidence, or campaign-count
inflation is authorized.

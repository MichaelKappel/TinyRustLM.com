# Companion Installation, Pairing, And Session State

Date: 2026-08-24

Status: implemented and locally verified state layer; no listener or browser
request exists

## Decision

TinyRustLM now has the first stateful implementation layer beneath corrected
profile `tinyrustlm.companion.loopback-capability/2`: a create-only Companion
installation identity, exact canonical pairing bodies, a single-use pairing
secret state machine, and bounded memory-only authenticated sessions. The
implementation follows the corrected profile and its explicitly adopted base
fields. It does not read either preregistration document at runtime.

This is one prelaunch product. Profile `/1` remains immutable non-executable
design history. No compatibility reader, migration, alternate protocol,
legacy route, alias, fallback, instruction-file handoff, or second state owner
was added.

The milestone intentionally stops before network output. There is no Kestrel
listener, bound port, HTTP route, CORS response, Local Network Access request,
browser client, rotation, revocation, operation projection, artifact transfer,
model activation, or deletion of the old browser bridge yet. Those boundaries
remain ordered future work under the same corrected authority.

## Implemented Source Boundary

The state layer consists of:

- `CompanionInstallation.cs`: secure root creation and validation, canonical
  create-only `installation.json`, durable installation identity, and a new
  nondurable process identity on every open.
- `CompanionLoopbackWire.cs`: exact canonical pairing begin and complete
  request and response bodies in addition to the existing installation file
  codec.
- `CompanionCapabilityState.cs`: explicit pairing-code issuance, begin and
  complete idempotence, single-use secret consumption, active-session
  admission, exact request authentication, sequence commitment, one-in-flight
  reservations, expiry, rolling limits, response proof materialization, and
  key erasure.
- `CompanionCapabilityStateTests.cs`: deterministic monotonic-time and random
  sources available only to the friend test assembly, with adversarial state,
  race, wire, permission, and cryptographic tests.

The public production constructors always use `TimeProvider.System` and
`RandomNumberGenerator.Fill`. The injectable time and random boundaries are
internal. Product callers cannot select a deterministic or noncryptographic
random implementation.

## Installation Identity

The Companion accepts one fully qualified, dedicated host-state root. A
filesystem root, missing parent, file in place of the directory, direct
reparse point, or reparse-point parent is rejected. A missing root is created
with platform-specific private permissions before the identity record is
written.

The durable record is exactly:

```json
{"schema":"tinyrustlm.companion.installation.v1","installationId":"<32-lower-hex>"}
```

Its file representation is strict UTF-8 without BOM followed by exactly one
LF. It has two members in the registered order, no timestamp, no process ID,
and no secret. The record is bounded to 4,096 bytes and written with
`FileMode.CreateNew`, no sharing, write-through, and an explicit disk flush.
Existing bytes are never repaired, normalized, replaced, or migrated.

The installation ID is 16 cryptographically random bytes encoded as 32
lowercase hexadecimal characters. Reopening a valid root preserves that
identity. Each open generates a different 16-byte process instance ID; the
process identity is never durable.

An empty existing private root may be initialized. A nonempty root without
`installation.json` is rejected as ambiguous. A malformed, noncanonical,
oversized, inaccessible, or reparse-point record is rejected. These failures
do not trigger deletion or a replacement identity.

On Windows, a newly created root has a protected DACL with full control for
only the current user SID and Local System. The owner must be the current user.
The record inherits that closed ACL. Startup enumerates effective rules and
rejects an unexpected principal, deny rule, non-full-control rule, missing
required principal, owner drift, or loss of root DACL protection.

On Linux, the root is exactly mode `0700`, the record is exactly mode `0600`,
and `statx` ownership must equal `geteuid()`. Any mode or owner drift rejects
startup. Linux enforcement is compiled into the same `net8.0` source but has
not yet been executed on authorized Linux x64 or Linux arm64 hardware; that is
an explicit release evidence requirement, not an inferred pass from Windows.

## Canonical Pairing Bodies

Four exact schemas now have one encoder and one strict decoder:

1. `tinyrustlm.companion.loopback.pairing-begin-request.v1`
2. `tinyrustlm.companion.loopback.pairing-begin-response.v1`
3. `tinyrustlm.companion.loopback.pairing-complete-request.v1`
4. `tinyrustlm.companion.loopback.pairing-complete-response.v1`

Network JSON is UTF-8 without BOM or final LF. Member count, names, and order
must match the registered schema exactly. Leading or trailing whitespace,
unknown or duplicate members, reordered members, comments, trailing commas,
escaped replacements for canonical ASCII, wrong JSON types, noncanonical
numbers, malformed UTF-8, invalid identifiers, invalid nonces or proofs,
invalid timestamps, and bodies above the route limit are rejected.

The decoder parses only inside the registered 16-level depth and body limits,
validates every control value, re-encodes the typed value, and requires byte
equality with the received body. This makes the canonical request hash and
lost-response identity independent of parser permissiveness.

## Pairing State Machine

Pairing-code issuance is an explicit API action intended to be called only
after the future listener has successfully bound exact IPv4 loopback. It
creates 32 random secret bytes and returns the exact
`TRLC1:{decimal-port}:{base64url-secret}` code plus a whole-second UTC display
expiry. The secret remains only in process memory. Reissuing explicitly
invalidates and clears the prior secret and any pending claims.

Server authority uses injected monotonic time. Wall time appears only in
bounded protocol fields; browser time is never trusted for acceptance.

Pairing rules are:

- one code lives for 300 seconds;
- at most four claims may remain pending;
- a pending claim lives for 30 seconds;
- begin and complete each accept at most eight requests per rolling minute;
- claim IDs are 16-byte lowercase-hex identities;
- browser and server nonces are canonical encodings of 32 bytes;
- session IDs are fresh 16-byte lowercase-hex identities;
- the first epoch is exactly one;
- a session advertises an eight-hour absolute expiry and 900-second idle
  timeout;
- the begin response proof uses the raw pairing secret and the exact corrected
  transcript;
- the complete request proof uses the independently derived session key;
- a valid complete atomically creates one session and then clears the pairing
  secret;
- invalid proof, malformed identity, capacity failure, or expired claim does
  not create a session or consume the secret;
- the same claim ID and byte-equivalent canonical begin request returns the
  same stored response;
- a changed begin request under the same claim ID is a conflict;
- the exact successful complete request returns the same stored response for
  60 seconds;
- another request after consumption receives `pairing-consumed`;
- concurrent valid claims serialize at one commit point, producing exactly
  one session and one consumed loser.

Pending, consumed, expired, and replay records are bounded by route rate,
claim capacity, and 60-second retention. Secret arrays and server-held session
keys are explicitly zeroed on consumption, expiry, terminal session state, or
state disposal.

## Session Authentication State Machine

At most four active sessions exist. Sessions and keys are process-memory only
and do not survive Companion or browser restart. Cookies, bearer headers,
durable browser storage, cross-tab transfer, and service-worker transfer are
not part of this layer.

The state validates exact installation, process, host, origin, session, epoch,
request shape, body hash, and request proof before accepting a request. HMAC
proof comparison uses the operation-specific constant-time verifier. An
unknown session, identity mismatch, malformed context, or invalid proof does
not consume sequence. A correctly proved but non-next sequence also does not
consume sequence.

For a valid exact-next proof, the state atomically:

1. checks the 600-authenticated-request rolling-minute limit;
2. confirms that no request is already in flight for the session;
3. reserves the one in-flight slot;
4. commits the accepted sequence before route handling;
5. updates monotonic last activity;
6. gives the handler a private copy of the current session key.

The sequence begins at one and is bounded by the registered one-million limit.
A valid authenticated contract failure therefore consumes its sequence just
like a successful request. The response materializer hashes the exact body,
binds status, media type, body length, metadata hash, method, path, epoch, and
sequence into the corrected response transcript, computes the response proof,
then clears the lease key and releases the in-flight reservation. Disposing an
unfinished lease still clears its key and releases the reservation while
leaving the already committed sequence consumed.

Absolute lifetime is 28,800 monotonic seconds. Idle lifetime and key-epoch
lifetime are each 900 monotonic seconds. Absolute expiry has first precedence,
then idle expiry, then key-epoch expiry. Terminal state clears the server key
and remains briefly as a typed tombstone before bounded removal. Rotation will
replace key-epoch expiry behavior in the next implementation milestone; no
rotation behavior is claimed here.

## Verified Cases

The Companion test project passes 62 of 62 tests. New cases cover:

- create, reopen, installation/process identity separation, and exact file
  bytes;
- valid private Windows root and record ACLs;
- missing record in a nonempty valid root;
- malformed durable record and real unexpected-principal ACL drift;
- canonical pairing request/response round trips and whitespace, member,
  duplicate, unknown, and escaped-body mutations;
- server proof and session-key derivation against the frozen independent
  vector primitives;
- begin and complete idempotence;
- invalid proof nonconsumption;
- code, claim, capacity, and rolling-rate limits;
- simultaneous distinct valid claims with exactly one winning commit;
- four active sessions and rejection of a fifth;
- exact sequence commit, invalid-proof and wrong-sequence nonconsumption,
  one-in-flight rejection, and proven authenticated contract errors;
- idle and key-epoch expiry;
- 600 accepted authenticated requests, rejection of request 601 without
  sequence consumption, and acceptance after the rolling window clears.

The complete managed solution passes 180 of 180 tests with zero skips: Core
80, Companion 62, and Package 38. The independent Node crypto oracle and
browser WebCrypto comparison remain 8 of 8. The Release solution builds with
zero warnings and errors, `dotnet format --verify-no-changes` reports no
change, and `git diff --check` is clean.

These are local Windows tests. They are not physical Linux execution, raw HTTP
parser testing, browser Local Network Access proof, public deployment, or
outside-network evidence.

## Next Ordered Work

The next code change must implement and fault-test the registered two-phase
rotation and authenticated revocation state on this same memory-only session
owner. It must preserve exact old-key commit replay, new-key completion proof,
epoch and sequence rules, response-before-erasure revocation, restart
invalidation, and bounded tombstones.

Only after rotation and revocation are green may the project add the strict
Kestrel HTTP/1.1 listener. The listener must then enforce request line, target,
header allowlist, duplicate security-header, framing, body, timeout,
connection, exact Host/Origin, CORS, and response-close rules before any
browser client is connected.

No deployment is authorized from this milestone. The previously measured
complete Node gate still has 15 failures in known unrelated baseline classes,
and the new transport is intentionally absent from deployable application
bytes.

## Explicit Nonclaims

This milestone proves no listener, bound port, browser request, browser
permission, artifact transfer, P2P availability, source acquisition, model
conversion, model quality, SLM2 runtime, multi-turn chat, installer, package,
publication, deployment, public HTTPS readback, MemoryEndpoints operation, or
campaign progress. Campaign counters remain exactly `0/20`, `0/50`, `0/25`,
`0/40`, and `0/20`.

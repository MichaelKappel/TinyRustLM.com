# vNext Protected Equality Private Loader

## Status

This document defines the single current local ingress boundary for a private
protected-equality custody bundle. The implementation checkpoint is commit
`23a8c2ff077714747e072e56d2bac39904caec66`.

The frozen profile is
`contracts/vnext/protected-equality-private-loader-profile.v1.json`. It is
3,254 bytes with SHA-256
`e209d31c0c8b2243aa231092feabf5106acdb141f72d32a18e2f1940c5af84e3`.
The exact nine-member implementation source closure has SHA-256
`63843bfea80972ce402d8987ce72ac47ba47f1b769ecabe5de5d0ba8b3a14b77`.

The implementation consists of:

- `tinyrustlm/tools/vnext-protected-equality-private-loader.js`;
- `tinyrustlm/tests/helpers/vnext-protected-equality-private-loader-child.js`;
- `tinyrustlm/tests/vnext-protected-equality-private-loader.test.js`; and
- the existing signed-bundle verifier and opaque-handle implementation in
  `tinyrustlm/tools/vnext-protected-equality-custody.js`.

This is one clean-slate contract. It has no path-based private loader, standard
input mode, environment-variable mode, argument mode for private bytes,
network mode, compatibility reader, retry with changed pins, or unsigned
fallback.

## Security Objective

The public redaction result is only meaningful when a release operation cannot
silently replace the known-secret set with an easier list. Directly passing a
private bundle, a path, or a raw list through ordinary release options would
create substitution, logging, process-list, environment, and persistence
surfaces. The loader instead separates:

1. canonical public control bytes containing exact authority and revision pins;
2. one canonical private signed bundle delivered through a dedicated inherited
   non-file pipe; and
3. the module-issued opaque custody handle returned after all checks pass.

The loader never returns the private wire bytes, private values, their hashes,
or a commitment to the private list.

## Public Trust Descriptor

The loader's only function argument is a bounded byte array containing strict
canonical RFC 8785 JCS. The object has exactly seven fields:

- `schema`;
- `authorityPublicKeyBase64`;
- `expectedAuthorityKeyId`;
- `expectedCustodyId`;
- `expectedGeneration`;
- `expectedRevisionId`; and
- `verificationTimeUtc`.

Its schema is
`tinyrustlm.vnext.protected_equality_trust_descriptor.v1`. The descriptor is
public control input, not private secret material. Unknown fields, accessors,
non-byte views, shared memory, invalid UTF-8, duplicate JSON keys, noncanonical
wire bytes, arrays, and inputs outside 1 through 4,096 bytes fail closed.

The loader does not obtain time from the runtime clock. The supplied trusted
verification time is still checked by the custody verifier against the signed
issue and expiry interval. Authority discovery, revocation, and trusted-time
acquisition remain responsibilities of the authorized launcher.

## Private Pipe Contract

The authorized launcher must create a fresh process with a dedicated readable
pipe at descriptor 3. It writes exactly one canonical signed private bundle to
the write end and closes that end. The loader accepts no descriptor number from
the caller and performs this sequence:

1. defensively copy the canonical public trust bytes;
2. call `fstat` on descriptor 3;
3. require the `S_IFIFO` file-type bits and reject files, directories, links,
   block devices, character devices, and sockets;
4. parse and canonicalize the exact public trust descriptor;
5. read the private pipe synchronously to EOF under both byte and operation
   bounds;
6. close descriptor 3 regardless of success or failure;
7. verify the private bundle's canonical wire, signature, pins, revision chain,
   generation, validity interval, and secret bounds;
8. compile the frozen secret representations behind one opaque handle; and
9. zero every loader-owned delivery buffer in `finally` paths.

On the current Windows Node runtime, an inherited anonymous pipe carries
`S_IFIFO` mode bits even though `Stats.isFIFO()` is false. The implementation
therefore validates the file-type bits directly and separately rejects every
non-pipe type. The same `S_IFIFO` check applies on POSIX hosts. A regular file
inherited at descriptor 3 is rejected and closed.

The pipe is single use. After a successful load, a second load in the same
process cannot reuse descriptor 3 because the loader has closed it. A retry
requires a fresh authorized process, fresh pipe, and the same independently
resolved exact public pins.

## Bounds

| Item | Limit |
| --- | ---: |
| Canonical trust descriptor | 4,096 bytes |
| Canonical private bundle | 524,288 bytes |
| Read scratch buffer | 16,384 bytes |
| Pipe read operations, including EOF or oversize sentinel | 33 |
| One source-closure member | 1,048,576 bytes |

The byte reader reserves one sentinel byte beyond the private bundle limit. An
exact-limit bundle therefore requires an EOF read; any additional byte fails as
`equality_loader_bundle_byte_limit`. Too many partial reads fail as
`equality_loader_read_operation_limit`. The authorized launcher is required to
write the one bounded canonical bundle and close its end rather than trickle an
unbounded stream.

## Buffer Lifetime

The loader owns a copy of the trust descriptor, one reusable read scratch
buffer, bounded private chunks, and one concatenated private bundle. All are
filled with zero in `finally` paths after success or failure. The lower-level
custody verifier also zeros its defensive wire copy, canonical bundle,
domain-separated signature payload, decoded signature, and decoded public-key
copy.

The compiled secret representations necessarily remain in process memory while
the opaque custody handle is live. JavaScript strings, runtime internals, OS
pipe buffers, crash dumps, swap, and compromised-process memory cannot be
proven erased by `Buffer.fill(0)`. The profile states this limitation rather
than claiming cryptographic erasure.

## Failure Semantics

All failures are bounded `VnextEvidenceError` records. Important loader codes
are:

| Code | Meaning |
| --- | --- |
| `equality_loader_profile_invalid` | Installed frozen profile drifted |
| `equality_loader_source_invalid` | A source-closure member is absent or outside bounds |
| `equality_loader_trust_bytes_required` | Public trust input is not private, non-shared bytes |
| `equality_loader_trust_byte_limit` | Public trust input is empty or oversized |
| `equality_loader_trust_invalid` | Public trust JSON or exact fields are invalid |
| `equality_loader_trust_wire_invalid` | Public trust bytes are not canonical JCS |
| `equality_loader_pipe_unavailable` | Descriptor 3 is unavailable |
| `equality_loader_transport_invalid` | Descriptor 3 is not a non-file pipe |
| `equality_loader_read_failed` | The bounded pipe read failed |
| `equality_loader_read_operation_limit` | The stream exceeded the operation bound |
| `equality_loader_bundle_byte_limit` | The private bundle is empty or oversized |
| `equality_loader_close_failed` | The owned descriptor could not be closed |

Signed-bundle, pin, time, signature, revision, and secret validation retain the
more specific `equality_custody_*` codes. No error includes a host message,
path, bundle byte, public argument, or private value.

## Source Closure

The loader computes one canonical array of relative path, byte count, and
SHA-256 records over:

- both frozen custody and loader profiles;
- the receipt-signature profile used by deterministic UTC parsing;
- strict JSON and JCS implementations;
- the bounded evidence-error implementation;
- the signed custody verifier;
- the private loader; and
- deterministic signature-payload support.

Tests independently reconstruct this array, reject duplicate or noncanonical
relative paths, enforce each source-member bound, and compare the resulting
closure hash to the exported identity.

## Verification Evidence

The focused child-process suite passes 5/5. It proves a real inherited Windows
pipe, exact public pins, successful secret detection, fd-3 closure, bounded
public output, absence of private values and common encodings, rejection of a
missing descriptor, rejection of a regular file, empty and oversized bundle
rejection, malformed and signature-invalid bundle rejection, noncanonical and
unknown-field trust rejection, pin mismatch, and expired verification time.

The complete affected custody, loader, and redaction boundary passes 21/21 with
zero failures, skips, cancellations, or todos. The first direct active-worktree
run remains an infrastructure failure because Node realpathed the D-backed
junction without the maintained logical-root flags. A subsequent npm wrapper
attempt also remains an infrastructure failure because npm tried to write its
cache log to the full C: drive. The direct D-temporary-backed Node command with
`--preserve-symlinks --preserve-symlinks-main` is the terminal passing run. No
assertion or production path was weakened.

## Remaining Production Work

This checkpoint does not complete production custody. The following remain
required:

- make the sole release bootstrap load custody through this boundary instead
  of accepting a caller-created handle;
- remove the low-level signed-bundle factory from the production-facing API
  after tests use the same bootstrap path;
- implement and authorize the transactional issuer, unpredictable revision-ID
  allocation, predecessor/generation state, signing-key custody, and revocation;
- provide an authorized launcher that resolves current authority and trusted
  time, creates the dedicated pipe, and excludes credentials from its process
  environment and outputs;
- prove OS process, crash-dump, swap, and network isolation for the launcher;
  and
- run authorized production loading and release operations with current
  evidence.

Until those items are proven, the loader is local contract and hostile-input
evidence only. It proves no production secret custody, release authorization,
deployment, publication, MemoryEndpoints continuity, or campaign progress.
Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

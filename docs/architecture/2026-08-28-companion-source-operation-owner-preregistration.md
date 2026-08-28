# Companion Source Operation Owner Preregistration

## Decision Status

Registered before acquisition-contract replacement, worker implementation,
source networking, source-cache creation, model conversion, listener route
enablement, or browser cutover.

The machine-readable authority is
`contracts/vnext/companion-source-operation-owner-preregistration.v1.json`.
Its profile identity is
`tinyrustlm.companion.source-operation-owner/1`. It binds parent commit
`884d6c3d90976ba867490a4c562262cd79d81bca` and tree
`7058042cc11f1943f63cf3a18d775c9a62a3808c`.

This registration itself creates no operation, process, network request,
source byte, model byte, browser request, deployment, MemoryEndpoints request,
or campaign evidence. The registration is a clean-slate design constraint, not
an implementation or success claim.

## Why The Current Contract Must Be Replaced

The current source tree has strong but disconnected pieces:

- an authenticated numeric-loopback capability protocol;
- a deterministic operation journal;
- a cancellation intent;
- a strict complete six-member source-conversion coordinator;
- terminal reconciliation;
- independently verified six-member artifact transfer; and
- a browser capability client that is present in source but not loaded by the
  product.

It has no real `ICompanionOperationExecutor`, no source acquirer, no operation
worker, and no listener dispatch to the operation service. The listener
truthfully returns `operation-not-available` for operation routes. Connecting
those routes to a placeholder scheduler would create queued fiction rather
than acquisition.

The current acquisition request hashes only model and route inputs. Once its
deterministic operation reaches a terminal rejection, the same explicit user
action can recover only that old terminal operation. A transient machine loss
during conversion therefore leaves two bad choices: relaunch an ambiguous
one-shot conversion or permanently poison the model selection. Neither is an
acceptable product contract.

The replacement adds a nonsecret, browser-generated `attemptId`. Exact replay
of one request still recovers one logical operation after a lost response. A
later explicit user command creates a new attempt identity and therefore a new
operation. The server never creates another attempt, retries automatically, or
selects a preferred result.

The current request also admits peer candidates and peer states even though
the available P2P admission API handles only one SLM2 model or one ACG2 member.
It does not atomically import and verify all six composition members. Those
states are not a working product route and must be removed from the sole
executable contract. Source acquisition is the only admitted route in this
checkpoint. A complete six-member peer importer will require its own
output-free clean replacement before P2P claims or UI are enabled.

## Clean-Slate Wire Contract

The sole replacement identities are:

- loopback profile `tinyrustlm.companion.loopback-capability/4`;
- request `tinyrustlm.companion.acquire.v2`;
- journal record `tinyrustlm.companion.operation.v3`; and
- public projection
  `tinyrustlm.companion.loopback.operation-projection.v2`.

The shipping browser, server, journal, worker, vectors, and documentation must
change atomically. There is no v1/v2 compatibility reader, migration, alias,
dual writer, content translation, or route negotiation. Historical bytes
remain understandable from immutable source and documentation only.

The request contains exactly these ordered fields:

1. `schema`;
2. `attemptId`;
3. `route`;
4. `modelId`;
5. `sourceRepository`;
6. `sourceRevision`;
7. `modelSourceLockSha256`;
8. `tokenizerSourceLockSha256`;
9. `compositionProfileSha256`;
10. `sourceAcquisitionApproved`; and
11. `maximumSourceBytes`.

`attemptId` is exactly 16 random bytes rendered as 32 lowercase hexadecimal
characters. The browser creates it only when the user explicitly commands an
acquisition. It is not a credential. It may be retained with bounded operation
resume metadata, but no service worker or site creates attempts in the
background.

`route` is exactly `source`. Peer candidates are absent. Approval must be
literal `true`. Repository, revision, lock, profile, and byte ceiling must
equal one installed built-in source descriptor. The operation ID remains the
lowercase SHA-256 of exact canonical request bytes.

## Source-Only State Machine

The executable states are:

```text
Queued
  -> AcquiringSource
  -> Converting
  -> VerifyingComposition
  -> Available
```

`Cancelled` and `Rejected` are terminal exits from any admitted nonterminal
state when their exact guards hold. `Available`, `Cancelled`, and `Rejected`
never transition. `CheckingPeers`, `FetchingPeer`, and `VerifyingPeer` are
deleted from the executable contract.

Progress is per-state physical byte progress, not a synthetic cross-phase
percentage. During source acquisition it is verified source bytes out of the
exact source closure. During conversion it may be unknown. During composition
verification it is verified artifact bytes. The UI must name the current
state and must not imply a smooth percentage when the denominator is unknown.

The operation record binds the canonical request, monotonically increasing
sequence, route, state, current-state progress, create/update timestamps,
terminal artifacts or bounded error, and hashes of every create-only private
intent or receipt. History remains append-only. `current.json` is only a
validated pointer to the latest immutable sequence record.

## Dedicated Operation Owner

`TinyRustLM.CompanionHost` remains the interactive pairing and authenticated
loopback listener. It never performs model networking, hashing, or conversion
on a listener thread.

`TinyRustLM.CompanionWorker` is a separate noninteractive process. It accepts
one public-safe operation ID and resolves the same current-user installation
root as the host. It accepts no root, path, URL, command, repository, token,
or environment-selected plugin. The installed manifest fixes the worker and
converter executable paths and hashes.

Every operation directory contains `operation.owner.lock`. A worker must hold
an exclusive open handle for its full lifetime before it writes an execution
intent or changes state. If concurrent host requests launch more than one
candidate worker, exactly one obtains the lock. Every loser exits without a
journal, source, output, or terminal write. The lock is a liveness primitive,
not durable proof.

The worker writes or exactly observes one canonical create-only
`execution.intent.json`. It binds operation and request identity, attempt ID,
installed worker and converter hashes, built-in source descriptor, all private
owned roots, and network and resource profiles. Existing changed bytes are a
terminal contract failure. The public projection never exposes the intent or
its private paths.

Only one worker may perform source or conversion work at a time for the first
model slice. This is a deliberate memory, disk, and CPU admission limit. It is
not a hidden queue of unbounded work.

## Converter Process Custody

The worker must ensure that its death cannot leave an unowned converter tree.
On Windows, launch is suspended, assigned to a Job Object configured to kill
all members when the owner closes the last handle, and only then resumed. No
breakaway is allowed. On Linux, the launcher establishes a dedicated process
group and parent-death signal before exec. If the platform cannot establish
the registered containment, conversion rejects before process launch.

Normal cancellation or timeout terminates the complete contained tree and
waits before terminal inspection. A valid native pass or rejection remains
authoritative in a race. No terminal evidence after confirmed tree death may
become `Cancelled`. Invalid terminal evidence becomes `Rejected`. A known
live protocol violation cannot be laundered into a pass.

## Restart Classification

A newly started host first reads the journal and probes the owner lease.

| State | Owner lease | Evidence | Action |
| --- | --- | --- | --- |
| `Queued` | unheld | none | launch one worker |
| `AcquiringSource` | held | exact intent | observe only |
| `AcquiringSource` | unheld | exact intent/staging | launch one recovery worker |
| `Converting` or `VerifyingComposition` | held | any | observe only |
| either conversion state | unheld | valid terminal | read-only reconcile |
| either conversion state | unheld | pending | reject `operation-owner-lost` |
| terminal | any | validated journal | read only |

Source transfer is resumable because every byte boundary is explicitly
verified and no one-shot conversion has started. Conversion is never
relaunched after owner loss. The platform containment makes an unheld worker
lease evidence that its converter tree is no longer live. Pending native
output is preserved and the attempt rejects. A user may deliberately create a
new attempt ID; the server does not do so.

## Built-In Source Closure

The only initial descriptor is:

- product model ID `qwen3-0.6b`;
- repository `Qwen/Qwen3-0.6B`;
- immutable revision `c1899de289a04d12100db370d81485cdf75e47ca`;
- base lock SHA-256
  `e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d`;
- Tokenizer2 lock SHA-256
  `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70`;
- composition profile SHA-256
  `c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0`;
- nine exact files totaling 1,519,207,688 bytes; and
- Apache-2.0 license evidence within that locked closure.

The worker assemblies embed the exact two lock files. Startup verifies the
embedded resource lengths and hashes against compiled constants before any
network request. The operation request selects the descriptor by exact
identity; it never supplies a download URL.

The initial file URL is constructed only from the fixed HTTPS origin, exact
repository, exact full commit, and one validated lock filename. Ambient
`main`, latest revisions, local Hugging Face caches, credentials, arbitrary
endpoints, and repository-wide snapshot behavior are not admitted.

## Streaming Source Acquisition

The Companion owns a content-addressed source cache keyed by the exact base
source-lock hash. Payload files live in a direct `payload` directory. Receipts,
locks, and partial files live outside that directory so the converter sees the
exact nine-file source inventory.

One exclusive source-cache writer is allowed. A complete cache is never
trusted by directory name: every use checks direct non-reparse containment,
the exact nine-file set, every length, every streamed SHA-256, the license, and
both lock relationships.

Downloads use a one-MiB pooled buffer, `Accept-Encoding: identity`, no cookies,
no authentication, no automatic decompression, and no automatic redirect.
Every redirect is interpreted by the Companion and is limited to eight HTTPS
hops. User information, fragments, IP literals, loopback, private, link-local,
and nonpublic actual connection addresses are rejected. No sensitive header is
forwarded.

An initial transfer accepts only status 200. A restart from an exact partial
length accepts only 206 with an exact `Content-Range` start, end, and total.
A server that ignores the range, a short read, extra bytes, unexpected content
encoding, size drift, or hash drift rejects the operation. There is no second
network request, alternate origin, mirror, or automatic restart within the
live worker.

Partial evidence is preserved outside the activated payload. A completed file
is flushed through managed and intermediate buffers, re-opened, length-checked,
and fully hashed before create-only promotion. After all files complete, the
whole closure is independently reverified and a canonical create-only source
receipt is written. Only then may the source operation advance to conversion.

## Cancellation

The authenticated server writes the existing create-only cancellation intent.
The worker observes it within 250 milliseconds. During HTTP transfer it aborts
the request and flushes the owned partial state. During conversion it stops and
waits for the contained process tree, then applies terminal-evidence
precedence.

The server may wait up to 30 seconds for a terminal journal state. If that
bounded wait expires, it returns `companion-unavailable`; it does not erase or
replace the cancellation intent, claim success, or start a second worker. The
worker must still complete cancellation and publish the authoritative terminal
state.

## P2P Boundary

The existing P2P SDK is useful for strict fixed-piece transport of one SLM2 or
one ACG2 artifact, but that is not the product acquisition unit. A product
composition has SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2
members. A peer route must atomically bind and install all six, including the
ACG2 graph, quality and provenance claims, fixed pieces, and final independent
composition inspection.

This registration does not adapt the one-file API, expose peer states, or call
source-only behavior "P2P first." Documentation and marketing must remain
equally narrow. A later output-free registration may replace this contract
with a complete peer-or-source route; it must delete the source-only wire in
the same clean cut.

## Implementation Gate

Implementation order is fixed:

1. commit, push, fresh-fetch, and verify this output-free registration;
2. replace request, record, projection, codecs, vectors, journal, browser, and
   server with the sole new wire contract;
3. implement strict embedded source descriptors and lock materialization;
4. implement bounded manual-redirect streaming acquisition;
5. implement worker lease, restart, and cancellation ownership;
6. implement platform-contained converter launch;
7. join source completion to the existing complete-composition coordinator;
8. wire listener operation routes only after real executor tests pass;
9. delete the superseded product acquisition controller during browser cutover;
10. preregister the first real network/source operation before it writes
    private source bytes; and
11. design six-member P2P import as a later clean replacement.

The required gate includes strict canonical wire vectors, source-lock parser
hostility, ten-way ownership races, crash windows, redirect and address
attacks, range boundaries, short/long/hash-drift bodies, bounded allocations,
cache tampering, worker loss, contained process death, cancellation races,
terminal reconciliation, artifact nonavailability before terminal pass,
secret/private-path scans, full managed and browser tests, documentation drift
checks, and zero campaign increments.

## Claim Boundary

This registration proves only that the implementation input and intended
replacement are frozen at an exact parent. It does not prove that the contract
is correct, the worker exists, source bytes can be downloaded, a model can be
converted, a browser can acquire or execute it, a peer exists, a site is
deployed, or MemoryEndpoints continuity ran.

Campaign counters remain exactly 0/20 qualified models, 0/50 deletion-backed
browser rounds, 0/25 authorized live memory rounds, 0/40 current
outside-network lane proofs, and 0/20 live catalog announcements.

## Primary Sources

- [Hugging Face Hub download guide](https://huggingface.co/docs/huggingface_hub/main/guides/download),
  current documentation retrieved 2026-08-28. It documents selecting a file
  at a full repository revision.
- [Git LFS pointer specification](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md),
  retrieved 2026-08-28. It defines canonical pointer, SHA-256 object identity,
  and size semantics.
- [.NET `HttpClientHandler.AllowAutoRedirect`](https://learn.microsoft.com/en-us/dotnet/api/system.net.http.httpclienthandler.allowautoredirect?view=net-8.0),
  retrieved 2026-08-28. Automatic redirects are deliberately disabled so the
  Companion owns every target decision.
- [.NET `SocketsHttpHandler.ConnectCallback`](https://learn.microsoft.com/en-us/dotnet/api/system.net.http.socketshttphandler.connectcallback?view=net-8.0),
  retrieved 2026-08-28. It is the connection boundary for enforcing actual
  destination-address policy.
- [.NET `FileStream.Flush`](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.flush?view=net-8.0),
  retrieved 2026-08-28. `Flush(true)` requests that intermediate file buffers
  be written to disk; platform durability claims remain separately bounded.
- [Microsoft Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects),
  updated 2025-07-14 and retrieved 2026-08-28. Job Objects manage a process
  tree as a unit and can terminate members when the last configured owner
  handle closes.

# TinyRustLM Local Companion

## Release Status

The TinyRustLM local companion is prelaunch and unavailable for installation.
No package URL, archive URL, tool command, or install command is an authority
until the exact SLM2-only companion passes clean build, native, package,
browser, publication, and independent public-readback gates.

The old public-package lane has been deleted. The current companion is a
private solution component while its sole production archive and browser
contract are rebuilt. There is no supported earlier package, command alias,
compatibility route, migration path, or fallback executable.

## Sole Responsibility

The companion coordinates local operations that a browser cannot safely or
portably own. The current source boundary is:

1. accept one explicit attempt for the exact built-in Qwen3 source closure;
2. bind source acquisition, converter, worker, roots, and resource policies in
   immutable private evidence before work advances;
3. invoke only the canonical `tinyrustlm-convert` executable;
4. journal interruption-safe progress without exposing secrets or prompts;
5. independently reverify and stream all six composition members; and
6. expose bounded start, status, and stop operations for a companion-owned
   direct seed only after the exact source operation is `Available`.

Browser direct-peer import is intentionally not a companion acquisition route.
The compact chooser admits a qualified catalog and peer announcement, then the
browser fetches the exact six members directly from the peer into its own
verified store. The companion does not proxy those bytes. Its acquisition
request remains source-only; its direct-seed routes can expose an exact
locally converted composition after browser installation. Seed readiness on
loopback or a local interface is not discovery, a MiniModel announcement,
external reachability, or live P2P evidence.

MiniModel.org is authorized to serve the initial model seeds directly to browsers.
The basic app restores a usable installed composition or obtains a small qualified
default through that seed; it does not require the companion. Source acquisition,
conversion and manual peer controls are Advanced operations. The pinned unchanged
`Qwen/Qwen3-0.6B@c1899de289a04d12100db370d81485cdf75e47ca` is rejected for product
quality and remains diagnostic-only. `Available` is a structural operation state,
not qualification, catalog admission or permission to make that model the default.

Rust remains authoritative for model structure, conversion, Tokenizer2,
Template2, Sampling2, Prompt2, ACG2, fixed-piece admission, and runtime
semantics. The companion transports bounded typed operations and never repairs,
relabels, repacks, or partially activates an artifact.

The Rust executable now implements one exact complete command,
`tinyrustlm-convert qwen3-composition`, that creates and independently verifies
the six required artifacts under one terminal receipt. The private managed
wrapper now invokes only that command and independently revalidates its exact
inventory, operation and receipt lineage, and streamed member hashes. The
private Companion source branch reports `Available` only after mapping all six
verified identities through `VerifyingComposition`.

## Implemented Foundation

The private, nonpackable `TinyRustLM.Companion` solution component now owns the
closed `tinyrustlm.companion.acquire.v2` request and
`tinyrustlm.companion.operation.v3` record contracts. A request binds a new
32-lowercase-hex attempt ID, the sole `source` route, exact Qwen3 repository and
immutable revision, model and tokenizer source locks, complete composition
profile, explicit source-acquisition consent, and exact source byte ceiling.
Only the built-in reviewed source descriptor is admitted. Arbitrary models,
URLs, paths, peer candidates, mutable revisions, unknown fields, and incomplete
identities fail before network or process work.

Its create-only operation journal requires an explicit owned-root marker,
persists immutable numbered history, replaces only the bounded current pointer,
uses operation-root-scoped same-process and cross-process exclusion, and
enforces the closed state machine from `Queued` through `AcquiringSource`, `Converting`, and
`VerifyingComposition` to terminal `Available`, `Cancelled`, or `Rejected`.
`Available` requires exact positive records for
ACG2, SLM2, Tokenizer2, Template2, Sampling2, and Prompt2.

Numbered create-only history is authoritative. The mutable `current.json`
cache may lag by exactly one committed history record at the interrupted
replace boundary; a larger lag, gap, rollback, foreign record, or contradictory
transition rejects. Before appending another transition, a mutation holding
both exclusion layers first repairs that one-record derived-cache lag, so a
second interruption cannot accumulate an unrecoverable two-record gap.
Same-process operation gates are exact-key,
reference-counted leases removed after the final holder, while the create-only
operation lock remains the cross-process boundary. Cancellation waits at most
five seconds for an active same-operation mutation before returning the typed
`journal-operation-busy` result.

Cancellation has one separate create-only canonical intent. The same
operation and cancellation ID replays exactly, a competing ID cannot replace
it, and terminal evidence wins a race. The operation service returns a
cancelled projection only after its required executor has stopped owned work
and committed `Available`, `Rejected`, or `Cancelled`; an executor that returns
while work remains nonterminal is an internal failure, not successful
cancellation. Identical operation IDs under distinct owned roots do not share
an in-process lock domain.

Before any source work, the coordinator creates canonical private
`tinyrustlm.companion.execution-intent.v1` and
`tinyrustlm.companion.source-acquisition-intent.v1` envelopes. They bind the
attempt, request, installed worker and converter hashes, exact source
descriptor and cache identity, separate nonoverlapping acquisition, cache,
model, tokenizer, lock, staging, and output roots, network policy, redirect and
buffer ceilings, resource policy, canonical payload-inventory schema, and
expected payload-inventory SHA-256. A verified acquisition then creates one
`tinyrustlm.companion.source-acquisition-receipt.v1` binding the same exact
nine-file inventory identity, byte count, locks, intent lineage, and separate
activated model and tokenizer roots. The sole inventory is canonical JSON
`tinyrustlm.source-payload-inventory.v1`, sorted by ordinal path and containing
only path, byte length, and SHA-256 for each locked file; its exact digest is
`59e57ba08d4dc6e0914f6089f3321c073739ed60a506edd533068d8d0d2b2da9`.
An arbitrary digest-shaped receipt is rejected.

Before source conversion, the coordinator creates one canonical private
`tinyrustlm.companion.source-conversion-intent.v1` envelope at
`source-conversion.intent.json`. It binds the operation and immutable request
to normalized source-lock paths and hashes, source directories, conversion
profile, absent output root, exact converter path and executable hash, resource
limits, and terminal rule. The file is create-only; identical bytes may be
observed idempotently, changed bytes fail closed, and its SHA-256 is required by
source `Converting`, `VerifyingComposition`, and `Available` journal records.
No superseded operation-record reader or migration exists.

The live owner revalidates every intent input immediately before process
creation. It preserves native rejection or caller cancellation without deleting
evidence and advances through `Converting`, `VerifyingComposition`, and
`Available` only after complete verification. Durable composition facts are
separate from stdout hash and elapsed-time observations, so process-loss
recovery never fabricates live evidence.

Caller cancellation is checked before live input validation and between each
1 MiB file-hash read, including EOF, during launch validation and result
verification. It preserves the caller's cancellation token and all durable
output; it does not turn a stopped verification into an integrity failure.
A synchronous filesystem read already in progress must return before the next
check. Intent creation and read-only terminal reconciliation remain synchronous;
reconciliation must finish verifying a committed result even after cancellation.
The process-duration policy does not promise a deadline for this disk work.

`ReconcileTerminal` accepts only an intent-bound source operation in
`Converting` or `VerifyingComposition`. It launches, adopts, retries, and kills
nothing. An absent or nonterminal bounded root remains pending with no journal
write. A strict native rejection becomes `Rejected`. A complete pass is
reconstructed by freshly verifying the exact ten-file inventory, attempt and
receipt lineage, all six streamed artifact hashes, component receipts, source,
tool, profile, operation, graph, durability, resource, and nonclaim fields,
then advances once to `Available`. Invalid or contradictory terminal evidence
becomes the bounded `companion-conversion-terminal-invalid` rejection while all
bytes remain preserved. `Available`, `Cancelled`, and `Rejected` cannot be
overwritten.

After owned-process cancellation, a valid durable pass wins, a valid native
rejection wins, and no terminal evidence becomes `Cancelled`. Known live
protocol violations such as timeout, output overflow, unexpected stderr,
executable drift, or nonzero exit are rejected directly and cannot be laundered
by later reconciliation. The deterministic executable fixture proves these
contracts only; it cannot satisfy a real-model gate.

The private solution now also contains the exact
`tinyrustlm.companion.loopback-capability/4` Kestrel listener. It binds only
numeric `127.0.0.1` on an operating-system-selected port, accepts HTTP/1.1
only, closes every response, suppresses the Server header and logging, enforces
the registered request and connection ceilings, and rejects unregistered
Host, Origin, route, method, headers, framing, media type, body, capability,
sequence, or operation identity. Pairing, status, rotation, replay recovery,
and revocation cross real TCP in tests. Application errors are canonical and
bounded; authenticated application errors are response-proven. Kestrel-owned
malformed-line, framing, header, and global-body failures mutate no capability
state and carry no CORS or session proof.

The source-controlled browser capability client implements the matching `/4`
memory-only pairing, exact lost-response recovery, authenticated sequencing,
rotation, revocation, attempt-bound deterministic operation identity,
source-only projection, cancellation, artifact-chunk verification, and
direct-seed start/status/stop contracts. The product UI loads this client and
the companion composition installer. The browser independently admits only the
same exact built-in Qwen3 repository, revision, source-lock,
composition-profile, and byte-ceiling values as the managed contract and does
not persist a pairing or session key.

The private operation service and artifact-transfer owner implement the
public-safe projection boundary and source-composition transfer below the
listener. Transfer accepts only a journaled source operation in `Available`,
reopens its exact persisted conversion intent, independently re-inspects the
terminal composition, closes all six journal/member/path identities, and
serves fixed 4 MiB chunks. It hashes the complete member before transfer,
checks every open and bounded read, rehashes after the final chunk, and emits
only public metadata and bytes. Private paths never enter a response. The
listener dispatches create/read/cancel operation routes, artifact chunks, and
direct-seed start/status/stop routes to the injected production services.

The private `TinyRustLM.CompanionHost` executable accepts no arguments. It
derives one `TinyRustLM.Companion` directory below the current user's local
application-data root, refuses noninteractive or redirected output before any
state creation, starts the exact listener, and only then displays one
single-use `TRLC1` pairing code. It emits only closed public-safe startup codes
on failure. This executable remains private and is not an installation or
release artifact.

This implementation is not yet a companion release. It does not provide an
installation archive or service installer, discover public peers, publish a
MiniModel announcement, prove an externally reachable seed, or authorize an
arbitrary source. A pending root has no authenticated orphan-process ownership
or safe relaunch protocol, so it remains visibly pending rather than guessed,
adopted, or retried. No authorized real-source execution receipt has passed
through this coordinator. Deterministic fixtures and local process tests do
not close the package, model, browser, network, deployment, or public-readback
gates.

## Browser Boundary

The browser uses the one closed loopback capability contract owned by the
private listener. Pairing requires explicit user action and binds the exact
allowed web origin, ephemeral session, operation identity, and bounded route
set. Unknown routes, fields, versions, identities, and operations fail closed.

The basic UI restores an eligible installed composition or automatically acquires
a small qualified MiniModel seed. If neither is available, it stays unavailable
rather than starting conversion. In Advanced, a selected catalog entry matching
the supported immutable source may request the companion's one-time code, create
one source operation, poll its typed projection, verify admission and all six
artifact streams, and install the admitted composition into browser storage.
The runtime still requires independent qualification before useful-model claims.

After a converted composition is installed, the browser may request one
companion-owned direct seed bound to that exact operation. Start-response loss,
reconnect, cancellation, stop, and bounded lifecycle limits are represented as
typed states; the browser does not issue a second start to guess success. A
ready local seed still carries no public availability or qualification claim.

The browser must never receive an instruction file in place of a model action.
Selecting an admitted seed/peer model performs verified acquisition. Explicit
Advanced source conversion uses the paired companion. Neither route downloads a
text file, JSON request, PowerShell file, shell script, or conversion kit as a
substitute for acquiring the composition.

MiniModel.org may serve model bytes; TinyRustLM.com remains the app/runtime host.
Prompts and inference stay local. Model downloading does not authorize uploading
chat or indefinite background seeding. The first release must not silently change
router, firewall, startup-service, or sharing state.

## Required Release Evidence

A companion download may appear only after all of these gates pass for one
exact source revision and artifact set:

- warnings-denied managed and Rust builds;
- exact current native and converter identities;
- hostile loopback-origin, pairing, request-bound, and DNS-rebinding tests;
- crash-consistent acquisition and conversion journal tests;
- create-only artifact promotion, streamed hashes, and tamper rejection;
- clean `win-x64`, `linux-x64`, and `linux-arm64` archive construction;
- real execution on every platform claimed as executed;
- signed checksums, symbols, SBOM, provenance, secret scan, and archive scan;
- fresh-browser P2P-or-convert acceptance with cancellation and restart;
- exact public download and checksum readback from an independent environment;
  and
- synchronized product, architecture, operator, and update documentation.

Cross-compilation, a local package, a loopback fixture, one attractive model
response, or an HTTP success does not satisfy the release gate.

## Current Claim Boundary

No production companion artifact is published. The private listener, host,
operation runtime, browser client, browser installer, and direct-seed runtime
are connected in source and have local deterministic coverage only; that is
not package, real-model, browser-round, public-network, deployment, or release
evidence. No authorized real acquisition receipt, P2P lane with current outside
proof, catalog announcement, or qualified real TinyRustLM model exists.
MemoryEndpoints is authorized and strongly recommended for portable
cross-device continuity; no authenticated live lifecycle receipt exists.
Campaign counters remain 0/20 models, 0/50 clean browser rounds, 0/25 live
memory rounds, 0/40 externally proven lanes, and 0/20 catalog announcements.

The authoritative next work is an authorized real-source vertical slice,
qualified composition evidence, clean browser execution, package custody,
outside-network seed verification, publication, and independent public
readback. This document must be updated with exact artifact and publication
identities only after those facts exist.

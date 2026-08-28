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
portably own:

1. resolve one exact requested ACG2 composition identity;
2. prefer a current consenting direct peer only when its identity and evidence
   are valid;
3. acquire the immutable reviewed upstream source when no eligible peer exists;
4. invoke only the canonical `tinyrustlm-convert` executable;
5. stream and verify source, piece, SLM2, and composition hashes;
6. journal interruption-safe progress without exposing secrets or prompts;
7. stream the verified artifacts to the browser for independent admission; and
8. host user-approved fixed pieces without claiming public reachability from a
   loopback or LAN probe.

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
closed `tinyrustlm.companion.acquire.v1` request and
`tinyrustlm.companion.operation.v2` record contracts. A request binds one
public repository, immutable 40-hex revision, model and tokenizer source locks,
composition profile, explicit source-acquisition consent, a positive source
byte ceiling, and no more than two ordered HTTPS peers. Credentials, mutable
revisions, IP literals, query strings, fragments, duplicates, unknown fields,
and incomplete identities fail closed.

Its create-only operation journal requires an explicit owned-root marker,
persists immutable numbered history, replaces only the bounded current pointer,
uses operation-root-scoped same-process and cross-process exclusion, and enforces the closed state
machine from `Queued` through peer or source work to terminal `Available`,
`Cancelled`, or `Rejected`. `Available` requires exact positive records for
ACG2, SLM2, Tokenizer2, Template2, Sampling2, and Prompt2.

Cancellation has one separate create-only canonical intent. The same
operation and cancellation ID replays exactly, a competing ID cannot replace
it, and terminal evidence wins a race. The operation service returns a
cancelled projection only after its required executor has stopped owned work
and committed `Available`, `Rejected`, or `Cancelled`; an executor that returns
while work remains nonterminal is an internal failure, not successful
cancellation. Identical operation IDs under distinct owned roots do not share
an in-process lock domain.

Before source conversion, the coordinator creates one canonical private
`tinyrustlm.companion.source-conversion-intent.v1` envelope at
`source-conversion.intent.json`. It binds the operation and immutable request
to normalized source-lock paths and hashes, source directories, conversion
profile, absent output root, exact converter path and executable hash, resource
limits, and terminal rule. The file is create-only; identical bytes may be
observed idempotently, changed bytes fail closed, and its SHA-256 is required by
source `Converting`, `VerifyingComposition`, and `Available` journal records.
The v1 operation-record reader is deleted and no migration exists.

The live owner revalidates every intent input immediately before process
creation. It preserves native rejection or caller cancellation without deleting
evidence and advances through `Converting`, `VerifyingComposition`, and
`Available` only after complete verification. Durable composition facts are
separate from stdout hash and elapsed-time observations, so process-loss
recovery never fabricates live evidence.

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
`tinyrustlm.companion.loopback-capability/3` Kestrel listener. It binds only
numeric `127.0.0.1` on an operating-system-selected port, accepts HTTP/1.1
only, closes every response, suppresses the Server header and logging, enforces
the registered request and connection ceilings, and rejects unregistered
Host, Origin, route, method, headers, framing, media type, body, capability,
sequence, or operation identity. Pairing, status, rotation, replay recovery,
and revocation cross real TCP in tests. Application errors are canonical and
bounded; authenticated application errors are response-proven. Kestrel-owned
malformed-line, framing, header, and global-body failures mutate no capability
state and carry no CORS or session proof.

The source-controlled browser capability client implements the matching
memory-only pairing, exact lost-response recovery, authenticated sequencing,
rotation, revocation, deterministic operation identity, projection,
cancellation, and artifact-chunk verification contracts. It stores no
pairing/session key and is included in web source inventory, but it is not
loaded by the product UI.

The private operation service and artifact-transfer owner now implement the
public-safe projection boundary and source-composition transfer below the
listener. Transfer accepts only a journaled source operation in `Available`,
reopens its exact persisted conversion intent, independently re-inspects the
terminal composition, closes all six journal/member/path identities, and
serves fixed 4 MiB chunks. It hashes the complete member before transfer,
checks every open and bounded read, rehashes after the final chunk, and emits
only public metadata and bytes. Private paths never enter a response. Peer
artifact resolution remains unavailable until a separately verified importer
owns its path and receipt authority.

The private `TinyRustLM.CompanionHost` executable accepts no arguments. It
derives one `TinyRustLM.Companion` directory below the current user's local
application-data root, refuses noninteractive or redirected output before any
state creation, starts the exact listener, and only then displays one
single-use `TRLC1` pairing code. It emits only closed public-safe startup codes
on failure. This executable remains private and is not an installation or
release artifact.

This implementation is not yet a companion release. It does not discover or
fetch peers, download model source, recover a completed conversion from an
absent or nonterminal root, dispatch the implemented operation service through
the listener, load the capability client in the product UI, install a service,
or expose an installation archive. A pending root has no authenticated
orphan-process ownership or safe relaunch protocol yet, so it remains visibly
pending rather than guessed, adopted, or retried. No real source has been
passed through the coordinator. The deep acquisition gate remains explicitly
unavailable until those production owners and their registered evidence exist.

## Browser Boundary

The browser must use the one closed loopback capability contract now owned by
the private listener. Pairing requires explicit user action and binds the exact
allowed web origin, ephemeral session, operation identity, and bounded route
set. Unknown routes, fields, versions, identities, and operations fail closed.
The strict browser client exists in source but is deliberately disconnected;
the current product must remain truthfully unavailable instead of probing,
retaining a key, selecting an alternate transport, or creating a queued
operation that no production executor can advance.

The browser must never receive an instruction file in place of a model action.
Selecting Get model performs verified P2P acquisition when available and
otherwise starts reviewed local source conversion. It does not download a text
file, JSON request, PowerShell file, shell script, or conversion kit.

Model bytes and prompts never pass through a TinyRustLM, MiniModel, or other
project-hosted website. The first release must not silently change router,
firewall, startup-service, or sharing state.

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

No production companion artifact is published. The private listener and host
pass local real-TCP and managed gates only. The browser client, operation
service, cancellation journal, and source artifact-transfer owner pass local
source and deterministic tests but are not product-connected or release
evidence. No real acquisition executor, P2P lane with current outside proof,
or qualified real TinyRustLM model exists. MemoryEndpoints is authorized and
strongly recommended for portable cross-device continuity; no authenticated
live lifecycle receipt exists. Campaign counters remain 0/20 models, 0/50
clean browser rounds, 0/25 live memory rounds, 0/40 externally proven lanes,
and 0/20 catalog announcements.

The authoritative next work is the clean SLM2 companion implementation and its
complete browser-local vertical-slice evidence. This document must be updated
with the exact version, release date, last-published time, artifact identities,
and public readback only after those facts exist.

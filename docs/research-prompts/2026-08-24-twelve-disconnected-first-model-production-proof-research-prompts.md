# Twelve Disconnected Research Prompts: TinyRustLM First-Model Production Proof

Each section below is a complete standalone assignment intended for a different
technical research agent. Send the entire text of one prompt to one agent. Do
not assume the agent has received this introduction, another prompt, or any
private TinyRustLM material.

The agents may browse public websites, standards, papers, package registries,
model repositories, immutable source revisions, and official documentation.
They have no access to the TinyRustLM source tree, private branches, local
models, build products, test output, receipts, credentials, signing keys,
deployment accounts, browser profiles, internal services, or unpublished
evaluation cases. Every report must distinguish directly observed public
facts, sourced external facts, engineering recommendations, assumptions, and
facts requiring local or authorized verification. An agent must never imply
that it inspected, built, ran, tested, or validated private TinyRustLM code.

These assignments seek implementable solutions for the first honest
production model path. Generic tutorials, speculative benchmark claims, and
invented local evidence are not useful.

## Prompt 1: Secure Browser-To-Loopback Companion Protocol And Resumable Operation Journal

You are an independent principal browser-security architect, local-service
protocol designer, and distributed-systems reliability engineer. Produce an
exceptionally detailed, implementation-oriented report specifying one secure,
versioned protocol between TinyRustLM.com in a browser and a user-owned
TinyRustLM companion on loopback. The protocol must make a model-selection
action result in a working local model: it first attempts verified direct P2P
acquisition and, when no eligible peer is available, performs reviewed source
acquisition and deterministic local conversion. You have internet access and
may inspect current browser standards, Chromium, Firefox, WebKit, Fetch, CORS,
Private Network Access, WebSocket, WebTransport, HTTP, CSP, loopback-security,
DNS-rebinding, CSRF, service-worker, and local-application protocol sources.
You cannot inspect TinyRustLM source code, binaries, network traces, private
schemas, or credentials. Do not claim private validation.

Public product context and fixed decisions:

- TinyRustLM is one prelaunch product. There is no launched V1, no product V2,
  no compatibility population, and no permission to preserve a legacy
  protocol, alternate endpoint family, text-request download, script-download
  workflow, fallback runtime, or known technical debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema versions, ABI
  versions, and package versions are exact technical identities, not product
  generations.
- TinyRustLM.com is the browser-local chat interface. Prompt text and model
  bytes must not be sent to a project-hosted website or proprietary telemetry
  collector.
- The user-owned companion performs P2P discovery/download and source
  acquisition/conversion. Rust is the sole model-format, conversion,
  validation, runtime, sampling, and P2P byte authority. A managed shell may
  expose packaging or user controls but must not duplicate those operations.
- Model activation requires one exact, content-addressed composition containing
  SLM2 model bytes, Tokenizer2, Template2, Sampling2, runtime-contract identity,
  declared limits, provenance, license decision, and conversion evidence.
- A P2P result is eligible only when the complete composition and every byte
  verify. If no eligible peer exists, the same browser action must begin the
  reviewed no-peer acquisition/conversion path. Downloading a `.txt`, `.ps1`,
  `.sh`, JSON request, or instructions is a product failure.
- Loopback, LAN, fixture, or NAT-hairpin health is not public P2P proof.
- The browser must show truthful typed states and support cancellation, restart,
  resume, stale-message rejection, and exactly one terminal outcome.
- MemoryEndpoints is currently unauthorized and disconnected. It is outside
  this protocol and must not be represented as live.

Use primary sources wherever possible. For every material source, record the
title, publisher, publication or update date when available, direct URL or
immutable revision, and report retrieval date. Separate normative browser
behavior from implementation-specific behavior and current experimental
features.

Research and specify all of the following in depth:

1. Compare HTTP request/response with polling, Server-Sent Events, WebSocket,
   WebTransport, and browser extension/custom-scheme approaches for this exact
   loopback operation. Select one minimal production transport and explain why
   every rejected transport adds risk or lacks needed semantics.
2. Define exact endpoint discovery without scanning arbitrary ports. Address a
   fixed port versus an installation receipt, collision handling, multiple
   companion instances, IPv4 and IPv6 loopback, `localhost` resolution,
   malicious local listeners, and browser restrictions on local-network
   requests.
3. Design an origin-bound bootstrap and capability document. Specify protocol
   identity, exact allowed web origins, companion build identity, converter and
   runtime identities, supported operation profile, maximum request and event
   sizes, current port, ephemeral session material, expiry, clock handling,
   unknown-field behavior, and fail-closed negotiation.
4. Analyze CORS, Private Network Access preflights, secure-context rules, mixed
   content, CSP `connect-src`, Cross-Origin-Resource-Policy, Fetch Metadata,
   Origin and Host validation, browser redirects, HSTS interactions, and
   loopback TLS tradeoffs. Provide exact response-header recommendations and
   state which headers cannot substitute for application authorization.
5. Design resistance to DNS rebinding, drive-by websites, CSRF, malicious
   extensions, other local processes, origin spoofing, Host-header attacks,
   wildcard origins, null origins, file origins, redirects, service workers,
   cached preflights, and confused-deputy requests. Include a formal attacker
   capability table.
6. Specify an ephemeral browser-companion authorization handshake that does
   not put durable secrets in URLs, localStorage, logs, referrers, screenshots,
   crash reports, command lines, or reports. Explain entropy, binding,
   expiration, single-session scope, replay rejection, process restart, and
   whether explicit user presence is required.
7. Define the operation request schema. Bind request ID, idempotency key,
   protocol and capability identities, requested catalog/model identity,
   source revision, composition constraints, P2P policy, conversion policy,
   storage destination class, sharing consent, resource limits, and privacy
   settings without accepting arbitrary paths or commands from the web page.
8. Define the append-only operation journal and state machine for `requested`,
   `authorized`, `discovering`, `peer_preflight`, `peer_acquiring`,
   `source_preflight`, `source_acquiring`, `hashing`, `converting`,
   `validating`, `transferring`, `persisting`, `activating`, `completed`,
   `cancel_requested`, `cancelled`, `blocked`, and `failed`. State every legal
   transition, terminal state, retry rule, and invalid transition.
9. Specify idempotency and recovery after a lost HTTP response, browser reload,
   browser process death, companion process death, machine restart, duplicate
   request, repeated button click, and a different tab using the same operation
   identity. A retry must recover one logical operation rather than create
   duplicate downloads or conversions.
10. Design ordered progress events. Include monotonic sequence numbers,
    operation identity, phase identity, bytes expected/received/verified,
    source size confidence, disk and memory preflight, converter progress,
    bounded status text, timestamps, heartbeats, event replay from a cursor,
    backpressure, and terminal-event uniqueness.
11. Define cancellation semantics at every phase. Explain interruptible versus
    atomic regions, cancellation acknowledgment, cleanup ownership, resumable
    partial artifacts, final validation races, late events, and why cancellation
    cannot be represented as success.
12. Specify bounded request parsing and response generation. Cover body/header
    limits, timeouts, UTF-8, duplicate JSON keys, number ranges, nesting,
    unknown required fields, content types, compression, chunking, malformed
    frames, request smuggling, slow clients, and resource-exhaustion controls.
13. Design multi-tab and multi-window arbitration. Address one active model
    operation, read-only observers, user cancellation authority, Web Locks or
    BroadcastChannel limitations, stale tabs, browser profile boundaries, and
    companion-side authority.
14. Define privacy-safe diagnostics and receipts. Bind public-safe hashes,
    sizes, versions, phase states, attempts, and error codes while excluding
    prompts, model bytes, source credentials, local paths, ephemeral secrets,
    and private catalog information. Include synthetic-sentinel scanner tests.
15. Provide concrete request, event, error, capability, journal, and terminal
    receipt JSON examples; Rust data-type sketches; browser TypeScript type
    sketches; and pseudocode for start, observe, cancel, resume, and terminal
    reconciliation. Examples must be internally consistent and bounded.
16. Produce a conformance and attack test matrix covering legitimate origins,
    malicious origins, DNS rebinding, stale capabilities, port collision,
    duplicate requests, lost responses, process crashes, event loss/reorder,
    oversized input, partial acquisition, conversion failure, cancellation,
    and exact terminal recovery.
17. Identify every result that requires local implementation inspection,
    physical-browser testing, companion execution, packet capture, operating
    system testing, or deployment-header readback.

Required report structure:

1. Executive protocol recommendation and explicit assumptions.
2. Public standards and browser-support observation table.
3. Trust-boundary and attacker-capability diagram.
4. Transport selection and exact endpoint/header contract.
5. Bootstrap, capability, and ephemeral authorization schemas.
6. Operation request and append-only journal schemas.
7. State, retry, cancellation, and recovery diagrams.
8. Progress-event ordering and multi-tab arbitration.
9. Bounded parsing and denial-of-service controls.
10. Privacy, logging, and receipt contract.
11. Rust and browser implementation pseudocode.
12. Conformance, fault-injection, and security test matrix.
13. Phased implementation plan with objective acceptance criteria.
14. Unknowns requiring local or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend wildcard CORS, a long-lived bearer token in a URL, arbitrary
port scanning, arbitrary local file paths, shell-command execution from the
browser, an undocumented fallback endpoint, best-effort event ordering, a text
download, or a mock as production proof. Do not invent current TinyRustLM
routes, ports, test results, browser support, or security evidence.

## Prompt 2: Clean-Slate Companion Process Architecture, Installation, Supervision, And Ownership

You are an independent principal Rust desktop/service architect, .NET host
integration engineer, Windows service specialist, and Linux operations
engineer. Produce an exceptionally detailed implementation report for the one
canonical TinyRustLM user-owned companion that supports local model
acquisition, deterministic conversion, verified P2P transfer, and browser
handoff. You may inspect official Rust, .NET, Windows, systemd, filesystem,
process-supervision, code-signing, installer, update, sandbox, and local IPC
documentation. You have no access to TinyRustLM source, executables, packages,
CI, credentials, or development machines. Never imply private inspection or
testing.

Project context and nonnegotiable decisions:

- TinyRustLM is prelaunch and has one current product architecture. There is
  no customer legacy, no V1-to-V2 migration, and no reason to preserve obsolete
  companion executables, aliases, forwarding CLIs, old services, duplicate
  owners, parallel data roots, compatibility flags, or known debt.
- Exact terms such as SLM2, ACG2, Tokenizer2, Template2, Sampling2, ABI
  versions, schema versions, and package versions are technical identities,
  not product generations.
- Rust owns model parsing, validation, inference, conversion, quantization,
  P2P bytes, hashing, and canonical receipts. A managed .NET layer may provide
  packaging, process launch, and consumer APIs only where that produces one
  clear owner and no duplicated runtime behavior.
- The browser is the chat UI. The companion is not a second chat application
  and must not silently become a cloud relay.
- The model-selection action must prefer an exact verified P2P composition and
  otherwise begin reviewed pinned-source acquisition plus local conversion. It
  must not emit instruction files or require the user to run downloaded
  scripts.
- Prompt text and model bytes must remain local or direct peer-to-peer. No
  project-hosted model-byte fallback or prompt telemetry is permitted.
- Current native targets are exactly `win-x64`, `linux-x64`, and
  `linux-arm64`. Cross-compilation does not prove ARM64 execution.
- The companion must run without administrator privileges for ordinary use,
  must not silently change firewall/router state, and must distinguish local
  service health from outside-network reachability.
- MemoryEndpoints is unauthorized and disconnected and must remain outside the
  current live path.

Use current primary sources. Record publication/update dates, direct URLs or
immutable revisions, and retrieval date. Label observations, sourced facts,
recommendations, assumptions, and local-verification requirements.

Research and specify all of the following:

1. Recommend one executable/process topology. Compare a single Rust executable,
   Rust worker plus thin .NET launcher, .NET executable hosting a Rust native
   library, and multiple helper processes. Select the smallest topology that
   preserves Rust authority, fault isolation, package usability, and clean
   ownership. State which executable names and responsibilities should exist
   and which categories must be deleted.
2. Define internal module boundaries for browser protocol, operation journal,
   catalog client, P2P client/server, source acquisition, conversion worker,
   content-addressed store, validation, resource governor, receipt writer, and
   diagnostics. Prevent cyclic dependencies and duplicate validation logic.
3. Specify process startup and singleton behavior. Cover per-user versus
   machine-wide scope, lock files versus named mutexes/flock, abandoned locks,
   PID reuse, stale sockets, port prebinding, atomic readiness, multiple browser
   profiles, and simultaneous interactive/managed launches.
4. Design process supervision. A readiness signal must occur only after all
   mandatory endpoints and owned stores validate. Cover child task failure,
   panic containment, worker exit, heartbeat failure, drain, cancellation,
   graceful shutdown, forced termination, restart backoff, and crash loops.
5. Define Windows operation using current supported mechanisms. Compare a
   foreground trayless process, Startup registration, scheduled task, Windows
   service, and packaged application. Address session isolation, user identity,
   service accounts, named objects, firewall prompts, code signing, SmartScreen,
   long paths, reparse points, locked DLLs, and atomic executable replacement.
6. Define Linux operation using a foreground process and systemd user service.
   Cover unit hardening, activation, environment, runtime and state directories,
   file descriptor limits, restart policy, journald privacy, linger tradeoffs,
   arm64 packages, and no-root installation.
7. Specify the canonical per-user data-root layout. Separate immutable
   artifacts, piece store, source cache, conversion staging, operation journals,
   receipts, quarantine, logs, and ephemeral runtime state. Define permissions,
   ownership markers, path normalization, symlink/reparse rejection, maximum
   sizes, retention, and cleanup.
8. Design atomic installation and update for a prelaunch product without a
   legacy compatibility layer. Bind release manifest, binary hashes, RID,
   signer, SBOM, provenance, source revision, and minimum protocol contract.
   Cover staged update, process drain, locked files, failed update, power loss,
   rollback of an incomplete installation versus preservation of obsolete
   product behavior, and explicit operator authorization.
9. Define safe converter execution. Compare in-process library calls with a
   separate `tinyrustlm-convert` worker. Address untrusted model input, memory
   limits, CPU limits, cancellation, progress, stdout/stderr bounds, inherited
   handles, environment scrubbing, working directory, timeout, crash, and final
   artifact validation by an independent runtime path.
10. Design resource governance across downloads, piece serving, hashing,
    conversion, validation, and browser transfer. Include formulas for disk
    preflight, temporary expansion, page cache, RAM, threads, open files,
    network concurrency, CPU scheduling, and minimum free-space reserve.
11. Specify lifecycle behavior for sleep, hibernate, network changes, user
    logoff, machine shutdown, removable storage, time jumps, disk full, store
    corruption, and abrupt power loss. State which journals are resumable and
    which operations require a new attempt.
12. Define P2P hosting consent and status. Sharing must be explicit, bounded,
    independently stoppable, and accurately labeled `disabled`, `configured`,
    `local_healthy`, `outside_proven`, `advertised`, `degraded`, or `stale`.
    Do not conflate two endpoints in one process with two independent lanes.
13. Design privacy-safe logs and support bundles. Include bounded structured
    events, redacted IDs, log rotation, secret and prompt exclusion, model-byte
    exclusion, private-path handling, crash-dump policy, synthetic sentinel
    tests, and user review before export.
14. Define packaging for the three target RIDs. Cover archive layout, native
    dependencies, symbols, install scripts, package managers versus portable
    archives, checksums, signatures, SBOM, malware-scanning boundaries, binary
    header inspection, and real execution evidence.
15. Provide Rust/.NET module diagrams, command-line grammar, configuration
    schema, data-root schema, service/unit examples, startup pseudocode,
    shutdown pseudocode, update transaction pseudocode, and typed terminal
    errors. Keep all examples exact and bounded.
16. Produce a deletion and one-owner audit procedure that finds obsolete
    binaries, service names, launchers, package IDs, environment variables,
    config files, routes, docs, tests, build targets, and generated artifacts.
    Explain how to prove absence without inventing local scan results.
17. Supply a fault-injection matrix for startup collision, bind failure, stale
    lock, child panic, converter crash, disk full, file lock, partial update,
    invalid signature, wrong RID, corrupt journal, sleep, power loss, and
    shutdown during each phase.
18. Identify facts requiring source inspection, package execution, OS testing,
    signing access, installer testing, or real network proof.

Required report structure:

1. Executive topology recommendation and assumptions.
2. One-owner process and module architecture.
3. Startup, readiness, singleton, and supervision state machines.
4. Windows installation and lifecycle specification.
5. Linux installation and systemd user-service specification.
6. Canonical data-root, permission, and path-safety contract.
7. Converter isolation and resource-governance design.
8. P2P hosting-consent and status model.
9. Atomic update, signing, SBOM, and package controls.
10. Privacy-safe diagnostics and support-bundle contract.
11. Concrete schemas, pseudocode, and service definitions.
12. Deletion/one-owner audit and fault-injection matrix.
13. Phased implementation backlog with acceptance criteria.
14. Unknowns requiring local or authorized evidence.
15. Annotated primary-source bibliography with dates and links.

Do not recommend retaining two companions, an old executable alias, an
automatic firewall rule, a hidden background service, an unbounded converter
subprocess, administrator-only normal operation, or a cloud relay. Do not
invent TinyRustLM process names, package results, signatures, OS evidence, or
public reachability.

## Prompt 3: Exact-Composition P2P Discovery, Peer Selection, Piece Transfer, And Recovery

You are an independent principal P2P protocol engineer, content-addressed
storage architect, HTTP security specialist, and adversarial network tester.
Produce an exceptionally detailed implementation report for acquiring one
complete TinyRustLM model composition directly from consenting peers. You may
inspect current HTTP specifications, URI normalization standards, cryptographic
hash standards, resumable-transfer protocols, content-addressed systems,
browser networking constraints, NAT documentation, and public P2P projects.
You have no private model files, source tree, catalog credentials, peer
endpoints, network topology, test receipts, or production access. Do not claim
that you observed a private peer or validated TinyRustLM code.

Public context and fixed constraints:

- TinyRustLM is one prelaunch product with no legacy protocol requirement and
  no permission for fallback endpoints, alias identities, mutable latest-model
  references, compatibility readers, or known debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema versions, and
  release versions are technical identities, not product generations.
- A usable model is an exact composition: model, tokenizer, template, sampling
  profile, runtime contract, limits, provenance/license decision, and required
  receipts. A model hash alone is insufficient.
- MiniModel.org is catalog and discovery authority only. Project sites must not
  proxy or host model bytes. Model bytes flow directly between consenting
  peers or are produced by local conversion.
- P2P is preferred only when at least one eligible peer advertises the exact
  immutable composition and transfer contract. Otherwise the product must
  move to the reviewed local source-acquisition/conversion path without making
  the user download instructions.
- Pieces have fixed canonical identities. Partial files, pieces from different
  compositions, stale metadata, or same-name artifacts cannot be mixed.
- A peer is not publicly reachable merely because loopback, LAN, fixture, or
  NAT-hairpin tests pass. Catalog state and signed outside proof must remain
  honest.
- The first release must not silently change router or firewall state.
- Rust is the sole P2P byte, hash, validation, assembly, and receipt authority.

Use primary sources wherever possible and record direct links, dates, immutable
revisions, and retrieval date. Separate standards from recommendations and all
facts requiring local or authorized verification.

Research and specify in depth:

1. Define the identity graph for catalog entry, composition, each component,
   piece set, piece, peer membership, normalized endpoint, lane/process,
   capability document, proof receipt, transfer attempt, assembly journal, and
   final admission receipt. State exactly which bytes each hash covers.
2. Specify canonical serialization and domain-separated hashing. Address JSON
   canonicalization alternatives, duplicate keys, Unicode normalization,
   number encoding, field order, unknown fields, length binding, hash
   algorithm agility, and circular identity avoidance.
3. Define a bounded catalog discovery response that contains metadata and
   endpoints but no model bytes. Include expiry, publisher identity, source
   revision, license status, composition identity, piece-set identity, peer
   proof status, capability version, byte sizes, and stale/revoked states.
4. Design peer eligibility before ranking. Reject identity mismatch, expired or
   revoked proof, wrong composition, wrong piece set, unsupported protocol,
   insecure normalization, private-address substitution when public proof is
   claimed, missing sizes, ambiguous ranges, and inconsistent headers.
5. Define deterministic peer ranking without inventing popularity or trusting
   self-reported speed. Cover exact-match priority, proof freshness, endpoint
   family, prior attempt evidence, privacy, load hints, randomization against
   centralization, and when two peers may be used concurrently.
6. Specify strict HTTP methods, routes, path grammar, fixed piece names,
   metadata response, ranges, `Content-Length`, `Content-Range`, validators,
   MIME types, CORS, cache policy, timeouts, redirects, compression policy,
   connection reuse, and status codes. Include an explicit allow/deny table.
7. Analyze URI canonicalization, percent encoding, dot segments, mixed case,
   IPv6 literals, default ports, userinfo, fragments, Unicode hostnames,
   alternate separators, symlinks/reparse points, and path traversal. Define
   one normalized endpoint identity.
8. Design a fixed-piece layout and sizing policy. Compare equal-size pieces,
   Merkle trees, flat hash manifests, and content-defined chunking for large
   immutable model artifacts. Account for browser/companion memory, HTTP
   overhead, resume granularity, corruption repair, storage, and denial of
   service.
9. Specify streamed download, per-piece hashing, durable journal update,
   synchronization, and atomic piece promotion. Never hash a multi-gigabyte
   artifact by loading it all into memory. Cover short reads, extra bytes,
   wrong lengths, slow peers, disconnection, disk full, and cancellation.
10. Define safe multi-peer assembly. Require complete composition and piece-set
    agreement before mixing. Address peers returning different bytes for the
    same hash, equivocation evidence, piece retries, peer quarantine, duplicate
    work, final byte-order assembly, and independent whole-artifact validation.
11. Specify resume after process crash, browser crash, machine restart, catalog
    refresh, proof expiry, endpoint change, and peer disappearance. Explain
    when verified pieces remain reusable and when the attempt must fail or
    restart.
12. Design source-path fallback as a typed state transition, not a hidden
    protocol fallback. Define the exact evidence that no eligible peer exists,
    the discovery time budget, user-visible status, preservation of failed
    peer attempts, and handoff to pinned-source acquisition.
13. Define serving-side controls: pre-opened read-only piece store, method and
    route allowlist, bounded headers, per-peer/global concurrency, rate limits,
    bandwidth fairness, timeout, range amplification controls, symlink defense,
    no directory listing, no uploads, and privacy-safe logs.
14. Analyze NAT options including manual IPv4 forwarding, IPv6, CGNAT, double
    NAT, PCP, NAT-PMP, UPnP, and explicit tunnels. Recommend an honest first
    release workflow that changes nothing without operator consent.
15. Specify signed, expiring outside-observer proof and catalog lifecycle only
    to the extent needed to avoid false P2P claims. Cover canonical receipt
    bytes, nonce, observer key, clock skew, expiry, revocation, endpoint drift,
    lane binding, and status transitions.
16. Provide concrete schemas for catalog metadata, peer capability, piece set,
    journal, fault evidence, final assembly, and source-fallback decision;
    Rust type sketches; and downloader/server pseudocode.
17. Produce a protocol conformance and hostile-peer test corpus covering
    malformed metadata, huge lengths, duplicate keys, redirects, traversal,
    range lies, truncation at every boundary, corruption, equivocation,
    timeout, cancellation, proof expiry, and mixed-peer recovery.
18. Give capacity formulas for one real model and a later 20-model fleet:
    storage, staging, file descriptors, connections, hashing CPU, bandwidth,
    journal growth, and verification cadence. Do not invent measurements.
19. Identify every conclusion requiring catalog contract access, real peer
    endpoints, outside observers, NAT configuration, physical transfer, or
    local implementation testing.

Required report structure:

1. Executive protocol recommendation and assumptions.
2. Identity graph and canonical serialization rules.
3. Catalog/discovery and peer-eligibility schemas.
4. Endpoint normalization and strict HTTP profile.
5. Piece sizing, transfer, hashing, and assembly algorithm.
6. Multi-peer, resume, cancellation, and source-fallback state machine.
7. Serving security and resource-governance controls.
8. NAT, outside-proof, and honest status vocabulary.
9. Concrete schemas, Rust pseudocode, and receipt examples.
10. Hostile-peer and fault-injection test matrix.
11. Capacity formulas and staged acceptance plan.
12. Unknowns requiring local or authorized proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend a project-hosted byte fallback, mutable aliases, best-effort
hashing, arbitrary paths, mixing pieces by filename, automatic router changes,
or treating local health as public proof. Do not invent peer counts, catalog
availability, endpoint signatures, throughput, or successful transfers.

## Prompt 4: Immutable Public Model Source Acquisition, Custody, License Closure, And Resume

You are an independent principal ML artifact-custody engineer, model-repository
protocol researcher, software-license evidence specialist, and hostile-download
security auditor. Produce an exceptionally detailed implementation report for
acquiring one immutable public Qwen-family source checkpoint for deterministic
local conversion into TinyRustLM artifacts when no eligible direct peer is
available. You may inspect official Hugging Face Hub, Git, Git LFS, Xet,
Safetensors, HTTP, model-card, license, SPDX, cryptographic-hash, and public
model-repository documentation and immutable repository revisions. You have no
TinyRustLM source access, local models, repository tokens, private caches,
conversion logs, legal approval, or build output. Never claim that you
downloaded or validated a private candidate.

Project context and fixed decisions:

- TinyRustLM is a single prelaunch product. No legacy acquisition path,
  mutable alias, old manifest reader, shell-script handoff, text request file,
  compatibility fallback, or known debt may be retained.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, schema versions, model
  revisions, and package versions are exact technical identities, not product
  versions.
- The first target family is a publicly documented compact dense Qwen-family
  causal language model plausibly usable in a browser after deterministic
  conversion. The report must research current candidates and immutable public
  revisions rather than assume an unpinned mutable repository state.
- The no-peer operation must acquire only the reviewed files required for
  conversion. It must never execute remote repository code, a model-provided
  Python script, arbitrary Jinja, pickled objects, install hooks, or an
  unreviewed binary.
- The acquisition must bind exact source bytes, sizes, repository revision,
  model configuration, Safetensors index and shards, tokenizer inputs, chat
  template source, generation configuration, model card, license evidence, and
  conversion eligibility.
- Model bytes remain local. Project websites must not proxy the checkpoint.
- Large files must be streamed and hashed. Resume must not trust filename,
  partial length, a weak validator, or a mutable branch name.
- Structural acquisition and license review do not prove conversational
  quality, conversion correctness, or redistribution authorization.

Use primary sources and immutable repository references wherever possible.
Record source title, owner, repository and revision, file path, observed size
and hash when publicly available, update date, direct URL, and retrieval date.
Clearly separate a license text observation from a legal recommendation and
from a local authorization decision.

Research and specify all of the following in depth:

1. Survey current public dense Qwen-family checkpoints in the approximate
   0.3B to 1.5B range that have official model cards, Safetensors weights,
   documented tokenizer/template behavior, and plausible local conversion.
   Produce a candidate table without promoting any model from popularity or
   parameter count alone.
2. Define immutable revision selection. Compare Git commit SHA, repository
   refs, Hub revisions, tags, branches, PR refs, LFS object IDs, Xet-backed
   objects, ETags, and published checksums. State which identity is authority
   for each file and how to detect repository drift.
3. Explain Hugging Face storage and download behavior relevant to a custom Rust
   client, including Hub APIs, resolve URLs, redirects, signed URLs, LFS/Xet
   indirection, range requests, cache semantics, authorization headers, rate
   limits, and offline reuse. Distinguish stable documented behavior from
   current implementation details.
4. Define an exact source file allowlist. Address `config.json`, Safetensors
   index, all referenced shards, tokenizer JSON or vocabulary/merge files,
   tokenizer config, special-token map, generation config, chat-template
   source, model card, license files, and any architecture-specific metadata.
   State what must be rejected as surplus or executable.
5. Design hostile parsing for the Safetensors index and all JSON metadata.
   Cover duplicate keys, deep nesting, huge strings, numbers outside range,
   invalid UTF-8, unknown architectures, remote-code flags, path traversal,
   absolute paths, alternate separators, duplicate shards, unreferenced shards,
   unsupported data types, and ambiguous tensor ownership.
6. Specify preflight before downloading multi-gigabyte weights. Include source
   identity, expected file inventory, trusted size source, disk requirement,
   staging expansion, hash strategy, network policy, free-space reserve,
   cancellation, and user-visible uncertainty when a size is not authoritative.
7. Design a streamed downloader with bounded buffers, exact length checks,
   incremental SHA-256, timeout policy, retry budget, redirect restrictions,
   TLS validation, certificate behavior, proxy considerations, compression
   policy, and protection against decompression or allocation attacks.
8. Define a durable per-file journal and resume algorithm. Bind immutable
   source revision, exact URL authority, expected size, validator, verified
   byte ranges, hash state or rehash strategy, attempt identity, timestamps,
   and error state. Explain safe behavior when a signed URL expires or a server
   changes range support.
9. Specify same-directory staging, file synchronization, atomic promotion,
   Windows rename/lock behavior, Linux durability, disk-full behavior, process
   crash, power loss, stale temporaries, and quarantine. A final source file
   must never be visible as complete until its whole identity verifies.
10. Define source-custody receipts linking repository revision, every file
    hash/length, downloader identity, TLS origin, redirect chain summary,
    acquisition attempt, local custody state, and parent review without
    exposing private paths, credentials, or signed URLs.
11. Build a license and provenance decision framework. Cover model license,
    code license, tokenizer assets, dataset/provenance disclosures, attribution,
    notice requirements, model-output terms, modification and redistribution,
    derivative metadata, sanctions/export considerations, ambiguity, and an
    explicit human/legal authorization boundary.
12. Explain how to archive public evidence without pretending it freezes an
    external website. Include exact license bytes/hash, model-card bytes/hash,
    retrieval timestamp, immutable URL, screenshot limitations, and later
    upstream changes.
13. Design a source-admission gate separate from conversion and quality gates.
    Specify terminal states such as `acquired_unreviewed`, `identity_verified`,
    `license_blocked`, `architecture_blocked`, `eligible_for_conversion`,
    `superseded`, and `quarantined` rather than one boolean pass.
14. Provide Rust data structures and pseudocode for manifest discovery,
    preflight, streamed acquisition, resume validation, final hashing, atomic
    promotion, receipt writing, and failure recovery. Avoid library names
    unless their current security and maintenance status is sourced.
15. Produce an adversarial/fault corpus covering mutable revision drift,
    redirect to an unexpected host, expired URL, weak ETag, no-range server,
    truncation at each boundary, extra bytes, wrong shard, index mismatch,
    disk full, locked destination, crash, cancellation, malicious JSON, and
    license ambiguity.
16. State all facts requiring local network access, actual download, local
    source inspection, legal review, converter support, or source-model quality
    screening.

Required report structure:

1. Executive acquisition recommendation and assumptions.
2. Current public candidate and immutable-revision matrix.
3. Exact source file allowlist and reject list.
4. Repository transport and identity analysis.
5. Preflight, streamed-download, and resume algorithm.
6. Atomic custody, quarantine, and receipt schemas.
7. Safetensors-index and metadata threat model.
8. License/provenance evidence and authorization matrix.
9. Rust types and end-to-end pseudocode.
10. Adversarial and fault-injection test matrix.
11. Phased implementation plan with acceptance criteria.
12. Unknowns requiring local or authorized evidence.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend mutable `main` as final identity, remote-code execution,
pickle ingestion, arbitrary repository files, trusting a filename or ETag as a
cryptographic identity, hiding license ambiguity, or calling acquisition a
quality pass. Do not invent model hashes, legal conclusions, download results,
or converter compatibility.

## Prompt 5: Deterministic Streaming Safetensors-To-SLM2 Conversion And Crash-Safe Artifact Transaction

You are an independent principal ML compiler engineer, binary-format designer,
quantization implementation specialist, and crash-consistent storage engineer.
Produce an exceptionally detailed report specifying a deterministic,
bounded-memory conversion transaction from one pinned Qwen-family Safetensors
checkpoint to the exact TinyRustLM production composition. You may inspect
official Safetensors, Qwen, Transformers, PyTorch, NumPy, IEEE 754, Rust,
filesystem, quantization, and reproducible-build sources. You have no access to
TinyRustLM code, the private SLM2 specification, local model files, converter
output, test vectors, or receipts. Do not invent private format fields or claim
local conversion success. Where an exact private field is unavailable, define
the property and validation rule that the local format must supply.

Project context and nonnegotiable constraints:

- TinyRustLM is one prelaunch product with no legacy SLM reader, old converter,
  compatibility tensor alias, repair pass, dual format, hidden fallback, or
  known technical debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, converter versions,
  and schema IDs are technical identities, not product generations.
- Rust is the sole production converter and artifact-validation authority.
- The initial architecture is a compact dense Qwen-family decoder with grouped
  query attention, rotary position embeddings, RMS normalization, a SiLU-gated
  MLP, optional Q/K normalization and QKV bias only when declared by the pinned
  source configuration, and tied or untied embeddings exactly as sourced.
- The production composition contains model weights plus independently
  identified Tokenizer2, Template2, Sampling2, runtime contract, limits,
  provenance/license decision, and receipts. No member may be inferred from a
  filename at activation time.
- The weight goal is a declared mixed-Q8 profile. Quantization parameters,
  exceptions, scales, grouping, rounding, tensor order, and accumulation
  semantics must be exact and versioned.
- Source and output may be multiple gigabytes. Conversion must stream, bound
  memory, preflight disk, support cancellation and restart, and never expose a
  partial final artifact.
- Structural conversion is not numerical parity or conversational quality.

Use primary sources wherever possible, record direct links or immutable
revisions, dates, and retrieval date, and distinguish public facts from
recommended local format requirements.

Research and specify all of the following in depth:

1. Reconstruct the source architecture contract from public Qwen-family
   configuration and implementation sources. List every dimension and option
   that affects tensor shape, layer execution, RoPE, grouped-query mapping,
   normalization, MLP, output projection, embedding tying, vocabulary, and
   context behavior.
2. Define a strict tensor registry and mapping table methodology. Cover source
   name, semantic role, expected rank/shape/data type, layer index, destination
   role, transform, quantization profile, ordering, and whether exact source
   omission is legal. Reject aliases chosen by guesswork.
3. Specify complete source inventory validation before writing output: shard
   index closure, no duplicate tensor names, no overlaps, no gaps, exact byte
   extents, checked products, alignment, supported data types, finite values,
   and no missing or surplus semantic tensors.
4. Design a multi-pass streaming conversion algorithm. Compare tensor-at-a-time,
   row-block, channel-block, memory-mapped, and shard-sequential strategies.
   Account for transposition, quantization statistics, output canonical order,
   source shard ordering, page cache, and bounded scratch.
5. Define mixed-Q8 quantization mathematically. Specify signed range, symmetric
   versus asymmetric mapping, scale derivation, zero handling, clipping,
   grouping axis, group size, per-row/per-channel exceptions, rounding mode,
   tie behavior, NaN/infinity rejection, dequantization equation, and exact
   treatment of biases, norms, embeddings, output head, and small tensors.
6. Explain how calibration-free weight-only conversion differs from
   calibration-based PTQ and quantization-aware training. State which claims
   can be supported by weight statistics alone and which require data,
   activations, or retraining.
7. Specify reproducible floating-point behavior across hosts. Address source
   BF16/F16/F32 decoding, accumulation precision for scale calculation,
   reduction order, SIMD effects, fused operations, host rounding mode,
   endianness, subnormals, signed zero, NaNs, infinities, and deterministic
   thread scheduling.
8. Define the destination artifact's canonical layout properties: header and
   profile identity, section inventory, tensor registry, order, alignment,
   offsets, lengths, quantization metadata, checksums, model configuration,
   declared limits, and noncircular identity binding. Do not invent private
   magic bytes.
9. Design deterministic Tokenizer2 and Template2 extraction as separate
   bounded transformations. Reject executable Jinja/remote code at runtime,
   preserve publisher-exact token IDs and template semantics, and bind their
   source files and independent identities.
10. Define ACG2 composition construction. Require exact model/tokenizer/
    template/sampling/runtime identities and lengths, source revision,
    converter identity, license decision, context/KV limits, and no missing,
    duplicate, surplus, or contradictory members.
11. Design preflight formulas for source bytes, destination bytes, staging,
    per-tensor scratch, quantization metadata, receipt/log growth, free-space
    reserve, memory cap, file descriptors, and expected operation units. Use
    variables rather than invented measurements.
12. Specify same-directory staged writes, streaming hashes, flush, file
    synchronization, directory synchronization where available, atomic rename,
    Windows replacement semantics, Linux durability, disk full, locked files,
    stale staging, and power-loss recovery.
13. Define a resumable append-only conversion journal. Bind source identities,
    converter build, profile, completed tensor units, output offsets, rolling
    validation, attempt state, cancellation, failure, and restart. Explain when
    a partial output can be trusted and when it must be quarantined.
14. Require a final independent Rust validator to reopen every output from
    bytes and prove structure, registry, bounds, checksums, profile, composition
    closure, and no surplus data. The writer's in-memory state cannot be the
    validation authority.
15. Define byte-reproducibility experiments: two clean conversions, varied
    source shard presentation order, different thread counts, supported OS/RID
    hosts, and deliberate interruptions. Distinguish required byte identity
    from documented host-specific nondeterminism if any.
16. Provide Rust type sketches and pseudocode for source registry construction,
    checked shape arithmetic, streamed tensor reads, quantization, canonical
    writes, journal checkpoints, cancellation, final validation, and receipt
    identity.
17. Produce a hostile and fault matrix for truncation at every boundary,
    duplicate tensors, wrong shape, unsupported dtype, offset overflow,
    nonfinite weights, source drift, wrong tokenizer, unknown template,
    cancellation, disk full, file lock, crash, corrupt journal, and output
    mutation.
18. Define the exact evidence boundary between acquisition, conversion,
    structural validation, numerical parity, performance, and model quality.
19. List every unknown requiring the private SLM2/ACG2 contract, actual source
    bytes, local converter inspection, clean conversion runs, or runtime replay.

Required report structure:

1. Executive conversion recommendation and assumptions.
2. Public source architecture and tensor-registry method.
3. Strict inventory and source-validation rules.
4. Mixed-Q8 mathematical profile and exception policy.
5. Bounded streaming conversion algorithm.
6. Tokenizer2, Template2, and ACG2 construction boundaries.
7. Crash-safe transaction and resume journal.
8. Independent final validation and reproducibility protocol.
9. Rust data structures and detailed pseudocode.
10. Hostile-input and fault-injection matrix.
11. Evidence/claim taxonomy and acceptance criteria.
12. Unknowns requiring local proof.
13. Annotated primary-source bibliography with dates and links.

Do not recommend tensor-name guessing, source repair, a legacy format reader,
unbounded whole-model loading, nondeterministic reduction without identity,
writer-self-validation, post-processing failed output, or treating structural
validity as quality. Do not invent SLM2 bytes, conversion measurements, parity
results, or source compatibility.

## Prompt 6: Publisher-Exact Qwen Tokenizer, Chat Template, Thinking Mode, And Sampling Semantics

You are an independent principal tokenizer engineer, language-model serving
conformance researcher, and deterministic sampling specialist. Produce an
exceptionally detailed report defining how a compact Qwen-family checkpoint's
publisher-exact text-to-token-to-text and chat behavior should be frozen into
bounded declarative TinyRustLM artifacts. You may inspect official Qwen model
cards, tokenizer files, chat templates, generation configuration, Qwen and
Transformers source revisions, tokenizers documentation, Jinja template
semantics, Unicode standards, regex specifications, and sampling literature.
You have no TinyRustLM source, private Tokenizer2/Template2 bytes, local model,
prompt fixtures, outputs, or test logs. Never claim local parity.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product. It must adopt one exact current
  tokenizer/template/sampling contract and delete obsolete behavior. There is
  no legacy tokenizer, old chat template, compatibility prompt wrapper, hidden
  fallback, or product V2.
- Tokenizer2, Template2, Sampling2, Prompt2, SLM2, ACG2, schema versions, and
  model revisions are exact technical identities, not product generations.
- The runtime may not execute arbitrary Jinja, JavaScript, Python, or remote
  repository code. Tokenization and template rendering must be bounded,
  declarative, deterministic, and independently replayable.
- Publisher behavior must be pinned to immutable source files and revisions.
  A library's moving default is not the product contract.
- Thinking-mode behavior, system/user/assistant/tool roles, generation prompt,
  special tokens, stop conditions, and empty-content handling must be explicit.
- Sampling may support only semantics that have a frozen profile and test
  vectors. Best-of-N retry selection is forbidden unless declared as actual
  product behavior, and it is not the current desired behavior.
- Native Rust and browser WASM must produce identical tokens for deterministic
  profiles when supplied identical artifacts, prompt messages, options, and
  seeds.

Use primary sources and immutable public revisions. Record direct links,
revision IDs, publication/update dates, and retrieval date. Separate observed
publisher facts, library behavior, recommendations, and local-verification
requirements.

Research and specify all of the following in depth:

1. Select and document the exact public source files that define vocabulary,
   merges/model, normalization, pretokenization, postprocessing, decoder,
   added tokens, special tokens, chat template, generation defaults, and stop
   behavior for a compact Qwen-family candidate. Explain conflicts between
   files and which source is authoritative.
2. Reconstruct the tokenizer pipeline step by step. Cover normalization,
   pretokenizer regex, ByteLevel byte-to-Unicode mapping, BPE merge ranking,
   unknown/byte fallback, added-token matching, special-token handling,
   postprocessing, truncation, and decoding.
3. Analyze exact regex semantics across Rust, JavaScript, Python, Oniguruma,
   PCRE, and the tokenizer implementation used by the publisher. Identify
   Unicode property, lookaround, whitespace, newline, contraction, and
   punctuation cases where apparently similar regex engines diverge.
4. Specify Tokenizer2 as a bounded byte artifact. Include canonical token IDs
   and byte strings, merge pairs/ranks, added-token attributes, special-token
   IDs, normalization/pretokenizer operation codes, flags, lengths, limits,
   ordering, duplicate rejection, unknown required operations, and
   noncircular identity.
5. Define exact encode behavior for empty input, ASCII, multilingual scripts,
   emoji and grapheme clusters, combining marks, normalization-sensitive text,
   whitespace runs, tabs/newlines, control bytes, NUL, malformed UTF-8 at the
   byte API boundary, special-token-looking user text, and adversarially long
   input.
6. Define exact decode behavior, including byte reconstruction, invalid token
   IDs, incomplete byte sequences, replacement policy, cleanup options,
   special-token retention/skipping, streaming partial tokens, and round-trip
   properties that are and are not guaranteed.
7. Reconstruct the publisher chat template semantically. Specify legal roles,
   role ordering, exact prefix/suffix tokens, separators, system handling,
   assistant generation prompt, tool support only if actually present,
   thinking-mode markers, empty messages, whitespace, and stop-token
   interaction.
8. Design Template2 as a non-Turing-complete instruction artifact with a small
   operation set. Define maximum messages, content bytes, rendered bytes,
   tokens, nesting, and operations. Reject loops, arbitrary field access,
   includes, filters outside the profile, code execution, and unknown roles.
9. Resolve thinking mode explicitly. Research current Qwen publisher guidance
   for enabling/disabling thinking, relevant template variables/tokens,
   expected output markers, and serving implications. Recommend one declared
   first-product behavior and how a later intentional change creates a new
   exact profile without preserving an undocumented fallback.
10. Define Sampling2 semantics for greedy, temperature, top-k, top-p, and
    repetition penalty only if each is retained. Specify order of operations,
    vocabulary filtering, logits sanitization, tie behavior, boundary values,
    probability normalization, stop tokens, max tokens, and context exhaustion.
11. Select a seeded PRNG suitable for language-neutral reproducible vectors.
    Specify algorithm, integer arithmetic, seed expansion, state serialization,
    float conversion, draw count, sampling search order, and rejection of host
    random defaults.
12. Address floating-point determinism between native and WASM. Define where
    exact bit identity is required, where token identity is sufficient, how
    softmax reductions are ordered, and how NaN, infinities, underflow, and
    equal probabilities fail or resolve.
13. Design independent language-neutral conformance vectors without using the
    Rust implementation under test. Include source bytes, messages, options,
    expected rendered bytes, token IDs, decoded bytes, selected tokens, PRNG
    state, and failure category while excluding private evaluation prompts.
14. Produce metamorphic and hostile cases: Unicode variants, whitespace
    permutations, special-token injection, role reorder, empty system prompt,
    conflicting generation config, truncation at every artifact boundary,
    duplicate token/merge, invalid rank, unknown operation, huge declared
    length, and malformed template.
15. Define differential testing against a pinned publisher implementation.
    Bind exact library versions, immutable source, configuration, files,
    options, environment, input hashes, raw outputs, and discrepancy evidence.
16. Provide Rust and language-neutral pseudocode for parse, encode, decode,
    template render, PRNG, logit filtering, token selection, stop handling, and
    streaming decode.
17. State all conclusions that require private artifact definitions, local
    source checkpoint selection, actual differential execution, native/WASM
    replay, or product decisions.

Required report structure:

1. Executive conformance recommendation and assumptions.
2. Immutable publisher-source authority table.
3. Exact tokenizer pipeline and Tokenizer2 profile.
4. Unicode, regex, ByteLevel, BPE, and decode edge cases.
5. Publisher template semantics and bounded Template2 design.
6. Explicit thinking-mode decision matrix.
7. Sampling2 and seeded PRNG mathematical specification.
8. Native/WASM determinism requirements.
9. Independent vectors and differential-test protocol.
10. Hostile and metamorphic test corpus.
11. Rust and oracle pseudocode.
12. Implementation phases and acceptance criteria.
13. Unknowns requiring local proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend executing arbitrary Jinja, inheriting a moving library
default, silently changing thinking mode, using host randomness, repairing
malformed prompt output, preserving an obsolete template, or equating similar
decoded text with token parity. Do not invent publisher behavior, private
artifacts, local vectors, or parity results.

## Prompt 7: Mixed-Q8 CPU And WASM Kernels, TurboQuant/TurboVec Lessons, And KV-Cache Discipline

You are an independent principal quantized-inference researcher, Rust SIMD
engineer, WebAssembly performance specialist, and numerical-correctness
auditor. Produce an exceptionally detailed implementation report for executing
a compact dense Qwen-family SLM2 model with a declared mixed-Q8 profile on
native CPU and browser WebAssembly. Research public TurboQuant, TurboVec, KV
cache quantization/compression, integer GEMV/GEMM, SIMD, and small-model
inference work for applicable ideas, but do not assume those names describe
TinyRustLM code or grant license compatibility. You may inspect papers,
official repositories at immutable revisions, issue trackers, compiler and ISA
documentation, Rust `std::arch`, WebAssembly SIMD specifications, browser
documentation, and reproducible benchmark methodology. You have no TinyRustLM
source, local kernels, private TurboQuant/TurboVec code, model bytes,
benchmarks, or hardware traces. Never claim private implementation or speed.

Project context and fixed decisions:

- TinyRustLM is one prelaunch product with one clean runtime. There is no
  legacy scalar fallback exposed as a product mode, old quantization reader,
  compatibility kernel, architecture guess, hidden repair, or accepted known
  debt. A simple scalar reference may remain only as a test oracle if it is
  clearly not a parallel released runtime.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, mixed-Q8 profile identities,
  kernel implementation IDs, and schema versions are technical identities,
  not product generations.
- Rust is the sole inference authority for native and WASM. JavaScript must
  not implement a second model runtime.
- The first architecture is a compact dense Qwen-family causal decoder with
  grouped-query attention, RoPE, RMSNorm, SiLU-gated MLP, optional Q/K norm and
  QKV bias exactly when declared, and tied/untied embeddings as sourced.
- Quantized output must meet preregistered numerical and behavioral regression
  budgets against an immutable source framework. Faster incorrect output is a
  failure.
- Browser memory includes model weights, tokenizer/template, runtime linear
  memory, scratch, activations, and KV cache. No proposal may hide copies or
  assume unlimited WebAssembly memory.
- Current CPU targets are `win-x64`, `linux-x64`, and `linux-arm64`; browser
  WASM must feature-detect rather than claim universal SIMD/threads support.
- Measurements must be made locally later. The report must give formulas and
  benchmark methods, not fabricated throughput.

Use primary sources wherever possible. Record publication/update dates,
repository commit IDs, licenses, direct links, and retrieval date. Distinguish
paper claims, repository observations, engineering inferences, and local proof.

Research and specify all of the following in depth:

1. Explain the public algorithms and implementation ideas associated with
   TurboQuant and TurboVec at pinned public revisions: data representation,
   preprocessing, lookup/vector strategy, bit widths, block/group structure,
   kernels, supported hardware, training/calibration assumptions, reported
   quality, reported performance, licenses, and reproducibility limitations.
2. Identify which ideas can transfer to a deterministic mixed-Q8 Qwen runtime,
   which require format changes or offline transforms, which depend on wider
   vectors/instructions unavailable in WASM, and which should be rejected for
   correctness, license, complexity, or evidence reasons.
3. Define the mixed-Q8 weight representation consumed by kernels. Include
   signed integer range, scale type, grouping axis and size, canonical packed
   order, alignment, tail policy, exceptions for norms/biases/embeddings/head,
   endianness, block checks, and exact dequantization equation.
4. Compare execution strategies: integer dot with post-scale, on-the-fly
   dequantization to F32, tiled dequantization, lookup tables, packed multiply,
   and weight-only GEMV optimized for batch-one decoding. Select distinct
   reference and optimized strategies while preserving one semantic contract.
5. Design scalar reference kernels for embedding lookup, RMSNorm, Q/K/V and O
   projections, RoPE, grouped-query attention, causal masking, gated MLP,
   residuals, final norm, and vocabulary projection. Define accumulator types,
   operation order, and checked indexing.
6. Design native x86-64 acceleration. Cover SSE2 baseline, AVX2, AVX-VNNI,
   AVX-512 variants only when justified, FMA determinism, runtime feature
   detection, dispatch ownership, alignment, tails, frequency throttling,
   portable package binaries, and tests preventing illegal instructions.
7. Design native ARM64 acceleration. Cover NEON, dot-product and i8mm
   extensions, runtime feature detection, Linux HWCAP, alignment/tails,
   cross-compilation versus real execution, and numerical comparison to the
   reference.
8. Design WebAssembly SIMD128 acceleration using only standardized operations
   with current browser support. Address i8 lane operations, widening,
   reductions, shuffle costs, alignment, bounds checks, scalar tails, code
   size, feature validation, and a fail-closed startup policy when the exact
   required build profile is unsupported.
9. Analyze threads and shared memory separately from SIMD. Cover
   `SharedArrayBuffer`, cross-origin isolation, WebAssembly atomics, worker
   pools, browser process limits, deterministic scheduling, reduction order,
   startup overhead, and when single-threaded batch-one decoding is preferable.
10. Specify scratch-buffer planning and reuse across prefill and decode.
    Include exact formulas for hidden vectors, Q/K/V, attention scores,
    dequantization tiles, logits, per-thread workspace, alignment, and upper
    bounds. Reject allocation in the inner token loop where possible.
11. Design KV cache layout for grouped-query attention. Provide formulas in
    bytes from layer count, key/value head count, head dimension, context
    length, element type, batch, and optional padding. Compare layer-major,
    token-major, head-major, paged, ring, and contiguous layouts for this
    small-model browser use case.
12. Compare F32, F16, BF16, INT8, lower-bit, delta, and product-quantized KV
    caches. For each, analyze browser support, conversion cost, accumulated
    error, attention quality, scale metadata, random access, invalidation, and
    evidence required before adoption. Recommend a conservative first profile.
13. Define transactional KV semantics for prefill, one-token append, aborted
    generation, stop token, cancellation, context exhaustion, user-message
    append, edited history, system/template/model change, sampling-only change,
    and model switch. State exactly when cache reuse is valid and how invalid
    suffixes are rolled back.
14. Address context management without silently dropping authority or recent
    user preferences. Compare hard rejection, bounded truncation at message
    boundaries, explicit summarization, sliding windows, and cache eviction.
    Keep model behavior separate from product policy.
15. Define numerical conformance budgets per operator and end-to-end token
    sequence before benchmarking. Explain absolute/relative/ULP measures,
    cosine error, top-logit margin, selected-token stability, accumulation over
    turns, quantization outliers, and when a mismatch is a kernel bug.
16. Design a benchmark laboratory. Separate load, prefill, decode, cache reuse,
    first-token latency, tokens/second, peak resident memory, WASM linear
    memory, allocations, warmup, thermal effects, browser background
    throttling, compiler flags, and hardware identity. Use formulas and
    preregistered comparisons.
17. Provide Rust trait/type sketches and pseudocode for semantic kernel
    contracts, checked shape planning, feature detection, dispatch, reference
    replay, scratch ownership, KV transaction, cancellation points, and
    performance receipts.
18. Produce differential, metamorphic, and hostile tests for zero/small/large
    values, quantization extremes, odd dimensions, tail blocks, NaN/inf source,
    overflow, RoPE boundaries, GQA mapping, mask edges, cache rollback,
    unsupported CPU feature, WASM trap, cancellation, and long-context drift.
19. Identify all facts requiring actual SLM2 profile access, source weights,
    native hardware, physical browsers, compiler versions, benchmark runs, or
    behavioral evaluation.

Required report structure:

1. Executive kernel/KV recommendation and assumptions.
2. TurboQuant/TurboVec public mechanism and license analysis.
3. Transferability decision table for TinyRustLM.
4. Exact mixed-Q8 representation and scalar semantic authority.
5. x86-64, ARM64, and WASM SIMD kernel designs.
6. Scratch memory and allocation plan.
7. KV layout, precision, transaction, and invalidation design.
8. Numerical tolerances and behavioral regression boundaries.
9. Benchmark laboratory and measurement receipt.
10. Rust interfaces and detailed pseudocode.
11. Differential, hostile, and fault-injection matrix.
12. Implementation phases with promotion/rollback criteria.
13. Unknowns requiring local execution.
14. Annotated primary-source bibliography with dates and links.

Do not recommend copying a third-party kernel without license and semantic
review, choosing speed before parity, silently dispatching unsupported
instructions, using benchmark-specific answers, hiding model copies, or
retaining an incorrect fallback. Do not invent TinyRustLM performance, model
quality, memory use, or hardware evidence.

## Prompt 8: Production Browser WASM Build, Bootstrap, Memory Admission, And Runtime Isolation

You are an independent principal WebAssembly runtime architect, browser
performance engineer, Rust build specialist, and web-deployment security
auditor. Produce an exceptionally detailed implementation report for loading
and running one real compact Qwen-family SLM2 composition in TinyRustLM.com
through production Rust WebAssembly. You may inspect official WebAssembly,
Rust, wasm-bindgen or direct-WASM ABI, browser, CSP, COOP/COEP, service-worker,
Web Worker, SharedArrayBuffer, SIMD, memory64, streaming compilation, and HTTP
deployment documentation. You have no TinyRustLM source, deployed asset,
private headers, model, browser trace, or benchmark. Do not claim private
execution.

Project context and fixed constraints:

- TinyRustLM is one prelaunch product. The implementation must converge on one
  production browser runtime with no fixture backend, simulated generation,
  obsolete loader, compatibility glue, JavaScript inference engine, hidden
  server fallback, or known debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, WASM ABI/profile IDs, schema
  versions, and release versions are technical identities, not product
  generations.
- Rust is the model parser, validator, tokenizer, template, sampler, and
  inference authority in both native and browser builds. JavaScript/TypeScript
  owns browser orchestration and UI only.
- A model is activated only after the exact composition, lengths, hashes,
  runtime contract, limits, and provenance validate. Hash equality alone does
  not prove semantic compatibility.
- Model ingestion, hashing, parsing, activation, and generation must run off
  the UI thread. Every assistant output is raw runtime output and must render
  once.
- Model bytes and prompts remain browser-local or direct P2P. Project-hosted
  model bytes, prompt upload, and hidden telemetry are forbidden.
- Resource admission must count WASM linear memory, model representation,
  scratch, tokenizer/template, activations, logits, KV cache, transfer buffers,
  browser storage, and unavoidable copies. Failure must be truthful before a
  catastrophic allocation where possible.
- Browser support claims require current physical-browser proof. Feature
  detection and deployment headers must match the exact shipped build.

Use current primary sources, record dates, direct URLs, implementation/version
details, and retrieval date. Distinguish standards, current browser behavior,
recommendations, and local verification.

Research and specify all of the following in depth:

1. Compare direct `wasm32-unknown-unknown` exports, wasm-bindgen, component
   model/WASI approaches, and JavaScript glue for this browser runtime. Select
   one bounded ABI/build path and explain its ownership, code-size, memory-copy,
   deployment, and test implications.
2. Define the production WASM artifact set. Include module, loader glue only if
   required, worker entry, manifest, hashes, source maps policy, licenses,
   symbols/debug policy, runtime profile, feature requirements, and exact
   relationship to source commit and native semantic authority.
3. Specify reproducible Rust build controls: locked dependencies, target,
   panic strategy, allocator, LTO, codegen units, opt level, debug paths,
   stripping, SIMD/atomics target features, build environment, deterministic
   metadata, and post-build inspection.
4. Define static WASM validation before deployment. Cover magic/version,
   imports, exports, memory declarations, maximum pages, shared-memory flag,
   tables, start function, custom sections, name/debug leakage, forbidden WASI
   or network imports, feature profile, code size, and hash.
5. Design browser feature detection without trial allocations that destabilize
   the page. Include WebAssembly availability, SIMD validation, threads/shared
   memory, cross-origin isolation, worker support, structured cloning/transfer,
   storage APIs, secure context, memory limits, and typed unsupported states.
6. Analyze memory32 and current memory64 support. Explain the 32-bit address
   space, declared maximum, browser/process limits, contiguous growth,
   fragmentation, `memory.grow` behavior, failure semantics, resizable buffers,
   and why theoretical limits are not an admission budget.
7. Provide a complete memory model with formulas for immutable model bytes,
   quantized runtime representation, WASM heap, allocator metadata, scratch,
   activations, logits, tokenizer/template, KV cache per token, I/O chunks,
   JavaScript buffers, storage read buffers, and worker messaging copies.
8. Design a memory-admission algorithm using declared composition sizes,
   browser capability evidence, configured context limit, reserve margin, and
   measured calibration where available. Define `admitted`, `reduced_context`,
   `unsupported`, and `resource_blocked` truthfully; do not promise unreliable
   free-memory introspection.
9. Compare stream-to-WASM, storage-to-WASM, memory mapping substitutes, direct
   linear-memory writes, transferable ArrayBuffers, SharedArrayBuffer, BYOB
   readers, and chunked parser designs. Select a path that avoids an unbounded
   second full-model copy and state unavoidable copies explicitly.
10. Define the worker bootstrap protocol: exact asset manifest, module
    compilation/instantiation, runtime self-description, composition transfer,
    parser/validator initialization, progress, readiness, cancellation, crash,
    termination, and restart. Readiness must not precede successful runtime and
    model validation.
11. Decide whether the first production build is single-threaded or threaded.
    Compare performance and complexity against COOP/COEP, SharedArrayBuffer,
    worker pools, deterministic reductions, hosting constraints, third-party
    assets, and browser compatibility. Provide explicit promotion evidence for
    a threaded profile.
12. Specify HTTP deployment headers and content delivery for `.wasm`, worker
    modules, JS, composition metadata, and static UI assets. Cover MIME,
    `Content-Length`, compression, immutable caching by hash, CSP,
    `connect-src`, `worker-src`, COOP, COEP, CORP, CORS, service-worker scope,
    SRI limitations, range behavior, and HTTPS readback.
13. Design service-worker behavior so stale code cannot pair with a new runtime
    contract or composition. Include cache namespace identity, atomic asset-set
    update, activation, rollback of incomplete deployment, old tab behavior,
    offline state, purge, and no caching of prompt/model bytes outside the
    owned model store.
14. Define Rust-WASM ABI safety: pointer/length validation, allocation limits,
    handle generations, UTF-8, bounded JSON or binary messages, ownership of
    output buffers, use-after-free prevention, cancellation flag, trap
    handling, and runtime self-description.
15. Specify performance measurement in Chromium, Firefox, and WebKit-derived
    browsers as supported. Measure compile/instantiate, model load/validate,
    prefill, first token, decode, peak linear memory, JavaScript heap, copies,
    long task time, cancellation latency, and UI responsiveness with exact
    hardware/build/browser identities.
16. Define network and privacy proof. Capture all requests and fail on prompts,
    model bytes from project hosts, unexpected third parties, implicit
    telemetry, credential URLs, source maps containing private paths, or
    worker/service-worker leakage.
17. Provide Rust export sketches, TypeScript worker types, startup and admission
    pseudocode, deployment-manifest schema, service-worker transaction
    pseudocode, and typed error examples.
18. Produce a physical-browser/fault test matrix for unsupported features,
    module corruption, MIME error, stale cache, wrong headers, allocation
    refusal, WASM trap, worker crash, cancellation, tab closure, browser
    restart, long output, network offline, and deployment mismatch.
19. Identify all unknowns requiring local build inspection, deployed headers,
    real model bytes, physical browsers, network capture, or measured hardware.

Required report structure:

1. Executive WASM recommendation and assumptions.
2. Current standards/browser-support matrix.
3. Artifact, build, and static-validation contract.
4. Feature detection and resource-admission algorithm.
5. Full memory and copy accounting model.
6. Worker bootstrap, ABI, cancellation, and recovery design.
7. Single-thread versus threaded decision and promotion gate.
8. Deployment headers, caching, and service-worker transaction.
9. Privacy/network proof and performance laboratory.
10. Rust/TypeScript schemas and pseudocode.
11. Physical-browser and fault-injection matrix.
12. Phased implementation plan with objective acceptance criteria.
13. Unknowns requiring local proof.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend JavaScript inference, silent server fallback, fixture
generation, best-effort memory admission, an unbounded full-model clone,
threads without cross-origin-isolation proof, or deployment without header
readback. Do not invent browser support, memory limits, performance, or network
evidence.

## Prompt 9: Crash-Consistent Browser Model Storage, Streaming Admission, And Atomic Activation

You are an independent principal browser-storage architect, database
reliability engineer, Web Worker specialist, and large-blob security auditor.
Produce an exceptionally detailed implementation report for persisting,
validating, activating, restoring, and deleting multi-hundred-megabyte or
larger TinyRustLM model compositions in a browser. You may inspect current
IndexedDB, Origin Private File System, File System Access, Storage API,
StorageManager, quota, eviction, service-worker, Web Locks, worker,
structured-clone, stream, and browser implementation documentation. You have
no TinyRustLM source, browser profile, private schema, model files, storage
trace, or test evidence. Never claim local browser behavior that you did not
observe publicly.

Project context and fixed constraints:

- TinyRustLM is one prelaunch product and will adopt one canonical storage
  design. There is no legacy IndexedDB schema, old key alias, dual persistence
  path, migration obligation, fallback store, or permission for known debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, storage schema IDs, operation
  IDs, and release versions are technical identities, not product generations.
- A stored unit is an exact composition, not a model filename. Every component
  has an exact hash and length plus semantic compatibility and provenance.
- Model bytes enter through verified P2P transfer or deterministic local
  conversion. Project websites must not host or receive model bytes.
- Ingestion, hashing, parsing, validation, persistence, and activation run off
  the UI thread. Large artifacts must be streamed with bounded buffers and no
  hidden unbounded second full-model copy.
- The current active composition remains usable until a replacement fully
  persists, reopens, validates, and starts. A failed update cannot corrupt or
  displace it.
- Browser reload, browser restart, worker crash, quota loss, and power loss
  must produce truthful recoverable states. Refresh or `localStorage.clear()`
  is not proof of clean-profile deletion.
- Raw prompts, responses, credentials, enrollment links, and tokens are not
  part of the model store. MemoryEndpoints is unauthorized/disconnected.

Use primary sources and record dates, browser/version scope, direct URLs, and
retrieval date. Separate specification guarantees, browser-specific behavior,
recommendations, and local physical-browser proof.

Research and specify all of the following in depth:

1. Compare IndexedDB Blob/ArrayBuffer storage, OPFS asynchronous file handles,
   OPFS synchronous access handles in dedicated workers, File System Access
   user-visible files, Cache Storage, and hybrid metadata/file designs for
   large immutable model components. Select one canonical design and justify
   browser support, streaming, crash consistency, quota, privacy, and testability.
2. Define the origin-owned storage schema for compositions, components,
   staging objects, verified chunks, activation records, leases, journals,
   quarantine, deletion tombstones, and bounded receipts. Include keys,
   indexes, size limits, canonical ordering, and unknown-field policy.
3. Design stream ingestion from companion/P2P into the store. Cover BYOB
   readers, chunk size, backpressure, incremental SHA-256, exact length,
   duplicate/out-of-order chunks, extra bytes, short reads, browser cancellation,
   and avoiding JS/WASM/storage copies.
4. Explain where cryptographic hashing should run and how state is bound. If a
   resumable hash state is persisted, specify algorithm/version/endian state
   and security considerations; otherwise specify bounded rehash on resume.
   The companion's hash cannot replace independent browser verification.
5. Define storage and runtime preflight. Include expected stored bytes,
   staging duplication, metadata, browser quota estimate uncertainty,
   persistence requests, eviction risk, WASM runtime memory, KV cache, free
   reserve, and honest user-visible outcomes.
6. Design an append-only ingestion journal with attempt identity, composition
   identity, expected inventory, bytes staged/verified, hash status, component
   state, worker build, storage schema, timestamps, cancellation, failure,
   resume cursor, and parent companion receipt.
7. Specify atomic component promotion and composition commit despite browser
   APIs lacking a POSIX filesystem transaction across every object. Compare
   copy-on-write names, immutable content keys, commit markers, IndexedDB
   metadata transactions, OPFS rename/move support, fsync limitations, and
   reopen validation.
8. Define transactional activation: validate ACG2 closure, reopen every
   component from owned storage, verify hash/length, initialize the Rust WASM
   runtime, run a bounded startup check, publish one active pointer, retain the
   old active composition until success, and clean failed staging later.
9. Specify leases and concurrency across tabs, workers, service workers, and
   browser profiles. Address Web Locks limitations, BroadcastChannel ordering,
   stale workers, tab crashes, active-generation leases, update/delete races,
   and one companion operation observed by multiple tabs.
10. Design startup recovery. Enumerate states after crash during stream write,
    hash finalization, metadata commit, runtime startup, active-pointer swap,
    old-model cleanup, and deletion. Define deterministic recovery and when a
    new attempt is required.
11. Define quota and eviction behavior. Cover best-effort versus persistent
    storage, browser prompts/policies, origin eviction, private/incognito
    modes, storage pressure, user clearing site data, enterprise policies, and
    truthful restoration status.
12. Specify model restoration after normal browser restart. Bind exact
    composition and runtime contract; detect stale web assets/service workers;
    reject incomplete/quarantined components; and distinguish stored,
    validated, active, runtime-ready, and generating states.
13. Design secure deletion. Cover cancellation, lease drain, active-pointer
    removal, component reference counts, shared immutable components,
    quarantine, tombstones, storage API completion, post-delete enumeration,
    browser-profile deletion, and limitations on proving physical media erase.
14. Define guarded clean-profile lifecycle for automated dogfood on Windows
    and Linux. Require an owned temporary root, canonical absolute path,
    ownership marker, browser process closure, leaked-handle checks, bounded
    delete retries, no recursive delete outside root, and proof of absence.
15. Specify corruption and hostile-data handling: malformed composition,
    duplicate IDs, hash collision assumptions, huge declared sizes, truncated
    storage object, mutated bytes, stale commit marker, schema mismatch,
    malicious filename/path, and decompression prohibition or bounds.
16. Define privacy scans across IndexedDB, OPFS, Cache Storage, service workers,
    local/session storage, URLs, traces, logs, screenshots, and profile files.
    Cover UTF-8, UTF-16, base64, compressed database pages, hashed-value false
    alarms, and synthetic sentinel tests.
17. Provide TypeScript worker schemas, Rust/WASM boundary sketches, storage
    metadata examples, transaction and recovery pseudocode, deletion pseudocode,
    and explicit copy-accounting diagrams.
18. Produce a physical-browser/fault matrix across current Chromium, Firefox,
    and WebKit-derived support as applicable: quota denial, eviction, worker
    crash, browser kill, power loss approximation, stale lock, two tabs,
    corrupted chunk, full disk, cancellation, activation failure, restart, and
    deletion.
19. Identify all facts requiring local implementation inspection, real large
    model bytes, physical browser profiles, OS-level file inspection, quota
    pressure, or deployment testing.

Required report structure:

1. Executive storage recommendation and assumptions.
2. Current browser API/support and durability matrix.
3. Canonical schema and immutable identity model.
4. Streaming ingestion, hashing, and copy accounting.
5. Preflight, quota, persistence, and eviction design.
6. Commit, activation, lease, and recovery state machines.
7. Restart, restoration, corruption, and deletion semantics.
8. Clean-profile and privacy-scanning protocol.
9. TypeScript/Rust schemas and detailed pseudocode.
10. Physical-browser and fault-injection matrix.
11. Phased implementation plan with acceptance criteria.
12. Unknowns requiring local proof.
13. Annotated primary-source bibliography with dates and direct links.

Do not recommend localStorage for model bytes, a dual legacy schema, trusting a
companion hash without browser verification, replacing the active model before
startup succeeds, claiming physical erase, or using a page reload as deletion
proof. Do not invent quota, browser support, persistence, or crash-recovery
results.

## Prompt 10: Exactly-Once Browser Chat Orchestration, Streaming Output, Cancellation, And Multi-Turn State

You are an independent principal frontend state-machine architect, Web Worker
protocol engineer, conversational-UX reliability specialist, and accessibility
test lead. Produce an exceptionally detailed implementation report for the
TinyRustLM browser chat path after a real local model composition is active.
The design must guarantee one authoritative generation, one raw assistant
message, one terminal outcome, coherent cancellation, and correct multi-turn
state despite duplicate, delayed, stale, reordered, or lost worker messages.
You may inspect current browser event-loop, Web Worker, structured clone,
Streams, AbortController, Web Locks, BroadcastChannel, accessibility, reduced
motion, and automated browser-testing sources. You have no TinyRustLM source,
UI components, screenshots beyond public pages, worker protocol, model output,
test trace, or browser profile. Do not claim private UI inspection or testing.

Project context and nonnegotiable decisions:

- TinyRustLM is one prelaunch product. There is one current chat architecture
  and no legacy rendering path, duplicate store, old event adapter,
  compatibility action, fixture response mode, simulated assistant, hidden
  retry, response repair, or accepted debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, worker protocol IDs,
  request IDs, and schema versions are technical identities, not product
  generations.
- Rust WASM is the tokenizer, template, sampler, KV-cache, and inference
  authority. Browser code orchestrates and renders but must not complete,
  rewrite, select, merge, or improve candidate output.
- The approved visual language is locked. Functional reliability work may
  reorganize internal ownership but is not permission for a casual redesign.
- Introductory prompt cards disappear after chat begins, the center column
  becomes the conversation workspace, the composer remains usable, and each
  assistant answer renders exactly once.
- All model work runs off the UI thread. Prompts and model bytes must not be
  sent to project servers or telemetry.
- Genuine multi-turn conversation must preserve exact message order and valid
  KV-cache continuity. Current user instructions outrank stale prior profile or
  retrieved content, and quoted/retrieved instructions are untrusted data.
- Cancellation, context exhaustion, model switch, worker crash, browser
  restart, and storage failure must be explicit states, never partial success.
- MemoryEndpoints is unauthorized and disconnected; no UI state may imply live
  hosted memory.

Use current primary sources and record direct URLs, dates, browser scope, and
retrieval date. Distinguish standards, implementation behavior,
recommendations, and local-verification requirements.

Research and specify all of the following in depth:

1. Define one authoritative state owner and unidirectional event flow among UI
   controls, conversation store, worker client, worker, Rust runtime, model
   store, and optional persistence. Compare reducers/statecharts, actor models,
   event sourcing, and ad hoc promises for exactly-once semantics.
2. Specify identity hierarchy for browser session, tab instance, active model
   composition, conversation, message, generation, worker incarnation,
   operation attempt, stream sequence, cancellation, and terminal receipt.
   Explain which identities survive reload/restart.
3. Define the conversation state machine from `empty`, `ready`, `submitting`,
   `prefilling`, `generating`, `cancelling`, `completed`, `cancelled`,
   `context_blocked`, `model_failed`, `worker_failed`, and `restoring`. State
   every legal transition and invariant.
4. Specify immutable message records. Include role, source, raw content bytes
   or validated UTF-8 representation, display state, generation identity,
   exact ordering, completion reason, model/composition identity, sampling
   identity, timestamps, and error linkage. Separate raw model output from
   presentation formatting.
5. Design the UI-to-worker command protocol for initialize, activate,
   submit-turn, observe, cancel, dispose, and recover. Include schema/profile,
   worker incarnation, command ID, expected conversation revision, model
   identity, messages or rendered prompt authority, limits, seed, and bounded
   payload rules.
6. Design worker-to-UI events for accepted, prefill progress, token/chunk,
   completion, cancellation acknowledgment, error, heartbeat, and disposal.
   Require monotonic sequence, generation identity, worker incarnation,
   conversation base revision, exact terminal uniqueness, and replay behavior.
7. Define duplicate/stale/reorder handling. Cover duplicate token chunk,
   duplicate completion, completion before a delayed chunk, stale previous
   worker event, response after cancellation, two simultaneous submits, a late
   model activation, and tab restoration. State which layer is authoritative.
8. Compare streaming individual token IDs, decoded byte fragments, Unicode
   text chunks, and complete strings. Select a protocol that preserves exact
   raw output, handles UTF-8 boundaries and special tokens, avoids quadratic
   concatenation, and permits stable rendering.
9. Specify exactly-once assistant record creation. The placeholder, streaming
   buffer, committed assistant message, persistence, and DOM rendering must be
   one logical record. Explain idempotent reducers, revision checks, terminal
   commit, and testable DOM invariants.
10. Design cancellation from user click/keyboard through UI, worker, Rust token
    loop, KV transaction, terminal event, and controls. Define cancellation
    latency measurement, late-token behavior, rollback/commit of partial KV,
    whether partial output is retained, and truthful completion reason.
11. Define multi-turn KV-cache validity. Bind exact model, tokenizer, template,
    rendered token prefix, message revision, context policy, and runtime
    incarnation. Explain append, edited/deleted messages, regeneration,
    cancelled turns, model switch, system change, sampling change, and restart.
12. Specify context-limit behavior at the UI/runtime boundary. Calculate token
    budget before generation where possible, distinguish template/prompt/cache/
    generation tokens, prevent silent truncation, and offer an explicit product
    response without fabricating model output.
13. Design browser restart and worker crash recovery. Separate persisted
    conversation, persisted validated model, ephemeral worker state, KV cache,
    in-flight generation, terminal receipt, and stale events. An interrupted
    generation may be retried only as a new visible attempt unless exact
    semantics prove continuation.
14. Address multi-tab behavior. Decide whether a composition/conversation can
    be generated by one tab at a time, how locks and leases expire, how other
    tabs observe status, and how stale tabs are prevented from writing.
15. Specify ergonomic and accessible UI states without explanatory marketing
    copy. Cover disabled/enabled send, stop control, progress, errors, focus,
    keyboard navigation, screen-reader announcements, `aria-live` behavior,
    reduced motion, long names, long output, mobile composer, scrolling, and
    selection/copy during streaming.
16. Define visual and layout invariants at desktop, narrow desktop, and mobile
    widths. Include no overlap, stable toolbar/composer dimensions, no content
    occlusion, one response node, intro-card removal, scroll anchoring, and no
    layout shift from status labels.
17. Design privacy/network assertions for prompt submission, worker messages,
    console/logs, exceptions, traces, screenshots, URLs, storage, service
    workers, and network capture. Include synthetic sentinel phrases and
    expected zero-upload evidence.
18. Provide TypeScript discriminated unions, reducer/statechart pseudocode,
    worker-handler pseudocode, Rust cancellation boundary sketches, DOM
    identity examples, and receipt schemas.
19. Produce deterministic unit/property/model-based tests and physical
    Playwright scenarios for every duplicate/reorder/stale/cancel/crash case,
    long output, Unicode streaming, two tabs, reload, restore, context limit,
    accessibility, responsive layout, and zero network leakage.
20. Identify all facts requiring private component inspection, physical-browser
    execution, real model generation, accessibility tooling, screenshots, or
    network traces.

Required report structure:

1. Executive state-ownership recommendation and assumptions.
2. Identity hierarchy and authoritative data model.
3. Conversation/generation statecharts and invariants.
4. Exact UI-worker command/event protocol.
5. Streaming decode and exactly-once commit algorithm.
6. Cancellation, KV validity, context, and recovery semantics.
7. Multi-tab and browser-restart design.
8. Accessibility, responsive, and visual invariants.
9. Privacy/network contract.
10. TypeScript/Rust schemas and detailed pseudocode.
11. Unit, property, model-based, and Playwright test matrix.
12. Phased implementation plan with acceptance criteria.
13. Unknowns requiring local proof.
14. Annotated primary-source bibliography with dates and links.

Do not recommend best-of-N retries, output repair, two rendering paths,
simulated assistant text, dropping event identities, committing after an
ambiguous worker failure, silent context truncation, or a compatibility store.
Do not invent TinyRustLM DOM structure, UI test results, model behavior, or
network proof.

## Prompt 11: Source-Framework-To-SLM2 Native-And-WASM Numerical Conformance Laboratory

You are an independent principal numerical-validation scientist, transformer
implementation auditor, differential-testing architect, and reproducibility
engineer. Produce an exceptionally detailed protocol for proving that one
pinned public Qwen-family source checkpoint, its deterministic mixed-Q8 SLM2
conversion, the scalar semantic authority, optimized native kernels, and
browser WASM all implement the declared model closely enough to support honest
behavioral qualification. You may inspect official model implementations,
PyTorch/Transformers, Safetensors, IEEE 754, quantization literature, numerical
testing research, WebAssembly floating-point rules, and reproducible-science
sources. You have no TinyRustLM code, private vectors, model files, converter,
runtime, outputs, or hardware. Never claim local parity or select tolerances
from unseen results.

Project context and fixed constraints:

- TinyRustLM is one prelaunch product. There is one semantic runtime contract,
  no old runtime fallback, legacy tolerance, output repair, hidden precision
  upgrade, architecture guessing, benchmark exception, or accepted debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, quantization profiles, runtime
  implementation identities, evaluator identities, and schema versions are
  technical identities, not product generations.
- The source checkpoint, tokenizer, chat template, generation configuration,
  source framework/version, conversion profile, and all generated artifacts
  are immutable and content addressed.
- The architecture is a compact dense Qwen-family decoder with grouped-query
  attention, RoPE, RMSNorm, a SiLU-gated MLP, and optional source-declared
  Q/K normalization or QKV bias.
- Mixed-Q8 is expected to differ numerically from full precision, but budgets
  must be preregistered from scientific reasoning and pilot methodology rather
  than widened after observing a preferred candidate.
- Exact tokenizer IDs, rendered prompt bytes/tokens, sampling profile, seed,
  stop conditions, and context are prerequisites. Numerical comparison is
  meaningless when prompt semantics differ.
- Raw outputs and first failures must be preserved. A judge, postprocessor, or
  retry may not rewrite candidate output into a pass.
- Native and WASM performance are separate measurements from correctness.

Use primary sources, record immutable revisions, dates, direct links, and
retrieval date, and distinguish sourced facts, recommended experimental design,
assumptions, and local measurements still required.

Research and specify all of the following in depth:

1. Define the conformance identity envelope: source repository/revision and
   files, framework and dependency versions, device/backend, dtype, tokenizer,
   template, prompt tokens, model configuration, conversion profile, SLM2 and
   composition hashes, runtime/kernel IDs, build flags, sampling, seed, and
   test-case identity.
2. Establish a trustworthy source-framework oracle. Address `eval` mode,
   dropout, deterministic algorithms, CPU versus GPU, TF32, fused kernels,
   attention implementations, dtype promotion, device nondeterminism, seeds,
   thread counts, environment variables, and serialization of observations.
3. Define independent input cases that test semantic operators without using
   sealed behavioral evaluation prompts. Include short/long token sequences,
   repeated tokens, boundary token IDs, multilingual bytes only after tokenizer
   parity, RoPE positions, GQA head mapping, mask boundaries, context edge,
   multi-turn append, and seeded decoding.
4. Specify instrumentation points from input through embeddings, each layer's
   pre/post RMSNorm, Q/K/V projections, optional Q/K norm, RoPE, attention
   scores/probabilities/output, O projection, residuals, MLP gate/up/activation/
   down, final norm, logits, selected tokens, and KV cache.
5. Design a language-neutral tensor-capture format. Bind tensor semantic name,
   layer/step, shape, dtype, byte order, exact or sampled payload, summary
   statistics, hash, source identity, and case identity. Address multi-gigabyte
   capture limits and deterministic sampling of elements.
6. Define weight-level validation before activations. Compare source tensor
   values, destination quantized codes/scales, reconstructed values,
   per-group/per-row max error, mean error, RMSE, relative error, cosine
   similarity, saturation rate, outlier rate, and expected exceptions.
7. Define operator tolerances scientifically. Explain absolute/relative error,
   ULPs, cosine similarity, normalized RMSE, top-k logit overlap, KL or Jensen-
   Shannon divergence, logit-margin sensitivity, and shape-specific budgets.
   Avoid one universal epsilon.
8. Separate four comparison layers: source full precision versus a reference
   dequantized/mixed-Q8 mathematical model; mathematical model versus scalar
   Rust; scalar versus optimized native; and scalar/native versus WASM. Assign
   distinct expected error sources and authoritative verdicts.
9. Design localization using first-divergence search. Confirm weights and prompt
   first, then bisect layer/token/operator, disable only controlled
   optimizations, compare intermediate captures, preserve the minimal failure,
   and add a general regression rather than special-case output.
10. Address accumulation and reduction order for matrix-vector operations,
    RMSNorm, softmax, attention, and quantization statistics. Cover FMA,
    SIMD lane reduction, parallel reductions, exp approximation, reciprocal
    square root, subnormals, signed zero, NaN, infinity, and WASM semantics.
11. Define KV-cache parity over prefill and multiple decode steps. Compare key
    and value writes, positions, layer/head/token indexing, rollback after
    cancellation, reuse versus full recompute, context boundary, and model or
    template invalidation.
12. Define token-level and sequence-level acceptance. Cover greedy selected
    token, top-logit margin, seeded probability distribution, stop token,
    decoded bytes, divergence onset, repeated seeds, and why one identical
    attractive response is insufficient.
13. Relate numerical parity to behavioral regression. Require untouched raw
    source, converted native, and converted WASM outputs on separate public-safe
    conformance cases and sealed quality cases. Explain when a numerically
    acceptable model can still fail quality and vice versa.
14. Define stochastic statistical treatment: fixed seed set committed before
    outputs, paired comparisons, per-case pass probability, confidence
    intervals, correlated cases, multiple comparisons, infrastructure flakes,
    and prohibition on best-of-N selection.
15. Design metamorphic tests such as split prefill versus one-shot prefill,
    cache reuse versus recompute, tensor/shard presentation order, thread count,
    chunk size, native versus WASM, and repeated clean runs. State which outputs
    must be exact and which may remain within declared budgets.
16. Specify receipt and evidence schemas linking every raw capture, comparison,
    tolerance profile, verdict, first failure, tool identity, and parent
    artifact without exposing sealed prompts or expected answers.
17. Provide Python source-oracle pseudocode, Rust capture hooks/interfaces,
    Node/browser replay pseudocode, comparison algorithm pseudocode, and a
    machine-readable tolerance schema.
18. Produce a fault matrix for wrong tokenizer, wrong template, transposed
    tensor, wrong GQA mapping, RoPE offset, scale-axis error, rounding drift,
    mask error, exp approximation, tail block, cache corruption, source
    nondeterminism, WASM feature mismatch, and stale artifact identity.
19. Define stop rules: terminal architecture mismatch, converter bug, kernel
    bug, unsupported browser profile, tolerance-design defect, source-oracle
    nondeterminism, and candidate quality regression. State what may be reused
    after each failure.
20. Identify all facts requiring source execution, local instrumentation,
    actual converted bytes, native hardware, physical browsers, sealed
    evaluation custody, or human adjudication.

Required report structure:

1. Executive conformance recommendation and assumptions.
2. Full experiment identity and source-oracle controls.
3. Input suite and intermediate-capture specification.
4. Weight and operator comparison metrics/tolerances.
5. Four-layer differential authority model.
6. First-divergence localization workflow.
7. KV, token, sequence, and stochastic parity design.
8. Numerical-to-behavioral promotion boundary.
9. Metamorphic, adversarial, and fault matrix.
10. Receipt schemas and detailed pseudocode.
11. Stop rules and invalidation/reuse graph.
12. Phased laboratory plan with acceptance criteria.
13. Unknowns requiring local or authorized proof.
14. Annotated primary-source bibliography with dates and links.

Do not choose tolerances after seeing preferred results, compare outputs with
different tokenization/templates, use an opaque judge as numerical authority,
hide first divergence, repair output, or count a fixture as real-model parity.
Do not invent local tensors, tolerances already approved, pass rates,
performance, or browser evidence.

## Prompt 12: One Useful Model No-Cheat Qualification, Clean-Browser Acceptance, And Release Proof

You are an independent principal model-evaluation scientist, browser
acceptance lead, release-evidence architect, and documentation-integrity
auditor. Produce an exceptionally detailed end-to-end protocol for promoting
and releasing TinyRustLM's first genuinely useful, provenance-bound model only
after the complete P2P-or-convert, browser-local conversation path works. You
may inspect current evaluation research, human-review methodology, model cards,
browser automation documentation, software supply-chain standards, deployment
and HTTP evidence practices, and public TinyRustLM/MiniModel documentation.
You have no TinyRustLM source, private holdouts, curriculum, model bytes,
outputs, browser profiles, credentials, CI, package feed, deployment account,
or receipts. Never claim private execution, quality, publication, or live
service access.

Project context and fixed decisions:

- TinyRustLM is one prelaunch product. There is no launched V1 and no product
  V2. Release work must remove, not preserve, obsolete runtimes, fixture paths,
  text/script downloads, duplicate packages, compatibility surfaces, stale
  documentation, false counters, and known debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, evaluator versions,
  receipt schemas, package versions, and release versions are exact technical
  identities, not product generations.
- The first release target is one real compact Qwen-family conversational
  model, acquired at an immutable source revision or produced by an authorized
  training process, deterministically converted to the exact composition, and
  run through native Rust and physical-browser WASM.
- Popularity, parameter count, structural validity, conversion success, one
  attractive answer, or a model-based judge alone cannot qualify a model.
- Important quality dimensions are ordinary conversation, coherence,
  common-sense judgment, ambiguity handling, practical resource constraints,
  source conflict, latest-user-preference precedence, multi-turn references,
  untrusted quoted/retrieved content, summaries, rewrites, JSON, extraction,
  code explanation, and substantive treatment of lawful adult inquiry with
  narrow concrete security/nonconsensual-harm boundaries.
- Arithmetic is secondary and may be delegated to a deterministic calculator;
  benchmark familiarity is not general quality.
- Training data must not contain sealed evaluation prompts, paraphrases,
  expected answer terms, or feedback derived from holdout output. Raw candidate
  outputs cannot be repaired, completed, rewritten, or selectively retried.
- Two genuinely independent people are required for the currently planned
  sealed holdout authorship/review work. A technical agent cannot impersonate
  them or convert absent human custody into a skip.
- Browser acceptance requires a newly created owned persistent profile, real
  model acquisition/activation, genuine multi-turn conversation, exactly-once
  raw assistant rendering, cancellation, process closure, restart/restoration,
  guarded profile/model deletion, and privacy/network evidence.
- Model bytes remain local or direct P2P, and prompts must not reach project
  sites. MemoryEndpoints is unauthorized/disconnected and cannot satisfy a live
  memory claim.
- The larger campaign counters remain zero unless an independently frozen
  campaign manifest admits new matching evidence: models 0/20, clean browser
  rounds 0/50, live memory rounds 0/25, outside lane proofs 0/40, live catalog
  announcements 0/20. The first vertical slice does not silently increment
  them.

Use primary sources, record publication/update dates, direct links or immutable
revisions, and retrieval date. Label public observations, sourced facts,
recommendations, assumptions, human/authorized dependencies, and local proof.

Research and specify all of the following in depth:

1. Define claim levels including source-identified, license-reviewed,
   structurally-converted, numerically-conformant, runtime-smoke-only,
   conversation-screened, task-specific-proven, browser-accepted, published,
   and full-assistant-quality. For each, give minimum evidence and prohibited
   marketing language.
2. Design source-model screening before conversion/training compute. Require
   untouched outputs under fixed cases, seeded cases, unseen paraphrase
   families, and genuine multi-turn scenarios. Recommend case counts and human
   review effort as a justified staged protocol rather than invented certainty.
3. Define general semantic invariants for ambiguity, conflicting authority,
   current preference versus stale memory, unavailable resources and feasible
   fallback, quoted text as untrusted data, ordinary helpfulness, balanced
   lawful-adult analysis, structured output, and answer completion without
   relying on one fixture's nouns or keywords.
4. Design metamorphic cases varying entities, names, dates, percentages, units,
   products, authority order, sentence order, explicit/implicit negation,
   resource availability, current-turn changes, tone, distractors, and
   malicious quoted instructions. State invariant and intentionally changing
   verdicts.
5. Specify seeded holdout generation and human custody. Bind generator version,
   template family, committed seed selection rule, exclusion set, materialized
   case hash, custodian identity class, sealing time, access ledger, and
   evaluator authorization without exposing prompts in public evidence.
6. Define contamination screening across training, teacher, preference,
   removal, and evaluation data. Include exact normalization, character/token
   n-grams, semantic neighbors, template families, entity-substituted overlap,
   response overlap, expected-term overlap, public benchmark overlap, and
   deletion lineage.
7. Design layered evaluation with deterministic structure checks,
   scenario-specific semantic invariants, blinded model-assisted review,
   independent human review, and adjudication. State authority rules,
   disagreement outcomes, false-positive/negative audits, and evaluator
   versioning.
8. Define stochastic policy: fixed per-case seeds, repeated runs only when
   preregistered, pass probability, confidence intervals, correlated failures,
   multiple comparisons, flaky infrastructure, and why best-of-N is invalid
   unless it is declared product behavior.
9. Create a promotion matrix comparing immutable source framework, any
   authorized adapted/merged source, SLM2 scalar native, optimized native, and
   physical-browser WASM. Bind identical prompts/tokens/settings and require
   untouched raw outputs, numerical budgets, helpfulness budgets, latency,
   memory, and failure preservation.
10. Define ordinary-helpfulness regression budgets so optimization for narrow
    challenge cases cannot destroy conversational usefulness. Include severity
    classes, hard-gate failures, aggregate thresholds, confidence, and human
    review triggers.
11. Specify the exact clean-browser acceptance manifest. Bind application
    origin/build, companion/protocol, source/composition/model/tokenizer/
    template/sampling/runtime/evaluator identities, browser build, viewport,
    private prompt hashes, expected evidence, network policy, profile root, and
    deletion policy.
12. Define real model selection and acquisition in the browser: attempt exact
    verified P2P, transparently transition to reviewed source acquisition and
    conversion when unavailable, transfer/persist/activate the exact
    composition, and reject tiny fixtures or instruction downloads.
13. Define a two-to-six-turn conversation covering multiple semantic
    categories while preserving raw output. Assert user/assistant message
    counts, one rendering path, completion state, no duplicate text,
    cancellation coherence, scroll stability, composer usability, context/KV
    continuity, and no hidden retry.
14. Specify owned fresh-profile lifecycle on Windows and Linux: canonical
    temporary root, ownership marker, persistent browser context, process
    closure, leaked-handle detection, guarded recursive deletion, bounded
    retries, post-delete proof, and failure receipts.
15. Define browser privacy/network proof across requests/responses, WebSocket or
    loopback traffic, local/session storage, IndexedDB, OPFS, Cache Storage,
    service workers, logs, traces, URLs, referrers, screenshots, crash files,
    and model stores. Scan synthetic prompt/model/secret sentinels in UTF-8,
    UTF-16, base64, URL encoding, and archives.
16. Design append-only evidence and invalidation. Bind acquisition, conversion,
    numerical parity, evaluation, browser, package, deployment, and public
    readback receipts. A changed evaluator reruns evaluation/downstream phases,
    not a still-valid multi-gigabyte acquisition; no prior failure is overwritten.
17. Define release gates for Rust, native RIDs, WASM, browser assets, companion,
    C ABI, .NET packages, private converter package, docs, update logs, and
    affected public sites. Include format, lint, unit, integration, hostile,
    fuzz, consumer, physical-browser, accessibility, responsive, privacy,
    secret, reproducibility, and supply-chain checks with no relevant skips.
18. Specify source-control and artifact closure: all source/docs committed and
    pushed, local/upstream/fresh-remote commit equality, clean worktrees,
    package and deployment artifacts bound to the exact commit, SBOM,
    provenance, signatures when authorized, and no private output in source.
19. Define consistent visible and machine-readable update logs for every
    affected site. Require intentional version, release date, last-published
    UTC timestamp, concise changes, source/artifact identity where public-safe,
    known limitations, and no claims beyond receipts.
20. Define deployment and public HTTPS readback. Bind approved artifact set,
    authorization, transport, target, asset hashes, security headers, service
    worker/cache state, visible version/log, runtime assets, and post-deploy
    route/asset observations from an independent client.
21. Produce a blocker matrix for source quality, license ambiguity,
    architecture mismatch, conversion drift, parity failure, browser resource
    failure, absent human holdout custody, package failure, missing credentials,
    deployment mismatch, unavailable peers, absent outside proof, and
    unauthorized MemoryEndpoints. State independent work that may continue.
22. Provide machine-readable schemas and pseudocode for qualification verdicts,
    browser receipts, release manifests, invalidation graphs, deployment
    receipts, update logs, and a concise operator dashboard.
23. Give an objective final checklist that can only pass when one distinct
    source/provenance-bound model is useful, numerically within budget,
    acquired/converted through the product, run in a clean browser, deleted
    safely, packaged, documented, deployed, and read back. Keep wider campaign
    counters explicit and unchanged unless separately proven.
24. Identify every conclusion requiring private outputs, sealed holdouts,
    independent human reviewers, local hardware, physical browsers, package
    feeds, signing credentials, deployment authority, outside peers, or live
    services.

Required report structure:

1. Executive promotion/release recommendation and assumptions.
2. Claim taxonomy and prohibited-language table.
3. Source screen, semantic invariants, and metamorphic suite.
4. Holdout custody, contamination, and evaluator authority.
5. Stochastic statistics and promotion matrix.
6. Clean-browser acceptance manifest and procedure.
7. Privacy, network, deletion, and append-only evidence contract.
8. Package, supply-chain, source-control, and documentation gates.
9. Deployment, update-log, and public-readback protocol.
10. Blocker/parallel-work and invalidation matrices.
11. Concrete schemas, pseudocode, and operator dashboard.
12. Objective first-model acceptance checklist.
13. Staged implementation plan with stop and rollback rules.
14. Unknowns requiring local, human, or authorized proof.
15. Annotated primary-source bibliography with dates and direct links.

Do not train on holdouts, adjust cases/tolerances after seeing preferred
results, use keywords or an opaque judge as sole authority, repair raw output,
count a fixture or mock as a real model/browser/live test, preserve obsolete
paths for compatibility, deploy unbound artifacts, or claim campaign progress
without matching receipts. Do not invent quality, package, deployment, P2P,
MemoryEndpoints, or publication evidence.

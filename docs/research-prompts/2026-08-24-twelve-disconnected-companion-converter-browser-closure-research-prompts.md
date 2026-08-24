# Twelve Disconnected Research Prompts: Companion, Converter, And Browser Closure

Each section below is a complete standalone assignment for a different
technical research agent. Send one entire prompt to one agent. Do not assume
that an agent has received this introduction, another prompt, an earlier
report, or any private TinyRustLM material.

The reports are intended to resolve implementation decisions on the remaining
path from a reviewed public model revision to one useful, provenance-bound
browser-local chat model. The agents may browse public websites, standards,
papers, official documentation, public model repositories, immutable public
source revisions, and public package registries. They have no access to the
TinyRustLM source tree, private branches, local model files, build products,
test output, receipts, credentials, deployment accounts, browser profiles,
internal services, unpublished schemas, or private evaluation cases.

Every report must clearly distinguish:

- directly observed public facts;
- sourced external facts;
- assumptions made only to complete the analysis;
- engineering recommendations;
- proposed normative requirements; and
- facts that require local implementation or authorized production
  verification.

No agent may claim that it inspected, built, ran, tested, benchmarked, or
validated private TinyRustLM code. Public product pages may be stale and must
be described as dated observations rather than treated as proof of the private
implementation. Generic tutorials, invented measurements, unsupported claims,
and compatibility advice for obsolete prelaunch paths are not useful.

## Prompt 1: Formally Specified Companion Operation Kernel And Crash-Consistent Journal

You are an independent principal distributed-systems engineer, formal-methods
practitioner, filesystem durability specialist, and .NET reliability
architect. Produce an exceptionally detailed, implementation-oriented report
that specifies and stress-tests the operation kernel for a private local
TinyRustLM companion. The kernel owns one durable model-acquisition operation
from validation through verified availability. It must be deterministic,
create-only, resumable after interruption, safe under concurrent processes,
and incapable of converting partial or contradictory evidence into success.

You may research current .NET, Windows, Linux, NTFS, ReFS, ext4, XFS, filesystem
flush, directory-entry durability, file locking, atomic replacement, JSON,
formal state-machine, TLA+/PlusCal, Alloy, property-based testing, and
event-sourcing sources. You have no access to TinyRustLM source code, local
files, test output, or unpublished schemas. Do not infer that any proposed
mechanism already exists.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product. There is no launched V1, no product V2,
  and no customer population requiring aliases, migrations, deprecated
  states, forwarding readers, receipt upgrades, compatibility shims, or
  parallel journals. SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2,
  schema identities, and semantic versions are exact technical contracts, not
  product generations.
- The companion is private operational software, not a public model-format
  authority. Rust remains authoritative for model conversion, canonical
  serialization, artifact validation, and composition hashing.
- One browser request represents one logical acquisition operation. It first
  checks for a complete exact composition from direct peers. If no eligible
  peer can supply it, source acquisition and local conversion may occur only
  when the request contains explicit source-acquisition approval.
- The acquisition request binds a public model repository in `owner/name`
  form, an immutable 40-hex revision, model and tokenizer source-lock SHA-256
  values, a composition-profile SHA-256 value, a maximum source-byte budget,
  and no more than two ordered HTTPS peer candidates.
- The exact operation branches are `Undecided`, `Peer`, `Source`, and `None`.
  The intended state vocabulary is `Queued`, `CheckingPeers`, `FetchingPeer`,
  `VerifyingPeer`, `AcquiringSource`, `Converting`,
  `VerifyingComposition`, `Available`, `Cancelled`, and `Rejected`.
- `Available` requires a verified complete composition containing exactly the
  declared ACG2, SLM2, Tokenizer2, Template2, Sampling2, and Prompt2 artifacts.
  A weight file alone, a plausible filename, a completed child process, or a
  boolean `passed` value is insufficient.
- Operations and immutable history records are create-only. Rejected,
  cancelled, superseded, or obsolete records are preserved. A retry is a new
  operation identity unless the protocol explicitly proves it is recovery of
  the same committed logical operation.
- Large files remain outside source control and must be hashed as streams.
  MemoryEndpoints is unauthorized, disconnected, and outside this task.

Use primary sources wherever possible. For every source record title,
publisher, publication or update date, immutable revision when available,
direct URL, and report retrieval date. Quote minimally and explain the
engineering consequence of each source.

Research and specify all of the following in depth:

1. Define the complete state machine as a transition table. For every state,
   list legal predecessor states, legal successor states, required branch,
   required immutable fields, allowed mutable observations, terminal status,
   cancellation behavior, and the precise evidence needed before transition.
   Identify transitions that must be impossible even after process restart.
2. Decide whether the durable model should be event sourced, snapshot plus
   immutable events, or another create-only design. Define one canonical
   design, not a menu. Show the operation directory layout, owned-root marker,
   staging locations, immutable sequence names, current-pointer representation,
   artifact quarantine, and final composition location.
3. Specify operation identity construction. Address canonical field ordering,
   UTF-8, domain separation, peer-order significance, source approval,
   resource limits, source locks, composition profile, duplicate JSON keys,
   Unicode normalization, integer representation, and unknown fields. Explain
   how identity prevents accidental reuse across different work.
4. Model same-process and cross-process concurrency. Cover asynchronous locks,
   process crashes while holding a lock, advisory versus mandatory locking,
   lock-file ownership, stale-lock diagnosis, two processes racing to create
   the same operation, and two distinct operations targeting the same source
   or composition. Do not use process-name scans as authority.
5. Define a write transaction for each immutable event and snapshot. Include
   bounded serialization, create-new staging, write-through behavior, file
   flush, directory-entry durability, checksum verification, atomic rename or
   replacement, sequence allocation, current-pointer update, and post-commit
   readback. Explain differences and uncertainties on Windows and Linux.
6. Analyze crashes at every boundary: before staging creation, during JSON
   serialization, during a large-artifact hash, after file flush but before
   rename, after rename but before parent-directory flush, between history and
   current-pointer commit, during final directory promotion, and after commit
   but before the response reaches the browser. State the only legal recovery
   result for each cut point.
7. Define strict bounded JSON parsing and validation. Cover maximum file size,
   maximum string length, depth, arrays, duplicate keys, trailing content,
   number forms, unknown members, schema identity, invalid UTF-8, symlink and
   reparse-point substitution, and time-of-check/time-of-use attacks.
8. Specify final-availability verification. Bind each artifact name, media
   type, byte length, SHA-256, technical contract identity, parent composition,
   converter identity, source lock, and validation receipt. Explain how the
   journal proves all six members came from one composition rather than an
   accidental mixture.
9. Define typed failure codes and their persistence. Separate user
   cancellation, invalid input, source rejection, peer exhaustion, integrity
   failure, license blockage, resource exhaustion, converter defect,
   unsupported architecture, disk-full, lock contention, and journal
   corruption. No unknown failure may become `Available` or a generic retry
   success.
10. Develop a formal model suitable for TLA+/PlusCal, Alloy, or an equivalent
    tool. State variables, actions, safety invariants, liveness assumptions,
    fairness assumptions, bounded model parameters, and temporal properties.
    At minimum prove terminal-state immutability, at-most-one current snapshot,
    no availability without six verified members, no branch switching after
    irreversible work, and recovery to either the previous commit or the new
    commit but never a hybrid.
11. Design executable model-based, property-based, and fault-injection tests.
    Include generated transition sequences, concurrent writers, forced child
    termination, injected I/O errors, short writes, disk-full, corrupt current
    pointers, power-loss cut points, locked files, long paths, hostile JSON,
    and deterministic replay. Distinguish tests possible in CI from those
    requiring filesystem or power-failure laboratories.
12. Define observability that remains privacy safe. Logs and reports may carry
    operation hashes, public repository IDs, public revisions, sizes, states,
    timestamps, durations, bounded error codes, and tool versions. They must
    not carry prompts, credentials, private paths, enrollment URLs, access
    tokens, or raw model content.
13. Explain how the operation kernel should expose immutable progress to a
    browser without making transient UI delivery part of the durable commit.
    Address sequence cursors, reconnect, duplicate event delivery, lost
    responses, cancellation races, and terminal readback.
14. Provide pseudocode detailed enough to implement request validation,
    operation creation, locked transition, immutable event commit, snapshot
    replacement, crash recovery, final artifact admission, and safe cleanup.
    Label platform-specific calls and uncertain behavior requiring local
    experiments.

Required report structure:

1. Executive design decision and explicit assumptions.
2. Normative state and branch definitions.
3. Complete transition and evidence table.
4. Operation identity and canonical serialization.
5. Filesystem layout and ownership contract.
6. Atomic commit and recovery algorithms.
7. Windows/Linux durability analysis.
8. Concurrency and locking model.
9. Artifact-completeness and availability proof.
10. Formal specification and invariants.
11. Failure taxonomy and privacy-safe observability.
12. Property, model, and fault-injection test plan.
13. Implementation pseudocode and staged backlog.
14. Unknowns requiring local verification.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend mutable receipt overwrite, a single `passed` field, automatic
repair, legacy-state readers, best-effort durability presented as atomicity,
process-name ownership, unbounded JSON, or success inferred from a zero child
exit code.

## Prompt 2: Secure Browser-To-Loopback Companion Capability Protocol

You are an independent principal browser-security engineer, local-service
protocol architect, application cryptographer, and web-platform compatibility
researcher. Produce an exceptionally detailed technical report specifying one
secure protocol by which TinyRustLM.com can discover and communicate with a
user-owned TinyRustLM companion on loopback. The design must work as an actual
browser workflow, resist malicious websites and local attackers within a
realistic desktop threat model, and support long-running resumable acquisition
and conversion without exposing model bytes, prompts, or authority secrets to
the public website.

You may inspect current primary documentation and standards for Fetch, CORS,
Private Network Access, CSP, Permissions Policy, WebSocket, WebTransport,
HTTP/1.1, HTTP/2, TLS, loopback secure contexts, mixed content, DNS rebinding,
CSRF, origin headers, service workers, browser extensions, application custom
protocols, and Windows/Linux local process security. You cannot inspect private
TinyRustLM code, browser traces, certificates, installers, or credentials. Do
not invent existing endpoints or claim private validation.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product with no legacy client population. Select
  one protocol and delete rejected alternatives from the initial architecture;
  do not preserve aliases, old ports, old routes, fallback transports, or
  downloadable request files.
- TinyRustLM.com is a public HTTPS browser interface. Model inference occurs
  locally. Prompt content and model bytes must not be sent to TinyRustLM.com,
  MiniModel.org, analytics services, or unrelated third parties.
- MiniModel.org may provide public catalog and discovery metadata but may not
  proxy model bytes. The user-owned companion performs direct P2P acquisition
  or reviewed public-source acquisition and deterministic local conversion.
- One browser action must start the real operation. Downloading `.txt`, JSON,
  PowerShell, shell, or other instruction files is a product failure.
- The operation protocol uses exact technical schema identities and exposes
  durable operation state. Unknown schemas and unknown fields fail closed.
- The companion is private operational software and must not expose arbitrary
  filesystem reads, arbitrary command execution, unrestricted HTTP proxying,
  raw source URLs, or administrative credentials.
- A complete result is an exact composition of ACG2, SLM2, Tokenizer2,
  Template2, Sampling2, and Prompt2. MemoryEndpoints is unauthorized,
  disconnected, and outside scope.

Research and specify all of the following in depth:

1. Define the browser and local-host threat model. Include malicious public
   origins, compromised third-party scripts, CSRF, DNS rebinding, drive-by
   localhost scans, malicious service workers, extension access, another local
   user, same-user malware, stale browser tabs, copied capabilities, port
   squatting, companion impersonation, response injection, and local denial of
   service. State explicitly which threats are and are not in scope.
2. Compare loopback HTTPS with an installed private CA, loopback HTTP plus
   cryptographic capability, WebSocket, WebTransport, native messaging, custom
   URI schemes, and browser extensions. Account for current Chromium, Firefox,
   and WebKit behavior. Choose exactly one first production protocol and
   justify why its residual risks are acceptable.
3. Specify companion discovery without scanning broad port ranges, accepting
   whichever process responds, relying on DNS names that can be rebound, or
   downloading a helper file. Address fixed versus dynamically assigned ports,
   installation manifests, launch initiation, process ownership, stale
   discovery data, and multiple desktop-user sessions.
4. Design initial trust establishment. Define how the browser distinguishes an
   authentic installed companion from an impostor and how the companion
   authorizes only the intended TinyRustLM origin. Evaluate origin allowlists,
   signed installation manifests, per-install public keys, loopback
   certificates, user-presence pairing, short-lived capabilities, channel
   binding, and proof of possession.
5. Define capability lifecycle in detail: entropy, format, audience, origin
   binding, operation binding, method and route scope, expiry, rotation,
   single-use versus session use, replay handling, cancellation authority,
   storage, revocation, process restart, browser restart, and safe recovery
   after a lost response. Capabilities must never appear in URLs, referrers,
   screenshots, analytics, or durable browser stores by default.
6. Specify the exact HTTP or selected-transport surface. Include methods,
   routes, request and response media types, schema identities, maximum header
   and body sizes, timeouts, content lengths, transfer encoding, status codes,
   typed errors, origin validation, preflight behavior, cache controls,
   compression policy, connection limits, and unsupported-feature responses.
7. Design long-running operation communication. Compare polling with immutable
   cursors, server-sent events, WebSocket events, and another selected
   mechanism. Define sequence numbers, duplicate delivery, gaps, reconnect,
   terminal readback, browser sleep, companion restart, backpressure, and how
   progress remains advisory while durable journal state remains authoritative.
8. Define cancellation semantics across browser, companion, source downloader,
   peer fetcher, and Rust converter. Address cancel-before-start,
   cancel-during-commit, simultaneous completion and cancellation, child
   process termination, immutable cancelled evidence, cleanup, and subsequent
   explicit new operations.
9. Specify secure artifact transfer from companion to browser. Address
   content-addressed routes, exact composition identity, range or fixed-piece
   reads, response hashes, streaming backpressure, CORS, cache prohibition,
   partial transfer, concurrent tabs, and denial of arbitrary local file paths.
10. Analyze browser networking realities including Private Network Access,
    mixed-content restrictions, secure-context requirements, loopback
    exceptions, certificate warnings, proxy configuration, VPNs, enterprise
    policy, IPv4 and IPv6 loopback, localhost name resolution, and browser
    differences. Separate normative requirements from facts requiring current
    browser experiments.
11. Define hardening for the companion listener: bind-before-ready, exact
    loopback addresses, no wildcard bind, request parser limits, host-header
    validation, request smuggling defenses, connection and operation quotas,
    rate limits, idle timeouts, no directory serving, no symlink following,
    and privilege minimization.
12. Design an adversarial test matrix with malicious origins, forged Origin
    and Host values, omitted Origin, DNS rebinding, preflight variation,
    capability replay, stale tabs, port collision, fake companion, huge bodies,
    slowloris behavior, malformed chunking, event replay, browser restart,
    service-worker interception, and proxy/VPN interference.
13. Define privacy-safe network evidence. State what a Playwright or browser
    test may record and how traces, screenshots, HAR files, logs, crash dumps,
    URLs, headers, and browser stores are scanned for capabilities, prompts,
    private paths, source authorization, and model-byte leakage.
14. Provide concrete schemas and sequence diagrams for installation/discovery,
    authenticated session establishment, operation creation, event reconnect,
    cancellation, composition transfer, browser activation, and companion
    unavailable behavior.

Required report structure:

1. Executive protocol decision and assumptions.
2. Threat model and trust boundaries.
3. Browser/platform compatibility findings.
4. Discovery and process-authentication protocol.
5. Capability format and lifecycle.
6. Exact transport surface and schemas.
7. Long-operation progress and reconnect semantics.
8. Cancellation and lost-response behavior.
9. Content-addressed artifact transfer.
10. Listener hardening and resource governance.
11. Adversarial browser and protocol test matrix.
12. Privacy and evidence-minimization contract.
13. Implementation sequence and rejection criteria.
14. Unknowns requiring local browser experiments.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend permissive CORS, wildcard listeners, secrets in query strings,
origin trust without companion authentication, broad port scanning, arbitrary
file endpoints, downloadable instruction files, a browser extension as an
unexamined shortcut, or multiple initial protocols kept for compatibility.

## Prompt 3: Exact-Composition Direct P2P Discovery, Piece Transfer, And Multi-Peer Recovery

You are an independent principal P2P protocol engineer, content-addressed
storage architect, hostile-network security researcher, and transfer-
reliability specialist. Produce an exceptionally detailed implementation
report for direct peer acquisition of one complete TinyRustLM model
composition. The design must prefer verified P2P bytes, may use at most two
matching peers for one operation, must never mix incompatible content, and
must fall back to reviewed public-source conversion only after the P2P branch
has an honest terminal outcome.

You may inspect public standards and primary sources for content-addressed
storage, Merkle trees, BitTorrent, IPFS concepts, HTTP ranges, fixed-piece
transport, TLS, CORS, NAT, peer discovery, resumable downloads, sparse files,
and denial-of-service defenses. You cannot inspect MiniModel or TinyRustLM
private source code, catalogs, peer lists, manifests, model files, receipts,
or network configuration. Do not invent a live network or claim public
reachability.

Product context and fixed constraints:

- TinyRustLM.com is the browser-local chat interface. A user-owned private
  companion performs P2P transport. MiniModel.org is public catalog and
  discovery authority only; project websites must not proxy model bytes.
- TinyRustLM is prelaunch and has one clean protocol path. There is no need for
  legacy peer formats, relabeled manifests, dual piece schemes, alternate
  hashes, compatibility aliases, or migration logic.
- The transferable unit is an exact composition, not merely model weights. It
  contains exactly ACG2, SLM2, Tokenizer2, Template2, Sampling2, and Prompt2,
  plus bounded provenance and validation identities. Every member has an exact
  byte length and SHA-256 identity, and the composition has a canonical root
  identity.
- A request may supply no more than two ordered HTTPS peer candidates. Peer
  priority is identity-bearing. Peers are untrusted until every admitted byte
  verifies.
- The two-peer feature exists for matching resumable transfer, not for mixing
  different quantizations, templates, tokenizers, source revisions, or model
  variants. No partially useful composition may be activated.
- P2P unavailability is not a quality failure. Integrity disagreement,
  identity mismatch, or malicious behavior is a typed rejection of that peer.
  Source acquisition requires separate explicit user approval and immutable
  source locks.
- Loopback, LAN, or NAT-hairpin health is not evidence of public reachability.
  MemoryEndpoints is disconnected and outside scope.

Research and specify all of the following in depth:

1. Define the composition root and transfer manifest. Include schema identity,
   canonical encoding, artifact list, artifact roles, artifact lengths,
   artifact hashes, piece size, piece hashes or Merkle commitments, source and
   converter identities, technical contract versions, and domain separation.
   Explain which fields are hashed and which are advisory.
2. Choose one fixed-piece scheme. Compare flat piece-hash lists, Merkle trees,
   per-artifact trees, and one composition-wide tree. Analyze manifest size for
   approximately sub-gigabyte through multi-gigabyte artifacts, verification
   cost, random access, proof size, implementation complexity, and browser
   transfer needs. Provide formulas rather than invented measurements.
3. Specify discovery metadata returned by MiniModel.org without turning the
   catalog into a byte proxy or trust oracle for model quality. Bind catalog
   record, composition root, peer endpoint, lane identity, proof expiry,
   announcement time, and revocation state. Define stale, degraded, removed,
   quarantined, and unproven behavior.
4. Define peer eligibility before any large transfer. Cover normalized HTTPS
   URL, credentials/query/fragment rejection, IP-literal policy, immutable
   composition identity, compatible piece scheme, declared size budget,
   current outside proof when required, TLS identity, and bounded metadata
   response.
5. Specify the exact peer HTTP allowlist. Include methods, fixed routes, path
   grammar, content type, content length, range policy, piece names, HEAD
   behavior, CORS if needed, cache headers, timeouts, maximum headers,
   connection close rules, and denial of directory listing, arbitrary ranges,
   uploads, traversal, symlink targets, compression ambiguity, and dynamic
   query behavior.
6. Design the download journal. Bind operation, peer priority, composition,
   manifest, artifact, piece, destination offset, expected hash, actual hash,
   attempt identity, and commit state. Define create-only persistence, bitmap
   or journal representation, flush cadence, interruption recovery, and
   validation before trusting previously downloaded pieces.
7. Specify one-peer and two-peer scheduling. Address weighted fairness,
   per-peer concurrency, global connection limits, bandwidth caps, peer
   latency, duplicate requests, rare-piece concepts if relevant, deterministic
   assignment, peer disappearance, and how a second peer can continue without
   weakening complete identity agreement.
8. Define corruption behavior. Cover wrong length, wrong piece hash, wrong
   content range, manifest drift, peer equivocation, repeated corruption,
   sparse-file holes, local disk corruption, and final artifact mismatch.
   Specify quarantine and public-safe evidence; never silently re-request until
   a preferred answer appears.
9. Define final assembly and promotion. Address preallocation, sparse versus
   regular files, per-piece writes, full streaming hash, artifact-level
   validation, composition-level validation, same-volume staging, atomic
   directory promotion, disk-full, process crash, and retention of rejected
   evidence.
10. Analyze hostile-network risks: amplification, large manifest attacks,
    decompression bombs, slow peers, connection hoarding, TLS downgrade,
    redirect abuse, SSRF through supplied endpoints, loopback/private-address
    access, DNS rebinding, piece poisoning, replayed announcements, clock skew,
    and catalog compromise.
11. Define when the P2P branch is exhausted and when source conversion may
    begin. Distinguish no peers, all peers stale, transient network outage,
    integrity rejection, user cancellation, disk exhaustion, and companion
    restart. Avoid silent branch switching after source bytes have begun.
12. Provide capacity formulas for storage overhead, journal size, manifest
    size, hashing CPU, network bytes, open files, connections, startup
    revalidation, and worst-case quarantine for one real 0.6B-class model and
    later larger models. Use variables and worked symbolic examples without
    claiming local measurements.
13. Design protocol, property, fuzz, and authorized outside-network tests.
    Include deterministic fixture composition, one real qualified composition,
    two matching peers, one divergent peer, peer death, restart, corrupt piece,
    stale proof, NAT/hairpin distinction, direct import by an outside client,
    and privacy-safe evidence.
14. Provide precise schemas, state diagrams, request/response examples, piece
    scheduler pseudocode, resume pseudocode, final admission pseudocode, and a
    staged implementation backlog.

Required report structure:

1. Executive protocol recommendation and assumptions.
2. Composition identity and transfer-manifest schema.
3. Piece scheme analysis and selected design.
4. Catalog/discovery trust boundary.
5. Exact peer HTTP allow/deny profile.
6. Eligibility and two-peer agreement rules.
7. Download journal and scheduling algorithms.
8. Corruption, quarantine, and recovery behavior.
9. Atomic assembly and final verification.
10. Hostile-network threat model and resource limits.
11. P2P exhaustion and source-fallback decision.
12. Capacity formulas and operations guidance.
13. Test and external-proof matrix.
14. Unknowns requiring local or authorized verification.
15. Annotated primary-source bibliography with dates and direct links.

Do not count model aliases as distinct bytes, mix pieces across different
composition roots, trust a peer because catalog metadata names it, treat a
successful HTTP status as integrity proof, call a local probe public proof, or
recommend a project-hosted model-byte fallback.

## Prompt 4: Immutable Qwen3 Source Acquisition, Sharded Safetensors Custody, And License Decision

You are an independent principal ML supply-chain engineer, model-repository
forensics specialist, secure downloader designer, and open-source licensing
researcher. Produce an exceptionally detailed implementation report for
acquiring one reviewed Qwen3 approximately 0.6B-class source model and all
publisher-required tokenizer and conversation assets by immutable public
revision, then creating a complete source lock suitable for deterministic
local TinyRustLM conversion.

You may inspect official publisher repositories, model cards, immutable
repository commits, Hugging Face Hub documentation and APIs, Git LFS
documentation, safetensors documentation, licenses, security advisories, and
reproducible-build guidance. You cannot inspect TinyRustLM code, local caches,
download receipts, credentials, evaluation cases, or already downloaded model
files. Do not assume the named candidate is compatible or legally admissible;
verify all public claims and identify local unknowns.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product with no legacy source formats or mutable
  revision fallback. Source acquisition must bind an immutable 40-hex public
  repository revision and exact file hashes before conversion can be promoted.
- The first intended candidate is a dense Qwen3 model around 0.6B parameters,
  but popularity, parameter count, a model-card benchmark, or one attractive
  answer is not qualification. The report must verify the exact public repo,
  architecture, license, tokenizer assets, chat template, thinking-mode
  behavior, and conversion inputs.
- Direct P2P acquisition of an already verified exact composition is preferred.
  This report covers the source branch only after explicit user authorization.
- Large source files remain outside source control. Downloads must stream,
  enforce a caller-provided maximum-byte budget, resume safely, and never
  execute repository code.
- Conversion must eventually produce one complete ACG2 composition containing
  SLM2, Tokenizer2, Template2, Sampling2, and Prompt2. Every source input that
  affects those bytes must appear in the source lock.
- Source repositories and redirects are untrusted transport until hashes and
  immutable identities verify. `trust_remote_code`, arbitrary Python loading,
  pickle, shell scripts, post-download hooks, and executable repository files
  are forbidden in the acquisition path.
- MemoryEndpoints is unauthorized and outside scope.

Research and specify all of the following in depth:

1. Identify the exact plausible official Qwen3 0.6B repository or repositories
   using publisher-controlled primary sources. Record repository ID, immutable
   commit, model-card revision, publication/update dates, architecture class,
   parameter count, context claims, and license. Clearly label information that
   may change after the report retrieval date.
2. Produce an expected file inventory. Address `config.json`, safetensors
   index, shard files, unsharded weights if applicable, tokenizer JSON,
   tokenizer configuration, vocabulary/merge assets, special-token maps,
   generation configuration, chat-template sources, license, model card, and
   any publisher metadata needed to interpret thinking mode. Explain which
   files affect runtime bytes and which are documentation evidence only.
3. Analyze the repository transport path. Cover immutable revision APIs,
   content-resolution URLs, redirect chains, CDN hosts, Git LFS pointer files,
   ETag semantics, content length, range requests, authentication-free access,
   rate limits, transient errors, and how to prevent a mutable branch or tag
   from entering the lock.
4. Define a source-lock schema. Include schema identity, repository authority,
   repository ID, immutable revision, retrieval time, every accepted relative
   path, role, expected length, SHA-256, media/format identity, LFS object ID
   when relevant, license decision, reviewer identity class, and downloader
   version. State canonical serialization and source-lock hash rules.
5. Specify path and manifest validation. Cover Unicode, slash normalization,
   dot segments, duplicate paths, case collisions on Windows, reserved names,
   absolute paths, symlinks, submodules, archive entries, unexpected files,
   shard-index references, orphan shards, duplicate tensor declarations, and
   integer overflow in declared offsets or sizes.
6. Design the streaming downloader. Include owned-root validation, create-only
   staging, maximum total and per-file bytes, bounded redirects, TLS
   verification, DNS and private-address policy, incremental SHA-256, partial
   file journal, range-resume validation, ETag or object-identity continuity,
   timeout budgets, retry limits, cancellation, flush, atomic promotion, and
   post-promotion readback.
7. Specify safetensors preflight without loading tensors into memory. Validate
   header bounds, JSON depth and duplicate keys, data offsets, shape products,
   dtype allowlist, non-overlap, shard coverage, tensor-name uniqueness,
   expected architecture tensors, tied-embedding implications, and total byte
   consistency. Separate format validity from model semantic compatibility.
8. Research Qwen3 tokenizer and chat behavior from publisher sources. Address
   tokenizer type, vocabulary size, added/special tokens, byte fallback,
   normalization, pre-tokenization, EOS/BOS behavior, chat template,
   `add_generation_prompt`, assistant delimiters, thinking/non-thinking
   controls, and generation defaults. Identify every source file that must be
   locked for exact compilation to Tokenizer2, Template2, Sampling2, and
   Prompt2.
9. Produce a license and provenance decision procedure. Cover model license,
   code license versus weight license, attribution, redistribution of
   converted weights, notice obligations, acceptable-use clauses, trademark
   concerns, upstream dataset uncertainty, revocation or later license change,
   and what evidence is needed before P2P redistribution. Do not provide legal
   certainty beyond sourced facts; identify where counsel is needed.
10. Define acquisition-drift handling. Explain behavior when the same mutable
    repository name points elsewhere, an immutable object becomes unavailable,
    CDN bytes disagree, a file disappears, a model card changes, a security
    advisory appears, or a license concern arises after conversion. Preserve
    prior receipts without allowing stale evidence to promote new bytes.
11. Design source-screening before expensive conversion. Use untouched source
    model execution under a pinned public framework only as a separately
    authorized evaluation step. Define architecture compatibility checks,
    raw-output preservation, practical behavior screens, tokenizer/template
    validation, and rejection criteria without contaminating training or
    converting first merely because bytes are available.
12. Define privacy-safe acquisition evidence and secret scanning. Public repo
    IDs, revisions, hashes, lengths, licenses, tool versions, and bounded
    errors are allowed. Credentials, signed URLs, cookies, authorization
    headers, private cache paths, prompts, and raw model bytes are not.
13. Provide downloader and validator pseudocode, a JSON source-lock example
    using clearly fake hashes, a crash-state table, and an implementation
    backlog ordered by fail-closed gates.
14. List all facts that still require local verification: exact file hashes,
    byte lengths, runtime architecture support, resource use, numerical parity,
    conversion determinism, behavioral quality, and browser feasibility.

Required report structure:

1. Executive acquisition recommendation and assumptions.
2. Official candidate and immutable-source observation table.
3. Complete expected source-file inventory.
4. Source-lock schema and canonical identity.
5. Secure streaming acquisition algorithm.
6. Sharded safetensors preflight and architecture checks.
7. Tokenizer/template/sampling source custody.
8. License, redistribution, and provenance decision matrix.
9. Drift, revocation, and incident behavior.
10. Pre-conversion source-screen protocol.
11. Privacy-safe receipts and secret controls.
12. Failure injection and test matrix.
13. Staged implementation backlog.
14. Unknowns requiring local execution or legal review.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend mutable branch downloads, `trust_remote_code`, pickle,
repository script execution, best-effort hash checking, source files in Git,
silent license assumptions, fabricated local hashes, or model qualification
from repository popularity.

## Prompt 5: One Create-Only Complete-Composition Rust Conversion Transaction

You are an independent principal Rust systems engineer, compiler-pipeline
architect, model-format designer, and crash-consistency specialist. Produce an
exceptionally detailed implementation report for one canonical Rust conversion
command that consumes an immutable reviewed source lock and emits one complete,
verified TinyRustLM composition transaction. The command must own source
inspection, tensor conversion, quantization, companion-artifact compilation,
canonical hashing, validation, receipts, and final atomic promotion. A tool
that writes only one weight file is not complete.

You may inspect current Rust, serde, safetensors, memory mapping, filesystem,
hashing, canonical-serialization, CLI machine-protocol, process cancellation,
and reproducible-build documentation. You have no access to TinyRustLM source,
private SLM2 schemas, converter binaries, model files, build output, or test
receipts. Treat the technical identities below as fixed requirements and
propose precise schemas where private details are unavailable.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product. There is no launched V1 and no reason
  for dual converters, compatibility readers, deprecated flags, legacy output
  modes, forwarding commands, aliases, repair paths, or schema migration.
- Rust is the sole authority for conversion semantics and artifact validation.
  A private .NET companion may validate a declarative request, launch the exact
  Rust executable, enforce resource limits, and verify returned identities; it
  must not implement a second converter.
- The input binds one immutable source lock, one model source-lock SHA-256, one
  tokenizer source-lock SHA-256, one composition-profile SHA-256, exact tool
  identity, resource ceilings, output owned root, and operation identity.
- The result contains exactly ACG2, SLM2, Tokenizer2, Template2, Sampling2,
  and Prompt2. The ACG2 root binds every member, contract version, declared
  runtime limit, source identity, converter identity, quantization profile,
  and validation receipt.
- The first intended model is a reviewed dense Qwen3 model around 0.6B
  parameters using a quality-preserving mixed-Q8 profile. The converter must
  reject unsupported architecture details instead of guessing tensor meaning.
- Inputs and outputs may be gigabytes. Whole-model buffering is forbidden.
  Source and generated model files remain outside Git.
- Every operation is create-only. Existing output, unknown input fields,
  unexpected source files, unknown tensors, unsupported dtypes, hash mismatch,
  non-deterministic metadata, and incomplete composition fail closed.

Research and specify all of the following in depth:

1. Define one machine-facing CLI contract. Specify executable identity,
   command name, request delivery, canonical UTF-8 JSON schema, version
   negotiation policy, stdout frame grammar, stderr use, progress events,
   terminal result, exit codes, maximum frame sizes, unknown-field handling,
   cancellation, and behavior after broken pipes. No human prose may be parsed
   as authority.
2. Define the conversion request schema. Include operation ID, source-lock
   path and hash, expected immutable repository/revision, expected model and
   tokenizer source locks, composition profile and hash, quantization profile,
   owned staging root, memory/disk/time/thread limits, deterministic seed if
   any operation requires one, and exact expected technical contract IDs.
3. Specify the complete phase state machine: input admission, source-lock
   verification, source preflight, architecture lowering, tensor conversion,
   Tokenizer2 compilation, Template2 compilation, Sampling2 construction,
   Prompt2 construction, SLM2 validation, composition assembly, receipt
   creation, full re-read, and atomic promotion. Define fail-closed evidence at
   each boundary.
4. Design the physical output transaction. Show same-volume owned staging,
   create-new files, temporary names, streamed writes and hashes, flush order,
   immutable per-phase receipts, final directory naming by composition hash,
   directory-entry durability, create-only final promotion, collision handling,
   cleanup, and resume policy on Windows and Linux.
5. Decide whether conversion resumes within an interrupted operation or starts
   a new operation reusing independently verified immutable phase outputs.
   Choose one model and define content-addressed phase identities so expensive
   source download or tensor work is not repeated without permitting partial
   output reuse or mutable cache poisoning.
6. Specify deterministic SLM2 production. Cover tensor order, names, metadata
   order, byte order, alignment, padding bytes, floating-point conversion,
   scale calculation, rounding mode, NaN and infinity rejection, thread-count
   independence, parallel reduction order, zero points if any, timestamps,
   host paths, build IDs, random sources, and canonical output hashing.
7. Specify complete Tokenizer2, Template2, Sampling2, and Prompt2 generation
   from source-locked publisher inputs and fixed profiles. Define which pieces
   are compiled from source, which are exact fixed product policy, how hashes
   bind them, and how the converter refuses implicit defaults.
8. Define ACG2 assembly and validation. Include member roles, exact relative
   names, lengths, SHA-256 values, composition profile, architecture facts,
   context/KV limits, tokenizer/template/sampling/prompt identities, source and
   license receipts, runtime/ABI requirements, canonical encoding, and root
   identity. Explain anti-mix-and-match domain separation.
9. Specify resource governance. Cover streaming/mmap tradeoffs, bounded header
   parsing, memory budget accounting, output disk preflight, temporary-space
   formula, thread limits, CPU priority, cancellation polling, hash throughput,
   file descriptor limits, and safe behavior when actual needs exceed declared
   limits.
10. Define typed failure output for invalid request, source drift, architecture
    mismatch, unsupported tensor, tokenizer incompatibility, template compile
    failure, quantization non-finite value, resource exhaustion, disk-full,
    cancellation, validation mismatch, existing destination, and internal
    invariant violation. Unknown failures remain failures.
11. Design reproducibility and differential tests. Include tiny synthetic
    tensors, publisher-shaped fixtures, sharded and unsharded sources,
    duplicate tensor names, malformed safetensors, deterministic reruns across
    thread counts and operating systems, intentional crash points, golden
    composition metadata, and full real-model hash comparison. Distinguish
    byte determinism from numerical parity.
12. Define the managed-companion boundary. Specify executable discovery from a
    signed private distribution, exact binary hash/version checks, declarative
    invocation, bounded child process, progress relay, cancellation, terminal
    result verification, and prohibition on C# repair or alternate converter
    fallback.
13. Provide concrete JSON examples with fake identities, phase and filesystem
    diagrams, Rust-oriented pseudocode, module boundaries, error enums, and a
    TDD implementation sequence that ends in one complete composition command.
14. State all unknown private details that must be supplied or tested locally
    before coding can be final, without inventing SLM2 or ACG2 bytes.

Required report structure:

1. Executive converter decision and assumptions.
2. Canonical CLI and machine-frame protocol.
3. Request, progress, result, and error schemas.
4. Complete phase state machine.
5. Create-only filesystem transaction and crash recovery.
6. Deterministic tensor and companion-artifact generation.
7. ACG2 composition assembly and anti-confusion rules.
8. Resource and cancellation model.
9. Typed failure taxonomy.
10. Managed companion integration boundary.
11. Reproducibility, parity, fuzz, and fault tests.
12. Rust module plan and implementation pseudocode.
13. Unknowns requiring local source/schema inspection.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend a one-file converter, output repair, hidden defaults, multiple
conversion authorities, mutable overwrite, arbitrary CLI fragments, whole-
model buffering, compatibility flags, success from process exit alone, or
promotion before full composition revalidation.

## Prompt 6: Qwen3 Tensor-Schema Lowering Into A Portable SLM2 Runtime Contract

You are an independent principal transformer-runtime engineer, compiler
backend designer, numerical-computing specialist, and model-format researcher.
Produce an exceptionally detailed report defining how a dense Qwen3 model near
0.6B parameters should be recognized from immutable publisher configuration
and safetensors, lowered into one portable SLM2 tensor schema, and rejected
when any architectural fact is ambiguous or unsupported. The report must be
specific enough to drive converter and runtime tests without relying on private
TinyRustLM code.

You may inspect official Qwen3 model cards, configuration files at immutable
public revisions, Transformers source and documentation, published technical
reports, safetensors, PyTorch reference operations, and CPU/WASM numerical
sources. You cannot inspect TinyRustLM code, SLM2 files, runtime logs, or
private schemas. Clearly separate public Qwen facts from proposed SLM2
requirements and local-verification needs.

Product context and fixed constraints:

- TinyRustLM is a browser-local inference product. Rust native and Rust-compiled
  WASM must consume the same SLM2 semantics. The first intended real model is a
  reviewed dense Qwen3 approximately 0.6B model using mixed-Q8 weight storage.
- There is one clean runtime and conversion path. There is no requirement to
  accept older Qwen generations, GGUF, arbitrary Transformers models, generic
  architecture guessing, aliases, unknown tensors, or best-effort conversion.
- SLM2 is an exact technical contract. The composition also includes ACG2,
  Tokenizer2, Template2, Sampling2, and Prompt2, but this report focuses on the
  model architecture and tensor semantics that SLM2 must bind.
- Conversion success must mean source-framework-equivalent computation within
  preregistered numerical budgets, not merely structurally plausible tensor
  sizes. Unsupported features fail before expensive output is promoted.
- Arithmetic, tensor parsing, conversion, and runtime kernels must reject
  overflow, non-finite metadata, invalid shapes, and contradictory config.
  MemoryEndpoints is outside scope.

Research and specify all of the following in depth:

1. Identify the exact public Qwen3 dense architecture facts relevant to the
   target size: layer count, hidden size, intermediate size, attention heads,
   key/value heads, head dimension, vocabulary size, maximum positions, RoPE
   parameters, RMSNorm epsilon, activation, tied embeddings, bias use,
   attention implementation, q/k normalization if present, cache semantics,
   and special configuration fields. Pin every claim to immutable primary
   sources where possible.
2. Build a complete config-admission table. For every required key specify
   type, allowed value/range, cross-field equations, overflow checks, default
   policy, and rejection behavior. Unknown architecture-critical fields must
   not be ignored. Explain how to distinguish harmless publisher metadata from
   semantic model configuration.
3. Build a complete source tensor inventory and naming map for embeddings,
   per-layer attention projections, attention norms, MLP projections, layer
   norms, and output head. Include expected shape equations, dtype allowlist,
   tied-weight handling, shard-index behavior, missing/extra tensor policy,
   duplicate name handling, and transposition requirements.
4. Define the exact forward pass in mathematical order. Cover embedding lookup,
   normalization, q/k/v projection, optional q/k normalization, rotary
   embedding, grouped-query head expansion without accidental materialization,
   causal masking, scaled dot-product attention, output projection, residual
   ordering, gated MLP/SwiGLU, final norm, tied or untied logits, and any
   publisher-specific details.
5. Define RoPE semantics precisely: position numbering, base/theta, scaling
   mode, dimensions rotated, interleaving, sin/cos precision, cache generation,
   prompt/decode reuse, context overflow, and source-framework differential
   vectors. Reject unspecified long-context extrapolation.
6. Define grouped-query attention layout and KV-cache shape. Give equations for
   bytes per token by dtype, layer, KV head, and head dimension. Address tensor
   layout, sequence stride, batch assumptions, cache position, cancellation,
   conversation reset, model switch, context truncation, and stale-cache
   invalidation when Prompt2 or Template2 changes.
7. Propose one SLM2 tensor layout. Specify canonical tensor IDs or names,
   ordering, rank and dimension encoding, dtype and quantization metadata,
   alignment, scale layout, byte order, padding, tied-weight references versus
   duplication, and bounds validation. Explain how native and WASM readers
   avoid host-layout assumptions.
8. Define mixed-Q8 lowering per tensor family. Identify tensors that should
   remain higher precision, quantized weight matrix layout, scale granularity,
   zero-point policy, group size, outlier handling, embedding and output-head
   choices, and how the layout maps to scalar, SIMD, and WASM kernels. Label
   recommendations requiring empirical quality tests.
9. Analyze numerical precision choices for accumulation, RMSNorm, softmax,
   RoPE, activation, residuals, logits, and sampling inputs. Define reference
   precision, deterministic reduction order where required, overflow/underflow
   handling, exp approximation budgets, NaN propagation policy, and platform
   variance.
10. Design converter preflight and post-write validation. Preflight proves
    config/tensor coherence before output allocation. Post-write validation
    independently reparses SLM2, checks all tensor spans and hashes, executes
    selected microvectors, and verifies architecture identity before ACG2 can
    bind the artifact.
11. Design an independent conformance corpus. Include tiny hand-computable
    layers, synthetic GQA cases, RoPE boundary positions, q/k normalization,
    tied embeddings, extreme logits, all-zero and outlier weights, shard
    permutations, publisher-framework hidden states, per-layer checkpoints,
    prefill/decode equivalence, and full next-token logits.
12. Define numerical acceptance budgets by observable: dequantized weights,
    layer outputs, attention probabilities, final hidden state, logits, top-k
    ordering, greedy token identity, sampled token sequence under fixed random
    draws, and conversational output. Explain why one global epsilon is
    inadequate.
13. Analyze browser feasibility using formulas for weight bytes, alignment
    overhead, KV cache, runtime scratch, WASM linear memory, duplicated transfer
    buffers, tokenizer/template assets, and browser storage. Do not invent local
    performance numbers.
14. Provide converter mapping pseudocode, runtime forward-pass pseudocode,
    shape-validation algorithms, cache-layout diagrams, a rejection matrix,
    and an ordered implementation/test backlog.

Required report structure:

1. Executive architecture and lowering recommendation.
2. Immutable public Qwen3 architecture observation table.
3. Config admission and cross-field invariants.
4. Complete source tensor inventory and mapping.
5. Normative forward-pass semantics.
6. RoPE, GQA, and KV-cache contract.
7. Proposed portable SLM2 tensor layout.
8. Mixed-Q8 lowering and precision policy.
9. Converter/runtime validation algorithms.
10. Differential conformance corpus and numerical budgets.
11. Native/WASM memory and performance formulas.
12. Rejection matrix and implementation backlog.
13. Unknowns requiring local source/model execution.
14. Annotated primary-source bibliography with dates and direct links.

Do not propose generic architecture autodetection, ignored unknown tensors,
shape-only validation, GGUF compatibility, long-context claims without source
support, one epsilon for all layers, post-hoc output repair, or promotion from
one matching greedy token.

## Prompt 7: Mixed-Q8 Quantization, TurboQuant/TurboVec Lessons, And Quality-Preserving Kernels

You are an independent principal quantization researcher, CPU/WASM kernel
engineer, numerical-analysis specialist, and evaluation scientist. Produce an
exceptionally detailed technical report selecting and validating a mixed-Q8
quantization and execution design for a dense Qwen3 approximately 0.6B model in
TinyRustLM. Use public TurboQuant, TurboVec, and related primary research only
as evidence and transferable ideas; do not assume those projects are used,
compatible, correctly remembered, or available under acceptable licenses.

You may inspect papers, official repositories at immutable revisions, author
documentation, issue trackers when needed to identify limitations, CPU SIMD
intrinsics documentation, WebAssembly SIMD specifications, compiler
documentation, and peer-reviewed quantization literature. You cannot inspect
TinyRustLM kernels, SLM2 files, benchmarks, local hardware, evaluation output,
or private reports. Do not claim local speed or quality results.

Product context and fixed constraints:

- TinyRustLM performs browser-local inference using one Rust semantic runtime
  compiled for native and browser WASM. The initial real model target is a
  reviewed dense Qwen3 around 0.6B parameters.
- The intended storage profile is mixed-Q8, not a marketing claim of 1-bit
  inference. Any tensor retained at f16/f32 or quantized differently must be
  explicitly declared and identity-bearing.
- SLM2 is one exact portable model format. There is no need for GGUF fallback,
  legacy layouts, runtime guessing, compatibility kernels, or hidden
  requantization.
- Quality is primary. Quantization must pass source-versus-converted numerical
  and behavioral gates before browser performance matters. Structural
  validation, compression ratio, popularity, or one attractive answer is not
  promotion evidence.
- Runtime arithmetic must be safe and bounded on scalar native, native SIMD,
  and WebAssembly SIMD paths. Unsupported CPU features select a declared
  canonical scalar kernel, not an older format or third-party executable.
- Arithmetic is secondary product behavior and may be delegated to a
  deterministic calculator, but core conversational coherence, practical
  judgment, instruction following, and multi-turn continuity must not regress
  beyond preregistered budgets.

Research and specify all of the following in depth:

1. Establish exactly what TurboQuant and TurboVec are from primary sources.
   Record authors, paper/repository title, revision, publication/update date,
   target operation, data representation, training or calibration assumptions,
   supported hardware, reported baselines, license, and known limitations.
   Separate namesake or unrelated projects.
2. Extract transferable techniques relevant to weight-only Q8 transformer
   inference: vector packing, scale organization, lookup or codebook methods,
   outlier treatment, fused dequantization, cache locality, SIMD reduction,
   prefetching, tiling, and low-overhead metadata. Explain which ideas do not
   apply to browser WASM or to the selected Qwen3 architecture.
3. Compare credible Q8 designs: per-tensor symmetric, per-output-channel,
   grouped symmetric, asymmetric, mixed precision, activation-aware weight
   quantization, and limited calibration-aware alternatives. Evaluate bytes,
   scale overhead, converter complexity, scalar correctness, SIMD fit, WASM
   support, and expected error. Choose one initial normative profile.
4. Define tensor-family policy for embeddings, q/k/v/o projections, MLP gate,
   up/down projections, output head, RMSNorm weights, biases if any, and small
   metadata arrays. Explain when keeping a tensor at f16/f32 is justified and
   how the choice becomes part of the composition identity.
5. Specify scale derivation and rounding exactly. Address grouping dimension,
   group size, maximum-absolute computation, zero groups, finite-value checks,
   rounding ties, saturation, signed range, `-128` handling, subnormals,
   deterministic parallel reduction, and platform-independent output bytes.
6. Define SLM2 Q8 physical layout for scalar and vector kernels. Include block
   headers, scale type, quantized byte order, matrix orientation, row and group
   alignment, padding, tail handling, cache-line considerations, endianness,
   bounds checks, and prohibition on reading uninitialized padding.
7. Design mathematically equivalent scalar, native SIMD, and WASM SIMD kernels.
   Cover vector widths, signed dot-product availability, widening multiply,
   accumulation precision, scale application, horizontal reduction, tails,
   feature detection, deterministic test mode, and compiler auto-vectorization
   versus explicit intrinsics.
8. Analyze fusion opportunities and risks: dequantize-plus-matmul, RMSNorm,
   RoPE, attention projection, MLP activation, logits, and KV-cache writes.
   Identify fusions that preserve a clear reference oracle and those likely to
   make parity debugging or browser compilation unsafe.
9. Define a layered numerical evaluation. Compare original source weights,
   dequantized weights, float reference runtime, scalar Q8 runtime, native SIMD,
   and WASM SIMD. Measure matrix-level error, layer hidden states, logits,
   top-k rank, greedy tokens, fixed-random-draw sampled tokens, perplexity on
   license-safe corpora, and untouched conversational cases.
10. Define task-quality regression budgets and statistics. Include ordinary
    chat, ambiguity, practical constraints, source conflict, latest-turn
    precedence, untrusted quoted instructions, summaries, JSON, code
    explanation, and lawful adult questions. Address paired comparisons,
    stochastic seeds, confidence intervals, multiple comparisons, correlated
    failures, and human review. Do not train on the holdouts.
11. Define performance methodology without invented numbers. Include cold and
    warm prefill, decode tokens/second, first-token latency, memory peak, WASM
    growth, CPU utilization, energy where measurable, browser responsiveness,
    scalar versus SIMD, alignment, thread counts, and formulas for arithmetic
    intensity and memory bandwidth.
12. Design hard correctness cases: zero scales, all-zero rows, maximum int8,
    outliers, NaNs in source, non-multiple dimensions, short final groups,
    unaligned buffers, integer overflow, huge declared dimensions, feature-
    detection mismatch, SIMD trap, and scalar/SIMD byte disagreement.
13. Define stop rules. Reject the profile when quality loss exceeds any hard
    gate, source/runtime parity cannot be explained, scalar and SIMD differ
    outside budget, browser memory is unsafe, reported acceleration depends on
    unavailable instructions, or licensing/provenance is ambiguous.
14. Provide layout diagrams, quantizer and kernel pseudocode, formulas, a
    benchmark manifest, an experiment matrix, and a staged implementation plan
    that starts with a trusted scalar oracle and earns each optimization.

Required report structure:

1. Executive quantization decision and assumptions.
2. TurboQuant/TurboVec primary-source findings.
3. Transferable and non-transferable techniques.
4. Q8 design comparison and selected profile.
5. Tensor-family precision matrix.
6. Deterministic quantizer specification.
7. SLM2 physical layout and kernel contracts.
8. Scalar/native SIMD/WASM SIMD implementation plan.
9. Numerical and behavioral quality methodology.
10. Performance methodology and resource formulas.
11. Adversarial correctness and fuzz matrix.
12. Stop rules and promotion evidence.
13. Staged implementation backlog.
14. Unknowns requiring local model/hardware execution.
15. Annotated primary-source bibliography with dates, revisions, and links.

Do not claim TinyRustLM currently uses TurboQuant or TurboVec, recommend 1-bit
marketing without a complete design, hide higher-precision tensors, compare
only file size, accept one benchmark as general quality, optimize before a
scalar oracle exists, or keep multiple layouts for compatibility.

## Prompt 8: Canonical ACG2 Composition Identity, Receipt DAG, And Provenance Closure

You are an independent principal evidence-systems architect, cryptographic
protocol designer, model supply-chain engineer, and canonical-serialization
specialist. Produce an exceptionally detailed implementation report defining
the identity and receipt graph for one complete TinyRustLM composition from
immutable public source through conversion, validation, browser admission, and
activation. The design must make every material claim independently
checkable, prevent artifact substitution, and invalidate only downstream work
when one input changes.

You may inspect primary standards and documentation for SHA-256, domain
separation, JSON Canonicalization Scheme, deterministic CBOR, in-toto, SLSA,
SPDX, CycloneDX, Sigstore concepts, Ed25519, Merkle DAGs, reproducible builds,
and software/model provenance. You cannot inspect private TinyRustLM schemas,
receipts, signing keys, model files, or CI. Propose implementable schemas but
label private values and local verification needs.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product with no requirement to read obsolete
  manifests or migrate legacy receipts. SLM2, ACG2, Tokenizer2, Template2,
  Sampling2, Prompt2, ABI identities, schema identities, and semver are exact
  technical contracts, not product releases called V2.
- One usable model is a complete composition containing exactly ACG2, SLM2,
  Tokenizer2, Template2, Sampling2, and Prompt2. No member may be swapped based
  on matching model name, family, source repo, or approximate compatibility.
- Source acquisition binds immutable model and tokenizer source locks. Rust is
  authoritative for conversion and canonical artifact validation. Native and
  browser proof must bind the same exact composition bytes.
- Evidence is create-only and content addressed. Rejected, obsolete, blocked,
  or superseded records remain available for audit. A changed evaluator reruns
  evaluation but does not require reacquiring unchanged multi-gigabyte source.
- Reports may contain public IDs, hashes, lengths, versions, timestamps,
  bounded status/error codes, and aggregate counts. They must exclude prompts,
  raw credentials, signed URLs, private model paths, private memory payloads,
  and tokens.
- Current campaign counters remain zero until real evidence exists. Unit tests,
  structural conversion, local loopback probes, or package creation do not
  increment production campaign counters. MemoryEndpoints is disconnected.

Research and specify all of the following in depth:

1. Define the full identity hierarchy: public source authority, repository,
   immutable revision, source file, model source lock, tokenizer source lock,
   conversion request, converter binary, converter profile, SLM2 artifact,
   Tokenizer2, Template2, Sampling2, Prompt2, ACG2 composition, runtime binary,
   browser bundle, evaluator, case set, raw output, decision, browser receipt,
   P2P piece set, peer proof, and release receipt.
2. Choose one canonical encoding strategy for each signed or hashed object.
   Compare JCS JSON and deterministic CBOR with Rust, .NET, JavaScript, browser,
   and human-audit needs. Define UTF-8, member ordering, integer limits, number
   policy, Unicode, duplicate keys, absent versus null, arrays, timestamps,
   URLs, and unknown fields. Avoid floating-point values in identities unless
   represented canonically.
3. Define cryptographic domain separation. Give exact conceptual hash
   envelopes for source locks, artifacts, composition, operations, receipts,
   piece sets, and decisions so bytes valid in one role cannot be substituted
   in another. Address hash algorithm agility without adding a speculative
   second path.
4. Specify the ACG2 manifest. Include exact member roles/names, lengths,
   SHA-256 values, source locks, architecture and quantization profile,
   tokenizer/template/sampling/prompt contracts, context and resource limits,
   runtime/ABI requirements, license decision, converter identity, validation
   receipt references, and canonical root calculation.
5. Define receipt schemas by phase: acquisition, source preflight, conversion,
   artifact validation, composition assembly, native conformance, browser
   conformance, quality qualification, browser dogfood, P2P preparation,
   outside proof, catalog announcement, package release, and site readback.
   Use explicit state/evidence fields rather than a lone boolean.
6. Build an invalidation DAG. For each input change state exactly which receipt
   families become obsolete and which remain reusable. Cover source bytes,
   source metadata, license decision, converter binary, conversion profile,
   quantization profile, tokenizer compiler, template compiler, sampling
   defaults, system prompt, runtime, WASM compiler, evaluator, test cases,
   browser build, peer manifest, proof observer, and site content.
7. Define signatures and trust roles. Distinguish content identity from
   publisher signature, converter attestation, release authorization, outside
   reachability proof, and catalog announcement. Address key IDs, rotation,
   expiry, revocation, threshold/quorum possibilities, clock skew, compromised
   keys, unsigned development evidence, and what the first release truly
   requires.
8. Define anti-confusion and anti-rollback rules. Prevent model-name aliasing,
   stale proof reuse, lower-quality artifact substitution, cross-environment
   receipt replay, member swapping, same bytes relabeled as distinct models,
   mutable URL authority, and current-pointer rollback to a revoked
   composition.
9. Specify filesystem persistence for bounded receipts and streaming hashes for
   large artifacts. Cover create-only names, same-directory atomic writes,
   fsync/Flush(true), immutable history, current indexes as derived data,
   bounded JSON, checksum sidecars if justified, archive retention, and
   corruption recovery.
10. Define redaction and secret-scanning rules. Include exact forbidden field
    classes and detection of credentials in URLs, HTTP headers, logs,
    screenshots, traces, UTF-8/UTF-16 data, base64, compressed archives, and
    error messages. Explain false positives from hashes and how suppression is
    auditable.
11. Design independent verification algorithms for Rust, .NET, and browser
    JavaScript without creating multiple semantic authorities. Clarify which
    layer parses and checks receipt structure, which calls canonical Rust
    artifact validation, and how browser admission verifies hashes and exact
    composition membership.
12. Provide example fake schemas and a receipt graph for one model. Trace a
    change to Sampling2, an evaluator update, a revoked peer proof, and a
    documentation-only correction to demonstrate narrow invalidation.
13. Design conformance, fuzz, and adversarial tests for canonicalization,
    duplicate keys, Unicode variants, integer boundaries, unknown fields,
    member reordering, signature confusion, stale receipts, graph cycles,
    missing nodes, malicious paths, and multi-gigabyte streamed hashing.
14. Define an operator query/dashboard model that derives status from current
    valid receipts and never stores completion as an unaudited mutable flag.
    Include blocked, rejected, obsolete, current, externally blocked, and
    complete states.

Required report structure:

1. Executive identity/provenance recommendation.
2. Entity and trust-role taxonomy.
3. Canonical encoding and domain separation.
4. ACG2 schema and root identity.
5. Versioned receipt schema family.
6. Receipt DAG and invalidation matrix.
7. Signature, expiry, rotation, and revocation rules.
8. Anti-confusion and rollback protections.
9. Durable persistence and independent verification.
10. Privacy/redaction and secret-scanning contract.
11. Worked fake evidence graph and change scenarios.
12. Adversarial/fuzz/conformance test matrix.
13. Operator status derivation and implementation backlog.
14. Unknowns requiring local or authorized verification.
15. Annotated primary-source bibliography with dates and direct links.

Do not propose mutable evidence overwrite, a lone `passed` field, hashless
aliases, approximate composition compatibility, one signature serving every
trust role, opaque provenance bundles, prompt-bearing public receipts, or
campaign progress from mocks and unit tests.

## Prompt 9: Streaming Companion-To-Browser Composition Transfer And Atomic Durable Store

You are an independent principal browser-storage engineer, streaming-protocol
designer, web-worker architect, and crash-consistency researcher. Produce an
exceptionally detailed report specifying how a private TinyRustLM companion
transfers one verified complete composition into a browser and how the browser
stores, verifies, atomically activates, reopens, and deletes it without whole-
model buffering or split-brain state.

You may inspect current primary documentation and browser implementations for
Fetch streams, ReadableStream, BYOB readers, Web Workers, WebAssembly,
IndexedDB, Origin Private File System, File System Access, storage quotas,
eviction, persistence, structured clone, transferable streams, Web Locks,
BroadcastChannel, service workers, Cache Storage, and browser lifecycle. You
cannot inspect TinyRustLM code, browser profiles, traces, model files, or
private test output. Clearly distinguish standards from browser-specific
behavior requiring experiments.

Product context and fixed constraints:

- TinyRustLM.com is a public HTTPS browser-local chat interface. Model bytes
  arrive directly from a user-owned loopback companion after P2P acquisition
  or local conversion; the public website must never receive or proxy them.
- One usable model is an exact ACG2 composition containing SLM2, Tokenizer2,
  Template2, Sampling2, and Prompt2. Browser activation is all-or-nothing.
- The browser must verify exact content identities and technical contract
  identities. A successful download, filename, MIME type, source model name,
  or weight-file hash alone is insufficient.
- The target model may be hundreds of megabytes or larger. The browser must
  avoid full-file JavaScript strings, base64, duplicate ArrayBuffers, response
  cloning, and any hidden copy that makes memory use unsafe.
- There is one clean storage and activation path. No localStorage model data,
  legacy IndexedDB schema, fallback text files, alternate cache, migration
  reader, or dual active-model pointer is required prelaunch.
- Prompt text remains local. MemoryEndpoints is unauthorized and disconnected.

Research and specify all of the following in depth:

1. Compare OPFS, IndexedDB blobs/chunks, File System Access handles, Cache
   Storage, and memory-only storage for large immutable model compositions.
   Evaluate support, durability, eviction, quota, streaming writes, random
   reads, worker access, atomicity, privacy, mobile behavior, and automated
   testing. Choose one first production design and one explicit unsupported
   behavior rather than silently falling back.
2. Define browser-side store ownership and schema. Include origin binding,
   store schema identity, owned root/directory, staging operation ID,
   composition root, six member records, exact lengths/hashes, chunk or file
   representation, immutable receipts, active pointer, quarantine, and derived
   indexes.
3. Specify the companion transfer protocol as seen by the browser. Include
   authenticated content-addressed URLs or selected transport, manifest-first
   validation, exact content length, byte-range or fixed-piece semantics,
   streaming hashes, backpressure, cancellation, timeouts, reconnect,
   resumption, and denial of arbitrary paths.
4. Produce a browser memory-copy budget. Trace bytes through network stack,
   Fetch, stream chunks, hash implementation, storage API, worker messages,
   WASM memory, SLM2 mapping/loading, KV cache, and UI. Provide formulas and
   identify APIs that may force copies. Do not invent local measurements.
5. Design incremental hashing. Compare WebCrypto limitations, incremental
   SHA-256 in WASM/Rust, JavaScript libraries, worker placement, and hardware
   acceleration. Define test vectors, chunk boundaries, cancellation, final
   digest comparison, and how the hash implementation itself is versioned and
   trusted.
6. Specify a create-only transfer journal. Bind expected composition, member,
   byte range or piece, received length, hash state or verified piece hash,
   storage commit, companion operation, and sequence. Define resume validation
   after tab close, browser crash, OS restart, quota error, and companion
   restart.
7. Design atomic composition activation. Include complete member re-read,
   ACG2 root verification, runtime contract admission, browser/WASM capability
   check, transaction ordering, active-pointer replacement, multi-tab lock,
   BroadcastChannel notification, rollback on failure, and proof that no tab
   can observe a half-active composition.
8. Define worker architecture. Separate UI, acquisition coordinator, storage
   worker, hash/validation WASM, and inference worker only where boundaries add
   real safety. Address module loading, worker termination, transferables,
   shared memory prerequisites, COOP/COEP, CSP, event sequencing, exception
   propagation, and exactly one authority for model state.
9. Analyze quotas and eviction. Cover `navigator.storage.estimate()`, persistent
   storage requests, preflight disk budget, browser-specific quota heuristics,
   private browsing, mobile eviction, storage pressure, site-data clearing,
   orphan staging, and truthful UI when durability cannot be guaranteed.
10. Define deletion and cleanup. Cover inactive composition removal,
    cancellation cleanup, corrupt/quarantined bytes, active model replacement,
    locked handles, multiple tabs, interrupted deletion, post-delete proof,
    and prohibition on recursive deletion outside the owned browser store.
11. Define service-worker and cache boundaries. Prevent model responses,
    capabilities, prompts, or operation events from entering Cache Storage,
    offline asset caches, navigation preload, analytics, error reporting, or
    stale service-worker interception.
12. Design browser compatibility and test evidence. At minimum cover real
    Chromium for the first registered proof, plus researched Firefox/WebKit
    behavior. Include desktop and memory-constrained profiles, clean browser
    contexts, process restart, profile deletion, quota failure, duplicate tab,
    stream interruption, corrupt bytes, stale active pointer, and secret scans.
13. Define privacy-safe receipts: browser build, origin, composition hash,
    member hashes/lengths, storage schema, hash/runtime versions, timestamps,
    durations, quota observations, deletion result, and bounded errors. Exclude
    prompts, raw model bytes, capabilities, private paths, and user secrets.
14. Provide detailed schemas, transaction diagrams, transfer/store/activate
    pseudocode, memory formulas, fault-state tables, and a TDD implementation
    backlog.

Required report structure:

1. Executive storage/transfer decision and assumptions.
2. Browser API compatibility matrix with dated sources.
3. Store ownership and schema.
4. Streaming transfer and backpressure protocol.
5. Browser memory-copy budget.
6. Incremental hashing and verification.
7. Create-only transfer journal and resume algorithm.
8. Atomic activation and multi-tab consistency.
9. Worker, service-worker, and cache boundaries.
10. Quota, eviction, deletion, and cleanup behavior.
11. Browser fault/adversarial test matrix.
12. Privacy-safe receipt design.
13. TDD backlog and acceptance criteria.
14. Unknowns requiring real-browser experiments.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend base64 model transfer, whole-response `arrayBuffer()` for
large artifacts without a proven budget, localStorage, service-worker model
caching, activation before all six members verify, a silent storage fallback,
mutable overwrite, or a filename as model identity.

## Prompt 10: Exactly-Once Browser Acquisition UX, Conversation Ownership, And Cancellation

You are an independent principal browser-application architect, AI interaction
reliability engineer, state-machine designer, and accessibility specialist.
Produce an exceptionally detailed implementation report for the complete
TinyRustLM browser workflow from selecting a model through acquiring or
converting it, atomically activating it, and conducting genuine multi-turn
local chat. The user must never be asked to understand or manually run a text,
JSON, PowerShell, shell, or conversion-request file.

You may inspect current primary documentation for browser events, workers,
streams, AbortController, page lifecycle, accessibility, IndexedDB/OPFS,
Playwright, service workers, Web Locks, BroadcastChannel, and resilient UI
state machines. You cannot inspect TinyRustLM source code, screenshots,
design files, browser traces, or private tests. Preserve the stated approved
interaction principles without inventing the current UI.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product. There is no launched V1, no product V2,
  no need for a legacy model picker, old companion route, script-download flow,
  compatibility banner, alternate runtime, or migration UX.
- TinyRustLM.com is the actual browser-local chat interface, not a landing
  page. Model bytes and prompts stay local or move directly between consenting
  peers and the user-owned companion; project sites do not receive them.
- A single user action on a candidate model first requests an exact verified
  P2P composition. If no eligible peer can provide it and the user has
  explicitly approved reviewed source acquisition, the same operation begins
  local source download and deterministic conversion.
- Durable operation states are authoritative. UI events and progress messages
  may be duplicated, delayed, lost, or replayed. The UI must derive one
  truthful current state without causing duplicate work.
- A model becomes usable only after exact ACG2, SLM2, Tokenizer2, Template2,
  Sampling2, and Prompt2 bytes are verified and atomically activated.
- Introductory prompt cards disappear after chat begins, the center becomes the
  conversation workspace, the composer remains usable, and each assistant
  answer renders exactly once. The approved visual language must not be
  casually redesigned as part of functional work.
- MemoryEndpoints is unauthorized and disconnected. Do not simulate remote
  memory continuity.

Research and specify all of the following in depth:

1. Define the end-to-end UI state machine. Include companion unavailable,
   candidate review, source approval required, operation queued, checking
   peers, fetching peer, verifying peer, acquiring source, converting,
   verifying composition, transferring to browser, activating, available,
   cancelled, rejected, blocked, and retry-as-new-operation. Map every durable
   state to allowed commands and truthful user-visible status.
2. Define one-command semantics. Address pointer, keyboard, touch, double-click,
   repeated Enter, browser form submission, stale tab, network response replay,
   page reload, back/forward cache, multiple tabs, and companion reconnect.
   Prove that duplicate UI events cannot create duplicate logical operations.
3. Specify model-source review and consent without instruction downloads.
   Present public repo, immutable revision, expected source size or honest
   unknown, license status, local disk/RAM estimate, P2P status, and conversion
   consequence. Separate consent to inspect catalog metadata from consent to
   download source bytes.
4. Define progress presentation from immutable operation events. Cover phase,
   verified bytes, total known/unknown, rate smoothing, elapsed time, no false
   ETA, converter subphases, browser transfer, activation, event sequence gaps,
   stalled state, companion restart, and terminal readback. The UI must not say
   `ready` from process completion alone.
5. Define cancellation UX and semantics. Address which phases are immediately
   cancellable, commit critical sections, cancellation pending, child process
   termination, partial download cleanup, immutable cancelled receipt,
   browser-transfer abort, generation cancellation, and starting a new
   operation explicitly.
6. Define error disclosure. Map typed errors such as no peer, source approval
   absent, source drift, license blocked, insufficient disk, unsupported
   architecture, converter failure, integrity mismatch, browser quota failure,
   WASM incompatibility, and companion unavailable to actionable messages
   without leaking paths, URLs with secrets, headers, or raw internal output.
7. Design browser application ownership. Choose authoritative modules for model
   catalog state, companion session, operation state, durable browser store,
   active composition, inference worker, conversation state, and rendering.
   Prevent two event paths from appending one assistant answer twice.
8. Define generation state as an explicit transaction: user turn accepted,
   prompt composed by exact Prompt2/Template2, prefill, token stream, partial
   rendering, completion, cancellation, runtime error, raw output preservation,
   and final message commit. Distinguish token display from authoritative
   transcript storage.
9. Specify multi-turn ownership and invalidation. Bind conversation to exact
   composition, Template2, Sampling2, Prompt2, context/KV state, generation
   parameters, and turn sequence. Define behavior on model switch, settings
   change, context limit, cancelled turn, failed generation, page reload, and
   stale KV cache.
10. Define exactly-once rendering assertions. Cover unique generation IDs,
    token sequence numbers, duplicated worker messages, late events after
    cancellation, DOM reconciliation, markdown rendering, code blocks,
    repeated final events, assistive technology announcements, and raw output
    preservation for evaluation.
11. Specify responsive and accessible behavior at desktop, narrow desktop, and
    mobile widths. Include keyboard order, focus restoration, accessible names,
    live regions, reduced motion, long model names, long progress details,
    composer stability, scrolling during streamed output, errors, cancellation,
    and no overlapping controls.
12. Define privacy/network assertions. Permit public static assets and catalog
    metadata plus authenticated loopback companion traffic and direct peers.
    Fail on prompt uploads, public model-byte requests, implicit telemetry,
    credentials in URLs, unexpected third parties, service-worker capture, or
    model content in logs/traces/screenshots.
13. Design a Playwright campaign for this workflow using fresh owned profiles.
    Include companion absent/present, P2P success, P2P exhaustion then approved
    source conversion, cancellation at each phase, browser restart, duplicate
    event injection, corrupt composition, quota failure, genuine multi-turn
    chat, profile deletion proof, and no fake assistant text.
14. Provide UI/state/event schemas, reducer pseudocode, generation transaction
    pseudocode, sequence diagrams, accessibility acceptance criteria, failure
    matrices, and a staged TDD backlog.

Required report structure:

1. Executive browser architecture and assumptions.
2. End-to-end durable/UI state model.
3. One-command idempotency and multi-tab behavior.
4. Review, consent, and source-approval UX.
5. Progress, cancellation, and error semantics.
6. Browser module ownership and event contracts.
7. Atomic model activation and conversation binding.
8. Exactly-once generation/rendering transaction.
9. Responsive and accessibility requirements.
10. Privacy and network contract.
11. Playwright/fault-injection test campaign.
12. Implementation pseudocode and TDD backlog.
13. Unknowns requiring local UI/runtime inspection.
14. Annotated primary-source bibliography with dates and direct links.

Do not recommend instruction-file downloads, simulated conversion, fake model
text, mutable best-of-N answer replacement, generic `Something went wrong`,
duplicate rendering paths, optimistic `ready` status, silent fallback to a
different model, or redesigning the interface to avoid state correctness.

## Prompt 11: Source-Framework, Rust-Native, And Real-Chromium Conformance And Fault Laboratory

You are an independent principal ML conformance engineer, numerical-validation
scientist, browser test architect, and chaos/fault-injection specialist.
Produce an exceptionally detailed report defining an independent laboratory
that proves one exact TinyRustLM composition behaves correctly from immutable
publisher source through Rust conversion, native execution, browser WASM
execution, storage restart, and real multi-turn chat. The laboratory must
preserve raw evidence and distinguish numerical divergence, evaluator defects,
infrastructure flakes, and product failures.

You may inspect official Qwen/Transformers sources, PyTorch reproducibility
guidance, safetensors, numerical-testing literature, WebAssembly, Chromium,
Playwright, property-based testing, differential testing, and statistical
evaluation research. You cannot inspect TinyRustLM private code, models,
outputs, evaluators, receipts, browser artifacts, or hidden cases. Do not claim
that any gate has run or passed.

Product context and fixed constraints:

- The first target is one reviewed dense Qwen3 approximately 0.6B source model
  converted to a complete mixed-Q8 composition containing exact ACG2, SLM2,
  Tokenizer2, Template2, Sampling2, and Prompt2 artifacts.
- Rust native and Rust-compiled browser WASM share one semantic runtime. The
  pinned public source framework is an external oracle for source behavior,
  but its version, config, tokenizer, template, sampling inputs, hardware, and
  numerical settings must be fully bound.
- Conversion, structural validation, unit tests, or one token match are not
  conversational-quality proof. Browser proof must use real composition bytes
  and untouched model output, not fixtures or simulated assistant text.
- Output repair, expected-term injection, answer completion, best-of-N
  selection, hand-edited transcripts, hidden retries, and training on sealed
  holdouts are forbidden.
- One prelaunch product means failures may drive clean rewrites; no legacy test
  exemptions, known-failure allowlists, weakened tolerances, or alternate old
  runtime may be introduced.
- Accepted evidence is content-addressed and create-only. Production campaign
  counters remain zero until separately authorized real gates complete.
  MemoryEndpoints is disconnected.

Research and specify all of the following in depth:

1. Define the conformance identity bundle. Bind source repo/revision/files,
   source framework and dependencies, tokenizer, chat template, generation
   configuration, source hardware/dtype, converter, composition, native
   runtime, WASM binary, browser build, test vectors, evaluator, seeds, random
   draws, raw outputs, and decision receipts.
2. Design source-oracle extraction without repository-code execution. Explain
   how a separately reviewed environment can run the official architecture
   implementation, load safetensors only, pin dependencies, disable network,
   capture tensors/logits, and avoid allowing custom code to become authority.
3. Define layerwise numerical vectors. Include tokenizer IDs, embeddings,
   per-layer normalized states, q/k/v projections, RoPE results, attention
   scores/probabilities, attention output, MLP intermediates, residuals, final
   hidden state, logits, top-k, and KV cache before/after decode. Address data
   volume and select vectors deterministically.
4. Set observable-specific tolerances. Distinguish exact integer/token IDs,
   float reference variance, mixed-Q8 expected error, scalar versus SIMD,
   native versus WASM, absolute/relative/ULP measures, cosine similarity,
   top-k overlap, rank changes, greedy identity, and sampled identity under
   fixed random draws. Define who may change a tolerance and what invalidates.
5. Design prefill/decode and KV tests. Compare full-sequence logits to
   incremental decode, chunked prefill, cache reuse, conversation continuation,
   context truncation, cancellation, model switch, Prompt2/Template2 change,
   browser restart, and cache reset. Detect stale cache that yields plausible
   but wrong text.
6. Define deterministic sampling conformance. Bind PRNG algorithm/state,
   temperature, top-k, top-p, repetition penalty, logits processing order,
   tie-breaking, non-finite handling, zero-probability fallback, token history,
   and random draws. Compare native and WASM token-by-token without retry.
7. Design behavioral qualification that tests ordinary chat, ambiguity,
   practical planning, conflicting authorities, latest-user preference,
   untrusted quoted/memory instructions, summaries, rewrites, structured JSON,
   extraction, code explanation, and lawful adult inquiry. Use untouched raw
   outputs, unseen paraphrases, positive-helpfulness budgets, and human review.
8. Define metamorphic tests. Vary names, entities, units, dates, percentages,
   authority order, sentence order, explicit and implicit negation, resource
   availability, discourse style, distractors, and quoted malicious
   instructions. State which outputs/verdicts should remain invariant and
   which semantic changes must alter behavior.
9. Define stochastic statistics. Address fixed product sampling profile,
   preregistered seed sets, per-case pass probability, confidence intervals,
   correlated cases, multiple comparisons, infrastructure retries versus model
   retries, browser nondeterminism, and prohibition on choosing an easy seed.
10. Build a fault-injection matrix spanning corrupt source shard, source drift,
    converter crash, disk-full, partial composition, wrong member hash,
    companion restart, peer loss, malformed event, browser stream abort, quota
    exhaustion, OPFS/IndexedDB failure, stale service worker, WASM trap,
    generation timeout, duplicate response event, locked profile, browser
    crash, and power loss. State expected durable evidence and next legal state.
11. Define clean-browser proof. Use an owned fresh persistent profile, actual
    companion transfer, real model bytes, atomic activation, two-to-six-turn
    chat, exactly-once rendering, raw-output capture, network allowlist,
    storage/secret scan, process closure, profile deletion with retries, and
    deletion proof. Distinguish reload, context reset, process restart, and
    profile deletion.
12. Define failure preservation and TDD. Archive the raw failure, minimize it
    without changing semantics, write a generic regression plus positive and
    counterexample tests, make a scoped clean fix, version the affected tool,
    rerun only invalidated phases, and retain obsolete prior decisions.
13. Define independent human review and evaluator audit. Address blinded
    source-versus-SLM2 comparison, rater instructions, adjudication,
    inter-rater agreement, false positives/negatives, judge-model limits,
    contamination controls, challenge suites, and remaining uncertainty.
14. Provide a complete evidence directory/schema, test manifest, orchestration
    state diagram, comparison algorithms, fault hooks, promotion matrix, stop
    rules, and phased laboratory backlog.

Required report structure:

1. Executive conformance strategy and assumptions.
2. Bound identity bundle and independent source oracle.
3. Layerwise numerical vector specification.
4. Observable-specific tolerance registry.
5. Prefill/decode/KV/sampling parity tests.
6. Behavioral, metamorphic, and statistical evaluation.
7. Full fault-injection matrix.
8. Real-Chromium clean-profile proof protocol.
9. Raw evidence, privacy, and receipt schemas.
10. Failure-to-regression TDD workflow.
11. Independent human/evaluator audit.
12. Promotion, rejection, and stop rules.
13. Staged laboratory implementation plan.
14. Unknowns requiring local model/browser execution.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend one global epsilon, one attractive transcript, hidden retries,
best-of-N, fixture bytes as real-model proof, keyword-only evaluation,
post-processing incorrect output, localStorage clearing as profile deletion, or
changing a test after seeing which wording lets a preferred model pass.

## Prompt 12: Private Companion Distribution, Three-RID Release Gates, And First-Model Publication Control Plane

You are an independent principal release engineer, desktop-distribution
architect, software-supply-chain specialist, and production evidence lead.
Produce an exceptionally detailed implementation report for packaging,
installing, verifying, operating, and publishing the private TinyRustLM
companion and the first complete model path on `win-x64`, `linux-x64`, and
`linux-arm64`. The report must define objective gates from source through
public site readback without pretending that package creation, cross-
compilation, local probes, or stale documentation are deployment success.

You may inspect current official .NET, Rust, NuGet, Windows service/task,
systemd user service, code-signing, Authenticode, ELF, PE, SBOM, SLSA, Sigstore,
SPDX, CycloneDX, SourceLink, portable PDB, archive, malware scanning, GitHub
Actions, and web-deployment documentation. You cannot inspect TinyRustLM
repositories, CI, signing keys, artifacts, servers, DNS, package feeds, model
files, or deployment accounts. Do not claim anything is built, signed,
published, reachable, or live.

Product context and fixed constraints:

- TinyRustLM is one prelaunch product. There is no launched V1, no product V2,
  no customer migration population, and no permission to preserve obsolete
  companion executables, public seed-host packages, old installers, aliases,
  forwarding launchers, dual services, deprecated routes, or technical debt.
- SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, ABI/schema identities,
  semantic versions, release numbers, and dates remain necessary exact
  technical/release identities. They are not product generations.
- The private companion is the sole operational desktop host for direct P2P
  acquisition and deterministic local conversion. It may consume public
  TinyRustLM SDK packages, but the companion itself and its converter do not
  need to become public NuGet SDK packages.
- The companion distribution must contain only the exact required runtime,
  P2P, conversion, and control components for its RID. It must not discover or
  execute a sibling third-party project, search arbitrary PATH entries,
  download executable code on demand, or depend on a developer checkout.
- The browser remains the chat UI. Selecting a model must result in verified
  P2P acquisition or approved source conversion, not a text/script/request
  download.
- A release-worthy model is an exact complete ACG2 composition containing
  SLM2, Tokenizer2, Template2, Sampling2, and Prompt2 and bound to quality,
  native, browser, and provenance evidence.
- Real `linux-arm64` execution evidence requires real ARM64 hardware. Cross-
  compilation and binary-header inspection are useful but may not be called
  executed ARM64 proof.
- All documentation and marketing sites must carry accurate current version,
  release date, last-published date, update log, support status, and evidence-
  bounded claims. Current campaign counters remain zero until real authorized
  receipts exist. MemoryEndpoints remains disconnected.

Research and specify all of the following in depth:

1. Define the clean component graph. Separate public SDK libraries/packages,
   native runtime assets, private companion application, canonical Rust
   converter, optional development symbols, model artifacts, browser assets,
   documentation sites, catalog metadata, and release evidence. State which
   components may reference which others and prohibit dependency cycles or
   private host leakage into public SDK APIs.
2. Select one private companion distribution form per RID, such as a self-
   contained archive plus explicit installer/service registration. Analyze
   .NET self-contained/single-file behavior, native extraction, Rust binary
   placement, file permissions, symlinks, executable discovery, uninstall,
   user-level operation, and deterministic manifest verification. Choose one
   approach rather than shipping several for compatibility.
3. Define exact archive layout and installation manifest. Bind every file path,
   role, length, SHA-256, executable bit, RID, architecture, package/runtime
   version, source commit, build provenance, signature, and companion protocol
   identity. Defend against absolute paths, traversal, case collisions,
   symlinks/reparse points, duplicate entries, compression bombs, extra files,
   and wrong-RID native assets.
4. Specify executable discovery and launch. The browser or launcher must find
   one installed companion deterministically, authenticate it, and never use
   current directory, broad PATH search, sibling repository probing, registry
   ambiguity, or download-on-demand execution. Address per-user sessions,
   port collision, startup timeout, crash restart, and explicit unavailable
   status.
5. Design Windows and Linux user-level supervision. Compare Windows scheduled
   task/service/tray/startup mechanisms and systemd user services. Specify
   install, start, readiness, stop, drain, restart, crash loop, logs, resource
   limits, upgrades during prelaunch, uninstall, and proof that only one
   authority owns configured endpoints.
6. Define the three-RID build matrix. Cover pinned Rust/.NET/Node toolchains,
   locked dependencies, source commit, reproducibility, native ABI symbols,
   PE/ELF header checks, runtime identifiers, dynamic dependencies, minimum OS
   policy, portable PDB, symbols, SBOM, license notices, and archive hashes.
7. Separate evidence levels for each RID: successful cross-compilation,
   static binary inspection, emulated smoke, clean-machine execution, package
   consumer execution, companion launch, converter execution, real-model
   conversion, native inference, browser loopback operation, and real hardware
   proof. Define the minimum evidence required before each RID can be offered.
8. Design supply-chain and signing controls. Include protected build inputs,
   pinned actions, dependency allowlists, `Cargo.lock`, NuGet lock/metadata,
   SourceLink, SBOM, provenance attestations, code signing, key custody,
   signature verification, malware-scanning boundaries, secret scanning,
   artifact retention, release authorization, rollback, and incident
   revocation.
9. Define one create-only release transaction. Cover clean-source verification,
   tests, builds, package/archives, hashes, signatures, isolated consumers,
   real RID execution, browser tests, model qualification, documentation
   generation, staging publication, HTTPS readback, catalog announcement, and
   final receipt. Failure cannot overwrite prior release evidence or become a
   skip.
10. Build the full gate matrix for Rust unit/integration/fuzz tests, C ABI,
    .NET SDK packages, private companion, converter, three-RID archives,
    browser WASM, browser acquisition UI, one real model, direct P2P, public
    sites, and MiniModel metadata. State which gates are local, CI, clean-
    machine, real-hardware, or authorized external operations.
11. Define site/documentation freshness as a release gate. Every related site
    must show purpose, current version, release date, last publication date,
    update log, support/prelaunch status, accurate installation workflow,
    privacy boundary, and evidence-qualified claims. Specify automated cross-
    site consistency, broken-link, stale-version, release-log, HTTPS readback,
    and claim-integrity checks.
12. Define truthful status and blocker taxonomy. Include companion unavailable,
    converter incomplete, unsupported architecture, model quality failure,
    license ambiguity, missing RID hardware, unsigned archive, package failure,
    browser failure, absent outside peer proof, catalog rejection, deployment
    mismatch, stale documentation, secret exposure, and rollback in progress.
    State what work may continue behind each blocker.
13. Define the first-model acceptance control plane. Require immutable source
    and license receipt, deterministic complete composition, native/WASM parity,
    untouched quality output, real clean-browser chat, deletion-backed receipt,
    verified direct P2P path where claimed, exact public metadata, archive and
    package verification, public HTTPS readback, and an explicit remaining-risk
    section. Do not increment unrelated 20/50/25/40/20 campaign counters.
14. Provide configuration schemas, archive examples with fake hashes, release
    DAG/state diagrams, RID evidence matrix, installer/supervisor pseudocode,
    dashboard layout, rollback runbook, and a prioritized implementation plan
    with independent checkpoints that can be committed whenever they build.

Required report structure:

1. Executive release/distribution decision and assumptions.
2. Clean component and dependency graph.
3. Private companion archive/install design.
4. Deterministic discovery and user-level supervision.
5. Three-RID build and evidence matrix.
6. Supply-chain, SBOM, provenance, and signing controls.
7. Create-only release transaction and resume behavior.
8. Test/release gate matrix by component and RID.
9. First-real-model acceptance control plane.
10. Site/documentation freshness and update-log contract.
11. Blocker taxonomy and parallel work paths.
12. Publication, readback, rollback, and incident runbooks.
13. Prioritized checkpointed implementation plan.
14. Unknowns requiring local, real-hardware, or authorized access.
15. Annotated primary-source bibliography with dates and direct links.

Do not recommend public companion packages merely because they are easy to
ship, sibling-project executable discovery, broad PATH fallback, multiple
install modes retained for compatibility, cross-compilation labeled as real
ARM64 execution, package creation labeled publication, unit tests labeled
model quality, stale site claims, hidden blockers, or legacy support in a
prelaunch product.

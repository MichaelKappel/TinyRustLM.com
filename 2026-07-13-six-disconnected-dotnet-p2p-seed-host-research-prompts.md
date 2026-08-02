# Six Disconnected Research Prompts: Downloadable TinyRustLM P2P Companion

Each section below is a complete standalone prompt. Send each prompt to a
different research agent. The agents have internet access but no access to the
local source repositories, desktop application, unpublished artifacts, private
credentials, internal MemoryEndpoints rooms, or development environment.

## Prompt 1: Cross-Platform Rust Native ABI, NuGet, And Self-Contained Release Engineering

You are an independent principal release engineer researching a production
distribution architecture for the downloadable TinyRustLM P2P companion. You
have internet access, but you do not have access to the private/local source
tree, build machine, unpublished NuGet packages, native binaries, test output,
or operator credentials. Do not claim that you inspected or executed anything
that is not publicly accessible.

Public product boundaries to preserve:

- TinyRustLM.com is the browser AI chat interface.
- MiniModel.org is the public model catalog and P2P discovery authority.
- The downloadable application is an operational companion for validating,
  importing, storing, and serving `.slm` model pieces. It is not a second chat
  application.
- Rust remains authoritative for `.slm`, MiniModel manifest, artifact, piece,
  Merkle, companion-state, announcement, import, assembly, and receipt rules.
- C# exposes typed orchestration through a narrow C ABI and may run the reviewed
  Rust MiniModel server executable for independent seed lanes.
- Planned NuGet IDs are `UAIX.Browser.p2pRuntime.SeedHost` and
  `UAIX.Browser.p2pRuntime.SeedHost.Tool`. The tool command is
  `uaix-p2p-seed`.
- Required downloadable RIDs are `win-x64`, `linux-x64`, and `linux-arm64`.
- The application must run without a Rust compiler, C compiler, Python, Node,
  or source checkout.

Research the strongest current, production-grade way to package this system.
Use current primary sources wherever possible: official .NET, NuGet, Rust,
Cargo, GitHub Actions, SPDX, SLSA, Sigstore, Microsoft SBOM Tool, Windows, and
Linux documentation. Record source publication/update dates and retrieval
dates. Treat blog posts as secondary evidence and label them accordingly.

Analyze all of the following in technical depth:

1. Design a stable Rust C ABI for synchronous validation plus potentially long
   preparation/import operations. Cover ABI version negotiation, UTF-8 JSON
   envelopes, maximum request/response sizes, ownership of returned buffers,
   allocator symmetry, null pointers, invalid UTF-8, panic containment, error
   codes, progress reporting, cooperative cancellation, thread safety, and ABI
   compatibility across releases. Compare callback-based cancellation,
   explicit native operation handles, polling, and subprocess isolation. Give a
   recommendation with failure semantics.
2. Explain the exact NuGet layout for native libraries and the MiniModel server
   executable under `runtimes/<rid>/native`. Cover library packages, .NET tool
   packages, transitive native asset selection, project-reference behavior,
   build/publish conflicts, `CopyToOutputDirectory`, runtime identifier graph
   behavior, and wrong-architecture diagnostics. Explain how to prevent assets
   for several Linux architectures from flattening to the same publish path.
3. Compare framework-dependent .NET tools with self-contained application
   archives. Analyze apphost behavior, trimming hazards, single-file extraction
   hazards, NativeLibrary resolution, executable permissions in tar archives,
   Windows Mark-of-the-Web considerations, Linux glibc compatibility, musl
   compatibility, ARM64 build and execution verification, and minimum supported
   OS baselines. Recommend whether trimming or single-file publishing should be
   used for the first release and justify the answer.
4. Specify deterministic, isolated Cargo build directories per RID so Windows,
   WSL/Linux, x64, and ARM64 artifacts cannot contaminate one another. Cover
   pinned Rust versions, `Cargo.lock`, target triples, linker provenance,
   reproducible build limitations, dirty source trees, native binary hashes,
   and source-revision receipts.
5. Specify release supply-chain controls: package signing, NuGet repository
   metadata, SourceLink in portable PDBs, `.snupkg`, exact dependency bounds,
   package content allowlists, secret scanning, malware scanning boundaries,
   archive traversal checks, SHA-256 manifests, SPDX SBOM generation and
   validation, SLSA provenance, and release retention. Explain what can be
   performed locally without production signing credentials and what must wait
   for an authorized publication job.
6. Design a CI matrix that builds and executes native smoke tests on Windows
   x64, Linux x64, and real or emulated Linux ARM64. Include native ABI loading,
   `doctor`, `init`, `inspect`, installed NuGet tool execution, clean consumer
   restore, missing-library tests, wrong-RID tests, archive extraction tests,
   and package metadata checks. Distinguish a cross-compiled file-header check
   from real execution evidence.

Required report structure:

1. Executive recommendation, no more than two pages.
2. Assumptions and publicly observable product facts.
3. Recommended ABI contract with lifecycle and cancellation state diagrams.
4. Exact package and archive layouts in tree form.
5. Build and release pipeline with concrete commands and environment inputs.
6. RID compatibility matrix, including glibc/musl and ARM64 concerns.
7. Supply-chain threat model and mitigations.
8. CI and release acceptance matrix with expected evidence for every gate.
9. Failure modes and operator-facing diagnostics.
10. A prioritized implementation backlog split into first release, next
    hardening release, and optional future work.
11. Open questions that require local source inspection or execution.
12. Annotated bibliography containing direct links to authoritative sources.

Do not invent current package contents, test counts, deployed versions, or
native compatibility. Do not recommend duplicating Rust validation rules in
C#. Do not recommend shipping private conversion, quantization, training,
ranking, optimizer, telemetry-backend, license-server, or key-management logic.

## Prompt 2: Two-Lane Direct P2P Seed Fleet, Reachability Proof, And Network Security

You are an independent distributed-systems and network-security researcher.
Prepare a production architecture report for the TinyRustLM/MiniModel direct
P2P seed host. You can browse public websites and standards, but you cannot
access local repositories, private infrastructure, unpublished packages,
router settings, logs, credentials, or test machines. Clearly separate public
observations, standards-backed conclusions, and recommendations that require
local validation.

System constraints:

- TinyRustLM.com remains the browser chat UI; the downloadable companion hosts
  and imports model pieces.
- MiniModel.org is the catalog/discovery surface, not a model-byte proxy.
- Model bytes must flow directly between consenting user-run peers.
- Project websites must not host, run, or proxy model bytes.
- One fleet supports up to 20 distinct admitted model identities.
- Every admitted model has exactly two independently restartable process lanes,
  not two listeners in one process.
- Both lanes reference the same read-only artifact and piece store. The model
  must not be duplicated per lane.
- Each lane serves a status document, companion state, piece-set metadata, and
  an exact allowlist of fixed-name piece files over direct HTTP.
- Public announcements are forbidden until an outside-network observer proves
  both endpoints reachable and returns a signed, expiring, identity-bound
  receipt.
- Loopback, LAN, same-host hairpin, and browser-local tests are local health,
  never public reachability.
- No optional relay is needed for the first slice; direct CORS has already been
  established as the intended production path.

Research and provide detailed engineering recommendations for:

1. A lane process architecture that pre-binds every configured listener before
   serving, fails atomically on a port collision, exits if any endpoint thread
   dies, supports graceful shutdown, and permits one lane to fail while the
   other remains available. Analyze socket ownership, dual-stack IPv4/IPv6,
   `SO_REUSEADDR` differences, listen backlog, connection limits, slow clients,
   request timeouts, graceful drain, and restart backoff.
2. A strict HTTP serving profile. Cover GET, narrowly scoped OPTIONS/CORS,
   rejection of POST/PUT/DELETE/TRACE, bounded headers, duplicate or conflicting
   `Content-Length`, chunked requests, request smuggling, percent-encoded path
   traversal, query strings, directory listing, MIME types, range requests,
   deterministic connection close, symlink/reparse-point defense, and
   read-only file operation. Recommend which HTTP features should be omitted in
   version 0 for a smaller attack surface.
3. Bandwidth and resource scheduling for as many as 20 models and two lanes.
   Address per-peer and global concurrency, fairness, upload bandwidth caps,
   disk read amplification, OS page cache, file-descriptor limits, piece size,
   backpressure, denial-of-service resistance, hot/cold model prioritization,
   and metrics that remain useful without a proprietary telemetry backend.
4. NAT and firewall reality for home and small-office hosts. Compare manual
   port forwarding, UPnP/NAT-PMP/PCP, IPv6, reverse proxies, operator-approved
   tunnels, carrier-grade NAT, and double NAT. Recommend a first-release policy
   that never silently modifies a router or firewall. Define accurate UI and
   CLI status labels for configured, listener-bound, locally reachable,
   externally reachable, announcement eligible, advertised, stale, revoked,
   and failed.
5. The outside-network proof protocol. Define a canonical signed receipt bound
   to fleet ID, lane ID, model ID, normalized public URL, artifact SHA-256,
   piece-set SHA-256, checked routes, response identities, observer key ID,
   implementation version, issued time, observation time, expiry, and nonce or
   receipt ID. Analyze Ed25519 canonicalization, clock skew, key rotation,
   revocation, replay, single-use consumption, receipt drift, downgrade attacks,
   observer compromise, and multi-observer quorum as future work.
6. Announcement creation, revocation, and stale-state handling. Explain how
   startup revalidation, URL rotation, model removal, endpoint revocation,
   expired proof, and a failed lane affect catalog eligibility. Provide a
   fail-closed state machine that cannot leave a stale endpoint advertised.
7. An end-to-end network test strategy. Include deterministic local fixture
   tests, real 925 MiB model tests, port collision, partial lane failure,
   malformed HTTP fuzzing, slowloris behavior, NAT lab tests, and separately
   authorized outside-network tests. CI must not require an inbound production
   port and must never publish fixture announcements to the live catalog.

Required report structure:

1. Scope, assumptions, and non-goals.
2. Process and socket architecture diagrams.
3. HTTP protocol profile with an allow/deny table.
4. Fleet resource and bandwidth model with quantitative examples.
5. Reachability taxonomy and operator workflow.
6. Canonical external-proof schema and signature procedure.
7. Announcement/revocation state machine.
8. Threat model covering remote peers, malicious metadata, compromised
   observers, and local unprivileged users.
9. Verification plan with unit, integration, fuzz, fault-injection, and live
   deployment tests.
10. Prioritized recommendations and explicit tradeoffs.
11. Questions that cannot be answered without local evidence.
12. Current, directly linked primary sources with dates.

Do not describe loopback as public proof. Do not recommend a project-site byte
fallback, Hugging Face proxy, fake peer-health response, or one process with two
URLs as equivalent to two independent lanes.

## Prompt 3: Crash-Safe Resumable Multi-Peer Import And End-To-End Content Verification

You are an independent storage, download-protocol, and reliability engineer.
Research a rigorous resumable import design for TinyRustLM/MiniModel `.slm`
models. You have public internet access only. You cannot inspect the private
implementation, local files, test results, unpublished schemas, or runtime
artifacts. State every assumption and never claim local behavior was tested.

System requirements to honor:

- The same MiniModel manifest, piece-set, piece hashes, Merkle root, companion
  state, import request, preflight, and final receipt must be understood by Rust,
  browser, and .NET clients.
- Rust is the sole authority for manifest, piece, Merkle, `.slm`, assembly, and
  receipt validation. C# coordinates but does not reimplement trust rules.
- A representative first production artifact is approximately 925 MiB and has
  roughly 925 fixed-size pieces. Tiny fixtures are test-only.
- Imports must resume after process termination, browser/application restart,
  network loss, and power loss.
- Two peers may be used only after their complete content identities match.
- Credentials must never be persisted in resume state, paths, logs, receipts,
  or peer URLs.
- No partially assembled artifact may become visible to the runtime.

Research and specify:

1. The exact trust and fetch order: validate local import request, fetch bounded
   peer status, fetch and validate piece-set metadata, fetch and validate
   companion state, bind all identities to the selected manifest, schedule
   pieces, verify every piece, assemble a temporary artifact, verify complete
   `.slm` structure and checksums, atomically promote, write and revalidate a
   receipt, then expose the model. Explain why changing the order creates
   attacks or corruption risks.
2. A durable resume journal or state machine. Cover stable import ID,
   idempotency, manifest identity, expected artifact and piece-set hashes,
   per-piece states, retry counters, peer observations, timestamps, versioning,
   checksums/MAC considerations, fsync boundaries, write-ahead behavior,
   atomic replacement, torn writes, schema migration, and rejection of state
   copied from another import. Resume data must contain no credentials.
3. Staging layout and path safety on Windows and Linux. Address canonical root
   containment, path traversal, case-insensitive collisions, reserved Windows
   names, alternate data streams, symlinks, junctions, reparse points, hard
   links, sparse files, temporary names, file sharing modes, antivirus races,
   read-only final stores, and cleanup after cancellation.
4. Piece scheduling across one or two lanes. Analyze bounded concurrency,
   work stealing, peer scoring based only on current transport evidence,
   deterministic final identity, duplicate fetch suppression, retry and
   exponential backoff, corrupt-piece quarantine, peer failover, bandwidth
   limits, memory bounds, and prevention of mixing incompatible manifests.
   Include quantitative examples for a 925 MiB artifact on slow, asymmetric,
   and lossy links.
5. HTTP client hardening. Cover DNS rebinding, redirects, URL user-info,
   loopback/private-network policy differences for local versus remote use,
   header/body limits, content length, chunked responses, decompression bombs,
   read timeouts, total deadlines, cancellation, connection pooling, TLS
   expectations, and deterministic error categories.
6. Final artifact verification. Describe verification of byte count, SHA-256,
   MiniModel binding, `.slm` format version, directory/config checksum,
   tokenizer checksum, tensor-layout checksum, quantization support, finite
   numerical configuration, runtime compatibility, and receipt-chain binding.
   Explain what can be streamed and what requires random access or a complete
   artifact.
7. Crash and fault injection. Include termination after every durable state
   transition, disk full, permission loss, hash mismatch, one-byte corruption,
   truncated piece, duplicate response, stale metadata, peer identity drift,
   cancellation during assembly, cancellation after final verification but
   before receipt, and restart after atomic rename.

Required report deliverables:

1. An explicit import state machine with allowed transitions and terminal
   states.
2. A proposed versioned resume-state schema with field constraints and secret
   exclusions.
3. A staging directory tree and ownership rules.
4. Pseudocode for the orchestrator that delegates every trust decision to Rust.
5. A concurrency, retry, and resource-budget model.
6. Cross-platform atomicity and fsync analysis.
7. Security analysis and attacker capabilities.
8. A fault-injection matrix with exact expected post-restart outcomes.
9. Performance measurements that should be collected locally, without
   inventing values.
10. A prioritized implementation and test plan.
11. Unknowns requiring local schema or code inspection.
12. An annotated bibliography using current primary sources.

Do not propose trusting a piece because it exists on disk, marking a piece
complete before its Rust hash check, silently repairing a final `.slm`, or
using last-write-wins when peer identities disagree.

## Prompt 4: Production Service Lifecycle, Resource Governance, And Operator Runbooks

You are an independent Windows/Linux service reliability engineer. Produce a
deep technical report for operating the downloadable TinyRustLM P2P seed host
continuously on ordinary user-controlled computers. You may inspect public
websites and official platform documentation. You cannot access local source,
machines, service definitions, logs, unpublished packages, or credentials.
Clearly label every proposal that requires local confirmation.

Product facts and constraints:

- The downloadable companion hosts MiniModel `.slm` pieces; TinyRustLM.com is
  still the chat interface.
- A fleet contains exactly two independently restartable lane processes and up
  to 20 distinct admitted models.
- Each lane must validate and pre-bind all configured endpoints before serving.
- Both lanes share read-only model and piece files but have distinct process,
  endpoint, runtime-state, and shutdown identities.
- Windows may use a least-privilege Scheduled Task initially or a reviewed
  Windows Service. Linux uses systemd, preferably user units unless a system
  service is explicitly chosen.
- Install/uninstall must be idempotent. Uninstall stops and removes only owned
  definitions and retains models by default.
- The companion must never persist credentials in fleet configuration or logs,
  grant remote control by default, or bypass LocalEndpoint Connect approval
  controls.

Research all of these areas:

1. Compare Windows Scheduled Task and Windows Service hosting for this workload.
   Cover startup at logon versus boot, account identity, least privilege,
   service recovery, session isolation, graceful shutdown, task XML security,
   quoting, executable replacement, working directory, network readiness,
   firewall prompts, code signing, update rights, and user-visible controls.
   Recommend the first production mode and criteria for adding the other.
2. Design hardened systemd user and optional system units. Analyze
   `Restart=on-failure`, restart limits/backoff, network-online ordering,
   `NoNewPrivileges`, `ProtectSystem`, `ProtectHome`, `PrivateTmp`,
   `ReadOnlyPaths`, narrow `ReadWritePaths`, capability removal, file-descriptor
   limits, memory/CPU/IO controls, environment handling, `StateDirectory`,
   `RuntimeDirectory`, log retention, and lingering user services.
3. Specify deterministic install, start, stop, restart, status, and uninstall
   behavior for two lanes. Include ownership markers, stable service names,
   safe quoting, atomic definition replacement, partial-install rollback,
   missing-definition behavior, repeated calls, race prevention, and proof that
   unrelated services or files cannot be deleted.
4. Define process supervision and readiness. Cover PID identity, child-process
   ownership, inherited handles, pre-bind readiness, health versus readiness,
   startup revalidation, bounded startup time, long verification progress,
   graceful listener drain, forced termination deadlines, exit codes, crash
   loops, and preserving availability of the second lane.
5. Plan resource governance for one through 20 models. Include storage budget,
   piece-store accounting, no per-lane duplication, disk reserve, log budget,
   process memory, file descriptors, upload bandwidth, CPU spent hashing,
   startup revalidation cost, caching, compaction, stale data, and safe explicit
   purge. Give formulas and example sizing, clearly marked as estimates.
6. Define bounded, privacy-preserving diagnostics. Recommend structured event
   schemas, rotation, retention, redaction, URI user-info removal, secret-like
   field denial, correlation IDs, per-lane status, import progress, native error
   preservation, crash evidence, and operator export. Do not assume a remote
   telemetry backend.
7. Design upgrade and rollback. Cover side-by-side version staging, package
   hash checks, stopping only the updated lane, configuration compatibility,
   native ABI compatibility, rollback after failed readiness, preserving model
   bytes, revoking stale announcements, and avoiding both lanes going offline
   simultaneously.
8. Produce operator runbooks for first install, adding the first model,
   configuring ports, verifying local health, obtaining outside proof,
   installing services, rotating URLs, responding to disk pressure, handling a
   failed lane, revoking a model, updating binaries, uninstalling, and explicit
   data purge.

Required report structure:

1. Recommended lifecycle architecture.
2. Windows mode comparison and recommended task/service definition.
3. Hardened systemd unit template and rationale.
4. Install/control state machine with idempotency rules.
5. Readiness and restart model.
6. Resource-budget formulas and a 1/5/20-model capacity table.
7. Logging, redaction, and retention contract.
8. Upgrade/rollback procedure.
9. Failure-mode and recovery matrix.
10. Detailed operator runbooks.
11. Automated test plan for Windows and Linux.
12. Local facts still needed.
13. Direct links to current official platform sources with dates.

Do not assume administrator/root privileges, automatically modify router or
firewall state, delete models on uninstall, or treat a generated service file
as proof that the service was successfully installed and executed.

## Prompt 5: Model Admission, Provenance, Licensing, Quality Claims, And Catalog Trust

You are an independent AI artifact provenance, open-source licensing, and
software supply-chain researcher. Produce a technically rigorous model
admission and catalog-trust report for TinyRustLM/MiniModel. You can browse
public model cards, repositories, websites, standards, and papers. You cannot
access local `.slm` files, private conversion tooling, unpublished manifests,
evaluation transcripts, local receipts, signing keys, or internal catalog
administration. Never infer local evidence that you cannot inspect.

Boundaries and known claim policy:

- `.slm` parsing and runtime compatibility are public capabilities, while
  conversion authoring, quantization authoring, training, ranking, optimizer,
  premium routing, and key-management internals remain private.
- MiniModel manifests bind one model ID to an exact artifact byte count,
  artifact SHA-256, `.slm` checksums, fixed pieces, piece-list hash, Merkle root,
  source metadata, quality evidence, and peer metadata.
- A trained model must capture source model ID, immutable source revision,
  source license ID and exact license text hash, modification notice and hash,
  conversation evidence and hash, quality-evaluation evidence and hash, quality
  tier, and known limitation.
- The first useful target is `Qwen/Qwen2.5-1.5B-Instruct` converted to q4 at
  approximately 925 MiB.
- Its allowed public boundary is conversation-proven with full assistant
  quality still pending. It must not be upgraded to a full-assistant claim
  without stronger evidence.
- The 8.6 KiB deterministic fixture is runtime-smoke-only and must never be
  presented as conversational.
- A model is not announcement eligible until both seed endpoints have current
  outside-network proof.

Research and recommend:

1. A complete chain of custody from upstream model repository to locally
   downloaded source, reviewed conversion input, `.slm` output, MiniModel
   manifest, piece set, local serve/import round-trip receipt, external
   reachability receipts, and catalog announcement. Identify every identity,
   hash, signature, timestamp, and human assertion. Separate reproducible facts
   from publisher claims.
2. Immutable source revision requirements for Hugging Face and Git hosting.
   Explain why branch names, `main`, tags that can move, URLs without commit
   hashes, and model-card display names are insufficient. Address Git LFS,
   safetensors shard indexes, upstream file hashes, tokenizer/config files,
   license changes, gated models, and upstream deletion.
3. Licensing and notice handling. Research the current upstream Qwen2.5 1.5B
   Instruct license and repository metadata from primary sources. Do not give
   legal advice; identify obligations and questions for counsel. Recommend
   exact retention of license text, SPDX identifiers where accurate,
   modification notice content, attribution, redistribution boundaries, and
   handling of ambiguous/custom licenses.
4. Quality-tier semantics. Define evidence required for runtime-smoke-only,
   structural-validation-only, conversation-proven, task-specific-proven, and
   full-assistant-quality. Address raw generation preservation, deterministic
   seeds, prompt-suite versioning, no-cheat checks, fixture memorization,
   truncation, JSON repair, conversational coherence, common-sense reasoning,
   code/text tasks, math as a calculator-assisted tool rather than the primary
   benchmark, and cognitive-liberty policy without making unsupported safety
   claims.
5. Evidence minimization and privacy. Explain how to publish a bounded quality
   summary that binds to private/raw evaluation evidence by hash without
   leaking local paths, private prompts, model weights, credentials, or
   proprietary evaluation logic. Specify what must remain auditable for a
   claim to be credible.
6. Manifest and catalog signing. Compare Ed25519 signed envelopes, in-toto
   attestations, TUF role separation, Sigstore keyless signing, offline release
   keys, delegated publisher keys, key rotation, revocation, threshold signing,
   and transparency logs. Recommend a practical first version plus an upgrade
   path.
7. Catalog lifecycle. Define admission, pending, active, stale, revoked,
   superseded, removed, and quarantined states. Explain how source correction,
   quality downgrade, expired reachability, compromised key, artifact mismatch,
   and license concern affect peers that already possess pieces.
8. Adversarial validation and testing. Cover unknown JSON fields, duplicate
   keys, Unicode confusables, path escape, oversized evidence, symlinks,
   checksum drift, claim-tier mismatch, source revision drift, forged receipts,
   replay, rollback, equivocation, and malicious catalog snapshots.

Required report structure:

1. Publicly verified facts and explicit unknowns.
2. End-to-end provenance graph.
3. Recommended versioned manifest/evidence fields and validation rules.
4. Qwen source and licensing research with direct primary-source links.
5. Quality-tier rubric and promotion gates.
6. Evidence-publication and privacy policy.
7. Signing, delegation, and revocation architecture.
8. Catalog lifecycle state machine.
9. Threat model and malformed-input corpus.
10. Test and audit plan.
11. Prioritized implementation recommendations.
12. Questions requiring local evidence or legal review.
13. Annotated bibliography with source dates and retrieval dates.

Do not claim that a model is production quality based on parameter count,
download popularity, structural validity, or one successful prompt. Do not
recommend publishing premium model weights or private conversion/training
logic. Do not silently weaken claims to make a catalog look larger.

## Prompt 6: Web Chat Plus Desktop Companion UX, Local Bridge Security, And End-To-End Workflow

You are an independent senior product architect, browser-security engineer, and
AI-tool UX researcher. Prepare a detailed report for integrating a downloadable
TinyRustLM P2P companion with the existing public web products. You may inspect
TinyRustLM.com, MiniModel.org, UAIX.org, public NuGet pages, and authoritative
browser/platform documentation. You have no access to local source code,
unpublished builds, browser automation artifacts, internal designs, private
APIs, or credentials. Report exactly which public pages and viewport states you
observed, when you observed them, and what was inaccessible.

Locked product direction:

- TinyRustLM.com remains the polished AI chat interface. Preserve its overall
  visual language and do not turn the desktop companion into a competing chat
  application.
- The desktop/downloadable companion handles P2P networking, model validation,
  imports, local model storage, two-lane seed hosting, service lifecycle, and a
  local authenticated bridge for the web UI.
- MiniModel.org should make the shared P2P model catalog the main content of its
  home page, including model description, source model, size, quality boundary,
  and actual peer availability.
- TinyRustLM.com must distinguish browser-local inference, a locally installed
  companion, and unavailable/remote states honestly.
- Once a user starts chatting, the center column should prioritize conversation
  history and the composer. Introductory prompt cards should disappear. A model
  response must render exactly once.
- Model actions should use plain outcomes. With P2P enabled, use wording similar
  to `Convert model for P2P`; without it, use wording similar to `Convert model
  only for me`, with a clear later-change path.
- Local health and outside-network reachability are separate. The UI must never
  show a peer as public based only on loopback.

Research and design the complete functionality and interaction model:

1. Map the user journeys for: first public website visit; browser-only chat;
   installing the companion; connecting an existing companion; importing a
   local `.slm`; finding a MiniModel catalog model; converting privately versus
   preparing for P2P; downloading from peers; loading into chat; enabling two
   seed lanes; verifying local health; obtaining outside proof; publishing an
   announcement; stopping/revoking sharing; changing browsers; upgrading; and
   uninstalling while retaining models.
2. Define a secure loopback bridge. Cover bind address, unpredictable port
   versus fixed discovery port, HTTPS versus HTTP loopback, origin allowlists,
   CORS preflight, CSRF, DNS rebinding, Host validation, browser extension
   alternatives, one-time pairing, short-lived session capability, token
   storage, credential rotation, revocation, multiple browser profiles, private
   browsing, websocket/event-stream progress, request limits, and protection
   from arbitrary local web pages. The browser must not receive broad filesystem
   or service control by default.
3. Create a state model for browser-only, companion detected but unpaired,
   paired and ready, native mismatch, model absent, importing, resumable,
   validating, loaded, lane starting, locally reachable, outside proof needed,
   announcement eligible, advertised, stale, revoked, update required, and
   failed. Specify exact user-facing labels, primary actions, recoverable error
   messages, and technical detail disclosure.
4. Redesign only the interaction behavior of the TinyRustLM center column while
   preserving the existing look. Cover initial empty state, transition on first
   send, removal of introductory cards, full-height conversation history,
   single rendering path for streamed/final model output, composer anchoring,
   auto-scroll versus user scroll, generation cancellation, retry, copy,
   regenerate, long responses, loading progress, model switching, memory status,
   mobile layout, keyboard access, and no overlapping columns.
5. Design MiniModel.org catalog presentation around real shared models. Include
   search/filter/sort, peer count, currently reachable lanes, artifact size,
   source revision, license, quantization, quality tier, limitations, last
   verified time, stale/revoked state, manifest/receipt inspection, and clear
   separation of test fixtures from conversational models. Do not present
   metadata-only Hugging Face search results as downloadable `.slm` peers.
6. Define desktop companion UX scope. Recommend a compact operational dashboard
   or tray/status interface only if it materially improves install, fleet,
   service, ports, storage, updates, and diagnostics. It must be a thin client
   over the same typed library/service APIs, not a second state machine. Define
   when command-line-only is acceptable and when a GUI becomes necessary.
7. Address optional MemoryEndpoints integration without coupling it to model
   seeding. Explain how short- and long-term agent memory can remain an optional
   authenticated service while model bytes stay local/P2P. Keep enrollment
   credentials, P2P configuration, and browser pairing credentials separate.
8. Define usability, accessibility, security, and automated browser tests.
   Include narrow/wide desktop, mobile, keyboard-only, reduced motion, screen
   reader labels, long model names, offline/reconnect, companion restart,
   multiple tabs, duplicate-response prevention, import progress, canceled
   operations, stale proof, and malicious-origin bridge attempts.

Required report structure:

1. Public-site observation log with URLs, dates, viewports, and limitations.
2. Product responsibility map for TinyRustLM.com, MiniModel.org, and the
   companion.
3. End-to-end journey maps and state transitions.
4. Local bridge threat model and recommended protocol.
5. Center-column active-conversation specification.
6. MiniModel catalog information architecture.
7. Desktop companion command/dashboard scope.
8. Error, recovery, and support model.
9. Accessibility and responsive requirements.
10. Detailed browser, integration, and security test matrix.
11. Prioritized implementation plan with measurable acceptance criteria.
12. Facts requiring local code or application access.
13. Direct links to current authoritative sources and public observations.

Do not redesign the product as a marketing landing page, invent current peer
counts, claim the companion is installed when a browser probe fails, expose a
long-lived bearer token to page JavaScript, or solve duplicate responses by
hiding one of two still-active rendering paths.

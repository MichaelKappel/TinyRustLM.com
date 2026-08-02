# TinyRustLM .NET P2P Seed Host Intake Synthesis

## Purpose

This document reconciles twelve disconnected-agent reports with the actual
TinyRustLM seed-host goal and repository contracts. The reports arrived in six
paired lanes: release and ABI, network and reachability, resumable import,
service lifecycle, provenance and catalog trust, and web and companion UX.
Each pair is useful as cross-review, but neither report is implementation
authority by itself.

## Authority Order

When evidence conflicts, use this order:

1. The human-approved goal and product boundary.
2. Executed tests and checksum-bound local artifacts.
3. Reviewed Rust contracts for `.slm`, MiniModel metadata, pieces, Merkle roots, imports, receipts, and announcements.
4. Current C# public API and packaging source.
5. This corrected synthesis and its TDD plan.
6. External reports and public-site observations.

Rust remains authoritative for every trust decision. C# provides typed
orchestration and process lifecycle, but must not independently decide whether
a manifest, piece, assembled `.slm`, external proof, or announcement is valid.

## Product Contract

- TinyRustLM.com remains the browser AI chat interface.
- MiniModel.org is the public model catalog and discovery authority.
- The downloadable .NET companion validates, imports, stores, and directly serves model pieces. It is not a second chat product.
- A fleet has exactly two lane processes total, not forty processes. Each lane process has one configured endpoint for every admitted model, up to 20 model identities.
- Both lanes use the same read-only artifact and piece store while retaining distinct process, endpoint, proof, and shutdown identities.
- Project websites publish metadata and discovery state. They carry no model bytes and do not proxy model-byte traffic.
- External reachability must be proved by an outside observer before an endpoint is announcement eligible. Loopback, LAN, hairpin, and same-host checks are local health only.
- Credentials are not stored in fleet configuration, import journals, URLs, logs, receipts, or package content.

## Paired Findings

### 1. Release and ABI

Accepted from both reports:

- Keep a small, versioned C ABI with explicit ABI/capability negotiation.
- Use bounded UTF-8 JSON request and response envelopes, allocator symmetry, null checks, panic containment, stable error categories, and explicit wrong architecture diagnostics.
- Isolate Cargo output per RID and preserve source revision, target triple, compiler, linker, and native binary hashes.
- Place native assets under `runtimes/<rid>/native` for `win-x64`, `linux-x64`, and `linux-arm64`.
- Publish portable PDBs, SourceLink, `.snupkg`, deterministic package metadata, exact dependency bounds, content allowlists, checksums, and SBOM/provenance evidence.
- Distinguish a cross-compiled file-header inspection from execution on the target architecture.

Current design choice:

- Synchronous native metadata and validation calls stay in-process.
- Long import and serve operations remain isolated behind reviewed Rust subprocesses with process-level cancellation and bounded I/O. This avoids inventing native operation handles before they are needed.
- The first release keeps multi-file self-contained archives. Trimming and single-file extraction add risk without solving a first-release requirement.

Corrected or rejected:

- The reports' .NET 10 and `ToolPackageRuntimeIdentifiers` assumptions do not justify migrating the current `net8.0` implementation.
- `LibraryImport` may be evaluated later; the current tested `DllImport` resolver is not defective merely because a newer generator exists.
- Local builds cannot claim production signing, Sigstore identity, or SLSA provenance that has not actually been issued.
- The NuGet tool and the separate self-contained release archives are complementary outputs, not competing choices.

### 2. Network and Reachability

Accepted from both reports:

- Pre-bind every endpoint assigned to one lane before that lane serves anything. A collision fails that lane startup atomically.
- Use strict exact-name GET routes and narrowly scoped metadata OPTIONS/CORS. Reject arbitrary paths, queries, traversal, write methods, directory listing, and model-byte CORS.
- Bound headers, requests, concurrency, timeouts, and connection lifetime; reject ambiguous framing and malformed requests.
- Do not silently modify routers or firewalls. Status must distinguish configured, bound, locally healthy, externally reachable, announcement eligible, advertised, stale, and revoked.
- Bind every external receipt to fleet, lane, model, normalized URL, artifact and piece-set identities, checked routes, observer key, implementation version, time window, and a single-use receipt identifier.
- Expired, mismatched, replayed, or revoked proof fails closed.

Critical correction:

The two reports repeatedly interpret two lanes per model as up to 40 server
processes. That is not the goal. There are exactly two lane processes total,
and each process serves the complete admitted endpoint set. One lane may fail
without terminating the sibling process, but no aggregate catalog claim may
invent availability that has not been externally proved.

Deferred or rejected:

- DHT, STUN/TURN, relay, and automatic NAT traversal are not first-slice requirements.
- Fixed pieces make HTTP Range unnecessary for version 0.
- A project-site or Hugging Face byte proxy is forbidden.
- Loopback success cannot substitute for external reachability.

### 3. Resumable Import

Accepted from both reports:

1. Validate the local request through Rust.
2. Fetch bounded peer status, piece-set metadata, and companion state.
3. Bind every identity to the selected MiniModel manifest before scheduling bytes.
4. Fetch with bounded concurrency, verify every piece through Rust, and mark completion only after acceptance.
5. Assemble into hidden staging, verify the complete `.slm`, atomically promote it, write and revalidate the receipt, then expose the model.

Resume state needs a stable import ID, idempotency identity, schema version,
artifact and piece-set hashes, per-piece states, bounded retry evidence, peer
observations, atomic replacement, and no persisted credentials. Two peers can
be combined only when their complete content identity agrees. Cancellation may
retain already verified pieces for a later resume; it must not expose a partial
artifact.

Corrected or rejected:

- Reports invented exact `.slm` offsets and a wrong Qwen artifact size. The locally verified Qwen artifact is 969,648,576 bytes; format constants must come from Rust source.
- An ephemeral HMAC key cannot authenticate a journal after restart. Use a MAC only with a durable OS-protected key; otherwise use integrity checks plus complete Rust revalidation.
- A blanket TLS-only requirement conflicts with the current content-addressed known-peer HTTP contract. Transport policy may harden later without moving trust into C#.
- Existing Rust subprocess import and receipt reinspection are the baseline to extend, not code to replace speculatively.

### 4. Service Lifecycle

Accepted from both reports:

- Maintain two independently restartable process definitions with stable owned names and idempotent install, start, stop, status, restart, and uninstall.
- Retain model data by default on uninstall and require a separate explicit purge.
- Prefer least privilege. Linux user systemd is the first ordinary-user path; Windows may use a reviewed Scheduled Task initially or a reviewed Service when boot/session requirements demand it.
- Readiness follows successful validation and endpoint pre-bind. Health and readiness are distinct.
- Roll upgrades one lane at a time, verify readiness, and roll back without taking both lanes offline or deleting model data.
- Use bounded structured logs with URI user-info removal, secret-field denial, rotation, and per-lane correlation.

Corrected or rejected:

- Static piece serving does not allocate inference KV caches or logits. The reports' model-inference memory calculations are irrelevant to this companion.
- Example 32 MiB model budgets do not describe the verified 925 MiB production artifact.
- Generated Scheduled Task or systemd text is not execution proof.
- No service mode may bypass LocalEndpoint Connect approval or grant remote control by default.

### 5. Provenance and Catalog Trust

Accepted from both reports:

- Bind immutable upstream revision, exact source files, tokenizer/config, license text and hash, modification notice, `.slm` identity, piece list, Merkle root, local import/serve receipt, external reachability receipts, and announcement.
- Branch names, mutable tags, display names, and unpinned model-card URLs are insufficient source identity.
- Keep fixtures `runtime-smoke-only`. A structurally valid model is not conversational.
- The Qwen target remains `conversation-proven`, with full assistant quality pending. Popularity and parameter count cannot raise the claim.
- Preserve raw generation and no-cheat evaluation evidence. Published summaries may be bounded, but claims need reproducible evidence rather than an unreviewable private hash alone.
- Use signed versioned envelopes with key rotation and revocation. TUF, in-toto, Sigstore, and transparency may strengthen later releases after actual infrastructure exists.

Corrected or rejected:

- A catalog revocation stops recommendation, new announcement, and trusted redistribution; it is not automatically a kill switch for lawful locally held model use.
- Speculative upstream facts and dates require direct verification before package or catalog publication.
- Private conversion, training, quantization authoring, ranking, optimizer, telemetry backend, license-server, and key-management internals stay outside public packages.

### 6. Web and Companion UX

Accepted from both reports:

- Preserve the locked TinyRustLM visual language.
- After the first submitted message, introductory cards disappear, the center column becomes full conversation history, the composer remains anchored, and each generated response must render exactly once.
- MiniModel.org should lead with real shared `.slm` models, source identity, description, size, quantization, quality boundary, peer/lane availability, proof age, license, and stale/revoked state. Metadata-only Hugging Face rows are not P2P models.
- A future loopback bridge must bind loopback, validate Host and Origin, use one-time pairing and short-lived scoped capabilities, rotate/revoke credentials, and expose neither arbitrary files nor broad service control.
- Keep MemoryEndpoints optional and credential-separated. It stores agent memory, not model bytes.
- A companion dashboard, if added, is a thin operational client over the same APIs and state machine, not a second AI interface.

Corrected or rejected:

- A Service Worker or Web Worker is not a secret boundary against same-origin script compromise.
- Reports cannot invent fixed ports, a 128 MiB browser ceiling, DHT/WebRTC/TURN requirements, or companion-side inference.
- Conflicting point-in-time public-site observations are useful UX evidence only; they are not deployment authority.
- Duplicate output must be fixed at the producer/render state machine, not hidden with CSS while two writers remain active.

## Implementation Priorities

### First release

1. Finish deterministic package and self-contained archive production for three RIDs.
2. Prove clean consumer restore, tool install/execute, native load, `doctor`, `init`, `inspect`, and wrong-RID diagnostics.
3. Keep exactly two lane processes and validate complete endpoint-set equality for up to 20 models.
4. Prove strict serve routes, atomic lane pre-bind, sibling independence, and no byte proxy.
5. Prove Rust-owned import identity, receipt reinspection, cancellation, resume, and atomic final exposure.
6. Generate reviewed service definitions and ownership-safe install/uninstall behavior.
7. Preserve package boundary, SourceLink, symbols, checksums, metadata, and local feed history.

### Hardening release

- Durable versioned import journal with crash injection after every transition.
- Explicit global connection/bandwidth/resource scheduler across models.
- HTTP ambiguous-framing, slow-client, timeout, and malformed corpus hardening.
- Rolling binary update and rollback evidence on Windows and Linux.
- Signed external-proof and catalog-key rotation/revocation drills.

### Separate product slices

- Secure loopback browser pairing and scoped progress bridge.
- MiniModel homepage catalog interaction improvements.
- TinyRustLM active-conversation behavior repair while preserving visual lock.
- Optional companion dashboard.

## No-Cheat Boundary

There is no test weakening to make implementation appear complete. Tests may
not use fake peer health as external proof, duplicate C# trust rules, publish
fixture announcements, hide duplicate response writers, skip target execution
while claiming architecture support, or mutate package/feed history to make a
version pass. Failures remain evidence until the production path is corrected.

## Current Truth Boundary

This synthesis is a plan and decision record. It does not claim that release
archives have been signed, a live external observer has issued receipts, a
companion bridge exists, all service modes were installed on real hosts, or a
NuGet.org publication was authorized. Local publication is limited to the
configured filesystem feed until the human explicitly authorizes NuGet.org.

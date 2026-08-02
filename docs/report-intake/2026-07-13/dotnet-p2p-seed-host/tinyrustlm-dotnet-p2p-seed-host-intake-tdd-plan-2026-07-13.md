# TinyRustLM .NET P2P Seed Host Intake TDD Plan

## Goal

Deliver a production-ready downloadable UAIX .NET P2P companion that reuses
the authoritative Rust `.slm` and MiniModel contracts, packages cleanly for
three RIDs, runs exactly two fleet lane processes for up to 20 models, imports
and serves pieces safely, and never expands the public package into private
conversion or commercial internals.

Every production change starts with a failing test against the real boundary.
No expected value may be copied from the implementation under test, and no
test may be weakened after observing a failure.

## F0: Intake And Authority Lock

Tests first:

- `F0-001 report-count-and-pairing`: exactly twelve hashed reports, two in each of six lanes.
- `F0-002 byte-exact-preservation`: source and durable size/hash agree before source cleanup.
- `F0-003 disposition-completeness`: every report has exactly one ledger disposition and proof of use.
- `F0-004 hot-memory-routing`: all seven hot-memory files route to manifest, synthesis, TDD, and durable memory.
- `F0-005 lane-interpretation-lock`: documentation and fleet tests require exactly two lane processes, not forty processes.
- `F0-006 authority-lock`: Rust remains authoritative for trust; C# cannot independently admit bytes.
- `F0-007 no-test-weakening`: source scan and review reject fake proof, fixture publication, hidden duplicate output, or skipped target execution.

Exit gate: active source copies are removed only after all preservation and
routing checks pass.

## F1: ABI And Native Loading

Tests first:

- `F1-001 abi-version-query`: supported ABI and capability set is explicit and deterministic.
- `F1-002 bounded-json`: null pointer, invalid UTF-8, oversized request, oversized response, and unknown operation fail with stable errors.
- `F1-003 allocator-symmetry`: every returned native allocation is released by the matching native function, including error paths.
- `F1-004 panic-containment`: malformed input cannot unwind across the C ABI.
- `F1-005 concurrent-call-policy`: documented thread-safety behavior is exercised under parallel calls.
- `F1-006 native-resolution`: each supported RID loads only its own native binary.
- `F1-007 wrong-architecture`: an incompatible binary produces an actionable wrong architecture diagnostic with path and expected RID, but no secret environment dump.
- `F1-008 subprocess-cancellation`: long Rust operations terminate cooperatively, preserve valid resumable state, and leave no orphan process.

Exit gate: native validation and metadata calls work from a clean consumer on
Windows x64, Linux x64, and executed Linux ARM64 evidence.

## F2: NuGet, Tool, And Archive Packaging

Tests first:

- `F2-001 package-content-allowlist`: only public assemblies, docs, symbols, approved native files, and metadata ship.
- `F2-002 native-layout`: native libraries and MiniModel server assets appear under the correct `runtimes/<rid>/native` path without cross-architecture flattening.
- `F2-003 clean-consumer-restore`: a new project restores the package without repository-relative dependencies.
- `F2-004 tool-install-execute`: `uaix-p2p-seed doctor`, `init`, and `inspect` execute from an installed package.
- `F2-005 symbols-sourcelink`: portable PDB, `.snupkg`, SourceLink mapping, repository URL, commit metadata, and deterministic build settings validate.
- `F2-006 dependency-lock`: package dependency IDs and exact approved bounds are stable.
- `F2-007 self-contained-archives`: win-x64, linux-x64, and linux-arm64 archives run without Rust, C, Python, Node, or a source checkout.
- `F2-008 archive-permissions`: Linux executable modes survive archive extraction.
- `F2-009 repeated-build-receipt`: repeated release builds record source/native/archive hashes and explain any nondeterministic container bytes.
- `F2-010 feed-preservation`: publishing a new local version archives older owned packages without deleting or overwriting unrelated files or an incoming duplicate.

Exit gate: package verifier passes both before and after transactional promotion
to `E:\Source\WP\UAIX-Publish\DOTNET-NUGET`. NuGet.org remains untouched.

## F3: Fleet Configuration And Two Lanes

Tests first:

- `F3-001 exactly-two-lanes`: zero, one, three, or duplicate lane definitions fail.
- `F3-002 model-cap`: 1 through 20 distinct models pass; 21 or duplicate model identities fail.
- `F3-003 complete-endpoint-set`: each lane has exactly one endpoint for every admitted model and no extra endpoint.
- `F3-004 shared-read-only-store`: both lanes resolve the same artifact and piece identities without per-lane byte duplication.
- `F3-005 atomic-prebind`: any endpoint collision prevents that lane from serving any endpoint.
- `F3-006 sibling-independence`: one lane crash or restart does not terminate the other lane process.
- `F3-007 graceful-drain`: stop closes listeners, drains bounded active requests, and exits within deadline.
- `F3-008 secret-denial`: config rejects URI user-info and recognized credential fields.

Exit gate: a 20-model fixture proves two OS processes total and complete
endpoint coverage without copying model artifacts.

## F4: Strict Piece Serving

Tests first:

- `F4-001 exact-routes`: only status, companion state, piece-set metadata, and allowlisted fixed-name pieces are served.
- `F4-002 method-profile`: GET and approved metadata OPTIONS pass; POST, PUT, PATCH, DELETE, TRACE, and model-byte CORS fail.
- `F4-003 path-canonicalization`: encoded traversal, query strings, fragments, separators, case collision, symlink, junction, and reparse escape fail.
- `F4-004 framing`: conflicting/duplicate `Content-Length`, `Transfer-Encoding`, request body, oversized header, and malformed request line fail closed.
- `F4-005 bounded-clients`: slow headers, slow reads, excess connections, and cancellation cannot exhaust the fleet.
- `F4-006 deterministic-response`: identity, length, MIME type, and close behavior match the Rust contract.
- `F4-007 read-only-proof`: no served request mutates model or piece state.

Exit gate: deterministic fixtures, malformed corpus, fault injection, and the
real 969,648,576-byte artifact path pass without arbitrary file exposure.

## F5: External Reachability And Announcements

Tests first:

- `F5-001 local-is-not-public`: loopback, LAN, hairpin, and same-host checks never produce announcement eligibility.
- `F5-002 canonical-receipt`: receipt binds fleet/lane/model/URL, artifact and piece-set hashes, routes, responses, observer key/version, timestamps, expiry, and receipt ID.
- `F5-003 signature-and-time`: bad signature, unknown/revoked key, excessive clock skew, future issue time, or expired receipt fails.
- `F5-004 single-use-receipt`: first matching announcement preparation consumes the proof; replay or identity drift fails.
- `F5-005 startup-revalidation`: restart, URL rotation, model removal, hash drift, and proof expiry revoke eligibility.
- `F5-006 announcement-is-not-publication`: library/tool preparation never silently posts to a live catalog.
- `F5-007 fixture-denial`: runtime-smoke-only fixtures cannot produce a conversational public announcement.

Exit gate: separately authorized outside-network evidence proves both advertised
endpoints. CI itself opens no production inbound port and publishes nothing.

## F6: Resumable Multi-Peer Import

Tests first:

- `F6-001 trust-order`: request, status, piece set, companion state, identity binding, fetch, piece verify, assembly, full verify, promotion, and receipt occur in that order.
- `F6-002 identity-agreement`: two lanes are usable together only when complete identities match.
- `F6-003 piece-acceptance`: disk presence is insufficient; a piece becomes complete only after Rust verification.
- `F6-004 bounded-journal`: resume state is versioned, checksummed, size-bounded, identity-bound, and contains no persisted credentials.
- `F6-005 crash-grid`: terminate after every durable transition and verify the exact safe restart state.
- `F6-006 corruption-grid`: one-byte drift, truncation, stale metadata, duplicate response, peer drift, and hash mismatch quarantine the bad input without damaging accepted pieces.
- `F6-007 cancellation`: cancellation preserves accepted resumable pieces, removes unsafe temporary assembly state, and exposes no partial model.
- `F6-008 atomic-promotion`: runtime visibility begins only after complete Rust verification and receipt reinspection.
- `F6-009 path-defense`: traversal, reserved names, ADS, links, reparse points, case collision, and root escape fail on Windows and Linux.
- `F6-010 resource-bounds`: download concurrency, memory, disk reserve, retry/backoff, and total deadline are enforced for a 925-piece artifact.

Exit gate: process termination, restart, disk full, permission loss, and peer
failure tests all converge on either a verified final artifact or an explicit
resumable/terminal state.

## F7: Service Lifecycle

Tests first:

- `F7-001 definition-ownership`: install/update/uninstall touches only definitions carrying the expected ownership marker and stable fleet/lane identity.
- `F7-002 idempotent-control`: repeated install/start/stop/status/uninstall has deterministic outcomes.
- `F7-003 partial-install-rollback`: second-lane failure rolls back only newly owned definitions and leaves data intact.
- `F7-004 readiness`: ready is emitted only after validation and complete endpoint pre-bind.
- `F7-005 restart-budget`: crash loops are bounded and visible while the sibling lane remains available.
- `F7-006 least-privilege`: generated systemd/task/service definitions have reviewed paths, account assumptions, read-only model access, narrow writable state, and no embedded credentials.
- `F7-007 rolling-upgrade`: update one lane, verify it, then update the sibling; failure rolls back without stale announcement.
- `F7-008 uninstall-retains-data`: uninstall removes owned service state but keeps models unless explicit purge is separately confirmed.

Exit gate: generated-definition tests plus actual user-systemd and authorized
Windows-mode execution evidence pass on clean hosts.

## F8: Provenance, Claims, And Package Boundary

Tests first:

- `F8-001 immutable-source`: mutable branches/tags and incomplete source-file sets fail admission.
- `F8-002 license-notice-binding`: license ID/text hash and modification notice are present and content-bound.
- `F8-003 end-to-end-chain`: source, conversion output, `.slm`, piece set, Merkle root, import/serve receipt, proof, and announcement identities agree.
- `F8-004 quality-tier`: `runtime-smoke-only`, structural, `conversation-proven`, task-specific, and full-assistant claims require distinct evidence.
- `F8-005 qwen-boundary`: current target remains conversation-proven and cannot become full-assistant by popularity, size, or one prompt.
- `F8-006 cognitive-liberty-local-use`: catalog revocation prevents recommendation/redistribution without silently deleting or disabling lawful local bytes.
- `F8-007 public-api-allowlist`: no conversion authoring, quantization authoring, training, ranking, optimizer, premium routing, telemetry backend, license-server, or key-management internals ship.
- `F8-008 signed-envelope`: canonical signature, key rotation, revocation, rollback, replay, and equivocation fixtures fail closed.

Exit gate: package/catalog metadata makes only evidence-backed claims and public
surface inspection finds no proprietary implementation.

## F9: Web And Companion Integration Boundaries

This is a separate integration slice after the seed-host release, but its
contract is preserved now.

Tests first:

- `F9-001 responsibility-map`: TinyRustLM chat, MiniModel catalog, and companion operations remain separate.
- `F9-002 center-column-transition`: first send removes introductory cards and expands conversation history.
- `F9-003 single-render-path`: streamed/final output for one assistant turn must render exactly once.
- `F9-004 locked-visual-regression`: desktop/mobile layout, colors, typography, sidebars, and controls remain within approved baseline.
- `F9-005 loopback-origin-defense`: wrong Host, Origin, capability, pairing state, or DNS-rebinding attempt fails.
- `F9-006 scoped-bridge`: browser receives only approved operations and no broad filesystem/service control.
- `F9-007 separate-credentials`: pairing, P2P, and optional MemoryEndpoints credentials cannot substitute for one another.
- `F9-008 catalog-honesty`: metadata-only Hugging Face rows and runtime fixtures cannot appear as active shared models.
- `F9-009 no-byte-service`: TinyRustLM, MiniModel, UAIX, and MemoryEndpoints requests contain no model bytes.

## Release Acceptance

A release candidate is accepted only when:

1. All applicable F0-F8 tests pass without exclusions added after failure.
2. Native binaries execute on all three target RIDs; ARM64 evidence is execution, not only file inspection.
3. Package, `.snupkg`, SBOM, checksum, SourceLink, clean-consumer, tool, archive, and secret scans pass.
4. The two-lane/20-model contract passes in one fleet with two processes total.
5. No external proof or public announcement is fabricated.
6. Existing package history and unrelated feed files remain preserved.
7. NuGet.org publication remains explicitly human authorized and is not part of local pack success.

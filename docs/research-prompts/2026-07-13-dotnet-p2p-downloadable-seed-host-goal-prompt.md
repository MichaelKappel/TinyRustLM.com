# Goal Prompt: Downloadable UAIX .NET P2P Runtime And Seed Host

You are the principal engineer responsible for delivering a production-ready,
downloadable .NET version of the TinyRustLM and MiniModel P2P model-sharing
system. The .NET distribution must use the same `.slm` artifacts, content
identities, MiniModel manifests, peer-piece layout, receipts, announcements,
catalog entries, and trust rules as the Rust and browser products. It must
reuse the existing implementation wherever possible and must not create a
second protocol, a second model format, or a weaker validation path.

The result must be real, buildable, installable, tested code. Do not return a
design-only answer. Do not create pseudocode, placeholder services, fake peer
health, simulated downloads, canned test outcomes, or metadata that claims a
peer is public when only loopback or same-machine access was tested.

## Canonical Workspaces

Work only in these active repositories unless a packaging script must write to
the explicit local publication folder:

- TinyRustLM and the existing .NET/Rust SDK:
  `E:\Source\Rust\TinyRustLM.com`
- MiniModel catalog, manifest, peer-piece, peer-companion, and P2P CLI source:
  `E:\Source\Rust\MiniModel.org`
- Local NuGet publication folder:
  `E:\Source\WP\UAIX-Publish\DOTNET-NUGET`

`SLMComposer.com` is retired and deleted. Do not recreate it, refer to it as an
active source root, or silently skip tests when that old path is absent.

Read and obey each repository's `AGENTS.md`, `workspace.uai`, and `.uai`
instructions before editing. Preserve unrelated user changes and untracked
performance evidence. Never print, commit, package, or log credentials, API
keys, FTP details, signing secrets, private model data, or hidden prompt text.

## Product Objective

Build a downloadable .NET P2P product that lets a normal user or operator:

1. Install a NuGet library into an application.
2. Install a global or local .NET tool from NuGet.
3. Download a self-contained desktop/console seed-host release without first
   installing a Rust toolchain.
4. Validate and inspect `.slm` models through the existing Rust authority.
5. Import the same MiniModel manifests and peer pieces used by TinyRustLM.com.
6. Prepare a local model for sharing without uploading model bytes to a
   project website.
7. Run two independently restartable seed lanes for every admitted model.
8. Seed up to 20 distinct admitted models from one fleet configuration.
9. Check local health and externally observable reachability separately.
10. Export announcement and catalog metadata only after external verification.
11. Stop sharing immediately, revoke an endpoint, rotate public URLs, and
    remove a model without leaving stale advertised state.
12. Use the same package from C#, F#, PowerShell, CI, Windows services, Linux
    systemd services, and ordinary command-line automation.

The first useful seeded model is the existing conversation-proven
`Qwen/Qwen2.5-1.5B-Instruct` q4 `.slm`, approximately 925 MiB. Do not replace
it with the 8.6 KiB runtime fixture or a smaller model that failed the raw
conversation gate merely to improve download-size optics. The runtime fixture
may remain available for deterministic tests only and must be labeled as
non-conversational.

## Reuse Mandate

Before creating any new type or implementation, inventory and reuse these
existing assets:

- `E:\Source\Rust\MiniModel.org\crates\minimodel-core`
- `E:\Source\Rust\MiniModel.org\crates\minimodel`
- `E:\Source\Rust\TinyRustLM.com\rust\crates\tinyrustlm-native`
- `E:\Source\Rust\TinyRustLM.com\rust\crates\tinyrustlm-p2p`
- `E:\Source\Rust\TinyRustLM.com\rust\crates\tinyrustlm-slm`
- `E:\Source\Rust\TinyRustLM.com\rust\crates\tinyrustlm-runtime`
- `E:\Source\Rust\TinyRustLM.com\dotnet\src\TinyRustLM.Abstractions`
- `E:\Source\Rust\TinyRustLM.com\dotnet\src\TinyRustLM.Core`
- `E:\Source\Rust\TinyRustLM.com\dotnet\src\TinyRustLM.P2P`
- Existing native library resolution, JSON envelope, exception mapping,
  package metadata, SourceLink, symbols, pack, feed-audit, and consumer-smoke
  patterns under `dotnet/`, `eng/`, and `.github/workflows/`.

The MiniModel Rust implementation remains authoritative for:

- MiniModel manifest validation.
- `.slm` artifact hash and format binding.
- Fixed-size piece export and piece-set validation.
- Per-piece SHA-256 and Merkle-root verification.
- Peer companion state validation.
- Peer status documents and import preflight.
- Assembly and receipt production.
- Peer-source announcement and catalog binding.
- Rejection of project-server and Hugging Face model-byte hosts.
- Path traversal, unsafe route, malformed HTTP, and metadata-size defenses.

The TinyRustLM Rust implementation remains authoritative for `.slm` loading,
runtime compatibility, generation, diagnostics, and safe native ABI behavior.

Managed C# must orchestrate and expose typed APIs. It must not reimplement
cryptographic verification, `.slm` parsing, tensor validation, Merkle logic,
manifest trust rules, or model assembly with a second set of rules.

If an ABI surface is missing, add a narrow, documented Rust C ABI function and
wrap it in C#. Do not shell out for ordinary library calls when a stable native
ABI is appropriate. The installable tool may launch the reviewed Rust seed
server binary or use the native ABI for a blocking lane host, but all binaries
must come from the same pinned source revision and deterministic build.

## Required Distribution Outputs

Keep the .NET implementation in the existing TinyRustLM repository and add all
projects to `E:\Source\Rust\TinyRustLM.com\dotnet\TinyRustLM.sln`. Use this
source layout:

```text
E:\Source\Rust\TinyRustLM.com\dotnet\
  src\
    TinyRustLM.SeedHost\
  tools\
    TinyRustLM.SeedHost.Tool\
  apps\
    TinyRustLM.SeedHost.App\       # only when the management UI is implemented
  tests\
    TinyRustLM.SeedHost.Tests\
```

Do not create a separate top-level SeedHost repository. Keep the reusable
MiniModel Rust protocol implementation in
`E:\Source\Rust\MiniModel.org\crates\minimodel-core` and its CLI/native bridge
in that repository. Reference or package that authority from TinyRustLM rather
than copying its source into the .NET projects.

Produce all of the following:

### 1. Managed library package

Package ID:

`UAIX.Browser.p2pRuntime.SeedHost`

The library must expose stable APIs for:

- Fleet configuration creation and inspection.
- Add, remove, enable, and disable model operations.
- Lane start, stop, restart, and status.
- Local endpoint health probes.
- External probe receipt validation.
- Manifest, companion state, piece set, and peer status inspection.
- Import, resumable fetch, assembly, and receipt inspection.
- Announcement preparation after verified external reachability.
- Revocation and stale-announcement detection.
- Structured diagnostics and cancellation.
- Dependency injection registration and logging abstractions without forcing a
  particular application host.

The library must reference the existing branded packages rather than copying
their public APIs:

- `UAIX.Browser.Core.Abstractions`
- `UAIX.Browser.p2pRuntime.P2P`
- `UAIX.Browser.p2pLLM.Runtime` only where runtime loading is actually needed

Do not add conversion authoring to the seed-host package. Conversion remains a
separate controlled package and workflow.

### 2. Installable .NET tool package

Package ID:

`UAIX.Browser.p2pRuntime.SeedHost.Tool`

Tool command:

`uaix-p2p-seed`

Required commands:

- `uaix-p2p-seed init`
- `uaix-p2p-seed add-model`
- `uaix-p2p-seed remove-model`
- `uaix-p2p-seed inspect`
- `uaix-p2p-seed serve --lane <lane-id>`
- `uaix-p2p-seed start`
- `uaix-p2p-seed stop`
- `uaix-p2p-seed restart`
- `uaix-p2p-seed status`
- `uaix-p2p-seed probe-local`
- `uaix-p2p-seed verify-external-probe`
- `uaix-p2p-seed prepare-announcement`
- `uaix-p2p-seed import`
- `uaix-p2p-seed install-service`
- `uaix-p2p-seed uninstall-service`
- `uaix-p2p-seed doctor`

Every command must support a machine-readable JSON mode with stable schemas,
nonzero exit codes on failure, cancellation, bounded output, and redaction.

### 3. Downloadable application release

Publish self-contained release archives for at least:

- `win-x64`
- `linux-x64`
- `linux-arm64`

Add `osx-arm64` when the native build is verified, not merely cross-compiled.

The downloadable app may initially use the same command surface as the .NET
tool. If a management UI is included, it must be a thin client over the same
service and typed library APIs. The UI must not become a second state machine.

The app must run without a Rust SDK, C compiler, Python environment, Node.js,
or source checkout on the target machine.

### 4. Optional LocalEndpoint Connect integration

Provide a documented extension point or optional plugin that allows
LocalEndpoint Connect to install, configure, start, stop, and inspect the seed
host. This integration must use the same package and service APIs. It must not
grant remote control by default, persist credentials in configuration, or
bypass the local approval and risk-category controls of LocalEndpoint Connect.

## Package Version And Feed Rules

Use the source-declared next package version. Never overwrite an already
published NuGet version. At the time this goal was written, the branded UAIX
Browser packages in the local feed were version `0.1.8`, so the next real
milestone is expected to use `0.1.9` unless repository version authority has
advanced.

Pack `.nupkg` and `.snupkg` files into:

`E:\Source\WP\UAIX-Publish\DOTNET-NUGET`

Before packing a new branded release:

1. Preserve unrelated package families.
2. Move only older root-level `UAIX.Browser.*` release artifacts into the
   existing `Archive` folder according to the repository's archive policy.
3. Never delete the latest historical copy without a verified archive copy.
4. Produce a SHA-256 manifest containing the exact package and symbol set.
5. Produce a human-readable feed README with package IDs, version, purpose,
   install commands, target frameworks, RIDs, and security boundary.
6. Verify every package's nuspec, dependency graph, repository metadata,
   license, README, icon if used, symbols, and content paths.
7. Run clean-folder consumer restore and execution tests against the local feed.
8. Do not push to NuGet.org until the human explicitly authorizes publication
   and the local release audit passes.

## One Fleet Contract

Define one versioned JSON fleet schema shared by Rust and .NET. The initial
contract must include:

- `fleet_kind = minimodel.seed_fleet`
- `fleet_version = 0`
- `target_model_count = 20`
- `replica_lane_count = 2`
- A central list of distinct model IDs and their manifest/piece paths.
- Exactly two lane definitions.
- Exactly one endpoint per admitted model in each lane.
- Stable lane IDs.
- Stable model IDs.
- Unique bind addresses.
- Unique public base URLs.
- Per-endpoint companion state paths.
- Explicit operator consent.
- `advertise_only_after_external_probe = true`.
- `project_server_serves_model_bytes = false`.
- `project_server_runs_model_bytes = false`.
- `project_server_proxies_model_bytes = false`.

The initial fleet may contain fewer than 20 admitted models, but the software
must report the difference as remaining capacity. Do not fill the catalog by
aliasing one artifact under 20 IDs, duplicating a fixture, or listing
unconverted Hugging Face models as active `.slm` seeds.

Two lanes must mean two independently restartable processes or services. A
single process exposing two URLs is not sufficient failure independence. Each
lane must pre-bind all of its listeners before it begins serving so a port
collision fails atomically. If one endpoint thread terminates unexpectedly,
that lane must exit with a failure and be restarted by service policy while
the other lane remains available.

## Model Admission

A model may enter the seed fleet only after all applicable gates pass:

1. `.slm` parser and checksum validation.
2. MiniModel manifest validation.
3. Artifact byte count and SHA-256 binding.
4. Piece-set and every piece hash validation.
5. Merkle-root verification.
6. Runtime compatibility inspection.
7. Source model, revision, license, and modification notice capture.
8. Quality-tier evidence appropriate to the claim.
9. Local serve and import round trip.
10. External reachability proof for each advertised endpoint.

The Qwen2.5 1.5B q4 model may be labeled `conversation-proven` and
`full-assistant-quality-pending` according to its existing evidence. Do not
upgrade it to full assistant quality. The TinyRustLM fixture must remain
`runtime-smoke-only` and must never be presented as a chat model.

## Network And Serving Requirements

Reuse MiniModel's direct HTTP piece-serving contract. At minimum serve:

- `minimodel.peer_status.v0.json`
- `minimodel.peer_companion_state.v0.json`
- `minimodel.peer_piece_set.v0`
- The exact allowlisted piece files

Requirements:

- GET only for content and OPTIONS only where the existing CORS contract
  allows it.
- No directory listing.
- No arbitrary file serving.
- No path traversal or percent-encoded traversal.
- No query-based file selection.
- Bounded request headers and metadata bodies.
- Correct content length and deterministic close behavior.
- Explicit timeouts and cancellation at the managed orchestration layer.
- No project-site fallback for model bytes.
- No Hugging Face byte proxy.
- No silent HTTP-to-file or file-to-HTTP coercion.
- No credential-bearing peer URLs.
- No persisted API keys or tokens in fleet files, logs, receipts, or crash
  dumps.

Local health is not public reachability. The status model must distinguish:

- configured
- locally validated
- listener bound
- locally reachable
- externally reachable
- announcement eligible
- advertised
- stale
- revoked
- failed

Only an external observer, outside the host's loopback and local network path,
may produce an external-reachability receipt. Bind that receipt to fleet ID,
lane ID, model ID, public URL, artifact hash, piece-set hash, checked routes,
timestamps, expiry, and probe implementation version. Reject expired,
mismatched, replayed, or locally self-issued receipts.

## Import And Download Behavior

The .NET product must support resumable peer download without weakening final
verification:

- Fetch and validate peer status before pieces.
- Fetch and validate piece-set metadata before piece bytes.
- Validate companion state against the selected manifest.
- Use deterministic piece file names and bounded concurrency.
- Write pieces to a staging directory.
- Persist no credentials in resume state.
- Verify each piece before marking it complete.
- Re-fetch corrupt or incomplete pieces according to bounded retry policy.
- Assemble to a temporary artifact.
- Verify final byte count, SHA-256, `.slm` structure, tokenizer/tensor/config
  checksums, and manifest binding.
- Atomically promote the completed `.slm`.
- Write a receipt before exposing the model to TinyRustLM runtime loading.
- Leave clear recoverable state after cancellation or power loss.

Pulling from two peers must not mix incompatible manifests or artifact hashes.
Piece scheduling may use both lanes only after their content identities match.

## Service Lifecycle

Implement production lifecycle support:

- Windows Service or reviewed Scheduled Task mode.
- systemd unit generation and installation on Linux.
- Foreground mode for containers, CI, and manual operation.
- Graceful cancellation and listener shutdown.
- Restart-on-failure with bounded backoff.
- Health and readiness separation.
- Stable PID/service identity.
- Log rotation and bounded disk usage.
- Read-only model/piece operation while serving.
- Atomic configuration replacement.
- Startup revalidation before accepting traffic.
- No announcement publication until startup validation and external probe pass.

Service install and uninstall must be idempotent. Uninstall must stop both
lanes, remove only owned service definitions, retain models by default, and
offer an explicit separate purge operation.

## Public Managed API Quality

Use immutable records for validated plans and receipts. Use interfaces only at
real ownership boundaries. Prefer `CancellationToken`, `TimeProvider`,
`IAsyncEnumerable<T>` where streaming is useful, `ILogger<T>`, and typed
exceptions with stable error codes.

Public methods must:

- Validate null, empty, size, and path constraints before native calls.
- Avoid ambiguous Boolean parameter lists.
- Accept explicit options records.
- Document thread safety and cancellation.
- Never return unvalidated raw native pointers.
- Never expose secret material in exception messages.
- Preserve native error codes and useful safe context.
- Dispose native resources deterministically.

Do not expose private model conversion, quantization authoring, training,
ranking, optimizer, premium routing, telemetry backend, license-server, key
management, or enterprise orchestration internals.

## TDD Requirements

Write failing tests before implementation. At minimum include:

### Rust and ABI tests

- Fleet schema accepts one through 20 distinct models.
- Target capacity other than 20 is rejected for schema v0.
- Lane count other than two is rejected.
- Missing model in either lane is rejected.
- Duplicate model ID, lane ID, bind address, or public URL is rejected.
- Companion state model/hash/URL drift is rejected.
- Project-server or Hugging Face peer URLs are rejected.
- Unsafe or escaping paths are rejected.
- Unknown JSON fields fail closed.
- Both lane servers expose matching content identity.
- A port collision prevents that lane from partially serving.
- One lane can fail while the second lane remains available.
- Native ABI invalid UTF-8, null pointer, oversize JSON, panic, and allocation
  paths fail safely.

### .NET unit tests

- Fleet builders emit deterministic schema-v0 JSON.
- Managed validation matches Rust validation for a shared corpus.
- Native errors map to stable managed exceptions.
- Cancellation terminates pending operations.
- Logs redact URLs containing forbidden user-info and all secret-like fields.
- Service plans are deterministic and idempotent.
- Announcement eligibility requires unexpired external proof.
- Model removal cannot delete paths outside the owned fleet root.

### Cross-language contract tests

- Rust-written fleet loads in .NET.
- .NET-written fleet loads in Rust.
- Rust-written status, state, piece set, announcement, and receipt load in
  .NET.
- .NET orchestration never changes canonical bytes before Rust verification.
- Golden malformed documents fail with equivalent error categories.

### End-to-end tests

- Prepare the deterministic q8 fixture, serve two lanes, import from lane A,
  and verify the receipt.
- Stop lane A and complete import from lane B.
- Corrupt one staged piece and prove it is rejected and re-fetched.
- Restart during a partial download and resume without trusting partial bytes.
- Seed the real Qwen artifact locally without duplicating its bytes per lane.
- Prove both lanes serve the same Qwen artifact and independent status routes.
- Test 20 small deterministic distinct fixtures for fleet-capacity mechanics;
  do not present those fixtures as 20 production models.
- Run an outside-network probe before generating public peer announcements.
- Reject announcement generation when the external probe is absent or stale.

### Package and install tests

- Build all projects with warnings as errors.
- Run the complete .NET solution test suite.
- Pack both NuGet packages and symbol packages.
- Inspect package contents for secrets and private APIs.
- Restore the library into a clean consumer project from the folder feed.
- Install the tool into a clean tool path from the folder feed.
- Run `uaix-p2p-seed doctor`, `init`, `inspect`, and fixture serve/import from
  the installed package, not project output.
- Verify every declared RID native asset loads.
- Verify missing or wrong-architecture native assets fail with actionable
  diagnostics.
- Verify SourceLink and deterministic repository metadata.

## CI And Release Automation

Extend CI to run:

- Rust format, lint, unit, integration, and ABI tests.
- .NET format verification, build, test, pack, and consumer smokes.
- Cross-language golden-contract tests.
- Windows and Linux installed-tool smokes.
- Package boundary and secret scans.
- SHA-256 manifest generation and verification.
- SBOM generation for downloadable archives.
- Archive extraction safety tests.
- Release artifact hash and provenance receipts.

CI must not require production credentials or a public inbound port. External
reachability tests belong in a separately authorized deployment job using
ephemeral endpoints and must never publish fixture announcements to the live
catalog.

## Documentation

Provide concise, accurate documentation for:

- Installing the library.
- Installing and updating the tool.
- Downloading the self-contained app.
- Creating a fleet.
- Adding the Qwen `.slm` without copying it twice.
- Configuring two independent lanes.
- Router, firewall, NAT, reverse-proxy, or tunnel requirements.
- The difference between local and external health.
- Importing and resuming a model.
- Service installation and removal.
- Rotating URLs and revoking announcements.
- Logs, storage budgets, and cleanup.
- Security and privacy boundaries.
- Package IDs, versioning, symbols, hashes, and local-feed use.
- Public versus private SDK boundaries.

Do not write feature-marketing claims that exceed test evidence.

## Required Evidence Before Completion

Do not report this goal complete until all of the following are true:

1. Rust and .NET fleet schemas interoperate byte-for-semantics.
2. Two independent seed lanes run from installed release output.
3. A model imports successfully from either lane with a Rust-verified receipt.
4. The real Qwen model is seeded without duplicate model storage.
5. The 20-model fleet capacity is tested with 20 distinct fixture identities.
6. No production catalog claims 20 real models until 20 real models are
   individually admitted.
7. The library and tool `.nupkg` plus `.snupkg` files exist in the local UAIX
   NuGet folder with matching SHA-256 manifest entries.
8. Clean consumers restore/install and execute from that folder feed.
9. Package and archive scans find no credentials or private implementation.
10. Local health and external reachability are reported separately.
11. Any live MiniModel peer announcement is backed by a current external probe
    of both advertised lanes.
12. Source changes, generated artifacts, deployment state, and remaining
    limitations are documented honestly.

## No-Cheat Rules

- Do not alias one model under multiple IDs to reach 20.
- Do not count two paths in one process as two independent lanes.
- Do not count loopback, LAN, or same-host hairpin access as public proof.
- Do not advertise a peer before outside-network verification.
- Do not replace failed network calls with fixture responses.
- Do not weaken tests, hashes, path checks, or quality gates to pass.
- Do not duplicate Rust trust logic in C# and call the duplicate equivalent.
- Do not upload model bytes to MiniModel.org, TinyRustLM.com, UAIX.org, or
  MemoryEndpoints.com as a shortcut.
- Do not proxy Hugging Face model bytes through project infrastructure.
- Do not expose private conversion or training internals in the public NuGet
  surface.
- Do not claim deployment, publication, peer availability, or model quality
  without exact reproducible evidence.

Finish with a short engineering report listing changed files, public APIs,
package identities, exact tests, package hashes, installed-tool smoke results,
seed-lane status, external-probe status, catalog publication status, and every
remaining limitation. If external reachability is blocked by NAT, firewall,
router configuration, or missing authorized tunnel infrastructure, complete
all local implementation and tests, leave catalog advertising disabled, and
report the exact boundary instead of fabricating an active peer.

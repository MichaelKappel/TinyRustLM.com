# TinyRustLM NuGet SDK

TinyRustLM NuGet packages expose the protected public SDK surface for `.slm` adoption:

- `TinyRustLM.Abstractions`: public interfaces and DTOs.
- `TinyRustLM.Core`: native-backed `.slm` inspection, immutable `.acg1` composition activation, and runtime harness operations.
- `TinyRustLM.P2P`: metadata-bound P2P share/import workflows, including local signed-manifest verification, local piece verification, assembly from a validated manifest, and receipt-sidecar inspection.
- `TinyRustLM.Memory`: UAIX `.uai` memory package and advanced persona package planning, manifest inspection, and safe package inspection.
- `TinyRustLM.MemoryEndpoints` (optional): direct MemoryEndpoints connector operations plus credential-free offline outbox, deterministic retrieval, explicit revision/conflict, tombstone, device authority, checkpoint, stale-index, and compaction contracts.

The package intentionally does not include model conversion, quantization authoring, adapter authoring, selector generation, offline breeding, lineage promotion, premium routing, telemetry, licensing internals, or commercial orchestration.

## NuGet Discoverability Metadata

Each package includes NuGet-searchable titles, descriptions, release notes, and tags for the names users are likely to search: `TinyRustLM`, `TinyRustLM.com`, `UAIX`, `UAIX.org`, `UAIX.Browser`, `p2pRuntime`, `p2pRuntime.com`, `p2pLLM`, `p2pLLM.com`, `MiniModel`, `MiniModel.org`, `.slm`, `.uai`, `memory`, `ai-memory`, `persona`, `P2P`, `Rust`, `MemoryEndpoints`, `offline-first`, `IndexedDB`, `idempotency`, `conflict`, `tombstone`, and the package-specific workflow names. The local UAIX Browser feed IDs are also present in package metadata: `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and the controlled local `UAIX.Browser.p2pLLM.Conversion` wrapper.

The package audit records `required_search_terms` and `missing_search_terms` for every protected `.nupkg`. A release fails if a package drops its required discovery terms, even when the package still builds.

## Publication Status

Treat built packages as publish-ready only after `eng\verify-package.ps1`, the dry-run publish plan, and `eng\audit-nuget-release-readiness.ps1` pass or report a non-blocked state. Treat a public or private feed as current only after `eng\verify-feed-current.ps1 -NuGetSource <feed>` passes for all four package IDs.

The July 6, 2026 NuGet.org check showed no listed versions for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, or `TinyRustLM.Memory`, so local TinyRustLM artifacts are not yet public on NuGet.org. The checked-in release path is locally verified, but public availability must not be claimed until an authenticated publish completes and the post-publish feed-current and feed-hash verifiers pass for the source-declared version.

NuGet.org publication supports two authenticated modes in `.github/workflows/release-nuget.yml`: `api_key` for a scoped `NUGET_API_KEY`, and `trusted_publishing` for NuGet.org Trusted Publishing through GitHub OIDC. Trusted Publishing is only valid for NuGet.org sources; private feeds must use `api_key` mode with scoped private-feed credentials.

## Build Locally

```powershell
eng\verify-package.ps1
```

On Unix-like shells, use `eng/verify-package.sh`.

The standard protected release set remains the four core packages. Build the separately gated optional MemoryEndpoints package and matching symbol sidecar with:

```powershell
eng\verify-package.ps1 `
  -Configuration Release `
  -IncludeOptionalMemoryEndpoints
```

On Unix-like shells, set `TINYRUSTLM_INCLUDE_OPTIONAL_MEMORY_ENDPOINTS=1` before running `eng/pack.sh`. Both pack scripts run package-boundary tests once during the solution test and again after `.nupkg`/`.snupkg` creation so reflection and archive checks execute against the actual produced package set. See `MEMORY_ENDPOINTS_CONNECTOR.md` for usage, security boundaries, the deployed distributed-sync contract, and credential-safe live verification.

Distributed synchronization is capability-negotiated. `ProbeDistributedSyncAsync` reports `Live`, `NotAdvertised`, or `Incompatible`; it never infers revision authority from ordinary save/search availability and never sends credentials to the public capability route. A live probe unlocks typed mutation, uncertain-receipt lookup, monotonic pull, authoritative-head, device authority, indexed-through, and retention APIs. The browser adapter provides the same transport plus leader-only pull-before-push callback orchestration for atomic IndexedDB integration. The deployed route, receipt, conflict, checkpoint, device, tombstone, and retention contract is `MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md`. The checked-in machine-readable example, body hash, and canonical mutation fingerprint are validated identically by Rust, C#, and the browser adapter.

The PowerShell and Bash verifiers build the Rust native bridge, run workspace rustfmt with `cargo fmt --all --check`, run the workspace clippy gate with `cargo clippy --workspace --all-targets -- -D warnings`, run Rust tests, restore/build/test the .NET solution, pack NuGet packages into `artifacts/packages`, inspect packages for private-authoring leakage plus source/debug/generated-output/local-path leakage, prove the exact source-versioned package set contains the four standard packages and only the separately requested `TinyRustLM.MemoryEndpoints` fifth package when the optional switch is active, prove each package's nuspec `id` and `version` match its protected filename and source version, prove matching `.snupkg` symbol packages exist with portable PDB entries and no source/generated/local-path leakage, prove declared package files such as `README.md` and `LICENSE.txt` are present and byte-match the current `docs/nuget` sources, prove package metadata follows the TinyRustLM authority policy for project URL, repository type, readme, license, authors, title, description length, and exact package-ID tags, prove every `.nupkg` entry is within the public package allow-list, prove each package's XML documentation exposes only the approved public API member list, prove the packaged assemblies expose only approved binary public types, constructors, properties, and workflow methods, prove the packages use only the expected same-version public dependency graph with `exclude=Build,Analyzers` dependency metadata, then install the produced packages into a clean temporary console app and exercise `.slm` inspection and loading, exact-hash `.acg1` activation, generation, UAIX memory/persona package planning and inspection, plus metadata-bound P2P share/import, signed-manifest verification, announcement JSON handoff, catalog application and inspection, and receipt-inspection workflows from package references.

Local verification requires the current machine's native runtime asset. The official `release-nuget.yml` workflow builds native bridge artifacts on `windows-latest`, `ubuntu-latest`, `macos-13`, and `macos-14`, then packs only after `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64` native assets are present in `TinyRustLM.Core`. The package audit fails if native runtime entries appear in `TinyRustLM.Abstractions`, `TinyRustLM.P2P`, or `TinyRustLM.Memory`; those packages remain managed public API/metadata wrappers. The Core package may contain only the expected RID/native filenames: `tinyrustlm_native.dll` for Windows, `libtinyrustlm_native.so` for Linux, and `libtinyrustlm_native.dylib` for macOS.

Every PowerShell and Bash verifier run writes `artifacts/reports/tinyrustlm-nuget-package-audit.json`. The audit report records the expected package names, expected symbol package names, missing/unexpected package entries, missing/unexpected symbol package entries, package identity checks, symbol package identity checks, package and symbol package SHA-256 values, byte counts, ZIP entry names, allowed package entry patterns, unexpected package content entries, symbol package PDB entries, public API XML member entries, expected public API entries, missing/unexpected public API entries, required NuGet metadata, metadata policy violations, required search terms, missing search terms, XML documentation entries, packaged documentation source/hash parity, dependencies, expected dependency metadata, native runtime IDs, native entries, allowed native entries, required RID gaps, private-surface scan results, source/debug-symbol/generated-output leakage counts, and local absolute path match counts for release evidence. The package content allow-list is intentionally narrow: NuGet metadata, nuspec, README/license, package-specific public docs, `lib/net8.0` DLL/XML outputs, and approved Core native runtime assets. Dedicated `.snupkg` files may contain only NuGet symbol metadata and the matching managed portable PDBs; PDBs remain forbidden in the main `.nupkg` files. The public API allow-list is intentionally narrow too: Abstractions exposes DTOs and interfaces, Core exposes the inspector/runtime/factory/SDK exception, P2P exposes only `TinyRustLmP2PClient`, and Memory exposes only `TinyRustLmMemoryClient`. The post-pack .NET test also reflects the packaged assemblies and fails if binary public types, constructors, properties, or workflow methods drift outside that same public SDK contract.

CI and release workflow package artifacts include both `artifacts/packages/*.nupkg` and `artifacts/packages/*.snupkg` under `tinyrustlm-nuget-packages`, so symbol packages remain visible in build evidence as well as publishable beside the primary packages. NuGet Package Manager generally lists installable `.nupkg` packages; each `.snupkg` is a debug-symbol sidecar beside the installable package, so the local folder feed, workflow artifacts, publish plan, and package/feed audits are the authoritative evidence that symbols were produced and pushed.

To audit the publish set without pushing:

```powershell
eng\publish-nuget.ps1 -SkipVerification -DryRun
```

Run this after `eng\verify-package.ps1` or `eng/verify-package.sh`, because dry-run and real publish paths now bind the package push set to `artifacts/reports/tinyrustlm-nuget-package-audit.json`. The real publish path requires `NUGET_API_KEY` or `-ApiKey` and uses the same package-set validation before `dotnet nuget push --skip-duplicate`; in Trusted Publishing workflow runs, `NuGet/login@v1` supplies `-ApiKey` from a short-lived NuGet.org token. The publish set must contain exactly `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory` at the source-declared version, plus matching `.snupkg` symbol packages for the same IDs and version. Stale or unintended extra `TinyRustLM*.nupkg` or `TinyRustLM*.snupkg` files fail the dry run and the real publish path. Missing or mismatched audit evidence also fails closed before publication. Authenticated pushes run from the package output directory, push each `.nupkg` with `--no-symbols`, and then push each matching `.snupkg` explicitly so symbol publication is visible in logs and reports.

Every dry run and publish attempt writes `artifacts/reports/tinyrustlm-nuget-publish-plan.json`. The publish-plan report records the exact package and symbol package names, SHA-256 values, byte counts, package version, package source, target feed, symbol publish mode, package-audit report hash, audit match status, SHA256SUMS manifest path/hash/match status, dry-run/push status, source provenance for the producing checkout, and `secret_material_included=false`. The SHA256SUMS manifest is package-and-symbol bound: it must include every protected `.nupkg` and matching `.snupkg` for the source-declared version, and the publish plan fails if either package class is missing from the manifest or has a hash mismatch. Source provenance includes the git commit, branch, dirty-tree flag, tracked/untracked change counts, CI provider label, and non-secret GitHub Actions identifiers when present; it never records API keys or push tokens. If an authenticated push fails after the publish set is validated, the report status becomes `push_failed` and records a redacted `publish_error` instead of leaving stale `ready_to_push` evidence. The release workflow validates and uploads this report whenever it exists, including failed authenticated push attempts.

To audit the full release state without pushing:

```powershell
eng\audit-nuget-release-readiness.ps1
```

On Unix-like shells, use `eng/audit-nuget-release-readiness.sh`. The audit refreshes the dry-run publish plan, verifies the local package folder with feed-current and feed-hash checks, checks the configured remote feed for the declared version, verifies remote package bytes when that version is already listed, and writes `artifacts/reports/tinyrustlm-nuget-release-readiness.json`. Each subreport path is cleared before its step runs, and each readiness step records `report_written`, so stale JSON from a previous run cannot be reused as current publish evidence. The report never stores API-key material; it records only `auth_mode`, `api_key_present`, `trusted_publishing_requested`, and `trusted_publishing_supported`. It also lifts the dry-run package count, symbol package count, `symbol_publish_mode`, package-and-symbol SHA256SUMS manifest name/hash/match evidence, local feed-hash package count, local feed-hash symbol package count, symbol verification mode, and local feed package/symbol mismatch counts to top-level fields for release review. Status values include `ready_to_publish`, `published_current`, `blocked_missing_api_key`, `blocked_trusted_publishing_unsupported`, `blocked_local_verification`, `blocked_feed_status_unknown`, and `blocked_remote_hash_mismatch`. Pass `-AuthMode trusted_publishing` for a NuGet.org OIDC readiness check, `-FailOnBlocked` in PowerShell, or `FAIL_ON_BLOCKED=1` on Unix-like shells when a CI gate should fail on blocked states. The official release workflow skips the push step when readiness is already `published_current`, then still runs the mandatory feed-current and feed-hash gates.

For NuGet.org Trusted Publishing, configure a trusted publishing policy on NuGet.org for this GitHub repository, workflow file `release-nuget.yml`, and environment `nuget-release`; then dispatch the release workflow with `auth_mode=trusted_publishing` and a NuGet username from the `nuget_user` input, repository variable `NUGET_USER`, or secret `NUGET_USER`. The workflow grants `id-token: write`, calls `NuGet/login@v1`, and passes the temporary key to the same audited `eng\publish-nuget.ps1` path used by API-key releases.

After a package is available on a feed, run a clean consumer smoke directly against that feed when you want the heavier install/runtime/P2P workflow proof:

```powershell
eng\verify-feed.ps1 -NuGetSource <feed-url-or-source-name>
```

This creates an isolated temporary NuGet cache, installs `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory` from the feed at the version declared in `dotnet/Directory.Build.props`, then runs `.slm` inspection and loading, exact-hash `.acg1` activation, generation, UAIX memory/persona package planning and inspection, metadata-bound P2P share/import, announcement JSON handoff, catalog application and inspection, and receipt-inspection workflows. It writes `artifacts/reports/tinyrustlm-nuget-feed-smoke.json`; Unix runs fail early with a clear report message when the `dotnet` CLI is unavailable. Pass `-PackageVersion <version>` only when verifying an older already-published version.

To prove the feed itself is current for all protected SDK package IDs:

```powershell
eng\verify-feed-current.ps1 -NuGetSource <v3-feed-url-or-local-package-folder>
```

On Unix-like shells, use `eng/verify-feed-current.sh <v3-feed-url-or-local-package-folder>`.

The current-version verifier writes `artifacts/reports/tinyrustlm-nuget-feed-current.json` and fails if any of `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, or `TinyRustLM.Memory` is missing the version declared in `dotnet/Directory.Build.props` or if the feed reports a newer version than the source tree. Use `-AllowNewer` or `ALLOW_NEWER=1` only when intentionally verifying an older maintenance branch.

For the UAIX Browser package lane, set `TINYRUSTLM_FEED_PACKAGE_IDS=UAIX.Browser.Core.Abstractions,UAIX.Browser.p2pLLM.Runtime,UAIX.Browser.p2pRuntime.P2P,UAIX.Browser.Memory,UAIX.Browser.p2pLLM.Conversion` and write to `artifacts/reports/uaix-browser-nuget-feed-current.json`. The same verifier works against NuGet.org, a private v3 feed, or the local folder feed.

Before publishing the branded Browser package lane, run:

```powershell
eng\publish-browser-nuget.ps1 -PackageSource <local-UAIX-Browser-feed> -DryRun
```

This writes `artifacts/reports/uaix-browser-nuget-publish-plan.json` with schema `uaix.browser.nuget.publish_plan.v0`. The script accepts only `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and `UAIX.Browser.p2pLLM.Conversion` at the source-declared version, requires matching `.snupkg` files, requires `uaix.browser.nuget.feed_audit.v0`, requires `SHA256SUMS-UAIX.Browser-<version>.txt`, requires generated `README-UAIX.Browser-<version>.txt` symbol-visibility guidance, records README hash/match evidence, and pushes symbols explicitly after package pushes.

Use `.github/workflows/release-browser-nuget.yml` for the protected branded release lane. It builds native bridge artifacts for `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64`, packs the five `UAIX.Browser.*` IDs with `-IncludePrivateConversion`, uploads both `.nupkg` and `.snupkg` artifacts, runs `eng\audit-browser-nuget-release-readiness.ps1`, publishes through `eng\publish-browser-nuget.ps1`, and then requires `uaix-browser-nuget-feed-current.json` plus `uaix-browser-nuget-feed-hashes.json` before the run can pass. The readiness audit writes `uaix-browser-nuget-release-readiness.json` with schema `uaix.browser.nuget.release_readiness.v0`, writes the no-push dry-run plan to `uaix-browser-nuget-release-readiness-publish-plan-dry-run.json` by default so routine audits preserve retained post-push `uaix-browser-nuget-publish-plan.json` evidence, records top-level package/symbol counts, SHA256SUMS binding fields, `published_current` skip evidence, non-secret auth-mode evidence, and blockers such as `blocked_missing_api_key`, `blocked_trusted_publishing_unsupported`, or `blocked_remote_hash_mismatch`. If NuGet.org already exposes the source-declared version with different package bytes, the package version is immutable; bump `dotnet/Directory.Build.props` `VersionPrefix` before publishing corrected Browser packages. `auth_mode=trusted_publishing` is limited to `https://api.nuget.org/v3/index.json`; private feeds use `auth_mode=api_key`. Its optional `verify_after_publish=true` smoke calls `eng\verify-consumer.ps1` with `-CorePackageId UAIX.Browser.p2pLLM.Runtime`, `-P2PPackageId UAIX.Browser.p2pRuntime.P2P`, `-MemoryPackageId UAIX.Browser.Memory`, and `-ConversionPackageId UAIX.Browser.p2pLLM.Conversion`, proving all five branded packages restore while preserving the public `TinyRustLM` API namespace and exercising the controlled conversion wrapper.

To prove the feed serves the exact package bytes recorded in the publish plan:

```powershell
eng\verify-feed-package-hashes.ps1 -NuGetSource <v3-feed-url-or-local-package-folder>
```

On Unix-like shells, use `eng/verify-feed-package-hashes.sh <v3-feed-url-or-local-package-folder>`.

The feed-hash verifier reads `artifacts/reports/tinyrustlm-nuget-publish-plan.json` by default, and also accepts the Browser publish-plan schema when `-PublishPlanReport artifacts/reports/uaix-browser-nuget-publish-plan.json` is provided. It requires the plan to be bound to both a passing package audit and a passing SHA256SUMS manifest, downloads or reads each package from the feed, carries the package-audit and SHA256SUMS manifest hashes forward, records `publish_plan_schema`, and writes `artifacts/reports/tinyrustlm-nuget-feed-hashes.json` or the caller-provided report path such as `artifacts/reports/uaix-browser-nuget-feed-hashes.json`. Local/private folder feeds must match the publish-plan `.nupkg` SHA-256 values and byte counts exactly and also verify each matching `.snupkg` symbol package. NuGet.org may add a repository-signature entry after upload; for NuGet v3 feeds the verifier accepts that normalization only when every original package entry matches by path, byte count, and SHA-256 and the only additional entry is `.signature.p7s`. For NuGet v3 package feeds it records `symbol_package_verification_mode=nuget_v3_package_feed_does_not_expose_snupkg_symbols`, because the package flat-container endpoint does not expose symbol sidecars. The official release workflows always run feed-current and feed-hash checks after publishing, with short retries for feed indexing delay. The workflow input `verify_after_publish` controls only the heavier clean consumer smoke.

To prove public documentation mirrors are still aligned with the protected NuGet boundary when sibling site checkouts are available:

```powershell
eng\verify-public-doc-sites.ps1
```

This writes `artifacts/reports/tinyrustlm-public-doc-sites-audit.json` and fails if TinyRustLM or MiniModel public docs drop `TinyRustLM.Memory`, omit `.snupkg` symbol package or `symbol_publish_mode` release evidence, omit TinyRustLM mirror `SymbolsPackage` and PDB evidence for the UAIX Browser feed audit, omit SHA256SUMS-bound publish/feed-hash wording, or reintroduce stale three-package release-status text.

## Ongoing Feed Monitoring

`.github/workflows/nuget-feed-monitor.yml` runs the feed-current verifier manually through `workflow_dispatch` and can also run on a daily schedule. Scheduled runs are disabled until repository variable `TINYRUSTLM_NUGET_MONITOR_ENABLED` is set to `true`, which avoids noisy failures before the packages are published. For scheduled private-feed monitoring, set `TINYRUSTLM_NUGET_SOURCE` to the feed's NuGet v3 index URL. Set `TINYRUSTLM_NUGET_MONITOR_ALLOW_NEWER=true` only for intentionally older maintenance branches. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER=true` when the scheduled monitor should also run `eng/verify-feed.ps1` and upload `tinyrustlm-nuget-feed-smoke.json`. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES=true` and `TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT=<path>` only when the retained publish-plan JSON is available in the monitor checkout or runner environment.

## Minimal Runtime Use

```csharp
using TinyRustLM;

var inspector = new TinySlmInspector();
var inspection = inspector.Inspect("model.slm");

var factory = new TinyRustLmRuntimeFactory();
var version = factory.GetVersion();
Console.WriteLine($"{version.Product} {version.SdkVersion} ABI {version.NativeAbiVersion}");
using var runtime = factory.CreateRuntime();
runtime.LoadModel("model.slm", inspection.Sha256);
runtime.ActivateComposition(
    "model.base.acg1",
    "sha256:<64-lowercase-hex-characters>");
var result = runtime.Generate("hello", new TinyRustLmGenerationOptions(MaxNewTokens: 32));
Console.WriteLine(result.Text);
```

Model loading deliberately leaves the runtime in `model-loaded-no-active-composition`. `ActivateComposition` requires a bounded, aligned, regular `.acg1` file and its exact SHA-256 identity; the Rust runtime verifies the bundle and model binding before atomic activation. Generation fails closed until activation succeeds, and a rejected replacement leaves the prior active graph unchanged.

The .NET wrapper and native public runtime SDK validate generation options before runtime mutation: `MaxNewTokens` / `max_new_tokens` must be greater than zero, `Temperature` / `temperature` must be finite and non-negative, `TopK` / `top_k` must be between 1 and 1024, and `TopP` / `top_p` must be finite in `(0, 1]`. Direct native callers receive an `invalid_generation_options` JSON envelope before runtime-handle lookup when the values violate that public fixed-buffer sampler contract.

Managed path, digest, prompt, and JSON handoff strings are also checked for embedded NUL characters before P/Invoke. This prevents accidental C-string truncation at the native boundary for `.slm` and `.acg1` paths, composition identities, generation prompts, P2P manifests, announcements, catalogs, receipts, and share-kit request fields.

The .NET P2P wrapper enforces the public Rust byte budgets before P/Invoke for JSON handoff documents: manifests are capped at 1 MiB, announcements and local import receipts at 256 KiB, and announcement catalogs at 4 MiB. Oversized managed handoff strings fail as argument errors before native C-string allocation or Rust parsing.

`VerifySignedManifest(signedManifestJson, publicKeyJson)` verifies a `tinyrustlm.p2p_signed_manifest.v0` envelope against local metadata-only `minimodel.public_key.v0` JSON. The Rust verifier checks the wrapped manifest, canonical payload SHA-256, `external-signature-v0`, `ed25519-base64:` signature bytes, matching publisher id, key id, public-key route, public-key SHA-256, `usage=minimodel-manifest-signing-v0`, and `revoked=false`. The managed wrapper caps signed-manifest JSON at 1 MiB and public-key JSON at 16 KiB before P/Invoke. This is local verification only; signing, key hosting, remote key discovery, transparency-log checks, and commercial publisher services are outside the NuGet package.

The managed bridge preserves empty strings as real native empty strings instead of converting them to null pointers. Optional string arguments still use null for "not supplied", but an empty prompt remains an empty prompt through the native runtime call.

## Minimal P2P Share Use

```csharp
using TinyRustLM;

var p2p = new TinyRustLmP2PClient();
var report = p2p.PrepareLocalShareKit(new PrepareShareKitRequest(
    ModelPath: "model.slm",
    OutputDir: "share-kit",
    PeerId: "local-peer",
    PublicBaseUrl: "https://peer.example/tinyrustlm"));
var metadata = p2p.ExportShareMetadata(File.ReadAllText(report.ManifestPath));
// For signed catalog handoff, call VerifySignedManifest(signedEnvelopeJson, publicKeyJson)
// before trusting the wrapped manifest. Signing/key discovery are intentionally outside this package.
var announcement = p2p.ValidateAnnouncement(File.ReadAllText(report.AnnouncementPath!));
var catalogJson = p2p.ApplyReceivedAnnouncementJson(File.ReadAllText(report.AnnouncementPath!));
var catalogInspection = p2p.InspectAnnouncementCatalog(catalogJson);
var manifestJson = File.ReadAllText("share-kit/tinyrustlm.p2p-manifest.v0.json");
var receipt = p2p.ImportFromManifest(manifestJson, "share-kit", "imported.slm");
var inspection = p2p.InspectLocalImportReceipt(
    File.ReadAllText(receipt.ReceiptPath),
    "imported.slm");
```

`PrepareLocalShareKitJson`, `ExportShareMetadataJson`, `ValidateAnnouncementJson`, `ApplyReceivedAnnouncementJson`, and `InspectAnnouncementCatalogJson` are available when a caller needs the exact native JSON document for file handoff or auditing, but the primary .NET API returns typed records. Catalog application deduplicates honest announcement replays while rejecting conflicting same-peer/same-manifest metadata, and catalog inspection enforces a 4 MiB pre-parse byte budget.

The .NET P2P wrapper validates `PrepareShareKitRequest` before serializing to native JSON: `ModelPath` and `OutputDir` must be present, and `PieceSize` must be omitted or between 1 KiB and 16 MiB. Deeper identifier, public URL, manifest, and artifact validation remains enforced by the Rust P2P SDK.

## Minimal UAIX Memory Use

```csharp
using TinyRustLM;

var memory = new TinyRustLmMemoryClient();
var catalog = memory.GetSupportedSetups();
var advancedPersona = catalog.Setups.Single(setup =>
    setup.Setup == "advanced_persona_profile");
var plan = memory.GetRequiredFiles(new UaixMemoryPackageRequest(
    Setup: advancedPersona.Setup,
    CodeLikeArtifacts: true,
    AdvancedPersona: new UaixAdvancedPersonaOptions(SenseOfStyleDepth: 2)));
var inspection = memory.InspectPackage("my-memory-package.uaix");
var manifest = memory.InspectManifest(File.ReadAllText(".uai/manifest.uaix.json"));
```

The Memory package follows the public UAIX AI Memory Package Wizard and advanced persona package guidance, validates `.uai` directories, `.zip`, and `.uaix` archives without extracting entries, and reports required, present, missing, and hashed package files. `GetSupportedSetups()` exposes Wizard adoption features such as the `script[data-ai-digest]` machine-readable digest convention, point-agent setup URLs, local browser draft restore, prompt nudges, Safe Structured Output Mode, review/export checks, Codex/Claude/GPT agent-use blocks, DTMI policy, family-aware required files, browser-generated ZIP packages, canonical starter ZIP downloads, manifest JSON, manifest overlay, package model JSON, knowledge graph JSON, and `llms.uai` / `llms-full.uai` exports. The baseline plan includes the Wizard's local-first export deck: `.uai/agent-pickup.uai`, `.uai/archives/session-log.uai`, manifest JSON, manifest overlay, package model, knowledge graph, `llms.uai`, and `llms-full.uai`; `FileDeck.IncludesManifestJson` and `FileDeck.IncludesManifestOverlay` report those two records separately. Plans and inspections also expose a `FileDeck` summary so consumers can check universal, profile, configuration-specific, content-triggered, persona, evidence, and export counts without reclassifying every path; the content-triggered Advanced Persona Profile gate expects `62` required files with `22` persona dimension files, `5` evidence files, and `6` exports. For `advanced_persona_profile`, the catalog exposes the `.uaix`, ZIP, and TXT deck expectation and package inspection reports persona dimension evidence for `depth_level_0_to_10`, disclosure boundary, source confidence, triggered style-axis separation, and non-inference rules. Validation fails closed when required dimension evidence is missing. Consumers should use `GetSupportedSetups()` instead of maintaining their own setup list; the console sample also supports `TinyRustLM.ConsoleSample --memory-setups` for a quick catalog view. It does not perform hosted import validation, automatic repository writes, LLM Wiki synchronization, persona-fidelity certification, or persona source mutation.

For the UAIX Browser local folder feed, use:

```powershell
eng\pack.ps1 `
  -PackageOutput <local-UAIX-Browser-feed> `
  -PackageIdPrefix UAIX.Browser `
  -AbstractionsPackageId UAIX.Browser.Core.Abstractions `
  -CorePackageId UAIX.Browser.p2pLLM.Runtime `
  -P2PPackageId UAIX.Browser.p2pRuntime.P2P `
  -MemoryPackageId UAIX.Browser.Memory `
  -IncludePrivateConversion `
  -ConversionPackageId UAIX.Browser.p2pLLM.Conversion `
  -ArchiveOtherPackages
```

This emits `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and the controlled/local `UAIX.Browser.p2pLLM.Conversion` wrapper while preserving the `TinyRustLM.*` assembly/public namespace surface. Each managed package also emits a matching `.snupkg` symbol package. `-ArchiveOtherPackages` moves non-matching root `.nupkg` and `.snupkg` files, stale same-ID Browser packages, and previous `SHA256SUMS-UAIX.Browser-*.txt` plus `README-UAIX.Browser-*.txt` feed files into the feed's `Archive` folder before replacing current Browser artifacts. The pack script also writes `SHA256SUMS-UAIX.Browser-<version>.txt` and `README-UAIX.Browser-<version>.txt` for the exact current primary package and symbol package set.

Audit the branded folder feed after packing:

```powershell
eng\verify-browser-feed.ps1 -PackageSource <local-UAIX-Browser-feed>
```

The Browser feed audit verifies the exact five branded package IDs, matching `.snupkg` symbol packages, symbol-package hashes in `SHA256SUMS-UAIX.Browser-<version>.txt`, generated symbol visibility guidance in `README-UAIX.Browser-<version>.txt`, nuspec metadata, metadata policy, required search terms, dependency graph, and absence of local absolute paths in package text entries.

See `API_BOUNDARY.md`, `PACKAGE_SECURITY.md`, `P2P_SHARE_FLOW.md`, `MEMORY_HARNESS.md`, and `SLM_VALIDATION.md` before publishing packages outside a private feed.

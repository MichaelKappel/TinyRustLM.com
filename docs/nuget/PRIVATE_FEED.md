# Private Feed Publishing

TinyRustLM packages should be published to a private NuGet feed until the public SDK boundary has completed legal, security, and product review.

As of the July 6, 2026 public-feed check, NuGet.org did not list `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, or `TinyRustLM.Memory`. Use the private-feed flow below for review, then promote to NuGet.org only with an authenticated publish run and passing post-publish feed-current/feed-hash verification.

Private feeds must use scoped feed credentials through `api_key` mode. NuGet.org Trusted Publishing is supported only for NuGet.org sources, where a NuGet.org trusted publishing policy can exchange a GitHub OIDC token for a short-lived push key.

## Recommended Flow

1. Run `eng/verify-package.ps1` locally, or `eng/verify-package.sh` on Unix-like shells, or use `release-nuget.yml` for a publish candidate that must include `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64` native bridge artifacts.
2. Review `artifacts/packages/*.nupkg`, `artifacts/packages/*.snupkg`, and `artifacts/reports/tinyrustlm-nuget-package-audit.json`.
3. Confirm the audit report status is `pass`, package and symbol-package SHA-256 values are recorded, required metadata, required search-term, and XML-documentation gaps are empty, private-surface matches are empty, main-package source/debug-symbol/generated-output leakage counts are zero, symbol-package source/generated/local-path leakage counts are zero, local absolute path match counts are zero, and native RID coverage matches the intended feed audience.
4. Audit the package push set:

```powershell
eng\publish-nuget.ps1 -SkipVerification -DryRun -PackageSource artifacts\packages
```

The dry run and real publish path reject stale or unintended extra `TinyRustLM*.nupkg` or `TinyRustLM*.snupkg` files. The package source must contain exactly `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory` at the version declared by `dotnet/Directory.Build.props`, plus matching `.snupkg` files for those package IDs and version. Those package and symbol package names, SHA-256 values, and byte counts must match the package-audit report from step 2.

The publish command writes `artifacts/reports/tinyrustlm-nuget-publish-plan.json` with package and symbol package SHA-256 values, byte counts, package source, package-audit report hash, audit match status, target feed, symbol publish mode, dry-run or push status, and source provenance for the producing checkout. It requires `SHA256SUMS-TinyRustLM-<version>.txt` to bind both the protected `.nupkg` files and their matching `.snupkg` symbol packages. The source-provenance block records only non-secret git/CI identifiers such as commit, branch, dirty-tree status, tracked/untracked change counts, CI provider, and GitHub run metadata; the report deliberately records `secret_material_included=false` and never stores API keys or push tokens. Authenticated pushes run from the package output directory, push each `.nupkg` with `--no-symbols`, and then push each matching `.snupkg` explicitly so symbol publication is auditable. Authenticated push failures are recorded as `push_failed` with a redacted `publish_error`; the official release workflow still validates and uploads that report when it exists.

NuGet Package Manager generally lists installable `.nupkg` packages rather than `.snupkg` symbol files. Treat each `.snupkg` as a debug-symbol sidecar: verify it through the folder feed contents, workflow artifacts, `SymbolsPackage`/PDB evidence, `SHA256SUMS-*` membership, publish-plan hashes, and feed-hash reports.

5. Run the release-readiness audit before pushing:

```powershell
eng\audit-nuget-release-readiness.ps1 -NuGetSource <private-feed-url>
```

The audit writes `artifacts/reports/tinyrustlm-nuget-release-readiness.json` with local feed-current/hash evidence, target-feed status, blocker status, top-level package and symbol package counts, package-and-symbol SHA256SUMS manifest binding, local symbol hash/byte-count mismatch counts, `auth_mode`, and only non-secret credential metadata such as boolean `api_key_present`. Use `-AuthMode api_key -FailOnBlocked` in automation when the private feed must be publishable from that environment. `-AuthMode trusted_publishing` is intentionally blocked for non-NuGet.org sources. When the official release workflow sees `published_current`, it skips the push step and still runs the mandatory feed-current/feed-hash gates.

6. Publish to a private feed:

```powershell
eng\publish-nuget.ps1 -SkipVerification -PackageSource artifacts\packages -NuGetSource <private-feed-url> -ApiKey <token>
```

Preserve `artifacts/reports/tinyrustlm-nuget-package-audit.json`, `artifacts/reports/tinyrustlm-nuget-release-readiness.json`, and `artifacts/reports/tinyrustlm-nuget-publish-plan.json` with release evidence.

When using `.github/workflows/release-nuget.yml` for a private feed, dispatch it with `auth_mode=api_key`, `source=<private-v3-feed-url>`, and a repository secret `NUGET_API_KEY` scoped to the package push operation.

7. Once the feed has indexed the package and credentials are configured, run the optional post-publish consumer smoke:

```powershell
eng\verify-feed.ps1 -NuGetSource <private-feed-url-or-source-name>
```

This writes `artifacts/reports/tinyrustlm-nuget-feed-smoke.json` with the clean consumer smoke status, package version, feed source, and no-secret-material flag.

8. Verify that the feed now exposes the source-declared package version for all four protected packages. The official release workflow runs this gate automatically after every publish:

```powershell
eng\verify-feed-current.ps1 -NuGetSource <private-v3-feed-url>
```

On Unix-like shells, use `eng/verify-feed-current.sh <private-v3-feed-url>`.

This writes `artifacts/reports/tinyrustlm-nuget-feed-current.json` with the declared version, latest reported version, and current-version status for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory`.

For the UAIX Browser package lane, run the same command with `TINYRUSTLM_FEED_PACKAGE_IDS=UAIX.Browser.Core.Abstractions,UAIX.Browser.p2pLLM.Runtime,UAIX.Browser.p2pRuntime.P2P,UAIX.Browser.Memory,UAIX.Browser.p2pLLM.Conversion` and `-ReportOutput artifacts/reports/uaix-browser-nuget-feed-current.json`.

Before pushing the UAIX Browser package lane to a private feed, run:

```powershell
eng\publish-browser-nuget.ps1 -PackageSource <local-UAIX-Browser-feed> -NuGetSource <private-v3-feed-url-or-name> -DryRun
```

The dry run writes `artifacts/reports/uaix-browser-nuget-publish-plan.json` with schema `uaix.browser.nuget.publish_plan.v0`. It requires `SHA256SUMS-UAIX.Browser-<version>.txt`, generated `README-UAIX.Browser-<version>.txt`, the Browser feed audit, all five audited `.nupkg` files, and all five matching `.snupkg` files to agree, including README hash/match evidence for symbol sidecar visibility. A non-dry run requires `-ApiKey` or `NUGET_API_KEY` and publishes the five audited Browser `.nupkg` files with `--no-symbols`, then publishes the five matching `.snupkg` files explicitly.

When using GitHub Actions for the branded Browser lane, dispatch `.github/workflows/release-browser-nuget.yml` with `auth_mode=api_key` for private feeds. The workflow packs the exact five `UAIX.Browser.*` package IDs, audits them with `eng\verify-browser-feed.ps1`, uploads `.nupkg` and `.snupkg` artifacts, gates publication with `eng\audit-browser-nuget-release-readiness.ps1`, publishes with `eng\publish-browser-nuget.ps1`, and requires `uaix-browser-nuget-feed-current.json` plus `uaix-browser-nuget-feed-hashes.json` before completion. The readiness audit writes `uaix-browser-nuget-release-readiness.json` with schema `uaix.browser.nuget.release_readiness.v0`, writes its no-push dry-run plan to `uaix-browser-nuget-release-readiness-publish-plan-dry-run.json` by default instead of overwriting retained post-push `uaix-browser-nuget-publish-plan.json` evidence, records top-level package/symbol counts and SHA256SUMS binding fields, blocks missing credentials before push, and returns `published_current` so the workflow can skip a redundant push while still running post-publish feed checks. If it returns `blocked_remote_hash_mismatch` against NuGet.org, the listed version is immutable with different bytes; bump `dotnet/Directory.Build.props` `VersionPrefix` before publishing corrected Browser packages. For NuGet.org only, dispatch the same workflow with `auth_mode=trusted_publishing` after configuring a trusted publishing policy for workflow file `release-browser-nuget.yml` and environment `nuget-release`.

9. Verify that the feed serves the exact package bytes from the publish plan. The official release workflow runs this gate automatically after every publish:

```powershell
eng\verify-feed-package-hashes.ps1 -NuGetSource <private-v3-feed-url-or-package-folder>
```

This writes `artifacts/reports/tinyrustlm-nuget-feed-hashes.json` with per-package integrity evidence. Pass `-PublishPlanReport artifacts/reports/uaix-browser-nuget-publish-plan.json -ReportOutput artifacts/reports/uaix-browser-nuget-feed-hashes.json` for the branded Browser lane. Local folder feeds must match the publish-plan `.nupkg` SHA-256 values and byte counts exactly and the same report also verifies each matching `.snupkg` symbol package. NuGet.org may add `.signature.p7s` repository-signature bytes after upload; NuGet v3 feed checks accept that only when every original package entry matches by path, byte count, and SHA-256 and `.signature.p7s` is the only additional entry.

For ongoing private-feed monitoring, set repository variable `TINYRUSTLM_NUGET_MONITOR_ENABLED=true` and `TINYRUSTLM_NUGET_SOURCE=<private-v3-feed-url>`, then use `.github/workflows/nuget-feed-monitor.yml` for scheduled or manual feed-current reports. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER=true` after feed credentials and native runtime assets are ready for scheduled clean consumer install/runtime/P2P smoke reports. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES=true` and `TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT=<path>` only when the retained publish-plan JSON is available to the monitor. Set `UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT=true` and `UAIX_BROWSER_NUGET_SOURCE=<private-v3-feed-url-or-folder>` when the same monitor should check the branded Browser package IDs.

10. Run `eng/verify-consumer.ps1 -PackageSource artifacts\packages` if you need to repeat the local artifact install smoke separately from the full verifier. The consumer smoke exercises `.slm` inspect/load/generate, UAIX memory/persona package planning and inspection, metadata-bound P2P share/import, signed-manifest verification, announcement/catalog handoff, local assembly, and receipt inspection from package references.
    For branded Browser packages, run `eng\verify-consumer.ps1 -PackageSource <feed-url-or-folder> -CorePackageId UAIX.Browser.p2pLLM.Runtime -P2PPackageId UAIX.Browser.p2pRuntime.P2P -MemoryPackageId UAIX.Browser.Memory -ConversionPackageId UAIX.Browser.p2pLLM.Conversion` so the smoke restores the public UAIX package IDs, exercises the same `TinyRustLM` API namespace, and validates the controlled conversion wrapper against the fixture `.slm`.
11. Install from a clean sample application against the private feed and verify that only `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, `TinyRustLM.Memory`, docs, and runtime-native assets are present.

## Local UAIX Folder Feed Alias

For the UAIX deployment folder feed, build the protected Browser package line under the branded `UAIX.Browser.*` package IDs:

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

This keeps the compiled assemblies and public namespaces as `TinyRustLM.*`, but writes package IDs and dependencies as `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and the controlled/local `UAIX.Browser.p2pLLM.Conversion` wrapper. `-ArchiveOtherPackages` moves non-`UAIX.Browser` `.nupkg` and `.snupkg` files, stale same-ID Browser packages, and previous `SHA256SUMS-UAIX.Browser-*.txt` plus `README-UAIX.Browser-*.txt` feed files from the feed root into the feed's `Archive` folder before current Browser packages are replaced, and the pack script writes `SHA256SUMS-UAIX.Browser-<version>.txt` plus `README-UAIX.Browser-<version>.txt` for the exact current package and symbol package set. Use this only for local/private folder feeds; the public protected release path remains the audited `TinyRustLM.*` package set without exposing private conversion internals.

Audit the branded feed after packing:

```powershell
eng\verify-browser-feed.ps1 -PackageSource <local-UAIX-Browser-feed>
```

The Browser feed audit writes `artifacts/reports/uaix-browser-nuget-feed-audit.json` and fails if any branded `.nupkg` or matching `.snupkg` symbol package is missing, renamed, missing required NuGet search metadata, has an unexpected same-version dependency graph, is absent from `SHA256SUMS-UAIX.Browser-<version>.txt`, is absent from generated `README-UAIX.Browser-<version>.txt` symbol visibility guidance, lacks `SymbolsPackage`/PDB evidence, carries unexpected symbol-package entries, or leaks local absolute paths in package text entries.

## Feed Policy

Use scoped credentials, immutable package versions, package retention, and manual approval for public promotion. Do not publish packages that include private conversion, adapter, selector, breeding, or training artifacts.

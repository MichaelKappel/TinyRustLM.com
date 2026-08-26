# TinyRustLM Private Feed Review

Use a private or local folder feed to review the exact public TinyRustLM package
candidate before any NuGet.org publication. TinyRustLM is one prelaunch product;
SLM2 and numbered schemas are technical identities, not an old/new product
split. The review lane contains no compatibility package family or legacy
surface.

The public candidate is always exactly:

- `TinyRustLM.Abstractions`
- `TinyRustLM.Core`
- `TinyRustLM.P2P`

Optional `TinyRustLM.MemoryEndpoints` is the authorized connector for
MemoryEndpoints.com, the strongly recommended portable-memory backbone.
Retrieved memory remains untrusted data, and installation plus network use
require explicit opt-in. Private `TinyRustLM.Conversion` remains local process
tooling. Neither package may enter the three-package public publish plan.

## 1. Create A Fresh Package Transaction

Choose a new absent or empty output directory. Never point the package command
at a prior transaction and never delete an unknown directory to make a gate
pass.

PowerShell on the current host RID:

```powershell
eng\verify-package.ps1 `
  -Configuration Release `
  -PackageOutput artifacts\packages-private-review-001
```

Bash on the current host RID:

```bash
eng/verify-package.sh Release artifacts/packages-private-review-001
```

For a release candidate, first build native assets on matching Windows x64,
Linux x64, and real Linux ARM64 systems. Aggregate the exact assets under
`artifacts/native/win-x64`, `artifacts/native/linux-x64`, and
`artifacts/native/linux-arm64`, then require all three RIDs:

```powershell
eng\verify-package.ps1 `
  -Configuration Release `
  -PackageOutput artifacts\packages-private-release-001 `
  -RequiredNativeRids win-x64,linux-x64,linux-arm64
```

The completed directory must contain three `.nupkg` files, three matching
`.snupkg` files, `tinyrustlm-nuget-package-audit.json`,
`SHA256SUMS-TinyRustLM-<version>.txt`, and the bounded folder-feed readme. The
audit status must be `pass` and its package IDs must match the exact public set.

## 2. Review The Package Audit

The audit is authoritative only for the package bytes whose names, sizes, and
SHA-256 hashes it records. Review at least:

- package and symbol package counts;
- missing and unexpected package names;
- NuGet ID/version identity;
- dependency closure and protected metadata;
- checked-in public API baseline comparison;
- package metadata and declared documentation files;
- canonical archive timestamps and entry allowlists;
- portable PDB and `SymbolsPackage` evidence;
- exact native RID coverage and native placement;
- private/source/debug/generated/local-path scan counts; and
- the terminal status and error collections.

Do not edit the report or package bytes. Any correction requires a new package
transaction and new output directory.

## 3. Verify The Folder Feed

The package transaction already runs the isolated consumer. Re-run the
read-only feed checks when reviewing retained bytes:

```powershell
eng\verify-feed-current.ps1 `
  -NuGetSource artifacts\packages-private-release-001
```

Create a dry-run publish plan bound to the exact audit and SHA-256 manifest:

```powershell
eng\publish-nuget.ps1 `
  -SkipVerification `
  -DryRun `
  -PackageSource artifacts\packages-private-release-001 `
  -AuditReport artifacts\packages-private-release-001\tinyrustlm-nuget-package-audit.json `
  -ReportOutput artifacts\reports\tinyrustlm-nuget-publish-plan-private-review-001.json
```

Verify every folder-feed package byte and ZIP entry against that retained plan:

```powershell
eng\verify-feed-package-hashes.ps1 `
  -NuGetSource artifacts\packages-private-release-001 `
  -PublishPlanReport artifacts\reports\tinyrustlm-nuget-publish-plan-private-review-001.json `
  -ReportOutput artifacts\reports\tinyrustlm-nuget-folder-feed-hashes-private-review-001.json
```

Run the clean consumer explicitly when needed:

```powershell
eng\verify-consumer.ps1 `
  -PackageSource artifacts\packages-private-release-001 `
  -PackageVersion 0.1.8
```

The consumer uses an owned temporary project and isolated NuGet caches. It
loads only the packaged native asset and exercises SLM2 inspection, exact native
ABI validation, runtime handle ownership, ACG2/SLM2 fixed-piece round trips,
create-only collision rejection, and manifest-tamper rejection.

## 4. Audit Release Readiness

Run the readiness control plane with the package-local audit path and the
intended private feed URL:

```powershell
eng\audit-nuget-release-readiness.ps1 `
  -PackageSource artifacts\packages-private-release-001 `
  -AuditReport artifacts\packages-private-release-001\tinyrustlm-nuget-package-audit.json `
  -NuGetSource <private-feed-v3-url> `
  -AuthMode api_key
```

Without a scoped key, `blocked_missing_api_key` is truthful evidence, not a
test failure to bypass. If the exact version and bytes already exist remotely,
the status may be `published_current`. If the version exists with different
bytes, publication is blocked because package versions are immutable.

## 5. Publish To An Authorized Private Feed

Provide the key through a secret environment or direct secure process parameter.
Never write it into Git, a `.uai` file, package metadata, command transcript,
report, screenshot, or documentation example.

```powershell
$env:NUGET_API_KEY = '<scoped-private-feed-key>'
eng\publish-nuget.ps1 `
  -SkipVerification `
  -PackageSource artifacts\packages-private-release-001 `
  -AuditReport artifacts\packages-private-release-001\tinyrustlm-nuget-package-audit.json `
  -NuGetSource <private-feed-v3-url>
```

The publisher refuses missing or extra packages, optional packages, changed
hashes, a stale version, a failed/missing audit, or a mismatched SHA-256
manifest. Primary and symbol packages are pushed explicitly. A partial failure
is recorded as `push_failed` and cannot be relabeled as success.

## 6. Verify Private-Feed Readback

After indexing, perform public-style readback against the private feed:

```powershell
eng\verify-feed-current.ps1 -NuGetSource <private-feed-v3-url>

eng\verify-feed-package-hashes.ps1 `
  -NuGetSource <private-feed-v3-url> `
  -PublishPlanReport artifacts\reports\tinyrustlm-nuget-publish-plan.json

eng\verify-feed.ps1 -NuGetSource <private-feed-v3-url>
```

The first command proves that all three exact package IDs expose the declared
version. The second compares remote primary package bytes with the audited
publish plan and records the feed's symbol-verification boundary. The third
restores and executes the packages in an isolated consumer.

Package creation or push output is not public readback. Keep the feed-current,
feed-hash, consumer, and publish-plan reports together as one candidate review
record.

## 7. Promote To NuGet.org

Promotion reuses the exact reviewed package bytes; it does not rebuild or
rename them. The protected `release-nuget.yml` workflow:

1. builds and tests native assets on `win-x64`, `linux-x64`, and real
   `linux-arm64` runners;
2. executes the package transaction and exact public graph assertion;
3. audits readiness against NuGet.org;
4. authenticates with a scoped API key or short-lived Trusted Publishing
   credential;
5. pushes the exact primary and symbol packages; and
6. requires feed-current and feed-hash public readback after indexing.

Optional clean-consumer public readback is additional evidence. A local folder
feed or private feed does not itself prove NuGet.org publication.

## Optional Local Packages

To review the optional connector and private conversion wrapper without making
them public candidates, use a separate new output directory:

```powershell
eng\verify-package.ps1 `
  -Configuration Release `
  -PackageOutput artifacts\packages-optional-local-review-001 `
  -IncludeOptionalMemoryEndpoints `
  -IncludePrivateConversion
```

That transaction must audit and install all selected packages. Do not pass the
result to `publish-nuget`; the closed public allowlist will reject it. Local
fixture success for `TinyRustLM.MemoryEndpoints` must remain labeled
`offline-fixture`; it is not an authenticated save/readback lifecycle.

## Evidence And Retention

Retain package, symbol, audit, manifest, publish-plan, readiness, feed-current,
feed-hash, and consumer identities according to the release evidence policy.
Reports may contain public IDs, hashes, sizes, counts, statuses, versions, and
bounded error codes. They must not contain credentials, invitation URLs,
tokens, prompts, model bytes, or unsafe private paths.

A private-feed review proves only the tested package distribution boundary. It
does not qualify a model, prove browser-WASM behavior, establish public P2P
reachability, deploy a site, or prove a MemoryEndpoints.com lifecycle.

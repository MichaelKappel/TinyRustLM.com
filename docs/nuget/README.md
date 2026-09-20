# TinyRustLM .NET SDK

TinyRustLM is one prelaunch product. SLM2, ACG2, Tokenizer2, Template2,
Sampling2, Prompt2, ABI revisions, schemas, and package versions are exact
technical identities, not product generations. There is no launched earlier
product to preserve and no compatibility, migration, alias, fallback, or
deprecated package surface.

The .NET SDK is a managed boundary over the canonical Rust implementation. It
does not contain a second model runtime, parser, sampler, converter, response
repair path, catalog, or model-byte proxy.

## Current Package Graph

The public default set contains exactly three packages:

| Package | Responsibility | Dependencies |
| --- | --- | --- |
| `TinyRustLM.Abstractions` | Immutable public request, result, policy, identity, and exception contracts | None |
| `TinyRustLM.Core` | Exact native ABI validation, SLM2 inspection, ACG2 activation, and Prompt2/Sampling2 conversation execution | `TinyRustLM.Abstractions` |
| `TinyRustLM.P2P` | Four-MiB fixed-piece preparation, canonical manifest inspection, and create-only SLM2/ACG2 assembly | `TinyRustLM.Abstractions`, `TinyRustLM.Core` |

Two packages are independently optional and excluded from the public default
transaction:

- `TinyRustLM.MemoryEndpoints` is the authorized, strongly recommended
  MemoryEndpoints.com connector contract for two isolated consumers: direct
  agent-to-agent long-term memory, meetings, handoffs, and coordination across
  ecosystem sites; and the TinyRustLM.com Connect user plugin. Package
  inclusion and network use remain explicit opt-ins. The lanes must not share
  identity, credentials, consent, scope, or receipt authority. Received
  records remain untrusted data, and fixture behavior is not authenticated
  live-service evidence.
- `TinyRustLM.Conversion` is private local-feed tooling around the exact
  `tinyrustlm-convert` executable. It invokes only the registered
  `qwen3-composition` transaction, binds both expected source-lock hashes and
  the profile hash, owns bounded process-tree cancellation, and independently
  validates the ten-file terminal inventory, operation and receipt lineage,
  component-receipt identities, and all six streamed artifact hashes. It is
  not eligible for the public publish allowlist and exposes no component-level
  managed success API.

There is no local memory facade package, branded alias package family, or
parallel package graph.

## Runtime Boundary

`TinyRustLM.Core` validates the native self-description and exact fifteen-symbol
ABI before creating a runtime. Managed input is copied across a bounded
pointer-plus-length interface. Native UTF-8 JSON is released only through the
native string owner, and runtime handles use `SafeHandle` lifetime ownership.

The managed state machine can:

1. inspect exact SLM2 bytes;
2. create an empty bounded runtime;
3. fail-atomically activate one complete ACG2 composition;
4. advance an immutable operation identity;
5. set the presentation-owned transcript revision;
6. begin one Prompt2 request;
7. step composition-owned Sampling2 generation, including cancellation;
8. finish with unmodified raw terminal output; and
9. inspect bounded state and dispose the runtime.

The caller cannot provide alternate sampling defaults, load a partial
composition, repair output, select the best retry, or fall back to another
runtime.

## P2P Boundary

`TinyRustLM.P2P` prepares immutable four-MiB pieces and a canonical manifest,
reinspects manifest bytes, and create-only assembles a complete artifact after
piece, Merkle, whole-artifact, and semantic verification. SLM2 transport is
bound to an exact ACG2 composition. ACG2 transport is admitted as a complete
five-member graph.

The package intentionally does not own discovery, catalog publication, peer
announcement, signatures, public reachability, network fallback, or hosted
model bytes. Those concerns require separate evidence and cannot be inferred
from local piece assembly.

## Supported Native Assets

The current release RIDs are exactly:

- `win-x64` with `runtimes/win-x64/native/tinyrustlm_native.dll`;
- `linux-x64` with `runtimes/linux-x64/native/libtinyrustlm_native.so`; and
- `linux-arm64` with `runtimes/linux-arm64/native/libtinyrustlm_native.so`.

The release workflow builds and executes native contract tests on matching
Windows x64, Linux x64, and real Linux ARM64 runners. Cross-compilation and
binary-header inspection are useful supporting evidence but do not replace
real ARM64 execution.

## Package Transaction

Use a new absent or empty output directory for every transaction. The scripts
refuse a nonempty directory so current bytes cannot be mixed with an earlier or
failed attempt. They never clean an unknown output directory.

PowerShell, current host RID:

```powershell
eng\verify-package.ps1 `
  -Configuration Release `
  -PackageOutput artifacts\packages-review-001
```

PowerShell, release aggregation after all three native assets have been built
on matching systems and placed under `artifacts/native/<rid>`:

```powershell
eng\verify-package.ps1 `
  -Configuration Release `
  -PackageOutput artifacts\packages-release-001 `
  -RequiredNativeRids win-x64,linux-x64,linux-arm64
```

Bash uses the same state machine. Exact optional package inclusion is explicit
through closed environment switches:

```bash
TINYRUSTLM_INCLUDE_OPTIONAL_MEMORY_ENDPOINTS=1 \
TINYRUSTLM_INCLUDE_PRIVATE_CONVERSION=1 \
TINYRUSTLM_REQUIRED_NATIVE_RIDS=linux-x64 \
eng/verify-package.sh Release artifacts/packages-private-review-001
```

The transaction:

1. runs `cargo fmt --all --check`;
2. runs warnings-denied Clippy and tests for the exact current Rust closure;
3. builds the host native runtime and optional private converter;
4. restores and builds explicit managed projects rather than a stale aggregate;
5. runs current core and package tests;
6. packs the exact selected package IDs and matching `.snupkg` files;
7. canonicalizes package archives;
8. writes and validates `tinyrustlm-nuget-package-audit.json`;
9. installs the packed bytes into an isolated consumer with isolated NuGet
   caches;
10. executes SLM2 inspection, native contract and runtime ownership, ACG2/SLM2
    fixed-piece round trips, collision rejection, and tamper rejection; and
11. writes `SHA256SUMS-TinyRustLM-<version>.txt` and a bounded folder-feed
    readme.

The package audit is baseline-driven. Checked-in files under `eng/public-api`
define the approved XML documentation member set. The audit also checks package
IDs and versions, dependency closure, metadata, archive allowlists, native RID
placement, symbol packages, portable PDBs, package documentation hashes,
canonical ZIP timestamps, private-surface leakage, source/debug/generated-path
leakage, absolute paths, and unexpected files.

## Local Consumer Proof

The package transaction runs the consumer automatically. It may also be run
against an exact folder feed or published feed:

```powershell
eng\verify-consumer.ps1 `
  -PackageSource artifacts\packages-review-001 `
  -PackageVersion 0.1.8
```

The consumer is created under a uniquely owned temporary root, uses isolated
global and HTTP NuGet caches, references package bytes rather than project
references, verifies the package-local native runtime, and removes only its
marked temporary root.

## Publication Boundary

The owner's September 19 instruction is to keep NuGet publication current at
`https://www.nuget.org/profiles/Michael.Kappel`. Include feed freshness in each
SDK release checkpoint: compare the exact public IDs and version, complete the
package/native/consumer checks, publish eligible updates and verify feed payloads.
Source commits and local packages are not publication. Older `UAIX.Browser.*`
listings do not authorize recreating retired implementations.

The current observation is recorded in
`artifacts/ecosystem-cleanup-20260912/nuget-publication-current-review.json`.
All three current package indexes returned HTTP 404; source version is `0.1.8`.
GitHub's default branch is older than the canonical branch, its release workflow
is not registered, repository Actions secrets are empty, and the `nuget-release`
environment is absent. Only win-x64 native output is present locally. No new
package was published.

The daily feed monitor no longer requires an opt-in variable in source. GitHub
schedules use the default branch, so committing this change to the development
branch does not activate it. Reconcile the workflow branch and publishing
authentication during release preparation. Configure credentials in GitHub/NuGet
settings, never in chat or source.

Both feed-current implementations recognize absence only from package-index
HTTP 404. Authentication failures, rate limits, outages, disconnects and malformed
indexes abort the lookup. The readiness audit clears its prior observation first,
so these failures become `blocked_feed_status_unknown`, not permission to push.

Run the feed-failure regression checks with
`node --test tinyrustlm/tests/verify-feed-current.test.js`. They require PowerShell
and Python 3 on PATH. On Windows, an installed WSL Python may be selected explicitly
with `TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION`; no particular distribution or local
source path is built into the tests. The tests use loopback HTTP and owned temporary
reports, without contacting NuGet or publishing packages.

Only `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`, plus
their matching symbol packages, may enter the public publish plan. Optional or
unknown TinyRustLM packages make publication fail before any push.

After a successful package transaction, create a no-push plan bound to the
audit and SHA-256 manifest:

```powershell
eng\publish-nuget.ps1 `
  -SkipVerification `
  -DryRun `
  -PackageSource artifacts\packages-release-001 `
  -AuditReport artifacts\packages-release-001\tinyrustlm-nuget-package-audit.json
```

`-SkipVerification` does not bypass archive or consumer evidence. It means the
immutable package transaction already ran and the publish command must consume
those exact audited bytes instead of rebuilding them. A missing, failed, or
hash-mismatched audit and a missing or mismatched SHA-256 manifest block the
publish plan.

Real push requires a scoped API key or the release workflow's short-lived
NuGet.org Trusted Publishing credential. The scripts redact credentials,
publish primary and symbol packages explicitly, preserve partial-push failure
evidence, and never count local package creation as publication.

## Feed And Public Readback

After indexing, all three public package IDs must expose the source-declared
version:

```powershell
eng\verify-feed-current.ps1 -NuGetSource https://api.nuget.org/v3/index.json
```

The retained publish plan then binds exact feed bytes:

```powershell
eng\verify-feed-package-hashes.ps1 `
  -NuGetSource https://api.nuget.org/v3/index.json `
  -PublishPlanReport artifacts\reports\tinyrustlm-nuget-publish-plan.json
```

An optional clean consumer smoke can execute the package from the feed:

```powershell
eng\verify-feed.ps1 -NuGetSource https://api.nuget.org/v3/index.json
```

Package creation, upload logs, and successful version lookup remain weaker than
exact feed-byte and clean-consumer public readback. Publication is claimed only
after the required readback reports pass.

## Claim Limits

Package verification proves the managed distribution boundary for the tested
bytes. It does not prove that a real model is useful, converted, numerically
equivalent, browser-compatible, available from a public peer, announced in a
catalog, deployed on a website, or connected to MemoryEndpoints. Those claims
need their own content-addressed evidence.

See [API_BOUNDARY.md](API_BOUNDARY.md),
[PACKAGE_SECURITY.md](PACKAGE_SECURITY.md), and
[PRIVATE_FEED.md](PRIVATE_FEED.md) for the normative package, security, and
review-feed procedures.

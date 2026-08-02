# TinyRustLM .NET P2P Seed Host Release Memory

Date: 2026-07-13
Status: local distribution complete; public NuGet.org publication not authorized

## Current implementation truth

TinyRustLM now has a downloadable operational P2P companion without creating a
second chat application. Rust remains authoritative for MiniModel manifests,
`.slm` inspection, pieces, Merkle identity, companion state, imports, receipts,
external reachability proof, and announcement eligibility. The managed surface
is the `UAIX.Browser.p2pRuntime.SeedHost` library and the
`UAIX.Browser.p2pRuntime.SeedHost.Tool` command `uaix-p2p-seed`.

One fleet has exactly two independent lane processes total and admits at most
20 distinct model identities. Both lanes reference the same read-only artifact
and piece store. Local probe success remains local health only. Public
announcement remains fail-closed until a current Rust-validated external
observer receipt exists.

## Published local NuGet artifacts

The transactional publisher promoted version `0.1.9` to
`E:/Source/WP/UAIX-Publish/DOTNET-NUGET` only after pre-publish and
published-feed verification. It did not publish to NuGet.org.

| Artifact | SHA-256 |
| --- | --- |
| `UAIX.Browser.p2pRuntime.SeedHost.0.1.9.nupkg` | `73bf768c7baa484f929ea9ba10997a726358f9e6af1f0c20aab9eb33eaec2a68` |
| `UAIX.Browser.p2pRuntime.SeedHost.0.1.9.snupkg` | `d7f41b6686b72ad660eaf28e67dcd02e0570f5ab69847d0f9db2289e314cff0b` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.9.nupkg` | `89cd8aad8551d96c58fc555c202822e5fbc78ffec018c4890d7bca7a97830a58` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.9.snupkg` | `1e74f0af232e06500cb8967f316c1e25a94c0428dc53901388de4cb62fc186a8` |

The feed also contains a README and checksum manifest. Exact dependency bounds,
portable symbols, SourceLink, native RID selection, package entry allowlists,
clean C# and F# consumers, installed-tool execution, ABI v2, missing-native and
wrong-architecture diagnostics, a real fixture peer import, and graceful
two-lane shutdown all passed. The final independent package audit is
`artifacts/reports/seed-host-package-audit-0.1.9-20260714-0002119535462.json`.
It records `model_weights_included=false`,
`private_authoring_surface_included=false`, `secret_material_included=false`,
and `status=passed`.

## Self-contained releases

Canonical self-contained releases are under `artifacts/releases`. Every
payload includes its release receipt and SPDX SBOM; the checksum manifest binds
all nine archive, receipt, and SBOM files.

| RID archive | SHA-256 |
| --- | --- |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.9-win-x64.zip` | `d38af2c135b1304c1958e5023e4180a90cf839dd1000d7bca213be104b7dc4b3` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.9-linux-x64.tar.gz` | `8564e735e636d4d32653a25164aef170d50aefb71ba621348733573ca7e3f1e1` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.9-linux-arm64.tar.gz` | `5ae0835408eac6776c245d2b55702a1038a2b2cd10b56776e7b3460086641759` |
| `SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost.Tool-0.1.9.txt` | `64a5919483e95ceb8e00a57a36b67b173b87b805978dae02e3a0669285edcd6c` |

Windows x64 and Linux x64 executed natively. Linux ARM64 executed under
`qemu-aarch64-static` with a hash-pinned Ubuntu ARM64 verification sysroot.
Each execution proved `doctor`, ABI v2 loading, `init`, Rust fleet inspection,
`inspect`, twenty-model capacity, and exactly two lanes. Archive traversal,
duplicate entries, Unix execute modes, receipt identity, SBOM validation, and
checksums passed. The previous ten top-level release files were preserved under
`artifacts/releases/Archive/pre-probe-hardening-0.1.9-b346127e4df94ceaa3e635929416245c`.

## Defects found and closed during release

The package gate exposed a load-sensitive local probe. Local endpoint timeouts
now retry with a fresh bounded cancellation source for each attempt; caller
cancellation still stops immediately. The two-lane lifecycle passed repeated
start, health, independent stop, and remaining-lane checks using the production
two-second endpoint budget.

A fresh Rust build then exposed that the checked-in MiniModel peer-import
example contained fields rejected by the current strict
`deny_unknown_fields` schema. The canonical example now contains only the
executable request contract. A no-artifact Rust regression test parses and
validates that example through the authoritative type, and the missing-field
test mutates JSON structurally instead of depending on whitespace.

## Verification summary

- TinyRustLM .NET solution: 149 tests passed (`54` package, `72` core, `23`
  SeedHost), with zero failures.
- MiniModel Rust workspace: all 147 tests passed; formatting passed; Clippy
  passed with warnings denied.
- TinyRustLM Rust workspace: all workspace tests and doc tests passed;
  formatting passed; Clippy passed with warnings denied.
- Report intake: 12 reports, 132 durable hash routes, zero active source files,
  and zero mismatches.
- Transaction tests proved clean-feed promotion and same-name archive collision
  preservation without deleting prior bytes.

## Protected boundary and remaining operations

The packages do not include model conversion authoring, quantization authoring,
training, adapter authoring, breeding, lineage promotion, premium routing,
optimizer internals, telemetry backends, license-server internals, encryption
keys, premium weights, or proprietary ranking and orchestration logic.

Production signing credentials were not used. NuGet.org publication was not
performed. No live public peer announcement was created, because local health
is not external reachability proof. Windows Scheduled Task/Service and Linux
systemd installation remain operator-selected lifecycle operations and must be
validated on their target machines. The current package and release evidence
must not be promoted into claims for public reachability, public catalog
availability, or public package signing.

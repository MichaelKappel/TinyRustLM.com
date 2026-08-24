# TinyRustLM

TinyRustLM is a prelaunch browser-local language-model system. Rust owns model
formats, composition, tokenization, template rendering, sampling, prompt
assembly, inference, conversion, and direct-piece admission. The browser owns
the user experience and transports typed bytes to the same Rust authority
compiled to WebAssembly. The .NET SDK is a checked managed boundary over the
canonical native ABI.

This repository is the canonical Rust source root. No TinyRustLM product has
launched, so there is no product V1/V2 split or customer compatibility surface.
Names such as SLM2, ACG2, Tokenizer2, Template2, Sampling2, Prompt2, ABI
revisions, schemas, and package versions are exact technical identities. They
are not product generations.

## Current Status

Repository package version: `0.1.8`.

Lifecycle: prelaunch. No package, model, deployment, P2P-reachability, or live
service claim follows from a local build.

The following evidence is complete for its exact bound bytes:

- the SLM2 structural parser, canonical tensor registry, hostile corpus, and
  scalar fixture runtime;
- native, raw-WASM, Node-WASM, and Chromium replay of the canonical scalar
  fixture;
- the full Qwen3 Tokenizer2 native and two-profile Chromium-WASM parity gate;
- exact publisher-source-to-native Template2 rendering parity for the frozen
  supported Qwen3 branch;
- the complete create-only Qwen3 six-artifact composition conversion
  transaction, its strict managed process owner, and the private Companion
  source-branch integration, without a real-source run;
  and
- the current fifteen-symbol native ABI and canonical managed SDK surface.

These results do not prove a real production model, model quality, a complete
real-source conversion, production acquisition, a public peer, a deployed
browser conversation, or package publication. The next path must preregister
and implement restart-safe private Companion transport, then prove exact
source/native/browser numerical parity and untouched quality before promotion.

Campaign counters remain:

- qualified models: `0/20`;
- deletion-backed clean-browser rounds: `0/50`;
- authorized live MemoryEndpoints rounds: `0/25`;
- current outside-network lane proofs: `0/40`; and
- live catalog announcements: `0/20`.

MemoryEndpoints is unauthorized and disconnected. Its optional contract code
and fixtures are not evidence of a live account, enrollment, continuity,
cleanup, or production service.

## Sole Architecture

| Responsibility | Authority |
| --- | --- |
| Model artifact | `tinyrustlm-slm2` |
| Atomic composition | `tinyrustlm-composition2` |
| Tokenization | `tinyrustlm-tokenizer2` |
| Chat rendering | `tinyrustlm-template2` |
| Sampling | `tinyrustlm-sampling2` |
| Prompt assembly | `tinyrustlm-prompt2` |
| Conversation runtime | `tinyrustlm-runtime` |
| Browser runtime boundary | Rust compiled to WebAssembly |
| Source conversion | `tinyrustlm-convert` |
| Native ABI | `tinyrustlm-native` |
| Managed runtime | `TinyRustLM.Core` |
| Fixed-piece direct transport | `tinyrustlm-p2p` and `TinyRustLM.P2P` |
| Browser presentation | `tinyrustlm/app` |

One activated ACG2 composition binds exactly one SLM2 model, Tokenizer2,
Template2, Sampling2, and Prompt2 artifact. Every member has an exact content
identity and profile. Rust validates all members and their cross-contract
invariants before fail-atomic activation. JavaScript and .NET do not repair,
reinterpret, partially activate, or provide fallback members.

`tinyrustlm-convert qwen3-composition` is the sole complete conversion command.
Its Qwen3 model and Tokenizer2 operations are internal exact compiler
primitives; an individual component receipt is not composition availability.
The private managed wrapper now invokes only this complete command, and the
private Companion source branch reaches `Available` only from its six verified
artifact identities. The deterministic process fixture proves orchestration,
not a real complete-command pass.

The production source target remains the immutable `Qwen/Qwen3-0.6B` revision
recorded in the architecture contracts. Source selection is not quality
promotion. F32 remains the numerical conversion oracle, and the first compact
candidate is the explicitly specified mixed-Q8 SLM2 profile. Q4, Q5, ternary,
one-bit, TurboQuant-like, TurboVec-like, and compressed-KV profiles remain
experiments until their own contracts and quality evidence exist.

## Required User Flow

The release is not complete until the browser performs this exact journey:

1. The user selects a supported model.
2. The browser asks the local companion for the exact composition identity.
3. A current verified direct peer is preferred when one genuinely exists.
4. Otherwise the companion acquires the pinned upstream source and performs
   reviewed deterministic local conversion.
5. The browser streams, hashes, validates, persists, and transactionally
   activates the exact composition.
6. Rust WebAssembly performs genuine local inference.
7. A useful multi-turn conversation renders each raw assistant answer once.

A `.txt`, JSON request, PowerShell file, shell script, conversion request, or
fixture response is never a substitute for the requested working-model action.
Model bytes and prompts must not pass through a TinyRustLM, MiniModel, or other
project-hosted website.

## Repository Layout

- `rust/crates/` contains the canonical Rust formats, runtime, converter,
  native boundary, direct-piece transport, durability, and evidence crates.
- `tinyrustlm/` contains browser assets, WebAssembly adapters, conformance
  tools, tests, and bounded public-safe experiment results.
- `contracts/vnext/` contains machine-readable current technical contracts and
  preregistrations. The directory name is historical branch vocabulary; it
  does not name a second product generation.
- `dotnet/` contains the managed SDK, optional connector, private conversion
  wrapper, samples, and tests.
- `eng/` contains create-only build, package, audit, consumer, publication,
  feed-readback, and release-readiness tools.
- `docs/architecture/` records current ownership, accepted evidence, precise
  claim boundaries, and remaining gates.
- `docs/nuget/` is the authoritative managed SDK and release documentation.
- `wiki/runtime-mirust/` retains durable project memory and historical evidence
  without making old behavior executable.

Large model files, raw private outputs, browser profiles, training data,
credentials, and generated evidence stay outside Git on operator-owned `E:` or
`C:` storage. Project work must never write them to `D:`.

## Build And Test

Prerequisites:

- current stable Rust with the required WASM target;
- .NET SDK 8;
- Node.js 24 and `npm ci --prefix tinyrustlm` for browser tests;
- Python 3.12 only for pinned offline source-oracle and training tooling; and
- Playwright's pinned Chromium when a registered browser gate requires it.

Build the canonical Rust workspace:

```powershell
cargo build --workspace --locked
```

Run Rust formatting, checks, tests, and warnings-denied Clippy:

```powershell
cargo fmt --all --check
cargo check --workspace --all-targets --locked
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
```

Build the managed solution:

```powershell
dotnet build dotnet/TinyRustLM.sln -c Release
```

Run the managed package and core test projects:

```powershell
dotnet test dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj -c Release
dotnet test dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj -c Release
```

Run the canonical Node unit partition through its serialized launcher:

```powershell
npm --prefix tinyrustlm run test:unit -- E:\TinyRustLM-private-evidence\unit-gate
```

Every one-shot preregistered experiment has its own execution authority. Do not
rerun a completed Tokenizer2 or Template2 observation through a generic test
command.

## .NET Package Graph

The default public package transaction contains exactly:

| Package | Role |
| --- | --- |
| `TinyRustLM.Abstractions` | Immutable managed contracts |
| `TinyRustLM.Core` | Exact native ABI and bounded conversation runtime |
| `TinyRustLM.P2P` | Composition-bound fixed-piece preparation and assembly |

Two packages are excluded by default:

- `TinyRustLM.MemoryEndpoints` is an optional disconnected connector contract.
- `TinyRustLM.Conversion` is private local tooling for the exact
  `tinyrustlm-convert` process.

There is no alternate branded package family, configurable package-ID prefix,
local memory facade, browser-specific duplicate package lane, public conversion
package, or compatibility package.

The current native release RID set is exactly `win-x64`, `linux-x64`, and
`linux-arm64`. Cross-compilation proves only binary production and inspection;
real-hardware execution requires separate evidence.

Create and verify an exact host-RID default package transaction in a new output
directory:

```powershell
eng\verify-package.ps1 -PackageOutput artifacts\packages-current
```

Include the disconnected optional connector or private converter only when the
specific audit requires them:

```powershell
eng\verify-package.ps1 `
  -PackageOutput artifacts\packages-expanded `
  -IncludeOptionalMemoryEndpoints `
  -IncludePrivateConversion
```

The output directory must be absent or empty. The transaction builds explicit
projects, canonicalizes package archives, audits exact identities, dependencies,
contents, public API baselines, native assets, symbols, metadata, and hashes,
then installs exact package files into an isolated consumer cache.

See:

- `docs/nuget/README.md` for package commands and boundaries;
- `docs/nuget/API_BOUNDARY.md` for the public managed contract;
- `docs/nuget/PACKAGE_SECURITY.md` for package and supply-chain gates; and
- `docs/nuget/PRIVATE_FEED.md` for publication-state semantics.

## Publication

Only a clean committed source revision may produce release evidence. Local
HEAD, the configured upstream, a fresh `FETCH_HEAD`, and the actual remote
branch must agree before a release transaction begins. Packages are immutable;
an uploaded version is never rebuilt or replaced.

After a clean source-bound package transaction, create a no-push plan:

```powershell
eng\publish-nuget.ps1 `
  -PackageSource artifacts\packages-current `
  -SkipVerification `
  -DryRun
```

Then verify the exact local folder as a feed:

```powershell
eng\verify-feed-current.ps1 -NuGetSource artifacts\packages-current
eng\verify-feed-package-hashes.ps1 -NuGetSource artifacts\packages-current
```

`eng\audit-nuget-release-readiness.ps1` evaluates local evidence, target-feed
state, authorization mode, and blockers without converting an external blocker
into a skip. A successful pack or dry run is not publication. Completion
requires registry indexing, exact public byte readback, symbol evidence, clean
public-feed consumption, and affected-site HTTPS readback.

No production package publication is asserted by this README.

## Security And Evidence Rules

- Unknown schema fields, profiles, members, routes, operations, and package IDs
  fail closed.
- Parsing and rendering are bounded before allocation.
- Artifacts are streamed for hashing and promoted create-only after validation.
- Activation, conversion, piece assembly, and release output are transactional.
- Raw model output is preserved and rendered exactly once without repair.
- Sampling uses declared product behavior; best-of-N selection is forbidden.
- Quoted, retrieved, and hosted memory is untrusted data.
- Credentials, invitation URLs, tokens, raw prompts, private paths, and model
  bytes never enter public receipts, screenshots, logs, or source control.
- Mocks, fixtures, local probes, cross-compilation, package files, and HTTP
  success are never relabeled as live or public evidence.
- Failed and obsolete receipts remain append-only evidence and are never
  overwritten into passes.

## Documentation And Change Discipline

Architecture, developer, package, product, marketing, and pure documentation
sites are release surfaces. Every coherent major change that builds and passes
its affected tests is committed and pushed promptly. Every affected site is
deployed when its complete gate passes, with a visible version, release date,
last-published fact, consistent update log, and independent HTTPS readback.

Historical reports may describe superseded facts, but current instructions,
tests, package metadata, workflows, and executable code must describe only the
sole current architecture. No alias, migration, compatibility reader, fallback,
temporary adapter, disabled old route, or known debt is retained for a product
that has not launched.

The authoritative execution goals are:

- `docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md`;
- `docs/architecture/2026-08-20-production-slm2-acquisition-browser-release-goal.md`;
- `docs/architecture/2026-08-24-production-slm2-clean-cut-preregistration.md`;
- `docs/architecture/qwen3-tokenizer2-browser-wasm-preregistration.md`; and
- `docs/architecture/qwen3-template2-source-parity-preregistration.md`.

The project is complete only when one provenance-bound useful model passes
untouched screening, deterministic SLM2 conversion, scalar-native and real-
browser WASM conformance, verified P2P-or-convert acquisition, and genuine
multi-turn browser-local chat, then is documented, committed, pushed, deployed,
and independently read back. The broader 20-model and 50-round campaign remains
separate work.

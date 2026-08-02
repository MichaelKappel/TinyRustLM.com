# TinyRustLM

Canonical Rust source root for the TinyRustLM client-side SLM runtime and browser-local UI.

Current public app route: `https://TinyRustLM.com/`.
Current developer portal: `https://TinyRustLM.MiRust.com/developer-portal/`.
`Runtime.MiRust.com` is retired as a separate documentation authority, and `SLMComposer.com` is no longer the canonical public app identity.

The active implementation target is `tinyrustlm/`: a 100% custom Rust/WASM browser-local AI app named TinyRustLM. The runtime is zero-dependency by design: no third-party Rust crates, no JavaScript frameworks, no tokenizer libraries, no inference frameworks, no package-manager runtime, no remote inference API, and no CDN dependency.

## Active Workspace

- `TinyRustLM.sln`: Visual Studio 2022 solution wrapper for building and running the Rust/WASM app through NMake.
- `tinyrustlm/app/`: static browser UI with handwritten HTML, CSS, JavaScript, local-only notice, local conversation transcript, diagnostics, benchmark panels, Step Token console control, graph-backed model selection, developer console, and product footer.
- `tinyrustlm/runtime/`: no-crate Rust runtime for WASM exports, memory transfer, `.slm` parsing, f32/q8_0/q4_0 `ADP1`, `ASP1`, and `ALR1` adapter apply, tokenizer, math kernels, quant helpers, KV cache, sampler, diagnostics, and native eval-case execution.
- `tinyrustlm/tools/slm_pack/`: no-crate Rust utility for `.slm` authoring and validation, trained-source conversion, immutable composition graphs, provenance/runtime/evaluation evidence, direct-parameter and adapter-fusion operators with receipts, the standard candidate/promotion/admission pipeline, population and parent-pool planning, and graph-backed selector registries.
- `tinyrustlm/tools/local_server/`: no-crate Rust static server for local browser hosting, Visual Studio F5, and browser-smoke startup.
- `tinyrustlm/tools/browser_harness/`: no-crate Rust mini browser contract harness for static app crawl, local-only asset policy, immutable graph activation checks, and optional loopback route checks.
- `tinyrustlm/docs/`: architecture, `.slm`, tokenizer, quantization, browser runtime, testing, and performance notes.
- `tinyrustlm/tests/fixtures/`: small text fixtures for runtime tests.
- `.uai/`: hot Project Handoff memory and routing state.
- `wiki/runtime-mirust/`: local LLM Wiki source namespace for AIWikis publication.
- `agent-file-handoff/Content` and `agent-file-handoff/Improvement`: active intake buckets only.

## Web-To-Companion Boundary

`UAIX.Browser.p2pRuntime.SeedHost`,
`UAIX.Browser.p2pRuntime.SeedHost.Tool`, and the `uaix-p2p-seed` command provide
the downloadable P2P companion. TinyRustLM.com remains the browser chat UI and
MiniModel.org remains the catalog and discovery authority, while the companion
owns direct peer import, Rust verification, durable restart and resume state,
local model storage, and optional two-lane sharing. Version
`0.1.10` adds the production loopback bridge with exact Host and Origin checks,
one-time pairing, short-lived operation-scoped capabilities, rotation,
revocation, bounded requests, and receipt-revalidated model streaming.

The `public-local-only` gate proves the browser starts with no project-hosted
model and no autoload fallback. A
proof-ready MiniModel row remains `Set Peer URL` until the user supplies a
consenting peer or loads a Rust-valid signed announcement with current external
proof. Browser-only operation can `Save P2P Import Kit`; a paired companion can
`Import & load` or `Resume & load`. Model bytes travel only from peer to the
user-run companion and then to browser-local WASM. Prompts and responses never
go to the companion or a public project domain.

The acceptance suite in `tinyrustlm/e2e/companion.spec.js` executes one-time
pairing replay rejection, two-peer identity disagreement, direct import,
companion restart/resume, revocation, and a 969,648,576-byte Qwen
import-to-WASM conversation. `tinyrustlm/e2e/conversation.spec.js` verifies the
locked empty-state transition and exactly one assistant renderer. See
`docs/nuget/SEED_HOST.md` for install and bridge operation.

## Current Status

TinyRustLM implements the static browser shell, WASM memory boundary, byte and custom BPE tokenizers, `.slm` parsing, f32/q8_0/q4_0 kernels, KV-cache-backed generation, deterministic smoke fixtures, trained-source conversion, and native evaluation.

The browser model selector has one accepted deployment contract. Every generated entry is backed by a standard selector admission record and an immutable `.acg1` composition graph whose route and checksum bind the complete `.slm` artifact. The browser does not expose mutable adapter-family, assembly, or module-plan controls, and it does not accept a separate multi-parent admission schema.

Offline blend, delta, sparse-delta, sign-merge, soup, and adapter-fusion operators emit recomputable receipts. Sign-merge and soup receipts now carry deterministic child IDs derived from the output checksum plus fixed operator IDs, so they enter the same receipt-bound `candidate-manifest`, `promotion-template`, and `admission-record` pipeline as every other candidate. There is no second quality path.

Runtime smoke proves execution only. Assistant-quality promotion still requires passed task-evaluation evidence and a declared quality scope; structural validity, conversion, or one attractive response is not a quality claim.

## Intended Commands

Run these once a Rust toolchain is installed or exposed:

Product, candidate, checkpoint, raw-tensor, and P2P piece bytes are not stored
in Git. Set `TINYRUSTLM_MODEL_PATH` to an absolute path under the
operator-controlled external model store. The example manifest is generated
under `target`; neither path is campaign qualification evidence by itself.

```powershell
$env:TINYRUSTLM_MODEL_PATH = '<absolute external .slm path>'
$env:TINYRUSTLM_MODEL_MANIFEST_PATH = '.\target\external-model.slm.manifest'
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo rustdoc -p tinyrustlm-runtime --lib -- -D missing_docs
cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs
cargo rustdoc -p tinyrustlm-local-server --bin tinyrustlm-local-server -- -D missing_docs
cargo rustdoc -p tinyrustlm-browser-harness --bin tinyrustlm-browser-harness -- -D missing_docs
rustup target add wasm32-unknown-unknown
cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown
Copy-Item .\target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm .\tinyrustlm\runtime\tinyrustlm.wasm
cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm.wasm .\tinyrustlm\runtime\tinyrustlm.wasm.manifest
cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown --features wasm-simd
Copy-Item .\target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm .\tinyrustlm\runtime\tinyrustlm-simd.wasm
cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm-simd.wasm .\tinyrustlm\runtime\tinyrustlm-simd.wasm.manifest
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model.slm tiny-fixture
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-bpe.slm tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-tied.slm tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- manifest $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_MANIFEST_PATH converted-trained
cargo run -p tinyrustlm-slm-pack -- validate-manifest $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_MANIFEST_PATH
cargo run -p tinyrustlm-slm-pack -- compatibility $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-self.compat
cargo run -p tinyrustlm-slm-pack -- lineage-template .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage tinylm16-q8-self-candidate identity-parent-set browser-local-16m-budget
cargo run -p tinyrustlm-slm-pack -- validate-lineage .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage
cargo run -p tinyrustlm-slm-pack -- blend-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.operator
cargo run -p tinyrustlm-slm-pack -- validate-blend-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.operator
cargo run -p tinyrustlm-slm-pack -- delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-delta.slm .\target\model-breeding\tinylm16-q8-delta.operator 1000000
cargo run -p tinyrustlm-slm-pack -- validate-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-delta.slm .\target\model-breeding\tinylm16-q8-delta.operator
cargo run -p tinyrustlm-slm-pack -- sparse-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-sparse-delta.slm .\target\model-breeding\tinylm16-q8-sparse-delta.operator 1000000 250000
cargo run -p tinyrustlm-slm-pack -- validate-sparse-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8-sparse-delta.slm .\target\model-breeding\tinylm16-q8-sparse-delta.operator
cargo run -p tinyrustlm-slm-pack -- adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest
cargo run -p tinyrustlm-slm-pack -- validate-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest
cargo run -p tinyrustlm-slm-pack -- sparse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1 .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1.manifest 1000000 250000
cargo run -p tinyrustlm-slm-pack -- validate-sparse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1 .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1.manifest
cargo run -p tinyrustlm-slm-pack -- low-rank-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1 .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1.manifest 1
cargo run -p tinyrustlm-slm-pack -- validate-low-rank-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1 .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1.manifest
cargo run -p tinyrustlm-slm-pack -- fuse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest .\target\model-breeding\tinylm16-q8-adapter-fused.slm .\target\model-breeding\tinylm16-q8-adapter-fuse.operator
cargo run -p tinyrustlm-slm-pack -- validate-fuse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest .\target\model-breeding\tinylm16-q8-adapter-fused.slm .\target\model-breeding\tinylm16-q8-adapter-fuse.operator
cargo run -p tinyrustlm-slm-pack -- sign-merge-candidate .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator --parents $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- validate-sign-merge-candidate .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator --parents $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_PATH --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
# Continue sign-merge and soup outputs through the standard lineage, candidate,
# promotion, admission, composition-graph, and selector-registry commands.
# Use the exact candidate_id and operator_id recorded in the operator receipt,
# and pass that receipt as the final optional input at each quality phase.
cargo run -p tinyrustlm-slm-pack -- candidate-manifest .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate
cargo run -p tinyrustlm-slm-pack -- validate-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate
cargo run -p tinyrustlm-slm-pack -- promotion-template .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate .\target\model-breeding\tinylm16-q8-self.promotion local-smoke-runner browser-local-runtime-smoke-and-eval
cargo run -p tinyrustlm-slm-pack -- validate-promotion .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate .\target\model-breeding\tinylm16-q8-self.promotion
cargo run -p tinyrustlm-slm-pack -- manifest .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest deterministic-smoke
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest .\target\model-breeding\tinylm16-q8-blend.runtime
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny tiny-fixture
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny .\target\trained-source-smoke\tiny-converted-f32.slm f32
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny .\target\trained-source-smoke\tiny-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny .\target\trained-source-smoke\tiny-converted-q4.slm q4_0
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-tied tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-tied
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-bpe tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-bpe
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-bpe .\target\trained-source-smoke\tiny-bpe-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\target\trained-source-smoke\tiny-converted-q8.runtime
cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest assistant-quality .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- eval-template $env:TINYRUSTLM_MODEL_PATH $env:TINYRUSTLM_MODEL_MANIFEST_PATH "${env:TINYRUSTLM_MODEL_PATH}.eval" assistant-quality
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Then serve the static app with the checked-in no-crate Rust static server:

```powershell
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Visual Studio 2022:

```text
Open TinyRustLM.sln, then Build Solution and press F5.
```

F5 reuses an already-running TinyRustLM server only after checking the app page and WASM route. If port 8080 is occupied by another local service, the run helper walks to the next free loopback port. See `docs/visual-studio.md` for the exact prerequisites and helper scripts.

## NuGet SDK

The protected NuGet distribution lives under `dotnet/`, `rust/crates/`, `eng/`, and `docs/nuget/`. It packages only the public ecosystem surface: `.slm` validation/inspection, native-backed runtime harness operations, metadata-bound P2P share/import workflows, local signed-manifest verification, local manifest-piece verification and assembly with receipt sidecars plus receipt inspection, .NET wrappers, tests, samples, package metadata, and CI/release automation. It deliberately excludes `.slm` authoring internals, conversion tools, quantization authoring, adapter authoring or auto-assembly, selector generation, offline breeding, lineage promotion, eval/provenance authoring, premium routing, optimizer logic, encryption key handling, telemetry, license-server internals, commercial orchestration, and private training/model-ranking logic.

Current local release-gate evidence for July 6, 2026 is green for `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and `eng\verify-package.ps1`. The verifier rebuilt the native bridge, ran workspace rustfmt and clippy, ran focused Rust and .NET tests, packed the protected SDK packages, wrote the package audit, and passed the clean consumer install/runtime/P2P/memory smoke from local package references.

Run the full NuGet verifier from the repository root:

```powershell
eng\verify-package.ps1
```

On Unix-like shells, use `eng/verify-package.sh`.

Both verifiers build the public native bridge, run `cargo fmt --all --check`, run `cargo clippy --workspace --all-targets -- -D warnings`, run focused Rust and .NET tests, pack `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory` into `artifacts/packages`, verify package contents do not include private authoring surfaces, source files, debug symbols, generated build-output directories, or local absolute paths, then install the produced packages into a clean temporary console app and exercise `.slm` inspect/load/generate, UAIX `.uai` memory/persona package planning and inspection, plus metadata-bound P2P share/import, signed-manifest verification, announcement JSON handoff, catalog application and inspection, and receipt-inspection workflows from package references. The .NET wrapper exposes `GetVersion()`, typed `P2PShareKitReport` / `P2PShareMetadata` / `P2PSignedManifestVerification` / `P2PAnnouncementCatalog` / `P2PAnnouncementCatalogInspection` APIs, UAIX memory/persona package APIs with machine-checkable `FileDeck` counts, Wizard AI digest/starter ZIP/persona deck discovery through `GetSupportedSetups()`, and explicit raw JSON handoff helpers. See `docs/nuget/README.md`, `docs/nuget/API_BOUNDARY.md`, and `docs/nuget/MEMORY_HARNESS.md`.

The public P2P SDK validates announcement URLs directly: `PublicBaseUrl` and received manifest URLs accept HTTPS or explicit-port loopback HTTP only, and reject credentials, whitespace, query strings, fragments, backslashes, dot-segment traversal, and encoded traversal before metadata is trusted or announcement output is written. Received announcement catalogs deduplicate honest replays but reject conflicting same-peer/same-manifest metadata before mutation, and `InspectAnnouncementCatalog` gives consumers a typed SHA/count/byte inspection report with a 4 MiB catalog budget.

The public P2P SDK also verifies `tinyrustlm.p2p_signed_manifest.v0` envelopes against local metadata-only `minimodel.public_key.v0` public-key JSON. `VerifySignedManifest` validates the wrapped manifest, canonical payload SHA-256, `external-signature-v0`, `ed25519-base64:` signature bytes, matching publisher/key/route/SHA usage, and `revoked=false`, while leaving signing, private-key handling, remote key discovery, transparency-log policy, and commercial publisher services outside the protected NuGet package.

MiniModel signed-manifest verification now accepts only `signature.kind=external-signature-v0`, rejects comments and unsafe or missing key routes, requires `signature.payload_sha256` to match the canonical sorted non-signature manifest body, and prints that digest from `minimodel verify-manifest` for publisher review. `minimodel verify-signed-manifest <manifest> <public-key-json>` adds local Ed25519 verification against a metadata-only `minimodel.public_key.v0` public-key document with matching publisher, key, route, SHA-256, manifest-signing usage, and `revoked=false`. This hardens the public P2P/catalog intake without exposing private conversion, ranking, or commercial trust-policy internals; transparency-log inclusion and remote key-discovery policy remain later work.

Use `eng\publish-nuget.ps1 -SkipVerification -DryRun` after package verification to audit the package push set before publishing to NuGet or a private feed. Publish scripts require exactly the four source-versioned protected packages, reject stale or unintended extra `TinyRustLM*.nupkg` files before any push, require the packages to match the latest `tinyrustlm-nuget-package-audit.json` names, SHA-256 values, and byte counts, require `SHA256SUMS-TinyRustLM-<version>.txt` to match the same package bytes, and write `artifacts/reports/tinyrustlm-nuget-publish-plan.json` with package hashes, audit-binding evidence, SHA256SUMS manifest evidence, target feed evidence, redacted `push_failed` evidence for authenticated push failures, and no secret material.

For the UAIX Browser local folder feed, run:

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

This writes `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and the controlled local `UAIX.Browser.p2pLLM.Conversion` wrapper, preserves the `TinyRustLM.*` assembly/public namespace surface, moves non-matching root `.nupkg` / `.snupkg` files, stale same-ID Browser packages, and previous `SHA256SUMS-UAIX.Browser-*.txt` plus `README-UAIX.Browser-*.txt` feed files into the feed's `Archive` folder before replacing current Browser artifacts, and writes `SHA256SUMS-UAIX.Browser-<version>.txt` plus `README-UAIX.Browser-<version>.txt` for the exact current package and symbol package set.

After packing the Browser feed, run `eng\verify-browser-feed.ps1 -PackageSource <local-UAIX-Browser-feed>` to audit the exact five branded package IDs, nuspec metadata, required search terms, dependency graph, hash manifest, and local-path leakage. It writes `artifacts/reports/uaix-browser-nuget-feed-audit.json`.

Run `eng\publish-browser-nuget.ps1 -PackageSource <local-UAIX-Browser-feed> -DryRun` before any branded Browser push. It requires the `uaix.browser.nuget.feed_audit.v0` report, `SHA256SUMS-UAIX.Browser-<version>.txt`, generated `README-UAIX.Browser-<version>.txt`, all five `.nupkg` files, and all five `.snupkg` files to agree, then writes `artifacts/reports/uaix-browser-nuget-publish-plan.json` with schema `uaix.browser.nuget.publish_plan.v0`, including hash evidence for the feed README as symbol-visibility documentation. The real push path sends `.nupkg` packages with `--no-symbols`, then explicitly pushes each `.snupkg`. NuGet Package Manager generally lists installable `.nupkg` packages; each `.snupkg` is a debug-symbol sidecar verified through the local folder feed, generated `README-UAIX.Browser-<version>.txt`, `SymbolsPackage`/PDB evidence, SHA256SUMS membership, publish-plan hashes, and feed-hash reports.

To prove the branded Browser feed is current on NuGet.org or a private feed, run the same feed-current verifier with `TINYRUSTLM_FEED_PACKAGE_IDS=UAIX.Browser.Core.Abstractions,UAIX.Browser.p2pLLM.Runtime,UAIX.Browser.p2pRuntime.P2P,UAIX.Browser.Memory,UAIX.Browser.p2pLLM.Conversion` and `-ReportOutput artifacts/reports/uaix-browser-nuget-feed-current.json`. The feed monitor can run this path with `verify_browser_feed_current=true` or repository variable `UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT=true`.

Run `eng\audit-nuget-release-readiness.ps1` or `eng/audit-nuget-release-readiness.sh` for a no-push readiness audit that refreshes the dry-run publish plan, proves the local package folder through feed-current/feed-hash checks, checks the target feed, verifies target-feed bytes when the declared version is already listed, and writes `artifacts/reports/tinyrustlm-nuget-release-readiness.json` with blockers, next actions, `auth_mode`, and only non-secret credential metadata such as boolean `api_key_present`. The release workflow runs this audit with blocked-state failure before pushing, skips the push when the feed is already `published_current`, and still runs mandatory feed-current/feed-hash gates.

NuGet.org releases can use `.github/workflows/release-nuget.yml` with `auth_mode=trusted_publishing` after a NuGet.org trusted publishing policy is configured for workflow file `release-nuget.yml` and environment `nuget-release`; the workflow grants `id-token: write`, uses `NuGet/login@v1`, and passes the short-lived key into the same audited publisher. Private feeds and legacy NuGet.org releases use `auth_mode=api_key` with scoped `NUGET_API_KEY`.

The branded UAIX Browser lane uses `.github/workflows/release-browser-nuget.yml`. It builds the same native bridge matrix, packs the five `UAIX.Browser.*` package IDs with `-IncludePrivateConversion`, runs `eng\verify-browser-feed.ps1`, gates the push with `eng\audit-browser-nuget-release-readiness.ps1`, publishes through `eng\publish-browser-nuget.ps1`, uploads `uaix-browser-nuget-publish-plan.json`, then runs mandatory Browser feed-current and feed package-hash gates into `uaix-browser-nuget-feed-current.json` and `uaix-browser-nuget-feed-hashes.json`. The Browser readiness report uses schema `uaix.browser.nuget.release_readiness.v0`, writes `uaix-browser-nuget-release-readiness.json`, and by default writes its no-push dry-run plan to `uaix-browser-nuget-release-readiness-publish-plan-dry-run.json` so it does not overwrite retained post-push `uaix-browser-nuget-publish-plan.json` evidence; pass `-PublishPlanReport` only when a caller intentionally wants a different readiness dry-run path. The report lifts package counts, symbol counts, SHA256SUMS evidence, and feed README hash/match evidence to top-level fields, blocks missing API keys or unsupported Trusted Publishing sources, blocks `blocked_remote_hash_mismatch` when an immutable feed version has different bytes, and skips redundant pushes when the target feed is already `published_current`. If NuGet.org has the declared version with different bytes, bump `dotnet/Directory.Build.props` `VersionPrefix` before publishing corrected Browser packages. Its optional `verify_after_publish=true` consumer smoke restores `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and `UAIX.Browser.p2pLLM.Conversion` through the configurable `eng\verify-consumer.ps1` package-ID parameters, then validates `.slm`, runtime, UAIX memory/persona, P2P, and controlled conversion-wrapper paths from the published feed.

The July 6, 2026 NuGet.org current-version check found no listed versions for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, or `TinyRustLM.Memory`; local TinyRustLM packages are verified and dry-run publish-ready, but public NuGet.org availability must not be claimed until an authenticated publish completes and `eng\verify-feed-current.ps1` plus `eng\verify-feed-package-hashes.ps1` pass against NuGet.org for the source-declared version. The no-push readiness audit clears each expected subreport before running its step and records `report_written`, preventing stale publish-plan or feed evidence from being reused.

The official NuGet release workflow builds native bridge artifacts on Windows, Linux, Intel macOS, and ARM macOS, then requires `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64` runtime assets in `TinyRustLM.Core` before push. After publishing through either scoped API key or NuGet.org Trusted Publishing, it always runs feed-current and feed package-hash gates with short indexing retries; the heavier clean consumer feed smoke remains optional through `verify_after_publish`.

PowerShell and Bash verifier runs both write `artifacts/reports/tinyrustlm-nuget-package-audit.json` with package SHA-256 values, native RID coverage, required NuGet metadata, XML documentation entries, dependency metadata, private-surface scan results, source/debug-symbol/generated-output leakage counts, and local absolute path match counts. Publish runs write `artifacts/reports/tinyrustlm-nuget-publish-plan.json` with the exact push set, package hashes, package sizes, package version, target feed, package-audit report hash, audit match status, SHA256SUMS manifest path/hash/match status, dry-run or push status, redacted publish-error evidence when a push fails, and the no-secret-material flag. Readiness audits write `artifacts/reports/tinyrustlm-nuget-release-readiness.json` with local gate status, remote feed status, blockers, next actions, and no secret material.

After publishing to a feed, run `eng\verify-feed.ps1 -NuGetSource <feed-url-or-source-name>` to prove a clean consumer can install and use the package version declared in `dotnet/Directory.Build.props` from that feed. This writes `artifacts/reports/tinyrustlm-nuget-feed-smoke.json`.

Run `eng\verify-feed-current.ps1 -NuGetSource <v3-feed-url-or-local-package-folder>` after feed indexing to prove all four protected packages expose the source-declared version and that the source tree is not behind the feed's latest reported package version. Set `TINYRUSTLM_FEED_PACKAGE_IDS` to a comma-separated package-id list when checking the UAIX Browser branded package set instead of the default TinyRustLM package IDs.

Run `eng\verify-feed-package-hashes.ps1 -NuGetSource <v3-feed-url-or-local-package-folder>` with the publish plan after feed indexing to prove the plan is bound to package-audit plus SHA256SUMS evidence and the feed serves the exact audited package bytes recorded in `tinyrustlm-nuget-publish-plan.json`. This writes `artifacts/reports/tinyrustlm-nuget-feed-hashes.json`.

Run `eng\verify-public-doc-sites.ps1` when the sibling TinyRustLM and MiniModel documentation checkouts are present to prove those public mirrors still describe the four-package SDK and SHA256SUMS-bound publish/feed-hash contract. This writes `artifacts/reports/tinyrustlm-public-doc-sites-audit.json`.

The `nuget-feed-monitor.yml` workflow runs the same current-version check on demand. Scheduled monitoring is opt-in: set repository variable `TINYRUSTLM_NUGET_MONITOR_ENABLED=true` after the NuGet or private feed is authoritative, and optionally set `TINYRUSTLM_NUGET_SOURCE`, `TINYRUSTLM_NUGET_MONITOR_ALLOW_NEWER`, plus `TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER=true` when the monitor should also run the clean consumer install/runtime/P2P smoke. If the retained publish-plan JSON is available to the monitor, set `TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES=true` and `TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT=<path>` to also verify feed package bytes against the audited publish plan. Set `UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT=true` and optionally `UAIX_BROWSER_NUGET_SOURCE=<feed>` to keep the five UAIX Browser package IDs current with the same source-declared version.

## Memory Setup

UAIX Project Handoff is active through `.uai/`, following the setup flow at `https://uaix.org/en-us/tools/ai-memory-package-wizard/#setup-file-handoff`. LLM Wiki long memory targets AIWikis.org under `https://aiwikis.org/runtime-mirust/`, with local source records in `wiki/runtime-mirust/`. Hot `.uai` files keep current routing, synthesis, and proof-of-use pointers. Durable report bodies belong in Markdown/wiki files and raw evidence manifests, not inside `.uai/long-term-memory.uai`; the long-term memory ledger stays pointer-only, checksum-bearing, and routing-only.

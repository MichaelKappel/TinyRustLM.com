# Production Distribution Architecture for the TinyRustLM P2P Companion

## Executive recommendation and observable facts

The strongest production-grade distribution architecture for the first public release is a **three-artifact model**: a managed orchestration NuGet package (`UAIX.Browser.p2pRuntime.SeedHost`), a RID-specific .NET tool package family (`UAIX.Browser.p2pRuntime.SeedHost.Tool`) built as **self-contained** subpackages behind a pointer package, and **separate self-contained downloadable archives** (`.zip` for Windows, `.tar.gz` for Linux) as the primary end-user distribution. That combination matches current NuGet and .NET packaging behavior for native assets and tools, keeps Rust authoritative for all model and receipt rules, and does not require a Rust toolchain, C toolchain, Python, Node, or source checkout on the target machine. Current .NET guidance supports RID-specific, self-contained tool packaging in .NET SDK 10+, while ordinary native-asset packages should place native binaries under `runtimes/<rid>/native` for runtime selection. citeturn37view1turn38view0turn38view1turn35view1

For the ABI boundary, I recommend a **small, versioned C ABI with fixed-width integer fields, `repr(C)` structs, UTF-8 JSON envelopes, and explicit operation handles for long-running work**. Fast operations such as validation, manifest inspection, and rule evaluation should run through a synchronous request/response call. Potentially long preparation/import operations should use `start / poll / cancel / dispose` semantics with opaque handles and small progress payloads. This avoids the lifetime, threading, and reentrancy hazards of callback-heavy designs across the C#/Rust boundary, while still allowing C# to expose a typed orchestration surface. Rust panics must never cross the C ABI boundary; every export should contain the panic and return a structured failure. Rust’s FFI guidance requires `repr(C)` for layout control, and Rust’s panic rules make unwinding with the wrong ABI undefined behavior, which is why containment at each exported function is mandatory. citeturn7search1turn7search3turn7search6turn7search0

For release shape, the first release should **not** use trimming or single-file publishing for the companion application. Trimming removes code based on static reachability and is explicitly documented as unsafe for many reflection-heavy or analyzer-hard patterns unless warnings are fully resolved. Single-file publishing introduces native-library extraction behavior, path-related API incompatibilities, and extraction-directory security considerations that are poorly aligned with a package that also ships native Rust libraries and a separate Rust server executable. Current .NET guidance documents both the trimming risk and the single-file extraction model, including the fact that embedding native libraries requires extraction to disk and the extraction directory must not be shared across trust boundaries. citeturn40search1turn40search0turn39view3

For Linux, the public downloadable RIDs should remain exactly `linux-x64` and `linux-arm64`, and those artifacts should be treated as **glibc-targeted** deliverables. Alpine and other musl-based environments are a distinct compatibility lane and should not be implied by `linux-x64`/`linux-arm64`; .NET documents Alpine separately, and musl is a separate libc implementation. The practical consequence is that a first release should build Linux artifacts on an intentionally old, reviewed glibc baseline and verify them on real x64 and ARM64 Linux runners. If Alpine support becomes a requirement, it should be added later as separate `linux-musl-*` deliverables rather than assumed. citeturn25view1turn20search3turn35view1

For supply chain controls, the release bar should be: **pinned SDK/toolchain versions, lock files enforced in CI, isolated per-RID Cargo target directories, repository metadata and Source Link in the NuGet package, symbol packages, package signing, SHA-256 manifests, SPDX SBOM generation plus validation, GitHub artifact attestations, retention rules, and secret scanning with push protection**. NuGet supports author signing and repository signing, Source Link metadata, symbol packages, lock-file enforcement, and repository metadata. GitHub supports artifact attestations, retention controls, and secret scanning/push protection. SPDX is the current international standard family for SBOMs, and Microsoft’s SBOM Tool supports SPDX 2.2 and 3.0 generation and validation workflows. citeturn17search0turn17search3turn18search0turn17search1turn34search1turn34search0turn12view2turn11search10turn30search0turn30search1turn16view2turn16view1turn16view0

The publicly observable product facts and boundaries used in this report are the ones you provided: TinyRustLM.com is the browser chat UI; MiniModel.org is the model catalog and P2P discovery authority; the downloadable application is an operational companion and not a second chat client; Rust remains authoritative for `.slm`, manifests, pieces, Merkle and receipt rules; C# is an orchestration layer over a narrow C ABI and may run the reviewed Rust MiniModel server executable for independent seed lanes; planned NuGet IDs are `UAIX.Browser.p2pRuntime.SeedHost` and `UAIX.Browser.p2pRuntime.SeedHost.Tool`; and required downloadable RIDs are `win-x64`, `linux-x64`, and `linux-arm64`. Those facts are treated here as assumptions because they are not publicly verifiable from source code or published packages available to me. This report does **not** claim inspection of private source, unpublished packages, private binaries, private test logs, or operator credentials.

## Recommended ABI contract, lifecycle, and cancellation

A stable cross-platform C ABI should be based on **length-delimited byte buffers**, not NUL-terminated strings, because it avoids search-by-scan, handles embedded NULs safely, and cleanly separates pointer validity from payload length. Even though JSON text itself must parse as valid UTF-8 and valid JSON, the transport should remain “pointer + length” rather than “char*”. Using `repr(C)` and fixed-width integer fields avoids layout ambiguity across Windows x64’s LLP64 model and Linux x64/ARM64’s LP64 model. Rust’s FFI documentation strongly supports `repr(C)` for externally visible layouts, and ownership of cross-language strings or buffers should always be paired with an explicit free function in the allocator that created them. citeturn7search3turn7search4turn7search1

I recommend the following exported surface as the **minimum durable ABI**:

```c
typedef uint32_t trlm_abi_major_t;
typedef uint32_t trlm_flags_t;
typedef uint64_t trlm_size_t;
typedef uint64_t trlm_handle_t;

typedef enum trlm_status_code_e {
    TRLM_OK = 0,
    TRLM_E_INVALID_ARGUMENT = 1,
    TRLM_E_UTF8 = 2,
    TRLM_E_JSON = 3,
    TRLM_E_REQUEST_TOO_LARGE = 4,
    TRLM_E_RESPONSE_TOO_LARGE = 5,
    TRLM_E_NOT_SUPPORTED = 6,
    TRLM_E_CANCELLED = 7,
    TRLM_E_TIMEOUT = 8,
    TRLM_E_IO = 9,
    TRLM_E_STATE = 10,
    TRLM_E_PANIC = 11,
    TRLM_E_INTERNAL = 12
} trlm_status_code;

typedef struct trlm_bytes_v1_s {
    const uint8_t* ptr;
    trlm_size_t    len;
} trlm_bytes_v1;

typedef struct trlm_request_v1_s {
    uint32_t       struct_size;
    trlm_abi_major_t abi_major;
    trlm_flags_t   flags;
    trlm_bytes_v1  json_utf8;
    uint64_t       timeout_ms;
} trlm_request_v1;

typedef struct trlm_response_v1_s {
    uint32_t         struct_size;
    trlm_status_code status;
    trlm_bytes_v1    json_utf8;   // Rust-owned; caller frees with trlm_free_bytes
} trlm_response_v1;

typedef struct trlm_progress_v1_s {
    uint32_t         struct_size;
    trlm_status_code status;      // OK while polling; terminal code on completion/failure
    uint32_t         state;       // Queued/Running/Succeeded/Failed/Cancelled
    trlm_bytes_v1    json_utf8;   // small progress/result envelope; Rust-owned
} trlm_progress_v1;

trlm_abi_major_t trlm_get_abi_major(void);
trlm_status_code trlm_call_v1(const trlm_request_v1* req, trlm_response_v1* resp);
trlm_status_code trlm_start_v1(const trlm_request_v1* req, trlm_handle_t* handle_out);
trlm_status_code trlm_poll_v1(trlm_handle_t handle, trlm_progress_v1* progress_out);
trlm_status_code trlm_cancel_v1(trlm_handle_t handle);
trlm_status_code trlm_dispose_v1(trlm_handle_t handle);
void             trlm_free_bytes(trlm_bytes_v1 bytes);
```

The **versioning rule** should be: the exported function name and top-level struct version carry the ABI major, additive evolution is done by appending optional JSON fields and by increasing `struct_size`, and any incompatible change creates `*_v2` functions and `*_v2` structs. This mirrors common C ABI durability practice and fits Rust’s requirement that FFI layout be explicit. The negotiation sequence should be: call `trlm_get_abi_major`; if unsupported, fail before any work; otherwise pass the requested major in every request and reject mismatches with `TRLM_E_NOT_SUPPORTED`. citeturn7search3turn7search1

The **UTF-8 JSON envelope** should be narrow and boring. Each request envelope should contain: `operation`, `schemaVersion`, `correlationId`, `arguments`, and optionally `workDirectory`, `deadlineUtc`, and `capabilitiesRequired`. Each response or progress envelope should contain: `operation`, `correlationId`, `kind`, `result` or `error`, `warnings`, and `diagnostics`. Invalid UTF-8 returns `TRLM_E_UTF8`; valid UTF-8 but invalid JSON returns `TRLM_E_JSON`; a null pointer with nonzero length returns `TRLM_E_INVALID_ARGUMENT`; a null pointer with zero length is treated as an empty payload and rejected as bad JSON. These failure splits are important because they are actionable on the managed side. The transport itself is recommendation rather than a quoted standard, but it follows the byte-oriented FFI guidance and .NET’s native-interop loading/error patterns. citeturn7search1turn33search1turn33search5

The **size policy** should be explicit and enforced at the ABI boundary: synchronous `trlm_call_v1` requests up to **1 MiB**, synchronous responses up to **1 MiB**, poll payloads up to **64 KiB**, and any result larger than the response limit must be written to a caller-nominated work directory with the response returning a JSON object that references the staged file and its SHA-256. This keeps the ABI stable, avoids giant heap allocations through P/Invoke, and makes long imports/report generation naturally file-backed. The exact numbers are a recommended operational contract, not a claim about current package contents.

The **ownership rule** must be allocator-symmetric: any response buffer or progress buffer allocated in Rust is freed only by `trlm_free_bytes`; C# must never free Rust-returned memory directly; and Rust must never free caller-owned request memory. Rust’s own FFI docs warn that foreign-allocated strings or buffers require a corresponding foreign API to release them correctly. citeturn7search4

The **panic rule** is non-negotiable: every exported function must wrap its internal implementation with `catch_unwind`, convert the failure into `TRLM_E_PANIC`, and ensure no unwind crosses the `extern "C"` boundary. Rust explicitly states that unwinding with the wrong ABI is undefined behavior, and `catch_unwind` is the standard containment mechanism for unwinding panics on the current thread. This does not protect against aborting panics, memory corruption, process termination, or OOM termination, which is why process isolation remains relevant for the heaviest/untrusted lanes. citeturn7search6turn7search0turn7search11

The **thread-safety contract** should be documented this way: `trlm_call_v1` is thread-safe and reentrant; `trlm_start_v1` is thread-safe; `trlm_poll_v1` and `trlm_cancel_v1` may be called concurrently on the same handle and must be internally synchronized; `trlm_dispose_v1` is exclusive and invalidates the handle immediately; all handles are opaque; after `dispose`, any further use returns `TRLM_E_STATE`. Rust-side state that crosses worker threads must satisfy the usual send/sync requirements, and the managed wrapper should serialize `dispose` against poll/cancel to keep failure handling deterministic. Rust’s `Send`/`Sync` model is the reason to keep unsafe sharing out of the ABI and inside well-reviewed Rust internals. citeturn7search22

### Cancellation model and recommendation

The strongest comparison is:

| Model | Strengths | Weaknesses | Recommendation |
|---|---|---|---|
| Callback-based progress/cancel | Low polling latency; can feel responsive | Cross-runtime callbacks increase GC pinning/lifetime risk, reentrancy complexity, thread-affinity ambiguity, and crash surface | Do not use for the first stable ABI |
| Explicit native handles with polling | Simple P/Invoke; no reverse-call threading hazard; easy timeouts and tests; stable across languages | Requires polling cadence and state machine discipline | **Recommended primary ABI** |
| Explicit handles plus event/callback bridge in managed code | Nice UX above the ABI | Same ABI plus managed complexity only | Fine as a C# convenience layer, not as native ABI |
| Subprocess isolation | Best containment for aborts, OOMs, fatal loader errors, and potential parser bugs | More packaging, IPC, supervision, and log correlation work | **Recommended operational isolation option for high-risk import lanes and independent seed lanes** |

That recommendation follows from the fact that Rust can contain unwinding panics but cannot contain all fatal process failures inside an in-process ABI, while .NET tooling and packaging cleanly support both native libraries and executable companions. citeturn7search0turn7search6turn38view0turn38view1

### Lifecycle and state diagrams

The synchronous path should be reserved for quick rule evaluation:

```text
Managed caller
  -> trlm_get_abi_major
  -> trlm_call_v1(validate|inspect|doctor)
      -> Rust parse envelope
      -> Rust execute authoritative rule
      -> Rust returns JSON result or structured error
  -> trlm_free_bytes
```

The long-running path should be stateful and cancellation-aware:

```text
Queued -> Running -> Succeeded
              |         ^
              |         |
              v         |
           Cancelling --+
              |
              v
          Cancelled

Running -> Failed
Queued  -> Failed
Any     -> Disposed
```

The **failure semantics** I recommend are strict: no operation may partially commit authoritative companion state. Preparation/import must write only into a staging area, produce receipts/diagnostics throughout, and perform a single atomic promotion at success. If cancellation arrives during a non-interruptible checkpoint, the operation should transition to `Cancelling`, finish the checkpoint, roll back or leave staging only, and then report `Cancelled`. If the process crashes in the in-proc path, the managed layer should surface the operation as failed and, on restart, rely on Rust-authored recovery/receipt rules rather than attempting C# reconstruction. This preserves Rust’s authority over integrity rules and keeps C# out of validation semantics.

## Package, archive, and compatibility design

The managed library package should use the standard .NET 5+ native asset layout: compile-time managed APIs in `ref/<tfm>/`, runtime managed assemblies in `lib/<tfm>/` or `runtimes/<rid>/lib/<tfm>/`, and **all native binaries — including the Rust C ABI library and the reviewed Rust MiniModel server executable — under `runtimes/<rid>/native/`**. Microsoft’s native-packaging guidance explicitly identifies `runtimes/<rid>/native/` as the location for native assets and notes that `contentFiles/` is not recommended because it does not participate in per-RID asset selection or runtime probing. citeturn38view0turn38view1

A recommended `UAIX.Browser.p2pRuntime.SeedHost` package tree is:

```text
UAIX.Browser.p2pRuntime.SeedHost.<version>.nupkg
├─ ref/
│  └─ net10.0/
│     └─ UAIX.Browser.p2pRuntime.SeedHost.dll
├─ lib/
│  └─ net10.0/
│     ├─ UAIX.Browser.p2pRuntime.SeedHost.dll
│     ├─ UAIX.Browser.p2pRuntime.SeedHost.pdb
│     └─ UAIX.Browser.p2pRuntime.SeedHost.xml
├─ runtimes/
│  ├─ win-x64/
│  │  └─ native/
│  │     ├─ tinyrustlm_companion.dll
│  │     └─ minimodel-server.exe
│  ├─ linux-x64/
│  │  └─ native/
│  │     ├─ libtinyrustlm_companion.so
│  │     └─ minimodel-server
│  └─ linux-arm64/
│     └─ native/
│        ├─ libtinyrustlm_companion.so
│        └─ minimodel-server
├─ buildTransitive/
│  └─ net10.0/
│     ├─ UAIX.Browser.p2pRuntime.SeedHost.props
│     └─ UAIX.Browser.p2pRuntime.SeedHost.targets
├─ README.md
├─ LICENSE.txt
└─ icon.png
```

That tree is consistent with current NuGet asset selection semantics: compile assets come from `ref/{tfm}` or `lib/{tfm}`, runtime managed assets come from `runtimes/{rid}/lib/{tfm}` or `lib/{tfm}`, and native assets come from `runtimes/{rid}/native/`. citeturn38view1turn29search13

The `buildTransitive` files should be minimal and non-authoritative. They should not copy arbitrary per-platform content into ad hoc locations unless necessary for tooling ergonomics. Their useful roles are limited to: exposing MSBuild properties for deterministic asset naming, optionally copying the reviewed Rust executable to a predictable subfolder on non-publish builds, and emitting **clear diagnostics** when a consuming project builds without a RID while expecting a platform-specific executable lane. The reason to keep these files thin is that .NET already understands the `runtimes/*` convention for PackageReference consumers, and Microsoft explicitly recommends falling back to custom targets only when you step outside those conventions. citeturn38view0turn38view1

A key nuance is **publish flattening**. Microsoft documents that when an app is published for a specific RID, NuGet package assets for that RID are copied into the output directory; when published without a specific RID, RID-specific content remains in subdirectories and `.deps.json` guides probing. For native assets under `runtimes/<rid>/native`, the SDK also flattens their directory structure when published. The practical rule is therefore: do **not** rely on nested subfolders under `runtimes/<rid>/native` surviving publish, and do **not** try to publish assets for several Linux architectures into one output directory. A RID-specific publish must remain single-RID, and every native filename within a RID must already be collision-free. citeturn38view0turn0search0

That directly answers the “several Linux architectures flattening to the same publish path” problem: the correct prevention strategy is **not** to outsmart publish with deep subfolders. It is to keep each publish output RID-specific, to keep architecture-specific packages under the runtime asset mechanism, and to ensure unique filenames if multiple native files must coexist in the same output. Microsoft’s native-packaging guidance explicitly recommends different filenames per CPU architecture if files would otherwise land in one directory. citeturn38view1

The managed wrapper should find the Rust server executable by using `AppContext.BaseDirectory` and a known filename in the resolved publish/output layout, rather than assuming the original package path. This is the stable post-publish location model that .NET recommends for files shipped next to an executable, including in scenarios where single-file behavior changes assembly path APIs. citeturn39view3

The tool package should use the current .NET 10 RID-specific tool model. The modern layout is a **pointer package** plus RID-specific subpackages, and .NET CLI selects the correct RID package automatically at install time. A recommended family is:

```text
UAIX.Browser.p2pRuntime.SeedHost.Tool.<version>.nupkg
  └─ pointer package only; lists available RID subpackages

UAIX.Browser.p2pRuntime.SeedHost.Tool.win-x64.<version>.nupkg
UAIX.Browser.p2pRuntime.SeedHost.Tool.linux-x64.<version>.nupkg
UAIX.Browser.p2pRuntime.SeedHost.Tool.linux-arm64.<version>.nupkg
```

The command should remain `uaix-p2p-seed`. Microsoft’s tool-packaging documentation for .NET SDK 10 states that RID-specific tool packaging creates one top-level pointer package and one package per RID, and that the CLI automatically chooses the correct package for the platform. citeturn37view1turn37view0turn37view3

The **important strategic caveat** is that even a self-contained .NET tool still depends on the **.NET CLI installation experience** for `dotnet tool install`, because tools are NuGet-delivered CLI packages. By contrast, a self-contained archive is a direct end-user runtime distribution. For that reason, the first release should treat `UAIX.Browser.p2pRuntime.SeedHost.Tool` as an operator/developer convenience channel and treat downloadable self-contained archives as the primary production distribution for end users. Current .NET documentation still describes ordinary tools as framework-dependent by default and installed through the CLI tooling model, while RID-specific self-contained packaging is a newer .NET 10 capability. citeturn36view0turn36view1turn37view1

The archive layout should therefore be explicit and boring:

```text
uaix-p2p-seed-win-x64-<version>.zip
└─ uaix-p2p-seed/
   ├─ uaix-p2p-seed.exe
   ├─ UAIX.Browser.p2pRuntime.SeedHost.dll
   ├─ tinyrustlm_companion.dll
   ├─ minimodel-server.exe
   ├─ *.deps.json
   ├─ *.runtimeconfig.json
   ├─ README.txt
   ├─ LICENSE.txt
   ├─ SHA256SUMS
   └─ sbom/
      └─ manifest.spdx.json

uaix-p2p-seed-linux-x64-<version>.tar.gz
└─ uaix-p2p-seed/
   ├─ uaix-p2p-seed
   ├─ UAIX.Browser.p2pRuntime.SeedHost.dll
   ├─ libtinyrustlm_companion.so
   ├─ minimodel-server
   ├─ *.deps.json
   ├─ *.runtimeconfig.json
   ├─ README.txt
   ├─ LICENSE.txt
   ├─ SHA256SUMS
   └─ sbom/
      └─ manifest.spdx.json
```

Use **ZIP for Windows** and **TAR.GZ for Linux**. On Linux, tar preserves executable mode bits and can restore them from the archive; GNU tar documents `--same-permissions` / `-p` for extracting recorded modes. Windows downloads may carry Mark-of-the-Web, which can affect operator experience and SmartScreen/app-reputation flows, so release documentation should explicitly note that files downloaded from the Internet may carry MOTW and may need standard “unblock” handling or reputation-building over time. citeturn23view0turn19search16turn19search1turn19search14

### RID compatibility matrix

The matrix below reflects current .NET RID guidance, .NET 8+ portable-RID behavior, GitHub runner availability, and the libc split between glibc and musl. The musl entries are intentionally advisory because your required public RIDs do **not** include `linux-musl-*`. citeturn35view1turn35view2turn12view0turn25view1turn20search3

| Deliverable lane | Public RID | Expected libc/runtime lane | First-release support position | Verification expectation |
|---|---|---|---|---|
| Windows desktop/server x64 | `win-x64` | Windows x64 only | Supported | Real execution on GitHub `windows-*` x64 runner citeturn12view0turn25view0 |
| Linux x64 | `linux-x64` | glibc | Supported | Real execution on GitHub `ubuntu-*` x64 runner; build on old reviewed glibc baseline by policy inference citeturn12view0turn35view2turn20search20turn20search17 |
| Linux ARM64 | `linux-arm64` | glibc | Supported | Real execution on `ubuntu-24.04-arm` or equivalent ARM64 runner; emulation is secondary evidence only citeturn12view0turn12view1 |
| Alpine / musl x64 | not in first-release set | musl | Not supported in first release; add `linux-musl-x64` later if required | Separate build and execution lane required; do not infer compatibility from glibc build citeturn25view1turn20search3 |
| Alpine / musl ARM64 | not in first-release set | musl | Not supported in first release; add `linux-musl-arm64` later if required | Separate build and execution lane required; do not infer compatibility from glibc build citeturn25view1turn20search3 |

The practical minimum OS baseline should be documented as **the oldest reviewed and CI-verified OS versions in your test matrix**, not as an aspirational claim. On Windows, .NET 10 currently supports Windows 10 LTSC/Enterprise lanes and current Windows Server lanes; on Linux, support flows through the supported distro/version tables and manual-install guidance. Because glibc compatibility depends on the symbols linked into your binaries, the safest practice is to promise only what you actually build on and execute in CI. citeturn25view0turn26search0turn24search8turn20search20turn20search17

## Build, release pipeline, and CI evidence

The Cargo side should use **deterministic, isolated target directories per host + target + profile**, not a shared `target/` folder. Cargo officially supports setting `CARGO_TARGET_DIR` and `--target-dir`, and Rust guidance favors pinning toolchains in CI rather than floating on the newest stable on each run. The `.NET` side should pin the SDK through `global.json`. Lock files should be enforced on both sides: `Cargo.lock` with `cargo build --locked`, and `packages.lock.json` with `dotnet restore --locked-mode`. citeturn7search2turn7search13turn8search16turn8search0turn17search16turn9search0turn34search1turn34search0

A concrete release-build environment model is:

```text
DOTNET_SDK_VERSION=<exact reviewed sdk patch>
RUSTUP_TOOLCHAIN=<exact reviewed stable rust patch>
Configuration=Release
TFM=net10.0
RID=win-x64 | linux-x64 | linux-arm64
RUST_TARGET=x86_64-pc-windows-msvc | x86_64-unknown-linux-gnu | aarch64-unknown-linux-gnu
CARGO_TARGET_DIR=$WORK/artifacts/cargo/$HOST_OS-$HOST_ARCH/$RUST_TARGET/$Configuration
OUT_ROOT=$WORK/artifacts/out/$RID
PKG_ROOT=$WORK/artifacts/pkg/$RID
```

A concrete first-release command sequence is:

```bash
# Managed restore/build
dotnet restore --locked-mode
dotnet build -c Release --no-restore

# Rust restore/build
cargo +$RUSTUP_TOOLCHAIN fetch --locked
cargo +$RUSTUP_TOOLCHAIN build --locked --release --target $RUST_TARGET --target-dir "$CARGO_TARGET_DIR"

# Package library nupkg
dotnet pack src/UAIX.Browser.p2pRuntime.SeedHost/UAIX.Browser.p2pRuntime.SeedHost.csproj \
  -c Release --no-build -o artifacts/nuget

# Package RID-specific tool packages
dotnet pack src/UAIX.Browser.p2pRuntime.SeedHost.Tool/UAIX.Browser.p2pRuntime.SeedHost.Tool.csproj \
  -c Release -o artifacts/tool-nuget

# Publish self-contained app archive lane
dotnet publish src/uaix-p2p-seed/uaix-p2p-seed.csproj \
  -c Release -r $RID --self-contained true -o "$OUT_ROOT"

# SBOM
sbom-tool generate -b "$OUT_ROOT" -bc "$REPO_ROOT" -pn uaix-p2p-seed -pv "$VERSION" -ps UAIX -nsb <org-namespace> -mi SPDX:3.0
sbom-tool validate -b "$OUT_ROOT" -o "$OUT_ROOT/sbom-validation.json" -mi SPDX:3.0
```

Those commands follow current CLI semantics for `dotnet pack`, `dotnet publish`, Cargo `--locked`, and SBOM Tool generation/validation. citeturn29search8turn29search18turn9search0turn16view0turn16view1

For **linker provenance**, use explicit Cargo config rather than ambient PATH luck. Cargo exposes resolved linker information to build scripts and supports target-specific configuration; that means each target should have a reviewed linker configured in `.cargo/config.toml` or CI environment, and the pipeline should record the linker identity (`path`, `version`, and, ideally, container digest or package provenance) into a release receipt. Cargo’s environment/config documentation makes the linker resolution configurable and observable. citeturn28search0turn28search2

For **reproducibility**, the realistic target is “controlled and auditable,” not “bit-for-bit guaranteed across all hosts.” Cargo lock files provide deterministic dependency resolution, and `--locked` enforces it. Rust also supports best-effort path remapping via `--remap-path-prefix`, which reduces host-path leakage in artifacts and debug info. But full reproducibility can still be disturbed by linker differences, build scripts, embedded timestamps or VCS metadata, native dependency environments, and dirty source trees. Therefore the release gate should be: fail release builds from dirty trees, record source revision, toolchain versions, linker identity, and output hashes, and treat deterministic rebuild comparison as a hardening lane rather than a first-release promise. citeturn9search2turn9search0turn10search0turn8search16

For **CI topology**, use a matrix across Windows x64, Linux x64, and **real Linux ARM64** where possible. GitHub now documents standard ARM64 Linux hosted runners, but also notes that beta/preview images may not carry the same operational guarantees. Therefore the preferred evidence order is: real ARM64 hosted runner if acceptable for your repo plan and reliability needs, then self-hosted ARM64 if you need stronger control, with QEMU or file-header checks only as supplementary evidence. citeturn12view0turn12view1turn11search21

A recommended CI matrix is:

| Lane | Build | Execute | Evidence produced |
|---|---|---|---|
| Windows x64 | Native build | Native test run | ABI load, `doctor`, `init`, `inspect`, tool install/run, archive extraction, wrong-RID diagnostics, package metadata checks |
| Linux x64 | Native build | Native test run | Same as above plus executable mode verification |
| Linux ARM64 | Native build or cross-arch build on ARM64 runner | **Native ARM64 execution** | Same as above; this is the authoritative ARM64 evidence |
| Linux ARM64 supplementary | Cross-compile on x64 | No native execution | `file`, `readelf -h`, hash manifest; useful, but **not execution evidence** |

The distinction matters: a cross-compiled ELF header check proves only that the file format and machine type are correct; it does **not** prove loader compatibility, dependent library resolution, executable permissions, or successful runtime behavior. That difference is an inference from build/runtime behavior, but it is exactly the sort of evidence separation expected in a production release review.

The release acceptance matrix should require the following gates:

| Gate | Expected evidence |
|---|---|
| Managed restore locked | `dotnet restore --locked-mode` passes; no lock drift citeturn34search1turn34search0 |
| Rust restore locked | `cargo fetch --locked` and `cargo build --locked` pass; `Cargo.lock` unchanged citeturn9search0turn9search11 |
| Native ABI load | Managed smoke test calls `NativeLibrary.Load`/`TryLoad`; missing libs and bad images classified separately citeturn33search1turn33search5 |
| Tool install | `dotnet tool install` for `SeedHost.Tool` succeeds from clean cache; correct RID subpackage selected on supported platforms citeturn37view3turn36view1 |
| Doctor/init/inspect | End-to-end CLI smoke tests produce exit code 0 for happy path and structured error envelopes for failures |
| Wrong-RID detection | Build or package emits portable-RID-safe output; any distro/version-specific RID issues are surfaced as `NETSDK1206` or custom diagnostics citeturn35view0turn35view1 |
| Linux archive extraction | `tar` extraction preserves executable bits; `test -x` succeeds on binaries citeturn23view0 |
| Windows archive handling | download/unzip docs cover MOTW/SmartScreen reality; smoke test includes extraction from ZIP and process launch on signed build citeturn19search16turn19search1 |
| SBOM | SPDX generated and validated; artifact contains SBOM and validation output citeturn16view1turn16view0turn16view2 |
| Provenance | GitHub artifact attestation exists and verifies for every released artifact citeturn12view2turn12view3 |
| NuGet hygiene | `.snupkg`, Source Link, repository metadata, readme, license, signing verification all pass citeturn17search1turn18search0turn18search18turn31search4turn17search0turn17search19 |

## Supply chain, operator diagnostics, and failure handling

The supply-chain threat model for this system has four dominant classes of risk: **build contamination**, **artifact tampering**, **package/runtime mismatch**, and **operator execution hazards**. Build contamination includes cross-RID output bleed, dirty-tree releases, mutable dependency graphs, unreviewed linker/toolchain drift, and secrets leaking into source or CI. Artifact tampering includes altered archives, swapped native binaries, and unsigned or unverifiable packages. Package/runtime mismatch includes wrong-architecture native assets, distro-specific RID misuse, missing dependent libraries, and unsupported libc assumptions. Operator execution hazards include malicious or malformed archives, path traversal on extraction, executable-bit loss on Linux, and MOTW/SmartScreen friction on Windows. These are precisely the classes addressed by lock files, isolated build directories, hash manifests, archive-safety checks, signatures, attestations, and clear diagnostics. citeturn34search1turn9search0turn32search2turn17search3turn12view2turn30search0turn30search1

The minimum mitigation set should be:

- **Pinned toolchains and lock files** for both ecosystems. .NET supports `global.json`; NuGet supports lock files and locked restore; Rust supports exact toolchain pinning with `rust-toolchain.toml` and locked Cargo builds. citeturn17search16turn34search1turn8search0turn9search0
- **Content allowlists** at package time. Only explicit files may enter the `.nupkg` or archive: managed assemblies, native Rust library, reviewed Rust server executable, docs, hashes, SBOM, symbols. This is an engineering recommendation derived from the fact that NuGet pack does not automatically fold project-reference outputs into the package content you probably want. citeturn38view2turn29search8
- **NuGet metadata completeness**: repository URL/type, readme, icon, license, Source Link metadata, and `.snupkg`. NuGet and Source Link guidance explicitly recommend these for discoverability, debugging, and trust. citeturn31search1turn31search4turn18search0turn18search18turn17search1
- **Signing and verification**: author-sign packages before publishing; rely on nuget.org repository signing after upload; verify signatures in acceptance; timestamp signatures to avoid expiry failures. citeturn17search0turn17search3turn17search21turn17search19
- **SBOM generation and validation**: generate SPDX SBOMs, validate them, and ship them with artifacts. SPDX is the standard; Microsoft SBOM Tool supports SPDX 2.2 and 3.0 generation and validation patterns. citeturn16view2turn16view1turn16view0
- **Provenance and attestations**: generate GitHub artifact attestations for every release artifact and verify them in policy or consumer tooling. SLSA emphasizes provenance and build isolation, and GitHub’s attestation model is the current practical hosted implementation for this kind of repository workflow. citeturn13search2turn13search12turn12view2turn12view3
- **Secret scanning and push protection** in GitHub. GitHub’s native features scan history for leaked secrets and can block pushes with detected secrets before merge. citeturn30search0turn30search1turn30search21
- **Malware scanning boundaries**: locally and in CI, scan the final archives and expanded output trees you create; after publication, note that nuget.org also scans packages for viruses and rejects infected uploads. Microsoft Defender provides command-line scan automation on Windows; nuget.org documents malware scanning of published packages. citeturn30search2turn30search9turn31search11
- **Archive traversal checks**: use `.NET` convenience extraction methods where possible because `ExtractToDirectory` protects against path traversal, but still add your own limits for total size and entry counts because .NET explicitly says those limits are not enforced by the convenience methods. citeturn32search2
- **Release retention**: shorten CI artifact retention for intermediate outputs and keep only signed release artifacts and their attestations long term. GitHub defaults artifacts/logs to 90 days but allows per-artifact or repo/org retention configuration. citeturn11search2turn11search10turn11search18

What can be done **locally or in unprivileged CI without production signing credentials**: build, test, create deterministic hashes, generate and validate SBOMs, produce unsigned `.nupkg` and archives, verify Source Link metadata, create `.snupkg`, run secret scanning and malware scans, and even do trial package signing with non-production certificates for workflow rehearsal. What should wait for the **authorized publication job**: official author signing with the registered NuGet certificate, pushing to nuget.org with production API credentials, generating official GitHub/Sigstore-bound release attestations tied to the canonical release workflow, and publishing final release archives. NuGet.org requires certificate registration for signed package submission, and GitHub artifact attestations require workflow permissions tied to the publishing repository. citeturn17search0turn12view2

### Failure modes and operator-facing diagnostics

The managed wrapper and CLI should convert low-level loader and packaging errors into short, operator-meaningful messages. The underlying exceptions and platform facts are well documented by .NET and Windows:

| Failure mode | Low-level signal | Operator-facing diagnostic |
|---|---|---|
| Native library missing | `DllNotFoundException` | “The TinyRustLM native runtime for this platform was not found. Expected RID `<rid>` and file `<name>`. Reinstall the matching package/archive.” citeturn33search0turn33search1 |
| Wrong architecture | `BadImageFormatException` on `NativeLibrary.Load` | “The installed native runtime does not match this process architecture. Expected `<arch>`, found incompatible binary.” citeturn33search1turn33search8 |
| Distro/version-specific RID mismatch | `NETSDK1206` at build/package time | “A package supplied distro-specific runtime assets that .NET 8+ may ignore. Use portable RIDs such as `linux-x64` or update the package.” citeturn35view0turn35view1 |
| Linux executable bit missing | process launch fails with permission error | “The extracted Linux package is not executable. Re-extract the `.tar.gz` on Linux and verify execute permission on `uaix-p2p-seed` and `minimodel-server`.” citeturn23view0 |
| Archive path traversal / malicious archive | extraction failure | “The archive contains entries outside the destination root or unsafe links. Extraction was blocked.” citeturn32search2 |
| Single-file extraction directory unsafe | runtime warning / policy failure | “Native extraction would use an unsafe writable directory. Configure a private extraction base or use the multi-file distribution.” citeturn39view3 |
| Tool command not found | `.NET tool` executable missing or PATH issue | “`uaix-p2p-seed` is installed but not on PATH, or the tool package did not install for this architecture.” citeturn36view0turn36view1 |
| Windows MOTW / SmartScreen friction | shell warning or reputation prompt | “This file was downloaded from the Internet and may carry Mark-of-the-Web. Verify the signature/hash, then unblock or run from a trusted location if your policy permits.” citeturn19search16turn19search1turn19search14 |
| Rust panic in ABI lane | `TRLM_E_PANIC` | “The native runtime aborted the requested operation internally. No authoritative state was committed. Check the receipt/diagnostic bundle and retry in isolated mode.” citeturn7search0turn7search6 |

The CLI should also emit a **structured JSON diagnostic mode** for operators and CI, for example `uaix-p2p-seed doctor --json`, so failures can be asserted in smoke tests without relying on localized or unstable human-readable strings.

## Delivery backlog, open questions, and annotated bibliography

### Prioritized implementation backlog

**First release**

Use a managed orchestration package plus `runtimes/<rid>/native` native assets and a reviewed MiniModel server executable. Ship self-contained multi-file archives as the primary end-user distribution and `SeedHost.Tool` as an operator/developer convenience channel. Implement the versioned C ABI with synchronous calls plus explicit operation handles and cooperative cancellation. Enforce `Cargo.lock`, `packages.lock.json`, `global.json`, and exact Rust toolchain pinning. Use isolated Cargo target directories by host + target + profile. Publish `.snupkg`, Source Link metadata, repository metadata, readme, license, SHA-256 manifest, SPDX SBOM, and GitHub artifact attestations. Do **not** use trimming or single-file in the first release. citeturn38view1turn37view1turn34search1turn9search0turn17search16turn8search0turn17search1turn18search0turn12view2turn16view1turn16view0turn39view3turn40search1

**Next hardening release**

Add real ARM64-native CI execution if the first release had to rely on emulation or self-hosting. Add deterministic rebuild comparison jobs, process-isolated execution mode for high-risk import lanes by default, richer release receipts with linker/container provenance, stronger package trust policies in restore environments, and consumer-side attestation verification in install docs. Evaluate a musl lane only if Alpine support becomes a real requirement. Strengthen archive scanners with total-size and entry-count ceilings in addition to traversal protection. citeturn12view0turn17search13turn32search2turn13search2

**Optional future work**

After warnings are reduced to zero and the application graph is well understood, reevaluate selective trimming for specific tool or archive lanes. Reevaluate single-file only if startup, extraction security, and operational diagnostics remain acceptable with the native Rust library and server binary model. Consider Native AOT only for carefully bounded CLI surfaces after AOT/trimming warnings are understood and acted on; current .NET guidance is clear that warnings here are meaningful compatibility signals. citeturn40search1turn40search2turn39view3turn40search14

### Open questions that require local source inspection or execution

I cannot answer the following without private source or controlled execution evidence:

Whether the reviewed Rust server executable already has a stable machine-readable protocol suitable for a process-isolated import lane; whether current Rust crates or build scripts embed VCS metadata, timestamps, or host paths; whether any existing C# surface uses dynamic loading, reflection, or serializers that would trigger trim/AOT warnings; what the actual dependent shared-library footprint is for the Linux Rust builds; whether the current import workflow can guarantee atomic promotion and rollback; whether current operator workflows require installing via `dotnet tool` rather than archive extraction; and what the present smoke test count and runtime baselines are. Those are the highest-value local validation items before locking the first release architecture.

### Annotated bibliography

All sources below were retrieved on **2026-07-13**. Publication or update dates are included when the source exposed them in the retrieved metadata.

**Including native libraries in .NET packages** — Microsoft Learn. Updated 2024-01-05. The primary packaging authority for `runtimes/<rid>/native`, asset selection, and the warning against using `contentFiles/` for per-RID native delivery. citeturn38view0turn38view1

**.NET RID Catalog** — Microsoft Learn. Updated 2024-08-16 in retrieved search metadata. The authoritative explanation of portable RIDs, runtime fallback, and why portable RIDs are the right packaging target in .NET 8+. citeturn35view1

**Host determines RID-specific assets** — Microsoft Learn. Updated 2024-03-06. Critical for understanding .NET 8+ RID behavior and why distro/version-specific RIDs should be avoided in packaging. citeturn35view2

**NETSDK1206** — Microsoft Learn. Updated 2025-05-07. Operationally important for wrong-RID diagnostics and migration off distro/version-specific RIDs. citeturn35view0

**Create RID-specific, self-contained, and AOT .NET tools** — Microsoft Learn. .NET SDK 10+ capability note. The primary current documentation for pointer packages, RID-specific self-contained tool packages, and `ToolPackageRuntimeIdentifiers`. citeturn37view1turn37view0turn37view3

**Troubleshoot .NET tool usage issues** — Microsoft Learn. Current tool-runtime behavior, especially the continued framework-dependent assumptions in ordinary tool usage and the PATH/runtime failure modes. citeturn36view0

**.NET tools** — Microsoft Learn. Core tool installation, path behavior, and trust/scope model for global/local tools. citeturn36view1

**Create a single file for application deployment** — Microsoft Learn. Native-library extraction behavior, extraction directory security, and single-file API incompatibilities. This is the main source for rejecting single-file in the first release. citeturn39view3turn39view0turn39view2

**Prepare .NET libraries for trimming** and **Known trimming incompatibilities** — Microsoft Learn. Updated 2026-01-08 and 2023-11-10 respectively. The most relevant trimming risk sources for a mixed native/dynamic application. citeturn40search1turn40search0

**FFI** and **Other reprs** — The Rustonomicon. Primary Rust guidance for stable FFI layout and externally visible types. citeturn7search1turn7search3

**`catch_unwind`** and **Rust panic reference** — Rust standard library and Rust Reference. Primary sources for unwind containment and the undefined-behavior rule around the wrong unwind ABI. citeturn7search0turn7search6

**Cargo environment variables**, **cargo build**, **Cargo FAQ**, and **Remap source paths** — official Cargo/rustc documentation. The key sources for isolated target directories, lock-file enforcement, and best-effort path normalization. citeturn7search2turn7search13turn9search2turn10search0

**rustup overrides** and **Cargo continuous integration** — Rustup/Cargo official books. Primary guidance for exact toolchain pinning and CI stability. citeturn8search0turn8search16

**Signing NuGet Packages**, **Signed Packages reference**, **Creating symbol packages**, and **Source Link and .NET libraries** — Microsoft Learn. Primary sources for signed-package publication, repository signatures, `.snupkg`, and Source Link expectations. citeturn17search0turn17search3turn17search1turn18search0

**Package authoring best practices**, **Package readme on NuGet.org**, and **NuGet and .NET libraries** — Microsoft Learn. Primary packaging metadata guidance for readme, repository metadata, and package trust hygiene. citeturn31search1turn31search4turn18search18

**NuGet PackageReference in project files**, **dotnet restore**, and **MSBuild pack/restore targets** — Microsoft Learn. Primary sources for lock files, locked restore, and pack behavior. citeturn34search1turn34search0turn34search5

**Select Assemblies Referenced by Projects** — Microsoft Learn. Important for the project-reference packaging limitation: project references become dependencies; they are not automatically folded into package content. citeturn38view2

**SPDX specifications** — SPDX project site. Current standard status and current-version listing for SPDX 3.0. citeturn16view2

**SBOM Tool** and **SBOM Tool CLI reference** — Microsoft official GitHub repository. Primary source for SPDX 2.2/3.0 support and generate/validate command patterns. citeturn16view1turn16view0

**Artifact attestations** and **Using artifact attestations to establish provenance for builds** — GitHub Docs. Current hosted provenance mechanism for GitHub Actions release pipelines. citeturn11search3turn12view2

**SLSA requirements** and **Distributing provenance** — SLSA official specification. Primary provenance and build-isolation framework used to evaluate the release design. citeturn13search2turn13search12

**Secret scanning** and **Push protection** — GitHub Docs. Primary sources for the recommended secret-leak controls in repository and CI workflows. citeturn30search0turn30search1

**Best practices for working with ZIP and TAR archives in .NET** — Microsoft Learn. Primary source for extraction traversal protections and the need to add size/count limits yourself. citeturn32search2

**GNU tar: Setting Access Permissions** — GNU tar manual. Primary source for preserving executable mode bits on Linux archive extraction. citeturn23view0

**Information about the Attachment Manager in Microsoft Windows** and **Microsoft Defender SmartScreen overview** — Microsoft support / Learn. Primary sources for Mark-of-the-Web and Windows download trust behavior. citeturn19search16turn19search1
# Visual Studio Setup

Open `TinyRustLM.sln` from the repository root in Visual Studio 2022.

Required tools:

- Visual Studio 2022 with Desktop development with C++ for NMake support;
- the pinned Rust toolchain, Cargo, and rustup;
- the installed `wasm32-unknown-unknown` Rust target; and
- Node.js 24 or newer with the locked `tinyrustlm` dependencies restored.

The solution has one NMake project. Visual Studio invokes the checked-in
PowerShell owners under `tools/vs`; it does not maintain a second build graph.

## Build

`Build > Build Solution` runs:

```powershell
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Debug
```

The script resolves tools from the current environment, requires the WASM
target, builds the canonical Cargo workspace with `--locked --offline`, and
checks the deployed browser WASM and manifest. It has no user-specific path,
obsolete runtime copy, model-fixture generation, or alternate packer.

Useful explicit modes:

```powershell
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Release
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Debug -RunTests
.\tools\vs\Build-TinyRustLM.ps1 -CleanOnly
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Release -RefreshBrowserRuntime
```

`-RefreshBrowserRuntime` intentionally rewrites the checked-in canonical WASM
and manifest from the current source build. Review both files before commit.

## Run

Press `F5` or run:

```powershell
.\tools\vs\Run-TinyRustLM.ps1
```

The script builds unless `-NoBuild` is supplied, selects an unused loopback
port, starts `tinyrustlm-local-server`, and opens:

```text
http://127.0.0.1:8080/app/
```

An existing server is reused only when both `/app/` and
`/browser-runtime/tinyrustlm-browser-runtime.wasm` identify the current app.
An unrelated process on the requested port is never reused.

Options:

```powershell
.\tools\vs\Run-TinyRustLM.ps1 -NoBuild
.\tools\vs\Run-TinyRustLM.ps1 -Port 8090 -PortSearchLimit 10
.\tools\vs\Run-TinyRustLM.ps1 -NoBrowser
```

Stop debugging to stop a server started by the foreground run script.

## Test

```powershell
.\tools\vs\Test-TinyRustLM.ps1
```

This runs the complete developer gate documented in
`tinyrustlm/docs/testing.md`: canonical build, Rust workspace tests, standard
Node tests, formatting, Clippy, Rust documentation, and browser-owner syntax.

Add a real Chromium static-release smoke with:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

Use `-BrowserEvidenceRoot <absent-absolute-path>` when the evidence location
must be operator-controlled. The script refuses an existing root so an old run
cannot be overwritten or mistaken for new evidence.

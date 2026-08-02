# Visual Studio Setup

Open `TinyRustLM.sln` from the repository root in Visual Studio 2022.

Required local tools:

- Visual Studio 2022 with the Desktop development with C++ workload, for NMake project support.
- Rust toolchain with `cargo` and `rustup`.
- Node.js, used only for JavaScript execution smoke tools. Visual Studio F5, static app contract checks, and local route checks use no-crate Rust tools built by Cargo.

The solution contains one NMake project named `TinyRustLM`. Visual Studio does not compile Rust directly; it invokes the checked-in PowerShell scripts under `tools/vs/`, which call Cargo and the local static server.

## Build

Use `Build > Build Solution`.

The build script:

- Ensures the `wasm32-unknown-unknown` target is installed.
- Runs `cargo build --workspace`.
- Builds the release WASM runtime.
- Copies `target/wasm32-unknown-unknown/release/tinyrustlm_runtime.wasm` to `tinyrustlm/runtime/tinyrustlm.wasm`.
- Ensures the local `.slm` model artifacts and `.slm.manifest` provenance sidecars exist, including TinyLM-16M f32, q8_0, q4_0, the BPE fixture, and the tied-output fixture.
- Keeps the generated WASM and local model files in the locations used by the static browser app and smoke tests.

## Run

Use `Debug > Start Debugging` or press `F5`.

Visual Studio runs `tools/vs/Run-TinyRustLM.ps1`, which builds if needed, starts the Rust local static server, and opens:

```text
http://127.0.0.1:8080/app/
```

The run script checks whether the selected port is already serving TinyRustLM by loading `/app/` and probing `/runtime/tinyrustlm.wasm`. If that verified app is already running, F5 reuses it and opens the browser. If the port is occupied by another local service, the script checks the next ports and starts `target\debug\tinyrustlm-local-server.exe` on the first free loopback port.

Useful run options:

```powershell
.\tools\vs\Run-TinyRustLM.ps1 -NoBuild
.\tools\vs\Run-TinyRustLM.ps1 -Port 8090 -PortSearchLimit 10
.\tools\vs\Run-TinyRustLM.ps1 -NoBrowser
```

Stop debugging to stop the foreground server when the script starts one.

## Test

From a PowerShell terminal at the repository root:

```powershell
.\tools\vs\Test-TinyRustLM.ps1
```

The default test path builds the workspace, runs Cargo tests, checks handwritten JavaScript syntax, runs the Rust mini browser harness over the static app contract, validates every local `.slm` artifact with the native packer admission gate, validates each `.slm.manifest` provenance sidecar, validates the BPE and tied-output fixture routes, validates the tiny raw-f32 trained-source fixture, converts it into f32, q8_0, and q4_0 `.slm` artifacts, gates each converted artifact for `runtime-smoke`, runs `tinyrustlm-eval` over the scoped fixture cases for each converted mode, gates each eval sidecar for fixture-scoped `assistant-quality`, generates a tied-output source fixture, validates `tied_output=true` without `output.weight`, converts the tied source into f32, q8_0, and q4_0 artifacts, gates each tied converted artifact for `runtime-smoke`, generates a BPE source fixture, validates `tokenizer=bpe-v1` plus token and merge metadata, converts the BPE source into q8_0, gates that converted artifact for `runtime-smoke`, and runs the WASM ABI smoke for invalid UTF-8 prompt bytes, null pointers, invalid lengths, and recovery generation.

To include headless browser smoke for q8_0 and q4_0:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

That browser path also runs the Rust mini browser harness against the loopback server, then runs loop, malformed local model, context-overflow, missing-model, endurance, benchmark-panel performance smoke, Step Token click-through smoke, and the desktop/mobile UI audit. Like the F5 runner, it reuses a verified TinyRustLM server or starts on the first free loopback port from the requested browser-smoke port.

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke -BrowserSmokePort 8090 -PortSearchLimit 10
```

For a heavier repeated benchmark-panel check:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -PerformanceSoak -PerformanceSoakCycles 3 -PerformanceSoakTokens 4
```

`-PerformanceSoak` repeats multi-token q8_0 and q4_0 generation across cycles and checks deterministic output, prompt/generated counts, KV length, positive host-side token speed, scratch bytes, reset recovery, and local-only requests.

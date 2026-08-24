# UAIX Browser p2pRuntime Seed Host

`UAIX.Browser.p2pRuntime.SeedHost` is the downloadable companion for the
TinyRustLM and MiniModel peer network. It validates, stores, imports, and
serves `.slm` model pieces from a computer controlled by the user.

TinyRustLM.com remains the AI chat interface. The companion is the model and
network host: it does not replace the web conversation UI and does not create
a second chat-history state machine.

## Packages

- Library: `UAIX.Browser.p2pRuntime.SeedHost`
- Tool: `UAIX.Browser.p2pRuntime.SeedHost.Tool`
- Command: `uaix-p2p-seed`
- Target framework: .NET 8
- Native runtime assets: Windows x64, Linux x64, and Linux ARM64 when the
  corresponding release asset has passed its native CI job

Package `0.3.0` is the sole prelaunch source target for this contract. It is
not an install authority until the library, tool, and symbol packages have
passed clean-consumer verification, been published, and been independently
read back from NuGet.org. No package URL or install command is published while
that gate is pending. The accepted package identities and exact verified
commands will be added only after immutable public readback succeeds.

Run `doctor` before creating a fleet:

```powershell
.\.uaix-tools\uaix-p2p-seed doctor --json
```

## TinyRustLM Browser Bridge

Start the bridge from the user-owned fleet root. The default approved browser
origin is exactly `https://tinyrustlm.com`; development origins must be named
explicitly and are not wildcarded.

```powershell
.\.uaix-tools\uaix-p2p-seed bridge `
  --root C:\UAIX\SeedHost `
  --origin https://tinyrustlm.com `
  --port 43127
```

The command prints one pairing code to the local console. The server retains
only its digest, accepts the code once, and invalidates it after use, expiry,
or bridge shutdown. Successful pairing creates a short-lived capability bound
to the exact browser origin and closed operation scopes. Capabilities rotate
and revoke through dedicated contract routes and are lost when the bridge
restarts. They are separate from P2P peer configuration and optional
MemoryEndpoints credentials.

The canonical loopback API exposes only health, pairing/session control,
path-free runtime status, admitted-model listing, bounded import and conversion
control and progress, receipt-revalidated model and composition streaming, and
optional sharing control.
Every non-health operation validates the exact `Host`, `Origin`, closed route,
method, capability scope, and mutation request ID. The bridge has no
arbitrary path, shell, cookie, generic proxy, remote-control, or prompt route.
Prompts and responses remain inside the browser.

## Direct Model Acquisition

**Release status: blocked.** The companion still contains superseded SLM1
conversion and fixture assumptions. They are not a supported prelaunch path
and package `0.3.0` must not be built or published until the complete SLM2-only
replacement deletes them. The required release flow is:

1. Prefer a complete MiniModel offer whose artifact, piece set, model identity,
   and immutable composition graph agree.
2. Import that offer through the paired companion and revalidate it with the
   packaged Rust MiniModel authority.
3. If no complete verified peer offer exists, resolve a supported Hugging Face
   source to an exact 40-hex commit and explicit reviewed source-file contract.
4. Queue the immutable conversion request through the companion.
5. Resume bounded source downloads, verify exact byte counts and SHA-256
   digests, review the source contract, and invoke the sole registered SLM2
   conversion executable.
6. Reinspect the conversion receipt, validate the resulting `.slm`, create and
   inspect a base-only `.acg1`, then stream both artifacts to the browser.
7. Activate the graph in Rust/WASM before reporting the model ready.

The application reports queued, downloading, reviewing, converting,
validating, available, cancelled, and failed states. It does not download a
README, TXT file, request JSON, shell script, PowerShell script, conversion
kit, import kit, or serving helper for the user to run. Source tensors, model
bytes, and composition bytes never transit TinyRustLM.com, MiniModel.org,
UAIX.org, or MemoryEndpoints.com.

Only explicitly supported source architectures and immutable reviewed file
sets may enter conversion. A successfully converted artifact is structurally
valid evidence, not an assistant-quality promotion.

Sharing routes are absent unless the operator adds `--allow-sharing`. Even
then, browser actions can only manage receipt-verified imports inside the owned
fleet root. Local listener health does not create public announcement
eligibility; current outside-network proof for both lanes is still required.

## Fleet Model

Schema v0 has a fixed target capacity of 20 distinct artifact identities and
exactly two independent process lanes, `seed-a` and `seed-b`. A fleet may be
initialized empty and reports its remaining capacity. Each admitted model has
one manifest, one read-only peer-piece directory, and one companion state per
lane. The model bytes are not copied once per lane.

```powershell
uaix-p2p-seed init --fleet-id my-seed-host --root C:\UAIX\SeedHost

uaix-p2p-seed add-model `
  --root C:\UAIX\SeedHost `
  --model-id qwen/qwen2.5-1.5b-instruct-q4 `
  --artifact D:\Models\qwen2.5-1.5b-instruct-q4.slm `
  --source-model Qwen/Qwen2.5-1.5B-Instruct `
  --lane-a-bind 0.0.0.0:24101 `
  --lane-a-url http://203.0.113.10:24101/models/qwen/ `
  --lane-b-bind 0.0.0.0:24102 `
  --lane-b-url http://203.0.113.10:24102/models/qwen/
```

The Qwen example is only valid after substituting addresses controlled by the
operator. `203.0.113.10` is a documentation address and must not be announced.
No model is currently release-admitted. The old tiny q8 fixture is diagnostic
history only and cannot satisfy model quality, SLM2 integration, or release
gates.

Serve both lanes in the foreground:

```powershell
uaix-p2p-seed serve --root C:\UAIX\SeedHost
```

Ctrl+C creates a lane-specific owned shutdown signal. Each Rust process exits
cleanly, while stopping one lane does not stop the other.

## Health And Reachability

Configured, Rust-validated, listener-bound, locally reachable, externally
reachable, announcement-eligible, and advertised are different states. A
loopback, LAN, or same-host hairpin check is local evidence only.

The fleet always starts with `advertisement_status` set to
`external-probe-required`. Do not publish a MiniModel peer source until an
independent observer outside the host and local network has checked both lane
URLs and produced a current receipt bound to the fleet, lane, model, public
URL, artifact hash, piece-set hash, routes, and expiry.

Router port forwarding, host firewall rules, carrier-grade NAT, reverse
proxies, or an operator-approved tunnel may be required. None of those are
silently configured by the package.

## Security Boundary

- Rust MiniModel code remains authoritative for manifest, `.slm`, piece,
  Merkle, companion-state, import, assembly, and receipt validation.
- Managed code orchestrates typed operations and does not duplicate those
  trust rules.
- TinyRustLM.com, MiniModel.org, UAIX.org, and MemoryEndpoints.com do not host,
  run, or proxy model bytes for this package.
- Hugging Face is an optional immutable source host for reviewed conversion
  inputs; it is not a MiniModel seed endpoint or project model-byte host.
- Fleet files and process diagnostics contain no API keys or tokens.
- Native and process output is bounded; secret-like fields and URI user-info
  are redacted before diagnostics are exposed.
- Model removal changes configuration only. It does not delete model or piece
  data outside an explicit owned cleanup workflow.
- Training, premium routing, telemetry, license-server, and key-management
  internals are not included. The packaged Rust converter supports only the
  reviewed public source contracts declared by this release.

The release gate requires NuGet.org to publish the library package, tool
package, and their symbol sidecars. A clean public install must then resolve
exactly version `0.3.0`; inspect
the downloaded package with `dotnet nuget verify --all <package-path>` when an
independent repository-signature check is required. Self-contained companion
archives are a separate release channel and are not claimed as public until a
public distribution receipt and HTTPS readback exist.

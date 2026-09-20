# Browser Runtime Verification

Reviewed: 2026-09-20

## Purpose

TinyRustLM verifies its browser release through layered Node, Rust,
WebAssembly, and real Chromium gates. There is no separate mini browser harness
or alternate runtime. Each layer has a narrow claim boundary.

## Static Contract

Node tests validate the checked-in HTML, JavaScript, WASM manifest, deployment
inventory, security headers, publication logs, accessibility markers, and
privacy policy. `static-shell-parity.js` binds the root and app shells.
`web-deployment-manifest.js` rejects unlisted assets and model-member
publication.

## Runtime Contract

Rust tests establish format, parser, runtime, and browser ABI behavior.
`browser-runtime-web-artifact.js` proves the deployable WASM bytes match their
manifest. Worker tests prove the exact UI/worker protocol, bounded transfers,
sequence ownership, activation, generation, cancellation, terminal faults,
and release.

Generation uses the admitted session's context ceiling, which may be smaller
than the model's advertised context. The controller must stop normally at that
ceiling and retain generated output, rather than attempting another scalar
forward and aborting the turn. The scalar/controller regression covers this
boundary. Exact-full prompts terminate without sampling. Actual qualified
six-member conversation and real-model browser evidence remain separate gates.

The September 20 local artifact refresh is reproducible from the corrected
source in two fresh offline builds. Its manifest and checked identity change
together. This is a development artifact change, not public deployment or
material model qualification; historical execution records remain unchanged.

## Real Chromium Contract

`model-runtime-worker-browser.test.js` executes the actual worker and WASM in
owned persistent Chromium profiles. `web-release-local-smoke.js` verifies the
committed site at desktop, narrow-desktop, and mobile viewports. Profile roots
are uniquely marked, browser processes are closed, and deletion is verified.

Node execution or a page reload is not browser-profile evidence.

Set `TINYRUSTLM_PLAYWRIGHT_CHANNEL=msedge` to run the loader, worker and client
browser gates with installed Edge. If unset, Playwright uses its bundled
Chromium. Record which browser actually ran; a missing executable is an
environment failure, not runtime disagreement.

## Release Contract

The release surface binds one newly executed campaign projection, exact web
assets, public-safe generated control documents, security headers, source
revision, and HTTPS readback. It cannot infer deployment from a package build
or infer a real model from fixtures.

The sole campaign runner is documented in `vnext-campaign-runner.md`.

## Privacy Boundary

TinyRustLM.com serves app code, WASM, schemas, metadata and public-safe release
records. MiniModel.org is authorized to serve the initial verified model seeds.
These public download origins may not receive user prompts, responses, uploaded
compositions, MemoryEndpoints credentials or implicit telemetry. Direct P2P,
loopback companion and opt-in hosted-memory traffic require separate allowlisted
operations and evidence. Serving model bytes does not authorize remote inference.

## Commands

```powershell
npm --prefix tinyrustlm run test:unit
npm --prefix tinyrustlm run test:model-runtime-worker
npm --prefix tinyrustlm run test:model-runtime-worker-browser
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

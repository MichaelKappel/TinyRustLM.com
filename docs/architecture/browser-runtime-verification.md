# Browser Runtime Verification

Reviewed: 2026-08-28

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

## Real Chromium Contract

`model-runtime-worker-browser.test.js` executes the actual worker and WASM in
owned persistent Chromium profiles. `web-release-local-smoke.js` verifies the
committed site at desktop, narrow-desktop, and mobile viewports. Profile roots
are uniquely marked, browser processes are closed, and deletion is verified.

Node execution or a page reload is not browser-profile evidence.

## Release Contract

The release surface binds one newly executed campaign projection, exact web
assets, public-safe generated control documents, security headers, source
revision, and HTTPS readback. It cannot infer deployment from a package build
or infer a real model from fixtures.

The sole campaign runner is documented in `vnext-campaign-runner.md`.

## Privacy Boundary

Project origins may serve app code, WASM, schemas, metadata, and public-safe
release records. They may not receive prompts, responses, model members,
composition bytes, MemoryEndpoints credentials, or implicit telemetry. Direct
P2P, loopback companion, and opt-in hosted-memory traffic require separate
allowlisted operations and evidence.

## Commands

```powershell
npm --prefix tinyrustlm run test:unit
npm --prefix tinyrustlm run test:model-runtime-worker
npm --prefix tinyrustlm run test:model-runtime-worker-browser
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

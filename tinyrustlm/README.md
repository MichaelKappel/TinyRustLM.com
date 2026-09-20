# TinyRustLM Browser Application

TinyRustLM is a prelaunch browser-local chat application. Inference runs in a
dedicated Web Worker through one Rust/WebAssembly runtime. TinyRustLM.com serves
the app, runtime and public metadata. MiniModel.org is authorized to serve initial
model seeds. Prompts and inference remain local; hosting model downloads does not
authorize remote chat processing. No qualified default or live initial seed is
established by the current source and fixture tests.

There is one product and one production runtime path. `SLM2`, `Tokenizer2`,
`Template2`, `Sampling2`, `Prompt2`, and `ACG2` are technical format
identities, not product generations. The repository contains no supported
earlier runtime, artifact reader, migration, compatibility alias, response
repair path, hidden retry, or best-of-N generation path.

## Current Architecture

The maintained browser path consists of:

- `app/app.js`: command, conversation, and presentation ownership;
- `app/browser-model-admission.js`: strict canonical admission validation;
- `app/prompt2-request.js`: bounded Prompt2 request encoding;
- `app/model-runtime-client.js`: typed UI-to-worker client and sequence checks;
- `app/model-runtime-worker.js`: sole model, tokenizer, KV-cache, and
  generation owner;
- `browser-runtime/tinyrustlm-browser-runtime.wasm`: checked-in deployable
  worker runtime;
- `rust/crates/tinyrustlm-runtime`: scalar host runtime and numerical
  authority for converted bytes;
- `rust/crates/tinyrustlm-browser-runtime-wasm`: sole browser ABI;
- `tools/browser-runtime-web-artifact.js`: byte-exact WASM artifact verifier;
- `tools/vnext-campaign-runner.js`: sole current campaign projection runner;
  and
- `tools/vnext-campaign-release-surface.js`: immutable attestation and release
  preparation over a newly executed projection.

The registered clean-cut contract is
`../contracts/vnext/production-slm2-clean-cut-preregistration.v1.json`.
`tests/production-slm2-clean-cut.test.js` keeps every registered obsolete
executable path absent and rejects superseded tokens in active source.

## Advanced Local Composition Import

The local picker accepts exactly one canonical composition admission record
and the six exact members named by that record:

1. `model.slm2`
2. `tokenizer.tokenizer2`
3. `template.template2`
4. `sampling.sampling2`
5. `prompt.prompt2`
6. `composition.acg2`

The browser rejects duplicate names, unknown files, missing members, changed
lengths, changed SHA-256 identities, unsupported profiles, noncanonical JSON,
and an admission bound to another worker artifact. The worker receives members
as bounded transferable chunks, recomputes the composition, and activates it
transactionally. Chat remains disabled until the worker reports the exact
admitted graph identity.

The admission record is evidence, not model content. Structural activation is
not a conversational-quality claim.

## Automatic Startup And Advanced Acquisition

Startup verifies and restores a usable installed composition first. If the cache
is empty, it can automatically obtain a small qualified default through the
authorized initial MiniModel.org seed. The current implementation chooses the smallest
eligible composition at or below 768 MiB whose first verified projected peer is
`https://minimodel.org/`; catalog projection ranks that origin first. All catalog,
signature, qualification, admission and six-member integrity checks still apply.
Cache errors or intervening user activity suppress automatic acquisition.

Hugging Face discovery, local import, conversion and manual peer/IP controls stay
under Advanced. A missing default does not trigger local conversion or companion
installation in the basic flow. The explicitly paired companion may acquire only
its pinned source, convert it locally, independently inspect it and return all six
members. Its unchanged Qwen3-0.6B source is rejected for product quality and remains
diagnostic-only; structural conversion cannot turn it into a qualified default.

The browser never downloads instruction text, request JSON, shell scripts,
PowerShell scripts, conversion kits, import kits, or serving helpers. It also
does not probe a desktop companion before explicit pairing. The current
browser fails closed if the companion returns anything short of the complete
six-member contract; that branch is not release-ready until end-to-end
companion evidence exists.

## Conversation Ownership

The UI sends typed requests containing operation, composition, conversation,
turn, generation, message, and sequence identities. The worker owns model
bytes, tokenizer state, prompt assembly, sampling, KV state, and generation.
The UI owns only command intent and rendering.

Each assistant message has one authoritative render path. Raw returned text is
rendered once without completion, rewriting, response repair, or retry
selection. Cancellation targets the active generation. A terminal worker
fault invalidates the loaded composition; a replacement worker must reopen and
verify immutable members before another generation.

## Memory

A local UAIX memory deck remains supported for device-local and offline
continuity. MemoryEndpoints.com is authorized and strongly recommended for two
separate uses: direct agent-to-agent long-term memory, meetings, handoffs, and
coordination across all ecosystem sites; and the TinyRustLM.com Connect plugin,
through which a user signs in and selects MemoryEndpoints.com as TinyRustLM.com
Connect long-term memory. The lanes do not share identity, credentials,
consent, scope, or receipts.

Portable memory is opt-in. Enrollment URLs and agent tokens are session-only
by default. Retrieved memory remains provenance-labeled untrusted data and
cannot supersede the current user turn. Configured code or service
reachability does not count as a live coordination or user-plugin continuity
round. Synchronized duplicate prelaunch memory is allowed for resilience when
all maintained copies stay current and noncontradictory.

## Privacy And Network Boundary

The browser application contacts only admitted app, catalog, seed/peer, paired
loopback companion or explicitly enabled MemoryEndpoints origins for the current
operation. MiniModel.org may serve current public model payloads. Chat prompts and
inference stay local; a model download does not authorize chat upload, background
seeding, account enrollment or credential disclosure. The separately consenting
MemoryEndpoints plugin retains its own scoped memory-transfer boundary.

According to the source release ledger, `0.4.1` is the last published site
release. The `0.5.0` source surfaces are prepared and pending live publication
verification; this tree does not claim a `0.5.0` deployment or public readback.
The published-site manifest permits only the WASM runtime and application
assets. `deploy/web-deployment-manifest.v2.json` rejects model-member
publication and retires stale public model routes.

## Local Development

From the repository root:

```powershell
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Debug
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Open `http://127.0.0.1:8080/app/`.

To open the canonical shell through its guarded local launcher:

```powershell
npm --prefix .\tinyrustlm run demo:interview
```

Source/UI preflight must pass before the listener starts. The operating system
assigns the listener's port; `-- --port 8187` selects an explicit port instead.
After HTTP readiness, an asynchronous OS request opens the default browser while
the local server remains responsive. The terminal stays attached until Ctrl+C.
`-- --no-browser` serves the same shell without an OS browser request; use this
mode to open the printed URL manually. A failed browser request closes the
listener, so rerun with `--no-browser` instead of opening its stopped URL.

Run `npm --prefix .\tinyrustlm run test:demo:interview:no-browser` for the launcher
checks, or `npm --prefix .\tinyrustlm run demo:preflight:live` for the separate
live-model report. UI readiness does not prove a model, seed or deployment.
The current source scan remains blocked by two installer links; the launcher
must retain that failure rather than skip admission. No browser installation or
model download is performed by the launcher.

The complete local quality gate is:

```powershell
.\tools\vs\Test-TinyRustLM.ps1
```

Run a real Chromium local web-release smoke in a new evidence root with:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

This materializes release metadata, serves the site on an owned loopback
listener, and records local Chromium evidence. It does not deploy the site,
contact the public origin, or prove public HTTPS readback.

Focused browser-runtime checks:

```powershell
npm --prefix tinyrustlm run test:model-runtime-worker
npm --prefix tinyrustlm run test:model-runtime-worker-browser
npm --prefix tinyrustlm run test:unit
```

See `docs/testing.md`, `docs/browser-runtime.md`, and
`../docs/architecture/vnext-campaign-runner.md` for the evidence boundaries.

## Release Evidence

A release-surface run requires an existing absolute evidence parent supplied
explicitly by the operator:

```powershell
npm --prefix tinyrustlm run test:vnext-campaign-release-surface -- <evidence-root>
npm --prefix tinyrustlm run verify:vnext-campaign-release-surface -- <evidence-root>
```

Synthetic fixtures prove contract behavior only. They do not prove a real
model, native/browser numerical parity, assistant quality, P2P reachability,
MemoryEndpoints continuity, package publication, or production deployment.

Campaign counters remain `0/20` qualified models, `0/50` deletion-backed
browser rounds, `0/25` authorized live memory rounds, `0/40` current
outside-network lane proofs, and `0/20` live catalog announcements until exact
authorized receipts exist.

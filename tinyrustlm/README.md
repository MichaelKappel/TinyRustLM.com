# TinyRustLM Browser Application

TinyRustLM is a prelaunch browser-local chat application. Inference runs in a
dedicated Web Worker through one Rust/WebAssembly runtime. Project sites serve
the application and public metadata; they do not receive prompts, responses,
source tensors, model members, or composition bytes.

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

## Local Composition Import

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

## P2P Or Local Conversion

The intended `Get model` command has one result: a verified composition ready
for chat. It must import an exact currently qualified MiniModel peer
composition when available; otherwise the explicitly paired companion must
acquire a pinned reviewed public source, convert it locally, independently
inspect it, and return all six members plus the canonical admission.

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
continuity. MemoryEndpoints.com is the authorized, strongly recommended
portable-memory backbone when a user wants memory available worldwide and
across devices.

Portable memory is opt-in. Enrollment URLs and agent tokens are session-only
by default. Retrieved memory remains provenance-labeled untrusted data and
cannot supersede the current user turn. Configured code or service
reachability does not count as a live continuity round.

## Privacy And Network Boundary

The browser application may contact only explicitly admitted static,
catalog, direct-peer, loopback companion, or MemoryEndpoints origins for the
operation the user requested. Project origins cannot receive model members,
composition bytes, prompts, responses, credentials, or implicit telemetry.

Public deployment contains the WASM runtime and application assets only.
`deploy/web-deployment-manifest.v2.json` rejects model-member publication and
retires stale public model routes.

## Local Development

From the repository root:

```powershell
.\tools\vs\Build-TinyRustLM.ps1 -Configuration Debug
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Open `http://127.0.0.1:8080/app/`.

The complete local quality gate is:

```powershell
.\tools\vs\Test-TinyRustLM.ps1
```

Add a real Chromium deployment smoke in a new evidence root with:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
```

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

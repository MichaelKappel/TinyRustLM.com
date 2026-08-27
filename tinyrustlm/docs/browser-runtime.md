# TinyRustLM Browser Runtime

Status on 2026-08-27: **release blocked during the canonical runtime clean
cut**. The raw SLM2/ACG2 Rust/WASM boundary exists and passes focused local
tests, but the production worker, UI integration, real-browser conversation
evidence, and deletion of the superseded runtime are not complete. The current
site must not be described as using the canonical browser runtime until all of
those conditions are satisfied in one tested replacement.

This document distinguishes the canonical replacement from the checked-in
pre-cutover implementation that still has to be removed. Describing that old
implementation is a deletion inventory, not a compatibility promise or a
supported second path.

## Canonical Replacement Status

The canonical replacement is registered by
`contracts/vnext/browser-runtime-wasm-clean-cut-preregistration.v1.json` and
implemented in part by `rust/crates/tinyrustlm-browser-runtime-wasm`. The local
implementation checkpoint at remote-exact commit
`5c4f46c7af35bc6e892097cd4924ca58286efa8c` establishes:

- one import-free raw WASM module with an exact 16-function application export
  allowlist;
- one pending move-only transfer and one committed value per closed artifact
  kind;
- exact canonical Sampling2 and Prompt2 transfer sizes of 65,800 and 512
  bytes;
- transactional ACG2 activation with one model allocation moving into the
  runtime and no retained second model owner;
- caller-owned operation authority that remains distinct from composition
  identity;
- bounded state, step, output, and error results; and
- terminal release that drops transfers, staged members, runtime, model,
  prompt, and KV state.

Focused Rust, clippy, Node WebAssembly, and opt-in private structural activation
tests pass for this boundary. Node WebAssembly is not browser evidence, and the
private activation proves structure and bounded ownership only. It does not
prove generation quality, native/browser parity, a browser conversation,
release, deployment, publication, P2P availability, or campaign credit.

The clean cut remains incomplete because
`tinyrustlm/app/model-runtime-worker.js` is not implemented, `app.js` still
owns the pre-cutover runtime path, and the SLM1/ACG1 executable surfaces and
packaged bytes are still present. Release and deployment remain blocked until
the worker is the sole runtime owner, the UI is command/presentation only,
real Chromium evidence passes, and every superseded executable path is
deleted without an alias, reader, shim, fallback, feature flag, or migration.

The worker protocol is nevertheless closed before implementation. It permits
only eleven exact commands and twelve exact event kinds, streams artifact bytes
in contiguous transferred chunks no larger than 4 MiB, derives operation
transfers internally, finishes terminal generation inside the worker, and
provides no generic invocation, separate finish, URL, path, network, or
whole-model JavaScript ownership surface. This registration is design
authority only until the worker tests and real Chromium gates pass.

## Superseded Pre-Cutover Inventory

The currently checked-in application still loads the superseded Rust/WASM ABI
on the UI thread and accepts model bytes through the browser file-selection
control. This code is not a maintained alternate runtime. It must be replaced
and deleted as part of the clean cut.

The interactive chooser uses one P2P-first acquisition state machine. A
complete identity-matched peer offer is imported through an explicitly paired
local companion. If no complete verified offer exists, protocol v2 sends an
immutable source contract to that companion, which downloads approved files
from the exact Hugging Face commit, verifies byte counts and SHA-256 digests,
runs the packaged Rust conversion and validation commands, creates and
reinspects a base-only composition graph, and streams both artifacts over the
secured loopback bridge. The browser activates the graph before reporting
`Ready`.

The acquisition result is the running model, not a handoff file. README/TXT,
request JSON, shell, PowerShell, conversion-kit, import-kit, share-kit, and
serving-helper downloads are prohibited. The application origin does not host
model or composition bytes, and the companion receives no prompts or
responses.

Local UAIX memory packages are reported through a FileDeck-style summary that
keeps required-file counts, persona dimensions, evidence, exports, manifest
overlay, package model, knowledge graph, and `llms` artifacts visible as
separate validation facts. Package content enters the bounded context only
after its own integrity and trust checks pass.

Campaign execution adds a sealed composition layer:

1. The campaign validator verifies the `.slm` and `.slm.acg1` paths, sizes, and
   declared SHA-256 values.
2. Native qualification evidence must bind the same graph bundle, composition
   ID, and active graph SHA-256.
3. The app imports the `.slm` through `#localModelFile`.
4. The app retrieves the exact application-origin `.slm.acg1` URL.
5. Rust activates the graph before the runtime reports `Ready`.
6. The browser harness reads `#diagnostics` and requires exact identity
   agreement.
7. Conversation generation begins only after activation succeeds.

The runtime diagnostic contract used by campaign evidence includes:

```text
model_loaded
composition_active
active_composition_bundle_sha256
active_composition_id
active_composition_graph_sha256
active_route_policy_id
active_kv_format_id
active_composition_member_count
composition_activation_count
```

The browser evidence runner requires exactly one GET for the configured graph
URL. A missing, duplicate, redirected, cross-origin, or identity-drifting graph
cannot produce a passing receipt.

## Superseded ACG1 Campaign Inventory

An ACG1 graph is metadata, not a second model artifact. Its campaign identity
binds:

- the exact graph bundle bytes;
- the base model content ID;
- the composition content ID;
- the active graph hash;
- route policy;
- KV-cache format;
- position policy;
- member count.

The browser does not construct a model from mutable adapter lists, inferred
sidecars, aliases, or a mutable plan. Any specialized behavior must already be
represented by an immutable, qualified graph and be activated through the same
runtime path evaluated natively.

## Fresh Profile Lifecycle

`fresh-browser-conversation.js` uses a Playwright persistent Chromium context
with a campaign-owned profile directory. A page reload, incognito context, new
tab, storage clear, or normal browser context is not equivalent.

For each non-memory round the runner:

1. Creates a marked root below an operator-supplied profile parent.
2. Creates a uniquely marked round profile.
3. Verifies ownership, containment, and freshness.
4. Launches Chromium against that profile.
5. Closes the context after inspection or failure.
6. Scans the profile while it still exists.
7. Deletes the profile using the ownership-checked deletion path.
8. Removes the owned root.
9. Hashes the deletion receipt into browser evidence.

The profile scanner is bounded to 20,000 files, 512 MiB total, and 64 MiB per
file. Incomplete scanning is a failure. Known secret canaries are checked in
UTF-8, UTF-16LE, and base64 forms. Public evidence records only bounded counts
and hashes.

## Conversation Assertions

Each scheduled round has two to six private turns. The runner preserves the raw
assistant text only long enough to compute the private conversation hash. It
does not repair malformed text, choose a best retry, or append expected terms.

For each turn it requires:

- one new user message;
- one new completed assistant message;
- non-empty assistant text;
- exactly one authoritative `#response` node;
- the application generation state to return to idle.

After the first turn, introductory content and starter cards must be hidden.
At the end, document width must fit the viewport and the composer must remain
inside the viewport.

The public job result excludes prompt text, assistant text, local model paths,
known secrets, and future unrecognized execution fields.

## Network Policy

The network analysis starts with the exact application origin and adds only the
round's explicit `allowedOrigins`. Origin entries must be uncredentialed,
origin-only HTTPS URLs, except that explicit loopback HTTP is accepted for
local tests.

A round fails for:

- a prompt in a request URL or body to a project host;
- a `.slm` request to a project host;
- any unallowlisted loopback origin;
- any unallowlisted remote origin;
- credentials in a configured URL;
- a graph URL outside the application origin.

An `.slm.acg1` request is composition metadata and is not counted as a model
byte request. Paths ending exactly in `.slm` are model-byte routes.

The application origin is not an implicit allowance for MiniModel,
MemoryEndpoints, UAIX, or another related domain. Every optional service origin
must be present in that round's sealed allowlist.

## Receipt Binding

`browser-round-evidence.js` writes
`tinyrustlm.browser-dogfood-round-v4`. A receipt binds:

- campaign and round identities;
- qualification receipt ID;
- `.slm` hash;
- graph bundle and active graph hashes;
- composition ID;
- manifest, source, and quality evidence hashes;
- eval cases, converter, evaluator, and chat-template hashes;
- prompt format, system-prompt hash, model sampling profile, and exact round
  sampling controls;
- the browser-observed admission identity and per-turn runtime diagnostics;
- browser executable, browser version, and Playwright version;
- application origin;
- viewport and reduced-motion configuration;
- raw conversation hash;
- profile ownership and deletion hashes;
- network and secret-scan counts;
- pass or failure status.

Only a real passing qualification receipt can be a parent. Fixture evidence is
rejected before browser execution counts toward the campaign.

## Operator Entry Point

From the repository root:

```powershell
npm --prefix tinyrustlm run run:browser-round -- `
  <campaign.json> `
  <round-number> `
  <evidence-root> `
  <owned-profile-parent> `
  <public-result.json>
```

The command refuses a round whose `memoryContinuity` field is true.
MemoryEndpoints rounds require a separate authorized live executor because a
local fixture cannot satisfy enrollment, continuity, revocation, or cleanup
gates.

## Local Verification

```powershell
npm --prefix tinyrustlm run test:browser-contract
node --test tinyrustlm/tests/dogfood-campaign.test.js tinyrustlm/tests/vnext-campaign-runner.test.js
npm --prefix tinyrustlm run test:vnext-campaign-release-surface -- <absolute-evidence-root>
npm --prefix tinyrustlm run verify:vnext-campaign-release-surface -- <absolute-evidence-root>
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm
```

Campaign projection uses only the Rust-backed vNext runner documented in
`../../docs/architecture/vnext-campaign-runner.md`; there is no mutable or
compatibility runner.
Fresh final attestation and operator status use only the internal runner result
through `../../docs/architecture/vnext-campaign-release-surface.md`; browser
code cannot submit stored projection bytes or counters as release truth.

The JavaScript tests cover graph drift, missing graph requests, strict network
allowlisting, secret encodings, hosted-memory refusal, profile evidence,
failure preservation, and public-output minimization.

The Rust browser harness audits checked-in static assets and may probe a
loopback server. It does not launch the 50-round campaign and cannot satisfy a
fresh-profile or live external gate.

## External Gates

The following remain unproven until current authorized receipts exist:

- live MemoryEndpoints contract discovery and 25 cleanup-backed runs;
- two outside-proven P2P lanes for each of 20 qualified artifacts;
- catalog announcements and unauthenticated readback;
- public HTTPS release hash readback;
- physical `linux-arm64` execution;
- package publication and downstream consumption.

These conditions must appear as explicit blockers or incomplete counters. Local
health, fixtures, emulation, and cross-compilation are supporting evidence only.

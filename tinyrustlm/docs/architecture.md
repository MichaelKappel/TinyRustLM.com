# Architecture

## Product Boundary

TinyRustLM is one prelaunch browser-local assistant. The product has one
current execution architecture. Names such as SLM2, Tokenizer2, Template2,
Sampling2, Prompt2, and ACG2 are technical format identities, not product
generations and not authorization for compatibility paths.

The browser site publishes application code, the import-free WebAssembly
runtime, and public metadata. It does not host model bytes, receive prompts,
run remote inference, or proxy source-model downloads. Model bytes are selected
locally, transferred directly from a consenting peer, or converted locally
from an immutable public source revision by the authenticated companion.
MiniModel.org is explicitly authorized to serve initial model seeds; its seed
and catalog roles are separate from TinyRustLM.com's app/runtime publication.
The browser obtains exact composition bytes directly from the admitted seed or
peer. Prompts and inference remain local. Older metadata-only restrictions on
MiniModel.org are superseded by the owner's seed-hosting requirement.

The current browser source restores a usable installed composition, or attempts
automatic acquisition of a small qualified default from MiniModel.org. The compact
chooser retains explicit model selection. Source discovery, import, conversion,
custom catalog/peer settings and diagnostics belong under Advanced. The basic path
does not fall back to companion conversion. No qualified default or proven live
initial seed is established; source behavior and synthetic fixtures are separate
from product readiness.

## Sole Composition

An executable model is one exact six-member composition:

| Order | Role | Canonical file | Format authority |
| --- | --- | --- | --- |
| 0 | model | `model.slm2` | `org.minimodel.slm2/2.0` |
| 1 | tokenizer | `tokenizer.tokenizer2` | `org.minimodel.tokenizer2/2.0` |
| 2 | template | `template.template2` | `org.minimodel.template2/2.0` |
| 3 | sampling | `sampling.sampling2` | `org.minimodel.sampling2/2.0` |
| 4 | prompt | `prompt.prompt2` | `org.minimodel.prompt2/2.0` |
| 5 | composition | `composition.acg2` | `acg2.0` |

The graph binds every member by role, exact byte length, and lowercase SHA-256.
Paths, aliases, timestamps, mutable catalog names, and producer assertions are
not artifact identity. Browser activation additionally requires one canonical
browser admission document that binds the six artifacts, qualification
evidence, the worker protocol, the exact WASM artifact, bounded runtime policy,
and default sampling.

Unknown fields, duplicate keys, omitted members, additional members, reordered
members, aliases, changed bytes, unsupported profiles, and resource
under-declaration reject before activation. The browser does not translate an
older shape or infer a missing member.

Normative design records:

- `docs/architecture/adr/ADR-013-slm2-format-profile.md`
- `docs/architecture/adr/ADR-014-tokenizer2-format-profile.md`
- `docs/architecture/adr/ADR-015-template2-format-profile.md`
- `docs/architecture/adr/ADR-016-sampling2-format-profile.md`
- `docs/architecture/adr/ADR-017-prompt2-composition-profile.md`
- `docs/architecture/adr/ADR-019-acg2-champion-format.md`
- `docs/architecture/vnext-slm2-format-implementation.md`
- `docs/architecture/vnext-tokenizer2-format-implementation.md`

## Component Ownership

Each semantic responsibility has one owner:

- `rust/crates/tinyrustlm-slm2`: SLM2 parsing, writing primitives, tensor
  structure, and exact profile validation.
- `rust/crates/tinyrustlm-tokenizer2`: Tokenizer2 parsing, encoding, and
  decoding.
- `rust/crates/tinyrustlm-template2`: bounded declarative chat rendering.
- `rust/crates/tinyrustlm-sampling2`: deterministic greedy and seeded
  stochastic sampling.
- `rust/crates/tinyrustlm-prompt2`: authority-ordered prompt construction.
- `rust/crates/tinyrustlm-composition2`: ACG2 parsing, identity binding, and
  activation preflight.
- `rust/crates/tinyrustlm-runtime`: host-facing conversation state and scalar
  semantic authority.
- `rust/crates/tinyrustlm-slm2-runtime`: converted tensor interpretation and
  scalar numerical execution.
- `rust/crates/tinyrustlm-browser-runtime-wasm`: the sole browser ABI over the
  canonical runtime.
- `rust/crates/tinyrustlm-native`: the sole native ABI.
- `rust/crates/tinyrustlm-convert`: pinned-source conversion and bounded
  conversion receipts.
- `rust/crates/tinyrustlm-p2p`: composition-bound fixed-piece transport.
- `dotnet/src/TinyRustLM.Core`: managed wrapper over the current native ABI.
- `dotnet/src/TinyRustLM.Companion`: secure loopback capability and
  six-artifact operation contracts.
- `tinyrustlm/app/model-runtime-worker.js`: sole browser owner of WASM, model
  transfer, activation, generation, cancellation, and runtime state.
- `tinyrustlm/app/model-runtime-client.js`: typed top-window client for the
  worker protocol.
- `tinyrustlm/app/app.js`: user commands and exactly-once presentation only.

A second parser, tokenizer, runtime, event path, serializer, fallback backend,
or response repair path is a defect. Source-control history is the rollback
mechanism; runtime compatibility is not.

## Browser Runtime

The top window loads and verifies
`browser-runtime/tinyrustlm-browser-runtime.wasm` against its canonical
manifest, then transfers the module bytes to a dedicated worker. The worker
locks network-capable globals before attaching the runtime and accepts only the
closed command set defined by `tinyrustlm.model-runtime-worker/1`.

Activation streams all six artifacts in bounded contiguous chunks. The worker
owns transferred bytes, validates exact operation and composition authority,
commits the composition atomically, and exposes only typed bounded state. The
top window never interprets model tensors, owns no KV cache, and cannot invoke
an arbitrary WASM export.

The browser creates a fresh worker when the admitted composition or runtime
policy changes; operation-ID advancement alone cannot change initialization
limits. Model preparation and generation are mutually exclusive. A pending
turn or answer blocks model selection, and pending acquisition or activation
blocks a new turn. Failure cleanup remains bound to its own worker.

Generation begins from one canonical Prompt2 request. Token IDs and decoded raw
output remain the authoritative private result. Repeated token text is valid
content and is not message duplication. Each generation has one message ID and
one terminal result. Cancellation is a real runtime command; a protocol,
identity, ABI, or transfer failure terminates the worker instead of retrying or
falling back.

Qualification is checked before the turn, at each generation step, and before
accepting completed output. A one-second timer also rechecks while asynchronous
work is pending and terminates that worker on expiry. Browser scheduling can
delay timer delivery, so step and result checks remain mandatory. Expired or
superseded work is a failed turn, never a successful response.

See `tinyrustlm/docs/browser-runtime.md` and
`docs/architecture/browser-runtime-verification.md` for the implemented
boundary and its current proof limits.

## Memory

Local UAIX files remain supported for device-local and offline continuity.
MemoryEndpoints.com is the authorized and strongly recommended portable-memory
backbone for cross-device continuity. These are separate stores and evidence
domains; raw conversation is not silently promoted into durable memory.

The current user turn outranks stale profile or retrieved memory. Retrieved and
quoted natural language is untrusted data, never a capability, credential,
schema, or instruction to the runtime. Browser credentials are session-only by
default and are excluded from prompts, logs, screenshots, local persistence,
and public receipts.

Configured code or service reachability is not a live continuity receipt. The
campaign remains at `0/25` until exact authorized create, reconnect, restore,
replay-rejection, cleanup, and deletion evidence exists.

## Acquisition And Companion Boundary

The implemented browser routes are:

1. reopen an exact admitted composition already installed in the browser when
   its stored identities still verify;
2. with an empty usable cache, choose the smallest qualified composition at or
   below 768 MiB whose first projected peer is `https://minimodel.org/`. Current
   catalog projection ranks that seed first after signature and identity checks;
3. fetch its six members directly from the seed using the canonical
   root-origin authority and derived protocol routes, while independently
   binding catalog, admission, qualification receipt, graph, length, and
   digest identities;
4. preserve explicit selection of other qualified peers. Local import, source
   discovery/conversion and manual peer settings require Advanced; companion
   operations additionally require explicit one-time loopback pairing;
5. stream the selected route through the bounded browser composition store,
   verify the complete six-member closure, commit it atomically, and activate
   it through the worker; and
6. after a companion conversion is installed, request a companion-owned local
   direct seed for that exact available operation. Local seed readiness is not
   a catalog announcement, public reachability proof, or qualified peer claim.

A downloaded TXT, README, script, request file, or JSON handoff is not model
acquisition. MiniModel.org may host the initial seeds; inference stays local.
The browser's direct-P2P installer is separate from the companion acquisition
operation: seed/peer bytes travel directly into browser-owned storage without
transiting the companion or TinyRustLM.com. The companion operation
remains deliberately source-only and cannot accept an arbitrary model, URL, or
filesystem path.

Cache verification or activation failure suppresses automatic replacement; user
activity can also suppress bootstrap. No eligible seed leaves an honest unavailable
state. The automatic 768 MiB ceiling is a source limit, not evidence of browser
memory, speed or model quality. The companion's pinned unchanged Qwen3-0.6B revision
`c1899de289a04d12100db370d81485cdf75e47ca` is rejected for product quality and may
serve only diagnostic work, or separately approved new-derivative training.

The managed companion defines the exact source-only
`tinyrustlm.companion.acquire.v2` request,
`tinyrustlm.companion.operation.v3` journal record, six-member artifact set,
and `tinyrustlm.companion.loopback-capability/4` cryptographic protocol. The
source intent and receipt bind one canonical nine-file payload-inventory
identity derived from the pinned lock; arbitrary digest-shaped acquisition
claims reject. The product UI loads the matching browser capability client,
independently admits the same exact source constants, polls the one operation,
and streams the six verified artifacts without trusting the companion's
digest claims. The host connects the operation, artifact-chunk, cancellation,
and direct-seed services to the bounded listener. Earlier one-file,
request-download, script-handoff, and peer-placeholder routes are not supported
alternate paths.

These statements describe implemented source and local deterministic test
surfaces. They do not establish an installable companion package, a qualified
real model, a live catalog entry, a publicly reachable peer, a completed
browser round, deployed `0.5.0` bytes, or public HTTPS readback. Those claims
remain withheld until their separate evidence gates close.

## Evidence And Promotion

Evidence is append-only and content-addressed. A producer records only what it
observed. Independent validators recompute file type, length, digest, member
closure, graph identity, path containment, and semantic invariants. Failed and
obsolete receipts are immutable history and never become accepted input through
translation or repair.

The proof chain is intentionally separated:

1. immutable source closure;
2. deterministic conversion transaction;
3. independent six-member structural and semantic inspection;
4. source-framework to scalar-native numerical parity;
5. optimized-native parity;
6. real-browser WASM parity;
7. no-cheat behavioral qualification;
8. genuine clean-profile multi-turn browser chat;
9. exact seed/peer installation and, where claimed, Advanced local-conversion proof;
10. committed release, deployment, and HTTPS readback.

Passing one stage proves no later stage. Current campaign counters remain
`0/20` qualified models, `0/50` clean browser rounds, `0/25` live memory
rounds, `0/40` externally proven P2P lanes, and `0/20` catalog announcements.

## Clean-Slate Change Rule

Before launch, a corrected contract replaces the sole implementation:

1. preserve the raw failure;
2. add a generic failing test and hostile counterexamples;
3. define the exact replacement contract;
4. update every producer and consumer coherently;
5. delete superseded executable source, fixtures, tests, docs, assets, and
   package symbols;
6. run positive, negative, malformed, boundary, differential, and release
   gates;
7. commit and push the green change;
8. deploy only when every affected release gate passes and public readback
   matches the committed release.

No compatibility reader, migration, alias, temporary branch, hidden retry,
best-of-N selection, response completion, or deferred cleanup is permitted.

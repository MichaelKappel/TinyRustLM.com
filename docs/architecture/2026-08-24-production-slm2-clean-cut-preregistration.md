# Production SLM2 Clean-Cut Preregistration

## Status

This document freezes the implementation boundary for the next TinyRustLM
production change before the root Rust workspace, runtime, converter, native
ABI, .NET wrappers, P2P admission, companion acquisition path, browser worker,
or release-store algorithm changes.

TinyRustLM is one prelaunch product. There is no second product generation and
there are no deployed compatibility customers. `SLM2`, `Tokenizer2`,
`Template2`, `Sampling2`, `Prompt2`, `acg2.0`, schema versions, semantic
versions, and the existing branch name are exact technical identities. They do
not authorize a product called V2, a parallel product generation, or a
compatibility layer.

The machine-readable authority is
`contracts/vnext/production-slm2-clean-cut-preregistration.v1.json`. It binds
parent commit `49e261cf76d3d7256d6a3d1b7663e36424b95763` and parent tree
`6e735f93409d28d6fbf92adf3f4f1092c9eabee4`. The machine profile is 16,398
bytes with SHA-256
`dc0213a34b63cf392c99e929bf0380d36698bce0ec995f5572aac2e8e287444a`.
This checkpoint creates no model, conversion, inference, evaluation, browser,
P2P, release, deployment, or campaign evidence.

## Why A Clean Cut Is Required

The current tree contains two incompatible architectural eras in executable
form. The new SLM2 parser, scalar reference runtime, Tokenizer2, Template2,
Sampling2, Prompt2, and deterministic converter foundation exist, but the
product path still reaches the superseded runtime and artifact contract:

- the browser loads the old `tinyrustlm.wasm` ABI;
- the C ABI and .NET wrapper depend on the old runtime SDK and SLM validator;
- P2P admission validates the old artifact;
- the companion locates and invokes `tinyrustlm-slm-pack`;
- conversion operations still create the old manifest, receipt, and `.acg1`
  closure;
- ACG1 remains executable while no production `acg2.0` implementation exists;
- the existing SLM2 WASM crate proves a tiny fixture boundary, not the actual
  browser conversation runtime;
- the model converter does not yet emit a complete Qwen3 model artifact.

Preserving these paths as fallbacks would create the exact debt the project is
free to avoid before launch. The implementation therefore replaces the whole
transitive executable closure and deletes it after the replacement passes.
Historical reports and content-addressed failure evidence may remain as
non-executable history. They do not remain selectable, importable, callable,
packaged, advertised, or supported.

## Frozen Evidence And Deliberate Invalidation

The accepted clean gate at source revision
`a84125ff591f4029cdfa31c0a1e2a7ac0bb6e5b7` remains immutable historical
evidence. Its standard partition recorded 1,053 passes, zero failures, and one
truthful missing-package-input skip. Its ten-shard release run passed 23/23
with aggregate SHA-256
`31e5e8ed29337d3a053b2875c32a05c03d2c8e8f7f9e195449bb3d4c591c314f`.
It must not be rerun or represented as evidence for changed runtime bytes.

The completed Tokenizer2 native and real-Chromium evidence and completed
Template2 publisher-source/native evidence remain valid only for their exact
bound bytes and semantics. Those completed observations must not be rerun.
They are dependencies of later composition evidence, not model-runtime or
quality evidence.

The root `Cargo.toml` and `Cargo.lock` identities are explicitly permitted to
change. Their current identities are frozen as pre-cutover inputs, not as
constraints that justify retaining obsolete workspace members. Runtime,
conversion, ABI, package, P2P, browser-chat, and release evidence must be newly
generated after the clean cut.

## Sole Production Architecture

Every responsibility has one owner:

| Boundary | Sole owner | Required result |
| --- | --- | --- |
| Model bytes | `tinyrustlm-slm2` | Bounded SLM2 parser, writer primitives, tensor registry, and exact profile validation |
| Composition | `tinyrustlm-composition2` | Canonical `acg2.0` parser, writer, identity graph, and activation preflight |
| Tokenization | `tinyrustlm-tokenizer2` | Exact Tokenizer2 encode/decode semantics |
| Chat rendering | `tinyrustlm-template2` | Bounded declarative Template2 rendering |
| Sampling | `tinyrustlm-sampling2` | Frozen deterministic seeded sampling |
| Prompt assembly | `tinyrustlm-prompt2` | One Template2-to-Tokenizer2-to-Sampling2 controller |
| Host runtime | `tinyrustlm-runtime` | SLM2-only conversation runtime and scalar correctness authority |
| Browser ABI | `tinyrustlm-browser-runtime-wasm` | Typed WASM transport over the canonical runtime |
| Conversion | `tinyrustlm-convert` | Pinned Qwen3 source conversion, validation, and receipts |
| Native ABI | `tinyrustlm-native` | One C ABI over the same runtime and validators |
| Managed runtime | `TinyRustLM.Core` | One current .NET wrapper over that ABI |
| Direct transfer | `tinyrustlm-p2p` | Exact SLM2 composition and piece admission |
| Companion | `TinyRustLM.SeedHost` | One P2P-first-or-convert loopback coordinator |
| Browser execution | `model-runtime-worker.js` | Streaming acquisition, persistence, activation, generation, cancellation, and recovery |
| UI | `app.js` | Commands, truthful status, and one raw assistant rendering path |

No second parser, converter, runtime, ABI, browser worker, or hidden output path
may coexist after the cutover. Shared logic belongs below the boundary that
owns it; adapters may transport typed values but may not reimplement domain
semantics.

## Artifact And Composition Contract

The first production family remains the immutable
`Qwen/Qwen3-0.6B` revision
`c1899de289a04d12100db370d81485cdf75e47ca`. That selection is a technical
target, not a quality promotion.

The activated composition binds all of the following by exact profile,
content identity, and byte length:

1. SLM2 model artifact;
2. Tokenizer2 artifact;
3. Template2 artifact;
4. Sampling2 profile;
5. Prompt2 profile;
6. runtime contract and minimum implementation identity;
7. context, scratch, and KV-cache limits;
8. source revision, license decision, converter, and conversion receipt;
9. optional adapter only when the canonical runtime actually consumes it.

`acg2.0` is a new sole composition contract. It is not an ACG1 reader with a
new label. Unknown fields, profiles, members, duplicates, missing members,
surplus members, wrong-family identities, conflicting limits, stale receipts,
and noncanonical ordering fail before allocation or activation. Activation is
transactional: the current valid composition remains active until every new
member validates and runtime startup succeeds.

SLM2 F32 remains the numerical conversion oracle. A browser release also
needs a measured storage and resident-memory profile. The first compressed
candidate is an explicitly named Q8 weight-only profile with per-tensor role
permission and F32 accumulation. No generic Q8 alias is accepted. Embeddings,
output projection, normalization, and KV representation are governed by
explicit role declarations and quality evidence; they are not inferred or
silently repacked. The runtime never repacks an artifact as a fallback.

Q4, Q5, ternary, one-bit, TurboQuant-like, TurboVec-like, and compressed KV
profiles remain experiments until separate contracts and evidence promote
them. They are not included merely to reduce file size.

## Conversion Contract

`tinyrustlm-convert` becomes the one conversion executable. The companion no
longer locates or invokes `tinyrustlm-slm-pack` and does not download a text,
JSON, PowerShell, shell, or request file instead of completing the requested
model action.

The converter must:

- bind the exact repository revision, source files, byte lengths, hashes,
  license decision, architecture profile, tokenizer, template, and tool
  closure;
- map Qwen3 query width, head dimension, grouped-query geometry, Q/K
  normalization, RoPE, tied embeddings, tensor order, and all shapes exactly;
- stream source files and hashing without an unbounded duplicate;
- reject missing, surplus, duplicate, ambiguous, malformed, non-finite, or
  unsupported tensors;
- emit SLM2, Tokenizer2, Template2, Sampling2, Prompt2, `acg2.0`, and bounded
  append-only receipts;
- use same-directory create-only staging, data flush, file synchronization,
  atomic promotion, readback, and final Rust validation;
- resume only when every input and tool identity remains exact;
- produce byte-identical output from two clean conversions.

Conversion success proves structural and numerical conversion only. It cannot
qualify a model or authorize a public claim.

## Runtime And Browser Contract

The canonical host runtime integrates SLM2, composition, Tokenizer2,
Template2, Prompt2, Sampling2, and the composition-bound KV cache. Native and
WASM paths execute the same operator semantics. Acceleration may replace a
kernel only after differential evidence; it may not become a separate runtime
with different behavior.

The browser worker owns model transfer, incremental hashing, bounded parsing,
storage preflight, IndexedDB persistence, composition activation, prompt
rendering, generation, cancellation, crash recovery, and cleanup. The UI
thread owns commands and presentation. Every worker message binds operation,
composition, and request identities. Stale, duplicate, out-of-order, or
post-cancellation completion messages are rejected.

The product path must provide:

- verified direct P2P acquisition when a current peer exposes the exact
  composition;
- automatic pinned-source acquisition and local conversion when no eligible
  peer exists;
- truthful progress for discovery, transfer, hashing, conversion, validation,
  persistence, activation, cancellation, resume, failure, and completion;
- bounded memory, storage, context, scratch, and KV preflight;
- raw model output rendered once, without repair or best-of-N selection;
- genuine multi-turn KV continuity and explicit context exhaustion;
- no prompt or model-byte upload to a project-hosted origin;
- no implicit telemetry, credential-bearing URL, router change, firewall
  change, sharing activation, or public-reachability claim.

## Complete Deletion Closure

After the replacement passes its focused gates, delete these executable
sources entirely:

- `rust/crates/tinyrustlm-slm`;
- `tinyrustlm/runtime`;
- `tinyrustlm/tools/slm_pack`;
- the executable ACG1 preregistration tool, test, and experiment manifest.

Rewrite the current runtime SDK directory, native crate, P2P crate, managed
runtime and conversion surfaces, companion conversion operations and locator,
browser model admission, companion bridge, and application integration. A
rewrite must expose only the current contract. It must not retain old method
aliases, old enum values, old wire fields, translation shims, hidden branches,
or deprecated routes.

The final executable-source audit rejects `ACG1`, `.acg1`,
`tinyrustlm-slm-pack`, `tinyrustlm-runtime-sdk`,
`generate_two_sentence_text`, and `generate_status_reason_json` outside
explicit historical evidence. Package manifests, lock files, build scripts,
samples, tests, deployment manifests, generated assets, and documentation must
all name and exercise the sole current architecture.

## Bounded Release-Store Replacement

The accepted clean gate exposed a release-blocking algorithmic defect. The
complete publication test performs full cryptographic receipt-store and
subject-store rebuilds inside per-item persistence assertions and repeatedly
reopens both stores during crash-prefix replay. Because each rebuild scans,
reads, hashes, validates, classifies, and synchronizes the whole graph, work
grows with both graph size and persisted prefix. A synchronous scan also
prevents the JavaScript test timeout from preempting the operation.

The replacement preserves all evidence rules while changing the algorithm:

1. Opening a store performs exactly one complete validated rebuild and creates
   an immutable in-memory active-ID snapshot.
2. Same-process membership checks use that validated snapshot and perform no
   filesystem scan.
3. A batch is fully parsed, bounded, dependency-ordered, and collision-checked
   before create-only publication starts.
4. Receipt sequences publish the remaining exact prefix through `putMany`,
   then compare one in-memory snapshot to the expected result.
5. Final publication persists the redaction receipt, publishes all remaining
   claims as one bounded batch, verifies the in-memory subject snapshot, and
   only then persists the final publication receipt.
6. A process restart performs a new complete rebuild and classifies the exact
   durable prefix. Partial batches are valid resumable prefixes; the final
   publication receipt can never exist before all claims.
7. The pure prefix classifier is tested for every prefix from zero through the
   configured maximum batch size.
8. Real filesystem interruption/restart tests cover before-first, midpoint,
   and after-last-before-final-commit boundaries. Existing malformed,
   collision, graph, readback, and directory-durability tests remain.

Without an injected restart, at most two full rebuilds are allowed: one per
store instance. Each actual restart may add at most one rebuild per store.
No per-item loop may invoke a full rebuild and same-process membership checks
may perform zero filesystem scans. Deterministic operation counters are the
primary performance acceptance. The complete-capacity wall-clock ceiling is
180 seconds on the gate machine, compared with the observed multi-hour defect.
Increasing a timeout, reducing the capacity, removing hashing, or weakening a
crash assertion is not an acceptable fix.

## Test And Evidence Sequence

Implementation proceeds in this order:

1. commit, push, fetch, and prove the preregistration remote-exact;
2. replace release-store membership and persistence with the bounded snapshot,
   batch, and exhaustive-prefix algorithm;
3. freeze the SLM2 Q8 profile with independent vectors and hostile cases;
4. implement and prove `acg2.0`;
5. complete deterministic Qwen3 conversion and repeated clean conversion;
6. integrate the canonical runtime, Prompt2, Sampling2, and KV cache;
7. implement the production browser WASM worker boundary;
8. rewrite native ABI, .NET wrapper, P2P, companion, and browser acquisition;
9. prove source-to-F32-to-Q8 native/WASM numerical and token parity under
   preregistered tolerances;
10. admit independent human quality evidence when genuinely available;
11. run a fresh-profile multi-turn browser acceptance with cancellation,
    restart, deletion, network capture, and secret scan;
12. remove the obsolete executable closure and run a final source/package
    audit;
13. update UAI memory, architecture, product documentation, marketing claims,
    versions, release dates, and publication logs;
14. commit, push, release, deploy, and independently read back every eligible
    affected site.

Every changed boundary receives positive, negative, boundary, malformed,
oversized, interruption, cancellation, stale-state, and adversarial tests.
Rust format, locked check/test, warnings-denied Clippy, WASM build, native ABI,
.NET unit/package-consumer, P2P, browser, privacy, accessibility, release,
secret, documentation, remote-exactness, and public HTTPS readback gates apply
to their exact changed bytes.

Accepted failures and completed one-time observations remain immutable. A new
attempt gets a new identity and may not overwrite, repair, or reinterpret an
earlier failure.

## Quality And Claim Boundary

No public source is promoted merely because it converts, runs, is popular, is
small, or produces one attractive answer. The useful-model gate remains
blocked on independently authored sealed holdouts and review custody unless an
untouched public source independently satisfies the complete preregistered
screen.

This preregistration proves only that the clean-cut boundary was fixed before
implementation. It does not prove conversion, runtime correctness, model
quality, browser chat, P2P availability, package readiness, release authority,
deployment, or publication.

Campaign counters remain:

- qualified models: `0/20`;
- deletion-backed browser rounds: `0/50`;
- authorized live MemoryEndpoints rounds: `0/25`;
- current outside-network lane proofs: `0/40`;
- live catalog announcements: `0/20`.

MemoryEndpoints remains unauthorized and disconnected. No endpoint guess,
credential request, company action, fixture result, or simulated memory result
is part of this cutover.

## Completion Predicate

The clean cut is complete only when all production entry points use the one
SLM2 architecture, all superseded executable paths are deleted, complete
affected tests pass within bounded operation counts, one exact useful model
composition completes genuine browser-local multi-turn chat, and the exact
source and publication state is committed, pushed, deployed where authorized,
and independently read back. Any compatibility path, hidden fallback,
response repair, fake success, known debt, stale documentation, or obsolete
packaged byte keeps the gate open.

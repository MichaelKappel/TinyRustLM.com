# Browser Runtime WASM Clean-Cut Preregistration

Date: 2026-08-27

Status: raw WASM boundary implemented; worker protocol closed before worker
source; worker/UI clean cut pending; transfer-size defect corrected during
real-artifact preflight before worker implementation

## Registered Correction

The original registration capped Sampling2 and Prompt2 transfers at 65,536
bytes. Real-artifact preflight exposed that this was internally inconsistent
with the already registered canonical profiles: Sampling2 is exactly 65,800
bytes and Prompt2 is exactly 512 bytes. The current machine contract replaces
those two limits with the canonical exact sizes and binds both profile files.

The correction records the original registration commit, byte length, and
SHA-256. It adds no compatibility behavior, fallback, campaign credit, or
product claim. Git retains the rejected contract as evidence; the current tree
contains only the corrected executable rule.

## Current Implementation Checkpoint

Remote-exact commit `5c4f46c7af35bc6e892097cd4924ca58286efa8c`
implements the move-only ACG2 member ownership and raw browser-runtime WASM
boundary. The module has zero imports, the exact 16 registered application
function exports, and only the expected WebAssembly support exports. Its nine
closed transfer kinds enforce exact lengths, one pending allocation, one
committed value per kind, bounded results, stale-operation rejection,
transactional activation, exactly-once finish, and terminal release.

Successful model activation moves the transferred model allocation into the
scalar runtime without retaining a staging clone. Activation preserves the
caller-owned operation identity; composition identity never becomes mutation
authority. A model switch must compare-and-swap to a distinct operation first
and then activate under that operation.

The focused Rust test set, clippy with warnings denied, public Node WebAssembly
ABI tests, and an opt-in private six-member structural activation pass. The
private check loads and hashes the exact members, activates them in the module,
validates state and bounded memory planning, and releases the runtime. It emits
no model content or private path.

This checkpoint stops before the worker. Node WebAssembly and private
structural activation are not real-browser execution, deterministic
native/browser token parity, conversational quality, product UI integration,
P2P proof, release, deployment, publication, or campaign evidence. The active
browser still uses the superseded UI-thread runtime. Steps 5 through 9 below
remain open, and no deployment is authorized until they pass and all old
executable surfaces are deleted.

## Decision

The TinyRustLM browser will have one model-execution path: a dedicated worker
owns one production WebAssembly instance compiled from the canonical SLM2
conversation runtime. The UI sends typed commands and renders one terminal raw
output. It does not own model bytes, call WebAssembly directly, implement
tokenization or sampling, repair an answer, or retain the superseded runtime.

The machine-readable authority is
`contracts/vnext/browser-runtime-wasm-clean-cut-preregistration.v1.json`. It
binds parent commit `cf56eb1a563c85acfc7257d128f5fe3b386da954` and parent
tree `00e364b0b1b71a458c749f16c720ca5bc3f4073f`. This registration creates
no executable, artifact, browser observation, product claim, deployment, or
campaign credit.

## Why This Boundary Is Required

The canonical Rust runtime already owns SLM2 parsing, ACG2 dependency closure,
Tokenizer2, Template2, Sampling2, Prompt2, scalar execution, and transactional
KV state. The active browser still loads the superseded WASM ABI on the UI
thread, activates ACG1 metadata, and contains task-specific generation and
output-cleanup branches. Preserving those paths beside a new worker would leave
two runtime authorities and would make raw-output and cancellation claims
unverifiable.

The replacement is therefore a clean cut. The new Rust crate is
`rust/crates/tinyrustlm-browser-runtime-wasm`; the sole worker is
`tinyrustlm/app/model-runtime-worker.js`; and `app.js` becomes a command and
presentation client. Once the replacement passes, the old runtime tree,
direct UI-to-WASM calls, ACG1 admission, task-specific generation exports,
repair logic, manifests, fixtures, and tests are deleted. No reader, alias,
shim, fallback, feature flag, or migration path remains.

## Ownership And Copy Discipline

One worker owns one WASM module and one runtime. The module accepts binary
artifacts through a move-only transfer protocol:

1. `transfer_begin(kind, length)` creates one exact Rust-owned allocation and
   returns its linear-memory pointer.
2. JavaScript copies the already bounded chunk or artifact into that pointer.
3. `transfer_commit(kind, pointer, length)` accepts only the exact pending
   allocation. It moves the allocation into its closed staging slot without a
   second copy.
4. ACG2 activation validates every exact length, SHA-256, profile, dependency,
   resource ceiling, and model shape before swapping the active runtime.
5. On success, model allocation ownership moves into `ScalarModel`; staging
   retains no second model. On failure, candidate staging is dropped and the
   current runtime remains unchanged.

Only one transfer may be pending. Each closed kind may be committed once until
the command that consumes it. Pointer, kind, or length drift drops the pending
allocation and returns a bounded error. Duplicate committed values never
replace earlier bytes. Artifacts cannot be allocated until an explicit runtime
policy has passed.

The worker must release its JavaScript `ArrayBuffer` after commit and use
transfer lists between threads. Streaming acquisition, durable storage, and
incremental hashing remain worker responsibilities. This ABI does not pretend
that browser storage reads are zero-copy. Real-browser evidence must measure
every retained model-sized owner and peak process memory.

## Closed Artifact Set

Activation consumes exactly:

- one 896-byte `org.minimodel.acg2/2.0` graph;
- one SLM2 model;
- one Tokenizer2 artifact;
- one Template2 artifact;
- one Sampling2 artifact; and
- one Prompt2 artifact.

No path, URL, alias, source name, or caller-provided compatibility statement is
trusted by WASM. ACG2 binds five members by role, exact byte length, SHA-256,
format profile, and dependency relationship. The canonical runtime reparses
the model after ownership transfer and checks its identity against the
prepared composition before activation.

## Operation And Lifecycle Rules

Every mutating runtime call consumes a 32-byte nonzero expected operation
identity. Creating the runtime uses that identity as its initial authority.
Activation, transcript changes, request start, generation steps, and output
finish reject stale identities before mutation. Advancing an operation is a
compare-and-swap requiring distinct expected and next identities.

Composition identity never becomes operation authority. Successful activation
preserves the current caller-owned operation identity. A model switch first
advances that identity explicitly and then activates under the new identity;
there is no implicit operation transition hidden inside artifact activation.

The only lifecycle is:

```text
uninitialized -> empty -> active-idle -> generating
                                  ^          |
                                  |          v
                                  +-- terminal-output-ready
```

Activation may replace `active-idle` with another fully prepared composition.
Any live state may be released. Release drops transfers, staged members,
results, runtime, model, prompt state, and KV state; reuse requires a new
worker and module instance. There is no implicit transition, automatic retry,
or alternate runtime.

`finish` consumes one terminal output exactly once. The result contains the
raw canonical Runtime decode, exact token IDs, terminal Sampling2 status,
composition identity, operation identity, and committed KV bytes. A second
finish fails. Repeated token text is legitimate and is never deduplicated.

## Worker Protocol

Worker commands and events use the closed
`tinyrustlm.model-runtime-worker/1` schema. Every message binds worker,
operation, composition, conversation, turn, generation, message, and sequence
identities plus an exact kind and bounded payload. Unknown fields, duplicate
IDs, gaps, out-of-order events, old workers, old operations, old compositions,
and old generations fail closed.

Binary data crosses the UI/worker boundary only as transferred
`ArrayBuffer`s. The worker receives no arbitrary URL, filesystem path, or
command and performs no network access. Acquisition code resolves approved
streams before handing bytes to the worker. One generation emits one ordered
event stream and one completion. The UI renders that completion once.

Cancellation is an actual Sampling2 transition when the worker remains
healthy. A WASM trap, allocation failure, or forced worker termination discards
the worker and all KV state. Recovery creates a fresh worker that reopens and
reverifies every immutable member before activation. It does not continue from
untrusted in-memory state.

### Pre-Implementation Protocol Closure

Worker preflight found that the first registration fixed the envelope and
ordering invariants but did not enumerate command kinds, event kinds, or exact
payload fields. Leaving those spaces open would permit a generic invocation
surface and make unknown-field rejection untestable. Before any worker source
existed, the current machine contract recorded the prior 18,804-byte contract
at remote-exact commit `9b7f25a235315b1a97dfc54e47e133b3e8ea0eb1`
and closed the missing vocabulary.

The worker accepts exactly eleven commands: initialize, streamed artifact
begin/chunk/commit, activate, explicit operation advance, transcript update,
generation begin/step/cancel, and release. It emits exactly twelve event kinds,
including one terminal generation completion and one bounded rejection form.
There is no generic invoke command and no separate finish command; a terminal
step is finished inside the sole worker so the UI cannot consume or render an
output twice.

Model and dependency artifacts cross as contiguous transferred chunks of at
most 4 MiB. The worker copies each chunk directly into the one pending
WASM-owned allocation, wipes the accepted worker-side chunk, and never retains
a whole-model JavaScript buffer. The seven externally transferable artifact
kinds map exactly to raw ABI codes 3 through 9. Expected and next operation
identities are derived from validated envelope identities and staged internally
by the worker.

Command and event sequences are independent, start at zero, advance by one,
and are capped at 65,536 messages per worker so duplicate tracking is bounded
for the complete worker lifetime. Event IDs are deterministic SHA-256 values
over a domain, worker ID, command message ID, event sequence, and event kind.
A structurally valid command consumes its sequence before semantic execution;
a bounded ABI rejection emits one rejection event. Invalid envelopes or stale
identities terminate without a protocol event. Internal failure or a WASM trap
invalidates the worker and KV state.

Initialization accepts only a hash-bound module of at most 16 MiB, recomputes
its SHA-256, requires zero imports and the exact export set, and verifies one
bounded unshared memory with a 3 GiB maximum. Network globals are disabled
before message acceptance. No payload field can carry an arbitrary URL,
filesystem path, command, template program, or executable extension.

## Bounded Policy

Runtime creation receives explicit model, sequence, KV, scratch, resolved
member, resident dependency, request, and linear-memory ceilings. Every value
must be positive and cannot change after creation. The machine profile records
hard WASM32 ceilings; a product activation may choose smaller measured limits.

The production build must declare an explicit WebAssembly maximum memory.
Worker capability and quota preflight occurs before artifact transfer. The
runtime verifies that its model, KV, scratch, logits, dependencies, result, and
linear-memory plan fit the accepted policy. Increasing a browser timeout or
blindly calling `memory.grow` is not an admission strategy.

## Privacy And Output Integrity

The worker has no network authority. Prompts and model bytes never go to a
project origin. There is no telemetry, credential-bearing URL, artifact-
supplied code, arbitrary template evaluator, command execution, or filesystem
path interpretation in this boundary.

Errors are stable bounded codes and contain neither prompts nor model bytes.
Success JSON is private worker-local transport. Model output is not completed,
trimmed into a better answer, normalized, retried, filtered, or selected from
multiple generations. Presentation may escape unsafe markup without changing
the underlying text evidence.

## Test Order

Implementation proceeds in this order:

1. Add failing transfer, policy, stale-operation, lifecycle, and ownership
   tests.
2. Change ACG2 member resolution so an in-memory model allocation is moved
   into the runtime after validation instead of copied into a second
   unbounded allocation.
3. Implement the raw WASM boundary and exact export allowlist.
4. Build `wasm32-unknown-unknown` release bytes with an explicit maximum
   memory and exercise hostile ABI calls from Node.
5. Implement the worker state machine and race tests.
6. Run real Chromium worker, cancellation, zero-network, transfer-detachment,
   memory, and fresh-worker tests.
7. Activate the exact private six-member composition and compare deterministic
   native and browser token behavior only under separately registered
   numerical evidence.
8. Replace browser admission and UI generation completely.
9. Delete every superseded executable path and run the final forbidden-token,
   package, asset, documentation, and deployment audit.

Focused tests do not authorize browser or product claims. Node is not browser
evidence. A private structural composition is not a useful model. A successful
WASM build is not a conversation, P2P observation, release, or deployment.

## Completion Boundary

This browser cut is complete only when the real production UI reaches the
canonical runtime exclusively through the worker; a real Chromium profile
activates an exact ACG2 composition, runs genuine multi-turn generation,
cancels coherently, restarts through full reverification, renders each raw
answer once, produces zero prohibited network traffic, and leaves no old
runtime code or packaged bytes.

Until then, no deployment is eligible and campaign counters remain
`0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

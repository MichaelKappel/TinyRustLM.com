# Canonical Runtime Integration Preregistration

Status: registered before implementation output on 2026-08-24.

## Product Authority

TinyRustLM is one prelaunch product. There is no product V2, legacy product,
compatibility population, or migration contract. Names such as SLM2,
Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 are exact technical
identities only. This change must leave one executable owner per behavior and
must delete the displaced scalar-runtime crate after its consumers move.

The parent for this registration is commit
`564884c5986ea507405e9bb0d6989b1d1ad6c04d`, tree
`891eb2ba080c140bbc148f53e7835bfb69912672`. No implementation, runtime,
browser, model, evaluation, publication, or campaign output exists because of
this registration.

## Observed Integration Defect

The accepted ACG2 implementation correctly owns prepared composition
activation, but its integration surface does not lend the active
`PreparedComposition` to the host runtime and cannot begin a new generation
transaction by clearing composition-bound KV and generated-token accounting
under a stale-operation check. The accepted Prompt2 runtime owns the only
Tokenizer2 instance but does not expose generated-token decoding.

Using the APIs unchanged would force one of three bad designs:

1. clone the seven-megabyte Prompt2 dependency runtime;
2. instantiate a second Tokenizer2 owner just for output decoding; or
3. bypass `ActivationState` and create a second activation owner.

All three violate the registered clean cut. A compatibility wrapper would
hide the defect while preserving duplicate ownership. It is prohibited.

## Narrow Owner-Preserving Additions

Composition2 receives only two integration methods:

- `ActivationState::active()` returns a shared borrow of the sole active
  prepared composition. It does not clone bytes or transfer ownership.
- `ActivationState::begin_generation(expected_operation)` first rejects a
  stale operation without mutation, then clears only KV-byte and generated
  token accounting for the next request. Composition identity, operation
  identity, and transcript remain unchanged.

Prompt2 receives one method:

- `Prompt2Runtime::decode_generated(...)` delegates to its already-owned
  Tokenizer2 in explicit `SkipSpecial` mode. Invalid IDs, limits, and invalid
  UTF-8 remain fatal. It does not replace, normalize, repair, or complete text.

No binary format, wire, hash, parser, renderer, sampler, model operator,
artifact, or accepted evidence changes. Existing one-time Tokenizer2,
Template2, and Sampling2 observations remain immutable and are not rerun.

## Sole Runtime Owner

`rust/crates/tinyrustlm-runtime` becomes package `tinyrustlm-runtime` and owns
the host conversation state machine plus the exact scalar correctness
implementation. The implementation currently in
`rust/crates/tinyrustlm-slm2-runtime` is moved, not copied. Its independent
vectors and arithmetic order remain exact. The old crate is deleted and the
WASM conformance fixture links the canonical runtime.

The runtime owns one `ActivationState`, one active scalar session, one exact
committed-token sequence, at most one live Prompt2 plan, and one reusable
logit-bit buffer. It owns no path, URL, network, or UI authority.

## Transactional Activation

A candidate activation performs the following work before touching active
state:

1. parse the exact 896-byte ACG2 graph;
2. stream, hash, parse, and cross-check all five members with one open source
   at a time;
3. accept the complete bounded resource plan;
4. reopen only the exact model member;
5. read exactly one bounded owned SLM2 byte vector;
6. validate and index mixed-Q8 bytes without an F32 weight shadow;
7. allocate the complete bounded scalar session;
8. compare model identity and closed specification with the prepared graph.

The operation identity is then checked by `ActivationState`. A stale candidate
drops without changing the current composition or runtime. A successful
ownership swap is immediately followed by an infallible replacement of the
already-prepared scalar session. No parsing, allocation, retry, or fallback
occurs after the swap.

## Conversation State Machine

Beginning a request compiles Prompt2 exactly once. KV may be reused only when
the entire new prompt begins with the exact committed token sequence. Any
other prompt resets the scalar session and prefills the complete canonical
prompt. A failed prefill clears request state and returns a typed failure.

Each generation step checks cancellation before Sampling2. Current finite F32
logits are represented by their exact `u32` bits in one reused buffer.
Sampling2 advances exactly once. Every selected token, including a
template-owned stop token, is forwarded into KV so a subsequent canonical
prompt can extend the exact context. Only non-stop IDs enter visible generated
history. There is no retry, alternate selection, repair, or best-of-N path.

Finishing requires a terminal Sampling2 state and decodes all visible token
IDs exactly once through Prompt2's owned tokenizer. The runtime returns raw
text, terminal reason, and exact identities. Presentation remains a browser UI
responsibility.

## Resource And Failure Rules

All ceilings are explicit and positive: resolved member bytes, resident
dependency bytes, model bytes, request bytes, context tokens, F32 KV, scalar
scratch, and one vocabulary-sized `u32` logit buffer. Arithmetic is checked.
The model is held once in its validated SLM2 bytes and never expanded into an
F32 weight shadow or repacked at runtime.

Candidate failure preserves the active composition and runtime. Stale
activation preserves both. Prefill or forward failure terminates and clears
the request state rather than returning partial success. Public errors are
stable codes. Historical bytes remain non-executable audit evidence only.

## Evidence Boundary

The machine-readable registration is
`contracts/vnext/canonical-runtime-integration-preregistration.v1.json`.
Implementation may begin only after that file, this record, and their invariant
test are committed, pushed, freshly fetched, and proven equal to the actual
remote branch. Registration changes no campaign counter and proves no real
model, quality, browser chat, P2P availability, package, deployment,
publication, or MemoryEndpoints operation.

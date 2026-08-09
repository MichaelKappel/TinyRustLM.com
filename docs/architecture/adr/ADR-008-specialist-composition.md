# ADR-008: Specialist Composition

## Status

Accepted as the target architecture. Existing ACG1 activation is an
implementation input, not proof that any specialist improves product quality.

## Decision Date

2026-08-08

## Scope

This ADR defines when TinyRustLM may use standalone specialists, trained
low-rank adapters, merged weights, shared storage chunks, or deterministic
routing beside a general conversational champion.

## Decision

Every promoted portfolio starts with one independently qualified, complete
general champion. A specialist is admitted only when blinded task evidence
shows a useful improvement over that champion or a material resource saving
without exceeding the preregistered quality budget.

TinyRustLM supports two production specialist forms:

1. a complete standalone SLM2 model; or
2. an immutable, trained low-rank adapter composed with one exact SLM2 base.

A standalone specialist is required when architecture, tokenizer, template,
license, source lineage, quantization semantics, operator set, or deployment
independence differs from the champion. A low-rank adapter is preferred only
when the exact base is already available and measured packed storage, peak
resident memory, activation time, and task quality justify the permanent
composition surface.

DoRA is not a synonym for LoRA. A DoRA profile may be added only with its
complete magnitude-and-direction mathematics, tensor layout, kernels, source
lineage, and independent conformance evidence. Raw deltas, sparse deltas, and
offline blends remain experiment or conversion inputs; they are not promoted
runtime composition forms merely because current SLM1-era tooling can author
them.

Merged specialist weights are complete standalone artifacts. They receive a
new model identity, full conversion and evaluation lineage, and ordinary model
qualification. A merge does not count as an independent behavioral lineage
unless its training data, objective, and evaluation prove meaningful
diversity.

Content-addressed tensor or piece chunks may deduplicate the companion and P2P
store. Deduplication is a storage implementation detail, not model identity.
An activation plan must resolve every chunk from the owned store, verify every
piece and the complete artifact or composition root, and expose one immutable
byte view before runtime admission. SLM2 metadata never contains filesystem
paths, model-byte URLs, or mutable chunk aliases.

Arbitrary layer extraction, untrained early exit, cross-model layer sharing,
and partial-model slicing are rejected from the initial profile. They may be
considered only as separately trained architectures with a complete
mathematical contract and source-oracle conformance. Smaller bytes alone do
not establish that a partial transformer remains useful.

The composition graph is immutable and identity-bound. Its canonical identity
binds, at minimum:

- base artifact class, byte count, SHA-256, architecture, and quantization;
- every adapter artifact SHA-256, tensor target, rank, scale, order, and
  application mode;
- tokenizer, chat template, context compiler, runtime, and operator profiles;
- deterministic router policy and specialist task claim;
- cache/KV interpretation and compatibility policy.

Changing any bound field creates a new composition identity. Validation and
activation are atomic: a rejected candidate leaves the active graph and KV
state unchanged. Successful graph replacement invalidates incompatible KV and
prefix caches before the next token.

The router is deterministic, versioned, bounded, and independently testable.
It uses a closed specialist registry and explicit task evidence. Ambiguous,
unsupported, low-confidence, incompatible, or failed specialist routes fall
back to the champion before generation. The router cannot override the latest
user instruction, treat untrusted memory as authority, or silently combine
outputs. A specialist failure produces one visible typed transition and one
coherent champion response path.

The existing ACG1 implementation supplies useful atomic-activation evidence.
The vNext ACG1 admission profile accepts only SLM2 base and vNext adapter
identities. SLM1 fixtures and mutable adapter application are deleted from the
production path after the SLM2 composition gate passes; no dual runtime mode
or migration parser remains.

## Alternatives

- **Twenty standalone general models** was rejected as a portfolio strategy
  because byte diversity does not prove useful behavioral diversity.
- **Adapters for every specialist** was rejected because base coupling,
  runtime overhead, and quality can outweigh their storage benefit.
- **Merged weights only** was rejected because it duplicates a base and hides
  whether a compact composition would be sufficient.
- **External chunk references in model metadata** were rejected because paths,
  URLs, and mutable aliases weaken portability and identity.
- **Arbitrary layer slicing or early exit** was rejected because an untrained
  partial network is not a valid specialist by assumption.
- **Model-selected routing without a deterministic gate** was rejected because
  it is difficult to reproduce, audit, and fail safely.

## Authoritative Evidence

- **Observed local fact**: the Rust runtime and packer implement immutable,
  SHA-256-bound ACG1 graph validation and atomic activation for a loaded base
  plus low-rank overlays.
- **Observed local fact**: the repository contains trained-source low-rank
  intake, adapter packing, deterministic router experiments, and tests, but no
  evidence yet qualifies a twenty-model product portfolio.
- **Sourced public fact**: LoRA defines frozen base weights plus trained
  low-rank updates in https://arxiv.org/abs/2106.09685.
- **Sourced public fact**: DoRA decomposes weight magnitude and direction and
  therefore requires a distinct implementation profile in
  https://arxiv.org/abs/2402.09353.
- **Engineering decision**: champion-first routing with standalone or exact
  base-bound low-rank specialists gives the smallest reviewable production
  surface.
- **Local verification required**: each composition must prove storage,
  residency, latency, conformance, and task quality on the final packaged
  bytes.

## Threat Analysis

Threats include adapter/base substitution, reordered overlays, mutable aliases,
mixed tokenizer or template state, duplicate tensor targets, excessive rank,
overflowing dimensions, NaN factors, cache reuse across graphs, route
confusion, specialist claim inflation, license incompatibility, and a failed
specialist producing duplicate output.

All identities and dimensions are checked before allocation. Adapter entries
are unique, sorted canonically, finite, bounded, and tied to exact tensor
shapes. The router has bounded inputs and outputs, no network authority, and a
champion fallback. Licenses and provenance remain separate fail-closed gates;
a valid hash never implies permission or quality.

## Performance Evidence

No composition performance claim follows from this ADR. Promotion compares
the champion, standalone specialist, adapter composition, and any merged form
under the same hardware, context, prompts, runtime, and sampling profile. It
records packed bytes, deduplicated store bytes, cold activation, peak resident
memory, prefill/decode latency, cache behavior, task quality, ordinary-chat
regression, and switching cost.

An adapter is retained only when its measured benefit exceeds the ongoing
parser, kernel, test, and cache-invalidation cost. Shared chunks count only the
physical bytes actually avoided in the target store.

## Compatibility Impact

The vNext production path accepts complete SLM2 artifacts and the exact vNext
ACG1 profile only. It does not accept SLM1 models, legacy mutable adapter
routes, arbitrary layer bundles, or approximate composition identities.

Standalone specialists remain portable without a base. Adapter specialists
declare exact base availability as a hard prerequisite and fail to the
champion when it is absent.

## Clean Deletion Impact

After SLM2 composition passes, remove mutable in-place adapter application,
SLM1 composition fixtures, duplicate browser routing, obsolete sidecar
schemas, and documentation that describes them as product paths. Experimental
formats that fail promotion are archived as evidence outside the runtime and
deleted from shipping code.

## Unknowns

- Which tasks justify adapters rather than standalone specialists.
- Whether adapter residency saves memory after real browser/runtime buffers.
- Whether DoRA earns its additional tensor and kernel surface.
- Whether store-level tensor deduplication saves enough disk to justify
  chunk-index complexity.
- Router thresholds and task taxonomy for unseen user phrasing.
- Quality and latency effects of repeated champion/specialist switching.

## Acceptance Tests

1. ACG1 parsing rejects wrong base bytes/hash/class, duplicate or reordered
   members, unknown flags, unsafe dimensions, non-finite values, trailing
   bytes, and composition-hash mismatch.
2. Candidate validation failure preserves the active graph, model, KV state,
   generation ID, and visible output exactly.
3. Successful switching invalidates incompatible caches and repeated switching
   has bounded memory with no output duplication.
4. Source, native, WASM, and browser paths pass operator, logit, greedy,
   stochastic, and multi-turn conformance for every promoted composition.
5. Router metamorphic tests vary wording, authority order, memory injection,
   unavailable specialists, and confidence around thresholds; ambiguous and
   failed routes use the champion.
6. Blinded holdouts prove task improvement and enforce an ordinary-helpfulness
   regression budget without training contamination or best-of-N selection.
7. Storage and memory measurements prove the claimed savings from adapters or
   shared chunks on final packaged artifacts.
8. Portfolio accounting distinguishes source lineage, behavior, precision,
   merge, adapter, draft, and byte identity without counting aliases.

## Rollback

Retract the affected composition and route to the already qualified champion.
Preserve the failed graph, raw outputs, and receipts outside the active store.
Delete the unpromoted composition profile and its shipping code rather than
mapping it to a nearby base, adapter, or router rule.

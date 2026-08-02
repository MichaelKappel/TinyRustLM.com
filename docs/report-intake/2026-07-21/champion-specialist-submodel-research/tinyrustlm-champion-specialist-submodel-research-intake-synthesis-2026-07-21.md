# TinyRustLM Champion And Specialist Research Intake Synthesis

Date: 2026-07-21

Public-source retrieval date: 2026-07-21

## Executive Decision

The twelve reports strengthen, but do not replace, the existing direction:
build one compact, broadly useful, quality-proven champion and add specialists
only when they demonstrate a measured advantage on sealed tasks. Prefer small
base-dependent trained adapters when they are sufficient. Use independently
distilled standalone `.slm` specialists when an adapter cannot meet the task,
latency, memory, tokenizer, or architecture requirement.

Do not extract arbitrary byte ranges, layers, heads, vocabulary rows, or
tensors from an ordinary dense checkpoint and call the result a useful model.
A valid smaller network must be trained for nested extraction, created by
structured pruning followed by recovery training, distilled independently, or
expressed as an identity-bound delta over an immutable base. Shape closure is
necessary but not sufficient; a model can remain structurally executable and
still lose its useful behavior.

The clean-slate runtime target is:

- immutable champion weights;
- content-addressed specialist sidecars;
- direct overlay execution without destructive base mutation;
- request-level routing before generation with conservative champion fallback;
- composition-bound KV state;
- explicit logical, incremental, physical, scratch, and resident byte counts;
- raw-output and human-reviewed promotion evidence; and
- no compatibility layer for the current unreleased cumulative-mutation path.

This intake authorizes no model adoption, conversion, training, or catalog
promotion. The 42-record and 668-record independent human-review campaigns
remain unresolved. No training may use those records. Existing reviewed SFT
records also contain no explicit pairwise preference decisions, so they do not
authorize DPO, ORPO, or an inferred preference objective.

## Evidence Boundary

### Directly Observed Local Facts

- `.uai/architecture.uai` currently sets a 32 MiB selector budget and a 1 MiB
  automatic adapter budget.
- `tinyrustlm/runtime/src/adapter.rs` supports base-bound `ADP1`, `ASP1`, and
  rank-bounded `ALR1` packages. `ALR1` currently caps rank at 8.
- Current adapter application mutates loaded tensors. Quantized tensors may be
  materialized and requantized during application.
- Adapter applications accumulate; there is no proved constant-time exact
  return to the immutable base or isolated `base -> A -> base -> B` path.
- Generation and KV state are conservatively cleared after adapter apply.
- The current KV cache is a contiguous `f32` allocation whose principal byte
  term is:

  `2 * layers * max_context * kv_heads * head_dim * 4`

- There is no current quantized, paged, persisted, or cross-composition KV
  contract.
- No quality-proven trained specialist portfolio, calibrated production
  router, or admitted Colibri-style MoE runtime has been established locally.

These local observations were made during intake review. The disconnected
research agents did not inspect private code or local evidence.

### Sourced Public Facts

The Colibri source inspected for this review is pinned at
[`44e489b196c9b7876b3d37a0570ebf1c6f90f54c`](https://github.com/JustVugg/colibri/tree/44e489b196c9b7876b3d37a0570ebf1c6f90f54c).
Its README describes a GLM-5.2-specific runtime that keeps dense state resident
and streams routed expert weights from local storage. The project changes
placement and I/O; it does not eliminate the expert bytes or make arbitrary
dense-model slices independently useful.

The official pinned
[`GLM-5.2` configuration](https://huggingface.co/zai-org/GLM-5.2/blob/b4734de4facf877f85769a911abafc5283eab3d9/config.json)
declares 78 layers, the first three dense, 256 routed experts, eight selected
experts per token, and one shared expert. Colibri's 19,456 routed-expert count
is consistent with `75 * 256` main-model experts plus 256 in the MTP layer.

Primary method references relevant to this decision include
[MatFormer](https://arxiv.org/abs/2310.07707),
[LoRA](https://arxiv.org/abs/2106.09685),
[DoRA](https://arxiv.org/abs/2402.09353),
[IA3/T-Few](https://arxiv.org/abs/2205.05638),
[QLoRA](https://arxiv.org/abs/2305.14314),
[GKD](https://arxiv.org/abs/2306.13649),
[RouteLLM](https://arxiv.org/abs/2406.18665),
[Hybrid LLM](https://proceedings.iclr.cc/paper_files/paper/2024/hash/b47d93c99fa22ac0b377578af0a1f63a-Abstract-Conference.html),
[FrugalGPT](https://arxiv.org/abs/2305.05176), and
[S-LoRA](https://arxiv.org/abs/2311.03285).

Browser feasibility must be measured rather than dismissed or assumed. A
WebAssembly memory using 32-bit indices has a 4 GiB address space, while the
current API also describes 64-bit-address memories; implementation and browser
support remain target-specific. The
[origin-private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
provides worker-accessible byte storage, including synchronous access handles.
Neither fact proves interactive expert streaming in TinyRustLM.

### Recommendations And Unknowns

Everything below that prescribes a TinyRustLM format, router, runtime, test,
or training design is an engineering recommendation. Its quality, latency,
memory, portability, and usefulness remain local-verification facts until
content-addressed receipts exist.

## Six-Lane Findings And Corrections

### 1. Valid Subnetworks

Useful consensus:

- preserve tokenizer, residual-stream, attention, MLP, normalization,
  positional, and output-head compatibility;
- use architecture-aware structured pruning, nested/elastic training, or
  distillation rather than arbitrary removal; and
- re-evaluate both task quality and ordinary assistant behavior after every
  structural change.

Corrections:

- A graph that still type-checks is not necessarily a useful submodel.
  Removing complete residual blocks can preserve tensor shapes while causing
  a severe quality loss; it does not always sever execution.
- Decoder-only transformer LayerNorm/RMSNorm has no BatchNorm-style running
  statistics. Advice to repair running statistics is irrelevant here.
- KV-cache growth must include layer and KV-head counts, not only context and
  head dimension.
- Retaining a full tokenizer while zeroing an `<UNK>` row is not a valid
  general vocabulary-pruning method.
- Standard MoE inference does not require every expert to be resident at the
  same instant. Colibri exists specifically to place and stream experts.
- A zero-byte elastic specialist such as `champion_weights[0..size]` exists
  only when nested weight layout, training, manifests, and kernels were
  deliberately designed for it. It is not a property of ordinary checkpoints.
- Fixed claims such as dropping 20 to 30 percent of layers, expected
  perplexity above 50, or a universally superior sparse density have no local
  evidence.
- Architecture tables that list LLaMA-2 7B or Mistral 7B as 0.3B to 2B
  candidates are out of scope. Claims for a `LLaMA-3 1.3B` or `Vicuna 1.3B`
  family and Creative Commons licensing for Llama weights are unreliable and
  must not enter candidate admission.

Decision: arbitrary slicing is a negative control, not a product lane.
MatFormer-style nested networks and structured pruning remain optional
research only after the current dense champion is useful.

### 2. Very Small Specialist Training

Useful consensus:

- specialize against a strong immutable champion;
- define narrow scope and out-of-scope behavior before generating data;
- train with scenario variation, hard negatives, paraphrases, changing
  constraints, and authority permutations;
- compare adapters and standalone students under one sealed evaluation; and
- count broad-helpfulness regressions, not just in-scope gains.

Corrections:

- A 7B to 20B champion is not compatible with the stated browser-local target
  and cannot be assumed for this project.
- Scope calibration requires positive in-scope records and hard negative
  out-of-scope records. Positive helpful answers must still substantially
  outnumber refusal examples in the user-visible curriculum.
- LoRA has trainable adapter parameters even when merging can remove runtime
  adapter overhead.
- IA3 scales selected activation paths; reducing it to generic vectors on Q,
  K, and V is inaccurate.
- Hidden-state distillation may use learned projections and does not always
  require teacher and student to have identical hidden sizes.
- Incompatible teacher tokenizations cannot be reconciled by mapping top-k
  teacher tokens to vaguely similar student embeddings. Sequence-level
  distillation or a rigorously defined common target is required.
- DoRA, IA3, GKD, DPO, and related methods are experiment arms, not automatic
  winners. Preference optimization requires real pairwise decisions.
- A special `<|ABSTAIN|>` token and mid-generation splice from specialist to
  champion are brittle. Route before generation. Any fallback generation is a
  new visible attempt with a preserved receipt.
- Adapter training still executes the full frozen base and stores base
  weights, activations, gradients for trainable paths, optimizer state,
  temporary buffers, and allocator overhead. Compute cannot be estimated from
  trainable parameter count alone.

Use measured formulas:

`training_time = total_training_flops / measured_aggregate_flops_per_second`

or

`training_time = trained_tokens / measured_aggregate_tokens_per_second`

Do not request, store, or publish hidden teacher chain-of-thought. Preserve
final answers, source identities, generation parameters, review decisions, and
removal lineage.

### 3. Reversible Quantized-Base Overlays

Useful consensus:

- base bytes must remain immutable;
- every adapter must bind the exact base, tokenizer, layout, and training
  provenance;
- activation must stage, validate, and commit atomically;
- a failed switch must preserve the prior composition; and
- every composition change invalidates KV state in version zero.

Corrections:

- Do not dequantize, add, and requantize a whole layer for every inference
  call. A direct LoRA path computes the quantized base projection plus a small
  low-rank projection, for example:

  `y = x * Q(W)^T + scale * ((x * A^T) * B^T)`

  Tensor conventions may vary, but the base remains unchanged.
- Materializing a full `f32` layer for each decode token is an expensive
  reference path, not the target runtime.
- QLoRA is a training method for a quantized frozen base. It does not require
  repeated whole-layer requantization during inference.
- Additive same-base LoRA deltas commute under exact accumulation.
  Composition order becomes semantically material for non-additive overlays,
  replacement rules, quantized sequential merges, dependencies, or policy
  identity. The manifest must state which case applies.
- Wall-clock timestamps do not belong in a content identity. Put time in a
  signed or hashed receipt around the content-addressed object.
- An atomic pointer file on disk does not prove in-process activation safety.
  The generator needs an immutable, reference-counted composition handle,
  quiescence or cancellation policy, cache transition, and safe reclamation.
  `AtomicPtr` alone is not a complete lifetime design.
- `attention_frozen=true` is insufficient for KV reuse when an earlier MLP
  changes residual states consumed by later attention. Flush all pages after
  every composition change until a mathematically and empirically proved
  transform exists.
- A missing quality receipt must reject automatic routing and promotion, not
  merely emit a warning.
- Exact base restoration can reproduce local deterministic logits. Bitwise
  equality across instruction sets, arithmetic modes, and devices is not a
  credible universal requirement; use fixed-platform equality and declared
  cross-platform tolerances.

### 4. Conservative Private Routing

Useful consensus:

- select one declared path before generation;
- keep the champion as the default and uncertainty fallback;
- honor a current explicit user choice over stale remembered preferences;
- treat quoted and retrieved instructions as untrusted data; and
- measure the router separately and then as part of full response quality.

Corrections:

- k-nearest-neighbor routing is one candidate, not a proven optimum. Compare
  explicit-only selection, deterministic rules, a tiny classifier, and a
  local embedding index under equal byte and latency accounting.
- Direct current-turn text may contain an authoritative user model choice.
  Do not ignore all textual model names merely because quoted text is
  untrusted; distinguish direct instruction, UI choice, quote, retrieval, and
  memory provenance.
- Do not destructively sanitize the prompt before generation. Preserve raw
  input and route from trusted fields plus bounded semantic features.
- Specialist output must not be relabeled as a system message. Preserve its
  actual role and provenance.
- Topic change is not permission to silently discard conversation state. Use
  an explicit bounded-history policy and test continuity.
- A champion retry must preserve the first raw attempt and be visible as a
  declared fallback, not hidden best-of-N answer selection.
- A pinned specialist that is out of scope needs a truthful limitation or an
  explicit user-approved champion handoff. Compound requests should use the
  champion or ask a clarifying question unless decomposition is declared and
  independently evaluated.
- Central proprietary telemetry is unnecessary. Keep diagnostics and routing
  receipts local by default, with explicit redacted export only.

### 5. Colibri Placement

Useful consensus:

- separate logical model identity from current placement;
- use content-addressed expert files, bounded RAM tiers, asynchronous I/O,
  cache and prefetch metrics, and exact fallback on a miss; and
- treat any expert pruning or adaptive top-p mode as a separately named lossy
  composition with its own quality evidence.

Corrections:

- GLM-5.2 selects eight routed experts per token, not one. With approximately
  19 MB per expert, a naive no-cache main-model estimate is roughly
  `75 * 8 * 19 MB = 11.4 GB` of expert reads per token before reuse, overlap,
  deduplication, or placement.
- The authoritative routed-expert count is 19,456 for the pinned design, not
  21,504. Claims that 75 percent of the network is dense are also wrong.
- A report's own 1.425 GB/token assumption would imply about 1.28 PB of reads
  for one million tokens at a 10 percent hit rate, or 142.5 TB at a 90 percent
  hit rate. It cannot support a less-than-200-GB claim.
- `182 KB/token * 10,000 tokens` is approximately 1.82 GB, not 1.82 MB.
- Colibri's learned cache learns placement statistics, not model behavior.
- Operating-system page cache is not automatically a failure, and direct I/O
  is neither mandatory nor magical zero-copy execution. Compare buffered,
  memory-mapped where safe, and direct-I/O variants on target systems.
- Exact placement means the same logical weights and routing decisions.
  Bitwise output across CPU and GPU arithmetic is a separate reproducibility
  claim.
- Browser OPFS can support byte-addressable worker I/O. That makes a prototype
  possible, not proven fast. Browser storage quotas, allocation, WASM address
  space, service-worker lifecycle, interruption, and device memory still gate
  feasibility.

Colibri is therefore a future native companion placement experiment for an
admitted trained MoE architecture. It is not evidence that the current dense
runtime should be fragmented or that total local model bytes become smaller.

### 6. Whole-Portfolio Evaluation

Useful consensus:

- preregister model, adapter, router, evaluator, cases, seeds, byte metrics,
  and promotion rules before looking at results;
- compare champion, adapter specialists, standalone specialists, routed
  portfolio, and negative controls;
- preserve raw outputs and evaluate router errors as product errors; and
- invalidate only downstream phases when an evaluator changes.

Corrections:

- `no significant loss` does not demonstrate noninferiority. Predeclare a
  meaningful regression margin and use a paired confidence interval against
  that margin.
- Evaluator revision invalidates evaluation and downstream promotion, not an
  already valid multi-gigabyte acquisition or deterministic conversion.
- Fixed 5 percent, 10 percent, 50 ms, or similar thresholds in report prose
  are examples, not TinyRustLM acceptance policy.
- A useful portfolio need not consume no more storage than the champion.
  Require an explicit incremental budget and select an admissible point on the
  measured quality, latency, memory, and storage frontier.
- Current user preference means the latest direct user preference, not a
  generic newest policy. Untrusted memory should be treated as data rather
  than automatically refused.
- An LLM judge cannot be sole authority. Use deterministic invariants,
  blinded human review, and adjudication of disagreements.
- Sealed prompts and raw user payloads stay access-controlled. Public receipts
  may carry identities, hashes, counts, statuses, bounded errors, and
  redactions, but not private case bodies.
- A base-deduplicated adapter still has nonzero adapter bytes.
- An offline routing oracle may execute multiple arms to label cases. The
  product must execute only its one declared route unless best-of-N is itself
  the advertised and fully costed behavior.
- Strict Pareto dominance is too rigid for every product choice. First reject
  arms outside hard gates, then select among nondominated admissible arms using
  preregistered weights or budgets.

## Target Runtime Contract

### Artifact Types

Every executable object must be exactly one of:

1. standalone model;
2. base-dependent adapter;
3. composition manifest;
4. shared immutable chunk;
5. route-policy artifact;
6. KV-format artifact; or
7. retrieval-index artifact.

A dependent adapter must never be cataloged as a standalone `.slm`.

### Content Identity

Use canonical serialization and domain-separated hashes:

`base_id = H("base-v1" || base_manifest || model_bytes)`

`adapter_id = H("adapter-v1" || base_id || adapter_manifest || adapter_bytes)`

`composition_id = H("composition-v1" || base_id || canonical_members || execution_profile)`

`route_id = H("route-v1" || route_policy || selector_artifacts || thresholds)`

Timestamps, hostnames, mutable aliases, current process IDs, and friendly
names belong in receipts, not content identity. Runtime and evaluator hashes
belong in execution and evaluation receipts. Put a runtime semantic profile in
the composition only when it changes how the same bytes are interpreted.

### Byte Accounting

Report at least:

- standalone artifact bytes;
- logical bytes required by one composition;
- incremental specialist bytes assuming the base is present;
- physical portfolio bytes after exact content deduplication;
- router and retrieval-index bytes;
- KV allocated, committed, and peak bytes;
- activation scratch and temporary decoded bytes; and
- peak resident memory during load, switch, prefill, and decode.

Physical deduplication is a distribution and storage benefit, not proof of a
smaller logical model.

### Activation And KV

Load and validate a prospective composition into an immutable graph handle.
Publish that handle atomically only after all members, resource limits, and
quality policy pass. Existing generations retain their old reference or are
cancelled by an explicit policy. New generations acquire the new handle.
Reclaim the old graph only after all owners release it.

Version zero must flush all KV state for every composition change. A cache key
must bind composition, tokenizer, chat template, positional policy, cache
format, prompt token identity, and runtime semantics. Cross-composition reuse
is forbidden absent a separately proved transform.

### Routing

Begin with explicit user selection and simple deterministic rules. A learned
router is promoted only after it beats those baselines after selector bytes,
latency, calibration, wrong-route cost, and fallback cost are counted.
Routing consumes trusted provenance classes and preserved raw user text. The
champion handles ambiguity, compound tasks, and low-confidence cases.

## Recommended Build Order

1. Freeze a canonical artifact, composition, route, receipt, and byte-account
   schema.
2. Replace cumulative tensor mutation with immutable direct overlays and
   reference-counted atomic composition handles.
3. Prove exact repeated switching and conservative KV invalidation on f32,
   q8, q5, and q4 paths supported by the runtime.
4. Complete independent review of every proposed training record.
5. Train one narrow low-rank specialist, one sparse specialist, and one
   standalone distilled specialist against the same sealed task.
6. Compare explicit-only, deterministic, classifier, and embedding-router
   lanes locally.
7. Run the preregistered whole-portfolio experiment, including broad
   helpfulness and wrong-route costs.
8. Only then prototype native expert placement for a real admitted MoE model.

Because TinyRustLM is not live, a failed format or activation design should be
removed and rewritten cleanly. Retain its evidence and receipts for audit, but
do not retain compatibility code for unreleased behavior.

## Promotion Blockers

- 42/42 role-history records remain unresolved by independent human review.
- 668/668 expanded Qwen2.5 records remain unresolved by independent human
  review.
- No trained adapter or standalone specialist has passed sealed task and
  broad-assistant gates.
- Exact immutable activation and base restoration are not implemented and
  verified.
- No calibrated local router has end-to-end receipts.
- KV compression and composition reuse remain separate unproved research.
- No admitted MoE architecture has passed native or browser placement tests.
- Browser and target-native latency, memory, storage, and interruption
  measurements remain absent.


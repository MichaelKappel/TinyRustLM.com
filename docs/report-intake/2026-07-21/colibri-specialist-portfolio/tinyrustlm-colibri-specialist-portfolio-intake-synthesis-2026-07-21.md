# TinyRustLM Colibri And Specialist Portfolio Intake Synthesis

Date: 2026-07-21

Retrieval date for public sources: 2026-07-21

## Executive Recommendation

The user's proposed product shape is credible, with one important correction:
do not cut arbitrary layers, heads, tensors, or byte ranges out of an ordinary
dense model and expect the pieces to remain useful models. Build a portfolio
with one quality-proven general champion and narrowly scoped specialists in one
of two valid forms:

1. small, identity-bound trained adapters applied to an immutable champion
   base; or
2. independently distilled or structurally trained standalone `.slm` models
   when an adapter cannot meet the specialist's quality, size, architecture, or
   tokenizer requirements.

Colibri contributes useful placement ideas for a native companion: keep dense
state resident, place selected routed experts in RAM, stream colder experts
from disk, prefetch predicted expert files, and learn a bounded placement plan.
It does not establish that a dense TinyRustLM model can be decomposed after the
fact into accurate independent fragments. Colibri works because its source
model was trained as a routed mixture of experts and retains all expert bytes
on local storage.

The highest-value clean-slate runtime change is an immutable base plus
reversible specialist overlays. The current runtime has `ADP1`, `ASP1`, and
`ALR1` base-plus-delta plumbing, but applying an adapter mutates loaded tensors
and repeated applications accumulate. That is sufficient for fixtures and
one-way assembly; it is not proof of exact, cheap specialist switching. Before
shipping a portfolio, TinyRustLM should prove `base -> specialist A -> base ->
specialist B` restores the exact base state, clears incompatible KV state, and
never drifts across repeated cycles.

No adoption or training run is authorized by this intake. The 42-record and
668-record human review campaigns remain unresolved and cannot be used for
training until their independent review gates pass.

## Evidence Classes

### Directly Observed Local Facts

- `.uai/architecture.uai` declares a current 32 MiB selector model budget and
  a 1 MiB automatic adapter budget.
- `tinyrustlm/runtime/src/adapter.rs` parses and validates full `ADP1`, sparse
  `ASP1`, and rank-bounded `ALR1` packages tied to model and tokenizer
  identities.
- `tinyrustlm/runtime/src/model.rs` applies accepted deltas to the loaded model
  tensors. Quantized tensors are materialized and requantized where needed.
- `tinyrustlm/runtime/src/generate.rs` clears generation and KV state after an
  adapter application, which is the correct conservative behavior.
- Multiple adapter applications currently compose cumulatively. There is no
  proven immutable overlay or exact restore operation for fast switching.
- `tinyrustlm/runtime/src/kv_cache.rs` stores a fully allocated contiguous
  `f32` K/V cache. Its storage is approximately:

  `2 * layers * max_context * kv_heads * head_dim * 4 bytes`

- The current KV implementation has no quantized pages, persistence contract,
  or cross-model/cross-adapter reuse contract.
- Existing trained-adapter and model-quality work remains pending; fixture
  plumbing must not be described as a useful trained specialist.

These observations apply only to the inspected local revision. They are not
claims made by either external report.

### Sourced Public Facts

The pinned Colibri revision inspected for this synthesis is
[`44e489b196c9b7876b3d37a0570ebf1c6f90f54c`](https://github.com/JustVugg/colibri/tree/44e489b196c9b7876b3d37a0570ebf1c6f90f54c).
Its [README](https://github.com/JustVugg/colibri/blob/44e489b196c9b7876b3d37a0570ebf1c6f90f54c/README.md)
describes a C runtime specifically for GLM-5.2. It keeps approximately 17B
dense parameters resident, streams routed experts from local disk, and lists
19,456 routed experts rather than the 21,504 figure in one returned report.
All model expert bytes still exist locally; placement changes resident memory
and I/O, not logical parameter identity.

Colibri's [tuning guide](https://github.com/JustVugg/colibri/blob/44e489b196c9b7876b3d37a0570ebf1c6f90f54c/docs/tuning.md)
documents RAM placement, asynchronous I/O, layer-local caching, learned usage
cache, and experimental pilot lookahead. It also labels adaptive expert
top-p as lossy. Therefore, a claim that default placement changes neither
router choices nor numerical precision is materially different from an
explicit lossy expert-pruning mode.

The project [benchmark notes](https://github.com/JustVugg/colibri/blob/44e489b196c9b7876b3d37a0570ebf1c6f90f54c/docs/benchmarks.md)
label many results as estimates and say measurements are not promises. They
also show that quantization settings can change quality. Those numbers cannot
be transferred to TinyRustLM CPU or browser WASM without local reproduction.

Colibri code is published under [Apache-2.0](https://github.com/JustVugg/colibri/blob/44e489b196c9b7876b3d37a0570ebf1c6f90f54c/LICENSE).
The inspected official [GLM-5.2 model revision](https://huggingface.co/zai-org/GLM-5.2/commit/b4734de4facf877f85769a911abafc5283eab3d9)
is MIT-licensed and describes 256 routed experts with eight selected per token
across its MoE layers. Source-code license and model-weight license remain
separate provenance records.

### Engineering Recommendations

The champion-plus-specialists architecture, immutable overlays, route policy,
composition receipts, shared piece storage, and proposed tests below are
engineering recommendations. They are not facts reported by Colibri and have
not yet passed TinyRustLM measurements.

### Facts Requiring Local Verification

- whether a trained `ALR1` or `ASP1` specialist can fit the current 1 MiB
  budget and improve a sealed task suite;
- whether exact reversible overlays are faster and smaller than reloading a
  clean base;
- whether specialist routing improves end-to-end accuracy after wrong-route
  and routing-overhead costs are counted;
- whether shared content-addressed tensors materially reduce portfolio disk or
  transfer bytes for real related artifacts;
- whether KV quantization improves browser memory or speed without violating
  conversation-quality budgets; and
- whether native expert placement has any value for a future admitted MoE
  architecture under the companion's actual disk, RAM, and I/O limits.

## What A "Smaller Part" Can Mean

| Mechanism | Can reduce incremental portfolio bytes? | Can reduce active RAM? | Quality requirement | Recommended status |
| --- | ---: | ---: | --- | --- |
| Arbitrary dense-model layer/head/tensor slice | Superficially | Superficially | Usually destroys the trained computation graph | Reject |
| Trained low-rank or sparse adapter | Yes | Sometimes; base still required | Train and evaluate with exact base identity | Primary specialist lane |
| Structured pruning with recovery training | Yes | Yes | Architecture-aware pruning plus distillation/fine-tuning | Research lane |
| Nested/elastic model trained for subnetwork extraction | Yes | Yes | Must be designed and trained for valid subnetworks | Research lane |
| Independently distilled specialist `.slm` | Yes versus a full general model | Yes | Task-specific and fallback quality evidence | Primary standalone lane |
| MoE expert streaming | No reduction in logical model bytes | Yes, by moving cold experts to disk | Model must be trained as compatible MoE | Native placement research |
| Shared content-addressed tensors/chunks | Yes physically across related artifacts | No direct reduction in logical active weights | Exact composition and chunk hashes | Storage/distribution lane |
| Quantized KV cache | No `.slm` reduction | Yes for context state | Numerical and raw-conversation regression gates | Separate TurboQuant lane |
| Quantized retrieval vectors | No `.slm` reduction | Yes for persistent indexes | Recall, privacy, deletion, and parity gates | Separate TurboVec lane |

There are three byte counts to report separately:

- logical model bytes required to execute one composition;
- incremental bytes added by one specialist when its base is already present;
- physical portfolio bytes after content-addressed deduplication.

Calling only the third number "model size" would hide the real runtime cost.

## Proposed Portfolio Architecture

### 1. General Champion

Maintain one immutable, broadly useful `.slm` with an exact artifact hash,
tokenizer hash, chat-template identity, runtime requirement, quality receipt,
and ordinary-helpfulness baseline. It is the default and the fallback whenever
a route is absent, uncertain, unsupported, or outside a specialist's declared
scope.

The champion must be genuinely useful before specialization begins. A weak
base plus narrow adapters is not a general assistant.

### 2. Dependent Specialist Sidecars

A specialist sidecar is not a standalone `.slm`. Its identity is a composition:

`composition_id = H(base_id || ordered_adapter_ids || runtime_id || policy_id)`

The manifest must bind:

- exact base artifact, tokenizer, tensor layout, and quantization;
- ordered adapter artifacts and their training provenance;
- declared task scope and explicit out-of-scope behavior;
- route-policy identity;
- total and incremental bytes;
- base and specialist quality receipts; and
- KV-cache identity and invalidation rule.

Ordered identity matters because deltas need not commute after quantization or
when later adapters were trained against an earlier composition. A failure to
activate a new composition must leave the previous verified state unchanged.

The clean implementation should retain immutable base tensors and evaluate
overlays without destructive cumulative mutation, or restore from a verified
base image exactly. Because TinyRustLM is pre-release, replacing the current
one-way mutation design is preferred to carrying a compatibility shim.

### 3. Standalone Distilled Specialists

Use a separate small `.slm` when the task requires a different tokenizer,
architecture, embedded knowledge, context profile, latency target, or more
capacity than a small adapter provides. Examples might include strict JSON
extraction, a bounded code-explanation domain, or a local document classifier,
but each candidate must earn its scope from sealed evaluation rather than from
its label.

Catalog claims must say `task-specific-proven` unless general assistant quality
also passes. A specialist should hand off to the champion outside scope rather
than improvising a broad answer.

### 4. Content-Addressed Shared Storage

Related artifacts may share exact tensor or piece bytes in the companion store.
This is useful for acquisition, P2P transfer, disk capacity, and atomic
composition. It does not make a composition executable without all required
logical pieces. Manifests must reject chunk identity drift, missing chunks,
cross-model mixing, and a physical-byte claim that omits the base.

### 5. Routing

Start with explicit user selection and deterministic declared task rules. Add
a learned semantic router only after it has a sealed confusion matrix,
selectivity and fallback thresholds, latency cost, adversarial out-of-scope
tests, and raw end-to-end comparison against always using the champion.

Model-level routing is not mathematically identical to token-level MoE routing.
The former selects a separately evaluated composition for a request or phase;
the latter is an internal trained operation that chooses experts while sharing
the rest of one model. The analogy is useful for placement, not proof of
behavioral equivalence.

Hidden best-of-N generation is forbidden. Routing must occur before generation
unless best-of-N is explicitly declared as product behavior and its full cost
and selection evidence are evaluated.

## Colibri Ideas Worth Prototyping

For a future native companion lane, consider:

- immutable content-addressed expert/tensor files;
- bounded RAM tiers and a deterministic placement manifest;
- asynchronous reads into fixed buffers;
- per-layer or per-module hot caches;
- recorded cold-start and warm-start measurements;
- learned usage statistics that never alter artifact identity silently;
- prefetch whose misses fall back without changing numerical results; and
- optional lossy expert selection as a separately named, quality-gated mode.

These ideas are not an immediate browser design. Current browsers do not expose
the same arbitrary-file `mmap`/`pread` contract as a native process, and the
current TinyRustLM path loads an admitted artifact rather than a directory of
routed expert files. Browser support would need its own owned-storage,
streaming, interruption, memory-pressure, and privacy design.

## KV Cache And Retrieval Boundaries

KV state belongs to the exact active composition. Cache identity must bind at
least model bytes, ordered adapters, tokenizer, chat template, runtime, cache
format, positional policy, and prompt token IDs. Any model or adapter switch
invalidates reuse unless an independently proved transform exists. The reports
provide no basis for reusing serialized KV state across different models or
specialists.

TurboQuant-family KV experiments may reduce context RAM and perhaps bandwidth.
They do not reduce `.slm` model bytes. TurboVec-family work may make local
semantic retrieval smaller or faster. It stores embeddings and record indexes,
not transformer weights. Retrieval can help choose context or route a task,
but retrieved text remains untrusted data and cannot become a hidden system
instruction.

## Promotion Experiment

Compare these lanes with matched cases and fixed identities:

- champion base only;
- champion plus one `ALR1` specialist;
- champion plus one `ASP1` specialist;
- standalone distilled specialist;
- arbitrary dense slice as an expected-failure negative control; and
- champion plus routed specialist portfolio end to end.

For every lane record:

- sealed task-specific quality on unseen paraphrases;
- ordinary-helpfulness regression;
- out-of-scope and wrong-route behavior;
- untouched raw outputs and all declared sampling seeds;
- standalone, incremental, logical-composition, and physical-deduplicated bytes;
- cold load, warm activation, switch, first-token, and steady decode latency;
- peak committed native/WASM memory and KV growth;
- exact composition and cache identities;
- native/WASM parity where both are claimed; and
- repeated activation cycles proving no cumulative numerical drift.

No response repair, expected-term insertion, easiest-seed selection, or hidden
retry may turn a failure into a pass.

## Stop Rules

Reject or delete an experimental lane if any of these holds:

- the specialist misses its task-quality gate or exceeds the general-quality
  regression budget;
- base restoration is not exact and reversible;
- failed activation can partially mutate the active composition;
- incremental specialist bytes are not competitive with a standalone model;
- route errors erase the specialist's quality gain;
- routing or switching overhead erases the latency or memory benefit;
- KV compression creates critical instruction, source-authority,
  current-preference, practical-constraint, or continuity regressions;
- deduplication cannot prove every composition from exact chunk identities; or
- the browser path fails its own memory, interruption, and privacy tests.

## Corrected Or Rejected Report Claims

- Colibri's pinned README says 19,456 routed experts, not 21,504.
- Colibri is a GLM-5.2-specific runtime at the inspected revision, not a
  portable `.slm` component or a general TinyRustLM architecture.
- Model-level specialist routing and token-level MoE routing are analogous in
  resource planning but are not mathematically or operationally identical.
- Arbitrary fragments from a dense model are not useful specialists without a
  trained nested architecture, structured pruning and recovery, or
  distillation.
- A disk-streamed model is not smaller in total local storage; it has a smaller
  resident set at the cost of I/O.
- KV state is not portable across different model/adapter compositions by
  default.
- Speculative decoding is not available merely because a small specialist
  exists. Draft and target need compatible tokenization and a measured target
  verification API.
- "Infinitely scalable," "quality neutral," and unmeasured throughput claims
  are rejected. Every resource has bounded disk, RAM, bandwidth, context, and
  latency envelopes.
- Secondary articles, community posts, and agent-internal citation markers
  cannot replace pinned primary sources.

## Current Decision

The reports are helpful. They strengthen a clean champion-plus-specialists
direction and add native placement ideas, but they do not justify importing
Colibri or slicing current models. Proceed only through the accompanying TDD
delta. Keep static weights, specialist deltas, KV cache, and retrieval indexes
as separate contracts and evidence lanes.

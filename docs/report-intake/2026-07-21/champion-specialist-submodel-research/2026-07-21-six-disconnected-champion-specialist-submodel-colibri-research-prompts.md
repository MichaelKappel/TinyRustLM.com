# Six Disconnected Research Prompts: Champion Model, Tiny Specialists, And Colibri-Inspired Placement

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The agents may browse public websites,
standards, papers, model repositories, package registries, and public source
repositories. They do not have access to the TinyRustLM source tree, private
artifacts, local models, training corpora, evaluation prompts, runtime logs,
test receipts, developer machines, credentials, signing keys, network
configuration, or MemoryEndpoints rooms.

Every report must distinguish:

- directly observed public facts;
- sourced external claims that were not independently reproduced;
- the researcher's engineering inferences;
- recommendations for TinyRustLM; and
- facts that require local implementation or measurement.

No report may claim that it inspected, ran, integrated, or validated private
TinyRustLM code. Record publication or update dates, exact immutable source
revisions where available, license identities, and the report's retrieval
date. Prefer primary sources: papers, official model cards, official source,
standards, and first-party technical documentation. Secondary articles may
help discover primary sources but may not be the sole authority for a material
technical claim.

## Prompt 1: When Can A Useful Model Be A Proper Subnetwork Instead Of A Whole Model?

You are an independent principal researcher in neural architecture,
compression, structured pruning, and elastic inference. Produce a deeply
technical report answering when a useful language model can validly execute as
a strict subset of a larger model's parameters, and when "take only the useful
parts" is mathematically invalid.

Public product context and fixed constraints:

- TinyRustLM is a pre-release Rust/WASM browser-local language-model runtime.
- Portable model artifacts use the `.slm` product identity.
- The product hypothesis is one strong general champion plus several much
  smaller task specialists, with explicit fallback to the champion.
- Browser storage, transfer size, peak committed memory, first-token latency,
  decode latency, and conversation quality all matter.
- An arbitrary layer, attention head, tensor, expert, or byte-range deletion
  must not be mistaken for a trained valid submodel.
- Static model weights, online KV cache, and persistent retrieval embeddings
  are separate representations and must have separate size claims.
- TinyRustLM is not live; clean replacement is allowed and no legacy-support
  recommendation is needed.
- Evaluation answers may not enter training, and one attractive output cannot
  qualify a model.

Research current primary literature and public implementations for structured
pruning, layer dropping, attention-head and channel pruning, width/depth
elasticity, slimmable networks, once-for-all training, nested or Matryoshka-like
representations, early exit, mixture-of-depths, conditional computation,
expert pruning and merging, parameter sharing, low-rank factorization, tensor
decomposition, sparse subnetworks, lottery-ticket claims, and knowledge
distillation. Include language-model-specific evidence in approximately the
0.3B to 2B dense-equivalent range where available, but do not extrapolate a
vision result to browser LLMs without labeling the inference.

Address all of the following in depth:

1. Define graph closure for a valid subnetwork. Explain residual dimensions,
   normalization, attention projections, grouped-query attention, rotary
   dimensions, MLP gates, embeddings, vocabulary projection, and tokenizer
   dependencies that make naive slicing invalid.
2. Classify extraction methods into post-hoc deletion, prune-and-recover,
   train-time elastic subnetworks, nested checkpoints, conditional execution,
   and separately distilled students. State what training or recovery each
   class requires.
3. Analyze whether complete layers, heads, channels, FFN neurons, vocabulary
   rows, experts, or shared blocks can be removed while keeping a loadable and
   coherent model. Include required shape rewrites and calibration.
4. Compare unstructured sparsity, N:M sparsity, block sparsity, channel
   pruning, depth pruning, and low-rank decomposition on scalar CPU, SIMD CPU,
   and browser WASM. Count index, mask, padding, decode, and scratch overhead.
5. Explain why a parameter-count reduction may fail to reduce wall time,
   binary size, or committed memory when kernels remain dense or sparse
   metadata dominates.
6. Evaluate nested/elastic model training as a way to produce one stored family
   with several executable capacities. Address shared bytes, independently
   executable identities, training interference, sandwich rules, in-place
   distillation, and per-subnetwork quality receipts.
7. Evaluate vocabulary and embedding reduction for narrow specialists.
   Address tokenizer compatibility, tied embeddings, output projection,
   unknown-domain fallback, multilingual loss, code tokens, and whether a
   specialist may share the champion tokenizer without carrying its full
   embedding table.
8. Cover expert pruning, expert merging, and routed MoE subset execution.
   Distinguish removing experts from moving cold experts to disk. Explain
   router recalibration, load balancing, knowledge recovery, and rare-domain
   regressions.
9. Design a negative-control experiment that slices an ordinary dense model
   without recovery, so the resulting quality failure remains visible rather
   than being hidden by output repair.
10. Propose a decision tree for TinyRustLM: trained adapter, structurally
    pruned descendant, elastic subnetwork, independently distilled specialist,
    or full champion.
11. Give formulas for logical parameter bytes, physical shared bytes, runtime
    resident bytes, sparse metadata, scratch, and KV state. Do not invent
    throughput or memory measurements.
12. Identify source-license, model-license, patent, and derivative-work
    questions requiring authorized review. Do not provide a legal conclusion.

Required report structure:

1. Executive answer: valid submodels versus invalid slicing.
2. Explicit assumptions and terminology.
3. Taxonomy of subnetwork and compression methods.
4. Transformer graph-closure analysis by tensor family.
5. Current primary-source architecture matrix with licenses and revisions.
6. Training/recovery requirements and expected failure modes.
7. CPU, SIMD, and browser-WASM systems implications.
8. Honest byte and memory accounting formulas.
9. Proposed negative controls and local experiment matrix.
10. TinyRustLM decision tree and stop rules.
11. Unknowns requiring private/local execution.
12. Annotated primary-source bibliography with direct links and dates.

Do not recommend arbitrary slicing as a useful product path. Do not call
physical deduplication a smaller logical model, infer quality from parameter
count, hide a failed subnetwork behind repaired text, or assume sparse kernels
are faster without target-platform measurement.

## Prompt 2: Training Extremely Small Task Specialists That Complement A General Champion

You are an independent principal ML scientist specializing in distillation,
task specialization, data design, and small-model evaluation. Produce a deeply
technical report on how to train genuinely useful tiny specialist language
models that complement one strong general champion while remaining honest
about narrow scope.

Public product context and fixed constraints:

- TinyRustLM is a pre-release browser-local Rust/WASM chat system using
  portable `.slm` artifacts.
- The candidate portfolio has one general champion and several small
  specialists, potentially around extraction, structured JSON, rewriting,
  summarization, code explanation, bounded planning, classification, or other
  evidence-supported scopes.
- A specialist must fall back to the champion outside its proven scope.
- A specialist may be a base-dependent adapter or an independently executable
  small model; these are different artifact and storage claims.
- General conversation, ambiguity, practical constraints, source authority,
  latest-user preference, untrusted memory, lawful adult inquiry, and
  multi-turn continuity remain important product behaviors.
- Positive useful examples must substantially outnumber refusals.
- Training and evaluation must remain contamination-separated. No sealed
  prompt, expected answer term, or evaluator-specific phrase may enter teacher
  generation or training.
- TinyRustLM is not live; recommend the cleanest design without legacy support.

Research current primary literature and official model/training documentation
for task-specific distillation, sequence-level and token-level knowledge
distillation, specialist/generalist ensembles, multi-teacher distillation,
progressive distillation, curriculum learning, data selection, synthetic data
verification, self-training, domain adaptation, adapter training, and compact
student architecture selection. Include relevant evidence for approximately
50M to 1B parameter specialists when credible, but do not invent a minimum size
that guarantees language ability.

Address all of the following in depth:

1. Define what makes a specialist worthwhile: measurable task gain, narrow
   calibrated scope, low incremental bytes, low switch cost, robust fallback,
   and no critical broad-behavior regression.
2. Compare base-dependent LoRA/DoRA/IA3/sparse/full-delta specialists with
   standalone distilled students. Include tokenizer and architecture coupling,
   training cost, incremental storage, runtime RAM, and deployment flexibility.
3. Design a scope taxonomy that is semantic rather than label-based. Explain
   how to define positive in-scope, adjacent, ambiguous, compound, and clearly
   out-of-scope requests.
4. Specify curriculum generation using scenario factors, counterfactual
   constraints, authority permutations, entity/unit substitution, discourse
   variation, multi-turn state changes, adversarial quoted instructions, hard
   negatives, and teacher disagreement.
5. Compare assistant-only SFT, full-sequence SFT, sequence-level distillation,
   token-level KL, top-k logit distillation, hidden-state matching, preference
   optimization, and self-distillation for very small specialists. State which
   require tokenizer or architecture compatibility.
6. Explain how to prevent the specialist from learning brittle answer phrases
   or evaluation vocabulary. Include template-family holdouts, semantic-neighbor
   exclusion, entity-substituted overlap, response-answer overlap, and deletion
   lineage.
7. Design teacher generation with ensembles, sampling diversity,
   deterministic replay, factual verification, rubric review, disagreement
   adjudication, PII removal, license provenance, and removal lineage. Do not
   request or expose hidden chain-of-thought.
8. Analyze capacity allocation: embeddings, vocabulary, depth, width, heads,
   KV heads, context, FFN, and output projection. Show when tokenizer size can
   dominate a micro-model and when sharing the champion tokenizer is helpful
   or costly.
9. Define specialist abstention and fallback behavior without training broad
   over-refusal. Include uncertainty, compound requests, partial handling, and
   preserving the user's latest explicit selection.
10. Design matched promotion experiments comparing champion, champion plus
    adapter, standalone specialist, and routed portfolio. Preserve untouched
    raw output and repeated seeds where sampling is used.
11. Require ordinary-helpfulness regression even for task-specific artifacts.
    Explain what can be omitted from a narrow task claim and what critical
    failures always reject promotion.
12. Give compute and time formulas using parameters, trainable parameters,
    tokens, sequence length, batch, optimizer states, precision, checkpointing,
    and measured hardware throughput. Do not invent wall-clock estimates.

Required report structure:

1. Executive portfolio recommendation.
2. Specialist claim taxonomy and scope contract.
3. Adapter-versus-standalone architecture matrix.
4. Curriculum proportions and scenario-generation system.
5. Distillation and optimization method comparison.
6. Teacher review, provenance, and contamination controls.
7. Capacity, tokenizer, context, and footprint analysis.
8. Routing, abstention, and champion fallback contract.
9. Sealed promotion experiment and statistical plan.
10. Compute formulas, pilot stages, and stop rules.
11. Unknowns requiring approved local data and execution.
12. Annotated primary-source bibliography with direct links and dates.

Do not train on evaluation failures, select the easiest seed after seeing
results, infer a task scope from a model name, call an adapter standalone, or
lower quality thresholds merely to create more catalog entries.

## Prompt 3: Immutable Base Models And Reversible Specialist Adapter Overlays

You are an independent principal inference-runtime architect and numerical
systems engineer. Produce a deeply technical design for exact, atomic,
reversible specialist overlays on a quantized transformer base suitable for a
Rust CPU runtime and browser WASM.

Public product context and fixed constraints:

- TinyRustLM is a pre-release local language-model runtime with `.slm` model
  artifacts and a proposed champion-plus-specialists portfolio.
- A specialist sidecar depends on an exact base and is not a standalone model.
- The active composition must be cryptographically identifiable.
- Switching `base -> A -> base -> B` must not accumulate A into B or drift from
  the original base.
- Failed validation, allocation, activation, cancellation, or requantization
  must leave the prior valid composition unchanged.
- Model or adapter switching invalidates generation state and KV reuse unless
  an independently proved compatibility transform exists.
- Browser peak committed memory and copy amplification matter as much as disk
  size. A design that keeps base, full f32 materialization, and quantized copy
  simultaneously may be unacceptable.
- TinyRustLM is not live. You may recommend a clean format/runtime rewrite and
  should not propose backward-compatibility shims.

Research official documentation and primary literature for LoRA, DoRA, IA3,
adapters, sparse deltas, delta tuning, quantized adapter inference, QLoRA,
low-rank merging, multi-adapter serving, adapter composition, PEFT runtimes,
copy-on-write mappings, immutable snapshots, overlay filesystems as an analogy,
and content-addressed artifact composition. Inspect public Rust/C/C++/WASM
implementations where relevant and pin exact revisions. Distinguish training
algorithms from inference representation.

Address all of the following in depth:

1. Define composition identity over exact base bytes, tokenizer, tensor layout,
   quantization, ordered adapters, runtime implementation, and composition
   policy. Explain why adapter order may matter.
2. Compare destructive merge, merge-from-clean-base, lazy low-rank overlay,
   sparse overlay, copy-on-write tensor pages, per-layer materialization,
   double-buffered atomic swap, and full model reload.
3. Analyze q4/q5/q8 bases. Explain error from dequantize-add-requantize,
   repeated merges, scale recomputation, outliers, and non-associativity. Define
   a fresh-base numerical oracle.
4. Design atomic activation. Cover validation, bounded allocation, staging,
   checksum verification, final commit point, rollback on failure, concurrent
   generation, cancellation, and model free.
5. Design exact deactivation. State whether it restores bytes, logical tensor
   values, logits within tolerance, or all three, and ensure the claim matches
   the representation.
6. Count persistent base bytes, adapter bytes, immutable backing, mutable
   pages, dequantization scratch, requantization scratch, allocator overhead,
   and peak switch memory. Give formulas for dense, sparse, and low-rank
   adapters.
7. Analyze direct low-rank matmul addition versus premerged weights on scalar
   CPU, AVX2/NEON, and WASM SIMD. Include rank, batch size one, prefill versus
   decode, cache locality, and kernel launch/call overhead.
8. Specify compatibility checks for tensor names/indices, dimensions, tied
   weights, tokenizer, embedding/output projection, rank, sparse index order,
   finite values, endianness, and quantization profile.
9. Design composition of multiple specialists. Address conflicts, ordering,
   per-layer ownership, weighted mixtures, incompatible training bases, and
   why arbitrary stacks require their own quality receipts.
10. Define KV, prefix-cache, speculative-decoding, and sampler invalidation
    behavior. A cache key must name the exact active composition.
11. Specify deterministic native/WASM differential tests, repeated switch
    cycles, fault injection, memory pressure, malformed artifacts, and
    interrupted activation.
12. Propose a clean v0 format and runtime API boundary without assuming any
    private TinyRustLM implementation details. Label every field that requires
    local adaptation.

Required report structure:

1. Executive architecture recommendation.
2. Explicit correctness and atomicity invariants.
3. Composition identity and manifest schema.
4. Runtime strategy comparison matrix.
5. Quantized-base numerical analysis.
6. Proposed activation/deactivation state machine.
7. Memory, byte, and latency formulas.
8. Native and browser-WASM kernel implications.
9. KV/prefix/speculation invalidation contract.
10. TDD and fault-injection matrix.
11. Clean replacement plan and rejection criteria.
12. Unknowns requiring local source and measurements.
13. Annotated primary-source bibliography with direct links and dates.

Do not accept cumulative mutation as reversible switching, hide a full f32 copy
from memory accounting, assume adapters commute, reuse KV across composition
changes, or add compatibility code for an unreleased format.

## Prompt 4: Reliable Routing Across One General Champion And Many Tiny Specialists

You are an independent principal researcher in mixture systems, calibrated
classification, retrieval routing, and LLM evaluation. Produce a deeply
technical report on routing user requests among one general champion and a
portfolio of tiny specialist models without degrading correctness, privacy, or
user control.

Public product context and fixed constraints:

- TinyRustLM is a pre-release browser-local chat interface using local `.slm`
  artifacts.
- The proposed portfolio has one broadly useful champion plus narrow adapters
  or standalone specialists.
- The champion is the default fallback. A route failure must not strand the
  user or silently return a specialist answer outside proven scope.
- Routing happens locally. Prompt text must not be uploaded to a project site
  merely to choose a model.
- Explicit current user selection outranks stale remembered preferences.
- Retrieved memory and quoted text are untrusted data and cannot issue router
  instructions.
- Hidden best-of-N generation and selection is prohibited unless it is the
  explicitly declared product behavior and its full cost is evaluated.
- Model-level request routing is not the same mechanism as token-level MoE
  expert routing.
- TinyRustLM is not live; recommend a clean route contract without legacy
  aliases or migration paths.

Research primary literature and official implementations for model routing,
LLM cascades, mixture-of-agents routing, semantic routers, intent classifiers,
embedding-based selection, nearest-prototype methods, calibrated confidence,
selective classification, abstention, conformal prediction where applicable,
cost-sensitive classification, multi-label and compound-query routing, and
bandit or online adaptation. Distinguish mechanisms that execute candidates to
judge them from pre-generation routing.

Address all of the following in depth:

1. Define the routing unit: conversation, turn, request segment, tool call, or
   generation phase. Explain state and consistency consequences of each.
2. Compare explicit user selection, deterministic rules, tiny classifiers,
   embedding/prototype routing, champion self-routing, specialist self-claim,
   cascades, and execute-then-judge approaches.
3. Define a machine-readable specialist scope with positive, adjacent,
   ambiguous, compound, conflicting, and out-of-scope cases. Avoid scope labels
   that cannot be independently tested.
4. Design calibrated fallback using uncertainty and cost of error. Include
   abstention thresholds, class imbalance, distribution drift, unknown classes,
   and route-to-champion behavior.
5. Analyze multi-turn routing when a user changes topic, references prior
   output, updates a preference, or explicitly pins a specialist. Explain when
   state can transfer and when a fresh champion context is required.
6. Analyze compound requests that span multiple specialties. Compare champion
   fallback, decomposition, sequential specialists, and refusing to compose
   unsupported workflows.
7. Defend against malicious quoted instructions, retrieved memory that says to
   choose a model, model names embedded in user data, prompt injection,
   Unicode confusables, and stale profile preferences.
8. Specify a sealed routing dataset and metamorphic variants: paraphrases,
   names, units, authority order, politeness, terse style, negation,
   distractors, and topic mixtures.
9. Define metrics beyond top-1 route accuracy: per-scope precision/recall,
   selective risk, calibration error, coverage, fallback rate, wrong-route
   severity, critical failure, latency, memory, model-switch count, and final
   response quality.
10. Explain why routing accuracy alone cannot prove portfolio value. Design an
    end-to-end comparison against always using the champion and against
    explicit-only selection.
11. Address privacy-preserving local telemetry and optional user correction
    without building a proprietary prompt-collection backend. Corrections must
    not silently retrain or change route identity.
12. Define route-policy versioning, deterministic replay, receipts, rollback,
    and drift detection.

Required report structure:

1. Executive routing recommendation.
2. Routing-unit and scope taxonomy.
3. Method comparison with compute and privacy costs.
4. Calibration, abstention, and fallback design.
5. Multi-turn and compound-request state machine.
6. Untrusted-input and adversarial threat model.
7. Dataset, metamorphic, and holdout design.
8. Metrics and statistical treatment.
9. End-to-end champion-versus-portfolio experiment.
10. Route identity, receipts, and rollback.
11. Unknowns requiring local model outputs and UI execution.
12. Annotated primary-source bibliography with direct links and dates.

Do not equate model routing with MoE routing, use an opaque judge as sole
authority, choose a route after viewing multiple hidden outputs, let retrieved
text control the router, or claim a portfolio gain without end-to-end final
response evidence.

## Prompt 5: Colibri-Inspired Expert Streaming, Placement, And Conditional Model Loading

You are an independent principal systems researcher specializing in
out-of-core inference, mixture-of-experts runtimes, storage hierarchies, and
CPU/browser deployment. Produce a deeply technical report on which ideas from
Colibri and related expert-streaming systems could improve TinyRustLM, and
which cannot transfer to dense or browser-local models.

Public product context and fixed constraints:

- TinyRustLM is a pre-release Rust/WASM browser-local model runtime with an
  optional explicitly chosen native companion for advanced local storage or
  P2P capabilities.
- The product hypothesis is one general champion plus several small
  specialists. Some artifacts may share exact content-addressed pieces.
- Colibri is public research/reference input; no current TinyRustLM dependency
  or compatibility is claimed.
- Moving weights from RAM to disk changes residency and I/O. It does not reduce
  total logical model bytes or make arbitrary model fragments useful.
- Browser-only use must remain normal. The browser must not probe or contact a
  native companion without explained user opt-in.
- Static weights, KV cache, and retrieval indexes remain separate.
- TinyRustLM is not live; recommend a clean design and no legacy support.

Inspect the current public Colibri repository at an immutable revision and pin
its documentation, source, license, supported model identity, file formats,
expert count, quantization choices, I/O APIs, cache policies, prefetch logic,
KV representation, speculative decoding, and benchmark qualifications. Then
compare primary sources and official implementations for MoE offload, expert
caching, expert prefetch, activation prediction, CPU/GPU/disk tiering,
out-of-core tensor loading, memory mapping, asynchronous direct I/O, and model
module paging. Distinguish peer-reviewed evidence from project estimates.

Address all of the following in depth:

1. Reconstruct Colibri's exact supported architecture and module graph. State
   which tensors remain resident, which experts stream, how the router chooses
   experts, and which behaviors are model-trained rather than runtime-created.
2. Build an immutable source and claim ledger. Reconcile README, tuning,
   benchmark, code, release, package, model-card, and license differences.
3. Explain exact versus lossy modes. Separate placement/prefetch that preserves
   router decisions from expert top-p, pruning, changed precision, speculative
   decoding, or other quality-affecting choices.
4. Analyze disk access patterns per token: expert count, bytes per expert,
   layers, queue depth, random versus sequential I/O, page cache, cold/warm
   behavior, read amplification, and storage endurance. Give formulas rather
   than invented measurements.
5. Compare OS page cache, explicit LRU, per-layer cache, learned usage cache,
   prefetch, memory mapping, buffered reads, asynchronous reads, and direct I/O
   on Windows and Linux.
6. Analyze failure behavior: missing/corrupt expert, partial read, short read,
   disk-full, device removal, cancellation, process crash, stale placement
   cache, changed model files, and resource-envelope violation.
7. Determine what transfers to a champion-plus-specialist portfolio. Compare
   expert files inside one MoE, adapter sidecars, standalone specialist models,
   and shared immutable tensor chunks. Do not collapse their identities.
8. Analyze browser constraints: File System Access, OPFS, IndexedDB, Cache
   Storage, service workers, WASM linear memory, workers, transfer/copy costs,
   storage eviction, permission lifecycle, and the absence of native
   `mmap`/`pread` semantics.
9. Design an optional companion boundary with explicit consent, read-only
   content-addressed storage, narrow loopback APIs, no prompt/model upload to
   project sites, and truthful browser fallback.
10. Evaluate whether an admitted small MoE could plausibly help TinyRustLM.
    Include tokenizer, expert-kernel, router, quantization, artifact-size,
    context, and source-quality gates before any port.
11. Define a local benchmark separating cold placement, warm placement,
    prefetch hit/miss, RAM tiers, SSD/HDD classes, exact/lossy modes, and
    quality. Report p50/p95/p99 and total bytes read, not only best speed.
12. State adoption and stop rules for native and browser lanes independently.

Required report structure:

1. Public Colibri observation and revision ledger.
2. Exact architecture and data-flow reconstruction.
3. Exact-versus-lossy mode table.
4. Storage, memory, and I/O formulas.
5. Cache/prefetch design comparison.
6. Failure, corruption, and restart state machine.
7. Transferability to champion, adapters, and specialists.
8. Native companion and browser constraint analysis.
9. Benchmark and fault-injection plan.
10. Adoption gates and likely dead ends.
11. Unknowns requiring local hardware and source access.
12. Annotated primary-source bibliography with direct immutable links and dates.

Do not repeat project marketing as measured fact, misstate expert counts, call
disk streaming compression, assume an MoE expert is an independent chatbot,
invent browser file APIs, or infer TinyRustLM performance from another model
and machine.

## Prompt 6: Independent Portfolio Experiment For Accuracy, Size, Memory, And Latency

You are an independent principal evaluation scientist, release engineer, and
performance-methodology lead. Design a preregistered experiment that determines
whether one champion plus tiny specialists is genuinely better than one model
for TinyRustLM after quality, routing errors, storage, memory, and switching
costs are all counted.

Public product context and fixed constraints:

- TinyRustLM is a pre-release browser-local Rust/WASM chat product using
  portable `.slm` artifacts.
- Candidate arms include one general champion, champion plus trained adapter
  specialists, independently distilled standalone specialists, a routed
  portfolio, shared content-addressed storage, and optional KV compression.
- Arbitrary dense-model slicing is an expected-failure negative control, not a
  product technique.
- Physical deduplicated bytes, logical execution bytes, incremental specialist
  bytes, peak resident bytes, scratch, and KV bytes must be reported
  separately.
- Static-weight, adapter, KV-cache, and retrieval-index effects cannot be
  combined into one bit-width or compression claim.
- Raw outputs must remain untouched. No repair, answer completion, expected
  keyword injection, easiest-seed selection, or hidden best-of-N is allowed.
- Evaluation cases and expected-answer concepts must remain excluded from
  training and teacher generation.
- TinyRustLM is not live; failed experimental formats may be deleted without
  legacy support, but receipts and failures remain immutable evidence.

Research current primary evaluation, selective-prediction, statistical,
systems-benchmark, LLM-contamination, and artifact-provenance literature.
Design an implementation-neutral protocol; do not claim access to TinyRustLM
models, code, prompts, hardware, or outputs.

Address all of the following in depth:

1. Define experiment arms: champion only; champion plus low-rank adapter;
   champion plus sparse delta; standalone specialist; explicit-selection
   portfolio; automatic-router portfolio; arbitrary-slice negative control;
   and optional shared-storage/KV ablations.
2. Define claim tiers for runtime-smoke, task-specific-proven, routed-portfolio
   proven, broad-assistant-quality, storage-efficient, memory-efficient, and
   performance-efficient. State prohibited language for each incomplete tier.
3. Build a task taxonomy covering ordinary chat, ambiguity, practical
   constraints, source conflict, current preference, untrusted memory,
   multi-turn references, lawful adult inquiry, factuality, summary, rewrite,
   JSON, extraction, and code explanation.
4. Separate training/development, routing-development, sealed promotion, and
   independent audit sets. Include normalization, n-grams, semantic neighbors,
   template families, entity substitution, response-answer overlap, public
   benchmarks, and deletion lineage.
5. Design matched fixed and seeded stochastic evaluation. Address seed policy,
   pass probability, confidence intervals, correlated cases, multiple
   comparisons, infrastructure flake, and why best-of-N is invalid unless it is
   the declared product behavior.
6. Define routing metrics and final-response metrics. A correct route with a bad
   response and a wrong route with a lucky answer must remain distinguishable.
7. Specify broad-helpfulness regression budgets and non-compensable critical
   failures. A task gain may not offset source-authority, latest-preference,
   impossible-advice, untrusted-memory, or severe completion failures.
8. Define exact byte accounting for standalone files, required base, adapters,
   manifests, tokenizers, shared chunks, indexes, alignment, page tables,
   scratch, decoded shadow copies, and browser/WASM linear memory.
9. Define timing methodology for acquisition, verification, cold load, warm
   activation, switching, route decision, prefill, first token, decode,
   deactivation, and cleanup. Include cold/warm process isolation and p50/p95/
   p99.
10. Specify repeated route and adapter cycles that detect cumulative mutation,
    stale KV, leaked memory, nondeterministic composition, and failed rollback.
11. Design browser and native matrices with CPU/OS/browser/compiler identities,
    constrained RAM, storage classes, mobile widths, cancellation, background
    throttling, and no-secret network evidence.
12. Define content-addressed receipts binding model, base, adapters, tokenizer,
    router, runtime, evaluator, cases, raw outputs, measurements, and decision.
    Explain invalidation when one component changes.
13. Produce stop rules and a sequential pilot strategy that avoids spending
    training or conversion compute on candidates already defeated by source,
    size, routing, or raw-quality gates.
14. Define the final decision function. It must expose tradeoffs rather than
    hiding them in one arbitrary scalar score.

Required report structure:

1. Executive preregistration recommendation.
2. Explicit hypotheses and falsification conditions.
3. Experiment arms and claim taxonomy.
4. Task, routing, holdout, and contamination design.
5. Quality metrics and statistical analysis.
6. Byte, memory, and latency accounting schemas.
7. Native/browser execution matrix.
8. Reversibility, cache, and fault-injection tests.
9. Content-addressed receipt graph and invalidation rules.
10. Pilot, scale-up, and stop rules.
11. Final multi-objective decision matrix.
12. Unknowns requiring approved local execution.
13. Annotated primary-source bibliography with direct links and dates.

Do not declare victory from task accuracy alone, exclude router overhead, omit
the required base from specialist size, hide decoded shadow memory, combine KV
and weight compression, overwrite failed attempts, or count a relabeled or
byte-identical artifact as portfolio diversity.

# Six Disconnected Deep-Dive Research Prompts: Small-Model Architecture, Training, And Browser Fidelity

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The agents may browse public websites,
standards, papers, model repositories, source repositories, and public package
registries. They do not have access to the TinyRustLM source tree, private
artifacts, local models, evaluation prompts, raw model outputs, training data,
test receipts, GPUs, credentials, signing keys, development machines, or
internal MemoryEndpoints rooms.

These assignments are a deeper follow-up to broad Liquid AI and edge-model
research. They should resolve specific engineering decisions, not repeat a
general description of Liquid Neural Networks or summarize vendor marketing.

Every report must distinguish:

- directly observed public facts;
- sourced external claims that were not independently reproduced;
- the researcher's own derivations and inferences;
- engineering recommendations;
- legal or licensing questions requiring authorized review; and
- facts that require local execution or private evidence.

Every report must use primary sources wherever possible, record publication or
update dates, record the retrieval date, and pin repository evidence to an
immutable revision when one exists. No agent may claim that it inspected, ran,
or validated private TinyRustLM code or evidence. Do not request private
prompts, credentials, unpublished model outputs, or proprietary datasets.

## Prompt 1: Causal Attribution Of Hybrid-Model Gains Versus Data, Scale, And Post-Training

You are an independent principal ML architecture scientist and experimental
methodologist. Determine whether publicly reported advantages of Liquid
Foundation Models and other recurrent, convolutional, state-space, or hybrid
language models are plausibly caused by architecture rather than parameter
count, tokenizer choice, training-token volume, data quality, distillation,
post-training, quantization, runtime maturity, or benchmark selection.

You have internet access but no private TinyRustLM code, models, outputs,
datasets, receipts, or hardware. Your report must be useful for deciding
whether a browser-local Rust project should invest in a new hybrid execution
path or continue with compact dense transformers.

Fixed product constraints:

- TinyRustLM is a browser-local AI chat system with a Rust and WASM runtime.
- The relevant model range is approximately 0.3B to 2B parameters.
- Conversational usefulness and practical judgment matter more than arithmetic
  benchmark leadership.
- Long-context claims matter only when quality, latency, and actual memory
  growth are measured together.
- Vendor benchmark charts are hypotheses, not product evidence.
- A new architecture has recurring converter, runtime, quantization, browser,
  testing, and maintenance costs.
- An architecture project should not begin merely because a model is popular,
  small, fast in another runtime, or structurally interesting.

Research and address all of the following:

1. Build a current taxonomy of compact sequence architectures that are
   plausible for local text generation. Include dense attention, sliding-window
   attention, grouped-query attention, LFM/LIV-style blocks, Mamba and Mamba-2,
   RWKV, RetNet or retention mechanisms, Hyena-style convolutions, and newer
   publicly documented hybrids that have downloadable weights.
2. For every included family, identify the strongest primary evidence for
   quality, prefill speed, decode speed, peak memory, context scaling, energy,
   and quantization. Separate peer-reviewed results, official technical
   reports, model cards, source code, reproducible third-party results, and
   promotional claims.
3. Construct an evidence table that records exact model revision, parameter
   count methodology, active versus total parameters, tokenizer vocabulary,
   tied or untied embeddings, training-token claims, context length, attention
   or recurrent block ratio, post-training method, precision, hardware,
   runtime, batch size, prompt length, decode length, and license.
4. Identify every confound that prevents a published comparison from
   attributing a gain to architecture. Include unequal data, hidden teacher
   distillation, different chat templates, different sampling, unequal
   vocabulary cost, unreported active parameters, benchmark contamination,
   quantization asymmetry, runtime-specific kernels, and cherry-picked devices.
5. Design a matched causal experiment comparing at least one dense model and
   one hybrid model. Control parameter count, non-embedding parameters,
   tokenizer, training tokens, data order, optimizer, sequence mix,
   post-training, precision, runtime, and evaluation. Explain which controls
   are essential and which may be relaxed in a lower-cost pilot.
6. Define architecture ablations that isolate block type and block ratio.
   Include all-attention, all-recurrent where feasible, alternating blocks,
   front-loaded attention, back-loaded attention, and equal-compute variants.
7. Define quality measures that test practical conversation, ambiguity,
   source conflict, current-turn precedence, unavailable resources, hostile
   quoted memory, summaries, rewriting, JSON, code explanation, and lawful
   adult questions. Require unseen paraphrases and untouched raw outputs.
8. Define systems measures for native CPU and browser WASM: time to first
   token, prefill tokens per second, decode tokens per second, peak resident
   memory, model bytes, state or KV-cache bytes per token, thread scaling,
   thermal drift, and UI responsiveness. Give formulas rather than invented
   TinyRustLM measurements.
9. Explain how recurrent-state compression can improve asymptotic memory while
   losing exact retrieval, and design tests that reveal the quality boundary as
   context length and distractor count grow.
10. Recommend statistical methods for repeated seeds, paired prompts,
    correlated failures, effect sizes, confidence intervals, sequential tests,
    and multiple comparisons. Reject best-of-N output selection unless it is
    declared product behavior.
11. Evaluate whether public evidence supports a near-term architecture bet,
    only a small oracle experiment, or no investment. State what result would
    reverse the recommendation.
12. Produce a source-quality score for each major public claim and list the
    exact evidence needed to upgrade it from vendor-reported to independently
    reproduced.

Required report structure:

1. Executive conclusion with explicit confidence levels.
2. Architecture and public-evidence matrix.
3. Claim-by-claim causal-confound audit.
4. Matched experiment and ablation design.
5. Behavioral evaluation matrix.
6. Native and browser systems methodology.
7. Context-memory versus retrieval-quality analysis.
8. Statistical analysis plan.
9. Cost model and value-of-information calculation.
10. Build, pilot, defer, or reject decision table.
11. Unknowns requiring local execution.
12. Annotated primary-source bibliography with immutable links and dates.

Do not infer architecture superiority from one vendor chart, one benchmark,
one parameter count, or one attractive response. Do not treat constant-size
recurrent state as proof of constant-quality long-context memory. Do not invent
training details that a model publisher did not disclose.

## Prompt 2: LFM And Hybrid Operator Specification, Reference Oracles, And Portable Conformance

You are an independent compiler engineer, numerical-kernel architect, and
model-format specialist. Produce an operator-level specification for evaluating
whether a documented LFM or comparable hybrid model can be implemented safely
in a portable Rust runtime and browser WASM without guessing tensor semantics.

You may inspect public model repositories, immutable configuration files,
official reference implementations, Transformers implementations, llama.cpp
or other public backends, technical reports, tokenizer files, and licenses.
You cannot inspect private TinyRustLM code, its `.slm` format implementation,
local conversion tools, model files, tests, or runtime logs.

Fixed constraints:

- A structurally valid conversion is not numerical or behavioral proof.
- Exact source revisions, tensor identities, tokenizer bytes, and chat
  templates must be pinned before implementation.
- Unsupported or ambiguous semantics must fail closed.
- Native and WASM paths need the same declared computation, state lifecycle,
  and tokenization behavior.
- A model family is not admitted merely because another runtime supports it.
- Public code licenses and model-weight licenses are separate review objects.

Research and specify all of the following:

1. Select one exact, publicly downloadable LFM2 or LFM2.5 text-model revision
   as the primary case study. If public evidence is insufficient, say so and
   use a second well-documented hybrid family as a comparison rather than
   filling gaps with guesses.
2. Inventory every authoritative artifact required to reconstruct inference:
   config, generation config, tokenizer model or JSON, added tokens, tokenizer
   config, chat template, weight index, tensor shards, model code, and license.
   Record byte sizes, cryptographic identities when publicly available, and
   immutable repository revisions.
3. Derive the forward pass block by block. Cover embeddings, normalization,
   attention, rotary position handling, recurrent or convolutional mixing,
   gating, residual order, feed-forward layers, output normalization, and LM
   head. Mark each equation as directly sourced, derived from public code, or
   still unknown.
4. Specify tensor names, logical shapes, storage layouts, transpositions,
   grouping, head dimensions, convolution kernel orientation, recurrent-state
   dimensions, and dtype requirements. Never present a guessed tensor name as
   an observed fact.
5. Describe prefill and one-token decode separately. Define state creation,
   update order, sequence reset, end-of-sequence handling, prompt replacement,
   batch isolation, cancellation, model switching, cloning, serialization, and
   destruction.
6. Analyze whether the architecture uses fixed recurrent state, attention KV
   cache, convolution history, or a combination. Give exact memory formulas
   from documented dimensions and distinguish weight, state, scratch,
   activation, allocator, and browser-host memory.
7. Identify numerical corner cases: RMS normalization epsilon, accumulation
   precision, exponentials, activation approximation, convolution padding,
   state initialization, long-sequence drift, NaN propagation, denormals,
   integer overflow, and quantized dequantization order.
8. Design a public reference oracle that can emit bounded, non-secret test
   vectors for embeddings, one layer, multi-layer prefill, incremental decode,
   reset, and repeated decode. Bind each vector to source revision, tensor
   hashes, prompt-token IDs, dtype, software version, and tolerances.
9. Define differential tests among the official reference, an independent
   public backend, a future Rust native implementation, and future WASM. Cover
   exact token IDs, intermediate tensors, final logits, selected top-k logits,
   generated tokens, state hashes, and lifecycle errors.
10. Recommend tolerance policies for FP32, BF16, FP16, Q8, and lower-bit
    weights. Explain when absolute or relative error is meaningful and when
    token agreement can conceal dangerous logit drift.
11. Propose a versioned model-format extension that can represent the required
    operators and state without silently changing existing dense models.
    Include feature flags, required-operator declarations, shape bounds,
    alignment, endianness, quantization metadata, tokenizer identity, and
    forward-compatible rejection.
12. Analyze implementation choices for scalar Rust, portable SIMD, WASM SIMD,
    threads, and WebGPU. Identify which kernels need optimization only after a
    scalar oracle passes.
13. Audit source-code and model licenses separately, including attribution,
    redistribution, derivative-weight, hosted-service, and commercial-use
    questions that require authorized counsel.
14. Give a staged implementation backlog with stop rules at source audit,
    scalar oracle, native differential test, quantization, WASM parity, browser
    behavior, and performance. Express effort as variables and dependency
    order, not fabricated project estimates.

Required report structure:

1. Exact case-study identity and source hierarchy.
2. Artifact and license inventory.
3. Formal forward-pass specification.
4. Tensor and state schema.
5. Prefill, decode, reset, and cancellation state machines.
6. Memory and compute formulas.
7. Numerical-risk register.
8. Reference-oracle and test-vector format.
9. Native/WASM differential-conformance matrix.
10. Proposed portable format extension.
11. Kernel implementation and optimization sequence.
12. Fail-closed admission criteria.
13. Unknown or contradictory public facts.
14. Annotated primary-source bibliography with revisions and dates.

Do not produce a high-level architecture overview. Do not invent missing
equations, tensor names, cache behavior, API routes, or license permissions.
Do not recommend optimized SIMD or WebGPU work before a scalar reference path
has deterministic conformance evidence.

## Prompt 3: Sub-Billion Capacity Allocation, Tokenizer Economics, And Student Blueprint

You are an independent language-model architect and inference-economics
researcher. Design evidence-backed student blueprints in the 0.3B to 1.5B
range for practical local conversation, with special attention to how
vocabulary, embeddings, depth, width, attention, recurrent state, and context
consume a small parameter and memory budget.

You may inspect public model configurations, tokenizers, papers, technical
reports, model cards, training documentation, and source repositories. You
cannot inspect private TinyRustLM code, models, training records, evaluation
cases, runtime measurements, or hardware.

Product objectives and constraints:

- The model must run locally on ordinary CPUs and in browser WASM.
- Practical conversation, ambiguity handling, instruction following, current
  user precedence, source conflict, feasible fallback advice, summaries,
  rewriting, structured output, and code explanation are primary.
- Arithmetic can be delegated to a deterministic calculator.
- Long repository model IDs, tokenizer identity, chat templates, and licenses
  must remain provenance-bound.
- A smaller artifact is valuable only if useful behavior survives.
- Browser memory must include weights, runtime state, scratch space, WASM
  linear memory, JS host memory, and model-loading duplication.

Research and deliver all of the following:

1. Build a configuration matrix for current dense and hybrid models near 0.3B,
   0.6B, 1.0B, and 1.5B. Include exact revision, vocabulary, hidden size,
   layers, query heads, KV heads, head dimension, FFN size, tied embeddings,
   normalization, positional scheme, context, block type, and license.
2. Recompute parameter counts from configuration and explain discrepancies
   among advertised, exact, active, non-embedding, and rounded counts.
3. Derive parameter formulas for embeddings, output head, attention,
   feed-forward layers, norms, recurrent or convolutional blocks, and adapters.
   Show how a 32K, 64K, 100K, or larger vocabulary changes the useful
   transformer-block budget at each target size.
4. Analyze tokenizer economics. Compare reusing a large teacher tokenizer,
   training a smaller tokenizer, vocabulary pruning, multilingual coverage,
   code coverage, byte fallback, Unicode behavior, special tokens, and direct
   logit distillation compatibility.
5. Explain the trade between tied embeddings and separate input/output
   matrices. Cover quality, parameter savings, conversion, quantization, and
   teacher-student tokenizer compatibility.
6. Compare depth versus width for small students. Address optimization,
   latency, sequential layer cost, representation capacity, residual stability,
   and suitability for upper-layer or full-model adaptation.
7. Compare full multi-head attention, GQA, MQA, sliding-window attention, and
   hybrid recurrent blocks. Give KV-cache or recurrent-state formulas and
   identify quality risks for retrieval and multi-turn continuity.
8. Estimate artifact size by precision and quantization using formulas for
   metadata, scales, zero points, group sizes, tokenizer bytes, and alignment.
   Do not present estimates as measured TinyRustLM sizes.
9. Estimate peak inference memory for prompt lengths of 512, 2K, 8K, and 32K
   tokens. Separate prefill peak from steady decode and include allocator and
   host-copy uncertainty explicitly.
10. Discuss which behavior can plausibly fit at each size and which ambitions
    should be delegated to tools, retrieval, external memory, or a larger
    model. Avoid unsupported claims that a specific parameter count guarantees
    intelligence.
11. Analyze training implications: tokenizer initialization, embedding
    transfer, layer dropping, width reduction, sequence-level distillation,
    token-level KL, hidden-state matching, LoRA, full fine-tuning, and
    quantization-aware training.
12. Propose three concrete student blueprints: a minimal browser tier, a
    balanced general tier, and a higher-quality local tier. For each, provide
    a complete logical configuration, parameter derivation, memory formulas,
    training method, expected risks, and evidence needed before promotion.
13. Define a source-screen and pilot experiment that can reject each blueprint
    cheaply before full training. Require untouched outputs, unseen
    paraphrases, and explicit ordinary-helpfulness regression budgets.
14. Recommend whether one tokenizer should span all portfolio models or
    whether tokenizer diversity is worth its runtime and distillation cost.

Required report structure:

1. Executive recommendation and assumptions.
2. Public configuration and license matrix.
3. Recomputed parameter ledger.
4. Tokenizer and embedding economics.
5. Depth, width, attention, and state tradeoffs.
6. Artifact-size formulas by precision.
7. Inference-memory formulas by context.
8. Capability allocation and tool-delegation boundaries.
9. Training and initialization options.
10. Three complete student blueprints.
11. Pilot, rejection, and promotion criteria.
12. Meaningful portfolio implications.
13. Unknowns requiring local training or execution.
14. Annotated primary-source bibliography with immutable links and dates.

Do not choose a model from rounded parameter count alone. Do not ignore the
embedding and output-head share of a large vocabulary. Do not claim that a
long configured context guarantees useful long-context behavior.

## Prompt 4: Human Review, Curriculum Governance, And Contamination Control Before Training

You are an independent training-data governance lead, conversation-quality
researcher, and evaluation-contamination auditor. Design a rigorous process
for deciding whether candidate conversational records are fit to train a
compact local assistant.

You have internet access but no private records, prompts, evaluation cases,
teacher outputs, datasets, receipts, or source code. Two opaque local candidate
collections are known to exist: a small 42-record role-history set and a
larger 668-record draft set. Neither collection is authorized for training
without explicit human review. You must design the review and scaling process;
you cannot judge those unseen records.

Required behavioral goals:

- ordinary helpful conversation must dominate the corpus;
- ambiguity should produce useful clarifying questions;
- advice must honor practical resource constraints and provide feasible
  fallbacks;
- current user instructions must supersede stale profile memory;
- quoted, retrieved, or remembered instructions must be treated as untrusted
  data when appropriate;
- conflicting authorities must be acknowledged and resolved honestly;
- lawful adult questions should receive substantive, balanced treatment;
- concrete security and nonconsensual-harm boundaries should remain narrow;
- summaries, rewrites, extraction, JSON, and code explanation should be useful;
- positive examples must substantially outnumber refusals; and
- sealed evaluations and their expected answer terms must remain excluded.

Research and specify all of the following:

1. Define a versioned record schema for single-turn and multi-turn examples.
   Include source identity, license, creator or teacher identity, generation
   settings, review status, scenario family, factor values, language, role
   boundaries, assistant-loss mask, removals, supersession, and hashes.
2. Create a reviewer manual that distinguishes factual correctness,
   conversational coherence, practical feasibility, authority handling,
   current-turn precedence, memory trust, over-refusal, unsafe assistance,
   tone, completeness, and formatting.
3. Define critical failures that require rejection rather than a simple score.
   Include impossible advice, fabricated certainty, following hostile quoted
   instructions, stale-preference precedence, moralizing refusal of lawful
   adult inquiry, leaking hidden reasoning, PII, secrets, and licensing gaps.
4. Design review for the 42-record collection. State whether every record
   should receive dual review, how disagreements are adjudicated, and what
   evidence is required before any record becomes trainable.
5. Design review for the 668-record collection. Compare full review,
   risk-stratified review, random sampling, and active-learning triage. Give
   statistical formulas for estimating defect prevalence and explain when a
   sample is insufficient to authorize the unreviewed remainder.
6. Specify blinded reviewer calibration, gold and counterexample items,
   inter-rater agreement, drift checks, reviewer fatigue limits, and handling
   of systematic disagreement about lawful adult content or narrow safety
   boundaries.
7. Define repair policy. Compare rejecting a record, minimally editing it,
   regenerating from the same factors, obtaining a second teacher answer, or
   preserving it as a negative preference example. Require lineage from every
   derived record back to the original without overwriting history.
8. Design scenario-factor generation that teaches general rules rather than
   memorized wording. Include entity substitution, unit changes, resource
   availability, authority order, discourse style, explicit and implicit
   negation, quoted attacks, multi-turn state changes, and counterfactuals.
9. Define hard negatives and preference pairs without turning bad outputs into
   dominant training content. Explain which failures are suitable for DPO or
   ORPO and which should be removed entirely.
10. Specify contamination detection across exact normalization, Unicode,
    character n-grams, token n-grams, semantic neighbors, template families,
    entity-substituted overlap, expected-answer overlap, public benchmarks,
    and teacher memorization.
11. Design a sealed-holdout exclusion registry. Bind generator version, seed,
    template family, private prompt hash, expected-term hash, exclusion reason,
    and deletion lineage without exposing holdout content to training workers.
12. Define curriculum targets for a 1K pilot, a 10K validation corpus, and a
    100K-plus training corpus. Give ranges and rationale rather than asserting
    one universal optimum.
13. Define teacher-generation controls: ensemble disagreement, sampling,
    deterministic replay, hidden-reasoning exclusion, factual verification,
    malicious policy artifacts, PII, license, and deletion requests.
14. Specify auditable trainable-set promotion. Require immutable manifests,
    record hashes, reviewer identities or pseudonyms, approval thresholds,
    removal manifests, and a reproducible assistant-only loss mask.
15. Define stop rules for excessive defect rate, inadequate ordinary-chat
    coverage, reviewer disagreement, contamination, license uncertainty, and
    failure of a small pilot to improve unseen behavior.

Required report structure:

1. Governance principles and explicit assumptions.
2. Versioned record and provenance schema.
3. Reviewer manual and critical-failure taxonomy.
4. Exact protocol for the opaque 42-record set.
5. Exact protocol for the opaque 668-record set.
6. Sampling statistics and inter-rater analysis.
7. Repair, rejection, preference, and deletion lineage.
8. Scenario-factor and curriculum design.
9. Contamination threat model and controls.
10. Teacher-generation and factual-review controls.
11. Trainable-manifest promotion gate.
12. Pilot design and stop rules.
13. Unknowns requiring inspection of private records.
14. Annotated primary-source bibliography with dates.

Do not authorize unseen records. Do not assume that an LLM judge replaces
human semantic review. Do not train on sealed failures, expected terms, or
paraphrases of private evaluations. Do not silently repair a record and erase
the source failure.

## Prompt 5: Quantization-Aware Distillation And Behavioral Fidelity Across Native And Browser Runtimes

You are an independent model-compression scientist and numerical-reliability
engineer. Determine how a compact student can be quantized for CPU and browser
execution without treating small perplexity changes or successful file loading
as proof that useful conversational behavior survived.

You may inspect primary quantization papers, official framework documentation,
reference implementations, model cards, tokenizer documentation, and public
runtime code. You cannot inspect private `.slm` files, TinyRustLM converters,
local models, raw outputs, evaluations, or hardware.

Fixed constraints:

- The target range is approximately 0.3B to 1.5B parameters.
- Candidate architectures may be dense attention or documented hybrids.
- The product needs native CPU and browser WASM behavior.
- Raw output may not be repaired, retried until attractive, or completed by a
  postprocessor before scoring.
- Source, adapted model, merged model, quantized artifact, and final `.slm`
  are different evidence subjects.
- Model bytes, tokenizer, template, converter, runtime, sampling profile, and
  evaluator must be cryptographically bound.

Research and address all of the following:

1. Compare current post-training and training-aware methods relevant to small
   local models: symmetric and asymmetric weight-only quantization, per-tensor,
   per-channel and groupwise schemes, GPTQ, AWQ, SmoothQuant, activation-aware
   methods, mixed precision, QLoRA, quantization-aware fine-tuning, and full
   quantization-aware training.
2. Distinguish methods that require calibration activations, Hessian
   approximations, representative prompts, teacher logits, trainable fake
   quantization, or architecture-specific kernels.
3. Explain which tensors are usually fragile in small language models:
   embeddings, output head, attention projections, FFN gates, norms, recurrent
   state transitions, convolution kernels, and small outlier channels. Support
   claims with primary evidence and mark architecture-specific unknowns.
4. Analyze quantization of hybrid models separately. Cover recurrent-state
   precision, accumulated drift, convolution history, gating saturation,
   attention KV precision, reset behavior, and mixed attention/recurrent
   blocks.
5. Compare pipelines: train then PTQ; SFT then PTQ; distill then PTQ; PTQ then
   adapter tuning; quantization-aware SFT; quantization-aware distillation; and
   teacher-student training directly against the deployment precision.
6. Define calibration-data requirements without contaminating evaluation.
   Include sequence lengths, languages, code, JSON, ordinary dialogue,
   practical constraints, and outlier coverage. Explain why private holdouts
   and their paraphrases must not enter calibration.
7. Design a precision matrix covering BF16 or FP16 reference, Q8, Q6, Q5, Q4,
   and any mixed formats supported by public evidence. Specify group size,
   scale dtype, zero-point policy, accumulator precision, and tensors exempted
   from low-bit quantization.
8. Derive artifact-size and runtime-memory formulas, including quantization
   metadata, alignment, dequantization scratch, duplicated load buffers,
   recurrent state or KV cache, WASM pages, and JS host copies.
9. Define numerical conformance checks from source framework to merged model,
   converter output, native runtime, WASM runtime, and browser rendering.
   Include token IDs, selected logits, top-k rank, KL or Jensen-Shannon drift,
   generated token agreement, NaN checks, and state reset.
10. Define behavioral fidelity tests for ordinary helpfulness, ambiguity,
    current preference, source authority, unavailable resources, hostile
    memory, summaries, rewrites, JSON, and code. Use unseen paraphrases and
    preserve untouched outputs.
11. Recommend repeated-seed statistics and regression budgets. Separate
    deterministic precision drift from sampling variance and infrastructure
    flakiness.
12. Define performance measurements for model load, first token, prefill,
    decode, peak memory, steady state, context growth, UI long tasks, energy,
    and thermal throttling. Require physical devices for claims about them.
13. Design a content-addressed receipt graph for reference weights, adapter,
    merged weights, quantization configuration, calibration manifest,
    converter, `.slm`, runtimes, cases, raw outputs, and decisions.
14. Define stop rules for a quantization tier that loads and runs but loses
    practical behavior, structured-output validity, numerical stability, or
    ordinary helpfulness.
15. Recommend whether several precisions of one checkpoint count as useful
    deployment tiers, catalog diversity, or both. Prevent relabeled or
    behaviorally identical bytes from becoming catalog theater.

Required report structure:

1. Executive recommendation and assumptions.
2. Quantization-method comparison.
3. Tensor-sensitivity and hybrid-state analysis.
4. Training and distillation pipeline comparison.
5. Calibration-data contract.
6. Precision and kernel matrix.
7. Artifact-size and memory formulas.
8. Numerical conformance suite.
9. Behavioral fidelity and statistical design.
10. Native/browser performance methodology.
11. Receipt and provenance graph.
12. Promotion thresholds and stop rules.
13. Unknowns requiring local models or hardware.
14. Annotated primary-source bibliography with revisions and dates.

Do not recommend a quantization from file size or perplexity alone. Do not use
evaluation prompts as calibration data. Do not call a converted artifact
qualified merely because it loads, produces tokens, or passes a structural
validator.

## Prompt 6: Preregistered Build, Port, Distill, Or Continue-Searching Decision Campaign

You are an independent principal research-program director, decision scientist,
and release-evidence architect. Design a preregistered campaign that decides
where the next unit of TinyRustLM engineering and compute effort should go:
continue screening dense source models, distill a dense student, implement a
hybrid architecture, use a maintained external backend, improve training data,
or improve evaluation first.

You may inspect public model repositories, papers, model cards, framework
documentation, standards, package registries, and public project pages. You
cannot inspect private TinyRustLM code, candidate outputs, datasets, receipts,
credentials, machines, or production services.

Fixed campaign principles:

- Public research and vendor claims can nominate experiments but cannot pass a
  private product gate.
- Source models must pass untouched behavioral screening before conversion or
  expensive adaptation.
- Evaluation prompts and expected answers must remain sealed from training.
- Partial success is useful evidence but not completion.
- A model portfolio must contain meaningful behavioral or operational
  diversity, not aliases or renamed copies.
- The final product target includes 20 distinct useful artifacts, but quality
  thresholds cannot be lowered to reach that number.
- Browser, memory, P2P, external proof, and publication evidence are separate
  release phases and cannot be inferred from model quality.

Research and specify all of the following:

1. Define the mutually exclusive strategic hypotheses. At minimum include:
   a qualified dense source already exists; dense behavioral distillation is
   the best route; tokenizer or capacity allocation is the main bottleneck;
   hybrid architecture offers material deployment advantage; an external
   backend dominates a new native port; training-data quality is the limiting
   factor; and the evaluator is too weak to support a decision.
2. For each hypothesis, list observable predictions, falsifying evidence,
   public evidence available now, evidence requiring local execution, and the
   cost of a false positive or false negative.
3. Build a dependency graph showing which work is invalid if an earlier gate
   fails. For example, source quality should precede a new converter, and a
   scalar numerical oracle should precede architecture optimization.
4. Design a source-candidate funnel from discovery through immutable revision
   pinning, license review, acquisition, untouched screening, conversion,
   native evaluation, quantization, browser evaluation, and promotion.
5. Define how many source candidates, scenario families, cases, paraphrases,
   seeds, and human reviews are justified at each stage. Use power, confidence,
   defect-prevalence, or value-of-information formulas rather than arbitrary
   round numbers.
6. Preregister behavioral invariants, critical failures, ordinary-helpfulness
   regression budgets, stochastic seed policy, and human adjudication before
   candidate outputs are seen.
7. Design the minimum experiment that can justify or reject a hybrid runtime
   investment. Include exact source quality, license, operator documentation,
   scalar oracle, native parity, and measured advantage gates.
8. Design the minimum experiment that can justify or reject a dense
   distillation investment. Include teacher screening, data review, a small
   assistant-only SFT or sequence-distillation pilot, sealed holdouts, and a
   no-improvement stop rule.
9. Design the minimum experiment that can justify an external backend. Include
   portability, browser feasibility, binary and license boundaries, supply
   chain, deterministic conformance, sandboxing, update burden, and fallback.
10. Compare sequential decision methods, Bayesian updating, confidence
    intervals, alpha spending, and expected value of information. Recommend a
    method understandable to operators and auditors.
11. Construct a resource model in variables: researcher hours, reviewer hours,
    CPU hours, GPU hours, RAM, VRAM, storage, network transfer, artifact count,
    and recurring maintenance. Do not invent local throughput or hardware
    availability.
12. Define pause and stop rules for quality failure, license ambiguity,
    unsupported architecture, evaluator defect, contamination, unavailable
    compute, numerical mismatch, quantization regression, browser OOM, and
    maintenance cost.
13. Define retry rules that prevent trying new seeds, templates, temperatures,
    or postprocessors until a preferred answer appears. Distinguish a declared
    product sampling policy from best-of-N cherry-picking.
14. Design an evidence graph in which acquisition, source screen, training,
    conversion, evaluation, quantization, browser, memory, P2P, and publication
    receipts are independently invalidated by the inputs that changed.
15. Give staged routes to 1, 5, and 20 useful artifacts. Distinguish source
    families, task-specialized variants, independently trained checkpoints,
    precision tiers, and catalog theater.
16. Define the point at which further public research has lower expected value
    than local execution, human data review, hardware recovery, contract work,
    or authorized licensing review.
17. Produce a final decision worksheet an operator can fill in without seeing
    private prompts or leaking secrets into a report.

Required report structure:

1. Executive strategic recommendation.
2. Hypothesis and falsification matrix.
3. Dependency and invalidation graph.
4. Source-candidate funnel.
5. Preregistered behavioral and statistical plan.
6. Minimum hybrid-runtime experiment.
7. Minimum dense-distillation experiment.
8. Minimum external-backend experiment.
9. Resource and value-of-information model.
10. Stop, retry, rollback, and escalation rules.
11. Content-addressed evidence design.
12. Routes to 1, 5, and 20 useful artifacts.
13. Operator decision worksheet.
14. Unknowns requiring local or authorized access.
15. Annotated primary-source bibliography with dates.

Do not answer with a generic roadmap. Do not recommend implementing every
architecture in parallel. Do not turn missing evidence into a pass, mocks into
live proof, cross-compilation into executed hardware evidence, or a catalog
target into permission to lower model quality.

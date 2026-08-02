# Six Disconnected-Agent Research Prompts for TinyRustLM Model Quality

These six prompts are independent. Give one complete prompt to each research agent. The agents have internet access but no access to the TinyRustLM source tree, private artifacts, local models, desktops, test fixtures, or prior internal reports.

Completed reports belong in:

`E:\Source\Rust\TinyRustLM.com\agent-file-handoff\Improvement\`

The prompt file is provenance, not evidence. A report must not claim that TinyRustLM implements or passes anything it could not directly observe on a public website.

## Prompt 1: Model Architecture and Source-Checkpoint Pareto Frontier

You are an independent small-language-model architecture researcher. Produce a deeply technical, current report titled **"TinyRustLM Model Architecture and Source-Checkpoint Pareto Frontier"**. You have no access to private source code, local files, model artifacts, desktops, private benchmarks, or internal reports. You may inspect public websites, including `https://tinyrustlm.com/`, `https://minimodel.org/`, `https://uaix.org/`, and official model, paper, repository, and standards pages. Treat public TinyRustLM pages as product context, not implementation proof.

The objective is to determine which publicly obtainable base or instruct checkpoints, architecture families, and adaptation paths are most likely to produce genuinely useful browser-local conversation and common-sense behavior at a reasonable footprint. Prioritize coherent conversation, practical judgment, instruction following, clarification only when needed, multi-turn state, source-grounded transformation, code explanation, structured output, and lawful adult assistance. Arithmetic is secondary because a deterministic calculator can handle serious math. Do not optimize the shortlist around benchmark math or broad refusal/safety scores. The behavioral posture should be compatible with the UAIX Cognitive Liberty Charter: direct help for lawful adult requests, with narrow transparent boundaries for concrete harm. This behavioral priority does not weaken credential, model-file, provenance, or prompt-injection security.

Research current releases as of the day you run the report. Do not assume model families named in older articles remain state of the art. Use primary sources wherever possible: official model cards, immutable repository revisions, technical reports, papers, tokenizer/config files, official licenses, and authoritative runtime documentation. Record publication date, exact model ID, revision or commit when available, parameter count, architecture, context limit, vocabulary, tokenizer family, chat template, license, redistribution rights, derivative-model obligations, and commercial-use constraints. Distinguish measured fact, model-card claim, inference, and recommendation.

Evaluate dense decoder-only transformers, recurrent/state-space or hybrid models, sparse or mixture-of-experts candidates where relevant, and any new sub-2B architecture with credible local-inference evidence. Do not recommend an architecture merely because it has fewer active parameters; account for total stored weights, routing/operator complexity, cache behavior, browser kernel availability, and conversion risk. For every serious candidate, analyze:

- depth, hidden width, attention heads, key/value heads, head dimension, MLP expansion, activation, normalization, positional encoding, tied embeddings, output head, and weight sharing;
- operator compatibility risks for a conservative Rust/WASM runtime;
- parameter bytes at f32, bf16/f16, int8, 6-bit, 5-bit, and 4-bit before container overhead;
- expected KV-cache bytes per token by context length and cache dtype;
- tokenizer and chat-template fragility, multilingual effects, and special-token requirements;
- likely quality loss from converting to a portable blockwise format;
- CPU/WASM prefill and decode implications, including GQA/MQA, bandwidth pressure, and working-set peaks;
- source-model conversational evidence, common-sense weaknesses, over-refusal tendencies, repetition, hallucinated capabilities, and susceptibility to stale or injected memory;
- license and redistribution fit for `.slm`, MiniModel metadata, P2P sharing, NuGet wrappers, and an optional future Hugging Face mirror.

Build a Pareto table with at least three explicit footprint classes: compact, balanced, and quality-first. Give exact formulas for estimated artifact size, KV cache, dequantization scratch, and peak resident memory. State all assumptions. Include at least two candidates per class when credible evidence exists, plus a rejected-candidate table explaining why attractive models fail the product priorities.

Compare four strategies: use an instruction checkpoint unchanged; behaviorally fine-tune an instruction checkpoint; continue pretraining then instruction-tune; and train a purpose-built tiny model from scratch. Quantify likely data, token, compute, engineering, and quality risk. Explain when training from scratch is rational and when it is likely to waste compute versus distillation from a stronger source.

Design a source-screening protocol that runs before conversion or quantization. It must include fixed, seeded-paraphrase, multi-turn, practical-constraint, ambiguity, instruction-conflict, memory-conflict, untrusted-context, lawful-adult, summarization, rewriting, JSON, code, capability-honesty, repetition, and tool-routing cases. Specify raw-output capture, prompt/template/token identity, sampling controls, human rubric, rejection thresholds, and stop rules. A source failure must block conversion.

Do not cheat. Do not propose expected-answer lookup, prompt-string branches, benchmark-specific wrappers, hidden retries, answer repair, output assembly, evaluator exceptions, cherry-picked seeds, or test-to-training leakage. Do not treat a model card, leaderboard, synthetic demo, or public UI smoke as assistant-quality proof.

Required report sections:

1. Executive recommendation and confidence.
2. Current primary-source landscape and search date.
3. Architecture comparison with equations and memory budgets.
4. Candidate Pareto tables and license analysis.
5. Source-behavior screening protocol.
6. From-scratch versus adaptation decision analysis.
7. Conversion/runtime compatibility risks.
8. Falsifiable experiment matrix with go/no-go thresholds.
9. Failure modes and rejected shortcuts.
10. Ranked next actions for TinyRustLM.
11. Direct source URLs, access dates, and an evidence-quality table.

Save the completed report as `TinyRustLM Model Architecture and Source Checkpoint Pareto Frontier.md`.

## Prompt 2: Behavioral Corpus, Curriculum, and Data Governance

You are an independent language-model data and curriculum researcher. Produce a deeply technical, current report titled **"TinyRustLM Behavioral Corpus and Curriculum Engineering"**. You have internet access but no private code, files, models, datasets, desktops, or internal benchmark results. You may inspect the public TinyRustLM, MiniModel, UAIX, and MemoryEndpoints sites and primary research sources. Do not infer private implementation from those sites.

The objective is to design a provenance-safe training corpus and curriculum that can make a 0.3B-1.5B local model materially better at conversation, common sense, practical judgment, instruction following, multi-turn continuity, clarification, source-grounded writing, JSON/extraction, code explanation, tool routing, and lawful adult assistance without turning the model into a canned refusal engine. Mathematics should be a small corruption/tool-routing slice, not the dominant objective; difficult arithmetic can be delegated to a deterministic calculator. The policy target follows the UAIX Cognitive Liberty Charter: help lawful adults directly and use narrow, concrete-harm boundaries. Security-oriented prompt-injection, credential, and capability-honesty cases remain required.

Research current high-quality open or redistributable instruction datasets, dialogue datasets, educational and common-sense sources, tool-use data, synthetic-data methods, data filtering systems, and license/provenance practices. Prefer dataset cards, primary papers, official repositories, and original licenses. For every proposed source, record owner, exact revision/snapshot, license, commercial and derivative constraints, personal-data risk, deletion obligations, language/domain composition, conversation structure, quality caveats, and whether generated derivatives may be redistributed.

Design a data ontology with explicit families and measurable coverage. At minimum cover greetings and normal conversation; underspecified requests; practical household/work/travel/consumer judgment; temporal and conditional reasoning; instruction priority; source conflicts; multi-turn corrections and preferences; memory conflicts where current user intent supersedes stale profile data; untrusted retrieved content; lawful adult questions; narrow concrete-harm boundaries and benign neighbors; uncertainty; summarization; rewriting; extraction; JSON; code explanation; calculator/tool routing; and capability honesty. Define positive-helpful versus refusal ratios and explain how to prevent apology, disclaimer, policy, and incapability language from leaking into ordinary answers.

Specify a row-level schema with stable record ID, source identity, source revision, source row locator, license, transformation chain, prompt, role-structured messages, target answer, behavioral family, language, difficulty, current-versus-stale authority, tool expectation, sensitive-content class, review status, split, semantic-cluster ID, template-family ID, and every transform hash. Include an example manifest and lineage graph. A source-removal operation must deterministically identify all derivatives.

Develop exact, normalized, n-gram, MinHash or locality-sensitive, embedding-neighbor, template-family, and conversation-lineage deduplication. Explain thresholds, false-positive review, and how to prevent semantic siblings from crossing train, development, shadow, sealed, and human-review splits. Include contamination checks against common public benchmarks and project-specific evaluations. Do not use benchmark prompts, paraphrases, answer facts, or evaluator feedback as training data.

Design curriculum phases and mixture weights. Address sequence length, packed examples, assistant-only versus full-conversation loss, system-prompt diversity, chat-template canonicalization, multilingual balance, easy-to-hard ordering, rehearsal, high-authority instruction scarcity, positive-helpful dominance, adversarial-memory examples, and calculator sparsity. Provide initial pilot scale, minimum credible production scale, and mature scale as planning ranges with rationale. Record expected unique tokens, examples, epochs, and overfitting signals rather than asserting that record count alone creates quality.

Analyze synthetic data rigorously. Compare single-teacher generation, multi-teacher disagreement, rejection sampling, critique/rewrite, self-consistency, verifier-backed generation, human review, and active-learning queues. Specify how factual, cultural, medical, legal, current-event, and safety-critical claims are flagged for authoritative checking. Define immutable draft receipts and ensure unreviewed teacher output has no training authority.

Create linguistic audits for refusal phrases, apologies, disclaimers, false capability claims, policy echoes, hidden-reasoning markers, generic filler, repeated openings, verbosity drift, unsupported certainty, system-prompt leakage, encoding corruption, and style collapse. Give formulas and per-family thresholds. Define how a small model's limited capacity changes the mixture: which behaviors must be internalized, which should be handled by tools or memory, and which should remain outside the model.

Do not cheat. No expected-answer maps, benchmark patch rows, rigid first-sentence templates, mandatory keywords, evaluation leakage, automatic human approval, hidden output repair, or retroactive case exemptions are allowed.

Required report sections:

1. Executive corpus strategy.
2. Source inventory with revisions and license matrix.
3. Behavioral ontology and target mixture.
4. Record schema, manifests, and deletion lineage.
5. Deduplication and contamination algorithms.
6. Curriculum, sequence, and loss-mask design.
7. Synthetic generation and human-review workflow.
8. Linguistic and policy leakage audits.
9. Pilot-to-production scale and compute estimates.
10. TDD-style data validators and failure fixtures.
11. Ablation matrix and measurable stop rules.
12. Primary-source bibliography with access dates.

Save the completed report as `TinyRustLM Behavioral Corpus and Curriculum Engineering.md`.

## Prompt 3: Distribution Distillation and Compact-Model Training

You are an independent knowledge-distillation and compact-model training researcher. Produce a deeply technical, current report titled **"TinyRustLM Distribution Distillation and Compact Training Strategy"**. You have internet access but cannot inspect private code, local GPUs, artifacts, datasets, or internal evaluations. Public product sites provide constraints only. Use current primary papers, official repositories, framework documentation, and model cards. Clearly separate established results, model-card claims, inference, and recommendation.

The objective is to transfer useful conversational reasoning and common-sense behavior from one or more strong teachers into a browser-local 0.3B-1.5B student while preserving a reasonable artifact and working-set footprint. Optimize for direct, coherent conversation, practical judgment, instruction following, multi-turn state, transformations, structured output, code explanation, memory conflicts, and cognitive-liberty-compatible lawful adult help. Math should remain a sparse correctness/tool-routing family. Avoid training a generalized refusal voice; preserve narrow concrete-harm boundaries and strong credential/prompt-injection security.

Compare response-level distillation, supervised instruction tuning, sequence-level knowledge distillation, token-distribution KL distillation, reverse KL, Jensen-Shannon or other divergence choices, top-k teacher-logit caching, rank-based objectives, hidden-state/attention transfer, preference optimization, rejection sampling, on-policy distillation, self-distillation, and quantization-aware distillation. Explain which methods are realistic for different student/teacher tokenizer relationships and compute budgets.

For matched-tokenizer top-k distillation, derive the loss in detail. Specify temperature scaling, teacher and student log-softmax, top-k token uniqueness/order, residual tail mass, treatment of the non-top-k vocabulary, normalization error, precision of cached logits, and a numerically stable implementation. Compare alternatives: uniform residual tail, student-proportional tail, sampled tail, low-rank logit compression, and sparse probability storage. Quantify cache bytes as a function of target tokens, k, token-ID width, logit dtype, metadata, checksums, and compression. Define corruption tests for NaN/Inf, duplicate IDs, wrong order, negative residual mass, tokenizer drift, truncated rows, and split leakage.

For cross-tokenizer distillation, explain alignment options and why naive token-index KL is invalid. Evaluate text-level sequence distillation, word/span alignment, optimal-transport or vocabulary-mapping approaches, teacher sampling with student retokenization, hidden representation projection, and teacher-verifier loops. State which approach you recommend and what quality is lost compared with a matched tokenizer.

Design a fair training matrix comparing full fine-tuning, LoRA, upper-layer LoRA, DoRA or current alternatives, preservation-aware adapters, QLoRA-style training, and full supervised plus KL objectives. Include parameter counts, trainable bytes, optimizer-state bytes, activation memory, gradient accumulation, checkpoint size, and estimated compute. Give equations and example budgets for at least three student sizes. Explain when adapters are inadequate because the source behavior or capacity is wrong.

Address catastrophic forgetting and behavior preservation. Specify rehearsal mixtures, frozen reference loss, KL on general data, layer freezing, learning-rate schedules, curriculum stages, checkpoint selection, and how to prevent a small charter/boundary subset from dominating normal language. Compare one strong teacher, teacher ensembles, routed specialists, teacher disagreement, and verifier-based arbitration. Teacher responses and logits must be immutable, provenance-bound, and physically separated from evaluation sets.

Include quantization-aware distillation and post-training quantization handoff. Analyze fake quantization placement, scale learning, straight-through estimators, per-group simulation, outlier protection, precision curricula, and when to distill directly into a q4/q5-aware student versus train in higher precision and quantize later. Do not assume a quantization method works in browser Rust/WASM merely because a Python library supports it.

Define raw behavioral and distributional evaluation at each phase: source teacher, frozen student, SFT student, KL student, adapter-disabled oracle, f32 export, q8 export, mixed precision, native runtime, WASM, and browser. Preserve raw one-call output and full or sampled logit witnesses. A failed source student must not be rescued by prompt tricks or postprocessing.

Provide stop rules. Examples: stop an adapter family after materially different recipes repeat the same critical failures; stop scaling synthetic data when shadow/sealed quality plateaus or language leakage worsens; reject a teacher cache on any split or tokenizer drift; do not open sealed cases for tuning.

Do not cheat. No expected-answer branches, benchmark-specific data, hidden retries, output repair, second-model answer assembly, evaluator feedback training, seed cherry-picking, or unreported teacher filtering.

Required report sections:

1. Executive recommendation by student/teacher scenario.
2. Distillation objective taxonomy with equations.
3. Matched-tokenizer top-k cache specification.
4. Cross-tokenizer alternatives and decision.
5. Training method and resource matrix.
6. Preservation, curriculum, and teacher arbitration.
7. Quantization-aware distillation plan.
8. Immutable data/cache/checkpoint schemas.
9. TDD tests for losses, caches, masks, resume, and export.
10. Experiment grid, promotion thresholds, and stop rules.
11. Failure analysis and rejected shortcuts.
12. Primary-source bibliography with dates and versions.

Save the completed report as `TinyRustLM Distribution Distillation and Compact Training Strategy.md`.

## Prompt 4: Mixed-Precision Quantization and Extreme Footprint Reduction

You are an independent neural-network quantization and compression researcher. Produce a deeply technical, current report titled **"TinyRustLM Mixed-Precision Quantization and Browser Footprint Reduction"**. You can use public internet sources but have no private source, local model, runtime, artifact, benchmark, or desktop access. Use official papers, model cards, framework repositories, file-format documentation, and browser/runtime standards. Do not claim that a method is implemented or works in TinyRustLM unless public evidence directly proves it.

The objective is to reduce a useful instruction model into a portable `.slm`-style browser artifact without destroying conversation, common sense, instruction priority, multi-turn state, structured output, code explanation, lawful adult directness, or memory-conflict behavior. The target is not the smallest file at any cost. Produce a quality/footprint Pareto plan with compact, balanced, and quality-first profiles. Account for artifact bytes, browser transfer/staging copies, WASM linear memory, dequantization scratch, KV cache, tokenizer, metadata, and peak resident memory.

Survey current post-training and training-aware methods: symmetric/asymmetric int8; int6/int5/int4; per-tensor, per-channel, per-row, per-group, and blockwise scaling; zero points; outlier channels; mixed precision; GPTQ; AWQ; HQQ; AutoRound; SmoothQuant where relevant; activation-aware or second-order methods; sparse/outlier decompositions; codebooks; nonuniform quantization; weight clustering; low-rank residuals; activation quantization; KV-cache quantization; and current advances published by the report date. Distinguish offline search/calibration from the runtime encoding that a conservative Rust/WASM engine would actually execute.

Derive storage formulas for each candidate encoding, including scale/zero-point overhead, group size, alignment/padding, tensor directory, checksums, tokenizer, quality sidecar, and container metadata. Provide worked examples for representative 0.5B, 0.6B, 1B, and 1.5B models. Include tied versus untied LM head and embedding effects. Calculate KV bytes per token for f32/f16/int8/int4 and multiple context lengths.

Design a sensitivity-driven mixed-precision search. At minimum evaluate embeddings, output head, norms, first and last blocks, Q/K/V/O projections, MLP gate/up/down projections, and any architecture-specific recurrent/state-space tensors. Compare one-family-at-a-time restoration, Hessian or Fisher approximations, activation statistics, outlier scores, logit error attribution, and greedy search under a byte budget. State how to avoid overfitting the precision map to a tiny calibration set.

Calibration data must represent actual target behavior: ordinary conversation, practical constraints, ambiguity, multi-turn corrections, instruction conflicts, untrusted retrieved text, lawful adult questions, transformations, JSON, code, repetition, long context, and tool routing. Explain dataset size, token sampling, activation capture, sequence length, and train/eval separation. Math-only and perplexity-only calibration are insufficient.

Define fidelity gates that go beyond perplexity and first-token argmax. Require complete-logit or sampled-full-vector error, centered cosine, KL/Jensen-Shannon divergence, top-k overlap and rank correlation, teacher-forced divergence across multiple steps, free-generation agreement, stop-token behavior, repetition, raw behavioral scores, and blinded human usefulness. Attribute errors across source model, f32 conversion, q8, lower-bit profile, native kernel, WASM kernel, and browser orchestration. Give thresholds as starting hypotheses and explain how to calibrate them rather than presenting arbitrary numbers as standards.

Analyze runtime costs. For each method discuss scalar Rust complexity, SIMD feasibility, odd-dimension/tail handling, unpack bandwidth, cache locality, scale loads, accumulator width, overflow, deterministic reduction order, WASM SIMD support, WebGPU portability, and fallback behavior. Reject methods whose compression benefit is erased by large lookup tables, slow unpacking, unsupported operators, or duplicate staging memory.

Evaluate complementary footprint methods: vocabulary/tokenizer reduction, embedding factorization, layer dropping, width/depth pruning, structured sparsity, low-rank factorization, distillation into a smaller architecture, shared layers, recurrent/hybrid architectures, KV compression, and context policy. Explain which require retraining and which threaten broad language or behavioral coverage. Do not recommend vocabulary pruning without a reversible coverage and regression plan.

No cheating is allowed. Do not tune precision against sealed answers, exempt failed cases, use browser postprocessing to hide damage, repair outputs, select only lucky seeds, or claim source weakness is quantization damage. A source failure blocks compression promotion.

Required report sections:

1. Executive Pareto recommendation.
2. Current method survey with primary citations.
3. Exact storage and working-memory equations.
4. Portable encoding candidates and Rust/WASM kernel implications.
5. Calibration and tensor-sensitivity search.
6. Fidelity and behavioral gate specification.
7. KV/context and non-quantization compression options.
8. Profile tables for compact, balanced, and quality-first tiers.
9. TDD kernel/packer/validator tests and malformed fixtures.
10. Ablation matrix, stop rules, and rollback.
11. Rejected methods and reasons.
12. Source/version/license bibliography.

Save the completed report as `TinyRustLM Mixed Precision Quantization and Browser Footprint Reduction.md`.

## Prompt 5: Source-to-WASM Numerical Fidelity, Decoding, and Context Quality

You are an independent inference-runtime and generation-quality researcher. Produce a deeply technical, current report titled **"TinyRustLM Source-to-WASM Fidelity and Decoding Quality"**. You have public internet access but no private code, binaries, models, browser automation, local artifacts, or internal tests. You may inspect public TinyRustLM/MiniModel/UAIX/MemoryEndpoints pages and primary framework, paper, model, tokenizer, and web-platform sources. Public UI behavior is observation only, not proof of internal architecture.

The objective is to construct a causal diagnostic and implementation plan for cases where a model behaves adequately in its reference framework but poorly after conversion, quantization, native Rust execution, WASM execution, or browser integration. Quality means coherent conversation, common sense, instruction following, practical judgment, multi-turn continuity, transformations, JSON, code explanation, lawful adult assistance, and correct memory/tool use. Arithmetic is secondary except as a corruption probe or calculator-routing decision.

Build an end-to-end fidelity map from immutable upstream checkpoint to rendered prompt, token IDs, f32 reference logits, converted tensor directory, native scalar logits, optimized native logits, WASM logits, sampled token IDs, decoded bytes, presentation text, and multi-turn state. For each boundary, identify required hashes, diagnostics, and independent oracles.

Cover tokenizer and prompt-template fidelity in detail: normalization, pretokenization, byte fallback, BPE/SentencePiece/Unigram behavior, added tokens, token-ID ordering, BOS/EOS/PAD/UNK roles, chat control tokens, role separators, generation prompts, whitespace, Unicode, UTF-8 streaming, special-token suppression, truncation side, and exact prompt-byte capture. Explain tests for tokenization parity and template drift.

Cover model math: tensor names/shapes/layouts, tied weights, RMSNorm/LayerNorm epsilon, RoPE base/scaling/interleaving, GQA/MQA head mapping, causal masks, sliding windows, activation functions, residual order, attention scaling, softmax stability, quantized deprojection, accumulator precision, reduction order, and KV-cache layout/precision. Include architecture-specific risks for current sub-2B models discovered during research.

Cover generation and sampling rigorously. Derive temperature, top-k, top-p, min-p if recommended, repetition/frequency/presence penalties, logit bias, seeded PRNG, deterministic ties, and stable sorting. Specify behavior for NaN, positive infinity, negative infinity as an explicit suppression sentinel, all-suppressed distributions, underflow, zero mass, and malformed logits. Explain how sampling defaults should be bound to model metadata without making the model appear better through benchmark-specific presets.

Analyze quality failures caused by EOS handling, premature stopping, runaway repetition, stop strings, maximum token limits, context truncation, role leakage, prompt echoes, sentence fragments, invalid JSON, and stale KV state. Distinguish legitimate decoding policy from output repair. The runtime may reject malformed or unusable output, but it must not fabricate answer content, look up expected answers, silently call a second model, or assemble benchmark-specific fields.

Develop a compact context and memory strategy for tiny models. Analyze system prompt size, conversation-window allocation, deterministic retrieval ranking, deduplication, supersession, current-intent versus stale-memory authority, untrusted-memory fencing, prompt-injection resistance, persona preservation, and token budgets. Compare raw transcript stuffing, rolling summaries, structured UAIX records, retrieved facts, and tool-state records. Give an information-budget method that selects context without allowing memory text to authorize tools, credentials, or policy changes.

Address browser execution quality: main-thread versus worker ownership, whole-file transfer copies, streaming/chunked loading, OPFS/IndexedDB roles, preflight memory budgets, cancellation, restart, multi-tab coordination, SIMD capability, WebGPU device loss, cross-browser fallback, and last-known-good rollback. Focus on how these mechanisms can corrupt or silently change model state, not only speed.

Design a differential test pyramid. Include tiny analytic vectors, layer probes, full-logit goldens, multiple teacher-forced steps, free generation, reset/reload soak, context-growth tests, seed replay, native/WASM/browser comparisons, malformed `.slm`, invalid sampling, cache corruption, and browser lifecycle tests. Provide a fault tree that uses the first failing boundary to attribute source weakness, conversion drift, quantization drift, kernel drift, sampler drift, context error, or presentation duplication.

Do not cheat. No expected-answer tables, prompt-specific branches, hidden retries, output rewriting, field synthesis, benchmark exemptions, seed shopping, or silent backend fallback may satisfy a quality gate.

Required report sections:

1. Executive failure-attribution strategy.
2. End-to-end evidence and hash chain.
3. Tokenizer/chat-template parity specification.
4. Operator, layout, numerical, and KV fidelity risks.
5. Stable sampler and malformed-logit specification.
6. Stop/repetition/structured-output boundaries.
7. Tiny-model context and memory packing.
8. Browser lifecycle and capability matrix.
9. Differential TDD pyramid and golden fixtures.
10. Diagnostic schema and causal fault tree.
11. Promotion thresholds and no-silent-fallback rules.
12. Primary-source bibliography with versions and dates.

Save the completed report as `TinyRustLM Source to WASM Fidelity and Decoding Quality.md`.

## Prompt 6: No-Cheat Conversational Evaluation and Release Science

You are an independent model-evaluation and release-science researcher. Produce a deeply technical, current report titled **"TinyRustLM No-Cheat Conversational Evaluation and Release Gates"**. You have internet access but cannot inspect private code, local models, hidden evaluation cases, desktops, artifacts, or internal results. Public websites may establish product intent only. Use primary evaluation papers, benchmark documentation, official model cards, judge-model research, human-evaluation methodology, statistical references, and browser standards. Label every unverified assumption.

The objective is to design an evaluation system that predicts whether a compact browser-local model is actually pleasant and useful after repeated interaction. Conversation, common sense, practical judgment, instruction following, clarification quality, multi-turn state, memory conflict, source-grounded transformations, JSON/extraction, code explanation, lawful adult directness, narrow concrete-harm boundaries, tool routing, repetition, and capability honesty matter more than advanced mathematics. Difficult arithmetic can route to a deterministic calculator. Safety scores must not dominate the system or reward censorship and blanket refusal; paired benign and harmful-neighbor cases should measure both helpfulness and narrow boundary behavior. Credential safety, prompt-injection resistance, and model-file trust remain strict application requirements.

Survey current small-model evaluation research and identify which public benchmarks correlate poorly or well with real conversational usefulness. Analyze benchmark contamination, answer-format sensitivity, multiple-choice artifacts, math/code over-weighting, judge-model bias, length bias, style bias, self-preference, reference-answer leakage, and leaderboard overfitting. Do not simply assemble popular benchmark names; explain causal value and limits for this product.

Design physically separate layers:

- fixed development diagnostics;
- seeded paraphrase and perturbation suites;
- generated shadow tests whose generator and prompts are frozen before candidate evaluation;
- sealed release tests unavailable to training and tuning operators;
- longitudinal multi-turn sessions;
- real-browser runtime tests;
- blinded human review;
- post-release opt-in failure sampling that cannot silently alter prior scores.

Define an ontology with critical families: greeting and ordinary dialogue; practical constraints; ambiguity; instruction conflicts; source conflicts; multi-turn corrections/preferences; current user intent versus stale memory; untrusted retrieved text; lawful adult requests and benign neighbors; concrete-harm boundaries; uncertainty; summarization; rewriting; extraction; JSON; code explanation; calculator routing; unsupported capability claims; repetition; context truncation; persona consistency; and cross-device memory conflict. Specify case schemas, stable IDs, provenance, hidden fields, expected-behavior descriptors, validators, and family weights.

Separate deterministic from subjective scoring. For JSON, extraction, counts, tool calls, hashes, and explicit constraints, define exact parsers and validators. For conversation and common sense, design a blinded human rubric covering coherence, relevance, practical correctness, nuance, directness, uncertainty calibration, respect for current intent, non-refusal, and natural style. Propose reviewer training, calibration anchors, inter-rater agreement, adjudication, and sample-size/power calculations. Explain when model judges may assist triage but cannot become sole authority.

Specify statistical analysis: per-family means and critical-failure counts, confidence intervals, bootstrap or hierarchical methods, paired candidate comparisons, effect sizes, multiple-comparison control, regression detection, seed variance, and minimum practically important difference. Aggregate averages must not hide catastrophic family failures. Define provisional promotion and rollback thresholds and explain how they should be calibrated on blinded references.

Build a no-cheat threat model. Explicitly detect and prohibit expected-answer lookup, prompt-string dispatch, retries, decomposition, answer assembly, JSON repair, post-hoc rewriting, second-model correction, judge feedback loops, case exemptions after failure, selected seed reporting, test-to-train overlap, hidden tool use, and browser-only canned answers. Preserve untouched decoder bytes, exact prompt/template/token identities, sampler settings, model hashes, adapter hashes, runtime hashes, and presentation transforms.

Design causal release attribution. A candidate should be evaluated at source model, f32 conversion, q8, mixed/lower precision, native scalar, optimized native, WASM, browser, context/memory enabled, and packaged/distributed stages. Specify how a failure at one stage blocks claims downstream. Include footprint, peak memory, load/prefill/decode latency, restart, multi-tab, offline, and locked-UI checks without allowing performance to excuse weak conversation.

Create an adversarial evaluator-audit plan. Include leaked phrases, near-duplicate cases, conflicting rubrics, judge-model prompt injection, verbose-but-wrong responses, concise correct responses, unnecessary refusal, policy boilerplate, hallucinated browsing/filesystem access, raw chain-of-thought requests, and malformed Unicode/JSON. Evaluation itself must not expose secrets or private memory.

Do not cheat, and do not propose ways to game the evaluator. The report should make gaming harder than improving the model.

Required report sections:

1. Executive evaluation strategy.
2. Current benchmark landscape and limitations.
3. Evaluation ontology and case schema.
4. Fixed/seeded/shadow/sealed/multi-turn/browser separation.
5. Deterministic validators and human rubric.
6. Judge-model role and anti-bias controls.
7. Statistical design, sample sizes, and thresholds.
8. No-cheat threat model and audit tests.
9. Source-to-browser causal attribution matrix.
10. Release, rollback, and evidence-retention policy.
11. Concrete TDD fixtures and failure examples.
12. Primary-source bibliography with access dates.

Save the completed report as `TinyRustLM No Cheat Conversational Evaluation and Release Gates.md`.

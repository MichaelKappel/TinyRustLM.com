# Six Deep Technical Research Prompts For TinyRustLM Model Quality

Use these as six separate assignments. Give exactly one complete prompt to each
research agent. The agents are intentionally disconnected from the TinyRustLM
desktop, source repository, private models, credentials, internal evaluations,
and one another. They may inspect public websites and current primary technical
sources. Each report must stand on its own and must not assume that another
agent will fill in missing analysis.

The six reports are designed to answer different questions:

1. Is response failure caused by the model, conversion, runtime, tokenizer,
   prompt, sampler, or presentation layer?
2. Which current model and architecture gives the best useful-quality-to-byte
   Pareto point?
3. Which data and behavioral curriculum will produce natural, useful answers?
4. Which distillation and post-training system can preserve that behavior in a
   much smaller student?
5. Which compression and quantization system preserves quality at a reasonable
   local footprint?
6. Which prompt, context, memory, decoding, and tool-routing system extracts the
   best real behavior from the final local model?

Every prompt includes its own context and evidence requirements so it can be
copied independently.

## Prompt 1: Forensic Diagnosis Of Incoherent Local Model Output

You are an independent principal inference-correctness and language-model
forensics researcher. You have public-web access, but no access to the
TinyRustLM source tree, developer desktop, private `.slm` files, internal model
weights, credentials, logs, hidden evaluations, or unpublished implementation
details. You may safely inspect the public product at https://tinyrustlm.com/
and public documentation discoverable through https://minimodel.org/ and
https://uaix.org/. Do not claim or imply private access. Record your UTC research
date, browser and operating-system details for public tests, visible model
identity, generation settings, and every primary source used.

TinyRustLM is intended to run real models locally through Rust and WebAssembly,
with native Rust and C# wrapper paths as well. The visible interface is already
considered a strong product design and is not the subject of this report. The
current engineering problem is that some local generations are nonsensical,
very short, repetitive, malformed, or unrelated to simple conversational
prompts. A separately observed duplicate rendering of one answer must be
treated as a presentation defect, not as proof that the model generated the
same text twice. Your job is to design the most rigorous possible method for
locating the first layer at which a correct reference model diverges.

Research and specify an end-to-end differential diagnosis for this chain:

1. Immutable source checkpoint and exact model configuration.
2. Tokenizer files, Unicode normalization, pre-tokenization, merge rules,
   added tokens, special-token IDs, chat template, and generation prompt.
3. Source-framework reference inference in full or native precision.
4. Tensor conversion, name mapping, transposition, shape interpretation,
   tied-weight handling, dtype conversion, and `.slm` serialization.
5. Loader parsing, byte order, alignment, dimensions, tensor lookup, and
   quantized block decoding.
6. Architecture implementation, including embedding lookup, RMSNorm or
   LayerNorm epsilon, RoPE frequency and scaling, partial rotary dimensions,
   GQA/MQA head mapping, Q/K normalization, attention scaling and masks,
   gated MLP ordering, activation function, residual ordering, final norm,
   tied or untied output projection, and logit scaling or soft capping.
7. Prefill state, KV or recurrent state, position counters, reset behavior,
   multi-turn state, and context truncation.
8. Sampler preparation, nonfinite-logit handling, temperature, top-k, top-p,
   minimum probability, repetition penalties, random seed, stop-token handling,
   and tokenizer decode.
9. Browser/WASM transport, JavaScript number and buffer boundaries, string
   decoding, streaming events, cancellation, and presentation of exactly one
   authoritative assistant result.

For each layer, identify failure signatures that distinguish it from adjacent
layers. For example, explain how shifted token IDs differ from a bad chat
template, how transposed projections differ from an incorrect RoPE convention,
how a wrong grouped-query head map differs from quantization loss, and how a
correct token stream rendered twice differs from two runtime generations. Give
specific observable symptoms, minimum instrumentation, and decisive tests.

Design a staged parity ladder with reproducible evidence artifacts:

- Exact prompt bytes and token-ID sequence parity.
- Tokenizer round-trip and special-token boundary tests.
- Tensor inventory, dimensions, per-tensor checksums, finite/range summaries,
  and sampled source-versus-converted values.
- Known-vector tests for every mathematical operator.
- Layer-zero embedding and normalization fingerprints.
- Per-layer hidden-state fingerprints at selected token positions.
- Attention Q/K/V, score, mask, softmax, and output fingerprints.
- MLP gate/up/down fingerprints and residual-stream fingerprints.
- Final hidden-state and full-vocabulary logit fingerprints.
- First-token and teacher-forced multi-token top-k comparison.
- Free-generation comparison only after teacher-forced parity passes.
- Native Rust versus WASM parity, then browser event-stream versus WASM parity.

Specify numeric comparison methods and explain their limitations: maximum
absolute and relative error, centered cosine similarity, rank correlation,
top-1 and top-k overlap, log-sum-exp difference, KL and Jensen-Shannon
divergence, probability-mass coverage, ULP distance, and error growth by layer
and decoding step. Recommend provisional thresholds for f32, q8, q6, q5, and
q4 paths, but make clear that thresholds must be calibrated against observed
behavior and cannot turn a bad answer into a pass.

Develop a fault-localization strategy that minimizes expensive full-model
runs. Include tiny deterministic fixtures, synthetic matrices with known
answers, one-layer reference models, layer substitution, binary search across
layers, cached source activations, first-token probes, and teacher-forced token
probes. Explain how to diagnose a model that structurally validates but fails
language behavior. Include tests for NaN/Inf, integer overflow, malformed block
scales, zero scales, unsupported tensor classes, bad padding, truncated files,
unknown special tokens, missing EOS, and accidental use of a base-model prompt
format on an instruct checkpoint.

Public black-box tests must be harmless, rate-limited, reproducible, and must
not include credentials, personal data, destructive inputs, or hidden prompt
extraction. Use simple conversations, summarization of supplied public text,
strict JSON from supplied facts, latest-user-correction cases, and bounded
multi-turn tasks. Record raw visible output without silently correcting it.

No-cheat requirements:

- Do not propose canned responses, prompt-specific branches, output lookup
  tables, hidden remote inference, or replacing malformed local output with a
  server answer.
- Do not judge success from a file loading, a checksum matching itself, a test
  fixture generating, or a UI saying `ready`.
- Do not tune against the exact evaluation prompts or expected answers.
- Do not hide failures through postprocessing that changes semantic content.
- Do not merge model correctness and UI correctness into one unexplained pass.
- Preserve failed probes and negative experiments as first-class evidence.

Deliver a deeply technical report with: a causal fault tree; a layer-by-layer
parity protocol; an instrumentation and evidence schema; equations and
threshold rationale; a minimal-to-expensive test order; failure-signature
tables; a public black-box protocol; a TDD backlog with acceptance criteria;
and a decision procedure that names the earliest proven divergence rather than
guessing. Include a machine-readable JSON appendix describing each probe,
inputs, expected evidence, thresholds, dependencies, and pass/fail state. End
with the ten highest-information experiments TinyRustLM should run first.

Always-current rule: verify current official model configurations, tokenizer
behavior, framework generation semantics, Rust/WASM numeric behavior, and
browser APIs at the time of research. Prefer model-owner documentation,
immutable repositories, specifications, and primary papers. Separate observed
facts, calculated values, inferences, recommendations, and unknowns. Include
direct links, publication or revision dates, last-verified UTC timestamps, and
confidence levels.

## Prompt 2: Current Model And Architecture Pareto Frontier For Useful Local Conversation

You are an independent principal small-language-model architecture researcher.
You have public-web access only. You cannot inspect TinyRustLM source code,
local checkpoints, private `.slm` artifacts, internal benchmarks, credentials,
or unpublished conversion support. Inspect https://tinyrustlm.com/ and
https://minimodel.org/ as public product context, and read the current UAIX
Cognitive Liberty Charter at
https://uaix.org/en-us/governance/cognitive-liberty-charter/. Do not infer
private implementation details from branding or UI. State the UTC research
date and reverify every volatile model, license, and framework claim.

The research objective is not to find the smallest model or the highest public
math score. It is to identify the best current Pareto points for natural
conversation, common sense, practical judgment, instruction following,
summarization, rewriting, extraction, code explanation, strict structured
output, multi-turn correction, and neutral treatment of lawful adult inquiry.
Arithmetic may be delegated to a deterministic calculator and should not
dominate the ranking. The system must run locally in native Rust and should be
realistically implementable in browser Rust/WASM. TinyRustLM needs at least one
compact tier and may offer a larger quality tier.

Perform a fresh model search across approximately 0.25B to 4B parameters. Do
not restrict the search to one vendor, one benchmark leaderboard, or only
dense decoder-only Transformers. Consider mature decoder Transformers,
GQA/MQA models, recurrent or state-space hybrids, linear-attention hybrids,
mixture-of-experts models with low active parameters, models trained natively
at low precision, and text-only extraction from multimodal families only where
architecture and license genuinely permit it. Explain why each nonstandard
architecture is or is not practical for a portable deterministic Rust runtime.

For every serious candidate, verify from primary sources:

1. Exact repository ID and immutable revision, release date, owner, checkpoint
   type, intended chat template, and tokenizer revision.
2. Exact weight, code, tokenizer, and dataset licenses; acceptable-use terms;
   attribution; gating; patent clauses; and whether converted-weight
   redistribution through `.slm`, MiniModel, and P2P is permitted.
3. Total and active parameter counts; layers; hidden and intermediate sizes;
   attention and KV heads; head dimension; vocabulary; embedding and output
   tying; normalization; activation; positional encoding; context behavior;
   and every nonstandard operator.
4. Published training-token scale, data-date limitations, language coverage,
   post-training method, and known behavior limitations.
5. Official or reproducible evidence for conversational quality, common sense,
   instruction following, factuality, structured output, coding, over-refusal,
   repetition, and long-context degradation. Treat leaderboard averages as
   supporting evidence, not proof of product usefulness.
6. Support maturity in the source framework and relevant independent runtimes.
   Separate implemented, merged, released, browser demonstrated, and
   production proven.

Calculate artifact size and runtime memory rather than quoting parameter count.
For each finalist, estimate f16/bf16, q8, q6, q5, q4, and at least two sensible
mixed-precision layouts. Include scale and zero-point metadata, alignment,
embedding and output-head costs, tokenizer, model manifest, KV or recurrent
state, full logits, sampler workspace, dequantization or matrix tiles, Rust/WASM
heap, JavaScript transfer copies, WebGPU staging if applicable, and browser
storage overhead. Report results at 256, 420, 768, and 1,536 MiB artifact
budgets and at 512, 1,024, and 2,048 context tokens. Explain which budgets are
feasible only after a streaming or paged loader exists.

Analyze vocabulary economics in detail. Quantify when a 100K-plus vocabulary
consumes so much of a sub-billion model that an apparently small architecture
is a poor local product choice. Evaluate tied versus untied heads, tokenizer
quality for ordinary English and code, byte fallback, Unicode behavior, and
the cost and risk of vocabulary reduction or tokenizer replacement. Do not
recommend tokenizer surgery without accounting for embedding retraining and
behavior regression.

Design a current, no-cheat candidate bake-off. It must include source-framework
evaluation before conversion; fixed public cases; procedurally seeded
paraphrases; sealed holdouts; conversational and common-sense tasks; user
correction overriding stale context; conflicting-source handling; untrusted
retrieved-text instructions; strict JSON; summarization; repetition and clean
stopping; latency; memory; and license eligibility. Specify human-review
rubrics and deterministic checks. Include math as a separately reported small
slice, not the overall promotion criterion.

No-cheat requirements:

- Do not select from benchmark score alone or treat benchmark contamination as
  impossible.
- Do not recommend hidden remote inference, canned responses, or model-specific
  prompt branches that recognize evaluation cases.
- Do not assume that a model supported by a Python library is supported by the
  TinyRustLM runtime.
- Do not call a quantized size feasible without accounting for all metadata and
  peak runtime copies.
- Do not call a license permissive without checking converted-weight
  redistribution and tokenizer terms.
- Do not erase poor conversational results because a candidate wins math or
  code benchmarks.

Deliver a report containing: an executive recommendation for one compact model,
one quality model, two backups, and explicit no-go candidates; a model evidence
matrix; architecture diagrams described in text; per-layer tensor inventories;
artifact and peak-memory formulas; browser and native implementation-risk
scores; license and provenance analysis; a bake-off protocol; promotion gates;
and a phased experiment backlog. Include sensitivity analysis showing what
recommendation changes when the artifact cap, browser memory, context length,
or license requirement changes. Add machine-readable JSON or CSV with exact
IDs, immutable revisions, dimensions, licenses, byte estimates, source URLs,
confidence, and last-verified UTC.

Always-current rule: begin by searching for releases and technical changes
after the prior known reports. Use official model cards, owner repositories,
license text, technical reports, and primary papers wherever possible. List
what was newly verified, what remains unknown, and what could invalidate the
recommendation. Never silently reuse a stale model ranking.

## Prompt 3: Data Engineering And Behavioral Curriculum For Natural Tiny-Model Answers

You are an independent principal language-model data and post-training
researcher. You have public-web access only and no access to TinyRustLM source,
private datasets, local model outputs, credentials, sealed tests, unpublished
prompts, or training infrastructure. Review https://tinyrustlm.com/,
https://minimodel.org/, and the current UAIX Cognitive Liberty Charter at
https://uaix.org/en-us/governance/cognitive-liberty-charter/ for public product
context. Clearly state that any local implementation facts are unknown. Record
the UTC research date and cite current primary sources and dataset cards.

Design a data system that makes a roughly 0.5B to 2B local assistant sound
coherent, attentive, concise, and practically useful. The main targets are
ordinary conversation, common sense, practical next steps, correct handling of
underspecified choices, conflicting-source preservation, latest-user-intent
precedence, summarization, rewriting, extraction, code explanation, strict
formats, clean stopping, and substantive lawful adult inquiry without generic
moralizing. Arithmetic should be taught mainly as calculator/tool routing, with
language quality taking priority. Generic refusal text, capability disclaimers,
and canned safety preambles must not become dominant answer templates.

Build an implementation-ready corpus and curriculum specification. Compare
continued pretraining, domain-adaptive pretraining, full supervised
fine-tuning, parameter-efficient tuning, preference optimization, and targeted
quantization-recovery data. Explain what each stage can and cannot repair. Give
minimum, recommended, and ambitious token and example counts for each stage,
with compute-aware alternatives for 0.5B, 1B, and 2B students.

Specify detailed task-family distributions for at least:

- Natural greetings, follow-up questions, conversational repair, and topic
  changes without canned assistant self-description.
- Common-sense physical, temporal, social, and practical reasoning grounded in
  supplied facts.
- Choosing among supplied options and asking only the clarification needed to
  make a real recommendation.
- Resource-constrained fallback planning that does not suggest unavailable
  tools, money, time, permissions, or data.
- Conflicting statements from users, managers, customers, documents, memory,
  and status records, preserving disagreement until authority is established.
- A new user correction superseding stale profile or memory facts.
- Retrieved webpages, email, reports, and memory containing embedded
  instructions that must be treated as untrusted content while the harmless
  task is still completed.
- Faithful summarization, extraction, rewriting, code explanation, and JSON or
  schema-constrained output.
- Honest uncertainty, calibrated confidence, and source attribution without
  generic inability claims.
- Lawful adult-policy and controversial-subject pairs balanced across
  viewpoints, with substantive answers rather than blanket refusal.
- Narrow boundaries around concrete unauthorized or nonconsensual action,
  paired with nearby lawful and genuinely useful alternatives.
- Anti-repetition, EOS behavior, length control, and recovery from a malformed
  previous assistant turn.
- Tool-selection examples where calculation is delegated but explanation and
  interpretation remain with the language model.

For each family, define positive examples, hard negatives, preference pairs,
multi-turn trajectories, common annotation errors, acceptance rubrics, and
regression risks. Quantify suggested mixture ratios and explain how they change
by training stage. Address the ratio of positive helpful rehearsal to narrow
boundary examples so that the model does not generalize refusal language into
benign conversation. Propose audits for repeated phrases such as capability
disclaimers and moralizing preambles, while explaining why phrase counts alone
cannot judge answer quality.

Research current high-quality public data sources and synthetic-data methods.
For every proposed source, examine license, provenance, consent, personally
identifying information, content quality, language mix, duplication, model-
generated contamination, benchmark leakage, and redistribution restrictions.
Do not merely list datasets. Give a field-level ingestion and rejection policy.
Describe document normalization, language identification, quality filtering,
semantic and exact deduplication, near-duplicate clustering, conversation-turn
repair, role validation, length filters, toxicity and refusal-template audits,
license receipts, provenance records, and immutable dataset snapshots.

Design a teacher-assisted generation and review pipeline that does not amplify
teacher quirks. Compare single-teacher, multi-teacher, debate or critique,
rejection sampling, rubric scoring, human review, and disagreement sampling.
Specify how to preserve answer diversity, avoid synthetic phrasing collapse,
keep user language natural, and prevent the teacher from inserting claims of
remote capabilities. Include hard-example mining from genuine failures without
copying sealed evaluation answers into training.

Give at least three concrete post-training recipes: a low-cost adapter recipe,
a full SFT plus rehearsal recipe, and a preference-optimization recipe. Specify
sequence length, packing, assistant-only loss masking, optimizer, learning-rate
range, warmup, schedule, batch and accumulation, epochs or token budget,
checkpoint cadence, gradient clipping, regularization, target modules for an
adapter, rank and alpha ranges, preference objective, beta or equivalent
strength, early stopping, and rollback criteria. Explain which parameters must
be tuned empirically rather than presented as universal constants.

No-cheat and contamination requirements:

- Freeze public, seeded, and sealed evaluation identities before data
  collection.
- Exclude exact, normalized, n-gram, template-near, and semantic near-duplicates
  of evaluation cases from all training stages.
- Never train on expected evaluation answers or prompt-specific correction
  branches.
- Never score success from training loss alone.
- Compare the untouched source, adapted source, quantized artifact, native
  runtime, and browser runtime.
- Require broad ordinary-conversation regressions after every targeted gain.
- Preserve dataset versions, exclusion receipts, rejected records, and failed
  checkpoints so results remain auditable.

Deliver a detailed report with a corpus authority map; source and license
matrix; field-level schema; normalization, filtering, and deduplication
algorithms; task taxonomy and exact mixture proposals; synthetic generation
and review design; three complete training recipes; compute and storage
budgets; contamination controls; quality audits; ablation plan; promotion and
rollback gates; and a TDD-style implementation backlog. Include machine-readable
tables for task families, data sources, mixture weights, provenance fields, and
acceptance rules. End with the smallest high-information corpus experiment that
could establish whether data quality is the primary bottleneck.

Always-current rule: recheck dataset revisions, licenses, takedown status,
training-framework behavior, and current post-training evidence at the time of
every report. Distinguish facts, calculations, proposals, and unknowns. Use
direct links and immutable revisions where available, and state confidence and
last-verified UTC for every volatile recommendation.

## Prompt 4: Multi-Stage Distillation And Student Design For High-Quality Tiny Models

You are an independent principal model-distillation and optimization
researcher. You have public-web access but no TinyRustLM repository access,
private teacher endpoints, local checkpoints, training data, credentials,
sealed evaluations, or unpublished model measurements. Review the public
product at https://tinyrustlm.com/, the model ecosystem at
https://minimodel.org/, and the current UAIX Cognitive Liberty Charter at
https://uaix.org/en-us/governance/cognitive-liberty-charter/. Do not invent
private architecture or training details. Date the report in UTC and ground
technical claims in current primary papers and official implementations.

Research how to distill strong conversational logic, common sense, practical
judgment, instruction following, latest-user-correction behavior, conflict
handling, memory-injection resistance, clean structured output, and low
over-refusal into a local student between roughly 0.5B and 2B parameters. The
goal is not to imitate long hidden reasoning or maximize math benchmark scores.
The student should produce direct, useful answers, route arithmetic to a
calculator when appropriate, preserve uncertainty honestly, and remain small
enough for native Rust and browser deployment after quantization.

Compare and mathematically derive the current options:

1. Sequence-level response distillation and rejection sampling.
2. Full-distribution token-level distillation.
3. Top-k logit distillation with explicit tail-mass reconstruction.
4. Reverse-KL, forward-KL, Jensen-Shannon, cross-entropy, and blended objectives.
5. Temperature schedules and the required temperature-squared scaling.
6. Hidden-state, embedding, attention, relation, and intermediate-feature
   matching when teacher and student dimensions differ.
7. Patient or progressive distillation across layers and checkpoints.
8. Multi-teacher distillation with capability-based routing and disagreement
   handling.
9. On-policy student sampling versus offline teacher corpora.
10. Preference distillation and post-distillation DPO, IPO, ORPO, SimPO, KTO,
    or better-supported current alternatives.
11. Quantization-aware distillation, fake quantization, learnable clipping,
    post-quantization recovery, and mixed-precision-aware training.
12. Width, depth, vocabulary, head, and MLP-structure reduction, including when
    inheriting weights is better than training the student architecture from
    random initialization.

Provide exact objective formulas, tensor dimensions, masking behavior, numerical
stability considerations, and gradient paths. Explain teacher/student tokenizer
alignment, mismatched vocabularies, byte fallback, special tokens, and chat
templates. Analyze when top-k teacher logits are sufficient, how to encode the
unobserved probability tail, how k and temperature affect storage and quality,
and how much offline storage is required for concrete corpus sizes. Compare
f16, bf16, compressed-logit, and quantized-logit storage with formulas.

Design three complete, costed distillation programs:

- A conservative same-architecture student that starts from a strong public
  base and uses response plus top-k logit distillation.
- A structurally smaller student produced through progressive depth or width
  reduction, intermediate matching, and recovery.
- A quantization-aware program targeting a compact mixed-precision `.slm`
  artifact rather than an unquantized checkpoint that later collapses.

For each program specify teacher and student selection criteria; corpus size and
mixture; prompt generation; teacher temperatures; number of teacher samples;
logit k; loss terms and initial weights; schedules; optimizer; learning rate;
warmup; effective batch; sequence length; packing; assistant-only masks;
precision; activation checkpointing; gradient accumulation; clipping;
checkpoint cadence; validation cadence; early stopping; preference stage; QAT
stage; compute, storage, and wall-clock formulas; and failure/rollback rules.
Do not fabricate exact universal hyperparameters. Give justified starting
ranges and a controlled search plan.

Address the difficult parts directly:

- Small students often lack capacity to imitate all teacher modes.
- Teacher outputs can be verbose, censored, stylistically repetitive, or
  factually wrong.
- Off-policy teacher text may teach surface form without robust decision rules.
- Hidden-state matching across unequal depth and width can dominate or conflict
  with token objectives.
- Distilling chain-of-thought can increase tokens, leakage risk, and imitation
  of unfaithful reasoning; research direct-answer and outcome-based alternatives.
- Synthetic curricula can collapse linguistic diversity.
- Preference optimization can erase base capabilities or increase refusal.
- Post-training gains can disappear after q5 or q4 conversion.
- A tiny vocabulary or tokenizer replacement can invalidate inherited weights.
- Quantization noise during training can destabilize norms, logits, and rare
  token behavior.

Design ablations that can attribute gains: teacher response only; logits only;
response plus logits; intermediate losses; preference stage; rehearsal;
quantization-aware stage; and each curriculum family. Require source-model,
student-source, student-quantized, native-runtime, and browser-runtime evidence.
Define first-token and teacher-forced parity separately from behavioral quality.
Use confidence intervals and paired evaluations where possible.

No-cheat requirements:

- Evaluation prompts, close paraphrases, expected answers, and sealed cases
  must never enter teacher generation or training corpora.
- Do not hardcode benchmark branches, canned responses, or model selectors that
  recognize evaluation content.
- Do not hide a large remote teacher behind the local product at inference.
- Do not report teacher imitation loss as proof of useful conversation.
- Do not cherry-pick only successful generations or discard failed seeds.
- Do not call an unquantized checkpoint a success if the deployable artifact
  loses the behavior.

Deliver an implementation-grade report with a literature and implementation
comparison; mathematical objective derivations; tokenizer-alignment strategy;
three complete recipes; data, compute, and storage budgets; ablation matrix;
QAT integration; evaluation and contamination design; expected failure modes;
promotion and rollback gates; and phased engineering milestones. Include a
machine-readable experiment matrix and recommend the first six experiments in
strict information-value order.

Always-current rule: verify current papers, official repositories, framework
APIs, model licenses, teacher terms, and hardware assumptions on each revision.
Prefer primary evidence. List changes since prior work, distinguish measured
facts from estimates, give confidence levels, and identify claims that require
local experiments before acceptance.

## Prompt 5: Quality-Preserving Quantization And Compression Under Browser Footprint Limits

You are an independent principal numerical-compression and portable-kernel
researcher. You have public-web access only. You cannot inspect TinyRustLM code,
private `.slm` format details, local model files, converter internals, credentials,
or unpublished test data. Review https://tinyrustlm.com/ and
https://minimodel.org/ as public product context. Do not claim that a proposed
method is already implemented. Record the UTC research date and use current
primary papers, official repositories, specifications, and model documentation.

The engineering question is how to preserve genuinely useful language quality
while keeping a model locally deployable in native Rust and eventually browser
Rust/WASM. A public-safe internal observation is available as starting evidence:
one approximately 0.6B model occupies about 574.9 MiB with q8 matrices and f32
normalization and retains first-token reference behavior on 7 of 8 probes with
about 0.995 average centered logit cosine. A q5-matrix/f32-normalization artifact
occupies about 395.4 MiB but retains top-1 on only 4 of 8 probes with about 0.970
average centered logit cosine. Increasing precision only for selected edge
layers or reducing q5 block size on selected tensors did not repair those four
top-1 failures enough to justify the extra bytes. The current scalar portable
q5 path is also far too slow for product deployment even after a meaningful
grouped-decode speedup. Treat these as limited measurements, not universal
truth, and design the next experiments instead of restating them.

Research current compression methods that could improve the quality/byte and
quality/latency Pareto frontier, including when supported by evidence:

- Symmetric and asymmetric q8, q6, q5, q4, q3, ternary, and mixed-bit schemes.
- Per-tensor, per-channel, per-row, per-group, and block floating-point scales.
- GPTQ, AWQ, HQQ, SmoothQuant, OmniQuant, ZeroQuant, SpQR, SqueezeLLM, AQLM,
  QuIP or QuIP#, QuaRot, SpinQuant, FlatQuant, outlier-aware methods, low-rank
  error correction, and better-supported successors available at research time.
- Hessian- or activation-aware calibration, clipping, scale optimization, and
  rotation-based outlier reduction.
- Sparse high-precision residuals and low-rank quantization-error adapters.
- Quantization-aware training and quantization-aware distillation.
- Mixed precision by tensor class, layer, channel sensitivity, token frequency,
  and activation outliers.
- Embedding and output-head treatment, tied-weight implications, normalization
  precision, attention and MLP asymmetry, KV-cache precision, and recurrent
  state if applicable.

For every serious method, explain the objective and derive the storage cost,
calibration needs, conversion compute, metadata, decode operations, random
access, streaming behavior, deterministic reproducibility, and error modes.
State whether its reference implementation depends on CUDA, Triton, custom GPU
kernels, nonportable integer instructions, runtime codebooks, large lookup
tables, or activation reordering. Then determine whether it can realistically
be implemented efficiently in safe portable Rust, native SIMD, WASM SIMD128,
and optional WebGPU. A method that produces a small file but requires an
impractical browser kernel is not a viable recommendation.

Derive complete byte formulas. Include codes, scales, zero points, codebooks,
outlier indices and values, low-rank residuals, group padding, row alignment,
tensor headers, tokenizer, manifest, signatures, adapter, KV cache, logits,
scratch, dequantization tiles, JavaScript copies, WASM memory, worker transfer,
and WebGPU staging. Evaluate at 256, 420, 512, 768, and 1,536 MiB artifact
budgets and 512, 1,024, and 2,048 token contexts. Distinguish artifact bytes,
resident bytes, peak load bytes, and peak generation bytes.

Design a sensitivity and profile-search system with:

1. Strict source tensor inventory, dimensions, finite/range checks, norms,
   kurtosis, outlier maps, and activation statistics.
2. Calibration data separated from every evaluation set.
3. Per-tensor and per-layer replacement experiments against a high-precision
   reference.
4. First-token full-logit and top-k parity.
5. Teacher-forced divergence over multiple decoding steps.
6. Free-generation paired behavior only after numerical probes pass.
7. Perplexity and task behavior, with conversation and common sense weighted
   above arithmetic.
8. Mixed-profile search under hard byte, peak-memory, and latency constraints.
9. Corruption, truncation, malformed scale, overflow, NaN/Inf, and deterministic
   cross-platform tests.
10. Kernel microbenchmarks plus complete prefill and decode measurements.

Explain how to use centered cosine, top-1/top-k retention, KL and
Jensen-Shannon divergence, tail-mass error, per-token rank displacement, and
behavior-gate deltas without confusing any single metric with quality. Propose
evidence-based provisional gates and a process for calibrating them. Analyze
why average cosine near 0.97 can still change generation catastrophically and
why spending extra bits on guessed layers can fail.

Propose at least four concrete next precision profiles, including a q6-centered
quality candidate, an activation-aware q5 candidate, a mixed q8/q6/q5 candidate,
and a compact profile with explicit outlier or low-rank correction. Inventory
every major tensor class and estimate exact bytes. Rank the experiments by
expected information gained per conversion and probe hour. Include kernel
design sketches for the two most promising portable formats, with packing,
unpacking, scale application, accumulation precision, tiling, SIMD mapping,
alignment, bounds checks, and deterministic scalar reference behavior.

No-cheat requirements:

- Structural validation, a matching self-checksum, or one generated token is
  not quality evidence.
- Do not choose calibration records from evaluation prompts or their
  paraphrases.
- Do not repair known prompts with tensor exceptions, canned outputs, or
  prompt-specific precision profiles.
- Do not hide remote inference or silently fall back to another model.
- Do not compare only artifact size while omitting runtime metadata and peak
  copies.
- Do not promote a profile that has no deployable portable kernel.
- Preserve and report rejected profiles so the same dead ends are not repeated.

Deliver a deeply technical report with a current-method comparison matrix;
quantization equations; complete byte and peak-memory models; tensor-sensitivity
protocol; proposed profiles with exact class-level precision; portable Rust,
SIMD, WASM, and WebGPU kernel implications; calibration and evaluation design;
performance methodology; corruption tests; an ordered experiment plan; and
hard promotion/rejection criteria. Include a machine-readable precision table
and experiment manifest schema.

Always-current rule: verify publication status, official implementations,
licenses, hardware assumptions, browser capabilities, and model-architecture
compatibility on every revision. Clearly label observed input evidence,
published facts, calculations, inferences, and experiments still required.
Include direct links, immutable commits when possible, confidence, and
last-verified UTC.

## Prompt 6: Inference-Time Conversation, Memory, Decoding, And Tool Quality

You are an independent principal inference-behavior, retrieval, and decoding
researcher. You have public-web access only and no access to TinyRustLM source,
private `.slm` files, local memory, credentials, internal prompts, hidden tests,
or unpublished runtime behavior. You may inspect https://tinyrustlm.com/ as a
safe public black box, https://memoryendpoints.com/ for public memory-product
context, https://minimodel.org/ for public model context, and the current UAIX
Cognitive Liberty Charter at
https://uaix.org/en-us/governance/cognitive-liberty-charter/. Do not attempt to
extract hidden prompts, submit private data, or infer private architecture from
the UI. Record the UTC date and exact public-test conditions.

Research how to obtain the best truthful and coherent behavior from a compact
local model after its weights are fixed. Focus on exact tokenizer and chat
templating, system-policy design, multi-turn history, hosted or local memory
retrieval, context packing, prompt-injection resistance, sampling, repetition
control, stopping, structured output, deterministic tool routing, and visible
streaming. The goal is substantive ordinary conversation, common sense,
practical judgment, latest-user-intent precedence, faithful transformation of
supplied text, and lawful adult inquiry under the Charter. Do not propose UI
restyling. The initial UI appearance is considered locked; this report concerns
the quality and correctness of interaction after a conversation begins.

Develop a normative prompt-construction pipeline covering:

1. Exact tokenizer revision and chat-template authority.
2. System instruction length, priority rules, and capability claims.
3. Current user turn, recent dialogue, summaries, persona, preferences,
   durable facts, episodic memories, retrieved documents, and tool results.
4. Provenance labels and trust boundaries for every context segment.
5. Stable token budgeting before tokenization and exact budgeting after it.
6. Truncation, compaction, supersession, tombstones, conflicts, and stale-index
   handling.
7. Latest explicit user correction overriding stale memory without deleting
   auditable history.
8. Clear separation between instructions and quoted untrusted content.
9. Output stop conditions, assistant-prefix handling, and prevention of role
   leakage or fake tool transcripts.

Research deterministic retrieval and context packing in detail. Compare lexical
BM25-style signals, dense embeddings, hybrid retrieval, recency, salience,
authority, user pinning, source reliability, diversity, maximal marginal
relevance, temporal validity, supersession graphs, and conflict preservation.
Give explicit ranking formulas, normalization, tie-breaking, deduplication,
token-cost-aware selection, and bounded-knapsack or greedy alternatives.
Explain how very small models react to long noisy context and why retrieving
more memory can make answers worse. Design a compact-context policy for 512,
1,024, and 2,048 tokens with exact percentage or token allocations and adaptive
fallbacks.

Treat memory, webpages, email, reports, and tool output as data, not authority.
Develop prompt-injection defenses appropriate to small local models: typed
context envelopes, provenance, instruction/data separation, allowlisted tool
contracts, retrieval-time filtering, output validation, and explicit conflict
reporting. Do not suggest asking the small model alone to decide whether text
is malicious. Preserve the useful content of a document while ignoring its
embedded attempts to redirect the system.

Research decoding methods and give mathematically precise recommendations for
greedy decoding, temperature, top-k, nucleus top-p, min-p, typical sampling,
locally typical sampling, repetition and frequency/presence penalties,
repetition windows, entropy-adaptive methods, contrastive search, candidate
generation and reranking, constrained decoding, and speculative decoding where
relevant. Explain interactions and failure modes for sub-billion models. Design
named presets for natural chat, precise extraction, code explanation, creative
rewriting, and strict JSON. For each preset give justified starting ranges,
adaptation rules, deterministic seed behavior, and tests. Do not present one
magic temperature as universally optimal.

Specify clean generation semantics:

- Validate all logits and define fail-closed behavior for NaN/Inf.
- Apply penalties and filters in a documented order.
- Guarantee at least one viable token or report a typed error.
- Handle EOS, stop sequences across token boundaries, maximum tokens,
  cancellation, context exhaustion, and UTF-8 decode.
- Detect loops using token and phrase repetition without rewriting a valid
  answer into something the model did not generate.
- Emit one authoritative assistant event stream and one final result identity
  so the same answer cannot be rendered twice by competing paths.
- Record diagnostics without recording private prompt or memory content by
  default.

Design deterministic tool routing for arithmetic and other narrowly defined
operations. The model may identify intent and explain a result, but a calculator
should perform arithmetic. Define typed tool schemas, argument validation,
authorization boundaries, timeout and failure behavior, provenance, and how the
tool result is returned to the model. Prevent fabricated tool success and avoid
making tools an excuse for poor ordinary conversation. For strict JSON, compare
grammar-constrained decoding, schema-aware token masks, validate-and-retry, and
bounded repair, including the cost and portability of each approach.

Create an evaluation matrix that isolates each inference-time intervention on
the same immutable model artifact. Use public fixed cases, seeded paraphrases,
sealed cases, and multi-turn workflows. Measure usefulness, instruction
following, common sense, factual faithfulness to supplied context, conflict
handling, stale-memory correction, injection resistance, structured-output
validity, repetition, truncation, latency, token throughput, and context cost.
Require paired outputs and blinded review where possible. Separate model token
output from browser rendering and memory-service behavior.

No-cheat requirements:

- No canned answers, prompt fingerprints, benchmark branches, hidden remote
  inference, or silent substitution of a larger model.
- No training or tuning on sealed evaluation prompts or expected answers.
- No semantic rewriting of poor output while claiming the model improved.
- No memory record may override the current explicit user instruction silently.
- No retrieved document may become a higher-priority instruction merely because
  it was ranked highly.
- No success claim may combine unrelated UI, memory, runtime, and model results
  without separate evidence.
- Preserve failed seeds and ordinary-conversation regressions.

Deliver a detailed report with: a normative prompt/context state machine;
token-budget formulas; deterministic retrieval and deduplication algorithms;
memory conflict and supersession semantics; injection-resistance controls;
decoding mathematics and recommended presets; tool-routing contracts; strict
output strategies; streaming identity semantics; diagnostics schema; ablation
and evaluation plan; promotion gates; and an ordered TDD backlog. Include
machine-readable configuration examples using public-safe placeholder values
and a table of the first ten inference-time experiments ranked by expected
quality gain, implementation cost, latency cost, and risk.

Always-current rule: verify current model chat templates, tokenizer behavior,
decoding research, retrieval methods, browser APIs, and public MemoryEndpoints
documentation at the time of research. Prefer primary papers, specifications,
and official implementations. Mark public observations, published facts,
calculations, inferences, recommendations, and unknown local details separately.
Provide direct links, versions or immutable commits, confidence, and
last-verified UTC.

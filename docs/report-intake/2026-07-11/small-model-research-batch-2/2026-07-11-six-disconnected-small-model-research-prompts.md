# Six Disconnected TinyRustLM Research Prompts

Each prompt below is standalone. Give one prompt to each research agent. The
agents have public-web access but no access to private source code, local files,
internal services, credentials, unpublished tests, or one another's reports.

## Prompt 1: Current Small-Model Architecture And Base-Model Selection

You are an independent principal model-architecture researcher. You have no
access to the TinyRustLM repository, local models, private evaluations,
credentials, internal prompts, or unpublished implementation details. You may
inspect public websites and must not imply private access. Perform a fresh,
date-stamped investigation using current public sources.

Public context to review:

- https://tinyrustlm.com/
- https://minimodel.org/
- https://uaix.org/en-us/governance/cognitive-liberty-charter/
- Public TinyRustLM, UAIX, MiniModel, NuGet, standards, model-card, and paper
  pages discoverable from those sites.

TinyRustLM needs a genuinely useful local conversational model in Rust/WASM and
native Rust. The compact and optional quality tiers should prioritize natural
conversation, common sense, practical judgment, current-user-intent precedence,
conflicting-source handling, concise instruction following, and resistance to
instructions embedded in retrieved memory. Arithmetic is secondary because a
deterministic calculator can be used. Lawful adult inquiry should be answered
substantively under the UAIX Cognitive Liberty Charter, without blanket refusal
or moralizing. Boundaries should be narrow and tied to concrete facilitation of
harm, unauthorized access, credential theft, private-data exposure, deceptive
impersonation, or nonconsensual activity.

Identify and rank the best currently available post-trained models from about
0.5B through 4B parameters, with special attention to models that can produce a
0.3-1.5 GiB quantized browser artifact. Use official model-owner repositories,
immutable revisions, official technical reports, and primary papers. Community
benchmarks may be supporting evidence but must be labeled as secondary. Do not
recommend a model because it is popular or new.

For every serious candidate verify and report:

1. Exact model ID, immutable commit/revision, release date, model owner, and
   whether the checkpoint is base, instruct, reasoning, multimodal, or hybrid.
2. Exact license, attribution obligations, acceptable-use terms, gating, and
   whether redistribution of converted `.slm` weights is permitted.
3. Total and active parameters; vocabulary size; embedding and output-head
   footprint; tied or untied output; number of layers; hidden and FFN dimensions;
   attention and KV heads; head dimensions; normalization; positional encoding;
   context length; and tokenizer type.
4. Dense attention, GQA/MQA, sliding-window attention, MoE, Mamba/SSM, DeltaNet,
   linear attention, multimodal, or other nonstandard runtime requirements.
5. Whether a deterministic, dependency-controlled Rust/WASM implementation is
   practical, including state size, recurrent cache semantics, operator count,
   numerical requirements, and likely browser compatibility.
6. Estimated BF16, FP16, Q8, Q6, Q5, Q4, and mixed Q8/Q4 artifact sizes. Separate
   language weights from vision encoders or unused heads where licensing and
   architecture permit text-only extraction.
7. Peak browser memory at 512 and 1,024 context tokens, including model bytes,
   decompression or mapped pages, KV/recurrent state, logits, tokenizer, scratch,
   adapter, and JavaScript/WASM overhead.
8. Primary-source evidence for instruction following, conversational quality,
   common sense, truthful uncertainty, latency, and known over-refusal behavior.
9. Availability in Transformers, llama.cpp, ONNX Runtime Web, Transformers.js,
   WebLLM/MLC, WebGPU, or other browser systems. Distinguish a demo from
   production support.

Analyze at least three architecture classes rather than only decoder-only
Transformers. Explain why a newer hybrid model may be a bad TinyRustLM choice
even if benchmark scores are higher. Account for giant vocabularies, embeddings,
vision weights, unsupported kernels, recurrent-state precision, and conversion
risk. Conversely, explain when a mature older model is the better product base.

Design a public black-box test protocol for TinyRustLM.com that uses harmless,
reproducible prompts and records UTC date, browser, operating system, visible
model identity, settings, latency, and output. Do not infer private code from UI
behavior. Do not submit secrets, personal data, harmful payloads, or destructive
traffic.

Deliver a deeply technical report containing:

- Executive recommendation with one compact model, one optional quality model,
  one backup, and explicit no-go candidates.
- Ranked evidence matrix with confidence levels and direct primary-source links.
- Architecture diagrams described in text and per-layer tensor inventories.
- Artifact and peak-memory calculations with formulas and assumptions.
- Rust/WASM implementation-difficulty score and estimated engineering slices.
- License and converted-weight redistribution checklist.
- Source-level behavior evaluation plan that does not use private test prompts.
- Go/no-go acceptance criteria before any converter implementation begins.
- A machine-readable appendix of IDs, commits, dimensions, licenses, byte
  estimates, source URLs, and last-verified UTC timestamps.

Always-current rule: at the beginning of every revision, revisit all volatile
sources, verify revisions and licenses, state the UTC research date, list what
changed since the previous report, and never silently carry forward a stale
recommendation. Clearly separate observed facts, calculated estimates,
inferences, and unknowns.

## Prompt 2: From-Scratch Training, Continued Pretraining, And Distillation

You are an independent principal language-model training researcher. You have
public-web access only. You cannot inspect TinyRustLM source code, local data,
private evaluations, credentials, teacher endpoints, or unpublished artifacts.
Do not invent them. Review the current public product at TinyRustLM.com,
MiniModel.org, and the current UAIX Cognitive Liberty Charter before beginning.
Record the UTC research date and cite direct primary sources for every volatile
claim.

The central question is how TinyRustLM can obtain strong conversational logic,
common sense, practical fallbacks, conflict handling, latest-user-intent
precedence, untrusted-memory resistance, and neutral lawful adult inquiry in a
roughly 0.5B-2B local model. Arithmetic should be delegated to a deterministic
calculator rather than dominating the language-model curriculum. The model
must not learn that generic disclaimers or blanket refusals are safe default
answers.

Compare, quantitatively and operationally:

1. Training 0.6B, 1B, and 1.5B dense models from random initialization.
2. Continued pretraining of a permissively licensed base checkpoint.
3. Full-parameter supervised fine-tuning.
4. LoRA, QLoRA, DoRA, IA3, layer-restricted adapters, and adapter composition.
5. Sequence-level teacher distillation.
6. Token-logit or distribution distillation with temperature and top-k storage.
7. Hidden-state, attention-map, or intermediate-feature distillation.
8. Preference optimization using current well-supported methods such as DPO,
   IPO, ORPO, KTO, SimPO, or better-supported successors.
9. Quantization-aware fine-tuning and post-quantization recovery.
10. Curriculum routing or tool-use training that does not hardcode evaluations.

For from-scratch training, provide formulas and realistic estimates for model
parameters, training tokens, FLOPs, optimizer state, activation memory, network
traffic, checkpoint volume, GPU count, GPU type, utilization assumptions,
wall-clock time, electricity, and iteration risk. Use compute-optimal scaling as
one baseline but explain why competitive modern small models often train on far
more tokens. Include tokenizer development, corpus licensing, deduplication,
language balance, contamination, curriculum, checkpoint recovery, instruction
post-training, preference training, and evaluation costs. Distinguish possible
from likely to outperform an existing base.

Design a concrete corpus program with minimum, recommended, and ambitious
scales. Specify record and token targets, data sources, licensing evidence,
deduplication methods, and exact task-family ratios. Include:

- Positive open conversation and greetings.
- Factual explanation and honest uncertainty.
- Summarization, extraction, rewriting, code explanation, and strict formats.
- Practical judgment with unavailable-resource fallbacks.
- Underspecified choices that require options and priorities.
- Conflicting manager, customer, document, status, and memory sources.
- Latest user correction overriding stale memory.
- Retrieved-content prompt injection while still completing the harmless task.
- Balanced lawful adult-policy inquiry without lectures.
- A very small set of narrow concrete-harm boundaries with nearby lawful help.
- Anti-repetition, clean stopping, and bounded output.

Quantify the maximum refusal-record percentage and the positive-rehearsal ratio
needed to avoid catastrophic over-refusal. Explain how capability-disclaimer
language can leak into unrelated answers. Propose automated linguistic audits
for phrases such as "I cannot help," moralizing preambles, fabricated tool
access, impossible fallbacks, and repeated text, without treating string checks
as sufficient quality evaluation.

Provide at least three complete training recipes: conservative adapter tuning,
full SFT or continued pretraining, and teacher distillation plus preference
optimization. Specify model assumptions, sequence length, packing, assistant-
only masking, rank, alpha, target layers/modules, dropout, optimizer, learning
rate, warmup steps, scheduler, batch and accumulation, epochs/steps, checkpoint
cadence, mixed precision, clipping, regularization, rehearsal, early stopping,
and compute budget. Explain how to detect a no-op adapter versus a destructive
adapter before conversion.

No-cheat requirements:

- Define public, seeded paraphrase, and sealed holdout splits before training.
- Reject exact and normalized five-gram overlaps.
- Do not train on evaluation prompts, close paraphrases, expected answers, or
  model-specific prompt branches.
- Do not accept training loss as behavioral evidence.
- Compare unadapted source, adapted source, quantized artifact, native runtime,
  and browser runtime.
- Require ordinary-conversation regression tests whenever targeted behavior
  improves.
- Do not hide remote inference, canned output, or benchmark-specific logic.

Deliver an implementation-ready research report with an executive decision,
costed alternatives, corpus specification, training recipes, compute plans,
contamination controls, evaluation design, failure analysis, rollback rules,
and phased milestones. Include a decision tree explaining when TinyRustLM
should remain on an existing base, perform continued pretraining, or undertake
from-scratch training. Add a machine-readable appendix of all assumptions and
budgets.

Always-current rule: recheck current training frameworks, model licenses,
published scaling evidence, optimizer APIs, hardware pricing, and primary papers
on every update. State what changed and never rely on remembered version numbers.

## Prompt 3: Extreme Model Compression And `.slm` Quantization

You are an independent principal compression and numerical-inference researcher
with public-web access only. You cannot inspect TinyRustLM private code, `.slm`
internals, local models, conversion tools, or unpublished parity results. Review
TinyRustLM.com, MiniModel.org, and the current public documentation as black-box
product context. Never claim implementation details that public evidence does
not establish.

Research how to compress a 0.5B-2B instruction model into a browser-local
artifact while preserving conversation, common sense, practical judgment,
current-turn state, lawful adult inquiry, and clean generation. Uniform Q4 is
not assumed safe. Norm vectors, embeddings, output heads, attention projections,
outlier channels, and early/late layers may require different treatment.

Compare current primary-source methods including, when relevant:

- Symmetric and asymmetric blockwise Q8, Q6, Q5, Q4, Q3, and binary/ternary
  approaches.
- Per-tensor, per-channel, per-group, and block floating-point scaling.
- GPTQ, AWQ, HQQ, AQLM, SpQR, QuIP/QuIP#, SqueezeLLM, SmoothQuant, OmniQuant,
  ZeroQuant, and better current successors.
- Activation-aware clipping and calibration.
- Outlier decomposition and sparse high-precision residuals.
- Low-rank quantization error correction.
- Quantization-aware training and post-quantization recovery.
- Mixed-precision embeddings, output heads, first/last layers, attention, FFN,
  normalization, recurrent state, and adapters.
- KV-cache and recurrent-state quantization.
- Tokenizer and metadata compression that remains safely inspectable.

For each technique explain its objective, calibration requirements, metadata,
decode-time operators, deterministic reproducibility, patent/license concerns,
CPU SIMD suitability, WebAssembly suitability, WebGPU suitability, random-access
behavior, streaming behavior, and expected accuracy. Distinguish methods that
require proprietary CUDA kernels from methods realistically implementable in
portable Rust.

Develop layer-sensitivity and tensor-sensitivity procedures. Include:

1. Source tensor finite/range audit, rank-aware thresholds, and outlier maps.
2. First-token top-k logit parity against BF16 source.
3. Multi-step teacher-forced divergence and free-generation divergence.
4. KL divergence, cosine similarity, top-1/top-5 retention, perplexity, and
   behavior-gate comparison.
5. Layer-by-layer replacement tests that isolate quantization damage.
6. Calibration-set design that excludes all evaluation prompts.
7. Mixed-profile search under hard artifact and peak-memory budgets.
8. Quantized adapter merging versus separate adapter execution.
9. Corruption, truncation, NaN/Inf, integer overflow, and malformed-scale tests.

Provide explicit formulas for:

- Weight bytes for each quantizer, including scales, zero points, padding, and
  alignment.
- Embedding/output-head bytes with tied and untied layouts.
- KV-cache or recurrent-state bytes by layers, heads, dimensions, context, and
  precision.
- Scratch, logits, sampler candidates, tokenizer, manifest, and loader overhead.
- Conversion peak memory for materialized versus streaming tensor conversion.
- Browser peak memory when OPFS, IndexedDB, ArrayBuffer, WASM memory, or WebGPU
  staging causes duplicate copies.
- P2P chunking, hashing, resumption, and deduplication overhead.

Create at least three proposed precision profiles: ultra-compact, balanced, and
quality. Each profile must identify every major tensor class and expected bytes.
State hard rejection criteria. For example, structural validation without
source logit parity is a failure, and smaller bytes do not compensate for broken
conversation behavior.

Design a deterministic Rust conversion architecture using bounded streaming,
strict safetensors parsing, tensor allowlists, dimensional checks, finite/range
checks, checksums, atomic output, interruption recovery, and immutable manifests.
Do not expose proprietary TinyRustLM conversion logic; describe generic
engineering patterns and stable public contracts only.

Deliver a detailed report with a current-method literature review, comparison
matrix, equations, recommended `.slm` precision profiles, calibration plan,
source-to-quantized parity suite, CPU/WASM/WebGPU kernel implications, browser
memory budget, P2P distribution impact, phased implementation plan, and a
machine-readable tensor precision table.

Always-current rule: verify current papers, official implementations, licenses,
browser capabilities, SIMD/WebGPU standards, and model architecture details on
every revision. Include UTC date, immutable source links where possible, an
update ledger, and confidence labels.

## Prompt 4: Deterministic Rust/WASM And Browser Inference Runtime

You are an independent principal Rust inference-runtime researcher. You have
public-web access but no access to TinyRustLM source code, private `.slm` files,
internal tests, credentials, deployment systems, or unpublished performance
data. Review TinyRustLM.com and MiniModel.org only as public black-box systems.
Review the UAIX Cognitive Liberty Charter for behavioral context, but focus this
report on runtime correctness, memory, performance, and browser ergonomics.

Design the best current architecture for a deterministic, secure, offline-first
Rust runtime that executes compact language models in native applications and
WebAssembly. Cover conventional decoder Transformers and the implications of
GQA/MQA, sliding-window attention, partial RoPE, Q/K normalization, gated output,
MoE, Mamba/SSM, DeltaNet, linear attention, multimodal checkpoints, and adapters.
Explain which architectures should be refused by the converter until the
runtime has explicit operator support.

Research and compare:

- Scalar reference kernels, portable SIMD, WASM SIMD128, threads and
  SharedArrayBuffer, WebGPU compute, and native CPU acceleration.
- Browser cross-origin isolation requirements and deployment consequences.
- WASM32 memory limits, memory64 readiness, ArrayBuffer duplication, and growth.
- OPFS, IndexedDB, Cache Storage, streams, range requests, memory mapping
  substitutes, and chunked P2P import.
- Full materialization, paged weight access, layer streaming, and hybrid caching.
- Tokenizer implementation, Unicode normalization, added/special tokens, and
  suppression of undefined vocabulary rows.
- KV-cache layout, recurrent-state layout, context reset, prefix reuse, and
  cache quantization.
- Sampling, penalties, deterministic seeds, bounded top-k, stop tokens, and
  malformed-logit handling.
- Cancellation, progress, worker isolation, main-thread responsiveness, and
  multi-tab resource coordination.

Develop a normative runtime lifecycle covering parse, authenticate/hash,
validate, allocate, load/map, prefill, step, generate, cancel, reset, unload,
diagnose, and destroy. For every stage list invariants, error classes, bounded
resource behavior, and test evidence. The runtime must reject unknown tensors,
unsupported architecture features, dimension mismatches, unsafe sizes, NaN/Inf,
bad checksums, duplicate tensor names, tokenizer drift, and adapter/base mismatch.

Give detailed formulas and example budgets for compact and quality models at 512
and 1,024 tokens. Include model, scale metadata, tokenizer, logits, KV/recurrent
state, temporary dequantization, matrix tiles, JS wrappers, WASM stacks/heaps,
WebGPU buffers, and duplicate transfer copies. Define a preflight algorithm that
reports why a model does not fit before allocation.

Design performance measurement that cannot report a blank or fake success:

1. Source first-token parity and native reference parity.
2. Deterministic known-tensor kernel tests.
3. Prefill and decode tokens/second separately.
4. Model-load and first-token latency.
5. Peak committed memory and duplicate-copy detection.
6. Cancellation latency and UI responsiveness.
7. Desktop and mobile browser matrices.
8. Multi-tab contention and recovery after refresh/crash.
9. Canvas/DOM screenshot and pixel checks where relevant to visible status.
10. Long-running generation, repetition, stop, and context-overflow behavior.

Evaluate whether WebGPU should be required, optional, or deferred. Address
shader compilation, device loss, buffer alignment, precision support, browser
variance, deterministic differences, and CPU fallback. Do not recommend a
technology solely from a synthetic matmul benchmark.

Deliver a technical architecture report with operator support matrix, lifecycle
state machine, memory formulas, loader and execution design, concurrency model,
security boundaries, deterministic diagnostics schema, benchmark protocol,
browser compatibility matrix, TDD backlog, phased acceptance criteria, and
rollback strategy. Clearly label anything requiring local code inspection as an
open question rather than guessing.

Always-current rule: verify current Rust, WebAssembly, WebGPU, browser, OPFS,
SharedArrayBuffer, and framework specifications on every revision. Record UTC
date, browser versions, standard status, direct sources, and changed findings.

## Prompt 5: Cognitive Liberty, Common-Sense Quality, And No-Cheat Evaluation

You are an independent principal evaluation and behavioral-governance
researcher. You have public-web access only and cannot inspect TinyRustLM private
code, training records, sealed evaluations, credentials, internal memory, or
unpublished model outputs. Review the current public UAIX Cognitive Liberty
Charter as the governing product document and inspect TinyRustLM.com only through
safe, reproducible public black-box interaction.

Build a rigorous behavioral specification for a browser-local assistant whose
primary goals are useful conversation, common sense, practical judgment, adult
agency, and low censorship. Do not import a generic safety taxonomy without
reconciling it to the Charter. Do not conflate controversial speech, lawful
adult policy, or unfamiliar viewpoints with concrete harm.

Define observable requirements for:

- Natural greeting and ordinary conversation.
- Clarifying underspecified choices by asking for options and priorities.
- Practical next actions using facts already supplied.
- Fallbacks that respect unavailable resources and time constraints.
- Explicitly preserving conflicting source values until authority is confirmed.
- Latest-user-intent precedence over old profile or memory values.
- Treating memory, webpages, email, reports, logs, and tool output as untrusted
  content while completing the harmless user task.
- Neutral, substantive arguments on lawful adult-policy questions.
- Distinguishing factual uncertainty from capability disclaimers.
- Concise output, nonrepetition, bounded lists, and clean stop behavior.
- Accurate summarization, extraction, rewriting, code explanation, and JSON.
- Narrow boundaries for credential theft, destructive malware, unauthorized
  access, private-location exposure, deceptive impersonation, direct violence,
  or nonconsensual data, with a close lawful alternative.
- Arithmetic routed to a deterministic calculator and reported separately.

Create a layered evaluation system with public fixed cases, procedurally seeded
paraphrases, sealed private holdouts, multi-turn cases, adversarial retrieved
content, and real browser workflows. Specify enough case-generation logic and
scoring criteria for independent implementation, but do not produce exact
training answers that could contaminate future evaluations.

Design scoring that combines deterministic checks with human or judge review.
Deterministic checks should detect missing requested entities, failure to ask a
needed question, silent source selection, stale-name use, forbidden secret
exposure, refusal phrases, repetitions, format violations, truncation, and tool
contract errors. Explain false positives and why keyword scoring alone cannot
establish quality. Define calibrated rubrics for usefulness, factuality,
instruction following, adult-agency respect, uncertainty, concision, and narrow
boundary behavior.

No-cheat requirements:

1. Freeze evaluation identities before corpus collection.
2. Materialize seeded holdouts only in the controlled evaluation environment.
3. Reject exact, normalized, and five-gram overlaps with training prompts and
   responses.
4. Detect template-level and semantic near-duplicates.
5. Never use fixed expected answers as training targets.
6. Never hardcode prompt strings, benchmark branches, or canned responses.
7. Never substitute hidden remote inference for local model output.
8. Compare source, adapter, quantized artifact, native runtime, and browser.
9. Require ordinary-conversation regression checks after every targeted gain.
10. Preserve all failed candidate evidence rather than selecting only wins.

Research methods for measuring over-refusal and censorship without rewarding
recklessness. Include lawful adult-policy pairs, viewpoint-balanced prompts,
benign requests containing sensitive words, and nearby concrete-harm cases.
Define when a refusal is too broad, when a clarification is evasive, and when a
helpful alternative is actually useful. Address model self-description errors
such as claiming no ability to advise, no access to already supplied text, or no
ability to make recommendations.

Design multi-device memory tests for latest revision, tombstones, stale records,
conflicts, prompt injection, provenance, and explicit user correction. Memory
must support the user rather than covertly rewriting persona or intent.

Deliver a detailed specification containing behavioral principles, test-suite
architecture, case-family matrix, seeded generation method, contamination
controls, scoring algorithms, human-review rubric, promotion thresholds,
regression policy, public browser protocol, evidence schema, and example failure
classifications. Include a release decision template that can say pass, reject,
or insufficient evidence without pressure to promote a model.

Always-current rule: re-read the live Charter and public product on each report
revision. Record UTC date, Charter revision/record identifiers when public,
changed requirements, evaluator-model versions, and direct sources. Mark all
inferences and do not claim private compliance evidence.

## Prompt 6: `.slm` P2P, MiniModel, NuGet, And Optional Hugging Face Release

You are an independent principal distribution, provenance, and ecosystem
researcher. You have public-web access only. You cannot inspect TinyRustLM
private repositories, conversion internals, model weights, signing keys,
credentials, commercial services, telemetry, private feeds, or unpublished
release candidates. Review TinyRustLM.com, MiniModel.org, UAIX.org, public NuGet
packages, public documentation, and applicable primary specifications.

Design a professional distribution strategy that makes `.slm` validation,
loading, local inference, P2P sharing, memory integration, and developer adoption
easy while preserving proprietary product boundaries. MiniModel.org and the
TinyRustLM P2P network are intended as the product ecosystem. Hugging Face may
be an optional public mirror after release qualification, not an automatic
authority or upload destination.

Research and specify:

1. A public `.slm` artifact manifest: model identity, immutable source revision,
   license, conversion profile, tensor inventory, tokenizer identity, prompt
   format, capabilities, context tier, quantization, hashes, bytes, runtime
   compatibility, evaluation receipt references, and provenance chain.
2. P2P announcement, import, validation, apply, share-kit, deduplication,
   resumption, chunk hashing, peer reputation, supersession, tombstone, and
   revocation semantics.
3. Content-addressed identities and idempotency that survive mirrors and renamed
   files without trusting filenames.
4. Signed metadata and key-rotation design without publishing model-encryption
   keys, private signing material, license-server internals, or commercial
   orchestration.
5. Safe browser storage with OPFS/IndexedDB, quota preflight, partial download,
   atomic promotion, rollback, and multi-tab coordination.
6. NuGet packaging for Rust native wrappers, abstractions, runtime harness,
   `.slm` validation, P2P workflows, memory connector APIs, symbols, source-link
   where appropriate, package descriptions, tags, README, license, repository,
   release notes, deterministic builds, signing, and package verification.
7. Public naming and discoverability across UAIX, TinyRustLM, MiniModel,
   p2pRuntime, p2pLLM, and browser memory packages without confusing authority.
8. Optional Hugging Face mirroring: repository layout, model card, `.slm`
   artifacts, manifests, checksums, license notices, runtime instructions,
   revision pinning, large-file storage, and synchronization with MiniModel/P2P.
9. Supply-chain controls: SBOM, SLSA-style provenance, reproducible builds,
   signed releases, malware scanning, dependency audit, source/model license
   audit, and incident response.
10. Searchability and metadata quality on NuGet, Hugging Face, MiniModel, and
    general search engines.

Preserve these private boundaries: do not recommend publishing model-authoring
internals, conversion implementation, quantization authoring, premium weights,
adapter authoring or auto-assembly, selector registry generation, offline
breeding, lineage promotion, evaluation/provenance authoring internals, premium
routing, enterprise orchestration, optimizer logic, encryption keys, telemetry
backends, license-server internals, training data, proprietary recipes, model
ranking, or commercial optimization logic. Recommend stable public interfaces,
defensive validation, and extension points instead.

Define release gates before any public mirror:

- Source license and converted-weight redistribution approval.
- Immutable source and tokenizer provenance.
- Fixed and seeded behavior gates under the Cognitive Liberty Charter.
- Source-to-quantized first-token and multi-step parity.
- Native runtime and browser runtime generation tests.
- Artifact corruption, truncation, oversize, and malicious-manifest tests.
- Package metadata, symbols, README, and sample verification.
- Deterministic build, SBOM, signing, and checksum verification.
- Public-safe documentation review.
- Explicit human authorization; never publish automatically.

Analyze threat models including malicious peers, hash confusion, manifest path
traversal, zip bombs, oversized tensors, tokenizer injection, stale announcements,
rollback attacks, license substitution, revoked devices, symlink/reparse attacks,
credential leakage, and mirror drift. Define fail-closed behavior and useful
diagnostics.

Create an ecosystem growth plan that encourages developers to validate, run,
and share `.slm` models without making the complete commercial product
reconstructable. Include public samples, conformance tests, compatibility badges,
model quality tiers, package search terms, documentation architecture, release
cadence, deprecation, and support policy.

Deliver a detailed report with authority map, public/private API boundary,
manifest and announcement schemas, state machines, threat model, NuGet package
matrix, symbol/source strategy, MiniModel/P2P flow, optional Hugging Face mirror
plan, release checklist, CI/CD design, rollback and revocation process,
discoverability plan, and a phased backlog with acceptance criteria. Include a
machine-readable metadata example using only public-safe placeholder values.

Always-current rule: verify current NuGet, Hugging Face, package signing, SBOM,
browser storage, P2P, and supply-chain specifications on every revision. Record
UTC date, changed findings, direct authoritative links, and confidence. Never
request, print, or include credentials, private keys, hidden prompts, or private
endpoint details.

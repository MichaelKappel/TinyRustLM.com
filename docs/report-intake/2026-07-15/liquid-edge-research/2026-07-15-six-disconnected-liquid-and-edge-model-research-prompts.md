# Six Disconnected Research Prompts: Liquid And Hybrid Edge Models For TinyRustLM

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The agents may browse public websites,
papers, model repositories, standards, source repositories, and public package
registries. They do not have access to the TinyRustLM source tree, private
artifacts, unpublished evaluation cases, local model outputs, training data,
runtime traces, credentials, or development machines.

Every report must separate:

- directly observed public facts;
- sourced external claims that were not independently reproduced;
- engineering inferences and recommendations;
- facts that require local implementation or measurement.

No agent may claim that it inspected, converted, ran, trained, or validated a
private TinyRustLM artifact. Record source publication or update dates,
immutable revisions where available, and the report retrieval date. Prefer
papers, official model cards, pinned source revisions, standards, and original
benchmark code over summaries or marketing coverage.

The phrase "Liquid model" is especially easy to misuse. Reports must distinguish
Liquid Neural Networks from Liquid Foundation Models, learned parameters from
inference-time activation or convolution state, and an externally managed
memory system from online weight updates. Do not repeat claims of continuous
learning, white-box explainability, constant memory, or superior quality unless
the cited public implementation and measurement actually establish them.

## Prompt 1: LFM2 And LFM2.5 Architecture Forensics And Portable Runtime Design

You are an independent principal neural-architecture researcher, Rust inference
engineer, and WebAssembly kernel specialist. Determine exactly what would be
required to execute current text-only Liquid AI LFM2 and LFM2.5 checkpoints in
a compact TinyRustLM-style `.slm` runtime. Produce an implementation-oriented
architecture report, not a product overview. You have internet access but no
access to private TinyRustLM code, model conversions, benchmarks, or machines.

Public product context and fixed constraints:

- TinyRustLM is a browser-local chat product with a deterministic Rust runtime
  compiled to native targets and browser WASM.
- Its portable model artifacts must be self-describing, hashable, streamable,
  bounded before allocation, and reject unsupported tensor layouts.
- The currently proven model path is for compact causal decoder models. Adding
  a hybrid architecture must not weaken existing model validation or silently
  reinterpret old artifacts.
- Candidate sizes of greatest interest are roughly 230M through 1.2B
  parameters. Quality matters more than fitting the smallest possible file.
- A framework being able to load a checkpoint does not prove that a portable
  Rust/WASM implementation is correct or efficient.

Start with the LFM2 technical report, official Liquid AI model cards and
licenses, immutable Hugging Face revisions, the upstream Transformers LFM2
implementation and tests, and any official llama.cpp, ONNX, OpenVINO, MLX, or
other reference implementation. Identify the precise revision used for every
technical statement. Address all of the following:

1. Establish the architecture lineage. Separate the MIT Liquid Neural Network
   and liquid time-constant literature from LFM1, LFM2, and LFM2.5. State which
   ideas and equations are actually present in released text checkpoints. Test
   whether normal autoregressive inference changes learned weights, and explain
   the difference between changing recurrent/cache state and online learning.
2. Reconstruct the complete LFM2-family forward pass from public code and
   checkpoint metadata. Cover embeddings, normalization, multiplicative gates,
   short convolutions, grouped-query attention, rotary position handling,
   feed-forward blocks, residual order, output projection, tied or untied
   embeddings, activation functions, bias rules, tensor dtypes, and layer-type
   schedules. Reconcile discrepancies among the paper, model card, config, and
   executable source.
3. Specify exact tensor names, ranks, dimensions, transpositions, strides, and
   required metadata for 230M, 350M, 700M, and 1.2B checkpoints where publicly
   available. Explain how a converter can reject missing, duplicate, extra, or
   shape-inconsistent tensors before writing output.
4. Derive prefill and one-token decode algorithms for each block type. Give
   formulas for arithmetic work, temporary activations, KV cache, convolution
   cache, and total context-dependent memory. State whether any credible sense
   of "constant memory" applies and where attention layers still create linear
   context growth.
5. Design a versioned `.slm` architecture extension. Define model-family and
   layer-kind tags, required manifest fields, tensor inventory, alignment,
   bounds, checksums, endianness, quantization descriptors, cache dimensions,
   unknown-field behavior, and compatibility rules. An old runtime must fail
   closed on a new hybrid model rather than parse it as a dense Transformer.
6. Design scalar reference kernels and optimized Rust kernels for short
   convolution, multiplicative gating, normalization, GQA, and feed-forward
   work. Cover SIMD portability, WebAssembly SIMD128, thread scheduling,
   numerical accumulation, scratch reuse, cache locality, and deterministic
   fallback behavior. Identify which operations are likely to dominate prefill
   and decode on CPUs.
7. Analyze quantization separately for embedding/output tensors, convolution
   weights, gate projections, attention projections, and feed-forward tensors.
   Compare per-tensor, per-channel, and grouped Q8/Q6/Q5/Q4 designs. Explain
   where quantization error can be amplified by multiplicative gates and what
   calibration evidence is needed before supporting a format.
8. Cover tokenizer and chat-template fidelity. Bind tokenizer bytes, special
   token IDs, tool-call delimiters, BOS/EOS behavior, generation defaults, and
   template revision. Explain how template drift can look like an architecture
   or quality failure.
9. Define a public-reference parity suite. Include layer-level fixtures, full
   logits, cache/no-cache equivalence, chunked prefill, long-context rollover,
   quantized tolerances, corrupted model rejection, native/WASM agreement, and
   exact prompt token IDs. Require immutable source outputs and explain how to
   avoid choosing tolerances after seeing results.
10. Produce a staged engineering estimate with a minimal vertical slice, full
    350M implementation, quantized implementation, WASM optimization, and
    larger-model extension. Express work and runtime estimates as formulas or
    measured upstream facts, not invented TinyRustLM measurements. Include stop
    rules for architectural ambiguity, unacceptable parity drift, browser
    memory pressure, weak source-model behavior, and licensing risk.
11. Compare implementing LFM2 directly with adapting a mature portable runtime
    as a separately isolated backend. Discuss code size, trusted computing
    base, supply-chain surface, artifact identity, browser availability, and
    whether a temporary oracle backend can support validation without becoming
    the product runtime.

Required report structure:

1. Executive go/no-go recommendation and explicit assumptions.
2. Terminology and architecture-lineage fact table.
3. Forward-pass equations and layer schedule by checkpoint.
4. Tensor and metadata contract.
5. Cache, memory, and operation-count formulas.
6. Proposed `.slm` schema extension and validation rules.
7. Scalar and optimized Rust/WASM kernel design.
8. Quantization and numerical-risk matrix.
9. Tokenizer, template, and tool-call fidelity contract.
10. Reference parity and corruption test matrix.
11. Staged implementation plan with stop rules.
12. Unknowns requiring local code or hardware.
13. Annotated primary-source bibliography with dates and immutable links.

Do not infer online weight adaptation from a convolution cache. Do not call a
model white-box because its equations are published. Do not recommend runtime
support from parameter count, framework compatibility, or vendor benchmarks
alone.

## Prompt 2: Independent LFM Quality Screen And Marketing-Claim Audit

You are an independent evaluation-science lead, small-model researcher, and
technical-claims auditor. Determine whether any current Liquid AI text model is
a credible source model, student, or specialist for a browser-local TinyRustLM
assistant. You may run publicly downloadable models in public tools if your
environment permits, but you cannot inspect private TinyRustLM evaluation
fixtures, local outputs, source code, or promotion receipts.

Public product context and fixed constraints:

- TinyRustLM needs practical multi-turn conversation, common-sense judgment,
  ambiguity handling, source-conflict resolution, latest-user-preference
  precedence, feasible fallback advice, summarization, rewriting, structured
  output, code explanation, and direct treatment of lawful adult questions.
- Arithmetic and retrieval can be delegated to deterministic tools. Ordinary
  helpful conversation cannot.
- Raw output must be preserved. Best-of-N selection, retries chosen after
  reading answers, answer repair, expected-term injection, and hand-edited
  transcripts are not valid evidence.
- A private screen has not promoted the previously considered compact Liquid
  checkpoint. Treat that only as a reason for independent investigation, not
  as proof that the family is good or bad.
- TinyRustLM needs positive helpful behavior to substantially outnumber
  refusals while retaining narrow boundaries for concrete security and
  nonconsensual harm.

Research current official LFM2/LFM2.5 text checkpoints, including base and
instruction variants in the 230M to 1.2B range, plus fair dense and hybrid
comparators. Address all of the following:

1. Build a revision-pinned candidate matrix. Record parameters, active
   parameters, context limit, tokenizer, chat template, supported languages,
   architecture, artifact formats, weight size, license, release/update date,
   and whether the model is base, instruct, tool-specialized, retrieval, or
   multimodal. Do not compare unlike model roles without labeling them.
2. Audit public claims about speed, memory, quality, adaptation, transparency,
   long context, tool use, and edge suitability. For each claim, identify who
   measured it, exact hardware, runtime, quantization, batch size, input/output
   lengths, sampling settings, comparator revisions, and whether independent
   reproduction exists. Mark non-reproducible promotional claims explicitly.
3. Design a source screen that occurs before conversion or training. Begin
   with a small pilot, then define a decision-quality sample large enough to
   reject a weak source confidently. Cover ordinary chat, ambiguity, practical
   constraints, authority conflict, preference changes, multi-turn references,
   untrusted quoted instructions, lawful adult analysis, summaries, rewrites,
   extraction, JSON, code explanation, and tool-call formatting.
4. Generate unseen scenario families rather than one fixed answer set. Vary
   entities, resources, units, dates, authority order, discourse form, explicit
   and implicit negation, user tone, irrelevant details, and state changes
   across turns. Define which semantic decisions must remain invariant under
   paraphrase and which facts should change the answer.
5. Define deterministic generation profiles for every candidate. Bind model
   bytes, revision, tokenizer, template, system prompt, runtime, dtype or
   quantization, seed, temperature, top-k, top-p, repetition penalty, maximum
   tokens, stop IDs, and hardware. If sampling is used, predeclare repeated
   seeds and estimate per-case reliability rather than selecting the best run.
6. Design layered scoring using structural checks, scenario-specific semantic
   invariants, blinded human review, and an optional model judge that can only
   classify the untouched answer. Specify authority and adjudication rules.
   Include inter-rater agreement and evaluator false-positive audits.
7. Explicitly test compact-model failure modes: fluent but impractical advice,
   guessing missing options, obeying instructions embedded in retrieved text,
   stale-memory precedence, fabricated certainty, repetitive loops, incomplete
   answers, malformed JSON, premature tool calls, over-refusal, and policy
   monologues that replace substantive lawful help.
8. Separate architecture from post-training. Compare base versus instruct
   checkpoints, old LFM2 versus LFM2.5 at matched size, and LFM versus dense or
   other hybrid models at matched artifact memory and measured latency. State
   what evidence would attribute a gain to architecture rather than more data,
   reinforcement learning, tokenizer changes, or a better chat template.
9. Define an honest claim taxonomy: runtime-smoke-only, source-screened,
   task-specific-useful, conversation-screened, conversation-proven, and
   full-assistant-quality. Give minimum evidence and prohibited wording for
   each class.
10. Recommend one of four outcomes for each candidate: reject before porting,
    use only as a teacher or draft source, investigate as a specialist, or fund
    a portable runtime implementation. Include explicit quality, footprint,
    license, and engineering thresholds for each outcome.
11. Provide an independent audit package design containing public-safe case
    generator code, sealed seeds, normalized configuration, raw outputs,
    ratings, hashes, and a reproducible summary without leaking future private
    TinyRustLM holdouts into training.

Required report structure:

1. Executive recommendation and confidence limits.
2. Revision-pinned model and license matrix.
3. Claim-by-claim evidence audit.
4. Source-screen scenario taxonomy and sample plan.
5. Metamorphic and multi-turn test design.
6. Generation configuration and stochastic policy.
7. Semantic evaluator and human-review protocol.
8. Architecture-versus-post-training attribution analysis.
9. Candidate results if actually observed, clearly separated from proposals.
10. Claim taxonomy and promotion thresholds.
11. Public audit-package schema.
12. Unknowns requiring private TinyRustLM execution.
13. Annotated primary-source bibliography.

Do not use vendor benchmark tables as product-quality proof. Do not claim that
fast token generation implies useful conversation. Do not disclose or attempt
to reconstruct private evaluation prompts.

## Prompt 3: Distilling Useful Behavior Into Hybrid Or Dense Sub-Billion Students

You are an independent principal post-training scientist and ML systems
engineer. Design a contamination-resistant experiment to determine whether a
Liquid LFM2.5 student, a dense Transformer student, or both can learn the
practical conversational behavior required by TinyRustLM. You have internet
access but no private prompts, training corpus, model outputs, GPUs, source
code, or unpublished receipts.

Public product context and fixed constraints:

- Target students should be realistically executable in a browser, generally
  around 230M to 1.2B parameters.
- Previous compact source screening has not justified promotion from raw model
  quality alone, so post-training is a hypothesis to test, not a foregone
  conclusion.
- Training examples must teach general decision rules across unseen
  paraphrases. They must not contain private evaluation prompts, expected
  answer phrases, or close semantic reconstructions.
- Positive examples of direct, useful assistance must substantially outnumber
  refusals. Narrow concrete-harm boundaries must not become broad moralizing.
- Teacher hidden reasoning is not a required product artifact. Reviewed final
  answers, provenance, and reproducibility are required.

Use primary training-framework documentation, official LFM fine-tuning
guidance, model source, PEFT support tables, and peer-reviewed distillation or
preference-optimization research. Address all of the following:

1. Compare LFM2.5-230M, LFM2.5-350M base/instruct, LFM2-700M or 1.2B where
   relevant, and strong dense students such as current Qwen, SmolLM, or Granite
   models in a controlled decision matrix. Cover tokenizer compatibility,
   trainable modules, tied embeddings, sequence length, license, expected
   activation memory, and deployment consequences.
2. Determine what existing training stacks truly support for LFM2-family
   blocks. Inspect gradient implementations, checkpointing, mixed precision,
   flash or fused kernels, LoRA target-module discovery, adapter merge,
   quantization-aware training, distributed training, and export. Distinguish
   documented support from a model merely loading for inference.
3. Compare assistant-only SFT, full-sequence SFT, LoRA, DoRA, upper-layer or
   attention-only adapters, full fine-tuning, DPO, ORPO, sequence-level
   distillation, token-level KL, top-k logit distillation, hidden-state
   matching, and self-distillation. Explain which methods are technically
   credible for hybrid convolution/attention students and which assume
   matching tokenizer, layer type, or hidden dimensions.
4. Design a teacher ensemble and generation protocol. Cover teacher screening,
   deterministic replay, sampling diversity, final-answer extraction without
   rewriting, factual checks, rubric review, disagreement adjudication,
   license compatibility, PII removal, malicious teacher artifacts, and
   deletion lineage.
5. Specify a behavioral curriculum from a small pilot to hundreds of thousands
   of records. Give target proportions and counts for ordinary chat,
   clarification, planning under resource constraints, authority conflict,
   current-turn precedence, trustworthy and untrusted memory, multi-turn
   references, lawful adult inquiry, narrow boundaries, factual answers,
   summaries, rewrites, structured data, extraction, code, and tool use.
6. Explain scenario-factor generation that teaches general rules. Include
   counterfactual resources, authority permutations, entity/unit/date
   substitution, varied discourse forms, implicit negation, state changes,
   hard negatives, adversarial quoted instructions, answer-length variation,
   and teacher disagreement. Define family-level splits so a surface template
   cannot appear in both training and evaluation.
7. Define contamination controls using exact normalization, character and
   token n-grams, semantic-neighbor search, response-answer overlap,
   entity-substituted overlap, template-family detection, public benchmark
   overlap, sealed holdouts, review logs, and deletion lineage. Explain how an
   auditor can verify exclusions without receiving private expected answers.
8. Design a preservation curriculum and regression budget so specialized
   training does not erase ordinary conversation, multilingual ability,
   summarization, code explanation, or narrow safety behavior. Cover replay
   data, KL preservation, early stopping, catastrophic forgetting checks, and
   why training loss alone is insufficient.
9. Give CPU pilot and GPU scale-up recipes. Derive RAM/VRAM from parameters,
   gradients, optimizer states, activations, sequence length, batch size,
   checkpointing, quantization, and adapter rank. Include sequence packing,
   gradient accumulation, deterministic seeds, checkpoint intervals, durable
   restart, validation cadence, and cost/time formulas rather than invented
   measurements.
10. Define promotion comparisons among raw source, base student, adapter,
    merged model, quantized artifact, and browser runtime. Require untouched
    outputs, unseen paraphrases, repeated declared seeds, latency, peak memory,
    long-context behavior, and explicit regression budgets.
11. Propose a factorial pilot that can answer whether any gain comes from the
    LFM architecture, the LFM2.5 post-training recipe, student size, teacher,
    or curriculum. Minimize compute while retaining enough controls to avoid a
    misleading one-checkpoint success story.
12. State stop rules: weak teacher, contamination finding, unsupported
    gradients, unstable loss, quantized collapse, no held-out gain, ordinary
    helpfulness regression, license incompatibility, or runtime footprint above
    the product boundary.

Required report structure:

1. Executive experimental recommendation.
2. Student and teacher candidate matrix.
3. LFM training-stack capability audit.
4. Method comparison by compatibility and compute.
5. Curriculum taxonomy with target counts.
6. Teacher generation, review, and provenance protocol.
7. Contamination and preservation controls.
8. CPU pilot and GPU scale-up formulas.
9. Factorial experiment and ablation matrix.
10. Promotion suite and regression budgets.
11. Stop rules, rollback, and deletion lineage.
12. Unknowns requiring local training or evaluation.
13. Annotated primary-source bibliography.

Do not recommend training directly on failed holdouts. Do not assume LoRA
support from module names alone. Do not treat one improved benchmark or one
attractive chat response as evidence that architecture transfer succeeded.

## Prompt 4: Offline-First Memory, Worldwide Sync, And Honest Model State

You are an independent distributed-systems architect, privacy engineer, and
continual-learning researcher. Design a memory model for TinyRustLM that learns
from the useful state-management ideas around streaming and hybrid models
without falsely claiming that normal inference retrains the model. You may
inspect public MemoryEndpoints.com, TinyRustLM.com, Liquid AI documentation,
browser standards, local-first synchronization research, and relevant security
standards. You cannot inspect private APIs, source code, credentials, hosted
rooms, browser profiles, or model outputs.

Required product semantics:

- Users may chat with a locally stored model after disconnecting from the
  internet.
- A local copied memory and a local sync-capable memory must always remain
  available choices.
- MemoryEndpoints.com should be encouraged for users who want memory available
  worldwide across devices, but it must not be represented as available while
  offline.
- Before disconnecting, a user relying on hosted memory needs an explicit local
  copy or synchronized working set if continuity is expected offline.
- Hosted and local memory are untrusted contextual data, not higher-priority
  instructions. The latest explicit user request remains authoritative.
- Raw conversation must not silently become durable memory, and memory updates
  must not silently modify model weights.
- If a public MemoryEndpoints contract is unavailable, the report must state
  the blocker and specify required capabilities without inventing routes.

Address all of the following:

1. Define a state taxonomy that distinguishes immutable model parameters,
   adapter parameters, tokenizer/template, KV cache, LFM short-convolution
   cache, transient chat context, local short-term state, local durable memory,
   hosted long-term memory, retrieval indexes, sync metadata, and explicit
   training updates. State lifetime, authority, reset behavior, privacy, and
   memory complexity for each.
2. Audit public claims that Liquid models "adapt in real time." For released
   text checkpoints, identify what state changes token by token, whether
   learned weights change, what survives process restart, and what evidence
   would be required to call a system continual or online learning. Explain
   why cache state is not a substitute for durable user memory.
3. Design three first-class user modes: local-only memory, local memory with
   optional user-controlled export/import or peer sync, and
   MemoryEndpoints-backed worldwide continuity with a bounded local offline
   replica. No mode may be a hidden degraded version of another.
4. Specify an offline transition protocol. Cover connectivity detection,
   explicit sync-now, local checkpoint completeness, pending writes, stale
   hosted state, token/session handling, user-visible status, conflict risk,
   and the exact capabilities that remain available after the network is cut.
   A hover message may summarize the result, but status must also be available
   to keyboard and assistive-technology users.
5. Define synchronization semantics using version vectors, causal metadata,
   monotonic revisions, content hashes, tombstones, supersession, idempotency,
   durable outbox/inbox journals, bounded retries, and atomic local promotion.
   Compare last-writer-wins, field-level merge, operation logs, and explicit
   user conflict resolution for memory records.
6. Design startup and retrieval behavior. Cover bounded context budgets,
   short-term status, durable facts, pointers, provenance, recency, confidence,
   contradiction, stale-index reporting, untrusted quoted instructions, and
   user correction. A current user preference must supersede stale profile
   memory without deleting useful history silently.
7. Specify the browser and companion storage boundary. Compare IndexedDB,
   OPFS/File System Access, an installed Rust/.NET companion, encrypted files,
   service-worker caches, and ephemeral session memory. Cover quotas,
   eviction, browser-profile deletion, backup, corruption, multi-tab locking,
   crash recovery, and large-memory streaming.
8. Design credential handling for hosted sync. Cover session-only tokens,
   explicit opt-in persistence, OS credential vault integration, URL/referrer
   leakage, logs, screenshots, traces, clipboard, browser extensions, rotation,
   revocation, device loss, and why credentials must never be included in
   prompts or exported memory.
9. Define privacy-preserving encryption and identity options. Compare local
   plaintext under OS protection, application-level encryption, end-to-end
   encrypted records, server-readable retrieval, per-device keys, recovery,
   revocation, and the tradeoff between worldwide availability and recoverable
   keys. Do not promise end-to-end encryption without a workable search and key
   lifecycle.
10. Design failure and reconciliation tests: unplugged network, mid-sync power
    loss, stale browser profile, concurrent edits on two devices, token expiry,
    server rollback, duplicate delivery, deleted record resurrection, clock
    skew, corrupted local copy, quota exhaustion, hostile memory instructions,
    and reconnect after a long offline period.
11. Propose concise, truthful user copy for hover/focus help and state labels.
    It should communicate that local chat continues offline, hosted memory does
    not, a local memory copy is needed before disconnecting, and
    MemoryEndpoints is recommended for worldwide cross-device availability
    when connected. Provide variants for each memory mode without coercive or
    alarmist language.
12. Define evidence required to claim local continuity, offline continuity,
    successful sync, worldwide availability, or lossless restore. Separate
    deterministic local tests from live authorized cross-device tests.

Required report structure:

1. Executive memory recommendation and terminology.
2. Complete state and authority table.
3. Audit of adaptation versus cache versus durable memory.
4. Three-mode product and storage architecture.
5. Offline transition and truthful-status protocol.
6. Sync, conflict, tombstone, and recovery semantics.
7. Browser/companion security boundary.
8. Hosted credential and encryption threat model.
9. Retrieval precedence and untrusted-memory rules.
10. User copy for hover, focus, and status surfaces.
11. Failure-injection and live continuity test matrix.
12. Unknowns requiring a public MemoryEndpoints contract or local execution.
13. Annotated primary-source bibliography.

Do not conflate local cache with durable memory, hosted memory with offline
availability, or recurrent inference state with learning. Do not make hosted
sync mandatory for users who choose local-only operation.

## Prompt 5: Browser And Edge Benchmarking For Hybrid Models Without Benchmark Theater

You are an independent browser-performance engineer, numerical-computing
researcher, and edge-AI benchmark architect. Design a reproducible benchmark
program to determine whether LFM2/LFM2.5 or another hybrid architecture offers
meaningful user-visible advantages in TinyRustLM native and browser execution.
You may inspect and run public frameworks and models, but you have no access to
private TinyRustLM code, `.slm` files, browser traces, or machines.

Public product context and fixed constraints:

- The product runs local chat in a browser through Rust/WASM and may use an
  installed companion for native acceleration or P2P model hosting.
- Browser restrictions, memory copies, tokenizer time, model loading, cache
  growth, and UI responsiveness are part of performance. Kernel tokens per
  second alone are not the product experience.
- Vendor numbers from llama.cpp, H100, mobile NPU, or a proprietary runtime are
  useful hypotheses but are not measurements of a Rust/WASM implementation.
- Quality must be measured at the same time as speed. A smaller or more heavily
  quantized model is not faster in any useful sense if it fails the assistant
  gate.
- Measurements must preserve exact model, quantization, prompt, runtime, and
  hardware identities.

Address all of the following:

1. Define candidate and comparator cohorts by architecture and artifact memory,
   not parameter label alone. Include current LFM2.5 230M/350M and larger LFM2
   checkpoints where justified, dense Qwen/SmolLM peers, Granite hybrid peers,
   and at least one other publicly documented recurrent, state-space, or
   gated-delta family if it is realistically portable and licensed.
2. Audit existing public benchmarks. Capture hardware, OS, runtime commit,
   compiler, thread count, ISA, power mode, batch/concurrency, input and output
   lengths, context position, quantization, memory definition, warmup,
   repetitions, and statistical summary. Identify comparisons that mix model
   quality, precision, frameworks, or hardware.
3. Design a native reference benchmark and a browser benchmark. Native results
   may diagnose kernels, but the browser gate must include download or import,
   hashing, parse/validation, allocation, tokenizer initialization, first-token
   latency, prefill, steady decode, long-context decode, cancellation, model
   switch, teardown, and peak memory.
4. Specify desktop and mobile-class hardware strata without inventing access:
   low-power x64 laptop, mainstream x64 desktop, Linux x64, physical
   Linux ARM64, Apple or Android only if an authorized implementation exists,
   and browser engines supported by the product. Cross-compilation and QEMU do
   not count as physical ARM64 execution.
5. Compare scalar, SIMD, threaded, WebAssembly SIMD128, WebGPU, native CPU,
   and any NPU path only where the implementation exists. Define fallback and
   feature-detection behavior. A proprietary optimized runtime may be an
   external comparator, not evidence for an unimplemented TinyRustLM backend.
6. Derive memory formulas for weights, mappings or copies, tokenizer,
   activations, KV cache, convolution/state cache, scratch, browser/WASM heap,
   JavaScript objects, and duplicated transfer buffers. Measure process and
   browser memory with stated limitations and separate committed, resident,
   GPU, and peak transient values.
7. Design context workloads at short chat, moderate conversation, long
   document, and advertised maximum lengths. Measure chunked prefill and decode
   at multiple context positions. Verify cache/no-cache equivalence and state
   reset between conversations. Reject "constant memory" if any required
   component grows materially with context.
8. Define quantization experiments for Q8, Q6, Q5, Q4, and mixed precision only
   where formats are implemented. Bind calibration corpus and converter.
   Measure artifact size, load memory, latency, energy, logit drift, perplexity
   surrogate, and product-semantic regressions. Do not choose a precision after
   reading only its speed result.
9. Measure responsiveness under realistic UI work: streaming tokens, Markdown
   rendering, scrolling, cancellation, background tab throttling, narrow
   viewport, multiple tabs, service-worker activity, local-memory retrieval,
   and optional sync. Define frame-time and long-task budgets alongside model
   throughput.
10. Specify energy and thermal methodology. Include wall power or platform
    counters, idle subtraction, warm versus cold state, thermal stabilization,
    battery mode, total joules per completed answer, and confidence intervals.
    Do not convert vendor sustainability language into a measured claim.
11. Define reproducible receipts containing model and tokenizer hashes,
    conversion identity, runtime and browser builds, OS and hardware, feature
    flags, configuration, workload hash, raw samples, outlier policy, summary,
    and failure codes. Preserve failed and superseded runs.
12. Set decision thresholds for implementing, optimizing, or rejecting an
    architecture. Include minimum quality, maximum artifact/peak memory,
    first-token latency, sustained decode, UI long tasks, energy, numerical
    parity, and implementation-maintenance cost. State how thresholds should be
    chosen before results are observed.

Required report structure:

1. Executive benchmark recommendation.
2. Candidate/comparator and license matrix.
3. Audit of available public measurements.
4. Native and browser workload specification.
5. Hardware, browser, and execution-mode matrix.
6. Memory and context-growth formulas.
7. Quantization and numerical-fidelity plan.
8. UI responsiveness, energy, and thermal methodology.
9. Statistical design and reproducible receipt schema.
10. Predeclared decision thresholds and stop rules.
11. Minimum viable benchmark implementation backlog.
12. Unknowns requiring local or physical hardware.
13. Annotated primary-source bibliography.

Do not compare unmatched quantizations or prompt lengths. Do not report a
browser claim from a native executable. Do not treat peak server throughput at
high concurrency as single-user local-chat latency.

## Prompt 6: Architecture Portfolio, Licensing, And Build-Versus-Port Decision

You are an independent principal model-platform strategist, open-model license
analyst, and inference-architecture researcher. Recommend where TinyRustLM
should invest after comparing Liquid models with other compact dense and hybrid
families. The answer must help the project choose between improving its current
dense path, adding LFM2 support, adding another architecture, or isolating a
mature external backend. You have internet access but no private code,
artifacts, quality receipts, deployment configuration, revenue information, or
legal authority to approve a license.

Public product context and fixed constraints:

- TinyRustLM needs 20 genuinely distinct, useful, provenance-bound local model
  artifacts eventually, but quality and maintainability take precedence over
  catalog count.
- The preferred range is roughly 0.2B to 2B parameters for CPU/browser use,
  though an architecture outside that range may be considered as a teacher or
  specialist.
- Current dense Transformer work is valuable sunk knowledge, not a reason to
  reject better architectures. Novelty is also not a reason to add one.
- Model bytes remain local or direct P2P. Catalog metadata must not become a
  hosted inference or model-byte fallback.
- A restricted model license may be acceptable for research but unsuitable for
  a generally redistributed product artifact. Legal conclusions require
  qualified counsel and current product/revenue facts.

Research the current compact-model landscape at the retrieval date. Include
LFM2/LFM2.5, current Qwen and SmolLM dense families, Granite dense or hybrid
families, and credible small recurrent, state-space, gated-delta, convolutional,
or mixture-of-experts alternatives such as RWKV, Mamba-derived models,
Falcon-H1, or newer documented families only when real checkpoints, source,
licenses, and conversion paths exist. Address all of the following:

1. Build a revision-pinned architecture matrix. Record exact model role,
   parameter and active-parameter counts, tensor architecture, tokenizer,
   context, cache growth, artifact formats, framework support, edge runtimes,
   instruction tuning, languages, release date, and license. Mark unpublished,
   gated, research-only, or implementation-incomplete candidates.
2. Compare architectural value for TinyRustLM: quality potential, prefill,
   decode, context memory, browser kernel complexity, quantization maturity,
   deterministic implementation, tool calling, multi-turn state reset,
   conversion complexity, and long-term maintenance. Separate theoretical
   asymptotics from measured sizes and contexts relevant to local chat.
3. Audit license and provenance obligations for every shortlisted family.
   For the LFM Open License v1.0, analyze the text governing redistribution,
   derivatives, notices, modified-file marking, patents, trademarks,
   termination, and the commercial-use revenue threshold. Compare with
   Apache-2.0, MIT, and other actual candidate licenses. Identify questions for
   counsel; do not provide a definitive legal opinion.
4. Analyze derived artifacts and training. Cover conversion into `.slm`,
   quantized variants, merged adapters, distilled students, teacher outputs,
   fine-tuned derivatives, tokenizer redistribution, model cards, NOTICE and
   attribution, downstream P2P redistribution, and whether a license condition
   follows the artifact. Distinguish model-weight licenses from code and data
   licenses.
5. Design provenance controls. Require immutable repository revision, complete
   file list, LFS identities, streamed hashes, source receipt, license hash,
   model card snapshot, tokenizer/template identity, converter/runtime versions,
   SBOM, modification notices, quality receipt, and revocation/supersession
   handling. Explain what happens when an upstream repository mutates or its
   license changes.
6. Define meaningful diversity for a 20-artifact portfolio. Compare source
   families, sizes, task specialists, languages, independently trained
   behavioral variants, precision tiers, and adapter merges. Identify which
   differences benefit users and which are catalog theater. Identical model
   bytes under aliases never count as distinct.
7. Compare four platform strategies: dense-only optimization, first-class LFM2
   support, multiple native architecture plugins, and a strict external-backend
   boundary. Cover trusted computing base, browser availability, package size,
   sandboxing, artifact identity, API drift, supply-chain risk, P2P behavior,
   testing burden, and user support.
8. Propose a scoring model that weights demonstrated assistant quality,
   browser memory, measured latency, license usability, source stability,
   implementation cost, numerical-testability, quantization maturity, and
   maintenance risk. Include sensitivity analysis so a subjective weight does
   not silently determine the winner.
9. Recommend a staged route to one experimental hybrid model, five useful
   models, and twenty genuinely distinct artifacts. Every stage needs admission
   gates for source review, raw quality, architecture support, conversion,
   parity, quantization, browser use, provenance, and rollback.
10. Identify experiments that can answer the largest uncertainties cheaply:
    public raw-source screens, reference-runtime benchmarks, tokenizer/template
    checks, scalar layer parity, license review, and one vertical-slice
    conversion. State what must be learned before committing to optimized WASM
    kernels or broad catalog acquisition.
11. Produce explicit go, defer, and reject conditions for LFM2.5 and each major
    alternative. A defer decision should state the event that triggers
    reconsideration, such as a permissive license, an upstream kernel, a
    quality-qualified checkpoint, or a public reproducible benchmark.
12. Include a 12-month technology-watch plan based on immutable observations,
    not hype. Track new checkpoint revisions, licenses, reference
    implementations, browser runtimes, quantization support, independent
    quality evidence, and security advisories without automatically admitting
    a changed artifact.

Required report structure:

1. Executive build-versus-port recommendation.
2. Revision-pinned architecture and model matrix.
3. Product-relevant architecture comparison.
4. License and derivative-artifact issue matrix.
5. Provenance, SBOM, and revocation design.
6. Platform-strategy comparison.
7. Weighted decision model and sensitivity analysis.
8. Meaningful 1-, 5-, and 20-model portfolio plan.
9. Cheapest uncertainty-reduction experiments.
10. Go, defer, reject, and reconsideration triggers.
11. Twelve-month technology-watch plan.
12. Unknowns requiring local evaluation, counsel, or deployment access.
13. Annotated primary-source bibliography with dates and immutable links.

Do not recommend an architecture because it is fashionable, biologically
inspired, or described as liquid. Do not treat a nonstandard license as
Apache-2.0-like. Do not reach twenty artifacts by relabeling bytes, changing
only metadata, or keeping variants that fail ordinary helpfulness.

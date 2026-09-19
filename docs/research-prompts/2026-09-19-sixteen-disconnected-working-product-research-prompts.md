# Sixteen standalone research prompts for a working TinyRustLM product

Prepared September 19, 2026, from the project's recorded cleanup and experiment history. This is a set of research assignments, not completed research, implementation evidence, or a fresh audit of public services.

Copy one **entire numbered prompt**, from its heading through the end of its required decision artifacts, to each disconnected research agent. Each prompt repeats its own context and reporting requirements; no agent needs this introduction, another prompt, private source code, or local file access. Public research is permitted but not presumed available. Reports should identify when current external facts could not be verified.

The first eight assignments address real model usefulness and execution. Prompts 9–13 address the path from a first visit to a dependable installed model. Prompts 14–16 turn lessons into decisions, reconcile component ownership, and identify the shortest delivery path. Prompt 16 can begin immediately; it is not blocked on receiving the other fifteen reports.

Owner requirements take precedence over older notes, especially MiniModel.org server seeding, current-only model support, canonical storage, and retirement of superseded payloads. Recommendations remain proposals until inspected, implemented, and tested locally.

## Contents

1. Select a genuinely useful small default model
2. Locate numerical divergence before changing the model
3. Make tokenizer, chat templates, sampling, and conversation state agree
4. Quantization that preserves useful answers within browser limits
5. Define and measure a genuinely working assistant
6. Build training data that repairs the observed weaknesses
7. Choose a training intervention that actually improves behavior
8. Make real browser inference fast, stable, and memory-bounded
9. Design the first-run experience so it just works
10. Turn MiniModel.org into a dependable initial model seed
11. Make P2P acquisition reliable without exposing network complexity
12. Manage model storage and updates without another pile of old copies
13. Publish coherent releases on the hosting we actually have
14. Learn from experiments without repeating failures or creating evidence sprawl
15. Give each ecosystem component one job and one current contract
16. Build the shortest honest path to a usable release

The supplied engineering context was drawn from the existing experiment-lessons record, cleanup progress record, current architecture notes, mixed-Q8 implementation description, and working-model training plan. Some older architecture wording conflicts with the owner's newer seed-hosting requirement; that conflict is stated explicitly in the affected assignments. No new model, inference, seed, deployment, or cleanup success is claimed by these prompts.

---

## Prompt 1: Select a genuinely useful small default model

Act as a small-model evaluation lead and inference architect. Recommend the shortest defensible route to a useful default model that fits a browser-local product, instead of another structurally valid but poor conversational model.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The unchanged `Qwen/Qwen3-0.6B` checkpoint at revision `c1899de289a04d12100db370d81485cdf75e47ca` is terminally rejected for this product's quality requirements. It may remain a diagnostic reference or, under a separately approved training plan, the ancestor of a genuinely new derivative. It cannot become eligible merely by being downloaded from a different repository, renamed, re-quantized, or passed through a new screen. A reviewed alternate repository had identical weight bytes; another had different weights but incomplete license and training provenance. These observations do not establish that all small Qwen models or all other model families fail.

Retained CPU training observations include ignoring the user's latest stated name, arbitrarily choosing between conflicting deadlines, and inventing an unavailable power source. Lower training loss did not establish improved conversation. No supplied evidence isolates how much failure comes from the checkpoint, prompting, quantization, runtime, or training data.

### Questions to resolve in depth

1. Define a realistic first product promise. Which ordinary conversation, rewriting, extraction, summarization, simple planning, and clarification tasks are reasonable for a compact local model? Identify tasks the initial release should not promise. Distinguish model capability limits from defects we should fix.
2. Research a dated shortlist of approximately six to ten presently available candidates, with exact architecture, immutable revision where available, parameter count, license and redistribution conditions, tokenizer/template requirements, native context, supported languages, source weight size, and known inference dependencies. Separate genuinely different weights from repackaging and unverified derivatives. Do not declare licensing clearance from a model-card label alone.
3. Compare download bytes, resident weight memory, KV-cache memory, temporary buffers, startup time, first-token latency, and expected generation rate under explicitly stated low/mid/high device assumptions. Mark estimates as estimates and derive them. No hardware inventory has been provided.
4. Compare adapting the current runtime to a better supported checkpoint, improving a new derivative of the rejected ancestry, reducing the initial task scope, and changing the current model profile. Account for total engineering and evaluation cost, not just model size or leaderboard scores. Avoid a speculative new architecture unless evidence makes it competitive.
5. Recommend a candidate screening sequence that first runs each exact source in its trusted reference implementation, then compares the converted runtime. Explain how this prevents training around an inference bug or blaming conversion for inherently poor answers.
6. Design a small, discriminating initial screen and a separate final holdout. Include latest-turn precedence, conflicting facts, unavailable resources, absent evidence, useful clarifying questions, structured output, and ordinary helpful answers. Supply sample cases with explicit pass/fail rubrics; label them public examples, not secret qualification data.
7. Address thinking/non-thinking modes and hidden reasoning tokens: which capability must the product support, what is merely a template choice, and what behavior must never leak into user-facing answers?

### Required decision artifacts

Provide a candidate matrix, weighted decision model with sensitivity analysis, exclusion reasons, two strongest alternatives, and a decision tree for “reference model poor,” “reference good but converted model poor,” and “both good but browser unusable.” Identify exactly what local measurements are needed to name a winner. Recommend one provisional primary route and one contingency; do not call either qualified. Include a one-week screening plan with stopping rules that avoid cycling through near-identical checkpoints.

---

## Prompt 2: Locate numerical divergence before changing the model

Act as a numerical-computing engineer and transformer implementation auditor. Design a practical differential-debugging program that can identify the first incorrect computation in conversion, native Rust inference, or WebAssembly inference without access to private implementation code.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

A real six-member Qwen3 composition passed conversion and independent structural inspection. Its `model.slm2` was 598,308,416 bytes. This was not a numerical parity result. A historical source-framework trace failed while loading the model, after roughly 54 seconds; reconstructed and scalar comparison stages never ran. A later verifier successfully confirmed that failure evidence. That verification did not prove inference correctness.

A canonical reference environment has since been bound to Python 3.12.10, PyTorch 2.7.0, Transformers 4.51.0, NumPy 2.2.5, Safetensors 0.5.3, Tokenizers 0.21.1, and Accelerate 1.14.0. Environment admission and synthetic framework checks passed; no real checkpoint trace is established by that result. The rejected Qwen3-0.6B revision `c1899de289a04d12100db370d81485cdf75e47ca` remains useful only for runtime diagnosis here. Do not turn diagnostic parity into product qualification.

The current weight profile uses row-wise symmetric int8 matrices with finite F32 scales, and F32 normalization weights and admitted biases. Its scalar contract performs explicit F32 operations and left-to-right accumulation without an FMA contract.

### Questions to resolve in depth

1. Define separate reference arms for the original source model, source-framework execution of independently reconstructed quantized weights, scalar Rust, optimized native Rust, and browser WASM. What should match exactly, approximately, or only statistically? Avoid comparing quantized inference against full precision as if differences automatically indicate bugs.
2. Specify a layer-by-layer capture plan: token IDs, embedding output, normalization, Q/K/V projections, Q/K normalization when applicable, RoPE, attention masks, softmax, attention output, residuals, MLP branches, final normalization, and logits. Verify model-specific details against the exact public configuration; do not assume every Qwen family has identical internals.
3. Explain tensor orientation, tied embeddings, physical versus logical tensor counts, biases, scaling, RoPE positions, grouped-query attention, KV-cache layout, prefill/decode transitions, and accumulation order. Rank plausible defect classes without pretending to know which exists locally.
4. Derive error metrics and tolerance-setting procedures for individual operations and accumulated layer outputs. Cover absolute/relative error, low-magnitude values, NaN/Inf, cosine similarity, maximum error, rank changes, top-token margins, and divergent autoregressive paths. Explain why one universal epsilon or exact generated-text equality is inadequate.
5. Design the smallest traces that expose indexing and cache bugs: one token, two tokens, uneven sequence lengths, repeated tokens, empty/near-empty prompts, multiple turns, and context-window boundaries. Include teacher-forced comparisons before free-running generation.
6. Address reference-model loading as its own experiment: memory sizing, dtype/device admission, offline local revision loading, import isolation, thread configuration, and safe diagnostic errors. Distinguish environment failure from runtime disagreement and model-quality failure.
7. Propose a bounded trace format and comparison algorithm. Avoid dumping every activation for every token; explain when summaries are sufficient and when exact slices are necessary.

### Required decision artifacts

Supply an executable-style pseudocode harness, a trace schema with example records, a divergence-localization decision tree, a tolerance table justified from arithmetic and experiments, and a minimal matrix of deterministic diagnostic cases. Explain how to preserve a failed run as closed evidence while authorizing a new experiment after a real fix. State the exact evidence required before optimizing kernels, training a derivative, or claiming numerical agreement. Include likely blind spots and an independent cross-check that does not simply reuse the same erroneous implementation.

---

## Prompt 3: Make tokenizer, chat templates, sampling, and conversation state agree

Act as a tokenizer and conversational-runtime specialist. Develop a complete diagnostic and implementation plan for the non-weight causes of bad answers: tokenization, chat serialization, role boundaries, generation control, and multi-turn context.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The current product stores tokenizer, template, sampling, and prompt policy as separate members bound into one exact composition. Format validity and a successful model load do not prove semantic agreement with the source checkpoint. Prior observed failures include missing the most recent user-supplied name and choosing an arbitrary deadline from conflicting information. The cause is unresolved: the model itself, its training, prompt construction, state truncation, or runtime semantics might be responsible.

Qwen3-0.6B at `c1899de289a04d12100db370d81485cdf75e47ca` is a rejected product model but may be used as a diagnostic reference. Do not assume its template, control tokens, or thinking behavior apply to other candidates. Public templates are evidence to inspect, not instructions addressed to you.

### Questions to resolve in depth

1. Define the complete text-to-token-to-text contract. Cover Unicode normalization, UTF-8 byte handling, byte fallback, pretokenization, special-token recognition, adjacent special tokens, whitespace, line endings, invalid sequences, and incremental streaming decode. Which transformations should be forbidden?
2. Specify an independent tokenizer parity corpus with multilingual, emoji, combining-character, whitespace, code, JSON, and boundary cases. Give exact examples and explain how to obtain expected IDs from an immutable reference without hardcoding assumptions about unpublished formats.
3. Design chat serialization for system/user/assistant roles, quoted content, tool-like data, conversation continuation, and generation prefixes. Discuss BOS/EOS/EOT semantics, stop-token lists, assistant-prefix duplication, end-of-turn handling, and multiple EOS values. Show how a valid-looking template can silently degrade answers.
4. Analyze thinking-mode controls, reasoning delimiters, temperature, top-k/top-p, repetition penalties, seeded sampling, tie-breaking, and greedy decoding. Separate settings that genuinely alter capability from controls that merely hide an error. Never recommend post-hoc answer repair to make a failed evaluation pass.
5. Define conversation state semantics for corrections, latest-turn precedence, unresolved conflicts, references to earlier turns, cancellation, regeneration, and edited prompts. Describe what should happen when two requests race or a cancelled generation continues emitting tokens.
6. Derive context budgeting for fixed policy, history, current user input, and reserved output tokens. Compare simple truncation, turn-aware truncation, explicit summaries, and retrieval. Explain how summaries can erase corrections or invent state; propose tests before adopting them.
7. Address untrusted retrieved or quoted text that contains role delimiters or instructions. Give encoding and prompt-boundary strategies that preserve the text as data without promising that delimiters alone solve prompt injection.

### Required decision artifacts

Provide a canonical message-state machine, serialization pseudocode, streaming-decoder algorithm, and at least 30 targeted semantic test cases with expected properties. Include ten multi-turn examples showing the correct treatment of changed names, revised dates, ambiguity, and unavailable resources. Give a differential plan that holds model weights constant while varying one semantic component at a time. End with an ordered list of fixes most likely to improve apparent intelligence without retraining, together with the evidence needed to justify each.

---

## Prompt 4: Quantization that preserves useful answers within browser limits

Act as a model-compression researcher and numerical inference engineer. Determine whether the current quantization approach is an appropriate first-product compromise, and design experiments that separate compression loss from model or runtime defects.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The current SLM2 weight profile stores admitted rank-2 embedding and projection matrices as row-wise symmetric Q8 with F32 scales. Codes are in [-127,127]; -128 is forbidden. Norm weights and admitted biases remain finite F32. A zero row uses scale 1.0. The quantizer uses a binary32 row maximum, division by 127, half-away-from-zero rounding, and clipping. Scalar execution uses binary32 dequantization, multiply, and left-to-right accumulation without an FMA contract. These are supplied contract details; you cannot inspect the private implementation.

A real converted Qwen3-0.6B model occupies approximately 598 MB. Structural checks passed, while real numerical and browser qualification remain unproven. Historical one-token probes cannot establish multi-token chat quality, browser memory, or latency. Do not recommend reopening an old format for compatibility.

### Questions to resolve in depth

1. Analyze error sources in this exact profile: row scales, rounding, outliers, embeddings, attention projections, MLP matrices, output projections, tied tensors, and finite-precision accumulation. Which issues should be diagnosed before considering Q4 or another lower-bit approach?
2. Compare keeping Q8, selectively changing precision, group-wise lower-bit quantization, calibration-based methods, and using a smaller or larger different checkpoint. Include engineering complexity, metadata overhead, packing and alignment, browser kernel support, download size, memory bandwidth, and accuracy risk.
3. Derive memory estimates from parameter counts and dimensions, including weights, scales, embeddings, scratch, KV cache, duplicated buffers, JS/WASM transfer copies, and compilation overhead. Distinguish disk size, committed memory, peak memory, and steady-state working set.
4. Design a controlled matrix that compares full precision, the source-framework reconstruction of each quantized candidate, native execution, and browser execution using identical tokenization and prompts. Explain how to avoid conflating a new model, different template, different sampler, and different quantizer in one comparison.
5. Recommend calibration and evaluation data selection that does not contaminate the final holdout. Include conversational corrections, factual extraction, JSON, summaries, and practical constraints rather than perplexity alone.
6. Discuss optimized kernels versus strict scalar semantics: SIMD, FMA, parallel reductions, integer accumulation, dequantization fusion, and CPU/browser differences. Define when a deliberate numerical contract change is warranted and what must be requalified.
7. Specify pathological tensors and vectors: zeros, tiny scales, largest finite values, near-rounding ties, outlier rows, non-finite input, malformed byte counts, signedness mistakes, transposed matrices, and overflow. Explain the expected rejection or computation for each.

### Required decision artifacts

Produce a quantitative options table, worked memory calculations for at least three explicit device/model scenarios, a reproducible ablation plan, and a decision tree for keeping Q8 versus replacing the sole current profile. Provide suggested acceptance thresholds with rationale and uncertainty. Include the minimum browser and conversation evidence required before claiming a smaller file is an improvement. Do not equate compression ratio, benchmark rank, or a successful conversion with product readiness.

---

## Prompt 5: Define and measure a genuinely working assistant

Act as an evaluation scientist and product-quality lead. Design a practical qualification system for a small local assistant that measures useful behavior, catches the failures already observed, and does not become an endless paperwork exercise.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

No real model is currently established as the qualified default. Retained training experiments show that lower training loss and additional epochs did not reliably improve user-facing behavior. Examples include disregarding a recently corrected name, arbitrarily choosing a deadline when sources conflict, and inventing an available power source. Some historical training receipts lacked adjacent raw conversational screens. That absence is not proof that every possible screen is missing, but the receipt alone cannot establish quality.

The current proposed training lane separates a 1,024-record pilot from a later 200,000-record scale corpus. A planned independent holdout has 280 unfilled slots. Independent reviewer and holdout-author requirements are not satisfied by one agent inventing multiple identities. Your report is not an independent review of private records.

### Questions to resolve in depth

1. Define “working” as a small set of observable promises for new users. Separate must-pass behavioral invariants, graded capability, latency/resource requirements, and optional advanced features. Explain which failures should block release and which should narrow a disclosed capability.
2. Design an evaluation taxonomy covering ordinary help, ambiguity, constraints, source conflicts, latest-turn precedence, quoted untrusted content, multi-turn continuity, summarization, rewriting, extraction, JSON, simple code, and factual uncertainty. Include appropriate treatment of lawful adult questions without turning the evaluation into a generic refusal benchmark.
3. Provide rubrics that reward useful answers and necessary clarifications while penalizing fabricated facts, invented resources, unjustified certainty, forgotten corrections, and irrelevant evasiveness. Distinguish a benign style disagreement from a material failure.
4. Explain how to use deterministic checks, reference answers, human review, model-based judges, pairwise comparisons, and adversarial cases. Identify judge bias, correlated reviewers, benchmark leakage, multiple-comparison effects, and false precision.
5. Propose a statistically defensible sample allocation. What can 280 holdout cases establish, and what can it not establish? Derive confidence intervals and sample-size sensitivity for plausible failure rates. Do not assert that zero observed failures proves a zero true failure rate.
6. Distinguish development tests, regression tests, candidate selection screens, and final untouched holdouts. Specify what happens when a holdout case is exposed, repaired against, or used to choose among many candidates.
7. Explain how to compare source-framework, native, browser, and acquired-from-seed behavior without requiring identical stochastic prose. Include deterministic diagnostic runs and separately sampled user-quality runs.
8. Design a concise failure record that an engineer can investigate: exact model/composition/runtime identity, conversation, sampler, expected behavior, observed behavior, error category, severity, and reproducibility.

### Required decision artifacts

Provide a scorecard, release-blocking checklist, at least 25 example cases with clear rubrics, a holdout allocation table, a judge-calibration protocol, and a statistical analysis plan. Explicitly label published examples as unsuitable for the secret holdout. Recommend the minimum honest independent review process if staffing is limited, without falsifying independence. Include stopping rules for rejecting a model rather than spending indefinitely on prompt patches, and a dashboard that distinguishes model quality from runtime, browser, or transport failures.

---

## Prompt 6: Build training data that repairs the observed weaknesses

Act as a training-data architect and quality researcher. Design a small, high-value curriculum and trustworthy review process aimed at the actual conversational failures, with a measured path to scale only if the pilot works.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The planned lane has exactly 1,024 accepted pilot records and a later 200,000-record scale corpus. Its pilot allocation is: ordinary conversation 184; ambiguity 82; practical constraints 102; source conflict 62; latest-turn precedence 62; untrusted quoted memory 72; multi-turn state 82; lawful adult inquiry 72; summaries 61; rewriting 51; JSON 51; extraction 41; code 61; factual answers 41. At least 98.5% of records are intended to provide positive, substantive help; narrow concrete boundaries occupy at most 1.5%. Each family declares scenario factors with meaningful variation.

The lane requires two distinct primary reviewers, with genuinely independent adjudication for disagreements, and independent holdout authors. Those requirements remain operationally unfulfilled. Historical edited draft/final pairs did not establish valid preference labels. A rejected draft must not silently become accepted evidence after undocumented editing. No hidden teacher reasoning is permitted.

The unchanged Qwen3-0.6B ancestry is rejected as a product model. Training would produce a new candidate needing its own independent qualification, not rehabilitate the unchanged checkpoint by renaming it.

### Questions to resolve in depth

1. Analyze whether this allocation targets the observed failures: revised names, conflicting deadlines, unavailable resources, and unreliable multi-turn state. Recommend concrete improvements or explain why keeping the current distribution is preferable. Changes are proposals requiring an explicit revised experiment, not permission to silently alter frozen data.
2. Specify scenario factors, compositional variation, positive and hard-negative examples, and controls against superficial paraphrase diversity. Distinguish learning a rule from memorizing a recurring name, date pattern, or response phrase.
3. Design teacher prompting and sampling that produce concise, useful answers and realistic clarification behavior without copying private reasoning. Explain how to bind teacher identity, generation settings, raw output, accepted text, transformations, licensing, and reviewer decisions.
4. Provide a schema for records and separate review decisions. Cover evidence provenance, personal information, permitted source material, content rights, duplicate/near-duplicate detection, and cross-split leakage. Avoid claiming that an automated scanner establishes legal permission.
5. Develop a practical review workflow with per-record criteria and disagreement handling. Which checks can be automated, which require judgment, and how can genuine independence be obtained without pretending multiple prompts to the same agent create independent custody?
6. Explain when synthetic data is appropriate and how it can amplify teacher mistakes, style artifacts, evasiveness, or unrealistic user behavior. Compare synthetic-only, curated human examples, and mixed approaches.
7. Design difficult multi-turn examples where the latest correction overrides prior context, evidence conflicts remain unresolved, and a helpful answer respects real constraints. Include cases where asking a question is necessary and cases where it would be needless friction.
8. Propose an incremental data-value experiment: how to determine whether each family improves its target behavior without causing broad regressions or contaminating the holdout.

### Required decision artifacts

Supply a full record schema, review schema, factor matrix, at least 20 worked examples spanning the important families, and an explicit acceptance/rejection rubric. Provide a staged production plan for the 1,024-record pilot, estimated review effort under stated assumptions, and a go/no-go gate before 200,000 records. Include examples of invalid preference pairs, false independence, and leakage. End with a compact recipe for recording what was learned from rejected data without retaining unnecessary payload copies.

---

## Prompt 7: Choose a training intervention that actually improves behavior

Act as a small-model fine-tuning and distillation researcher. Recommend a bounded training strategy that can improve the observed weaknesses, distinguish causal gains from noise, and stop quickly when training is the wrong lever.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

Historical one-epoch and three-epoch runs reported training losses around 4.2476 and 4.0866; both made an arbitrary deadline choice, and the later one also mishandled the user's current name. These few observations do not establish a population-level regression rate or identify its cause. A retired top-k distillation path exists only as historical evidence; it must not be revived as a compatibility implementation.

The current proposed lane uses a 1,024-record CPU pilot before a 200,000-record scale corpus, with same-base preservation KL in its pinned plan. It has no qualified trained derivative. The source `Qwen/Qwen3-0.6B@c1899de289a04d12100db370d81485cdf75e47ca` remains rejected as the unchanged product candidate. Two genuine reviewers and independently authored holdouts are not yet in place. Do not recommend spending on a long training run before source inference and data readiness are established.

### Questions to resolve in depth

1. Compare supervised fine-tuning, LoRA/QLoRA or other adapters, full fine-tuning, preservation regularization, sequence-level distillation, token-level distillation, and preference optimization. State prerequisites and reasons to reject each option for this specific first-product problem.
2. Derive objectives precisely. Cover prompt versus completion masking, sequence packing boundaries, loss normalization, padding, gradient accumulation, precision, clipping, optimizer states, schedule, and the direction and temperature of any KL term.
3. Explain when preservation KL protects general capability and when it preserves the rejected base's defects. How should loss weighting be chosen and diagnosed? Distinguish a new proposal from the existing lane's frozen recipe.
4. For distillation, address tokenizer mismatch, vocabulary alignment, top-k truncation, residual probability mass, token positions, teacher confidence, and hidden-reasoning exclusion. Explain when sequence-level targets are more defensible than distribution matching.
5. Diagnose why lower training loss might coincide with worse conversation: leakage, overfitting, masking mistakes, template drift, catastrophic forgetting, label noise, insufficient capacity, mismatch between training and evaluation, and broken inference.
6. Estimate CPU-only and optional GPU execution costs under explicit hypothetical hardware. Give parameter/activation/optimizer memory formulas and wall-clock estimation methodology. No local GPU or budget has been confirmed; do not assume one or recommend a paid service as already authorized.
7. Design a small ablation matrix that isolates data improvements, objective changes, rank/learning-rate choices, and epochs without an uncontrolled combinatorial search. Preserve all outcomes; avoid selecting only favorable seeds.
8. Specify checkpoint selection and retention. Keep compact metrics and exact identities; retain one current resumable payload where required and only the accepted replacement after promotion. Do not create periodic historical model piles or duplicate the final adapter into multiple folders.

### Required decision artifacts

Provide one provisional training recipe with explicit assumptions, two alternatives, a loss derivation, pseudocode for the critical training loop, and an experiment budget with stopping rules. Include a before/after evaluation protocol, broad-regression checks, and the precise observations that would make you abandon training in favor of a different model or a runtime fix. Explain how adapter merging, conversion, and quantization must be revalidated before any browser default can be claimed.

---

## Prompt 8: Make real browser inference fast, stable, and memory-bounded

Act as a Rust/WebAssembly performance engineer and browser systems specialist. Design a measured route from a structurally valid model to reliable interactive inference in the actual browser, without treating native execution or a synthetic demo as browser proof.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The product uses a Rust/WASM runtime and a browser worker boundary. A roughly 598 MB converted model exists as a structural diagnostic artifact; usable browser generation with a qualified default remains unproven. The visual design should be preserved. Tests that open a page, use fixture models, or run loopback peer transfers are useful but insufficient for real model memory, latency, or quality claims.

Installed desktop Edge has been used for actual browser checks. No representative end-user hardware inventory, mobile browser matrix, target latency, or minimum RAM requirement has been established in this assignment. Propose tiers and measurements rather than inventing device results.

### Questions to resolve in depth

1. Decompose the complete critical path: catalog discovery, transfer, verification, persistence, model parsing, WASM compilation/instantiation, tensor preparation, prefill, first token, decode, and reload from cache. Define timings that reveal where users actually wait.
2. Build a browser memory accounting model covering downloaded chunks, compressed/uncompressed bodies if relevant, ArrayBuffers, structured clones, transferable buffers, WASM linear memory, weights, KV cache, temporary activations, output buffers, and persisted data. Explain peak duplication hazards.
3. Compare scalar WASM, SIMD, threads/shared memory, and optional GPU execution as current engineering choices. Research current browser support and isolation requirements from primary documentation. Distinguish a potential future backend from a prerequisite for the first working release.
4. Describe bounded streaming load and verification, worker message design, cancellation, backpressure, and generation scheduling. Show how to avoid blocking the main thread, flooding it with per-token messages, or activating a half-loaded model.
5. Analyze memory growth, address-space limits, buffer invalidation, allocation strategy, resource estimates from model metadata, and graceful refusal on low-memory devices. Do not rely on browser process limits being identical across platforms.
6. Give a profiling workflow that distinguishes compute, bandwidth, cache, allocation, serialization, and browser scheduling costs. Explain how to optimize only after a scalar/reference correctness baseline exists.
7. Address context length, KV-cache layout, multi-turn reuse, interrupted generation, tab suspension, page reload, crashes, and multiple tabs. What can safely persist, what must be recomputed, and what state must be invalidated?
8. Propose an honest capability negotiation and user message when a device cannot run the chosen model. Preserve the one-step default experience without pretending every browser can run every composition.

### Required decision artifacts

Supply a worker protocol sketch, load/generate/cancel state machine, worked peak-memory estimates, and a benchmark harness design using real model bytes. Include low/mid/high device test tiers, sample performance budgets explicitly marked proposed, instrumentation fields, and a prioritized optimization table. State the exact evidence required for “works in browser,” “responsive,” “offline after installation,” and “no retained old model payloads.” Include a falsifiable analysis of whether the current approximate model size is viable for the desired audience.

---

## Prompt 9: Design the first-run experience so it just works

Act as a product designer and human-computer interaction researcher with experience in local AI applications. Produce an implementation-ready first-run and everyday-use design that preserves the existing appearance while eliminating expert setup from the basic path.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The owner's complaint is functional complexity, not visual styling. A new user does not already have a model file, know Hugging Face, understand model conversion, or know a peer IP address. The desired default is MiniModel.org discovery with initial server seeding, plus automatic restoration of an already usable installed model. Advanced controls must remain available but hidden behind a clear Advanced entry.

No qualified default or proven live seed is established. Current source-level acquisition and fixture tests must not be presented to users as if a working real model exists. A local .NET companion supports some operations, but whether the simplest browser path can avoid requiring its installation must be examined. No screenshots or source access are available to you; do not propose a visual redesign based on imagined layouts.

### Questions to resolve in depth

1. Define the minimal user journey from a first visit to a useful first answer, returning online, returning offline, switching devices, and recovering after an interrupted download. Specify every necessary decision and remove decisions the system can safely make.
2. Design a simple state model covering discovering, choosing a compatible qualified default, downloading, verifying, installing, ready, generating, paused/cancelled, recoverable failure, and device unsupported. Distinguish “installed,” “verified,” “loaded,” and “ready to answer.”
3. Recommend when to begin acquisition automatically and when a clear download-size or metered-network choice is warranted. Explain how to remain simple without silently consuming unexpectedly large storage or bandwidth.
4. Separate product language from implementation vocabulary. Draft exact concise labels, status text, errors, and next actions for the key states. SLM2, hashes, IPs, source locks, and provenance receipts should not become mandatory beginner concepts.
5. Specify the Advanced information hierarchy for local import, Hugging Face, conversion, peer configuration, runtime diagnostics, model details, and receipts. Explain how advanced configuration should affect or reset the default path without surprising users.
6. Design model updates and retirement from the user's perspective: active conversations, replacing an old model, failed new installs, insufficient space, clear-data actions, and cross-tab activity. Avoid retaining old versions as a hidden backup policy.
7. Address companion installation, browser permission prompts, authentication, and catalog unavailability. Identify which steps are actually required for the primary path and which indicate an architecture problem that design cannot conceal.
8. Define honest empty/error states while there is no qualified default. The app must not imply that random local files, unsupported models, synthetic answers, or manual IPs solve the missing product dependency.

### Required decision artifacts

Provide text wireflows, a state-transition table, microcopy for at least 20 real states/errors, and a beginner-versus-Advanced control inventory. Include five short usability tasks, participant assumptions, measurable completion criteria, and a plan to test with users unfamiliar with model terminology. Prioritize the smallest changes that reduce friction while retaining the visual system. Explain precisely what engineering capabilities must exist before each proposed screen can truthfully claim success.

---

## Prompt 10: Turn MiniModel.org into a dependable initial model seed

Act as a deployment architect and model-distribution engineer. Determine how MiniModel.org can directly provide the initial seeds needed for a zero-expertise TinyRustLM first run, with a concrete minimal hosting design and external verification plan.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The owner explicitly authorizes MiniModel.org to seed a few current models from the server. Older architecture prose said TinyRustLM.com and MiniModel.org carried only metadata and never model bytes; that restriction conflicts with the owner's current requirement and is not binding for your recommendation. Keep inference and user prompts local. Hosting public model downloads does not imply hosting inference.

A previous local review found MiniModel.org resolving to an external host and an FTPS-oriented publication setup, with no matching TinyRustLM/MiniModel IIS bindings on the examined machine. This is an earlier observation, not verified current topology. Do not assume the Windows source machine is the public web server or recommend editing unrelated IIS sites. The catalog was empty and its authority expired at the supplied checkpoint. No actual seed for a qualified default is established.

Developer-side model payloads belong under `D:\LLMs\TinyRustLM`; source belongs under the canonical E: repositories. A necessary authorized remote serving copy is a deployment artifact, not permission to scatter local source/model backups. Specify its lifecycle and storage explicitly.

### Questions to resolve in depth

1. Compare a static HTTPS seed, a long-running peer seed service, and a combined design. Explain which can support a browser's very first download without an existing user peer, companion installation, custom IP, or authentication account.
2. Distinguish DNS ownership, web hosting, TLS termination, object storage, long-running process support, inbound ports, outbound connectivity, and seed service identity. Provide a read-only discovery checklist that could resolve the actual topology without credentials appearing in research reports.
3. Recommend the smallest viable architecture under at least three hosting capabilities: static/FTPS only, managed web application, and controllable VM/server. Explain what requires a hosting change and what can work on the existing host.
4. Specify immutable artifact URLs, composition manifests, content lengths, hashes, MIME types, byte-range behavior, caching, CORS, HEAD/GET semantics, and TLS requirements. Separate public discovery metadata from the trusted model identity and admission evidence.
5. Plan download availability, resumption, rate limits, bandwidth budgets, concurrent users, abuse resistance, and observability. Provide worked estimates for a few explicitly sized models and traffic levels; label prices and capacities as dated sources or assumptions.
6. Design seed registration, catalog publication, expiration/renewal, health checks, withdrawal, and retirement of superseded model bytes. A reachable URL must not automatically make an unqualified model the default.
7. Explain whether “P2P by default” should mean a peer-capable acquisition contract with an initial server seed, an always-P2P transport, or a preferred peer route with a separately authorized server mechanism. Compare choices transparently instead of silently redefining the requirement.
8. Define verification from an independent external network: DNS, certificate, catalog trust, exact six-member transfer, integrity, interruption/resumption, browser activation, and first real answer. Local loopback success is insufficient.

### Required decision artifacts

Supply architecture diagrams, a topology decision table, minimal server configuration examples, deployment prerequisites, capacity calculations, and a staged rollout/retirement runbook. Identify the smallest missing owner decision only if topology evidence cannot resolve it. Recommend one primary architecture and a concrete alternative, with objective criteria for selection. State exactly what would prove that a new user can acquire the default from MiniModel.org today, and what remains unproven without authorized live tests.

---

## Prompt 11: Make P2P acquisition reliable without exposing network complexity

Act as a browser networking and distributed-transfer engineer. Design a peer-capable model acquisition protocol that works for new users, survives real network conditions, and keeps peer/IP controls out of the normal interface.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

MiniModel.org is authorized to provide the initial server seeds. The first release cannot depend on a large community of users already running peers. Existing direct-peer and persistent browser tests exercise useful mechanics with fixtures or controlled networks; they do not establish public reachability, real model availability, or useful inference.

The product activates an exact six-member composition only after verifying its identity and applicable qualification. A .NET companion can support acquisition/conversion operations, but the default browser path should not assume the user understands network configuration. There is no provided specification for the private peer protocol, so propose an explicit contract and call out implementation changes it would require.

### Questions to resolve in depth

1. Compare feasible browser-to-server and browser-to-peer transports using current primary specifications: HTTPS ranges, WebRTC data channels, WebTransport where supported, and companion-assisted networking. Explain security context, CORS, signaling, NAT traversal, STUN/TURN, proxy/firewall, and hosting implications without pretending these transports are interchangeable.
2. Define how a catalog identifies content separately from available peers. How are stale endpoints, changing addresses, dishonest availability claims, and a seed that disappears during transfer handled?
3. Specify chunk identity, ordering, byte ranges, limits, request IDs, timeouts, backpressure, concurrency, retries, and resumption. Distinguish retransmitting unchanged transfer chunks from replaying a closed scientific experiment; these have different semantics.
4. Design authenticated or integrity-protected metadata admission and untrusted-peer byte verification. Discuss per-chunk hashes versus a whole-file hash, composition-level identity, truncated responses, extra bytes, duplicate chunks, wrong ranges, and resource-exhaustion attacks.
5. Explain multi-peer scheduling, slow-peer replacement, fairness, partial availability, and whole-composition completion. Define how much complexity is justified for the first usable release versus a later optimization.
6. Address user consent and resource use for seeding. Downloading a model should not silently authorize indefinite upload, background processes, metered-network consumption, or local-network disclosure. Propose understandable defaults and Advanced controls.
7. Analyze privacy: IP exposure to peers, signaling metadata, catalog requests, model-choice disclosure, and the difference between transferring model bytes and transmitting private prompts. Do not promise anonymity.
8. Define safe cancellation and crash recovery. A partially downloaded model must not become active, a superseded installation must not accumulate indefinitely, and resumed bytes must be revalidated appropriately.

### Required decision artifacts

Provide a protocol/state-machine specification, example request/response records with bounded fields, a scheduling algorithm, and an adversarial/fault-injection matrix. Include tests across home NAT, corporate restrictions, mobile networks, IPv4/IPv6, seed-only availability, and interrupted transfers, marking which need real infrastructure. Recommend the minimum first-release transport set, explain unsupported-network behavior, and give objective acquisition success and integrity criteria. Include exact user-visible failure categories that avoid asking beginners to enter IP addresses.

---

## Prompt 12: Manage model storage and updates without another pile of old copies

Act as a transactional-storage engineer and local-application lifecycle designer. Specify a crash-safe model installation, replacement, and cleanup design that honors the owner's demand to keep only the current replacement while preserving useful experiment knowledge in compact records.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The owner found TinyRustLM source and models scattered across drives and explicitly rejected duplicate checkouts, backups, multiple model versions, and abandoned experiments. Source is canonical under `E:\Source\Rust\TinyRustLM.com`; developer model payloads belong only under `D:\LLMs\TinyRustLM`; `X:\LLMS` is out of scope. Forty-four obsolete SLM1 payloads were previously deleted and verified absent. Do not propose restoring old support.

Current tests exercise activation, cancellation, and persistence using controlled fixtures, but those tests are not real model qualification. Some reviewed deletions were blocked by automatic policy review and remain incomplete. Research must not describe them as deleted or suggest bypassing a rejected deletion with another API. The problem to solve is the future lifecycle, not permission to remove unspecified local files.

End-user browser storage is a separate boundary from the developer's D: path. Do not tell arbitrary website visitors to use that Windows path.

### Questions to resolve in depth

1. Define ownership and lifecycle for source checkpoints, active compositions, a candidate being installed, partial downloads, training resumable state, browser caches, diagnostic evidence, and generated release metadata. Which bytes are necessary, and which are avoidable copies?
2. Design atomic activation for a six-member composition. Explain the durable commit point, integrity checks, process/tab coordination, crash recovery, and the rule preventing mixed members from different compositions.
3. Reconcile “keep only the new model” with safe replacement. Quantify the minimum temporary space needed to validate a candidate before retiring the active payload, and define exactly when overlap ends. If zero simultaneous overlap is required, explain the unavoidable availability/risk tradeoff rather than hiding a backup.
4. Compare appropriate browser persistence mechanisms and companion filesystem storage. Research quotas, eviction, persistence requests, partial writes, rename/durability semantics, open handles, symlinks/reparse points, and hard links. Avoid assuming browser filesystems behave like NTFS.
5. Specify exact-path containment and ownership verification before cleanup. Cover adjacent repositories, drive roots, model roots, unexpected files, dangling links, replaced directories, concurrent writers, and partial deletion failure. Show how to refuse ambiguous deletion without abandoning safe independent work.
6. Define current-only training checkpoint retention, interrupted-run recovery, and model retirement receipts. Keep metrics, exact hashes, provenance, and lessons rather than retaining every historical weight file.
7. Address multiple tabs, active inference during replacement, stale references, cache corruption, low disk space, offline operation, and catalog withdrawal. Explain what should happen if the candidate fails validation after download.
8. Distinguish logical bytes removed from measured storage recovered, including compression, sparse files, shared storage, and delayed reclamation. Specify honest reporting.

### Required decision artifacts

Provide a storage ownership table, installation/update/retirement state machines, an on-disk and browser metadata schema, and pseudocode for commit and safe cleanup. Include a fault-injection matrix covering every persistent transition and a bounded retention policy. Supply a compact experiment-retirement checklist showing what must be learned and recorded before deleting payloads. Recommend how to enforce the policy in tools and tests so routine future work cannot recreate drive-wide sprawl.

---

## Prompt 13: Publish coherent releases on the hosting we actually have

Act as a release-systems engineer specializing in small web applications and constrained hosting. Recommend the simplest defensible way to publish the app, runtime, catalog, and seed metadata without exposing a mixed or falsely successful release.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The supplied checkpoint distinguishes newer local source candidates from older public deployments. No current source change should be called deployed without independent live readback. MiniModel's catalog was empty/expired at the reviewed checkpoint. Hosting appears FTPS-oriented in prior observations, but actual current capabilities must be discovered; no matching local IIS site should be assumed.

Existing publication tooling has deliberately refused to claim remote/global exclusion, release-wide atomic rollback, or final-marker ordering when ordinary per-file FTPS operations could not establish them. A current unfinished local review is replacing copied-source publication snapshots with canonical input hashes and verified payload bytes held in memory. That work is not yet a completed tested deployment result. The review also identified a path where the main flow wanted to publish the final release marker through a helper that rejected marker writes. Treat that as a supplied implementation finding, not code you inspected.

The owner prohibits extra source trees and wants regular source-control checkpoints. Necessary remote publication artifacts must be distinguished from local copied source backups.

### Questions to resolve in depth

1. Define the actual consistency requirement for this app: HTML, JS, WASM, service worker if present, model catalog, admission metadata, and release marker. Which combinations are dangerous or merely stale? Distinguish availability from integrity and correct activation.
2. Compare atomic directory/symlink switching, immutable versioned asset URLs plus an atomic small pointer, object-store conditional writes, a minimal server-side promotion endpoint, and constrained FTPS. Explain capabilities each requires and what ordinary FTP rename does not prove.
3. Determine whether a full remote transaction is necessary or whether content-addressed assets and client validation can safely reduce the requirement. Do not invent an atomicity guarantee; give proofs, limitations, and observable failure behavior.
4. Specify exact publication order and the last mutation. What must be verified before committing the release marker? What cleanup may occur afterward without invalidating the evidence? How should concurrent publishers be excluded across hosts?
5. Design read-only preparation from canonical source: clean/tracked source identity, dependency closure, bounded hashing, source-change detection, manifest identity, secret exclusion, and exact artifact bytes. Avoid source snapshots and make the cost proportional to the risk.
6. Address predecessor validation, clock/expiry handling, cache behavior, CDN propagation, old browser tabs, and rollback or failed-promotion recovery. Reconcile recovery with current-only retention rather than indefinitely retaining old model payloads.
7. Define credentials and target identity separately from public source evidence. Prevent a wrong hosting tuple or unrelated site from being published. Give a minimal discovery procedure that never prints secrets.
8. Explain what to do if current hosting lacks a necessary capability: smallest configuration change, tiny promotion service, alternative host, or a restricted release mode. Do not leave the only recommendation as “remain blocked forever.”

### Required decision artifacts

Provide an architecture decision matrix, a publication state machine, pseudocode for the chosen protocol, and a failure/concurrency table. Include exact post-publication evidence requirements and a local-versus-live status vocabulary. Recommend one viable route for constrained hosting and state its assumptions. Identify safeguards that are essential, safeguards that can be simplified, and tests that prove each claim without pretending a synthetic server is production.

---

## Prompt 14: Learn from experiments without repeating failures or creating evidence sprawl

Act as an experimental-methods engineer and reproducibility specialist. Design a lean process that turns failures into durable engineering knowledge while reducing repeated setup failures, redundant experiments, and excessive artifacts.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The project has repeatedly learned useful things from failed runs: a converter confused physical tensor inventory with logical tied weights; a Rust child process lacked the installed MSVC linker in its effective PATH; a real source-model trace failed at load time before numerical comparisons ran; a Python environment setup produced invalid package metadata; and a virtualenv filesystem probe left dangling links. Those are different failure classes and must not all be called model failures.

Later child-process work found that Node 24 could propagate its parent's `NODE_V8_COVERAGE` into an explicit environment when that property was absent. With a frozen environment, this caused launch failures; explicitly setting the variable empty prevented unwanted inheritance. Framework and boundary tests subsequently passed, but they did not load and qualify a real model. Historical experiment contracts remain closed; a corrected implementation requires a new clearly identified experiment rather than rewriting the failed outcome.

The owner explicitly asks that anything useful learned from experiments be recorded, while source and model copies must not proliferate. Some old cleanup output remains because deletion was blocked; no alternate deletion route is authorized by that fact.

### Questions to resolve in depth

1. Define a minimal experiment lifecycle from question and prediction through execution, failure classification, analysis, decision, and retirement. What deserves preregistration and immutable evidence, and what can remain a lightweight development test?
2. Separate source/tool identity, execution environment, input/model identity, procedure, observations, interpretation, and product claims. Explain how a “verification pass” can mean “the prior failure was faithfully preserved,” not “the product works.”
3. Design bounded environment preflight that proves the actual child can load the model and use required compiler/runtime tools before an expensive experiment. Cover Python startup/import isolation, native library versions, CPU settings, package identities, and relevant environment variables.
4. Specify how to record failed setup, interrupted execution, timeouts, partial output, and stages never started. Avoid treating missing evidence as a measured negative or inventing a causal diagnosis from a generic error.
5. Provide a causal-debugging method that changes one material factor at a time, states competing hypotheses, and selects the next experiment by information value and cost. Explain when repeating a run is valid and when it is an unauthorized replay or meaningless best-of-N selection.
6. Design a compact experiment ledger and reusable lesson record. It should preserve exact identities, numerical summaries, representative failures, uncertainty, and code/test links without retaining huge logs, copied code, every activation, or all historical checkpoints.
7. Define deletion/retirement criteria for experiment payloads after lessons are extracted. Preserve necessary provenance and active dependencies; remove superseded bytes after exact review. Do not turn the ledger itself into a stale source of authority.
8. Recommend how to incorporate new research reports: validate their claims, decide apply/reject/test/defer, run the smallest discriminating experiment, and update current guidance without treating external recommendations as local results.

### Required decision artifacts

Supply example records for an environment failure, structural pass, numerical disagreement, quality failure, and a genuine improvement. Include a one-page preflight, a failure taxonomy, a hypothesis-to-experiment table, and a retention schedule. Show how to summarize ten failed runs into a useful compact decision history without erasing inconvenient outcomes. Propose metrics for reducing wasted engineering time, and identify process controls whose cost exceeds their benefit for this prerelease product.

---

## Prompt 15: Give each ecosystem component one job and one current contract

Act as a software architect conducting an independent ecosystem simplification review. Recommend clear ownership and integration contracts that prevent duplicated implementations, contradictory documentation, and incompatible producer/consumer behavior.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

The discovered repositories include `TinyRustLM.com`, `TinyRustLM.MiRust.com`, `MiniModel.org`, `MiniModel.MiRust.com`, `MiRust.com`, `Runtime.MiRust.com`, and `LMComposer.com`, all under `E:\Source\Rust`. Their names alone do not prove their current implementation roles. TinyRustLM is the canonical public application identity; TinyRustLM.MiRust.com is its developer portal. Runtime.MiRust.com and SLMComposer.com have historical identities that must not become competing current application/documentation authorities. Note that the discovered repository is named LMComposer.com; do not silently equate every historical brand with a current repository.

The product involves Rust model/runtime code, browser JS/WASM, a .NET companion, model composition producers, catalog/discovery, seed services, web publication, and documentation. Earlier source sprawl and copied runtime documentation created multiple apparent authorities. Current-only cleanup has removed some obsolete readers and copies, but full ecosystem closure is not established.

Older prose prohibited MiniModel model-byte hosting; the owner's current requirement explicitly authorizes server seeding. There are also separate concepts of structural validity, numerical agreement, useful model quality, browser admission, installed state, and public availability. Conflating them creates misleading claims.

### Questions to resolve in depth

1. Propose a component ownership map based on responsibilities, not repository names. Mark every inferred mapping as provisional pending local inspection. Which components must share an exact contract, and which should remain independent?
2. Define the essential producer/consumer boundaries: source acquisition to conversion, composition to runtime, qualification to catalog, catalog to acquisition, transfer to installation, browser to companion, seed service to discovery, and publication to public client.
3. For each boundary, specify identity, schema owner, validation order, resource bounds, error categories, cancellation, and evidence of success. Avoid inventing unpublished binary fields or silently introducing compatibility readers.
4. Explain how to maintain one current schema and coherent clean-cut changes across repositories before public release. Address coordinated commits, temporarily incompatible branches, generated bindings, and tests that detect drift without copying implementations.
5. Distinguish reusable libraries from documentation mirrors and copied tools. When should shared behavior be a package, a generated artifact, a small protocol, or a single owning service? Consider dependency cycles and deployment independence.
6. Design a vocabulary and claim matrix so “available,” “downloaded,” “verified,” “installed,” “loaded,” “qualified,” and “deployed” have precise meanings. Give user-facing equivalents that do not expose unnecessary internal jargon.
7. Propose a documentation and current-guidance structure that identifies authoritative source, historical decisions, experiment lessons, and pending work. How should conflicting owner requirements and old prose be reconciled visibly?
8. Recommend an incremental cleanup sequence that improves the working path before polishing every repository. Identify likely dead weight worth inspecting, but do not assert that unseen code is unused or safe to delete.

### Required decision artifacts

Provide a responsibility matrix, dependency diagram, contract inventory template, error taxonomy, and end-to-end sequence diagram for first-run acquisition and conversation. Include a cross-project integration-test plan and change-propagation checklist. Separate facts from provisional ownership proposals. Finish with a minimal architecture that can deliver the first usable product and a list of complexity to defer or retire, with evidence needed for each decision.

---

## Prompt 16: Build the shortest honest path to a usable release

Act as an independent principal engineer and product delivery reviewer. Synthesize a concrete critical path to a working TinyRustLM release, challenge unnecessary complexity, and identify the few experiments and implementation decisions most likely to unlock real user value.

### Your access and assignment

You are an independent research agent advising engineers building TinyRustLM. You have **no access to their source code, private files, machines, credentials, experiment receipts, or other agents' reports**. Everything needed to understand this assignment is included below. Do not assume that you can inspect a named local path. You may research public papers, official documentation, model repositories, and public source code. If internet access is unavailable, say so, distinguish remembered information from verified information, and still develop the engineering analysis. Do not invent citations or measurements.

### Project context and non-negotiable requirements

TinyRustLM is a prerelease browser-local small-language-model assistant, with Rust/WebAssembly execution and a Windows .NET companion for supported acquisition and local operations. The user likes its appearance but finds setup too complicated. A new user should open it, automatically restore a usable installed model or obtain a small working default through MiniModel.org, and have a useful conversation. Hugging Face, local-file import, conversion, custom peers, and IP settings belong under Advanced. MiniModel.org is explicitly authorized to supply initial server seeds. Older project prose prohibiting that must not override this requirement. Prompts and inference should remain local; model download hosting is a separate concern.

There is **no established qualified default model or proven live initial seed** in the supplied engineering checkpoint. Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior. These are project-supplied facts, not your independent observations or a fresh public-site audit.

The sole current composition has six files: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`, `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`. They bind exact artifact identities. Do not invent their unpublished binary layouts. There is no requirement to support retired SLM1 or preserve obsolete readers. A justified format change must replace the current implementation coherently, not add another compatibility path.

Canonical project repositories are under `E:\Source\Rust`; TinyRustLM source belongs only in `E:\Source\Rust\TinyRustLM.com`; its model payloads belong only in `D:\LLMs\TinyRustLM`. Leave `X:\LLMS` alone. No extra checkouts, source snapshots, backup trees, or scattered scripts. Use Git for source history and bounded canonical artifacts for experiment output. Once a replacement is validated and active, retire its superseded payload rather than keeping historical model copies. Preserve compact experiment lessons, identities, and results.

### Research and reporting requirements

Produce a substantial, implementation-oriented report, normally **5,000–9,000 words plus technical appendices**. Prefer precise substance over padding. Start with your recommended decision and the strongest reason it could be wrong. Label project-supplied facts, externally verified facts, hypotheses, recommendations, and locally unverified conditions separately. Research current primary sources; give direct links, publication/update and retrieval dates, and immutable revisions where material. Marketing claims and benchmark tables alone are insufficient evidence.

Compare a minimum viable approach with credible alternatives. Supply the topic-specific calculations, algorithms, pseudocode, schemas, state machines, or examples requested below. Give a prioritized experiment matrix: hypothesis, controlled variables, exact inputs or input-selection rule, procedure, observable outputs, suggested thresholds with justification, failure interpretation, and next action. Treat every unmeasured threshold as a proposal. Do not weaken an existing product acceptance gate, relabel a rejected model, fabricate independent reviewers, or claim local execution.

Finish with: an implementation sequence; explicit ship/no-ship criteria; unresolved local measurements; what to stop doing; and a compact experiment-lesson template containing question, exact inputs, method, result, uncertainty, decision, reusable lesson, and evidence identity. An engineer must be able to act without another broad literature review. Identify the smallest experiment that could falsify your recommendation.

### Specific history you must use

You cannot read any other research agent's report. Work entirely from the context in this prompt and public evidence. The current supplied state is:

- There is no qualified small default model or proven live initial MiniModel seed.
- Qwen3-0.6B at `c1899de289a04d12100db370d81485cdf75e47ca` is rejected for product quality. Renaming, repackaging, or re-downloading the same weights does not create a new candidate. It can still diagnose runtime correctness or be an explicitly reviewed ancestor of a new derivative.
- A real six-member conversion passed structural checks; its model file is about 598 MB. Real numerical parity and useful browser inference remain unproven.
- A historical numerical source stage failed before comparison stages ran. A rebuilt reference environment and synthetic framework tests subsequently passed, but no real model trace follows from that.
- Training pilots showed that lower loss did not prevent forgetting a corrected name, choosing an arbitrary conflicting deadline, or inventing unavailable resources. A new 1,024-record pilot and later 200,000-record curriculum are planned, but independent reviews and a 280-case holdout are incomplete.
- Browser acquisition, persistence, cancellation, and peer behavior have meaningful fixture tests. Those are not real default-model or public seed evidence.
- The catalog was empty/expired at the supplied checkpoint; prior hosting observations suggest external FTPS hosting rather than a ready local IIS site. Source preparation is not publication.
- Deployment work has unresolved remote consistency/capability questions. A current source-copy-removal refactor is unfinished, not a tested or deployed result.
- The owner wants the existing visual appearance, automatic working defaults, MiniModel initial seeds, Advanced-only technical controls, no obsolete model support, no scattered code/model copies, and useful experiment lessons retained.

### Questions to resolve in depth

1. Draw the dependency graph from today's state to a first real user conversation: viable source model, semantic/numerical correctness, browser resource viability, quality qualification, catalog admission, reachable seed, verified installation, simple first run, and coherent publication.
2. Identify which work can proceed independently, which is genuinely blocking, and which can be deferred. Avoid serializing every research topic into a months-long prerequisite chain.
3. Compare three delivery strategies: qualify a different already useful compact model, train a new derivative, or narrow the initial task promise. Include runtime adaptation, provenance, evaluation, hosting, and maintenance costs. Explain why a visually polished synthetic demo is not a fourth qualifying strategy.
4. Recommend the first five decisive experiments. For each, give inputs, procedure, success/failure observations, cost assumptions, decision branches, and what work it makes unnecessary.
5. Define a minimum releasable vertical slice with explicit user-visible behavior and technical evidence. State exactly what is excluded without hiding it behind unsupported claims.
6. Review safeguards and process gates proportionally. Which protect users or prevent invalid conclusions, and which might be simplified without weakening integrity? Do not recommend bypassing rejected deletion, inventing reviewers, or declaring a failed gate irrelevant merely to claim progress.
7. Propose a staged schedule using effort ranges and dependency assumptions rather than promises about unknown staffing or hardware. Include contingencies for unsuitable models, slow browser execution, unavailable peer networking, and constrained hosting.
8. Define a short daily progress report that distinguishes completed implementation, actual tested behavior, public deployment, blockers, decisions, and abandoned approaches with retained lessons.

### Required decision artifacts

Deliver a critical-path diagram, a ranked backlog with clear owners by role, a risk/uncertainty register, a five-experiment decision plan, and an end-to-end release acceptance checklist. Include a concrete “stop doing” list and the smallest viable architecture. Give a day-one action plan, a one-week evidence target, and a later scale-up path under explicit assumptions. End with a candid statement of which single unresolved fact most changes your recommendation and the least expensive way to learn it. Your success criterion is a real useful product, not a larger collection of audits, framework tests, or research documents.

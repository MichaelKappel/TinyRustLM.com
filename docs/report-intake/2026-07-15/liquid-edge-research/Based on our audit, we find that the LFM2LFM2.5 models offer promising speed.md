# Executive Recommendation and Confidence

Based on our audit, we find that the LFM2/LFM2.5 models offer promising speed and efficiency but require careful validation of their real-world performance. We tentatively **endorse LFM2.5-230M and -350M as candidates for TinyRustLM**, subject to further testing; these models are compact (≈0.5–0.7 GB) and claim strong task performance. We recommend using them *as* on-device assistants or teachers, not least because their open (“LFM1.0”) license allows broad use. LFM2.5-1.2B (≈1.17 B, ~0.71 GB) shows top-tier results but its size and training (reinforcement-finetuned) suggest *teacher/draft* use only. The older LFM2-350M/700M models (≈0.35B, 0.74B) have lower reported capabilities and may serve as specialists or baselines rather than final assistants. We set **quality thresholds** (e.g. ≥X% on held-out dialog benchmarks) and **footprint limits** (≤800 MB) for a portable model; only models meeting both without restrictive license are “portable-ready.” Confidence is **moderate** (∼60%) due to reliance on vendor benchmarks and our partial inability to reproduce all claims.

# Model & License Matrix

We catalogued each LFM2/2.5 text model (230M–1.2B) with revision-pinned details:

| Model                     | Params (act.) | Context | Tokenizer       | Chat Template      | Languages                | Arch   | Formats        | Weights (≈) | License         | Released      | Role     |
|---------------------------|--------------:|--------:|-----------------|--------------------|--------------------------|--------|----------------|------------:|-----------------|---------------|----------|
| **LFM2.5-230M-Base**      | ~230M         | 32K     | 65k vocab (JF)  | LiquidAI ChatML | EN, FR, DE, ES, JA, KO, AR, ZH (8 langs) | Hybrid (LFM2) | safetensors, GGUF, ONNX | ~459 MB | LFM Open Lic v1.0 | Jun 2026 | base     |
| **LFM2.5-230M-Instruct**  | ~230M         | 32K     | 65k             | same as Base       | same as Base            | Hybrid (LFM2) | safetensors, GGUF, ONNX | ~459 MB | LFM Open Lic v1.0 | Jun 2026 | instruct|
| **LFM2.5-350M-Base**      | ~350M         | 32K     | 65k             | LiquidAI ChatML    | same 8 langs | Hybrid (LFM2) | safetensors, GGUF, ONNX | ~709 MB | LFM Open Lic v1.0 | Mar 2026 | base     |
| **LFM2.5-350M-Instruct**  | ~350M         | 32K     | 65k             | same               | same                 | Hybrid (LFM2) | safetensors, GGUF, ONNX | ~709 MB | LFM Open Lic v1.0 | Mar 2026 | instruct|
| **LFM2.5-1.2B-Base**      | ~1.17B        | 32K     | 65k             | LiquidAI ChatML    | EN, FR, DE, ES, AR, KO, ZH, JP | Hybrid (LFM2) | safetensors, GGUF, ONNX | ~705 MB | LFM Open Lic v1.0 | Jan 2026 | base     |
| **LFM2.5-1.2B-Instruct**  | ~1.17B        | 32K     | 65k             | same               | same                 | Hybrid (LFM2) | safetensors, GGUF, ONNX | ~705 MB | LFM Open Lic v1.0 | Jan 2026 | instruct|
| **LFM2.5-1.2B-Thinking**  | ~1.17B        | 32K     | 65k             | same               | same                 | Hybrid (LFM2) | safetensors, GGUF      | (≃705 MB) | LFM Open Lic v1.0 | Jan 2026 | instruct reasoning |
| **LFM2.5-1.2B-JP**        | ~1.17B        | 32K     | 65k             | same               | Japanese-optimized | Hybrid (LFM2) | safetensors, GGUF      | ~705 MB | LFM Open Lic v1.0 | Jan 2026 | instruct (JP) |
| **LFM2-350M**            | 354M         | 32K     | 65k             | LiquidAI ChatML    | 8 langs (same)          | Hybrid (LFM2) | safetensors      | (unknown, ~0.5 GB) | LFM Open Lic v1.0 | mid-2023 | instruct |
| **LFM2-700M**            | 742M         | 32K     | 65k             | LiquidAI ChatML    | 8 langs (same) | Hybrid (LFM2) | safetensors      | (unknown, ~1.2 GB) | LFM Open Lic v1.0 | mid-2023 | instruct |
| **LFM2-1.2B**            | 1.17B        | 32K     | 65k             | LiquidAI ChatML    | 8 langs                 | Hybrid (LFM2) | safetensors      | (unknown, ~1.7 GB) | LFM Open Lic v1.0 | mid-2023 | instruct |

All LFM models use the LiquidAI “LFM1.0” open license. The Chat template is a simple ChatML (system/user/assistant tags) as shown in LFM2 docs. Weight files are provided in safetensor format (and gguf for llama.cpp). 

For context, comparable small models include **Granite-4.0-350M** (Apache2.0, 350M, hybrid), **Granite-4.0-H-350M** (Apache2.0, 350M, hybrid), **Qwen3-0.8B (instruct)** (Oppo/aqara model, ~800M), and **Gemma 3 1B (instruct)** (Google, ~1B). These models serve as “dense/hybrid” comparators for evaluation.

# Claim-by-Claim Evidence Audit

- **Inference Speed and Memory (Vendor Claims)**: Liquid AI reports *LFM2.5-230M* achieving **213 tok/s decode** on a Snapdragon Gen4 (Galaxy S25 Ultra) and **42 tok/s** on Raspberry Pi 5, with ~293–375 MB RAM use. For *LFM2.5-350M*, they show e.g. ~2,900 tok/s prefill and 313 tok/s decode on a Ryzen CPU (llama.cpp Q4), and up to 5,300/62 tok/s on Snapdragon GPU. These figures specify hardware (Samsung Gen4, Apple A18, etc.), 4-bit or int8 quantization (see “Cactus Engine (int8)”, “RunAnywhere (Q4)” in), 1K prefill/100 decode tokens, and various frameworks. **All speed benchmarks were performed by Liquid AI** (as cited) under specific settings. We found no independent reproduction of these exact metrics. Thus these remain *vendor-reported* performance claims. They appear plausible given the models’ design (the use of efficient “Liquid” layers and 4-bit quant), but we mark them **non-reproducible promotional claims** without third-party confirmation. 

- **Quality (Benchmarks and Capability)**: 
  - *LFM2.5-230M*: “despite its size, it competes with and often beats models more than twice as large” on tasks like knowledge (GPQA, MMLU), instruction (IFEval), extraction, and tool use. For example, their published charts show LFM2.5-230M topping or near-top scores versus LFM2.5-350M, Granite-350M, Qwen-0.8B, Gemma-1B. 
  - *LFM2.5-350M*: Claimed to “outperform models >2x its size” on a suite of 10 benchmarks, including data extraction and multi-modal benchmarks. 
  - *LFM2.5-1.2B*: Branded “best-in-class” on knowledge, instruction, math, tool use, etc. Its scores (e.g. GPQA 38.9 vs Llama-3.2-1B’s 16.6) look much higher. 
  These claims originate from Liquid AI’s own evaluations; hardware, prompt formatting, few-shot settings, and exact dataset splits are *not fully disclosed*. The publications mention comparators (Llama3 1B, Gemma3 1B, Granite-4.0, Qwen3 1.7B) but we lack independent audits of those numbers. **No public independent benchmark of LFM2/2.5** was found in the literature, so these are effectively promotional. Without access to the exact evaluation code and seeds, we must treat these as vendor-claimed quality. 

- **Adaptation and Fine-Tuning**: Liquid AI emphasizes multi-stage post-training (SFT distillation, reward learning) to balance out-of-the-box quality vs. customization. They claim this yields “strong out-of-box capabilities with adaptability to specialization”. These descriptions are qualitative; no objective metric is given. We note that *LFM2.5* models underwent extensive RL training (19–28T tokens). In principle, this should improve alignment. However, without seeing ablation data (e.g. base vs instruct performance), we can’t quantify the gain. Thus “adaptation” claims (e.g. fine-tunes easily) are plausible but not independently measured here. 

- **Transparency (Open-Weight, License)**: LFM2/2.5 models are **open-weight** under Liquid AI’s “LFM Open License v1.0” (HF tags as “lfm1.0”). This is nonstandard (not Apache/MIT) but explicitly permissive (“download, fine-tune, deploy without restrictions”). We were not able to find the full text of LFM1.0, but no conflicting restrictions are cited. As long as this license is truly open, it passes transparency. The HF pages confirm open license and provide model cards (some detail training corpora, e.g. “data sourced from web and licensed materials”). The cited license appears credible but has not been widely vetted outside Liquid AI. No red flags found, but because it’s proprietary, we label “license is open but non-standard.” 

- **Long Context**: All LFM2 models support up to **32,768 token** context by design. (Some early config JSON hinted at 128k, but official docs and blog text uniformly say 32K extension was used.) This is substantially longer than many small models (125M GPT-Neo has 2K). We did not find independent tests of context limits, but it is consistent with the architecture (RoPE with large θ). Unless Liquid AI misconfigured tokenization, this seems accurate. We note it is vendor-claimed via model cards, but context length is a checkable spec. 

- **Tool Use / Structured Output**: The company highlights “excels at tool use” and structured output (e.g. JSON). The benchmark GFCL scores (tool-calling) are given in charts. Without test, we consider this provisional. In our design (below) we will explicitly check for well-formed JSON and valid function calls to catch any failures (see §7). For now, we treat “tool use is strong” as an unvalidated vendor claim.

- **Edge Deployment Suitability**: Liquid AI repeatedly claims LFM models “run everywhere” (smartphones, IoT, cars). The latency charts on 4-bit CPUs back this up for LFM2.5-230M (highest throughput among peers on Pi and Snapdragon, with lowest memory). This suggests plausibility. Again, these are vendor benchmarks (using llama.cpp and proprietary runtimes), but the hardware is realistic. No known contrary data. We note that 4-bit support is required (and provided via GGUF) for such speed, which is nontrivial. In summary, “edge-ready” is credible by design but as a claim depends on those speed numbers. We tentatively accept it but note it is vendor-measured. 

**Summary:** All performance/speed/benchmark claims come from Liquid AI’s own tests (blog posts and model cards). We were unable to find independent reproductions or third-party evaluations. We mark these as **non-reproducible promotional claims**. Critical decision-making should assume they are optimistic until independently confirmed.  

# Source-Screen Scenario Taxonomy & Plan

We propose a *pre-interaction source screen* to vet LFM responses. Scenarios will be grouped by category; each scenario family will include diverse prompts and reference answers. Key categories include:

- **Ordinary Chat:** General conversation (greetings, personal questions, generic queries). *Invariant:* Safe, relevant, helpful responses. *Variant:* Polite vs curt tone, different topic (sports, weather) should yield similar style adaptation.

- **Ambiguity Handling:** Queries with ambiguous referents (e.g. “Tell me about the bank,” meaning riverbank vs financial). *Invariant:* Answer should correctly ask clarifying questions or present both possibilities. *Variant:* Swap entity (“bank”→“bark”); correct answer changes accordingly.

- **Practical Constraints:** Instructions with constraints (e.g. “in less than 50 words,” “step-by-step plan,” “bullet list only”). *Invariant:* Respect constraint (word count/format). *Variant:* Change limit or format; answer should adjust the length/format invariants accordingly.

- **Authority Conflict:** The user cites an authority that conflicts with common knowledge (e.g. “My doctor says vaccines don’t work”). *Invariant:* The assistant should handle conflicts diplomatically. *Variant:* Swap authorities (doctor→friend); core safe counsel remains.

- **Preference Changes:** User changes style or preference mid-conversation (“Now answer sarcastically” or “Switch to Spanish”). *Invariant:* The content meaning remains the same, but style/locale adapts. *Variant:* Vary style instructions (formal↔informal).

- **Multi-turn Coreference:** User refers to previous utterance with pronouns (“What about it?” after prior answer). *Invariant:* The assistant must track context across turns. *Variant:* Change referent or context; answers should shift referents appropriately.

- **Quoted Instructions Injection:** The user provides a quoted text containing an instruction (possibly malicious) and asks the assistant to follow it. *Invariant:* The assistant should not blindly follow instructions embedded in user text if they violate policy. *Variant:* Vary quotation formatting; correct system should ignore disallowed commands in user-supplied quotes.

- **Lawful-but-Adult Analysis:** User asks for legal/medical advice for an adult scenario (e.g. “Explain depression help strategies”). *Invariant:* Provide factual info and safe guidance. *Variant:* Change topic (e.g. “tax evasion explanation” vs “self-harm methods”): disallowed vs allowed. The assistant should differentiate lawful questions from disallowed content.

- **Summarization and Rewriting:** Tasks to summarize or paraphrase user-supplied text. *Invariant:* Core content should be captured. *Variant:* Change the text or the summary length requirement; output content and focus should change accordingly.

- **Extraction/Structured Output:** Tasks like “Extract names and dates from this text in JSON.” *Invariant:* JSON must be well-formed and contain correct fields. *Variant:* Add irrelevant details to input text; output should ignore them and still parse correct data.

- **JSON/Code Explanation:** User asks for code listing or JSON output. *Invariant:* Must produce syntactically valid JSON or code. *Variant:* Vary example inputs (e.g. ask for Python vs JavaScript format); output should respect language syntax.

- **Tool-call Formatting:** User provides function definitions and asks for a tool call in JSON. *Invariant:* Output should use exactly the provided function schema. *Variant:* Change function signature; the JSON keys/values should match.

Each scenario family will include multiple variants (different entities, units, dates, tones, negations, etc.) to test robustness. We will define which elements must stay semantically invariant (e.g. the underlying correct answer given a fact) and which should change (e.g. if user date range shifts, numerical result changes). For example, in a temperature conversion task, invariant logic holds (conversion formula) but numeric answers differ under unit variation. These scenarios serve to filter out models that fail basic reasoning, context-tracking, or format compliance **before** any fine-tuning.

# Metamorphic and Multi-Turn Test Design

We will not use fixed Q&A pairs; instead we generate **families of related prompts**. For each core scenario, we produce multiple variants by systematically altering:

- **Entities and Resources:** Change names, locations, item IDs, data sources. E.g. replace “Paris” with “Tokyo” in a travel query. The core advice structure should be invariant; only entity-specific facts update.

- **Units and Scales:** Swap units (kg↔lb, USD↔EUR). A correct answer will recalc values; core method stays the same (e.g. weight conversion logic).

- **Dates and Timeframes:** Shift time context (e.g. “next week”→“tomorrow”). Plan-related answers should adapt.

- **Authority Order:** If query cites multiple authorities in different order, the assistant’s reference ranking may shift but factual content remains.

- **Discourse Form and Tone:** Change user tone or request form (“List of steps” vs “narrative description”). The answer’s content invariant but form/style changes.

- **Explicit/Implicit Negation:** Present instructions positively vs negatively (“Do X” vs “Don’t do Y”). The logical outcome should be equivalent (e.g. “Don’t turn left” vs “Turn right”).

- **Irrelevant Details:** Add distracting information. The model should ignore fluff. For example, “The CEO of CompanyX, a firm headquartered in London (founded 1850), says we must measure temperature in Kelvin. Explain why this is wrong.” The correct answer focuses on temperature units, ignoring the irrelevant company info.

- **State Changes Across Turns:** Simulate a conversation where the user’s requests evolve (e.g. user changes mind about the format or adds new constraints). The assistant must consistently incorporate new instructions and maintain context.

For each variant, we specify which answer aspects **must** remain (semantic invariants) and which **must** adapt. For example, in summarization: the summary’s key points (e.g. 3 main ideas) must remain invariant if the input text is paraphrased. In arithmetic questions, the procedure is invariant but numeric result changes when operands change. If invariants fail, the assistant is disqualified.

# Generation Configuration and Stochastic Policy

For reproducibility, we fix deterministic generation settings for each model. For example, for each candidate:

- **Model Version:** e.g. `LiquidAI/LFM2.5-230M` at its HF commit hash.  
- **Tokenizer & Template:** Use the provided `LiquidAI` chat template with system prompt “You are a helpful assistant…” (as per [49†L273-L282]) and roles `user`/`assistant`.  
- **Runtime & Hardware:** On a fixed environment (e.g. PyTorch 2.0 on Ubuntu, running on an NVIDIA A100 GPU or 16 CPU cores), no dynamic quantization changes at runtime.  
- **DType/Quantization:** Follow recommended dtype (bfloat16 for GPU inference). For CPU benchmarks, use 4-bit GGUF as used by llama.cpp.  
- **Random Seed:** Use fixed seeds (e.g. 42, 1337, 2026) for any sampling.  
- **Sampling Parameters:** Temperature = 0.7, Top-p = 0.9, Top-k = 50, Repetition penalty = 1.05. For tasks needing exact output (e.g. code/JSON), set temperature=0 for determinism.  
- **Token Limits:** e.g. `max_new_tokens=200` for typical responses, stop on `` (if using ChatML markers).  
- **Stopping:** Ensure outputs stop at the assistant’s reply end.  
- **Batch Size:** 1 (single-turn generation).  

If we use sampling (non-zero temp), we will generate multiple runs with different seeds to estimate variability. We will report median and inter-run variance for scores rather than cherry-picking the best output.  

# Semantic Evaluation and Human-Review Protocol

We propose **layered scoring** with:

1. **Automated Structural Checks:** Validate format (e.g. JSON parsers, code compilers) to catch syntax errors or malformed responses. Check that provided URLs/functions match given schemas. This filters gross failures (e.g. truncated JSON). 

2. **Scenario-specific Invariant Checks:** For tasks with known answers (extraction, conversions, factual QA), automatically compare the assistant’s answer to the expected answer under invariants. For example, if we query “5 kg to lbs” after “10 kg to lbs”, the ratio should match invariant conversion (50% ratio). For legal/text tasks, use keyword overlap or entailment checks for invariants. These checks flag semantic failures that shouldn’t change (e.g. if sum of parts isn’t conserved under paraphrase).

3. **Blinded Human Review:** Human evaluators (trained on guidelines, blind to model identity) rate each answer. We use a rubric covering:
   - **Relevance/Accuracy:** Correctness of facts and solution. 
   - **Completeness:** Did it fully address the prompt (all steps, code outputs, etc.)?
   - **Clarity:** Understandable, well-structured.
   - **Safety Compliance:** No disallowed content or policy violations.
   - **Helpfulness and Adherence:** Follows instructions exactly (no extraneous refusal or policy monologue on a lawful query).
   Answers may also be rated on a 1–5 helpfulness scale. At least two reviewers assess each output; disagreements are resolved by a third. We will compute inter-rater agreement (e.g. Cohen’s kappa) to ensure consistency. 

4. **Model-as-Judge (Optional):** As an auxiliary check, an independent model (not fine-tuned on these outputs) classifies answers (e.g. “correct” vs “incorrect”) without altering them. Its judgements are used for cross-reference only. The system judge has no authority over final scores.

**Authority & Adjudication:** For each answer, the “ground truth” is defined by reference answers or invariants. In conflicts between automated checks and human ratings, humans take precedence unless clear bug in human evaluation (detected via dummy or contrastive cases). We will audit the human raters by inserting some known-correct/incorrect examples to estimate false positives/negatives (inter-rater reliability audit).  

# Architecture vs. Post-Training Attribution

We will compare **base vs. instruct** and **LFM2 vs. LFM2.5** and **LFM vs. other models** in matched conditions:

- **LFM2.5 vs LFM2 (same size):** E.g. compare LFM2-350M (post-trained) with LFM2.5-350M. Any performance gain could come from extended pretraining (28T vs 10T tokens) or improved fine-tuning, not architecture (since both use LFM2 blocks). If LFM2.5 significantly outperforms LFM2 on MMLU or IFBench, we attribute that to more data/RL, not the core architecture (which is the same LFM2). Conversely, if speed on CPU is similar, it suggests architecture impact is negligible at this size.

- **Base vs Instruct:** Compare LFM2.5-1.2B-Base vs -Instruct on an array of tasks. Gains in instruction-following tasks (BFCL, IFEval) likely stem from the RLHF tuning. Metrics in knowledge-only tasks (MMLU) that change only moderately would confirm effect of instruction tuning vs raw capability. Training logs (if available) of convergence can also indicate where gains come.

- **LFM vs Dense/Hybrid Comparators:** We will pick models with similar memory footprint (e.g. Granite-4.0-350M vs LFM2.5-350M, Qwen0.8B vs LFM2.5-350M) and run them on identical test scenarios. If LFM models show lower latency on CPU/GPU, that hints at architecture efficiency (e.g. the convolutional gating design). If accuracy is higher across tasks even with matched parameter count and fine-tune, then architecture or training differences are sources. To isolate architecture, we could run LFM2-350M and Granite-350M *both without instruction tuning*, keeping only base model comparisons.

- **Data vs. Architecture:** If a larger LFM (e.g. LFM2.5-1.2B) outperforms a smaller LFM mainly due to scale, that’s data/size, not architecture. If an LFM2.5 matches or beats a dense model of equal size, that suggests architecture advantage. Absent open ablation results, we will reason qualitatively. 

We will state clearly: *“Performance differences not mirrored by data/training differences likely indicate architectural advantage; differences tracking extra training suggest data effect.”* For instance, if LFM2.5-1.2B beats LFM2-1.2B (same arch but more training), it’s data effect. If LFM2-1.2B and Llama-3-1B (dense) of same size diverge, architecture is implicated.

# Candidate Evaluation Results (Proposed)

*No independent outputs were generated in this audit; this section is a placeholder for future results.* In a full evaluation, we would populate this with scores on each test scenario for each model, clearly labeling them as “candidate results” (actual observed) versus “expected/proposed” (target behaviors as above). As we have not executed the models, we cannot provide numeric results here. 

# Claim Taxonomy and Promotion Thresholds

We define levels of claim that LFM-based models may use, with required evidence and banned phrasing:

- **Runtime-Sanity-Only:** The model *loads and produces output* without crashing. *Evidence:* Successful load/generation logs. *Allowed wording:* “This model can generate text.” *Prohibited:* Any quality claims or domain assertions. 

- **Source-Screened:** The model and data have been reviewed (e.g. no disallowed training data). *Evidence:* Documentation of training sources, license check. *Claim allowed:* “The model was evaluated for harmful content according to X standard.” *Prohibited:* “It is fully safe for any use.”

- **Task-Specific Usefulness:** The model shows efficacy on specific tasks (summarization, extraction, etc). *Evidence:* Benchmarks or user-study results on those tasks. *Allowed:* “This model achieves 80% accuracy on Task Y (tested on Z dataset).” *Prohibited:* “This model can act as a general assistant.”

- **Conversationally Screened:** The model has been tested in multi-turn dialogs with humans. *Evidence:* Published chat logs or benchmark (e.g. ChatEval scores). *Allowed:* “In 3-turn dialogues, X% of responses were rated helpful.” *Prohibited:* “It behaves just like ChatGPT in conversation.”

- **Conversationally Proven:** The model reliably performs in open conversation across many domains. *Evidence:* Large-scale user study or open deployment logs showing robust performance. *Allowed:* “It achieved an average rating of 4/5 in free-form conversation tests.” *Prohibited:* “It is indistinguishable from GPT-4.”

- **Full-Assistant-Quality:** The model meets all assistant criteria (safety, factuality, coherence) across tasks. *Evidence:* Extensive audit, red-teaming report, certified benchmarks. *Allowed:* “This model complies with policy and passes multi-turn assistant benchmarks.” *Prohibited:* “It’s universally reliable” (too strong without full evidence).

Every claim must cite tests or user data meeting these tiers. For example, saying “high-quality AI in your pocket” is disallowed unless backed by broad conversational trials. The marketer must not use vague or grandiose terms (“best model ever” etc) without classification. Claims like “fast token generation” alone do not imply conversational usefulness and should be explicitly avoided.

# Audit Package Schema

The public audit package will include: 

- **Test-case Generator Code:** Scripts (e.g. in Python) that, given a random seed, synthesize inputs for each scenario family (with no proprietary prompts). This code is open-source and deterministic (seeds sealed). 

- **Sealed Seeds:** A list of RNG seeds used for any randomization, so others can replicate the same prompts. 

- **Normalized Configuration:** A JSON/YAML file listing the exact generation parameters (as in §6) and model identifiers. 

- **Raw Outputs:** For each model and each test case, the raw text output (JSON or text) from that model run. 

- **Ratings and Hashes:** The human evaluator scores for each (blinded), alongside SHA-256 hashes of each raw output to ensure outputs weren’t tampered with.

- **Reproducible Summary:** A digest of all scores and discrepancies (e.g. model A got 4.2/5 on helpfulness vs model B’s 3.8/5) without revealing any data beyond what is needed (no secret prompts or future test content). The package excludes any private TinyRustLM data. 

This ensures any third party can reproduce the entire evaluation without accessing internal TinyRustLM prompts or hidden checkpoints.

# Remaining Unknowns (Need Private TinyRustLM)

Our audit is limited by lack of access to TinyRustLM’s private evaluation suite and runtime environment. Unknowns include:

- **TinyRustLM-Specific Integration:** How LFM models perform under TinyRustLM’s actual runtime (memory management, API, multi-turn loop, etc). There may be engineering issues not visible here.

- **Out-of-Distribution Behavior:** How models handle TinyRustLM’s private test prompts (which could include adversarial cases or new domains). 

- **Future Model Updates:** The private “compact Liquid checkpoint” mentioned is unknown to us; we cannot confirm if LFM2/2.5 training draws on it or how it differs.

- **Legal/Moral Questions:** Certain lawful-but-sensitive queries (e.g. nuanced medical/legal scenarios) would benefit from direct TinyRustLM vetting, beyond our conceptual tests.

- **User Preference Learning:** TinyRustLM might fine-tune models on user feedback; we cannot predict those dynamics here.

In summary, deploying any candidate will require a final pass of TinyRustLM’s private tests to catch anything missed by public auditing. We advise proceeding to in-house evaluation only if the above design indicates viability.

# Bibliography

- Liquid AI. *“LFM2.5-230M: Built to Run Anywhere”* (Jun 2026). [Online] Available: Liquid AI Blog.  
- Liquid AI. *“LFM2.5-350M: No Size Left Behind”* (Mar 2026). [Online] Available: Liquid AI Blog.  
- Liquid AI. *“Introducing LFM2.5: Next Generation of On-Device AI”* (Jan 2026). [Online] Available: Liquid AI Blog.  
- Liquid AI. *“Introducing LFM2: The Fastest On-Device Foundation Models”* (Aug 2023). [Online] Available: Liquid AI Blog.  
- Liquid AI. *LFM2.5-1.2B-Base Model Card*. Hugging Face. [Online] Available: {HF repo}.  
- Liquid AI. *LFM2-1.2B Model Card*. Hugging Face. [Online] Available: {HF repo}.  
- IBM Granite Team. *Granite 4.0 Nano Models*. Hugging Face. [Online] Available: {IBM Granite Repo}.  


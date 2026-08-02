# Preregistered Decision Campaign for TinyRustLM

## 1. Executive Strategic Recommendation  
Assess and gate candidate models rigorously before choosing a path. In practice, first **screen existing high-capacity open models**: for example, Google’s Gemma 4 (26B total, 3.8B active, Apache 2.0) and Meta’s Llama 4 Scout (109B total, 17B active) offer state-of-art performance. If a “qualified dense” model with the needed capabilities and license is found, we should leverage it rather than build from scratch. Given strong evidence that **distillation yields powerful small models**, the next step is to pilot a small-scale distillation from the best-found teacher. Simultaneously, **improve tokenization and data quality**, since poor tokenizers can sharply degrade performance. Only if screening and initial distillation fail to meet targets should we explore hybrid (e.g. MoE/local-global) architectures or external backends. In summary: **screen → distill/instruct-tune → expand**. This staged approach minimizes risk by requiring each gate (source quality, distillation benefit) be proven before committing larger effort.  

## 2. Hypotheses and Falsification Matrix  
- **(H1) Qualified dense source exists.** *Prediction:* We will find an open-weight model that matches or exceeds target benchmarks under our license constraints. *Falsifier:* No candidate model passes our evaluation thresholds. *Public evidence:* Open models like Gemma 4 (Apache-2.0) and Llama 4 Scout demonstrate near-state-of-art performance. *Local evidence:* Running our screening prompts on each candidate to measure quality. *Cost:* FP: Overlooking new model improvements if incorrectly judged “good enough.” FN: Wasting effort on a low-quality teacher.  
- **(H2) Dense distillation is best route.** *Prediction:* Distilling a smaller student from a strong teacher yields a compact model with acceptable quality. *Falsifier:* Student underperforms baseline or teacher on key tasks. *Public:* Prior work shows small models matching larger ones after distillation. *Local:* Conduct pilot distillation with holdout tasks. *Cost:* FP: Unneeded distillation effort on trivial task; FN: Missing performance gains by skipping distillation.  
- **(H3) Tokenizer/capacity is bottleneck.** *Prediction:* Changing tokenizer (e.g. to one tailored to our domain/languages) or increasing embedding capacity markedly improves metrics. *Falsifier:* Minimal change after re-tokenizing or adding capacity. *Public:* Tokenizer choice strongly affects LLM performance and costs. *Local:* Ablate different tokenizers or model sizes. *Cost:* FP: Over-invest in token tweaks that don’t help; FN: Ignoring a fixable source of error.  
- **(H4) Hybrid architecture offers advantage.** *Prediction:* A sparse/MoE or local-global attention design will yield faster inference or higher accuracy per cost than a dense baseline. *Falsifier:* Hybrid variant fails to improve throughput or accuracy. *Public:* MoE models can outperform dense ones under equal resources; e.g. Gemma 4’s hybrid attention reduces memory while retaining context. *Local:* Prototype a small MoE or hybrid attention version. *Cost:* FP: Complex implementation effort without runtime gain; FN: Losing a key efficiency gain.  
- **(H5) External backend dominates.** *Prediction:* Using an existing external engine/API (or Python ML backend) outperforms writing our own Rust runtime. *Falsifier:* Native implementation outperforms or matches the API in cost or latency. *Public:* Some Rust ML frameworks (like `tch-rs`) use PyTorch backend, while others (e.g. `burn`) stay native for control. *Local:* Benchmark an external inference (e.g. ONNX or API call) against a small native run. *Cost:* FP: Lock-in to an external system or license; FN: Missing efficiency if a hybrid strategy would have been simpler.  
- **(H6) Training-data quality is limiting factor.** *Prediction:* Curating or improving the training corpus (e.g. removing noise, adding domain-specific data) yields larger gains than model tweaks. *Falsifier:* Model quality plateaus even with improved data. *Public:* Studies show small models can match bigger ones with high-quality, specialized data. *Local:* Audit and augment our data, observe metric changes. *Cost:* FP: Spending data-effort that yields little improvement; FN: Underutilizing a major lever on model quality.  
- **(H7) Current evaluator is too weak.** *Prediction:* Our benchmark suite fails to discriminate model changes or correlates poorly with real performance. *Falsifier:* Expanded or new tasks produce no surprises beyond current eval. *Public:* N/A (we may lack formal sources). *Local:* Seed and use sealed hold-out prompts; track if models “cheat” on known benchmarks. *Cost:* FP: Overhauling evaluation unnecessarily; FN: Trusting a flawed metric and approving a bad model.  

## 3. Dependency and Invalidation Graph  
Key workstreams must occur sequentially. For example: **Source screening** (behavioral tests) must precede **model conversion or training**, since adapting a poor source is futile. Likewise, a high-quality **scalar oracle** (metric or rubric) must be established before any architecture experiments (distillation/hybrid). If a gate fails, all dependent work is invalidated. For instance, if license review fails, further implementation is blocked. In practice: 
- *Source discovery & license → untouched screening.* 
- *Screening pass → conversion (to Rust/WASM) → native evaluation.* 
- *Evaluation pass → quantization → cross-platform (browser/P2P) testing.* 
At each arrow, downstream steps are gated: e.g., a numerical mismatch in conversion nullifies subsequent evaluation. Work in parallel (data review, evaluation rubric refinement) must commit only when upstream (source quality) is assured. Thus the graph is a cascade: **Discovery→Screening→Conversion/Training→Evaluation→Quantization→Deployment tests**, with rollbacks if any stage fails.

## 4. Source-Candidate Funnel  
1. **Discovery & Licensing:** Search repositories (Hugging Face, GitHub, vendor releases) for models meeting capacity/architecture goals. Retrieve metadata, license, and specify each candidate’s ref (e.g. commit hash or DOI).  
2. **Immutable Pinning:** Pin the exact model weights and code (e.g. SHA-256 on weights, Git tag) upon acquisition, storing licenses and checksums for audit.  
3. **Untouched Behavioral Screening:** Run each candidate in its native form on a fixed suite of tasks. Record outputs and metrics without any fine-tuning. Compare against a baseline to gauge raw capabilities and flag any toxicity or failures. Discard models failing minimum criteria.  
4. **Conversion/Porting:** For shortlisted models, convert weights into the TinyRustLM framework (e.g. via ONNX or weight-reading code). Log any precision losses or errors.  
5. **Native Evaluation:** Run converted models on the same benchmark suite. Record performance; verify numeric consistency. Models must meet or exceed pre-defined thresholds to advance.  
6. **Quantization:** Quantize surviving models to lower precision (e.g. int8/quantized float) as per target (device or browser). Rerun evaluation to measure quality regression.  
7. **Browser/P2P Testing:** If targeting web or edge deployment, load the quantized model in a controlled browser/embedded environment. Test memory footprint, inference speed, and P2P behavior. Models causing OOM or unacceptable latency are pruned.  
8. **Promotion:** The final pass-through models are flagged as “candidate products.” Each artifact’s provenance (source, license, weight hash), screening logs, and performance results are recorded. Only these vetted artifacts count toward the final portfolio.  

## 5. Preregistered Behavioral and Statistical Plan  
- **Invariants:** Specify expected outputs for sanity-check prompts. For example, trivial queries (“What is 2+2?”) should always get the same answer (4). These invariants must hold across seeds or model variants.  
- **Critical Failures:** Define must-not-happen behaviors (e.g. disallowed content, hallucinated facts on test items). Any occurrence halts the pipeline.  
- **Performance Regression Budgets:** Allow only small deviations in standard tasks (e.g. ≤2–5% drop in accuracy, BLEU, etc.) when moving between steps (like quantization or hybrid). Budgets are tighter on key metrics and relaxed on non-critical ones.  
- **Stochasticity Policy:** Fix random seeds for all experiments to isolate model differences. If sampling must vary (e.g. temperature effects), declare a fixed sampling protocol (no “best-of-N” cherry-picking). All randomness should be reproducible.  
- **Human Adjudication:** Predefine criteria for subjective checks (e.g. “helpfulness,” “clarity”). Use a small panel of human reviewers only as a tiebreaker for marginal cases, and only after quantitative tests. Reviewers should follow documented rubrics.  

## 6. Minimum Hybrid-Runtime Experiment  
To test a hybrid/MoE approach, select one screened model that supports sparsity (e.g. Gemma 4’s 26B A4B). Gate requirements: ensure its license permits modification, and that developer docs exist for extending it. Use a fixed *scalar oracle* (e.g. a closed evaluation script) to compare any hybrid variant against the original. Build a minimal hybrid runtime (e.g. integrate a PyTorch MoE layer or implement Gemma’s sliding-window attention). Then measure: **(a)** functional parity: outputs must match the original within tolerance; **(b)** performance gain: e.g. reduced memory use or increased tokens/sec on realistic tasks. If the prototype fails either gate (no speedup or loss of output quality), we reject further hybrid work. This one-run experiment ensures early stopping: quality must meet threshold and a real deployment advantage (benchmarked in a browser or small GPU) must be evident.

## 7. Minimum Dense-Distillation Experiment  
Pick a top teacher model (passed all screening) and a smaller student architecture. Pre-review a small distillation dataset (e.g. a few thousand instruction-response pairs) for content suitability. Train the student under two-stage curriculum SFT and logit-level distillation as in prior work, holding out a sealed test set of prompts not seen by teacher or student during training. After a short pilot run, evaluate the student on the holdouts. If its performance *significantly* improves over a baseline student (without distillation), we proceed; if not, we stop. Use a “no-improvement” rule: if distillation yields <ε gain on key metrics, abort. This pilot uses a small compute budget and ensures data/process validity (tokenizer shared, teacher outputs fixed) before scaling.

## 8. Minimum External-Backend Experiment  
Define “external backend” as using an outside inference engine (e.g. an API or WASM runtime). The experiment must show viability in all respects: **Portability:** Package a minimal example (e.g. a small model in WebAssembly or calling Hugging Face’s Inference API) and run it locally. **Browser Feasibility:** Load the backend in a Chrome/Firefox instance, check memory footprint and speed. **License/Binary:** Verify the binary or API usage complies with licenses (no GPL issues, etc.). **Supply Chain:** Confirm we can obtain the binary or service (e.g. PyPI/conda or API keys) reliably. **Deterministic Conformance:** For a set of inputs, ensure the backend’s outputs are consistent with expected results (within tolerance). **Sandboxing:** The backend must run safely (e.g. no raw Python eval on user data). **Update Burden/Fallback:** Plan how updates (or failures) are handled (e.g. if API calls cost more, have a fallback). Only if the backend passes all gates (same accuracy, acceptable latency, and security) do we consider it; otherwise, we reject this path.  

## 9. Resource and Value-of-Information Model  
We define resources in abstract units: 
- **People:** researcher-hours, reviewer-hours.  
- **Compute:** CPU-hours (for data processing), GPU-hours (for training/eval), RAM/VRAM usage (peak on runs).  
- **Infrastructure:** storage (GB for datasets/models), network (GB transferred).  
- **Artifacts:** count of candidate models tested, checkpoints stored.  
- **Maintenance:** fraction of developer/ops time per month.  

For decision planning, we weigh each experiment’s expected information gain against costs: e.g. if distillation shows rapid early benefits, its high expected value may justify heavy compute. Conversely, trying many seeds has low VOI if early results are promising. We would estimate these by simple models (e.g. cost = hours + GPU time; VOI = probability(distillation succeeds) × improvement magnitude) and allocate effort to maximize information per unit cost.  

## 10. Stop, Retry, Rollback, and Escalation Rules  
- **Stop:** Halt a pathway immediately on critical issues: e.g. if quality metrics fall below pre-set thresholds, if a model violates license or ethical checks, if hardware limits (no more GPU hours) are hit, or if a conversion produces irreconcilable numeric errors. Also stop if a model runs out of memory in target environments (e.g. browser OOM) or if maintenance costs escalate (e.g. patching issues).  
- **Retry:** Do *not* retry changes until fundamental errors are fixed. Specifically, we will not try new random seeds or prompts in hopes of a better outcome. We separate “product sampling” (selecting random outputs from a fixed model) from “research retries.” Only if a failure is due to known nondeterminism (like quantization rounding) do we allow a fixed limited retry; otherwise, we adjust the approach (e.g. pick a different model) rather than blindly repeating.  
- **Rollback:** If a newly tested model or update regresses (e.g. evaluation shows a drop beyond budget), revert to the last checkpoint that passed all tests. Each artifact’s history is versioned (hash-linked), so the last valid version can be quickly identified.  
- **Escalation:** For unresolved critical issues (license ambiguity, unsupported hardware, evaluator defects, or security concerns) that block progress, escalate to management/legal before proceeding. Define clear thresholds (e.g. if >10% of test cases fail in a weird way, trigger an in-depth investigation by experts).  

## 11. Content-Addressed Evidence Design  
Every artifact and log is tied to its inputs: 
- *Acquisition receipts:* save raw model files with checksums.  
- *Screening outputs:* log prompt/response pairs along with model hash.  
- *Training checkpoints:* record exact training data commits and random seeds.  
- *Conversion metadata:* store conversion scripts and output file hashes.  
- *Evaluation logs:* link metrics to both model and prompt hash.  
- *Quantization/binary:* note quant settings and resulting file hashes.  
- *Deployment tests:* capture browser console logs or memory traces with references to model versions.  
Finally, each published release (paper or public demo) includes hashes of the models and code used. If any input (model version, data, code) changes, all downstream evidence (logs, metrics) must be flagged as invalid. This content-addressed graph ensures that e.g. an improved dataset invalidates models trained on old data unless revalidated.  

## 12. Routes to 1, 5, and 20 Useful Artifacts  
- **1 artifact:** Typically deliver one best-performing model (one architecture, one quantization) that meets product criteria.  
- **5 artifacts:** Could include one base model plus a few variants: e.g. the full-size model, a smaller distilled model, a domain-finetuned model, and their quantized versions. These must differ meaningfully (different tasks, sizes, or families) rather than trivial copies.  
- **20 artifacts:** Achievable by combining: multiple *source families* (e.g. Gemma, Llama, DeepSeek variants), each with *task-specialized fine-tunes* (math solver, code assistant, summarizer, etc.), *independent training runs* (different random seeds or secondary fine-tunes), and different *precision tiers* (FP16, int8, 4-bit). Each artifact must serve a distinct use-case. For example, two latent routes: (1) specialized sub-models for math and coding (fine-tuned separately on those domains) and (2) several quantization levels of each. We avoid “catalog theater” by ensuring each model is validated on a unique benchmark domain or throughput profile.  

## 13. Operator Decision Worksheet  
A final checklist for operators (without exposing secrets) might include:  
- **Gate A (Source):** Candidate model [Name, License, SourceHash] – Passed screening? (Y/N)  
- **Gate B (Distillation):** Pilot Δ on eval metric = ______ (must exceed threshold Δ<sub>min</sub>).  
- **Gate C (Hybrid):** Measured speedup = ____, quality loss = ____.  
- **Gate D (Evaluation):** Key tasks (accuracy, safe generation) within budgets?  
- **Gate E (Deployment):** Fits target memory (____ MB) and runtime (____ ms/token).  
- **Stop/Go:** If any gate fails, mark “STOP – don’t proceed”; if all pass, “GO to next phase.”  

Each item corresponds to preregistered criteria (e.g. "accuracy > 90%", "no license flags") so the operator simply ticks yes/no and the system logs hashes of models and prompts used.  

## 14. Unknowns Requiring Local or Authorized Access  
- **Proprietary benchmarks or user data:** Need internal access to domain-specific test sets or customer logs to fully validate use-cases.  
- **Source code for locked models:** If a candidate model has closed-source components, we must request license review rather than guess its internals.  
- **Hardware constraints:** Actual deployment environment specs (CPU/GPU models) may only be known internally.  
- **Legal/license clarifications:** Ambiguous license terms require expert analysis, not public guesswork.  
- **Evaluator development:** Designing new “protected” prompts (for safety tests) must be done offline so they cannot leak into model training.  

## 15. Annotated Primary-Source Bibliography  

- **BentoML Blog (Sherlock Xu, 2026):** *“The Best Open-Source Small Language Models (SLMs) in 2026.”* Explains how recent advances (distillation, data quality) have made sub-10B models highly capable. Useful for understanding the state-of-art in small model capabilities. (Last updated Mar 9, 2026)  
- **Hugging Face Blog (Daya Shankar, 2026):** *“Best Open-Source LLM Models in 2026.”* Surveys top open LLMs with licensing and deployment notes. Cited for specific model details (Gemma 4 parameters/licensing, Llama 4 context) and for stressing license importance. (2026)  
- **Google Gemma-4 26B A4B Model Card (HuggingFace, 2024):** Official card for Gemma 4 (A4B variant). Provides architecture (25.2B total, 3.8B active) and benchmarks. Confirms a high-performing open model with extended context (128K tokens) and MoE structure. (Updated Jun 10, 2024)  
- **OpenRouter – Llama 4 Scout (Meta, 2025):** Public model listing for Meta’s Llama 4 Scout. Details (109B total, 17B active) and multimodal abilities. Shows the existence of a large open-weight model and its license (Llama 4 Community) and training dates. (Released Apr 5, 2025)  
- **Chourishi *et al.*, NAACL 2024:** *“Tokenizer Choice for LLM Training: Negligible or Crucial?”* Finds that tokenizer choice can drastically affect LLM downstream performance and cost. Demonstrates why tokenization can be a bottleneck and must be tested. (June 16–21, 2024)  
- **Chen *et al.*, arXiv 2025:** *“Revealing the Power of Post-Training for Small Language Models via Knowledge Distillation.”* Shows a two-stage SFT + distillation pipeline yielding state-of-art 1B models. Cited for evidence that dense distillation can significantly boost small-model accuracy. (ArXiv preprint, Sept. 2025)  
- **Li *et al.*, arXiv 2025:** *“Can Mixture-of-Experts Surpass Dense LLMs Under Strictly Equal Resources?”* (StepFun project). Demonstrates that properly configured MoE models can outperform dense ones at equal parameter/compute budgets. Informs the hybrid-architecture hypothesis by quantifying MoE gains. (ArXiv preprint, June 2025)  
- **Rust Deep Learning (Rantai.dev blog, 2024):** Chapter on Rust ML frameworks, noting that `burn` is pure Rust (no external backend). Used to illustrate the trade-off between using an external library (PyTorch via tch-rs) vs writing native Rust. (2024)  
- **Penn State Stat 509 Lecture (2024):** Online notes on group-sequential tests. Covers O’Brien-Fleming and Pocock stopping boundaries, explaining how to control Type I error in interim analyses. Used to justify a practical, explainable sequential decision approach. (PSU STAT 509: Frequentist Sequential Methods, 2024)  


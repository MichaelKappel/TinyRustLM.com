# TinyRustLM Specialist Portfolio Experiment Pre-Registration

## 1. Executive preregistration recommendation  
We propose a rigorously preregistered multi-arm experiment to compare a single “champion” model against portfolios of specialist models for TinyRustLM.  We will measure not only task accuracy but also resource use (model size, memory footprint, latency) and routing overhead.  All experiment design (arms, tasks, metrics, thresholds) is fixed in advance to avoid cherry-picking.  The decision rule will be multi-objective: we will present a Pareto front of solutions (quality vs. cost) rather than a single aggregated score.  In short, our recommendation is to **evaluate both quality and resource trade-offs holistically**, and only claim improvements when evidence is complete.  For example, prior work emphasizes that routing is “budgeted inference” and should show an improved *performance–cost* curve, not just one-point gains.  By analogy to RouteJudge, we will judge routers by user preferences in paired comparisons.  We commit to publishing all test cases, raw outputs, and metrics in content-addressed receipts so any change invalidates past results.  In sum, we recommend a strict pre-registration with gated claims: specialists must demonstrably improve targeted tasks without unacceptable overhead in size, memory, or latency.  Broad claims (e.g. “better on all chat tasks”) will only be permitted once evidence covers all defined categories below.

## 2. Explicit hypotheses and falsification conditions  
**Hypotheses.** We frame the key hypotheses as precise statements about trade-offs. For example: *H1:* (Quality) “A champion+specialists portfolio achieves ≥ the champion’s accuracy on every task type, and > champion on some task subsets.” *H2:* (Efficiency) “The portfolio uses no more physical storage or peak memory than the champion plus baseline storage.” *H3:* (Latency) “Inferences with routing (on average) do not incur unacceptable latency overhead.” *H4:* (Routing) “The automatic router selects the best model significantly more often than chance.” Each hypothesis has a clear falsifier: e.g., H1 is falsified if, on the test suite, a specialist configuration yields statistically lower accuracy (with 95% confidence) on any task category than the champion.  

**Falsification and thresholds.** We will use pre-defined significance and margin thresholds. For each metric (e.g. pass rate on a task), we compute confidence intervals via paired bootstrap. If a specialist arm’s performance falls significantly below champion on an entire slice or drops a critical metric (see below), we consider the claim false.  We avoid claims unless intervals show clear advantage or at least non-inferiority.  We will correct for multiple comparisons (e.g. using Bonferroni or False Discovery Rate) across tasks so that type I error is controlled.  In summary, each hypothesis must specify what *must not happen* (e.g. “no more than X% quality regression”), and we will *fail* that hypothesis if it does.

## 3. Experiment arms and claim taxonomy  
We will implement the following experimental arms, each evaluated on the same tasks:  
- **Champion only:** The base general model alone, with no specialists. (Baseline.)  
- **Champion + LoRA adapter specialists:** A pool consisting of the champion plus lightweight fine-tuned adapters (low-rank delta) for certain domains. The adapters are applied on the fly to the champion model as described in the TinyRustLM Adapter ABI.  
- **Champion + sparse delta specialists:** Similar, but using sparse or quantized weight deltas instead of low-rank. The runtime supports loading *dense, sparse, or low-rank* adapter deltas that are validated against model identity.  
- **Standalone specialist models:** A set of independently distilled small models, each fine-tuned or distilled for a specific domain. The champion is not used; instead queries are routed or selected among the specialists.  
- **Explicit-selection portfolio:** A portfolio where a rule-based dispatch (e.g. static template matching) chooses which specialist to run. This is a control for *manual* routing vs. learned routing.  
- **Automatic-router portfolio:** A portfolio with the same specialists, but a learned or dynamic router chooses the model per query (using, e.g., an embedding-based selector).  
- **Arbitrary-slice negative control:** A naïve “specialist” constructed by arbitrarily splitting or pruning the champion’s weights. This is expected to *not* help quality, serving as a negative control to validate that random slicing does not appear beneficial.  
- **Shared-storage ablation:** For any multi-model arms above, we compare with/without content-addressed deduplication (i.e. shared chunk storage) so we can separate the effect of weight sharing on physical size.  
- **KV-compression ablation:** For all relevant arms, an optional setting with and without compression of the model’s key–value cache (if applicable) to measure its impact.  

**Claim taxonomy.** We pre-define the claims we may make about each arm, in tiers from weakest to strongest. For example:  
- *Runtime-smoke* (Tier 1): “The setup runs without crashes on baseline hardware.” Proof: successful load and minimal sample inference. We only claim “loads and runs on device” at this stage. We forbid claiming any quality or efficiency improvement until higher tiers are met.  
- *Task-specific-proven* (Tier 2): “For each target task subset (from our taxonomy), the portfolio’s quality ≥ champion’s.” Requires statistically significant pass rates on those tasks. If not met, we prohibit claims of “improves task X”. E.g. we cannot say “better on math” unless we showed it.  
- *Routed-portfolio-proven* (Tier 3): “With routing enabled, the overall system matches champion quality or beats it on covered tasks.” Requires the automatic-router arm to show combined performance. If this fails, we forbid claims like “portfolio boosts overall QA” or any general routing success.  
- *Broad-assistant-quality* (Tier 4): “Maintains champion-level quality across our *entire* task taxonomy.” Requires passing all slices. Without it, we cannot claim general assistant-level performance or “broad generalization” beyond the tested tasks.  
- *Storage-efficient* (Tier 5): “Portfolio uses strictly less (or equal) physical storage than champion-only.” This accounts for all model files, adapters, manifests, tokenizers, etc. If not met, we forbid language like “smaller footprint” or “compact storage.”  
- *Memory-efficient* (Tier 6): “Peak memory and working-set size ≤ champion’s (plus adapter overhead).” If an arm exceeds acceptable memory, we disallow claims of “runs in same memory as champion.”  
- *Performance-efficient* (Tier 7): “Inference latency is comparable or better than champion-only.” If routing or switching adds overhead beyond our budget, we cannot claim it is “faster” or equal-speed.  

For each tier, we will explicitly prohibit exaggerated language unless that tier’s criteria are fully satisfied. For instance, if only Tier 2 is proven, we must *not* say the model is “generally better” or “ready for all chat use” – we can only speak of the specific tasks validated.  We will publish this hierarchy so reviewers know exactly which claims have been vetted.  

## 4. Task, routing, holdout, and contamination design  
We define a **task taxonomy** covering the specified categories:  

- **Ordinary chat (general query):** Casual or factoid conversation not involving edge cases.  
- **Ambiguous queries:** Questions with multiple valid interpretations (to test disambiguation).  
- **Pragmatic constraints:** Prompts that include length, format, style, or resource constraints (e.g. “answer in ≤50 words”).  
- **Source-conflict queries:** Tasks where two conflicting statements or documents exist and the model must resolve which to trust.  
- **Current-preference queries:** Requires knowledge of up-to-date world state or user preference (testing recency).  
- **Untrusted-memory tasks:** Involve hypothetical or user-provided memory which the model should *not* trust fully.  
- **Multi-turn references:** Requires following context from previous turns (e.g. “what did I ask two questions ago?”).  
- **Lawful adult inquiries:** Adult or sensitive content that is legally permissible (tests policy compliance in “hard but allowed” areas).  
- **Factuality tasks:** Fact-checking, knowledge questions, or answering with evidence.  
- **Summary and rewrite tasks:** Given a passage, produce a concise summary or rewrite in different style.  
- **Structured output (JSON, CSV, etc.):** Require the model to output valid JSON or other structured data.  
- **Information extraction:** Extract specific fields (e.g. phone number, names) from a text.  
- **Code explanation:** Given code, the model explains its function.  

These categories will be balanced in the test set.  We will include both *production-distribution* samples and *challenge cases* in each category (following best practices).  We will tag each case (e.g. “ambiguous”, “preference”, “JSON”) so we can slice results by category.  For training and dev construction, we apply normalization and variation techniques: e.g. synonym paraphrases, entity substitution, multiple template instances of each case, to ensure models cannot overfit via surface patterns.  We will hash all test prompts and search training corpora to prevent leakage.  Any prompt or expected-answer concept used in evaluation is guaranteed *not* to appear in training or adapter data.

We partition datasets as follows:  
- **Training set:** Used to train the champion and specialists. (Though in practice all TinyRustLM models are pre-trained/converted outside this evaluation, we assume their development was separate.)  
- **Router development set:** A held-out subset of tasks (distinct from training) used solely to tune or train the router (e.g. to learn selection thresholds or classifier weights).  
- **Sealed promotion (validation) set:** A larger holdout set kept frozen (“locked”) that mimics final evaluation. The experimenters cannot tune on it until the final test; it’s used to assess each arm. This set is *never* used to train models or routers. We follow “freeze a release suite” guidance: once the sealed set is fixed, any new edge-case tasks go into an auxiliary pool.  
- **Independent audit set:** After final decisions, an external auditor will test the winning arms on a fresh secret set, ensuring no contamination or selection bias.  

In all cases, we will check for near-duplicates: run semantic overlap detection and n-gram matching between test cases and any published benchmarks or internal prompts.  We also enforce *deletion lineage*: if any data or cases are removed from training, we track that provenance so that any case potentially affected is flagged or removed.  We will explicitly note any public benchmarks included and ensure they were unseen by model training.  

## 5. Quality metrics and statistical analysis  
**Metrics per task.** We will use task-specific scoring: e.g. exact-match or semantic similarity for QA, schema validation for JSON, unit-test success for code tasks, and human/LLM-judge ratings for open-ended chat.  Where possible, we use *deterministic scoring* first: for example, JSON tasks are scored by JSON-schema validators or strict parsing, code by execution tests, exact-string match for factoids, etc.  This minimizes judge bias.  For open dialogue or fallible tasks, we will employ calibrated model-based judges or human evaluation on samples, following guidelines to calibrate LLM judges if used.  All scoring rules will be fixed in advance. 

We will report *pass rates* (fraction correct) and also continuous quality scores where relevant, for each slice of the taxonomy.  We include failures and null outputs in denominators (no dropping timeouts).  In addition to accuracy, we will capture auxiliary metrics: e.g. hallucination count, policy violations, JSON parse error rate, etc.

**Statistical analysis.** For each binary or averaged metric we compute standard errors and 95% confidence intervals.  For example, accuracy on a slice with $n$ cases and observed pass $p$ is given by the Clopper–Pearson or bootstrap CI.  When comparing two arms on the *same cases*, we use *paired* bootstrap or McNemar’s test to see if their difference is significant.  We report p50/p95/p99 intervals for continuous metrics like latency.  For multiple metrics or slices, we control for multiple comparisons (e.g. Bonferroni-adjusted thresholds) to avoid spurious conclusions.

We also measure **intra-run variability**: each model inference will be run with fixed random seeds to check determinism.  We log random seeds for replicability.  If an arm uses nondeterminism, we evaluate with many seeds and measure “pass probability” (fraction of seeds yielding a correct answer).  We will not use any best-of-*N* selection of answers unless the TinyRustLM runtime itself does that, because best-of-N would hide variability. (Indeed, best-of-N is prohibited as an evaluation trick – we reflect the product’s declared sampling policy.) 

In all reports we include the number of cases evaluated and raw counts (passed, failed, timeouts).  We compute confidence intervals via analytic formulas or bootstrap, and present paired differences relative to the champion baseline.  For any metric, an arm is only considered non-inferior if its 95% CI lower bound exceeds the predefined threshold (often the champion’s lower CI).  We will avoid interpreting any result with wide CI as definitive.

## 6. Byte, memory, and latency accounting schemas  
We will account *exactly* for all byte- and memory-related resources:  

- **Physical deduplicated bytes:** On disk/flash (or download size) of all artifacts, counting shared chunks only once. For example, if two specialists share base weights or adapters, we deduplicate in our sum. This includes: model weight files, adapter delta files, tokenizer files, router code, manifest/metadata files, and any auxiliary index or embedding databases.  
- **Logical execution bytes:** The memory footprint needed at inference time for each arm. This includes all loaded weights in RAM (base model + applied adapter deltas), plus tokenizer state, and any retrieval or helper indexes loaded in memory. We separate: “base model bytes” vs “incremental specialist bytes” (the extra weight for each specialist) plus any index or router tables.  
- **Incremental specialist bytes:** For adapter arms, the adapter file size. For standalone specialists, the full model size per specialist. We report both total (sum of all specialist sizes) and incremental (per specialist beyond base).  
- **Peak resident bytes:** The maximum working-set memory (RSS) during inference, including model parameters, caches, activations, and scratch. This covers the process’s real memory usage.  
- **Key–Value (KV) bytes:** If the model uses a KV cache (e.g. Transformer past states), we measure the size of that cache on each inference.  
- **Scratch and overhead:** Temporary memory used during generation (e.g. for dequantization or batched buffers). We identify “decoded shadow copies” (extra float32 copies of quantized weights, if any) and count them.  
- **WASM linear memory:** For the browser runtime, we also record the size of the WebAssembly linear memory reserved/used.  

We will also itemize subtle sources of overhead: e.g. memory alignment padding, page table consumption, and manifest or index memory.  The runtime design specifies these components, so we will measure them with tools (e.g. memory profilers in the Rust/WASM runtime). All these will be reported separately so that no hidden terms remain. For example, if an adapter shares weights with the base, its “deduped bytes” are zero, but the adapter’s presence might still affect execution memory (we measure that separately). All byte/memory stats will be reported for “cold load” (fresh start) and “steady-state” (after warm-up), as described next.

## 7. Native/browser execution matrix  
We will evaluate on a variety of execution environments to capture real-world variation. The matrix will include:  
- **Platforms:** A selection of common CPUs/OS/browser combos. For example, a representative desktop (Windows/Linux), a mobile environment (Android WebView or iOS Safari), and a Node.js native run (WASM on Node). We record CPU model and OS version.  
- **Browser types:** At least Chrome/Chromium, Firefox, and Safari (on supported OS). We note version numbers.  
- **RAM constraints:** We run each on default memory conditions, then artificially constrained (e.g. using OS limits or low-memory devices) to test robustness.  
- **Storage classes:** If persistent storage matters (for download or caching), we test on SSD vs slower storage.  
- **Mobile (width) modes:** On mobile-like narrow viewports, to ensure UI/DOM factors (if any) don’t affect the runtime.  
- **Background throttling:** In browsers, test the case where the tab is in background or device is in low-power mode.  
- **Cancellation and interrupts:** We include tests where generation is aborted mid-way (e.g. user cancellation) to ensure no leaks.  
- **Network access:** We enforce the “local-only” policy. The TinyRustLM harness includes a static contract crawler that forbids external fetches.  We will verify no network calls occur (e.g. by running in airplane mode). If network is allowed, we document the traffic; otherwise we record failures.  

For each environment and arm, we run the full evaluation pipeline (load model, route, infer) on a subset of cases. We measure cold-start and warm-start performance (below). The purpose is to capture any differences (e.g. certain browsers may have slower WASM JIT). We will tabulate any deviations. All experiments will be reproducible: we record exact compiler versions for the WASM runtime (including Wasm-bindgen, Rust version, etc.) and note whether hardware acceleration (SIMD) is used, so that others can replicate.

## 8. Reversibility, cache, and fault-injection tests  
We will test robustness by cycling routes and adapters repeatedly. Specifically:  
- **Adapter cycles:** For an adapter arm, we will apply and remove the adapter package many times (e.g. load champion, apply adapter, unload adapter, repeat) and check that the champion model state is uncorrupted. We track the model’s outputs against a baseline to ensure no cumulative mutation. This tests that *nondense deltas* (low-rank or sparse) are truly reversible.  
- **Router cycles:** We will interleave queries that trigger different specialists and ensure that state (e.g. KV cache or any global memory) is correctly reset between them. For example, route to Specialist A then to Specialist B then back to the champion, verifying each time that the answers match a cold execution of that model.  
- **Memory-leak checks:** We monitor peak and free memory after each cycle. No increase over many cycles should be observed; any leak will abort testing.  
- **Stale caches:** We will explicitly test for stale data: e.g. if a query uses a retrieval mechanism, we ensure its cache is cleared between tasks. We test by looking for carry-over content. The architecture warns of “stale cached packages” as a failure mode, so we especially test cache flushing in browser sessions.  
- **Determinism:** We will run identical inference (same seed, same context) multiple times across cycles. We check bitwise output equality to ensure deterministic composition of models, adapters, and routing.  
- **Fault-injection:** We will simulate failures: e.g. deliberately corrupt a manifest or adapter file and ensure the runtime rejects it cleanly (as in the pseudocode). We also test partial failures (e.g. fail to load an adapter after the model is loaded) to ensure rollback leaves no side-effects.  

These tests mirror best practices for stateful systems (akin to reviewing full traces). We will review a sample trace of a multi-cycle run to verify that the process is sound, following the advice to “review real conversations and full traces”.

## 9. Content-addressed receipt graph and invalidation rules  
Every experiment run will produce a *content-addressed release packet* that cryptographically ties together all components. This packet includes:  
- Hashes/digests of the base model file and its version.  
- Hashes of each adapter or specialist file used.  
- Hash of the tokenizer/vocabulary file.  
- Hash of the router code (if used, e.g. its source or WASM).  
- Hash of the TinyRustLM runtime binary (WASM).  
- Hash of the evaluation harness (the code running the tests).  
- Hash of the seed list (for randomness) and environment identifiers.  
- The sealed test cases (or their hashes) and any prompt templates.  
- The raw model outputs and final answer strings from each case.  
- Computed metrics and intermediate logs (routes taken, decisions).  
- The final decision (pass/fail per metric and overall).  

We will store this as an immutable DAG (for example, a Merkle-tree or a content-addressable file bundle).  This is analogous to the *release packet* in the architecture pseudocode.  Indeed, the provided pseudocode for TinyRustLM’s evaluation runner ends with:
```
RETURN BUILD_RELEASE_PACKET(
    parent_model_digest = HASH(model_bytes),
    adapter_digest = HASH(adapter_bytes),
    eval_evidence = evidence,
    diagnostics = diagnostics
)
```
 
We will extend this concept to include all listed components.  

If any component changes, the receipts are invalidated. For instance, if the base model or an adapter is updated (thus changing its hash), none of the old release packets apply, and we must re-run evaluation. In other words, a new receipt graph node is created for each experiment run, and no old run can be reused if *any* linked artifact is modified. This ensures strict provenance: every byte (model, code, data, output, metrics) is accounted for.

## 10. Pilot, scale-up, and stop rules  
We will adopt a **sequential pilot strategy** to avoid wasted effort on doomed approaches. For each new candidate arm (e.g. a particular specialist), we first run a small pilot on a balanced subset of tasks. We define quick gating rules:  
- **Source gate:** If the specialist model is trained on data that does not cover its intended domain, we stop early.  
- **Size gate:** If the combined size of the champion+specialist exceeds the champion alone by more than a small fraction (e.g. >10%) without a clear storage-sharing benefit, we drop it.  
- **Quality gate:** After pilot cases, if the specialist does not outperform or at least match the champion on its target slice, we stop full training. For adapters, if after applying the delta the model still fails the adapter’s domain tasks, we do not continue.  
- **Routing gate:** If an automatic router cannot learn to distinguish tasks (e.g. its validation accuracy is no better than random), we halt that arm.  

For example, we might try training a specialist for “factual recall” tasks. If in a quick evaluation it shows no accuracy improvement, we cease further specialist training. Likewise, if we try a router-based arm and the router’s route accuracy on the routing-dev set is too low (<50%), we discard that approach.  

These rules mirror early-stopping in A/B trials. They prevent spending lots of compute converting or quantizing models that have already failed on key criteria. Once an arm passes all gate checks, we scale up to full evaluation.  We document each stop decision with the reason (e.g. “Specialist X failed domain gate”). At no point do we overwrite or throw away failed runs without trace: all pilot results become part of the audit trail.

## 11. Final multi-objective decision matrix  
The final outcome will be a multi-dimensional comparison table (and accompanying Pareto plot) showing each arm’s trade-offs: 

| Arm                    | Task Accuracy (%) | No. Correct Routes (%) | Model Size (MB) | Incremental Size (MB) | Peak RAM (MB) | Latency (ms, p50/p95/p99) | Storage (MB) |
|------------------------|------------------|------------------------|----------------|----------------------|---------------|---------------------------|---------------|
| Champion only          | …                | 100% (N/A)             | BaseSize       | –                    | …             | … / … / …                 | BaseSize      |
| + LoRA adapters        | …                | …                      | BaseSize+LORA  | LORABytes            | …             | … / … / …                 | DedupedSize   |
| + Sparse deltas        | …                | …                      | BaseSize+Sparse| SparseBytes          | …             | … / … / …                 | DedupedSize   |
| Standalone specialists | …                | –                      | ∑SpecSizes     | ∑SpecSizes           | …             | … / … / …                 | ∑SpecSizes    |
| Static selection       | …                | –                      | ∑SpecSizes     | ∑SpecSizes           | …             | … / … / …                 | ∑SpecSizes    |
| Automatic router       | …                | …                      | ∑SpecSizes     | ∑SpecSizes           | …             | … / … / …                 | ∑SpecSizes    |
| Negative slice control | …                | –                      | BaseSize+slice | sliceBytes           | …             | … / … / …                 | BaseSize+slice|

*(Example format – actual numbers to be filled after evaluation.)*

Each quality metric (accuracy) will include confidence intervals.  We highlight the Pareto-optimal arms: e.g. a portfolio arm might have higher accuracy but also higher resource use, so its choice depends on weighting.  We do not combine all metrics into one score; we leave trade-offs visible.  Importantly, even if one arm has the highest accuracy, we will note the cost (size/latency).  This aligns with the principle that “budgeted inference calls for evaluation beyond a single static operating point”.  

We will also report *regression budgets*: allowable drops in “broad-helpfulness” metrics (like general accuracy) if specialists gain in narrow tasks. However, **critical slices are non-compensable**: we will enforce that policies or safety-related metrics do not decline under any arm. For instance, any drop in correctness on a privacy or fairness test is unacceptable even if specialist gains elsewhere. We follow the guideline that weighted scores must be disaggregated so that “a high top-line metric does not hide a safety regression”. Specifically, if a specialist arm produces even a single critical failure (e.g. giving impossible advice, hallucinating legal info, or violating policy on adult content), we regard that as disqualifying, regardless of overall accuracy gains.

## 12. Unknowns requiring approved local execution  
Certain aspects cannot be fully verified by remote review of outputs, and will require controlled local tests or manual inspection:  
- **Memory leaks or environment-specific failures:** We must run locally (or in a sandbox) to monitor leaks over time.  
- **Interactive/time-based behaviors:** If routing decisions use timeouts or asynchronous callbacks, we should test on real hardware.  
- **Browser UI interactions:** Any JavaScript front-end (e.g. dynamic DOM markers, cancellation) needs manual validation that it doesn’t interfere with the core evaluation.  
- **Security/sandbox checks:** We must ensure no unauthorized filesystem or network access in a real browser context. The `tinyrustlm-browser-harness` provides a static check, but we should confirm in a live session that no secrets leak.  
- **Non-deterministic hardware effects:** If using WebGPU or special acceleration, we have to validate on target devices.  

All such checks will be documented as “local execution” steps. Findings (e.g. “Spark throttling in background mode slows to X% of normal”) will be noted, but they will not alter the published metrics unless they systematically affect user-facing performance. 

## 13. Annotated primary-source bibliography (with links and dates)  

- **Liu et al., “RouteJudge: An Open Platform for Reproducible and Preference-Aware LLM Routing” (2026)** – *ArXiv preprint (Jun 2026)*. Describes router evaluation via pairwise user preference comparisons and emphasizes performance–cost trade-off curves. [Link](https://arxiv.org/abs/2606.18774)  
- **César Migueláñez, “How to Evaluate LLM Agents: Practical Error Analysis” (May 28, 2026)** – *Latitude blog*. Advocates reviewing full conversation traces and warns that a model can give a correct answer via a flawed process. We use this for guidance on multi-turn evaluation. [Link](https://latitude.so/blog/llm-agents-evaluate-practical-error-analysis)  
- **Michael Kappel, “LLM Evaluation: Contamination, Judge Bias, and Production Metrics” (May 19, 2026)** – *Dr. TMA Pai Chair blog*. Provides best practices for dataset splits, contamination checks, private test sets, and detailed reporting (confidence intervals, paired tests). It informs our data hygiene and statistical analysis. [Link](https://blog.ecitis.org/llm-evaluation)  
- **Valentyn Hvozdenko et al., “When Do Multi-Agent LLM Systems Outperform Single-Agent Approaches? An Empirical Comparison…” (2026)** – *European Conf. on REsearch (ECER 2026)*. Empirically shows single strong LLM often beats more complex multi-agent pipelines across tasks. We cite it to caution that portfolio complexity may not always help. [Link](https://ecer.pria.at/archive/ecer-2026/papers/When_Do_Multi-Agent_LLM_Systems_Outperform_Single-Agent_Approaches_An_Empirical_Comparison_Across_Different_Task_Types.pdf)  
- **ModelBreeder.com, “TinyRustLM browser runtime architecture” (2026-06-28)** – *Architecture documentation by M. Kappel*. Details the TinyRustLM WASM execution design, including memory components and adapter support. We use it to define memory accounting and understand adapters. [Link](https://modelbreeder.com/architecture/tinyrustlm-runtime)  
- **ModelBreeder.com, “Browser and edge runtime architecture” (2026)** – *Architecture guide by M. Kappel*. Notes key failure modes like “cold-start latency” and offline execution constraints. It motivates our latency measurements. [Link](https://modelbreeder.com/architecture/browser-edge-runtime)  
- **MiRust.com, “TinyRustLM Implementation” (2026)** – *Implementation notes by D. Gustafsson et al.*. Reveals that (as of June 2026) TinyRustLM’s code does **not yet** implement multi-model routing or adapters, highlighting that our experiment is forward-looking. Also mentions the browser harness for policy enforcement. [Link](https://mirust.io/implementation)  
- **FutureAGI Substack, “LLM Evaluation: Frameworks, Metrics, and Best Practices (2026 Edition)” (Jan 23, 2026)** – *FutureAGI newsletter*. Summarizes evaluation goals (accuracy, fairness, relevance) and stresses checking factual claims. We cite its emphasis on factual consistency and relevance to reinforce our metric choices. [Link](https://futureagi.substack.com/p/llm-evaluation-frameworks-metrics)  

Each reference is given with date and link for verification.
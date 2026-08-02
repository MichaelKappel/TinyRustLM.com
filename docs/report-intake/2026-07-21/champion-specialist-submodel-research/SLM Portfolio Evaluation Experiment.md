# **Independent Portfolio Experiment For Accuracy, Size, Memory, And Latency: Preregistration Protocol for TinyRustLM**

## **1\. Executive Preregistration Recommendation**

The deployment of large language models within highly constrained edge environments represents a fundamental shift from cloud-centric inference to decentralized, privacy-preserving execution. TinyRustLM, operating as a browser-local Rust/WebAssembly (WASM) chat product utilizing portable .slm artifacts, exemplifies this shift. However, the architectural transition introduces a severe tension between expanding model capabilities and adhering to rigid physical resource limitations. A prevailing hypothesis within the domain suggests that a monolithic dense model can be effectively replaced or augmented by a "champion plus tiny specialists" portfolio—leveraging parameter-efficient fine-tuning techniques such as Low-Rank Adaptation (LoRA) to dynamically swap domain expertise1. While theoretical models of multi-tenant serving demonstrate the efficacy of shared backbone architectures3, applying these paradigms to client-side WASM and WebGPU execution contexts often obfuscates the true systemic costs associated with memory fragmentation, context switching, and routing overhead5.  
This document establishes a mathematically rigorous, independently preregistered experimental protocol to determine whether the proposed portfolio architecture genuinely outperforms a standalone monolithic champion. The scientific consensus surrounding dynamic model routing and concurrent adapter serving indicates that task-specific accuracy gains are frequently eclipsed by the unmeasured latency of acquiring, verifying, and instantiating specialized weights within a constrained memory pool7. Consequently, claiming victory based solely on isolated task accuracy—without accounting for the holistic degradation of system performance—constitutes a methodological failure.  
This preregistration mandates a comprehensive evaluation schema wherein quality, routing accuracy, storage footprints, peak resident memory utilization, and switching latencies are measured concurrently as dependent variables within a multi-objective optimization framework. Furthermore, to prevent survivorship bias and selective reporting, this protocol enforces that all experimental artifacts, failed formats, and null results remain immutable cryptographic evidence. The overarching recommendation is to execute this protocol strictly sequentially, utilizing predefined falsification gates to halt computational expenditure on candidate arms that fail to demonstrate Pareto-optimal improvements across the designated physical and logical constraints.

## **2\. Explicit Hypotheses and Falsification Conditions**

The experimental design is constructed around a strict hypothesis-testing framework designed to isolate the true efficacy of the routed portfolio architecture. The evaluation is predicated on the assumption that any added architectural complexity must yield a statistically significant gain in target performance without violating predefined regression constraints.  
The primary null hypothesis (![][image1]) states that a routed portfolio architecture—whether utilizing a champion paired with trained adapter specialists or a collection of independently distilled standalone specialists—yields no statistically significant improvement in task-specific correctness over a monolithic general champion, assuming both are constrained by equivalent peak resident memory boundaries and latency thresholds. The alternative hypothesis (![][image2]) posits that the portfolio architecture achieves a statistically significant, positive delta in target domain accuracy while maintaining statistical equivalence or superiority in aggregate latency, memory footprint, and broad-assistant helpfulness.  
To ensure that the experimental progression is rigorously controlled, predefined falsification conditions act as terminal gates. An experimental arm is immediately falsified, and further evaluation is terminated, if any of the following conditions manifest:

| Falsification Condition | Mathematical / Systemic Threshold | Rationale |
| :---- | :---- | :---- |
| **Memory Exceedance** | Peak aggregate resident memory ![][image3] Champion Peak VRAM/RAM \+ 5%. | Adapter swapping mechanisms must not trigger out-of-memory (OOM) exceptions in constrained WASM environments9. |
| **Latency Degradation** | End-to-end ![][image4] response latency ![][image3] Champion ![][image4] \+ 50ms. | The overhead of routing decisions and dynamic weight loading must remain imperceptible to the end-user3. |
| **Critical Task Regression** | Catastrophic failure rate ![][image5] on broad-helpfulness regression set. | Domain-specific gains (e.g., coding) cannot justify the introduction of systemic failures (e.g., prompt injection vulnerability). |
| **Statistical Insignificance** | Lower bound of 95% bootstrap CI for task improvement ![][image6]. | Observed improvements must be resilient to sampling noise and validated through rigorous paired testing10. |

## **3\. Experiment Arms and Claim Taxonomy**

Isolating the precise mechanisms of model specialization, parameter efficiency, and routing logic requires a highly stratified experimental design. The evaluation protocol defines eight distinct experimental arms, preventing the conflation of different sparsity techniques and routing mechanisms.  
The defined experimental arms are:

> 1. **Champion Only**: The monolithic, dense baseline model executing generalized instruction tuning without any dynamic modifications or external routing dependencies.  
> 2. **Champion plus Low-Rank Adapter**: The base champion dynamically composing with dense, low-rank perturbation matrices loaded dynamically into the execution context1.  
> 3. **Champion plus Sparse Delta**: The base champion utilizing highly sparse, unstructured, or semi-structured weight updates to modify activation pathways, challenging the assumption that rank-restricted updates are the only efficient specialization method.  
> 4. **Standalone Specialist**: An independently distilled, entirely separate small language model tailored for a specific domain, lacking shared weights with the champion.  
> 5. **Explicit-Selection Portfolio**: A deterministic system where the evaluation API explicitly dictates the activation of a specific specialist or adapter, entirely bypassing inference-time routing.  
> 6. **Automatic-Router Portfolio**: A dynamic system utilizing a lightweight inference-time classifier to predict query complexity and route to the optimal adapter or specialist12.  
> 7. **Arbitrary-Slice Negative Control**: A deliberate expected-failure arm wherein arbitrary, untrained slices of the dense model are activated. This validates the evaluation framework's sensitivity, ensuring it accurately detects and penalizes non-functional parameter subsets.  
> 8. **Shared-Storage/KV Ablations**: Configurations assessing the isolated impact of shared content-addressed storage chunks and KV cache retention policies across sequential requests, distinct from weight modifications.

To enforce precise external communication of the experimental results and prevent deceptive marketing, a strict claim taxonomy is established. Any public or internal reporting must adhere to the criteria and prohibited language outlined below.

| Claim Tier | Criteria for Achievement | Prohibited Language if Incomplete |
| :---- | :---- | :---- |
| **Runtime-Smoke** | Successful native and browser WASM execution without linear memory overflow or runtime compilation failure14. | "Fully functional," "Production-ready," "Stable execution." |
| **Task-Specific-Proven** | Statistically significant gain on a targeted taxonomy task over the monolithic champion, validated by McNemar's test15. | "Better overall," "Superior model," "Replaces the champion entirely." |
| **Routed-Portfolio Proven** | Automatic router accurately identifies and dispatches queries, yielding a net-positive system accuracy relative to a static champion. | "Flawless routing," "Zero overhead routing," "Optimal generalized portfolio." |
| **Broad-Assistant-Quality** | No statistically significant regression on general chat, lawful safety, or multi-turn reference tasks11. | "Uncompromised global quality," "Matches champion exactly in all domains." |
| **Storage-Efficient** | Total physical deduplicated bytes on disk (including all manifests and tokenizers) ![][image7] the champion alone. | "Zero storage cost," "Free specialists," "Costless adapters." |
| **Memory-Efficient** | Peak resident RAM during execution, including all shadow copies, page tables, and uncompressed KV caches, ![][image7] baseline7. | "No memory overhead," "Memoryless adapters," "Zero RAM impact." |
| **Performance-Efficient** | Time-to-first-token (TTFT) and decode throughput (tokens/sec) are statistically equivalent to or faster than the baseline. | "Zero-latency switching," "Instantaneous routing," "Compute-free execution." |

## **4\. Task, Routing, Holdout, and Contamination Design**

The evaluation taxonomy is designed to probe the absolute limits of edge-deployed models across diverse behavioral axes. The task taxonomy is constructed to capture nuanced failure modes that standard aggregate benchmarks often obscure.

| Taxonomy Domain | Evaluation Focus | Expected Response Characteristics |
| :---- | :---- | :---- |
| **Ordinary Chat** | Conversational flow, persona adherence, and general knowledge retrieval. | High perplexity tolerance, naturalistic prose. |
| **Ambiguity Resolution** | Handling queries with insufficient context or contradictory premises. | Proactive clarification requests; selective prediction behavior16. |
| **Practical Constraints** | Strict adherence to length limits, character exclusions, or formatting rules. | Binary pass/fail on constraint violation. |
| **Source Conflict** | Resolving contradictions between provided prompt context and internalized parametric memory. | Absolute deference to the provided prompt context. |
| **Current Preference** | Alignment with the latest safety and helpfulness guidelines. | Rejection of outdated behavioral norms. |
| **Untrusted Memory** | Resilience against adversarial prompt injections or embedded malicious payloads. | Safe failure; refusal to execute adversarial instructions. |
| **Multi-Turn References** | Contextual tracking over extended conversational horizons. | Accurate anaphora resolution and entity tracking. |
| **Lawful Adult Inquiry** | Safe navigation of sensitive but lawful adult topics without excessive puritanical refusal. | Nuanced, objective informational delivery. |
| **Factuality** | Precision in historical, scientific, and mathematical knowledge retrieval. | Zero hallucination tolerance on verifiable facts. |
| **Summary & Rewrite** | Condensation and tonal translation of extensive source texts. | High ROUGE/BLEU scores; preservation of core entities. |
| **JSON Extraction** | Unforgiving structured data extraction against predefined schemas. | Valid, parseable JSON strictly matching the requested schema. |
| **Code Explanation** | Syntactic comprehension and pedagogical explanation of complex algorithms. | High pass@k on functional unit tests derived from explanations17. |

Dataset partitioning mandates absolute cryptographic separation. The data splits include a **Training/Development** set for adapter fine-tuning, a distinct **Routing-Development** set exclusively for calibrating the confidence thresholds of the automatic router to optimize deferral rates18, a **Sealed Promotion** set utilized solely for the final go/no-go production decision, and an **Independent Audit** set managed by third-party evaluators.  
Contamination protocols are strictly enforced to ensure that evaluation cases and expected-answer concepts remain entirely excluded from training corpora and teacher-model generation pipelines. Normalization and decontamination pipelines utilize exact n-gram overlap detection (enforcing an ![][image8] sequence threshold), alongside semantic neighbor detection utilizing cosine similarity on dense embeddings to identify paraphrased leaks. Template families used to generate synthetic queries are deduplicated prior to training. Furthermore, entity substitution algorithms are applied to benchmark datasets—systematically replacing standard entities (e.g., swapping "Alice and Bob" for "Xavier and Yasmine" and recalculating expected probabilities) to ensure the model exhibits genuine conceptual reasoning rather than benchmark memorization. Response-answer overlap must be scrutinized to confirm the model is generating complete reasoning pathways. Finally, strict deletion lineage documentation is required, providing cryptographically signed proof that identified contaminated records were excised from the pre-training and fine-tuning datasets before artifact compilation.

## **5\. Quality Metrics and Statistical Analysis**

The evaluation methodology utilizes a paired, matched-case design that combines fixed deterministic evaluation (enforcing greedy decoding with temperature set to ![][image9]) and seeded stochastic evaluation. In stochastic configurations, strict seed policies must be enforced, capturing the precise pseudo-random number generator (PRNG) state to ensure absolute reproducibility across all experimental iterations11.  
Pass probability is calculated based on strict binary functional correctness rather than surface-level string matching. For structured tasks, this implies exact schema adherence or unit test passage; for qualitative tasks, it implies deterministic LLM-as-a-judge acceptance utilizing a highly capable teacher model operating under a strict zero-temperature constraint12. Hidden best-of-N sampling is explicitly classified as an invalid methodology unless the final deployed browser runtime inherently executes multiple samples and self-selects the optimal output19. Utilizing best-of-N during evaluation conceals fundamental model unreliability and artificially inflates capability metrics by shifting inference compute costs from the deployment environment to the evaluation environment.  
Statistical significance for binary pass/fail metrics is calculated utilizing the paired McNemar's test, which specifically isolates the discordant pairs between the monolithic champion and the portfolio candidate10. For continuous or ordinal graded scores, paired Wilcoxon signed-rank tests are required17. Every reported metric must be accompanied by 95% bootstrap confidence intervals to characterize the dispersion and reliability of the performance estimate, utilizing a minimum of 10,000 resamples11. When evaluating multiple specialists across the taxonomy, a Bonferroni correction or Benjamini-Hochberg procedure must be rigorously applied to the ![][image10] threshold to control the family-wise error rate and prevent false discoveries arising from multiple comparisons. Infrastructure flakes—such as WASM runtime compilation timeouts or WebGPU device losses unrelated to model logic—are recorded, isolated, and analyzed exclusively as system-level reliability metrics rather than model quality metrics.

### **Routing Metrics and Final-Response Metrics**

The evaluation must definitively distinguish between the efficacy of the router and the ultimate capability of the target specialist. An evaluation framework that only measures final task accuracy cannot differentiate between a highly capable specialist hindered by a poor router and a weak specialist masked by a router that safely defaults to the champion13.  
Routing metrics assess the classification mechanism independently. A confusion matrix of predicted versus optimal model assignments is constructed, where the optimal assignment is determined *a posteriori* by evaluating all available arms on the query and identifying the lowest-cost model that yields a correct response12. The router's performance is quantified using the Area Under the Curve (AUC) across varying confidence deferral thresholds to assess its calibration profile18.  
Final-response metrics measure aggregate system behavior. A correct route paired with a bad response indicates specialist deficiency. A wrong route paired with a lucky answer indicates a brittle router masking underlying systemic inefficiency. The analysis heavily penalizes "over-routing," defined as scenarios where a complex, high-latency specialist is invoked for a simple query that the base champion could have resolved efficiently.

### **Broad-Helpfulness Regression Budgets and Critical Failures**

A fundamental tenet of this protocol is that domain-specific improvements cannot compensate for systemic regressions in core utility. Strict broad-helpfulness regression budgets are mathematically enforced. If the addition of a specialized code-explanation adapter degrades the portfolio's performance on ordinary chat or ambiguity resolution by a statistically significant margin (where the upper bound of the confidence interval for the regression exceeds the predefined tolerance threshold), the portfolio candidate is falsified.  
Furthermore, non-compensable critical failures are defined as absolute terminal events. A statistically significant task gain in one domain may not offset the introduction of the following critical failures:

* **Source-Authority Failures**: The model overrides explicit, deterministic facts provided within the prompt context, relying instead on internalized parametric hallucinations.  
* **Latest-Preference Failures**: The model reverts to outdated, deprecated alignment behaviors that were successfully excised in earlier iterations of the champion.  
* **Impossible-Advice Failures**: The model generates syntactically valid but physically or logically impossible instructions.  
* **Untrusted-Memory Failures**: The model succumbs to prompt injection attacks or executes malicious payloads embedded within untrusted context windows.  
* **Severe Completion Failures**: Unending generation loops, structural output collapse, or catastrophic repetition requiring external runtime termination.

## **6\. Byte, Memory, and Latency Accounting Schemas**

Deploying AI within the browser via WebAssembly, which is typically constrained by a rigid 4GB linear memory limit in standard wasm32 environments, alongside WebGPU backends, necessitates exhaustive, byte-for-byte accounting9. The assertion that low-rank adapters are inherently "memory-efficient" must be empirically verified against the actual resident memory footprint during execution1.

| Memory Accounting Category | Measurement Definition | Constraint |
| :---- | :---- | :---- |
| **Physical Deduplicated Bytes** | Total disk footprint of .slm files, isolating the base model, individual adapters, metadata manifests, tokenizers, and shared content-addressed chunks. | Must be ![][image7] Champion alone. |
| **Logical Execution Bytes** | Uncompressed footprint during active computation within the WASM sandbox. | Cannot exceed browser limits. |
| **Incremental Specialist Bytes** | The exact byte delta required to fetch and load a new domain adapter from local IndexedDB or the network. | Minimized for fast switching. |
| **Peak Resident VRAM/RAM** | Maximum memory utilization including base weights, active adapters, uncompressed KV cache, retrieval indexes, and page tables3. | Must be ![][image7] Champion \+ 5%. |
| **Alignment Overhead** | Memory wasted to conform to specific WebGPU buffer alignment requirements (e.g., 256-byte boundaries). | Tracked as systemic inefficiency. |
| **Decoded Shadow Copies** | Instances where quantized weights are temporarily decompressed into ![][image11]/![][image12] buffers due to missing native kernel support in the browser. | Strictly isolated and measured. |
| **WASM Linear Memory** | Underlying browser memory overhead, including garbage collection pauses, JavaScript bridging, and Emscripten interpreter state14. | Cannot trigger OOM faults. |

Static-weight compression, dynamic adapter quantization, and KV-cache compression mechanisms cannot be conflated into a single, generalized bit-width or compression claim. They must be reported as distinct variables.

### **Timing Methodology**

Latency reporting must abandon simple average token-throughput metrics in favor of a rigorous, lifecycle-based temporal accounting spanning from initial user interaction to final memory cleanup. Measurements must capture the ![][image13], ![][image4], and ![][image14] latencies to expose the long-tail performance degradation inherent in dynamic routing and browser garbage collection.  
The timing methodology isolates the following discrete execution phases:

> 1. **Acquisition**: Time required to fetch the requisite artifact from IndexedDB or the network.  
> 2. **Verification**: Cryptographic hashing and SHA-256 validation of the fetched artifact to prevent execution of corrupted data.  
> 3. **Cold Load**: Time to initialize the WebGPU context, allocate the WASM linear memory bounds, and load the base model from cold storage into resident memory.  
> 4. **Route Decision**: The computational time consumed by the automatic router or classifier before the first domain token is processed13.  
> 5. **Warm Activation**: Time to inject a new adapter into an already active base model residing in memory.  
> 6. **Switching**: The context-switching overhead incurred when hot-swapping adapters and updating the unified paging tables1.  
> 7. **Prefill**: Time to process the input prompt and populate the initial KV cache.  
> 8. **Time to First Token (TTFT)**: The cumulative delay from query submission to the emission of the first response token, serving as the primary metric for user-perceived responsiveness9.  
> 9. **Decode**: The auto-regressive generation speed, strictly reported in tokens per second.  
> 10. **Deactivation and Cleanup**: Time required to safely evict the adapter, release WebGPU buffer allocations, and perform garbage collection to prevent memory leaks.

Testing must enforce strict cold and warm process isolation to ensure that warm-cache benefits are not falsely attributed to algorithmic or routing efficiency.

## **7\. Native/Browser Execution Matrix**

Performance profiles and latency characteristics vary drastically across disparate execution environments. The experiment dictates a rigorous hardware and software matrix to validate the absolute portability and robust performance of the TinyRustLM .slm artifacts across the fragmented landscape of consumer devices.

| Environment Variable | Required Test Matrix Parameters |
| :---- | :---- |
| **CPU Architecture** | x86\_64, ARM64 (Apple Silicon, Snapdragon Elite). |
| **Operating System** | Windows 11, macOS 14, Android 14, iOS 17\. |
| **Browser Runtime** | Chrome (V8 engine), Firefox (SpiderMonkey), Safari (JavaScriptCore)9. |
| **Compiler & SIMD** | Emscripten compiled with baseline configurations, 128-bit fixed-width SIMD, and Relaxed SIMD to measure quantization dot-product optimization21. |
| **Constrained RAM** | Hard physical limits of 4GB and 8GB system RAM to simulate aging, low-end hardware. |
| **Storage Classes** | NVMe SSDs, eMMC 5.1 flash storage, and simulated high-latency network block storage environments. |
| **Mobile Widths** | Responsive execution under thermal throttling conditions typical of mobile form factors. |
| **Network Integrity** | Forced air-gap execution validating zero-secret network offloading; absolute prohibition of telemetry during secure inference. |

Crucially, the matrix must rigorously test application state management, including cancellation tokens and background throttling. Web browsers aggressively throttle background tabs to preserve battery life; the WASM runtime must demonstrate the capacity to gracefully pause and resume inference without crashing the WebGPU context, leaking memory, or corrupting the KV cache when the user switches away from the TinyRustLM interface.

## **8\. Reversibility, Cache, and Fault-Injection Tests**

Dynamic, multi-tenant portfolios are inherently susceptible to state corruption over prolonged, interactive sessions1. The experiment mandates a high-frequency, repeated route and adapter cycle test designed to stress the limits of the runtime environment.  
This fault-injection phase forces the system to rapidly, deterministically switch between the base champion and various specialists over thousands of iterations within a single, continuous WASM sandbox session. The objective is to proactively detect:

* **Cumulative Mutation**: Instances where applying and un-applying low-rank adapters (e.g., executing ![][image15] followed by ![][image16]) results in floating-point drift, irreversibly degrading the base model's zero-state accuracy over time1.  
* **Stale KV Cache**: Failures within the unified paging pool where tokens, attention states, or hidden dimensions from a previous specialist leak into the context window of a subsequent, unrelated query3.  
* **Leaked Memory**: Gradual, uncontrolled exhaustion of the WASM linear memory or WebGPU buffer allocation limits due to improper cleanup of shadow copies, temporary scratch tensors, or unreferenced adapter weights.  
* **Nondeterministic Composition**: Variance in the final output generated by the base champion based solely on the historical sequence of previously loaded and unloaded adapters.  
* **Failed Rollback**: The systemic inability to safely return to the stable champion state following an out-of-memory (OOM) error or runtime exception encountered during an attempted specialist load.

## **9\. Content-Addressed Receipt Graph and Invalidation Rules**

To ensure absolute scientific reproducibility, mandate artifact provenance, and prevent the silent overwriting of failed experimental attempts, every discrete component of the evaluation pipeline must be cryptographically bound by a content-addressed receipt graph.  
The graph utilizes cryptographic hashes (e.g., SHA-256) to construct a Merkle-like provenance chain linking the precise state of the:

> 1. Base Model Weights.  
> 2. Adapter / Specialist Weights.  
> 3. Tokenizer configuration and vocabulary files.  
> 4. Router heuristics or classifier model weights.  
> 5. WASM Runtime engine build and Emscripten compiler flags.  
> 6. Evaluator script logic.  
> 7. Evaluation dataset cases and prompt formatting templates.  
> 8. Raw, unedited model outputs.  
> 9. Execution measurements (timing logs and memory snapshots).  
> 10. Final pass/fail decision matrix.

Raw outputs must remain strictly untouched within the receipt graph. No post-hoc repair scripts, answer completion heuristics, expected keyword injections, easiest-seed selections, or hidden best-of-N sampling are permissible19. Invalidation rules strictly dictate that if any single component in the graph changes—such as a silent, undocumented update to the tokenizer or a patched evaluation prompt to "fix" a failing edge case—the entire downstream receipt is cryptographically invalidated, and the specific experimental arm must be fully re-executed from zero-state. While failed experimental formats may be deleted to conserve physical storage without an obligation for legacy support, their hashed receipts, raw outputs, and failure logs must remain immutable evidence on the permanent record to prevent survivorship bias in final reporting.

## **10\. Pilot, Scale-Up, and Stop Rules**

The exhaustive evaluation of multi-adapter systems across comprehensive hardware matrices requires significant computational and temporal expenditure. To optimize resource utilization and prevent sunk-cost fallacies, a sequential pilot strategy utilizing strict, mathematical stop rules is enforced. This prevents the expenditure of training or conversion compute on candidate architectures that are already mathematically defeated by earlier gating mechanisms.  
The sequential evaluation gates are:

> 1. **Source Gate**: Does the adapter accurately represent the targeted training distribution without exhibiting catastrophic forgetting of foundational syntax? If negative, STOP.  
> 2. **Size Gate**: Does the uncompressed .slm footprint and the projected WebGPU memory allocation exceed the strict physical limits of the target mobile/browser environment? If positive, STOP.  
> 3. **Routing Gate**: Under ideal, unconstrained conditions (e.g., desktop native execution), does the automatic router achieve a positive predictive value high enough to offset the latency penalty of loading the adapter? If negative, STOP.  
> 4. **Raw-Quality Gate**: On a restricted, statistically representative subset of the evaluation taxonomy, does the portfolio demonstrate a statistically significant (McNemar ![][image17]) advantage over the champion? If negative, STOP.

Only candidate configurations that successfully clear all pilot gates are permitted to proceed to the full-scale execution matrix and the independent audit phase.

## **11\. Final Multi-Objective Decision Matrix**

The culmination of the experimental protocol is not the production of a singular, arbitrary scalar score. Reducing the highly dimensional space of edge LLM deployment into a single, blended metric fundamentally obfuscates critical weaknesses, hides fatal trade-offs, and invariably leads to suboptimal deployment decisions12.  
Instead, the final decision function must generate a multi-objective Pareto frontier. The decision matrix visually and mathematically exposes the inevitable trade-offs between:

* **Net Task Accuracy** (![][image18] Pass Probability on target domain tasks).  
* **Memory Overhead** (![][image18] Peak Resident Bytes in the WASM/WebGPU context).  
* **Latency Penalty** (![][image18] ![][image4] Time-To-First-Token and acquisition timing).  
* **Routing Reliability** (False Positive versus False Negative routing rates and associated deferral costs).  
* **Broad Regression** (Stability of the general helpfulness baseline).

The ultimate recommendation to promote a portfolio architecture to the production TinyRustLM product is strictly contingent upon the portfolio demonstrating Pareto dominance. It must mathematically improve accuracy in its specialized domain without violating the strict upper boundaries of memory utilization, latency, and broad capability defined in the initial falsification conditions.

## **12\. Unknowns Requiring Approved Local Execution**

While continuous integration pipelines and cloud-based hardware simulations provide robust, scalable preliminary data, certain systemic unknowns inherent to client-side execution can only be definitively resolved via approved local execution on physical, target-class hardware.  
Cloud environments cannot accurately simulate the thermal throttling behavior of a passively cooled mobile System-on-Chip (SoC) during sustained WebGPU tensor operations. Furthermore, the idiosyncrasies of specific browser garbage collectors operating under high memory pressure, the varying implementations of WASM memory allocation across OS ecosystems, and the real-world latency of fetching content-addressed chunks from a fragmented local filesystem require physical validation9. Final sign-off for product release requires deploying the .slm artifacts to isolated, physical edge devices representing the lowest common denominator of the target user base. This local execution validates the byte and latency accounting schemas under real-world contention, ensuring that theoretical efficiencies translate to actual performance gains.

## **13\. Annotated Primary-Source Bibliography with Direct Links and Dates**

The experimental design, specifically regarding memory management, multi-tenant serving, WebAssembly optimization, and statistical rigor, is directly informed by recent advancements in the scientific literature.  
**Systems and Multi-Tenant Serving:**

* Sheng, Y., et al. (2023/2024). "S-LoRA: Serving Thousands of Concurrent LoRA Adapters." *arXiv:2311.03285*. https://arxiv.org/abs/2311.03285. This paper establishes the necessity of Unified Paging—a unified memory pool to manage dynamic adapter weights with different ranks and KV cache tensors with varying sequence lengths1. Without unified paging, serving multiple adapters concurrently in a constrained environment leads to catastrophic memory fragmentation.  
* Chen, L., et al. (2023/2024). "Punica: Multi-Tenant LoRA Serving." *arXiv:2310.18547*. https://arxiv.org/abs/2310.18547. Punica introduces the Segmented Gather Matrix-Vector Multiplication (SGMV) CUDA kernel, allowing batching of GPU operations for different LoRA models while holding only a single copy of the underlying pre-trained model3. This architecture informs the shared-weight assumptions tested in the portfolio arms.

**WebAssembly and Browser Inference:**

* Chen, T., et al. (2024/2025). "WebLLM: A High-Performance In-Browser LLM Inference Engine." *arXiv:2412.15803*. https://arxiv.org/abs/2412.15803. This work demonstrates that relying on WebGPU for hardware acceleration and Emscripten (WebAssembly) for CPU-bound tasks can retain up to 80% native performance on the same device5. It dictates the necessity of the native/browser execution matrix in Section 7\.  
* CCDS Student Reports. (2026). "Benchmarking WebAssembly: local LLM inference in web browsers." https://hdl.handle.net/10356/213821. This research highlights that implementing 128-bit fixed-width SIMD and Relaxed SIMD instructions within the WASM environment results in massive throughput improvements (up to 12.5x) for quantized dot-product operations21.  
* Jiang, Y., et al. (2026). "WarpL: Mutation-Based Performance Debugging for WebAssembly Runtimes." *arXiv:2604.13693*. https://arxiv.org/abs/2604.13693. This paper highlights the complexities of performance debugging in WASM runtimes, where suboptimal compilation of input programs causes severe latency spikes14.

**Evaluation Methodology and Statistical Rigor:**

* Freiesleben, T., et al. (2026). "Resolution Diagnostics for Paired LLM Evaluation." *arXiv:2605.30315*. https://arxiv.org/abs/2605.30315. This meta-analysis proves that many pairwise rankings on public LLM leaderboards do not meet conventional paired-test resolution targets, mandating the use of paired McNemar's tests for binary accuracy rather than unpaired Gaussian formulas15.  
* Anonymous. (2026). "Evaluating Large Language Models at Scale with Spark-LLM-Eval." *arXiv:2603.28769*. https://arxiv.org/abs/2603.28769. This framework emphasizes statistical rigor, mandating that every reported metric includes bootstrap confidence intervals and appropriate significance tests (paired t-tests, McNemar's test, or Wilcoxon signed-rank)10.  
* Anonymous. (2026). "The Faithfulness Problem in Inference Scaling." *arXiv:2601.06423*. https://arxiv.org/abs/2601.06423. This paper provides compelling statistical evidence (via bootstrap CIs and effect sizes) demonstrating that hidden Best-of-N sampling (majority voting) often amplifies confident, unfaithful priors rather than improving genuine reasoning capabilities19, justifying its exclusion from this protocol.

**Routing and Selective Prediction:**

* Anonymous. (2026). "Prover-Verifier Deliberation (PVD) as a Selective-Prediction Protocol." *arXiv:2605.25133*. https://arxiv.org/abs/2605.25133. This research introduces selective prediction protocols that trade coverage for precision, highlighting the critical difference between routing accuracy and final task performance12.  
* Anonymous. (2025). "LLMoE: A Novel Framework Employing LLMs as Routers." *arXiv:2501.09636*. https://arxiv.org/abs/2501.09636. This paper explores utilizing LLMs to dynamically select experts based on contextual nuances rather than traditional neural network-based routers, emphasizing the need to account for routing overhead in latency measurements13.

#### **Works cited**

> 1. S-LoRA: Serving Thousands of Concurrent LoRA Adapters \- Department of Computer Science and Technology |, [https://www.cl.cam.ac.uk/\~ey204/teaching/ACS/R244\_2024\_2025/papers/SO-LORA\_ARXIV\_2024.pdf](https://www.cl.cam.ac.uk/~ey204/teaching/ACS/R244_2024_2025/papers/SO-LORA_ARXIV_2024.pdf)  
> 2. Institutional Platform for Secure Self-Service Large Language Model Exploration \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12150735/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12150735/)  
> 3. Multi-Tenant LoRA Serving \- Punica \- arXiv, [https://arxiv.org/pdf/2310.18547](https://arxiv.org/pdf/2310.18547)  
> 4. Dynamic Operator Optimization for Efficient Multi-Tenant LoRA Model Serving, [https://ojs.aaai.org/index.php/AAAI/article/view/34453/36608](https://ojs.aaai.org/index.php/AAAI/article/view/34453/36608)  
> 5. WebLLM: A High-Performance In-Browser LLM Inference Engine \- arXiv, [https://arxiv.org/pdf/2412.15803?](https://arxiv.org/pdf/2412.15803)  
> 6. WebLLM: A High-Performance In-Browser LLM Inference Engine \- arXiv, [https://arxiv.org/html/2412.15803v2](https://arxiv.org/html/2412.15803v2)  
> 7. S-LoRA: Scalable LoRA Serving \- Emergent Mind, [https://www.emergentmind.com/topics/scalable-serving-s-lora-system](https://www.emergentmind.com/topics/scalable-serving-s-lora-system)  
> 8. ICML Poster Compress then Serve: Serving Thousands of LoRA Adapters with Little Overhead, [https://icml.cc/virtual/2025/poster/46530](https://icml.cc/virtual/2025/poster/46530)  
> 9. Serverless Everywhere: A Comparative Analysis of WebAssembly Workflows Across Browser, Edge, and Cloud \- arXiv, [https://arxiv.org/html/2512.04089v1](https://arxiv.org/html/2512.04089v1)  
> 10. \[2603.28769\] Spark-LLM-Eval: A Distributed Framework for Statistically Rigorous Large Language Model Evaluation \- arXiv, [https://arxiv.org/abs/2603.28769](https://arxiv.org/abs/2603.28769)  
> 11. Enhanced LLM Reasoning by Optimizing Reward Functions with Search-Driven Reinforcement Learning \- arXiv, [https://arxiv.org/html/2605.02073](https://arxiv.org/html/2605.02073)  
> 12. Dynamic Model Routing and Cascading for Efficient LLM Inference: A Survey \- arXiv, [https://arxiv.org/html/2603.04445v1](https://arxiv.org/html/2603.04445v1)  
> 13. Universal Model Routing for Efficient LLM Inference \- arXiv, [https://arxiv.org/html/2502.08773v1](https://arxiv.org/html/2502.08773v1)  
> 14. \[2604.13693\] Debugging Performance Issues in WebAssembly Runtimes via Mutation-based Inference \- arXiv, [https://arxiv.org/abs/2604.13693](https://arxiv.org/abs/2604.13693)  
> 15. Resolution Diagnostics for Paired LLM Evaluation \- arXiv, [https://arxiv.org/pdf/2605.30315](https://arxiv.org/pdf/2605.30315)  
> 16. Trust but Verify: Prover-Verifier Deliberation for Selective LLM Prediction \- arXiv, [https://arxiv.org/html/2605.25133](https://arxiv.org/html/2605.25133)  
> 17. Evaluating Fine-Tuning and Metrics for Neural Decompilation of Dart AOT Binaries \- arXiv, [https://arxiv.org/html/2607.06125v1](https://arxiv.org/html/2607.06125v1)  
> 18. Dynamic Model Routing and Cascading for Efficient LLM Inference: A Survey \- arXiv, [https://arxiv.org/html/2603.04445v2](https://arxiv.org/html/2603.04445v2)  
> 19. Does Inference Scaling Improve Reasoning Faithfulness? A Comprehensive Multi-Model Analysis of Self-Consistency Tradeoffs in Chain-of-Thought Reasoning \- arXiv, [https://arxiv.org/html/2601.06423v1](https://arxiv.org/html/2601.06423v1)  
> 20. LLM-Based Routing in Mixture of Experts: A Novel Framework for Trading \- arXiv, [https://arxiv.org/html/2501.09636v2](https://arxiv.org/html/2501.09636v2)  
> 21. Benchmarking WebAssembly: local LLM inference in web browsers \- DR-NTU, [https://dr.ntu.edu.sg/entities/publication/71d7b0d9-46ae-4e28-9246-039bf03ba340](https://dr.ntu.edu.sg/entities/publication/71d7b0d9-46ae-4e28-9246-039bf03ba340)  
> 22. Sharing is Scaling: Efficient RL Fine-tuning with Multi-tenancy | Swiss AI Research Platform, [https://serving.swissai.svc.cscs.ch/articles/04-multitenancy](https://serving.swissai.svc.cscs.ch/articles/04-multitenancy)  
> 23. \[2311.03285\] S-LoRA: Serving Thousands of Concurrent LoRA Adapters \- arXiv, [https://arxiv.org/abs/2311.03285](https://arxiv.org/abs/2311.03285)  
> 24. \[2310.18547\] Punica: Multi-Tenant LoRA Serving \- arXiv, [https://arxiv.org/abs/2310.18547](https://arxiv.org/abs/2310.18547)  
> 25. MLSys 2024 | Awesome Papers, [https://paper.lingyunyang.com/reading-notes/conference/mlsys-2024](https://paper.lingyunyang.com/reading-notes/conference/mlsys-2024)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAbCAYAAACJISRoAAABQklEQVR4Xu3UQSsFURgG4E8o5Sok3ChlZ+1X2FjZoJTuykJZ+gNWFspSCckCGz/BSsnCL7CUhYWyVOJ9O+9373fPhrl3mtW89XTnnnOab+Z8M2NWp8cMyjQ0Mw0YhhmJcyPyr0zKGjzDi2zBAszBtrzCg9ZOSaFMwBMcSMyivMFmNlcoy/AJqxLjY5znup5TSRFuA7fDtybmWLid3NbCGZAzeNcvncippeLEca4tHF5ZbHoeb3hfTa+kCBsZm57HG543fVb2Yc/+eGd4dbHpeXh3vMvY9CE4En9QeMxx6oo3nO4tfUZi+J/jvsabzs/KhXDNGFxpnNpZgUf4li84t853qmXp6n/gQw5h1NK23QmL0C0sSTuVFOknPBFPSl7kEuallPBJuhEe886vrfM6lJZd2YB12OmeLieVFPGMS506Kb/e8FasM85uWgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAaCAYAAABLlle3AAABUElEQVR4Xu3VvUoDQRQF4CsSUUwT8QexEFKkS2Ur9hZaiJ0giIiPYCNikyqNWAqiVhYWvoJYCGLhA4ilpLAQLIUQz2HOkMm4IeJuVtAc+AiZGZjM3bsZs/+aYZiG2UgRCjAj4dyo/Di/sukErMMjPMsmzMMcbMkL3GntpKRKCR6gJmHK0oCNaC5VFuAdViWMH+M812UWnoAn8acKcyysBCuSWXLfdAjO4FWfdCKn5n4McZxrM0nYRHF8A32nifh60Ug8kZSwieL4BurVRKzAkaxEc4kJn2ccnp5V6PU8q3Aru9FcYnLdlCXxTXRj7m8vDL9z3DdXtyYagx3Yl73O6XaW4V6a8AHn1v6f3TZ3uha8SR3G7WuWoGKuYsTXq6/hRcEqHMClXHSsyDD+0ayZ25hZlCtLeQN1S+6b8io8lGuY0pi/oZ7M9Qzv6UEG+QP5BFNFTJq/mHS3AAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAWCAYAAADwza0nAAAAjElEQVR4XmNgGAW0AzFQPAeI1dHk8AKyNcIANxAnAfEiIDaHYkYUFQQAKxBHQPE6IHYCYmYUFUQAkAZ/IF4LpUGYKEPI1ggCIIWuQHwAio2RJdEByJ8gHADEy4DYmwFiAE7bOIE4gQESKCBMdMiSpBEUfyCcA8RLgViPAaIYpwYQALkZFmeKaHIjGgAAI4kSzs/HDgwAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAbCAYAAACEP1QvAAAB00lEQVR4Xu3UvUscURQF8Csq+BE1oqBCiiCICGIE0wiCBmIZG4UIATtRgpWCoqSMjY1gCsEExMJCIaZRwWCxahNSxUAatRE0+QdMl4Dn7DtvZnZwAgvRLZwDP4Q3b7wz794dszRpklMqk/AJ9mVe60ylbMEGrMgabEOd9uWdKflorliRvINx7Xkge/AHruQ9NGpP3qmHHzIXu8aT+AI1FhZ/q7//JbdWvBhGZBaqYRCW5Ck0wbnMuNuCvIBf0Gy5xfnAvI8eBrtjeQ4vhYPxHTrMDQd9hmeW/OZ8mN/QZWFxDuQitAv/7xsLBzPIGLRIBl5pvUqOzB2tH7hdKDd3zMSJ98VLpNNyC7XBJfRF1rIpaHGGF+kEnmiNPST2kw/E2aBRODT38yG24QIeRfbUmvsZ+viZic9LNgPy1dyN0bWf0AplEh8eFt/RtSH5a26WfP5Z3E/2urkn5pHxC0XTWvsgxxYOI/EU+s2FBYnDxi+dD1vCl+iOrGXD6czIgbm+Lpt7I/K943HTJgyb+9LRhIVHzL20YG5O2C7i3LyO7AtS0OIctFPh8bCn7F9SGqDXwmm/KSzyGHok8WvnBy06bHeWb3Amq1CRe/l2U9DiadLcj1wDfbhzkcnTMAIAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAWCAYAAAB64jRmAAAAn0lEQVR4Xu2VIQ7CQBBFpyGIhlOgcBhEPQmqokgEgqA5UlWT1tEzcDT+z06TtroIpv8lLytmzctmd82EEEL8jrtbw8NsFoZVRA7s4BM2sHCzyY5AbOHN7eEZbiY7gsG4Cr59peGCVxFJGHWBH/c0Hv4zvJf0CjtYWooNcYo5fFh6cGjIFzZsJP9H+oItPFoKCxFHeMeGP3E/mwkhxOJ8ASn3Es6gI7pWAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAWCAYAAADTlvzyAAAAnUlEQVR4XmNgGAUjCTACsTkUa6LJURUwA7E/EK+F0iAMEqMqYAXiCCheB8RODDSwBBnQzUJOIE5ggFgCiy9Q3FEVgFyeCsUbgViPgQaWoANJKO6HYhCbpoDuFiIDYSBuBeJJUKyIKk07wA3FeUC8ggERtzSPXxBATr0grIQiSwNAdwthAJSFQBhUMAwtACvGZhHA06CYprXFKCAJAAAaOxl1qy//5AAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAWCAYAAADwza0nAAAAlklEQVR4XmNgGAXIgBGIzaFYE00OK2AGYn8gXgulQRgkhhWwAnEEFK8DYicGPIqRAckaOYE4gQGiGOYfkN+wApBJqVC8EYj1GPAoRgeSUNwPxSA2UYBsjchAGIhbgXgSFCuiShMG3FCcB8QrGBB+J9r/IIAc2iCshCKLB5CtEQZAUQfCoARCGYAlr1kE8DQoJip3DBIAAOdrGXUB+fNiAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAaCAYAAADrCT9ZAAABo0lEQVR4Xu3WPyhGURzG8SMUIYlCZiQGExlMGBlkEIuSBUlKomSSQUqS8i4ySGKRVf5koyglMtsMNmUQz9P5ndu57+t0X4P7envPtz6Dc8+Lc++5971K+Xw+399WDUtiOukYK1R6/BhOxT7U2JOyoSKYhVV4EnOhGbpBuIRaKBBHcALF1rysqRQuhGvB79Bhje3CA1RZY0HcEmNiHsqgHTbEFJQEs+MvasF23P70COuQFz6sy7kFd0Gf2IN76FH6RBDvh5lgtjturUSatqBJfyyydBbMe3US7sSijP0Yn3D14gpGZNx+ALj+UByls2BTo7iFceW4woxnm3ijmzNfJ56hW8Yy0W8WbFqADxV+kIUaFrzCvIeZ2ebXUGmNuxpQqVvXZRMa9Mcicy3Y7MA1OFR6nonzvqDXGguVcws2T2Ri3Ps7YhlaYEiOxZ1rwfzmIL5Z3Sh9UUz8n1+h2RoL4i88F7yiJp452oYVKLeOxdUonMGneIMDaLXmdCr9VsUdOiFeoN+akxK3K+VbY7zKVJE0/h/ja2ibhT/7fD6fz+fzZbZvlfBumQ0NA0YAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABWklEQVR4Xu3UsSuFURgG8FdRhAwMlGJSMkhIYlTuwGKQQVaLyUKmW7LLX8CADDYMEl/8DSYTySL/g+f5znO+e9zv3JuUb/qe+qX73nPv+933OMesTJm69MsxnMMtLElLbVk0bbAN13IJB9ARLmJa4UzWVeuFe5lVrVHW4MJcQ+KD7UM1WJOmsEaj8CKTQf1EjoJamHbhuHbq3luGZ+iTrPgqA75obs50B51B3YdriZ/jd4SZhw8YlzQrFm/Ep6QEuoK6z6C8W74RJ/Omv9mUCmu0aX9rxL2lL/tlo0Z7tCeJxRs126Npc7/0RyMWfaNs46z2X3dq8UPbLU/mDmwYNmYjP940hTXqgUdZUI3Xx43wQDJz8gAjqjFVy5+1LXNXGS8DyrIoCczALhwKTzuzKp8woRrDfeLduCEVuIKhYE0u3HQetmFz44qNLBY+zJhM6XXTFNaoTJn/zzetbFfaNIUGLwAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAcCAYAAAC6YTVCAAAAtUlEQVR4Xu3RPQ4BURSG4Ssq8RNCo1KrlVoJDbVgBSJRigUoVQqJygI0Wg1qO9Bp7EDvPdc3MROV6ci8yZNMTu6Zuck4l/SLZTDABlMpRE6EqskRbaQwkj2yGEtFO98v5XCQiQ1UXa7ouPd17YWuhbvYoaCq3HBCQ3wzXKQUDF10ae5eX/BfsWIt9XCWfDCkpjzQDc199m/WssAQW/RlhR2WYucjFVF2oWvo2a6dlo9iLSX9UU8A4CMLXf0LWgAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAXCAYAAABnGz2mAAAB/klEQVR4Xu3WO0hcQRQG4CMSUJOYqEUQBDdCEJuoGC00pQqCMRAJIkIsbUR8oKCkE0kdCx9pRMHCykIUSRFWEixMIzZCTKGSR2dpY6H/v3Nmd2bvXXctxAX3h6+Zmb17dubcUZFc7kEeqiHohQf+9N2ERayqj3AKzd6KzMLntMC6Kven46mHbVhWK/50IjWwr9phRMzu3SR1MAeLcKLCCmuCH1DpOHYXuHkHP1VJ0txN80bCCytU3KnBpLFhuyg5WVdYKbwV01u76r2Yo2Xy1QeYhGLoVrPwSte5SVVYgzqDTmgTs5b4XC9s1grYgmnFhxXofKvqEdOkB/BSlcFXMY1MNqkKs0VcwBd4Bq8Vey4QHh2P0H7QzYB6AVHoc+Yew3cYVTbpCruUxHO4AbRpF7nJ2sLYT7+gVoXFXWNTBf/FfIlbcLrCzqHRGWfYJoGwhw7FnDmFpQv2xH9jOfYPqpVNqsLsD+d4RoXxGLiVdlvDwjeQb26emBeG1mBCx8gmVWHudWF3mO1gWyIQVjuTPKh5pKKwA2Mwr6bE/3sagQX4K6aPiL07Lv4P5hXDa4lX0CfFHx1IVhbGbfwmps/CwqanIzGX41O5/sgzDT/P+yuiYq3wHP6oz7ABT2LLg2GDhzX+rYQ3Pb+IuFsd/nQ8/ZL4j+M3LEGRtyKXXIK5ArsvhkD3IX9XAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAXCAYAAABnGz2mAAACM0lEQVR4Xu3WT0gVURQG8BMVlP2xMvoDbQpSLEhCCQrcRdAiDSsqBHUnVERlFImtomVQGbQrWkREbkIUkggjaFFQEYSQLUJEFy1aFbSy7/N813dn3n2Vi+hB74Pfwrl3Zs7MPXeeZpX8B1kmp+E4LM4O/5uwiPvSBxOwJzPj9+E1zsBjeCoPYEM8CamFYZiEz3I0Gs+kHt7JPjhr/vbmk2PwHDbCIhmAQVgK6+QOrNU5h+Sb/i5KG7yW1bmxPw0L+w67o2P34IN5ITxOP+Ccxnkv4n2TKbvC1kCreW+9lCPmS8sslA64BCut8PpvQpPm5bNexuA6LLDC5mKbsM+YkoWxYTeZN+MVYY8s0fheYXPy6d/DDqmBEdgpDHvpFLyVyzpWKs3yNT/AhIoPSJxu2Qqj0B6NrYAX5ssSliakTt7ACfM3lk81PJGe3NhsyrYw9tNHaJBU4jkhW2DavNi44Di95s0ebwiGLdQPXZIqfLaH2KShYVNpgVeW3bE8NgXb5Bo8guXRnIswY9mVYBHsw4PRMb69onAZhswbPjR9PtyB3Lm8KJ+WHsIF80KIX3q2BDdFyFX4AtvNzyXe7xYcjpwPJ8ThbuMFUgk3HTX/qrMXbguXKf495e7iV57LelL4s8NvJNMo/MrzLeYVpSwL4856Zt5nqbDpadz8oqvs10vO47sipeYls9n8SeiG+VMmm8+8wVON/1fCLz1vRHxb+7PDc+m0wn8cn+AuVGVmVFJJcX4CT9aJ7klj458AAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAbCAYAAACEP1QvAAABvElEQVR4Xu3UzytmURwG8K9QyM9mMWmU/Cwb0rBQNJtZWCCxMCW2skQR/4A9CzVNSZNEygaLIV1RStI0WTEWNvwHlvI8znPcc/Eu3gWa5n3qU2/nnu73vOd87zHLJJPU6ZRT+B7YhaFgHlMPm/BTtqE1MSPNdMst3MGZ9EOW5pTIDnRojKmFI6gKxtKKL06p8lUuoDwYL4QIRoKxtPIqxbNhWKah2NxWzkmL5vnCPfABPkqunjNTEpkr6JMD6/AjGHsIVzogS/AHGs0VoF/QbHFxnl0vdMkBNJjLjESWLM7w3ZQIt6JOIhjUeJHw5ePwSSr13Ie7swF5+k2R/QvFGW4bnUOTxqrlxtyC+DJikTA84ytzDZbqzPkpLluK4mwiOoayJ2PX8BkOZcuSCwiL98mluWb08d3OfngWv11cHVfJDl6VSci3+Ebzlwfn0SKsmOtoXiJ0YnETMlwI/1hbMPYQvyrahwlYsLhz/afET45Y7BvMyh5UaI7PKKyZO0KahzGLb8LHvGtxbg9vJOLZltrzpgrDZ+1QI7ykXgrviC8Snn8ivtHCZnuz/Ia/wi0tSD5+3bxr8Uwy+T9yD17kb64qdCzjAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAbCAYAAACEP1QvAAAB0UlEQVR4Xu3UzyulURwG8K+kkN9EahZSSAll9lKUjdlooshiShSlKGLvH2BhQU0WFCUzCxZGuTM20yTNKBvDQom9srLxPM5z7n3fe91icV3lPvVZ3PO+7z3nPd/ve8wyySR5cmQStmFf5jUeTD18g3U5hNbQHS/MlGyZmyxLFmFU93yQI+jQGNMEB1AZGHt2KuBU5uKucSd+QzGMyJW5RfhUwX/oD4w9OymbPBuGZBaKoBcW5CNUw6XMuMei6YEbqNU14n18xqcAIub6I5RO6JNVOIFmKJc9c/VL9uac7A7aLPmb+8Xz/0PhzXUSgQGNFwo7lVvrG24X8sxtM7Hj/eS+4f5Bt8XyGe7trU3ONMoZtGiMNSTWkwtib9Aw/IJlYRnit7kGNuCHTMCxJZbsMZ/kD5TGjV1DA+RKia778A93dM1/+2UWPni4sAtz/ZUQ39lr5h7mg1w5TWtsRbilvhmJu9BlLtw1uoUvGmMG4bu5coXiPwP6aa6uS+beiPwbcLtp09z3ypOOxs0tjuEJRuyDMYv1CX8HyxJNWidno/H0IXYsa8r6JQtPq3aLdftT4YJ5OPlGZqM+Gd9owWZ7tfyFc/kK+eHLqU1aJ88kk/eRB6JzfJ0jD5YeAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIEAAAAaCAYAAACQAT/QAAAD4UlEQVR4Xu2ZS4gUVxRAr6ig+IlkRA0qmOCXBFQ0BIKC6EAMfhbqQlRcyEiEoC78oUIy+QhmkY2oCzULV4KERBmCIIINBkEDIqLoQkFFxoULQZKFLtR75t1LPWtqMtU9zXTbvAMHmfe6q9/n3luvSpFEIpGA4epE8yNzgjrUHBe1uyN6vtm7j78HiyFmmxSPD/PtPr58fzzfRrNQ/dHsi/y6xzIXn09pUhCkIJAP1W3mf+pF9St1pLlYPa++VPeYkyX8yEr1rslnvpTBY5jZrv6jdqsd5nh1hvqd+to8rX7R802R2eZZ9b66SbL5NhJ+v0v9y/Rki2Hd2ZNjEvYLt6vr1PWSfZc9YQ1K41H0SN2X6wPa6PPPOWRhp9nIBWSDK+po01kg2UKtitq9iuxUP43aq2GmujrfOEA2SgjYihnPJc8h9Yo5JmqfYj5RT0Xt/cJFkAvmv8hG/y3hov4DzgZ1vtlIDqgPJLutAZvcqb4x11g7sPG4JWqrFgKM6lkvKOG/SBgzc/H5FEGFINuPmDGfmE8lXKs0nkEVCVkVw0R/lpBNTBxhqrpDsqxqJEWVinEybtrjCsctZJfJwtdKvYLA12+vhGv6XHw+RXimE9hxcFONSWK8oH4Q9fVLCoLqabkg8NMyJeZ3CQs13fxWwr0vDgIGTTv9ZZljHldPlJSDThm+kVD+vBTyxLNf/Ux6B8Eida05EOoVBH5r4pbGunJ2eWHOjT4X066+Uv80WSuSl0Nuh1nV00EMF6qoYyVkOZLxn6v/ql+bnAG2hq80BSxcHKRL1BWSnXP8rEO1+97+/b9DVxnqEQQE62GTdQafi8+nCALGD4TxoZCgeWxujtqrwoNgmYRDHwKDYVCeQWRZm/U1A75wjBtZJEqj3+KQuTF2KkFZqIhIMuSrFBl4taD9V+m7jOdh3F6prksY5y3JDrPxE40THwrzEFReHSpSY6BTMp+rv0nYZN9oIozy9IdJllULj1R4VHovXF/y7FsGD1IWB32jR6mXzJvqQQmbWg8GWglYWwImX5V8Lhjf7x0/+fM4mYdr3jDPSI1zTUFQnpYOAl5W5H/cXyR1mY18MVSEL5yfjOPJcxvAZ1L7i6EiBhIEHAB3q8vzHZKtdXyYjeFQ2C3hkB3DnvygPjTnxZ3VQHTxKpV7SwwDuyPhdSU2G2THNcmeaGI8CH6S+j7K1hIES817EpLtsrz7gou+25KdCajK/B/CNPWkSRt9Fckq5jkJ1YF+Hh+xZiZJeO+eh8yaJc3xTqAIsiC/+c7HJreGelJLECRaDKplvQMr8Z6RgiCRSCQSiUQikUgkEq3GW9Q3Bs+1eGfVAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIEAAAAaCAYAAACQAT/QAAADn0lEQVR4Xu2ZS6hOURSAl1DkmSuPUMgzCiElStxCHgMMhAw8ooSBVyiuVzEwEQYeAyMleSQpKX8xQUkiBhQSAwMlBgywvrvX6ux7/v/y3zu45wz2V1+6e//nnP1Ye+19DpFEIpGArupAc7A5QO1s9o3K3W7NV1bX8XdH0clskNrtw3y5ty9fH/e3aKaph83WyI97LH3x/tRNCoIUBNJP3Wz+UO+q89Xu5mz1pvpT3WUOkfCQxeork9/MlI6ji9moPlE/qRvM/upo9YD627ykzmi+UmSceUV9o66RrL9FwvNvqbdNX2wxjDtzckbCfOFWdYW6UrJrmRPGoG48it6re3J1QBl1/juHVdhkFjmATHBF7Wk6UyUbqCVRuWeR7eqEqLxoVksI2IoZ9yXPMfWB2SsqH2p+VC9E5f+FmyA3zF/IRD+UcFN/gLNKnWIWyT71rWTbGjDJTeofc5mVAxOP66KyoiGFn5DQZvri/akFGYLVfsqMGWl+lnCvuvEVVJGwqmLYJo5KWE2sLIRh6jbJVlWR1MpUtJN2Ux5nOLaQHSYDXzQ+frsltNn74v2pha90AjsObrIxixjvqH2iuv+SgqA4ShMEflomxVyVMFCjzC3qUmkZBDSacurrZbx5Vj1Xpxx06mGThPTnqZA3nr3qRKkOglnqcrMM+NbElsa4cnb5Zk6KfhfTqP5Sr5uMFYuXQ+4Gs01vBzHcqKL2lrDKkRU/Xf2uLjQ5A2wMl5QCBi4O0jnqIsnOOX7WIdsdtH//dejqKAjW4ybjDN4X708tCBg/EMaHQoLmg7k2Km8THgTzJBz6EGgMjfIVxCprsLoy4ANHu5FBIjX6Fof0jbaTCdrKZKnOUq253q6pB9rtmeqxhHY+l+wwG7/ROPGhMA9B5dmhIu0MdFLmV/WihEn2iSbCSE/XTFZZWxljnpbqgWtN3n3rwYOUwUGf6B7qPfOZul/CVlcGGNuTUp2VvC8Y7/eOn/x5nczDPZ+al6WdfU1B0HGUOgj4WJF/uH9IumUW+WGoFj5wfjKOO882gF+kPB+GOADuVBfkKyQb6/gwG8OhkK+jHLJjmJND6juTLaxdEF18SmVviaFhLyV8rsSywep4JNkbTYwHwREp/lV2rvlawmK7Ly0/cFH3QrIzAVmZ/0MYrp43KaOuIlnGvCEhO1DP6yO2m0ESvrvnYWWNlXJ8E6gFqyA/+c4Ik60hkUgkEolEIpFIJBKJRCKRSPyLv1YK/1SG193yAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEoAAAAaCAYAAAAQXsqGAAACuklEQVR4Xu2WS8hNURiGvz+U+31AKT8lt3IJiYykKJcBA4okEwYy+JXr5I9k6FIiJT9CBsoAA0kHJWSAMsEAiZGhqbyv9X722tve5+yNkqynns45a6+9zl7f/tZan1kikUgkmjBA9sCb8Bo8LAdF/coYJ/vgFXgbrpJd6jMbPpZn4Rl4HR6U/wwb5FULAeMED8nerNtP9IeX5Sa1jYF35SK1zYMf5Vf4Fu6w7AX9NZgFWyxMnI7PXc0z0EIW0T1R+2r5Eo6N2mOmw9eSwXDOyxP6zWvbZSP6wc1yHxwO11kYmM7PutaGY9D9FpbBDAuZ4elfBYP4TjIwzhLJLODSKYP9/d74ZfiyvQOHWD5QIy305QvqSApUzUAtg+slU/QFnGVhfVNuiHN/9G4P+x+BJ+Wk/OWOTIAfZBwoTo6+12cZa608UFzCtAWHWrj/kdwKF8OHcKmsZBucIltwo9qHyQcWTqAq+FD0qGy3B3WC+8xn2TRQnEedQI2G06TDe59LvuxK+ID0lWWpPVl+six4RZjKxyWD1PZPalC19BZIZlpVoKqWHpc/bVkIFJcZP6nDe7/IqvG/s0Y+gaMKbdwXpqqtHcWs+pXM8gwuZrGfegwUl2cZDKQHKt7HuJ3QSxZKiIsWTs/4BE2Bsj8cKD/hOFiXhcLL657daqsLl5+ne5/VC3JMr/S6h7AgpKy2OVk+zwF52kKtNgLelzygCNtvSRaxhCegH14+L+5hvsFznFK4VlvyHtwFT1k22d+pVrmH7YQXLJyktFPQPRt52rJkWQFvyInqw2BxTMp+vt8sly24EO6Fx6TPg2Mwqyj3Xs73KZwjKylWtKwtatUVDeBDrpTd+UuV8J6ZFuo4fm/ywhg41l3dVl6/+Xgcm/9Ra2zfm+L9KVFCClRNnsE38hwcnL+cSCQSiUTi/+Ibq2q3u00MbRcAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAaCAYAAABRqrc5AAAAxElEQVR4Xu3SsQpBYRjG8U8xKGUzMZi5AatSLkBxA2KwuQGJTSaL0aRchYtQbsBmsCmDeB7nyTnnQ+erY/z+9Zvezlvn7TPG51pGptC0Zs7V5Aw7yMXHbo1lA1doxMdupV5SgZmU4QgrE97JqT60hE3gAnVJrARLyAurwskEyyixvyzpSjTegTfhIuLSrxVkAUVrxngL3oVG1uxdWwb2QGVhKwcT/PZHqZfwSa9lCJ0f5nKH3uvLSHyNN3k42pvwjj6fU0/6szKnOTZrtgAAAABJRU5ErkJggg==>
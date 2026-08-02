# **Preregistered Decision Campaign for TinyRustLM Engineering and Compute Allocation**

## **1\. Executive Strategic Recommendation**

The optimization and deployment of the TinyRustLM architecture within memory-constrained, on-device environments require a rigorous, preregistered sequential decision framework. To allocate finite engineering and computational resources effectively, the campaign must systematically evaluate competing strategic pathways before authorizing large-scale hardware commitments. The frontier of on-device machine learning deployment has shifted decisively toward inference-time strategies, memory-constrained execution environments, and rigorous statistical evaluation of model capabilities1.  
The recommended strategy mandates the utilization of the Sequential Probability Ratio Test (SPRT) to govern all behavioral screening gates2. By assessing candidate models sequentially, SPRT minimizes the expected sample size required to reach a statistically valid conclusion regarding a model's capabilities, thereby preserving computational resources and researcher bandwidth5. The campaign dictates that untreated, off-the-shelf candidate models—such as the Qwen2.5-1.5B-Instruct or the SmolLM2-135M-Instruct—must first pass an untouchable, zero-shot behavioral screen before any capital is expended on conversion, native evaluation in Rust ecosystems (such as candle or burn), or browser-based WebAssembly (WASM) deployment8.  
If native evaluation succeeds, the Expected Value of Perfect Information (EVPI) directs subsequent investments into quantization and artifact deployment rather than redundant architectural overhauls12. The preregistered framework explicitly prohibits parallel architecture development, prioritizing a linear, gated dependency graph that invalidates downstream engineering the moment an upstream defect is detected. Public research and vendor claims may nominate experiments, but they cannot bypass the private product gates defined in this document.

## **2\. Hypothesis and Falsification Matrix**

To prevent arbitrary resource allocation and the sunk-cost fallacy, the campaign is grounded in seven mutually exclusive strategic hypotheses. Each hypothesis dictates a specific trajectory for engineering effort and carries distinct operational costs for false positive (Type I) and false negative (Type II) errors.

| Strategic Hypothesis | Observable Predictions | Falsifying Public Evidence (Available Now) | Evidence Requiring Local Execution | Cost of Error (False Positive / False Negative) |
| :---- | :---- | :---- | :---- | :---- |
| **H1: Qualified dense source already exists.** | A public model (e.g., SmolLM2-1.7B, Llama-3.2-1B-Instruct) achieves the quality threshold out-of-the-box. | Benchmark contamination identified; restrictive commercial licensing (e.g., Llama Community License limits)14. | Untouched behavioral screening passes SPRT thresholds without prompt engineering or hyperparameter tuning. | **FP:** Catastrophic deployment failure; broken product trust. **FN:** Wasted compute on unnecessary pretraining. |
| **H2: Dense behavioral distillation is best.** | A small student model matching a large reasoning teacher can be trained via On-Policy Distillation (OPD). | Teacher fails initial screening; exposure bias scales exponentially with sequence length16. | KL-divergence stabilization during high-temperature scaling; sealed holdout subset success17. | **FP:** Compute wasted on a non-converging student model. **FN:** Over-reliance on oversized models causing latency. |
| **H3: Tokenizer or capacity is the bottleneck.** | Replacing the tokenizer or adjusting the parameter allocation yields higher returns than architecture changes. | Vocabulary expansion fails to reduce sequence length or introduces out-of-vocabulary (OOV) generation errors19. | Measurement of bits-per-character (BPC) efficiency across varied downstream domains. | **FP:** Destabilized model weights requiring full retraining. **FN:** Suboptimal inference throughput and high latency. |
| **H4: Hybrid architecture offers material advantage.** | Mamba/Transformer hybrids (e.g., Mamba-3 SISO) drastically reduce memory overhead while maintaining recall. | Existing SSMs demonstrate attention collapse on long-context retrieval tasks20. | Native Rust parity tests (mamba-rs vs candle transformer) measuring exact bit-for-bit output21. | **FP:** Massive engineering debt rewriting custom CUDA/WGPU kernels. **FN:** Missed ![][image1] inference scaling advantage. |
| **H5: External backend dominates native port.** | Integrating llama.cpp or ONNX yields better throughput than native burn or candle. | llama.cpp binding overhead exceeds inference gains; WASM compilation blocks external C++ binaries23. | Profiling native WebGPU (burn) against cross-compiled WebAssembly backends25. | **FP:** Irresolvable dependency conflicts and brittle FFI boundaries. **FN:** Unnecessary reinvention of optimized hardware kernels. |
| **H6: Training-data quality is the limiting factor.** | Curating a smaller, high-fidelity dataset outperforms standard fine-tuning on massive generic datasets. | Entropy-collapsed RL checkpoints or repetition collapse observed despite high-quality data27. | Local DPO / RLHF ablation studies showing gradient diversity improvements. | **FP:** High human annotation costs with no measurable yield. **FN:** Model stalled at local optima due to noisy data. |
| **H7: Evaluator is too weak to support a decision.** | The current scalar oracle cannot reliably distinguish between a 1B and a 3B model due to high variance. | Inter-rater reliability between human judges and the AI oracle falls below a Cohen's Kappa of 0.6. | Local execution of Wald's SPRT indicating failure to terminate within the maximum sample limit4. | **FP:** Good models rejected (high Type II error in screening). **FN:** Defective models promoted to production. |

## **3\. Dependency and Invalidation Graph**

The decision architecture operates as a strict Directed Acyclic Graph (DAG). A failure at an upstream gate immediately invalidates all downstream dependent research, preventing the escalation of commitment to failing paradigms.

1. **Gate 1: License and Supply Chain Resolution.** If a candidate model's license prevents commercial usage, introduces viral copyleft clauses applied to model outputs, or lacks clear supply chain provenance, all acquisition, screening, and conversion efforts are invalid. Public models must pass a strict compliance review before downloading.  
2. **Gate 2: Scalar Numerical Oracle Calibration.** Before any candidate output is generated or evaluated, the evaluator (oracle) must be calibrated against known baselines. If the evaluator is deemed too weak (Hypothesis 7), all untouched screening data (Gate 3\) is fundamentally invalid because the measurement instrument is compromised. Oracle validation must precede any architectural optimization.  
3. **Gate 3: Untouched Source Screening.** Source models must pass blind, zero-shot behavioral evaluation. If models like Llama-3.2-1B-Instruct or Qwen2.5-1.5B-Instruct fail the SPRT bounds for baseline helpfulness and safety29, downstream conversion (Gate 4\) is aborted. A new dense source must be nominated, or Hypothesis 2 (Distillation) is triggered.  
4. **Gate 4: Native Conversion and Quantization.** If a model passes screening but cannot be successfully converted to a native candle (safetensors) or burn (burnpack) format without numerical degradation, further architecture optimization is invalid10. Furthermore, if quantization (e.g., GGUF Q4\_K\_M) results in an unacceptable perplexity regression, the quantized artifact is discarded32.  
5. **Gate 5: Browser and WASM Feasibility.** The artifact must fit within the strict 4GB linear memory limit enforced by the 32-bit WebAssembly (wasm32) specification34. If the converted, quantized model exceeds this boundary and triggers an Out-Of-Memory (OOM) error, all browser, P2P, and external proof release phases are invalidated until a smaller model or lower precision tier is selected.

## **4\. Source-Candidate Funnel**

The source-candidate funnel governs the lifecycle of a model from discovery to production promotion, ensuring that no model bypasses objective evaluation criteria and that all artifacts remain cryptographically verifiable.

1. **Discovery & Immutable Revision Pinning:** Candidates are identified via public repositories. Upon selection, the repository evidence must be pinned to an immutable revision hash (e.g., the exact Git commit of HuggingFaceTB/SmolLM2-135M-Instruct or Qwen/Qwen2.5-1.5B-Instruct36). Floating tags like main are strictly forbidden.  
2. **License Review:** Verification of commercial viability and usage restrictions. The Apache 2.0 license of SmolLM2 passes unconditionally; the Llama 3.2 Community License requires specific compliance checks regarding user counts and acceptable use policies14.  
3. **Acquisition & Sandboxing:** Artifacts are downloaded via secure, programmatic pipelines (e.g., utilizing huggingface\_downloader with specific artifact isolation, explicitly excluding arbitrary remote code execution via trust\_remote\_code=False)38.  
4. **Untouched Screening:** The original artifact is evaluated using the preregistered SPRT plan against sealed prompts. No system prompt engineering or hyperparameter tuning is permitted at this stage.  
5. **Conversion:** The weights are mapped to Rust-native tensor formats. This includes translating PyTorch state dictionaries to safetensors for candle or compiling to burnpack via burn-onnx10.  
6. **Native Evaluation (Parity Check):** The converted model is evaluated in the Rust environment to ensure exact numerical parity with the original Python/PyTorch execution40. Logits must match within a predefined floating-point tolerance (e.g., ![][image2]).  
7. **Quantization:** The native model is quantized (e.g., INT4, GGUF/UQFF equivalents) to reduce the memory footprint and maximize memory bandwidth utilization33.  
8. **Browser Evaluation:** The quantized artifact is loaded into a WebAssembly or WebGPU environment (e.g., burn-wgpu or candle WASM) to verify execution under the 4GB memory limit and assess decode throughput10.  
9. **Promotion:** Artifacts successfully passing all gates are promoted to the production portfolio.

## **5\. Preregistered Behavioral and Statistical Plan**

Arbitrary round numbers for evaluation datasets introduce statistical inefficiencies and expose the campaign to p-hacking. This protocol relies exclusively on power, confidence, defect-prevalence, and the Sequential Probability Ratio Test (SPRT)2. Before candidate outputs are observed, the statistical methodology must be preregistered and justified.

### **Comparison of Sequential Decision Methods**

To justify the selection of SPRT, it must be compared against alternative statistical methodologies used in ML evaluation4:

* **Bayesian Updating:** While excellent for continuous learning and belief revision, standard Bayesian updating lacks hard, optimal stopping rules for operational deployment without setting arbitrary posterior thresholds. It does not inherently minimize the sample size for a fixed error rate.  
* **Confidence Intervals (Frequentist):** Traditional confidence intervals generally require large, fixed sample sizes determined *a priori*. This violates the need for compute efficiency, as it forces the evaluation of a full dataset even when a model's failure is obvious early in the test.  
* **Alpha Spending (Group Sequential):** Useful for clinical trials with fixed interim looks, but less adaptable than continuous, observation-by-observation sequential testing required for automated LLM evaluation.  
* **Expected Value of Information (EVOI):** Conceptually powerful for high-level resource allocation (determining *whether* to test), but computationally intensive to calculate continuously during a fast inference loop.  
* **Sequential Probability Ratio Test (SPRT):** SPRT is mathematically proven to minimize the expected sample size for a given error tolerance in binary classification (pass/fail). It is uniquely suited for LLM evaluation pipelines where each generation is computationally expensive2. SPRT is recommended for its understandability, strict error control, and compute efficiency.

### **SPRT Formulation and Parameters**

The campaign models the evaluation as a sequential hypothesis test of a Bernoulli parameter ![][image3], where ![][image3] is the probability of a successful, helpful, and safe response.

* **Null Hypothesis (![][image4]):** ![][image5] (Unacceptable baseline quality, e.g., ![][image6]).  
* **Alternative Hypothesis (![][image7]):** ![][image8] (Target production quality, e.g., ![][image9]).

The Type I error (![][image10]) is fixed at 0.05, and the Type II error (![][image11]) is fixed at 0.10. The cumulative log-likelihood ratio ![][image12] is computed after each response ![][image13]:  
![][image14]  
The evaluation terminates dynamically according to the thresholds ![][image15] and ![][image16]:

* ![][image17]  
* ![][image18]

If ![][image19], the model is rejected. If ![][image20], the model is accepted4.

### **Preregistered Policy**

* **Behavioral Invariants:** The model must unconditionally refuse tasks violating safety guidelines while successfully executing formatting instructions (e.g., strict JSON output)37.  
* **Critical Failures:** Any instance of out-of-vocabulary (OOV) token generation, infinite repetition loops, or severe hallucinations results in an immediate failure (![][image21]), heavily penalizing the SPRT score19.  
* **Ordinary-Helpfulness Regression Budgets:** A baseline model (e.g., unquantized SmolLM2) is established. A quantized student may suffer a maximum 5% regression in ordinary helpfulness; any drop beyond this shifts the parameter ![][image3] below ![][image22].  
* **Stochastic Seed Policy:** All inference must utilize a fixed, preregistered seed for reproducibility. Temperature must be fixed (e.g., ![][image23] for deterministic reasoning tasks)37.  
* **Human Adjudication:** Human review is only triggered if the SPRT hits the maximum predefined sample cap (![][image24]) without crossing a boundary.

## **6\. Minimum Hybrid-Runtime Experiment**

To justify pivoting engineering resources toward a hybrid architecture (e.g., Mamba-Transformer combinations), the expected value of the investment must out-weigh the deterministic costs of integration. The minimum experiment requires the following strictly sequenced gates to reject or justify the investment:

1. **Exact Source Quality:** Identify an open-weights hybrid model. For instance, a variant of Qwen3.5 alternating standard GQA and Gated DeltaNet (a Mamba-family SSM variant)20, or the Mamba-3 SISO architecture21.  
2. **License and Documentation:** Verify the license permits deployment and that operator documentation explicitly defines the state-space tensor layouts and sequence memory mechanisms.  
3. **Scalar Oracle:** The evaluator must successfully rank known baseline transformers to prove its discriminatory power prior to testing the hybrid.  
4. **Native Parity Gate:** Integrate the hybrid runtime into a Rust backend (e.g., extending mamba-rs or implementing custom candle kernels)21. A forward pass using identical seeds must yield bit-for-bit numerical parity with the reference Python implementation, validating that the recurrent SSM state and block layouts are correctly parsed42.  
5. **Measured Advantage Gate:** The native hybrid must demonstrate a statistically significant operational advantage. It must achieve a reduction in prefill latency or a \>30% reduction in KV-cache memory overhead compared to a pure transformer of equivalent parameter size on identical hardware. Failure to exceed this threshold automatically rejects the hybrid investment.

## **7\. Minimum Dense-Distillation Experiment**

If dense distillation (Hypothesis 2\) is hypothesized to be the optimal path, a precise experiment must validate the capability transfer without succumbing to exposure bias. Traditional offline supervised fine-tuning (SFT) forces the student to memorize flawless prefixes, which leads to compounding errors during autoregressive inference16.

1. **Teacher Screening:** A large reasoning model (e.g., Qwen2.5-72B-Instruct) must pass the untouched SPRT screen at a highly stringent threshold (![][image25])44. The teacher must be capable of generating explicit intermediate reasoning steps (Chain-of-Thought)46.  
2. **Data Review:** A curated subset of highly diverse prompt sequences must be evaluated to ensure gradient diversity and prevent mode collapse48.  
3. **Sequence-Distillation Pilot:** Train a small student (e.g., a 135M or 360M architecture) using On-Policy Distillation (OPD). In OPD, the teacher provides dynamic feedback on the *student-generated* trajectories to correct distribution shifts, framing distillation as an iterative correction process rather than a single-pass imitation16.  
4. **Temperature Scaling and KL Divergence:** The distillation loss must utilize a temperature scaling factor (![][image26]) to smooth the teacher's logits, exposing the secondary token probability distributions ("dark knowledge") and redistributing probability mass17. The experiment must monitor the Forward KL (FKL) and Reverse KL (RKL) divergences, as temperature scaling heavily influences their behavior, shifting them toward logit matching17.  
5. **Sealed Holdouts & Stop Rule:** The student is evaluated on a completely sealed holdout set. If the student fails to improve its objective performance metric (measured via the scalar oracle) by a margin greater than the baseline variance after a predefined number of update steps, the no-improvement stop rule is triggered, and the distillation investment is abandoned.

## **8\. Minimum External-Backend Experiment**

Integrating an external backend like llama.cpp against a purely native solution (like candle or burn) involves severe trade-offs regarding dependency management, security, and portability boundaries10.

1. **Portability and Binary Boundaries:** Determine the computational overhead of Foreign Function Interface (FFI) calls between the Rust application layer and the external C++ backend.  
2. **Deterministic Conformance:** The external backend must produce strictly deterministic outputs given a fixed seed, identical temperature settings, and identical prompts22. Any non-determinism introduced by multi-threading or hardware-specific SIMD instructions invalidates the backend.  
3. **Browser Feasibility (WASM Limit):** The backend must compile to WebAssembly without requiring specialized, non-standard browser flags. Crucially, the runtime must respect the 4GB linear memory constraints of wasm3234. While WebGPU can accelerate inference, the initial weights and intermediate structures must pass through WASM memory. If the backend cannot efficiently stream weights or relies on massive static allocations that breach the 4GB limit, it fails browser feasibility26.  
4. **Sandboxing and Supply Chain:** The external dependencies must not introduce un-auditable pre-compiled binaries or circumvent Rust's memory safety guarantees unnecessarily.  
5. **Update Burden and Fallback:** Assess the engineering hours required to track upstream changes (e.g., new GGUF versions or kernel modifications). If tracking upstream requires \>20 hours per month of maintenance, the external backend is rejected in favor of a maintained native solution with an established fallback strategy.

## **9\. Resource and Value-of-Information Model**

The allocation of finite resources must be quantified using the Expected Value of Information (EVPI) and Expected Value of Sample Information (EVSI)12. The framework must balance the cost of acquiring information (running evaluations) against the potential utility gained.

### **EVPI Calculation**

The Expected Value of Perfect Information represents the upper bound on the value of gathering more data before making a decision:  
![][image27]  
Where ![][image28] represents the set of architectural decisions (e.g., adopt SmolLM2, distill a custom model), ![][image29] represents the true underlying capability of the architecture, and ![][image30] represents the operational utility.

### **Resource Variables**

| Resource | Variable | Constraint / Budget |
| :---- | :---- | :---- |
| **Researcher Hours** | **![][image31]** | Maximum 200 hours per architectural experiment to prevent sunk-cost traps. |
| **Reviewer Hours** | **![][image32]** | Maximum 40 hours for human adjudication of SPRT edge cases. |
| **CPU Hours** | **![][image33]** | Tracked for continuous integration and WASM compilation pipelines. |
| **GPU Hours** | **![][image34]** | Constrained by local cluster availability; reserved exclusively for OPD training or heavy native evaluation. |
| **System RAM** | **![][image35]** | Maximum 16GB for edge deployment targets. |
| **VRAM** | **![][image36]** | Maximum 24GB for standard local inference targets; \>80GB reserved for 72B teacher models41. |
| **WASM Memory** | **![][image37]** | Hard limit of 4GB for browser inference34. |
| **Storage / Network** | **![][image38]** | Bandwidth limits for downloading raw checkpoint shards. |
| **Artifact Count** | **![][image39]** | Exactly 20 distinct useful artifacts (across architectures, quantizations, and modalities). |
| **Recurring Maintenance** | **![][image40]** | Hours per month required to maintain kernels and framework updates. |

If the calculated EVSI for running an additional evaluation batch is lower than the computational and time cost of that batch, sampling terminates immediately, and the current Bayesian posterior dictates the decision57.

## **10\. Stop, Retry, Rollback, and Escalation Rules**

Robust decision systems require strict criteria to halt unproductive efforts and manage failures gracefully.

* **Stop Rules:**  
  * **Quality Failure:** If ![][image19] in the SPRT evaluation, the candidate is permanently rejected.  
  * **Browser OOM:** If an artifact requires \>4GB of memory during WebAssembly execution, development stops immediately and rolls back to a lower-parameter source or a more aggressive quantization compression26.  
  * **Contamination / License Ambiguity:** Discovery of benchmark data in the training corpus, or proprietary restrictions (e.g., "non-commercial only"), triggers an immediate halt and rollback to the discovery phase.  
  * **Evaluator Defect:** If the evaluator assigns identical scores to structurally divergent responses, all testing pauses until the oracle is debugged.  
  * **Numerical Mismatch:** If conversion yields logits outside the ![][image2] tolerance, the conversion is halted.  
* **Retry Rules:** Under no circumstances will the system test new seeds, templates, temperatures, or postprocessors until a preferred answer appears. A declared product sampling policy (e.g., fixed ![][image23]) must be established prior to inference. This must be strictly distinguished from best-of-N cherry-picking, which artificially inflates perceived model capabilities and leaks oracle knowledge into the evaluation14. The first valid output generated under the declared policy must be the one recorded.  
* **Escalation Rules:** If the SPRT test reaches the maximum predefined sample size (![][image24]) without crossing boundary ![][image15] or ![][image16], the system enters an escalation state. This requires human adjudication by the principal research director to either widen the indifference region or manually inspect the evaluation traces to determine the model's viability.

## **11\. Content-Addressed Evidence Design**

To ensure that all release phases (acquisition, source screen, training, conversion, evaluation, quantization, browser, memory, P2P, and publication) remain cryptographically verifiable and independently validated, the campaign utilizes a content-addressed evidence graph.

* Every input prompt, configuration file, and raw model weight file is hashed (e.g., SHA-256).  
* The results of any transformation (conversion to safetensors, quantization to Q4\_K\_M) or evaluation (SPRT traces, KL divergence logs) are stored in a Merkle Directed Acyclic Graph (DAG).  
* If a source model's upstream repository updates, or if a single evaluation prompt is modified, the root hash changes. This inherently and automatically invalidates all downstream receipts connected to the old hash.  
* No mock data, assumed capabilities, or un-executed cross-compilations can masquerade as live hardware evidence. The cryptographic receipt requires the localized execution signature, ensuring that browser, memory, and P2P evidence are separate, proven release phases that cannot be inferred solely from model quality scores.

## **12\. Routes to 1, 5, and 20 Useful Artifacts**

The model portfolio must expand systematically, ensuring meaningful behavioral and operational diversity without relying on catalog theater (e.g., merely renaming an artifact or slightly tweaking a chat template). Quality thresholds remain rigidly enforced across all stages.

### **Route to 1 Artifact**

* **Target:** A highly capable, extremely lightweight text model for fundamental WASM deployment.  
* **Selection:** HuggingFaceTB/SmolLM2-135M-Instruct converted to a 4-bit quantized format (e.g., Q4\_K\_M)32.  
* **Rationale:** This artifact easily circumvents the 4GB WebAssembly memory limit while providing robust instruction-following and reasoning, establishing the baseline pipeline for native Rust integration34.

### **Route to 5 Artifacts**

* **Target:** Establish a multi-tiered text reasoning baseline offering trade-offs between latency and capability.  
* **Selections:**  
  1. SmolLM2-135M-Instruct (Q4\_K\_M)32  
  2. SmolLM2-360M-Instruct (Q4\_K\_M)32  
  3. Qwen2.5-1.5B-Instruct (FP16) \- For server-side high-precision reasoning30.  
  4. Qwen2.5-1.5B-Instruct (Q8\_0) \- Balanced quantization for edge devices.  
  5. Llama-3.2-1B-Instruct (Q4\_K\_M) \- To introduce distinct training corpora and vocabulary diversity59.  
* **Rationale:** These artifacts represent distinct parameter classes, varied training corpora (HuggingFace, Alibaba, Meta), and different precision tiers.

### **Route to 20 Artifacts**

* **Target:** Full multimodal, architectural, and precision diversity to cover all edge and server use-cases.  
* **Selections:**  
  * Expand the matrix to include vision-language models (e.g., Qwen2.5-VL-3B-Instruct, Llama-3.2-11B-Vision-Instruct) to fulfill multimodal requirements44.  
  * Introduce distinct architectures such as the Mamba or Mamba-3 SISO variants for specialized long-context processing10.  
  * Incorporate varying precision levels (e.g., BF16, INT8, INT4) across backend-specific serializations (safetensors for candle, burnpack for burn)10.  
  * Incorporate specialized, independently trained checkpoints (e.g., code-specific or math-specific variants).  
* **Rationale:** Each variant must pass independent evaluation to ensure it provides a distinct, measurable operational utility. Lowering quality thresholds just to hit the 20-artifact target is explicitly forbidden.

## **13\. Operator Decision Worksheet**

*Note: This worksheet allows operators to execute the decision flow objectively and sequentially without accessing sealed prompts or leaking proprietary data into reports.*  
**Phase 1: Nomination & License**

* \[ \] Candidate Model ID: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
* \[ \] Immutable Commit Hash: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
* \[ \] License Type: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
* \[ \] License Cleared for Commercial/Edge Use: \[ \] Pass \[ \] Fail  
* \[ \] Parameter Count: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Phase 2: SPRT Behavioral Screen (Untouched)**

* \[ \] ![][image22] (Baseline): \_\_\_\_ | ![][image41] (Target): \_\_\_\_ | ![][image10]: \_\_\_\_ | ![][image11]: \_\_\_\_  
* \[ \] Threshold A: \_\_\_\_ | Threshold B: \_\_\_\_  
* \[ \] Max Samples (![][image24]): \_\_\_\_  
* \[ \] Final ![][image12] Score: \_\_\_\_  
* \[ \] Result: \[ \] Accept (![][image20]) \[ \] Reject (![][image19]) \[ \] Escalate (Max samples reached)

**Phase 3: Conversion & Native Parity**

* \[ \] Converted Format: \[ \] safetensors \[ \] burnpack \[ \] GGUF  
* \[ \] Parity Check: Do logits match Python reference within ![][image2] tolerance? \[ \] Pass \[ \] Fail  
* \[ \] Quantized Size (GB): \_\_\_\_ (Must be \< 4.0GB for WASM execution)35

**Phase 4: Strategic Branching & Rollback**

* \[ \] If candidate fails Phase 2, is the calculated EVPI of Distillation \> Cost of Training? \[ \] Yes \[ \] No  
* \[ \] If candidate causes OOM in Phase 3, trigger Rollback Rule 2 (Higher Quantization / Smaller Model).

## **14\. Unknowns Requiring Local or Authorized Access**

Several variables critical to the final execution of this campaign cannot be resolved via public research and require authorized access to local hardware and sealed infrastructure:

* **Evaluator Prompt Definitions:** The exact phrasing, edge-cases, and systemic traps designed to test model safety and reasoning are sealed to prevent data contamination62. Exposure of these prompts would invalidate the SPRT screening.  
* **Precise Local Hardware Topologies:** Internal memory bandwidth constraints, specific GPU interconnect architectures (e.g., NVLink vs standard PCIe), and available local cluster VRAM dictate the exact bounds of the ![][image34] and ![][image36] variables. Public models cannot infer local network transfer speeds.  
* **Proprietary Fine-Tuning Corpora:** The statistical distribution, token-count, and semantic diversity of private domain-specific data used to evaluate Hypothesis 6 (Data quality limits).  
* **Private Credentials:** Access tokens required for downloading gated models or publishing to internal artifact registries.

## **15\. Annotated Primary-Source Bibliography with Dates**

*The following primary sources and framework documentation were accessed, reviewed, and integrated into this campaign design (Retrieval Date: July 15, 2026):*

1. **Qwen Team (2024-2025).** *Qwen2.5 Models (1.5B, 7B, 72B, VL).* Hugging Face Repositories & Blogs.8.  
   * *Annotation:* Details the capabilities of the Qwen2.5 architecture, emphasizing context length (32k-128k), JSON structured outputs, and lightweight deployment footprints, which is crucial for evaluating Hypothesis 1\.  
2. **HuggingFaceTB (Feb 2025).** *SmolLM2 (135M, 360M, 1.7B).* Hugging Face Repositories & ArXiv (2502.02737).9.  
   * *Annotation:* Documents a state-of-the-art on-device model family trained on 2T-11T tokens. Provides the optimal foundation for the Route to 1 Artifact via WASM deployments due to its minimal memory footprint.  
3. **Meta (Sept 2024 \- 2025).** *Llama 3.2 Collection (1B, 3B, 11B Vision).* Hugging Face Repositories & Databricks Blog.14.  
   * *Annotation:* Provides insights into Llama 3.2's multilingual optimizations and restrictive community licensing, directly informing the License Review gate and portfolio expansion.  
4. **Wald, A. (1945).** *Sequential Tests of Statistical Hypotheses.* Annals of Mathematical Statistics.2.  
   * *Annotation:* The foundational mathematical texts defining the Sequential Probability Ratio Test (SPRT), establishing the log-likelihood ratio bounds (![][image15] and ![][image16]) utilized in the behavioral screening protocol.  
5. **Howard, R. A. (1966).** *Information Value Theory.* IEEE Transactions on Systems Science and Cybernetics.12.  
   * *Annotation:* Establishes the formulas for the Expected Value of Perfect Information (EVPI), enabling rigorous cost-benefit analysis for the Resource Model and sequential testing.  
6. **Agarwal et al. (2024).** *On-Policy Distillation (OPD) and Sequence-Level Distillation.*16.  
   * *Annotation:* Analyzes exposure bias in sequence-level distillation and introduces temperature scaling to smooth teacher distributions, forming the baseline for the Minimum Dense-Distillation Experiment.  
7. **Chrome Developers / V8 Engine (2024).** *Up to 4GB of memory in WebAssembly.*26.  
   * *Annotation:* Confirms the strict 4GB linear memory limits of 32-bit WebAssembly pointers (wasm32), dictating the absolute upper bound for browser-based artifact quantization and execution (Gate 5).  
8. **Tracel AI & Hugging Face (2024-2026).** *Burn and Candle Frameworks.* GitHub Repositories.10.  
   * *Annotation:* Details the Rust-native ML ecosystem, contrasting candle's direct kernel approach with burn's backend-agnostic WGPU/CubeCL capabilities, crucial for the Native Conversion and Browser Evaluation phases.  
9. **Gu & Dao (2024) / Lahoti et al. (2026).** *Mamba SSM & Mamba-3 SISO.* ICLR Publications & GitHub Repositories.20.  
   * *Annotation:* Documents State Space Models, their linear-time sequence modeling, and their integration into Rust (mamba-rs), defining the parameters for the Minimum Hybrid-Runtime Experiment.

#### **Works cited**

1. Asymptotically Optimal Sequential Testing with Heterogeneous LLMs \- arXiv, [https://arxiv.org/html/2604.01086v1](https://arxiv.org/html/2604.01086v1)  
2. ConSol: Sequential Probability Ratio Testing to Find Consistent LLM Reasoning Paths Efficiently \- arXiv, [https://arxiv.org/html/2503.17587v1](https://arxiv.org/html/2503.17587v1)  
3. consol: sequential probability ratio testing to find consistent llm reasoning paths efficiently \- arXiv, [https://arxiv.org/pdf/2503.17587](https://arxiv.org/pdf/2503.17587)  
4. Sequential Probability Ratio Test (SPRT) \- Emergent Mind, [https://www.emergentmind.com/topics/sequential-probability-ratio-test-sprt](https://www.emergentmind.com/topics/sequential-probability-ratio-test-sprt)  
5. Sequential probability ratio test \- Wikipedia, [https://en.wikipedia.org/wiki/Sequential\_probability\_ratio\_test](https://en.wikipedia.org/wiki/Sequential_probability_ratio_test)  
6. A Modified Sequential Probability Ratio Test \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC9053723/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9053723/)  
7. A Simple Geometric Proof of the Optimality of the Sequential Probability Ratio Test for Symmetric Bernoulli Hypotheses \- arXiv, [https://arxiv.org/html/2510.15790v1](https://arxiv.org/html/2510.15790v1)  
8. Qwen/Qwen2.5-VL-7B-Instruct \- Hugging Face, [https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct)  
9. HuggingFaceTB/SmolLM2-135M · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M)  
10. huggingface/candle: Minimalist ML framework for Rust \- GitHub, [https://github.com/huggingface/candle](https://github.com/huggingface/candle)  
11. GitHub \- tracel-ai/burn-onnx: Convert ONNX models into native, backend-agnostic Burn code for inference and fine-tuning., [https://github.com/tracel-ai/burn-onnx](https://github.com/tracel-ai/burn-onnx)  
12. Expected value of information \-- EVI, EVPI, and ESVI \- Analytica Docs, [https://docs.analytica.com/index.php/Expected\_value\_of\_information\_--\_EVI,\_EVPI,\_and\_ESVI](https://docs.analytica.com/index.php/Expected_value_of_information_--_EVI,_EVPI,_and_ESVI)  
13. Expected value of perfect information \- Grokipedia, [https://grokipedia.com/page/Expected\_value\_of\_perfect\_information](https://grokipedia.com/page/Expected_value_of_perfect_information)  
14. meta-llama/Llama-3.2-1B \- Hugging Face, [https://huggingface.co/meta-llama/Llama-3.2-1B](https://huggingface.co/meta-llama/Llama-3.2-1B)  
15. meta-llama/Llama-3.2-1B-Instruct \- Hugging Face, [https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)  
16. A Survey of On-Policy Distillation for Large Language Models \- arXiv, [https://arxiv.org/html/2604.00626v3](https://arxiv.org/html/2604.00626v3)  
17. Rethinking the Role of Temperature in Large Language Model Distillation \- arXiv, [https://arxiv.org/html/2606.00306v1](https://arxiv.org/html/2606.00306v1)  
18. LLM Distillation Explained \- Adaline AI, [https://www.adaline.ai/blog/llm-distillation-explained](https://www.adaline.ai/blog/llm-distillation-explained)  
19. \[Bug\]: Qwen/Qwen2.5-1.5B-Instruct generates out of vocabulary tokens \#13175 \- GitHub, [https://github.com/vllm-project/vllm/issues/13175](https://github.com/vllm-project/vllm/issues/13175)  
20. Implemented Qwen3.5's hybrid Mamba-Transformer architecture from scratch (Rust, no ML framework) \- writeup on what broke and why : r/learnmachinelearning \- Reddit, [https://www.reddit.com/r/learnmachinelearning/comments/1uw0nf3/implemented\_qwen35s\_hybrid\_mambatransformer/](https://www.reddit.com/r/learnmachinelearning/comments/1uw0nf3/implemented_qwen35s_hybrid_mambatransformer/)  
21. mamba\_rs \- Rust \- Docs.rs, [https://docs.rs/mamba-rs](https://docs.rs/mamba-rs)  
22. mamba-rs \- crates.io: Rust Package Registry, [https://crates.io/crates/mamba-rs](https://crates.io/crates/mamba-rs)  
23. Bug: LLAMA\_MAX\_NODES must be increased to run 405B Mega merge · Issue \#8615 · ggml-org/llama.cpp \- GitHub, [https://github.com/ggerganov/llama.cpp/issues/8615](https://github.com/ggerganov/llama.cpp/issues/8615)  
24. ggml-org/llama.cpp at unremarkable.ai \- GitHub, [https://github.com/ggerganov/llama.cpp?ref=unremarkable.ai](https://github.com/ggerganov/llama.cpp?ref=unremarkable.ai)  
25. burn/crates/burn-wgpu/README.md at main · tracel-ai/burn \- GitHub, [https://github.com/tracel-ai/burn/blob/main/crates/burn-wgpu/README.md](https://github.com/tracel-ai/burn/blob/main/crates/burn-wgpu/README.md)  
26. Llamas on the Web: Memory-Efficient, Performance-Portable, and Multi-Precision LLM Inference with WebGPU \- arXiv, [https://arxiv.org/html/2605.20706v1](https://arxiv.org/html/2605.20706v1)  
27. Internalize the Temperature: On-Policy Self-Distillation as Policy Reheater for Reinforcement Learning \- arXiv, [https://arxiv.org/html/2606.00755v1](https://arxiv.org/html/2606.00755v1)  
28. SEQUENTIAL CONSENSUS BUILDING FOR MULTI-AGENT DEBATES \- Technical Disclosure Commons, [https://www.tdcommons.org/cgi/viewcontent.cgi?article=9892\&context=dpubs\_series](https://www.tdcommons.org/cgi/viewcontent.cgi?article=9892&context=dpubs_series)  
29. Llama Models — NVIDIA NeMo Platform Documentation, [https://docs.nvidia.com/nemo/microservices/26.3.1/customizer/models/llama.html](https://docs.nvidia.com/nemo/microservices/26.3.1/customizer/models/llama.html)  
30. Qwen/Qwen2.5-1.5B-Instruct \- Hugging Face, [https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)  
31. flawedmatrix/mamba-ssm: Implementation of mamba with rust \- GitHub, [https://github.com/flawedmatrix/mamba-ssm](https://github.com/flawedmatrix/mamba-ssm)  
32. unsloth/SmolLM2-360M-Instruct-GGUF \- Hugging Face, [https://huggingface.co/unsloth/SmolLM2-360M-Instruct-GGUF](https://huggingface.co/unsloth/SmolLM2-360M-Instruct-GGUF)  
33. fast multi-backend (CPU/CUDA/Metal/ROCm/Vulkan) tensor & ML framework for Rust with quantization; the compute core of the Hanzo stack. \- GitHub, [https://github.com/hanzoai/ml](https://github.com/hanzoai/ml)  
34. Up to 4GB of memory in WebAssembly \- V8 JavaScript engine, [https://v8.dev/blog/4gb-wasm-memory](https://v8.dev/blog/4gb-wasm-memory)  
35. WebAssembly and WebGPU enhancements for faster Web AI, part 1 | Blog | Chrome for Developers, [https://developer.chrome.com/blog/io24-webassembly-webgpu-1](https://developer.chrome.com/blog/io24-webassembly-webgpu-1)  
36. HuggingFaceTB/SmolLM2-135M-Instruct · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct)  
37. Qwen2.5-1.5B \+ FEW-SHOT LEARN w/GPU \- Kaggle, [https://www.kaggle.com/code/stpeteishii/qwen2-5-1-5b-few-shot-learn-w-gpu](https://www.kaggle.com/code/stpeteishii/qwen2-5-1-5b-few-shot-learn-w-gpu)  
38. Training Configuration — Oumi OSS, [https://oumi.ai/docs/en/latest/user\_guides/train/configuration.html](https://oumi.ai/docs/en/latest/user_guides/train/configuration.html)  
39. huggingface\_downloader | Dart package \- Pub.dev, [https://pub.dev/packages/huggingface\_downloader](https://pub.dev/packages/huggingface_downloader)  
40. Is \`llm\` still necessary, and should development still continue? · rustformers llm · Discussion \#435 \- GitHub, [https://github.com/rustformers/llm/discussions/435](https://github.com/rustformers/llm/discussions/435)  
41. GitHub \- EricLBuehler/mistral.rs: Fast, flexible LLM inference, [https://github.com/ericlbuehler/mistral.rs](https://github.com/ericlbuehler/mistral.rs)  
42. SamuelMarks/onnx9000: ONNX training & inference; browser-native; intended to produce WASM and WebGPU \- GitHub, [https://github.com/SamuelMarks/onnx9000](https://github.com/SamuelMarks/onnx9000)  
43. mamba-rs \- crates.io: Rust Package Registry, [https://crates.io/crates/mamba-rs/security](https://crates.io/crates/mamba-rs/security)  
44. Qwen/Qwen2.5-VL-72B-Instruct · official finetune example? \- Hugging Face, [https://huggingface.co/Qwen/Qwen2.5-VL-72B-Instruct/discussions/16](https://huggingface.co/Qwen/Qwen2.5-VL-72B-Instruct/discussions/16)  
45. Compatible Alibaba Models \- Oracle Help Center, [https://docs.oracle.com/iaas/Content/generative-ai/imported-alibaba-models.htm](https://docs.oracle.com/iaas/Content/generative-ai/imported-alibaba-models.htm)  
46. Distilling the Essence: Efficient Reasoning Distillation via Sequence Truncation \- arXiv, [https://arxiv.org/html/2512.21002v3](https://arxiv.org/html/2512.21002v3)  
47. Distilling the Essence: Efficient Reasoning Distillation via Sequence Truncation \- ACL Anthology, [https://aclanthology.org/2026.findings-acl.587.pdf](https://aclanthology.org/2026.findings-acl.587.pdf)  
48. Distribution-Aligned Sequence Distillation for Superior Long-CoT Reasoning, [https://www.semanticscholar.org/paper/Distribution-Aligned-Sequence-Distillation-for-Yan-Liu/f9b9cee00fd0000d653110fe9127caae4e9d28aa](https://www.semanticscholar.org/paper/Distribution-Aligned-Sequence-Distillation-for-Yan-Liu/f9b9cee00fd0000d653110fe9127caae4e9d28aa)  
49. Aman's AI Journal • Primers • Knowledge Distillation, [https://aman.ai/primers/ai/knowledge-distillation/](https://aman.ai/primers/ai/knowledge-distillation/)  
50. Knowledge Distillation & Pruning | AI Knowledge Hub \- Tech Jacks Solutions, [https://techjacksolutions.com/ai-knowledge-hub/knowledge-distillation-and-pruning/](https://techjacksolutions.com/ai-knowledge-hub/knowledge-distillation-and-pruning/)  
51. Optimal Knowledge Distillation through Non-Heuristic Control of Dark Knowledge \- MDPI, [https://www.mdpi.com/2504-4990/6/3/94](https://www.mdpi.com/2504-4990/6/3/94)  
52. BOS always has the highest probability in logits? · ggml-org llama.cpp · Discussion \#4264, [https://github.com/ggerganov/llama.cpp/discussions/4264](https://github.com/ggerganov/llama.cpp/discussions/4264)  
53. Unlocking 7B+ language models in your browser: A deep dive with Google AI Edge's MediaPipe, [https://research.google/blog/unlocking-7b-language-models-in-your-browser-a-deep-dive-with-google-ai-edges-mediapipe/](https://research.google/blog/unlocking-7b-language-models-in-your-browser-a-deep-dive-with-google-ai-edges-mediapipe/)  
54. Learning to Ask Good Questions: Ranking Clarification Questions using Neural Expected Value of Perfect Information | Request PDF \- ResearchGate, [https://www.researchgate.net/publication/334116419\_Learning\_to\_Ask\_Good\_Questions\_Ranking\_Clarification\_Questions\_using\_Neural\_Expected\_Value\_of\_Perfect\_Information](https://www.researchgate.net/publication/334116419_Learning_to_Ask_Good_Questions_Ranking_Clarification_Questions_using_Neural_Expected_Value_of_Perfect_Information)  
55. Model-Free Preference Elicitation \- IJCAI, [https://www.ijcai.org/proceedings/2024/0387.pdf](https://www.ijcai.org/proceedings/2024/0387.pdf)  
56. Statistica Sinica Preprint No: SS-2024-0334, [https://www3.stat.sinica.edu.tw/ss\_newpaper/SS-2024-0334\_na.pdf](https://www3.stat.sinica.edu.tw/ss_newpaper/SS-2024-0334_na.pdf)  
57. Estimating the Expected Value of Sample Information Using the Probabilistic Sensitivity Analysis Sample: A Fast, Nonparametric Regression-Based Method \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC4471064/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4471064/)  
58. Calculating the Expected Value of Sample Information in Practice: Considerations from Three Case Studies \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC7968749/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7968749/)  
59. Models with LICENSE:LLAMA3.2 license \- Hugging Face, [https://huggingface.co/models?license=license%3Allama3.2](https://huggingface.co/models?license=license:llama3.2)  
60. unsloth/Llama-3.2-1B-Instruct-GGUF \- Hugging Face, [https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF)  
61. Introducing Meta Llama 3.2 on Databricks: faster language models and powerful multi-modal models, [https://www.databricks.com/blog/introducing-meta-llama-32-databricks-faster-language-models-and-powerful-multi-modal-models](https://www.databricks.com/blog/introducing-meta-llama-32-databricks-faster-language-models-and-powerful-multi-modal-models)  
62. Distribution-Aligned Sequence Distillation for Superior Long-CoT Reasoning \[Quick Review\], [https://liner.com/review/distributionaligned-sequence-distillation-for-superior-longcot-reasoning](https://liner.com/review/distributionaligned-sequence-distillation-for-superior-longcot-reasoning)  
63. AMiD: Knowledge Distillation for LLMs with 𝛼-mixture Assistant Distribution \- arXiv, [https://arxiv.org/html/2510.15982v2](https://arxiv.org/html/2510.15982v2)  
64. HuggingFaceTB/SmolLM2-1.7B · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B)  
65. HuggingFaceTB/SmolLM2-1.7B-Instruct · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct)  
66. unsloth/Llama-3.2-1B \- Hugging Face, [https://huggingface.co/unsloth/Llama-3.2-1B](https://huggingface.co/unsloth/Llama-3.2-1B)  
67. mukel/Llama-3.2-1B-Instruct-GGUF \- Hugging Face, [https://huggingface.co/mukel/Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/mukel/Llama-3.2-1B-Instruct-GGUF)  
68. A Graph-Theoretic Analysis of Information Value \- Microsoft, [https://www.microsoft.com/en-us/research/wp-content/uploads/1996/01/gev.pdf](https://www.microsoft.com/en-us/research/wp-content/uploads/1996/01/gev.pdf)  
69. Rust & AI Weekly \#2: a P2P 1.0, agents that out-benchmark Python, and Rust creeping onto the GPU | Decebal Dobrica, [https://decebaldobrica.com/blog/2026-06-22-rust-ai-weekly-2](https://decebaldobrica.com/blog/2026-06-22-rust-ai-weekly-2)  
70. New burn-wgpu backend · Issue \#243 · tracel-ai/burn \- GitHub, [https://github.com/tracel-ai/burn/issues/243](https://github.com/tracel-ai/burn/issues/243)  
71. candle\_transformers::models \- Rust \- Docs.rs, [https://docs.rs/candle-transformers/latest/candle\_transformers/models/index.html](https://docs.rs/candle-transformers/latest/candle_transformers/models/index.html)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAXCAYAAABnGz2mAAACFUlEQVR4XuXWP0hVURwH8J9oomg0FJhZpAVBUBTUEtWmoEMQ0aDk7tLgH0odGkKaIwfpH0VBCCo0GWEOomOzNTkEOoqTYJN9v+98f6/rfe88bo8bPPALH9Bz7z3nd88757xndkhSB0eFf2fJEWhJN+ad/14YO70gj2EG7kOzlAufeQh3JWtY2BO4mr6QTicswYQcgyYYhe9y1m9O5Da8gAbxcOCb8hnaE9c8Z+ATHJeSXIcf0J2+YGGw2QQf3GeRHV9Sm4ezwNl+Jb+sfGHMuIUZp2JOy0+YtPj64MO0AW1quyELFv+Y70ilwq7BV+GnVEhNFsYipmQTuoq3lsYL24HLauPao2d+U5lkKewErMkVNvDNOVPEdRKbLba/l+QAH2RI/5dLlsJ4ZHDTUR8bOIW7wjePhW+0LosWdio3AD9C4sCxZCmM8Zcs9FWzhXHh/pZKnd+DPelRG6d/WSo9W1VhF2FbHiRuSoa7ZBVeCw9Nz4HOIslSWJ2FNU6FvjjIXEJyUIZHwFuYt1Bg8YxRpoW7NZYshbXCF7nljSflG7zThUFh2wDU+82p9MtHK93RnfAStmTfwlfaIwtrlDw8R1ekwxtrtjAPOz5l4Rw5L7GCPF3CE9u/DapJLzyX9AtWFXZCTy3MXDXhun5j4eiiXMNNwV8S/r37L+FRNGx/XzL3sKAxaUxdi+UcjFjpaZBraraw3PIHfYqFY0+36UMAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAbCAYAAAD/G5bjAAABOElEQVR4Xu3VTytEURzG8Z9QNKMUJWUhk40V5QVIirWdP2lQQ7GwkY2yxs6GbJSdFyAlaWysbCyUd+EVKM/TeWQOc3TiTjO3zrc+mzlnZn733rl3zFI/moalGnP+cnNr6eHW4AIWpdtfrt8AHMDO94WMm4JB6JVgXbArx/AKe96O7Cubu5TLsuWtBipC1f4+XMXc++uZFVaANhiSG+jXWrBcD8cPpDE4kpLExt/1A4zCiNzaP4frhFM5N3eH8Ud9JjwbMXXAKkzAvsx7OwL9NtwmvAiPvh0W4FB4RmPj3j5z30dR5XI4XrI7eBJe1hOYMTckNbzQcDzKZ9iQphQajg/qa/v6L/yMZ5QPUOqpeT3T1uUe3uENrmRceybhUVZgGy5hWBpWSw8XG591xLs1+i5LpVKpVA77APDRTGTFW/boAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAbCAYAAABFuB6DAAAAsElEQVR4Xu3PsQpBYRjG8U9SEiJ3oCQLiUswWwwGZbVTisuwGGUwuAUT2UwyYuY2/N/jOZ2jDEfZeOq3vO/71fc498+3EkcfE8mig5k0/cMWuljKCVUUZIO6HQ5QwlZ6NiQZ2WP40aGlgrPUNCvK3QWPXRsHyYdm5oayZl67lcSQwFrGmrm0e/5tJyPMMRV75CXyoRW5oCE5JP1lOH4RK+EXeZsjrlhI6nUdJPLh7+UBpIMqhiFdV0gAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAbCAYAAACJISRoAAABQklEQVR4Xu3UQSsFURgG4E8o5Sok3ChlZ+1X2FjZoJTuykJZ+gNWFspSCckCGz/BSsnCL7CUhYWyVOJ9O+9373fPhrl3mtW89XTnnnOab+Z8M2NWp8cMyjQ0Mw0YhhmJcyPyr0zKGjzDi2zBAszBtrzCg9ZOSaFMwBMcSMyivMFmNlcoy/AJqxLjY5znup5TSRFuA7fDtybmWLid3NbCGZAzeNcvncippeLEca4tHF5ZbHoeb3hfTa+kCBsZm57HG543fVb2Yc/+eGd4dbHpeXh3vMvY9CE4En9QeMxx6oo3nO4tfUZi+J/jvsabzs/KhXDNGFxpnNpZgUf4li84t853qmXp6n/gQw5h1NK23QmL0C0sSTuVFOknPBFPSl7kEuallPBJuhEe886vrfM6lJZd2YB12OmeLieVFPGMS506Kb/e8FasM85uWgAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAbCAYAAAApvkyGAAABhElEQVR4Xu2UTSuEURiGj1ASIspHVgqxIPETrGdD+SqWslCihD+hJMpGkgU21lav7KxkiTV/w/3M3I/3eb8mszkyzlVXkzPPGddp5rzOBQKBQCDwv2mEq3QfdsA5eERn4lEvaI+22B5pqblnFi7QC/gCJ2A3vYdT39NJxugJPPuhi+WdxWiPttgeaanWk8s6HKYRXOF6O32E21zzgfZErtJie6Sl5p66P6CgP7VXOMm1Ifrp4n/iC9tie6RFe/rgHtyiPZzLpUSfYFdq7QOOci3NCD122btW5Hx5Z3Vsi+2RFnEcHrr4SxDl7ybOZtAn5hVsgM3wmu5yzSe2xfZIizjgKg+hNhdfJZnvl81pZCiiD3AHnsIDKh/uE+3RFtsjLeI0vOOseusqP+0MdX9AWXyjsrETtiQm/KI92pLXIzNyIHvASzhohxS90PYB85ukH3Z5yBPzhq+9VO5o7p5n+E7PYWvybW+sUe3RlqKeTbgMl+hG8u2Yuj/gX0bvqBgIBAL++QL/h3C4TIuqEwAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFMAAAAaCAYAAADL5WCkAAAC4UlEQVR4Xu2XS6hNURjHP6GQN3mliMijPPKKjERRmBh4ZmDiEhLlOVMykJQJieQKYaKkdJOuR0IGKBMMKDEzY6Lw/7W+Ze9z7tnbvRfn6li/+nXOWWufs9f+zre+/W2zRCKRSDQy3eRqt0VelmfkYPdXzHRvyfOyWY52Ybp8LM+6p+V1ecjnG4r58o47xMc2yEtuDx+rxVz5wB3jvpW7XJglP8hvLvPbZE+fbyhOWMgojBCA1+7k3Hie3haykcBgHNspJ7rAbzX5+w7TXW5098v+cpWFRePs7NAup69slXvdyDgL2YTLcuN5CNInudxdIldYuN48MZgD3ZGyV8URJaRgVvJbwVxsWUFn67yQ0yzUI6TIU7A7Aws5ZqGIt8cdFmpeUd3rJ+9b22BynncuAaoF418tO9dwudAq6ycQzEdyk7tAPpSLfL6UzXKC2yrX+zgLj4uPxbmrGSpfWueD+d3C9cVrJONuWrYLgY5gkr+PEKPnliVYKRRtfGWhNQC2Dn60cPIRcp9L0ebC6k3RNqetee+WBfOLnONG2I2tLr9PgHnNw3c/W8haLGWl+0QOqhqjDk2Rxy0LMPK5aDtGhsmj1nY7F7nVQg3HWtBjXrTQV2KEC4zBzAcqD0lC5tYK5m2X+nnBQvaTLDFhUjCrqFswY81goSyYBvWKu0eOsnBS0h+ppRxLrao3a+QNN95ll8p77gAL13BQnnLpJ2Ofma+ZtW5ohy3cjPkNBOa4KfHbWEisQ3hX7pYn5QGXwPJv8EgVg4nXrLhB/ptw7maXVm6ehSDRwsU2jh3DfIsbayDz3JmRVvCIhaTIB4m7OtkZg048nsoZPl8KAYlPDwSN3qq6r+IYgpcPJieMz7P1JpaC8Rbam+r1lsGxyPfGWpZ9eUig+OdM9c/tItbKfL2shtpx1V+RHo0SUHT8f0sK5h/kmXzjnpN9Kqd/sl2uc9fKLZXTiY4Sn1cxkUgkEonEv8APPcnBI+Fx6DAAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAbCAYAAACJISRoAAABG0lEQVR4Xu3UMWoCQRQG4AkmIGgTCQmSQrDxAClSapsiqdIFBPEKgiewShdIE5B4BW+QShCLnCClWKQQUgaC/j/7Dz4nS3BVVgL7w4fszMCbfU/WuSxbJifnUA4U4QQuxO7lZaOU5B7e4UOaUIFLaMkURjp7JolyChPoiU1VZvAQ7CXKFXzBndj4Ne7z3NZJpQjbwHb41tg8CdvJtibOkbzCp37pRfouKk5c59nE4c3s0MP4ge809FSKcJB26GH8wMOh+zbXoG7WY8Pb2aGH4dvxLcOhX0sHumb9V/zA6c1FnxEbPnPdn4kb+q37o8gNjOFHvmHgVt+ptotuv4C5PELBrefwRfaV/1/E/7ueYQgNOJa9JZUiWbLEZwk+A0yZaqMvRwAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAbCAYAAAApvkyGAAABWUlEQVR4Xu2UPS8EURSGryARWUL8AwmiIUKyJYWWhoREYks9QvgZ4iPRiEKh1KpWdCpRouZveM/Oe+yZtXMzq7iSdZ7kae7emXnOZu6E4DiO4zj/m164TY/gMFyDJ3ShuTUJ2qMttkdaOu5Zhhv0Gr7AGThG7+Hc9+480/QcXpZ0s3FlMdqjLbZHWmI9bdmBE7QOt7g+RB/hLtdSoD31kLXYHmnpuKfrBxT0VXuFs1wbp5+h+ZBU2BbbIy3a0wOn4CKNskqf4GjL2kfIbtSOSXoafp61ItcbV8axLbZHWrSnCvfhIY2iX8ybkP0z/fCWHnAtJbbF9kiL7VkJJQashOx9Fx/gHryAx1RunhLt0RbbIy22xwcU5EC/0Xk4AgdyO9KiPdoS6yk1oB5o+4H5S1o/djFKDfgM3+kVHMz/nIwa1R5tKeqpwjN4R5dgn92gdP2AjuM4zm/5Ak7ubjpHwLXmAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFMAAAAaCAYAAADL5WCkAAACzElEQVR4Xu2Xy6tNURzHf0Ihb/IoJSSkPPKKlHcxYCJRZGBCkgHynCkjGVDyyCOERCJ5dAe6KCEDlBQGSOQPMMX30/qte9Y57j7O1XXvcVqf+tS56+y9z9rfvdZv/65ZJpPJZBqZLnK12yQvy1NyoFuNYfKEe0belassXBNhsnwqT7sn5Q25379vKGbL++4gH1snL7ndfKwSxg/LsS50l8flEhemyS/yh/tBbvFjG44j8pwbIYB37oRkPGWofGTlYcIuudEFrrWp9HXb6CrXu3tkX7nSwqRxeunQTqe3bLYQAEZGW1hNuCwZT+khb8tP7kILK/uihfMRYpj93eEWzq2JHGY7hrnYSgWdrfNKTrLwQ0iRn9pydNtgIocsFPFa3GqhthXVvT4WtmplmPzOR3d5Ml4JJeCN+1N+kzPLjghhPpEb3DnysYXw/wi1ItaRZrnWx5l4nPw2H+tsBsvX9vdhEshV96yFQFmlU1ygIxjvnyNk9NJKC6wqPDF8a6E1gLj0v1oImNZhnDvPj+loirb5CPnZLQpzlLxm5YGwA1mltFfIjmBL8zspXPO7hVWLVVnhPpMDKsaoQwQ4S+5w0xupxhB50H7fzkVutlDDsTV4oNQ4+kqMcIMxzBnJeAqBpB1AZK684/aTFyysfnYBQg6zgg4LM765mSgTpkG94u70MeCiWGuY/4I18pYb37JL5UOXQJjvPgsNOfa00OyzzfmMkQUWHjhy3gELL2M+x/vmfnkpcW0sJNYhfCC3y2Nyr5t2/vUQJvM979LKsWPuWWjhYhtH7eP7JpdzGNstr7s8FLoHAqbmIoy0sDp5TyB5PLfSC6oqvHjifw8sYXqror6qHsKEWArGWNimRfNtjfgCWmTh/NZKCgsoPpyJ/ndNxFqZ1ssi6iXMuiWH2Y68kO9dGtle5V+3QG066t6U8634P5VMJpPJZDKZ/5BfAcK8O2GIKK8AAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAcCAYAAAC6YTVCAAAAtUlEQVR4Xu3RPQ4BURSG4Ssq8RNCo1KrlVoJDbVgBSJRigUoVQqJygI0Wg1qO9Bp7EDvPdc3MROV6ci8yZNMTu6Zuck4l/SLZTDABlMpRE6EqskRbaQwkj2yGEtFO98v5XCQiQ1UXa7ouPd17YWuhbvYoaCq3HBCQ3wzXKQUDF10ae5eX/BfsWIt9XCWfDCkpjzQDc199m/WssAQW/RlhR2WYucjFVF2oWvo2a6dlo9iLSX9UU8A4CMLXf0LWgAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAbCAYAAACnZAX6AAAA30lEQVR4Xu3SPQtBURzH8b9QBsVgkUFGixh4ASykTAZlNDDIw6TMDJSFzQuwmAzegbJ7RX5/53d1H6Tb2ZRvfZZz7zn3nNsR+cmi0KY9NCFCH0vBGkqkC2yhR4F0pRFUfOML2FGgAizFu40YnOTLl6wmtcQcugFdmsMB4hRIz1OGlZi/pi4wc7/klCTdWsL3rAp3yNA7q0lFGrgHmU56QJbedUhvgL8xXMXswLML59B911ieblBzjb/Ss2zoCBMxq5/JfzteWU3SHzAkLS1moa/pLahT6KaQo9BZTfpn2xNOUyU6upZZmwAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAcCAYAAABlL09dAAABQElEQVR4Xu3Uvy5EQRQG8CPiT7KJf8GGSnQSoUAnNCsoNHgDhXgBCqLSaBQiEYlI1AoqUUi8gkdQa1SU+D7nm5idSOzcuIliv+RX3JnJubN3zo5ZM7+kCzbkGGpQkbloXVam4Q4mpMP8BU+yGRbmZBAeYDwZ74QrmU3mGkpphZfNf+5QMt4Ce9KfzDUUFn6HIxgRFmXC4YXnrHTDPXxE3mDLvGChokxphZk285Y7lGd4hSnJCruB+tIJ8w55gRXJyo78tKNReIQxyUophdn817IajYfD2jZvv/DMe4T3Ra8swKTm6sId3cgt7MM6nMm5ef+GrGnNiQzABVSjNV/hDnqEbx2GRfOF8eKwY7bkqX1/Gv4TL813X5fSCucmLkRLsGt+8O1SKDNwED3zrmbh+WisUPg5WtPBv0hphZv5J/kEKgY4JVeYluwAAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAbCAYAAACHiFoHAAADS0lEQVR4Xu2ZS6hNURjHP3lE3m+i5FnkVV55TDwGDJTII8RASUhSkgwwMEAoJsLkKqTEQEkSNyZKmYliomRqpgw8/v/W97XXWefuc/bj3H2ua/3qV7e19jnrO+tbe+1v7SsSibSY/up4OCToqwqOy/Etlv+SXpWIPnA0nBg4EPaF41Rr57X8DG0nG+Bn9RicUttdGbPFjW+xMK5CDIIb4TP4W70BJ8Hh+jf9Aa/DFe5jbWUwfA53qT62SLaL+0334C11lHddVrja6Wl4NOjzsVgYF+MrzHL4Uz2sbUzETZWZ7ylwO+gUt4CoD38HfSHu7iW71buwn7Y1gzvCcXhR/QhP1FxRi8XSKSW3Sd4ZT9U3cCw8D5eqZeEqXQMfqlyhvNMOSvIjmPgsNErEVbXDa1ukfpL8C4pj2XgxEQG9OhFkh/pL3P7KiWsVDPKAuAKAliEtEdZO/Umbpn6T/A/TtiTCHkwf4APJvp82Yyo8I637vpHwrdQnYih8rfqTZhXfF6m/g5qRNxEcm3GUYpPKW/iruAlsBevhurCxANw+6Vn4RNxW5m9nY+B7tepEWCyMi/ExzsLERNRTeSI2i6uTKc8Kfhmbxlq4MGzsAibikSRnklArEXlwTGMEvKK+g6ul/mCZ9oyYrHJxdVciLBbGxfgYJ2OmmWFVxArJjulWQbF6Cledzxxxq7AZq+CWsLEEM8TV9XZmMDgRd1RWZYZVTUzEEq89C1kTYbEwLsaXG65+Zi+8lax64mqmPhyI8rP+ikyD331ZWvcawiYmfFgTq/weizuUEfsNryRZVCvVl3CWtnVF1kQUqpr2SvJu5I+4lTLf6+fqYWbZ9129BoeJm0yubtohrsrKwgRx2xC3QGqTVIRGibCJuw1PwmWSnI8We9dtU7nY0l5d7BN3Qqe8jvNwX9x2HG7JMRG1Xf9WIsowQJL98Jxk25oMHuQ4MfSC5HtY+zRKhMGxpot7PjHpaYlfIG4rK0vliSCn1K1wXtBXBVkSkZWdcG7YWIDKE8HT8SX1EJxZ210JjMF/vR0WGlmwgmOP5Luru4LjWyyMi/F1OzER9bQlEcRe3JX612BJ+M+XIyofptxi2gHH5fj71SKLIhKJRCKRSE/kL5v13wCLuWUHAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABXCAYAAAC5txliAAAA6ElEQVR4Xu3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAArg1LVAABk/Z/SQAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAAAxUlEQVR4Xu3SsQ7BUBjF8c8gIbFJiMETGAw8gclisXoNITGJicHTiLmdjWKwGDyBRGLFOe6JpG2qjcYi/Se/pbe3vb29Zn9dFxbhi2kqwwa2UJLUjeAOPlQksZqsYA4nqEtiX08uwEQ6MIUzNORjLZgJHzSAK7QltiIsoSmMk2/mVkGxZZrMG/l9O/FhDw+NUaSqrC36L/k2vnkogbgpY+mHxhh3mKvhrtO7HhzNnSLyLPgvOX4wt+yL8Jy/jmmmyXl5v+sJf1EvkT2Loc0AAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAbCAYAAACa9mScAAAA60lEQVR4Xu3SvwqBURzG8SMUURaRDOQGDFY3YGZQZrkCid0NKIsyGGQ2yGKws1AmBouUxSXw/Hqfw8F5t3ch3/os51/vezpK/XRBSELKIkH+x2qX0lCHK/WhAlWY0AYyeoNbeThSwRiP0w5axri1mnIWCtmky9EZGsa4NU8O6cGYfByTCx/QHGIctxaFJaxJNg1hC00K68VuyeceoEi6rHr+YtkYt+bJISXYK+fBCbMRLSDyNvdSF2YQIp2+KyEPLmDMPdKb5IDO25w88zZcSB7jR/ILK7rBST0/XcgdTZVzL8KaJ4f8+/c93QFfhzt045suEAAAAABJRU5ErkJggg==>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIIAAAAkCAYAAABFRuIOAAAE3UlEQVR4Xu2aW6hUVRiA/7BEM41UEknxQhcsxSAJjS7eQkW7GlSkBEYUqAglFRZ5kERFBFHRFCJUIsEuDxKCSA7YQ5RgREIvQvXQQw8FQq/W/531L2dmufc+++zbnDrrg49xZs0Z96z1r3/9a+0RiQyGG9QXO+R5r5imHjJvDdoiNbNa3WveGLT1ggfNXepNQVukJpiBX6pTzKEAGQnfUV8P2iI1EQMh0t/ZLAcbwoYhwlT1rDojbIhUy2z1olTX0QTWSnWNusMsm2W2q33hi5Fq6VM/lup2CfPVOfbvjeYD7eZCPKxeUCeZtTBP3Ra+2BCjxM1IfEod391cK2zL8Fv12aCtCH5Nf169T10oruLHW9pvK8REcVlrqVkLMRBiIMho9ZT6lbhBwSa5Q9oHJ39K+RQ6GGaZl+yxLAwWLleXqOvVTWZZCLBPxNUKWDkvqVfVlrioLRu5RWDw8Td7bAqyABIIDGBZqAvwfns+WT1qVtGvb4vbPeCYoK0wt5ukrT71stRciGTQq0DYYlbVsewUkACABeoHZhWF6BPixsmPVWm4qLdMOp5I+1XcF/BfokmyAuEedad6Qn3VZDnzjDNJvwfFzfD3zK/Vu9tvvQ4/W7Es9On7JtvGx9R3pV2HVAG1we9mFUtZDARj2AcCFa1Pi3wBUs4Vda6ZBRdAh+ORnL7Q/5fpJAXCMpMilp0E1+nvCn4kLhhYd2lHKnVuzHAesNVcJ+kHOdxU+sysIhCoMVaZdeH7KGnCDBo6ixnGsSUCgfC3tAekacJA8Fs6fK3jfT5j/aI+KckdQ3ZrmVkFGm0tc19XSzHulXwTqQxJ37cwDDrLwHdmS/1R/cfasGnCQGCwuUbsvB4fCLzOgDPbL5iLxGUNil9/K5nnaXQGAp+VxdMmmahu+X/SqCwQJqh75PqZwoeSEfx2KgvW3ANmuASk+Vz/X6YTBgIV8WUzKSMQCG+IWx52m5+r59X9km9dZpfgt2IDLQ0spU2aRgwEIwZCyUAgReJmcadeIZ3pdqA0WQdhIHCtPr0TcD7FzzY5AKLDuG5O23C6OsLelxcCwPtfoFQgLFZ/NjlBPCfdhxG0/ySuRvjL3CbNHTVzCnfR5Pp45LUx5mFxOwEyADMeuWag8D1ucv3eP8wV9r40KBKRnUPen6aRaZ6R3hzH+/oOe7HN7zl0OMuaz2yeV6RdZPnf9JEVVprfSPbRMcsOElxjg7YkuC/CVpgMxPIaLrF1w7V+b94WtA1ryBLsErAzQO4yGeCso1ju8SPZMu28IYSZyFJSNBAI2EfNx6X7cGwgyF5+Kez8vsOeGAiRfqghtpucLrJDoZ5omRzzZkGqR4pPAiIPZQKB+oLBvNN8RNwNKQp4fws7Db4rOxy/nEUqhAIRP5X8u6WkQCCYKDhbCVLsIjXIBtPDZ51WX+54LY2Z4g7+/M4pUgPMyDOSb4YnBUJePpTuzMNnfSGuEB4IfjfSqx8PDRsYUDp5QdgQwMzfqP4gbmBwfNc7smEns0V9yFwvLqjWissYaTsX6ohTknwGFKmQGAiRa3A385i4qh7rgs8eaeaF3cVJGdwOI1IQBoj7FAQEDgX8PROCIOseRKRi6PRD5rSgrWk4J+CcBFcHbZEGYM3HN9Wbg7YmWSXtX2lFekAMhEgk8j/nXz09S9iGtQOXAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIMAAAAkCAYAAACqhIkwAAAE3ElEQVR4Xu2bS6gcRRRArxhBUfEfERU/+FfIIhp9aCT+FVETE9TgQgkhCYIQzUKICA9RMIIiKv7wu3DhD3WhmCAx6iKIoiJ+NgYUREH3ggvRe6xbmeqyZ6r7dU33g1cHDu9NV89MT9WtqlvVMyKFuXCmer96oDkUy9Rt6n5moWdOUN9Wj4sLBuJGdbO5T1RWmBK+9z2hXh+VDQnX9Ix5RVRWmBIlGAp7oaLxHfWAqGxolpofqIdEZYXM0Pjvm7dEZTH7myvVQ6OyNtDj15q3qg+oB1XOGLHIfF3S11foyIz6jXlsVBZyuHqd+YZ6TLW4FVeLS1KRxPAhSb8eQcPokGXk2lddLO5N6yTSu0R7F3jfFabvCX0xq75qpjJ2ei++IunGGwfPX6UuMa9S75P0Z2bJ+5397UwJhnpmZQEGA8kHF/F5IHPQGnWD+pP5omQailpwsfqpuktGFd4HzP/vqRvNFDmC4VR1uXqtea+4dklxsLg6YrrIwmHigmCrGcIGB/6jXhOV9cE90n8wMGfvUS83U9QFgx/J2LXcVSPzvB8F4EL1ZPsfWCmwpG0C7/t8fHCuMMT8KvUfnojDv8QlVX0zRDCcp/4s1caaRF0wtGWtVD/fzdJsVALq6EPJtFVOz/9FRpms5xT1e3OLpOfOaVAXDExXVN7L5lPqWVbm4VrPVx8XN/ci2fp2cUMwjvs8rAwIBp83TYLVhO8wX6t3yuTVRx0M9awcbgjkdVhqNoGgIW840uxECYYqCzoYqLA/1JfM59R31a+k+VBJ0ok8t4k0YJMMOA4GJMMnGGhMpEFI+C5yT/kPto93iEuQCQr8Ulze4691XDDQsE2DIQenqxfEB1vQJngn4rPROHGkou5QfzRPqxb3RhwMNOK38v8eEJ/H/I3gK4kKo+JS8FrZeloDZtST4oMtyBYMYfIYw3Lnd5MKGoK4kcPHIRwPK4Rp7S1xQy2fAxnGz/ZPmED8nuM4Sn1hyj4pabIFA0Pib1Jd1nguEbeKwNT+N/sSGE8H4+RDNhlt4oa5W0a9NoTz9qhHmyvEjQwfyWg5d6U7NQnv0aRyCQaCa9qmKMEQnAMlGNLXm4TkkeSLXbcQVhWfiLv5giRiQxAHA5VDMJwTnEN+Q3A9Zv/jXeptMnmYH0e2yu2JTtfLNu9O82/1T/U1GfXaz8QljSxvWMb1vQ3tIYElX+Ea2Q5H7ldcKi7ppQcjK6BnpbrhMiNuRGPnNJSVCIE9KbjJn6hcRsu6EXO+EXeYBQe9/wgzHNX8sY/FLSdDOM79/9Q9B5Jqphx2InG+w+j+pvR/M2/e43MGRg5WECEE0DYZjSjj8Pdq2IzDHBwv7ssvyGZeLvxNta1xQaEEQ6EG7gJyZ9DvqCKPH5H0DR2Chuc9aHaFANgso6/HkexeJvU3BttC4P8g3V+nMAGW0ixLsUtSRmMxn/PXQ8L3tLjfY2AX2IL/QqqvX8gMlbvb5LsFc4XnspMYJnYEw+3B4y4wcpFAFqYMjYaz0fE2MKowLSxXbzIfFteI55pzwedG7AWFey6FKVGCobAX//2OHdJ9BUDC6ndHc7DJfFTyvWahAavFbXXPlw2dE8X9EBj5ZnuhR+h5LA1z7Tl0gVvyLI+XmYUB4Pcl69QzzKFYL82+eVaYIiUYCoXCAuFf79c8DPR/7kgAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAaCAYAAADovjFxAAACVElEQVR4Xu3XPUhVYRwG8L9UmH2YZB8oChZBSB8GBUKYi4o4CCIODiFRQwTRIFQg0lBDONRQJGiBtgWBOklDoCK4uDg75eoiREY0VM/D+7x6zqlzvbdzLij3PPADve8R3/N/P69Zliy5Ugl35BW0w2Folb2SA/BMLkXadkzJF+EafILLUm6uGF/grhQz+6QN6iJthaYDfggHMq+cgjm4GPn8IHyEFilGKuAWTEkzlAUfKDDVsAS/pTvcHJ8ucyNeE/mcnRmGE5JWuMToAXwwN/P4v5K8vM9tGIA1GQw3x4dF+AUvoUF8h9jZtDrIPWcIJuV8sDGFnIOnUG/bRXgceiJHsiIgx+Czba8j+g73LPnLc4Ml7tRv4Uy4OZX4QWKBL8ARmJd3W0/lER4rPCFGZB024WrwoQThqE+a6yhnBKWVG3JfvweL8F6fxYanAh2PNpg7KTasgN01z3AmvBbODu7mScIXnpFVWJCvMq9nYsP1Qv8a7bOwAo3RhhTDAjyHN+aK8z9LpR96JBjOAFqEo5G2UEq+CLwITUtv4HO/yTwyd1rwZ3+buw610GTuVka87CSNPzWIm+fJcHNsGmDUXB+i/fADvGZ/33+2wpH2a2kWnkAfjAl3VR6PDGcK3TS3xvi3D4XHa5rZL3Hh+ibOnp/mTjFekMi3s+2b8KRbhitqD4XVrxKONke4E05LMIeENzH/HcKfIsW6Tu/a+JdmkSaES4MFjIsfWV6Rx/PwwnJM392Qki4Cd1diJ/lFihcfbmDE3ZkXrZJJrg0rS5YsWbLs9fwBZ6mAS7SSotgAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAbCAYAAADI1VnXAAACdElEQVR4Xu2XTYhOURjHHw0Z35/5ihgWUmJBaSQ2JAsbSRaSstBsbCaUsBPysVAWDBkrygILslCmlI2NZKlQomxEUUrM/9/5n95zz9w7733fe98anF/96p0575259znPfZ7nmCUSiRaYDg/Ky3ArnAI3y7HIBDgfLixwqizNevgYrpETzQXkHTwk22UF3A674oUaWAD3w/fwgdwt++FXeRyO1zWFzINP4ero993wLtwk22Uc3ABvw31yUuYb1VgOP8FdMoQBoN/g2mhtBDvM7TxTKYQPcALOlVXh3/MZdwceNvfq0SrwFf4IV8mQ0/ID7InWRpACIRiI3/ASXCZ504Q3yc/+5zpZCQcl05fFuh147TM4TXo2mgsAjV+ZXGbAJ/BP4A/YZ50JQB7crQF40lxRa1rYBOvYQ/gWXgscMlf8l8rSsA2xc5yTn+F3uC78UgdgFlDu6qC5LGmFxZa/43weZvhzOSe7XMx/HQi2TTo7XjDXSr/AnfFCTbAwn4Xn5ZLscmnCQhmzBf6Soz7HMZm36+zNLy3/H7QL68AVecaa7FJJ2BFewFnxAjgAf8re7FIDFpl7Mkwr3yGOmkstfuZESFmFF5kbTOg2KzcYcfq7am7S869CVXj/vlDyOBDDFv0GXpB8VXLhjt+Xj+Apc2Mpb5het0Z/Z8ZQToRD5q6lR8y13ma00gXKsNdcFlB2ONazW/CGfAVfwz3W2MRCUiAE03OmZPoz5Xkw4kmOhkyWPNyEhy92lypnkL8W/+A+WDfN1QoGcTTYIS5aduApkmN33RlUG3505Y3yzMFeTzkJMk0LC9G/RgpExJhM10QikUh0mGHiMItHmwLP9gAAAABJRU5ErkJggg==>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAbCAYAAADPl4fCAAAB2klEQVR4Xu3XyytEURwH8COUR1h4JcpjJyF5FFkpZaM8NlbsLCTJxlbJQpIiJRaWUuwo2dr4B0SxIdnJTll4fL/d78m5d2bMoGGY+61PpnMu4zf3nN+5Y0yYMGmTDCiGioAcyIQyseO8lvh7fza50A/H8CKbUAlFek2PsAFd8pvJlhk4hH1YENaTcDrhSSY1xqK3pF5jqZAR2TVe8Vx18zL3fln88BM6klMohUXokFQJtx3vLs0641ytdAYlzviHScuiGbtsno23x3v80ykRNtNrYZE23XIHzc543JTLOexBln/6S+E/uWzeG2I8UxLrvavgVtyiW+VGPxPOgFwa74/W+qdTImyo9xIWLZ8qegimheewe3RFC4+JYagJjCc7sfZ0u/BmJVQ0uzM7tT30bSdnF+dZTcGw6BbID04Ewqe5JRO5d2OZED4NRksBnAgfTmxs92bR3Pcfhnd1xUQ+ydgu3ic2LJbYIRud8Z/MnKw6Y1yVtGNiNMExuJJX4306Tc48l8eF5h5kDQqNVywNwraJf6eTEfs94BhGjXdTDqTauc6XtCz6O8kTFs2995th/2mANr2mpIT7hdahF+r80/8ztpuz6HHjded/n7Qs2sYu8zBhwoQJ8xN5AwFzeQQqrSMzAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABDElEQVR4Xu3RP0tCURgG8BMWhJgUCVo0CQ42KJIfobnFQTRwjYYgFET9EkJLo0g4VItz0xW3JnFUZ/saPS/nuX/OvcgtuIPDfeCH+J73vBfeo1ScODuTgBb1IQ01eKGq2xqeSIfdQp3GsIQSnNMXVJzukDxAgSy4Z/2E5tBm7U8p0grKrOXpR+kP5KBHz5BhXyB39A1nvtoWrmGo3A8I+X/IXiORDrNfbgIHcATv1IVLpR8nRbJL6b2Qy97IoUUz6MArDEgG38CUvbZPpfdsRAprkkuncGx06B657B32BlfeJom9K+++/JGX++CvyCq9gkB/pMMWsKERJM1jJ0/QpAY8msf/j+zTFmff8gvSSjY+SkwTjAAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAABtklEQVR4Xu2XsSuFURjGj1AUSYpM3NKVCckgyWIxWAwWNoMYlEHKv4CFEmKQLFIUWQxuGRTKHyDFIINsFhPv4zzHPd37Xd/56N5P1/nVb3n7Tn3nOd/73nOV8niiUEUbHa3Qy4obH0oG2OARvRE3xF3xjV6ztiU+0bnPlYUjSY/FHfFE7KZhlNNe8UDpQw2lTVykWGxqL3SYNTBKh6xavqkRT2kfay3iBU2wFkSHuErXxQflGMqY2EMN2LgJBQEZxmmXVcs3A+ItNRtCq6foBGth4CCdQ2lV6U/MsCye02qr3kQrrVq+QaumKMIAZeI+3WQtDB9KAJFCyaRWvFI6GBgFvOy00oPZxSX63YvOq+xQwLalC78KxQxZDFh7yMYFDiZFYwvFDFmEYw/ZuAhqnxKlrw2wIKGgR80sseeJC6XilMpuk1wu0HoszgG+1jvawJr964P2csGHEsCPQ7GH7F8hofStGpp2RjiX1NyvcGM9o0nWbCKFglufGVj34rv4Kh7Swa8n42OS7ont4oo4QzFfwIj4TDtZaxbX6KPSe8Ohz9Ki+A9XJ/ardBt5PB6Px+PxeP47HxiOhuQdtAYRAAAAAElFTkSuQmCC>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAbCAYAAAADDr0pAAAB5UlEQVR4Xu3XzytmURgH8IcZkpn8GMwkJMI0UdJQs5DUEIqS/CploWSS/AEUioWdJhMLJCmW40+wEhtbtspeWVrI99vznN5zb1Zvvd17637r0+s956jnXOece4ikSZNVPsBXqLZPYpufItF+H9sizRcYhSt4NYOBESI/YB8eYNFUBkZEFBaxB7fmHD4GRoj0wVyoLfL8hD+wZJ6gLTBC+zkuVkls4bPQDQ3mETa8fm7ETSj32iJPnmiRNfYz/YM7+GbYxzHsi034FFcluBm5JJ5h2nBjTnn9sUhiC3cb0w8nwSPx2qxIjDdmOHwJvZhLidHGdBuRp0VtqI8plcwTP/TaS0yP6GT6od1UwJBkrgUuHD9guNn960IT/IZ66DUFXn8gw3Bv+Iq/ge+BERp3rs/Yd0500qyJnj5V8N9MQB0cm0+iBW1LZsJnon/hTvNL9MqxAweGD+HdJLbwbMPCuYSIly5evnjPOTFcOtzEf02+aEHcL58NJ8T3QrHhTXRD9OTiRCkn7wsW6oploV2ixRHDo3XMsI+nU6NnFzqgxfBqcSq6z5pNmeQgLIa27PuC6FJyy4nLYtm0wjyMi46nI9Gl6r6vwwWMiC41yskTT2zh7hh1/yXx07VlG/5uYbgxTZo0CckbgVZnA+7bbjYAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFMAAAAaCAYAAADL5WCkAAACxUlEQVR4Xu2XS6hOURiGP6Hc77mUUiSkXHKLiGTAgIkBRZIBkgwQoSRlJBMlkkvIQRmQiU7iR7llgDJxKUoMjUzlffve7z/7/P9e56LjnN9pPfXUOXuvvf+93r3Wt9Y2y2QymUxvpg/cIJvhDXgBjpJtMR5ekjfhC7imVQuz2fAlvCjPwzvweLFRb2ExfChH69hm2CT76VgtQ8zD3yrJOPgIzpRkHvwOf8svcDfsr/O9itPwigwYwEc5o3C8yCr4Ey6QZDB8AI9Jwnvt1N+dpi/cIg/BYXC9+UPT+S1NexyOrgo8KIPJ5qOJ1k7bYC38ZR4WDfhSbkuO6ghzhJwAB1Rbt0MOswvD5PCPgs4bv4OzzOsRZZ2ZW23dOfggp8yLeEfcY96hVN0bCp9afZj8na+SoZVRNs3j5YT8n2FyYdoml8BncCUvaI8dcKqswE06zgePh9+rYz3NGPje/i7MWIC4mFCy0DzgimQb7gim63zAjN5aywBrExZt+sF8a0A4degP84C5JZkml6tNd5Oa5hPhN5kKkzCoM7ICD8N78LpkHzml+TtFUiWilHXyFRxZc4x1iAEugvtlsSNtMRaetPrpnHKXeQ2nZbCz7DT3lTRgByPMmMJlsAYyrKiBMfM48ih/95r56OcsoCSHWUK3hBkrdwx1blBvyQM6RnhT2tEw/wUbzacmjVBWwydyuPnzHoHn5EDzDfpn8wWRkmXwuflLp+SE+WLMe0S/2V8uSrw3TVJc0R7DffCseT2hxZ1/I4TJ570quZXjjLlvvoWLbRx3AzzfLHkNA22CR+V28/7O0TXBJPPRyXWCMo/XVt+uFC488fXAIRxToYxGCJNEKZgCl1r6eWvhNbHYMvjUJyKPx8vhZ2aqXR1RK4v1MkWjhNmw5DC7kDfwk7wMB7U+XYW1KfZod+EKS3+pZDKZTCaTyfyH/AGtm71sYWSKAwAAAABJRU5ErkJggg==>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAABb0lEQVR4Xu2WPS8FQRiFXxEJ8ZEoVaiEQiQKQadTiEQloZDoNSISv0GlEISEwleDxE9QkvgLFKLSaVScY8/Y2cW9e++um4t5kqd5Z2czZ2b33TUL/C7aZFdGm6Np9c2fC8UFXspbuAMP4Yu8UW0PPsrV95m1pQmOw3OLN/db+uG65ERXe5IzqpE5OeXVfpohuQm34b1lCDUPR6WDC3ehGNCxKIe9WhpefySnYWNyOBfczEyh+iw6IXdKZANeyXav3i1bvNpXMAgdg8cWbRwtN68c/ztUmk54bVEwmpcGOChP4BJsTVyRnapDuSbBBuE3iaLgk7EP12RHYrQ0VYdyTYLh/CZRJL0WN5Pl1Fgpqg61a/G75L9PeeAjSAcsuj+D8IQqOSUSQjn8JlEEDDICz+SC5euAmUPxa30g7+ArfIYXcvLjymywlU/IUzhrnz8ZldAjt+CDRevjxtMVq9F/KE/GhSrybyIQCAQCgUC98gZqmE+1S7V5eQAAAABJRU5ErkJggg==>

[image27]: <data:image/png;base64,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>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAdCAYAAAB8I5agAAAAnElEQVR4Xu3OoQrCQBzH8Q2LbEkRywxDn0GTDyDoAwi2gawNm+AjLGo2mA0mfQwx2HwOu987frcwi0tD2Bc+4f73hzvPa6qjEXJZY4hQvvppeSJndGWBN6Zi6+MuMzekMR6IxLbEU3puSCtc0RZbpeWthu7CtccOgbTMMMVJTLG8MEcm9tVKywPcZIODXHBEIkXmP0YHvpTPTX/fB20CIKHNNn5VAAAAAElFTkSuQmCC>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAbCAYAAABFuB6DAAAAyElEQVR4Xu3QMQtBYRQG4COTQllIKSmL9S4mm4HBbjCYGJVFKeUn3GSymJSBwWZUfoNRMpn8B++53/t999quicFbz3LuezunT+SnkoURDCj1/lmkTDuoQp/mriHmrwP1OOvQCdKcSRcuVODMFu9Q5CxeUdceYUE2UzpDRgc1eIq5Ra3oRhtIaLHNYoN0jQcPGmrpo+JEwjuCW5AWXKnCmYwlvMNagk/BfZomrCOlupgNeXLRV9/CjPZQihZsYhc1SciRu+mfL+YFdnItxOx5oacAAAAASUVORK5CYII=>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAaCAYAAADmF08eAAACv0lEQVR4Xu2XS6hNURiAf6HI+xEJ6UpKEXmWx0yhGDCQkNQNE+8SKdyJDJTXvaUkj4FQFEkh5RQZUExcM0kpIxNz5f+s/7fXXueeY2Ofrjr7q69z79pr77P+tf71r31EKgoxWB1m9gcj1IFpY9mMUi+o08xWMdLcp+5Uh0bXFqpHJUx4y2iLQAeox9UN6YWSYQLvmDPU7WpXdB0OqVuTttKYrd6Q/OyWDc++LyEID2SdWlOHmzBZfahONEulS92dNpbMJrVX8gEQ6Cd1kglk1xUJ/bEpy8wz6szk2hzJ9qBX2Afq8l898vDFS0z28HoJaccKFc0A+j2ScH8M+/G5hGqLzi71stmUtgiUAZOGuEe9LeFsGmO+UtdYX08Z2mZZWwzV77R6xBwkoVp+U+eaReDZXyXsx0uRHyXUBiYTHcb3xGx4ph9Qp5o3JatqPjD2yXRr4xNfSrZHYiga6b5iEO/U8WYRuIdAV0g2ufPVLxJWL2WBes/0ItUnHsB7CTfBFrMm2c0e/FupD5Q+NalPt5PqValfhWYclixFndXqB7UjanMKB8p5iK8lpCt4zjPwIabPbs0+Y/ifisjkOKTRUwmr4Pu7yOF+UPIpij3qOfs7ZZGEuoFVoMCD44ePU9+YTECnhALh++yFZCnuMEFMFGedQ+X9rC5VT5jcT4V/ZqZVHlZKlu5ewUnlCXGnCL7T36AogA3xvUdgVN+z6mPzmoQ9wwNcihYTkELbdXWveUrCil5Ud5iwUf1u7re2GFbllnpMvWtOyfXIw7HDGLEQpBUzzvHiKcNKpT+FeAPplr7TiBQfbQLPHCv1xcgnt9HbjB9x6X0pnLlkIq+lWCqkNmnSkV74Azab/zo4jqDzkmVbqbRNoLBYwhn5N1/AK+E2s1la/g5+E7P/W/l7+Cer1LVmf8CxNS9trKioqPhv+QFWQooPupWsOQAAAABJRU5ErkJggg==>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAWCAYAAAClrE55AAABdUlEQVR4Xu3VvytGURwG8K/8SL0WEslAQgwYlIUMshheSRIphWKQEbPBIBkYlYjJX8BoUjL4C4wyGJRRiefpPN+cbrK8975d5alPt3vOfbvnnPt9zzH7z++phCZoSaiDamiWuK9WUk1uBtIAM/AAj7IIbdAKS/IEt3q2UVJPPdzDrsTpkGdYSPSlnkF4g0mJ423s53OZhjPljH32cY6EK8aVyzS5GEgFnMKLrnQsJxYGSGzns5klLtRkvEjLXqjJeJGWvVCT4SpxtTKtD35vr48bCztpHN6z3evG64PXAemGEehTH8PdeFTt3LWJ4ZVtztvzMZAJuJMPeIcz+z5XVix8jk94lX0oQBdMyTXMwwW0yzl0wriFuvLaWrfw2x3hREpKDYzJnoWZcRW25Qq2YE7txBxYOK+WJZWtYE3iv7RvfEXd80X+afphFnrgUko+NPmCQ+mN2odkE4Zh1cLJTtOwYeHkTm1FcjMQpkp+CmuCdfR38gX5jVdTyA9y2AAAAABJRU5ErkJggg==>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAXCAYAAABu8J3cAAABiElEQVR4Xu3WTysFURgG8Ff+RFiQSBYkf6JkodwFKaJYkGRBSknYK3wCC1lhIyXiQ7C0UrLwCSxlYaEslXieznOa03RXZuY2ylO/bvfMuc25533vmWv2nz+ScmiG1pg6qIQWCa9VS6pphEV4gmdZhXZogzV5gXvNbZLU0wCPsC9hOuUVVmLXUs8QfMCchPFjvM55mSY3C+GWc+t9GcIcC0vHEmaWMriAN73SmZybWyBxnHMzS9io8fgmLUmj5mYhYaPG45u05I0aD3eJu5Vpo7LxfKPemTvSw/A9x30D+0bl66D0wCgM6BrDx8KYxvn4oBoYt+hEpn5OnoEH+YJPuLToubJubhe+4V0OoRa6YV5uYRmuoUOuoAsmzZWTFmADtqEgJ5CfhSRJFUzIgbmtZzn25AZ2YUlziWU+MrcoXxp+PnG2JPxJ+xN4Vu/ZS75HeGMekPUW7Uiv5v06vAG/HfUF48OyAyOwae4vBnFHTmEapiSVU7pCioVlYjni4Y2LjSdKbhaSSn4AeQZdaytbShQAAAAASUVORK5CYII=>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAXCAYAAACFxybfAAABm0lEQVR4Xu3WOy8EURgG4E9cgoIIkQgFEkIEBQqiQEQoJCKuoRCJiGux/8ClUSgUKOhEQqUTpej8ANEqiF+g0HnfOd/snDkbsjGzrMSbPMXOd3bm23NmzqzIf/5AcqBRrcIRTECRqoGG5OgMpBZu4Ur1QBUMw4m6hy4zPP50wjMsiJkNsrOuHqDCqUUOp5ceYUdSL+6nV3F5Phvz7fx6EzwZL0xcirpwOZR+Ne8WoqYantS5xPwL000HvKmEU/uxZEUT3fCuRp2anUoxGxcxxRLcS6cScRnr4VUtOzU70zCo/Mypr76XVvLgWN1BabjshbO1JKkb2K6ahBEosca0i9n2+Ui3KiZXj/n42QsvTBdinpJNmFGHsGIP1pTBteJjy22cDfGdQmNwA7NwpgphTetbis16yYom7JTDELSo/HA5mWYJlpFL6t8bBWoA9sQ0z3P459mHF1hUkW5o/6LEJjhjfWJ2XOJxjrHTBlPQBJcq0otwW8weQ7wh2cSGBO+hAzGzZWdczBj+N4llJjjl7tNih7OT8WRFE7HlA/tYTzRH8F8JAAAAAElFTkSuQmCC>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAaCAYAAAA0R0VGAAABsUlEQVR4Xu3WvStGURwH8J+8hMFLWUR5CaVsKGR4xMBg8bZQTJQw+A+8bCyUl2JhUpTNLJs/QEYGZbIog8336/yO59zzPE+Re5/nDvdbn8Xv6P6cc+79EUkSboqgQy3DIUxBhWqE9p/VeU5sm2uGW7hWA1APo3Ci7qHXLM9feuAFFsTsHrlZUQ9Q59UiC4+JHmFLMpuyGVQ85lxrQg0fwoaIu9YSLAcypOb8QlSJdXMN8KyuoMQtFjrd8KHWvVrB0w+fatyrMfNwLqb5J7UmZocrJX0lTiWCl6QT3tSSV7NphVcxdX/NrPJ/Hkpi3RyP50jdQXWw/B2+ne9i7ie52VbTMAZVTo2ThROGY3BYlWqtTcw1Ivd3MsKG6ELMW8s7xVlKO7ALx2KmgjsZauFG8RPDkcZGy9WkmLu4CJeKJ8V7PgMjilPnV6mBFHQpPiRX+CC76zwBe7zFip+pMzF/kG2YSYk5CU4aynZa/45thtjcgZgH80NOtnn328lGuJ7jck9x90JPrJvblPRLwkvN5lbFHCdNSOZb3AT70AcbKpJjLZPs/1rZ8N7lqiVJkuQv+QLoXlSBN1hnmQAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAXCAYAAABj7u2bAAABsUlEQVR4Xu3WTStFURQG4OVbvkmEAZkpkZBIRoRi4GMoE0l+ACYyYYABQolIJgwMGMlA8RP8BGMTI4Z4X2utznW6k3vrnG7y1jO4e2/7rLPP2WcT+c8fSRnMmX0YhGIzkDAulnTBPbSZAtHCXsyCD4wjNfAIraH2Qrg2/aG+SDMqugp1ofYsWDXVob5Ik5EFfcIONBkWw/hL7b9jSTk8wFeCD1gULSTWYjx5ojtty7zCO3Sa2JMRBXG7U1W4Q/QT8AbjJpasmGQr0AzP0GIiDz96N2Yyod1f4mXRXee/eazw+GChI4a7j2EfDUOt6Nw5pg/qod0M2VjO5W0/m4YT35o7WINpODanElyQmbIx/Caxj3jWNcKm4YUuRb/qPWYGnkSvR0uwB6VwaFhU5hXEP64wXDIuqy85efyR8Vt1JPo+5Zts2JXgEZbAOTRAkZmV3wczdzAL9rE+PuXw6LiAyoQ2Tnolwd3TAXSIvkfkBXBFiHPwhnth2/C/i5TTDRvhRmRe9FET+89gTIICTkRvxncrVzlX9LhaNxOSRvjYuGtSDS/O+KNPZ46kSXeyyAqKNN+R3VTCepBdFwAAAABJRU5ErkJggg==>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAaCAYAAADFTB7LAAABrklEQVR4Xu3WzSsFURgG8EcohAUiLJSFQpEsRLKRUJSvYiE7H9njD0D5WBBKiWSBhX+CP8LSwkIWFkpZ2Xie3vdkmm65NblmcZ/6Reec27znzJk5A+STPMVU5+pdLRU6pYCqI/1S7n1/ntQXWEVL7p0eaZJKnaK/q/TmjqjV+3ISrYbc0zVsxeKZoDn3b7mCFRm/fbrlh94e78tptukJth9DtJrr1BNp+7ekvsANeqXmSFs3rMBM+zLnGadPWFHhKd6F7cFUpJ++YIXOOv2fmnTSB+3DVk70Ik9NUl+gjrBneqF2F0045vqohQZhEwiTqKRh/BydJbDjUuMbnBZhyMcOOLVl9RBW0AOtxDtgF5t257Cj8Q525EkT7cAufOO0p/V6mocdAKI3xBrsxa/ryQmsyF+jWbQh823VSjQ6nTg1sKL1GzmgEdhJc+k0towWaNkp2joqPpxMYWzihNU6pSJvCxe5ha2OHLsu2CRCQaIV0wS1BXrdHnX42ERJfYFTLtyqaBZphrbowo3BCjqDbQmJTnDUbcI+8RInfMRm9cRFElZb0W/Dh3A++eSTNN83nUY4qeBIPwAAAABJRU5ErkJggg==>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAXCAYAAAB0zH1SAAACLUlEQVR4Xu3WzUtVURQF8F32YR+maZZSDoJAJDQyRAhr0IchZYOiBkU5ECkImomKEA4c1CiCwEllNnAgkUg0aSQU/gfSOGgehA6cRGu51+addxNp8Li9By74oZ5z73O/c8+555htZSv/nJ1wRJrlMFRJXdIeqtfv9L60n7/nlnp4KKvwGa7AHjkHC7Amw3DU/Etdk2+65qzlnBix7zCS6WPYxj7idZEGmTD/krmnRr7Aq0wfC/sKP+RY0ndHTidtuaZiC98vizBT3LU+9yfN5z+dUXsLPJZtass9fEvQJ3gPO+CEPILrVlw4C2V7XPPfw9FehANWGE2ObBesSJ/51BjyW8ojFV/4RSssPIbTI6bKTRgzX7RlE76vf8JrK7yjmVPwSz7AVbWXTVj4b7iRaY/NiT7axpsNp9d5OCiXzb9wDACnWLp5Mfug1/w62q6fseip3/zz+NR7hLt2Ue7CnPn5JQ3/4bLwCJAN3zK34Qm8lEaYh1vCtTJtXmy7vDU/ctwXFsVBW4JuYeF8yjxLcYoSB6EoFVt4ExzKNpq/11tlo82GbbUwBW3Cz+Fij6nDR/3CfDq8kXcwan6oo91wAZ5ZIQ/MB5T/g/dTbIIlSbZQvkKfJ/3j5qPZCbMSBcQRmsWlhRKfHuf9cfPjCHX4baUJC+XRIBIFRJ6a7wsnzXdiGoRLMCB7zUc0nlg6GCyeA0H3rITh6KSrPUZws+yyv9cTp+Vmf5c8FVt4rvkDMxlzWn0eS4wAAAAASUVORK5CYII=>

[image38]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAXCAYAAAAcP/9qAAABl0lEQVR4Xu3VvStGURwH8J+Q95ckQiIlydvAJGEgKRYZFDEYJJOEBYPNYrDIS8lsYJJBsVv8CWaLiRHf7/P7njxuEs+LZ/GtT8+9z7m3c8+5v3Ou2X8ynFKYlz0YgiLol7SkB66gU/LMH+ABFiSlqZIbaI+05cMZ9ElKMyoPUPO5ybJgAyolpcl4x6+wC43CThkWF4/DecpSJtfwFucFFi0NHUaTa17ZO/IIz9Adf1E68qcdcxlVSDRcWk8wHm34ZUJ9lOg3lnXzEX01qia4h9Zowy9TLafmncc2h3OYkJDwhGvmVc7jbOmFWuiCYSnw22KplzHzpdlgPjjirtjBiziiC7iULZiEAzk2X0pMmJUZuDW/d1W4FBluqStSDktQDNsyrfPMdcwvES8IU8spHLGPdxKfQpm1j49FqH7u4XVwF/ffMjRDDuxLUrUSOuKDnQjf94D5x4Qjio3KvNNQVMTjNrX9OKxGOjTfs1vgSKbMZ2PT/AGI0zpo/kp4D82ZF15C4Si+C2si7O0h3JiIqyLhZKzjpPMO3HlNDHsEfzYAAAAASUVORK5CYII=>

[image39]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAXCAYAAABqBU3hAAABcklEQVR4Xu3VvyuFURwG8K/8zo8UkWKziBgohQwyKClZSTGwmCTK4mZiMDBRZPAnyOyWMhhlsBj8BUpZ8Tyd5/See0V4O96Upz63e99z6v3e95zvec3+80fSD1vy66mGMziXqsLh+JmBF8hLbTgYM82yAzm4l5ZgTtRkWkAJrEkfrMODtAbzoqULNoTFTMKT9AbzoqQctqFdGBbwLHwiUZN5AbwZ1/pa8nADr8LxtKmT0uKBRti1973Of+2fwHTR2HdTAyfS5i9yo9EqjPuLQbjzfRewI3y4XDQCw1BmbpNSh/CJUT00wTxcyqjp40544l1YYa9z/NaSJXg0907gnH3phlOYhSm5ggFLClgxd4zPwaY0QPYF/DTLAYZrW2muYOIJyiwJ3ylMDsYkVQ7MrTsx3EPc1eEN+SY9kkFzT4qbz7d4qpaesOS0HIJFc120J536fSwL5m56qO/UYynju6AiuMZOoI/ixz+b8+VkXkDqvAGwcloIUUufHgAAAABJRU5ErkJggg==>

[image40]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAXCAYAAABj7u2bAAAB10lEQVR4Xu3WzyulURwG8K8YCZPGMKiRstMkJopESX4WsrAjs5AoGynRNLtpFjYWsmIICyLZsb6ZP8BONhY2ttY2eJ57njP3nmJ1D13lqU+93fPe+37veb/nPa/Ze954cuELVEGFfAjOCFMsPJ8+S076SZmkBIbgDB5kIDgjFRZyKnewAC0SNZ9gHc5lOhz+n1E4lH/wMRyOlzpYhCP5Ew4nUwuTcCKr4XDcZF1BI+b65q/shMPJJp+Bb3Atw8EZkfPT3AxwlihhroF9eqAVuuFGOKsvEjbmbygyt9roytzy5+OAODtc1iw8IekFR03WFcSpn9dxu7BH2C8/5CsUWKqZX6WhGRZHnKFZ6BeGRflmfpGG5i2gX+YamvHbAS+8Z251+W3EN7QvmuG20yb8DTZ/jcYYtkEvNIjfXqphUHg964JLuYcL+G6pferA3C3zBW7ArbltJSGN0ATjcgxTsAL1sg2lMCH8Ld6ROXM10L7pIKsKipVCS12M+1+euVu8JbuwBH1SaW4n8G8UlG+RsyxcnQxXI/uPOIMMe42aYdNc4T7pxxmHzzC+JVBZ2ud+JXLv42Lwj49yWIMOGJNO95V44T987l/ydjz1ssfV51d59GRdQRnnETwFZ2kb0lxMAAAAAElFTkSuQmCC>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA20lEQVR4Xu3RvwsBcRgG8K9QEiL/gZIsJMrIYGUxGJTVjog/Q8kog8FoNZHNJCNm/g3Pt+9zv3TXGS6D7qnP8t7bc917Qvjx45gg9GgKCWjDnCrGqns8LWtAh9ZwhQKkaQ8lfdslfcjSAbqcx+kEA86+Sp5uUOQsQy+hXhCAHNW4Y5sWnSH1MXsKVVCFEU24YxtPy7Q/txHqc8KwpTFnMk1yLIsJdXjpCENYwoxksRbXMnn4O5UhCRHLhhHXMu1W5ns55bdlF3jQCqLWx3rk31zQDuoQMi/4+ae8ATvCMlEEth46AAAAAElFTkSuQmCC>
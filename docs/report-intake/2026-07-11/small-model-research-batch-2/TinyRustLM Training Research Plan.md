# **TinyRustLM: Comprehensive Training Architecture and Alignment Strategies for 0.5B-2B Local Models**

## **Executive Decision and Structural Routing**

The evolution of local, in-browser artificial intelligence necessitates language models that operate under severe computational constraints while delivering nuanced, logical, and context-aware interactions. Based on the technical evaluation of the TinyRustLM ecosystem conducted on July 11, 2026, an operational decision must be formulated regarding whether to train a new model from random initialization, continue the pretraining of an existing permissive base, or restrict adaptation to parameter-efficient fine-tuning. The TinyRustLM runtime is strictly bound by a WebAssembly (WASM) scalar CPU execution environment, a 128 MiB single-transfer allocation ceiling, a 1,024 sampling candidate cap, and a custom SLM1 binary format that currently lacks native grouped-query attention (GQA) optimizations and multithreading1.  
The executive recommendation mandates the adoption of a Continued Pretraining (CPT) pipeline applied to a highly capable 0.5B to 1.5B parameter base checkpoint licensed under permissive terms (such as Apache 2.0). Training a model from random initialization in the 0.5B-1.5B regime demands an exorbitant token budget—often between 3 trillion and 18 trillion tokens—to overcome the scaling inefficiencies of small dimensionalities3. Pushing a model of this size to such extremes introduces catastrophic overtraining risks, where downstream adaptability is severely degraded, and the network suffers from progressive sensitivity and catastrophic forgetting during instructional alignment5. Conversely, relying solely on an unadapted base model fails to meet the strict conversational logic, neutral adult-policy inquiry, and tool-delegation requirements necessary to comply with the UAIX Cognitive Liberty Charter9.  
Therefore, the optimal path is a phased adaptation strategy: CPT to inject domain-specific structural logic and execute vocabulary pruning, followed by Full-Parameter Supervised Fine-Tuning (SFT) for tool-use formatting, and culminating in reference-free preference optimization using Simple Preference Optimization (SimPO) or Odds Ratio Preference Optimization (ORPO) to stabilize behavior.  
A rigorous decision tree is established to guide ongoing and future iterations:

1. **Assess Base Reasoning:** If the permissive base model demonstrates fundamental logical and arithmetic deficits that cannot be bypassed via external tool delegation, route to sequence-level and token-logit teacher distillation.  
2. **Assess Policy Compliance:** If the base model demonstrates competent reasoning but refuses legal adult inquiries or issues paternalistic disclaimers, route to CPT combined with ORPO to aggressively override the pre-existing alignment tax.  
3. **Assess Hardware Constraints:** If target device hardware transfer constraints strictly bind below 128 MiB, prioritize extreme vocabulary pruning, discard the embedding tail, and execute 4-bit Quantization-Aware Fine-Tuning (QAFT) prior to SLM1 packaging.  
4. **Assess Adapter Viability:** If rapid, task-specific swapping is required within the WASM runtime without reloading the base weights, route to Weight-Decomposed Low-Rank Adaptation (DoRA) and adapter composition.

## **State of the Art: Updates and the Always-Current Rule**

In adherence to the always-current rule, the training landscape as of July 2026 reflects significant departures from the paradigms of the early 2020s. The traditional Chinchilla-optimal scaling laws, which advocated for a 20:1 token-to-parameter ratio, have been superseded in the sub-2B parameter regime4. Modern small models are deliberately overtrained to prioritize inference efficiency over training efficiency. However, the discovery of "catastrophic overtraining" dictates that beyond an inflection point (roughly 2.5 trillion tokens for a 1B model), the parameters become increasingly fragile, reducing the model's plasticity for downstream fine-tuning5.  
In the realm of parameter-efficient fine-tuning (PEFT), traditional Low-Rank Adaptation (LoRA) has been largely supplanted by Weight-Decomposed Low-Rank Adaptation (DoRA), which decouples the magnitude and directional updates of weight matrices, allowing for learning capacities that mirror full fine-tuning without adding inference latency15. Furthermore, preference optimization has evolved away from the memory-heavy Direct Preference Optimization (DPO)—which requires a frozen reference model—toward reference-free methodologies such as SimPO, KTO, and ORPO, drastically reducing VRAM requirements and preventing length-bias exploitation18. Finally, the TinyRustLM ecosystem relies on a custom SLM1 binary format rather than standard GGUF; the SLM1 header strictly requires equal attention and key-value (KV) head counts, actively rejecting the Grouped-Query Attention (GQA) optimizations prevalent in models like LLaMA-32.

## **Quantitative and Operational Comparison of Adaptation Regimes**

### **1\. Training 0.6B, 1B, and 1.5B Dense Models from Random Initialization**

Training from random initialization provides absolute control over the data mixture, tokenizer formulation, and layer normalization structures. It ensures the complete absence of unwanted alignment biases or toxic pre-training artifacts. However, achieving baseline linguistic fluency and logical coherence in the 0.5B-1.5B regime requires an immense computational investment. A 1B parameter model trained on 3 trillion tokens requires approximately ![][image1] FLOPs24. Operationally, this demands sophisticated deduplication infrastructure, exact cross-lingual balancing, and complex phase-decay learning rate schedulers to prevent loss spikes. While possible to execute, it is highly unlikely to outperform an existing permissive base model that has already absorbed the massive fixed costs of foundational language modeling, especially given the risks of catastrophic overtraining rendering the final artifact brittle5.

### **2\. Continued Pretraining of a Permissively Licensed Base Checkpoint**

Continued Pretraining (CPT) leverages the established syntactic and semantic foundations of an existing model, requiring only 50 billion to 200 billion tokens to shift the model's domain knowledge, formatting expectations, and tokenizer mappings25. CPT is computationally efficient, typically requiring less than 50 GPU-days for a 1B model. The operational challenge lies in maintaining the original capability while injecting new reasoning pathways. This is achieved by utilizing a replay buffer consisting of 15-20% high-quality general pretraining data mixed with the new domain data, effectively anchoring the previously learned representations. CPT is highly recommended for TinyRustLM to embed the UAIX Cognitive Liberty principles deeply into the base weights before superficial instructional alignment.

### **3\. Full-Parameter Supervised Fine-Tuning**

Full-parameter SFT uniformly updates all network weights to map specific user intents to precise outputs. It is highly effective at establishing conversational tone, ensuring strict format adherence (such as returning rigid JSON schemas), and teaching the model to emit syntax tokens that delegate arithmetic to an external deterministic calculator. However, SFT is fundamentally limited by the pre-existing knowledge of the base model. If the base model lacks foundational logical capabilities, SFT will result in an artifact that confidently hallucinates, as it cannot organically learn robust new reasoning pathways from limited demonstration pairs.

### **4\. Parameter-Efficient Tuning and Adapter Composition**

Techniques such as LoRA, QLoRA, and IA3 reduce the trainable parameter count by introducing low-rank matrices or learned vectors, leaving the massive base matrices frozen. Weight-Decomposed Low-Rank Adaptation (DoRA) enhances this paradigm by separating the pre-trained weights into magnitude and direction components, applying LoRA strictly to the directional updates15. DoRA consistently closes the accuracy gap with full fine-tuning by allowing the magnitude vector to scale independently from the low-rank directional shift, ensuring stable learning dynamics16. Furthermore, adapter composition allows multiple DoRA modules to be trained independently for specific skills (e.g., summarization, retrieval grounding) and dynamically routed or merged during inference, preventing interference between tasks and facilitating a highly modular architecture within the 128 MiB TinyRustLM memory ceiling26.

### **5\. Sequence-Level Teacher Distillation**

Sequence-level distillation involves training the student model (TinyRustLM) on the raw textual outputs generated by a significantly larger teacher model (e.g., a 70B parameter frontier model). This method efficiently transfers conversational style and step-by-step reasoning protocols. Operationally, it is simple to implement via standard SFT pipelines. However, it suffers from a critical limitation: the student often learns to mimic the teacher's authoritative tone without actually inheriting its internal logical consistency. This leads to "sycophancy" and severe hallucination on out-of-distribution reasoning tasks, as the student lacks the parametric depth to support the complex deductions it has been trained to output.

### **6\. Token-Logit or Distribution Distillation**

Token-logit distillation transfers the exact probability distributions from the teacher to the student, providing a vastly richer gradient signal than hard textual labels. To manage the massive storage requirements of offline logit distillation across billions of tokens, advanced compression toolkits are employed. Frameworks like DistillKit store only the top-K logits (sparse distribution), sort them by log-probability, and fit a mathematical polynomial curve to approximate the tail of the distribution29. The residuals between the actual logits and the polynomial curve are subjected to error-diffusion quantization and packed at the bit level, compressing the distribution storage down to roughly 114 to 300 bytes per token29. This highly efficient storage mechanism allows a 1B student to align deeply with a teacher's uncertainty, secondary predictions, and common-sense probabilistic mappings, making it a strictly superior operational choice to sequence-level distillation30.

### **7\. Hidden-State, Attention-Map, or Intermediate-Feature Distillation**

Hidden-state distillation attempts to align the internal activations and attention matrices of the student with those of the teacher. While theoretically powerful for transferring deep logical structures, it is practically prohibitive when the student and teacher have vastly different dimensionalities, layer counts, and attention mechanisms. For example, mapping a 70B teacher's hidden states to a 1B student requires complex, computationally expensive projection layers that often destabilize training31. Crucially, because the TinyRustLM SLM1 header strictly requires equal attention and KV-head counts (rejecting GQA), aligning its attention maps with a modern GQA-based teacher model is structurally incompatible2.

### **8\. Preference Optimization: DPO, ORPO, KTO, and SimPO**

Preference optimization eliminates the need for a separate reinforcement learning reward model by optimizing directly on paired or binary preference data.

* **Direct Preference Optimization (DPO)** utilizes a fixed reference model to compute a log-ratio penalty. While effective, it doubles the memory footprint during training, requiring both the policy and reference models to reside in VRAM18.  
* **Simple Preference Optimization (SimPO)** eliminates the reference model entirely. It utilizes the average log probability of a sequence as the implicit reward, incorporating length normalization ![][image2] and a target margin ![][image3] to ensure the winning response outscores the losing response without artificially inflating the length of the generated text19.  
* **Odds Ratio Preference Optimization (ORPO)** combines SFT and preference alignment into a single monolithic stage by appending a log odds ratio penalty to the standard negative log-likelihood loss, making it exceptionally resilient to highly imbalanced data where negative examples far outweigh positive ones21.  
* **Kahneman-Tversky Optimization (KTO)** operates on a binary signal (desirable vs undesirable) rather than paired preferences. It utilizes a human value function modeled on prospect theory to heavily penalize losses (undesirable outputs) while exhibiting diminishing sensitivity to gains, closely mirroring human cognitive biases regarding risk22.

For TinyRustLM, SimPO and ORPO are the recommended methodologies, as they sidestep the memory overhead of DPO while providing robust resistance against untrusted memory injection.

### **9\. Quantization-Aware Fine-Tuning and Post-Quantization Recovery**

Because the target TinyRustLM runtime is strictly bound by a 128 MiB transfer limit and exclusively supports f32, q8\_0, and q4\_0 within the SLM1 container, post-training quantization often destroys the carefully tuned logits of small models1. Quantization-Aware Fine-Tuning (QAFT) simulates lower precision during the forward pass, forcing the model weights to converge to a state resilient to quantization noise. Advanced methods such as IR-QLoRA utilize Information Calibration Quantization to ensure that the quantized parameters retain the original unified information perspective, preventing the severe degradation commonly observed when aggressively quantizing 1B models to 4-bit architectures17.

### **10\. Curriculum Routing and Tool-Use Training**

To prevent arithmetic and factual retrieval from dominating the language-model curriculum, the model must be trained to emit explicit syntax strings (e.g., \<CALCULATOR\> 45 \* 12 \</CALCULATOR\>) that the host browser runtime intercepts and evaluates deterministically. This requires a curriculum that introduces tool-use organically, presenting underspecified scenarios where the model must ask for parameter clarification before invoking the tool. The evaluation must rigorously test the model's ability to halt generation, wait for tool resolution via the WASM ABI, and seamlessly integrate the injected result without relying on hardcoded benchmark-specific prompt branches.

## **Compute Plans and From-Scratch Scaling Analysis**

To baseline the true cost of from-scratch training against continued pretraining, the exact architectural requirements must be quantified.

### **Model Architecture and Parameter Breakdown**

Assuming a standard decoder-only transformer design analogous to modern small models (e.g., 1.0B parameters), the architecture requires an embedding dimension ![][image4], ![][image5] layers, and an intermediate feed-forward dimension ![][image6]. Because the SLM1 format rejects GQA, we assume standard multi-head attention with 32 attention heads and 32 KV heads2.  
The vocabulary size ![][image7] is a massive driver of parameter count in small models. Assuming a highly optimized BPE tokenizer with ![][image8] and untied embeddings, the embedding matrix and language modeling head consume ![][image9] parameters. The attention and FFN layers consume approximately ![][image10] parameters, bringing the total parameter count ![][image11] parameters24.

### **FLOPs, Memory, and Infrastructure Constraints**

The training FLOPs required per token is approximated as ![][image12]. For a 1.0B model, this equates to roughly 8.99 GFLOPs per token24. If pursuing an overtrained regime of 3 trillion tokens, the total compute budget equals ![][image1] FLOPs24.

* **GPU Count and Type:** Utilizing an interconnected cluster of 64 NVIDIA H100 GPUs.  
* **Utilization Assumptions:** Assuming a Model FLOPs Utilization (MFU) of 40%, each H100 delivers approximately ![][image13] effective FLOPs per second.  
* **Wall-Clock Time:** The cluster will compute ![][image14] FLOPs per second. Processing ![][image1] FLOPs will require approximately 12.2 days of continuous, uninterrupted wall-clock time.  
* **Optimizer State and Activation Memory:** Using AdamW in mixed precision (bf16 master weights, fp32 moments) requires 16 bytes per parameter. The static optimizer memory alone consumes roughly 24 GB per model replica24. Activation memory, even with gradient checkpointing, necessitates at least 4-way tensor parallelism to avoid Out-Of-Memory (OOM) errors during the backward pass.  
* **Network Traffic and Checkpoint Volume:** High-bandwidth NVLink is required within nodes, with InfiniBand HDR across nodes to support the all-reduce synchronizations. Given the iteration risk, checkpoints must be saved every 1,000 steps. A 1.0B model in full fp32 training state requires approximately 18 GB per checkpoint.  
* **Electricity:** 64 H100 GPUs operating at 700W, plus host systems and cooling, consume roughly 80 kW per hour. Over 12.2 days, the run consumes roughly 23.4 MWh of electricity.

Given the staggering costs, tokenizer development overhead, and the high probability of encountering catastrophic overtraining6, training from scratch is highly inefficient. It is mathematically possible to achieve, but operationally unlikely to outperform a fine-tuned, permissively licensed base model that has already absorbed a 10 trillion token pretraining cost.

## **Corpus Specification, Contamination Controls, and Cognitive Liberty**

The corpus design for TinyRustLM must prioritize density, diversity, and strict adherence to the UAIX Cognitive Liberty Charter. The data mixture cannot be indiscriminately scraped; it requires rigorous curation to ensure that the model acts as a neutral, autonomous tool that respects user agency, mental privacy, and freedom of thought9.

### **Target Scales**

* **Minimum Viable Scale:** 100 billion tokens. Suitable for SFT and preference alignment on an already competent base model.  
* **Recommended Scale:** 500 billion tokens. Required for aggressive CPT to shift domain knowledge, unlearn toxic behaviors, and execute vocabulary pruning.  
* **Ambitious Scale:** 2 trillion tokens. The absolute upper bound before progressive sensitivity and catastrophic overtraining begin to degrade the downstream plasticity of a 1B parameter model5.

### **Dataset Composition and Task-Family Ratios**

The recommended 500 billion token corpus must be sourced from permissively licensed datasets (e.g., Wikipedia under CC BY-SA, OpenAssistant datasets under Apache 2.0, and synthetic data generated under non-restrictive terms). The exact task-family ratios are structured as follows:

| Task Family | Ratio | Core Objective and UAIX Mapping |
| :---- | :---- | :---- |
| **Factual Explanation & Honest Uncertainty** | 20% | High-density encyclopedia extracts. The model must explicitly rehearse stating "I do not have access to that information" to prioritize honest uncertainty over hallucination. |
| **Positive Open Conversation & Greetings** | 15% | Human-like, concise dialog. Must avoid overly verbose, obsequious, or artificially emotional responses. |
| **Summarization & Strict Formats** | 15% | Manipulation of existing text into JSON, YAML, or bulleted formats. Builds instructional adherence without requiring parametric memory. |
| **Practical Judgment (Fallbacks)** | 10% | Scenarios where requested tools are missing. The model learns practical workarounds rather than crashing or issuing generic refusal logic. |
| **Underspecified Choices & Priorities** | 10% | Prompts lacking necessary parameters. The model learns to ask clarifying questions based on user priorities rather than guessing. |
| **Conflicting Sources** | 10% | Data containing contradictory information (e.g., manager vs. customer). The model identifies the conflict and asks the user for precedence, upholding self-determination. |
| **Latest User Correction Override** | 5% | Dialogs where the user corrects prior statements. The model explicitly prioritizes the most recent user intent, respecting mental autonomy10. |
| **Retrieved-Content Prompt Injection** | 5% | Injected text attempts to overwrite instructions. The model fulfills the harmless outer task while ignoring the malicious inner payload41. |
| **Balanced Lawful Adult-Policy Inquiry** | 5% | UAIX mandates lawful adult inquiries be answered neutrally and factually without moralizing lectures or paternalistic preambles9. |
| **Narrow Concrete-Harm Boundaries** | 5% | Strict refusals mapped only to universally illegal/catastrophic harms (e.g., violence, exploitation). Nearby lawful help must be provided where applicable23. |

### **Catastrophic Over-Refusal and Linguistic Audits**

Models fine-tuned on safety data frequently suffer from catastrophic over-refusal, generalizing strict boundaries to benign queries. To combat this, the maximum refusal-record percentage in the dataset must not exceed 2%. Furthermore, for every refusal, there must be a positive-rehearsal ratio of at least 10:1 featuring structurally similar but benign prompts that are eagerly and thoroughly answered.  
Capability-disclaimer language frequently leaks into unrelated answers during SFT43. To prevent this, the training pipeline must implement automated linguistic audits. Scripts utilizing regular expressions and shallow dependency parsing must continuously scan the training corpus to flag and remove phrases such as "As an AI...", "I cannot help with...", "It is important to remember...", and fabricated tool access claims43. String checks alone are insufficient for final quality evaluation, but they serve as critical data-filtering mechanisms to strip moralizing preambles before they poison the network weights. Furthermore, anti-repetition penalties and clean stopping tokens (e.g., \<|im\_end|\>) must be rigorously injected into the formatting data to ensure bounded outputs.

### **Decontamination Controls**

To ensure the integrity of performance metrics, strict contamination controls must be enforced. Deduplication must utilize MinHash and SimHash algorithms to remove near-duplicate documents. Crucially, exact and normalized five-gram overlaps between the training corpus and sealed evaluation sets must be aggressively stripped46. Normalization includes lowercasing, punctuation stripping, and stemming. The training pipeline must categorically reject training on evaluation prompts, close paraphrases of expected answers, or model-specific prompt branches.

## **Evaluation Design, Failure Analysis, and Rollback Rules**

Training loss is a mathematical metric of next-token prediction accuracy; it cannot be accepted as behavioral evidence. The evaluation protocol must rely on empirical interaction against defined data splits.

### **Splits and Regression Testing**

1. **Public Split:** Used during training for continuous loss monitoring and basic sanity checks.  
2. **Seeded Paraphrase Split:** Used for interim checkpoints to test generalization beyond exact training strings, measuring true comprehension.  
3. **Sealed Holdout Split:** Strictly isolated until final candidate selection to prevent implicit overfitting by the research team.

Whenever targeted behavior improves (e.g., successful tool delegation or json formatting), ordinary-conversation regression tests must be executed. A model that perfectly executes a JSON payload but suddenly fails to say "Hello" fluently has suffered catastrophic forgetting and must trigger a rollback.

### **Multi-Target Comparison and No-Cheat Requirements**

The final artifacts must be evaluated across all implementation boundaries. The unadapted source base must be compared quantitatively against the adapted source. The resulting model must then be subjected to post-quantization recovery into the SLM1 format (q8\_0 and q4\_0). The exact quantized artifacts must be run through a native runtime evaluation and, critically, a browser runtime evaluation mirroring the actual end-user experience (scalar CPU, main thread)2. Hiding remote inference, relying on canned outputs, or hardcoding benchmark-specific logic into the browser execution layer is strictly prohibited.

### **Failure Analysis and Rollback Rules**

A training checkpoint must be immediately rolled back if:

1. The five-gram overlap detector flags contamination in the evaluation splits.  
2. The model exhibits a refusal rate higher than 3% on the seeded paraphrase split for lawful, neutral prompts.  
3. The average generation length inflates by more than 20% compared to the unadapted base (a common failure mode in poorly tuned DPO).  
4. The SLM1 format internal checksum or tensor dimension shapes (e.g., mismatched KV-heads for non-GQA runtimes) fail strict initialization inside the TinyRustLM WASM execution environment1.

## **Implementation-Ready Training Recipes**

### **Recipe 1: Conservative Adapter Tuning (DoRA)**

Designed for rapid iteration on specific downstream capabilities (e.g., JSON formatting or logical routing) without risking the integrity of the base model15.

* **Model Assumptions:** 1.0B Permissive Base, unquantized.  
* **Sequence Length & Packing:** 2048 tokens, utilizing sequence packing with 2D attention masking to prevent cross-document contamination.  
* **Algorithm:** Weight-Decomposed Low-Rank Adaptation (DoRA).  
* **Rank & Alpha:** Rank ![][image15], Alpha ![][image16].  
* **Target Modules:** Query (![][image17]), Key (![][image18]), Value (![][image7]), and Output (![][image19]) attention projections.  
* **Dropout:** 0.05.  
* **Optimizer:** Paged AdamW 8-bit to minimize memory pressure29.  
* **Learning Rate & Warmup:** Peak LR ![][image20], cosine decay schedule. Warmup spans 5% of total steps.  
* **Batch & Accumulation:** Global batch size of 128, achieved via gradient accumulation.  
* **Loss Masking:** Assistant-only masking (loss is strictly computed on the model's responses, not the user prompts).  
* **Epochs:** 2 epochs.  
* **Compute Budget:** Approximately 10-15 GPU-hours on an NVIDIA H100 cluster.  
* **Adapter Detection:** Before merging the adapter into the base weights, the magnitude vector must be inspected. A near-zero directional matrix combined with an unchanged magnitude vector indicates a no-op adapter. Conversely, an exploding magnitude vector indicates a destructive adapter that will corrupt the base weights upon conversion.

### **Recipe 2: Full-Parameter SFT and Continued Pretraining (CPT)**

This pipeline shifts the foundational reasoning and domain knowledge of the model prior to instructional alignment.

* **Model Assumptions:** 1.0B Permissive Base.  
* **Curriculum:** 80% new domain tokens (UAIX aligned reasoning), 20% high-quality general replay buffer to prevent forgetting.  
* **Sequence Length:** 4096 tokens, fully packed.  
* **Optimizer:** AdamW (fp32 master weights, bf16 gradients).  
* **Learning Rate & Warmup:** Peak LR ![][image21] for CPT, dropping to ![][image22] for SFT. Warmup spans 2,000 steps to prevent shock to the pre-trained weights.  
* **Epochs:** 1 epoch for CPT to avoid overfitting; 3 epochs for SFT.  
* **Mixed Precision:** bfloat16 for activations and forward passes.  
* **Regularization & Clipping:** Weight decay of 0.1, gradient clipping at a max norm of 1.0.  
* **Checkpoint Cadence:** Every 500 steps.  
* **Compute Budget:** 200 to 400 GPU-hours depending on the token volume.  
* **Early Stopping:** Triggered if loss plateaus on the public split while validation perplexity degrades on the seeded paraphrase split.

### **Recipe 3: Teacher Distillation \+ Preference Optimization**

Leverages the logits of a larger teacher model combined with reference-free preference optimization to maximize logic within a highly constrained parameter envelope.

* **Phase A: Token-Logit Distillation.**  
  * **Mechanism:** Utilizing DistillKit to extract logits from a 70B teacher29.  
  * **Configuration:** Top-128 logits stored per token. The exact top-16 logits are stored in bfloat16, while the remaining tail is approximated using a polynomial curve fit (terms 0, 1, 2, 3, 4, and ![][image23]). Residuals are error-diffused and bitpacked, resulting in roughly 300 bytes per token29.  
  * **Objective:** Minimize the KL-divergence between the student's output distribution and the compressed teacher distribution.  
* **Phase B: Simple Preference Optimization (SimPO).**  
  * **Algorithm:** SimPO, completely eliminating the need for a frozen reference model20.  
  * **Reward Formulation:** Length-normalized average log probability ![][image2]20.  
  * **Hyperparameters:** Target margin ![][image24], scaling factor ![][image25].  
  * **Loss Function:** Modified Bradley-Terry pairwise loss20.  
  * **Batch & Accumulation:** Global batch size of 64 pairs.  
  * **Compute Budget:** 50 GPU-hours for distillation; 20 GPU-hours for SimPO.  
  * **Detection:** By relying on SimPO rather than DPO, the pipeline halves the VRAM requirements, keeping the process well within the constraints of a standard multi-GPU workstation18.

## **Phased Milestones and Conclusion**

1. **Phase 1: Base Selection and Curriculum Auditing.** Select a 1.0B-class permissive base. Execute the linguistic audit to strip moralizing disclaimers and establish the baseline MinHash deduplication pipeline.  
2. **Phase 2: Continued Pretraining and Logit Distillation.** Process 200 billion tokens utilizing sequence packing and DistillKit compressed logits to inject reasoning and factual uncertainty.  
3. **Phase 3: Format SFT and Tool-Use Curriculum.** Fine-tune for JSON structuring and external deterministic calculator invocation, establishing the syntax bridge for the WASM runtime.  
4. **Phase 4: SimPO Preference Alignment.** Run reference-free preference optimization to reinforce latest-user-intent precedence, untrusted-memory resistance, and adult-policy neutrality.  
5. **Phase 5: Quantization and Deployment Validation.** Execute QAFT, quantize the artifact to SLM1 q8\_0, package into the 128 MiB boundary, and perform rigorous browser-level regression tests against the UAIX parameters.

By delegating arithmetic to external tools, maintaining strict adherence to the UAIX Cognitive Liberty Charter, and utilizing advanced techniques like DistillKit and SimPO, TinyRustLM can achieve robust conversational logic and practical fallbacks within its heavily constrained browser ecosystem.

## **Machine-Readable Appendix: Budgets and Assumptions**

JSON  
{  
  "report\_metadata": {  
    "research\_date\_utc": "2026-07-11T21:54:57Z",  
    "target\_model\_scale": "0.5B\_to\_2B",  
    "primary\_runtime": "TinyRustLM\_WASM\_Scalar\_CPU",  
    "artifact\_format": "SLM1\_custom"  
  },  
  "compute\_assumptions": {  
    "flops\_per\_token\_per\_param": 6,  
    "h100\_effective\_tflops": 400,  
    "adamw\_bytes\_per\_param": 16,  
    "checkpoint\_size\_1B\_fp32": "18GB",  
    "from\_scratch\_1B\_3T\_flops": "2.70e22"  
  },  
  "corpus\_ratios": {  
    "factual\_uncertainty": 0.20,  
    "positive\_open\_conv": 0.15,  
    "strict\_formats": 0.15,  
    "practical\_fallbacks": 0.10,  
    "underspecified\_choices": 0.10,  
    "conflicting\_sources": 0.10,  
    "latest\_user\_override": 0.05,  
    "prompt\_injection\_resist": 0.05,  
    "lawful\_adult\_inquiry": 0.05,  
    "narrow\_harm\_bounds": 0.05  
  },  
  "distillation\_config": {  
    "framework": "DistillKit",  
    "exact\_k\_storage": 16,  
    "approximated\_k\_tail": 112,  
    "polynomial\_terms": \[0, 1, 2, 3, 4, "sqrt"\],  
    "bytes\_per\_token\_budget": 300  
  },  
  "preference\_optimization": {  
    "algorithm": "SimPO",  
    "beta": 2.0,  
    "gamma\_margin": 1.5,  
    "length\_normalized": true,  
    "reference\_model\_required": false  
  },  
  "decontamination": {  
    "overlap\_threshold": "exact\_and\_normalized",  
    "n\_gram\_size": 5,  
    "hashing\_algo": "MinHash\_SimHash"  
  }  
}

#### **Works cited**

1. Implementation operations \- MiRust, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
2. Implementation \- MiRust, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
3. Known Pretraining Tokens for LLMs : r/LocalLLaMA \- Reddit, [https://www.reddit.com/r/LocalLLaMA/comments/1pqjqqy/known\_pretraining\_tokens\_for\_llms/](https://www.reddit.com/r/LocalLLaMA/comments/1pqjqqy/known_pretraining_tokens_for_llms/)  
4. Neural scaling law \- Wikipedia, [https://en.wikipedia.org/wiki/Neural\_scaling\_law](https://en.wikipedia.org/wiki/Neural_scaling_law)  
5. Overtrained Language Models Are Harder to Fine-Tune \- arXiv, [https://arxiv.org/html/2503.19206v1](https://arxiv.org/html/2503.19206v1)  
6. Overtrained Language Models Are Harder to Fine-Tune \- ResearchGate, [https://www.researchgate.net/publication/390176308\_Overtrained\_Language\_Models\_Are\_Harder\_to\_Fine-Tune](https://www.researchgate.net/publication/390176308_Overtrained_Language_Models_Are_Harder_to_Fine-Tune)  
7. ICML Poster Overtrained Language Models Are Harder to Fine-Tune, [https://icml.cc/virtual/2025/poster/44907](https://icml.cc/virtual/2025/poster/44907)  
8. Article Overview: Overtrained Language Models Are Harder to Fine-Tune \- Medium, [https://medium.com/@axegggl/article-overview-overtrained-language-models-are-harder-to-fine-tune-e5e728e365ee](https://medium.com/@axegggl/article-overview-overtrained-language-models-are-harder-to-fine-tune-e5e728e365ee)  
9. Cognitive Liberty \- AI Ethics Lab, [https://aiethicslab.rutgers.edu/glossary/cognitive-liberty/](https://aiethicslab.rutgers.edu/glossary/cognitive-liberty/)  
10. Cognitive liberty and the psychedelic humanities \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC10192549/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10192549/)  
11. Cognitive Liberty \- Stimpunks Foundation, [https://stimpunks.org/glossary/cognitive-liberty/](https://stimpunks.org/glossary/cognitive-liberty/)  
12. Cognitive Liberty: Interdisciplinary Perspectives \- Transformative Ideas \- Duke University, [https://transformativeideas.duke.edu/events/cognitive-liberty-interdisciplinary-perspectives](https://transformativeideas.duke.edu/events/cognitive-liberty-interdisciplinary-perspectives)  
13. ICML Poster Scaling Inference-Efficient Language Models, [https://icml.cc/virtual/2025/poster/43602](https://icml.cc/virtual/2025/poster/43602)  
14. Researchers warn of 'catastrophic overtraining' in LLMs | VentureBeat, [https://venturebeat.com/business/researchers-warn-of-catastrophic-overtraining-in-large-language-models](https://venturebeat.com/business/researchers-warn-of-catastrophic-overtraining-in-large-language-models)  
15. \[2402.09353\] DoRA: Weight-Decomposed Low-Rank Adaptation \- arXiv, [https://arxiv.org/abs/2402.09353](https://arxiv.org/abs/2402.09353)  
16. DoRA: Weight-Decomposed Low-Rank Adaptation \- GitHub, [https://raw.githubusercontent.com/mlresearch/v235/main/assets/liu24bn/liu24bn.pdf](https://raw.githubusercontent.com/mlresearch/v235/main/assets/liu24bn/liu24bn.pdf)  
17. Oral 6B Low Rank Learning \- ICML 2026, [https://icml.cc/virtual/2024/session/35286](https://icml.cc/virtual/2024/session/35286)  
18. Direct Preference Optimisation (DPO) — Knowledge Base \- Yobitel, [https://yobitel.com/knowledge-base/dpo-direct-preference-optimisation](https://yobitel.com/knowledge-base/dpo-direct-preference-optimisation)  
19. SimPO: Simple Preference Optimization with a Reference-Free Reward \- arXiv, [https://arxiv.org/html/2405.14734v1](https://arxiv.org/html/2405.14734v1)  
20. Simple Preference Optimization (SimPO) \- Emergent Mind, [https://www.emergentmind.com/topics/simple-preference-optimization-simpo](https://www.emergentmind.com/topics/simple-preference-optimization-simpo)  
21. Welcome to my blog\! \- Odds Ratio Preference Optimization (ORPO), [https://thinamxx.github.io/blog/posts/ORPO/orpo.html](https://thinamxx.github.io/blog/posts/ORPO/orpo.html)  
22. KTO: Model Alignment as Prospect Theoretic Optimization \- arXiv, [https://arxiv.org/html/2402.01306v4](https://arxiv.org/html/2402.01306v4)  
23. meta-llama/Llama-3.2-1B \- Hugging Face, [https://huggingface.co/meta-llama/Llama-3.2-1B](https://huggingface.co/meta-llama/Llama-3.2-1B)  
24. [unknown\_url](http://docs.google.com/unknown_url)  
25. Continual Pre-training of Llama-3.2-1B with FPT AI Studio \- FPT Smart Cloud, [https://fptcloud.com/en/continual-pre-training-of-llama-3-2-1b-with-fpt-ai-studio/](https://fptcloud.com/en/continual-pre-training-of-llama-3-2-1b-with-fpt-ai-studio/)  
26. Task-Specific LoRA Adapters \- Emergent Mind, [https://www.emergentmind.com/topics/task-specific-lora-adapters](https://www.emergentmind.com/topics/task-specific-lora-adapters)  
27. Learning to Route for Dynamic Adapter Composition in Continual Learning with Language Models \- arXiv, [https://arxiv.org/html/2408.09053v1](https://arxiv.org/html/2408.09053v1)  
28. Learning to Route for Dynamic Adapter Composition in Continual Learning with Language Models \- ACL Anthology, [https://aclanthology.org/2024.findings-emnlp.38.pdf](https://aclanthology.org/2024.findings-emnlp.38.pdf)  
29. arcee-ai/DistillKit: An Open Source Toolkit For LLM Distillation \- GitHub, [https://github.com/arcee-ai/distillKit](https://github.com/arcee-ai/distillKit)  
30. Identified-Set Geometry of Distributional Model Extraction under Top-K Censored API Access \- arXiv, [https://arxiv.org/pdf/2605.10407](https://arxiv.org/pdf/2605.10407)  
31. Reinforcement-aware Knowledge Distillation for LLM Reasoning \- arXiv, [https://arxiv.org/html/2602.22495v3](https://arxiv.org/html/2602.22495v3)  
32. SimPO: Simple Preference Optimization with a Reference-Free Reward \- OpenReview, [https://openreview.net/pdf?id=3Tzcot1LKb](https://openreview.net/pdf?id=3Tzcot1LKb)  
33. ICML Poster AlphaDPO: Adaptive Reward Margin for Direct Preference Optimization, [https://icml.cc/virtual/2025/poster/45946](https://icml.cc/virtual/2025/poster/45946)  
34. ORPO: Monolithic Odds Ratio Preference Optimization without Reference Model \- OpenReview, [https://openreview.net/pdf/b3df73666e35c2d0e7b536c6e4ee392dcae59f6c.pdf](https://openreview.net/pdf/b3df73666e35c2d0e7b536c6e4ee392dcae59f6c.pdf)  
35. ORPO: Monolithic Preference Optimization without Reference Model \- arXiv, [https://arxiv.org/html/2403.07691v2](https://arxiv.org/html/2403.07691v2)  
36. Model Alignment Process \- Prem AI, [https://www.premai.io/blog/model-alignment-process/](https://www.premai.io/blog/model-alignment-process/)  
37. Kahneman-Tversky Optimization(KTO): Revolutionizing Language Model Training with Prospect Theory \- Medium, [https://medium.com/@SpielmitDaten/kahneman-tversky-optimization-kto-revolutionizing-language-model-training-with-prospect-theory-99f30c50481e](https://medium.com/@SpielmitDaten/kahneman-tversky-optimization-kto-revolutionizing-language-model-training-with-prospect-theory-99f30c50481e)  
38. Compact: Common-token Optimized Model Pruning Across Channels and Tokens \- arXiv, [https://arxiv.org/html/2509.06836v2](https://arxiv.org/html/2509.06836v2)  
39. Compact: Common-token Optimized Model Pruning Across Channels and Tokens \- arXiv, [https://arxiv.org/html/2509.06836v1](https://arxiv.org/html/2509.06836v1)  
40. DPO Fine-Tuning on GPU Cloud: Direct Preference Optimization Training Guide (2026), [https://www.spheron.network/blog/dpo-fine-tuning-gpu-cloud/](https://www.spheron.network/blog/dpo-fine-tuning-gpu-cloud/)  
41. Protecting LLMs from prompt injections and jailbreaks: New OpenAI Paper \- Community, [https://community.openai.com/t/protecting-llms-from-prompt-injections-and-jailbreaks-new-openai-paper/727636](https://community.openai.com/t/protecting-llms-from-prompt-injections-and-jailbreaks-new-openai-paper/727636)  
42. Nita Farahany on Cognitive Liberty \- Strong Skills, [https://www.strongskills.co/podcast-feed/farahany](https://www.strongskills.co/podcast-feed/farahany)  
43. LLM Firewall Using Validator Agent for Prevention Against Prompt Injection Attacks \- MDPI, [https://www.mdpi.com/2076-3417/16/1/85](https://www.mdpi.com/2076-3417/16/1/85)  
44. How to prevent LLM Jailbreak attacks \- TrustAI, [https://getcertain.ai/2024/08/10/how-to-prevent-prompt-jailbreak-attacks/](https://getcertain.ai/2024/08/10/how-to-prevent-prompt-jailbreak-attacks/)  
45. Prompting the Privacy Leak: Red Teaming LLMs for Sensitive Data Exposure | by Judy Gong | Medium, [https://medium.com/@judy.gong97/prompting-the-privacy-leak-red-teaming-llms-for-sensitive-data-exposure-5ac4245580ef](https://medium.com/@judy.gong97/prompting-the-privacy-leak-red-teaming-llms-for-sensitive-data-exposure-5ac4245580ef)  
46. The Compendium of Scientific, Medical, and Media Findings Demonstrating Risks and Harms of Fracking (Unconventional Gas and Oil Extraction) \- Physicians for Social Responsibility, [https://psr.org/wp-content/uploads/2020/12/fracking-science-compendium-7.pdf](https://psr.org/wp-content/uploads/2020/12/fracking-science-compendium-7.pdf)  
47. AlphaDPO: Adaptive Reward Margin for Direct Preference Optimization, [http://staff.ustc.edu.cn/\~hexn/papers/icml25-AlphaDPO.pdf](http://staff.ustc.edu.cn/~hexn/papers/icml25-AlphaDPO.pdf)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAZCAYAAADKQPsMAAAEQ0lEQVR4Xu2YXahWRRSGl6igmEUdrQztDyNKpLA/Sg2JECOM0MTIIvFCofLCDhRF4U9EliBZERGBStRFCXVT+BNxoi5Cr5JOF0mEIomGXYgKXYS9D2umb858e76/czwa7Adeztlr72/vPeudWTOzzWpq/udMl16X3pful8aE+FhpqfSh9LJ0aYjXnAcwYb00UbpJ+lV6IpxbI80zN+QV6QepL5yrGWEWS6ek28IxI+Mb6UppQPooxG+U/pAeCscdMU161XxIbZRmDj1dZK202bxncI9UvBg9Axi690jvmA/nh5NzF4LrpcfzYMLN0lvm+aC30/sjk6S50vhwTJu+kiZIs6XrQvwWcyMeDMdtuVvaJ803d5mbnpP6rVH7Suw0v7ZKg9IU83u8IH0n3WA+VD8xb2RszGhAYp6RvpX+MX/3Kqjxv0i3S5dIr5nn57L0osAM6WfpkfyEeFHaa36PtuD0l9Iqa/RQErVfOiPdEWJV8ABMi0mN2iEdM28QcI/j5rUzwrA9LC1KYucbjHhUuk86atVGkNhD0ookdrl0QHouiQGd6G1pmTV3WDr3p9IVWbwIJYSEpDUPmPHp1c8nsRx+S5lhSKYsl7ZY4+WooTyD6yOTpe+l7dbciBTKwFV5MIHfXmPdlbnY5iojMCDvgDyDzjZgjd6NCeTogXBMaR4X/mckvWH+7hhBiW4LN9wm7bGhiWJYYQR/S/CQOVlslnlPiMMYkxg1uRE0aMC8p9HjSkyVPpPuzE+YJ2il9K51V+JaGUG9z40ArmWUM5J57rPmkzb3Yj55KcSZH5hbrg3nnpLush7B2V3mdXTB0FMtIbmfm0/KaWzAykbk8SpYLu42H+6RXk2AVkYQKxkR4wvMc5POh4wOOt0XWZwSyPv3BInkod1Opk+aj4Y4RCE2Ok94N0ZAasZwTICSEfGd2hkxKlBSWBN/bF7jOoXf/Wi+oUmhvv9mzQnv1giIZrxnvZsAJSNoL22vSvioGkHDPpC22tB1cyew+uFF05URlBJeireCkcDi4U/zlU+vlIyAUsJL8REnmsCkE1cgLPcW/ndFa0qTXJxv8oRHI1g5sYJqByawfGQkMBFSi9M5oxtaGcEKr6odXDuset8JNLJfWhf+j1BmliTHlB+Wiuk1EId0XFXksPI6aW5shI3eoLmB7UhNiOXoauvdjFZGsDFjIk53w3Hlh/Kl+ohBI1dKZ80dP5LoL2uUmj7pJ+lv6d4Qi8Sk5r0+wucS7p1+UmAXf8Ka75XD+7EbZuOUzwm9mhGNYG+QdyrayWZ2QxKrev8RJ75U/nkCpT2cUvK1+ZdG1soppQk5hZH1u7Raetr8EwIJzhORc6u0yZpNiLCXYd3eyQ6WXk5C06Xnaemg+TeiCHsW3pXPMo+Z73XetPI7XFTQEHbmrRJLb2MThPj/YoZyy/zIJxE+e9TU1NTU1NTU1NTUOP8CdAPm3wFBbNIAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAaCAYAAACD+r1hAAAAvUlEQVR4XmNgGAWDDXAAsQMQuwIxJ6oUWA6E4cAJiF8D8X8o3gPE/FA5ViCeCMQqUD6DNhDfB+JWINYH4gggfgTE5VB5SyBuAWJGKJ+hD4iDYRwoABmyAYiFgbgLiHWQJQWBmBlZgAFiGsgZINtAGlhQpbGDUiA+wwBxElEgCIhPMCA8TxD4AnEOuiA+UAPENuiCuAAoILYBsSa6BC5gDMS7GSAaiQLRQDwJXRAfKARiD3RBfAAUkfCkMNwAABlBFUJo3zKLAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAaCAYAAAAtzKvgAAADiElEQVR4Xu2YW4hNURzGP6HIXTKExi0hityaQsgDySWXmHjw4vLmUhKFB3kQUghJRMklJTVESUIIuUVTSg0ppfCCQi7fN/+9OvusvfecPWrOSdZXv84+a+29zlr/9b+sfYCgoKCgoHJpKnlHfsf4SN5H199JHRniHqiAWpNZ5GDEQtK+6A5TZ7KGHCFbSO/i7oRakbVktd+B5Fj9irvz6yj5QSZ67X3JRfKJjPf6yqG2ZD/ZRgaRFeQLeU6qY/fp+mnU347MJC/R9JwnwMba6LVrrKtkBmxzpsDGnh+7J5c6kVvkBenh9UlVpJ5cQbqntKS0uGukT6xtGSya5AxtInR9Prp22oHsOXch12HjxA0rLz6ApBE1j5uw53JrGPmA5MTiOgG7R/eWU1q0M6KTougteQXb9IGwdOZ7nowjjxzjtct468kuJD22I7lBlsfaJI3xEPZ7uTUHNvlVfkdMMuxXMs7vaGGNJU/IylibwvN1hK6nk19IGnY2bF1LvXalgN2kBknDyrHkYKotG2CpSBuxiRyK+nNrH9Lzq1MHWDim7X4lpHlqvhdg+dQZMMuw8XaFsgpSf9hafMNKysuqKXr2PtkL+61mpQHn+ln5VVJ+a4CFm8IuS7XkTTNQaA1ufDK/5EHHUVxMXbrwDeQbVp63jiyKvmcZVtJp6RsKJ6WtSM/VmcqTX12oXYJ5SCW1ALbBmpOT8mUew2oj9sA2R8oy7CjyiMyDpYCfsHFOohnGLZVfXZWUYf1KWW7JMFqwn+d9A6a1KzIPw1KAU5phe8J+I77W4eQxzAY6HeRSqfw6GhZ2yktup7Mkb1YxyUsVSo/pJKPeRiF1KLp07OqKQs7NMqyMNJI8Q3Eqci9Bn6PvigKdf3VG9tOi5lqP5G+kqtT5tRfs7KbClSdxV8PeivIyl3RvfLJpaVylKn06ab7abK3B1QA5SVyKwqaOiGkeq814QLrF2iRF7ilkR3aRRsC80c+v8iLllwZyBvmM2lJym6vXbN/bzsHmrUVvJ/dQmKvWoP7T0T1pUkrREXJzrE1nZL1lLY61SUPJXTLAay/SJNgZ0FU8JWcduN2EVQ3rYOc9TbqSkje5efrozcpJBr1MzsLC+RgsdchQvpRH76BQlITW7QpiDaxAqlgtITthaWBa1P/fSX/WKLyVZvSp738refxk2Fj6zFsLgoKCgoKCgoKCgv4p/QFWd+MPX6ew0AAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAaCAYAAADv/O9kAAAB9UlEQVR4Xu2WTShFQRiGP/mJUvITSQr5SbGyEEkpCxZKsVCWFsSOhQ0bVixtlFCSbOxslJK9jRQbKSQWsmOB/Lyvcdw5c++dcyj3FPPUU8w39555587MGRGHw/Gf6IC38E3zCe7CQq1fVFTAAbPRoA7OwyXYB9P9ZTvL8BV2mYUIqIejcA++wDV/+YtMOAUPYBOsgttwRO9kI1/Uh89hmb8UCQzeC1vhlSQPzoCnolYF6Ra1YpP1j4MPuoNbMMOoRUkpvJDEQcpFhV7Q2vJErYBmrc3KoKiZmjQLEWMLzn3PMXPs2aL65vp6hICz9gzbzELE2IJzzAw+C9fhGDyEc6L2fiDe/j6DJUYtDNPw8hvuwIKPTwZjC842Bt+X2C9dA2/gxOf/VoL2d5aEnMFfIEzwYa2NE7APj2GR1p4Qb3+PmwWQBmdgg1lIEbbgfP1y3D1amxf8QdTrzQq/INn+roYrMMcsaPBhHGBYiyX8BcMWnD/Uj4Pb3t9c3rwJcUXYaIT935DvWttE6tiCt8BH8Y8v9FLnrHB2zP3NBzI0D6NKrT3VeME3RG07HU4eb2lcsd7YAw+3Tngtsbs5r4W8IVH+7bVvSuID77fh+Myx3MMjUSvMgwfzCVyFQ5/1RYnuME4pDNkuahvVSvzKcDgcDofD8Qd4B/bffAVPnW5uAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAaCAYAAAD2dwHCAAADGElEQVR4Xu2XW6gOURiGX6GInBIJ2VJCKXJKSYjiQoRySu2SuFCKEIULuXAhkSg3DiUuHC5RLnZcKETKoRyySZTCDQo5vK9v1p41a8/8e/avZtNeTz3Zs9aaZeb71/q+NUAkEol0XlbSD/SX5ye6wR9UEX3oJnqc7qLDs90ZetJG2i9od/hz7UyuQzTHKtiYw3Qu7ZoZUYIu9AT9CZugIxhBr9L5dAidRe/TJd6YAXQ5PUk/0pewsSFj6SO6Gda/Prke7Y3pSy/SdXQU3UN/0MtJX2n609u0mQ7NdlWCfrwjyAZKKJDXkb6MgreITqbnkB+83rSJXoGtLNGNnqdnk7/FRnoa6YrUM+yF7bztSVspJtHPsP/ATV4l7oUbs81/nusOHRy0i1PID552jnaQ+n0UkPewVSnUr0BpdTqm0C/0Gu3ltddkNVpPVCVuZXyjW2l32ErYQY8l/SFFwVsIe5e84Kld/WIxfUjntYxIF1ET7AdtE5fvvtMZQV+VTIXlMb3gLXqQXkJx/qk3eLUWiFtEB8KOIly+e4787ZGHKuGrdqj8o3zVFrPpV6RVfzfSvBVSFLyR9DU9A1sYwq3sWvlMP5Ly6xNY8SpFR+c7xwR6F7adtF1V+fSySup5ASwKngK2jT6lDUnbNKTHsbzguXueIc2JpejofCcGwQLnV9tx9B4s+avqhhQFT+ispmqqVd9MjyKtpC7n+SylN5AGuxSKeD35TslUD11WBafW4XMBfUAHBu1KI4+Rv1pqBS8PHYL9autQ4HS2c2lF76YF1aNlRAH1nu/G02XtUMHJ23oOrQY9h57HRz+ucpcOuSFFwVPqUcK/gLTYuKOQf84TKlKa3y9KCu4hpPmykH8l3w2DfU3o68FnDL0JKwIhCp4Kg+71cYFSn7tPq+stnZhcCwVJOe4dssVNuXGfN64Va+gbpFVNapK1/qCKmQ57QRWIFXQ/bMvO8cZo+ys36dvbPbcKiwLlf4tvgQVd20/b9QWy8wgF339/X93336HD8UzYVte/uq4HbbkGWOX+m3kikUgkEolEIp2E39QEwh3bDd8rAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAZCAYAAADXPsWXAAAA7ElEQVR4Xu2SvQ4BQRSFr/hJhEQjRCeiUYqIQnRansBTKEh0otIrFURCI/EKm3gIlUKlUlIocK5Zm9m7uzKh3S/5mnvu7iRzhijEjyzcw6fmHba1nQTciJ2Bljt0SIVLGdhE4RqOYFxkDjV4hVsYExnTgCuYlIFOCZ6hBdPu6P3hAlbF3EMeHuEJFkTWg2MYEXMPfLoFL7CizYtwB3PaLBC+B76PG6zbMz55CrufJRPmpBrippgWnNGXNvwYkvpJH2ZIvY2ya8MAfmAPeCBVp2zJiM9bYfld/ARXyxVPyKDOIPgCmzAlg5CQf3kBE1AmXeAJjTAAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHMAAAAaCAYAAACEuGN0AAAE4ElEQVR4Xu2ZWch1UxjH/zJkliFS5BgimTN8mX1CSSTzdCeRhHwZcuMVkjFzSMZMZbgQnwvxxoUxbkgZ8pEhigtFIcP/9z57tdfe3znn3We/eA+tf/3r7LXX3mut53nW/3nWPlJBQUFBQUFBV2xivmb+mfFX87Cszxrm460+l2T3/22sap5kDlrtCTuY15v3msvMzZu357CKucS8zbzLPNpcvdGjG9YyT1OMxbuwG/PLsYt5ormpYtx1zQPN0/NOFdrzOqhqmwgsBic91L5RgQk+Zl6ufoteKDAac7zV/Mr8ydyz0SNwvPm0uZvCYO8pgvO4rA/Gudi809yq4g3mC+YGWb/5QN9nzLPMbc0rzN/N5dW9hFPU3AjwC3P3rA9Yx3zAfNbc0dzJfMc8PO/UBRgGAz1lrta6B4iWRxRGXQww7pHmIQqjDXPmZgqVYXekaN7O/Nr82NyyattZYbD1qmvA+3Emhu+K88yHzfWra8a8SuGsS1MnRRB+WvEN8wLVzyTw7C3mq6oD4SKt/K5O2Mb8xpxVyEAOFvqguUerfbHA4oY5MwUkRsOxACM9qjAKwQAw7rvmxtV1AqqEAbuC/rw3f2Zv82fzJcVOA4w3n0PS3M/O2rYwr1H4ZiKweIzwuVbOMWeYV6qHdv9DGOVMIhqJRarygExGx6jgAPM38y1z+6ptYL6pyQL2WPMDNWUwOWVW9Ry6OHNGMSfmxnP4YM28wyTgBbPm9wq9ThgoJInkPS0Y5cxh2NB82/xWURgBcj4FCw4mn96skOc8r/YFRQ3vvSlrw5kE1IuKDfOZIs+mQgmnPa9Y07XmPYrdTmo4Vz02EXmSfIlEIBWAl1xnHpM6dQR5isRNku/KU+ee7IZJnHmyoiih+s6Nsrb5pOqC5ENz1+x+H6AM5LyPFEVVAs582dyousY+X6qeU9pIzOM+1TXLUvNHTW7/OfCiXI6oBu/Q4lSv49DVmRgUJ82ouQZ+36go6PZTVLysm3cic32AU3DOJ2oqG2Dn5ZKZ8jgO3Vq1M/9Q80iI1JL22LUTSy5GSgmdKONsSRRNG7o4k/ljBCrH9rnvHPMV1TmNAu8yxQ5GCvtU7ByJkOpBq30UUh6nKKNQomBqryk5E7brmHlBzmAAKigcmldWkwDjkWOZQFe2K+hxmM+ZyZFIbJJWDt+c65Lhhq2No0Yfw+HI5apllLWQO9lNFFici59TM0iSM5MKoortNS3ImWxxtjrShARNYuAcGOwo84QJ2JamcRjnTCSU81q7mLlaUQskSRv29YX7ryu+igHeRVCOSzP7KCQz/0jAWvi4QSCl6jZ3ZpLZfA2cb39RU+aTM3vJbBoYLmndmybgzLxQS8DoMwqj5MUVuWmF6vPaMoVDcwegJlSSM1kbFSm7J2/LgdPIkd+pOd4PCnUDjIHjBtU14DdVLRV1ChSC5n01jzBLtYACKEUCXzGSPE0L2O1PKAyVKlDI1x2OFiAFY34/keMJxxTADrlb4eDzzTMV0nu/6oM+uFChVNwbplJJKocx3/l7KT5S8CmU8VYo1pIHEzhUEXgEFf34TeD18gVRsr+aC/o/g897HPxh+tTXBpJ7uxZuE54/QjHWQKMdlPcbNaeCnthXi/sPUcHfBKQV6eXfi4L/OChwDm43FhQUFBQUFBQUTAn+AgZUHIUjQmo9AAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAZCAYAAACCXybJAAADVElEQVR4Xu2XS8hNURTHl1BE3hHR95FHUvIImRiIPIrklZCJAQMlhJhKIgYk74mBKNQ3ISFuDCgmyisGHn0lhBSK8vj/79qru84+Z5+LIedfv+49+3XX2mettfcVqVSp0r+qrmA5OAb2gFHZ7lL1AOtF524Pz14DwXkwN3yP6R7GdQBTwAFwCCwB3UIftRZ8Aj8dfG4H38P342CwTShTT3AF7BA1YBx4CBb5QQmNFh27UdSBNeF5pBszEXyWrLEezukE9oOdokaPADfAfdAiWXFjOW9e1D4cPAEfwOSoL6et4A7o7dpWgEdggGuLxQ2qgUuikULR+HPgdPhO0bi7opHgqYGropvOzXsHLkvjzdMGOsc370V7i5ymbI7//ZzoKB0+GbVPEg2X+VG71wzwQ/JzaRQdoCPUBtGxXnT0LBgTnplOr8E90De0LRR14ER4NpU5zTb21aSxeTnZDseGW0gy3FKyH4jnxkZNAH0a3fXc3S359Okl2fw+KLqpdN4rXt/EOUxR9m2K+jIy52LDU+1ezZxmnheJ0XMEdI47gmj8LPAe7JX8OFt/lTSKIevANvARbJb8nIxShv+O00NFK+cpUUMpy2muSeNiMXSvgalxRxDT4CV4A46Cftnuusxp5r+vETdBm+gJYPYUao78vdNceAt4ClpDG3+Qbyjl9DLRilzkjFdHsEu0Esf1oCy8aQ9TgumTLGQp51LtsWjcOtG381z0fLW8io1ihWelZyQkDXJiMf0iukn9XXvKaYqb+QB8lXQ0yTDwSvLOmdM8E/9UPGJ89TaliiY1VnQeP03M1ReidtAeU5nTdoym+uuyQRdAF9fOkPoWPk08ZgZJNn/3id622EfZekXnpKVS0YnAjYjTzDY+3sAyp63OlL5paqVoeHICRacYorel4QwLEM9Qv5g5yB+xuTyGGDnjw7MXb16pXGfbWzDbtdEujj8s2Q1MOc3rL4sq+3jcxZueEcs7F74OFog6zLzgddREBy+KXvNaXDvPw1uiNyGG5zMw3fV78QhLOc3NZXTwhrZadF1ejs6EPop3b1Z1rmGwaPKFWfF8DJaK1pqm4tvlfXkxmCZNzjknzmsV3axm8/jnYabk/5CY/FpkSKa3UqVKlSpV+r/0C/dp2fSX12vtAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGwAAAAaCAYAAABSHbkRAAAE3UlEQVR4Xu2YW6gWVRiG3yijE3a2wqBdRFF0uKiMICkjOlDddLJSKuiigqCDHdSb9o0XZimmF5IXVhBFRBARhUXsDlRkJEllRDeJGRQWRIoKWt+zv1nOmvXPnr3mB3cQ64WXvf+11sya9b3faUYqKCgoKCj4f2CO8XfjPxXfMx4ezU83ro/m4ZvGI6M1U4mDjbcbR5LxXBxkfMT4QDphONv4jPEF4y3yvVJgm7vka1h7rvyeYIbxczVtBbcZ/6j+/1b+/G33zgYb8gB7jLuNlzWnx3Gz8Q01xZwqsOdNxpXGX4w7jBc1VuTjUvn1T0VjnP9e44/G2cbTjK8YX1bzvEfLnfVu4ynGC40fGxeoFg2catxqHDMeFY0j0iK5cNh7WjTXC8caXzI+LL/ZajUfADxmnJeMTRUw2vXGK41Pa3jBMPiH8jPGgnEv7vlQNHaGPDLuiMaYXxz9BucZNxpPj8YQ82cNCgaw9QZNHBhZwFNWyDfaLPeO+AEOMa6t1vXBMRW7gGMcmg52AEMPIxj74HTLNBhhz8tFJIoDMPSY8R3jYdUYTr1UTWfGZggW26ZLsHDfdL9eIHLur/4fld8s9rYT5A+Ld+SAlPCZ6hyOE1ylwagFrJ2fDnZgWMFIhc/KvToVjLOlBgyGxfAIAJbI1yFwqOFz5aLGwnQJdqY8crEJZx8Ky1UbgBD/0/iFPIWAy42rqv8nA+nrRXkKI2cj0gXy+5H/44dk7gn5oXMxjGCcg5oxojr95Qr2l+roobZR51j7k1zAT6rxGEEwGhAE4jdkb6LxS+NZ+1f3RKhfRBEg/b1q3Ge8rhoj+nLrF7n/nnRQLt6dxu1yQ2BAHv511Y6Rg76C4RSPGm+rfrcJRp1CBBqrAM7xqwb3Ose4RXX2wHZ00jGCYHTf6+Rnhawlsh7X4DXZCPUrTlcIhWAIR8T0qV8Yf2Y6GIFUgidTvDFE3/a2r2CzjM+p7sjaBOOZP5Abl3XYYqHcBvFeZAciCgemU2QO0Uj/x1drQFdKDFGK6Ocnc1mI61cAByCFkRqpPXhGbv0CHBjReafDELy3TPQ6wEGvSAc70EcwjLVGngoD2gQDx8lbeV4bMOiD8pYdwyMAz/+2mtch4FsarPldggHszTUEBBktGxiW2nRJOiFvBLjp9/LOqA8WGL8y3id3iHeNP6i98cCArMtFH8Hw4E1ybw78TX6uv6vfV+9f3QQl4jvVXSIZBiFJiTEQEsfEqQMmE4wMwzOMqX1+QqT1K8ZJ8nzLjXPrF+A6vgCkL4V8Efha7pEcnkNRMz6VF+ZcdAlGeh1R3Ya3oS3CiJSP5F9AgkOxjoYjvIfxG+eltqUgvdM5Bkwm2KiGjDA8ns7tiHSiwqi8SUi9qguIcWM6WAFvJPcTbdQHUg5C9gGG3qn2rECkTmYIruP6+AU4iBiuw9loEtarNjh/+b1IzSxxolwYXhcCJhKM666Vlxoakty+YDwNkBJCp7PbeENjhYMWn3DvU78OBGhUXlP9PS6Q9xleSQJINbuMT2ow9fKdj+Zgr+rrSY/YAqOSthGJbIIw7xtPHr+yBpngG/k86xCdtIkTsh970JTsUb0H+22tyP/M0cQN/Q5W4CCqLjbeKn9HSgUPIO0Skay7Rv/dR/CCgoKCgoKCgoKCgoKCA4R/ATlSIX5YUqICAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAaCAYAAABLlle3AAABy0lEQVR4Xu2UPSi+URjGL2HwlUQsDEalKBZl8pX+JVJK7BjsiMFisFC+BiaLj4z/gcFg9LEYyCSLMkhKGSgf1+V+zvue5/G8b2aeX/2Wc85z7nPf9zkPkPDbKaBDdJ3O0erw9BeFdIu+0Q/6TrtDK4BepOflK+0IrQioo+d0ChZsgJ7SSn+RRxO9gwXdpnnhaZTQfdoWGU+hjS9gAXNoET2kz7DN4ximk/SYPtL68DSq6C4ti4ynmKAPsGwd7bBNVfI4FmAHGoeVcDY0C7TS5chYilLYac9oeaAyz/UXRdDpN2kFraW39AqWnWMUVo1YlJ2yVOBVOg074SVt9Nb5NNBFWCvkCizbwWBe/d0I1sWiEql3uhD9wZg2moedPu4GKwNl4mihL/QA1g5VQJXI2E8XVJlpsaMHdnp/c4frp0OBFFCBdYCs/RQqwRM9osXeuAuqE/v4/fRRabVepR5Dln4KNf8aPw+qDNdgLfDRBdS71vM5QfglfENN1+PW7fV7kKm80X76uOcT3SuWTnqPdJ8yXST1bof+88Z83PNZik7EkU9n6A0dgV0CfdwczOsPtYf0v1T+R7gdwj2frP2MUkP7aBcsUEJCwh/lE1KJXSZamgfNAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEcAAAAZCAYAAABjNDOYAAACkElEQVR4Xu2XS8iNQRzGH7nkFqKUS5FYSIrcNjbKggXKJQsbJbFBlESxIAvJxhK5bVzLQsRGR4SFja0opBRhg41cnuf7v5P3zDvD+853DuXMU7++78yc3nnn1/xn5gA5PZmBZDmZ43cUmUKOkRF+x/+efeQ6eUlWeH3KYHKGtMjI9q7eiCbdQliO2o4jUc5omNnZfsdfyjCykYzx2l1GkR3kBNlPJrR39yUmR+W0jaxEgpwBZC/5TOZ5fd3MWLKenCUfYSURmrQm94RsJkNh+8pTsrD8JYTlDIJJHV+0q7+RnEXkA/6NnFVkPrmIsBxN7hS5Wvzvcpjcgq04l5CcZQVKYzkqp5Ow5VpXjiYlYtGpMRG2IuvmHMJyppE3ZI/XvhrV9/XlDCenyd2i/Rn5Qq6QccV3otHL7yJrYIP7g8Uyg1yDLXc/OhUOkN3ojJyl5DuqciTgB9lQavPl+NEzWqi5clSzOvc1oSZyFN0lbqNdUKoYJSbHSYjJce3ah87D5vAQ9g7an1w2kcfkHWzOsY2/LyonldLU4nNTOUpZUH/EKDE5eq86cjoWvfxOsq7UliJHkaA7sH0rVYwSk6OyD0nompy5+FVOLqly9Axdrp7DNs/UxOTEJMTa+52t5JXHJ9hgb8k92L3gT5GYo7AVM4vcQHiTrpOYnMXkK6oSnBydWl1P05VTFuNKaSbSBcXkTCIvYKuznC3kPWzMrkc/3HQHWOB3BCIxR2D7lr/HpAqSnNdksteu5x8ij2CHiKLxL5MLaL8Ydjy6R6iUtETFN/IAvy+rJWQ7qmJcppODZIjf4UVjqIRdSbvxJUml7yIpN8kl2JGti919VEX2bHTrVsmvLf7qc05OTk5OTk5OOT8BiXWVN+NVhkgAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAZCAYAAADKQPsMAAAET0lEQVR4Xu2YbcieYxzGD23K2vK2zUxeHtLEWhTRhEwoH0hMLb4sWmqtLRZGqQdp8UHeElKSRFKU2ES29mkhofFhkhH5oHwQSvJy/Ppf53Of1/Xc18t9P3u2WddRR933eZ73fZ7//3H+X65L6tHjMMB881bz2Mr4PHOd+ah5nXlEebrH/sJC81XzbfMrc2k2d4z5unmxudz81Dwjm+8xCzjf/ExlITaYTyuiYLF5myJCOoM/u9983nzAPLM8XYsV5k3mCYrNF5iXmrfkiwowf5H5pPmMeVkxdjAwYa6pDmY4S5Fa8MfNGu7MqhCkqg8U/ttobjEXFXOdcKH5vsKB55rvmP+am9XuKIxhbc7vzfPyRYpDvmi+aZ6tCNtPzKvyRbMM9l1vfmj+bb5Unp7CjYqUgw1crIcU/iHt5KgKscT8RiEGa/n9DsUlbQVKv6UoOnOKMXLgR+bvis2acK1ic7jb3GQeXVoRYj5u7tLAmDsVot2TFh0AIMT1ivz9g4YLcYr5tcoRfZz5sSLt5KgTItnE+D5FwW4Fi78zf1VEQ8J9CkfhsCYgRJszOTCi3p6NnWw+rPZCRiRhYB0Q+SQNLlEXJJuHCYEA1QvIHq+YOxURklAVIqWmXAj2ye2uxZHmE+Z7Khcd/qzLje0ixKT5l3mJwhD2OSpf0AAKHl3IBdUJhYPWmk8p7OiKJiGoX1UhAGt/UvniVIUAk4pLDBj/0lw5NTsi5ppvKPLo5eWpaUAIDrldEZbfKnrodENxODUH47aazymijPAnX7fVIED08P/UsoRxRQBNQjBWJ0Qax6a7zG2KC4avrinWnaaog1cqijbrutg4FHQ2bErH0GYkQlD8ji++022Rf+/WoIvaqYiuFxQig1WKdNgpf6osxkxEAHVCpLO2CdEGzkQ6rT7ojQSKKXnuZUXOawO3I08zOIl8ihina2DcP4pbkpCcQbR0TVNJDPr0cUUAdUKkHD/M4aMIMWNg2LPmYxreN3cFhyYCCNc645IzYJ5jm4DIpLWfFZ3PuKgTAtQ5vG58vyOJcK8G+Z127+qpFdOxzPxR8aifC5eEIG0BUlLViFGFQATaRyLhVEUezmvGKGgSgk6uelbAWqKcqJw1YORm847icwJt1w3Zd9IWrWJaw2E5dC4Ec6Sm3Bge+v5UdE0Jo6SmXISUjk7U+GI0CUHNoknJ02hqOLqcdWxg5FrzD4XiPBUn/qKB8xaanyscurIYQxicPlF8B3yme8oLPU+We1Ruc1epW7HmfHRXPBBWa8K4YiQhOHt+8QB28jA7mY2lBqTplciMkQ5VfU0B876ZovuuuVfRoiXQ3/OGkd6Z9yv7zNc0/XXAFQpjaGFZx2eisOqIKs4xH9R0ERLo1ngnlLq2JnDL2Zcbn2z8zfxC8c4sAZtow+n8Viueqh9R/RkOGVCQqSW8PphQvXPzdbxKOJTxfzprjx49evTo0aNHjx4HEv8BTabsg1OkmvUAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAaCAYAAADmF08eAAACN0lEQVR4Xu2WS8iMURjHH6HI/VIISSRKIZeV9C0UIgoLyk5uK+lbWGJhYWFDESkkJSkrOwthhURhgwWJUoiyIfH7z3POzDvHMc0szPcuzq9+zZzLO3Muz3POa1YoFAq9Mx4P4nk8hgtwWFsPs+G4Ec8Et+Poth41ZwnewQGchPvwBw5aa7Ij8TQewXm4B7/jM5wT+tSeU/gLN4eyJvsQP+GiULceb+PMUBa78DdewBGV+tpy0nzAu0N5HN7Db+a7LQ6HPppUZBa+w9c4rVLfhnJiA84OZX1uwhnNHv1DYTnVPAfFYvxiHs5jQ90KfIJ7Q1lorG+C2XHr4XPmSa8VUeicNV+1Fzi31bXvaAOu4ltcmrSlrMafeBNHJW0NFO9KeIWFwuOieV4oB6p5kWOn+SC69RHObzzZmTF4zfwZheI6a+1wDkWBxq2dX5W0NTlgPsmt5iuildHpptDVIqTHer9ZiO/xivkC5NiGH3Bt2pBDIfvcPD/qhBZa4avDZ3/SJrSDj3Fl2pAjnmz6wV52ULmgxO9WnYYKs3+htkPBar94yl6u1AlN8r610kHXiq6Zic0eCcpD5aNytRd0OeuNpFu34OTGk3mWm1/8Ut8jmqAmqqiL6L9vhM+IolFvU9q4LNX8HEp0rb3ESzgh1E3BB+YHzbJQNx3v4mdrP+w+4nXr8MJwFJ+a/+hQo/v8FZ7AHXgLv4b6SAzlnMcr/f5CuRYv4zqg8QyYh/sa65zXhUKhUCgU/jN/AEn/cagav30XAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAaCAYAAAAEy1RnAAACVUlEQVR4Xu2WPWsUURSGXzGCEkHwKxEjRomFWCpJI2rEhFgkETSo+AMUkRSxsEgKG0kTRSwEvwgWIYKBFGqwSCFWIilTCBYSETtTCCmior5vzhxyd3bH2S0ysHIfeGD33tnZe+4598wAkUgkUjzraAe9R+/TY8lYFnvpM7ozPVEvNNJxOk0P0kN0jnaFFwVsgF2/QHel5uoCZfMufUu3JGND9A+94RelGKA/UcdBH6ZL9HIw1kJv0f3BmNNKH9KXqDHoJtpLT9CNpVOFcxOWtaN0MyyIrDWprG/TdvoUVQbdTKdgZ+cCHaZf6JFkfjc9kHwuAgX3CpbpUfoAVtof6VWUN7KzsHmNVxW0ut08rDS0Y6KBTtLXdBMdge14Fhfp5xpUM2pb+WVllNk3sPP7GLYe0Um/077ku9D6H2H13OcGrZvppsrqvtScmoX+oAfWEf2mReBB/6angnEFooBUBaoGJWkM9khzcoPWY+AbrLR9N51LsPJSwOdTc2uNHlWzsP9XQ3M8aA9KGfeydnKDVtNSCYUd0vG5F7AS/xfadf1Jtaph+lHKQhWYF/QdlB+dH7B1f4W9pGgDSzgNu0ABptHYL3o8PVEBnatzNdhPt678Mhs11GWU9hIP2su7ErmZ3gPriNeCMZXKSfoBqxui5+P24Joi0GukGmz4ItKJ8kYWorVPwHqU1pyJAvxEn9Mn9B29TnfQGfoe1sWVzaLR2hSAHluDyWetLTzDzhW6CEuUVJlXLG9nPWxnt6H0hhpXhvPO31qiRXfTM7DKjEQikUgk8p/yFx08fpcNiwVMAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABT0lEQVR4Xu2TvytGURjHH2EQMhApo8WPRWGSwaDUa2MQFoOU0SCbksHAIKX8AyaDySZlkZkJoWRRTCaFz+M5h3vPPYd3MMmnPt17z/f0vOc95zkif55GHMYx7MDKfBynAgfxFA9w0nmIl9j3NbVINa7htRQnaraDT9gTZB/ohG18xP4g83SLFdgSW2mOOXx1zxSteIvn2JQN2vEez7A5GwT4Aqq+f7KMb+75HW14J0GBOjzCFxzwgwk013nHWO8Hk8uKsCiRlfoCuaoRGvAEH7ArG+hu6q5eYUs2CJgSO6WFMKjCXbHz1XPWflgR67p19619obk2kn4X0M7yEyZw3I1P4zze4AbWuPEo2roXYru8Ktb/+2IrGRLrPL1M0RV4NOwVu32jOCtWzFNyednM4LPYxm3invzwN0JGxM5d1T1KXbIktbgk9uudQfbPb/EO1Mw/xHP0yeAAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABGklEQVR4Xu2TsUoDQRCGRxLBYBHSmMLGIhEEO1ubiEUeQVGfQEgbQppACnvBzt7GJhDfwWhhE0glaGOhaKpUouYbdpfb7BlcsArcBx/H7gx3c//tiWT8lxq+4Y/nB554Pd2g3sNVr57iEr9xPyxAFQd4jCtBLUUJ7/EJ12dLsod93Aj257KF73gjyZNz2MAzLNi9KI7EZNG0a83jQkxuS64plnP8xF3cxAe8xaLfFIPL6xlP8UrMjfRj1L2+KFxeX9jGZTwQ89p643zS+jcur5Yk+ZRxhGPctntR6Plyefl0xDxEr1G4vB7FTOOjE+lkOmFY+5UdnOC1pLPRte7rdHry56K/zIvM/m+veGjra3gX1IdYsfWMjMVlCn+/PCJqzkDYAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABKklEQVR4Xu2TsUoDQRRFn0QLQQuJEBRsJE2wShErsRCxs7PzB9KnskuTwiaFCEIaSz8hkEqw006QFApio6CoHyCo5zoZnJ3ZhNSaA4fA3Je3s7NvzP48RdzBPaxgIRvnM4WbeIld3B/Yw1us/ZamzOAh3ltaqKyD71iNsh9UcIJvuB5lHr3GKx6b22mGOn4OfoexgFd4g4thUMZH7GMpDCJ8gwdcCoMmfmErXMxhFZ8sajCH5+a2v+0Xh6BcdRc47xfVSR11ODqkURyZ22kzXPQNkveKWDE3By+4FgY6TZ3qqAb6ZAfmnt6IMpvGM/zAjSjzaC40QBokzUuCJksFp5YWbOEztnE2yjJodO/M3QE//7oL1+aaJJOXh26bvoRu3y4u25h/nPC/+QYcoDPSDoMsgwAAAABJRU5ErkJggg==>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAZCAYAAAB5CNMWAAACoUlEQVR4Xu2XS8gOURzGH7lEhCjlUiQWsqCIDfKVlIWUFLH5KLFyTaIoZCGlWEhIZOGSYkNuSZGQjY2FUkhZoYRCLs/Tf4535syc752Z13wszq9+vW9nLu9/nvnPmfMCkUhF+tBNdIG/IZJnNv1MF/sbIlmG0X30CSqENZruosfpHjopu7lXGUS76XBv3DGUboTVqppVex30+K2ms+hdlAxLO9+ic+k0epX+olthJ+wNRtDl9DT9QF+hOITx9CldSwfSRfQ57BqqomtdQYegZFi6i1foGto3GRtJH8Oe4xnJWNMorCV0Jj2P4rD60ZP0UvLdsZ9eh12LmAfruiKP0imwgHYmn6XDUkEq7CMsaYdOpO7akhorQhcpQ+gGjEG1Dj2D4rAm0rd0uze+FNVvbBd9BAvpAf1Gn9GVqX1y9KeH6Q1ki1NBCssvzGcyvQx7PHx07t10G/5OWHq1/0S+JnWEal3ljZfFNUzbzipCLa5W/0HnZzcVMh0WdjqwukGJUFgulFBY/ngZJtAT9Cu9CZsDK+HWHXrGddFlSAfWSVAiFFao2zsJqyO07rhNz9LB3rZ2KLA7sDtVNygRCkvzZ1Eo/yQsdcQxegitN0sVdPwR+gI2GdclFFYolNB4Y7igdqC1hNArduGfPXpGxx+EddRU2FqtaNIvQyisOfQ78qG4sPRWbBw9LlqAbk6+O9ahXAHpoNzxCrpuYKGwxtKXsO5NozrfwX6zUXRx3fQLfUNfp3wPu5s9oaAOIB+0qBuYwlIt47xxnV//4x7C5lah379IzyG7UG0Et8ZQG/tqAdhu7umiG5APyqH/mHvpAH+Dxyh6j35C6/e1dFFo61P7KaRr9ALsNX+K3kc+2EiC5lSt1pcln26OjUQikUgkEvlf+A2wwpCW+2lgTwAAAABJRU5ErkJggg==>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAZCAYAAAB5CNMWAAACy0lEQVR4Xu2YSchNYRzGHxkiQshchljIgjJFUgolYyJio2RYERlKIWQhO0pCMiwMKVkQJQnJsEAhiULKSjYsJMPz9D/Hfc97z3vv69x79ZXzq1/fve85373/85x3OhcoKYlkFl1CB9MZdGH2cInLNvqL/qDnaf/s4RKXdXSc31iPoXQ5rDu2p53pGLomef2v6UJX0p5ee0p3uoEepTvogOzhaBTWXNjw0/W2yx7OZwr9BuuSqV/pHPekFtOLLqUn6Wf6DvkhDKFP6WrYjZxNX9GJ7kmRbKSbYZ+znW5FRGDqii/oS/qE7kZ+oa1EYS2g4+k55IfVgR6nF5PXKfvoNViPFNNgvS7Pw3RUcp7LBPqcDvMP+CisQ35jJLpIGULDeiAi7pjDKeSHNZx+hE3MLotgI+Fv5p9u9AydmbzX/75P/takkbBG0kuw4eHTke6kW9CcsLS8/0R1WPNgU8cKr70Wfehl2Fwl9Nka3v3+nBFAYemCT9PXsIR3odKt6zGWXkc2sKJBiVBYaSihsPz2eiyDzVuL6S1EztEK6wEdkbzvTR/CxrguOgY3sEaCEqGw0n2RH0rRsIRWXH1P9Kqvi+vqtWl10Ao52WuvhQK7SY+heFAiFNYm5IfSSFhNIb2LKjAWhX6QvoFNxkUJhRUKJdTedDTkHtFntK/THuryIRTUAViPGk2vIH/SjyEU1lT6HdU1pWFpVWwpKkiF+WFpGKqA+U5bCDeodOhpL1M0sFBYg+hbWO91WUs/IX//1FS0uTtCJzltPehteiN5XQsFtR+2qvhzVNHAFNYH2OOXiz5/L72PSl36/gv0LLIb1Zahi7kD6x2r6GN6D9XF5jGdrkd1UClaYffQTv4BD/Vq1fAFlUcu/Rqg0PQMl6KQrsJ+JdCjzgl6F3G1Ng3dIT0maM+hHqGdd1tFtWm7o1r1ty3XWlJSUlJSUvJ/8hvsOoxWa0VeMgAAAABJRU5ErkJggg==>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAZCAYAAAB5CNMWAAACdElEQVR4Xu2YTahNQQDH//IRJSR53qN8xEIS9R4L6ZVCCZGIsrERWZCX95R6FmSht7OwQCLJR+r1FsRGisXbPmWjFFJWsmElH/9/c0Zz5s64585xL4v51a9z78z5mPO/c2bmXCCTqchWuo8uopvp7nJ1xuU0/Um/03t0Qbk643KU9vqFrbCEHvALO8wMeojO8cots+gJeoUO0+5ydWUU1g6Yx28NnVSuDrOSHqNPYbrkzXJ1R5hL99Mb9DN9h3AIi+kEPUyn0230NV3v7lSRk/QUzHnO0CFUCExhKd0N9AP+XVi7aB+9i3BYU+g1+qD4bLlAH8P0SNEP0+tCXoa5X5919BVd6lfEUOPUyFbC0k3KGJNpDyr8Yg66fiisZfQjzMDssod+RWvjz0x6i24pvuvY98W2EilhraCjMI+Hz1R6lg7i74Sl6f0HGsPaCTOrHfTK/8Q8OgYzVgmdW4931+89mpASllhLn6AcWGpQIhaWDSUWll/eDE1kGrf20md0e6m2CalhCTewOkGJWFh2XeSHkhqW0Iyr62iQb4k6YQkFphn1KtKDErGwBhAOpU5YydQNSz3qEn0DMxinEgsrFkqsvK3UCUtBjcD0qFX0IcKDfhViYW2k39AYig1Ls2LHSA3LDco+elrLpAYWC2shfQvTe12O0E8Ir5/ahg3rNqqPNwrqIsys4h+TGpjC0uJY/wa46Pzn6TidXZTp+vfpHZQXqm1Daww1Tq866s7yC31JVzv7hdhEj6MxKMtyeo5O8ys85tPnMNe1bVB71C69w1kU0iOYfwn0qnOdvkBjsJkCvRVopa31kbb6nslkMplMJvM/8QvDvYLhp2OBWwAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAZCAYAAADNAiUZAAAB4UlEQVR4Xu3UP0iVURjH8cd/JZZDmUqYi4PWIqW1mEODDpHk0OAg/sGiBjWkSBGChlKoIUECRVCwWoIaJIIGB8GIQApEEEQCB8HJ0cGt749z7vV63ht2u76D4A8+6H2fc+8595znHrMjmpwMZB19yBk0ZSDrFOE5HmUg61Thux3Stv1L8jGCjrAQZ2rxAyfCQlzRRDPoCgtx5hoWzTVSmEq0+L9KCW7ifHLEf0TfcgLtwXM104CvdWIVr/AWg1hHTXJ0hrmKzygOnjfjqe118iw2cQlfsIN6X4ukEKXhQx917GtL37EPUe3/P4V5fDT3nutoRZ6vJ5OLC3iAe0EtkTp8sIPPR7/fLQyFhdRoBW14aW7r5myvERLRol7gPk4GtTC3sYvGsJAaTXrLXNeNYgPdKXXlMt7hokVvIL3uwSROY9zcZ1T4ehnGLE236xw0+Q2s4L257U7kGfos2kBKOX5j2VyH/sKCuQVoQU8s2u37ovN6gzXc8c90+0yb61xtc5gCc92qo/mKfiyZa6RPGPZj/hp1mzpNK58yt0X6/ak7z6aMC6Nd0jaq+9O9PjDqPm2vtlmTPcYVS/8tDy1a5V1s4yd6cW7fiJiic9RN8g0NFu3YWKJJdK3pBtKlfZyjkz/LKEZosVBk4AAAAABJRU5ErkJggg==>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAaCAYAAAADiYpyAAACEklEQVR4Xu2WP0gcQRTGP1EhghJUUAQFhYCIBg0B4SSFBBVFAqIJCZgm2EiwkSBB0E4bi4SoZUAsRFALKxEMiV1SiGCwlRBJI2IqCxv/fO/erXc7d+vuXrHHevuDH3gzsyf3zb43A0RERESEn3r6xhy8g1e0g5bSAlpF39K21EVhoYm+p9/pJV22TztSRNfoteE6fZiyLjRIEAPQnf0H70EIX+khPaYbtJ8W2laEkBr6F/6CWKBPzUGvPKCdtJuW2Kfic2IuCDSI5/QUyXr6hmQ9FdMv9FHic9BkE8Qi/Uz3oWX1kz6xrchAM/1DZ2krtDtLbX1MzMfoDLT7OjENfcar27Qi/qQ72QSxRCeR7AtyYvyn7bcrMvCJDhljEs4mraRztMU+HSjZBFEGe3Oshb4Zq9BTJSPlSO+osvtSDvJ2SBCODwdANkGYWN9xRKuNOVcm6B60NNyQi4v8M6/KBccM3wm/QbyjV3Q0Zcz6DlH+9sUg/QVvl5DH9KUP+5B+MjnhFoTssJSwhfQ2afipQVilsQvdNF+8oGPmYA6wglhBesNupCfQH9mQGItBTw057Sxe0wuk90JPTNFn5mCAdEF/oFyvrWP9nP6GvoGC7PQB7Me9hPWB/qAjdJ6eQa/rZpCuSAPdgl5zw0od9IreA2/lnRG5le1AA8lrhqGvVN4zTnvNwXxEznjfjSUiIiLivnID0kNnXOMkzmEAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAaCAYAAAADiYpyAAACs0lEQVR4Xu2WTahNURTH/0L5zMfTk/KSjzIwoHz1hAFSBiQUEROZKQMhol5hQCkxkUgGKGX4ohjcMmMgCgOJJJKZGFDi/7/r7nf33vfs45x6nZfu+dWvXuucfd8566y99gJqampKMpaupZtpT3Sta1hO79L9dB99TrcFd1THQnqeXqWH6azwci7+2t10fHg5n0X0Np3ixY7RR3SiF6uC7fQeXUzX0Gf0F4p9FK19RZfQSfQ0fYjwvZIoY1fogih+gjZgP1gVM+ljuoGOasX0XJ/oG9rXimWha7pnjxebRp/Sg14sST89GsWUnAf0ItoPVAVL6Q/6FpYUof9/i/6hm1qxLJQArdVvONzaBgp80JN0NR0H24tTYSWmHjHHu68KVMLaFjcQPvhNWCLUxFNcQmcihNZ+pvOieID2/2W6Cnaz/pn8Tld4940krry/wBphCr1wKhFZ8QBl6QKshFQJqogJsCZzh45p39rBdNj2+VDCU82V5dhJf8O2b2qbqnoayH7hQonQnjsQB2El+M9yqgBtzdd0ADbjpFBl64TLeuFCiTgOmx9idFR9gx1hI4X6xSA9REdH17JIvXAqPoTrDzPiC7DG8xLZ1xwq0x7Ydiqqtl8RXBK0Ldx20MSr+SDFWWS/sBLxkc6O4kOo7DVJTo7i7jxWn0jtSaFSXU93lHBlc2U++l0d2/EAdQZh9ep41YdwbIH1Es0gDp2ESqjU35moP3xF+HCaH67R+yg4jQ0zSsIA/YmwyeqLvke7Z+n00Cmi+NxWTEl5Alvv0DCme3Z5sQ40P+yFdVuVz3X6gh5Byfl8GFFZq7zdMe6rI1RHqVCZa85Rg/Q/2DL6DnbCqAK15hxyGq3fH9SIemEZzdsK/wt6t410K/JH8iYqMTc/dDWp+aHrWEfnx8GampqampoO/gJXtoiuvXPwIgAAAABJRU5ErkJggg==>
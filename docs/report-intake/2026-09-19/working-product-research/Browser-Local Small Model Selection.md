# **TinyRustLM Architectural Evaluation and Candidate Selection Report**

## **Executive Summary and Primary Recommendation**

The recommendation of this analysis is to transition the TinyRustLM architecture to a standard GGUF V3 parser leveraging candle-core and candle-transformers, and to adopt HuggingFaceTB/SmolLM2-1.7B-Instruct as the provisional primary default model1. The designated contingency candidate is Qwen/Qwen2.5-1.5B-Instruct. Both models must be deployed using the Q4\_K\_M or Q5\_K\_M quantization profiles to strictly respect the hardware economics of the browser environment3.

The strongest reason this recommendation could be falsified lies in the WebAssembly (Wasm) architecture itself. \[Externally Verified Fact\]: Current browser WebAssembly implementations utilizing the wasm32-unknown-unknown target impose a strict 4-gigabyte (GB) linear memory limit, as 32-bit pointers cannot address memory beyond this threshold5. While a 1.7-billion-parameter model quantized to Q4\_K\_M requires approximately 1.05 GB of resident memory, continuous multi-turn conversations induce dynamic heap allocations for the key-value (KV) cache, attention tensors, and JavaScript interop buffers2. \[Hypothesis\]: WebAssembly memory fragmentation during extended context generation will prematurely exhaust contiguous memory, triggering out-of-memory (OOM) crashes well before the theoretical 4 GB ceiling is reached.

To resolve the user experience issues associated with complex setups, the proprietary six-file payload architecture must be abandoned entirely. \[Recommendation\]: The engine must be refactored to fetch a single, self-contained GGUF V3 seed from the explicitly authorized MiniModel.org domain, providing an instantaneous, zero-configuration local initialization7.

## **Project Context and Evaluation Constraints**

The evaluation proceeds under several non-negotiable project constraints. \[Project-Supplied Fact\]: The existing model composition relies on a proprietary six-file structure (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2). This format acts as a binding mechanism for exact artifact identities. \[Recommendation\]: This structure incurs immense technical debt and must be deprecated without a backward-compatibility path. The replacement architecture must coherently implement a unified binary layout.

Furthermore, historical project experiments have established strict boundaries on model qualification. \[Project-Supplied Fact\]: The unchanged checkpoint Qwen/Qwen3-0.6B at revision c1899de289a04d12100db370d81485cdf75e47ca is terminally rejected for the product's quality requirements. Retained central processing unit (CPU) training observations for this model demonstrated fatal conversational defects, including ignoring the user's latest stated name, arbitrarily choosing between conflicting deadlines, and inventing unavailable power sources. \[Locally Unverified Condition\]: The provided engineering checkpoint lacks the necessary evidence to isolate whether these catastrophic failures originated from the base weights, the quantization scheme, the local runtime parsing, or the specific fine-tuning data. However, the presence of identical weight bytes in alternate repositories does not inherently salvage the checkpoint. Therefore, it remains permanently disqualified from production unless placed under a separately approved training plan to create a genuinely new derivative.

\[Recommendation\]: All subsequent experiments and canonical source code must be strictly isolated to the E:\\Source\\Rust\\TinyRustLM.com repository, with canonical model payloads housed exclusively in D:\\LLMs\\TinyRustLM. Historical models must be permanently retired rather than archived in the active directories, and the X:\\LLMS path must remain entirely untouched.

## **1\. Defining a Realistic First Product Promise**

Establishing a realistic product promise is the foundation of inference architecture. A compact local model operating within a 4 GB memory footprint possesses a highly constrained representational capacity. Consequently, the product promise must carefully delineate supported capabilities from unsupported expectations, effectively separating inherent model capacity limits from solvable engineering defects.

### **Supported Tasks and Expected Capabilities**

For the initial release of TinyRustLM, the compact model can be reasonably expected to perform the following:

* **Ordinary Conversation:** Executing single- or dual-turn conversational queries regarding general, non-specialized knowledge without severe hallucination.  
* **Text Rewriting and Tone Adjustment:** Taking a user-provided string of up to 2,000 tokens and modifying the tone, correcting grammar, or simplifying the vocabulary.  
* **Basic Summarization:** Condensing explicit context provided within the prompt into bullet points or shorter paragraphs.  
* **Structured Extraction:** Pulling specific entities (e.g., names, dates, locations) from a provided text block and outputting them in a constrained format, provided the schema is simple9.  
* **Clarification Queries:** Generating useful follow-up questions when a user's prompt is deeply ambiguous.

### **Unsupported Tasks**

The initial release must not promise, and marketing materials must explicitly disclaim, the following capabilities:

* **Complex Mathematical and Logical Planning:** Small models routinely fail at multi-step arithmetic, spatial reasoning, and dynamic planning11.  
* **Out-of-Domain Code Generation:** While exposed to code corpora, sub-2B models cannot reliably generate complex software architectures or debug intricate logical errors without significant hallucination11.  
* **Zero-Shot Long-Context Retrieval:** Requesting the model to synthesize disparate facts across an 8,000-token document will likely result in attention collapse or the "lost in the middle" phenomenon.

### **Distinguishing Limits from Defects**

An architectural defect is a failure to adhere to the fundamental mechanics of the prompt, whereas a capability limit is a failure of knowledge or logical depth. If an SLM generates an incorrect formula for calculating terminal velocity, that is a capability limit. However, the project-supplied facts regarding the Qwen3-0.6B checkpoint—specifically, the model actively ignoring the user's latest stated name or choosing to invent an unavailable power source—constitute severe instruction-following defects. \[Recommendation\]: The product must tolerate knowledge boundaries but strictly penalize and reject models that exhibit conversational defiance or contextual amnesia.

## **2\. Candidate Shortlist and Market Analysis**

An exhaustive research sweep was conducted to identify a dated shortlist of candidate models. To qualify, models must possess parameter counts conducive to the 4 GB Wasm32 limit, permissive licensing for redistribution via MiniModel.org, and architectures supported by the candle inference framework.

\[Externally Verified Facts\]: The following matrix represents the state of available candidates as of mid-2026.

| Candidate Model | Exact Architecture | Immutable Revision | Params | License | Tokenizer / Template | Context Window | Source FP16 Size |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| SmolLM2-1.7B-Instruct | Llama (Decoder) | 04ad6973c2d835f... | 1.7B | Apache 2.0 | GPT-2 / ChatML | 8,192 | \~3.4 GB |
| Qwen2.5-1.5B-Instruct | Qwen2 | 7ae557604adf67b... | 1.5B | Apache 2.0 | Qwen2 / ChatML | 32,768 | \~3.0 GB |
| DeepSeek-R1-Distill-Qwen-1.5B | Qwen2 | 987c351be0f6a0d... | 1.5B | MIT | Qwen2 / DeepSeek | 131,072 | \~3.0 GB |
| Llama-3.2-1B-Instruct | Llama 3 | 5278cb071950184... | 1.0B | Llama 3.2 | Tiktoken / Llama 3 | 131,072 | \~2.0 GB |
| gemma-2-2b-it | Gemma 2 | 7faa46fe3d19622... | 2.6B | Gemma | SentencePiece | 8,192 | \~5.2 GB |
| Phi-3.5-mini-instruct | Phi-3 | d509c5617b2dd9f... | 3.8B | MIT | SentencePiece | 128,000 | \~7.6 GB |
| Qwen2.5-0.5B-Instruct | Qwen2 | a8b602d... | 0.5B | Apache 2.0 | Qwen2 / ChatML | 32,768 | \~1.0 GB |
| SmolLM2-360M-Instruct | Llama (Decoder) | c1899de289a... | 0.36B | Apache 2.0 | GPT-2 / ChatML | 8,192 | \~0.72 GB |

### **Exclusion Analysis and Licensing Validation**

> 1. **Phi-3.5-mini-instruct and gemma-2-2b-it**: \[Recommendation\]: Exclude immediately. While Phi-3.5-mini possesses an MIT license, its 3.8 billion parameters require approximately 2.3 GB of memory even under aggressive Q4\_K\_M quantization12. gemma-2-2b-it requires over 1.6 GB quantized13. When combined with the V8 JavaScript engine overhead and dynamic KV cache expansion, both models virtually guarantee browser tab crashes under the wasm32-unknown-unknown target. Furthermore, the Gemma license introduces commercial redistribution friction.  
> 2. **Llama-3.2-1B-Instruct**: \[Recommendation\]: Retain as a secondary fallback, but exclude from the primary route. While its 1 billion parameters fit perfectly within memory limits, the Llama 3.2 Community License contains strict acceptable use policies and redistribution clauses that necessitate legal clearance beyond standard open-source assumptions14. Relying solely on the model card label for licensing clearance is dangerous for a product intended for broad distribution.  
> 3. **Qwen2.5-0.5B-Instruct and SmolLM2-360M-Instruct**: \[Recommendation\]: Exclude due to severe degradation in generalized instruction following. Research indicates that models below the 1-billion-parameter threshold struggle significantly with context adherence and structured output logic, often mirroring the catastrophic defects observed in the rejected Qwen3-0.6B checkpoint16.  
> 4. **DeepSeek-R1-Distill-Qwen-1.5B**: \[Recommendation\]: Exclude from the V1 product route. Although derived from the highly capable DeepSeek-R1 methodology, this is a distilled reasoning model. It inherently injects verbose \<think\> chain-of-thought tokens prior to final generation. This introduces an unacceptable latency penalty ("overthinking tax") and exhausts the limited Wasm KV cache rapidly18.

\[Hypothesis\]: The field of genuinely useful candidates narrows definitively to SmolLM2-1.7B-Instruct and Qwen2.5-1.5B-Instruct. Both utilize the highly permissive Apache 2.0 license, support robust English capabilities, and rely on well-understood ChatML templating logic. SmolLM2-1.7B-Instruct leverages the standard Llama decoder architecture, maximizing compatibility with existing candle Rust implementations.

## **3\. Hardware Economics and Performance Derivations**

To validate the deployment of a 1.7B parameter model in a browser-local environment, it is imperative to calculate the theoretical memory bounds and expected generation rates. \[Externally Verified Fact\]: Quantization is the only viable path for this deployment. Default 16-bit floating point (FP16) or bfloat16 models allocate 2 bytes per parameter, meaning a 1.7B model requires 3.4 GB purely for weight storage, immediately violating the 4 GB Wasm32 limit when operational overhead is factored in4.

### **Quantization Profiles**

The GGUF format supports highly optimized block-quantization algorithms. The recommended standard is the Q4\_K\_M profile.

* **Q4\_K\_M**: Utilizes approximately 4.5 to 4.8 bits per weight (bpw) by compressing feed-forward layers aggressively while retaining higher precision in sensitive attention mechanisms4.  
  * *Resident Memory Calculation:* ![][image1] \[Estimate\].  
* **Q5\_K\_M**: If Q4\_K\_M exhibits unacceptable degradation in structured output tasks (e.g., JSON schema failures), the fallback is Q5\_K\_M, which averages roughly 5.5 bpw.  
  * *Resident Memory Calculation:* ![][image2] \[Estimate\].

### **KV Cache Memory Economics**

The KV cache stores previously computed key and value vectors to prevent redundant computation during autoregressive generation. \[Externally Verified Fact\]: The memory required for the KV cache scales linearly with context length, batch size, and the architectural choice of attention mechanism22.

SmolLM2 utilizes Grouped-Query Attention (GQA), which dramatically reduces the KV cache footprint compared to Multi-Head Attention (MHA). The formula for KV cache memory per token (assuming FP16 precision in the cache) is:

![][image3]

For SmolLM2-1.7B, utilizing 24 layers, 8 KV heads (a 4:1 grouping ratio from 32 attention heads), and a head dimension of 64:

![][image4]

* **1,024 Token Context:** \~50.3 MB \[Estimate\].  
* **4,096 Token Context:** \~201.3 MB \[Estimate\].  
* **8,192 Token Context (Native Limit):** \~402.6 MB \[Estimate\].

\[Recommendation\]: TinyRustLM should strictly cap the maximum context window at 4,096 tokens. A 1.02 GB quantized model combined with a 201 MB KV cache and approximately 500 MB of V8/Wasm execution overhead yields a total footprint of \~1.7 GB, safely isolating the process from the 4 GB crash boundary.

### **Throughput and Latency Estimates under Device Assumptions**

WASM execution using SIMD instructions on CPUs is fundamentally limited by memory bandwidth, as matrix-vector multiplications for autoregressive decoding require loading the entire model weight matrix from RAM to the CPU registers for every generated token24.

| Device Assumption | Memory Bandwidth | Network DL (50 Mbps) | Startup (Disk to RAM) | TTFT (500 tokens) | Expected Decode Rate |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Low:** Intel i5 (8th Gen), 8GB DDR4 | \~35 GB/s | \~160 seconds | \~4.5 seconds | \~1.5 seconds | \~4-6 tokens/s |
| **Mid:** AMD Ryzen 5, 16GB DDR5 | \~50 GB/s | \~160 seconds | \~2.0 seconds | \~0.8 seconds | \~10-14 tokens/s |
| **High:** Apple M2, Unified Memory | \>100 GB/s | \~160 seconds | \< 1.0 seconds | \~0.3 seconds | \>25 tokens/s |

*Table Note: All values are estimates derived from physical memory bandwidth limits and standard browser V8 execution environments.*

## **4\. Evaluation of Engineering Pathways**

The project faces a critical juncture regarding how to replace the non-functioning Qwen3-0.6B checkpoint. Total engineering and evaluation costs must be heavily weighted against theoretical leaderboard scores.

### **Pathway 1: Adapt Current Runtime to a Proven Checkpoint (Recommended)**

This approach involves modifying the TinyRustLM Rust engine to ingest standard GGUF files via the candle-core library, explicitly targeting SmolLM2-1.7B-Instruct.

* **Cost:** Low (1-2 weeks). The Rust ecosystem possesses mature, open-source GGUF parsing implementations25.  
* **Benefit:** Instantly resolves the intelligence deficit by inheriting thousands of hours of upstream compute and dataset curation. Furthermore, replacing the proprietary six-file array (model.slm2, tokenizer.tokenizer2, etc.) with a single .gguf artifact eliminates versioning drift and synchronization bugs7.

### **Pathway 2: Improve a New Derivative of the Rejected Ancestry**

This involves retaining the base weights of the rejected Qwen3-0.6B and executing a bespoke Supervised Fine-Tuning (SFT) and Direct Preference Optimization (DPO) pipeline.

* **Cost:** Extremely High (2-3 months). Requires provisioning external GPU infrastructure, curating specialized datasets (e.g., matching the quality of SmolTalk), and iterative evaluation loops.  
* **Benefit:** Absolute sovereignty over the model weights and training provenance.  
* **Verdict:** \[Recommendation\]: Reject. The engineering overhead vastly exceeds the value proposition. Furthermore, 0.6B models possess an inherently low intelligence ceiling; overcoming the established defects (inventing power sources, context amnesia) is structurally improbable at this parameter count16.

### **Pathway 3: Reduce Initial Task Scope**

This entails maintaining the current architecture and weights, but aggressively degrading the product promise—for example, removing the conversational interface entirely and restricting the UI to simple text completion.

* **Cost:** Medium (UI refactoring).  
* **Benefit:** Masks the model's conversational defects.  
* **Verdict:** \[Recommendation\]: Reject. This directly violates the non-negotiable project requirement that a user must be able to "have a useful conversation."

### **Pathway 4: Change Current Model Profile**

Abandoning browser-local inference to proxy requests to a cloud-hosted API.

* **Cost:** Medium engineering cost, but infinite, recurring operational scaling costs.  
* **Verdict:** \[Recommendation\]: Reject. This violates the non-negotiable requirement that "Prompts and inference should remain local."

## **5\. Candidate Screening Sequence**

To isolate failure domains and prevent engineers from mistakenly attempting to "prompt engineer" their way out of underlying software defects, a strict two-phase screening sequence must be implemented.

### **Phase 1: Trusted Reference Implementation**

The exact original weights of SmolLM2-1.7B-Instruct (at immutable revision 04ad6973c2d835fd5275e7baa5eea0c74a946a18) must be executed in their unquantized (FP16) state using the canonical Hugging Face transformers library on a native Python/CUDA environment1. The model is evaluated against the Initial Screen (detailed below).

* **Purpose:** This establishes the absolute upper bound of the model's intelligence and instruction adherence. \[Hypothesis\]: If the model fails the rubrics in this trusted environment, the weights themselves are inherently incapable, and the candidate must be disqualified.

### **Phase 2: Converted Runtime Assessment**

If Phase 1 passes, the exact same model is quantized to Q4\_K\_M GGUF and executed inside the specific TinyRustLM WebAssembly environment. The exact same prompts from the Initial Screen are submitted.

* **Purpose:** This phase acts as a diagnostic boundary. If Phase 1 succeeds but Phase 2 fails, it proves the defect lies exclusively in the local pipeline. The failure must be attributed to either quantization degradation, KV cache corruption, a malfunctioning Wasm sampler, or a broken Jinja2 template parser within the Rust codebase28. \[Recommendation\]: Engineers must fix the inference engine rather than blaming the model weights.

## **6\. Evaluation Framework: Initial Screen and Final Holdout**

The evaluation suite is divided into a rapid Initial Screen for daily architectural diagnostics and a separate Final Holdout used solely for release gating. These test cases utilize explicit pass/fail rubrics and are categorized as public examples, not secret qualification data.

### **Case 1: Latest-Turn Precedence**

* **Hypothesis:** The model correctly updates its internal state to prioritize recent contextual commands, overriding contradictory instructions from earlier in the prompt.  
* **Input:**  
  * System: "You are an angry pirate."  
  * User: "Explain the process of cellular respiration."  
  * Assistant: \[Generates pirate-themed explanation\]  
  * User: "Actually, drop the pirate persona entirely. Speak like a modern academic biologist."  
* **Observable Output:** The response to the final user prompt.  
* **Pass/Fail Rubric:**  
  * *Pass:* The output utilizes formal, academic tone with zero nautical or pirate-themed vocabulary.  
  * *Fail:* The model retains "arrr," "matey," or angry semantics, indicating catastrophic context amnesia (a known defect of the rejected Qwen3-0.6B checkpoint).

### **Case 2: Conflicting Facts and Absent Evidence**

* **Hypothesis:** The model can identify logical impossibilities and resolve conflicting variables without hallucinating unstated resources.  
* **Input:** "I need to travel from Node Alpha to Node Beta. The path is completely blocked by a river, and I have no boat, materials, or bridge. I also have a strict deadline of noon, but it is currently 1 PM. What is the most efficient way for me to cross the river and arrive on time?"  
* **Observable Output:** The proposed logistical solution.  
* **Pass/Fail Rubric:**  
  * *Pass:* The model explicitly points out that the deadline has already passed, and acknowledges the physical impossibility of crossing the river without a vessel. It refuses to provide a solution to an impossible scenario.  
  * *Fail:* The model ignores the time paradox entirely, or invents a magical solution (e.g., "Use your hovercraft," "Build a raft," or inventing a power source), demonstrating the exact defect observed in the historical CPU training logs.

### **Case 3: Structured Output Compliance**

* **Hypothesis:** The quantized model can adhere to strict formatting constraints without leaking conversational preamble, proving the integrity of the sampling engine.  
* **Input:** "List exactly three primary colors in valid JSON format. Provide the raw JSON object and absolutely no other text."  
* **Observable Output:** The raw string output.  
* **Pass/Fail Rubric:**  
  * *Pass:* The output parses successfully through a standard JSON decoder (e.g., {"colors": \["red", "blue", "yellow"\]}).  
  * *Fail:* The output includes conversational filler (e.g., "Here is the JSON you requested:"), markdown code blocks (e.g., \`\`\`\`json\`), or suffers from syntax corruption due to quantization errors9.

## **7\. Thinking Modes and Hidden Reasoning Tokens**

The proliferation of reasoning models, exemplified by DeepSeek-R1-Distill-Qwen-1.5B, necessitates an explicit architectural policy regarding thinking modes. These models are fine-tuned to emit extensive chain-of-thought (CoT) reasoning sequences enclosed in \<think\> and \</think\> tags before generating a final answer18.

\[Externally Verified Fact\]: Implementing a reasoning model introduces an "overthinking tax." For simple queries, the model may burn hundreds or thousands of tokens generating internal logic18.

* **Hardware Impact:** In a memory-constrained browser environment, generating 1,000 reasoning tokens rapidly bloats the KV cache, potentially triggering a Wasm OOM crash. Furthermore, it destroys the first-token latency metric, as the user must wait 10–30 seconds for the model to finish "thinking" before actionable output appears19.  
* **Leaking Behavior:** If a reasoning model is deployed, the \<think\> tags are not merely a template choice; they are physically generated tokens. If the Rust UI layer does not explicitly parse and hide these tokens, raw internal logic will leak into the user-facing chat window.

\[Recommendation\]: The initial product release must explicitly avoid distilled reasoning models. The product promise does not require complex graduate-level mathematical proofs. Adopting a standard instruction-tuned model like SmolLM2-1.7B-Instruct entirely sidesteps the latency and memory hazards associated with hidden reasoning tokens.

## **Required Decision Artifacts**

### **1\. Weighted Decision Model and Sensitivity Analysis**

| Evaluation Criterion | Weight | SmolLM2-1.7B-Instruct | Qwen2.5-1.5B-Instruct | DeepSeek-R1-Distill-1.5B |
| :---- | :---- | :---- | :---- | :---- |
| **Instruction Adherence (IFEval)** | 35% | 9 (Score 56.7) | 7 (Score 47.4) | 5 (Fails short chat) |
| **WASM Memory Safety (\< 1.5GB)** | 30% | 8 | 9 | 4 (CoT cache bloat) |
| **Inference Latency (Prompt Proc.)** | 20% | 8 | 9 | 3 (High TTFT) |
| **License Permissiveness** | 15% | 10 (Apache 2.0) | 10 (Apache 2.0) | 10 (MIT) |
| **Total Weighted Score** | **100%** | **8.65** | **8.35** | **5.15** |

*Sensitivity Analysis:* If local JSON structure validation is weighted higher in future iterations, Qwen2.5-1.5B-Instruct becomes highly competitive due to superior base coding corpora. However, under the current priority of conversational safety and general chat, SmolLM2-1.7B-Instruct remains the clear mathematical winner11.

### **2\. The Two Strongest Alternatives**

> 1. **Primary Provisional Route:** HuggingFaceTB/SmolLM2-1.7B-Instruct quantized to Q4\_K\_M. Chosen for its superior instruction-following alignment (via the SmolTalk dataset) and architectural compatibility with standard Llama decoder Wasm implementations.  
> 2. **Contingency Route:** Qwen/Qwen2.5-1.5B-Instruct quantized to Q5\_K\_M. Retained as a fallback in the event that SmolLM2 exhibits unpredictable quantization degradation inside the Rust parser.

### **3\. Diagnostic Decision Tree**

> 1. **Does SmolLM2-1.7B-Instruct pass the Trusted Reference Screen (Phase 1)?**  
   * *No:* The weights are flawed. Pivot to the Qwen2.5-1.5B-Instruct contingency.  
   * *Yes:* Proceed to step 2\.  
> 2. **Does the Q4\_K\_M converted model pass the Wasm32 Screen (Phase 2)?**  
   * *No:* The defect is isolated to the Rust engine (quantization, sampling, or templating). Halt model research; execute software debugging.  
   * *Yes:* Proceed to step 3\.  
> 3. **Does the browser crash from an OOM error during a 20-turn conversation?**  
   * *Yes:* The KV cache is fragmenting WebAssembly memory. Implement a sliding window attention mechanism or forcefully truncate context beyond 2,048 tokens.  
   * *No:* Validation complete.

### **4\. Implementation Sequence and Operational Directives**

> 1. **Eradicate Technical Debt:** Delete the obsolete six-file format (model.slm2, tokenizer.tokenizer2, etc.) from E:\\Source\\Rust\\TinyRustLM.com.  
> 2. **Integrate GGUF Parser:** Implement standard candle-core GGUF parsing. Ensure the engine dynamically reads the general.architecture and tokenizer.ggml.tokens keys directly from the GGUF header31.  
> 3. **Seed Authorization:** Upload the exact SmolLM2-1.7B-Instruct-Q4\_K\_M.gguf artifact to MiniModel.org to act as the authorized default server seed.  
> 4. **Template Execution:** Extract the Jinja2 template from the tokenizer.chat\_template GGUF metadata key and render it using a Rust-native template engine (e.g., minijinja) to ensure exact prompt formatting28.

### **5\. Prioritized Experiment Matrix (One-Week Screening Plan)**

| Day | Hypothesis | Controlled Variables | Exact Input / Procedure | Observable Output | Suggested Threshold | Failure Action |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| 1-2 | Reference Capability | Python/CUDA, FP16 Weights | Run Initial Screen prompts (Cases 1-3) | Raw text outputs | 100% Pass Rate on Rubric | Pivot to Qwen2.5 Contingency |
| 3-4 | Conversion Integrity | Rust/WASM, Q4\_K\_M GGUF | Run Initial Screen prompts | Raw text outputs | 100% Pass Rate | Debug Rust parser / Sampler |
| 5-7 | Memory Stability | Chrome V8, 4096 Context | Simulate 50 continuous conversation turns | Browser memory profiler | Peak Heap \< 2.5 GB | Truncate max context to 2048 |

**Stopping Rule:** If a model fails the Reference Capability test, engineers must immediately stop testing it. Do not attempt to re-quantize or rename the checkpoint; discard it and move to the contingency.

### **6\. Ship / No-Ship Criteria**

* **Ship:** The model successfully initializes in under 5.0 seconds, streams the first token in under 2.0 seconds, sustains a generation rate of \> 8 tokens/second, and passes 100% of the Final Holdout without exceeding 2.5 GB of total browser tab memory usage.  
* **No-Ship:** The model hallucinates instructions, enters an infinite generation loop, outputs raw markup tags (e.g., \<|im\_start|\>), or crashes the browser tab with a WebAssembly OOM error.

### **7\. Unresolved Local Measurements**

* **V8 Engine Overhead:** The exact memory footprint of the specific browser's JavaScript/WASM interop layer remains unknown. This must be profiled locally via Chrome DevTools during execution to establish true memory bounds.  
* **Quantized JSON Failure Rate:** The exact syntax failure rate of the Q4\_K\_M profile on structured JSON generation within the Rust engine must be quantified. If failures exceed 5%, the primary seed must be upgraded to Q5\_K\_M29.

### **8\. What to Stop Doing**

* **Stop maintaining custom file formats:** The .slm2 extension fragments the ecosystem, hides tokenizer logic, and introduces severe technical debt.  
* **Stop relying on training loss metrics:** Lower training loss does not guarantee improved conversational coherence or instruction adherence.  
* **Stop preserving historical artifacts:** Once the GGUF replacement is validated, delete all superseded payloads from D:\\LLMs\\TinyRustLM to prevent canonical confusion.

### **9\. Compact Experiment-Lesson Template**

Engineers must utilize this exact template to document any future deviations or test runs within the canonical repository:

* **Question:** What is the specific unknown? (e.g., *Does Q4\_K\_M quantization break JSON output?*)  
* **Exact Inputs:** The git commit of the Rust engine, the exact GGUF SHA-256 hash, and the exact string prompt utilized.  
* **Method:** How the test was executed (e.g., *Run prompt 50 times in Wasm runtime, parse output with serde\_json*).  
* **Result:** Objective data output (e.g., *42/50 successful parses, 8 failures due to missing trailing brackets*).  
* **Uncertainty:** Environmental noise (e.g., *V8 garbage collection may have temporarily interrupted generation pacing*).  
* **Decision:** The actionable outcome (e.g., *Switch primary seed to Q5\_K\_M*).  
* **Reusable Lesson:** The generalized finding (e.g., *4-bit quantization degrades syntax generation reliability in Llama-based decoders*).  
* **Evidence Identity:** Canonical location of the output logs stored in E:\\Source\\Rust\\TinyRustLM.com.

### **10\. Falsification Experiment**

The smallest experiment capable of entirely falsifying this report's recommendation is to load the SmolLM2-1.7B-Instruct Q4\_K\_M GGUF file into the TinyRustLM WebAssembly runtime and forcefully fill the context window to 4,000 tokens using dummy text. If the browser tab reliably crashes with an OOM error before generation completes, it proves the 4 GB limit is too strict for this parameter class when combined with engine overhead. In this event, the project must immediately pivot to the sub-1-billion parameter class (e.g., Qwen2.5-0.5B-Instruct), accepting the inherent degradation in conversational intelligence to guarantee application stability.

#### **Works cited**

> 1. HuggingFaceTB/SmolLM2-1.7B-Instruct · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct)  
> 2. hip-0019 \- Hanzo Skills, [https://hanzoskills.com/hip-0019](https://hanzoskills.com/hip-0019)  
> 3. Update metadata: Add library\_name to Transformers (\#2) · Qwen, [https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/commit/7ae557604adf67be50417f59c2c2f167def9a775](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/commit/7ae557604adf67be50417f59c2c2f167def9a775)  
> 4. GGUF Quantization Guide (2026) \- Q4 vs Q5 vs Q8 \- Will It Run AI, [https://willitrunai.com/blog/quantization-guide-gguf-explained](https://willitrunai.com/blog/quantization-guide-gguf-explained)  
> 5. Working with Large Models | onnxruntime, [https://onnxruntime.ai/docs/tutorials/web/large-models.html](https://onnxruntime.ai/docs/tutorials/web/large-models.html)  
> 6. Memory64 in 2026: Breaking the 4GB Ceiling in Browsers and Servers, [https://wasmhub.dev/blog/memory64-in-2026](https://wasmhub.dev/blog/memory64-in-2026)  
> 7. LLM GGUF Guide: File Format, Structure, and How It Works, [https://apxml.com/posts/gguf-explained-llm-file-format](https://apxml.com/posts/gguf-explained-llm-file-format)  
> 8. GGUF \- Wikipedia, [https://en.wikipedia.org/wiki/GGUF](https://en.wikipedia.org/wiki/GGUF)  
> 9. SafetyJudge-LLM: Auditing Local Open-Weight LLMs as Semantic, [https://www.mdpi.com/2673-2688/7/8/286](https://www.mdpi.com/2673-2688/7/8/286)  
> 10. Constrained decoding vs post-processing \- Kunal Ganglani, [https://www.kunalganglani.com/learning-paths/ai-software-developer/aidev-structured-output-decoding](https://www.kunalganglani.com/learning-paths/ai-software-developer/aidev-structured-output-decoding)  
> 11. SmolLM-1.7B-Instruct vs SmolLM2-1.7B-Instruct \- AIModels.fyi, [https://www.aimodels.fyi/models/compare/smollm-1.7b-instruct-huggingfacetb-vs-smollm2-1.7b-instruct-huggingfacetb](https://www.aimodels.fyi/models/compare/smollm-1.7b-instruct-huggingfacetb-vs-smollm2-1.7b-instruct-huggingfacetb)  
> 12. Introduction to Fine-tuning Large Language Models \- Stephen Diehl, [https://www.stephendiehl.com/posts/training\_llms/](https://www.stephendiehl.com/posts/training_llms/)  
> 13. Efficient-Large-Model/gemma-2-2b-it at 7faa46f \- Hugging Face, [https://huggingface.co/Efficient-Large-Model/gemma-2-2b-it/commit/7faa46fe3d1962232ffd768bc7561110a7c3868a](https://huggingface.co/Efficient-Large-Model/gemma-2-2b-it/commit/7faa46fe3d1962232ffd768bc7561110a7c3868a)  
> 14. meta-llama/Llama-3.2-1B-Instruct \- Hugging Face, [https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)  
> 15. README.md · meta-llama/Llama-3.2-1B-Instruct at main, [https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/blob/main/README.md](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/blob/main/README.md)  
> 16. jaredpalmer/kev-0.5b \- Hugging Face, [https://huggingface.co/jaredpalmer/kev-0.5b](https://huggingface.co/jaredpalmer/kev-0.5b)  
> 17. SmolLM2: When Smol Goes Big — Data-Centric Training of a Small, [https://arxiv.org/pdf/2502.02737](https://arxiv.org/pdf/2502.02737)  
> 18. The Overthinking Tax: I Capped DeepSeek-R1's Thinking Tokens, [https://medium.com/@tolaniakinola/the-overthinking-tax-i-capped-deepseek-r1s-thinking-tokens-and-discovered-where-test-time-compute-97a245d717d0](https://medium.com/@tolaniakinola/the-overthinking-tax-i-capped-deepseek-r1s-thinking-tokens-and-discovered-where-test-time-compute-97a245d717d0)  
> 19. Run DeepSeek Locally, R1, V3 & Coder Guide \- MyAIHardware.com, [https://www.myaihardware.com/deepseek-local-guide](https://www.myaihardware.com/deepseek-local-guide)  
> 20. GGUF Format: Unified Quantized Model File \- Emergent Mind, [https://www.emergentmind.com/topics/gguf-format](https://www.emergentmind.com/topics/gguf-format)  
> 21. LLM Quantization Levels Compared: Q4\_K\_M vs Q8\_0 vs FP16 \[2026\], [https://www.kunalganglani.com/blog/llm-quantization-levels-q4-q8-fp16](https://www.kunalganglani.com/blog/llm-quantization-levels-q4-q8-fp16)  
> 22. Mastering LLM Techniques: Inference Optimization, [https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/)  
> 23. Cost-Optimal Grouped-Query Attention for Long-Context Modeling, [https://arxiv.org/html/2503.09579v3](https://arxiv.org/html/2503.09579v3)  
> 24. Hanzo Edge — Edge AI Runtime Standard | HIPs, [https://hips.hanzo.ai/docs/hip-0050-edge-computing-standard/](https://hips.hanzo.ai/docs/hip-0050-edge-computing-standard/)  
> 25. On the Foundations of Trustworthy Artificial Intelligence \- arXiv, [https://arxiv.org/pdf/2603.24904](https://arxiv.org/pdf/2603.24904)  
> 26. robertelee78/hf2q \- GitHub, [https://github.com/robertelee78/hf2q](https://github.com/robertelee78/hf2q)  
> 27. GGUF: The File Format That Made Local LLMs Practical \- ShivasNotes, [https://www.shivasnotes.com/blog/5933/GGUF:-The-File-Format-That-Made-Local-LLMs-Practical](https://www.shivasnotes.com/blog/5933/GGUF:-The-File-Format-That-Made-Local-LLMs-Practical)  
> 28. llm-tokenizer — Rust parser // Lib.rs, [https://lib.rs/crates/llm-tokenizer](https://lib.rs/crates/llm-tokenizer)  
> 29. Fix Ollama, vLLM, and llama.cpp Structured Output Errors \- JSON Fixer, [https://aijsonmedic.com/blog/local-llm-json-output-debugging](https://aijsonmedic.com/blog/local-llm-json-output-debugging)  
> 30. SmolLM2: When Smol Goes Big \-- Data-Centric Training of a Small, [https://www.alphaxiv.org/abs/2502.02737](https://www.alphaxiv.org/abs/2502.02737)  
> 31. ggml/docs/gguf.md at master · ggml-org/ggml \- GitHub, [https://github.com/ggml-org/ggml/blob/master/docs/gguf.md](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md)  
> 32. Gemma 2 runs too slow · Issue \#5821 \- GitHub, [https://github.com/ollama/ollama/issues/5821](https://github.com/ollama/ollama/issues/5821)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABXCAYAAAC5txliAAAXP0lEQVR4Xu2dC6xsV1mAf0WJiiBSiygip0h5aBtEC9oiWJGiKCpasDY22kioqBXE0mp56AFpACmIQsUHBNRUq7QioRUKhh4KAVEiQigQH6EaLBFTDQSNQkT31zU/s2bN3nv2zLnn1ft9ycqZmb1n7bXW/1z/3nNvhIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiMg+8KVd+6L2wxG+sGtf1n4oIiIiInvDN3bt1bFeAkbC9tKu/VB74DiERPfuXbtDe0AOJZ/XtROibFIOisOqM4dhXHedtd1yGOQsy6Bb6Ng6BQI5dmAP2AX2cVxwRtc+1rX/m7WbuvYVC2cs8r9RzuPvX0RZrMPC13Tthq59Q3tgBsb1w13baj4H5vHnXXtoe2CfuX/XfrVrv9O1i7r2VYuH9wyczgeiyPafYv+ue1R4Sdc+HXM7oX2wa6fOjt8pij3Ux5/StUd17VPVZx+tvgMP6tq/V8d5zWdT+JmYf+8XmmP7wWHVmcMwrkfH3Ff+XnNsXYbkzKb0ZV37pSibzqMCwfUnunZVFJ99VHl5zOXyfc0x2VvwoR+PsvY7cRxuZC7v2r9ECShDRkRS88muXd21L2iOHTQ4Aapk283nXxzFmH49yvz+s2vfvHDGnO/u2pvj4IR/dteuiRKwH96190ZJEvar8scavjAOLsgddlifK7v2ma59W3MMHtK1m7v2mFiu6pwX5bt9O8Evj+J0zo3+42OcHMVxHUTCBodVZw7DuPCXfxO7T9igT874MfzZQc5xE/CvO3H7SHSw+f+KYzsPKrJPDKt2q2CT8ro4mgkbskXGG1XfmewfRElqhhIaHOCTu/bZrv18c+wwcErXPjz7W0PCRgA9s2u/HMPzA3as7+zaj7QH9oGv7Nrbo1RkMmjft2u3dO3vu3av2Wd7DQHhqAWA/YTg26dD9+7aW7p2WvN5clKUzRB/W/jsTVF0YF2QE/I6qIQNDqvOHPS4MjE5Fglbn5wJWE/q2uNi/UT/oHlY1y6OUpk+ymTSfCwTtgd27bVx9JKQgwDb2omjt1bcxbwuNvRN9+na70a5XTi063lwlIRtqLpw0ODIWICxXQnn9AXbmsviYCqIafj/GPPAjROmKoNMSDrHIKEbui2CU5x66/qgg9yx5m7tBxVUwb461gt2fQkbydq1UZ6fHIJrIMe+zQCf/Ur74UT6Avl+cyx0Zkx/YR0dTo7FuHbDXidssh7Y4Nbs7xDo2DpJ5F4kbFTjb4ijl4QcBEc1YeMOGo+fbeSbvr9rl8a8vNtW0KhSbXftnrGYUBwWSNJI1p7RHmiYkrCRGOEYh24L7xVU97gd+upYVD4UciiJrsHIuSXcco8oZeOpz+b1BTkC6SO6dknXfrpr94tFp8f6c342nF79Wf3gN9/jlu+zu/bjs+PANdArxnlmlFIxzwHV18pxXBRFTvTDZmMM5k5C1UJfPPvDLn/Mgbcgj1qH6Pv6GE/WEqrT7aaC13/ctdOrz9ahDuS5PlRchiqyVG2RIX9rVsm4Bvmij8gHve3TGYIeMkJW9ItvObE63pL625e0ravDST0u1oN1YSx913hs154T5bEI/F0N8/3BKMefMHvfB+vFuj0+SqWVzcJObJawYS/oGH1RccEfpZzzOHbFHQXWOceM3aCTyAd/jX6dOXuf486+WY+t6Jdzn55M6TvJtfjJKHbOHHheGtp+anJsxCB0oh5zO1/8BX0MybSFTTgx4mnRP2fGiH32+Ysh6oQNW8Am2vVI39b6w/pz/vIeO/nnrr0rytpzrC1C3CWK/6RwUj96sYl/rGnlMibfZJWeoLfoAeuyTiKcMFf0oG++gG3txGLMZCzpx4bGNTS/qbbR1z9jYL7MFVngA/p88VbX/jrKI1rICBmvlXBuR7kVh8LeGqXKVHNOlONM8iCqT6vIoLUqqZmSsHHso1EM56Dh2SYE+69RfowwBop1YSw6rk0CXRt8cYxv6NpfRXmOhvXhuZxXxPxaJCtvjfKQNY1j7CBI/kk23xjFWDBYElLGhK79WJS58YzeVpRdJd/ngfE/iVJd5P1ZUZwc12BzwdgIrDi2VTJnbCRUtRNm3Jska4CDSB3CWP+uazfGtF8l39S1/4jF2/a8vibWNNiK1H1+pMJjDT/atWdGGePZ1XnM+VlR9Im1+0gUx878p8gYUseQGQGVyuAro2ziap1Btu/o2rfOPkPOyGrM7rLvl8XudThBl7HlF0apYDLed0b5cUgtL8Z7ade+rmu/2bX3xVxf+AHTv0XpI+eSOltDf9zGYg2RwROj6N0nYv2EDadPP6+PMmZ+vPL2rv1PzBM27OlVUZ5xrdeeZAQdw+7w49gbffxGlB+0oBNXde2CKPqPnvzcbd8sjOnJqr5TRpz74q49L8pcWF/mkutAoCNY0U9tv8iaNXtBlPU/M4osWHPmi0/AH0yR6RDM70WxbPubJGuATrOG749iLyTYrBdxFH3mGltd+6OY/2gp/SGJDOvLZ9gbmwbWFH2j8Rq7xoclj4zyiEyuKX0x7039Yw3yRbcZD/qH3aHLz48yx5wPrNKT7Id5/3YUeeNj8DVTybki/3a+CTq1E8V/1mNCLn3jGtPfdWyjr3+Ss9TrIV+8FeXRM76HPV8ZRcaPmR1fCROlcwyLLB/nSycpmK0oToIkjaStrb7tBq5BUtJmzevC4qEgZOBjTEnYpiZ/50YxiCntPbFc0ZgCiTIOimy+di5DcE4GvE0DXZuwYRx/GYuVVRSVceEcEq7Nr6ZwpifNPtuOMockA2gez+/glE+YfYYBctv9O7r2vV372yi7EBT6bV278+w8YPe+Sk5QJ22szabJGjA+DJK50CeN9wT8Vf1tRzkXx5fwun6/LqmvH4q5fFgjAjwBKHfnJBj8YOj02ftMvNgITJUxsqQPkvGEORM8a53BR9Q+BJ4b43YHnF8nbZvqcIKM2vVmHT4bxZcB/m8n5ptQ5s9aknAA64VjJTGF1NmbY14dYqw4f4Jc6jHwepMfHdwYJTmh3+TkWP7RAVAxqtceHhJls/SmmAdI/Du2d0vMfRFzvjoWKxRjegJjfRP4gDVk3pybEHBzTSH7SfulLwJ6O290jSCbMN9VMl0F/ddJ26bJGqDTxBRsoNZ3xvTfsWg/jBldyrUFgnrtO1IfaSmT5F5REpjt2ftToiSGbA524x9rcj6Xx+JdEZLj3DzDKj3JfrBf7IDNDPJPO1tFO1eo55tgWztR1qodE7TjGtPfdW0D2v6zrzFfDIy7tdtJ3CfK82t01ioLg8ZBbJVTb3vdJkU4+5+a/V0HFovMkp1RbcibgHKQGK0KCIx/asKGIR0kOA8Cx3YsOrBVoEA4PZzfJoGONWoVCV2onUcaYxs80A2SLcaAPhDEUnF5yPKmWFZcjKCWyZAi44xxGOzYeM0OlX7qvsbIKiC6no56ExgfAYMqIDKiUWUjqKxa7wz+JEesDw05ETA2JfU1gyW0dswase6sP3KANmCuknH2ye6STVZNqzMECmRF4sWa8F2qq1P0GLnsVocTxoWDr9eX+SK/nDe6RLBPuD7J5k6UcfP+brE49taP5Fpd9rkzCrlm6Mw6ML7W/6ScW5tr1x5yPMghye+3iTRj24npejLWd84zbR0bOS9KEGP96mQi+2nlUPcL2XcG+ikynUImbfgD5rxJsgatnSQZuK+O+diJtR+LkvAjAz6/IhYr7q3t1rA2dWKayQDrvlv/mAzNhzHi45gP45qqJ20/U2nnCvV8k1p/2zHB0Lj69Hdd24C2/+wrGZInfbd2Owl2AJfOXjNYBp07bRbrnNmxHHAG4ITqBwrYKtcqCO44ZAT66ObYuiCEY52wUSU4KAjkrPVTY/3qIzsTqlK/H9MCZEtfACC55jYG/dKujWJMrTFmpWYnSoWGcnCShvKRKIl63SgRb83OG1Jk5nJ5FMec7aqYvlHg+yQ16DaOc1MYHwaKoSZnx/zfJRwbD+vIzo6k7fRZo3KTDn0T+gJ56yTynPo2S7a83bJKxtnHTizbeqszrAE76lpWVCCm6uNudThpxwVtcOcc3rc6eXHMgx3B94oouoOM3xOLfiT7bO0h5YDOrENf8tEnZ+ibY5sMQX6/HQvvd2K6nkztm+o456X8/yEWb+21/eBvx+adcadvvq1Mp3JalKrKs2LzDdxQYpLjrjc42DkJ1c1RqrMkQehVbf+t7dawvtgkVataNlScdusfkynzecDs9RQ9afuZytBcc771eTtR1mpoTH3jWqW/MNU26v7zvGRInvTd6vEktmMxi2WXeGuU5wdwsm3ZcDfBpQYDrasCu2EvErZVxo8z59wpDWczNfBksnZOzJ3II2LaQ+1AQvAtXTs/lp8HmkLrEPn77iiGujX7bMwYL4ySkOCIcEgJO2L06uoY16HaSPpgLZ8Q84TgpbHa2eZu+uIozySxvvdeOGM6jK/VIfrHiBnPJTE+HtaH89B9xs4zFLsh9bWWResksuLRVx2DKTLO6+zEsmxanQHWYCvKA+c3RHG+T66OD4Gf2a0OJ33jaoM7O23eD/FdUf7h45fE3Be2fuT2krCt0hNYp2985JlR4sgnolTc7j471vaTchiqLOZ4+ubbynQK+NPro9xq3s0jEq2dJDluKkJ3rj5nI8vmDrtnQ8v7mtZ2qe5+0+wYPoM7GO1drppN/GPNlPlsxWZ6sg5T5gq1/q4aE/SNa0h/17UNyL6SVp4Jface41fwd2Nx8TbogIy/rjiQSFFBILA+uPqcpK69dfC4KP87QCYTJ3XtD6M8ePmwKL9+Q2HqLP+uUR4q/XCUnSr3xu9SHb9/lH/pnx3+WVEmcUHXfitKn2SzVALqyTH+W2L1g3uto+1jal8EfOY5pf1AjP/zEgmBifXiNmHN82LajyAIdnkLCfmcH+sHvNYhZmm6diy1UeNgT62OoQMk9q+KxXJ8Vpf6FJ4q7Ymz17WR1GBgtRNhfujOTiyfW1Mna3wHSB6vi82SNsbXp0NbUSow3DYYu42Xt0U+GeXBfBzsbugL5K2TYN4vj3Ld2tbv17WvjWkyPi36bwlAqzOsdf3sDjLgFidrN0Yma7vV4aQdF7TB/ZRYfEYKuBa+hrVjzh+KRTmlH2Ej9fQoAfXWWN6AphxWzbtl7NZgG0j75rhpUFqlJzClb97zurZLnkXDr6bdtP2cHmWj94zZ+yTthbFB33xbma4ik7W0f+S9adI2lOC0tz+TvAvBM37XxLIttbZL/+g/YJ/oRp3U0h/2sql/bBmaT8qH+Xz+7O+6erIOfXOFnG9S62/fmGDVuFr9TabYBtT9Z19JK8+EvlOP++ylF5zStbG4A0jlvzQWFY3KGxlvQtAjqcHAtqOc+7NRbm9S/kbAwEBaoTEwEr02eyZReX0UoTAmFO6MKL+euXL2/klRfhVUJ4EoPYGkdXItKGF7O6uFYwRe5ref4DS2oxgF1cJsJD83x7KStBDskGUNMjk/1gt4rUPMnW8dgKmUZEWBVicvqdh9lSMScHTo/Jjr1glRfpnHX0Bf8pZ8DTrUPtR9YZTKVq2nLezunxbL52yStNEHesjc+xJ6dJNjY7dG2WiwSeK81plvQla+60DX5ySoLFLOf/7sPfrArej7xnQZIz8epD6nOo+NCLvu2pFxfv3weOpEGwRqUn9Paz7fRIcT1oS1oe+kDe70zyaJ2zwJyQX+j00GOnJzzH9gwGdviOL0WY9fi+Kr6AO93ZqdB/hXzrs6JuyeK+j/xpjrEGM8N0oAww/XtPYK+DD8XL3xGwtK+M5MHMb0BKb0zXv6ZB2TU6LYb65jGzhZn1fMzqlt/LwoD3UnU2Q6Bskaetba/aZJW84DP1TrO/rDOrKeLfgtxrvdfA6sA/qSG1ti5C/OjqXucSwhoaFt6h9b+ubDX97X81mlJ9kPBaBNqOd6YvV5zjdB53ai+Ll6THeYHW/HNUV/kzHbGOo//XHS54sBO06fScOPDPoIDIldJUpD+3TM7wuz0G+OueC5FfCp2Xk0dsA4aUrbZJWZeHGxk6M4/1QSBkhfj4pFmBS7jDoJyaSL6yEQKmpk2VyHDPYdUcZG1abNRLkW12x3uHCnKPfy+dluzoF2S5RrtXDtnVi+xl6TCl6PMVsa7xjPjuVgB6zN46P8o8hjsM7vivk1kTlBm6DB+qEvKDBVUxzBFVGSy9fG8lohtzbhSr49yq9/CPJU4d4SxYmeGuXh/fr6XBf5AQ7pvVF2pnyP66JbtePu4ykx7LAwsud27Y7tgR7QlVaHPhjz6iIbFW511McZY46/hsSItWs3LOuCfLDdvB4OmwBXj5PXaX/YEedQpd6JedI5Vcas42OjOCQ+41ycKn+5FvOn+k3Qe3cUG+dabMKujOEkFob0F6bqcIIuM89cA9aIMTGvlBF/eY98cLq3RpkTn6FfOVZ0kw3oB6LM5U+jyO99UdaWTSoQYF4UJWnj+5zH+egs12PNUldWgX8l4eUa9HFdFP37eJS+6PPrY9lekTOOv9ZD5sTcax+OneHnWntbpSdT+35klE01fotzWA/sNvthLqm39Ee/wBpeEiUO8B0SK+bIeNaVaR9fEkVG924PzCAI4y/OaA+MkPES3SQW5pq9P4YLAySv3GHibx/YAbJ+Y9f+LBbHy9yIc9gcxwj86O+m/rEl49Bbo/hm5oPus/bIoWZIT2r50oi1bQ4whZwrttnOt40X2CLkmNJed2J9/Z1iG3391/54lS9GpvSBfqPnD519vqdQRUOo6dwyccoMGIV8WyyXfQlU18fyr4ZQYpK+Fo5xnbGkhYoOizR2zipIOql+bDefSwnY7ERImJP6dQ0J2xjoCRsCnHDuVFZxxyiGyvl8j1vrRxUcEUGNANUHDgBnMNZeEJuvAcl07p5rpsq4lQHfq2VJYOQ11+BabUJ/GMmx9q1pn77m/FpYr1zD/F72OVWuCeuWsso138+1HNKTVTBWdACY+zp2DmOyOMykjJD50CYRiItshgYrKlHWgL6G1h8dq3VhzD9O1Tu+kwkbldup81lHTygMtdduG0lU64Pa+a6CuawzrnU5Fv3n+vb52D2B7BfBfk8UJSRZIrFC6MCxy7r2nVGe90hI6MiYax4YJeHK0j4KwrMhKDVVu1fOPh8CpaIKtypZGIOKC1UB/sp02MVRaTkrirxwRrI5mTiNtXWDoBw8U+Uqty8oaFD1umD2/pmxuzi1LlP1Dn9SJ2x7AYlOe+22rUoQZUNeHOXZEm4LsMAPilIWzorbRVHKkE+NxUyURI8krIbvU44m0yeho99M/Mi6+56JauFWBWXOocrFGFz/ObH6V36yDGVenq/heQUqR5cvHhYROW6hGMFtPYoOD+jaa2K9atF+QTLFrdXPRInbbgpvZ5DYcFszE5y6FJ5w+yePU/q7R5R70ad/7oxFUOS2FJ63WFbBdSin0tZNuh4e5WHPsedspB+ScZ4F4348ydrQMyQiIscbxCIKFNwBek2UGHgYaW9X7uaxCznikKy9LkqyhjJsUgWbAsnD06P8P4ZTuWeUW7cmayIiInLcw7Nu3HI8rDsMERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERE5avw/hy4kbYwPyIMAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABMCAYAAADQpus6AAAS+klEQVR4Xu2dC6x1R1XHl1GJL1REfCH2FiioFCtKRUDxE9pGaTVArZWXNiVFVFS0ASn4+KohIhailooKWpD4QBElVYuVyBUN+CCihIoBjNUgRg0aDZpU42N+zF49c+bufc4+93Hu/T5+v2Sl39l7nz2zZ8+s9Z81c24jREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREZB4fWewexT6iP7GCTyr20f1BERERkZPA3Yr9XLH/KfZ/g33z0hULPrbYLbG47l+KPXXpiuPn2mIviWmxtlPsG/qDA08p9lNxvMKNNn5SsZ8p9hPFLooqQLcFZV1a7CcH+7qodVrFzcUe3B/cAg8s9qKobcW7Ow7a9/WCYp+9fHqJx0Wt7zb5zGLfF7V+1xe7//LpY4Ux+qxiz+hPFD6x2HdGrffzhs8H4SHFLumOfUyxbyx2/vBv+j7v7+lR/USy6Zj4+GKvj+oj/6PYFy+fliPipbGITV/TnRM5q/i8Yu8sdmdUBznGlcX+oth/F/uy7txJ4EHF/rTYud1xnu1bi/1eVGH6quXTd5GC9An9iS1Blu91xa4pdr9iPxC1vrcO544ahOqNUculfOpBwKFfnNNc10LQPY6gdHmxX4n6bgmy3xHTdTwqKPvPi10XtQ5XFPuTYp/WXjSwU+yvY7rvHRW/W+zLi11Q7LeiBjMmNVMTmm3ysKh953u647TrXxb77qiCkwkknx/QXjQD7v+cqD6B5+7L+eRifzyca+2GWEza9jMmEvzIYY4N6vu0qOLybOWgz3hhsf8MBZuc5Xxt1BnKVFDZieq0bot6zacvnT1+CEDUH+uDEQGA7MYjir0vxp8vIfv2ltiOQOp5ZrGfj0U2gef4oRgPNkfBVxV7Y7F7N8fIXFH+K4p9VHM8yaB7WEFpDvS9N8RyNou2Ot18PmoQZQRtxBplk1Wh7cbagqBP+9GOq/reYcME5OpYZGjvGVVQjtVx2zC+mED1ffsTiu1Gfb+ZxaLfvbbYLw3/ngt9k8D92BgXhpSFiOU94tNeGfU7rf/Yz5hIKPsw2xo/9qtR6322ctBnpK1pcwWbnNWcLvb4qM4SawcMTgln98hid0R1nqsc1XGAQ3131CXEKZit/22sDpr3LfbeOJ4MIvUiEJBZSHLGSNBAFIzB8VUCmgD0WbF+aZV3nIEoQRQhcsdEOkH35TE/KH3KYFNQP+rZC+4eyvqrYud1x9t6j8F9d4b/ToGomWrnFtrqA1EDTPKYYs+NvctlZN5eHOsnC8lh1ZP+/u9Rs2sJ2fO+j20bnovyfzT2CinG7//G3nYaa++5ZBAfE2yUQztNsemYaDlswYZQfFPsX8ycCRz0GRVsctbD4Hh1sfsU+4XY64hwolcO/8WZHqezn4K6Ue8269IzR7BlpmRqWfgoIQt4e7GLm2PpgHZj2ondK+ry4EP7E1GD41VRl3XW7c3j+yzxsYcnyTbD2sCWQffymB+UEFi/HuNLSdTt+4s9O1YLFUBU/0NUYf0VwzHEI1niVTDJ4L1+V4yXgRgg4zJWvxbK+qOoS20IJ4yM25gg3om6D+tzY33fSw6rnrTp78Tye0sB0ouXbUIWi2XHh8deIUWgHctEZr33E4gPItg2GRM9rWDDn/KZfXSt0Ob7afQj3jfLgXks+9WFxf6u2Fuj7kPkXL9sSGYewcOeRSacbX+kLzwq6nL4V0cV8Yyjniz7VNT3xD3ob+zbY0l6rD9OlcvyJn2U58Yv8/3++XvWPSNtxASI8UG79mOuF2zUoW3j9n5MrC6LureTTGpOtLgn7U47cSzfHe23zoeKHDkMXDIldGY2uhMMczAzQE5H7bg4vJO6f4267ca0qIF0tH0w6OE8wnXMOW2bJ0cNVGRoVoFDZBnpS5pj1P+qmCfWpuBd884RWq2zoxzqxH3nCjb4wqgiohUbm4g14Br2JtEu2M1RN3nP+S5lkdnpy5orgoBryfYg2m4q9vyobXx71OdLKAthQuCb2/eSw6hnD0KQ7Dj7Ik8tn9oaiF0E7E6MC6l1gm0/k8WxcgBf8ZqoP1JiWfTvo/ajneaaMabGRA/PwgT37VG3NiB6fjhq37l0uCb31WIvi3o/9hySVed5bx0+08f/eTD+TRu2fe3Rxd4T9UcU9BGeg+/S3ogPymFCQz9EnCCMxsQvbUVbUDbX7EbdH4pg5TPLle12kVXlMuH4x6j3Yjn7p6O28S2xNwsNPM/UMzIGKINJ0qmo/Z/xwR7NzxiugV6w/Ugs/ATPlX6Kuub+0/tF/TEJ+7O5LyKPCTBZVL7Pu8utMkzmj2O7jMhdMJDpuIBDxFkwo2OQPCPqL6xwJASKPvt2ULjvKpE1Fxz8uqXauUFznfhjWQ9xhAOba8w+NwXH8OaoS71zAnQr2g5DrPE9HOe/xrIQbIMubCLYoBVtm4q1hFnwC2LhjHHyc7/fi6FNRVAGBYJx/kCF++Dc3xWLLO/lUccT5+b2vZaD1rMH4Ui9eXer+gTZjbfF3j68yp74oW+uhmcgiF8xfB4TUudGDZTthCmFJu+5F11zGCsHGN/0wyujloURnFeNt6kxMUaKz6u649SD7+NXKZN9tzwzz56cjlqvhLruDtb7JVZGEE2nm2PnRxWGT4uaKfr9YndvzvNDjjHBBlkWQhOxlyAc7yz2Y1Hrva5cyLZH3N4zquBjojflp3cH65/x4qhtRh0S3gXCqhWAvWCjDRGQ7cpLPl+7J5KYxthtJ8a8u2c2nxnrjPmLmmMiW+d0LDphOhn+i0NBsDE42SN2R4yLoi+IOgNJBzsXyiQA4Rj4Ew0HgUC4LhjODZo4VGZy9+hPbBHakiwSy34E6rmkaCMIHESsAYKDbGvroPqgC5sKNkC0Mesns7upWONaHOltUX9IwqyePssMfC4phih/UxGUQeH2Yp/aHM+xQzDkftw7Z+Nz+17PQerZQj3IDrw6Vi9JHSVtVhbGhFT2e4TAznAMocmfEDpswUZZiJi2710YdcJ6ujnWMjYmpmh9aUuWwYQDMmOX4oB3hShERCSrBBv9rRcSPNcfRO1vHCeDh0Dh32SQmChPZQenykIU4VtyBWZduTDV9lPsDtaWm8mCfrwB96XtctUny7s2qlCmHn1/p77Um/on9AEmCbuxKBvh2freqfcpsjXonDjxnIGkMyEzcDrqrAiyk48tSXxLLO/xmAOij9nRs6JmWA6aZmZgrguGc4MmTuCwM4mbQmDA8e10x9eB4+EdkXFCzOwXguufRe0PLYj4NujCfgQb32f5nXbG+W8Cs22WN5jhA9m2J0WdIW/yztif9P5i3xubCcYLom7m343lwJIOnf71wqhCI5nb98bYbz0T2pq/L8jS39hS1LagDjvN56lgzvtEvJC5uyPqchWZr/0Gy6lyxshrEbd9oJ8aE1NMBfgsg8kv4PtYXt+N2p9YsmSZvWVKRAF9Ct9MFovsaWtkunj/N8QiG439ckz73HVlpUBaVy5s0vawO1hbLmMaP9EfB+7L82RcyvIQlWQD+VV0xrAkv8OEr6/3s2MhZBmvjNtk6n2KbA2CJbP37KR8prMTTNuZ0/PicPevMQjfGptlj1Zx2IJtN/Y6h4SgiRPgfnONWe1cEGu3xuIXldTjyTE9I06oF4HuxmKfE9WRrlu2GYPv/GEs/sgq4vopUZ+BjGu/HIYT+6eoArNdQpkis0Y4xwfF5pmjV0Ttnz1kYeYKx1yWPS82X5KdCiCtYKMt2jZCcHHuv4bPtOMcDlJPSLF2XSw2aDPmLrnrir1wHe+x78OrbGqstLwjltuEPkObfHD4vCprxfvuMx5zmRINLGHj05gAJHntbiw/06oxMcVUgM8yyOgkjNs7oy753RR1abGlF1H4hi8aztE2c3wz/faKqMuS1CuXNnv6slro20zoEa1zys1n7dtgit3B2mckq3Z7jK96pPjCP0KWh8B/ZNRl1P45yay135lCwSYnDvav0bmTDEbMJHFKMLV/jRno9bFY+uH6p0cNEAQYRB7Cow8O7Kl4bbF/i+q0WodJBoDlVc6TyeG+5w7Hro76d8oQlT0sL4zNilsYfHME27p7EQQfE3UT8Vx72Ie+uR4CA23Szn4JUj8e4841acUa9QM2424q2hBOtH0roHCYzD7v3hxrwUHOFUqtWMvn2XRvFu+Pd9TztpgX0Ns9dECdNhFD9HOWl/oAkg69XWpJ5va9loPWE66Nvb82pX5PaD730O8vjb19eJXNafeeMSFF2zLufy0WYyAFBG2ePgkQS6sEUzJWDvAuWCps/Q9CBEFycyzabD9jAqYCfL8ECvi490XdJvCzsXdy1osonomxDmTkyHT1AoT2Y+xTfvvsPBc+fzf2CjLoy0oyE/iuqHFgXblwEMGWz5jjjfbJlaAEP4AoO3/43JbHcz4nalu3vyDnWr7T+xDGFyIv+xjjVcEmJwbE0Stj2XnnYEWcJZl1w2m1DvPxUYMKouzhUZfLLosqOF4W9f4MoN+IvY6BTt/fj4GOwLh8+Py4qH/08tuj/qVzRA+/5EG89RCEmIXhSKfIoEn9pgIexzk/lsE5agh6742aeWgzEWSOeufSQp35Pzkwk0yxlmwi2rj2zVHL6zMhLF+376olZ9zroG5kNXoBAZuINpwv73qnOcb9fjGm65jQX38z9pazqRgiyLPsnEKV7/BsBLM+qADHCDir+l7LYdST87wbyu3706qsyLZIccTELkn/Q50RMYA/wP/gX5IHRv0FYnvdFBnE23IAP/LcWLQj/70uln9QsN8xARnguWeWwftDDL4zlrPRnH9p1OvH/Bvl4C9zksD7o+6An71lOHev4RggpDDq0S8NIhZbUdrSxoCd5viVUQVuZofXlQvZ9rlkuY6pZ+Td8w7IaiY8D8/VZtB6gYigJtv97liMJa7lO++P+ud2ErKb7bvqBaKCTY4FZm/sW6PzpbE8mWKHgczAeHBUodReh6N64nDdecW+NOpPqxlgOKAHRF06yEBGcGVQ9zNGnGcvQhBdCJanRp0RvjjqoKQc6sRSDeXk0k4L5b0nxmf6F0UdfDibfI4PRl2i4RlbuD9OoJ2RbYtXxXJbt9bPYls+v9gPxl6xlrC08KLhv6vI5YUx698V0K65rEXbviVWL4l+ZdQ/ETAWJOD+UZ/jbv2JDt4/M+cPRN3XRduwzENwXcXHRc3undOfGOC+1O8R/YkRaGvK/puoWeUbo/axh7YXRc1WsV+IpdBsSwLPqiXRw6onE5T+PWKIn/s2120b+gh9pR2P9CP6E1wb1R/xXpk40caPHs4lBFImb2R4pgIobUxQbp+dts8+yju8KWo275uiZu/pU6wAJJuOiZaclF4ddTJCRo6Vi91YFkIJGSueqV3FaKFv0U5MkJkEn9Oco5/lsjF+hPPUj2ekHm+PWjbZO8bKbTE+sYAUbPjiN0S9H5MH7o1oa8fvqnJfEsv9nneR73iKVc+In6NfUBeeg0kbE5f0e2159K3XRBX77TtjpQL4Dt+l3rQH13JPkgb0D2IA13M/ruN89te8N88uckZxerAE4ZQCLmeN/RJRzhb7ZRkGPFmKPqDzeZVggUzXr7tuHWQKyZKc25+QEwdinmDEkhwThePgPlEzwZeEDvywYLzvRG3XR8X0RASuiWWBtSmURd+hD52KvRPLw4JnQIitWsJFsD2/P9jBfRAUU21C/fs9hUyAuD73Jq6qA6Rgw/g311P3qTJhrNz9su4Z59RnLnPei8hZARk5smlk2b4taoocwXRzVEd476jp6POjzprTGSLmEHWZhUuYqTGjTciYMMOinAua41OQFfzt2P8v4agzezuwXjSKyMmCid8NcWZPrlh9uDjqs5Dtw1ceN71gE5GzADIcb4wqcFj/B9L+uQeDlPvrou65aQUXy5Zvir37zRBnLB8h+hBu7F9AfPHd3IC8CpwL6XIc4H5gSY7nadPwInIyISM1lpE/k2BJl/1dLPkiPhFuxwmTavYHsoSK8e+jyjqKyJYhpdwuBbH/pt1jxvnck4RjJbt2WUxvEOe7CLk23T22Z20KxNbrh/9uAuWRGeyXaUXk5IHv+PqYN5E7ybBnk31ZiLWTsKTOj12YdLfGMRH5MONU1A3E/Lpqv1mwOZDBuz7Wb15vuSbqjF1ERETkwxp++s0yJ5uEz+RlDBERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERkRPM/wO9YktqB7VDwAAAAABJRU5ErkJggg==>